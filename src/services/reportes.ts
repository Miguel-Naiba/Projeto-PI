import { supabase } from './supabaseClient';
import type { Reporte, TipoReporte, StatusReporte } from '../types';

// Reportes são sobre coisas que mudam rápido (uma obra some, uma botoeira é
// consertada) — depois disso, mostrar um reporte antigo pra outra pessoa
// atrapalha mais do que ajuda. 72h é uma janela generosa o bastante pra
// cobrir "isso começou ontem" sem virar um mural permanente de coisas já
// resolvidas.
const JANELA_RELEVANCIA_HORAS = 72;

const COLUNAS =
  'id, tipo, problema, lat, lon, descricao, ponto_id, ponto_nome, ponto_fonte, rota_ativa, distancia_da_rota_m, usuario_id, usuario_nome, criado_em, status';

interface LinhaReporte {
  id: string;
  tipo: TipoReporte;
  problema: string | null;
  lat: number;
  lon: number;
  descricao: string;
  ponto_id: string | null;
  ponto_nome: string | null;
  ponto_fonte: string | null;
  rota_ativa: boolean | null;
  distancia_da_rota_m: number | null;
  usuario_id: string;
  usuario_nome: string;
  criado_em: string;
  status: StatusReporte;
}

function mapearLinha(linha: LinhaReporte): Reporte {
  return {
    id: linha.id,
    tipo: linha.tipo,
    problema: linha.problema ?? undefined,
    lat: linha.lat,
    lon: linha.lon,
    descricao: linha.descricao,
    pontoId: linha.ponto_id ?? undefined,
    pontoNome: linha.ponto_nome ?? undefined,
    pontoFonte: linha.ponto_fonte ?? undefined,
    rotaAtiva: linha.rota_ativa ?? undefined,
    distanciaDaRotaM: linha.distancia_da_rota_m ?? undefined,
    usuarioId: linha.usuario_id,
    usuarioNome: linha.usuario_nome,
    criadoEm: linha.criado_em,
    status: linha.status,
  };
}

export async function buscarReportesRecentes(): Promise<Reporte[]> {
  if (!supabase) return [];
  const desde = new Date(Date.now() - JANELA_RELEVANCIA_HORAS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('reportes')
    .select(COLUNAS)
    .gte('criado_em', desde)
    .order('criado_em', { ascending: false })
    .limit(300);

  if (error) throw new Error('Não foi possível carregar os reportes da comunidade.');
  return (data ?? []).map(mapearLinha);
}

export interface DadosNovoReporte {
  tipo: TipoReporte;
  problema?: string;
  lat: number;
  lon: number;
  descricao: string;
  pontoId?: string;
  pontoNome?: string;
  pontoFonte?: string;
  rotaAtiva?: boolean;
  distanciaDaRotaM?: number;
  usuarioId: string;
  usuarioNome: string;
}

export async function criarReporte(dados: DadosNovoReporte): Promise<Reporte> {
  if (!supabase) throw new Error('Reportar indisponível: Supabase não configurado neste app.');

  const { data, error } = await supabase
    .from('reportes')
    .insert({
      tipo: dados.tipo,
      problema: dados.problema ?? null,
      lat: dados.lat,
      lon: dados.lon,
      descricao: dados.descricao.trim(),
      ponto_id: dados.pontoId ?? null,
      ponto_nome: dados.pontoNome ?? null,
      ponto_fonte: dados.pontoFonte ?? null,
      rota_ativa: dados.rotaAtiva ?? null,
      distancia_da_rota_m: dados.distanciaDaRotaM ?? null,
      usuario_id: dados.usuarioId,
      usuario_nome: dados.usuarioNome,
    })
    .select(COLUNAS)
    .single();

  if (error || !data) throw new Error('Não foi possível enviar o reporte agora. Tente novamente.');
  return mapearLinha(data);
}

export async function apagarReporte(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('reportes').delete().eq('id', id);
}
