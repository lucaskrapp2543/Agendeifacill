// Utilitário para gerenciar Service Worker

export const registerServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('✅ Service Worker registrado:', registration);
      
      // Escutar atualizações
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível
              console.log('🔄 Nova versão do Service Worker disponível');
              
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
        if (event.data && event.data.type === 'CACHE_UPDATED') {
          console.log('📦 Cache atualizado pelo Service Worker');
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao registrar Service Worker:', error);
    }
  }
};

export const unregisterServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
      console.log('🗑️ Service Workers removidos');
    } catch (error) {
      console.error('❌ Erro ao remover Service Workers:', error);
    }
  }
};

export const clearAllCaches = async (): Promise<void> => {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      console.log('🗑️ Todos os caches limpos');
    } catch (error) {
      console.error('❌ Erro ao limpar caches:', error);
    }
  }
};

export const forceUpdate = async (): Promise<void> => {
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
};
