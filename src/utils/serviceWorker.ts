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
      console.log('🗑️ Service Workers removidos');
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
      console.log('🗑️ Todos os caches limpos');
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
  // (isso evita exatamente o problema de UI “antiga”/cacheada aparecer do nada)
  if (!isProduction()) {
    console.log('🧹 Dev: garantindo limpeza de Service Worker/caches em localhost');
    await unregisterServiceWorker();
    await clearAllCaches();
    console.log('🚫 Service Worker desabilitado em desenvolvimento');
    return;
  }

  // ⚠️ NÃO registrar em mobile (causa página branca)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    console.log('📱 Service Worker desabilitado em mobile (evita página branca)');
    
    // Remover Service Workers existentes
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('🗑️ Service Workers removidos em mobile');
    }
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('✅ Service Worker registrado:', registration);
      
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
