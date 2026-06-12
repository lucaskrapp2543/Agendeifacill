import { supabase } from './supabase';
import { normalizePartnerReferralCodeInput } from './partnerReferralCode';

export { normalizePartnerReferralCodeInput } from './partnerReferralCode';

export type PartnerReferralCodeRow = {
  id: string;
  establishment_id: string;
  code: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const PARTNER_REFERRAL_LINK_BASE = 'https://agendeifacil.com/planos';

export function isPartnerReferralCodeValid(code: string): boolean {
  const normalized = normalizePartnerReferralCodeInput(code);
  return normalized.length >= 3 && normalized.length <= 20;
}

export function buildPartnerReferralPlansLink(code: string): string {
  const normalized = normalizePartnerReferralCodeInput(code);
  if (!normalized) return PARTNER_REFERRAL_LINK_BASE;
  return `${PARTNER_REFERRAL_LINK_BASE}?cupom=${encodeURIComponent(normalized)}`;
}

export function buildPartnerReferralWhatsAppMessage(code: string, establishmentName?: string): string {
  const link = buildPartnerReferralPlansLink(code);
  const shop = String(establishmentName || 'minha barbearia').trim() || 'minha barbearia';
  return (
    `💈 Indiquei você para conhecer o Agendei Fácil!\n\n` +
    `Use meu cupom *${normalizePartnerReferralCodeInput(code)}* no plano Diamante e comece a agendar online com a ${shop}.\n\n` +
    `Acesse: ${link}`
  );
}

function isMissingPartnerReferralTableError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  return (
    code === '42P01' ||
    msg.includes('partner_referral_codes') &&
      (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache'))
  );
}

export async function fetchPartnerReferralCodeForEstablishment(
  establishmentId: string
): Promise<PartnerReferralCodeRow | null> {
  const id = String(establishmentId || '').trim();
  if (!id) return null;

  try {
    const { data, error } = await supabase
      .from('partner_referral_codes')
      .select('id, establishment_id, code, is_active, created_at, updated_at')
      .eq('establishment_id', id)
      .maybeSingle();

    if (error) {
      if (isMissingPartnerReferralTableError(error)) return null;
      throw error;
    }

    if (!data?.id) return null;
    return {
      id: String(data.id),
      establishment_id: String(data.establishment_id),
      code: String(data.code || ''),
      is_active: Boolean(data.is_active),
      created_at: data.created_at ? String(data.created_at) : undefined,
      updated_at: data.updated_at ? String(data.updated_at) : undefined,
    };
  } catch (error) {
    if (isMissingPartnerReferralTableError(error)) return null;
    console.warn('Indique e Ganhe: falha ao carregar cupom:', error);
    return null;
  }
}

export type CreatePartnerReferralCodeResult =
  | { ok: true; row: PartnerReferralCodeRow }
  | { ok: false; reason: 'invalid' | 'duplicate' | 'already_has_code' | 'missing_table' | 'unknown'; message: string };

export async function createPartnerReferralCode(params: {
  establishmentId: string;
  rawCode: string;
}): Promise<CreatePartnerReferralCodeResult> {
  const establishmentId = String(params.establishmentId || '').trim();
  const code = normalizePartnerReferralCodeInput(params.rawCode);

  if (!establishmentId) {
    return { ok: false, reason: 'unknown', message: 'Estabelecimento não encontrado.' };
  }

  if (!isPartnerReferralCodeValid(code)) {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Use entre 3 e 20 caracteres, apenas letras e números.',
    };
  }

  const existing = await fetchPartnerReferralCodeForEstablishment(establishmentId);
  if (existing?.code) {
    return {
      ok: false,
      reason: 'already_has_code',
      message: 'Você já possui um cupom cadastrado.',
    };
  }

  try {
    const { data, error } = await supabase
      .from('partner_referral_codes')
      .insert({
        establishment_id: establishmentId,
        code,
        is_active: true,
      })
      .select('id, establishment_id, code, is_active, created_at, updated_at')
      .single();

    if (error) {
      if (isMissingPartnerReferralTableError(error)) {
        return {
          ok: false,
          reason: 'missing_table',
          message: 'Tabela partner_referral_codes ainda não existe. Execute a migration no Supabase SQL Editor.',
        };
      }

      const msg = String(error.message || '').toLowerCase();
      const isDuplicate =
        error.code === '23505' ||
        msg.includes('duplicate') ||
        msg.includes('partner_referral_codes_code_lower_unique') ||
        msg.includes('partner_referral_codes_establishment_unique');

      if (isDuplicate) {
        if (msg.includes('establishment')) {
          return {
            ok: false,
            reason: 'already_has_code',
            message: 'Você já possui um cupom cadastrado.',
          };
        }
        return {
          ok: false,
          reason: 'duplicate',
          message: 'Esse cupom já está sendo usado. Escolha outro nome.',
        };
      }

      return {
        ok: false,
        reason: 'unknown',
        message: [error.message, error.details, error.hint].filter(Boolean).join(' — ') || 'Erro ao salvar cupom.',
      };
    }

    return {
      ok: true,
      row: {
        id: String(data.id),
        establishment_id: String(data.establishment_id),
        code: String(data.code),
        is_active: Boolean(data.is_active),
        created_at: data.created_at ? String(data.created_at) : undefined,
        updated_at: data.updated_at ? String(data.updated_at) : undefined,
      },
    };
  } catch (error: any) {
    if (isMissingPartnerReferralTableError(error)) {
      return {
        ok: false,
        reason: 'missing_table',
        message: 'Tabela partner_referral_codes ainda não existe. Execute a migration no Supabase SQL Editor.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: error?.message || 'Erro inesperado ao salvar cupom.',
    };
  }
}
