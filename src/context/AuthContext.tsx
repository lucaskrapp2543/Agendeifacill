import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type UserRole = 'client' | 'premium' | 'establishment' | null;

type AuthContextType = {
  user: User | null;
  userRole: UserRole;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<{ user: User | null; session: Session | null }>;
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
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Função para recuperar sessão
    const initializeAuth = async () => {
      try {
        // Primeiro, tenta recuperar do Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao recuperar sessão:', error);
        }
        
        if (session) {
          setSession(session);
          setUser(session.user);
          setUserRole(session.user?.user_metadata?.role as UserRole || null);
          
          // Salva no localStorage para backup
          localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
        } else {
          // Se não há sessão ativa, tenta recuperar do localStorage
          const savedSession = localStorage.getItem('agendafacil_auth_token');
          if (savedSession) {
            try {
              const parsedSession = JSON.parse(savedSession);
              // Verifica se a sessão não expirou
              if (parsedSession.expires_at && parsedSession.expires_at > Date.now() / 1000) {
                setSession(parsedSession);
                setUser(parsedSession.user);
                setUserRole(parsedSession.user?.user_metadata?.role as UserRole || null);
              } else {
                // Sessão expirada, remove do localStorage
                localStorage.removeItem('agendafacil_auth_token');
              }
            } catch (error) {
              console.error('Erro ao recuperar sessão do localStorage:', error);
              localStorage.removeItem('agendafacil_auth_token');
            }
          }
        }
      } catch (error) {
        console.error('Erro na inicialização da autenticação:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Inscreve para mudanças na sessão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setUserRole(session?.user?.user_metadata?.role as UserRole || null);
      setIsLoading(false);

      // Salvar a sessão no localStorage com chave consistente
      if (session) {
        localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
        console.log('✅ Sessão salva no localStorage para PWA');
      } else {
        localStorage.removeItem('agendafacil_auth_token');
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

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'client', // Role padrão para novos usuários
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