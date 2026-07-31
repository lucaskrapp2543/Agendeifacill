import { supabase } from '../lib/supabase';

/**
 * Cupom de desconto no booking — fonte única para as três telas de agendamento
 * (formulário clássico, chat guiado e /af), para nenhuma calcular diferente.
 *
 * Regras (iguais às já usadas em AppointmentForm.tsx):
 * - validação pela RPC `validate_discount_coupon` (não expõe a lista de cupons)
 * - desconto em % sobre o valor do SERVIÇO (produtos do booking entram depois, sem desconto)
 * - assinante não usa cupom (não paga o serviço)
 * - o preço gravado já vai com desconto, então pagamento online, comissão e
 *   financeiro herdam o valor correto sem lógica extra
 */

export type AppliedCoupon = { code: string; percent: number };

export const normalizeCouponCode = (raw: unknown): string =>
  String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export type ValidateCouponResult =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; message: string };

/** Consulta o cupom no banco. Retorna mensagem pronta para o toast quando inválido. */
export async function validateDiscountCoupon(
  establishmentId: string,
  rawCode: string
): Promise<ValidateCouponResult> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return { ok: false, message: 'Digite um cupom.' };
  if (!String(establishmentId || '').trim()) {
    return { ok: false, message: 'Estabelecimento não identificado.' };
  }

  try {
    const { data, error } = await supabase.rpc('validate_discount_coupon', {
      p_establishment_id: establishmentId,
      p_code: code,
    });

    if (error) {
      console.error('❌ Erro ao validar cupom:', error);
      return { ok: false, message: error.message || 'Erro ao validar cupom.' };
    }

    const row: any = Array.isArray(data) ? data[0] : data;
    const percent = Number(row?.discount_percent ?? 0);
    if (!row?.valid || !Number.isFinite(percent) || percent <= 0) {
      return { ok: false, message: 'Cupom inválido ou inativo.' };
    }

    return { ok: true, coupon: { code, percent } };
  } catch (e: any) {
    console.error('❌ Erro inesperado ao validar cupom:', e);
    return { ok: false, message: e?.message || 'Erro ao validar cupom.' };
  }
}

/** Desconto e preço final do serviço. Sem cupom devolve o preço original intacto. */
export function computeCouponDiscount(
  basePrice: number,
  coupon: AppliedCoupon | null
): { discountAmount: number; finalPrice: number } {
  const base = Number(basePrice) || 0;
  const percent = coupon ? Number(coupon.percent) || 0 : 0;
  if (!coupon || percent <= 0 || base <= 0) {
    return { discountAmount: 0, finalPrice: round2(Math.max(0, base)) };
  }
  const discountAmount = round2((base * percent) / 100);
  return {
    discountAmount,
    finalPrice: round2(Math.max(0, base - discountAmount)),
  };
}

/**
 * Campos de auditoria do cupom no agendamento (mesmos nomes gravados pelo
 * formulário clássico). Sem cupom, todos vão nulos — nada muda no registro.
 */
export function buildCouponPayloadFields(
  basePrice: number,
  coupon: AppliedCoupon | null
): {
  price_original: number | null;
  coupon_code: string | null;
  coupon_discount_percent: number | null;
  coupon_discount_amount: number | null;
} {
  if (!coupon) {
    return {
      price_original: null,
      coupon_code: null,
      coupon_discount_percent: null,
      coupon_discount_amount: null,
    };
  }
  const { discountAmount } = computeCouponDiscount(basePrice, coupon);
  return {
    price_original: round2(Number(basePrice) || 0),
    coupon_code: coupon.code,
    coupon_discount_percent: Number(coupon.percent) || 0,
    coupon_discount_amount: discountAmount,
  };
}

/** Colunas de cupom podem não existir em bancos antigos — permite regravar sem elas. */
export function isMissingCouponColumnError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  if (!msg) return false;
  const mentionsCouponColumn =
    msg.includes('coupon_code') ||
    msg.includes('coupon_discount_percent') ||
    msg.includes('coupon_discount_amount') ||
    msg.includes('price_original');
  return mentionsCouponColumn && (msg.includes('column') || msg.includes('schema cache'));
}
