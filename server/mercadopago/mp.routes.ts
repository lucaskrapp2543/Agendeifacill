/**
 * Mercado Pago Routes - Rotas OAuth e pagamentos
 * 
 * Define as rotas para OAuth e criação de pagamentos do Mercado Pago
 */

import { createClient } from '@supabase/supabase-js';
import { Request, Response, Router } from 'express';
import axios from 'axios';
import { randomUUID } from 'crypto';
// Importar de src/lib para compatibilidade (também funciona em server local)
import { exchangeCodeForToken, getAuthorizationUrl } from '../../src/lib/mercadopago/mp-oauth';
import { recordAdminMpCommission } from '../../src/lib/mercadopago/adminMpCommission';
import { confirmPendingAppointmentFromMpPaymentMetadata } from '../../src/lib/mercadopago/confirmAppointmentFromMpPayment';
import { reconcilePendingMercadoPagoAppointments } from '../../src/lib/mercadopago/reconcilePendingAppointmentsMp';
import { checkMPPaymentStatus, createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';
import { convertSiteRegistrationCheckoutIfPaid } from '../../src/lib/siteRegistrationCheckoutConversion';
import {
  buildSiteRegistrationCheckoutPartnerColumns,
  getPartnerReferralRecurringStartDateIso,
  resolvePartnerReferralForSiteRegistrationCheckout,
  validatePartnerReferralForSiteRegistration,
} from '../../src/lib/partnerReferralCheckout';

const router = Router();

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');

// Função para obter Supabase Admin (carrega variáveis dinamicamente)
function getSupabaseAdmin() {
  const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ [MP Routes] Supabase admin não configurado:', {
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });
    return null;
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const normalizeSubscriptionPaymentStatus = (raw: unknown): 'paid' | 'pending' | 'failed' | 'cancelled' => {
  const status = String(raw || '').toLowerCase().trim();
  if (status === 'approved' || status === 'authorized' || status === 'paid') return 'paid';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'rejected' || status === 'refused' || status === 'failed') return 'failed';
  return 'pending';
};

const normalizeBillingStatus = (raw: unknown): 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' => {
  const status = String(raw || '').toLowerCase().trim();
  if (status === 'approved' || status === 'authorized') return 'paid';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  if (status === 'rejected' || status === 'refused' || status === 'failed') return 'failed';
  return 'pending';
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);
const toISODateTime = (d: Date): string => d.toISOString();
const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

const getNextDueDate = (planTypeRaw: unknown): string => {
  const planType = String(planTypeRaw || 'monthly').toLowerCase().trim();
  const today = new Date();
  if (planType === 'annual') return toISODate(addMonths(today, 12));
  if (planType === 'trial') return toISODate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
  return toISODate(addMonths(today, 1));
};

async function upsertPendingClientSubscription(
  supabaseAdmin: any,
  input: {
    establishmentId: string;
    subscriptionId: string;
    preapprovalId: string;
    customerName: string;
    customerWhatsapp: string;
    customerEmail: string | null;
    durationMonths: number;
  }
) {
  const phone = onlyDigits(input.customerWhatsapp);
  if (!supabaseAdmin || !input.establishmentId || !input.subscriptionId || !input.preapprovalId || !input.customerName || !phone) {
    throw new Error('Dados insuficientes para criar assinante pendente');
  }

  const today = new Date();
  const startDate = toISODate(today);
  const endDate = toISODate(addMonths(today, Number.isFinite(input.durationMonths) && input.durationMonths > 0 ? input.durationMonths : 1));

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('client_subscriptions')
    .select('id, payment_status, last_payment_date, start_date, end_date')
    .eq('establishment_id', input.establishmentId)
    .eq('subscription_id', input.subscriptionId)
    .eq('subscriber_whatsapp', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.warn('[MP subscription checkout local] Não foi possível procurar assinante pendente existente:', existingError);
  }

  const isAlreadyPaid = String((existing as any)?.payment_status || '').toLowerCase() === 'paid';
  const payload: any = {
    subscription_id: input.subscriptionId,
    establishment_id: input.establishmentId,
    start_date: isAlreadyPaid ? ((existing as any)?.start_date || startDate) : startDate,
    end_date: isAlreadyPaid ? ((existing as any)?.end_date || endDate) : endDate,
    payment_status: isAlreadyPaid ? 'paid' : 'unpaid',
    last_payment_date: isAlreadyPaid ? ((existing as any)?.last_payment_date || startDate) : null,
    subscriber_name: input.customerName,
    subscriber_whatsapp: phone,
    subscriber_email: input.customerEmail,
    subscriber_payment_method: 'credito',
    subscription_payment_provider: 'mercadopago_card_recurring',
    subscription_payment_order_id: input.preapprovalId,
    // Vínculo da recorrência em coluna própria — pagamento avulso reescreve a
    // linha inteira pelo telefone e apagava o preapproval daqui.
    recurring_preapproval_id: input.preapprovalId,
  };

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('client_subscriptions')
      .update(payload)
      .eq('id', String(existing.id))
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('client_subscriptions')
    .insert([{ client_id: randomUUID(), ...payload }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

const SITE_PLAN_CONFIG = {
  prata: { label: 'PRATA', amountCents: 3790 },
  diamante: { label: 'DIAMANTE', amountCents: 6790 },
} as const;

router.post('/validate-partner-referral-code', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin nao configurado' });

    const planKey = String(req.body?.plan || 'diamante').toLowerCase().trim();
    const result = await validatePartnerReferralForSiteRegistration(supabaseAdmin, {
      planKey,
      rawCode: req.body?.code,
      registrationEmail: req.body?.email,
      baseAmountCents: SITE_PLAN_CONFIG.diamante.amountCents,
    });

    if (!result.ok) {
      return res.json({
        ok: false,
        valid: false,
        message: result.message,
        reason: result.reason,
      });
    }

    return res.json({
      ok: true,
      valid: true,
      code: result.code,
      partner_name: result.partnerEstablishmentName,
      message: `Cupom válido: indicado por ${result.partnerEstablishmentName}`,
      pricing: {
        original_amount_cents: result.pricing.originalAmountCents,
        final_amount_cents: result.pricing.finalAmountCents,
        discount_percent: result.pricing.discountPercent,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: String(error?.message || 'Erro ao validar cupom') });
  }
});

router.post('/site-registration-create-checkout', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin nao configurado' });

    const accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
    if (!accessToken) return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN nao configurado' });

    const planKey = String(req.body?.plan || '').toLowerCase().trim() as keyof typeof SITE_PLAN_CONFIG;
    const method = String(req.body?.method || '').toLowerCase().trim();
    const registration = req.body?.registration || {};
    const plan = SITE_PLAN_CONFIG[planKey];

    if (!plan || !['pix', 'recurring_card'].includes(method)) {
      return res.status(400).json({ error: 'Plano ou forma de pagamento invalida.' });
    }

    const clientName = String(registration.client_name || '').trim();
    const establishmentName = String(registration.establishment_name || '').trim();
    const email = String(registration.email || '').trim().toLowerCase();
    const password = String(registration.password || '');
    const clientWhatsapp = String(registration.client_whatsapp || '').trim();
    const documentType = String(registration.document_type || '').toUpperCase().trim() === 'CNPJ' ? 'CNPJ' : 'CPF';
    const documentNumber = String(registration.document_number || '').replace(/\D/g, '');

    if (!clientName || !establishmentName || !email || !password || !clientWhatsapp) {
      return res.status(400).json({ error: 'Preencha todos os dados do cadastro antes de pagar.' });
    }

    if (method === 'recurring_card' && documentNumber.length !== 11 && documentNumber.length !== 14) {
      return res.status(400).json({ error: 'Para cartão, informe CPF ou CNPJ válido do titular.' });
    }

    const partnerResolution = await resolvePartnerReferralForSiteRegistrationCheckout(supabaseAdmin, {
      planKey,
      rawCode: req.body?.partner_referral_code,
      registrationEmail: email,
      baseAmountCents: plan.amountCents,
    });
    if (!partnerResolution.ok) {
      return res.status(400).json({ error: partnerResolution.message, reason: partnerResolution.reason });
    }
    const pricing = partnerResolution.pricing;
    const partnerColumns = buildSiteRegistrationCheckoutPartnerColumns(pricing);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: checkout, error: checkoutError } = await supabaseAdmin
      .from('site_registration_checkouts')
      .insert({
        client_name: clientName,
        establishment_name: establishmentName,
        email,
        password,
        client_whatsapp: clientWhatsapp,
        selected_plan: planKey,
        amount_cents: pricing.chargeAmountCents,
        ...partnerColumns,
        payment_method: method,
        payment_provider: 'mercadopago',
        status: 'pending',
        ip_address: req.ip || null,
        user_agent: String(req.headers['user-agent'] || registration.user_agent || ''),
        expires_at: expiresAt,
        metadata: {
          source: 'site_registration',
          created_from: 'cadastroag_local_api',
          document_type: documentType,
          document_last4: documentNumber ? documentNumber.slice(-4) : null,
        },
        updated_at: new Date().toISOString(),
      } as any)
      .select('*')
      .single();

    if (checkoutError || !checkout) {
      return res.status(500).json({ error: 'Erro ao iniciar checkout do cadastro.', details: checkoutError?.message });
    }

    const checkoutId = String((checkout as any).id);
    const externalReference = `site_registration_checkout:${checkoutId}`;
    const description = `Plano ${plan.label} Agendei Facil - ${establishmentName}`;

    if (method === 'pix') {
      const payment = await createMPPayment({
        amount: pricing.chargeAmountCents,
        description,
        access_token: accessToken,
        payment_method_id: 'pix',
        payer: { email },
        external_reference: externalReference,
        metadata: {
          type: 'site_registration_checkout',
          checkout_id: checkoutId,
          selected_plan: planKey,
          payment_method: 'pix',
        },
      } as any);

      const paymentId = String((payment as any)?.id || '');
      const pixData = (payment as any)?.point_of_interaction?.transaction_data || {};
      await supabaseAdmin
        .from('site_registration_checkouts')
        .update({
          payment_id: paymentId,
          qr_code: String(pixData?.qr_code || '') || null,
          qr_code_base64: String(pixData?.qr_code_base64 || '') || null,
          metadata: { ...(checkout as any).metadata, external_reference: externalReference },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', checkoutId);

      return res.json({
        ok: true,
        checkout_id: checkoutId,
        plan: planKey,
        method,
        amount_cents: pricing.chargeAmountCents,
        amount_brl: pricing.chargeAmountCents / 100,
        original_amount_cents: pricing.originalAmountCents,
        discount_percent: pricing.discountPercent,
        partner_referral_code: pricing.partnerReferralCode,
        payment_id: paymentId,
        status: String((payment as any)?.status || 'pending'),
        qr_code: String(pixData?.qr_code || ''),
        qr_code_base64: String(pixData?.qr_code_base64 || ''),
        expires_at: expiresAt,
      });
    }

    const cardTokenId = String(req.body?.card_token_id || req.body?.token || '').trim();
    const paymentMethodId = String(req.body?.payment_method_id || '').trim();
    const issuerId = String(req.body?.issuer_id || '').trim();
    const installments = Math.max(1, Number(req.body?.installments || 1));
    const cardBin = String(req.body?.card_bin || '').trim().slice(0, 6);
    const cardLastFourDigits = String(req.body?.card_last_four_digits || '').trim().slice(-4);

    if (cardTokenId) {
      const backUrlCandidate = String(req.body?.backUrl || process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || 'https://agendeifacil.com.br/cadastroag').trim();
      const baseBackUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : 'https://agendeifacil.com.br/cadastroag';
      const returnUrl = new URL(baseBackUrl);
      returnUrl.searchParams.set('site_checkout_id', checkoutId);
      returnUrl.searchParams.set('site_payment', 'return');

      const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
      const hasPartnerFirstMonthDiscount =
        Boolean(pricing.partnerReferralCode) && pricing.chargeAmountCents < pricing.recurringAmountCents;

      let firstPaymentId = '';
      let firstPaymentStatus = '';

      if (hasPartnerFirstMonthDiscount) {
        const firstPayment = await createMPPayment({
          amount: pricing.chargeAmountCents,
          description: `${description} - 1ª mensalidade com cupom`,
          access_token: accessToken,
          payment_method_id: paymentMethodId || 'credit_card',
          installments,
          token: cardTokenId,
          issuer_id: issuerId || undefined,
          payer: {
            email,
            identification:
              documentNumber.length === 11 || documentNumber.length === 14
                ? { type: documentType as 'CPF' | 'CNPJ', number: documentNumber }
                : undefined,
          },
          external_reference: `${externalReference}:first_month`,
          metadata: {
            type: 'site_registration_checkout_first_month',
            checkout_id: checkoutId,
            selected_plan: planKey,
            partner_referral_code: pricing.partnerReferralCode,
          },
        } as CreateMPPaymentRequest);

        firstPaymentId = String((firstPayment as any)?.id || '').trim();
        firstPaymentStatus = String((firstPayment as any)?.status || '').trim();
        if (!firstPaymentId) {
          return res.status(500).json({ error: 'Mercado Pago nao retornou ID do pagamento da primeira mensalidade.' });
        }
      }

      const autoRecurring: Record<string, unknown> = {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: pricing.recurringAmountCents / 100,
        currency_id: 'BRL',
      };
      if (hasPartnerFirstMonthDiscount) {
        autoRecurring.start_date = getPartnerReferralRecurringStartDateIso(1);
      }

      const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, {
        reason: description,
        payer_email: email,
        card_token_id: cardTokenId,
        external_reference: externalReference,
        auto_recurring: autoRecurring,
        back_url: returnUrl.toString(),
        status: 'authorized',
      }, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `site_reg_card_${checkoutId}`,
        },
      });

      const preapproval = response.data || {};
      const preapprovalId = String(preapproval?.id || '').trim();
      if (!preapprovalId) {
        return res.status(500).json({ error: 'Mercado Pago nao retornou ID da assinatura.' });
      }

      await supabaseAdmin
        .from('site_registration_checkouts')
        .update({
          payment_id: firstPaymentId || (checkout as any).payment_id || null,
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
            checkout_mode: hasPartnerFirstMonthDiscount
              ? 'transparent_card_subscription_partner_discount'
              : 'transparent_card_subscription',
            conversion_requires_subscription_payment: !hasPartnerFirstMonthDiscount,
            partner_first_payment_id: firstPaymentId || null,
            recurring_amount_cents: pricing.recurringAmountCents,
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', checkoutId);

      const conversion = await convertSiteRegistrationCheckoutIfPaid(supabaseAdmin, checkoutId, {
        status: hasPartnerFirstMonthDiscount
          ? firstPaymentStatus || String(preapproval?.status || '')
          : String(preapproval?.status || ''),
        paymentId: firstPaymentId || undefined,
        preapprovalId,
        paymentMethod: 'recurring_card',
      });

      return res.json({
        ok: true,
        checkout_id: checkoutId,
        plan: planKey,
        method,
        amount_cents: pricing.chargeAmountCents,
        amount_brl: pricing.chargeAmountCents / 100,
        original_amount_cents: pricing.originalAmountCents,
        discount_percent: pricing.discountPercent,
        partner_referral_code: pricing.partnerReferralCode,
        preapproval_id: preapprovalId,
        payment_id: firstPaymentId || null,
        status: hasPartnerFirstMonthDiscount
          ? firstPaymentStatus || String(preapproval?.status || 'pending')
          : String(preapproval?.status || 'pending'),
        recurrence_created: true,
        conversion,
        expires_at: expiresAt,
      });
    }

    if (method === 'recurring_card') {
      return res.status(400).json({ error: 'Token do cartão obrigatório para cobrar a primeira mensalidade.' });
    }

    const backUrlCandidate = String(req.body?.backUrl || process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();
    const baseBackUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : '';
    if (!baseBackUrl) {
      return res.status(400).json({
        error: 'back_url is required',
        userMessage: 'Em localhost, assinatura recorrente precisa de URL HTTPS publica. Use PIX localmente ou teste em producao.',
      });
    }

    const returnUrl = new URL(baseBackUrl);
    returnUrl.searchParams.set('site_checkout_id', checkoutId);
    returnUrl.searchParams.set('site_payment', 'return');

    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, {
      reason: description,
      payer_email: email,
      external_reference: externalReference,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: plan.amountCents / 100,
        currency_id: 'BRL',
      },
      back_url: returnUrl.toString(),
      status: 'pending',
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `site_reg_${checkoutId}`,
      },
    });

    const preapproval = response.data || {};
    await supabaseAdmin
      .from('site_registration_checkouts')
      .update({
        preapproval_id: String(preapproval?.id || ''),
        checkout_url: String(preapproval?.init_point || preapproval?.sandbox_init_point || ''),
        metadata: { ...(checkout as any).metadata, external_reference: externalReference },
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', checkoutId);

    return res.json({
      ok: true,
      checkout_id: checkoutId,
      plan: planKey,
      method,
      amount_cents: plan.amountCents,
      amount_brl: plan.amountCents / 100,
      preapproval_id: String(preapproval?.id || ''),
      init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || ''),
      status: String(preapproval?.status || 'pending'),
      expires_at: expiresAt,
    });
  } catch (error: any) {
    return res.status(500).json({ error: String(error?.response?.data?.message || error?.message || 'Erro ao criar checkout do cadastro') });
  }
});

