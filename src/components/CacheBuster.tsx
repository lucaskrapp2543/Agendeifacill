import { useEffect } from 'react';
import { scheduleUpdateCheck } from '../utils/versionManager';

export const CacheBuster = () => {
  useEffect(() => {
    // DESABILITADO EM DESENVOLVIMENTO
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🚫 CacheBuster desabilitado em desenvolvimento');
      return () => {};
    }

    try {
      // Agendar verificação de atualizações
      scheduleUpdateCheck();
      
      // Verificar atualizações a cada 15 minutos (mais frequente para detectar mudanças)
      const interval = setInterval(async () => {
        try {
          // Verificar atualizações de versão
          scheduleUpdateCheck();
          
          // Verificar service worker
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.update();
            
            // Se há atualização disponível, notificar
            if (registration.waiting) {
              console.log('🔄 Service Worker atualização disponível');
              
              // Disparar evento de atualização disponível
              window.dispatchEvent(new CustomEvent('sw-update-available', {
                detail: { type: 'service-worker' }
              }));
            }
          }
        } catch (error) {
          console.log('Erro ao verificar atualizações:', error);
        }
      }, 900000); // 15 minutos

      return () => clearInterval(interval);
    } catch (error) {
      console.log('Erro no CacheBuster:', error);
      return () => {};
    }
  }, []);

  return null;
};
