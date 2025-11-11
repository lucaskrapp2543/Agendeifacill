import { useEffect, useState } from 'react';

export default function AppInstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // Detectar plataforma
    const userAgent = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(userAgent);
    const android = /Android/.test(userAgent);
    const desktop = !iOS && !android;

    setIsIOS(iOS);
    setIsAndroid(android);
    setIsDesktop(desktop);

    // Capturar evento de instalação PWA (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('✅ Prompt de instalação capturado');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallAndroid = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Usuário ${outcome === 'accepted' ? 'aceitou' : 'recusou'} a instalação`);
        if (outcome === 'accepted') {
          alert('✅ App instalado com sucesso! Verifique sua tela inicial.');
        }
        setDeferredPrompt(null);
      } catch (error) {
        console.error('Erro ao instalar:', error);
        alert('Para instalar o app:\n\n1. Toque nos 3 pontos (⋮) no canto superior\n2. Toque em "Adicionar à tela inicial"\n3. Toque em "Adicionar"');
      }
    } else {
      // Verificar se já está instalado
      if (window.matchMedia('(display-mode: standalone)').matches) {
        alert('✅ O app já está instalado no seu dispositivo!');
      } else {
        alert('Para instalar o app:\n\n1. Toque nos 3 pontos (⋮) no canto superior direito\n2. Toque em "Adicionar à tela inicial" ou "Instalar app"\n3. Toque em "Adicionar" ou "Instalar"\n\n💡 Certifique-se de estar usando o Chrome ou Edge.');
      }
    }
  };

  const handleInstallIOS = () => {
    alert('Para instalar o app no iOS:\n\n1. Toque no botão Compartilhar (□↑) na barra inferior\n2. Role para baixo e toque em "Adicionar à Tela Inicial"\n3. Toque em "Adicionar"');
  };

  const handleInstallDesktop = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`Usuário ${outcome === 'accepted' ? 'aceitou' : 'recusou'} a instalação`);
      setDeferredPrompt(null);
    } else {
      alert('Para instalar o app no PC:\n\n1. Clique nos 3 pontos (⋮) no canto superior\n2. Clique em "Instalar Agendei Fácil"\n3. Clique em "Instalar"');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <img
            src="/logosite.png"
            alt="AgendeiFácil Logo"
            className="h-16 w-auto mx-auto mb-6"
          />
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Instale o Agendei Fácil
          </h1>
          <p className="text-lg text-gray-600">
            Tenha acesso rápido ao sistema direto da sua tela inicial
          </p>
        </div>

        <div className="mb-6 text-center text-sm text-gray-500">
          <p>Funciona em: 📱 Android • 🍎 iOS • 💻 Desktop</p>
        </div>

        <div className="space-y-4">
          {/* Botão Android */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <button
              onClick={handleInstallAndroid}
              disabled={!isAndroid && !deferredPrompt}
              className={`w-full px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-md ${
                isAndroid || deferredPrompt
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              📱 Instalar no Android
            </button>
            <p className="mt-3 text-sm text-gray-600 text-center">
              {deferredPrompt 
                ? '✅ Clique no botão acima para instalar automaticamente'
                : 'Toque nos 3 pontos (⋮) → "Adicionar à tela inicial"'}
            </p>
          </div>

          {/* Botão iOS */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <button
              onClick={handleInstallIOS}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-md"
            >
              🍎 Instalar no iOS
            </button>
            <p className="mt-3 text-sm text-gray-600 text-center">
              Toque em Compartilhar (□↑) → "Adicionar à Tela Inicial"
            </p>
          </div>

          {/* Botão Desktop */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <button
              onClick={handleInstallDesktop}
              disabled={!isDesktop && !deferredPrompt}
              className={`w-full px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-md ${
                isDesktop || deferredPrompt
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              💻 Instalar no PC
            </button>
            <p className="mt-3 text-sm text-gray-600 text-center">
              {deferredPrompt 
                ? '✅ Clique no botão acima para instalar automaticamente'
                : 'Clique nos 3 pontos (⋮) → "Instalar Agendei Fácil"'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