router.get('/site-registration-checkout-status', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin nao configurado' });

    const checkoutId = String(req.query.checkout_id || '').trim();
    if (!checkoutId) return res.status(400).json({ error: 'checkout_id obrigatorio' });

    const { data, error } = await supabaseAdmin
      .from('site_registration_checkouts')
      .select('id,status,selected_plan,amount_cents,payment_method,payment_id,preapproval_id,created_establishment_id,converted_at,expires_at')
      .eq('id', checkoutId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'Erro ao consultar checkout', details: error.message });
    if (!data) return res.status(404).json({ error: 'Checkout nao encontrado' });

    let conversionResult: any = null;
    const accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
    const status = String((data as any).status || '').toLowerCase();
    const paymentId = String((data as any).payment_id || '').trim();
    const preapprovalId = String((data as any).preapproval_id || '').trim();

    if ((data as any).created_establishment_id) {
      const { data: fullCheckout } = await supabaseAdmin
        .from('site_registration_checkouts')
        .select('*')
        .eq('id', checkoutId)
        .maybeSingle();
      if (fullCheckout) {
        conversionResult = await convertSiteRegistrationCheckoutIfPaid(supabaseAdmin, checkoutId, {
          status: 'approved',
          paymentId: paymentId || (fullCheckout as any).payment_id || null,
          preapprovalId: preapprovalId || (fullCheckout as any).preapproval_id || null,
          paymentMethod: String((fullCheckout as any).payment_method || '') === 'recurring_card' ? 'recurring_card' : 'pix',
        });
      }
    } else if (status !== 'converted' && paymentId && accessToken) {
      const payment = await checkMPPaymentStatus(Number(paymentId), accessToken);
      conversionResult = await convertSiteRegistrationCheckoutIfPaid(supabaseAdmin, checkoutId, {
        status: (payment as any)?.status,
        paymentId,
        paymentMethod: String((data as any).payment_method || '') === 'recurring_card' ? 'recurring_card' : 'pix',
      });
    } else if (status !== 'converted' && preapprovalId && accessToken) {
      const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
      const preapprovalResp = await axios.get(
        `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(preapprovalId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const preapproval = preapprovalResp.data || {};
      conversionResult = await convertSiteRegistrationCheckoutIfPaid(supabaseAdmin, checkoutId, {
        status: preapproval?.status,
        preapprovalId,
        paymentMethod: 'recurring_card',
      });
    }

    const { data: refreshed } = await supabaseAdmin
      .from('site_registration_checkouts')
      .select('id,status,selected_plan,amount_cents,payment_method,payment_id,preapproval_id,created_establishment_id,converted_at,expires_at')
      .eq('id', checkoutId)
      .maybeSingle();

    return res.json({ ok: true, checkout: refreshed || data, conversion: conversionResult });
  } catch (error: any) {
    return res.status(500).json({ error: String(error?.message || 'Erro ao consultar checkout') });
  }
});

/**
 * GET /api/mercadopago/oauth/authorize
 * Inicia o fluxo OAuth do Mercado Pago
 * 
 * Query params:
 * - establishmentId: ID do estabelecimento
 */
router.get('/oauth/authorize', async (req: Request, res: Response) => {
  try {
    const establishmentId = req.query.establishmentId as string;

    if (!establishmentId) {
      return res.status(400).json({
        error: 'establishmentId é obrigatório',
      });
    }

    // Verificar se o estabelecimento existe
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('establishments')
        .select('id')
        .eq('id', establishmentId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          error: 'Estabelecimento não encontrado',
        });
      }
    }

    // Gerar URL de autorização
    const authUrl = getAuthorizationUrl(establishmentId);

    return res.status(200).json({
      authorization_url: authUrl,
      establishment_id: establishmentId,
    });
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro ao gerar URL de autorização:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao gerar URL de autorização',
    });
  }
});

/**
 * GET /api/mercadopago/oauth/callback
 * Callback OAuth do Mercado Pago
 * 
 * Query params:
 * - code: Código de autorização
 * - state: establishmentId (passado no início do fluxo)
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string; // establishmentId

    if (!code) {
      return res.status(400).json({
        error: 'Código de autorização não fornecido',
      });
    }

    if (!state) {
      return res.status(400).json({
        error: 'State (establishmentId) não fornecido',
      });
    }

    const establishmentId = state;

    console.log('🔄 [MP Routes] Processando callback OAuth:', {
      establishmentId,
      hasCode: !!code,
    });

    // Trocar código por token
    const tokenData = await exchangeCodeForToken(code);

    // Salvar tokens no banco de dados
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('establishments')
      .update({
        mercadopago_user_id: String(tokenData.user_id),
        mercadopago_access_token: tokenData.access_token,
        mercadopago_refresh_token: tokenData.refresh_token,
        mercadopago_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString(),
      })
      .eq('id', establishmentId);

    if (updateError) {
      console.error('❌ [MP Routes] Erro ao salvar tokens:', updateError);
      return res.status(500).json({
        error: 'Erro ao salvar tokens no banco de dados',
        details: updateError,
      });
    }

    console.log('✅ [MP Routes] Tokens salvos com sucesso:', {
      establishmentId,
      user_id: tokenData.user_id,
    });

    // Retornar sucesso (em produção, redirecionar para uma página de sucesso)
    return res.status(200).json({
      success: true,
      message: 'Conta do Mercado Pago conectada com sucesso',
      user_id: tokenData.user_id,
      establishment_id: establishmentId,
    });
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro no callback OAuth:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao processar callback OAuth',
    });
  }
});

/**
 * POST /api/mercadopago/create-payment
 * Cria um pagamento no Mercado Pago Marketplace
 * 
 * Body:
 * - establishmentId: ID do estabelecimento
 * - amount: Valor em centavos
 * - description: Descrição do pagamento
 * - payer: { email, identification?: { type, number } }
 * - payment_method_id: 'pix', 'credit_card', etc.
 * - metadata?: Dados adicionais
 */
router.post('/create-payment', async (req: Request, res: Response) => {
  try {
    const {
      establishmentId,
      amount,
      description,
      payer,
      payment_method_id,
      installments,
      token,
      metadata,
    } = req.body;

    // Validação
    if (!establishmentId || !amount || !description || !payer?.email) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'amount', 'description', 'payer.email'],
      });
    }

    // Buscar access_token do estabelecimento
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    const { data: establishment, error: fetchError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token, mercadopago_user_id')
      .eq('id', establishmentId)
      .single();

    if (fetchError || !establishment) {
      return res.status(404).json({
        error: 'Estabelecimento não encontrado',
      });
    }

    const accessToken = (establishment as any)?.mercadopago_access_token;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Estabelecimento não possui conta do Mercado Pago conectada',
        userMessage: 'Conecte a conta do Mercado Pago antes de criar pagamentos',
      });
    }

    // Taxa da plataforma (centavos) para Mercado Pago.
    // Regras:
    // - Cartão: prioriza MERCADOPAGO_CREDIT_PLATFORM_FEE_CENTS (fallback 100 = R$1,00)
    // - PIX: mantém MERCADOPAGO_PLATFORM_FEE_CENTS / PLATFORM_FEE_CENTS (fallback 50 = R$0,50)
    const normalizedMethod = String(payment_method_id || '').toLowerCase().trim();
    const isCardPayment = Boolean(token) || (normalizedMethod !== '' && normalizedMethod !== 'pix');
    const applicationFeeRaw = isCardPayment
      ? (
        process.env.MERCADOPAGO_CREDIT_PLATFORM_FEE_CENTS ||
        process.env.PLATFORM_CREDIT_FEE_CENTS ||
        '100'
      )
      : (
        process.env.MERCADOPAGO_PLATFORM_FEE_CENTS ||
        process.env.PLATFORM_FEE_CENTS ||
        '50'
      );
    const applicationFee = Number(String(applicationFeeRaw).trim());

    // Criar pagamento
    const paymentData: CreateMPPaymentRequest = {
      amount: Math.round(Number(amount)),
      description: String(description),
      payer: {
        email: String(payer.email),
        ...(payer.identification
          ? {
            identification: {
              type: payer.identification.type === 'CPF' ? 'CPF' : 'CNPJ',
              number: String(payer.identification.number),
            },
          }
          : {}),
        ...(payer.address ? { address: payer.address } : {}),
      },
      application_fee: applicationFee,
      access_token: String(accessToken),
      payment_method_id: payment_method_id || 'pix',
      ...(installments ? { installments: Number(installments) } : {}),
      ...(token ? { token: String(token) } : {}),
      ...(metadata ? { metadata } : {}),
    };

    const payment = await createMPPayment(paymentData);

    const returnedFee = Number((payment as any)?.application_fee ?? 0);
    const expectedFee = Number((paymentData.application_fee || 0) / 100);
    const feeIsValid = Number.isFinite(returnedFee) && Math.abs(returnedFee - expectedFee) < 0.0001;
    if (!feeIsValid) {
      console.warn('⚠️ [MP Routes] Taxa divergente detectada (sem bloquear pagamento):', {
        establishmentId,
        paymentId: (payment as any)?.id,
        expectedFee,
        returnedFee,
      });
    }

    console.log('✅ [MP Routes] Pagamento criado:', {
      paymentId: payment.id,
      status: payment.status,
      establishmentId,
    });

    return res.status(200).json({
      ...payment,
      fee_expected: expectedFee,
      fee_returned: returnedFee,
      fee_validation: feeIsValid ? 'ok' : 'divergent',
      fee_version: `R$${(applicationFee / 100).toFixed(2).replace('.', ',')}`,
      application_fee_cents_expected: applicationFee,
      fee_mode: isCardPayment ? 'credit_card' : 'pix',
    });
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro ao criar pagamento:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao criar pagamento',
    });
  }
});

/**
 * POST /api/mercadopago/create-establishment-billing
 * Cria PIX de regularizacao da barbearia (100% para a plataforma, sem split).
 */
router.post('/create-establishment-billing', async (req: Request, res: Response) => {
  try {
    const { establishmentId, description, payer } = req.body || {};
    if (!establishmentId) {
      return res.status(400).json({
        error: 'establishmentId é obrigatório',
      });
    }

    const platformAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
    if (!platformAccessToken) {
      return res.status(500).json({
        error: 'MERCADOPAGO_ACCESS_TOKEN não configurado',
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    let establishment: any = null;
    let amountCents = 0;

    const { data: estWithAmount, error: estWithAmountError } = await supabaseAdmin
      .from('establishments')
        .select('id, name, plan_type, mercadopago_billing_amount')
      .eq('id', String(establishmentId))
      .single();

    if (!estWithAmountError && estWithAmount) {
      establishment = estWithAmount;
      const estAmount = Number((estWithAmount as any)?.mercadopago_billing_amount ?? 0);
      amountCents = Math.round(estAmount * 100);
    } else {
      const { data: estFallback, error: estFallbackError } = await supabaseAdmin
        .from('establishments')
        .select('id, name, plan_type')
        .eq('id', String(establishmentId))
        .single();

      if (estFallbackError || !estFallback) {
        return res.status(404).json({
          error: 'Estabelecimento não encontrado',
        });
      }
      establishment = estFallback;
    }

    if (amountCents <= 0) {
      const { data: adminConfig, error: adminError } = await supabaseAdmin
        .from('admin_billing_links')
        .select('mercadopago_billing_amount')
        .eq('id', 'global')
        .maybeSingle();

      if (!adminError) {
        const amountBRL = Number((adminConfig as any)?.mercadopago_billing_amount ?? 0);
        amountCents = Math.round(amountBRL * 100);
      }
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        error: 'Valor cobrança MP não configurado para este estabelecimento',
        userMessage: 'Configure o valor da cobrança PIX desta barbearia no Admin.',
      });
    }

    const payerEmail = String(payer?.email || `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`).trim();
    const billingDescription = String(
      description || `Regularizacao Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`
    );

    const body = req.body || {};
    const tokenRaw = String(body?.token || '').trim();
    const pmIdRaw = String(body?.payment_method_id || '').trim();
    const isCard = Boolean(tokenRaw && pmIdRaw);
    const shouldCreateRecurringSubscription = isCard && body?.create_recurring_subscription === true;

    const metadataBase = {
      type: 'establishment_billing',
      establishment_id: String(establishmentId),
      source: 'establishment_dashboard',
      created_at: new Date().toISOString(),
    };

    if (isCard && shouldCreateRecurringSubscription) {
      const payerCard = body?.payer || {};
      const idType = String(payerCard?.identification?.type || 'CPF').toUpperCase();
      const idNum = String(payerCard?.identification?.number || '').replace(/\D/g, '');
      const addr = payerCard?.address || {};
      if (!payerCard?.email || !idNum || !(idType === 'CPF' || idType === 'CNPJ')) {
        return res.status(400).json({ error: 'Para cartão: payer.email e payer.identification são obrigatórios' });
      }
      if (!addr?.zip_code || !addr?.street_name || addr?.street_number == null || !addr?.city || !addr?.federal_unit) {
        return res.status(400).json({ error: 'Para cartão: endereço de cobrança completo é obrigatório' });
      }

      const payerEmailForCard = String(payerCard.email).trim().toLowerCase();
      const backUrlCandidate = String(body?.backUrl || process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();
      const backUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;
      const externalReference = `establishment_billing_subscription:${String(establishmentId)}`;
      const preapprovalPayload: any = {
        reason: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
        payer_email: payerEmailForCard,
        card_token_id: tokenRaw,
        external_reference: externalReference,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: amountCents / 100,
          currency_id: 'BRL',
        },
        status: 'authorized',
      };
      if (backUrl) preapprovalPayload.back_url = backUrl;

      const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
      const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `est_bill_recur_card_${String(establishmentId)}_${tokenRaw.slice(-24)}`,
        },
      });

      const preapproval = response.data || {};
      const preapprovalId = String(preapproval?.id || '').trim();
      if (!preapprovalId) {
        return res.status(500).json({ error: 'Mercado Pago não retornou ID da assinatura.' });
      }

      const normalizedStatus = normalizeBillingStatus(preapproval?.status);
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from('establishment_billing_subscriptions')
        .upsert(
          {
            establishment_id: String(establishmentId),
            preapproval_id: preapprovalId,
            status: String(preapproval?.status || 'authorized'),
            payer_email: payerEmailForCard,
            amount_cents: amountCents,
            description: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
            init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
            payment_provider: 'mercadopago',
            external_reference: externalReference,
            metadata: {
              type: 'establishment_billing_subscription',
              establishment_id: String(establishmentId),
              created_from: 'establishment_dashboard_card_token',
            },
            updated_at: nowIso,
          } as any,
          { onConflict: 'preapproval_id' }
        );

      await supabaseAdmin
        .from('establishment_billing_payments')
        .upsert(
          {
            establishment_id: String(establishmentId),
            amount_cents: amountCents,
            payment_provider: 'mercadopago_card_recurring',
            payment_id: preapprovalId,
            status: normalizedStatus,
            description: billingDescription,
            qr_code: null,
            qr_code_base64: null,
            metadata: {
              ...metadataBase,
              payment_method: 'recurring_card',
              preapproval_id: preapprovalId,
              external_reference: externalReference,
            },
            paid_at: normalizedStatus === 'paid' ? nowIso : null,
            updated_at: nowIso,
          } as any,
          { onConflict: 'payment_id' }
        );

      if (normalizedStatus === 'paid') {
        await supabaseAdmin
          .from('establishments')
          .update({
            payment_status: 'paid',
            is_blocked: false,
            is_deleted: false,
            payment_alert_enabled: false,
            payment_paid_at: nowIso,
            payment_due_date: getNextDueDate((establishment as any)?.plan_type),
          } as any)
          .eq('id', String(establishmentId));
      }

      return res.status(200).json({
        id: preapprovalId,
        status: String(preapproval?.status || ''),
        billing_type: 'establishment_billing',
        subscription_type: 'establishment_billing_recurring_card',
        amount_cents_used: amountCents,
        amount_brl_used: amountCents / 100,
        recurrence_created: true,
        preapproval_id: preapprovalId,
      });
    }

    let payment: Awaited<ReturnType<typeof createMPPayment>>;
    if (isCard) {
      const payerCard = body?.payer || {};
      const idType = String(payerCard?.identification?.type || 'CPF').toUpperCase();
      const idNum = String(payerCard?.identification?.number || '').replace(/\D/g, '');
      const addr = payerCard?.address || {};
      if (!payerCard?.email || !idNum || !(idType === 'CPF' || idType === 'CNPJ')) {
        return res.status(400).json({ error: 'Para cartão: payer.email e payer.identification são obrigatórios' });
      }
      if (!addr?.zip_code || !addr?.street_name || addr?.street_number == null || !addr?.city || !addr?.federal_unit) {
        return res.status(400).json({ error: 'Para cartão: endereço de cobrança completo é obrigatório' });
      }
      payment = await createMPPayment({
        amount: amountCents,
        description: billingDescription,
        access_token: platformAccessToken,
        payment_method_id: pmIdRaw,
        token: tokenRaw,
        issuer_id: String(body?.issuer_id || '').trim() || undefined,
        installments: Number(body?.installments) > 0 ? Number(body?.installments) : 1,
        payer: {
          email: String(payerCard.email).trim().toLowerCase(),
          first_name: String(payerCard.first_name || 'Cliente').trim(),
          last_name: String(payerCard.last_name || 'Cliente').trim(),
          identification: {
            type: idType === 'CNPJ' ? 'CNPJ' : 'CPF',
            number: idNum,
          },
          address: {
            zip_code: String(addr.zip_code).replace(/\D/g, ''),
            street_name: String(addr.street_name || '').trim(),
            street_number: Number(addr.street_number) || 0,
            neighborhood: String(addr.neighborhood || '').trim() || '—',
            city: String(addr.city || '').trim(),
            federal_unit: String(addr.federal_unit || '').trim().slice(0, 2).toUpperCase(),
          },
        },
        metadata: metadataBase,
      });
    } else {
      payment = await createMPPayment({
        amount: amountCents,
        description: billingDescription,
        payer: { email: payerEmail },
        access_token: platformAccessToken,
        payment_method_id: 'pix',
        metadata: metadataBase,
      });
    }

    const normalizedStatus = (() => {
      const raw = String((payment as any)?.status || '').toLowerCase().trim();
      if (raw === 'approved' || raw === 'authorized') return 'paid';
      if (raw === 'cancelled') return 'cancelled';
      if (raw === 'rejected') return 'failed';
      if (raw === 'refunded') return 'refunded';
      return 'pending';
    })();

    const pixData = (payment as any)?.point_of_interaction?.transaction_data || {};
    const { error: saveError } = await supabaseAdmin
      .from('establishment_billing_payments')
      .upsert(
        {
          establishment_id: String(establishmentId),
          amount_cents: amountCents,
          payment_provider: 'mercadopago',
          payment_id: String((payment as any)?.id || ''),
          status: normalizedStatus,
          description: billingDescription,
          qr_code: isCard ? null : String(pixData?.qr_code || '') || null,
          qr_code_base64: isCard ? null : String(pixData?.qr_code_base64 || '') || null,
          metadata: {
            type: 'establishment_billing',
            establishment_id: String(establishmentId),
            ...(isCard ? { payment_method: 'credit_card' } : { payment_method: 'pix' }),
          },
          paid_at: normalizedStatus === 'paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'payment_id' }
      );

    if (saveError) {
      return res.status(500).json({
        error: 'Erro ao salvar cobrança',
        details: saveError,
      });
    }

    let recurrenceCreated = false;
    let preapprovalId = '';
    if (isCard && normalizedStatus === 'paid' && shouldCreateRecurringSubscription) {
      const paymentId = String((payment as any)?.id || '');
      const cardId = String((payment as any)?.card?.id || (payment as any)?.card_id || '').trim();
      if (cardId) {
        try {
          const backUrlCandidate = String(body?.backUrl || process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();
          const backUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          const preapprovalPayload: any = {
            reason: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
            payer_email: String((payment as any)?.payer?.email || payerEmail).trim().toLowerCase(),
            card_id: Number(cardId),
            external_reference: `establishment_billing_subscription:${String(establishmentId)}`,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              start_date: nextMonth.toISOString(),
              transaction_amount: amountCents / 100,
              currency_id: 'BRL',
            },
            status: 'authorized',
          };
          if (backUrl) preapprovalPayload.back_url = backUrl;

          const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
          const response = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
            headers: {
              Authorization: `Bearer ${platformAccessToken}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': `est_bill_recur_${paymentId}`,
            },
          });
          const preapproval = response.data || {};
          preapprovalId = String(preapproval?.id || '').trim();
          recurrenceCreated = Boolean(preapprovalId);
          if (preapprovalId) {
            await supabaseAdmin
              .from('establishment_billing_subscriptions')
              .upsert(
                {
                  establishment_id: String(establishmentId),
                  preapproval_id: preapprovalId,
                  status: String(preapproval?.status || 'authorized'),
                  payer_email: String((payment as any)?.payer?.email || payerEmail).trim().toLowerCase(),
                  amount_cents: amountCents,
                  description: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
                  init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
                  payment_provider: 'mercadopago',
                  metadata: {
                    type: 'establishment_billing_subscription',
                    establishment_id: String(establishmentId),
                    first_payment_id: paymentId,
                    starts_after_first_paid_month: true,
                  },
                  updated_at: new Date().toISOString(),
                } as any,
                { onConflict: 'preapproval_id' }
              );
          }
        } catch (recurrenceError: any) {
          console.warn('⚠️ [MP Establishment Billing Local] Mensalidade atual paga, mas recorrência não foi criada:', recurrenceError?.response?.data || recurrenceError?.message);
        }
      }
    }

    if (isCard && normalizedStatus === 'paid' && shouldCreateRecurringSubscription && !recurrenceCreated) {
      return res.status(409).json({
        ok: false,
        error: 'Mensalidade atual foi paga, mas a recorrência não foi criada no Mercado Pago. Não feche: chame o suporte para vincular a assinatura antes do próximo mês.',
        payment_id: String((payment as any)?.id || ''),
        status: normalizedStatus,
        recurrence_created: false,
      });
    }

    return res.status(200).json({
      ...payment,
      billing_type: 'establishment_billing',
      application_fee_cents_expected: 0,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
      recurrence_created: recurrenceCreated,
      preapproval_id: preapprovalId || null,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Erro ao criar cobrança PIX de regularização',
    });
  }
});

