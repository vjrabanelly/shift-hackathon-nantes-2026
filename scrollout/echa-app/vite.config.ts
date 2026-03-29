import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'static',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../src/enrichment'),
    },
  },
  build: {
    outDir: 'www',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
