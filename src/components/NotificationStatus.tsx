import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Settings } from 'lucide-react';

interface NotificationStatusProps {
  permission: NotificationPermission;
  onRequestPermission: () => void;
}

export function NotificationStatus({ permission, onRequestPermission }: NotificationStatusProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mostrar o banner se a permissão não foi concedida
    if (permission !== 'granted') {
      setIsVisible(true);
    }
  }, [permission]);

  if (!isVisible) return null;

  return (
    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {permission === 'granted' ? (
            <Bell className="h-5 w-5 text-green-500" />
          ) : (
            <BellOff className="h-5 w-5 text-yellow-500" />
          )}
          <div>
            <h3 className="text-white font-medium">
              {permission === 'granted' 
                ? '🔔 Notificações Ativadas' 
                : '🔔 Ative as Notificações'
              }
            </h3>
            <p className="text-gray-400 text-sm">
              {permission === 'granted'
                ? 'Você receberá lembretes 30 minutos antes dos seus agendamentos!'
                : 'Receba lembretes automáticos dos seus agendamentos'
              }
            </p>
          </div>
        </div>
        
        {permission !== 'granted' && (
          <button
            onClick={onRequestPermission}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Settings className="h-4 w-4" />
            Ativar
          </button>
        )}
        
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
