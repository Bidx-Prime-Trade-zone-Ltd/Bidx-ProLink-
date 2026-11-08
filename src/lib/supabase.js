import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError = (!url || !anonKey)
  ? 'Authentication is not configured in this build. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the production build environment.'
  : '';

export const supabase = supabaseConfigError ? null : createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});