/**
 * POST /api/mercadopago/create-establishment-billing-subscription
 * Cria assinatura recorrente mensal no cartão para regularização da barbearia.
 */
router.post('/create-establishment-billing-subscription', async (req: Request, res: Response) => {
  try {
    const { establishmentId, description, payer, backUrl } = req.body || {};
    if (!establishmentId) {
      return res.status(400).json({ error: 'establishmentId é obrigatório' });
    }

    const platformAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();
    if (!platformAccessToken) {
      return res.status(500).json({ error: 'MERCADOPAGO_ACCESS_TOKEN não configurado' });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    let establishment: any = null;
    let amountCents = 0;
    const { data: estWithAmount, error: estWithAmountError } = await supabaseAdmin
      .from('establishments')
      .select('id, name, mercadopago_billing_amount')
      .eq('id', String(establishmentId))
      .single();

    if (!estWithAmountError && estWithAmount) {
      establishment = estWithAmount;
      const estAmount = Number((estWithAmount as any)?.mercadopago_billing_amount ?? 0);
      amountCents = Math.round(estAmount * 100);
    } else {
      const { data: estFallback, error: estFallbackError } = await supabaseAdmin
        .from('establishments')
        .select('id, name')
        .eq('id', String(establishmentId))
        .single();

      if (estFallbackError || !estFallback) {
        return res.status(404).json({ error: 'Estabelecimento não encontrado' });
      }
      establishment = estFallback;
    }

    if (amountCents <= 0) {
      const { data: adminConfig, error: adminError } = await supabaseAdmin
        .from('admin_billing_links')
        .select('mercadopago_billing_amount')
        .eq('id', 'global')
        .maybeSingle();

      if (!adminError) {
        const amountBRL = Number((adminConfig as any)?.mercadopago_billing_amount ?? 0);
        amountCents = Math.round(amountBRL * 100);
      }
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        error: 'Valor cobrança MP não configurado para este estabelecimento',
        userMessage: 'Configure o valor da cobrança PIX/cartão desta barbearia no Admin.',
      });
    }

    const payerEmail = String(payer?.email || `billing_${String(establishmentId).slice(0, 8)}@agendeifacil.com`).trim().toLowerCase();
    const recurringDescription = String(
      description || `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`
    );

    const preapprovalPayload: any = {
      reason: recurringDescription,
      payer_email: payerEmail,
      external_reference: `establishment_billing_subscription:${String(establishmentId)}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amountCents / 100,
        currency_id: 'BRL',
      },
      status: 'pending',
    };
    const backUrlCandidate = String(backUrl || SUBSCRIPTION_BACK_URL || '').trim();
    if (!/^https:\/\//i.test(backUrlCandidate)) {
      return res.status(400).json({
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com uma URL HTTPS pública (ex.: https://app.agendeifacil.com/dashboard/establishment).',
      });
    }
    preapprovalPayload.back_url = backUrlCandidate;

    const mpResponse = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      },
    });

    const preapproval = mpResponse.data || {};
    const preapprovalId = String(preapproval?.id || '').trim();
    if (!preapprovalId) {
      return res.status(500).json({ error: 'Assinatura criada sem ID no Mercado Pago' });
    }

    const nowIso = new Date().toISOString();
    const { error: saveError } = await supabaseAdmin
      .from('establishment_billing_subscriptions')
      .upsert(
        {
          establishment_id: String(establishmentId),
          preapproval_id: preapprovalId,
          status: String(preapproval?.status || 'pending'),
          payer_email: payerEmail,
          amount_cents: amountCents,
          description: recurringDescription,
          init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
          payment_provider: 'mercadopago',
          metadata: {
            type: 'establishment_billing_subscription',
            establishment_id: String(establishmentId),
          },
          updated_at: nowIso,
        } as any,
        { onConflict: 'preapproval_id' }
      );

    if (saveError) {
      const msg = String((saveError as any)?.message || '').toLowerCase();
      const missingTable = msg.includes('relation') || msg.includes('does not exist') || msg.includes('establishment_billing_subscriptions');
      if (!missingTable) {
        return res.status(500).json({ error: 'Erro ao salvar assinatura', details: saveError });
      }
    }

    return res.status(200).json({
      subscription_type: 'establishment_billing_recurring_card',
      preapproval_id: preapprovalId,
      status: String(preapproval?.status || 'pending'),
      init_point: preapproval?.init_point || null,
      sandbox_init_point: preapproval?.sandbox_init_point || null,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
    });
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao criar assinatura recorrente no cartão',
    });
  }
});

/**
 * POST /api/mercadopago/create-subscription-checkout
 * Cria checkout externo do Mercado Pago para assinatura de cliente.
 */
router.post('/create-subscription-checkout', async (req: Request, res: Response) => {
  try {
    const { establishmentId, subscriptionId, payer, backUrl } = req.body || {};
    const payerEmail = String(payer?.email || '').trim();
    const payerName = String(payer?.name || '').trim();
    const cardTokenId = String(req.body?.card_token_id || req.body?.cardTokenId || '').trim();
    const deviceSessionId = String(req.body?.device_session_id || req.body?.deviceSessionId || '').trim();
    const customerName = String(req.body?.customer?.name || payerName || '').trim();
    const customerWhatsapp = onlyDigits(String(req.body?.customer?.whatsapp || req.body?.customer?.phone || ''));
    const customerEmail = String(req.body?.customer?.email || payerEmail || '').trim() || null;
    const firstPaymentAlreadyCaptured =
      req.body?.first_payment_already_captured === true ||
      req.body?.firstPaymentAlreadyCaptured === true;
    const payerFirstName = String(payer?.first_name || payer?.firstName || '').trim();
    const payerLastName = String(payer?.last_name || payer?.lastName || '').trim();
    const payerDocumentType = String(payer?.identification?.type || '').trim().toUpperCase();
    const payerDocumentNumber = onlyDigits(String(payer?.identification?.number || ''));
    const payerAddress = payer?.address || {};
    const cardInfo = req.body?.card || {};
    const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();
    const backUrlCandidate = String(backUrl || SUBSCRIPTION_BACK_URL || '').trim();

    if (!establishmentId || !subscriptionId || !payerEmail) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'subscriptionId', 'payer.email'],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token')
      .eq('id', String(establishmentId))
      .single();
    if (estError || !establishment) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    }

    const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Estabelecimento sem Mercado Pago conectado' });
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, name, value, duration_months')
      .eq('id', String(subscriptionId))
      .single();
    if (subError || !subscription) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const amount = Number((subscription as any)?.value || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor da assinatura inválido' });
    }
    const txAmountBrl = Number(amount.toFixed(2));
    const recurringStartDate = firstPaymentAlreadyCaptured ? toISODateTime(addMonths(new Date(), 1)) : null;

    const externalReference = `subscription_preapproval:${String(establishmentId)}:${String(subscriptionId)}:${Date.now()}`;
    const title = String((subscription as any)?.name || 'Assinatura').trim();
    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();

    const payload: any = {
      reason: `Assinatura mensal - ${title}`,
      payer_email: payerEmail,
      external_reference: externalReference,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: txAmountBrl,
        currency_id: 'BRL',
        ...(recurringStartDate ? { start_date: recurringStartDate } : {}),
      },
      metadata: {
        type: 'subscription_preapproval',
        establishment_id: String(establishmentId),
        subscription_id: String(subscriptionId),
        payer_name: payerName || null,
        payer_first_name: payerFirstName || null,
        payer_last_name: payerLastName || null,
        payer_document_type: payerDocumentType || null,
        payer_document_last4: payerDocumentNumber ? payerDocumentNumber.slice(-4) : null,
        payer_phone_last4: customerWhatsapp ? customerWhatsapp.slice(-4) : null,
        billing_zip_code: String(payerAddress?.zip_code || '').trim() || null,
        billing_city: String(payerAddress?.city || '').trim() || null,
        billing_federal_unit: String(payerAddress?.federal_unit || '').trim() || null,
        card_payment_method_id: String(cardInfo?.payment_method_id || '').trim() || null,
        card_issuer_id: String(cardInfo?.issuer_id || '').trim() || null,
        card_bin: String(cardInfo?.bin || '').trim().slice(0, 6) || null,
        card_last4: String(cardInfo?.last_four_digits || cardInfo?.lastFourDigits || '').trim().slice(-4) || null,
        has_device_session_id: Boolean(deviceSessionId),
        first_payment_already_captured: firstPaymentAlreadyCaptured,
      },
      status: cardTokenId ? 'authorized' : 'pending',
    };
    if (cardTokenId) payload.card_token_id = cardTokenId;

    if (!cardTokenId && !/^https:\/\//i.test(backUrlCandidate)) {
      return res.status(400).json({
        error: 'back_url is required',
        userMessage: 'Configure MERCADOPAGO_SUBSCRIPTION_BACK_URL com uma URL HTTPS pública.',
      });
    }
    if (/^https:\/\//i.test(backUrlCandidate)) {
      payload.back_url = backUrlCandidate;
    }

    const mpHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `sub_preapproval_${externalReference}`,
    };
    if (deviceSessionId) {
      mpHeaders['X-meli-session-id'] = deviceSessionId;
    }

    const mpResponse = await axios.post(`${MP_API_BASE_URL}/preapproval`, payload, {
      headers: {
        ...mpHeaders,
      },
    });

    const preapproval = mpResponse.data || {};
    const initPoint = String(preapproval?.init_point || preapproval?.sandbox_init_point || '').trim();
    if (!cardTokenId && !initPoint) {
      return res.status(500).json({ error: 'Mercado Pago não retornou init_point' });
    }
    let pendingSubscriber: any = null;
    if (cardTokenId) {
      try {
        pendingSubscriber = await upsertPendingClientSubscription(supabaseAdmin, {
          establishmentId: String(establishmentId),
          subscriptionId: String(subscriptionId),
          preapprovalId: String(preapproval?.id || ''),
          customerName,
          customerWhatsapp,
          customerEmail,
          durationMonths: Number((subscription as any)?.duration_months || 1),
        });
      } catch (pendingError: any) {
        return res.status(500).json({
          error: 'Recorrência criada no Mercado Pago, mas falhou ao criar o assinante como Não Pago no sistema',
          details: pendingError?.message || pendingError,
          preapproval_id: String(preapproval?.id || ''),
          subscription_status: String(preapproval?.status || 'pending'),
        });
      }
    }
    return res.status(200).json({
      preapproval_id: String(preapproval?.id || ''),
      init_point: initPoint || null,
      sandbox_init_point: preapproval?.sandbox_init_point || null,
      external_reference: externalReference,
      subscription_status: String(preapproval?.status || 'pending'),
      recurring_mode: cardTokenId ? 'card_token' : 'hosted_checkout',
      recurrence_created: Boolean(String(preapproval?.id || '').trim()),
      amount_brl_used: amount,
      amount_cents_used: Math.round(amount * 100),
      application_fee_brl_used: 0,
      application_fee_cents_used: 0,
      application_fee_applied: false,
      pending_subscriber_created: Boolean(pendingSubscriber?.id),
      pending_subscriber_id: pendingSubscriber?.id || null,
    });
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      'Erro ao criar checkout externo da assinatura';
    const status = Number(error?.response?.status || 500);
    const lower = String(message || '').toLowerCase();
    const supportsRecurringHint =
      status === 401 ||
      status === 403 ||
      lower.includes('preapproval') ||
      lower.includes('recurring') ||
      lower.includes('subscription') ||
      lower.includes('not authorized') ||
      lower.includes('not allowed');

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: message,
      userMessage: supportsRecurringHint
        ? 'A conta Mercado Pago conectada do barbeiro não conseguiu criar assinatura recorrente agora. Peça para reconectar o Mercado Pago e habilitar Assinaturas/Preapproval na aplicação.'
        : undefined,
      recurring_capability_error: supportsRecurringHint,
    });
  }
});

/**
 * POST /api/mercadopago/get-payment-by-external-reference
 * Busca o pagamento mais recente por external_reference.
 */
router.post('/get-payment-by-external-reference', async (req: Request, res: Response) => {
  try {
    const { establishmentId, externalReference } = req.body || {};
    if (!establishmentId || !externalReference) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'externalReference'],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token')
      .eq('id', String(establishmentId))
      .single();
    if (estError || !establishment) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    }

    const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Estabelecimento sem Mercado Pago conectado' });
    }

    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    const mpResponse = await axios.get(`${MP_API_BASE_URL}/v1/payments/search`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      params: {
        external_reference: String(externalReference),
        sort: 'date_created',
        criteria: 'desc',
        limit: 1,
      },
    });

    const results = Array.isArray(mpResponse?.data?.results) ? mpResponse.data.results : [];
    const payment = results[0] || null;
    if (!payment) {
      return res.status(200).json({ found: false, payment: null });
    }

    return res.status(200).json({
      found: true,
      payment: {
        id: String(payment?.id || ''),
        status: String(payment?.status || ''),
        status_detail: String(payment?.status_detail || ''),
        date_approved: payment?.date_approved || null,
        transaction_amount: payment?.transaction_amount || null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao buscar pagamento no Mercado Pago',
    });
  }
});

/**
 * POST /api/mercadopago/get-preapproval-status
 * Busca status da assinatura recorrente (preapproval) por id.
 */
router.post('/get-preapproval-status', async (req: Request, res: Response) => {
  try {
    const { establishmentId, preapprovalId } = req.body || {};
    if (!establishmentId || !preapprovalId) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'preapprovalId'],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token')
      .eq('id', String(establishmentId))
      .single();
    if (estError || !establishment) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    }

    const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Estabelecimento sem Mercado Pago conectado' });
    }

    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    const mpResponse = await axios.get(
      `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(String(preapprovalId))}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const subscription = mpResponse.data || {};
    return res.status(200).json({
      preapproval: {
        id: String(subscription?.id || ''),
        status: String(subscription?.status || ''),
        external_reference: String(subscription?.external_reference || ''),
        reason: String(subscription?.reason || ''),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao buscar status da recorrência no Mercado Pago',
    });
  }
});

