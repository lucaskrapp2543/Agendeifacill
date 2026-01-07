// Utilitário para detectar e limpar dados corrompidos que causam loops de reload

const RELOAD_DETECTION_KEY = 'agendafacil_reload_count';
const RELOAD_TIMESTAMP_KEY = 'agendafacil_reload_timestamps';
const MAX_RELOADS_PER_MINUTE = 5; // Se houver mais de 5 reloads em 1 minuto, limpar tudo

/**
 * Detecta se há um loop de reload e limpa dados corrompidos automaticamente
 */
export const detectAndCleanReloadLoop = (): boolean => {
  try {
    const now = Date.now();

    // Obter histórico de reloads
    const reloadTimestampsStr = sessionStorage.getItem(RELOAD_TIMESTAMP_KEY);
    let reloadTimestamps: number[] = [];

    if (reloadTimestampsStr) {
      try {
        reloadTimestamps = JSON.parse(reloadTimestampsStr);
      } catch {
        reloadTimestamps = [];
      }
    }

    // Adicionar timestamp atual
    reloadTimestamps.push(now);

    // Manter apenas timestamps dos últimos 2 minutos
    const twoMinutesAgo = now - (2 * 60 * 1000);
    reloadTimestamps = reloadTimestamps.filter(timestamp => timestamp > twoMinutesAgo);

    // Salvar histórico atualizado
    sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, JSON.stringify(reloadTimestamps));

    // Contar reloads no último minuto
    const oneMinuteAgo = now - (60 * 1000);
    const recentReloads = reloadTimestamps.filter(timestamp => timestamp > oneMinuteAgo);

    // Se há muitos reloads em pouco tempo, é um loop!
    if (recentReloads.length >= MAX_RELOADS_PER_MINUTE) {
      console.warn('🚨 LOOP DE RELOAD DETECTADO! Limpando dados corrompidos...');
      console.warn(`⚠️ ${recentReloads.length} reloads detectados no último minuto`);

      // Limpar tudo que pode estar causando o loop
      performEmergencyCleanup();

      // ⚠️ DESABILITAR SERVICE WORKER AUTOMATICAMENTE quando detecta loop
      // Isso protege QUALQUER navegador com problemas (Brave, Edge com proteções, etc)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister().then(() => {
              console.log('🛡️ Service Worker desabilitado automaticamente (loop detectado)');
              // Marcar no localStorage para não registrar novamente nesta sessão
              localStorage.setItem('sw_disabled_loop_detection', 'true');
            }).catch((error) => {
              console.warn('⚠️ Erro ao desabilitar Service Worker:', error);
            });
          });
        });
      }

      // Limpar histórico de reloads
      sessionStorage.removeItem(RELOAD_TIMESTAMP_KEY);
      sessionStorage.removeItem(RELOAD_DETECTION_KEY);

      return true; // Loop detectado e limpeza realizada
    }

    return false; // Não há loop
  } catch (error) {
    console.error('Erro ao detectar loop de reload:', error);
    return false;
  }
};

/**
 * Limpeza de emergência de todos os dados que podem causar loops
 */
export const performEmergencyCleanup = async (): Promise<void> => {
  try {
    console.log('🧹 Iniciando limpeza de emergência...');

    // 1. Remover TODOS os Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(reg => reg.unregister().catch(() => { }))
        );
        console.log('✅ Service Workers removidos');
      } catch (error) {
        console.warn('⚠️ Erro ao remover Service Workers:', error);
      }
    }

    // 2. Limpar TODOS os caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name).catch(() => { }))
        );
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
              return new Promise<void>((resolve) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!);
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => resolve(); // Continuar mesmo com erro
                deleteReq.onblocked = () => resolve();
              });
            }
          })
        );
        console.log('✅ IndexedDB limpo');
      } catch (error) {
        console.warn('⚠️ Erro ao limpar IndexedDB:', error);
      }
    }

    // 4. Limpar sessionStorage (exceto dados críticos)
    try {
      const criticalKeys = [RELOAD_TIMESTAMP_KEY, 'last_reload_time'];
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && !criticalKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      console.log('✅ sessionStorage limpo');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar sessionStorage:', error);
    }

    // 5. Limpar localStorage de dados problemáticos (mas manter versão e auth)
    try {
      const criticalKeys = [
        'agendafacil_app_version',
        'agendafacil_auth_token',
        'agendafacil_last_update_check',
        'agendafacil_is_updating'
      ];

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !criticalKeys.includes(key) && !key.startsWith('quiz_progress_')) {
          // Verificar se é uma chave que pode causar problemas
          if (
            key.includes('update') ||
            key.includes('reload') ||
            key.includes('cache') ||
            key.includes('service_worker')
          ) {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log('✅ localStorage limpo (dados críticos preservados)');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar localStorage:', error);
    }

    // 6. Limpar cookies do domínio
    try {
      document.cookie.split(';').forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        if (cookieName) {
          // Limpar para todos os paths e domains possíveis
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
        }
      });
      console.log('✅ Cookies limpos');
    } catch (error) {
      console.warn('⚠️ Erro ao limpar cookies:', error);
    }

    console.log('✅ Limpeza de emergência concluída');
  } catch (error) {
    console.error('❌ Erro na limpeza de emergência:', error);
  }
};

/**
 * Verifica se há dados corrompidos e limpa preventivamente
 */
export const checkAndCleanCorruptedData = async (): Promise<void> => {
  try {
    // Verificar se há Service Workers órfãos
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        // Verificar se algum está em estado problemático
        const problematicSWs = registrations.filter(reg => {
          // Se há um service worker instalado mas não ativo, pode causar problemas
          return reg.installing || reg.waiting;
        });

        if (problematicSWs.length > 0) {
          console.warn('⚠️ Service Workers problemáticos detectados, removendo...');
          await Promise.all(
            problematicSWs.map(reg => reg.unregister().catch(() => { }))
          );
        }
      }
    }

    // Verificar se há flags de atualização travadas
    const isUpdating = localStorage.getItem('agendafacil_is_updating');
    if (isUpdating === 'true') {
      const updateTime = localStorage.getItem('agendafacil_is_updating_time');
      if (updateTime) {
        const elapsed = Date.now() - parseInt(updateTime);
        // Se a flag está ativa há mais de 30 segundos, limpar (pode ter travado)
        if (elapsed > 30000) {
          console.warn('⚠️ Flag de atualização travada detectada, limpando...');
          localStorage.removeItem('agendafacil_is_updating');
          localStorage.removeItem('agendafacil_is_updating_time');
        }
      }
    }
  } catch (error) {
    console.warn('Erro ao verificar dados corrompidos:', error);
  }
};








