import { buscarRota, ErroRota } from './api';
import type { FeatureOrs } from './api';
import { foiCancelado } from './requisicao';
import { avaliarCandidatas, obrasNoCorredorDaRota, MAX_DESVIO_ROTA_METROS } from './avaliadorRota';
import { bufferPontoPoligono } from '../utils/geografia';
import type { RotaAcessivel, PontoProximidade, EtapaRota, Obra, SinalSonoro } from '../types';
import type { RotaCandidata } from './avaliadorRota';

// Raio do "canteiro" aproximado em volta de cada obra, só pra montar o
// avoid_polygons — não é o tamanho real da obra (não temos essa geometria),
// é uma margem de segurança pra garantir que o ORS realmente desvie da
// quadra, não só do ponto exato.
const RAIO_BUFFER_OBRA_M = 20;

// Quantas alternativas pedir ao ORS. O teto real da API é 3 (ver restrições
// oficiais em openrouteservice.org/restrictions) — pedir mais que isso é
// erro garantido, então usamos o teto.
const NUMERO_ALTERNATIVAS = 3;

export interface ContextoAcessibilidade {
  obras: Obra[];
  botoeiras: SinalSonoro[];
  pisoTatil: { lat: number; lon: number }[];
}

function extrairRota(feature: FeatureOrs, destino: PontoProximidade): RotaAcessivel {
  const coordenadas: [number, number][] = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

  const etapas: EtapaRota[] = feature.properties.segments.flatMap((seg) =>
    seg.steps.map((s) => {
      const [wp] = s.way_points;
      const [lon, lat] = feature.geometry.coordinates[wp] ?? [destino.lon, destino.lat];
      return {
        instrucao: s.instruction,
        distanciaM: s.distance,
        duracaoS: s.duration,
        lat,
        lon,
      };
    })
  );

  return {
    coordenadas,
    etapas,
    distanciaM: feature.properties.summary.distance,
    duracaoS: feature.properties.summary.duration,
    destino,
  };
}

/**
 * Pipeline de rota acessível do EchoPath:
 *
 *   origem/destino -> foot-walking -> ROTA BASE
 *     -> obras no corredor da rota base
 *     -> rotas candidatas (alternativas do ORS, tentando desviar das obras)
 *     -> filtro de tolerância (rotaBase + 100m, ver MAX_DESVIO_ROTA_METROS)
 *     -> avaliação (obras > botoeiras > piso tátil > distância > tempo)
 *     -> rota final
 *
 * Preserva o comportamento de antes (uma chamada, uma rota) como fallback em
 * qualquer etapa que falhar — a pessoa sempre recebe uma rota utilizável,
 * mesmo que o ORS rejeite alternativas ou avoid_polygons nessa conta/perfil.
 */
export async function calcularRotaAcessivel(
  origem: [number, number],
  destino: PontoProximidade,
  chaveApi: string,
  contexto: ContextoAcessibilidade,
  perfil: 'foot-walking' | 'wheelchair' = 'foot-walking',
  sinal?: AbortSignal
): Promise<RotaCandidata> {
  const destinoCoord: [number, number] = [destino.lat, destino.lon];

  // 1) Rota base — a referência de distância/tempo e o ponto de partida do
  // pipeline. Se isso falhar, propaga o erro normal (sem fallback possível).
  const geojsonBase = await buscarRota(origem, destinoCoord, chaveApi, perfil, { sinal });
  const featureBase = geojsonBase?.features?.[0];
  if (!featureBase) throw new Error('Rota não encontrada pelo OpenRouteService.');
  const rotaBase = extrairRota(featureBase, destino);

  // 2) Obras que realmente cruzam o corredor da rota base.
  const obrasNoCaminho = obrasNoCorredorDaRota(rotaBase.coordenadas, contexto.obras);

  // 3) Rotas candidatas: tenta alternativas do ORS, desviando das obras
  // encontradas quando possível. Cada etapa tem fallback pra etapa anterior.
  let candidatas: RotaAcessivel[] = [rotaBase];
  let alternativasIndisponiveis = false;

  const poligonosObras =
    obrasNoCaminho.length > 0
      ? ({
          type: 'MultiPolygon',
          coordinates: obrasNoCaminho.map((o) => bufferPontoPoligono(o.lat, o.lon, RAIO_BUFFER_OBRA_M).coordinates),
        } satisfies GeoJSON.MultiPolygon)
      : undefined;

  const adicionarAlternativas = async (evitarPoligonos?: GeoJSON.MultiPolygon) => {
    const dados = await buscarRota(origem, destinoCoord, chaveApi, perfil, {
      sinal, alternativas: { targetCount: NUMERO_ALTERNATIVAS }, evitarPoligonos,
    });
    candidatas.push(...dados.features.map(f => extrairRota(f, destino)));
  };
  try {
    await adicionarAlternativas(poligonosObras);
  } catch (erro) {
    if (foiCancelado(erro) || sinal?.aborted) throw erro;
    alternativasIndisponiveis = true;
    // Só um erro de parâmetros COM polígonos justifica remover essa opção.
    // Não repetir chamada idêntica, 401/403, 429, timeout ou falha de servidor.
    if (poligonosObras && erro instanceof ErroRota && [400, 422].includes(erro.status ?? 0)) {
      try { await adicionarAlternativas(); alternativasIndisponiveis = false; }
      catch (fallbackErro) {
        if (foiCancelado(fallbackErro) || sinal?.aborted) throw fallbackErro;
      }
    }
    // A base já validada permanece utilizável; obras conhecidas serão anunciadas.
  }
  sinal?.throwIfAborted();
  // ORS pode repetir a base entre alternativas; não inflar o conjunto/nota.
  candidatas = candidatas.filter((r, i, todas) => todas.findIndex(c =>
    c.distanciaM === r.distanciaM && c.duracaoS === r.duracaoS &&
    JSON.stringify(c.coordenadas) === JSON.stringify(r.coordenadas)) === i);

  // 4) Filtro de tolerância — nunca escolher algo além de rotaBase + 100m,
  // mesmo que zere as obras no caminho.
  const dentroDaTolerancia = filtrarDentroDaTolerancia(rotaBase, candidatas);
  const pool = dentroDaTolerancia.length > 0 ? dentroDaTolerancia : [rotaBase];

  // 5) Avaliação e escolha final.
  const avaliadas = avaliarCandidatas(pool, contexto);
  return { ...avaliadas[0], ...(alternativasIndisponiveis ? { limitacao: 'Não foi possível consultar rotas alternativas. A rota foi avaliada com os dados disponíveis.' } : {}) };
}

/**
 * Regra de rota (checklist Fase 3, item 5): uma candidata só é aceita se
 * adicionar no máximo `maxDesvioM` sobre a distância da rota base — limite
 * INCLUSIVO (exatamente +100m passa; +101m é rejeitada). Extraída como
 * função pura exportada para ser testável sem depender do ORS.
 */
export function filtrarDentroDaTolerancia(
  rotaBase: RotaAcessivel,
  candidatas: RotaAcessivel[],
  maxDesvioM: number = MAX_DESVIO_ROTA_METROS
): RotaAcessivel[] {
  const limite = rotaBase.distanciaM + maxDesvioM;
  // Epsilon de representação, não tolerância adicional em metros.
  return candidatas.filter((c) => Number.isFinite(c.distanciaM) && c.distanciaM >= 0 &&
    c.distanciaM <= limite + Number.EPSILON * Math.max(1, Math.abs(limite), Math.abs(c.distanciaM)));
}
