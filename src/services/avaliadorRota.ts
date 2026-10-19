import { distanciaM, distanciaPontoPolilinhaM } from '../utils/geografia';
import type { RotaAcessivel, Obra, SinalSonoro } from '../types';

/**
 * Tolerância máxima de desvio sobre a rota base (a rota mais curta/rápida
 * encontrada pelo OpenRouteService). Regra oficial do EchoPath: uma rota
 * candidata só pode ser escolhida no lugar da base se não passar disso —
 * mesmo que tenha zero obras no caminho. "100m" aqui é uma tolerância de
 * desvio, não um desvio-padrão estatístico.
 */
export const MAX_DESVIO_ROTA_METROS = 100;

// Um ponto de instrução/vértice da rota a até isto de uma obra/botoeira/piso
// tátil é considerado "no corredor" dela. Mais apertado que os 40m usados em
// segurancaRota.ts (que avalia cobertura por etapa da rota já escolhida,
// não decide entre candidatas) porque aqui precisamos decidir, com pouca
// margem, se uma obra realmente atrapalha ESTA rota especificamente.
const RAIO_CORREDOR_ROTA_M = 30;

// Índice ponderado legado mantido para compatibilidade de diagnóstico.
// NÃO decide a preferência: frações parciais exigem comparação lexicográfica.
const PESO_PISO_TATIL_M = 150; // > 100m (domina distância) — prioridade nº 3
const PESO_BOTOEIRA_M = 300; // > PESO_PISO_TATIL_M + 100m = 250 (folga de 50) — prioridade nº 2
const PESO_OBRA_M = 600; // > PESO_BOTOEIRA_M + PESO_PISO_TATIL_M + 100m = 550 (folga de 50) — prioridade nº 1

export interface AvaliacaoRota {
  /** Índice legado de diagnóstico; NÃO ordena candidatas. Não é distância real. */
  custo: number;
  /** Preferência relativa 0–100, atribuída após ordenar o conjunto. Não mede segurança. */
  pontuacao: number;
  obrasProximas: number;
  /** Fração (0–1) dos pontos da rota que têm uma botoeira sonora a até 30m. */
  coberturaBotoeira: number;
  /** Fração (0–1) dos pontos da rota que têm piso tátil confirmado a até 30m. */
  coberturaPisoTatil: number;
}

export interface RotaCandidata extends RotaAcessivel {
  limitacao?: string;
  avaliacao: AvaliacaoRota;
}

interface PontoComCoordenada {
  lat: number;
  lon: number;
}

/** Amostra a rota nos próprios vértices retornados pelo ORS — usado só pra detecção de presença (obra no corredor), onde não importa a densidade dos pontos, só se algum vértice caiu perto o suficiente. */
function amostrarRota(coordenadas: [number, number][]): PontoComCoordenada[] {
  return coordenadas.map(([lat, lon]) => ({ lat, lon }));
}

function interpolar(a: PontoComCoordenada, b: PontoComCoordenada, fracao: number): PontoComCoordenada {
  return { lat: a.lat + (b.lat - a.lat) * fracao, lon: a.lon + (b.lon - a.lon) * fracao };
}

// Espaçamento usado só pra reamostrar a rota antes de calcular COBERTURA
// (fração dos pontos com botoeira/piso tátil perto). Ver amostrarRotaPorDistancia.
const PASSO_AMOSTRAGEM_COBERTURA_M = 15;

/**
 * Reamostra a rota em pontos igualmente espaçados por DISTÂNCIA percorrida,
 * não pelos vértices brutos do ORS. Sem isso, cobertura vira fração de
 * VÉRTICES — e o ORS concentra vértices em curvas/interseções, então um
 * trecho reto e longo (poucos vértices) "vale" menos na fração do que uma
 * curva curta com muitos vértices, mesmo cobrindo mais distância real.
 * Regra 28 do EchoPath pede cobertura em relação aos trechos relevantes da
 * caminhada, não à densidade de geometria — isso resolve exatamente isso.
 */
export function amostrarRotaPorDistancia(
  coordenadas: [number, number][],
  passoM = PASSO_AMOSTRAGEM_COBERTURA_M
): PontoComCoordenada[] {
  const vertices = amostrarRota(coordenadas);
  if (vertices.length <= 1) return vertices;

  const pontos: PontoComCoordenada[] = [vertices[0]];
  let acumuladoDesdeUltimoPonto = 0;

  for (let i = 1; i < vertices.length; i++) {
    let inicioSegmento = vertices[i - 1];
    const fimSegmento = vertices[i];
    let restanteSegmento = distanciaM(inicioSegmento.lat, inicioSegmento.lon, fimSegmento.lat, fimSegmento.lon);

    while (restanteSegmento > 0 && acumuladoDesdeUltimoPonto + restanteSegmento >= passoM) {
      const faltaParaProximo = passoM - acumuladoDesdeUltimoPonto;
      const novoPonto = interpolar(inicioSegmento, fimSegmento, faltaParaProximo / restanteSegmento);
      pontos.push(novoPonto);
      inicioSegmento = novoPonto;
      restanteSegmento = distanciaM(inicioSegmento.lat, inicioSegmento.lon, fimSegmento.lat, fimSegmento.lon);
      acumuladoDesdeUltimoPonto = 0;
    }
    acumuladoDesdeUltimoPonto += restanteSegmento;
  }

  pontos.push(vertices[vertices.length - 1]);
  return pontos;
}

