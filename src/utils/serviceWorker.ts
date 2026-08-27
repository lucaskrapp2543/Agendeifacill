// Utilitário para gerenciar Service Worker

// Verificar se está em produção
const isProduction = (): boolean => {
  const hostname = window.location.hostname;
  return (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.includes('localhost') &&
    !hostname.includes('127.0.0.1')
  );
};

export async function unregisterServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.error('❌ Erro ao remover Service Workers:', error);
    }
  }
}

export async function clearAllCaches(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    } catch (error) {
      console.error('❌ Erro ao limpar caches:', error);
    }
  }
}

export async function forceUpdate(): Promise<void> {
  try {
    // Limpar caches
    await clearAllCaches();

    // Remover service workers
    await unregisterServiceWorker();

    // Recarregar página
    window.location.reload();
  } catch (error) {
    console.error('❌ Erro ao forçar atualização:', error);
    // Fallback: apenas recarregar
    window.location.reload();
  }
}

export const registerServiceWorker = async (): Promise<void> => {
  // ✅ Em desenvolvimento: se existir SW antigo em localhost, REMOVER
  if (!isProduction()) {
    await unregisterServiceWorker();
    await clearAllCaches();
    return;
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  // Mobile usa SW mínimo (sem cache) para manter PWA instalável
  const swPath = isMobile ? '/sw-mobile.js' : '/sw.js';

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: '/'
      });
      
      // ⚠️ NÃO tentar atualizar imediatamente (evita loops)
      // O navegador verifica atualizações automaticamente a cada 24h
      // Só verificar atualizações periodicamente, não imediatamente
      
      // Escutar atualizações (mas não forçar)
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nova versão disponível
              // Notificar o app sobre a atualização
              window.dispatchEvent(new CustomEvent('sw-update-available', {
                detail: { registration, newWorker }
              }));
            }
          });
        }
      });
      
      // Escutar mensagens do Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'CACHE_UPDATED') return;
      });
      
      // ── VERIFICAÇÃO DE VERSÃO NOVA ──────────────────────────────────────────
      // Antes só existia o intervalo de 30 min abaixo, e nada rodava ao abrir o app.
      // Quem abria, usava 20 minutos e fechava NUNCA recebia versão nova — ficava preso
      // numa build antiga para sempre. Foi por isso que, após vários deploys, ainda havia
      // gente rodando versões velhas (inclusive com bugs já corrigidos).
      //
      // `registration.update()` apenas PERGUNTA ao servidor se há SW novo. Ele não
      // recarrega a página nem troca a versão sozinho: se achar algo, dispara
      // 'updatefound' → evento 'sw-update-available' → o aviso de atualizar aparece
      // para a pessoa decidir. Por isso é seguro chamar mais vezes.
      const MIN_INTERVALO_MS = 5 * 60 * 1000; // trava para não checar demais
      let ultimaChecagem = 0;

      const verificarAtualizacao = (motivo: string) => {
        const agora = Date.now();
        if (agora - ultimaChecagem < MIN_INTERVALO_MS) return;
        ultimaChecagem = agora;
        registration.update().catch((error) => {
          if (error?.message && !String(error.message).includes('not found')) {
            console.warn(`⚠️ Falha ao verificar atualização (${motivo}):`, error);
          }
        });
      };

      // 1) Ao ABRIR o app — com folga para não competir com o carregamento inicial.
      setTimeout(() => verificarAtualizacao('abertura'), 8000);

      // 2) Ao VOLTAR para a aba/app. Cobre o PWA que fica dias aberto em segundo plano:
      //    a pessoa volta ao app e nesse momento descobre que existe versão nova.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') verificarAtualizacao('voltou ao app');
      });

      // 3) Quando a internet volta — quem estava offline não conseguiu verificar.
      window.addEventListener('online', () => verificarAtualizacao('reconectou'));

      // 4) Periodicamente, para quem deixa a tela aberta o dia todo.
      setInterval(() => verificarAtualizacao('periódico'), 30 * 60 * 1000);
      
    } catch (error) {
      console.error('❌ Erro ao registrar Service Worker:', error);
    }
  }
};
