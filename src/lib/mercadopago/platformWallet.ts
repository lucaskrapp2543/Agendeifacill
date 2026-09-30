import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Carteira de pagamentos recebidos pela CONTA DA PLATAFORMA (Agendei Fácil).
 *
 * Quando o estabelecimento não tem Mercado Pago conectado, o pagamento online do
 * cliente é criado com o token da plataforma e cai na nossa conta. Cada pagamento
 * aprovado vira uma linha em `platform_collected_payments` com:
 *   bruto - taxa do Mercado Pago - taxa de serviço (R$ 1,00) = líquido do estabelecimento.
 * O saldo e os saques ficam por conta das funções SQL da migration
 * 20260929_carteira_pagamentos_plataforma.sql.
 *
 * Só código de servidor (service_role) chama isto. Idempotente por mp_payment_id.
 */

export const PLATFORM_COLLECTOR_METADATA_KEY = 'collector';
export const PLATFORM_COLLECTOR_VALUE = 'platform';

/**
 * Token da conta do Agendei Fácil no Mercado Pago — o MESMO das mensalidades
 * (MERCADOPAGO_ACCESS_TOKEN, já configurado no Netlify). MP_ACCESS_TOKEN é só
 * um apelido de reserva.
 */
export function getPlatformMercadoPagoAccessToken(): string {
  return String(process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || '').trim();
}

/**
 * user_id da conta do Agendei Fácil no Mercado Pago (GET /users/me com o token da
 * plataforma). Serve para reconhecer um estabelecimento que conectou a PRÓPRIA conta
 * da plataforma: nesse caso o MP recusa application_fee ("You cannot use application_fee
 * with this payment") e o pagamento tem que ser tratado como cobrança pela plataforma.
 * Cache em memória por 6h (uma chamada por cold start).
 */
let cachedPlatformUserId: { id: string; at: number } | null = null;
export async function getPlatformMercadoPagoUserId(): Promise<string> {
  const token = getPlatformMercadoPagoAccessToken();
  if (!token) return '';
  if (cachedPlatformUserId && Date.now() - cachedPlatformUserId.at < 6 * 60 * 60 * 1000) return cachedPlatformUserId.id;
  try {
    const base = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').replace(/\/+$/, '');
    const res = await fetch(base + '/users/me', { headers: { Authorization: 'Bearer ' + token } });
    const body: any = await res.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (id) cachedPlatformUserId = { id, at: Date.now() };
    return id;
  } catch (err: any) {
    console.warn('⚠️ [Carteira] Não consegui ler o user_id da conta da plataforma:', err?.message || err);
    return cachedPlatformUserId?.id || '';
  }
}

/** Taxa de serviço descontada do estabelecimento em cada pagamento pela plataforma (centavos). */
export function getPlatformWalletFeeCents(): number {
  const raw = Number(String(process.env.PLATFORM_WALLET_FEE_CENTS || '100').trim());
  return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : 100;
}

export function isPlatformCollectedPayment(payment: any): boolean {
  const meta = payment?.metadata || {};
  return String(meta?.[PLATFORM_COLLECTOR_METADATA_KEY] || '').toLowerCase().trim() === PLATFORM_COLLECTOR_VALUE;
}

/** Taxa cobrada pelo Mercado Pago neste pagamento, em centavos (lida do próprio pagamento). */
export function extractMercadoPagoFeeCents(payment: any): number {
  const gross = Math.round(Number(payment?.transaction_amount || 0) * 100);
  const fees = Array.isArray(payment?.fee_details) ? payment.fee_details : [];
  const mpFee = fees
    .filter((f: any) => String(f?.type || '').toLowerCase().includes('mercadopago_fee'))
    .reduce((sum: number, f: any) => sum + Math.round(Number(f?.amount || 0) * 100), 0);
  if (mpFee > 0) return mpFee;
  const net = Number(payment?.transaction_details?.net_received_amount);
  if (Number.isFinite(net) && net > 0 && gross > 0) {
    const diff = gross - Math.round(net * 100);
    return diff > 0 ? diff : 0;
  }
  return 0;
}

