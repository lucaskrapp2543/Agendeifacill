import { Copy, MessageCircle, Rocket, Share2, X } from 'lucide-react';
import React, { useEffect, useMemo } from 'react';
import {
  buildPartnerReferralShareTemplates,
  openPartnerReferralWhatsAppShare,
  sharePartnerReferralText,
  type PartnerReferralShareTemplate,
} from '../lib/partnerReferralShareMessages';
import { useToast } from './ui/Toaster';

type PartnerReferralShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  cupomCode: string;
};

export const PartnerReferralShareModal: React.FC<PartnerReferralShareModalProps> = ({
  isOpen,
  onClose,
  cupomCode,
}) => {
  const { toast } = useToast();
  const templates = useMemo(() => buildPartnerReferralShareTemplates(cupomCode), [cupomCode]);

  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyMessage = async (template: PartnerReferralShareTemplate) => {
    try {
      await navigator.clipboard.writeText(template.message);
      toast('Texto copiado!', 'success');
    } catch {
      toast('Não foi possível copiar. Tente selecionar o texto manualmente.', 'error');
    }
  };

  const handleShare = async (template: PartnerReferralShareTemplate) => {
    const result = await sharePartnerReferralText(template.message);
    if (result === 'shared') return;
    if (result === 'copied') {
      toast('Texto copiado! Cole no seu Story ou bio.', 'success');
      return;
    }
    toast('Não foi possível compartilhar. Use copiar texto.', 'error');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-share-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 id="partner-share-modal-title" className="text-lg font-extrabold text-gray-900 leading-tight">
                🚀 Compartilhar e Ganhar Mais
              </h3>
              <p className="mt-1 text-xs text-gray-600">Escolha um texto pronto e envie em segundos.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
              <div>
                <p className="text-sm font-extrabold text-gray-900">
                  {template.emoji} {template.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{template.subtitle}</p>
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-white p-3 text-xs sm:text-sm text-gray-800 leading-relaxed font-sans max-h-40 overflow-y-auto">
                {template.message}
              </pre>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void copyMessage(template)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black"
                >
                  <Copy className="w-4 h-4" />
                  Copiar texto
                </button>
                {template.showWhatsApp && (
                  <button
                    type="button"
                    onClick={() => openPartnerReferralWhatsAppShare(template.message)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                )}
                {template.showShare && (
                  <button
                    type="button"
                    onClick={() => void handleShare(template)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-900 px-4 py-2.5 text-sm font-bold text-gray-900 hover:bg-gray-50"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
