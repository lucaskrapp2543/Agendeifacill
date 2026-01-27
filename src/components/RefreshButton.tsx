import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { clearAllCaches, unregisterServiceWorker } from '../utils/serviceWorker';

export const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Oculta o botão de recarregar especificamente na página /planos
  if (window.location.pathname === '/planos') return null;

  const hardRefresh = async () => {
    try {
      // Melhor esforço: limpar caches e remover SW antigos
      await clearAllCaches();
      await unregisterServiceWorker();

      // Cache-bust: adiciona parâmetro para forçar baixar assets atualizados
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', String(Date.now()));
      window.location.replace(url.toString());
    } catch (e) {
      console.warn('⚠️ Falha ao forçar hard refresh, usando reload simples:', e);
      window.location.reload();
    }
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    // Recarregar a página após um pequeno delay para feedback visual
    setTimeout(() => {
      void hardRefresh();
    }, 300);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="fixed bottom-32 right-4 sm:bottom-20 sm:right-6 z-[9998] bg-black hover:bg-gray-800 text-white p-4 rounded-full shadow-lg transition-all transform hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Atualizar página"
      aria-label="Atualizar página"
    >
      <RefreshCw 
        className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} 
      />
    </button>
  );
};

export default RefreshButton;

