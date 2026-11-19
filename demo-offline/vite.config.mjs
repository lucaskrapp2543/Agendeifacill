// ════════════════════════════════════════════════════════════════════════
// APRESENTAÇÃO OFFLINE — montagem separada do sistema de verdade.
// Usada só por demo-offline/montar.mjs. O site normal continua usando o
// vite.config.ts da raiz e não enxerga nada daqui.
//
// O que esta montagem troca:
//   • a biblioteca do banco vira o "banco de mentira" (src/supabaseFalso.js);
//   • as peças que limpam cache / forçam atualização viram "não faz nada"
//     (elas apagariam o próprio app offline);
//   • o index.html perde os scripts externos (Google, Mercado Pago etc.).
// ════════════════════════════════════════════════════════════════════════
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '..');

const TROCAS = {
  'src/components/CacheBuster.tsx': 'export const CacheBuster = () => null;',
  'src/components/UpdateNotification.tsx': 'export const UpdateNotification = () => null;',
  'src/components/PWARedirect.tsx': 'export const PWARedirect = () => null;',
  'src/components/UpdateButton.tsx': 'export const UpdateButton = () => null; export default UpdateButton;',
  'src/components/RefreshButton.tsx': 'export const RefreshButton = () => null; export default RefreshButton;',
  'src/utils/serviceWorker.ts': 'export async function unregisterServiceWorker() {} export async function clearAllCaches() {} export async function forceUpdate() {} export const registerServiceWorker = async () => {};',
  'src/utils/autoCacheCleaner.ts': 'export const performHealthCheck = () => ({ isHealthy: true, healthy: true, issues: [] }); export const autoCleanup = async () => {}; export const detectLoadProblems = () => false; export const startAutoMonitoring = () => {}; export const aggressiveInitialCheck = () => false; export const initializeAutoCleanup = () => {};',
};

function trocarPecas() {
  return {
    name: 'af-demo-trocar-pecas',
    enforce: 'pre',
    load(id) {
      const limpo = id.split('?')[0].replace(/\\/g, '/');
      for (const [fim, codigo] of Object.entries(TROCAS)) {
        if (limpo.endsWith('/' + fim)) return codigo;
      }
      return null;
    },
  };
}

const CABECA = `
  <meta name="robots" content="noindex, nofollow">
  <script>
    // Apresentação offline: nada pode apagar o app guardado no aparelho.
    try { ServiceWorkerRegistration.prototype.unregister = function () { return Promise.resolve(false); }; } catch (e) {}
    try { CacheStorage.prototype.delete = function () { return Promise.resolve(false); }; } catch (e) {}
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {};
    window.fbq = window.fbq || function () {};
    window.__AF_DEMO_OFFLINE__ = true;
  </script>`;
const RODAPE = `
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () { navigator.serviceWorker.register('/sw-demo.js').catch(function () {}); });
    }
  </script>`;

function htmlDaApresentacao() {
  return {
    name: 'af-demo-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let h = html;
        // Tira todos os scripts, menos o do próprio sistema (type="module").
        h = h.replace(/<script\b(?![^>]*type="module")[^>]*>[\s\S]*?<\/script>/gi, '');
        // Tira fontes e pré-conexões externas (offline não carregam).
        h = h.replace(/<link\b[^>]*(fonts\.googleapis|fonts\.gstatic)[^>]*>/gi, '');
        h = h.replace(/<title>[\s\S]*?<\/title>/i, '<title>Agendei Fácil — Apresentação</title>');
        h = h.replace(/<head([^>]*)>/i, `<head$1>${CABECA}`);
        h = h.replace(/<script type="module"/i, '<script src="/demo-chart.umd.js"></script>\n  <script type="module"');
        h = h.replace(/<\/body>/i, `${RODAPE}\n</body>`);
        return h;
      },
    },
  };
}

export default defineConfig({
  root: raiz,
  envDir: aqui, // não lê o .env de verdade: nenhuma chave real entra no app offline
  publicDir: false, // as imagens são copiadas (só as usadas, comprimidas) pelo montar.mjs
  plugins: [trocarPecas(), react(), htmlDaApresentacao()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://offline.invalid'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('offline'),
    'import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY': JSON.stringify(''),
    'import.meta.env.VITE_PAGARME_PUBLIC_KEY': JSON.stringify(''),
    'import.meta.env.VITE_PAGARME_API_KEY': JSON.stringify(''),
  },
  resolve: {
    alias: [
      { find: '@supabase/supabase-js', replacement: path.resolve(aqui, 'src/supabaseFalso.js') },
      { find: '@', replacement: path.resolve(raiz, 'src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: process.env.AF_DEMO_SAIDA || path.resolve(aqui, 'saida/app'),
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 20000,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
