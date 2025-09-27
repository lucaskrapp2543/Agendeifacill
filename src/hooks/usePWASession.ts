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

      console.log('📱 Modo PWA detectado:', isPWA);
      return isPWA;
    };

    const isPWA = checkPWAMode();

    // Se for PWA, configurar persistência especial
    if (isPWA) {
      console.log('🔧 Configurando persistência PWA...');

      // Listener para mudanças de visibilidade (app sendo fechado/aberto)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('👁️ PWA voltou ao foco, verificando sessão...');
          checkAndRestoreSession();
        }
      };

      // Listener para antes de fechar o app
      const handleBeforeUnload = () => {
        console.log('🚪 PWA sendo fechado, salvando estado...');
        // Força salvar a sessão atual
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
            console.log('💾 Sessão salva antes de fechar PWA');
          }
        });
      };

      // Verificar e restaurar sessão ao inicializar
      const checkAndRestoreSession = async () => {
        try {
          const savedSession = localStorage.getItem('agendafacil_auth_token');
          if (savedSession) {
            const parsedSession = JSON.parse(savedSession);
            const now = Date.now() / 1000;
            const expiresAt = parsedSession.expires_at;
            const margin = 10 * 60; // 10 minutos de margem

            if (expiresAt && (expiresAt - margin) > now) {
              console.log('✅ Sessão PWA válida, restaurando...');
              setSessionRestored(true);
              return true;
            } else {
              console.log('⏰ Sessão PWA expirada, removendo...');
              localStorage.removeItem('agendafacil_auth_token');
            }
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
          console.log('🔄 Sessão PWA verificada e salva');
          return true;
        }
      }
      return false;
    }
  };
};