/**
 * POST /api/mercadopago/list-preapprovals
 * Espelho local de netlify/functions/mercadopago-list-preapprovals.ts.
 * SOMENTE LEITURA: lista as recorrências da conta da barbearia. Não escreve
 * nada no banco nem no Mercado Pago.
 */
router.post('/list-preapprovals', async (req: Request, res: Response) => {
  try {
    const { establishmentId } = req.body || {};
    if (!establishmentId) {
      return res.status(400).json({ error: 'Dados incompletos', required: ['establishmentId'] });
    }

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin não configurado' });

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id, mercadopago_access_token')
      .eq('id', String(establishmentId))
      .single();
    if (estError || !establishment) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado' });
    }

    const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'Estabelecimento sem Mercado Pago conectado' });
    }

    const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
    // ⚠️ Paginação instável do Mercado Pago: sem ordenação aceita, ela ora repete
    // registros (148 recebidos / 140 distintos) ora perde registros que existem.
    // Junta por id e repete a varredura até cobrir o total informado por ele.
    const PAGE_SIZE = 100;
    const MAX_PAGES = 10;
    const MAX_VARREDURAS = 4;
    const porId = new Map<string, any>();
    let total = 0;
    let varreduras = 0;

    for (varreduras = 1; varreduras <= MAX_VARREDURAS; varreduras += 1) {
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const mpResponse = await axios.get(`${MP_API_BASE_URL}/preapproval/search`, {
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          // Sem sort: o Mercado Pago recusa ('Invalid sorting value format').
          params: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
          validateStatus: () => true,
        });

        if (mpResponse.status !== 200) {
          return res.status(200).json({
            ok: false,
            httpStatus: mpResponse.status,
            mercadoPagoError: mpResponse.data ?? null,
            hint: 'O Mercado Pago recusou a consulta de recorrências.',
          });
        }

        const data = mpResponse.data || {};
        const results: any[] = Array.isArray(data?.results) ? data.results : [];
        total = Number(data?.paging?.total ?? total) || total;
        results.forEach((raw: any) => {
          const id = String(raw?.id || '').trim();
          if (id && !porId.has(id)) porId.set(id, raw);
        });
        if (results.length < PAGE_SIZE) break;
      }
      if (total > 0 && porId.size >= total) break;
    }

    const all = Array.from(porId.values());
    const coberturaCompleta = total === 0 || porId.size >= total;
    const preapprovals = all
      .map((raw: any) => ({
        id: String(raw?.id || ''),
        status: String(raw?.status || '').toLowerCase(),
        payer_email: String(raw?.payer_email || raw?.payer?.email || '').toLowerCase().trim(),
        payer_id: String(raw?.payer_id || raw?.payer?.id || ''),
        // O Mercado Pago NÃO devolve o e-mail do pagador em conta conectada por
        // OAuth (vem vazio até no detalhe individual). O NOME vem — é por ele que
        // dá para descobrir de quem é cada recorrência.
        payer_first_name: String(raw?.payer_first_name || '').trim(),
        payer_last_name: String(raw?.payer_last_name || '').trim(),
        next_payment_date: String(raw?.next_payment_date || ''),
        external_reference: String(raw?.external_reference || ''),
        reason: String(raw?.reason || ''),
        date_created: String(raw?.date_created || ''),
        last_charged_date: String(raw?.summarized?.last_charged_date || ''),
        charged_quantity: Number(raw?.summarized?.charged_quantity ?? 0) || 0,
        transaction_amount: Number(raw?.auto_recurring?.transaction_amount ?? 0) || 0,
      }))
      .filter((p: any) => Boolean(p.id));

    const porStatus: Record<string, number> = {};
    preapprovals.forEach((p: any) => {
      const key = p.status || 'sem_status';
      porStatus[key] = (porStatus[key] || 0) + 1;
    });

    // A listagem em lote não traz o e-mail do pagador; ele só vem no detalhe
    // individual. Busca só das ativas, em lotes de 5. Continua só leitura.
    const ACTIVE = new Set(['authorized', 'approved', 'active', 'paid']);
    const ativas = preapprovals.filter((p: any) => ACTIVE.has(p.status));
    let falhasAoBuscarDetalhe = 0;
    let amostraDetalhe: any = null;
    for (let i = 0; i < ativas.length; i += 5) {
      const lote = ativas.slice(i, i + 5);
      await Promise.all(
        lote.map(async (p: any) => {
          if (p.payer_email) return;
          try {
            const det = await axios.get(`${MP_API_BASE_URL}/preapproval/${encodeURIComponent(p.id)}`, {
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              validateStatus: () => true,
            });
            if (det.status !== 200) {
              falhasAoBuscarDetalhe += 1;
              if (!amostraDetalhe) amostraDetalhe = { httpStatus: det.status, erro: det.data ?? null };
              return;
            }
            const d = det.data || {};
            if (!amostraDetalhe) {
              amostraDetalhe = {
                httpStatus: det.status,
                campos: Object.keys(d || {}).sort(),
                payer_email: d?.payer_email ?? null,
                payer_id: d?.payer_id ?? null,
                payer: d?.payer ?? null,
              };
            }
            p.payer_email = String(d?.payer_email || d?.payer?.email || '').toLowerCase().trim();
            if (!p.payer_id) p.payer_id = String(d?.payer_id || d?.payer?.id || '');
            if (!p.next_payment_date) p.next_payment_date = String(d?.next_payment_date || '');
            if (!p.last_charged_date) p.last_charged_date = String(d?.summarized?.last_charged_date || '');
            if (!p.charged_quantity) p.charged_quantity = Number(d?.summarized?.charged_quantity ?? 0) || 0;
            if (!p.transaction_amount) p.transaction_amount = Number(d?.auto_recurring?.transaction_amount ?? 0) || 0;
          } catch {
            falhasAoBuscarDetalhe += 1;
          }
        })
      );
    }

    return res.status(200).json({
      ok: true,
      establishmentId: String(establishmentId),
      totalInformadoPeloMercadoPago: total,
      totalRecebido: preapprovals.length,
      coberturaCompleta,
      varreduras,
      porStatus,
      ativasEnriquecidas: ativas.length,
      falhasAoBuscarDetalhe,
      semEmailMesmoAposDetalhe: ativas.filter((p: any) => !p.payer_email).length,
      camposDisponiveis: all[0] ? Object.keys(all[0]).sort() : [],
      amostraDetalhe,
      preapprovals,
    });
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro ao listar recorrências no Mercado Pago',
      httpStatus: error?.response?.status ?? null,
    });
  }
});

