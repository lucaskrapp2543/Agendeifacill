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

  // Enviar notificação via service worker
  const sendNotificationViaServiceWorker = async (options: NotificationOptions) => {
    try {
      if (!pushSupported) {
        console.log('❌ Service Worker não suportado');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      console.log('📱 Enviando notificação via Service Worker:', options);
      
      // Enviar mensagem para o service worker
      registration.active?.postMessage({
        type: 'SHOW_NOTIFICATION',
        data: {
          title: options.title,
          body: options.body,
          type: options.type || 'new_appointment',
          appointmentId: options.appointmentId,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      console.error('Erro ao enviar notificação via Service Worker:', error);
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
      // Sempre usar Service Worker para notificações
      if (pushSupported) {
        console.log('📱 Enviando notificação via Service Worker');
        await sendNotificationViaServiceWorker(options);
        return;
      }

      // Fallback para notificação nativa
      console.log('🌐 Enviando notificação nativa (fallback)');
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

  // Função para salvar notificação no histórico
  const saveNotificationToHistory = (notificationData: {
    title: string;
    body: string;
    type: 'new_appointment' | 'cancelled_appointment' | 'custom';
  }) => {
    try {
      const savedNotifications = localStorage.getItem('agendei-facil-notifications');
      const notifications = savedNotifications ? JSON.parse(savedNotifications) : [];
      
      // Verificar se já existe uma notificação similar nos últimos 5 minutos
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const recentSimilar = notifications.find((n: any) => 
        n.title === notificationData.title && 
        n.body === notificationData.body && 
        n.timestamp > fiveMinutesAgo
      );
      
      if (recentSimilar) {
        console.log('⚠️ Notificação similar recente encontrada, ignorando:', notificationData);
        return;
      }
      
      const newNotification = {
        id: `notification-${Date.now()}-${Math.random()}`,
        ...notificationData,
        timestamp: Date.now(),
        read: false
      };
      
      // Adicionar no início e limitar a 50 notificações
      const updatedNotifications = [newNotification, ...notifications].slice(0, 50);
      localStorage.setItem('agendei-facil-notifications', JSON.stringify(updatedNotifications));
      
      console.log('📝 Notificação salva no histórico:', newNotification);
    } catch (error) {
      console.error('Erro ao salvar notificação no histórico:', error);
      // Limpar localStorage corrompido
      localStorage.removeItem('agendei-facil-notifications');
    }
  };

  // Notificação de novo agendamento
  const notifyNewAppointment = (clientName: string, service: string, time: string) => {
    console.log('🔔 NOTIFY NEW APPOINTMENT:', { clientName, service, time, isPWA });
    const notificationData = {
      title: 'Agendei Fácil',
      body: `Novo agendamento: ${clientName} - ${service} às ${time}`,
      type: 'new_appointment' as const
    };
    
    // Salvar no histórico
    saveNotificationToHistory(notificationData);
    
    sendNotification(notificationData);
  };

  // Notificação de agendamento cancelado
  const notifyCancelledAppointment = (clientName: string, service: string, time: string) => {
    console.log('🔔 NOTIFY CANCELLED APPOINTMENT:', { clientName, service, time, isPWA });
    const notificationData = {
      title: 'Agendei Fácil',
      body: `Agendamento cancelado: ${clientName} - ${service} às ${time}`,
      type: 'cancelled_appointment' as const
    };
    
    // Salvar no histórico
    saveNotificationToHistory(notificationData);
    
    sendNotification(notificationData);
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
    requestPermission,
    sendNotification,
    notifyNewAppointment,
    notifyCancelledAppointment,
    notifyCustom
  };
};
