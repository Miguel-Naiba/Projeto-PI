import type { BusStop } from '../types';



function parseCsv(text: string): Record<string, string>[] {

  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map((line) => {

    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));

    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));

  });

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

let cachedStops: BusStop[] | null = null;

export async function loadGtfsStops(): Promise<BusStop[]> {

  if (cachedStops) return cachedStops;

  const res = await fetch('/gtfs/stops.txt');

  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar stops.txt`);

  

  const text = await res.text();

  cachedStops = parseCsv(text).map(rowToStop).filter(isValidStop);

  console.log(`✅ GTFS: ${cachedStops.length} paradas carregadas`);

  return cachedStops;

}