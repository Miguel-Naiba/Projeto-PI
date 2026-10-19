/**
 * Detecção de saída real da rota pra disparar recálculo automático —
 * checklist Fase 3, P11. Reaproveita o que já existe (GPS, ORS, TTS,
 * estado da rota) só decidindo QUANDO chamar `solicitarRota` de novo; não
 * é um sistema de rota/GPS/TTS paralelo.
 *
 * LIMIAR_SAIDA_ROTA_M — a especificação (checklist) não define um valor
 * exato pra "saiu da rota", só pede pra eu definir tecnicamente e
 * documentar a justificativa em vez de apresentar como requisito original.
 * Decisão: 40 metros. Raciocínio:
 *   - GPS de celular em pé, ao ar livre, normalmente fica na faixa de 5 a
 *     20m de erro (ver PRECISAO_MAX_UTILIZAVEL_M = 120m, que é o limite de
 *     "baixa precisão" já tratado em useLocalizacaoUsuario.ts — bem acima
 *     disso) — 40m é grande o suficiente pra não disparar recálculo por
 *     imprecisão normal de GPS nem por estar andando na calçada em vez de
 *     exatamente em cima da linha da rota.
 *   - É pequeno o suficiente pra pegar uma saída de verdade (virar numa
 *     rua errada, atravessar antes da hora) rapidamente, antes da pessoa
 *     se afastar muito.
 *   - NÃO é o mesmo conceito dos 100m de MAX_DESVIO_ROTA_METROS
 *     (avaliadorRota.ts/roteamento.ts) — aquele é "quanto uma ALTERNATIVA
 *     de rota pode ser mais longa que a rota base pra ainda ser aceita no
 *     cálculo"; este aqui é "a que distância da geometria da rota ATUAL a
 *     pessoa precisa estar, de verdade andando, pra contar como tendo
 *     saído dela". São números parecidos por coincidência de ordem de
 *     grandeza, não porque são a mesma regra.
 *
 * DURACAO_MINIMA_FORA_MS — exigir que o desvio esteja presente por um
 * tempo mínimo contínuo (não só uma leitura isolada) evita recálculo por
 * oscilação momentânea do GPS perto do limiar. 8 segundos: tempo
 * suficiente pra uma leitura ruim passageira se corrigir sozinha, curto o
 * bastante pra não demorar demais reagindo a uma saída real.
 */
export const LIMIAR_SAIDA_ROTA_M = 40;
export const DURACAO_MINIMA_FORA_MS = 8000;

export interface EstadoDesvioRota {
  /** Timestamp (ms) de quando a distância até a rota passou a exceder o limiar continuamente, ou null se está dentro da rota agora. */
  foraDesdeMs: number | null;
}

export const ESTADO_DESVIO_INICIAL: EstadoDesvioRota = { foraDesdeMs: null };

export interface ResultadoAvaliacaoDesvio {
  recalcular: boolean;
  novoEstado: EstadoDesvioRota;
}

/**
 * Função pura: dada a distância atual até a geometria da rota (já calculada
 * por `distanciaDaRotaAtivaM`, que o app já tem — não duplicada aqui) e o
 * estado anterior de "desde quando está fora", decide se já passou tempo
 * suficiente fora da rota pra valer um recálculo, e devolve o novo estado.
 *
 * `distanciaAtualM === null` significa "sem rota ativa ou sem geometria" —
 * nunca recalcula nesse caso (não tem o que recalcular) e zera o estado.
 */
export function avaliarNecessidadeRecalculo(
  distanciaAtualM: number | null,
  estadoAnterior: EstadoDesvioRota,
  agoraMs: number,
  limiarM: number = LIMIAR_SAIDA_ROTA_M,
  duracaoMinimaMs: number = DURACAO_MINIMA_FORA_MS
): ResultadoAvaliacaoDesvio {
  if (distanciaAtualM === null) {
    return { recalcular: false, novoEstado: ESTADO_DESVIO_INICIAL };
  }

  if (distanciaAtualM <= limiarM) {
    // Voltou pra dentro da rota (ou nunca saiu) — zera o cronômetro.
    return { recalcular: false, novoEstado: ESTADO_DESVIO_INICIAL };
  }

  if (estadoAnterior.foraDesdeMs === null) {
    // Acabou de sair — começa a contar, ainda não recalcula.
    return { recalcular: false, novoEstado: { foraDesdeMs: agoraMs } };
  }

  if (agoraMs - estadoAnterior.foraDesdeMs >= duracaoMinimaMs) {
    // Fora da rota, de forma contínua, por tempo suficiente — recalcula
    // agora e zera o cronômetro (a próxima rota, quando chegar, parte de
    // um estado limpo).
    return { recalcular: true, novoEstado: ESTADO_DESVIO_INICIAL };
  }

  // Ainda fora, mas ainda não completou o tempo mínimo.
  return { recalcular: false, novoEstado: estadoAnterior };
}

