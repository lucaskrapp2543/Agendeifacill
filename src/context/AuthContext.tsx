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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
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

        // Estratégia 1: Verificar localStorage primeiro (mais rápido para PWA)
        const savedSession = localStorage.getItem('agendafacil_auth_token');
        if (savedSession && isMounted) {
          try {
            const parsedSession = JSON.parse(savedSession);

            // Verificar validade da sessão ANTES de tentar renovar
            const now = Date.now() / 1000;
            const expiresAt = parsedSession.expires_at;
            const timeUntilExpiry = expiresAt - now;
            const hoursUntilExpiry = timeUntilExpiry / 3600;


            // Se já expirou, limpar imediatamente para evitar travar em renovação inválida
            if (timeUntilExpiry <= 0) {
              localStorage.removeItem('agendafacil_auth_token');
            } else if (timeUntilExpiry > 1800 && isMounted) {
              // Se ainda tem mais de 30 minutos, usar a sessão antiga diretamente
              setSession(parsedSession);
              setUser(parsedSession.user);
              setUserRole(parsedSession.user?.user_metadata?.role as UserRole || null);
              if (isMounted) {
                setIsLoading(false);
                markInitialized();
              }
              return;
            } else {
              // Se tem menos de 30 minutos (mas ainda válida), tentar renovar

              try {
                const { data, error } = await withTimeout(
                  supabase.auth.setSession({
                    access_token: parsedSession.access_token,
                    refresh_token: parsedSession.refresh_token
                  }),
                  7000,
                  'Timeout ao renovar sessão'
                );

                if (!error && data.session && isMounted) {
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
                  if (error) {
                    console.error('❌ Erro ao renovar sessão:', error);
                    console.error('📱 CELULAR: Detalhes do erro:', JSON.stringify(error, null, 2));
                  } else {
                    // Alguns ambientes podem retornar sem erro e sem session; evita log "erro: null".
                    console.warn('⚠️ Renovação de sessão não retornou sessão, seguindo com fallback local.');
                  }

                  // Mesmo com erro, se a sessão ainda é válida, usar
                  if (expiresAt && expiresAt > now && isMounted) {
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
              } catch (renewError) {
                console.error('❌ Exceção ao renovar sessão:', renewError);
                console.error('📱 CELULAR: Stack trace:', renewError);

                // Mesmo com exceção, se a sessão ainda é válida, usar
                if (expiresAt && expiresAt > now && isMounted) {
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
            }
          } catch (error) {
            console.error('❌ Erro ao parsear sessão do localStorage:', error);
            localStorage.removeItem('agendafacil_auth_token');
          }
        }

        // Estratégia 2: Buscar do Supabase (fallback)
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          7000,
          'Timeout ao recuperar sessão do Supabase'
        );

        if (error) {
          console.error('❌ Erro ao recuperar sessão do Supabase:', error);
        }

        if (session && isMounted) {
          setSession(session);
          setUser(session.user);
          setUserRole(session.user?.user_metadata?.role as UserRole || null);

          // Salva no localStorage para PWA
          localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
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
      // IMPORTANTE: Ignorar eventos INITIAL_SESSION se já inicializamos
      if (event === 'INITIAL_SESSION' && isInitializedRef.current) {
        return; // Não fazer nada
      }

      // IMPORTANTE: Não sobrescrever sessão válida com sessão vazia
      if (!session && isInitializedRef.current && event === 'INITIAL_SESSION') {
        return; // Não limpar a sessão válida
      }

      // Apenas processar eventos importantes
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setSession(session);
        setUser(session?.user ?? null);
        setUserRole(session?.user?.user_metadata?.role as UserRole || null);
        setIsLoading(false);

        // Tratamento específico para PWA
        if (session) {
          // Salvar a sessão no localStorage com chave consistente
          localStorage.setItem('agendafacil_auth_token', JSON.stringify(session));
        } else if (event === 'SIGNED_OUT') {
          // APENAS limpar localStorage em logout explícito
          localStorage.removeItem('agendafacil_auth_token');
          localStorage.removeItem('supabase.auth.token'); // Limpar chave antiga também
        }
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
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const rawPassword = String(password || '');
      const trimmedPassword = rawPassword.trim();
      const hasEdgeSpacesInPassword = rawPassword !== trimmedPassword;

      if (!navigator.onLine) {
        const offlineError = new Error('Sem conexão com a internet. Verifique sua rede e tente novamente.');
        (offlineError as any).code = 'OFFLINE';
        throw offlineError;
      }

      let { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: rawPassword,
        }),
        15000,
        'Timeout no login. Verifique conexão/Supabase e tente novamente.'
      );

      // Fallback de compatibilidade: alguns preenchimentos automáticos adicionam espaço nas bordas.
      if (
        error &&
        String(error?.message || '').toLowerCase().includes('invalid login credentials') &&
        hasEdgeSpacesInPassword
      ) {
        const retry = await withTimeout(
          supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: trimmedPassword,
          }),
          10000,
          'Timeout na segunda tentativa de login.'
        );
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      setUser(data.user);
      setSession(data.session);
      setUserRole(data.user?.user_metadata?.role as UserRole || null);

      if (data.session && data.user) {
        localStorage.setItem('agendafacil_auth_token', JSON.stringify(data.session));
      }
      return { user: data.user, session: data.session }; // Retorna o user e a session
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('timeout') || message.includes('load failed') || message.includes('failed to fetch')) {
        error.code = error?.code || 'NETWORK_TIMEOUT';
        error.details = error?.details || 'A API de autenticação não respondeu a tempo.';
        error.hint = error?.hint || 'Valide internet, DNS/firewall e status do Supabase.';
      }
      throw error;
    }
  };


  const signUp = async (email: string, password: string, name: string, additionalData?: any) => {
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
    }
    return { user: data.user, session: data.session };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserRole(null);
      setSession(null);
      localStorage.removeItem('agendafacil_auth_token');
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