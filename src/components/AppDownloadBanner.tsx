import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, ExternalLink } from 'lucide-react';

export const AppDownloadBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Verificar se está no navegador (não é PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInApp = window.navigator.standalone === true; // iOS Safari
    
    // Verificar se já foi dispensado
    const dismissed = localStorage.getItem('app-download-banner-dismissed');
    
    // Mostrar apenas se:
    // 1. Não está em modo standalone (não é PWA)
    // 2. Não está no app iOS
    // 3. Não foi dispensado
    // 4. É um dispositivo móvel
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isStandalone && !isInApp && !dismissed && isMobile) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('app-download-banner-dismissed', 'true');
  };

  const handleDownload = () => {
    // Detectar o sistema operacional
    const userAgent = navigator.userAgent;
    
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      // iOS - redirecionar para App Store
      window.open('https://apps.apple.com/app/agendei-facil/id123456789', '_blank');
    } else if (/Android/i.test(userAgent)) {
      // Android - redirecionar para Google Play
      window.open('https://play.google.com/store/apps/details?id=com.agendeifacil.app', '_blank');
    } else {
      // Outros dispositivos - mostrar instruções
      alert('Para instalar o app:\n\n📱 iOS: Abra no Safari e toque em "Compartilhar" > "Adicionar à Tela Inicial"\n\n🤖 Android: Abra no Chrome e toque no menu > "Instalar app"');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 rounded-lg shadow-lg border border-primary/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1">
              📱 Baixe o App Agendei Fácil
            </h3>
            <p className="text-xs text-white/90 mb-3">
              Tenha acesso mais rápido e uma experiência melhor!
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 bg-white text-primary px-3 py-2 rounded-md text-xs font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-1"
              >
                <Download className="h-4 w-4" />
                Baixar App
              </button>
              
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-white/70 hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Indicador de que é um banner */}
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-white/30 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};
