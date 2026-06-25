// Utilitário para gerenciar Service Worker

// Verificar se está em produção
const isProduction = (): boolean => {
  const hostname = window.location.hostname;
  return (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.includes('localhost') &&
    !hostname.includes('127.0.0.1')
  );
};

export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.error('❌ Erro ao remover Service Workers:', error);
    }
  }
}

export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    } catch (error) {
      console.error('❌ Erro ao limpar caches:', error);
    }
  }
}

export async function forceUpdate(): Promise<void> {
  try {
    // Limpar caches
    await clearAllCaches();

    // Remover service workers
    await unregisterServiceWorker();

    // Recarregar página
    window.location.reload();
  } catch (error) {
    console.error('❌ Erro ao forçar atualização:', error);
    // Fallback: apenas recarregar
    window.location.reload();
  }
}

export const registerServiceWorker = async (): Promise<void> => {
  // ✅ Em desenvolvimento: se existir SW antigo em localhost, REMOVER
  if (!isProduction()) {
    await unregisterServiceWorker();
    await clearAllCaches();
    return;
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  // Mobile usa SW mínimo (sem cache) para manter PWA instalável
  const swPath = isMobile ? '/sw-mobile.js' : '/sw.js';

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: '/'
      });
      
      // ⚠️ NÃO tentar atualizar imediatamente (evita loops)
      // O navegador verifica atualizações automaticamente a cada 24h
      // Só verificar atualizações periodicamente, não imediatamente
      
      // Escutar atualizações (mas não forçar)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível
              // Notificar o app sobre a atualização
              window.dispatchEvent(new CustomEvent('sw-update-available', {
                detail: { registration, newWorker }
              }));
            }
          });
        }
      });
      
      // Escutar mensagens do Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') return;
      });
      
      // Verificar atualizações periodicamente (a cada 30 minutos), não imediatamente
      setInterval(() => {
        registration.update().catch((error) => {
          // Ignorar erros silenciosamente (pode ser que não haja atualização)
          if (error.message && !error.message.includes('not found')) {
            console.warn('⚠️ Erro ao verificar atualização do Service Worker:', error);
          }
        });
      }, 30 * 60 * 1000); // 30 minutos
      
    } catch (error) {
      console.error('❌ Erro ao registrar Service Worker:', error);
    }
  }
};
