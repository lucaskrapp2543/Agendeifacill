import axios from 'axios';
import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createMPPayment } from '../../src/lib/mercadopago/mp-service';
import { convertSiteRegistrationCheckoutIfPaid } from '../../src/lib/siteRegistrationCheckoutConversion';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PLATFORM_MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

type SitePlan = 'prata' | 'diamante';
type CheckoutMethod = 'pix' | 'recurring_card';

const PLAN_CONFIG: Record<SitePlan, { label: string; amountCents: number }> = {
  prata: { label: 'PRATA', amountCents: 3790 },
  diamante: { label: 'DIAMANTE', amountCents: 5790 },
};

const normalizePlan = (raw: unknown): SitePlan | null => {
  const value = String(raw || '').toLowerCase().trim();
  if (value === 'prata' || value === 'diamante') return value;
  return null;
};

const normalizeMethod = (raw: unknown): CheckoutMethod | null => {
  const value = String(raw || '').toLowerCase().trim();
  if (value === 'pix' || value === 'recurring_card') return value;
  return null;
};

const requiredString = (value: unknown) => String(value || '').trim();

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) return json(500, { error: 'Supabase admin nao configurado' });
    if (!PLATFORM_MP_ACCESS_TOKEN) return json(500, { error: 'MERCADOPAGO_ACCESS_TOKEN nao configurado' });

    const body = parseJsonBody<any>(event) || {};
    const plan = normalizePlan(body?.plan);
    const method = normalizeMethod(body?.method);
    const registration = body?.registration || {};

    if (!plan || !method) {
      return json(400, { error: 'Plano ou forma de pagamento invalida.' });
    }

    const clientName = requiredString(registration?.client_name || registration?.clientName);
    const establishmentName = requiredString(registration?.establishment_name || registration?.establishmentName);
    const email = requiredString(registration?.email).toLowerCase();
    const password = String(registration?.password || '');
    const clientWhatsapp = requiredString(registration?.client_whatsapp || registration?.whatsapp);
    const documentType = String(registration?.document_type || '').toUpperCase().trim() === 'CNPJ' ? 'CNPJ' : 'CPF';
    const documentNumber = requiredString(registration?.document_number).replace(/\D/g, '');
    const userAgent = requiredString(registration?.user_agent || event.headers['user-agent']);
    const ipAddress = requiredString(
      event.headers['x-forwarded-for']?.split(',')?.[0] ||
      event.headers['client-ip'] ||
      registration?.ip_address
    );

    if (!clientName || !establishmentName || !email || !password || !clientWhatsapp) {
      return json(400, { error: 'Preencha todos os dados do cadastro antes de pagar.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { error: 'E-mail invalido.' });
    }

    if (password.length < 6) {
      return json(400, { error: 'Senha deve ter pelo menos 6 caracteres.' });
    }

    if (method === 'recurring_card' && documentNumber.length !== 11 && documentNumber.length !== 14) {
      return json(400, { error: 'Para cartão, informe CPF ou CNPJ válido do titular.' });
    }

    const config = PLAN_CONFIG[plan];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: checkout, error: checkoutError } = await supabaseAdmin
      .from('site_registration_checkouts')
      .insert({
        client_name: clientName,
        establishment_name: establishmentName,
        email,
        password,
        client_whatsapp: clientWhatsapp,
        selected_plan: plan,
        amount_cents: config.amountCents,
        payment_method: method,
        payment_provider: 'mercadopago',
        status: 'pending',
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        expires_at: expiresAt,
        metadata: {
          source: 'site_registration',
          created_from: 'cadastroag',
          document_type: documentType,
          document_last4: documentNumber ? documentNumber.slice(-4) : null,
        },
        updated_at: nowIso,
      } as any)
      .select('*')
      .single();

    if (checkoutError || !checkout) {
      return json(500, {
        error: 'Erro ao iniciar checkout do cadastro.',
        details: checkoutError?.message,
      });
    }

    const checkoutId = String((checkout as any).id);
    const externalReference = `site_registration_checkout:${checkoutId}`;
    const description = `Plano ${config.label} Agendei Facil - ${establishmentName}`;

    if (method === 'pix') {
      const payment = await createMPPayment({
        amount: config.amountCents,
        description,
        access_token: PLATFORM_MP_ACCESS_TOKEN,
        payment_method_id: 'pix',
        payer: { email },
        external_reference: externalReference,
        metadata: {
          type: 'site_registration_checkout',
          checkout_id: checkoutId,
          selected_plan: plan,
          payment_method: 'pix',
        },
      });

      const paymentId = String((payment as any)?.id || '').trim();
      const pixData = (payment as any)?.point_of_interaction?.transaction_data || {};
      if (!paymentId) {
        return json(500, { error: 'Pagamento PIX criado sem ID.' });
      }

      await supabaseAdmin
        .from('site_registration_checkouts')
        .update({
          payment_id: paymentId,
          qr_code: String(pixData?.qr_code || '') || null,
          qr_code_base64: String(pixData?.qr_code_base64 || '') || null,
          metadata: {
            ...(checkout as any).metadata,
            external_reference: externalReference,
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', checkoutId);

      return json(200, {
        ok: true,
        checkout_id: checkoutId,
        plan,
        method,
        amount_cents: config.amountCents,
        amount_brl: config.amountCents / 100,
        payment_id: paymentId,
        status: String((payment as any)?.status || 'pending'),
        qr_code: String(pixData?.qr_code || ''),
        qr_code_base64: String(pixData?.qr_code_base64 || ''),
        expires_at: expiresAt,
      });
    }

    const cardTokenId = requiredString(body?.card_token_id || body?.token);
    const paymentMethodId = requiredString(body?.payment_method_id);
    const issuerId = requiredString(body?.issuer_id);
    const installments = Math.max(1, Number(body?.installments || 1));
    const cardBin = requiredString(body?.card_bin).slice(0, 6);
    const cardLastFourDigits = requiredString(body?.card_last_four_digits).slice(-4);

    if (cardTokenId) {
      const backUrlCandidate = requiredString(body?.backUrl) || SUBSCRIPTION_BACK_URL || 'https://agendeifacil.com.br/cadastroag';
      const baseBackUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : 'https://agendeifacil.com.br/cadastroag';
      const returnUrl = new URL(baseBackUrl);
      returnUrl.searchParams.set('site_checkout_id', checkoutId);
      returnUrl.searchParams.set('site_payment', 'return');

      const preapprovalPayload = {
        reason: description,
        payer_email: email,
        card_token_id: cardTokenId,
        external_reference: externalReference,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: config.amountCents / 100,
          currency_id: 'BRL',
        },
        back_url: returnUrl.toString(),
        status: 'authorized',
      };

      const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
        headers: {
          Authorization: `Bearer ${PLATFORM_MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `site_reg_card_${checkoutId}`,
        },
      });

      const preapproval = response.data || {};
      const preapprovalId = String(preapproval?.id || '').trim();
      if (!preapprovalId) {
        return json(500, { error: 'Mercado Pago nao retornou ID da assinatura.' });
      }

      await supabaseAdmin
        .from('site_registration_checkouts')
        .update({
          preapproval_id: preapprovalId,
          checkout_url: null,
          metadata: {
            ...(checkout as any).metadata,
            external_reference: externalReference,
            document_type: documentType,
            document_last4: documentNumber.slice(-4),
            payment_method_id: paymentMethodId || null,
            issuer_id: issuerId || null,
            installments,
            card_bin: cardBin || null,
            card_last_four_digits: cardLastFourDigits || null,
            checkout_mode: 'transparent_card_subscription',
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', checkoutId);

      const conversion = await convertSiteRegistrationCheckoutIfPaid(supabaseAdmin, checkoutId, {
        status: String(preapproval?.status || ''),
        preapprovalId,
        paymentMethod: 'recurring_card',
      });

      return json(200, {
        ok: true,
        checkout_id: checkoutId,
        plan,
        method,
        amount_cents: config.amountCents,
        amount_brl: config.amountCents / 100,
        preapproval_id: preapprovalId,
        status: String(preapproval?.status || 'pending'),
        conversion,
        expires_at: expiresAt,
      });
    }

    const backUrlCandidate = requiredString(body?.backUrl) || SUBSCRIPTION_BACK_URL;
    const baseBackUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;
    if (!baseBackUrl) {
      return json(400, {
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com uma URL HTTPS publica.',
      });
    }

    const returnUrl = new URL(baseBackUrl);
    returnUrl.searchParams.set('site_checkout_id', checkoutId);
    returnUrl.searchParams.set('site_payment', 'return');

    const preapprovalPayload = {
      reason: description,
      payer_email: email,
      external_reference: externalReference,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: config.amountCents / 100,
        currency_id: 'BRL',
      },
      back_url: returnUrl.toString(),
      status: 'pending',
    };

    const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
      headers: {
        Authorization: `Bearer ${PLATFORM_MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `site_reg_${checkoutId}`,
      },
    });

    const preapproval = response.data || {};
    const preapprovalId = String(preapproval?.id || '').trim();
    const initPoint = String(preapproval?.init_point || preapproval?.sandbox_init_point || '').trim();
    if (!preapprovalId || !initPoint) {
      return json(500, { error: 'Mercado Pago nao retornou link da assinatura.' });
    }

    await supabaseAdmin
      .from('site_registration_checkouts')
      .update({
        preapproval_id: preapprovalId,
        checkout_url: initPoint,
        metadata: {
          ...(checkout as any).metadata,
          external_reference: externalReference,
        },
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', checkoutId);

    return json(200, {
      ok: true,
      checkout_id: checkoutId,
      plan,
      method,
      amount_cents: config.amountCents,
      amount_brl: config.amountCents / 100,
      preapproval_id: preapprovalId,
      init_point: initPoint,
      status: String(preapproval?.status || 'pending'),
      expires_at: expiresAt,
    });
  } catch (error: any) {
    const message =
      String(error?.response?.data?.message || '') ||
      String(error?.response?.data?.error || '') ||
      String(error?.message || 'Erro ao criar checkout do cadastro.');
    return json(500, { error: message });
  }
};
