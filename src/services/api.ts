import { comPrazo, coordenadaValida, esperaRetryAfter, PRAZO_ORS_MS, foiCancelado } from './requisicao';

const BASE_DADOS_ABERTOS = 'https://dadosabertos.poa.br/api/3/action';
// Host oficial atualizado. Preservar esta URL centralizada; não usar o domínio depreciado.
const BASE_ORS = 'https://api.heigit.org/openrouteservice/v2';

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

export interface EtapaOrs {
  instruction: string; distance: number; duration: number; way_points: [number, number];
}
export interface FeatureOrs {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: {
    segments: { distance: number; duration: number; steps: EtapaOrs[] }[];
    summary: { distance: number; duration: number };
  };
}
export interface GeojsonOrs { type: 'FeatureCollection'; features: FeatureOrs[] }

export class ErroRota extends Error {
  tipo: 'configuracao' | 'http' | 'rede' | 'resposta' | 'processamento';
  status?: number;
  retryAfterMs: number;
  constructor(message: string, tipo: ErroRota['tipo'], status?: number, retryAfterMs = 0) {
    super(message); this.name = 'ErroRota';
    this.tipo = tipo; this.status = status; this.retryAfterMs = retryAfterMs;
  }
}

export function chaveOrsValida(chave: unknown): chave is string {
  return typeof chave === 'string' && !!chave.trim() &&
    !/^(undefined|null|api[_ -]?key|token|chave|key|\.\.\.)$/i.test(chave.trim()) &&
    !/^(your|sua?|seu)[_ -].*(key|chave|token|api)/i.test(chave.trim()) &&
    !/(sua[_ -]?chave|your[_ -]?(api[_ -]?)?key|placeholder|coloque|insira|aqui|example|exemplo|change.?me|<|>)/i.test(chave);
}

function registro(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object'; }
function numero(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= 0; }

/** Contrato mínimo consumido pelo extrator e Leaflet, sem confiar em casts de JSON. */
export function validarGeojsonOrs(v: unknown): asserts v is GeojsonOrs {
  const falhar = () => { throw new ErroRota('O serviço de rotas retornou uma resposta inválida. Tente novamente.', 'resposta'); };
  if (!registro(v) || v.type !== 'FeatureCollection' || !Array.isArray(v.features) || !v.features.length) return falhar();
  for (const f of v.features) {
    if (!registro(f) || f.type !== 'Feature' || !registro(f.geometry) || f.geometry.type !== 'LineString' ||
      !Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length < 2) return falhar();
    const coords = f.geometry.coordinates;
    if (!coords.every(c => Array.isArray(c) && c.length >= 2 && coordenadaValida(c[1], c[0]))) return falhar();
    if (!registro(f.properties) || !registro(f.properties.summary) ||
      !numero(f.properties.summary.distance) || !numero(f.properties.summary.duration) ||
      !Array.isArray(f.properties.segments)) return falhar();
    for (const seg of f.properties.segments) {
      if (!registro(seg) || !numero(seg.distance) || !numero(seg.duration) || !Array.isArray(seg.steps)) return falhar();
      for (const step of seg.steps) {
        if (!registro(step) || typeof step.instruction !== 'string' || !numero(step.distance) || !numero(step.duration) ||
          !Array.isArray(step.way_points) || step.way_points.length !== 2 ||
          !step.way_points.every(i => Number.isInteger(i) && i >= 0 && i < coords.length)) return falhar();
      }
    }
  }
}

// Somente metadados de espera em memória, nunca chave ou trajetória persistida.
let bloqueadoAte = 0;

export interface OpcoesRota {
  sinal?: AbortSignal;
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
): Promise<GeojsonOrs> {
  opcoes?.sinal?.throwIfAborted();
  if (!chaveOrsValida(chaveApi)) throw new ErroRota('Serviço de rotas não configurado. Contate os responsáveis pelo EchoPath.', 'configuracao');
  if (!coordenadaValida(...de) || !coordenadaValida(...para)) throw new ErroRota('Origem ou destino inválido. Selecione o destino novamente.', 'processamento');
  if (Date.now() < bloqueadoAte) throw new ErroRota('Limite do serviço de rotas atingido. Aguarde antes de tentar novamente.', 'http', 429, bloqueadoAte - Date.now());
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

  try {
    return await comPrazo(async (signal) => {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: chaveApi.trim() },
        body: JSON.stringify(corpo), signal,
      });
      if (!res.ok) {
        const mensagens: Record<number, string> = {
          401: 'Chave do serviço de rotas inválida ou não reconhecida. Contate os responsáveis pelo EchoPath.',
          403: 'Serviço de rotas sem permissão de acesso. Contate os responsáveis pelo EchoPath.',
          404: 'O endereço do serviço de rotas não foi encontrado (HTTP 404). Contate os responsáveis pelo EchoPath.',
          429: 'Limite do serviço de rotas excedido. Aguarde e tente novamente.',
          500: 'Serviço de rotas indisponível (HTTP 500). Tente novamente mais tarde.',
          503: 'Serviço de rotas temporariamente indisponível (HTTP 503). Tente novamente mais tarde.',
          504: 'O serviço de rotas demorou para responder (HTTP 504). Tente novamente.',
        };
        const espera = res.status === 429 ? esperaRetryAfter(res.headers?.get('Retry-After')) : 0;
        if (espera) bloqueadoAte = Date.now() + espera;
        throw new ErroRota(mensagens[res.status] ?? `Falha no serviço de rotas (HTTP ${res.status}). Tente novamente.`, 'http', res.status, espera);
      }
      let dados: unknown;
      try { dados = await res.json(); }
      catch { throw new ErroRota('Resposta ilegível do serviço de rotas. Tente novamente.', 'resposta'); }
      validarGeojsonOrs(dados);
      return dados;
    }, PRAZO_ORS_MS, opcoes?.sinal);
  } catch (erro) {
    if (erro instanceof ErroRota || foiCancelado(erro) || (erro instanceof Error && erro.name === 'TimeoutError')) throw erro;
    throw new ErroRota('Não foi possível acessar o serviço de rotas. Verifique a conexão e tente novamente.', 'rede');
  }
}

export const ONIBUS_MOCK = [
  { idVeiculo: 'B001', linha: 'T1', lat: -30.031, lon: -51.218, direcao: 90, timestamp: Date.now() },
  { idVeiculo: 'B002', linha: 'L2', lat: -30.028, lon: -51.224, direcao: 180, timestamp: Date.now() },
];

export const ACIDENTES_MOCK = [
  { id: 'a1', lat: -30.0411, lon: -51.2287, data: '2025-05-10', gravidade: 'leve' as const, descricao: 'Colisão traseira' },
  { id: 'a2', lat: -30.0178, lon: -51.1872, data: '2025-05-08', gravidade: 'grave' as const, descricao: 'Atropelamento' },
];
