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

    // Verificar se é PWA
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsPWA(true);
      console.log('📱 PWA detectado');
    }
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
      return result === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      return false;
    }
  };

  // Enviar notificação
  const sendNotification = async (options: NotificationOptions) => {
    console.log('🔔 SEND NOTIFICATION:', { options, isSupported, permission, isPWA });
    
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
        const notification = new Notification(options.title, {
          body: options.body,
          icon: '/novo-icone.png',
          badge: '/novo-icone.png',
          requireInteraction: true, // Manter notificação até clicar
          data: {
            type: options.type || 'new_appointment',
            appointmentId: options.appointmentId
          }
        });

        // Tocar som
        playNotificationSound(options.type || 'new_appointment');
        
        // Listener para clique na notificação
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

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
      // Som embutido que sempre funciona
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYbXq66hVFApGn+DyvmwfCEqhz+2VQgELTZ/Y7aZeFAsXZLPp56UtBjGM1e/GeScGKnDC7+OPOgUTYrLo66hTEgpJm9+zt3MjCSN6yu3CfC0HKHbH8N2QQwQTYrHo7K1cFApModr+wWUfBS2Cyuy0bSYI');
      audio.volume = 0.7;
      audio.play().catch(() => console.log('Som não pôde ser reproduzido'));
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
