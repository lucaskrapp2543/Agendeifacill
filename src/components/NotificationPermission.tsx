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
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-900">
            {isPWA ? '📱 Notificações do App' : '🔔 Notificações'}
          </h3>
          <p className="text-xs text-blue-700 mt-1">
            {permission === 'default' && 'Receba notificações de novos agendamentos'}
            {permission === 'denied' && 'Permissão negada. Clique para ativar novamente'}
            {permission === 'granted' && isPWA && 'Notificações ativadas no app'}
          </p>
          {isPWA && (
            <p className="text-xs text-blue-600 mt-1">
              📱 App PWA detectado - Notificações nativas ativas
            </p>
          )}
        </div>
        <button
          onClick={handleRequestPermission}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            permission === 'granted'
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
          }`}
        >
          {permission === 'granted' ? '✅ Ativadas' : '🔔 Ativar'}
        </button>
      </div>
      
      {/* Debug info */}
      <div className="mt-2 text-xs text-gray-500">
        <div>Status: {permission}</div>
        <div>PWA: {isPWA ? 'Sim' : 'Não'}</div>
        <div>Suportado: {isSupported ? 'Sim' : 'Não'}</div>
      </div>
    </div>
  );
};
