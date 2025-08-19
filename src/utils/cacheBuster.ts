// Cache buster utility
export const getCacheBuster = (): string => {
  return `?v=${Date.now()}`;
};

// Função para adicionar cache buster a URLs
export const addCacheBuster = (url: string): string => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
};

// Função para forçar reload da página
export const forceReload = (): void => {
  window.location.reload();
};

// Função para limpar cache do navegador programaticamente
export const clearBrowserCache = async (): Promise<void> => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
  }
};

// Função para verificar se há atualizações
export const checkForUpdates = (): void => {
  // Adiciona um listener para detectar quando o servidor tem atualizações
  if (import.meta.hot) {
    import.meta.hot.on('vite:beforeUpdate', () => {
      console.log('🔄 Atualização detectada, recarregando...');
      setTimeout(() => {
        window.location.reload();
      }, 100);
    });
  }
};
