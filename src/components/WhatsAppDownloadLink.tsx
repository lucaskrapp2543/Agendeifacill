import React, { useState } from 'react';
import { MessageCircle, Copy, Check, Smartphone, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export const WhatsAppDownloadLink: React.FC = () => {
  const [copied, setCopied] = useState(false);

  // Mensagem para o WhatsApp
  const whatsappMessage = `📱 *Baixe o App Agendei Fácil!*

Olá! Agende seus serviços de forma mais rápida e prática com nosso app:

🤖 *Android:*
• Abra no Chrome
• Toque no menu (3 pontos)
• Selecione "Instalar app" ou "Adicionar à tela inicial"

🍎 *iOS:*
• Abra no Safari
• Toque em "Compartilhar" (ícone de compartilhamento)
• Selecione "Adicionar à Tela Inicial"

✨ *Vantagens do App:*
• Acesso mais rápido
• Notificações de lembretes
• Interface otimizada
• Funciona offline

Baixe agora e tenha uma experiência ainda melhor! 🚀

_Link: ${window.location.origin}_`;

  // Link do WhatsApp
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      toast.success('📋 Link copiado para a área de transferência!');
      
      // Reset após 2 segundos
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('❌ Erro ao copiar link');
    }
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappLink, '_blank');
  };

  return (
    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <MessageCircle className="h-8 w-8 text-white" />
        <div>
          <h3 className="text-xl font-bold">📱 Link para WhatsApp</h3>
          <p className="text-green-100 text-sm">
            Compartilhe o download do app com seus clientes
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Botão para abrir WhatsApp */}
        <button
          onClick={handleOpenWhatsApp}
          className="w-full bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5" />
          Abrir no WhatsApp
          <ExternalLink className="h-4 w-4" />
        </button>

        {/* Botão para copiar link */}
        <button
          onClick={handleCopyLink}
          className="w-full bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
        >
          {copied ? (
            <>
              <Check className="h-5 w-5" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="h-5 w-5" />
              Copiar Mensagem
            </>
          )}
        </button>
      </div>

      {/* Preview da mensagem */}
      <div className="mt-4 p-4 bg-white/10 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Preview da Mensagem:
        </h4>
        <div className="text-sm text-green-100 whitespace-pre-line max-h-32 overflow-y-auto">
          {whatsappMessage}
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-4 text-xs text-green-200">
        <p>💡 <strong>Como usar:</strong></p>
        <p>1. Clique em "Abrir no WhatsApp" para enviar diretamente</p>
        <p>2. Ou copie a mensagem e cole em qualquer conversa</p>
        <p>3. A mensagem inclui instruções para Android e iOS</p>
      </div>
    </div>
  );
};