function algumPertoDe(ponto: PontoComCoordenada, alvos: PontoComCoordenada[], raioM: number): boolean {
  return alvos.some((a) => distanciaM(ponto.lat, ponto.lon, a.lat, a.lon) <= raioM);
}

/**
 * Obras cujo ponto cai a até `raioM` de QUALQUER SEGMENTO da rota (não só dos
 * vértices) — usadas tanto pra avoid_polygons quanto pra penalidade de score.
 * Medir por segmento é necessário porque o ORS devolve poucos vértices em
 * trechos retos: uma obra a 10 m da calçada, no meio de um segmento de 500 m,
 * ficaria a ~250 m do vértice mais próximo e passaria despercebida.
 */
export function obrasNoCorredorDaRota(coordenadas: [number, number][], obras: Obra[], raioM = RAIO_CORREDOR_ROTA_M): Obra[] {
  return obras.filter((obra) => distanciaPontoPolilinhaM(obra.lat, obra.lon, coordenadas) <= raioM);
}

interface ContextoAvaliacao {
  obras: Obra[];
  botoeiras: SinalSonoro[];
  pisoTatil: PontoComCoordenada[];
}

/**
 * Avalia uma rota candidata cruzando seus vértices com obras, botoeiras e
 * piso tátil já carregados. Cobertura é calculada como FRAÇÃO dos pontos da
 * rota (não contagem bruta) — uma rota longa não deve ganhar bônus só por
 * passar perto de mais coisas por acaso (regra de cobertura, não só
 * quantidade).
 */
export function avaliarRota(rota: RotaAcessivel, contexto: ContextoAvaliacao): AvaliacaoRota {
  const obrasProximas = obrasNoCorredorDaRota(rota.coordenadas, contexto.obras).length;

  // Cobertura usa amostragem por distância (não os vértices brutos do ORS) —
  // ver amostrarRotaPorDistancia. Presença de obra acima continua nos
  // vértices brutos: ali só importa se ALGUM ponto caiu perto, não a fração.
  const amostraCobertura = amostrarRotaPorDistancia(rota.coordenadas);
  const totalAmostras = Math.max(amostraCobertura.length, 1);
  const comBotoeira = amostraCobertura.filter((p) => algumPertoDe(p, contexto.botoeiras, RAIO_CORREDOR_ROTA_M)).length;
  const comTatil = amostraCobertura.filter((p) => algumPertoDe(p, contexto.pisoTatil, RAIO_CORREDOR_ROTA_M)).length;

  const coberturaBotoeira = comBotoeira / totalAmostras;
  const coberturaPisoTatil = comTatil / totalAmostras;

  const custo =
    rota.distanciaM +
    obrasProximas * PESO_OBRA_M -
    coberturaBotoeira * PESO_BOTOEIRA_M -
    coberturaPisoTatil * PESO_PISO_TATIL_M;

  // A preferência relativa só existe após comparar o conjunto de candidatas.
  const pontuacao = 0;

  return { custo, pontuacao, obrasProximas, coberturaBotoeira, coberturaPisoTatil };
}

/** Critérios documentados em RELATORIO-ECHOPATH.md antes da alteração.
 * Sem faixa arbitrária de empate: toda diferença de cobertura conta. */
export function compararCandidatas(a: RotaCandidata, b: RotaCandidata): number {
  return a.avaliacao.obrasProximas - b.avaliacao.obrasProximas ||
    b.avaliacao.coberturaBotoeira - a.avaliacao.coberturaBotoeira ||
    b.avaliacao.coberturaPisoTatil - a.avaliacao.coberturaPisoTatil ||
    a.distanciaM - b.distanciaM || a.duracaoS - b.duracaoS;
}

export function avaliarCandidatas(candidatas: RotaAcessivel[], contexto: ContextoAvaliacao): RotaCandidata[] {
  const avaliadas = candidatas.map(rota => ({ ...rota, avaliacao: avaliarRota(rota, contexto) }));
  avaliadas.sort(compararCandidatas); // sort estável conserva empates completos.
  let grupo = 0;
  const grupos = avaliadas.map((r, i) => {
    if (i && compararCandidatas(avaliadas[i - 1], r) !== 0) grupo++;
    return grupo;
  });
  return avaliadas.map((r, i) => ({ ...r, avaliacao: {
    ...r.avaliacao, pontuacao: grupo === 0 ? 100 : 100 * (grupo - grupos[i]) / grupo,
  } }));
}
