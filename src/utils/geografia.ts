const RAIO_TERRA_M = 6371000;

function paraRad(graus: number) {
  return (graus * Math.PI) / 180;
}

export function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = paraRad(lat2 - lat1);
  const dLon = paraRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(paraRad(lat1)) * Math.cos(paraRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return RAIO_TERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} metros`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} quilômetros`;
}

export function chaveCelula(lat: number, lon: number, precisao = 3): string {
  return `${lat.toFixed(precisao)},${lon.toFixed(precisao)}`;
}

// Caixa aproximada de Porto Alegre — mesma usada na geocodificação (services/geocodificacao.ts,
// scripts/geocode-*.mjs). Qualquer coordenada fora disso é quase certamente um geocode
// errado (bairro homônimo em outra cidade, erro de parsing, etc.), não um dado real.
const LAT_MIN_POA = -30.27;
const LAT_MAX_POA = -29.93;
const LON_MIN_POA = -51.3;
const LON_MAX_POA = -51.03;

/** true se lat/lon são números finitos e caem dentro da área de Porto Alegre. */
export function coordenadaValidaPoa(lat: unknown, lon: unknown): lat is number {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= LAT_MIN_POA && lat <= LAT_MAX_POA && lon >= LON_MIN_POA && lon <= LON_MAX_POA;
}

/**
 * Gera um octógono aproximado (GeoJSON Polygon) ao redor de um ponto — usado
 * pra transformar uma obra (que só temos como ponto, sem geometria real de
 * canteiro) numa área que o OpenRouteService consegue evitar de fato via
 * `options.avoid_polygons`. Aproximação deliberada: não temos o polígono real
 * do canteiro de obra, só um ponto e um raio de segurança.
 */
export function bufferPontoPoligono(lat: number, lon: number, raioM: number, lados = 8): GeoJSON.Polygon {
  const M_POR_GRAU_LAT = 111320;
  const mPorGrauLon = 111320 * Math.cos(paraRad(lat));
  const anel: [number, number][] = [];
  for (let i = 0; i <= lados; i++) {
    const angulo = (2 * Math.PI * i) / lados;
    const dLat = (raioM * Math.sin(angulo)) / M_POR_GRAU_LAT;
    const dLon = (raioM * Math.cos(angulo)) / mPorGrauLon;
    anel.push([lon + dLon, lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [anel] };
}
