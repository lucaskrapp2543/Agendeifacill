import { useEffect, useState } from 'react';
import { checkForUpdates, forceReload } from '../utils/cacheBuster';

interface CacheBusterProps {
  children: React.ReactNode;
  autoReload?: boolean;
  checkInterval?: number;
}

export const CacheBuster: React.FC<CacheBusterProps> = ({ 
  children, 
  autoReload = true, 
  checkInterval = 5000 
}) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    // Configura verificação automática
    checkForUpdates();

    // Adiciona meta tags anti-cache
    const addMetaTags = () => {
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

    addMetaTags();

    // Verifica atualizações periodicamente
    if (autoReload) {
      const interval = setInterval(() => {
        setLastUpdate(Date.now());
        
        // Força reload se detectar mudanças
        if (import.meta.hot) {
          import.meta.hot.on('vite:beforeUpdate', () => {
            console.log('🔄 Atualização detectada, recarregando...');
            setTimeout(forceReload, 100);
          });
        }
      }, checkInterval);

      return () => clearInterval(interval);
    }
  }, [autoReload, checkInterval]);

  // Adiciona timestamp na URL para forçar cache busting
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('v')) {
      url.searchParams.set('v', lastUpdate.toString());
      window.history.replaceState({}, '', url.toString());
    }
  }, [lastUpdate]);

  return <>{children}</>;
};

// Hook para forçar atualização manual
export const useForceUpdate = () => {
  const [, forceUpdate] = useState({});
  
  const triggerUpdate = () => {
    forceUpdate({});
    forceReload();
  };

  return triggerUpdate;
};

// Componente para botão de atualização manual
export const ForceUpdateButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const triggerUpdate = useForceUpdate();

  return (
    <button
      onClick={triggerUpdate}
      className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${className}`}
      title="Forçar atualização (Ctrl+F5)"
    >
      🔄 Atualizar
    </button>
  );
};