/**
 * GET /api/mercadopago/recent-establishment-billing-payments
 * Lista pagamentos automáticos (regularização) recentes por estabelecimento.
 */
router.get('/recent-establishment-billing-payments', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const rawDays = Number(req.query.days || 10);
    const days = Number.isFinite(rawDays) ? Math.min(30, Math.max(1, Math.floor(rawDays))) : 10;
    const nowTs = Date.now();
    const startTs = nowTs - (days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('establishment_billing_payments')
      .select('establishment_id, paid_at, updated_at, status, payment_provider, metadata')
      .eq('status', 'paid')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      return res.status(500).json({
        error: 'Erro ao buscar pagamentos automáticos',
        details: String((error as any)?.message || error),
      });
    }

    const latestByEstablishment = new Map<string, { establishment_id: string; paid_at: string | null; updated_at: string | null; payment_provider: string; payment_method: string }>();
    (data || []).forEach((row: any) => {
      const establishmentId = String(row?.establishment_id || '').trim();
      if (!establishmentId) return;

      const ts = new Date(String(row?.paid_at || row?.updated_at || '')).getTime();
      if (!Number.isFinite(ts) || ts < startTs || ts > nowTs) return;

      const current = latestByEstablishment.get(establishmentId);
      const currentTs = current ? new Date(String(current.paid_at || current.updated_at || '')).getTime() : NaN;
      if (!current || !Number.isFinite(currentTs) || ts > currentTs) {
        latestByEstablishment.set(establishmentId, {
          establishment_id: establishmentId,
          paid_at: row?.paid_at ? String(row.paid_at) : null,
          updated_at: row?.updated_at ? String(row.updated_at) : null,
          payment_provider: String(row?.payment_provider || 'mercadopago'),
          payment_method: String(row?.metadata?.payment_method || ''),
        });
      }
    });

    const items = Array.from(latestByEstablishment.values()).sort((a, b) => {
      const ta = new Date(String(a.paid_at || a.updated_at || '')).getTime();
      const tb = new Date(String(b.paid_at || b.updated_at || '')).getTime();
      return tb - ta;
    });

    return res.status(200).json({ days, count: items.length, items });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Erro ao listar pagamentos automáticos',
    });
  }
});

