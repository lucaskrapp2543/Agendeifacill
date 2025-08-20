import { useEffect, useState } from 'react';

interface NotificationOptions {
  title: string;
  body: string;
  type?: 'new_appointment' | 'cancelled_appointment';
  appointmentId?: string;
}

export const useNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Verificar se o navegador suporta notificações
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }

    // Verificar se é PWA - Múltiplas formas de detecção
    const checkIfPWA = () => {
      // Método 1: display-mode standalone
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // Método 2: navigator.standalone (iOS)
      const isIOSStandalone = (window.navigator as any).standalone === true;
      
      // Método 3: Verificar se está em um contexto de app
      const isInApp = window.location.href.includes('agendeifacil.com') && 
                     !window.location.href.includes('localhost') &&
                     (window.navigator.userAgent.includes('Mobile') || 
                      window.navigator.userAgent.includes('Android') ||
                      window.navigator.userAgent.includes('iPhone'));
      
      // Método 4: Verificar se tem service worker ativo
      const hasServiceWorker = 'serviceWorker' in navigator;
      
      const pwaDetected = isStandalone || isIOSStandalone || (isInApp && hasServiceWorker);
      
      console.log('🔍 DETECÇÃO PWA:', {
        isStandalone,
        isIOSStandalone,
        isInApp,
        hasServiceWorker,
        userAgent: window.navigator.userAgent,
        url: window.location.href,
        pwaDetected
      });
      
      setIsPWA(pwaDetected);
      
      if (pwaDetected) {
        console.log('📱 PWA detectado!');
      } else {
        console.log('🌐 Navegador normal detectado');
      }
    };

    // Verificar imediatamente
    checkIfPWA();
    
    // Verificar novamente após um delay (para garantir que tudo carregou)
    setTimeout(checkIfPWA, 1000);
  }, []);

  // Solicitar permissão para notificações
  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('Notificações não são suportadas neste navegador');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      console.log('🔔 Permissão de notificação:', result);
      return result === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      return false;
    }
  };

  // Enviar notificação
  const sendNotification = async (options: NotificationOptions) => {
    console.log('🔔 SEND NOTIFICATION:', { 
      options, 
      isSupported, 
      permission, 
      isPWA,
      userAgent: window.navigator.userAgent,
      url: window.location.href
    });
    
    if (!isSupported) {
      console.log('❌ Notificações não são suportadas');
      return;
    }

    if (permission !== 'granted') {
      console.log('⚠️ Permissão não concedida, solicitando...');
      const granted = await requestPermission();
      if (!granted) {
        console.log('❌ Permissão de notificação negada');
        return;
      }
    }

    try {
      // Para PWA, usar notificação nativa
      if (isPWA) {
        console.log('📱 Enviando notificação PWA nativa');
        
        // Tocar som ANTES da notificação
        playNotificationSound(options.type || 'new_appointment');
        
        const notification = new Notification(options.title, {
          body: options.body,
          icon: '/novo-icone.png',
          badge: '/novo-icone.png',
          requireInteraction: false, // Não manter até clicar
          silent: false, // Permitir som do sistema
          tag: 'agendei-facil-notification', // Tag para agrupar
          data: {
            type: options.type || 'new_appointment',
            appointmentId: options.appointmentId,
            timestamp: Date.now()
          }
        });

        // Listener para clique na notificação
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto-close após 5 segundos
        setTimeout(() => {
          notification.close();
        }, 5000);

        return;
      }

      // Verificar se o service worker está registrado
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        
        // Enviar mensagem para o service worker
        registration.active?.postMessage({
          type: 'SEND_NOTIFICATION',
          data: {
            title: options.title,
            body: options.body,
            type: options.type || 'new_appointment',
            appointmentId: options.appointmentId
          }
        });
      } else {
        // Fallback para notificação nativa
        new Notification(options.title, {
          body: options.body,
          icon: '/novo-icone.png',
          badge: '/novo-icone.png',
          data: {
            type: options.type || 'new_appointment',
            appointmentId: options.appointmentId
          }
        });
      }
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  };

  // Função para tocar som
  const playNotificationSound = (type: string) => {
    try {
      // Som embutido que sempre funciona - VOLUME MÁXIMO
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYbXq66hVFApGn+DyvmwfCEqhz+2VQgELTZ/Y7aZeFAsXZLPp56UtBjGM1e/GeScGKnDC7+OPOgUTYrLo66hTEgpJm9+zt3MjCSN6yu3CfC0HKHbH8N2QQwQTYrHo7K1cFApModr+wWUfBS2Cyuy0bSYI');
      audio.volume = 1.0; // VOLUME MÁXIMO
      audio.play().catch(() => console.log('Som não pôde ser reproduzido'));
      
      // Tocar som adicional para garantir
      setTimeout(() => {
        const audio2 = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYbXq66hVFApGn+DyvmwfCEqhz+2VQgELTZ/Y7aZeFAsXZLPp56UtBjGM1e/GeScGKnDC7+OPOgUTYrLo66hTEgpJm9+zt3MjCSN6yu3CfC0HKHbH8N2QQwQTYrHo7K1cFApModr+wWUfBS2Cyuy0bSYI');
        audio2.volume = 1.0;
        audio2.play().catch(() => {});
      }, 200);
      
    } catch (error) {
      console.log('Erro ao tocar som:', error);
    }
  };

  // Notificação de novo agendamento
  const notifyNewAppointment = (clientName: string, service: string, time: string) => {
    console.log('🔔 NOTIFY NEW APPOINTMENT:', { clientName, service, time, isPWA });
    
    // Tocar som imediatamente
    playNotificationSound('new_appointment');
    
    sendNotification({
      title: 'Agendei Fácil',
      body: `Novo agendamento: ${clientName} - ${service} às ${time}`,
      type: 'new_appointment'
    });
  };

  // Notificação de agendamento cancelado
  const notifyCancelledAppointment = (clientName: string, service: string, time: string) => {
    console.log('🔔 NOTIFY CANCELLED APPOINTMENT:', { clientName, service, time, isPWA });
    
    // Tocar som imediatamente
    playNotificationSound('cancelled_appointment');
    
    sendNotification({
      title: 'Agendei Fácil',
      body: `Agendamento cancelado: ${clientName} - ${service} às ${time}`,
      type: 'cancelled_appointment'
    });
  };

  // Notificação personalizada
  const notifyCustom = (title: string, body: string) => {
    sendNotification({
      title,
      body
    });
  };

  return {
    isSupported,
    permission,
    isPWA,
    requestPermission,
    sendNotification,
    notifyNewAppointment,
    notifyCancelledAppointment,
    notifyCustom
  };
};
