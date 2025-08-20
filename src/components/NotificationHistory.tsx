import React, { useState, useEffect } from 'react';
import { Bell, Trash2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: 'new_appointment' | 'cancelled_appointment' | 'custom';
  timestamp: number;
  read: boolean;
}

export const NotificationHistory: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Carregar notificações do localStorage
  useEffect(() => {
    const savedNotifications = localStorage.getItem('agendei-facil-notifications');
    if (savedNotifications) {
      try {
        const parsed = JSON.parse(savedNotifications);
        
        // Filtrar notificações antigas (mais de 7 dias) automaticamente
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const validNotifications = parsed.filter((notification: any) => {
          // Verificar se tem timestamp válido
          if (!notification.timestamp || typeof notification.timestamp !== 'number') {
            console.log('❌ Notificação inválida removida:', notification);
            return false;
          }
          
          // Verificar se não é muito antiga
          if (notification.timestamp < sevenDaysAgo) {
            console.log('❌ Notificação antiga removida:', notification);
            return false;
          }
          
          return true;
        });
        
        // Limitar a 50 notificações para evitar bugs
        const limitedNotifications = validNotifications.slice(0, 50);
        
        console.log('📝 Carregadas notificações válidas:', limitedNotifications.length);
        setNotifications(limitedNotifications);
        
        // Salvar versão limpa se houve mudanças
        if (limitedNotifications.length !== parsed.length) {
          localStorage.setItem('agendei-facil-notifications', JSON.stringify(limitedNotifications));
          console.log('🧹 Notificações limpas e salvas');
        }
        
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
        // Limpar localStorage corrompido
        localStorage.removeItem('agendei-facil-notifications');
        setNotifications([]);
      }
    }
  }, []);

  // Salvar notificações no localStorage
  const saveNotifications = (newNotifications: NotificationItem[]) => {
    setNotifications(newNotifications);
    localStorage.setItem('agendei-facil-notifications', JSON.stringify(newNotifications));
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
      read: false
    };

    // Limitar a 50 notificações para evitar bugs
    const updatedNotifications = [newNotification, ...notifications].slice(0, 50);
    saveNotifications(updatedNotifications);
    
    console.log('✅ Nova notificação adicionada:', newNotification);
  };

  // Marcar como lida
  const markAsRead = (id: string) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === id ? { ...notification, read: true } : notification
    );
    saveNotifications(updatedNotifications);
  };

  // Limpar notificações antigas (mais de 7 dias)
  const clearOldNotifications = () => {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const filteredNotifications = notifications.filter(
      notification => notification.timestamp > sevenDaysAgo
    );
    saveNotifications(filteredNotifications);
    console.log('🧹 Notificações antigas removidas');
  };

  // Limpar notificações antigas automaticamente (chamada a cada 1 hora)
  useEffect(() => {
    const autoCleanup = () => {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const hasOldNotifications = notifications.some(
        notification => notification.timestamp < sevenDaysAgo
      );
      
      if (hasOldNotifications) {
        console.log('🧹 Limpeza automática de notificações antigas');
        clearOldNotifications();
      }
    };

    // Executar limpeza a cada hora
    const interval = setInterval(autoCleanup, 60 * 60 * 1000);
    
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
      console.log('🚨 Limpeza de emergência executada');
    } catch (error) {
      console.error('Erro na limpeza de emergência:', error);
    }
  };

  // Limpar notificações lidas
  const clearReadNotifications = () => {
    const unreadNotifications = notifications.filter(notification => !notification.read);
    saveNotifications(unreadNotifications);
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

  const unreadCount = notifications.filter(n => !n.read).length;

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
                    className={`p-4 border-l-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                      notification.read ? 'opacity-75' : ''
                    } ${getNotificationColor(notification.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${
                            notification.read ? 'text-gray-600' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {formatDate(notification.timestamp)}
                            </span>
                          </div>
                        </div>
                        <p className={`text-sm mt-1 ${
                          notification.read ? 'text-gray-500' : 'text-gray-700'
                        }`}>
                          {notification.body}
                        </p>
                        {!notification.read && (
                          <div className="mt-2">
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                          </div>
                        )}
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
