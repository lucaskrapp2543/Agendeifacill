import { useEffect } from 'react';
import { scheduleUpdateCheck } from '../utils/versionManager';

export const CacheBuster = () => {
  useEffect(() => {
    // DESABILITADO EM DESENVOLVIMENTO
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return () => { };
    }

    // ⚠️ PROTEÇÃO: NÃO verificar service worker em mobile (causa problemas)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // Apenas agendar verificação de versão, sem verificar service worker
      scheduleUpdateCheck();
      return () => { };
    }

    try {
      // Agendar verificação de atualizações (apenas uma vez, não cria múltiplos intervalos)
      scheduleUpdateCheck();

      // Verificar service worker a cada 30 minutos (apenas em desktop)
      const interval = setInterval(async () => {
        try {
          // Verificar service worker apenas (scheduleUpdateCheck já está rodando)
          if ('serviceWorker' in navigator) {
            // ⚠️ PROTEÇÃO: Verificar se há service worker registrado antes de acessar .ready
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length === 0) {
              return; // Não há service worker, não verificar
            }

            const registration = await navigator.serviceWorker.ready;
            await registration.update();

            // Se há atualização disponível, notificar
            if (registration.waiting) {
              // Disparar evento de atualização disponível
              window.dispatchEvent(new CustomEvent('sw-update-available', {
                detail: { type: 'service-worker' }
              }));
            }
          }
        } catch (error) {
          // Ignorar erros silenciosamente (pode não haver service worker)
          return;
        }
      }, 30 * 60 * 1000); // 30 minutos (aumentado de 15 minutos)

      return () => clearInterval(interval);
    } catch (error) {
      return () => { };
    }
  }, []);

  return null;
};
