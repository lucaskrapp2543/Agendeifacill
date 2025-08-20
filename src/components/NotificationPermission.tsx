import React from 'react';
import { useNotifications } from '../hooks/useNotifications';

export const NotificationPermission: React.FC = () => {
  const { isSupported, permission, isPWA, requestPermission } = useNotifications();

  // Sempre mostrar no mobile, mesmo se já tem permissão
  const shouldShow = isSupported && (permission === 'default' || permission === 'denied' || isPWA);

  if (!shouldShow) {
    return null;
  }

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900">
              {isPWA ? '📱 App' : '🔔'} Notificações
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              permission === 'granted' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              {permission === 'granted' ? '✅ Ativo' : '🔔 Ativar'}
            </span>
          </div>
          {isPWA && permission === 'granted' && (
            <p className="text-xs text-green-600 mt-1">
              Notificações nativas ativas
            </p>
          )}
        </div>
        {permission !== 'granted' && (
          <button
            onClick={handleRequestPermission}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Ativar
          </button>
        )}
      </div>
    </div>
  );
};
