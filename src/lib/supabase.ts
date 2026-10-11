import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * A chave anon/publishable é própria para uso no browser.
 * Nunca coloque a chave service_role neste projeto ou nas variáveis públicas do Vercel.
 */
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
export const supabaseConfigured = Boolean(supabase);
