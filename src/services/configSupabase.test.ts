import { describe, expect, it, vi } from 'vitest';
import { resolverConfigSupabase } from './configSupabase';

const URL_OK = 'https://abc.supabase.co';

/** JWT legado fictício só com o payload necessário (assinatura irrelevante aqui). */
function jwtLegado(role: 'anon' | 'service_role'): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role })}.assinatura-falsa`;
}

describe('resolverConfigSupabase (Fase A, item F)', () => {
  it('prefere a chave publishable quando as duas existem', () => {
    const cfg = resolverConfigSupabase({
      VITE_SUPABASE_URL: URL_OK,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_nova',
      VITE_SUPABASE_ANON_KEY: jwtLegado('anon'),
    });
    expect(cfg?.chave).toBe('sb_publishable_nova');
  });

  it('cai na chave anon legada quando só ela existe (compatibilidade)', () => {
    const anon = jwtLegado('anon');
    expect(resolverConfigSupabase({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: anon })?.chave).toBe(anon);
  });

  it('publishable vazia ou só espaços é tratada como ausente (usa a anon)', () => {
    const anon = jwtLegado('anon');
    const cfg = resolverConfigSupabase({
      VITE_SUPABASE_URL: URL_OK,
      VITE_SUPABASE_PUBLISHABLE_KEY: '   ',
      VITE_SUPABASE_ANON_KEY: anon,
    });
    expect(cfg?.chave).toBe(anon);
  });

  it('sem URL ou sem nenhuma chave: não configurado (null) — o app segue com fallback local', () => {
    expect(resolverConfigSupabase({})).toBeNull();
    expect(resolverConfigSupabase({ VITE_SUPABASE_URL: URL_OK })).toBeNull();
    expect(resolverConfigSupabase({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' })).toBeNull();
  });

  it('RECUSA chave secreta nova (sb_secret_...) no frontend, sem vazar o valor no log', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const segredo = 'sb_secret_valor_super_sigiloso';
    const cfg = resolverConfigSupabase({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: segredo });
    expect(cfg).toBeNull();
    expect(erro).toHaveBeenCalled();
    expect(JSON.stringify(erro.mock.calls)).not.toContain(segredo);
    erro.mockRestore();
  });

  it('RECUSA JWT legado com role service_role, mesmo na variável ANON', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const servico = jwtLegado('service_role');
    expect(resolverConfigSupabase({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_ANON_KEY: servico })).toBeNull();
    expect(JSON.stringify(erro.mock.calls)).not.toContain(servico);
    erro.mockRestore();
  });

  it('chave que não é JWT nem sb_secret_ (formato desconhecido) não é bloqueada', () => {
    expect(resolverConfigSupabase({ VITE_SUPABASE_URL: URL_OK, VITE_SUPABASE_PUBLISHABLE_KEY: 'qualquer-coisa' })).not.toBeNull();
  });
});
