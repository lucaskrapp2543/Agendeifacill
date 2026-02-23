import React, { useEffect, useState } from 'react';
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
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const checkSupabaseHealth = async (): Promise<boolean> => {
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!supabaseUrl) return navigator.onLine;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: anonKey
          ? {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            }
          : undefined,
      });
      // Se respondeu 401/403, o servidor está alcançável (não é falta de internet).
      if (res.status === 401 || res.status === 403) return true;
      return res.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const checkConnectivity = async () => {
    setIsChecking(true);
    try {
      // 1) Sem rede local no aparelho: desconectado imediatamente.
      if (!navigator.onLine) {
        setConsecutiveFailures(prev => prev + 1);
        setIsConnected(false);
        setLastCheck(new Date());
        onConnectionStatusChange?.(false);
        dlog('🔍 Verificação de conectividade: ❌ Offline (navigator.onLine=false)');
        return;
      }

      // 2) Health check direto no Supabase (evita falso negativo por RLS/permissão).
      const healthOk = await checkSupabaseHealth();
      if (healthOk) {
        setConsecutiveFailures(0);
        setIsConnected(true);
        setLastCheck(new Date());
        onConnectionStatusChange?.(true);
        dlog('🔍 Verificação de conectividade: ✅ Conectado (health check)');
        return;
      }

      // 3) Fallback legado (se health falhar momentaneamente).
      // Erro de permissão/RLS aqui não significa "sem internet", apenas regra de banco.
      const { error } = await supabase.from('establishments').select('id').limit(1);
      const errMsg = String((error as any)?.message || '').toLowerCase();
      const isPermissionLikeError =
        errMsg.includes('permission') ||
        errMsg.includes('rls') ||
        errMsg.includes('not authorized') ||
        errMsg.includes('jwt');

      if (isPermissionLikeError) {
        setConsecutiveFailures(0);
        setIsConnected(true);
        setLastCheck(new Date());
        onConnectionStatusChange?.(true);
        dlog('🔍 Verificação de conectividade: ✅ Conectado (erro de permissão ignorado)');
        return;
      }

      // 4) Só mostra tela de "sem conexão" após 2 falhas seguidas, para não punir oscilações móveis.
      setConsecutiveFailures(prev => {
        const next = prev + 1;
        const connected = next < 2;
        setIsConnected(connected);
        setLastCheck(new Date());
        onConnectionStatusChange?.(connected);
        dlog('🔍 Verificação de conectividade:', connected ? '🟡 Instável (1ª falha)' : '❌ Desconectado (2 falhas)');
        return next;
      });
    } catch (error) {
      console.error('❌ Erro na verificação de conectividade:', error);
      setConsecutiveFailures(prev => {
        const next = prev + 1;
        const connected = next < 2;
        setIsConnected(connected);
        setLastCheck(new Date());
        onConnectionStatusChange?.(connected);
        return next;
      });
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
          <p className="text-gray-600 mb-2">
            Não foi possível conectar ao servidor. Verifique sua conexão com a internet.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Dica: se continuar, tente usar <strong>dados móveis (4G)</strong> ou <strong>reiniciar o roteador</strong>.
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
