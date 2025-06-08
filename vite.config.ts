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
    strictPort: true, // Não tentar outras portas se 5173 estiver ocupada
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Configuração para servir o index.html em todas as rotas
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
