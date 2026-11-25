import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { workbenchPlugin } from './src/workbench/devServer';

const root = path.dirname(fileURLToPath(import.meta.url));

// The procedural asset modules live untouched in References/ and are imported
// in place (lazily, one chunk per module). Every module imports `three`, so the
// dependency is de-duplicated to the single copy installed at the repo root.
export default defineConfig({
  base: './',
  // workbenchPlugin: dev-only file access for the animal workbench (workbench.html)
  plugins: [react(), tailwindcss(), workbenchPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@ref': path.resolve(root, 'References'),
    },
    dedupe: ['three'],
  },
  // Only scan the app's own pages (the app and its dev tools); the reference studios have
  // their own index.html files and dependencies that are not part of this app.
  optimizeDeps: { entries: ['index.html', 'workbench.html', 'review.html'], include: ['three', 'blockly'] },
  server: { host: true },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/blockly/')) return 'blockly';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
});
