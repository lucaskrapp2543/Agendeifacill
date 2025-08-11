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
    // Tentar recuperar a sessão do localStorage primeiro
    const savedSession = localStorage.getItem('supabase.auth.token');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setSession(parsedSession);
        setUser(parsedSession?.user ?? null);
        setUserRole(parsedSession?.user?.user_metadata?.role as UserRole || null);
      } catch (error) {
        console.error('Erro ao recuperar sessão:', error);
      }
    }

    // Recupera a sessão do Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setUserRole(session?.user?.user_metadata?.role as UserRole || null);
      setIsLoading(false);
    });

    // Inscreve para mudanças na sessão
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setUserRole(session?.user?.user_metadata?.role as UserRole || null);
      setIsLoading(false);

      // Salvar a sessão no localStorage (permitindo múltiplas sessões)
      if (session) {
        const sessionKey = `supabase.auth.token.${session.user.id}`;
        localStorage.setItem(sessionKey, JSON.stringify(session));
        localStorage.setItem('supabase.auth.token', JSON.stringify(session));
      } else {
        localStorage.removeItem('supabase.auth.token');
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
        const sessionKey = `supabase.auth.token.${data.user.id}`;
        localStorage.setItem(sessionKey, JSON.stringify(data.session));
        localStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
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
        const sessionKey = `supabase.auth.token.${data.user.id}`;
        localStorage.setItem(sessionKey, JSON.stringify(data.session));
        localStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
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
      localStorage.removeItem('supabase.auth.token');
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