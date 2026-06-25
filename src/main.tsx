import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { shouldDisableAggressiveReloads } from './utils/browserEnv';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { SupabaseProvider } from './context/SupabaseContext';

// ✅ DEV/LOCALHOST: remover Service Worker/caches antes de renderizar (evita UI “presa” em versão antiga)
// Proteção: faz isso só 1x por sessão para não criar loop de reload.
if (
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  !sessionStorage.getItem('__dev_sw_cleared__')
) {
  sessionStorage.setItem('__dev_sw_cleared__', '1');
  (async () => {
    try {
      const { unregisterServiceWorker, clearAllCaches } = await import('./utils/serviceWorker');
      await unregisterServiceWorker();
      await clearAllCaches();

      // Se a página estava controlada por SW antigo, um reload garante que pega assets atuais do Vite.
      const url = new URL(window.location.href);
      url.searchParams.set('_dev_refresh', String(Date.now()));
      window.location.replace(url.toString());
    } catch (e) {
      console.warn('⚠️ DEV: falha ao limpar SW/cache automaticamente:', e);
    }
  })();
}

// Adiciona meta tags anti-cache dinamicamente
const addAntiCacheMetaTags = () => {
  const metaTags = [
    { httpEquiv: 'Cache-Control', content: 'no-cache, no-store, must-revalidate, max-age=0' },
    { httpEquiv: 'Pragma', content: 'no-cache' },
    { httpEquiv: 'Expires', content: '0' }
  ];

  metaTags.forEach(tag => {
    if (!document.querySelector(`meta[http-equiv="${tag.httpEquiv}"]`)) {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', tag.httpEquiv);
      meta.setAttribute('content', tag.content);
      document.head.appendChild(meta);
    }
  });
};

// Adiciona meta tags anti-cache
addAntiCacheMetaTags();

