// ─── GTFS Parser para Porto Alegre ────────────────────────────────────────────
// O arquivo GTFS é um ZIP contendo stops.txt, routes.txt, trips.txt etc.
// Estratégia: baixar o ZIP, extrair stops.txt e parsear o CSV em memória.

import type { BusStop } from '../types';

const GTFS_ZIP_URL =
  'https://dadosabertos.poa.br/dataset/1fe9c2c1-9fbe-48ea-841b-61e30597ecd6/resource/b3bce61f-78ee-49eb-be57-6236d82bd5e0/download/arquivo-gtfs.zip';

// Proxy CORS público — usado só se o fetch direto falhar por CORS
const CORS_PROXY = 'https://corsproxy.io/?';

// ─── CSV parser simples ───────────────────────────────────────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

// ─── Extrai stops.txt do ZIP usando DecompressionStream (nativo no Chrome/Edge) ─
async function extractStopsFromZip(zipBuffer: ArrayBuffer): Promise<string> {
  // Usa fflate via CDN para descomprimir no browser
  const fflate = await import('https://esm.sh/fflate@0.8.2' as string) as typeof import('fflate');

  return new Promise((resolve, reject) => {
    const uint8 = new Uint8Array(zipBuffer);
    fflate.unzip(uint8, (err, files) => {
      if (err) return reject(err);
      const stopsFile = files['stops.txt'];
      if (!stopsFile) return reject(new Error('stops.txt não encontrado no ZIP'));
      const text = new TextDecoder('utf-8').decode(stopsFile);
      resolve(text);
    });
  });
}

// ─── Fetch com fallback para proxy CORS ──────────────────────────────────────
async function fetchWithCors(url: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(url);
    if (res.ok) return res.arrayBuffer();
    throw new Error(`HTTP ${res.status}`);
  } catch {
    // Tenta com proxy CORS
    const res = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res.ok) throw new Error(`Proxy falhou: HTTP ${res.status}`);
    return res.arrayBuffer();
  }
}

// ─── API principal ────────────────────────────────────────────────────────────
let cachedStops: BusStop[] | null = null;

export async function loadGtfsStops(): Promise<BusStop[]> {
  if (cachedStops) return cachedStops;

  // Tenta carregar do public/ primeiro (arquivo local — recomendado)
  try {
    const localRes = await fetch('/gtfs/stops.txt');
    if (localRes.ok) {
      const text = await localRes.text();
      cachedStops = parseCsv(text).map(rowToStop).filter(isValidStop);
      console.log(`✅ GTFS local: ${cachedStops.length} paradas carregadas`);
      return cachedStops;
    }
  } catch {
    // não encontrado localmente, tenta remoto
  }

  // Tenta baixar o ZIP remoto
  console.log('⬇️ Baixando GTFS remoto...');
  const buffer = await fetchWithCors(GTFS_ZIP_URL);
  const stopsText = await extractStopsFromZip(buffer);
  cachedStops = parseCsv(stopsText).map(rowToStop).filter(isValidStop);
  console.log(`✅ GTFS remoto: ${cachedStops.length} paradas carregadas`);
  return cachedStops;
}

function rowToStop(row: Record<string, string>): BusStop {
  return {
    stop_id:   row['stop_id']   ?? '',
    stop_name: row['stop_name'] ?? 'Parada sem nome',
    stop_lat:  parseFloat(row['stop_lat'] ?? '0'),
    stop_lon:  parseFloat(row['stop_lon'] ?? '0'),
  };
}

function isValidStop(s: BusStop): boolean {
  return (
    !!s.stop_id &&
    !isNaN(s.stop_lat) && s.stop_lat !== 0 &&
    !isNaN(s.stop_lon) && s.stop_lon !== 0
  );
}
