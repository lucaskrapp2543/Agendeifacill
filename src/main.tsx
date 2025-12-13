import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { checkForUpdates } from './utils/cacheBuster';

// Configura verificação automática de atualizações
checkForUpdates();

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

  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;
    
    // Verificar se é um erro de script ou link
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || '';
      
      // Verificar se é um chunk JavaScript que falhou
      if ((src.includes('chunk-') || (src.includes('.js') && src.includes('assets/'))) && 
          (event.message?.includes('404') || event.message?.includes('Failed to load'))) {
        console.error('❌ Erro 404 detectado em chunk:', src);
        console.log('🔄 Tentando recuperar...');
        
        // Evitar loops infinitos
        if (reloadAttempts < maxReloadAttempts) {
          reloadAttempts++;
          
          // Limpar cache e recarregar
          setTimeout(async () => {
            try {
              // Limpar service workers
              if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                  await registration.unregister();
                }
              }
              
              // Limpar caches
              if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
              }
              
              console.log('✅ Cache limpo, recarregando...');
              window.location.reload();
            } catch (error) {
              console.error('❌ Erro ao limpar cache:', error);
              window.location.reload();
            }
          }, 1000);
        } else {
          console.error('❌ Muitas tentativas de reload, parando...');
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
      console.log('🔄 Erro de chunk detectado, tentando recuperar...');
      if (reloadAttempts < maxReloadAttempts) {
        reloadAttempts++;
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  });
};

// Inicializar detecção de erros
handleChunkErrors();

// Verificar atualização IMEDIATAMENTE ao carregar (apenas em produção)
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // Importar e verificar atualizações
  import('./utils/versionManager').then(({ checkForUpdates }) => {
    const updateInfo = checkForUpdates();
    if (updateInfo.hasUpdate) {
      console.log('🔄 Atualização detectada na inicialização:', updateInfo);
      // Disparar evento imediatamente (UpdateNotification vai mostrar)
      window.dispatchEvent(new CustomEvent('app-update-available', {
        detail: updateInfo
      }));
      
      // NÃO forçar atualização automática aqui - deixa o usuário clicar
      // Isso evita loops e problemas de recarregamento
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
  const renderTimeout = setTimeout(() => {
    if (!rootElement.hasChildNodes()) {
      console.error('❌ Timeout na renderização após 8 segundos! Forçando reload...');
      
      // Limpar cache e recarregar
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(name => caches.delete(name));
        });
      }
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(reg => reg.unregister());
        });
      }
      
        // Recarregar (Service Worker já busca da rede sempre)
        setTimeout(() => {
          window.location.reload(true);
        }, 500);
    }
  }, 8000); // Reduzido de 15s para 8s

  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <App />
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