/**
 * GET /api/mercadopago/check-status
 * Verifica o status de um pagamento
 * 
 * Query params:
 * - paymentId: ID do pagamento
 * - establishmentId: ID do estabelecimento
 */
router.get('/check-status', async (req: Request, res: Response) => {
  try {
    const paymentId = req.query.paymentId as string;
    const establishmentId = req.query.establishmentId as string;

    if (!paymentId || !establishmentId) {
      return res.status(400).json({
        error: 'paymentId e establishmentId são obrigatórios',
      });
    }

    // Buscar access_token do estabelecimento
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    const { data: establishment, error: fetchError } = await supabaseAdmin
      .from('establishments')
      .select('mercadopago_access_token')
      .eq('id', establishmentId)
      .single();

    if (fetchError || !establishment) {
      return res.status(404).json({
        error: 'Estabelecimento não encontrado',
      });
    }

    const accessToken = (establishment as any)?.mercadopago_access_token;

    if (!accessToken) {
      return res.status(400).json({
        error: 'Estabelecimento não possui conta do Mercado Pago conectada',
      });
    }

    // Verificar status
    const payment = await checkMPPaymentStatus(Number(paymentId), String(accessToken));

    return res.status(200).json(payment);
  } catch (error: any) {
    console.error('❌ [MP Routes] Erro ao verificar status:', error);
    return res.status(500).json({
      error: error.message || 'Erro ao verificar status do pagamento',
    });
  }
});

