import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getQueryParam, json } from './_utils';
import { getPlatformMercadoPagoAccessToken } from '../../src/lib/mercadopago/platformWallet';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

type BillingRow = {
  id: string;
  establishment_id: string | null;
  payment_id: string | null;
  amount_cents: number | null;
  paid_at: string | null;
  updated_at: string | null;
  payment_provider: string | null;
  metadata: Record<string, any> | null;
};

/**
 * Líquido EXATO que caiu na conta da plataforma (transaction_details.net_received_amount
 * do Mercado Pago). Pagamentos novos já chegam com isso gravado pelo webhook; para os
 * antigos, esta função busca no MP (poucos por vez, com limite de tempo) e grava no
 * `metadata` da linha — só uma vez por pagamento.
 */
const extractNetFromMpPayment = (payment: any): { net: number | null; fee: number | null; gross: number | null } => {
  const net = Number(payment?.transaction_details?.net_received_amount);
  const gross = Number(payment?.transaction_amount);
  const fee = Array.isArray(payment?.fee_details)
    ? payment.fee_details.reduce((sum: number, f: any) => sum + (Number(f?.amount) || 0), 0)
    : null;
  return {
    net: Number.isFinite(net) && net > 0 ? Math.round(net * 100) / 100 : null,
    fee: fee !== null && Number.isFinite(fee) ? Math.round(fee * 100) / 100 : null,
    gross: Number.isFinite(gross) && gross > 0 ? Math.round(gross * 100) / 100 : null,
  };
};

async function fetchNetFromMercadoPago(paymentId: string, token: string): Promise<{ net: number | null; fee: number | null; gross: number | null } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return extractNetFromMpPayment(await res.json());
  } catch {
    return null;
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, { error: 'Supabase admin nao configurado' });
    }

    const rawDays = Number(getQueryParam(event, 'days') || '10');
    const days = Number.isFinite(rawDays) ? Math.min(30, Math.max(1, Math.floor(rawDays))) : 10;
    const nowTs = Date.now();
    const startTs = nowTs - (days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('establishment_billing_payments')
      .select('id, establishment_id, payment_id, amount_cents, paid_at, updated_at, status, payment_provider, metadata')
      .eq('status', 'paid')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      return json(500, { error: 'Erro ao buscar pagamentos automaticos', details: String(error.message || error) });
    }

    // Último pagamento de cada barbearia dentro da janela
    const latestByEstablishment = new Map<string, BillingRow>();
    ((data || []) as BillingRow[]).forEach((row) => {
      const establishmentId = String(row?.establishment_id || '').trim();
      if (!establishmentId) return;
      const ts = new Date(String(row?.paid_at || row?.updated_at || '')).getTime();
      if (!Number.isFinite(ts) || ts < startTs || ts > nowTs) return;
      const current = latestByEstablishment.get(establishmentId);
      const currentTs = current ? new Date(String(current.paid_at || current.updated_at || '')).getTime() : NaN;
      if (!current || !Number.isFinite(currentTs) || ts > currentTs) {
        latestByEstablishment.set(establishmentId, row);
      }
    });

    // Líquido que ainda não está gravado: busca no MP (lotes de 8, no máximo ~6 s) e grava.
    const platformToken = getPlatformMercadoPagoAccessToken();
    const missing = Array.from(latestByEstablishment.values()).filter(
      (row) => row.payment_id && !(Number(row.metadata?.net_received_amount) > 0)
    );
    if (platformToken && missing.length > 0) {
      const deadline = Date.now() + 6000;
      for (let i = 0; i < missing.length && Date.now() < deadline; i += 8) {
        const batch = missing.slice(i, i + 8);
        const results = await Promise.all(batch.map((row) => fetchNetFromMercadoPago(String(row.payment_id), platformToken)));
        await Promise.all(
          batch.map(async (row, idx) => {
            const r = results[idx];
            if (!r || r.net === null) return;
            const merged = {
              ...(row.metadata || {}),
              net_received_amount: r.net,
              mp_fee_amount: r.fee,
              transaction_amount: r.gross,
            };
            row.metadata = merged;
            try {
              await supabaseAdmin.from('establishment_billing_payments').update({ metadata: merged } as any).eq('id', row.id);
            } catch {
              // best-effort: se não gravar agora, grava na próxima abertura
            }
          })
        );
      }
    }

    const items = Array.from(latestByEstablishment.values())
      .map((row) => {
        const net = Number(row.metadata?.net_received_amount);
        const fee = Number(row.metadata?.mp_fee_amount);
        return {
          establishment_id: String(row.establishment_id || ''),
          paid_at: row.paid_at ? String(row.paid_at) : null,
          updated_at: row.updated_at ? String(row.updated_at) : null,
          payment_provider: String(row.payment_provider || 'mercadopago'),
          payment_method: String(row.metadata?.payment_method || ''),
          amount_cents: Number.isFinite(Number(row.amount_cents)) ? Number(row.amount_cents) : null,
          net_received_amount: Number.isFinite(net) && net > 0 ? net : null,
          mp_fee_amount: Number.isFinite(fee) && fee >= 0 ? fee : null,
        };
      })
      .sort((a, b) => {
        const ta = new Date(String(a.paid_at || a.updated_at || '')).getTime();
        const tb = new Date(String(b.paid_at || b.updated_at || '')).getTime();
        return tb - ta;
      });

    return json(200, { days, count: items.length, items });
  } catch (err: any) {
    return json(500, { error: 'Erro inesperado', details: String(err?.message || err) });
  }
};
