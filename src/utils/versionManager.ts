// Sistema de gerenciamento de versão e atualização forçada

const APP_VERSION = '2.1.0'; // Incrementar a cada atualização importante
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
    '2.1.0'  // Versão atual com correções de RLS
  ];
  
  return forceUpdateVersions.includes(newVersion);
};

export const applyUpdate = (): void => {
  const currentVersion = getCurrentVersion();
  setStoredVersion(currentVersion);
  
  // Limpar cache do service worker se existir
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
      });
    });
  }
  
  // Limpar cache do navegador
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
      });
    });
  }
  
  // Forçar reload da página
  window.location.reload();
};

export const scheduleUpdateCheck = (): void => {
  const now = Date.now();
  const lastCheck = localStorage.getItem(LAST_UPDATE_CHECK_KEY);
  const checkInterval = 30 * 60 * 1000; // 30 minutos
  
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
};
