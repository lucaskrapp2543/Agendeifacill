// Sistema de gerenciamento de versão e atualização forçada

const APP_VERSION = '2.2.0'; // Versão com correções críticas de tela branca - ATUALIZAÇÃO OBRIGATÓRIA
const VERSION_KEY = 'agendafacil_app_version';
const LAST_UPDATE_CHECK_KEY = 'agendafacil_last_update_check';

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
  
  // Se as versões são diferentes, há uma atualização
  if (storedVersion !== currentVersion) {
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
  }
  
  return {
    hasUpdate: false,
    currentVersion,
    newVersion: currentVersion,
    forceUpdate: false,
    updateMessage: 'Aplicação atualizada'
  };
};

const shouldForceUpdate = (oldVersion: string, newVersion: string): boolean => {
  // Versões que requerem atualização forçada
  const forceUpdateVersions = [
    '2.0.0', // Versão com melhorias de 4G
    '2.1.0', // Versão com correções de RLS
    '2.2.0'  // ⚠️ CORREÇÃO CRÍTICA: Tela branca e erros de cache - OBRIGATÓRIA
  ];
  
  // Se a versão antiga for menor que 2.2.0, FORÇAR atualização
  const oldVersionNum = parseFloat(oldVersion);
  const newVersionNum = parseFloat(newVersion);
  
  if (oldVersionNum < 2.2 && newVersionNum >= 2.2) {
    return true; // Forçar atualização para versão 2.2.0+
  }
  
  return forceUpdateVersions.includes(newVersion);
};

export const applyUpdate = async (): Promise<void> => {
  try {
    console.log('🔄 Iniciando atualização...');
    
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
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
    
    // Verificar novamente se versão ainda está salva (garantia final)
    const finalCheck = getStoredVersion();
    if (finalCheck !== currentVersion) {
      console.warn('⚠️ Versão foi perdida durante limpeza, restaurando...');
      setStoredVersion(currentVersion);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Aguardar um pouco mais antes de recarregar (evitar conflito)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log('🔄 Recarregando página...');
    console.log('✅ Versão final salva:', getStoredVersion());
    
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

export const scheduleUpdateCheck = (): void => {
  const now = Date.now();
  const lastCheck = localStorage.getItem(LAST_UPDATE_CHECK_KEY);
  const checkInterval = 30 * 1000; // 30 SEGUNDOS (muito mais frequente para detectar rápido)
  
  // Verificar atualizações IMEDIATAMENTE na primeira vez
  const updateInfo = checkForUpdates();
  if (updateInfo.hasUpdate) {
    // Notificar sobre atualização disponível IMEDIATAMENTE
    window.dispatchEvent(new CustomEvent('app-update-available', {
      detail: updateInfo
    }));
  }
  
  if (!lastCheck || (now - parseInt(lastCheck)) > checkInterval) {
    localStorage.setItem(LAST_UPDATE_CHECK_KEY, now.toString());
    
    // Verificar atualizações em background
    setTimeout(() => {
      const updateInfo = checkForUpdates();
      if (updateInfo.hasUpdate) {
        // Notificar sobre atualização disponível
        window.dispatchEvent(new CustomEvent('app-update-available', {
          detail: updateInfo
        }));
      }
    }, 1000);
  }
  
  // Verificar a cada 30 segundos (muito mais frequente)
  // Mas apenas se não estiver em desenvolvimento
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    setInterval(() => {
      const updateInfo = checkForUpdates();
      if (updateInfo.hasUpdate) {
        window.dispatchEvent(new CustomEvent('app-update-available', {
          detail: updateInfo
        }));
      }
    }, 30000); // 30 segundos
  }
};
