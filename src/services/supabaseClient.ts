import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE_ANONIMA_SUPABASE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  URL_SUPABASE && CHAVE_ANONIMA_SUPABASE ? createClient(URL_SUPABASE, CHAVE_ANONIMA_SUPABASE) : null;
