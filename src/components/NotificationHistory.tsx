import React, { useState, useEffect } from 'react';
import { Bell, Trash2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'new_appointment' | 'cancelled_appointment' | 'custom';
  timestamp: number;
  read: boolean;
  readAt?: number; // Timestamp quando foi marcada como lida
}

export const NotificationHistory: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Carregar notificações do localStorage
  useEffect(() => {
    // LIMPEZA RADICAL: Limpar localStorage completamente ao carregar
    console.log('🧹 LIMPEZA RADICAL: Removendo todas as notificações antigas do cache');
    localStorage.removeItem('agendei-facil-notifications');
    
    // Iniciar com lista vazia
    setNotifications([]);
    console.log('✅ Sistema de notificações resetado completamente');
  }, []);

  // Listener para receber notificações do hook
  useEffect(() => {
    const handleAddNotification = (event: CustomEvent) => {
      const notificationData = event.detail;
      console.log('📝 Recebida notificação do hook:', notificationData);
      addNotification(notificationData);
    };

    window.addEventListener('addNotificationToHistory', handleAddNotification as EventListener);

    return () => {
      window.removeEventListener('addNotificationToHistory', handleAddNotification as EventListener);
    };
  }, []);

  // Salvar notificações no localStorage
  const saveNotifications = (newNotifications: NotificationItem[]) => {
    setNotifications(newNotifications);
    // NÃO salvar no localStorage - manter apenas em memória
    console.log('📝 Notificações salvas apenas em memória:', newNotifications.length);
  };

  // Adicionar nova notificação
  const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    // Verificar se já existe uma notificação similar (mesmo título e corpo) nos últimos 5 minutos
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentSimilar = notifications.find(n => 
      n.title === notification.title && 
      n.body === notification.body && 
      n.timestamp > fiveMinutesAgo
    );
    
    if (recentSimilar) {
      console.log('⚠️ Notificação similar recente encontrada, ignorando:', notification);
      return;
    }
    
    const newNotification: NotificationItem = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      read: false,
      readAt: undefined // Não foi lida ainda
    };

    // Limitar a 10 notificações não lidas
    const updatedNotifications = [newNotification, ...notifications].slice(0, 10);
    saveNotifications(updatedNotifications);
    
    console.log('✅ Nova notificação adicionada:', newNotification);
  };

  // Marcar como lida - REMOVER COMPLETAMENTE
  const markAsRead = (id: string) => {
    // REMOVER a notificação completamente ao invés de marcar como lida
    const updatedNotifications = notifications.filter(notification => notification.id !== id);
    saveNotifications(updatedNotifications);
    console.log('🗑️ Notificação removida ao ser lida:', id);
  };

  // Limpar notificações antigas (mais de 2 dias)
  const clearOldNotifications = () => {
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    const filteredNotifications = notifications.filter(
      notification => notification.timestamp > twoDaysAgo
    );
    saveNotifications(filteredNotifications);
    console.log('🧹 Notificações antigas removidas');
  };

  // Limpeza automática RADICAL - a cada 5 minutos
  useEffect(() => {
    const autoCleanup = () => {
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      
      // REMOVER todas as notificações lidas e antigas
      const filteredNotifications = notifications.filter(notification => {
        // Manter só se NÃO foi lida E é dos últimos 2 dias
        if (notification.read) {
          return false;
        }
        
        if (notification.timestamp < twoDaysAgo) {
          return false;
        }
        
        return true;
      });
      
      if (filteredNotifications.length !== notifications.length) {
        console.log('🧹 Limpeza automática RADICAL executada');
        saveNotifications(filteredNotifications);
      }
    };

    // Executar limpeza a cada 5 minutos
    const interval = setInterval(autoCleanup, 5 * 60 * 1000);
    
    // Executar limpeza inicial
    autoCleanup();

    return () => clearInterval(interval);
  }, [notifications]);

  // Limpar todas as notificações
  const clearAllNotifications = () => {
    saveNotifications([]);
    console.log('🗑️ Todas as notificações removidas');
  };

  // Limpar notificações antigas e inválidas (função de emergência)
  const emergencyCleanup = () => {
    try {
      // Limpar localStorage completamente
      localStorage.removeItem('agendei-facil-notifications');
      setNotifications([]);
      console.log('🚨 Limpeza de emergência executada - localStorage e memória limpos');
    } catch (error) {
      console.error('Erro na limpeza de emergência:', error);
    }
  };

  // Limpar notificações lidas (não existe mais, só não lidas)
  const clearReadNotifications = () => {
    // Não faz nada, pois não existem mais notificações lidas
    console.log('🧹 Não há notificações lidas para remover');
  };

  // Limpar notificações antigas (mais de 2 dias)
  const clearOldReadNotifications = () => {
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    const filteredNotifications = notifications.filter(notification => 
      notification.timestamp > twoDaysAgo
    );
    
    saveNotifications(filteredNotifications);
    console.log('🧹 Notificações antigas removidas');
  };

  // Formatar data
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Agora mesmo';
    } else if (diffInHours < 24) {
      return `${diffInHours}h atrás`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} dia${diffInDays > 1 ? 's' : ''} atrás`;
    }
  };

  // Obter ícone baseado no tipo
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_appointment':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'cancelled_appointment':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    }
  };

  // Obter cor baseada no tipo
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'new_appointment':
        return 'border-l-green-500 bg-green-50';
      case 'cancelled_appointment':
        return 'border-l-red-500 bg-red-50';
      default:
        return 'border-l-yellow-500 bg-yellow-50';
    }
  };

  const unreadCount = notifications.length; // Todas são não lidas agora

  return (
    <div className="relative">
      {/* Botão de notificações */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Histórico de notificações */}
      {showHistory && (
        <div className="absolute right-0 top-12 w-96 max-h-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">
              Notificações ({notifications.length})
            </h3>
                         <div className="flex gap-2">
               <button
                 onClick={clearReadNotifications}
                 className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200"
               >
                 Limpar lidas
               </button>
               <button
                 onClick={clearOldReadNotifications}
                 className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200"
                 title="Remove notificações lidas há mais de 24 horas"
               >
                 Limpar lidas antigas
               </button>
               <button
                 onClick={clearOldNotifications}
                 className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-200"
               >
                 Limpar antigas
               </button>
               <button
                 onClick={clearAllNotifications}
                 className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
               >
                 Limpar todas
               </button>
               <button
                 onClick={emergencyCleanup}
                 className="text-xs text-red-800 hover:text-red-900 px-2 py-1 rounded hover:bg-red-100 border border-red-300"
                 title="Limpeza de emergência - remove todas as notificações e corrige bugs"
               >
                 🚨 Emergência
               </button>
             </div>
          </div>

          {/* Lista de notificações */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma notificação</p>
                <p className="text-sm">As notificações aparecerão aqui</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                                     <div
                     key={notification.id}
                     onClick={() => markAsRead(notification.id)}
                     className={`p-4 border-l-4 cursor-pointer transition-colors hover:bg-gray-50 ${getNotificationColor(notification.type)}`}
                   >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                                                 <div className="flex items-center justify-between">
                           <p className="text-sm font-medium text-gray-900">
                             {notification.title}
                           </p>
                           <div className="flex items-center gap-2">
                             <Clock className="w-3 h-3 text-gray-400" />
                             <span className="text-xs text-gray-500">
                               {formatDate(notification.timestamp)}
                             </span>
                           </div>
                         </div>
                         <p className="text-sm mt-1 text-gray-700">
                           {notification.body}
                         </p>
                         <div className="mt-2">
                           <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay para fechar */}
      {showHistory && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};

// Exportar função para adicionar notificações
export const addNotificationToHistory = (notification: {
  title: string;
  body: string;
  type: 'new_appointment' | 'cancelled_appointment' | 'custom';
}) => {
  // Esta função será chamada pelo hook de notificações
  const event = new CustomEvent('addNotificationToHistory', {
    detail: notification
  });
  window.dispatchEvent(event);
};