/**
 * POST /api/mercadopago/reconcile-pending-appointments
 * Body: { establishmentId: string, maxRows?: number, lookbackDays?: number }
 */
router.post('/reconcile-pending-appointments', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin não configurado' });
    }

    const establishmentId = String((req.body as any)?.establishmentId || '').trim();
    if (!establishmentId) {
      return res.status(400).json({ error: 'establishmentId é obrigatório' });
    }

    const maxRows = (req.body as any)?.maxRows;
    const lookbackDays = (req.body as any)?.lookbackDays;

    const result = await reconcilePendingMercadoPagoAppointments(supabaseAdmin, establishmentId, {
      maxRows: typeof maxRows === 'number' ? maxRows : undefined,
      lookbackDays: typeof lookbackDays === 'number' ? lookbackDays : undefined,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ [MP Routes] reconcile-pending-appointments:', error);
    return res.status(500).json({
      error: error?.message || 'Erro ao reconciliar agendamentos pendentes',
    });
  }
});

/**
 * POST /api/mercadopago/webhook
 * Webhook do Mercado Pago para notificações de pagamento
 * 
 * Body: Notificação do Mercado Pago (JSON ou form-urlencoded)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado',
      });
    }

    // Parse do body
    let webhookData: any = req.body;

    // Se vier como form-urlencoded, tentar parse do campo 'data'
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      const dataParam = (req.body as any)?.data;
      if (dataParam && typeof dataParam === 'string') {
        try {
          webhookData = JSON.parse(dataParam);
        } catch {
          webhookData = { id: dataParam };
        }
      }
    }

    console.log('📨 [MP Webhook] Notificação recebida:', {
      type: webhookData?.type,
      action: webhookData?.action,
      id: webhookData?.id,
      data: webhookData?.data,
    });

    if (webhookData?.type === 'subscription_preapproval') {
      const preapprovalId = String(webhookData.data?.id || webhookData.id || '').trim();
      if (!preapprovalId) {
        return res.status(400).json({ error: 'preapproval id não encontrado' });
      }

      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('client_subscriptions')
        .select('id, establishment_id, subscription_id, payment_status, subscription_payment_order_id')
        .eq('subscription_payment_order_id', preapprovalId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (rowsError || !Array.isArray(rows) || rows.length === 0) {
        return res.status(200).json({ message: 'Webhook preapproval recebido sem assinante vinculado' });
      }

      const establishmentId = String((rows[0] as any)?.establishment_id || '').trim();
      const { data: establishment } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token')
        .eq('id', establishmentId)
        .single();
      const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
      if (!accessToken) {
        return res.status(200).json({ message: 'Webhook preapproval recebido, mas estabelecimento sem token MP' });
      }

      const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
      const preapprovalResp = await axios.get(
        `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(preapprovalId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const preapproval = preapprovalResp.data || {};
      const status = String(preapproval?.status || '').toLowerCase().trim();

      return res.status(200).json({
        message: 'Webhook preapproval recebido; aguardando webhook de pagamento aprovado para liberar assinatura',
        preapprovalId,
        status,
        linkedSubscribers: rows.length,
      });
    } else if (webhookData?.type === 'payment') {
      const paymentId = webhookData.data?.id || webhookData.id;

      if (!paymentId) {
        return res.status(400).json({ error: 'Payment ID não encontrado' });
      }

      // Buscar agendamento
      const { data: appointments } = await supabaseAdmin
        .from('appointments')
        .select('id, establishment_id, payment_transaction_id, status, payment_method, payment_status')
        .eq('payment_transaction_id', String(paymentId))
        .limit(1);

      if (!appointments || appointments.length === 0) {
        const platformAccessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
        if (platformAccessToken) {
          try {
            const payment = await checkMPPaymentStatus(Number(paymentId), platformAccessToken);
            const externalReference = String((payment as any)?.external_reference || '').trim();
            const recurringPrefix = 'establishment_billing_subscription:';
            if (externalReference.startsWith(recurringPrefix)) {
              const establishmentId = externalReference.slice(recurringPrefix.length).trim();
              const billingStatus = normalizeBillingStatus((payment as any)?.status);
              const nowIso = new Date().toISOString();
              const amountCents = Math.round(Number((payment as any)?.transaction_amount || 0) * 100);

              if (establishmentId) {
                const { error: upsertBillingError } = await supabaseAdmin
                  .from('establishment_billing_payments')
                  .upsert(
                    {
                      establishment_id: establishmentId,
                      amount_cents: Number.isFinite(amountCents) && amountCents > 0 ? amountCents : 0,
                      payment_provider: 'mercadopago_subscription',
                      payment_id: String(paymentId),
                      status: billingStatus,
                      description: 'Cobranca recorrente mensal via cartao',
                      metadata: {
                        type: 'establishment_billing_subscription_payment',
                        external_reference: externalReference,
                      },
                      paid_at: billingStatus === 'paid' ? nowIso : null,
                      updated_at: nowIso,
                    } as any,
                    { onConflict: 'payment_id' }
                  );

                if (upsertBillingError) {
                  console.error('❌ [MP Webhook] Erro ao salvar pagamento recorrente em billing_payments:', upsertBillingError);
                }

                const { data: estData } = await supabaseAdmin
                  .from('establishments')
                  .select('id, plan_type')
                  .eq('id', establishmentId)
                  .single();

                if (billingStatus === 'paid' && estData?.id) {
                  const { error: estUpdateError } = await supabaseAdmin
                    .from('establishments')
                    .update({
                      payment_status: 'paid',
                      is_blocked: false,
                      is_deleted: false,
                      payment_alert_enabled: false,
                      payment_paid_at: nowIso,
                      payment_due_date: getNextDueDate((estData as any)?.plan_type),
                    } as any)
                    .eq('id', String((estData as any).id));

                  if (estUpdateError) {
                    console.error('❌ [MP Webhook] Erro ao regularizar estabelecimento por recorrência:', estUpdateError);
                  }
                }

                const { error: subscriptionUpdateError } = await supabaseAdmin
                  .from('establishment_billing_subscriptions')
                  .update({
                    status: billingStatus === 'paid' ? 'authorized' : billingStatus,
                    last_charged_payment_id: String(paymentId),
                    last_charged_at: billingStatus === 'paid' ? nowIso : null,
                    updated_at: nowIso,
                  } as any)
                  .eq('establishment_id', establishmentId);

                if (subscriptionUpdateError) {
                  const msg = String((subscriptionUpdateError as any)?.message || '').toLowerCase();
                  const missingTable = msg.includes('establishment_billing_subscriptions') || msg.includes('relation') || msg.includes('does not exist');
                  if (!missingTable) {
                    console.error('❌ [MP Webhook] Erro ao atualizar assinatura recorrente:', subscriptionUpdateError);
                  }
                }

                return res.status(200).json({
                  message: 'Webhook de cobrança recorrente processado',
                  establishmentId,
                  paymentStatus: String((payment as any)?.status || ''),
                  billingStatus,
                });
              }
            }

            const subscriptionPreapprovalPrefix = 'subscription_preapproval:';
            if (externalReference.startsWith(subscriptionPreapprovalPrefix)) {
              const parts = externalReference.split(':');
              const establishmentId = String(parts[1] || '').trim();
              const subscriptionId = String(parts[2] || '').trim();
              const subscriptionStatus = normalizeSubscriptionPaymentStatus((payment as any)?.status);
              const payerEmail = String((payment as any)?.payer?.email || '').trim().toLowerCase();

              if (establishmentId && subscriptionId) {
                let subscriberQuery = supabaseAdmin
                  .from('client_subscriptions')
                  .select('id, payment_status, subscription_payment_order_id')
                  .eq('establishment_id', establishmentId)
                  .eq('subscription_id', subscriptionId)
                  .eq('subscription_payment_provider', 'mercadopago_card_recurring')
                  .order('created_at', { ascending: false })
                  .limit(20);

                if (payerEmail) {
                  subscriberQuery = subscriberQuery.eq('subscriber_email', payerEmail);
                }

                const { data: subscriberRows, error: subscriberFetchError } = await subscriberQuery;
                if (subscriberFetchError) {
                  console.error('❌ [MP Webhook] Erro ao buscar assinatura recorrente de cliente:', subscriberFetchError);
                } else if (Array.isArray(subscriberRows) && subscriberRows.length > 0) {
                  const ids = subscriberRows.map((r: any) => String(r.id)).filter(Boolean);
                  if (ids.length > 0 && subscriptionStatus === 'paid') {
                    const { data: subData } = await supabaseAdmin
                      .from('subscriptions')
                      .select('duration_months')
                      .eq('id', subscriptionId)
                      .single();
                    const durationMonths = Number((subData as any)?.duration_months || 1);
                    const now = new Date();
                    const startDate = toISODate(now);
                    const endDate = toISODate(addMonths(now, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

                    const { error: subscriberUpdateError } = await supabaseAdmin
                      .from('client_subscriptions')
                      .update({
                        payment_status: 'paid',
                        last_payment_date: startDate,
                        start_date: startDate,
                        end_date: endDate,
                        subscriber_payment_method: 'credito',
                        subscription_payment_provider: 'mercadopago_card_recurring',
                      } as any)
                      .in('id', ids);

                    if (subscriberUpdateError) {
                      console.error('❌ [MP Webhook] Erro ao liberar assinatura recorrente aprovada:', subscriberUpdateError);
                    } else {
                      return res.status(200).json({
                        message: 'Webhook de cobrança recorrente de assinatura aprovado',
                        establishmentId,
                        subscriptionId,
                        paymentId: String(paymentId),
                        updatedSubscribers: ids.length,
                      });
                    }
                  }

                  return res.status(200).json({
                    message: 'Webhook de cobrança recorrente recebido sem aprovação; assinatura permanece pendente',
                    establishmentId,
                    subscriptionId,
                    paymentId: String(paymentId),
                    paymentStatus: String((payment as any)?.status || ''),
                    subscriptionStatus,
                    matchedSubscribers: ids.length,
                  });
                }
              }
            }

            const subscriptionCheckoutPrefix = 'subscription_checkout:';

            if (externalReference.startsWith(subscriptionCheckoutPrefix)) {
              const parts = externalReference.split(':');
              const establishmentId = String(parts[1] || '').trim();
              const subscriptionId = String(parts[2] || '').trim();
              const subscriptionStatus = normalizeSubscriptionPaymentStatus((payment as any)?.status);

              if (establishmentId && subscriptionId) {
                const lookupOrderIds = [externalReference, String(paymentId)].filter(Boolean);
                const { data: subscriberRows, error: subscriberFetchError } = await supabaseAdmin
                  .from('client_subscriptions')
                  .select('id, payment_status, subscription_payment_order_id')
                  .eq('establishment_id', establishmentId)
                  .eq('subscription_id', subscriptionId)
                  .in('subscription_payment_order_id', lookupOrderIds)
                  .order('created_at', { ascending: false })
                  .limit(20);

                if (subscriberFetchError) {
                  console.error('❌ [MP Webhook] Erro ao buscar assinatura pendente (checkout externo):', subscriberFetchError);
                } else if (Array.isArray(subscriberRows) && subscriberRows.length > 0) {
                  if (subscriptionStatus === 'paid') {
                    const ids = subscriberRows.map((r: any) => String(r.id)).filter(Boolean);
                    if (ids.length > 0) {
                      const { error: subscriberUpdateError } = await supabaseAdmin
                        .from('client_subscriptions')
                        .update({
                          payment_status: 'paid',
                          last_payment_date: toISODate(new Date()),
                          subscriber_payment_method: 'credito',
                          subscription_payment_provider: 'mercadopago_card',
                          subscription_payment_order_id: String(paymentId),
                        } as any)
                        .in('id', ids);

                      if (!subscriberUpdateError) {
                        await recordAdminMpCommission(supabaseAdmin, {
                          establishmentId,
                          sourceType: 'subscription',
                          sourceId: ids[0] || null,
                          paymentId: String(paymentId),
                          externalReference,
                          paymentMethod: String((payment as any)?.payment_method_id || ''),
                          grossAmountCents: Math.round(Number((payment as any)?.transaction_amount || 0) * 100) || null,
                          paidAt: String((payment as any)?.date_approved || (payment as any)?.date_created || '') || null,
                          metadata: {
                            origin: 'mercadopago_webhook_subscription_checkout_local',
                            subscription_id: subscriptionId,
                            updated_subscribers: ids.length,
                            payment_status: (payment as any)?.status || null,
                          },
                        });
                        return res.status(200).json({
                          message: 'Webhook de assinatura externa processado automaticamente',
                          establishmentId,
                          subscriptionId,
                          paymentId: String(paymentId),
                          paymentStatus: String((payment as any)?.status || ''),
                          updatedSubscribers: ids.length,
                        });
                      }
                    }
                  } else {
                    return res.status(200).json({
                      message: 'Webhook de assinatura externa recebido (ainda não aprovado)',
                      establishmentId,
                      subscriptionId,
                      paymentId: String(paymentId),
                      paymentStatus: String((payment as any)?.status || ''),
                    });
                  }
                }
              }
            }
          } catch (externalErr) {
            console.warn('⚠️ [MP Webhook] Falha ao processar assinatura externa automática:', externalErr);
          }
        }

        const platformAccessTokenFallback = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
        if (platformAccessTokenFallback) {
          try {
            const paymentMeta = await checkMPPaymentStatus(Number(paymentId), platformAccessTokenFallback);
            const fb = await confirmPendingAppointmentFromMpPaymentMetadata(
              supabaseAdmin,
              String(paymentId),
              paymentMeta
            );
            if (fb.ok) {
              return res.status(200).json({
                message: 'Webhook agendamento confirmado via external_reference/metadata',
                appointmentId: fb.appointmentId,
                paymentId: String(paymentId),
              });
            }
          } catch (metaErr) {
            console.warn('⚠️ [MP Webhook] Fallback metadata agendamento:', metaErr);
          }
        }

        return res.status(200).json({ message: 'Webhook recebido, mas agendamento não encontrado' });
      }

      const appointment = appointments[0];

      // Buscar access_token do estabelecimento
      const { data: establishment } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token')
        .eq('id', appointment.establishment_id)
        .single();

      if (!establishment || !(establishment as any)?.mercadopago_access_token) {
        return res.status(200).json({ message: 'Webhook recebido, mas estabelecimento não configurado' });
      }

      // Verificar status do pagamento
      const payment = await checkMPPaymentStatus(
        Number(paymentId),
        String((establishment as any).mercadopago_access_token)
      );

      if (payment.status === 'approved' || payment.status === 'authorized') {
        // Converter payment_method_id do Mercado Pago para o formato do sistema
        // Sempre usar o payment_method_id do pagamento (fonte mais confiável)
        const paymentMethodId = String(payment.payment_method_id || '').toLowerCase();
        let paymentMethod = 'pix'; // Padrão

        if (paymentMethodId === 'credit_card') {
          paymentMethod = 'credito';
        } else if (paymentMethodId === 'debit_card') {
          paymentMethod = 'debito';
        } else if (paymentMethodId === 'pix') {
          paymentMethod = 'pix';
        }

        await supabaseAdmin
          .from('appointments')
          .update({
            status: 'confirmed',
            payment_status: 'paid',
            payment_method: paymentMethod,
            pix_payment_status: payment.payment_method_id === 'pix' ? 'aprovado' : null,
          })
          .eq('id', appointment.id);

        await recordAdminMpCommission(supabaseAdmin, {
          establishmentId: String(appointment.establishment_id || ''),
          sourceType: 'appointment',
          sourceId: String(appointment.id),
          paymentId: String(paymentId),
          externalReference: String((payment as any)?.external_reference || '') || null,
          paymentMethod,
          grossAmountCents: Math.round(Number((payment as any)?.transaction_amount || 0) * 100) || null,
          paidAt: String((payment as any)?.date_approved || (payment as any)?.date_created || '') || null,
          metadata: {
            origin: 'mercadopago_webhook_appointment_local',
            payment_status: (payment as any)?.status || null,
            payment_method_id: (payment as any)?.payment_method_id || null,
          },
        });

        return res.status(200).json({
          message: 'Webhook processado com sucesso',
          appointmentId: appointment.id,
          paymentStatus: payment.status,
        });
      }

      return res.status(200).json({
        message: 'Webhook processado',
        paymentStatus: payment.status,
      });
    }

    return res.status(200).json({
      message: 'Webhook recebido',
      type: webhookData?.type,
    });
  } catch (error: any) {
    console.error('❌ [MP Webhook] Erro:', error);
    return res.status(200).json({
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
});

/**
 * 💳 COBRAR CLIENTE — rota de DESENVOLVIMENTO.
 *
 * Em produção quem atende é a função Netlify. Aqui a rota apenas ADAPTA a
 * requisição do Express e chama a MESMA função — sem reimplementar nada.
 * Assim dev e produção não têm como divergir (o resto deste arquivo duplica a
 * lógica das functions, e é justamente por isso que elas costumam divergir).
 */
router.post('/create-appointment-local-charge', async (req: Request, res: Response) => {
  try {
    const { handler: localChargeHandler } = await import(
      '../../netlify/functions/mercadopago-create-appointment-local-charge'
    );

    const result: any = await (localChargeHandler as any)(
      {
        httpMethod: 'POST',
        headers: req.headers || {},
        body: JSON.stringify(req.body || {}),
      },
      {} as any,
      undefined as any
    );

    res.status(Number(result?.statusCode || 500));
    res.type('application/json');
    return res.send(String(result?.body || '{}'));
  } catch (error: any) {
    console.error('❌ [MP Local Charge - dev] Erro:', error);
    return res.status(500).json({
      error: String(error?.message || 'Erro ao gerar cobranca PIX'),
      userMessage: 'Nao foi possivel gerar a cobranca agora. Tente novamente.',
    });
  }
});

export default router;
