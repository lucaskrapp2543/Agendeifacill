import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallAppButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Verificar se já está instalado
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      const isInstalled = isStandalone || isIOSStandalone;
      
      setIsInstalled(isInstalled);
      
      // Mostrar botão se não está instalado E é mobile
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setShowButton(!isInstalled && isMobile);
    };

    // Listener para o evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowButton(true);
    };

    // Listener para quando o app é instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowButton(false);
      setDeferredPrompt(null);
    };

    // Verificar inicialmente
    checkIfInstalled();

    // Adicionar listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Verificar periodicamente
    const interval = setInterval(checkIfInstalled, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(interval);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Se não há prompt automático, mostrar instruções manuais
      showManualInstallInstructions();
      return;
    }

    try {
      // Mostrar o prompt de instalação
      await deferredPrompt.prompt();
      
      // Aguardar a escolha do usuário
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('App instalado com sucesso!');
        setIsInstalled(true);
        setShowButton(false);
      } else {
        console.log('Instalação cancelada pelo usuário');
      }
    } catch (error) {
      console.error('Erro ao instalar app:', error);
      showManualInstallInstructions();
    }

    setDeferredPrompt(null);
  };

  const showManualInstallInstructions = () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let message = '';
    
    if (isIOS) {
      message = 'Para instalar o app:\n\n1. Toque no botão Compartilhar (□↑)\n2. Toque em "Adicionar à Tela Inicial"\n3. Toque em "Adicionar"';
    } else if (isAndroid) {
      message = 'Para instalar o app:\n\n1. Toque nos 3 pontos (⋮)\n2. Toque em "Adicionar à tela inicial"\n3. Toque em "Adicionar"';
    } else {
      message = 'Para instalar o app:\n\n1. Clique nos 3 pontos (⋮)\n2. Clique em "Instalar Agendei Fácil"\n3. Clique em "Instalar"';
    }
    
    alert(message);
  };

  if (!showButton) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50">
      <div className="bg-blue-600 text-white rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium">📱 Instalar Agendei Fácil</h3>
            <p className="text-xs opacity-90 mt-1">
              Instale o app para receber notificações e usar offline
            </p>
          </div>
          <button
            onClick={handleInstallClick}
            className="ml-4 px-4 py-2 bg-white text-blue-600 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
};
