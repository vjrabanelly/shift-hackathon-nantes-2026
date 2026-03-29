import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Separate Vite build config for tracker scripts injected into Instagram WebView.
 * Builds as IIFE (no modules, no imports) so it can be evaluateJavascript'd.
 */
export default defineConfig({
  build: {
    outDir: 'www',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/tracker/scrollout-ui.ts'),
      name: 'ScrolloutUI',
      formats: ['iife'],
      fileName: () => 'scrollout-ui.js',
    },
    minify: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
