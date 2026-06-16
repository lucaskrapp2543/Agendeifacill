import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook para gerenciar sessão específica para PWA
 * Resolve problemas de desconexão ao fechar/reabrir o app
 */
export const usePWASession = () => {
  const [isPWAMode, setIsPWAMode] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);

  useEffect(() => {
    // Detectar se está rodando como PWA
    const checkPWAMode = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSPWA = (window.navigator as any).standalone === true;
      const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;

      const isPWA = isStandalone || isIOSPWA || isAndroidPWA;
      setIsPWAMode(isPWA);
      return isPWA;
    };

    const isPWA = checkPWAMode();

    // Se for PWA, configurar persistência especial
    if (isPWA) {
      // Listener para mudanças de visibilidade (app sendo fechado/aberto)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkAndRestoreSession();
        }
      };

      // Listener para antes de fechar o app
      const handleBeforeUnload = () => {
        // Força salvar a sessão atual
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
          }
        });
      };

      // Verificar e restaurar sessão ao inicializar / reabrir o app
      const checkAndRestoreSession = async () => {
        try {
          const savedSession = localStorage.getItem('agendafacil_auth_token');
          if (savedSession) {
            const parsedSession = JSON.parse(savedSession);
            const now = Date.now() / 1000;
            const expiresAt = parsedSession.expires_at;
            const margin = 10 * 60; // 10 minutos de margem

            if (expiresAt && (expiresAt - margin) > now) {
              setSessionRestored(true);
              return true;
            }

            if (parsedSession.refresh_token) {
              const { data, error } = await supabase.auth.refreshSession({
                refresh_token: parsedSession.refresh_token,
              });
              if (!error && data.session) {
                localStorage.setItem('agendafacil_auth_token', JSON.stringify(data.session));
                setSessionRestored(true);
                return true;
              }
            }
          }

          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
            setSessionRestored(true);
            return true;
          }
        } catch (error) {
          console.error('❌ Erro ao verificar sessão PWA:', error);
        }
        return false;
      };

      // Configurar listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Verificar sessão inicial
      checkAndRestoreSession();

      // Cleanup
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, []);

  return {
    isPWAMode,
    sessionRestored,
    // Função para forçar verificação de sessão
    checkSession: async () => {
      if (isPWAMode) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
          return true;
        }
      }
      return false;
    }
  };
};
