// Sistema de gerenciamento de versão e atualização forçada

const APP_VERSION = '2.4.1'; // ✅ Correção crítica: Loop infinito no AppointmentForm resolvido - ATUALIZAÇÃO OBRIGATÓRIA
const VERSION_KEY = 'agendafacil_app_version';
const LAST_UPDATE_CHECK_KEY = 'agendafacil_last_update_check';
const UPDATING_FLAG_KEY = 'agendafacil_is_updating'; // Flag para evitar reloads múltiplos

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  newVersion: string;
  forceUpdate: boolean;
  updateMessage: string;
}

export const getCurrentVersion = (): string => {
  return APP_VERSION;
};

export const getStoredVersion = (): string | null => {
  try {
    return localStorage.getItem(VERSION_KEY);
  } catch (error) {
    console.warn('Erro ao acessar localStorage:', error);
    return null;
  }
};

export const setStoredVersion = (version: string): void => {
  try {
    localStorage.setItem(VERSION_KEY, version);
  } catch (error) {
    console.warn('Erro ao salvar versão no localStorage:', error);
  }
};

export const checkForUpdates = (): UpdateInfo => {
  // ⚠️ PROTEÇÃO: Se está atualizando, não verificar novamente (evita loop)
  try {
    const isUpdating = localStorage.getItem(UPDATING_FLAG_KEY);
    if (isUpdating === 'true') {
      // Se a flag está ativa há mais de 10 segundos, limpar (pode ter travado)
      const updateStartTime = localStorage.getItem(UPDATING_FLAG_KEY + '_time');
      if (updateStartTime) {
        const elapsed = Date.now() - parseInt(updateStartTime);
        if (elapsed > 10000) {
          // Limpar flag se passou muito tempo (evita travamento)
          console.warn('⚠️ Flag de atualização travada, limpando...');
          localStorage.removeItem(UPDATING_FLAG_KEY);
          localStorage.removeItem(UPDATING_FLAG_KEY + '_time');
        } else {
          // Ainda está atualizando, não verificar (evita loop)
          return {
            hasUpdate: false,
            currentVersion: getCurrentVersion(),
            newVersion: getCurrentVersion(),
            forceUpdate: false,
            updateMessage: 'Atualização em andamento'
          };
        }
      }
    }

    // ⚠️ PROTEÇÃO EXTRA: Verificar se houve reload recente (últimos 5 segundos)
    // Isso evita que após um reload, o sistema detecte falsamente uma atualização
    const lastReloadTime = sessionStorage.getItem('last_reload_time');
    if (lastReloadTime) {
      const elapsed = Date.now() - parseInt(lastReloadTime);
      if (elapsed < 5000) {
        // Reload muito recente, não verificar atualizações ainda
        return {
          hasUpdate: false,
          currentVersion: getCurrentVersion(),
          newVersion: getCurrentVersion(),
          forceUpdate: false,
          updateMessage: 'Aplicação recém carregada'
        };
      }
    }
  } catch (error) {
    console.warn('Erro ao verificar flag de atualização:', error);
  }

  const currentVersion = getCurrentVersion();
  const storedVersion = getStoredVersion();

  // Se não há versão armazenada, é a primeira vez
  if (!storedVersion) {
    setStoredVersion(currentVersion);
    return {
      hasUpdate: false,
      currentVersion,
      newVersion: currentVersion,
      forceUpdate: false,
      updateMessage: 'Aplicação inicializada'
    };
  }

  // ⚠️ PROTEÇÃO: Se as versões são iguais, não há atualização (evita falsos positivos)
  if (storedVersion === currentVersion) {
    return {
      hasUpdate: false,
      currentVersion,
      newVersion: currentVersion,
      forceUpdate: false,
      updateMessage: 'Aplicação atualizada'
    };
  }

  // Se as versões são diferentes, há uma atualização
  const forceUpdate = shouldForceUpdate(storedVersion, currentVersion);

  return {
    hasUpdate: true,
    currentVersion: storedVersion,
    newVersion: currentVersion,
    forceUpdate,
    updateMessage: forceUpdate
      ? 'Atualização obrigatória disponível'
      : 'Nova versão disponível'
  };
};

