import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The Firebase SDK is ~170 kB gzipped; that is expected and fine, but it
    // is worth tracking, so we keep the warning on rather than hiding it.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /*
         * Split vendor code by concern so a Firebase Auth-only change does not
         * invalidate the Firestore chunk in users' caches. The function form
         * works across Rollup and Rolldown.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('@firebase/firestore')) return 'firebase-firestore';
          if (id.includes('@firebase/auth')) return 'firebase-auth';
          if (id.includes('@firebase/storage')) return 'firebase-storage';
          if (id.includes('@firebase') || id.includes('firebase/app')) return 'firebase-core';

          if (id.includes('react-dom') || id.includes('react-router') || id.includes('scheduler')) {
            return 'react';
          }
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) {
            return 'forms';
          }
          return undefined;
        },
      },
    },
  },
});
