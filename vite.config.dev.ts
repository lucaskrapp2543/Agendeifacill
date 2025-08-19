import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuração específica para desenvolvimento
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    strictPort: false, // Permite outras portas se 5173 estiver ocupada
    host: true,
    watch: {
      usePolling: true,
      interval: 100, // Verifica mudanças a cada 100ms
    },
    headers: {
      // Headers anti-cache mais agressivos
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, private',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString(),
      'ETag': `"${Date.now()}"`,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
    hmr: {
      overlay: true,
      // Força reload em mudanças
      reload: true,
    },
    // Middleware para forçar cache busting
    middlewareMode: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Habilita sourcemaps para debug
    rollupOptions: {
      output: {
        // Adiciona hash único para cada build
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          return `assets/[name]-[hash].${ext}`;
        },
      },
    },
  },
  // Configuração para desenvolvimento
  define: {
    __DEV__: true,
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
