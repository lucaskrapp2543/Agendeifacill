import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { dlog } from '../utils/debugConsole';

interface ConnectivityCheckerProps {
  onConnectionStatusChange?: (isConnected: boolean) => void;
  children: React.ReactNode;
}

export const ConnectivityChecker: React.FC<ConnectivityCheckerProps> = ({
  onConnectionStatusChange,
  children
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkConnectivity = async () => {
    setIsChecking(true);
    try {
      // Teste simples de conectividade com Supabase
      const { data, error } = await supabase
        .from('establishments')
        .select('id')
        .limit(1);
      
      const connected = !error;
      setIsConnected(connected);
      setLastCheck(new Date());
      onConnectionStatusChange?.(connected);
      
      dlog('🔍 Verificação de conectividade:', connected ? '✅ Conectado' : '❌ Desconectado');
    } catch (error) {
      console.error('❌ Erro na verificação de conectividade:', error);
      setIsConnected(false);
      setLastCheck(new Date());
      onConnectionStatusChange?.(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Verificar conectividade inicial
    checkConnectivity();
    
    // Verificar a cada 30 segundos
    const interval = setInterval(checkConnectivity, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Verificar conectividade quando a página ganha foco
  useEffect(() => {
    const handleFocus = () => {
      checkConnectivity();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (!isConnected) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Problema de Conectividade
          </h3>
          <p className="text-gray-600 mb-4">
            Não foi possível conectar ao servidor. Verifique sua conexão com a internet.
          </p>
          <div className="space-y-2">
            <button
              onClick={checkConnectivity}
              disabled={isChecking}
              className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isChecking ? 'Verificando...' : 'Tentar Novamente'}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              Recarregar Página
            </button>
          </div>
          {lastCheck && (
            <p className="text-xs text-gray-500 mt-4">
              Última verificação: {lastCheck.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