const isMissingTableError = (error: any) => {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('platform_collected_payments') || msg.includes('relation') || msg.includes('does not exist') || msg.includes('schema cache');
};

/**
 * Grava (uma vez) o pagamento aprovado na carteira do estabelecimento.
 * Nunca lança: falha aqui não pode derrubar a confirmação do agendamento.
 */
export async function recordPlatformCollectedPayment(
  admin: SupabaseClient | any,
  input: { establishmentId: string; appointmentId?: string | null; payment: any }
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  try {
    const establishmentId = String(input.establishmentId || '').trim();
    const payment = input.payment || {};
    const mpPaymentId = String(payment?.id || '').trim();
    if (!admin || !establishmentId || !mpPaymentId) return { ok: false, skipped: true, reason: 'missing_fields' };

    const status = String(payment?.status || '').toLowerCase();
    if (status !== 'approved' && status !== 'authorized') return { ok: false, skipped: true, reason: 'not_approved' };

    const gross = Math.round(Number(payment?.transaction_amount || 0) * 100);
    if (!Number.isFinite(gross) || gross <= 0) return { ok: false, skipped: true, reason: 'zero_amount' };

    const mpFee = extractMercadoPagoFeeCents(payment);
    const platformFee = getPlatformWalletFeeCents();
    const net = Math.max(0, gross - mpFee - platformFee);

    const methodId = String(payment?.payment_method_id || '').toLowerCase();
    const paymentMethod = methodId === 'pix' ? 'pix' : methodId === 'debit_card' ? 'debito' : methodId ? 'credito' : null;
    let payerName = [payment?.payer?.first_name, payment?.payer?.last_name].filter(Boolean).join(' ').trim() || null;
    // PIX quase nunca traz o nome do pagador: usa o nome do cliente do agendamento.
    if (!payerName && input.appointmentId) {
      try {
        const { data: apt } = await admin
          .from('appointments')
          .select('client_name')
          .eq('id', String(input.appointmentId))
          .maybeSingle();
        payerName = String((apt as any)?.client_name || '').trim() || null;
      } catch {
        // sem nome, segue com "Cliente"
      }
    }

    const row = {
      establishment_id: establishmentId,
      appointment_id: input.appointmentId ? String(input.appointmentId) : null,
      mp_payment_id: mpPaymentId,
      gross_cents: gross,
      mp_fee_cents: mpFee,
      platform_fee_cents: platformFee,
      net_cents: net,
      payment_method: paymentMethod,
      payer_name: payerName,
      status: 'approved',
    };

    const { error } = await admin
      .from('platform_collected_payments')
      .upsert(row, { onConflict: 'mp_payment_id', ignoreDuplicates: true });

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('⚠️ [Carteira] Tabela platform_collected_payments ainda não existe. Rode a migration 20260929_carteira_pagamentos_plataforma.sql.');
        return { ok: false, skipped: true, reason: 'missing_table' };
      }
      console.error('❌ [Carteira] Erro ao gravar pagamento na carteira:', error);
      return { ok: false, reason: String(error?.message || 'erro') };
    }

    console.log('💰 [Carteira] Pagamento creditado ao estabelecimento', { establishmentId, mpPaymentId, gross, mpFee, platformFee, net });
    return { ok: true };
  } catch (err: any) {
    console.error('❌ [Carteira] Falha inesperada ao creditar carteira:', err?.message || err);
    return { ok: false, reason: 'unexpected' };
  }
}

/** Estorno/chargeback: tira o pagamento do saldo (não apaga a linha, marca o status). */
export async function markPlatformCollectedPaymentRefunded(admin: SupabaseClient | any, mpPaymentId: string, kind: 'refunded' | 'chargeback' = 'refunded'): Promise<void> {
  try {
    if (!admin || !mpPaymentId) return;
    await admin
      .from('platform_collected_payments')
      .update({ status: kind, refunded_at: new Date().toISOString() })
      .eq('mp_payment_id', String(mpPaymentId));
  } catch (err: any) {
    console.warn('⚠️ [Carteira] Falha ao marcar estorno:', err?.message || err);
  }
}
