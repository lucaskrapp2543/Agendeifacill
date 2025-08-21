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
      return isStandalone || (indicators.length >= 2);
    };

    // Se for PWA e estiver na home, redirecionar para login
    if (isPWA() && location.pathname === '/') {
      console.log('📱 PWA detectado, redirecionando para login...');
      console.log('✅ Confirmação: É realmente o app instalado!');
      // Pequeno delay para garantir que a detecção seja precisa
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 100);
    } else if (location.pathname === '/') {
      console.log('🌐 Navegador normal detectado, mantendo na home');
    }
  }, [navigate, location.pathname]);

  return null; // Componente não renderiza nada
};
