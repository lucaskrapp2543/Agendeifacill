// Utilitário para forçar atualização de cache
export const forceCacheRefresh = () => {
  // Adiciona timestamp na URL para forçar reload
  const currentUrl = new URL(window.location.href);
  const timestamp = Date.now();
  
  // Adiciona parâmetro de versão se não existir
  if (!currentUrl.searchParams.has('v')) {
    currentUrl.searchParams.set('v', timestamp.toString());
    window.history.replaceState({}, '', currentUrl.toString());
  }
};

// Função para verificar se precisa atualizar
export const checkForUpdates = () => {
  // Verifica se há uma nova versão disponível
  const currentVersion = localStorage.getItem('app_version') || '0';
  const newVersion = Date.now().toString();
  
  if (currentVersion !== newVersion) {
    localStorage.setItem('app_version', newVersion);
    forceCacheRefresh();
  }
};

// Função para adicionar headers anti-cache
export const addAntiCacheHeaders = () => {
  // Adiciona meta tags para evitar cache
  const metaTags = [
    '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">',
    '<meta http-equiv="Pragma" content="no-cache">',
    '<meta http-equiv="Expires" content="0">'
  ];
  
  metaTags.forEach(tag => {
    if (!document.querySelector(`meta[http-equiv="${tag.match(/http-equiv="([^"]+)"/)?.[1]}"]`)) {
      document.head.insertAdjacentHTML('beforeend', tag);
    }
  });
};
