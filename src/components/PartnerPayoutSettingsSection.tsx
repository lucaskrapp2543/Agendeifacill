import { Wallet } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  getPartnerPixKeyPlaceholder,
  maskPartnerPixKeyInput,
  PARTNER_PIX_KEY_TYPE_OPTIONS,
  partnerPayoutSettingsToFormValues,
  savePartnerPayoutSettings,
  type PartnerPixKeyType,
  type PartnerPayoutSettingsRow,
  validatePartnerPixKey,
} from '../lib/partnerReferralPayoutSettings';

type PartnerPayoutSettingsSectionProps = {
  establishmentId?: string | null;
  initialSettings?: PartnerPayoutSettingsRow | null;
  isLoading?: boolean;
  onSaved?: (settings: PartnerPayoutSettingsRow) => void;
  readOnly?: boolean;
};

export const PartnerPayoutSettingsSection: React.FC<PartnerPayoutSettingsSectionProps> = ({
  establishmentId,
  initialSettings = null,
  isLoading = false,
  onSaved,
  readOnly = false,
}) => {
  const [pixKeyType, setPixKeyType] = useState<PartnerPixKeyType>('cpf_cnpj');
  const [pixKey, setPixKey] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const form = partnerPayoutSettingsToFormValues(initialSettings);
    setPixKeyType(form.pixKeyType);
    setPixKey(form.pixKey);
    setReceiverName(form.receiverName);
  }, [initialSettings]);

  const handleSave = async () => {
    const id = String(establishmentId || '').trim();
    if (!id || readOnly) return;

    const validationError = validatePartnerPixKey(pixKeyType, pixKey);
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await savePartnerPayoutSettings({
        establishmentId: id,
        pixKeyType,
        pixKey,
        receiverName,
      });
      if (!result.ok) {
        setError(result.message || 'Não foi possível salvar.');
        return;
      }
      setSuccess(result.message || 'Salvo com sucesso.');
      if (result.settings) {
        const form = partnerPayoutSettingsToFormValues(result.settings);
        setPixKey(form.pixKey);
        onSaved?.(result.settings);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-6 text-center text-teal-800/70">
        Carregando dados para saque...
      </div>
    );
  }

  if (readOnly) {
    if (!initialSettings) {
      return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          Parceiro ainda não cadastrou chave Pix.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-sm space-y-1">
        <p>
          <strong>Tipo:</strong>{' '}
          {PARTNER_PIX_KEY_TYPE_OPTIONS.find((o) => o.value === initialSettings.pixKeyType)?.label}
        </p>
        <p>
          <strong>Chave:</strong> {initialSettings.pixKey}
        </p>
        <p>
          <strong>Nome:</strong> {initialSettings.receiverName || '—'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-5 sm:p-6 shadow-lg space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center shrink-0 shadow-md">
          <Wallet className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-gray-900">💸 Dados para saque</h3>
          <p className="text-sm text-gray-600 mt-1">
            Cadastre sua chave Pix para receber os lucros das suas indicações.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="partner-pix-type" className="block text-sm font-semibold text-gray-800">
            Tipo da chave Pix
          </label>
          <select
            id="partner-pix-type"
            value={pixKeyType}
            onChange={(e) => {
              setPixKeyType(e.target.value as PartnerPixKeyType);
              setPixKey('');
              setError(null);
            }}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
          >
            {PARTNER_PIX_KEY_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="partner-pix-key" className="block text-sm font-semibold text-gray-800">
            Chave Pix
          </label>
          <input
            id="partner-pix-key"
            type={pixKeyType === 'email' ? 'email' : 'text'}
            value={pixKey}
            onChange={(e) => {
              setPixKey(maskPartnerPixKeyInput(pixKeyType, e.target.value));
              setError(null);
            }}
            placeholder={getPartnerPixKeyPlaceholder(pixKeyType)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="partner-receiver-name" className="block text-sm font-semibold text-gray-800">
            Nome do recebedor <span className="font-normal text-gray-500">(opcional)</span>
          </label>
          <input
            id="partner-receiver-name"
            type="text"
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="João Barbearia"
            maxLength={120}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-gray-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 font-medium">{error}</p>}
      {success && <p className="text-sm text-emerald-700 font-medium">{success}</p>}

      <button
        type="button"
        disabled={isSaving || !establishmentId}
        onClick={() => void handleSave()}
        className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? 'Salvando...' : 'Salvar dados'}
      </button>
    </div>
  );
};
