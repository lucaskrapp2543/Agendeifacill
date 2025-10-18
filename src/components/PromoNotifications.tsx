import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

const notifications = [
  "AGORA : uma barbearia acabou de se tornar plano mensal",
  "AGORA : uma lavação-car acabou de se tornar plano mensal",
  "AGORA : um salão acabou de se tornar plano Anual",
  "AGORA : uma barbearia acabou de se tornar plano Anual"
];

export const PromoNotifications = () => {
  const location = useLocation();

  // ✅ DEBUG: Log para verificar onde está sendo chamado
  console.log('🔔 PromoNotifications renderizado em:', location.pathname);

  // Só mostrar notificações na página inicial
  if (location.pathname !== '/') {
    console.log('🔔 PromoNotifications: Não é página inicial, retornando null');
    return null;
  }

  console.log('🔔 PromoNotifications: É página inicial, continuando...');

  // ✅ TESTE SIMPLES: Mostrar toast imediatamente
  console.log('🔔 TESTE: Tentando mostrar toast...');
  toast('TESTE: Toast funcionando!', {
    duration: 3000,
    position: 'top-center',
    style: {
      background: 'rgba(0, 0, 0, 0.8)',
      color: '#fff',
      fontSize: '14px',
    }
  });

  // Função para mostrar a notificação
  const showNotification = (message: string) => {
    return new Promise<void>((resolve) => {
      // Remove todas as notificações existentes
      toast.dismiss();

      // Mostra a nova notificação
      const toastId = toast(
        (t) => (
          <div className="flex items-center justify-between">
            <span>{message}</span>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                resolve();
              }}
              className="ml-3 text-white hover:text-gray-300 transition-colors text-lg font-bold"
              style={{ fontSize: '16px', lineHeight: '1' }}
            >
              ×
            </button>
          </div>
        ),
        {
          duration: 5000,
          position: 'top-center', // Posiciona no centro superior, não no canto
          style: {
            background: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '12px 20px',
            fontSize: '14px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            marginTop: '80px', // Adiciona margem para não ficar em cima do header
            zIndex: 9999,
          },
        }
      );

      // Resolve a promise após 5 segundos
      setTimeout(() => {
        toast.dismiss(toastId);
        resolve();
      }, 5000);
    });
  };

  // Efeito para mostrar as notificações
  useEffect(() => {
    // Só executar se estiver na página inicial
    if (location.pathname !== '/') {
      return;
    }

    let currentIndex = 0;
    let timeoutId: NodeJS.Timeout;

    // Função para mostrar a próxima notificação
    const showNextNotification = async () => {
      // Verificar novamente se ainda está na página inicial
      if (location.pathname !== '/') {
        return;
      }

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
  }, [location.pathname]);

  return null; // Este componente não renderiza nada visualmente
}; 