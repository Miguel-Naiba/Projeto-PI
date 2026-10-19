import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configurarLimitadorNominatim,
  reiniciarLimitadorNominatim,
  fetchNominatim,
  ErroNominatim,
  INTERVALO_MINIMO_NOMINATIM_MS,
  PAUSA_PADRAO_429_MS,
  PAUSA_APOS_403_MS,
} from './limitadorNominatim';
import { geocodificarEndereco, geocodificarReverso } from './geocodificacao';

async function capturar(promessa: Promise<unknown>): Promise<ErroNominatim> {
  try {
    await promessa;
  } catch (e) {
    return e as ErroNominatim;
  }
  throw new Error('esperava uma rejeição, mas a promessa resolveu');
}

let tempo = 0;
function usarRelogioFalso() {
  tempo = 1_000_000;
  configurarLimitadorNominatim({
    agora: () => tempo,
    dormir: async (ms: number) => {
      tempo += ms;
    },
  });
}

function resposta(status: number, corpo: unknown = {}, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (nome: string) => headers[nome] ?? null },
    json: async () => corpo,
  } as unknown as Response;
}

const OK_BUSCA = [{ display_name: 'Rua X, Porto Alegre', lat: '-30.03', lon: '-51.23' }];

beforeEach(() => {
  reiniciarLimitadorNominatim();
  usarRelogioFalso();
});
afterEach(() => {
  vi.unstubAllGlobals();
  reiniciarLimitadorNominatim();
});

describe('limitador global do Nominatim — frequência (Fase A, item E)', () => {
  it('requisições simultâneas saem em fila, com no mínimo 1 s entre os inícios', async () => {
    const inicios: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      inicios.push(tempo);
      return resposta(200, []);
    }));
    await Promise.all([1, 2, 3, 4].map((i) => fetchNominatim(`https://x/${i}`)));
    expect(inicios).toHaveLength(4);
    for (let i = 1; i < inicios.length; i++) {
      expect(inicios[i] - inicios[i - 1]).toBeGreaterThanOrEqual(INTERVALO_MINIMO_NOMINATIM_MS);
    }
    expect(INTERVALO_MINIMO_NOMINATIM_MS).toBeGreaterThanOrEqual(1000);
  });

  it('busca direta e geocodificação reversa dividem o MESMO limite', async () => {
    const inicios: number[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      inicios.push(tempo);
      return url.includes('/reverse') ? resposta(200, { display_name: 'Endereço A' }) : resposta(200, OK_BUSCA);
    }));
    await Promise.all([geocodificarEndereco('Rua Limite Um'), geocodificarReverso(-30.031, -51.231)]);
    expect(inicios).toHaveLength(2);
    expect(inicios[1] - inicios[0]).toBeGreaterThanOrEqual(INTERVALO_MINIMO_NOMINATIM_MS);
  });
});

describe('limitador do Nominatim — 429 e 403 (Fase A, item E)', () => {
  it('429 respeita Retry-After: uma só requisição, sem retentativa automática, e bloqueia chamadas até o fim da espera', async () => {
    const fetchMock = vi.fn(async () => resposta(429, {}, { 'Retry-After': '5' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchNominatim('https://x/a')).rejects.toBeInstanceOf(ErroNominatim);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Ainda dentro da espera: nem tenta a rede.
    tempo += 4_000;
    await expect(fetchNominatim('https://x/b')).rejects.toBeInstanceOf(ErroNominatim);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Passada a espera, volta a funcionar.
    tempo += 1_500;
    fetchMock.mockResolvedValueOnce(resposta(200, []));
    await expect(fetchNominatim('https://x/c')).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('429 sem Retry-After usa a pausa padrão', async () => {
    const fetchMock = vi.fn(async () => resposta(429));
    vi.stubGlobal('fetch', fetchMock);
    const erro = await capturar(fetchNominatim('https://x/a'));
    expect(erro).toBeInstanceOf(ErroNominatim);
    expect(erro.esperaMs).toBe(PAUSA_PADRAO_429_MS);
  });

  it('403 NÃO é retentado: uma requisição, e pausa longa antes de qualquer nova tentativa', async () => {
    const fetchMock = vi.fn(async () => resposta(403));
    vi.stubGlobal('fetch', fetchMock);
    const erro = await capturar(fetchNominatim('https://x/a'));
    expect(erro.status).toBe(403);
    expect(erro.esperaMs).toBe(PAUSA_APOS_403_MS);
    tempo += 60_000;
    await expect(fetchNominatim('https://x/b')).rejects.toBeInstanceOf(ErroNominatim);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falha de rede propaga o erro sem bloquear as próximas tentativas', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(resposta(200, []));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchNominatim('https://x/a')).rejects.toThrow('Failed to fetch');
    await expect(fetchNominatim('https://x/b')).resolves.toBeDefined();
  });

  it('a busca de endereço, bloqueada pelo 429, rejeita com mensagem útil e sem martelar o serviço', async () => {
    const fetchMock = vi.fn(async () => resposta(429, {}, { 'Retry-After': '30' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(geocodificarEndereco('Rua Bloqueada Alfa')).rejects.toThrow(/pausa|segundos/i);
    await expect(geocodificarEndereco('Rua Bloqueada Beta')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('geocodificação reversa — cache e robustez (Fase A, item E)', () => {
  it('mesma coordenada (e coordenadas a poucos metros) reaproveitam o cache', async () => {
    const fetchMock = vi.fn(async () => resposta(200, { display_name: 'Av. Cache, 100' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await geocodificarReverso(-30.0301, -51.2301)).toBe('Av. Cache, 100');
    expect(await geocodificarReverso(-30.0301, -51.2301)).toBe('Av. Cache, 100');
    expect(await geocodificarReverso(-30.03012, -51.23012)).toBe('Av. Cache, 100'); // ~2 m de diferença
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falha NÃO fica em cache: a próxima tentativa consulta de novo', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(resposta(500)).mockResolvedValueOnce(resposta(200, { display_name: 'Rua Recuperada' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await geocodificarReverso(-30.05, -51.25)).toBeNull();
    expect(await geocodificarReverso(-30.05, -51.25)).toBe('Rua Recuperada');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('429, 403 e falha de rede devolvem null (o Reportar já cai nas coordenadas) em vez de lançar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(429)));
    expect(await geocodificarReverso(-30.06, -51.26)).toBeNull();
    reiniciarLimitadorNominatim();
    usarRelogioFalso();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await geocodificarReverso(-30.07, -51.27)).toBeNull();
  });
});
