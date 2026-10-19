import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarRota } from './api';
import { geojsonValido } from './fixturesRota.test-utils';
import { PRAZO_ORS_MS } from './requisicao';

function respostaFalsa(status: number, corpo: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response;
}

describe('buscarRota — tratamento de erros do OpenRouteService (checklist item 17)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('401 — chave inválida gera mensagem amigável e preserva o status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(401)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'chave-invalida')).rejects.toMatchObject({
      message: expect.stringMatching(/chave.*inválida|não reconhecida/i),
      status: 401,
    });
  });

  it('403 — chave sem permissão pro perfil', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(403)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'chave-sem-permissao')).rejects.toMatchObject({
      message: expect.stringMatching(/permissão/i),
      status: 403,
    });
  });

  it('404 — endereço do serviço não encontrado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(404)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'token-teste')).rejects.toMatchObject({
      message: expect.stringMatching(/endereço.*não foi encontrado/i),
      status: 404,
    });
  });

  it('429 — limite de uso excedido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(429)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'token-teste')).rejects.toMatchObject({
      message: expect.stringMatching(/limite/i),
      status: 429,
    });
  });

  it('status HTTP não mapeado cai para uma mensagem genérica com o código', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(500)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'token-teste')).rejects.toMatchObject({
      message: expect.stringMatching(/500/),
      status: 500,
    });
  });

  it('falha de rede é traduzida sem inventar rota', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'token-teste')).rejects.toMatchObject({ tipo: 'rede', message: expect.stringMatching(/conexão/i) });
  });

  it('sucesso (200) devolve o GeoJSON e manda a Authorization com a chave recebida', async () => {
    const geojson = geojsonValido();
    const fetchMock = vi.fn().mockResolvedValue(respostaFalsa(200, geojson));
    vi.stubGlobal('fetch', fetchMock);
    const resultado = await buscarRota([-30.03, -51.22], [-30.04, -51.23], 'minha-chave');
    expect(resultado).toEqual(geojson);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('minha-chave');
  });
});

describe('buscarRota — endpoint do OpenRouteService (Fase A, item A)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa o host novo api.heigit.org e preserva o perfil foot-walking', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => geojsonValido() });
    vi.stubGlobal('fetch', fetchMock);
    await buscarRota([-30.03, -51.22], [-30.04, -51.23], 'token-teste');
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson');
  });

  it('nunca chama o host descontinuado api.openrouteservice.org', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => geojsonValido() });
    vi.stubGlobal('fetch', fetchMock);
    await buscarRota([-30.03, -51.22], [-30.04, -51.23], 'token-teste', 'foot-walking', {
      alternativas: { targetCount: 3 },
    });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('api.openrouteservice.org');
  });

  it('continua enviando alternative_routes e avoid_polygons no corpo da requisição', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => geojsonValido() });
    vi.stubGlobal('fetch', fetchMock);
    const poligono: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
    await buscarRota([-30.03, -51.22], [-30.04, -51.23], 'token-teste', 'foot-walking', {
      alternativas: { targetCount: 2 },
      evitarPoligonos: poligono,
    });
    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(corpo.alternative_routes.target_count).toBe(2);
    expect(corpo.options.avoid_polygons).toEqual(poligono);
  });
});


describe('buscarRota — validação e prazo', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it.each(['', '   ', 'sua_chave_aqui', 'YOUR_API_KEY', 'YOUR_ORS_API_KEY', 'API_KEY', 'chave', 'undefined', '<token>'])('não envia configuração inválida: %s', async chave => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(buscarRota([-30, -51], [-30.1, -51.1], chave)).rejects.toMatchObject({ tipo: 'configuracao' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([null, {}, {type: 'FeatureCollection', features: []},
    geojsonValido({ type: 'Point' }), geojsonValido({ coordinates: [[-51, -30]] }),
    geojsonValido({ coordinates: [[NaN, -30], [-51, -31]] }),
    geojsonValido({ coordinates: [[-51, 91], [-51, -31]] }),
  ])('rejeita GeoJSON inválido %#', async dados => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(200, dados)));
    await expect(buscarRota([-30, -51], [-31, -51], 'token-teste')).rejects.toMatchObject({ tipo: 'resposta' });
  });
  it('rejeita summary e índice de instrução inválidos', async () => {
    const dados = geojsonValido(); dados.features[0].properties.segments[0].steps[0].way_points = [0, 200];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(200, dados)));
    await expect(buscarRota([-30, -51], [-31, -51], 'token-teste')).rejects.toMatchObject({ tipo: 'resposta' });
    dados.features[0].properties.summary.distance = Infinity;
    await expect(buscarRota([-30, -51], [-31, -51], 'token-teste')).rejects.toMatchObject({ tipo: 'resposta' });
  });
  it.each([503, 504])('classifica HTTP %d sem retentar', async status => {
    const f = vi.fn().mockResolvedValue(respostaFalsa(status)); vi.stubGlobal('fetch', f);
    await expect(buscarRota([-30, -51], [-31, -51], 'token-teste')).rejects.toMatchObject({ tipo: 'http', status });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('limita tempo e distingue timeout de cancelamento voluntário', async () => {
    vi.useFakeTimers();
    let sinal: AbortSignal;
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      sinal = init.signal;
      sinal.addEventListener('abort', () => reject(sinal.reason));
    })));
    const promessa = buscarRota([-30, -51], [-31, -51], 'token-teste');
    const erro = expect(promessa).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(PRAZO_ORS_MS); await erro;
    expect(sinal!.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
    const controle = new AbortController();
    const outra = buscarRota([-30, -51], [-31, -51], 'token-teste', 'foot-walking', { sinal: controle.signal });
    const cancelada = expect(outra).rejects.toMatchObject({ name: 'AbortError' });
    controle.abort(); await cancelada; expect(vi.getTimerCount()).toBe(0);
  });
  it('preserva a ordem lon/lat no corpo', async () => {
    const f = vi.fn().mockResolvedValue(respostaFalsa(200, geojsonValido())); vi.stubGlobal('fetch', f);
    await buscarRota([-30, -51], [-31, -52], 'token-teste');
    expect(JSON.parse(f.mock.calls[0][1].body).coordinates).toEqual([[-51, -30], [-52, -31]]);
  });
  it('respeita Retry-After sem repetir chamada durante o bloqueio', async () => {
    vi.useFakeTimers();
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '120' } }));
    vi.stubGlobal('fetch', f);
    await expect(buscarRota([-30, -51], [-31, -51], 'token-teste')).rejects.toMatchObject({ status: 429, retryAfterMs: 120000 });
    await expect(buscarRota([-30, -51], [-31, -51], 'token-teste')).rejects.toMatchObject({ status: 429 });
    expect(f).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120001);
    f.mockResolvedValue(respostaFalsa(200, geojsonValido()));
    await expect(buscarRota([-30, -51], [-31, -51], 'token-teste')).resolves.toHaveProperty('features');
  });
});
