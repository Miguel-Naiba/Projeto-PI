import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Bug reportado em produção: com o Supabase configurado e as tabelas
// criadas (supabase/schema.sql) mas ainda SEM NENHUMA LINHA sincronizada
// (sync nunca rodou), o fallback `data ?? carregarDoJsonEstatico()` não
// disparava — array/Set vazio não é null/undefined — e paradas com piso
// tátil e obras sumiam do mapa e da categoria de Reportar. Este arquivo
// testa que, agora, uma resposta "sucesso mas vazia" do Supabase cai pro
// JSON estático (que tem os dados reais) exatamente como uma resposta com
// erro já caía.

const JSON_PARADAS = { paradas: [{ stop_id: 'p1' }, { stop_id: 'p2' }] };
const JSON_BOTOEIRAS = { botoeiras: [{ id: 'b1', local: 'Teste', lat: -30.03, lon: -51.23, fonte: 'eptc' }] };
const JSON_OBRAS = { obras: [{ id: 'o1', nome: 'Obra teste', lat: -30.03, lon: -51.23, fonte: 'smoi' }] };

function respostaJson(corpo: unknown) {
  return { ok: true, headers: { get: () => 'application/json' }, json: async () => corpo } as unknown as Response;
}

function supabaseFalso(linhas: unknown[] | null, erro: { message: string } | null = null) {
  return { from: () => ({ select: async () => ({ data: linhas, error: erro }) }) };
}

describe('fallback Supabase → JSON estático (tabela vazia, não só erro)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('./supabaseClient');
  });

  it('paradas com piso tátil: tabela Supabase vazia (sucesso, 0 linhas) cai pro JSON estático', async () => {
    vi.doMock('./supabaseClient', () => ({ supabase: supabaseFalso([]) }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(JSON_PARADAS)));
    const { carregarIdsParadasTatilEptc } = await import('./pisoTatilEptc');
    const ids = await carregarIdsParadasTatilEptc();
    expect(Array.from(ids)).toEqual(['p1', 'p2']);
  });

  it('paradas com piso tátil: tabela Supabase com erro continua caindo pro JSON (comportamento preservado)', async () => {
    vi.doMock('./supabaseClient', () => ({ supabase: supabaseFalso(null, { message: 'relation does not exist' }) }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(JSON_PARADAS)));
    const { carregarIdsParadasTatilEptc } = await import('./pisoTatilEptc');
    const ids = await carregarIdsParadasTatilEptc();
    expect(Array.from(ids)).toEqual(['p1', 'p2']);
  });

  it('paradas com piso tátil: tabela Supabase com linhas de verdade NÃO cai pro JSON (usa o dado real)', async () => {
    vi.doMock('./supabaseClient', () => ({ supabase: supabaseFalso([{ stop_id: 'real-1' }]) }));
    const fetchMock = vi.fn().mockResolvedValue(respostaJson(JSON_PARADAS));
    vi.stubGlobal('fetch', fetchMock);
    const { carregarIdsParadasTatilEptc } = await import('./pisoTatilEptc');
    const ids = await carregarIdsParadasTatilEptc();
    expect(Array.from(ids)).toEqual(['real-1']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('botoeiras: tabela Supabase vazia cai pro JSON estático', async () => {
    vi.doMock('./supabaseClient', () => ({ supabase: supabaseFalso([]) }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(JSON_BOTOEIRAS)));
    const { carregarBotoeirasEptc } = await import('./botoeirasEptc');
    const botoeiras = await carregarBotoeirasEptc();
    expect(botoeiras.map((b) => b.id)).toEqual(['b1']);
  });

  it('obras: tabela Supabase vazia cai pro JSON estático', async () => {
    vi.doMock('./supabaseClient', () => ({ supabase: supabaseFalso([]) }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(JSON_OBRAS)));
    const { carregarObrasSmoi } = await import('./obrasSmoi');
    const obras = await carregarObrasSmoi();
    expect(obras.map((o) => o.id)).toEqual(['o1']);
  });

  it('sem Supabase configurado (cliente null), vai direto pro JSON — comportamento preservado', async () => {
    vi.doMock('./supabaseClient', () => ({ supabase: null }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(JSON_OBRAS)));
    const { carregarObrasSmoi } = await import('./obrasSmoi');
    const obras = await carregarObrasSmoi();
    expect(obras.map((o) => o.id)).toEqual(['o1']);
  });
});
