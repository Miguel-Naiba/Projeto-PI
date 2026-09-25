const BASE_DADOS_ABERTOS = 'https://dadosabertos.poa.br/api/3/action';
const BASE_ORS = 'https://api.openrouteservice.org/v2';

const ID_RECURSO_ACIDENTES = 'b56f8123-716a-4893-9348-23945f1ea1b9';
const LIMITE_BUSCA_ACIDENTES = 1000;
const IDADE_MAX_ACIDENTES_MESES = 24;
const MAX_RESULTADOS_ACIDENTES = 300;

interface RegistroAcidenteBruto {
  idacidente?: string;
  _id?: number;
  latitude?: string;
  longitude?: string;
  data?: string;
  hora?: string;
  tipo_acid?: string;
  feridos?: string;
  feridos_gr?: string;
  mortes?: string;
  morte_post?: string;
  fatais?: string;
  log1?: string;
  log2?: string;
}

function analisarDataBr(bruto?: string): number {
  if (!bruto) return 0;
  const [d, m, a] = bruto.split('/').map(Number);
  if (!d || !m || !a) return 0;
  return new Date(a, m - 1, d).getTime();
}

export async function buscarAcidentes(): Promise<import('../types').Acidente[]> {
  const params = new URLSearchParams({
    resource_id: ID_RECURSO_ACIDENTES,
    limit: String(LIMITE_BUSCA_ACIDENTES),
    sort: '_id desc',
  });
  const res = await fetch(`${BASE_DADOS_ABERTOS}/datastore_search?${params.toString()}`);
  if (!res.ok) throw new Error(`Erro ao buscar acidentes: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error('Resposta inválida do Dados Abertos POA (acidentes).');

  const registros: RegistroAcidenteBruto[] = json.result?.records ?? [];
  const limite = Date.now() - IDADE_MAX_ACIDENTES_MESES * 30 * 24 * 60 * 60 * 1000;

  return registros
    .map((r) => ({ r, ts: analisarDataBr(r.data) }))
    .filter(({ r, ts }) => r.latitude && r.longitude && ts >= limite)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_RESULTADOS_ACIDENTES)
    .map(({ r }) => {
      const fatais = Number(r.fatais ?? 0);
      const feridosGraves = Number(r.feridos_gr ?? 0);
      const gravidade: 'leve' | 'grave' | 'fatal' = fatais > 0 ? 'fatal' : feridosGraves > 0 ? 'grave' : 'leve';
      return {
        id: String(r.idacidente ?? r._id ?? `${r.latitude},${r.longitude},${r.data}`),
        lat: Number(r.latitude),
        lon: Number(r.longitude),
        data: r.data ?? '',
        gravidade,
        descricao: [r.tipo_acid, r.log1 && r.log2 ? `${r.log1} × ${r.log2}` : r.log1].filter(Boolean).join(' — '),
      };
    });
}

export interface OpcoesRota {
  /** Pede rotas alternativas ao ORS (máximo real da API: 3). Só funciona com origem+destino simples, sem waypoints. */
  alternativas?: { targetCount: number; weightFactor?: number; shareFactor?: number };
  /** Polígono(s) GeoJSON que o ORS deve evitar de fato — usado pra desviar de obras conhecidas. */
  evitarPoligonos?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export async function buscarRota(
  de: [number, number],
  para: [number, number],
  chaveApi: string,
  perfil: 'foot-walking' | 'wheelchair' = 'foot-walking',
  opcoes?: OpcoesRota
) {
  const url = `${BASE_ORS}/directions/${perfil}/geojson`;
  const corpo: Record<string, unknown> = {
    coordinates: [
      [de[1], de[0]],
      [para[1], para[0]],
    ],
    language: 'pt',
  };
  if (opcoes?.alternativas) {
    corpo.alternative_routes = {
      target_count: opcoes.alternativas.targetCount,
      weight_factor: opcoes.alternativas.weightFactor ?? 1.4,
      share_factor: opcoes.alternativas.shareFactor ?? 0.6,
    };
  }
  if (opcoes?.evitarPoligonos) {
    corpo.options = { avoid_polygons: opcoes.evitarPoligonos };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: chaveApi,
    },
    body: JSON.stringify(corpo),
  });
  if (!res.ok) {
    const mensagens: Record<number, string> = {
      401: 'Chave do OpenRouteService inválida ou não reconhecida — confira VITE_CHAVE_API_ORS no .env.',
      403: 'Chave do OpenRouteService sem permissão para este perfil de rota (foot-walking/wheelchair) — confira o painel da sua conta ORS.',
      404: 'OpenRouteService não encontrou rota entre esses dois pontos (podem estar fora da área coberta ou sem caminho a pé).',
      429: 'Limite diário/por minuto do OpenRouteService excedido — espera um pouco e tenta de novo.',
    };
    const erro = new Error(mensagens[res.status] ?? `Erro na rota: HTTP ${res.status}`);
    (erro as Error & { status?: number }).status = res.status;
    throw erro;
  }
  return res.json();
}

export const ONIBUS_MOCK = [
  { idVeiculo: 'B001', linha: 'T1', lat: -30.031, lon: -51.218, direcao: 90, timestamp: Date.now() },
  { idVeiculo: 'B002', linha: 'L2', lat: -30.028, lon: -51.224, direcao: 180, timestamp: Date.now() },
];

export const ACIDENTES_MOCK = [
  { id: 'a1', lat: -30.0411, lon: -51.2287, data: '2025-05-10', gravidade: 'leve' as const, descricao: 'Colisão traseira' },
  { id: 'a2', lat: -30.0178, lon: -51.1872, data: '2025-05-08', gravidade: 'grave' as const, descricao: 'Atropelamento' },
];
