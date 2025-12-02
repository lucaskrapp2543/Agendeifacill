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
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
    // Forçar reload quando chunks mudarem
    fs: {
      strict: true,
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
        // Usar hash baseado no conteúdo para evitar referências a chunks antigos
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
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
