import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { usePWASession } from '../hooks/usePWASession';

type UserRole = 'client' | 'premium' | 'establishment' | null;

type AuthContextType = {
  user: User | null;
  userRole: UserRole;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, name: string, additionalData?: any) => Promise<{ user: User | null; session: Session | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setSession] = useState<Session | null>(null);

  // Hook para gerenciar sessão PWA
  const { isPWAMode } = usePWASession();

  useEffect(() => {
    // Função para recuperar sessão com múltiplas estratégias
    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação PWA...');

        // Estratégia 1: Verificar localStorage primeiro (mais rápido para PWA)
        const savedSession = localStorage.getItem('agendafacil_auth_token');
        if (savedSession) {
          try {
            const parsedSession = JSON.parse(savedSession);
            console.log('📱 Sessão encontrada no localStorage');

            // Verifica se a sessão não expirou (com margem de 5 minutos)
            const now = Date.now() / 1000;
            const expiresAt = parsedSession.expires_at;
            const margin = 5 * 60; // 5 minutos de margem

            if (expiresAt && (expiresAt - margin) > now) {
              console.log('✅ Sessão válida, restaurando...');
              setSession(parsedSession);
              setUser(parsedSession.user);
              setUserRole(parsedSession.user?.user_metadata?.role as UserRole || null);
              setIsLoading(false);
              return; // Sair aqui se sessão válida
            } else {
              console.log('⏰ Sessão expirada, removendo...');
              localStorage.removeItem('agendafacil_auth_token');
            }
          } catch (error) {
            console.error('❌ Erro ao parsear sessão do localStorage:', error);
            localStorage.removeItem('agendafacil_auth_token');
          }
        }

        // Estratégia 2: Buscar do Supabase (fallback)
        console.log('🌐 Buscando sessão do Supabase...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Erro ao recuperar sessão do Supabase:', error);
        }

        if (session) {
          console.log('✅ Sessão encontrada no Supabase');
          setSession(session);
          setUser(session.user);
          setUserRole(session.user?.user_metadata?.role as UserRole || null);

          // Salva no localStorage para PWA
          localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
          console.log('💾 Sessão salva no localStorage para PWA');
        } else {
          console.log('🚫 Nenhuma sessão ativa encontrada');
        }
      } catch (error) {
        console.error('❌ Erro na inicialização da autenticação:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Inscreve para mudanças na sessão com melhor tratamento para PWA
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔄 Evento de autenticação: ${event}`);

      setSession(session);
      setUser(session?.user ?? null);
      setUserRole(session?.user?.user_metadata?.role as UserRole || null);
      setIsLoading(false);

      // Tratamento específico para PWA
      if (session) {
        // Salvar a sessão no localStorage com chave consistente
        localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
        console.log('✅ Sessão salva no localStorage para PWA');

        // Verificar se é um refresh de token
        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token renovado automaticamente');
        }
      } else {
        // Limpar completamente o localStorage em logout
        localStorage.removeItem('agendafacil_auth_token');
        localStorage.removeItem('supabase.auth.token'); // Limpar chave antiga também
        console.log('🗑️ Sessão removida do localStorage');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setUser(data.user);
      setSession(data.session);
      setUserRole(data.user?.user_metadata?.role as UserRole || null);

      if (data.session && data.user) {
        localStorage.setItem('agendafacil_auth_token', JSON.stringify(data.session));
        console.log('✅ Login salvo no localStorage para PWA');
      }
      return { user: data.user, session: data.session }; // Retorna o user e a session
    } catch (error) {
      throw error;
    }
  };


  const signUp = async (email: string, password: string, name: string, additionalData?: any) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'client', // Role padrão para novos usuários
            ...additionalData, // Incluir dados adicionais (first_name, last_name, whatsapp, is_new_client)
          },
        },
      });

      if (error) throw error;

      setUser(data.user);
      setSession(data.session);
      setUserRole(data.user?.user_metadata?.role as UserRole || null);

      if (data.session && data.user) {
        localStorage.setItem('agendafacil_auth_token', JSON.stringify(data.session));
        console.log('✅ Cadastro salvo no localStorage para PWA');
      }
      return { user: data.user, session: data.session };
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserRole(null);
      setSession(null);
      localStorage.removeItem('agendafacil_auth_token');
      console.log('🗑️ Logout realizado e localStorage limpo');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const value = useMemo(
    () => ({ user, userRole, isLoading, signIn, signOut, signUp }),
    [user, userRole, isLoading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}