const shouldForceUpdate = (oldVersion: string, newVersion: string): boolean => {
  // Versões que requerem atualização forçada
  const forceUpdateVersions = [
    '2.0.0', // Versão com melhorias de 4G
    '2.1.0', // Versão com correções de RLS
    '2.2.0', // ⚠️ CORREÇÃO CRÍTICA: Tela branca e erros de cache - OBRIGATÓRIA
    '2.3.0', // ⚠️ CORREÇÃO CRÍTICA: Bugs de login e cache - OBRIGATÓRIA
    '2.4.0',  // ⚠️ CORREÇÃO CRÍTICA: Sistema automático de limpeza de cache - OBRIGATÓRIA
    '2.4.1'  // ✅ CORREÇÃO CRÍTICA: Loop infinito no AppointmentForm resolvido - OBRIGATÓRIA
  ];

  // Se a versão antiga for menor que 2.4.1, FORÇAR atualização
  const oldVersionNum = parseFloat(oldVersion);
  const newVersionNum = parseFloat(newVersion);

  if (oldVersionNum < 2.4 && newVersionNum >= 2.4) {
    return true; // Forçar atualização para versão 2.4.0+
  }

  return forceUpdateVersions.includes(newVersion);
};

export const applyUpdate = async (): Promise<void> => {
  try {
    console.log('🔄 Iniciando atualização...');

    // ⚠️ PROTEÇÃO: Marcar flag de atualização para evitar verificações durante o processo
    localStorage.setItem(UPDATING_FLAG_KEY, 'true');
    localStorage.setItem(UPDATING_FLAG_KEY + '_time', Date.now().toString());

    // ⚠️ IMPORTANTE: Marcar versão ANTES de limpar (para evitar loop infinito)
    const currentVersion = getCurrentVersion();
    setStoredVersion(currentVersion);
    console.log('✅ Versão atualizada no localStorage:', currentVersion);

    // Verificar se foi salvo corretamente (garantia extra)
    const savedVersion = getStoredVersion();
    if (savedVersion !== currentVersion) {
      console.warn('⚠️ Versão não foi salva corretamente, tentando novamente...');
      setStoredVersion(currentVersion);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Aguardar um pouco para garantir que localStorage foi salvo no disco
    await new Promise(resolve => setTimeout(resolve, 500));

    // Limpar Service Workers PRIMEIRO
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
        console.log('✅ Service Workers removidos');
      } catch (error) {
        console.warn('⚠️ Erro ao remover Service Workers:', error);
      }
    }

    // Aguardar um pouco antes de limpar cache
    await new Promise(resolve => setTimeout(resolve, 300));

    // Limpar cache do navegador (MAS NÃO localStorage - versão deve ser preservada)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        console.log('✅ Cache limpo (localStorage preservado)');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar cache:', error);
      }
    }

    // Verificar novamente se versão ainda está salva (garantia final antes de reload)
    const finalCheck = getStoredVersion();
    if (finalCheck !== currentVersion) {
      console.warn('⚠️ Versão não está salva, salvando novamente...');
      setStoredVersion(currentVersion);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Aguardar um pouco mais antes de recarregar (evitar conflito)
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('🔄 Recarregando página...');
    console.log('✅ Versão final salva:', getStoredVersion());

    // ⚠️ IMPORTANTE: Limpar flag de atualização ANTES de recarregar
    // Mas adicionar um timestamp na URL para forçar reload sem cache
    localStorage.removeItem(UPDATING_FLAG_KEY);
    localStorage.removeItem(UPDATING_FLAG_KEY + '_time');

    // ⚠️ PROTEÇÃO: Marcar tempo do reload para evitar verificação imediata após reload
    sessionStorage.setItem('last_reload_time', Date.now().toString());

    // Usar replace em vez de reload para evitar problemas
    window.location.replace(window.location.href.split('?')[0] + '?v=' + Date.now());
  } catch (error) {
    console.error('❌ Erro ao aplicar atualização:', error);
    // Em caso de erro, garantir que versão está salva antes de recarregar
    const currentVersion = getCurrentVersion();
    setStoredVersion(currentVersion);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
};

