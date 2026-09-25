import { supabase } from './supabaseClient';

export interface EntradaPisoTatilEptc {
  idParada: string;
  nomeParada: string;
  lat: number;
  lon: number;
  bairro: string;
  enderecoOrigem: string;
  piso: string;
  fonte: string;
  distanciaCasamentoM: number;
}

let cache: Promise<Set<string>> | null = null;

async function carregarDoSupabase(): Promise<Set<string> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('paradas_piso_tatil').select('stop_id');
  if (error) {
    console.warn('Falha ao ler piso tátil do Supabase, tentando JSON estático:', error.message);
    return null;
  }
  return new Set((data as Array<{ stop_id: string }>).map((p) => p.stop_id));
}

async function carregarDoJsonEstatico(): Promise<Set<string>> {
  const res = await fetch('/data/paradas-tatil-eptc.json');
  const tipo = res.headers.get('content-type') ?? '';
  if (!res.ok || !tipo.includes('json')) {
    throw new Error(!res.ok ? `Falha ao carregar lista EPTC: HTTP ${res.status}` : 'paradas-tatil-eptc.json não encontrado.');
  }
  const dados: { paradas: Array<{ stop_id: string }> } = await res.json();
  return new Set(dados.paradas.map((p) => p.stop_id));
}

/**
 * Devolve os stop_id (GTFS) confirmados com piso tátil pela EPTC. Tenta o
 * Supabase primeiro (se configurado), senão cai pro JSON estático. As
 * coordenadas usadas no mapa são sempre as do GTFS, não as dessa fonte — ver
 * README/supabase/schema.sql sobre o motivo (datum diferente na planilha
 * original).
 */
export function carregarIdsParadasTatilEptc(): Promise<Set<string>> {
  if (!cache) {
    cache = carregarDoSupabase()
      .then((doSupabase) => doSupabase ?? carregarDoJsonEstatico())
      .catch((err) => {
        console.warn('Piso tátil EPTC indisponível, seguindo só com OSM:', err instanceof Error ? err.message : err);
        return new Set<string>();
      });
  }
  return cache;
}
