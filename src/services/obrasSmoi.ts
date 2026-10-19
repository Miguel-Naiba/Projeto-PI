import { supabase } from './supabaseClient';
import { coordenadaValidaPoa } from '../utils/geografia';

export interface EntradaObraSmoi {
  id: string;
  nome: string;
  endereco: string | null;
  bairro: string | null;
  lat: number;
  lon: number;
  precisao: string;
  fonte: string;
}

let cache: Promise<EntradaObraSmoi[]> | null = null;

export function filtrarValidas(linhas: EntradaObraSmoi[]): EntradaObraSmoi[] {
  const validas: EntradaObraSmoi[] = [];
  for (const l of linhas) {
    if (coordenadaValidaPoa(l.lat, l.lon)) {
      validas.push(l);
    } else {
      console.warn(`Obra SMOI "${l.nome ?? l.id}" descartada — coordenada inválida ou fora de Porto Alegre (lat=${l.lat}, lon=${l.lon}).`);
    }
  }
  return validas;
}

async function carregarDoSupabase(): Promise<EntradaObraSmoi[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('obras_smoi')
    .select('id, nome, endereco, bairro, lat, lon, precisao, fonte');
  if (error) {
    console.warn('Falha ao ler obras do Supabase, tentando JSON estático:', error.message);
    return null;
  }
  return data as EntradaObraSmoi[];
}

async function carregarDoJsonEstatico(): Promise<EntradaObraSmoi[]> {
  const res = await fetch('/data/obras-smoi.json');
  const tipo = res.headers.get('content-type') ?? '';
  if (!res.ok || !tipo.includes('json')) {
    throw new Error(
      !res.ok ? `Falha ao carregar obras SMOI: HTTP ${res.status}` : 'obras-smoi.json ainda não foi gerado — rode `npm run obras:geocode`.'
    );
  }
  const dados: { obras: EntradaObraSmoi[] } = await res.json();
  return dados.obras ?? [];
}

/**
 * Carrega as obras oficiais da SMOI. Tenta o Supabase primeiro (se
 * VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (ou a ANON_KEY legada) estiverem configurados); se não
 * estiver configurado, a consulta falhar, OU a tabela existir mas ainda
 * estiver vazia (0 linhas — ex.: schema aplicado mas o script de sync nunca
 * rodou), cai pro JSON estático gerado por `npm run obras:geocode`. Esse
 * terceiro caso importa: `data ?? fallback` NÃO pega array vazio (`[]` não é
 * null/undefined), então sem o `.length > 0` explícito o app ficava sem
 * nenhuma obra pra sempre com uma tabela só criada e nunca populada — bug
 * real reportado em produção. Se nenhum dos dois existir ainda, devolve
 * lista vazia — o app segue funcionando só com o OSM.
 */
export function carregarObrasSmoi(): Promise<EntradaObraSmoi[]> {
  if (!cache) {
    cache = carregarDoSupabase()
      .then((doSupabase) => (doSupabase && doSupabase.length > 0 ? doSupabase : carregarDoJsonEstatico()))
      .then(filtrarValidas)
      .catch((err) => {
        console.warn('Obras SMOI indisponíveis, seguindo só com OSM:', err instanceof Error ? err.message : err);
        return [];
      });
  }
  return cache;
}
