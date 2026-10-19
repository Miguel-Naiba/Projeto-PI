/**
 * Resolve a configuração pública do Supabase a partir das variáveis VITE_*
 * (Fase A, item F). Função pura — não cria client — para ser testável.
 *
 * Chaves: o Supabase está substituindo as chaves legadas `anon`/`service_role`
 * pelas novas `publishable` (sb_publishable_...) e `secret` (sb_secret_...)
 * até o fim de 2026. Aqui a publishable é a preferida; a anon legada continua
 * valendo como fallback de compatibilidade (não desligar antes de confirmar a
 * migração no painel).
 *
 * IMPORTANTE: toda variável VITE_* vai parar no bundle do navegador — nunca é
 * segredo. Por isso uma chave SECRETA (sb_secret_... ou JWT com role
 * service_role) é recusada aqui: ela daria acesso total ao banco, ignorando
 * RLS, a qualquer visitante que abrisse o DevTools. O valor nunca é logado.
 */

export interface EntradaConfigSupabase {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface ConfigSupabase {
  url: string;
  chave: string;
}

function limpar(valor: string | undefined): string | undefined {
  const t = valor?.trim();
  return t ? t : undefined;
}

function pareceChaveSecreta(chave: string): boolean {
  if (chave.startsWith('sb_secret_')) return true;
  const partes = chave.split('.');
  if (partes.length !== 3) return false;
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export function resolverConfigSupabase(env: EntradaConfigSupabase): ConfigSupabase | null {
  const url = limpar(env.VITE_SUPABASE_URL);
  const chave = limpar(env.VITE_SUPABASE_PUBLISHABLE_KEY) ?? limpar(env.VITE_SUPABASE_ANON_KEY);
  if (!url || !chave) return null;

  if (pareceChaveSecreta(chave)) {
    console.error(
      'Supabase: a chave configurada no frontend é uma chave SECRETA (service_role/sb_secret_). ' +
        'Ela foi ignorada por segurança — use a chave publishable (ou a anon legada) em ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY e revogue/troque a chave exposta no painel do Supabase.'
    );
    return null;
  }
  return { url, chave };
}
