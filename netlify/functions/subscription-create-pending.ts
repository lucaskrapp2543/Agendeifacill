import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

const getSubscriberPaymentMethodFromProvider = (providerRaw: unknown): string | null => {
  const provider = String(providerRaw || '').toLowerCase().trim();
  if (!provider) return null;
  if (provider.includes('pix')) return 'pix';
  if (provider.includes('debit') || provider.includes('debito')) return 'debito';
  if (provider.includes('credit') || provider.includes('card') || provider.includes('credito')) return 'credito';
  if (provider.includes('dinheiro')) return 'dinheiro';
  return null;
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Supabase admin não configurado',
          details: { hasUrl: Boolean(SUPABASE_URL), hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY) },
        }),
      };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = event.body ? JSON.parse(event.body) : {};
    const { orderId, establishmentId, subscriptionId, customer, provider } = body || {};

    const customerName = String(customer?.name || '').trim();
    const customerWhatsapp = onlyDigits(String(customer?.whatsapp || customer?.phone || ''));
    const customerEmail = String(customer?.email || '').trim() || null;

    if (!orderId || !establishmentId || !subscriptionId || !customerName || !customerWhatsapp) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Dados incompletos',
          required: ['orderId', 'establishmentId', 'subscriptionId', 'customer.name', 'customer.whatsapp'],
        }),
      };
    }

    // Buscar duração da assinatura
    const { data: subData, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('duration_months')
      .eq('id', String(subscriptionId))
      .single();
    if (subErr) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao buscar assinatura', details: subErr }) };
    }

    const durationMonths = Number((subData as any)?.duration_months || 1);
    const today = new Date();
    const startDate = toISODate(today);
    const endDate = toISODate(addMonths(today, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

    // Se já existir, atualizar (para garantir que apareça no painel do barbeiro mesmo antes do pagamento)
    const { data: existing } = await supabaseAdmin
      .from('client_subscriptions')
      .select('id')
      .eq('establishment_id', String(establishmentId))
      .eq('subscription_id', String(subscriptionId))
      // @ts-expect-error coluna existe no banco
      .eq('subscriber_whatsapp', customerWhatsapp)
      .limit(1)
      .maybeSingle();

    const providerFinal = String(provider || 'pagarme_pix').toLowerCase().trim() || 'pagarme_pix';
    const subscriberPaymentMethod = getSubscriberPaymentMethodFromProvider(providerFinal);

    const payload: any = {
      subscription_id: String(subscriptionId),
      establishment_id: String(establishmentId),
      start_date: startDate,
      end_date: endDate,
      payment_status: 'unpaid',
      last_payment_date: null,
      subscriber_name: customerName,
      subscriber_whatsapp: customerWhatsapp,
      subscriber_email: customerEmail,
      subscriber_payment_method: subscriberPaymentMethod,
      subscription_payment_provider: providerFinal,
      subscription_payment_order_id: String(orderId),
    };

    let resultRow: any = null;
    if (existing?.id) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('client_subscriptions')
        .update(payload)
        .eq('id', String(existing.id))
        .select()
        .single();
      if (updErr) return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao atualizar assinatura pendente', details: updErr }) };
      resultRow = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('client_subscriptions')
        .insert([{ client_id: uuidv4(), ...payload }])
        .select()
        .single();
      if (insErr) return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao criar assinatura pendente', details: insErr }) };
      resultRow = ins;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, status: 'unpaid', subscription: resultRow }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error?.message || 'Erro ao criar assinatura pendente',
        details: error?.details || error?.hint || error?.code || undefined,
      }),
    };
  }
};

