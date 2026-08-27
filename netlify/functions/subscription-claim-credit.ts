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


/**
 * Pagamento avulso NÃO pode rebaixar quem já tem recorrência.
 *
 * O assinante é localizado pelo TELEFONE e a linha é reescrita por inteiro. Quando
 * alguém com renovação automática ativa pagava avulso, o provider caía para
 * 'mercadopago_card' e o sistema perdia o rastro da recorrência: parava de renovar
 * sozinho, o cliente voltava para a lista de "ativação pendente" e o barbeiro
 * tendia a mandar OUTRO link — criando uma segunda recorrência e cobrando o
 * cliente duas vezes por mês.
 *
 * O pagamento continua sendo registrado normalmente (status, datas, método);
 * só o vínculo da recorrência é preservado.
 */
const preserveRecurringProvider = (existingRow: any, payload: any): void => {
  const current = String(existingRow?.subscription_payment_provider || '').toLowerCase().trim();
  const isRecurring = current === 'mercadopago_card_recurring' || current === 'mercadopago_card_recurring_pending';
  if (!isRecurring) return;
  const incoming = String(payload?.subscription_payment_provider || '').toLowerCase();
  if (incoming.includes('recurring')) return;
  delete payload.subscription_payment_provider;
};
const findExistingSubscriberByPhone = async (
  supabaseAdmin: any,
  establishmentId: string,
  subscriptionId: string,
  customerWhatsapp: string
) => {
  const estId = String(establishmentId || '').trim();
  const subId = String(subscriptionId || '').trim();
  const phone = String(customerWhatsapp || '').trim();
  if (!estId || !subId || !phone) return { data: null, error: null };

  const attempts: Array<{ column: 'subscriber_whatsapp' | 'client_whatsapp'; sameSubscriptionFirst: boolean }> = [
    { column: 'subscriber_whatsapp', sameSubscriptionFirst: true },
    { column: 'subscriber_whatsapp', sameSubscriptionFirst: false },
    { column: 'client_whatsapp', sameSubscriptionFirst: true },
    { column: 'client_whatsapp', sameSubscriptionFirst: false },
  ];

  let lastError: any = null;

  for (const attempt of attempts) {
    let query = supabaseAdmin
      .from('client_subscriptions')
      .select('id, subscription_id, created_at, subscription_payment_provider')
      .eq('establishment_id', estId)
      // @ts-expect-error colunas legadas podem não existir no tipo
      .eq(attempt.column, phone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (attempt.sameSubscriptionFirst) {
      query = query.eq('subscription_id', subId);
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data?.id) {
      return { data, error: null };
    }
    if (error) {
      lastError = error;
    }
  }

  return { data: null, error: lastError };
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
    const { establishmentId, subscriptionId, customer, providerKey } = body || {};

    const customerName = String(customer?.name || '').trim();
    const customerWhatsapp = onlyDigits(String(customer?.whatsapp || customer?.phone || ''));
    const customerEmail = String(customer?.email || '').trim() || null;

    if (!establishmentId || !subscriptionId || !customerName || !customerWhatsapp) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Dados incompletos',
          required: ['establishmentId', 'subscriptionId', 'customer.name', 'customer.whatsapp'],
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

    // Se já existir, atualizar
    const { data: existing, error: existingErr } = await findExistingSubscriberByPhone(
      supabaseAdmin,
      String(establishmentId),
      String(subscriptionId),
      customerWhatsapp
    );
    if (existingErr) {
      console.warn('⚠️ Não foi possível checar assinatura existente (credit):', existingErr);
    }

    const provider = String(providerKey || 'credit_link').trim() || 'credit_link';
    const subscriberPaymentMethod =
      String(provider).toLowerCase() === 'credit_link'
        ? 'credito'
        : getSubscriberPaymentMethodFromProvider(provider);
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
      subscription_payment_provider: provider,
      subscription_payment_order_id: `credit_${Date.now()}_${uuidv4()}`,
    };

    preserveRecurringProvider(existing, payload);

    let resultRow: any = null;
    if (existing?.id) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('client_subscriptions')
        .update(payload)
        .eq('id', String(existing.id))
        .select()
        .single();
      if (updErr) return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao atualizar assinatura (crédito)', details: updErr }) };
      resultRow = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('client_subscriptions')
        .insert([{ client_id: uuidv4(), ...payload }])
        .select()
        .single();
      if (insErr) return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao criar assinatura (crédito)', details: insErr }) };
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
        error: error?.message || 'Erro ao registrar assinatura via crédito',
        details: error?.details || error?.hint || error?.code || undefined,
      }),
    };
  }
};