// Função de LIMPEZA COMPLETA FORÇADA - limpa TUDO
export const forceCompleteCleanup = async (): Promise<void> => {
  try {
    console.log('🧹 Iniciando limpeza completa forçada...');

    // 1. Limpar Service Workers PRIMEIRO
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
        console.log('✅ Service Workers removidos');
      } catch (error) {
        console.warn('⚠️ Erro ao remover Service Workers:', error);
      }
    }

    // 2. Limpar TODOS os caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        console.log('✅ Todos os caches removidos');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar cache:', error);
      }
    }

    // 3. Limpar IndexedDB COMPLETAMENTE
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
              });
            }
          })
        );
        console.log('✅ IndexedDB limpo');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar IndexedDB:', error);
      }
    }

    // 4. Limpar TODOS os cookies
    document.cookie.split(";").forEach((c) => {
      const cookieName = c.split("=")[0].trim();
      // Limpar cookie para todos os paths e domains possíveis
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
      document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
    });
    console.log('✅ Todos os cookies removidos');

    // 5. Limpar sessionStorage
    try {
      sessionStorage.clear();
      console.log('✅ sessionStorage limpo');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar sessionStorage:', error);
    }

    // 6. Limpar localStorage (EXCETO versão e dados de autenticação/login)
    try {
      const currentVersion = getCurrentVersion();
      // Chaves importantes que NUNCA devem ser limpas
      const keysToKeep = [
        VERSION_KEY,                    // Versão do app
        'agendafacil_auth_token',       // Token de autenticação principal
        'saved_email',                  // Email salvo do login
        'saved_password',               // Senha salva do login
        'save_credentials',             // Flag de salvar credenciais
        'supabase.auth.token',          // Token antigo do Supabase (se existir)
      ];

      // Salvar versão atual antes de limpar
      setStoredVersion(currentVersion);

      // Limpar tudo exceto as chaves importantes
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          allKeys.push(key);
        }
      }

      allKeys.forEach(key => localStorage.removeItem(key));
      console.log('✅ localStorage limpo (versão e autenticação preservadas)');
      console.log('🔒 Chaves preservadas:', keysToKeep.filter(key => localStorage.getItem(key)));
    } catch (error) {
      console.warn('⚠️ Erro ao limpar localStorage:', error);
    }

    // 7. Limpar cache do navegador (forçar reload sem cache)
    console.log('✅ Limpeza completa finalizada');

  } catch (error) {
    console.error('❌ Erro na limpeza completa:', error);
    throw error;
  }
};

// Variável global para armazenar o intervalo e evitar múltiplos intervalos
let updateCheckInterval: NodeJS.Timeout | null = null;
let isUpdateCheckScheduled = false;

export const scheduleUpdateCheck = (): void => {
  // ⚠️ PROTEÇÃO: Evitar criar múltiplos intervalos
  if (isUpdateCheckScheduled) {
    return;
  }

  // Apenas em produção
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  isUpdateCheckScheduled = true;

  const now = Date.now();
  const lastCheck = localStorage.getItem(LAST_UPDATE_CHECK_KEY);
  const checkInterval = 5 * 60 * 1000; // 5 MINUTOS (reduzido de 30 segundos para evitar reloads constantes)

  // Verificar atualizações IMEDIATAMENTE na primeira vez (apenas uma vez)
  const updateInfo = checkForUpdates();
  if (updateInfo.hasUpdate) {
    // Notificar sobre atualização disponível IMEDIATAMENTE
    window.dispatchEvent(new CustomEvent('app-update-available', {
      detail: updateInfo
    }));
  }

  // Verificar se já passou o intervalo desde a última verificação
  if (!lastCheck || (now - parseInt(lastCheck)) > checkInterval) {
    localStorage.setItem(LAST_UPDATE_CHECK_KEY, now.toString());
  }

  // Limpar intervalo anterior se existir (proteção extra)
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }

  // Criar UM ÚNICO intervalo para verificar a cada 5 minutos
  updateCheckInterval = setInterval(() => {
    try {
      const updateInfo = checkForUpdates();
      if (updateInfo.hasUpdate) {
        window.dispatchEvent(new CustomEvent('app-update-available', {
          detail: updateInfo
        }));
      }
      // Atualizar timestamp da última verificação
      localStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Erro ao verificar atualizações:', error);
    }
  }, checkInterval); // 5 minutos
};

// Função para limpar o intervalo (útil para cleanup)
export const clearUpdateCheckInterval = (): void => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
    isUpdateCheckScheduled = false;
  }
};
