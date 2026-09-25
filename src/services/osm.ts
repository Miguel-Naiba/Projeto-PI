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
    out center tags;
  `.trim();
}

async function consultarOverpass(consulta: string): Promise<ElementoOverpass[]> {
  let ultimoErro: unknown;
  for (const endpoint of ENDPOINTS_OVERPASS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: consulta,
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const dados = await res.json();
      return (dados.elements ?? []) as ElementoOverpass[];
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Overpass indisponível');
}

function posicaoElemento(el: ElementoOverpass): { lat: number; lon: number } | null {
  if (el.type === 'node' && el.lat != null && el.lon != null) return { lat: el.lat, lon: el.lon };
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

export async function buscarDadosAcessibilidade(
  lat: number,
  lon: number,
  raioM = 1200
): Promise<DadosAcessibilidadeOsm> {
  const elementos = await consultarOverpass(montarConsulta(lat, lon, raioM));

  const pontosPisoTatil: PontoTatilOsm[] = [];
  const sinaisSonoros: SinalSonoro[] = [];
  const obras: Obra[] = [];

  for (const el of elementos) {
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
