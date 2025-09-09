import React, { useState } from 'react';
import { Smartphone, Copy, Check, ExternalLink, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const PWADownloadLink: React.FC = () => {
  const [copied, setCopied] = useState(false);

  // Link do PWA (sua página atual)
  const pwaLink = window.location.origin; // Ex: https://seudominio.com
  const currentUrl = window.location.href; // URL completa atual

  // Mensagem para WhatsApp
  const whatsappMessage = `📱 *Baixe o App Agendei Fácil!*

Olá! Agende seus serviços de forma mais rápida e prática com nosso app:

🔗 *Link para instalar:*
${pwaLink}

📱 *Como instalar:*

🤖 *Android:*
• Abra o link no Chrome
• Toque no menu (3 pontos)
• Selecione "Instalar app" ou "Adicionar à tela inicial"

🍎 *iOS:*
• Abra o link no Safari
• Toque em "Compartilhar" (ícone de compartilhamento)
• Selecione "Adicionar à Tela Inicial"

✨ *Vantagens do App:*
• Acesso mais rápido
• Notificações de lembretes
• Interface otimizada
• Funciona offline
• Sem necessidade de loja de apps

Baixe agora e tenha uma experiência ainda melhor! 🚀`;

  // Link do WhatsApp
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pwaLink);
      setCopied(true);
      toast.success('📋 Link copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('❌ Erro ao copiar link');
    }
  };

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      toast.success('📋 Mensagem do WhatsApp copiada!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('❌ Erro ao copiar mensagem');
    }
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappLink, '_blank');
  };

  const handleOpenPWA = () => {
    window.open(pwaLink, '_blank');
  };

  return (
    <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <Smartphone className="h-8 w-8 text-white" />
        <div>
          <h3 className="text-xl font-bold">📱 Link do PWA (App Web)</h3>
          <p className="text-white/90 text-sm">
            O mesmo app que funciona quando você clica em "Instalar app"
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Link do PWA */}
        <div className="bg-white/10 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">🔗 Link do App:</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={pwaLink}
              readOnly
              className="flex-1 bg-white/20 text-white px-3 py-2 rounded text-sm font-mono"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-white/20 text-white rounded hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
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

        {/* Botões de ação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleOpenPWA}
            className="bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="h-5 w-5" />
            Abrir App
          </button>

          <button
            onClick={handleOpenWhatsApp}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="h-5 w-5" />
            Enviar no WhatsApp
          </button>
        </div>

        {/* Botão para copiar mensagem completa */}
        <button
          onClick={handleCopyWhatsApp}
          className="w-full bg-white/20 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors flex items-center justify-center gap-2"
        >
          <Copy className="h-5 w-5" />
          Copiar Mensagem Completa
        </button>
      </div>

      {/* Preview da mensagem */}
      <div className="mt-4 p-4 bg-white/10 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Preview da Mensagem:
        </h4>
        <div className="text-sm text-white/90 whitespace-pre-line max-h-32 overflow-y-auto">
          {whatsappMessage}
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-4 text-xs text-white/80">
        <p>💡 <strong>Como usar:</strong></p>
        <p>1. Copie o link e envie para seus clientes</p>
        <p>2. Eles abrem no celular e clicam em "Instalar app"</p>
        <p>3. O app fica na tela inicial como um app normal</p>
      </div>
    </div>
  );
};
