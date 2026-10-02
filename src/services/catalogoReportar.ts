import type { ItemCatalogoReportar, Obra, ParadaOnibus, SinalSonoro, TipoReporte } from '../types';

/**
 * Catálogo oficial do fluxo de Reportar (Fase 3, checklist seção D).
 *
 * Regras de domínio (não negociáveis):
 *  - só entra ponto com coordenada numérica válida (finita);
 *  - só entra ponto de fonte oficial (EPTC para paradas/botoeiras, SMOI para
 *    obras) — OSM complementa a visualização do mapa, mas NUNCA substitui o
 *    ponto oficial dentro do catálogo de Reportar;
 *  - pendências (sem geocodificação) já são excluídas rio acima, pelos
 *    próprios serviços de dados (filtrarValidas em obrasSmoi/botoeirasEptc) —
 *    aqui só reforçamos com um segundo filtro defensivo, nunca inventamos
 *    coordenada para preencher buraco.
 */

function coordenadaFinita(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon);
}

export function catalogoParadasTatil(paradas: ParadaOnibus[]): ItemCatalogoReportar[] {
  return paradas
    .filter((p) => p.fontePisoTatil === 'eptc' && coordenadaFinita(p.latParada, p.lonParada))
    .map((p) => ({ id: p.idParada, nome: p.nomeParada, lat: p.latParada, lon: p.lonParada, fonte: 'eptc' }));
}

export function catalogoBotoeiras(sinais: SinalSonoro[]): ItemCatalogoReportar[] {
  return sinais
    .filter((s) => s.fonte === 'eptc' && coordenadaFinita(s.lat, s.lon))
    .map((s) => ({ id: s.id, nome: s.nome ?? 'Botoeira sonora', lat: s.lat, lon: s.lon, fonte: 'eptc' }));
}

export function catalogoObras(obras: Obra[]): ItemCatalogoReportar[] {
  return obras
    .filter((o) => o.fonte === 'smoi' && coordenadaFinita(o.lat, o.lon))
    .map((o) => ({ id: o.id, nome: o.nome ?? 'Obra em execução', lat: o.lat, lon: o.lon, fonte: 'smoi', endereco: o.endereco ?? null }));
}

export function construirCatalogoOficial(
  paradas: ParadaOnibus[],
  sinais: SinalSonoro[],
  obras: Obra[]
): Record<TipoReporte, ItemCatalogoReportar[]> {
  return {
    parada_tatil: catalogoParadasTatil(paradas),
    botoeira: catalogoBotoeiras(sinais),
    obra: catalogoObras(obras),
  };
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Busca por texto/voz dentro do catálogo de uma categoria (seção D do checklist). */
export function buscarNoCatalogo(itens: ItemCatalogoReportar[], consulta: string): ItemCatalogoReportar[] {
  const alvo = normalizar(consulta);
  if (!alvo) return itens;
  return itens.filter((item) => normalizar(item.nome).includes(alvo));
}
