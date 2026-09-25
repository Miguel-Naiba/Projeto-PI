import type { ParadaOnibus } from '../types';

function analisarCsv(texto: string): Record<string, string>[] {
  const linhas = texto.trim().split(/\r?\n/);
  if (linhas.length < 2) return [];

  const cabecalhos = linhas[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return linhas.slice(1).map((linha) => {
    const valores = linha.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(cabecalhos.map((h, i) => [h, valores[i] ?? '']));
  });
}

function linhaParaParada(linha: Record<string, string>): ParadaOnibus {
  return {
    idParada: linha['stop_id'] ?? '',
    nomeParada: linha['stop_name'] ?? 'Parada sem nome',
    latParada: parseFloat(linha['stop_lat'] ?? '0'),
    lonParada: parseFloat(linha['stop_lon'] ?? '0'),
  };
}

function paradaValida(p: ParadaOnibus): boolean {
  return !!p.idParada && !isNaN(p.latParada) && p.latParada !== 0 && !isNaN(p.lonParada) && p.lonParada !== 0;
}

let paradasEmCache: ParadaOnibus[] | null = null;

export async function carregarParadasGtfs(): Promise<ParadaOnibus[]> {
  if (paradasEmCache) return paradasEmCache;

  const res = await fetch('/gtfs/stops.txt');
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar stops.txt`);

  const texto = await res.text();
  paradasEmCache = analisarCsv(texto).map(linhaParaParada).filter(paradaValida);
  return paradasEmCache;
}
