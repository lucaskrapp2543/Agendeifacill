import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { UpdateInfo, checkForUpdates, applyUpdate } from '../utils/versionManager';

interface UpdateNotificationProps {
  className?: string;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ className = '' }) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Verificar atualizações ao carregar
    const checkUpdates = () => {
      const info = checkForUpdates();
      if (info.hasUpdate) {
        setUpdateInfo(info);
        setIsVisible(true);
      }
    };

    // Verificar imediatamente
    checkUpdates();

    // Escutar eventos de atualização
    const handleUpdateAvailable = (event: CustomEvent) => {
      setUpdateInfo(event.detail);
      setIsVisible(true);
    };

    window.addEventListener('app-update-available', handleUpdateAvailable as EventListener);

    return () => {
      window.removeEventListener('app-update-available', handleUpdateAvailable as EventListener);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    
    try {
      // Mostrar mensagem de atualização
      setTimeout(() => {
        applyUpdate();
      }, 1000);
    } catch (error) {
      console.error('Erro ao aplicar atualização:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    
    // Se for atualização forçada, não permitir fechar
    if (updateInfo?.forceUpdate) {
      setTimeout(() => {
        setIsVisible(true);
      }, 100);
    }
  };

  if (!isVisible || !updateInfo) {
    return null;
  }

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 text-center shadow-xl">
        <div className="flex justify-center mb-4">
          {updateInfo.forceUpdate ? (
            <AlertTriangle className="text-orange-500" size={48} />
          ) : (
            <CheckCircle className="text-green-500" size={48} />
          )}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {updateInfo.forceUpdate ? 'Atualização Obrigatória' : 'Nova Versão Disponível'}
        </h3>
        
        <p className="text-gray-600 mb-4">
          {updateInfo.forceUpdate 
            ? 'Uma atualização importante está disponível e é necessária para o funcionamento correto da aplicação.'
            : 'Uma nova versão da aplicação está disponível com melhorias e correções.'
          }
        </p>
        
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Versão atual:</span>
            <span className="font-mono text-gray-800">{updateInfo.currentVersion}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-600">Nova versão:</span>
            <span className="font-mono text-green-600 font-semibold">{updateInfo.newVersion}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
              updateInfo.forceUpdate
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-primary text-white hover:bg-primary/90'
            } disabled:opacity-50`}
          >
            {isUpdating ? (
              <>
                <RefreshCw className="animate-spin" size={16} />
                Atualizando...
              </>
            ) : (
              <>
                <Download size={16} />
                {updateInfo.forceUpdate ? 'Atualizar Agora' : 'Atualizar'}
              </>
            )}
          </button>
          
          {!updateInfo.forceUpdate && (
            <button
              onClick={handleDismiss}
              className="w-full py-2 px-4 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Atualizar Depois
            </button>
          )}
        </div>
        
        {updateInfo.forceUpdate && (
          <p className="text-xs text-orange-600 mt-3">
            Esta atualização é obrigatória para continuar usando a aplicação.
          </p>
        )}
      </div>
    </div>
  );
};