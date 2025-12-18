import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePWASession } from '../hooks/usePWASession';
import { supabase } from '../lib/supabase';

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
  const [isInitialized, setIsInitialized] = useState(false); // Flag para controlar inicialização
  const isInitializedRef = useRef(false);

  // Hook para gerenciar sessão PWA
  const { isPWAMode } = usePWASession();

  useEffect(() => {
    let isMounted = true; // Flag para evitar atualizações após unmount
    let timeoutId: NodeJS.Timeout | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const markInitialized = () => {
      isInitializedRef.current = true;
      setIsInitialized(true);
    };

    // Timeout de segurança: se não inicializar em 10 segundos, parar o loading
    timeoutId = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn('⚠️ Timeout na inicialização de autenticação, parando loading...');
        setIsLoading(false);
        markInitialized();
      }
    }, 10000); // 10 segundos

    // Função para recuperar sessão com múltiplas estratégias
    const initializeAuth = async () => {
      try {
        console.log('🔄 Inicializando autenticação PWA...');
        console.log('📱 PWA Mode:', isPWAMode);
        console.log('🌐 User Agent:', navigator.userAgent);

        // Estratégia 1: Verificar localStorage primeiro (mais rápido para PWA)
        const savedSession = localStorage.getItem('agendafacil_auth_token');
        if (savedSession && isMounted) {
          try {
            const parsedSession = JSON.parse(savedSession);
            console.log('📱 Sessão encontrada no localStorage');
            console.log('📅 Expira em:', new Date(parsedSession.expires_at * 1000).toLocaleString());

            // Verificar validade da sessão ANTES de tentar renovar
            const now = Date.now() / 1000;
            const expiresAt = parsedSession.expires_at;
            const timeUntilExpiry = expiresAt - now;
            const hoursUntilExpiry = timeUntilExpiry / 3600;

            console.log(`⏰ Tempo até expirar: ${hoursUntilExpiry.toFixed(2)} horas`);

            // Se ainda tem mais de 30 minutos, usar a sessão antiga diretamente
            if (timeUntilExpiry > 1800 && isMounted) {
              console.log('✅ Sessão ainda válida (>30min), usando sem renovar...');
              console.log('📱 CELULAR: Evitando renovação desnecessária');
              setSession(parsedSession);
              setUser(parsedSession.user);
              setUserRole(parsedSession.user?.user_metadata?.role as UserRole || null);
              if (isMounted) {
                setIsLoading(false);
                markInitialized();
              }
              return;
            }

            // Se tem menos de 30 minutos, tentar renovar
            console.log('🔄 Sessão próxima de expirar (<30min), tentando renovar...');
            console.log('📱 CELULAR: URL atual:', window.location.href);
            console.log('📱 CELULAR: isSecureContext:', window.isSecureContext);

            try {
              const { data, error } = await supabase.auth.setSession({
                access_token: parsedSession.access_token,
                refresh_token: parsedSession.refresh_token
              });

              if (!error && data.session && isMounted) {
                console.log('✅ Sessão renovada com sucesso!');
                console.log('📅 Nova expiração:', new Date(data.session.expires_at! * 1000).toLocaleString());
                setSession(data.session);
                setUser(data.session.user);
                setUserRole(data.session.user?.user_metadata?.role as UserRole || null);
                localStorage.setItem('agendafacil_auth_token', JSON.stringify(data.session));
                if (isMounted) {
                  setIsLoading(false);
                  markInitialized();
                }
                return; // Sair aqui se renovação foi bem-sucedida
              } else {
                console.error('❌ Erro ao renovar sessão:', error);
                console.error('📱 CELULAR: Detalhes do erro:', JSON.stringify(error, null, 2));
                console.log('⚠️ Tentando usar sessão antiga do localStorage...');

                // Mesmo com erro, se a sessão ainda é válida, usar
                if (expiresAt && expiresAt > now && isMounted) {
                  console.log('✅ Sessão antiga ainda válida, usando mesmo com erro de renovação...');
                  console.log('📱 CELULAR: Mantendo sessão antiga válida');
                  setSession(parsedSession);
                  setUser(parsedSession.user);
                  setUserRole(parsedSession.user?.user_metadata?.role as UserRole || null);
                  if (isMounted) {
                    setIsLoading(false);
                    markInitialized();
                  }
                  return;
                } else {
                  console.log('⏰ Sessão antiga expirada, removendo...');
                  localStorage.removeItem('agendafacil_auth_token');
                }
              }
            } catch (renewError) {
              console.error('❌ Exceção ao renovar sessão:', renewError);
              console.error('📱 CELULAR: Stack trace:', renewError);

              // Mesmo com exceção, se a sessão ainda é válida, usar
              if (expiresAt && expiresAt > now && isMounted) {
                console.log('✅ Sessão ainda válida, usando apesar da exceção...');
                console.log('📱 CELULAR: Mantendo sessão válida');
                setSession(parsedSession);
                setUser(parsedSession.user);
                setUserRole(parsedSession.user?.user_metadata?.role as UserRole || null);
                if (isMounted) {
                  setIsLoading(false);
                  markInitialized();
                }
                return;
              } else {
                localStorage.removeItem('agendafacil_auth_token');
              }
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

        if (session && isMounted) {
          console.log('✅ Sessão encontrada no Supabase');
          console.log('📱 PWA: Sessão válida, fazendo login automático');
          setSession(session);
          setUser(session.user);
          setUserRole(session.user?.user_metadata?.role as UserRole || null);

          // Salva no localStorage para PWA
          localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
          console.log('💾 Sessão salva no localStorage para PWA');
        } else if (isMounted) {
          console.log('🚫 Nenhuma sessão ativa encontrada no Supabase');
          console.log('📱 PWA: Será necessário fazer login manual');
        }
      } catch (error) {
        console.error('❌ Erro na inicialização da autenticação:', error);
      } finally {
        if (isMounted) {
          // Limpar timeout se inicialização completou
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          setIsLoading(false);
          markInitialized();
        }
      }
    };

    initializeAuth();

    // Inscreve para mudanças na sessão com melhor tratamento para PWA
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔄 Evento de autenticação: ${event}`);
      console.log('📱 Sessão atual:', session ? 'Presente' : 'Ausente');
      console.log('📱 User atual:', session?.user?.email || 'Nenhum');
      console.log('📱 Já inicializado?', isInitializedRef.current);

      // IMPORTANTE: Ignorar eventos INITIAL_SESSION se já inicializamos
      if (event === 'INITIAL_SESSION' && isInitializedRef.current) {
        console.log('⚠️ INITIAL_SESSION ignorado - já temos sessão restaurada');
        return; // Não fazer nada
      }

      // IMPORTANTE: Não sobrescrever sessão válida com sessão vazia
      if (!session && isInitializedRef.current && event === 'INITIAL_SESSION') {
        console.log('⚠️ Sessão inicial vazia ignorada - mantendo sessão existente');
        return; // Não limpar a sessão válida
      }

      // Apenas processar eventos importantes
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        console.log(`✅ Processando evento: ${event}`);

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
            console.log('🔄 Token renovado automaticamente pelo Supabase');
          }
        } else if (event === 'SIGNED_OUT') {
          // APENAS limpar localStorage em logout explícito
          localStorage.removeItem('agendafacil_auth_token');
          localStorage.removeItem('supabase.auth.token'); // Limpar chave antiga também
          console.log('🗑️ Sessão removida do localStorage (logout explícito)');
        }
      } else {
        console.log(`⚠️ Evento ignorado: ${event}`);
      }
    });

    authSubscription = subscription;

    return () => {
      isMounted = false; // Evitar atualizações após unmount
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
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