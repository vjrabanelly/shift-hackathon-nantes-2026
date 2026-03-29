import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load root .env (two levels up from apps/web)
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '../..'), '')
  const apiUrl = process.env.VITE_API_URL ?? rootEnv.VITE_API_URL ?? 'http://127.0.0.1:3000'

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        rootEnv.VITE_SUPABASE_URL ?? rootEnv.SUPABASE_URL
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        rootEnv.VITE_SUPABASE_ANON_KEY ?? rootEnv.SUPABASE_ANON_KEY
      ),
    },
    server: {
      proxy: {
        '/events': apiUrl,
        '/stream': apiUrl,
      },
    },
    build: {
      outDir: 'dist',
    },
  }
})