// ---------------------------------------------------------------------------
// Backoff após FALHA de recálculo (Fase A, item D)
//
// Sem isto, se o ORS falha (rede, 429, 401...) e a pessoa continua fora da
// rota, `avaliarNecessidadeRecalculo` zera o cronômetro ao disparar e, 8 s
// depois, dispara de novo — um ciclo de chamadas ao ORS a cada ~8 s que só
// agrava um 429 e queima a cota. A rota anterior já é preservada (useRotaAcessivel
// só troca `rota` em sucesso); aqui só se controla QUANDO tentar de novo, sozinho.
// Nova tentativa manual (pedir a rota de novo) nunca passa por esta trava.
// ---------------------------------------------------------------------------

export const ESPERA_BASE_APOS_FALHA_MS = 30_000;
export const ESPERA_MAXIMA_APOS_FALHA_MS = 300_000;
const ESPERA_MINIMA_429_MS = 60_000;
/** 401/403: chave inválida ou sem permissão — repetir sozinho nunca resolve. */
const STATUS_FALHA_PERMANENTE = [401, 403];

export interface EstadoFalhaRecalculo {
  falhasConsecutivas: number;
  /** Antes deste instante (ms) não se tenta recalcular sozinho. Infinity = desistiu. */
  bloqueadoAteMs: number;
}

export const ESTADO_FALHA_INICIAL: EstadoFalhaRecalculo = { falhasConsecutivas: 0, bloqueadoAteMs: 0 };

/** Registra uma falha de recálculo e calcula até quando ficar sem tentar sozinho. */
export function registrarFalhaRecalculo(
  estado: EstadoFalhaRecalculo,
  agoraMs: number,
  statusHttp: number | null | undefined
): EstadoFalhaRecalculo {
  const falhasConsecutivas = estado.falhasConsecutivas + 1;
  if (statusHttp != null && STATUS_FALHA_PERMANENTE.includes(statusHttp)) {
    return { falhasConsecutivas, bloqueadoAteMs: Infinity };
  }
  let espera = Math.min(ESPERA_BASE_APOS_FALHA_MS * 2 ** (falhasConsecutivas - 1), ESPERA_MAXIMA_APOS_FALHA_MS);
  if (statusHttp === 429) espera = Math.max(espera, ESPERA_MINIMA_429_MS);
  return { falhasConsecutivas, bloqueadoAteMs: agoraMs + espera };
}

export function recalculoAutomaticoPermitido(estado: EstadoFalhaRecalculo, agoraMs: number): boolean {
  return agoraMs >= estado.bloqueadoAteMs;
}

/**
 * Texto a anunciar após uma falha — `null` quando não vale repetir (só avisa
 * na 1ª falha da sequência e quando desiste, pra não virar spam de voz).
 */
export function mensagemFalhaRecalculo(estado: EstadoFalhaRecalculo, mensagemErro: string | null): string | null {
  if (estado.bloqueadoAteMs === Infinity) {
    return `Não consegui recalcular a rota e vou parar de tentar sozinho. ${mensagemErro ?? ''} Você segue na rota anterior; peça a rota de novo quando resolver.`.replace(/\s+/g, ' ').trim();
  }
  if (estado.falhasConsecutivas === 1) {
    const segundos = Math.round(ESPERA_BASE_APOS_FALHA_MS / 1000);
    return `Não consegui recalcular a rota. Continuo com a rota anterior e tento de novo em cerca de ${segundos} segundos.`;
  }
  return null;
}
