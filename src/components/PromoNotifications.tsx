import React, { useEffect } from 'react';
import { toast } from 'react-hot-toast';

const notifications = [
  "AGORA : uma barbearia acabou de se tornar plano mensal",
  "AGORA : uma lavação-car acabou de se tornar plano mensal",
  "AGORA : um salão acabou de se tornar plano Anual",
  "AGORA : uma barbearia acabou de se tornar plano Anual"
];

export const PromoNotifications = () => {
  // Função para mostrar a notificação
  const showNotification = (message: string) => {
    return new Promise<void>((resolve) => {
      // Remove todas as notificações existentes
      toast.dismiss();
      
      // Mostra a nova notificação
      const toastId = toast(message, {
        duration: 5000,
        style: {
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '12px 20px',
          fontSize: '14px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      });

      // Resolve a promise após 5 segundos
      setTimeout(() => {
        toast.dismiss(toastId);
        resolve();
      }, 5000);
    });
  };

  // Efeito para mostrar as notificações
  useEffect(() => {
    let currentIndex = 0;
    let timeoutId: NodeJS.Timeout;
    
    // Função para mostrar a próxima notificação
    const showNextNotification = async () => {
      // Mostra a notificação atual e espera ela terminar (5 segundos)
      await showNotification(notifications[currentIndex]);
      
      // Atualiza o índice para a próxima notificação
      currentIndex = (currentIndex + 1) % notifications.length;
      
      // Agenda a próxima notificação após 45 segundos
      timeoutId = setTimeout(showNextNotification, 45000);
    };

    // Inicia o ciclo após 2 segundos
    const initialTimeout = setTimeout(() => {
      showNextNotification();
    }, 2000);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
      toast.dismiss();
    };
  }, []);

  return null; // Este componente não renderiza nada visualmente
}; 