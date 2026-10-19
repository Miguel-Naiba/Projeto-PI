import { fetchNominatim } from './limitadorNominatim';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSO = 'https://nominatim.openstreetmap.org/reverse';
const CAIXA_VISUALIZACAO_POA = '-51.30,-30.27,-51.03,-29.93';

export interface ResultadoGeocodificacao {
  rotulo: string;
  lat: number;
  lon: number;
}

// Abreviações comuns em endereços brasileiros — o Nominatim às vezes não
// casa "av" com "avenida" ou "r." com "rua", especialmente quando vem sem
// espaço ou ponto. Expandir antes de buscar aumenta a taxa de acerto sem
// mudar o que a pessoa efetivamente digitou ou falou.
const ABREVIACOES: [RegExp, string][] = [
  [/^av\.?\s+/i, 'avenida '],
  [/^r\.?\s+/i, 'rua '],
  [/^trav\.?\s+/i, 'travessa '],
  [/^al\.?\s+/i, 'alameda '],
  [/^est\.?\s+/i, 'estrada '],
  [/^pca\.?\s+/i, 'praça '],
];

function normalizarEndereco(consulta: string): string {
  let texto = consulta.trim().replace(/\s+/g, ' ');
  for (const [padrao, substituto] of ABREVIACOES) {
    texto = texto.replace(padrao, substituto);
  }
  return texto;
}

function mapearResultado(dados: Array<{ display_name: string; lat: string; lon: string }>): ResultadoGeocodificacao[] {
  return dados.map((d) => ({ rotulo: d.display_name, lat: parseFloat(d.lat), lon: parseFloat(d.lon) }));
}

async function buscarNominatim(params: URLSearchParams): Promise<ResultadoGeocodificacao[]> {
  const url = `${NOMINATIM_BASE}?${params.toString()}`;
  // Toda chamada passa pelo limitador global (1 req/s somando busca direta e
  // reversa; 429/403 respeitados, sem retentativa imediata) — ver
  // limitadorNominatim.ts. Quem bloqueou: ErroNominatim, com mensagem pronta.
  const res = await fetchNominatim(url, { headers: { 'Accept-Language': 'pt-BR' } });
  if (!res.ok) throw new Error(`Falha na busca de endereço: HTTP ${res.status}`);
  return mapearResultado(await res.json());
}

// Checklist Fase 3, P9 ("controle das chamadas OSM", "cache"): Nominatim é
// gratuito e tem limite de ~1 req/s — e uma única chamada a esta função já
// pode disparar até 4 requisições HTTP de verdade (2 tentativas de busca ×
// até 2 tentativas cada, em caso de 429/403, ver buscarNominatim). Um cache
// em memória por sessão evita repetir TODAS essas requisições quando a
// pessoa busca o mesmo endereço de novo (reabriu o app, digitou igual por
// engano, Enter duplo que escapou do controle de concorrência em
// Aplicativo.tsx) — sem guardar erro em cache, pra uma tentativa seguinte
// poder tentar de novo normalmente.
const TAMANHO_MAXIMO_CACHE = 200;
const cacheConsultas = new Map<string, Promise<ResultadoGeocodificacao[]>>();

export function geocodificarEndereco(consultaBruta: string): Promise<ResultadoGeocodificacao[]> {
  const consulta = normalizarEndereco(consultaBruta);
  if (!consulta) return Promise.resolve([]);

  const chave = consulta.toLowerCase();
  const emCache = cacheConsultas.get(chave);
  if (emCache) return emCache;

  const promessa = buscarEnderecoSemCache(consulta).catch((err: unknown) => {
    cacheConsultas.delete(chave);
    throw err;
  });

  if (cacheConsultas.size >= TAMANHO_MAXIMO_CACHE) {
    const maisAntiga = cacheConsultas.keys().next().value;
    if (maisAntiga !== undefined) cacheConsultas.delete(maisAntiga);
  }
  cacheConsultas.set(chave, promessa);
  return promessa;
}

async function buscarEnderecoSemCache(consulta: string): Promise<ResultadoGeocodificacao[]> {
  const jaMencionaCidade = /porto alegre/i.test(consulta);
  const textoBusca = jaMencionaCidade ? consulta : `${consulta}, Porto Alegre, RS`;

  // 1ª tentativa: restrita à área de Porto Alegre (bounded=1) — evita
  // confundir com ruas de mesmo nome em outras cidades.
  const resultadosRestritos = await buscarNominatim(
    new URLSearchParams({
      q: textoBusca,
      format: 'jsonv2',
      limit: '5',
      viewbox: CAIXA_VISUALIZACAO_POA,
      bounded: '1',
      countrycodes: 'br',
    })
  );
  if (resultadosRestritos.length > 0) return resultadosRestritos;

  // 2ª tentativa: a mesma área agora como preferência, não como limite
  // rígido. bounded=1 descarta qualquer rua cujo ponto de referência no OSM
  // caia um pouco fora da caixa (bairros de divisa como Belém Novo, Lomba do
  // Pinheiro, Restinga; ruas compridas que cruzam a borda do mapa) — mesmo
  // que a rua exista de verdade dentro de Porto Alegre. Isso é o que fazia
  // algumas ruas reais "não serem encontradas".
  return buscarNominatim(
    new URLSearchParams({
      q: textoBusca,
      format: 'jsonv2',
      limit: '5',
      viewbox: CAIXA_VISUALIZACAO_POA,
      bounded: '0',
      countrycodes: 'br',
    })
  );
}

/**
 * Geocodificação reversa (coordenada -> endereço legível) — necessária pra
 * narrar/confirmar "você está reportando em [endereço]" quando a
 * localização vem do GPS, já que o GPS só dá lat/lon, não um endereço.
 * Mesmo serviço (Nominatim) já usado na busca direta — não é um segundo
 * sistema de geocodificação, é o mesmo, na direção contrária.
 */
// Cache da geocodificação reversa: arredonda a 4 casas (~11 m) — coordenadas
// praticamente iguais (GPS oscilando parado) reaproveitam o mesmo endereço.
// Só guarda SUCESSO; falha/null nunca fica em cache.
const cacheReverso = new Map<string, Promise<string | null>>();

export function geocodificarReverso(lat: number, lon: number): Promise<string | null> {
  const chave = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const emCache = cacheReverso.get(chave);
  if (emCache) return emCache;

  const promessa = buscarReversoSemCache(lat, lon).then((endereco) => {
    if (endereco === null) cacheReverso.delete(chave);
    return endereco;
  });

  if (cacheReverso.size >= TAMANHO_MAXIMO_CACHE) {
    const maisAntiga = cacheReverso.keys().next().value;
    if (maisAntiga !== undefined) cacheReverso.delete(maisAntiga);
  }
  cacheReverso.set(chave, promessa);
  return promessa;
}

async function buscarReversoSemCache(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '0',
  });
  try {
    const res = await fetchNominatim(`${NOMINATIM_REVERSO}?${params.toString()}`, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!res.ok) return null;
    const dados = (await res.json()) as { display_name?: string };
    return dados.display_name ?? null;
  } catch {
    // 429/403 (ErroNominatim) e falha de rede: sem endereço legível — quem
    // chama já tem o fallback pras coordenadas. Nunca lança (antes, uma falha
    // de rede aqui deixava o spinner do Reportar preso).
    return null;
  }
}
