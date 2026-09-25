import { distanciaM } from '../utils/geografia';
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

// Peso de cada critério, em "metros equivalentes" — soma/subtrai do custo
// da rota, que é comparado em metros como a distância. Isso resolve a
// prioridade pedida (obras > botoeiras > piso tátil > distância > tempo)
// de um jeito comparável: uma única obra no caminho pesa mais que qualquer
// bônus de cobertura possível, então uma rota com obra só vence uma sem
// obra se a diferença de distância for enorme (o que a tolerância de 100m
// já impede na prática).
const PENALIDADE_POR_OBRA_M = 250;
const BONUS_MAXIMO_COBERTURA_BOTOEIRA_M = 80;
const BONUS_MAXIMO_COBERTURA_TATIL_M = 60;

export interface AvaliacaoRota {
  /** Custo em "metros equivalentes" usado só pra ORDENAR candidatas — menor vence. Não é uma distância real. */
  custo: number;
  /** Indicador aproximado 0–100 pra mostrar na interface/narração. Não é uma métrica de precisão. */
  pontuacao: number;
  obrasProximas: number;
  /** Fração (0–1) dos pontos da rota que têm uma botoeira sonora a até 30m. */
  coberturaBotoeira: number;
  /** Fração (0–1) dos pontos da rota que têm piso tátil confirmado a até 30m. */
  coberturaPisoTatil: number;
}

export interface RotaCandidata extends RotaAcessivel {
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

/** Obras cujo ponto cai a até `raioM` de QUALQUER vértice da rota — usadas tanto pra avoid_polygons quanto pra penalidade de score. */
export function obrasNoCorredorDaRota(coordenadas: [number, number][], obras: Obra[], raioM = RAIO_CORREDOR_ROTA_M): Obra[] {
  const amostra = amostrarRota(coordenadas);
  return obras.filter((obra) => algumPertoDe({ lat: obra.lat, lon: obra.lon }, amostra, raioM));
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
    obrasProximas * PENALIDADE_POR_OBRA_M -
    coberturaBotoeira * BONUS_MAXIMO_COBERTURA_BOTOEIRA_M -
    coberturaPisoTatil * BONUS_MAXIMO_COBERTURA_TATIL_M;

  // Indicador 0–100 só pra exibição/narração — metade do peso pra ausência
  // de obras (é o critério nº 1), o resto dividido entre as duas coberturas.
  const pontuacao = Math.round(
    (obrasProximas === 0 ? 50 : Math.max(0, 50 - obrasProximas * 20)) +
      coberturaBotoeira * 30 +
      coberturaPisoTatil * 20
  );

  return { custo, pontuacao, obrasProximas, coberturaBotoeira, coberturaPisoTatil };
}

/**
 * Recebe as candidatas já dentro da tolerância de 100m (ver
 * MAX_DESVIO_ROTA_METROS) e devolve todas avaliadas e ordenadas da melhor
 * pra pior. Desempate por menor duração quando o custo é praticamente igual
 * — distância already domina o custo, então "tempo" só decide entre rotas
 * essencialmente equivalentes nos outros critérios.
 */
export function avaliarCandidatas(candidatas: RotaAcessivel[], contexto: ContextoAvaliacao): RotaCandidata[] {
  const avaliadas: RotaCandidata[] = candidatas.map((rota) => ({ ...rota, avaliacao: avaliarRota(rota, contexto) }));

  return avaliadas.sort((a, b) => {
    const diferenca = a.avaliacao.custo - b.avaliacao.custo;
    if (Math.abs(diferenca) > 5) return diferenca;
    return a.duracaoS - b.duracaoS;
  });
}
