import { supabase } from './supabaseClient';
import { coordenadaValidaPoa } from '../utils/geografia';

export interface EntradaBotoeiraEptc {
  id: string;
  local: string;
  lat: number;
  lon: number;
  dataImplantacao: string;
  nBotoeiras: number;
  nTravessias: number;
  fonte: string;
}

interface LinhaSupabaseBotoeira {
  id: string;
  local: string;
  lat: number;
  lon: number;
  data_implantacao: string;
  n_botoeiras: number;
  n_travessias: number;
  fonte: string;
}

let cache: Promise<EntradaBotoeiraEptc[]> | null = null;

export function filtrarValidas(linhas: EntradaBotoeiraEptc[]): EntradaBotoeiraEptc[] {
  const validas: EntradaBotoeiraEptc[] = [];
  for (const l of linhas) {
    if (coordenadaValidaPoa(l.lat, l.lon)) {
      validas.push(l);
    } else {
      console.warn(`Botoeira "${l.local ?? l.id}" descartada — coordenada inválida ou fora de Porto Alegre (lat=${l.lat}, lon=${l.lon}).`);
    }
  }
  return validas;
}

async function carregarDoSupabase(): Promise<EntradaBotoeiraEptc[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('botoeiras_sonoras')
    .select('id, local, lat, lon, data_implantacao, n_botoeiras, n_travessias, fonte');
  if (error) {
    console.warn('Falha ao ler botoeiras do Supabase, tentando JSON estático:', error.message);
    return null;
  }
  return (data as LinhaSupabaseBotoeira[]).map((l) => ({
    id: l.id,
    local: l.local,
    lat: l.lat,
    lon: l.lon,
    dataImplantacao: l.data_implantacao,
    nBotoeiras: l.n_botoeiras,
    nTravessias: l.n_travessias,
    fonte: l.fonte,
  }));
}

async function carregarDoJsonEstatico(): Promise<EntradaBotoeiraEptc[]> {
  const res = await fetch('/data/botoeiras-eptc.json');
  const tipo = res.headers.get('content-type') ?? '';
  if (!res.ok || !tipo.includes('json')) {
    throw new Error(
      !res.ok ? `Falha ao carregar botoeiras EPTC: HTTP ${res.status}` : 'botoeiras-eptc.json ainda não foi gerado — rode `npm run botoeiras:geocode`.'
    );
  }
  const dados: { botoeiras: EntradaBotoeiraEptc[] } = await res.json();
  return dados.botoeiras ?? [];
}

/**
 * Carrega as botoeiras sonoras oficiais. Tenta o Supabase primeiro (se
 * configurado); se não, cai pro JSON estático gerado por
 * `npm run botoeiras:geocode`. Se nenhum dos dois existir, devolve lista
 * vazia — o app segue funcionando só com o OSM.
 */
export function carregarBotoeirasEptc(): Promise<EntradaBotoeiraEptc[]> {
  if (!cache) {
    cache = carregarDoSupabase()
      .then((doSupabase) => doSupabase ?? carregarDoJsonEstatico())
      .then(filtrarValidas)
      .catch((err) => {
        console.warn('Botoeiras EPTC indisponíveis, seguindo só com OSM:', err instanceof Error ? err.message : err);
        return [];
      });
  }
  return cache;
}
