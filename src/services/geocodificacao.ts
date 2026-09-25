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
  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });

  if (res.status === 403 || res.status === 429) {
    // O Nominatim é um serviço público gratuito com limite de ~1 req/s e já
    // bloqueou este projeto antes (ver ALTERACOES-FINAIS.md, script de
    // geocodificação de obras). Uma segunda tentativa depois de uma pausa
    // curta resolve a maioria dos bloqueios momentâneos por excesso de uso.
    await new Promise((resolve) => setTimeout(resolve, 700));
    const retentativa = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!retentativa.ok) throw new Error(`Falha na busca de endereço: HTTP ${retentativa.status}`);
    return mapearResultado(await retentativa.json());
  }

  if (!res.ok) throw new Error(`Falha na busca de endereço: HTTP ${res.status}`);
  return mapearResultado(await res.json());
}

export async function geocodificarEndereco(consultaBruta: string): Promise<ResultadoGeocodificacao[]> {
  const consulta = normalizarEndereco(consultaBruta);
  if (!consulta) return [];

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
export async function geocodificarReverso(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '0',
  });
  const url = `${NOMINATIM_REVERSO}?${params.toString()}`;

  const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
  if (res.status === 403 || res.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const retentativa = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    if (!retentativa.ok) return null;
    const dados = (await retentativa.json()) as { display_name?: string };
    return dados.display_name ?? null;
  }
  if (!res.ok) return null;
  const dados = (await res.json()) as { display_name?: string };
  return dados.display_name ?? null;
}
