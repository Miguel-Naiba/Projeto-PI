import { comPrazo, coordenadaValida, foiCancelado, PRAZO_OVERPASS_MS } from './requisicao';
import type { SinalSonoro, Obra } from '../types';

const ENDPOINTS_OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export interface PontoTatilOsm {
  idOsm: number;
  lat: number;
  lon: number;
}

export interface DadosAcessibilidadeOsm {
  pontosPisoTatil: PontoTatilOsm[];
  sinaisSonoros: SinalSonoro[];
  obras: Obra[];
  buscadoEm: number;
}

interface ElementoOverpass {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function montarConsulta(lat: number, lon: number, raioM: number): string {
  const ao_redor = `(around:${raioM},${lat},${lon})`;
  return `
    [out:json][timeout:25];
    (
      node["tactile_paving"="yes"]${ao_redor};
      node["highway"="crossing"]["traffic_signals:sound"="yes"]${ao_redor};
      node["highway"="traffic_signals"]["traffic_signals:sound"="yes"]${ao_redor};
      way["highway"="construction"]${ao_redor};
      node["highway"="construction"]${ao_redor};
      way["construction"]${ao_redor};
      node["barrier"="construction"]${ao_redor};
    );
    out body center;
  `.trim();
}

async function consultarOverpass(consulta: string, sinal?: AbortSignal): Promise<unknown[]> {
  let ultimoErro: unknown;
  for (const endpoint of ENDPOINTS_OVERPASS) {
    try {
      return await comPrazo(async (signal) => {
        const res = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: consulta }).toString(), signal,
        });
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
        const dados = await res.json();
        if (!dados || !Array.isArray(dados.elements) || dados.remark) throw new Error('Resposta Overpass incompleta ou inválida');
        return dados.elements;
      }, PRAZO_OVERPASS_MS, sinal);
    } catch (err) {
      if (foiCancelado(err) || sinal?.aborted) throw err;
      ultimoErro = err;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Overpass indisponível');
}

function elementoValido(el: unknown): el is ElementoOverpass {
  if (!el || typeof el !== 'object') return false;
  const e = el as ElementoOverpass;
  return ['node', 'way', 'relation'].includes(e.type) && Number.isSafeInteger(e.id) && e.id > 0 &&
    (!e.tags || (typeof e.tags === 'object' && !Array.isArray(e.tags) && Object.values(e.tags).every(v => typeof v === 'string')));
}
function posicaoElemento(el: ElementoOverpass): { lat: number; lon: number } | null {
  const pos = el.type === 'node' ? { lat: el.lat, lon: el.lon } : el.center;
  return pos && coordenadaValida(pos.lat, pos.lon) ? { lat: pos.lat!, lon: pos.lon! } : null;
}

export async function buscarDadosAcessibilidade(
  lat: number,
  lon: number,
  raioM = 1200,
  sinal?: AbortSignal
): Promise<DadosAcessibilidadeOsm> {
  if (!coordenadaValida(lat, lon) || !Number.isFinite(raioM) || raioM <= 0) throw new Error('Área de consulta inválida');
  const elementos = await consultarOverpass(montarConsulta(lat, lon, raioM), sinal);

  const pontosPisoTatil: PontoTatilOsm[] = [];
  const sinaisSonoros: SinalSonoro[] = [];
  const obras: Obra[] = [];

  for (const el of elementos) {
    if (!elementoValido(el)) continue;
    const pos = posicaoElemento(el);
    if (!pos) continue;
    const tags = el.tags ?? {};

    if (tags.tactile_paving === 'yes' && !tags['traffic_signals:sound']) {
      pontosPisoTatil.push({ idOsm: el.id, lat: pos.lat, lon: pos.lon });
    }

    if (tags['traffic_signals:sound'] === 'yes') {
      sinaisSonoros.push({
        id: `osm-${el.id}`,
        idOsm: el.id,
        lat: pos.lat,
        lon: pos.lon,
        nome: tags.name,
        pisoTatil: tags.tactile_paving === 'yes',
        fonte: 'osm',
      });
    }

    if (tags.highway === 'construction' || tags.construction || tags.barrier === 'construction') {
      const tipo: Obra['tipo'] =
        tags.highway === 'construction' ? 'via' : tags.footway ? 'calcada' : 'outro';
      obras.push({
        id: `osm-${el.id}`,
        idOsm: el.id,
        lat: pos.lat,
        lon: pos.lon,
        tipo,
        nome: tags.name,
        fonte: 'osm',
      });
    }
  }

  return { pontosPisoTatil, sinaisSonoros, obras, buscadoEm: Date.now() };
}
