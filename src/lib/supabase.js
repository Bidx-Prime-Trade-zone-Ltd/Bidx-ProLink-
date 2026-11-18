import { createClient } from '@supabase/supabase-js';

// Build-time values remain supported, while Worker runtime secrets are
// injected into the HTML shell for deployments that keep variables at runtime.
const runtimeConfig = typeof window !== 'undefined'
  ? (window.__BIDX_PROLINK_CONFIG__ || {})
  : {};
const url = import.meta.env.VITE_SUPABASE_URL || runtimeConfig.supabaseUrl || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeConfig.supabaseAnonKey || '';

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
