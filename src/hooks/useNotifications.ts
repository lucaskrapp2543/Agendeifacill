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
  const [pushSupported, setPushSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    // Verificar se o navegador suporta notificações
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }

    // Verificar se suporta push notifications
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
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

    // Configurar push subscription
    setupPushSubscription();
  }, []);

  // Configurar push subscription
  const setupPushSubscription = async () => {
    if (!pushSupported) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Verificar se já tem subscription
      const existingSubscription = await registration.pushManager.getSubscription();
      
      if (existingSubscription) {
        console.log('📱 Push subscription já existe');
        setSubscription(existingSubscription);
        return;
      }

      // Criar nova subscription
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa1FJqF8VgRzqJzLzQ')
      });

      console.log('📱 Nova push subscription criada:', newSubscription);
      setSubscription(newSubscription);

      // Enviar subscription para o servidor (você precisará implementar isso)
      await sendSubscriptionToServer(newSubscription);

    } catch (error) {
      console.error('Erro ao configurar push subscription:', error);
    }
  };

  // Converter chave para Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Enviar subscription para o servidor
  const sendSubscriptionToServer = async (subscription: PushSubscription) => {
    try {
      // Aqui você enviaria a subscription para seu backend
      // Por enquanto, vamos apenas logar
      console.log('📱 Enviando subscription para o servidor:', subscription.toJSON());
      
      // Exemplo de como seria:
      // await fetch('/api/push-subscription', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(subscription.toJSON())
      // });
    } catch (error) {
      console.error('Erro ao enviar subscription:', error);
    }
  };

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
      
      if (result === 'granted') {
        // Configurar push subscription após permissão concedida
        await setupPushSubscription();
      }
      
      return result === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      return false;
    }
  };

  // Enviar notificação push real
  const sendPushNotification = async (options: NotificationOptions) => {
    try {
      if (!pushSupported) {
        console.log('❌ Push notifications não suportadas');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Enviar mensagem para o service worker para criar notificação push
      registration.active?.postMessage({
        type: 'PUSH_NOTIFICATION',
        data: {
          title: options.title,
          body: options.body,
          type: options.type || 'new_appointment',
          appointmentId: options.appointmentId,
          timestamp: Date.now()
        }
      });

      console.log('📱 Push notification enviada para o service worker');
    } catch (error) {
      console.error('Erro ao enviar push notification:', error);
    }
  };

  // Enviar notificação
  const sendNotification = async (options: NotificationOptions) => {
    console.log('🔔 SEND NOTIFICATION:', { 
      options, 
      isSupported, 
      permission, 
      isPWA,
      pushSupported,
      subscription: !!subscription,
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
      // Para PWA, usar push notifications reais
      if (isPWA && pushSupported) {
        console.log('📱 Enviando push notification real');
        await sendPushNotification(options);
        return;
      }

      // Fallback para notificação nativa
      console.log('🌐 Enviando notificação nativa');
      const notification = new Notification(options.title, {
        body: options.body,
        icon: '/novo-icone.png',
        badge: '/novo-icone.png',
        requireInteraction: false,
        silent: false, // Usar som nativo do sistema
        tag: 'agendei-facil-notification',
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

    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  };

  // Notificação de novo agendamento
  const notifyNewAppointment = (clientName: string, service: string, time: string) => {
    console.log('🔔 NOTIFY NEW APPOINTMENT:', { clientName, service, time, isPWA });
    
    sendNotification({
      title: 'Agendei Fácil',
      body: `Novo agendamento: ${clientName} - ${service} às ${time}`,
      type: 'new_appointment'
    });
  };

  // Notificação de agendamento cancelado
  const notifyCancelledAppointment = (clientName: string, service: string, time: string) => {
    console.log('🔔 NOTIFY CANCELLED APPOINTMENT:', { clientName, service, time, isPWA });
    
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
    pushSupported,
    subscription: !!subscription,
    requestPermission,
    sendNotification,
    notifyNewAppointment,
    notifyCancelledAppointment,
    notifyCustom
  };
};