// Detectar erros de carregamento de chunks JavaScript
const handleChunkErrors = () => {
  let reloadAttempts = 0;
  const maxReloadAttempts = 2;
  const disableAggressiveReloads = shouldDisableAggressiveReloads();

  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;

    // Verificar se é um erro de script ou link
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || '';

      // Verificar se é um chunk JavaScript que falhou
      if ((src.includes('chunk-') || (src.includes('.js') && src.includes('assets/'))) &&
        (event.message?.includes('404') || event.message?.includes('Failed to load'))) {
        console.error('❌ Erro 404 detectado em chunk:', src);

        // ⚠️ PROTEÇÃO: Verificar se navegador tem proteções agressivas antes de fazer reload
        const hasProtections = disableAggressiveReloads; // Já inclui detecção de navegadores com proteções

        // Evitar loops infinitos
        if (!hasProtections && reloadAttempts < maxReloadAttempts) {
          reloadAttempts++;

          // Limpar cache e recarregar (manter SW para PWA)
          setTimeout(async () => {
            try {
              // Limpar caches (mas manter SW registrado para PWA)
              if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
              }

              window.location.reload();
            } catch (error) {
              console.error('❌ Erro ao limpar cache:', error);
              if (!hasProtections) {
                window.location.reload();
              }
            }
          }, 1000);
        } else {
          if (!hasProtections) {
            console.error('❌ Muitas tentativas de reload (ou modo seguro em mobile/in-app), parando...');
          }
          // Mostrar mensagem ao usuário
          const root = document.getElementById('root');
          if (root) {
            root.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui;">
                <div>
                  <h1 style="font-size: 24px; margin-bottom: 16px;">Erro ao carregar aplicação</h1>
                  <p style="margin-bottom: 24px; color: #666;">Houve um problema ao carregar os arquivos necessários.</p>
                  <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                    Recarregar Página
                  </button>
                  <p style="margin-top: 16px; color: #888; font-size: 12px;">
                    Dica: se estiver abrindo pelo Instagram/WhatsApp, tente abrir no Chrome para melhor estabilidade.
                  </p>
                </div>
              </div>
            `;
          }
        }
      }
    }
  }, true); // Usar capture phase

  // Detectar erros não capturados
  window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Erro não tratado:', event.reason);

    // Se for erro de chunk, tentar recuperar
    if (event.reason?.message?.includes('chunk') ||
      event.reason?.message?.includes('404') ||
      event.reason?.message?.includes('Failed to load')) {
      if (!disableAggressiveReloads && reloadAttempts < maxReloadAttempts) {
        reloadAttempts++;
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  });
};

// Inicializar detecção de erros
handleChunkErrors();

// ⚠️ REMOVIDO: autoCacheCleaner causava loops infinitos
// Não é necessário - cacheCleaner.ts já detecta loops e Service Worker gerencia cache
// console.log('✅ AutoCacheCleaner removido (causava loops infinitos)');

// ⚠️ DETECÇÃO DE LOOP DE RELOAD: Verificar primeiro se há loop antes de qualquer coisa
if (
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1' &&
  !shouldDisableAggressiveReloads() // ⚠️ Já inclui detecção de navegadores com proteções
) {
  import('./utils/cacheCleaner').then(({ detectAndCleanReloadLoop, checkAndCleanCorruptedData }) => {
    // Verificar e limpar dados corrompidos preventivamente
    checkAndCleanCorruptedData();

    // Detectar se há loop de reload
    const hasLoop = detectAndCleanReloadLoop();

    if (hasLoop) {
      // Aguardar um pouco antes de continuar para evitar reload imediato
      setTimeout(() => {
        // Continuar com verificação de atualizações normalmente
        import('./utils/versionManager').then(({ checkForUpdates }) => {
          const updateInfo = checkForUpdates();
          if (updateInfo.hasUpdate) {
            window.dispatchEvent(new CustomEvent('app-update-available', {
              detail: updateInfo
            }));
          }
        });
      }, 2000);
    } else {
      // Sem loop, verificar atualizações normalmente
      import('./utils/versionManager').then(({ checkForUpdates }) => {
        const updateInfo = checkForUpdates();
        if (updateInfo.hasUpdate) {
          window.dispatchEvent(new CustomEvent('app-update-available', {
            detail: updateInfo
          }));
        }
      });
    }
  });
}

// Verificar se o root existe antes de renderizar
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Elemento root não encontrado!');
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui;">
      <div>
        <h1 style="font-size: 24px; margin-bottom: 16px;">Erro crítico</h1>
        <p style="margin-bottom: 24px; color: #666;">Elemento root não encontrado. Recarregue a página.</p>
        <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Recarregar Página
        </button>
      </div>
    </div>
  `;
} else {
  // Timeout de segurança: se não renderizar em 8 segundos, forçar reload automático
  const disableAggressiveReloads = shouldDisableAggressiveReloads();
  const renderTimeoutMs = disableAggressiveReloads ? 25000 : 8000;
  const renderTimeout = setTimeout(() => {
    if (!rootElement.hasChildNodes()) {
      console.error(`❌ Timeout na renderização após ${renderTimeoutMs}ms!`);

      // Em mobile/in-app, NÃO forçar reload automático (evita piscaceira).
      if (disableAggressiveReloads) {
        const root = document.getElementById('root');
        if (root) {
          root.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui;">
              <div>
                <h1 style="font-size: 22px; margin-bottom: 12px;">Carregando...</h1>
                <p style="margin-bottom: 18px; color: #666;">Seu navegador pode estar limitando o carregamento (Instagram/WhatsApp).</p>
                <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
                  Recarregar
                </button>
                <p style="margin-top: 16px; color: #888; font-size: 12px;">
                  Dica: clique em “Abrir no Chrome” no menu do Instagram/WhatsApp.
                </p>
              </div>
            </div>
          `;
        }
        return;
      }

      // Desktop: limpar cache e recarregar (comportamento atual)
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(name => caches.delete(name));
        });
      }

      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }, renderTimeoutMs);

  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <SupabaseProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SupabaseProvider>
        </ErrorBoundary>
      </StrictMode>
    );

    // Limpar timeout se renderizou com sucesso
    clearTimeout(renderTimeout);
  } catch (error) {
    console.error('❌ Erro ao renderizar aplicação:', error);
    clearTimeout(renderTimeout);
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; font-family: system-ui;">
        <div>
          <h1 style="font-size: 24px; margin-bottom: 16px;">Erro ao iniciar aplicação</h1>
          <p style="margin-bottom: 24px; color: #666;">Ocorreu um erro ao iniciar a aplicação. Tente recarregar a página.</p>
          <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px;">
            Recarregar Página
          </button>
        </div>
      </div>
    `;
  }
}
