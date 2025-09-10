import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, Smartphone } from 'lucide-react';
import { getConnectionInfo } from '../utils/connectionDetector';

interface ConnectionStatusProps {
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      const connectionInfo = getConnectionInfo();
      setConnectionType(connectionInfo.type);
      setTimeout(() => setShowStatus(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    // Detectar tipo de conexão inicial
    const connectionInfo = getConnectionInfo();
    setConnectionType(connectionInfo.type);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showStatus && isOnline) {
    return null;
  }

  const getConnectionIcon = () => {
    if (!isOnline) return <WifiOff size={16} />;
    
    switch (connectionType) {
      case 'wifi':
        return <Wifi size={16} />;
      case '4g':
      case '3g':
        return <Smartphone size={16} />;
      case 'slow':
        return <AlertCircle size={16} />;
      default:
        return <Wifi size={16} />;
    }
  };

  const getConnectionText = () => {
    if (!isOnline) return 'Sem conexão';
    
    switch (connectionType) {
      case 'wifi':
        return 'Wi-Fi';
      case '4g':
        return '4G';
      case '3g':
        return '3G';
      case 'slow':
        return 'Conexão lenta';
      default:
        return 'Conectado';
    }
  };

  const getConnectionColor = () => {
    if (!isOnline) return 'bg-red-500 text-white';
    
    switch (connectionType) {
      case 'wifi':
        return 'bg-green-500 text-white';
      case '4g':
        return 'bg-blue-500 text-white';
      case '3g':
        return 'bg-yellow-500 text-white';
      case 'slow':
        return 'bg-orange-500 text-white';
      default:
        return 'bg-green-500 text-white';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${className}`}>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg ${getConnectionColor()}`}
      >
        {getConnectionIcon()}
        <span className="text-sm font-medium">{getConnectionText()}</span>
      </div>
    </div>
  );
};
