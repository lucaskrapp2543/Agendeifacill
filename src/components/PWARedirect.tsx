import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const PWARedirect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
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
      
      // Verificar se está em modo app (sem barra de endereço) - APENAS se for standalone
      const isAppMode = window.innerHeight === window.screen.height && (isStandalone || isFullscreen);
      
      console.log('🔍 Detecção PWA:', {
        isStandalone,
        isFullscreen,
        hasPWAViewport,
        hasServiceWorker,
        hasManifest,
        isAppMode,
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

    // Função para verificar e redirecionar
    const checkAndRedirect = () => {
      if (isPWA() && location.pathname === '/') {
        console.log('📱 PWA detectado, redirecionando para login...');
        console.log('✅ Confirmação: É realmente o app instalado!');
        navigate('/login', { replace: true });
      } else if (location.pathname === '/') {
        console.log('🌐 Navegador normal detectado, mantendo na home');
      }
    };

    // Verificar imediatamente
    checkAndRedirect();

    // Verificar novamente após um pequeno delay (para casos onde a detecção demora)
    const timeoutId = setTimeout(checkAndRedirect, 500);

    // Verificar quando a janela ganha foco (para casos de PWA que abrem em segundo plano)
    const handleFocus = () => {
      setTimeout(checkAndRedirect, 100);
    };

    // Verificar quando o DOM está pronto
    const handleDOMReady = () => {
      setTimeout(checkAndRedirect, 200);
    };

    // Verificar quando a página carrega completamente
    const handleLoad = () => {
      setTimeout(checkAndRedirect, 300);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('DOMContentLoaded', handleDOMReady);
    window.addEventListener('load', handleLoad);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('DOMContentLoaded', handleDOMReady);
      window.removeEventListener('load', handleLoad);
    };
  }, [navigate, location.pathname]);

  return null; // Componente não renderiza nada
};
