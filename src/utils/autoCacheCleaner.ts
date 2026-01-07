// Sistema automático de limpeza de cache e cookies
// Detecta problemas e limpa automaticamente sem intervenção do usuário

const HEALTH_CHECK_INTERVAL = 30000; // Verificar a cada 30 segundos
const MAX_FAILED_ATTEMPTS = 3; // Após 3 tentativas falhadas, limpar cache
const CACHE_PROBLEM_FLAG = 'cache_problem_detected';
const LAST_HEALTH_CHECK = 'last_health_check';
const FAILED_LOAD_ATTEMPTS = 'failed_load_attempts';

interface HealthCheckResult {
  isHealthy: boolean;
  reason?: string;
  needsCleanup: boolean;
}

const canUseStorage = (type: 'local' | 'session'): boolean => {
  try {
    const storage = type === 'local' ? window.localStorage : window.sessionStorage;
    const testKey = '__agf_storage_test__';
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

// Verificar saúde da aplicação
export const performHealthCheck = (): HealthCheckResult => {
  try {
    // ⚠️ Se storage não funciona (muito comum em WebViews do Instagram/WhatsApp),
    // não podemos usar essa rotina para decidir reload/cleanup. Em vez disso, "não faz nada".
    if (!canUseStorage('local') || !canUseStorage('session')) {
      return {
        isHealthy: true,
        needsCleanup: false
      };
    }

    // 1. Verificar se localStorage está funcionando
    try {
      const testKey = '__health_check__';
      localStorage.setItem(testKey, 'ok');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (value !== 'ok') {
        return {
          isHealthy: false,
          reason: 'localStorage não está funcionando corretamente',
          needsCleanup: true
        };
      }
    } catch (error) {
      return {
        isHealthy: false,
        reason: 'Erro ao acessar localStorage',
        needsCleanup: true
      };
    }

    // 2. Verificar se sessionStorage está funcionando
    try {
      const testKey = '__health_check__';
      sessionStorage.setItem(testKey, 'ok');
      const value = sessionStorage.getItem(testKey);
      sessionStorage.removeItem(testKey);

      if (value !== 'ok') {
        return {
          isHealthy: false,
          reason: 'sessionStorage não está funcionando corretamente',
          needsCleanup: true
        };
      }
    } catch (error) {
      return {
        isHealthy: false,
        reason: 'Erro ao acessar sessionStorage',
        needsCleanup: true
      };
    }

    // 3. Verificar se a página carregou corretamente
    if (typeof window === 'undefined' || !document.body) {
      return {
        isHealthy: false,
        reason: 'DOM não está disponível',
        needsCleanup: true
      };
    }

    // 4. Verificar se há erros de carregamento de recursos
    const images = document.querySelectorAll('img');
    let brokenImages = 0;
    images.forEach(img => {
      if (img.complete && img.naturalHeight === 0) {
        brokenImages++;
      }
    });

    if (brokenImages > images.length * 0.5 && images.length > 0) {
      return {
        isHealthy: false,
        reason: 'Muitas imagens quebradas detectadas',
        needsCleanup: true
      };
    }

    // 5. Verificar se há Service Workers problemáticos
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations.length > 2) {
          // Múltiplos Service Workers podem causar problemas
          console.warn('⚠️ Múltiplos Service Workers detectados, pode causar problemas');
        }
      }).catch(() => {
        // Ignorar erros silenciosamente
      });
    }

    return {
      isHealthy: true,
      needsCleanup: false
    };
  } catch (error) {
    console.error('❌ Erro no health check:', error);
    return {
      isHealthy: false,
      reason: 'Erro durante verificação de saúde',
      needsCleanup: true
    };
  }
};

// Chaves importantes que NUNCA devem ser limpas
const PRESERVED_LOCALSTORAGE_KEYS = [
  'agendafacil_auth_token',      // Token de autenticação principal
  'saved_email',                  // Email salvo do login
  'saved_password',               // Senha salva do login
  'save_credentials',             // Flag de salvar credenciais
  'agendafacil_app_version',      // Versão do app
  'system_updated',               // Flag de sistema atualizado
  'supabase.auth.token',          // Token antigo do Supabase (se existir)
];

