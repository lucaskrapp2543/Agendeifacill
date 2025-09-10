import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    strictPort: false, // Permitir outras portas se 5173 estiver ocupada
    host: true, // Necessário para network access
    watch: {
      usePolling: true, // Melhor compatibilidade com Windows
    },
    // Configuração para lidar com rotas do React Router
    proxy: {
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
    // Configurações para evitar cache - ULTRA AGRESSIVAS
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, no-transform',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Last-Modified': new Date().toUTCString(),
      'ETag': `"${Date.now()}-${Math.random()}"`,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
    // Forçar reload automático
    hmr: {
      overlay: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Configuração para servir o index.html em todas as rotas
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Configuração para forçar atualizações automáticas
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // Adicionar timestamp para evitar cache
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          const timestamp = Date.now();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/[name]-v2.1.0-[hash]-${timestamp}.${ext}`;
          }
          return `assets/[name]-v2.1.0-[hash]-${timestamp}.${ext}`;
        },
        chunkFileNames: `assets/[name]-v2.1.0-[hash]-${Date.now()}.js`,
        entryFileNames: `assets/[name]-v2.1.0-[hash]-${Date.now()}.js`,
      },
    },
    // Configurações anti-cache
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Manter console para debug
      },
    },
    // Forçar cache busting em todos os assets
    assetsInlineLimit: 0,
  },
});
