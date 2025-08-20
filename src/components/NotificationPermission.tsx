import React from 'react';
import { useNotifications } from '../hooks/useNotifications';

export const NotificationPermission: React.FC = () => {
  const { isSupported, permission, isPWA, requestPermission } = useNotifications();

  // Mostrar sempre se suportado e não tem permissão, ou se é PWA, ou se é PC
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const shouldShow = isSupported && (
    permission === 'default' || 
    permission === 'denied' || 
    isPWA || 
    !isMobile // Mostrar sempre no PC
  );

  console.log('🔍 NOTIFICATION PERMISSION DEBUG:', {
    isSupported,
    permission,
    isPWA,
    isMobile,
    shouldShow,
    userAgent: navigator.userAgent
  });

  if (!shouldShow) {
    console.log('❌ NOTIFICATION PERMISSION: Não deve mostrar');
    return null;
  }

  console.log('✅ NOTIFICATION PERMISSION: Deve mostrar');

  const handleRequestPermission = async () => {
    console.log('🔔 CLICOU NO BOTÃO ATIVAR NOTIFICAÇÕES');
    console.log('🔍 Estado atual:', { isSupported, permission, isPWA });
    
    try {
      const result = await requestPermission();
      console.log('🔔 RESULTADO DA PERMISSÃO:', result);
    } catch (error) {
      console.error('❌ ERRO AO SOLICITAR PERMISSÃO:', error);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900">
              {isPWA ? '📱 App' : isMobile ? '📱 Mobile' : '💻 PC'} Notificações
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
            id="notification-activate-button"
            onClick={handleRequestPermission}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            style={{ cursor: 'pointer' }}
            title="Clique para ativar notificações"
          >
            Ativar
          </button>
        )}
      </div>
    </div>
  );
};
