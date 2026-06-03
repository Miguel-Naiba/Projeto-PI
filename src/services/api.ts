// Base URLs
const DADOS_ABERTOS_BASE = 'https://dadosabertos.poa.br/api/3/action';
const ORS_BASE = 'https://api.openrouteservice.org/v2';

// ─── Dados Abertos POA ────────────────────────────────────────────────────────

export async function searchPackages(query: string) {
  const url = `${DADOS_ABERTOS_BASE}/package_search?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar pacotes: ${res.status}`);
  return res.json();
}

export async function listPackages() {
  const url = `${DADOS_ABERTOS_BASE}/package_list`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao listar pacotes: ${res.status}`);
  return res.json();
}

export async function getResource(resourceId: string) {
  const url = `${DADOS_ABERTOS_BASE}/datastore_search?resource_id=${resourceId}&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao buscar recurso: ${res.status}`);
  return res.json();
}

// ─── GTFS (Paradas e Linhas) ──────────────────────────────────────────────────
// GTFS estático da EPTC: baixar zip e parsear localmente ou usar endpoint proxy
// Resource IDs de exemplo (confirmar no portal):
const GTFS_STOPS_RESOURCE = 'stops'; // placeholder — checar ID real no portal

export async function fetchBusStops() {
  try {
    const data = await getResource(GTFS_STOPS_RESOURCE);
    return data.result?.records ?? [];
  } catch {
    console.warn('GTFS stops indisponível, usando mock');
    return MOCK_BUS_STOPS;
  }
}

// ─── TRI GPS (Ônibus ao vivo) ─────────────────────────────────────────────────
// Endpoint público TRI: https://www.tri.com.br/siteT/src/mapaLinhaOnibus.aspx
// Alternativa EPTC API (verificar disponibilidade):
export async function fetchLiveBuses(lineId?: string) {
  try {
    const query = lineId ? `?linha=${lineId}` : '';
    const res = await fetch(`https://dadosabertos.poa.br/api/3/action/datastore_search?resource_id=live-buses${query}`);
    if (!res.ok) throw new Error('Live buses não disponível');
    const data = await res.json();
    return data.result?.records ?? [];
  } catch {
    console.warn('Live buses indisponível, usando mock');
    return MOCK_LIVE_BUSES;
  }
}

// ─── OpenRouteService (Roteamento Acessível) ──────────────────────────────────
export async function getRoute(
  from: [number, number],
  to: [number, number],
  apiKey: string,
  profile: 'foot-walking' | 'wheelchair' = 'foot-walking'
) {
  const url = `${ORS_BASE}/directions/${profile}/geojson`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      coordinates: [
        [from[1], from[0]],
        [to[1], to[0]],
      ],
    }),
  });
  if (!res.ok) throw new Error(`Erro na rota: ${res.status}`);
  return res.json();
}

// ─── Mocks para desenvolvimento ───────────────────────────────────────────────
export const MOCK_BUS_STOPS = [
  { stop_id: '1', stop_name: 'Terminal Triângulo', stop_lat: -30.0346, stop_lon: -51.2177 },
  { stop_id: '2', stop_name: 'Av. Ipiranga / Cristóvão Colombo', stop_lat: -30.0269, stop_lon: -51.2094 },
  { stop_id: '3', stop_name: 'Parada Farrapos', stop_lat: -29.9786, stop_lon: -51.1937 },
  { stop_id: '4', stop_name: 'Terminal Belém Novo', stop_lat: -30.1541, stop_lon: -51.2198 },
  { stop_id: '5', stop_name: 'Largo dos Açorianos', stop_lat: -30.0322, stop_lon: -51.2302 },
];

export const MOCK_LIVE_BUSES = [
  { vehicle_id: 'B001', line: 'T1', lat: -30.031, lon: -51.218, heading: 90, timestamp: Date.now() },
  { vehicle_id: 'B002', line: 'L2', lat: -30.028, lon: -51.224, heading: 180, timestamp: Date.now() },
];

export const MOCK_ROAD_WORKS = [
  { id: 'w1', title: 'Pavimentação Av. Cavalhada', description: 'Recapeamento asfáltico', lat: -30.1321, lon: -51.2043, severity: 'medium' as const },
  { id: 'w2', title: 'Drenagem Rua da Conceição', description: 'Obras de drenagem pluvial', lat: -30.0432, lon: -51.2198, severity: 'high' as const },
];

export const MOCK_ACCIDENTS = [
  { id: 'a1', lat: -30.0411, lon: -51.2287, date: '2025-05-10', severity: 'leve' as const, description: 'Colisão traseira' },
  { id: 'a2', lat: -30.0178, lon: -51.1872, date: '2025-05-08', severity: 'grave' as const, description: 'Atropelamento' },
];
