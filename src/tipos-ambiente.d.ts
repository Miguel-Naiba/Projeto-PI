/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAVE_API_ORS?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Chave anon legada — fallback de compatibilidade enquanto o Supabase migra para publishable. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