// Limpeza automática e silenciosa
export const autoCleanup = async (): Promise<void> => {
  try {
    console.log('🧹 Iniciando limpeza automática de cache...');
    console.log('🔒 Preservando dados de autenticação e login...');

    // 1. Limpar Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('✅ Service Workers removidos');
      } catch (error) {
        console.warn('⚠️ Erro ao remover Service Workers:', error);
      }
    }

    // 2. Limpar todos os caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ Caches removidos');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar caches:', error);
      }
    }

    // 3. Limpar IndexedDB
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map(db => {
            if (db.name) {
              return new Promise<void>((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!);
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
                deleteReq.onblocked = () => {
                  // Se estiver bloqueado, tentar novamente após um tempo
                  setTimeout(() => {
                    const retryReq = indexedDB.deleteDatabase(db.name!);
                    retryReq.onsuccess = () => resolve();
                    retryReq.onerror = () => resolve(); // Resolver mesmo com erro
                  }, 1000);
                };
              });
            }
          })
        );
        console.log('✅ IndexedDB limpo');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar IndexedDB:', error);
      }
    }

    // 4. Limpar cookies problemáticos (mas manter cookies essenciais)
    try {
      const cookiesToKeep = ['system_updated']; // Manter cookies importantes
      document.cookie.split(';').forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        if (!cookiesToKeep.includes(cookieName)) {
          // Limpar cookie para todos os paths e domains
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        }
      });
      console.log('✅ Cookies limpos');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar cookies:', error);
    }

    // 5. Limpar sessionStorage (mas manter dados importantes)
    try {
      const keysToKeep: string[] = [];
      const allKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          allKeys.push(key);
        }
      }
      allKeys.forEach(key => sessionStorage.removeItem(key));
      console.log('✅ sessionStorage limpo');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar sessionStorage:', error);
    }

    // 6. Limpar localStorage (mas PRESERVAR dados de autenticação/login)
    try {
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !PRESERVED_LOCALSTORAGE_KEYS.includes(key)) {
          allKeys.push(key);
        }
      }
      allKeys.forEach(key => localStorage.removeItem(key));
      console.log('✅ localStorage limpo (dados de autenticação preservados)');
      console.log('🔒 Chaves preservadas:', PRESERVED_LOCALSTORAGE_KEYS.filter(key => localStorage.getItem(key)));
    } catch (error) {
      console.warn('⚠️ Erro ao limpar localStorage:', error);
    }

    // 7. Marcar que limpeza foi feita (mas preservar flags importantes)
    localStorage.setItem(CACHE_PROBLEM_FLAG, 'false');
    localStorage.setItem(FAILED_LOAD_ATTEMPTS, '0');

    console.log('✅ Limpeza automática concluída');
  } catch (error) {
    console.error('❌ Erro na limpeza automática:', error);
  }
};

// Detectar problemas de carregamento
export const detectLoadProblems = (): boolean => {
  try {
    // Se não dá pra acessar storage, não tentar "detectar problemas" (evita loop de reload).
    if (!canUseStorage('local')) return false;

    // Verificar se a página está travada
    const lastCheck = localStorage.getItem(LAST_HEALTH_CHECK);
    if (lastCheck) {
      const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
      // Se passou mais de 2 minutos sem verificação, pode estar travado
      if (timeSinceLastCheck > 120000) {
        return true;
      }
    }

    // Verificar tentativas falhadas
    const failedAttempts = parseInt(localStorage.getItem(FAILED_LOAD_ATTEMPTS) || '0');
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      return true;
    }

    // Verificar se há flag de problema
    const hasProblem = localStorage.getItem(CACHE_PROBLEM_FLAG) === 'true';
    if (hasProblem) {
      return true;
    }

    return false;
  } catch (error) {
    console.warn('⚠️ Erro ao detectar problemas:', error);
    // Em WebViews pode dar erro de storage; NÃO assumir problema para não iniciar loop.
    return false;
  }
};

