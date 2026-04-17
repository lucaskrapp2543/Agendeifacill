import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserHttpUrl, supabase } from '../lib/supabase';
import { dlog } from '../utils/debugConsole';

interface ConnectivityCheckerProps {
  onConnectionStatusChange?: (isConnected: boolean) => void;
  children: React.ReactNode;
}

export const ConnectivityChecker: React.FC<ConnectivityCheckerProps> = ({
  onConnectionStatusChange,
  children
}) => {
  const CONNECTIVITY_WARN_DISMISS_KEY = 'agendafacil_connectivity_warn_dismissed_until';
  /** Não bloquear login por oscilação: exige várias falhas seguidas antes de avisar. */
  const FAILURES_BEFORE_WARN = 4;
  const HEALTH_TIMEOUT_MS = 12000;

  const [isConnected, setIsConnected] = useState(true);
  const [showConnectivityWarn, setShowConnectivityWarn] = useState(false);
  const [warnDismissed, setWarnDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const readDismissedUntil = (): number => {
    try {
      const raw = sessionStorage.getItem(CONNECTIVITY_WARN_DISMISS_KEY);
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };

  const checkSupabaseHealth = async (): Promise<boolean> => {
    const supabaseUrl = String(getSupabaseBrowserHttpUrl() || '').trim();
    const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!supabaseUrl) return navigator.onLine;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
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
      // Qualquer resposta HTTP indica que o host foi alcançável (não é "sem internet").
      if (res.status === 401 || res.status === 403) return true;
      if (res.status >= 200 && res.status < 600) return true;
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
      const dismissedUntil = readDismissedUntil();
      if (dismissedUntil > Date.now()) {
        setWarnDismissed(true);
        setShowConnectivityWarn(false);
      }

      // 1) Sem rede local no aparelho: desconectado imediatamente.
      if (!navigator.onLine) {
        setConsecutiveFailures((prev) => prev + 1);
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
        setShowConnectivityWarn(false);
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
        setShowConnectivityWarn(false);
        setLastCheck(new Date());
        onConnectionStatusChange?.(true);
        dlog('🔍 Verificação de conectividade: ✅ Conectado (erro de permissão ignorado)');
        return;
      }

      // 4) Falha real de rede / timeout: não bloquear o app inteiro (login fica preso).
      // Mostra apenas aviso após várias falhas; usuário pode dispensar e tentar logar.
      setConsecutiveFailures((prev) => {
        const next = prev + 1;
        const shouldWarn = next >= FAILURES_BEFORE_WARN;
        setIsConnected(true);
        setShowConnectivityWarn(shouldWarn && !warnDismissed && readDismissedUntil() <= Date.now());
        setLastCheck(new Date());
        onConnectionStatusChange?.(true);
        dlog(
          '🔍 Verificação de conectividade:',
          shouldWarn ? '⚠️ Instável (avisar usuário)' : `🟡 Falha ${next}/${FAILURES_BEFORE_WARN}`
        );
        return next;
      });
    } catch (error) {
      console.error('❌ Erro na verificação de conectividade:', error);
      setConsecutiveFailures((prev) => {
        const next = prev + 1;
        const shouldWarn = next >= FAILURES_BEFORE_WARN;
        setIsConnected(true);
        setShowConnectivityWarn(shouldWarn && !warnDismissed && readDismissedUntil() <= Date.now());
        setLastCheck(new Date());
        onConnectionStatusChange?.(true);
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

  return (
    <>
      {showConnectivityWarn && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-50 border-b border-amber-200 text-amber-950 px-3 py-2 text-sm shadow-sm">
          <div className="max-w-3xl mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong>Conexão instável com o servidor.</strong>{' '}
              Você ainda pode tentar logar. Se falhar, use 4G ou outra rede.
              {lastCheck && (
                <span className="block text-xs text-amber-900/70 mt-1">
                  Última verificação: {lastCheck.toLocaleTimeString()}
                </span>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={checkConnectivity}
                disabled={isChecking}
                className="px-3 py-1 rounded-md bg-amber-600 text-white text-xs font-medium disabled:opacity-50"
              >
                {isChecking ? 'Verificando...' : 'Tentar de novo'}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1 rounded-md bg-amber-200 text-amber-950 text-xs font-medium"
              >
                Recarregar
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const until = Date.now() + 60 * 60 * 1000;
                    sessionStorage.setItem(CONNECTIVITY_WARN_DISMISS_KEY, String(until));
                  } catch {
                    /* ignore */
                  }
                  setWarnDismissed(true);
                  setShowConnectivityWarn(false);
                }}
                className="px-3 py-1 rounded-md border border-amber-300 text-xs font-medium"
              >
                Continuar assim
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
};
