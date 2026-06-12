import { supabase } from './supabase';

export type PartnerPixKeyType = 'cpf_cnpj' | 'phone' | 'email' | 'random';

export type PartnerPayoutSettingsRow = {
  id: string;
  establishmentId: string;
  pixKeyType: PartnerPixKeyType;
  pixKey: string;
  receiverName?: string | null;
  updatedAt?: string | null;
};

export const PARTNER_PIX_KEY_TYPE_OPTIONS: Array<{ value: PartnerPixKeyType; label: string }> = [
  { value: 'cpf_cnpj', label: 'CPF/CNPJ' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'random', label: 'Chave aleatória' },
];

export function getPartnerPixKeyPlaceholder(type: PartnerPixKeyType): string {
  if (type === 'cpf_cnpj') return '000.000.000-00 ou 00.000.000/0000-00';
  if (type === 'phone') return '(48) 99999-9999';
  if (type === 'email') return 'exemplo@gmail.com';
  return 'Cole sua chave aleatória';
}

export function getPartnerPixKeyTypeLabel(type: PartnerPixKeyType): string {
  return PARTNER_PIX_KEY_TYPE_OPTIONS.find((opt) => opt.value === type)?.label || type;
}

export function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

export function formatPartnerPixKeyForDisplay(type: PartnerPixKeyType, rawKey: string): string {
  const key = String(rawKey || '').trim();
  if (!key) return '';
  if (type === 'phone') {
    const d = digitsOnly(key);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return key;
  }
  if (type === 'cpf_cnpj') {
    const d = digitsOnly(key);
    if (d.length === 11) {
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }
    if (d.length === 14) {
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }
    return key;
  }
  return key;
}

export function maskPartnerPixKeyInput(type: PartnerPixKeyType, value: string): string {
  const input = String(value || '');
  if (type === 'phone') {
    const d = digitsOnly(input).slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (type === 'cpf_cnpj') {
    const d = digitsOnly(input).slice(0, 14);
    if (d.length <= 11) {
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
      if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }
    if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (type === 'email') return input.toLowerCase().trim();
  return input.trim();
}

export function normalizePartnerPixKeyForSave(type: PartnerPixKeyType, value: string): string {
  const trimmed = String(value || '').trim();
  if (type === 'phone' || type === 'cpf_cnpj') return digitsOnly(trimmed);
  if (type === 'email') return trimmed.toLowerCase();
  return trimmed;
}

export function validatePartnerPixKey(type: PartnerPixKeyType, value: string): string | null {
  const normalized = normalizePartnerPixKeyForSave(type, value);
  if (!normalized) return 'Informe a chave Pix.';

  if (type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return 'Informe um e-mail válido.';
    }
    return null;
  }

  if (type === 'phone') {
    if (normalized.length < 10 || normalized.length > 11) {
      return 'Informe um telefone válido com DDD.';
    }
    return null;
  }

  if (type === 'cpf_cnpj') {
    if (normalized.length !== 11 && normalized.length !== 14) {
      return 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).';
    }
    return null;
  }

  if (normalized.length < 8) {
    return 'Informe uma chave aleatória válida.';
  }
  return null;
}

function mapSettingsRow(raw: any): PartnerPayoutSettingsRow {
  return {
    id: String(raw.id),
    establishmentId: String(raw.establishment_id),
    pixKeyType: String(raw.pix_key_type) as PartnerPixKeyType,
    pixKey: String(raw.pix_key || ''),
    receiverName: raw.receiver_name ? String(raw.receiver_name) : null,
    updatedAt: raw.updated_at ? String(raw.updated_at) : null,
  };
}

function isMissingPayoutSettingsError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('partner_payout_settings') ||
    (msg.includes('does not exist') && msg.includes('payout'))
  );
}

export async function fetchPartnerPayoutSettings(
  establishmentId: string
): Promise<{ ok: boolean; settings: PartnerPayoutSettingsRow | null; error?: string }> {
  const id = String(establishmentId || '').trim();
  if (!id) return { ok: false, settings: null, error: 'Estabelecimento não informado.' };

  try {
    const { data, error } = await supabase.rpc('get_partner_payout_settings', {
      p_establishment_id: id,
    });
    if (error) {
      if (isMissingPayoutSettingsError(error)) return { ok: true, settings: null };
      throw error;
    }
    const payload = (data || {}) as { ok?: boolean; error?: string; settings?: any };
    if (!payload.ok) {
      if (payload.error === 'forbidden') return { ok: false, settings: null, error: 'Acesso negado.' };
      return { ok: true, settings: null };
    }
    if (!payload.settings) return { ok: true, settings: null };
    return { ok: true, settings: mapSettingsRow(payload.settings) };
  } catch (error: any) {
    if (isMissingPayoutSettingsError(error)) return { ok: true, settings: null };
    return { ok: false, settings: null, error: error?.message || 'Erro ao carregar dados Pix.' };
  }
}

export async function savePartnerPayoutSettings(input: {
  establishmentId: string;
  pixKeyType: PartnerPixKeyType;
  pixKey: string;
  receiverName?: string;
}): Promise<{ ok: boolean; settings?: PartnerPayoutSettingsRow; message?: string; error?: string }> {
  const validationError = validatePartnerPixKey(input.pixKeyType, input.pixKey);
  if (validationError) {
    return { ok: false, message: validationError, error: 'validation' };
  }

  const normalizedKey = normalizePartnerPixKeyForSave(input.pixKeyType, input.pixKey);

  try {
    const { data, error } = await supabase.rpc('upsert_partner_payout_settings', {
      p_establishment_id: input.establishmentId,
      p_pix_key_type: input.pixKeyType,
      p_pix_key: normalizedKey,
      p_receiver_name: input.receiverName?.trim() || null,
    });
    if (error) throw error;

    const payload = (data || {}) as { ok?: boolean; error?: string; message?: string; settings?: any };
    if (!payload.ok) {
      return {
        ok: false,
        message: payload.message || 'Não foi possível salvar os dados Pix.',
        error: payload.error,
      };
    }

    return {
      ok: true,
      message: 'Dados Pix salvos com sucesso.',
      settings: payload.settings ? mapSettingsRow(payload.settings) : undefined,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Erro ao salvar dados Pix.' };
  }
}

export function partnerPayoutSettingsToFormValues(settings: PartnerPayoutSettingsRow | null): {
  pixKeyType: PartnerPixKeyType;
  pixKey: string;
  receiverName: string;
} {
  if (!settings) {
    return { pixKeyType: 'cpf_cnpj', pixKey: '', receiverName: '' };
  }
  return {
    pixKeyType: settings.pixKeyType,
    pixKey: formatPartnerPixKeyForDisplay(settings.pixKeyType, settings.pixKey),
    receiverName: settings.receiverName || '',
  };
}