// Iniciar monitoramento automático
export const startAutoMonitoring = (): void => {
  // ⚠️ PROTEÇÃO: Não rodar em navegadores com proteções (Brave, etc)
  const isBrave = navigator.userAgent.includes('Brave') || 
                  (navigator.userAgentData && navigator.userAgentData.brands && 
                   navigator.userAgentData.brands.some(b => b.brand && b.brand.includes('Brave')));
  
  if (isBrave) {
    console.log('🛡️ Brave detectado - AutoCacheCleaner desabilitado (evita loops)');
    return; // Não rodar no Brave
  }
  
  // ⚠️ PROTEÇÃO: Verificar se já está em loop de limpeza
  const cleanupCount = parseInt(sessionStorage.getItem('agendafacil_cleanup_count') || '0');
  const lastCleanup = parseInt(sessionStorage.getItem('agendafacil_last_cleanup') || '0');
  const now = Date.now();
  
  // Se limpou mais de 2 vezes nos últimos 5 minutos, PARAR
  if (cleanupCount >= 2 && (now - lastCleanup) < (5 * 60 * 1000)) {
    console.warn('🚨 Muitas limpezas detectadas, desabilitando autoCacheCleaner para evitar loop');
    sessionStorage.setItem('agendafacil_cleanup_disabled', 'true');
    return;
  }
  
  // Verificar se está desabilitado
  if (sessionStorage.getItem('agendafacil_cleanup_disabled') === 'true') {
    console.log('🛡️ AutoCacheCleaner desabilitado (loop detectado anteriormente)');
    return;
  }
  
  // Verificar imediatamente ao iniciar
  const healthCheck = performHealthCheck();
  if (!healthCheck.isHealthy || detectLoadProblems()) {
    console.warn('⚠️ Problemas detectados, iniciando limpeza automática...');
    
    // Incrementar contador de limpezas
    sessionStorage.setItem('agendafacil_cleanup_count', (cleanupCount + 1).toString());
    sessionStorage.setItem('agendafacil_last_cleanup', now.toString());
    
    autoCleanup().then(() => {
      // Recarregar após limpeza
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });
    return;
  }

  // Atualizar timestamp da última verificação
  localStorage.setItem(LAST_HEALTH_CHECK, Date.now().toString());

  // Verificar periodicamente
  setInterval(() => {
    try {
      const healthCheck = performHealthCheck();
      localStorage.setItem(LAST_HEALTH_CHECK, Date.now().toString());

      if (!healthCheck.isHealthy) {
        console.warn('⚠️ Problema detectado:', healthCheck.reason);

        // Incrementar contador de tentativas falhadas
        const failedAttempts = parseInt(localStorage.getItem(FAILED_LOAD_ATTEMPTS) || '0') + 1;
        localStorage.setItem(FAILED_LOAD_ATTEMPTS, failedAttempts.toString());
        localStorage.setItem(CACHE_PROBLEM_FLAG, 'true');

        // Se atingiu o limite, limpar automaticamente
        if (failedAttempts >= MAX_FAILED_ATTEMPTS || healthCheck.needsCleanup) {
          // ⚠️ PROTEÇÃO: Verificar se não está em loop de limpeza
          const cleanupCount = parseInt(sessionStorage.getItem('agendafacil_cleanup_count') || '0');
          const lastCleanup = parseInt(sessionStorage.getItem('agendafacil_last_cleanup') || '0');
          const now = Date.now();
          
          // Se limpou mais de 2 vezes nos últimos 5 minutos, PARAR
          if (cleanupCount >= 2 && (now - lastCleanup) < (5 * 60 * 1000)) {
            console.warn('🚨 Loop de limpeza detectado! Desabilitando autoCacheCleaner.');
            sessionStorage.setItem('agendafacil_cleanup_disabled', 'true');
            return; // Não limpar mais
          }
          
          console.log('🧹 Limpando cache automaticamente...');
          
          // Incrementar contador de limpezas
          sessionStorage.setItem('agendafacil_cleanup_count', (cleanupCount + 1).toString());
          sessionStorage.setItem('agendafacil_last_cleanup', now.toString());
          
          autoCleanup().then(() => {
            // Recarregar após limpeza
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          });
        }
      } else {
        // Resetar contador se tudo está ok
        localStorage.setItem(FAILED_LOAD_ATTEMPTS, '0');
        localStorage.setItem(CACHE_PROBLEM_FLAG, 'false');
      }
    } catch (error) {
      console.error('❌ Erro no monitoramento automático:', error);
    }
  }, HEALTH_CHECK_INTERVAL);
};

