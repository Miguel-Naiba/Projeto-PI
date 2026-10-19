import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolverConfigSupabase } from './configSupabase';

// Prefere VITE_SUPABASE_PUBLISHABLE_KEY; VITE_SUPABASE_ANON_KEY (legada) segue
// como fallback. Chaves secretas são recusadas — ver configSupabase.ts.
const configSupabase = resolverConfigSupabase({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const supabase: SupabaseClient | null = configSupabase ? createClient(configSupabase.url, configSupabase.chave) : null;
