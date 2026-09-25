import { buscarRota } from './api';
import { avaliarCandidatas, obrasNoCorredorDaRota, MAX_DESVIO_ROTA_METROS } from './avaliadorRota';
import { bufferPontoPoligono } from '../utils/geografia';
import type { RotaAcessivel, PontoProximidade, EtapaRota, Obra, SinalSonoro } from '../types';
import type { RotaCandidata } from './avaliadorRota';

interface EtapaOrs {
  instruction: string;
  distance: number;
  duration: number;
  way_points: [number, number];
}

interface FeatureOrs {
  geometry: { coordinates: [number, number][] };
  properties: {
    segments: { distance: number; duration: number; steps: EtapaOrs[] }[];
    summary: { distance: number; duration: number };
  };
}

interface GeojsonOrs {
  features: FeatureOrs[];
}

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
  perfil: 'foot-walking' | 'wheelchair' = 'foot-walking'
): Promise<RotaCandidata> {
  const destinoCoord: [number, number] = [destino.lat, destino.lon];

  // 1) Rota base — a referência de distância/tempo e o ponto de partida do
  // pipeline. Se isso falhar, propaga o erro normal (sem fallback possível).
  const geojsonBase: GeojsonOrs = await buscarRota(origem, destinoCoord, chaveApi, perfil);
  const featureBase = geojsonBase?.features?.[0];
  if (!featureBase) throw new Error('Rota não encontrada pelo OpenRouteService.');
  const rotaBase = extrairRota(featureBase, destino);

  const limiteToleranciaM = rotaBase.distanciaM + MAX_DESVIO_ROTA_METROS;

  // 2) Obras que realmente cruzam o corredor da rota base.
  const obrasNoCaminho = obrasNoCorredorDaRota(rotaBase.coordenadas, contexto.obras);

  // 3) Rotas candidatas: tenta alternativas do ORS, desviando das obras
  // encontradas quando possível. Cada etapa tem fallback pra etapa anterior.
  let candidatas: RotaAcessivel[];

  const poligonosObras =
    obrasNoCaminho.length > 0
      ? ({
          type: 'MultiPolygon',
          coordinates: obrasNoCaminho.map((o) => bufferPontoPoligono(o.lat, o.lon, RAIO_BUFFER_OBRA_M).coordinates),
        } satisfies GeoJSON.MultiPolygon)
      : undefined;

  try {
    // Tentativa "ideal": alternativas + desviar de verdade das obras.
    const geojsonAlt: GeojsonOrs = await buscarRota(origem, destinoCoord, chaveApi, perfil, {
      alternativas: { targetCount: NUMERO_ALTERNATIVAS },
      evitarPoligonos: poligonosObras,
    });
    candidatas = geojsonAlt.features.map((f) => extrairRota(f, destino));
  } catch {
    // O ORS pode não aceitar avoid_polygons junto de alternative_routes
    // (não documentado com certeza) — tenta só as alternativas, sem forçar
    // desvio. As obras ainda entram na pontuação abaixo.
    try {
      const geojsonAlt: GeojsonOrs = await buscarRota(origem, destinoCoord, chaveApi, perfil, {
        alternativas: { targetCount: NUMERO_ALTERNATIVAS },
      });
      candidatas = geojsonAlt.features.map((f) => extrairRota(f, destino));
    } catch {
      // Conta/plano sem suporte a alternativas — segue só com a rota base.
      candidatas = [rotaBase];
    }
  }

  // 4) Filtro de tolerância — nunca escolher algo além de rotaBase + 100m,
  // mesmo que zere as obras no caminho.
  const dentroDaTolerancia = candidatas.filter((c) => c.distanciaM <= limiteToleranciaM);
  const pool = dentroDaTolerancia.length > 0 ? dentroDaTolerancia : [rotaBase];

  // 5) Avaliação e escolha final.
  const avaliadas = avaliarCandidatas(pool, contexto);
  return avaliadas[0];
}
