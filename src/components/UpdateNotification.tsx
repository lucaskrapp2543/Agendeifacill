import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';

interface UpdateNotificationProps {
  onUpdate: () => void;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate }) => {
  const [showNotification, setShowNotification] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listener para mensagens do Service Worker
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        console.log('🔄 Atualização disponível:', event.data.version);
        setUpdateAvailable(true);
        setShowNotification(true);
      }
    };

    // Verificar se há service worker ativo
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      
      // Verificar se há atualizações pendentes
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setUpdateAvailable(true);
          setShowNotification(true);
        }
      });
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Forçar atualização do service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        
        if (registration.waiting) {
          // Enviar mensagem para o service worker em espera
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        
        // Forçar atualização
        await registration.update();
      }
      
      // Aguardar um pouco e recarregar
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      // Fallback: recarregar diretamente
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowNotification(false);
  };

  if (!showNotification || !updateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white border border-green-200 rounded-lg shadow-lg p-4 max-w-sm animate-slide-in">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Download className="w-5 h-5 text-green-600" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            Nova versão disponível!
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Clique para atualizar e obter as últimas funcionalidades.
          </p>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="mt-3 flex space-x-2">
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex-1 bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Atualizando...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Atualizar Agora</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;
