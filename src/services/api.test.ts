import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarRota } from './api';

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

  it('404 — sem rota possível entre os pontos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(404)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'chave')).rejects.toMatchObject({
      message: expect.stringMatching(/não encontrou rota/i),
      status: 404,
    });
  });

  it('429 — limite de uso excedido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(429)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'chave')).rejects.toMatchObject({
      message: expect.stringMatching(/limite/i),
      status: 429,
    });
  });

  it('status HTTP não mapeado cai para uma mensagem genérica com o código', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFalsa(500)));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'chave')).rejects.toMatchObject({
      message: expect.stringMatching(/500/),
      status: 500,
    });
  });

  it('falha de rede (fetch rejeita) propaga o erro, sem inventar uma rota', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(buscarRota([-30.03, -51.22], [-30.04, -51.23], 'chave')).rejects.toThrow('Failed to fetch');
  });

  it('sucesso (200) devolve o GeoJSON e manda a Authorization com a chave recebida', async () => {
    const geojson = { type: 'FeatureCollection', features: [] };
    const fetchMock = vi.fn().mockResolvedValue(respostaFalsa(200, geojson));
    vi.stubGlobal('fetch', fetchMock);
    const resultado = await buscarRota([-30.03, -51.22], [-30.04, -51.23], 'minha-chave');
    expect(resultado).toEqual(geojson);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe('minha-chave');
  });
});
