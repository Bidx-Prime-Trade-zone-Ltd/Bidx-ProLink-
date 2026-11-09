import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cloudflare Workers Builds can expose variables under either the Vite-prefixed
  // names or the project-level Supabase names. Only the public URL and anon key
  // are mapped into the browser bundle; service-role and other secrets are never
  // exposed through Vite's envPrefix.
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey)
    },
    server: { host: '0.0.0.0' },
    preview: { host: '0.0.0.0' }
  };
});
