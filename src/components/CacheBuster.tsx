import { useEffect } from 'react';

export const CacheBuster = () => {
  useEffect(() => {
    // DESABILITADO EM DESENVOLVIMENTO
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('🚫 CacheBuster desabilitado em desenvolvimento');
      return () => {};
    }

    try {
      // Verificar atualizações a cada 30 minutos (muito menos agressivo)
      const interval = setInterval(async () => {
        try {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            
            // Apenas verificar se há atualizações, sem forçar reload
            await registration.update();
            
            // Se há atualização disponível, mostrar notificação sutil
            if (registration.waiting) {
              console.log('🔄 Atualização disponível - usuário pode clicar no botão para atualizar');
              
              // Notificação sutil (opcional)
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Agendei Fácil', {
                  body: 'Nova versão disponível! Clique no botão de atualização.',
                  icon: '/novo-icone.png',
                  requireInteraction: false,
                  silent: true
                });
              }
            }
          }
        } catch (error) {
          console.log('Erro ao verificar atualizações:', error);
        }
      }, 1800000); // 30 minutos

      return () => clearInterval(interval);
    } catch (error) {
      console.log('Erro no CacheBuster:', error);
      return () => {};
    }
  }, []);

  return null;
};
