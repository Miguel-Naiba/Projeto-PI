import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodificarEndereco } from './geocodificacao';
import { configurarLimitadorNominatim, reiniciarLimitadorNominatim } from './limitadorNominatim';

function respostaOk(corpo: unknown) {
  return { ok: true, status: 200, json: async () => corpo } as unknown as Response;
}

function respostaErro(status: number) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

const RESULTADO_FALSO = [{ display_name: 'Rua de Teste, Porto Alegre, RS', lat: '-30.03', lon: '-51.23' }];

describe('geocodificarEndereco — cache/dedup em memória (checklist Fase 3, P9)', () => {
  beforeEach(() => {
    // Estes testes verificam cache/dedup, não o espaçamento (coberto em limitadorNominatim.test.ts).
    reiniciarLimitadorNominatim();
    configurarLimitadorNominatim({ intervaloMs: 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a mesma consulta duas vezes em paralelo reaproveita a mesma requisição (não dobra chamadas ao Nominatim)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk(RESULTADO_FALSO));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([geocodificarEndereco('Rua de Teste'), geocodificarEndereco('Rua de Teste')]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a mesma consulta de novo depois que a primeira já terminou também reaproveita o cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk(RESULTADO_FALSO));
    vi.stubGlobal('fetch', fetchMock);

    await geocodificarEndereco('Avenida Cache');
    await geocodificarEndereco('Avenida Cache');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('consultas diferentes nunca compartilham cache entre si', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaOk(RESULTADO_FALSO));
    vi.stubGlobal('fetch', fetchMock);

    await geocodificarEndereco('Primeira Rua Distinta');
    await geocodificarEndereco('Segunda Rua Distinta');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uma consulta que falhou NÃO fica em cache — a próxima tentativa dispara uma nova requisição', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaErro(500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodificarEndereco('Rua Que Falha')).rejects.toThrow();
    await expect(geocodificarEndereco('Rua Que Falha')).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('consulta vazia nunca chega a chamar fetch nem entra em cache', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await geocodificarEndereco('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
