import React, { useState, useEffect } from 'react';
import { Bell, BellOff, CheckCircle, XCircle } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationPermissionProps {
  onPermissionGranted?: () => void;
  className?: string;
}

export const NotificationPermission: React.FC<NotificationPermissionProps> = ({
  onPermissionGranted,
  className = ''
}) => {
  const { isSupported, permission, requestPermission } = useNotifications();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    if (!isSupported) return;
    
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted && onPermissionGranted) {
        onPermissionGranted();
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 text-sm ${className}`}>
        <BellOff className="w-4 h-4" />
        <span>Notificações não suportadas</span>
      </div>
    );
  }

  if (permission === 'granted') {
    return (
      <div className={`flex items-center gap-2 text-green-600 text-sm ${className}`}>
        <CheckCircle className="w-4 h-4" />
        <span>Notificações ativadas</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className={`flex items-center gap-2 text-red-600 text-sm ${className}`}>
        <XCircle className="w-4 h-4" />
        <span>Notificações bloqueadas</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleRequestPermission}
      disabled={isRequesting}
      className={`flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm ${className}`}
    >
      <Bell className="w-4 h-4" />
      {isRequesting ? 'Solicitando...' : 'Ativar notificações'}
    </button>
  );
};
