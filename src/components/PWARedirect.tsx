import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const PWARedirect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let hasRedirected = false; // Flag para evitar múltiplos redirecionamentos
    let redirectTimeout: NodeJS.Timeout | null = null;

    // Detectar se é PWA (app instalado)
    const isPWA = () => {
      // Verificar se está em modo standalone (PWA) - MAIS CONFIÁVEL
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      // Verificar se está em tela cheia (PWA)
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      
      // Verificar se tem viewport específico de PWA (iOS)
      const hasPWAViewport = window.navigator.standalone === true;
      
      // Verificar se tem service worker ativo (indicador de PWA)
      const hasServiceWorker = 'serviceWorker' in navigator;
      
      // Verificar se tem manifest instalado
      const hasManifest = document.querySelector('link[rel="manifest"]') !== null;
      
      console.log('🔍 Detecção PWA:', {
        isStandalone,
        isFullscreen,
        hasPWAViewport,
        hasServiceWorker,
        hasManifest,
        userAgent: navigator.userAgent
      });
      
      // SÓ retorna true se for realmente PWA instalado
      // Deve ter pelo menos 2 indicadores para ser considerado PWA real
      const indicators = [isStandalone, isFullscreen, hasPWAViewport].filter(Boolean);
      
      console.log('📊 Indicadores PWA encontrados:', indicators.length);
      
      // Só é PWA se tiver pelo menos 2 indicadores ou se for standalone (mais confiável)
      // OU se for mobile e tiver características específicas de PWA
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isMobilePWA = isMobile && (isStandalone || isFullscreen || hasPWAViewport);
      
      return isStandalone || (indicators.length >= 2) || isMobilePWA;
    };

    // Função para verificar e redirecionar (com proteção contra loops)
    const checkAndRedirect = () => {
      // Evitar múltiplos redirecionamentos
      if (hasRedirected) {
        console.log('⚠️ Redirecionamento já realizado, ignorando...');
        return;
      }

      // Só redirecionar se estiver na rota raiz
      if (location.pathname === '/') {
        if (isPWA()) {
          console.log('📱 PWA detectado, redirecionando para login...');
          console.log('✅ Confirmação: É realmente o app instalado!');
          hasRedirected = true;
          navigate('/login', { replace: true });
        } else {
          console.log('🌐 Navegador normal detectado, mantendo na home');
        }
      }
    };

    // Verificar apenas uma vez após um pequeno delay (evitar múltiplas verificações)
    redirectTimeout = setTimeout(() => {
      checkAndRedirect();
    }, 300);

    return () => {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [navigate, location.pathname]);

  return null; // Componente não renderiza nada
};
