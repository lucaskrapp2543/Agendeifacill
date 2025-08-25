import { useEffect } from 'react';

export const CacheBuster = () => {
  useEffect(() => {
    try {
      // Versão simples baseada no timestamp
      const currentVersion = Date.now().toString();
      const storedVersion = localStorage.getItem('app-version');
      
      // Só força reload se for a primeira vez ou se detectar mudança significativa
      if (!storedVersion) {
        localStorage.setItem('app-version', currentVersion);
      }

      // Verificar atualizações a cada 60 segundos (menos agressivo)
      const interval = setInterval(() => {
        try {
          // Verificar se há service worker e atualizar
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
              registrations.forEach((registration) => {
                registration.update();
              });
            }).catch((error) => {
              // Silenciar erro para não poluir console
            });
          }
        } catch (error) {
          // Silenciar erro para não poluir console
        }
      }, 60000);

      return () => clearInterval(interval);
    } catch (error) {
      // Silenciar erro para não poluir console
      return () => {};
    }
  }, []);

  return null;
};
