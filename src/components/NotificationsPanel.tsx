import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Toaster';

interface Notification {
  id: string;
  type: 'new_appointment' | 'cancelled_appointment';
  title: string;
  message: string;
  appointment_id?: string;
  read: boolean;
  created_at: string;
}

interface NotificationsPanelProps {
  establishmentId: string;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ establishmentId }) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'new_appointment' | 'cancelled_appointment'>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Buscar notificações
  const fetchNotifications = async () => {
    try {
      console.log('🔍 Buscando notificações para establishment:', establishmentId);
      
      const { data, error } = await supabase
        .from('establishment_notifications')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        return;
      }

      console.log('📋 Notificações encontradas:', data?.length || 0);
      console.log('📋 Notificações:', data);

      setNotifications(data || []);
      
      // Contar não lidas
      const unread = (data || []).filter(n => !n.read).length;
      setUnreadCount(unread);

      console.log('🔔 Notificações não lidas:', unread);

      // Enviar notificação para o celular se houver novas não lidas
      if (unread > 0 && 'Notification' in window && notificationPermission === 'granted') {
        const newNotifications = data?.filter(n => !n.read) || [];
        console.log('📱 Enviando notificações para celular:', newNotifications.length);
        newNotifications.forEach(notification => {
          sendMobileNotification(notification);
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar notificações:', error);
    }
  };

  // Enviar notificação para o celular
  const sendMobileNotification = (notification: Notification) => {
    try {
      const mobileNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/novo-icone.png',
        badge: '/novo-icone.png',
        vibrate: [100, 50, 100],
        silent: false,
        tag: `notification-${notification.id}`,
        data: {
          type: notification.type,
          appointmentId: notification.appointment_id,
          timestamp: Date.now()
        }
      });

      // Auto-close após 10 segundos
      setTimeout(() => {
        mobileNotification.close();
      }, 10000);

      // Listener para clique na notificação
      mobileNotification.onclick = () => {
        window.focus();
        mobileNotification.close();
        
        // Abrir dashboard se clicado
        if (window.location.pathname !== '/dashboard/establishment') {
          window.location.href = '/dashboard/establishment';
        }
      };

      console.log('📱 Notificação enviada para o celular:', notification.title);

    } catch (error) {
      console.error('❌ Erro ao enviar notificação para celular:', error);
    }
  };

  // Marcar como lida
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('establishment_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('❌ Erro ao marcar como lida:', error);
        return;
      }

      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );

      // Atualizar contador
      setUnreadCount(prev => Math.max(0, prev - 1));

    } catch (error) {
      console.error('❌ Erro ao marcar como lida:', error);
    }
  };

  // Limpar todas as notificações
  const clearAllNotifications = async () => {
    try {
      const { error } = await supabase
        .from('establishment_notifications')
        .delete()
        .eq('establishment_id', establishmentId);

      if (error) {
        console.error('❌ Erro ao limpar notificações:', error);
        toast.error('Erro ao limpar notificações');
        return;
      }

      setNotifications([]);
      setUnreadCount(0);
      toast.success('Todas as notificações foram limpas');

    } catch (error) {
      console.error('❌ Erro ao limpar notificações:', error);
      toast.error('Erro ao limpar notificações');
    }
  };

  // Buscar notificações quando abrir
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, establishmentId]);

  // Buscar notificações periodicamente (mesmo fechado)
  useEffect(() => {
    // Buscar imediatamente
    fetchNotifications();
    
    // Buscar a cada 10 segundos
    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, [establishmentId]);

  // Atualizar status da permissão de notificações
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Filtrar notificações
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    return notification.type === filter;
  });

  const newAppointmentsCount = notifications.filter(n => n.type === 'new_appointment' && !n.read).length;
  const cancelledAppointmentsCount = notifications.filter(n => n.type === 'cancelled_appointment' && !n.read).length;

  return (
    <div className="relative">
      {/* Botão de notificações */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Bell className="h-5 w-5 mr-2" />
        Notificações
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Painel de notificações */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setIsOpen(false)}>
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">Notificações</h3>
                                 {/* Status das notificações */}
                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
                     <div className={`w-3 h-3 rounded-full ${notificationPermission === 'granted' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                     <span className={`text-sm ${notificationPermission === 'granted' ? 'text-green-700' : 'text-gray-600'}`}>
                       {notificationPermission === 'granted' ? 'Ativo' : 'Inativo'}
                     </span>
                   </div>
                   {/* Dica para o usuário */}
                   <p className="text-xs text-gray-500 italic">
                     Clique nas notificações para sabermos que você viu
                   </p>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                {('Notification' in window && notificationPermission !== 'granted') && (
                  <button
                    onClick={async () => {
                      try {
                        const permission = await Notification.requestPermission();
                        setNotificationPermission(permission);
                        if (permission === 'granted') {
                          toast.success('Notificações no celular ativadas!');
                        } else if (permission === 'denied') {
                          toast.error('Permissão negada. Ative nas configurações do navegador.');
                        }
                      } catch (error) {
                        console.error('Erro ao solicitar permissão:', error);
                        toast.error('Erro ao ativar notificações');
                      }
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Ativar notificações no celular"
                  >
                    📱 Ativar
                  </button>
                )}
                <button
                  onClick={clearAllNotifications}
                  className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                  title="Limpar todas"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setFilter('all')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  filter === 'all' 
                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('new_appointment')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  filter === 'new_appointment' 
                    ? 'bg-green-50 text-green-600 border-b-2 border-green-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Agendamentos ({newAppointmentsCount})
              </button>
              <button
                onClick={() => setFilter('cancelled_appointment')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative ${
                  filter === 'cancelled_appointment' 
                    ? 'bg-red-50 text-red-600 border-b-2 border-red-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Cancelados ({cancelledAppointmentsCount})
              </button>
            </div>

            {/* Lista de notificações */}
            <div className="max-h-96 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {filter === 'all' 
                    ? 'Nenhuma notificação' 
                    : filter === 'new_appointment' 
                      ? 'Nenhum agendamento novo' 
                      : 'Nenhum cancelamento'
                  }
                </div>
              ) : (
                                 filteredNotifications.map((notification) => (
                   <div
                     key={notification.id}
                     className={`p-4 border-b border-gray-100 transition-colors cursor-pointer ${
                       !notification.read 
                         ? 'bg-blue-100 border-l-4 border-l-blue-500 shadow-sm hover:bg-blue-200' 
                         : 'hover:bg-gray-50'
                     }`}
                     onClick={() => markAsRead(notification.id)}
                   >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {notification.type === 'new_appointment' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                                                 <div className="flex items-center justify-between">
                           <h4 className="text-sm font-medium text-gray-900">
                             {notification.title}
                           </h4>
                           {!notification.read && (
                             <div className="flex items-center gap-2">
                               <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-medium">
                                 NÃO LIDA
                               </span>
                               <span className="inline-block w-3 h-3 bg-blue-600 rounded-full animate-pulse"></span>
                             </div>
                           )}
                         </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(notification.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