// Verificação agressiva na inicialização - detecta problemas ANTES de carregar
export const aggressiveInitialCheck = (): boolean => {
  try {
    // ⚠️ PROTEÇÃO: Não rodar em navegadores com proteções (Brave, etc)
    const isBrave = navigator.userAgent.includes('Brave') || 
                    (navigator.userAgentData && navigator.userAgentData.brands && 
                     navigator.userAgentData.brands.some(b => b.brand && b.brand.includes('Brave')));
    
    if (isBrave) {
      return false; // Não rodar no Brave
    }
    
    // ⚠️ PROTEÇÃO: Verificar se está desabilitado por loop anterior
    if (sessionStorage.getItem('agendafacil_cleanup_disabled') === 'true') {
      return false; // Não rodar se desabilitado
    }
    
    // ⚠️ PROTEÇÃO: Verificar se não está em loop de limpeza
    const cleanupCount = parseInt(sessionStorage.getItem('agendafacil_cleanup_count') || '0');
    const lastCleanup = parseInt(sessionStorage.getItem('agendafacil_last_cleanup') || '0');
    const now = Date.now();
    
    // Se limpou mais de 2 vezes nos últimos 5 minutos, PARAR
    if (cleanupCount >= 2 && (now - lastCleanup) < (5 * 60 * 1000)) {
      console.warn('🚨 Loop de limpeza detectado! Desabilitando verificação agressiva.');
      sessionStorage.setItem('agendafacil_cleanup_disabled', 'true');
      return false; // Não limpar mais
    }
    
    // Se não dá pra usar storage, não rodar lógica agressiva (evita piscaceira).
    if (!canUseStorage('local') || !canUseStorage('session')) {
      return false;
    }

    // 1. Verificar se há problemas de carregamento anteriores
    const failedAttempts = parseInt(localStorage.getItem(FAILED_LOAD_ATTEMPTS) || '0');
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      console.warn('⚠️ Múltiplas tentativas falhadas detectadas, limpando imediatamente...');
      
      // Incrementar contador de limpezas
      sessionStorage.setItem('agendafacil_cleanup_count', (cleanupCount + 1).toString());
      sessionStorage.setItem('agendafacil_last_cleanup', now.toString());
      
      autoCleanup().then(() => {
        window.location.reload();
      });
      return true; // Indica que precisa limpar
    }

    // 2. Verificar se localStorage está funcionando (teste crítico)
    try {
      const testKey = '__init_check__';
      localStorage.setItem(testKey, 'ok');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      if (value !== 'ok') {
        // ⚠️ PROTEÇÃO: Verificar se não está em loop antes de limpar
        const cleanupCount = parseInt(sessionStorage.getItem('agendafacil_cleanup_count') || '0');
        const lastCleanup = parseInt(sessionStorage.getItem('agendafacil_last_cleanup') || '0');
        const now = Date.now();
        
        if (cleanupCount >= 2 && (now - lastCleanup) < (5 * 60 * 1000)) {
          console.warn('🚨 Loop de limpeza detectado! Não limpando novamente.');
          sessionStorage.setItem('agendafacil_cleanup_disabled', 'true');
          return false; // Não limpar mais
        }
        
        console.warn('⚠️ localStorage não está funcionando, limpando...');
        
        // Incrementar contador de limpezas
        sessionStorage.setItem('agendafacil_cleanup_count', (cleanupCount + 1).toString());
        sessionStorage.setItem('agendafacil_last_cleanup', now.toString());
        
        autoCleanup().then(() => {
          window.location.reload();
        });
        return true;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao testar localStorage, limpando...');
      // Se localStorage falha, não forçar reload infinito em WebView
      return false;
    }

    // 3. Verificar se há Service Workers problemáticos
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations.length > 3) {
          console.warn('⚠️ Muitos Service Workers detectados, limpando...');
          autoCleanup().then(() => {
            window.location.reload();
          });
        }
      }).catch(() => {
        // Ignorar erros silenciosamente
      });
    }

    return false; // Tudo ok
  } catch (error) {
    console.error('❌ Erro na verificação inicial:', error);
    // Em caso de erro, NÃO assumir que precisa limpar (evita loop)
    return false;
  }
};

// Verificar e limpar na inicialização
export const initializeAutoCleanup = (): void => {
  // ⚠️ PROTEÇÃO: Não rodar em navegadores com proteções (Brave, etc)
  const isBrave = navigator.userAgent.includes('Brave') || 
                  (navigator.userAgentData && navigator.userAgentData.brands && 
                   navigator.userAgentData.brands.some(b => b.brand && b.brand.includes('Brave')));
  
  if (isBrave) {
    console.log('🛡️ Brave detectado - AutoCacheCleaner desabilitado (evita loops)');
    return; // Não rodar no Brave
  }
  
  // ⚠️ PROTEÇÃO: Verificar se está desabilitado por loop anterior
  if (sessionStorage.getItem('agendafacil_cleanup_disabled') === 'true') {
    console.log('🛡️ AutoCacheCleaner desabilitado (loop detectado anteriormente)');
    return;
  }
  
  // Verificação agressiva IMEDIATA (antes de qualquer coisa)
  if (aggressiveInitialCheck()) {
    return; // Já está limpando, não precisa continuar
  }

  // Aguardar um pouco para garantir que a página carregou
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        startAutoMonitoring();
      }, 2000);
    });
  } else {
    setTimeout(() => {
      startAutoMonitoring();
    }, 2000);
  }
};
