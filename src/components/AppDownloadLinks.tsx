import React, { useState } from 'react';
import { Download, Copy, Check, Smartphone, ExternalLink, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export const AppDownloadLinks: React.FC = () => {
  const [copiedAndroid, setCopiedAndroid] = useState(false);
  const [copiedIOS, setCopiedIOS] = useState(false);

  // Links dos apps (você precisa atualizar com os links reais)
  const androidAPKLink = 'https://github.com/SEU-USUARIO/agendei-facil/releases/download/v1.0.0/agendei-facil.apk'; // Link direto do APK
  const iosAppStoreLink = 'https://apps.apple.com/app/agendei-facil/id123456789'; // Link da App Store
  const playStoreLink = 'https://play.google.com/store/apps/details?id=com.agendeifacil.app'; // Link da Play Store

  const handleCopyAndroid = async () => {
    try {
      await navigator.clipboard.writeText(androidAPKLink);
      setCopiedAndroid(true);
      toast.success('📋 Link do APK copiado!');
      setTimeout(() => setCopiedAndroid(false), 2000);
    } catch (err) {
      toast.error('❌ Erro ao copiar link');
    }
  };

  const handleCopyIOS = async () => {
    try {
      await navigator.clipboard.writeText(iosAppStoreLink);
      setCopiedIOS(true);
      toast.success('📋 Link da App Store copiado!');
      setTimeout(() => setCopiedIOS(false), 2000);
    } catch (err) {
      toast.error('❌ Erro ao copiar link');
    }
  };

  const handleDownloadAPK = () => {
    // Criar um link temporário para forçar o download
    const link = document.createElement('a');
    link.href = androidAPKLink;
    link.download = 'agendei-facil.apk';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAppStore = () => {
    window.open(iosAppStoreLink, '_blank');
  };

  const handleOpenPlayStore = () => {
    window.open(playStoreLink, '_blank');
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <Smartphone className="h-8 w-8 text-primary" />
        <div>
          <h3 className="text-xl font-bold text-gray-900">📱 Links de Download do App</h3>
          <p className="text-gray-600 text-sm">
            Links diretos para baixar o Agendei Fácil
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Android APK */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">🤖</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Android APK</h4>
              <p className="text-sm text-gray-600">Download direto do arquivo APK</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleDownloadAPK}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar APK
            </button>
            <button
              onClick={handleCopyAndroid}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              {copiedAndroid ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar
                </>
              )}
            </button>
          </div>
          
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 font-mono break-all">
            {androidAPKLink}
          </div>
        </div>

        {/* Google Play Store */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">📱</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Google Play Store</h4>
              <p className="text-sm text-gray-600">Download pela loja oficial do Android</p>
            </div>
          </div>
          
          <button
            onClick={handleOpenPlayStore}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir na Play Store
          </button>
        </div>

        {/* iOS App Store */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">🍎</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">iOS App Store</h4>
              <p className="text-sm text-gray-600">Download pela loja oficial da Apple</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleOpenAppStore}
              className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir na App Store
            </button>
            <button
              onClick={handleCopyIOS}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              {copiedIOS ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Como usar:
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>APK:</strong> Envie o link para usuários Android que preferem instalação direta</li>
          <li>• <strong>Play Store:</strong> Para usuários que preferem a loja oficial</li>
          <li>• <strong>App Store:</strong> Para usuários iOS (iPhone/iPad)</li>
        </ul>
      </div>

      {/* Aviso sobre hospedagem do APK */}
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
          ⚠️ Importante - Hospedagem do APK:
        </h4>
        <div className="text-sm text-yellow-700 space-y-2">
          <p><strong>Para o APK funcionar, você precisa hospedar o arquivo em:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong>GitHub Releases:</strong> https://github.com/SEU-USUARIO/agendei-facil/releases</li>
            <li><strong>Google Drive:</strong> Compartilhar como "Qualquer pessoa com o link"</li>
            <li><strong>Dropbox:</strong> Link direto para o arquivo</li>
            <li><strong>Seu próprio servidor:</strong> https://seudominio.com/apps/agendei-facil.apk</li>
          </ul>
          <p className="text-xs text-yellow-600 mt-2">
            💡 <strong>Dica:</strong> Atualize o link do APK no código acima com o link real do seu arquivo!
          </p>
        </div>
      </div>
    </div>
  );
};
