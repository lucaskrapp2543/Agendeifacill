import React, { useCallback, useEffect, useState } from 'react';

import {
  buildPartnerReferralPlansLink,
  buildPartnerReferralWhatsAppMessage,
  createPartnerReferralCode,
  fetchPartnerReferralCodeForEstablishment,
  normalizePartnerReferralCodeInput,
  type PartnerReferralCodeRow,
} from '../lib/partnerReferral';

import { GanheDinheiroPageLayout } from './GanheDinheiroPageLayout';
import { PartnerReferralsSection } from './PartnerReferralsSection';
import { useToast } from './ui/Toaster';

type PartnerReferralPanelProps = {
  establishmentId?: string | null;
  establishmentName?: string | null;
};

export const PartnerReferralPanel: React.FC<PartnerReferralPanelProps> = ({
  establishmentId,
  establishmentName,
}) => {
  const { toast } = useToast();
  const [partnerCode, setPartnerCode] = useState<PartnerReferralCodeRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftCode, setDraftCode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadCode = useCallback(async () => {
    const id = String(establishmentId || '').trim();
    if (!id) {
      setPartnerCode(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const row = await fetchPartnerReferralCodeForEstablishment(id);
      setPartnerCode(row);
    } catch (error: any) {
      setLoadError(error?.message || 'Não foi possível carregar seu cupom.');
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void loadCode();
  }, [loadCode]);

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(successMessage, 'success');
    } catch {
      toast('Não foi possível copiar. Tente selecionar o texto manualmente.', 'error');
    }
  };

  const handleSaveCode = async () => {
    const id = String(establishmentId || '').trim();
    if (!id) {
      toast('Estabelecimento não encontrado.', 'error');
      return;
    }

    setIsSaving(true);
    const result = await createPartnerReferralCode({ establishmentId: id, rawCode: draftCode });
    setIsSaving(false);

    if (!result.ok) {
      if (result.reason === 'duplicate') {
        toast('Esse cupom já está sendo usado. Escolha outro nome.', 'error');
      } else {
        toast(result.message, 'error');
      }
      return;
    }

    setPartnerCode(result.row);
    setDraftCode('');
    toast('Cupom salvo com sucesso!', 'success');
  };

  const handleDraftChange = (value: string) => {
    setDraftCode(normalizePartnerReferralCodeInput(value));
  };

  const referralLink = partnerCode?.code ? buildPartnerReferralPlansLink(partnerCode.code) : '';

  const handleShareWhatsApp = () => {
    if (!partnerCode?.code) return;
    const message = buildPartnerReferralWhatsAppMessage(partnerCode.code, establishmentName || undefined);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <GanheDinheiroPageLayout>
      <PartnerReferralsSection
        establishmentId={establishmentId}
        partnerCode={partnerCode}
        cupomLoading={isLoading}
        cupomError={loadError}
        draftCode={draftCode}
        isSaving={isSaving}
        referralLink={referralLink}
        onDraftChange={handleDraftChange}
        onSaveCode={() => void handleSaveCode()}
        onCopyCupom={() => void copyText(partnerCode?.code || '', 'Cupom copiado!')}
        onCopyLink={() => void copyText(referralLink, 'Link copiado!')}
        onShareWhatsApp={handleShareWhatsApp}
      />

      <p className="text-xs text-white/40 text-center px-2 pb-2">
        Plano Diamante: cupom com <strong className="text-white/60">5% OFF</strong> em{' '}
        <span className="font-mono text-white/50">agendeifacil.com/planos?cupom=SEUCUPOM</span>
      </p>
    </GanheDinheiroPageLayout>
  );
};
