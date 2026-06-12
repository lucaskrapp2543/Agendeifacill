import {
  createPartnerReferralAfterConversion,
  ensurePartnerReferralLinkForConvertedCheckout,
} from './partnerReferralCheckout';

const SITE_REGISTRATION_PLAN_CONFIG = {
  prata: { label: 'PRATA', amountCents: 3790, planPrataActive: true },
  diamante: { label: 'DIAMANTE', amountCents: 6790, planPrataActive: false },
} as const;

const isApprovedStatus = (raw: unknown) => {
  const status = String(raw || '').toLowerCase().trim();
  return status === 'approved' || status === 'authorized' || status === 'paid';
};

const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

const toISODate = (date: Date): string => date.toISOString().slice(0, 10);

const defaultBusinessHours = {
  monday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  tuesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  wednesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  thursday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  friday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  saturday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  sunday: { enabled: false, open1: null, close1: null, open2: null, close2: null },
};

async function generateUniqueEstablishmentCode(supabaseAdmin: any): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const { data } = await supabaseAdmin
      .from('establishments')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!data?.id) return code;
  }
  return `${Date.now()}`.slice(-6);
}

async function findUserIdByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find(
      (user: any) => String(user?.email || '').toLowerCase().trim() === normalizedEmail
    );
    if (match?.id) return String(match.id);
    if (users.length < 200) break;
  }

  return null;
}

async function findEstablishmentForCheckout(
  supabaseAdmin: any,
  input: { ownerId: string; establishmentName?: string | null }
): Promise<{ id: string; code?: string | null } | null> {
  const ownerId = String(input.ownerId || '').trim();
  if (!ownerId) return null;

  const establishmentName = String(input.establishmentName || '').trim();
  let query = supabaseAdmin.from('establishments').select('id, code, name').eq('owner_id', ownerId);
  if (establishmentName) {
    query = query.ilike('name', establishmentName);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data?.id) return null;
  return { id: String(data.id), code: data.code ? String(data.code) : null };
}

async function markCheckoutConverted(
  supabaseAdmin: any,
  input: {
    checkoutId: string;
    checkoutAny: Record<string, any>;
    planKey: string;
    plan: (typeof SITE_REGISTRATION_PLAN_CONFIG)[keyof typeof SITE_REGISTRATION_PLAN_CONFIG];
    userId: string;
    establishmentId: string;
    establishmentCode: string;
    paymentContext: {
      status: unknown;
      paymentId?: string | null;
      preapprovalId?: string | null;
      paymentMethod?: 'pix' | 'recurring_card';
    };
    partnerReferralResult: { created: boolean; reason?: string; error?: string };
    nowIso: string;
  }
) {
  const {
    checkoutId,
    checkoutAny,
    planKey,
    plan,
    userId,
    establishmentId,
    establishmentCode,
    paymentContext,
    partnerReferralResult,
    nowIso,
  } = input;

  const method = paymentContext.paymentMethod || checkoutAny.payment_method || 'pix';
  const recurringAmountCents = Number(
    checkoutAny.original_amount_cents || checkoutAny.amount_cents || plan.amountCents
  );
  const firstPaymentAmountCents = Number(checkoutAny.amount_cents || plan.amountCents);

  await supabaseAdmin
    .from('site_registration_checkouts')
    .update({
      status: 'converted',
      created_user_id: userId,
      created_establishment_id: establishmentId,
      payment_id: paymentContext.paymentId || checkoutAny.payment_id || null,
      preapproval_id: paymentContext.preapprovalId || checkoutAny.preapproval_id || null,
      paid_at: checkoutAny.paid_at || nowIso,
      converted_at: checkoutAny.converted_at || nowIso,
      metadata: {
        ...(checkoutAny.metadata || {}),
        converted_by: 'status_or_webhook',
        payment_raw_status: paymentContext.status,
        establishment_code: establishmentCode,
        partner_referral_linked: partnerReferralResult.created,
        partner_referral_reason: partnerReferralResult.reason || null,
        partner_referral_error: partnerReferralResult.error || null,
        conversion_error: null,
      },
      updated_at: nowIso,
    } as any)
    .eq('id', checkoutId);

  const { data: existingForm } = await supabaseAdmin
    .from('registration_forms')
    .select('id')
    .eq('email', String(checkoutAny.email || '').toLowerCase().trim())
    .ilike('notes', `%Checkout: ${checkoutId}%`)
    .maybeSingle();

  if (!existingForm?.id) {
    await supabaseAdmin.from('registration_forms').insert({
      client_name: checkoutAny.client_name,
      establishment_name: checkoutAny.establishment_name,
      email: checkoutAny.email,
      password: checkoutAny.password,
      client_whatsapp: checkoutAny.client_whatsapp || null,
      status: 'approved',
      processed_at: nowIso,
      processed_by: null,
      notes: `Conta criada automaticamente apos pagamento do site. Plano: ${plan.label}. Codigo: ${establishmentCode}. Checkout: ${checkoutId}.`,
      ip_address: checkoutAny.ip_address || null,
      user_agent: checkoutAny.user_agent || null,
      account_type: 'paid',
    } as any);
  }

  if (paymentContext.paymentId) {
    await supabaseAdmin.from('establishment_billing_payments').upsert(
      {
        establishment_id: establishmentId,
        amount_cents: Number(checkoutAny.amount_cents || plan.amountCents),
        payment_provider: method === 'pix' ? 'mercadopago_site_pix' : 'mercadopago_site_subscription',
        payment_id: String(paymentContext.paymentId),
        status: 'paid',
        description: `Cadastro site plano ${plan.label}`,
        metadata: {
          type: 'site_registration_checkout',
          checkout_id: checkoutId,
          selected_plan: planKey,
          payment_method: method,
        },
        paid_at: nowIso,
        updated_at: nowIso,
      } as any,
      { onConflict: 'payment_id' }
    );
  }

  if (paymentContext.preapprovalId) {
    await supabaseAdmin.from('establishment_billing_subscriptions').upsert(
      {
        establishment_id: establishmentId,
        preapproval_id: String(paymentContext.preapprovalId),
        status: 'authorized',
        payer_email: String(checkoutAny.email || '').toLowerCase().trim(),
        external_reference: `site_registration_checkout:${checkoutId}`,
        amount_cents: recurringAmountCents,
        payment_provider: 'mercadopago',
        metadata: {
          type: 'site_registration_checkout',
          checkout_id: checkoutId,
          selected_plan: planKey,
          payment_method: method,
          first_payment_amount_cents: firstPaymentAmountCents,
        },
        updated_at: nowIso,
      } as any,
      { onConflict: 'preapproval_id' }
    );
  }
}

async function finalizeExistingConvertedCheckout(
  supabaseAdmin: any,
  checkoutId: string,
  checkoutAny: Record<string, any>,
  paymentContext: {
    status: unknown;
    paymentId?: string | null;
    preapprovalId?: string | null;
    paymentMethod?: 'pix' | 'recurring_card';
  }
) {
  const establishmentId = String(checkoutAny.created_establishment_id || '').trim();
  const partnerReferral = await ensurePartnerReferralLinkForConvertedCheckout(supabaseAdmin, {
    checkout: { ...checkoutAny, id: checkoutId },
    checkoutId,
    referredEstablishmentId: establishmentId,
    referredOwnerId: checkoutAny.created_user_id || null,
    paymentId: paymentContext.paymentId || checkoutAny.payment_id || null,
  });

  if (checkoutAny.status !== 'converted') {
    await supabaseAdmin
      .from('site_registration_checkouts')
      .update({
        status: 'converted',
        metadata: {
          ...(checkoutAny.metadata || {}),
          conversion_error: null,
          conversion_healed_at: new Date().toISOString(),
          partner_referral_linked: partnerReferral.created,
          partner_referral_reason: partnerReferral.reason || null,
          partner_referral_error: partnerReferral.error || null,
        },
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', checkoutId);
  }

  return {
    handled: true,
    created: false,
    reason: checkoutAny.status === 'converted' ? 'already_converted' : 'healed_conversion',
    establishmentId,
    partnerReferral,
  };
}

export async function convertSiteRegistrationCheckoutIfPaid(
  supabaseAdmin: any,
  checkoutId: string,
  paymentContext: {
    status: unknown;
    paymentId?: string | null;
    preapprovalId?: string | null;
    paymentMethod?: 'pix' | 'recurring_card';
  }
) {
  if (!isApprovedStatus(paymentContext.status)) {
    return { handled: true, created: false, reason: 'payment_not_approved' };
  }

  const { data: checkout, error: checkoutError } = await supabaseAdmin
    .from('site_registration_checkouts')
    .select('*')
    .eq('id', checkoutId)
    .maybeSingle();

  if (checkoutError || !checkout) {
    return { handled: false, created: false, reason: 'checkout_not_found', error: checkoutError?.message };
  }

  const checkoutAny = checkout as any;
  if (checkoutAny.created_establishment_id) {
    return finalizeExistingConvertedCheckout(supabaseAdmin, checkoutId, checkoutAny, paymentContext);
  }

  const planKey = String(checkoutAny.selected_plan || '').toLowerCase().trim() as keyof typeof SITE_REGISTRATION_PLAN_CONFIG;
  const plan = SITE_REGISTRATION_PLAN_CONFIG[planKey];
  if (!plan) {
    await supabaseAdmin
      .from('site_registration_checkouts')
      .update({
        status: 'conversion_failed',
        metadata: { ...(checkoutAny.metadata || {}), conversion_error: 'Plano invalido no checkout' },
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', checkoutId);
    return { handled: true, created: false, reason: 'invalid_plan' };
  }

  const nowIso = new Date().toISOString();

  try {
    let userId = '';
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: String(checkoutAny.email || '').toLowerCase().trim(),
      password: String(checkoutAny.password || ''),
      email_confirm: true,
      user_metadata: {
        role: 'establishment',
        full_name: checkoutAny.client_name,
        establishment_name: checkoutAny.establishment_name,
        source: 'site_registration',
        selected_plan: planKey,
      },
    });

    if (authError || !authData?.user?.id) {
      const authMessage = String(authError?.message || '');
      const isDuplicateEmail =
        authMessage.toLowerCase().includes('already been registered') ||
        authMessage.toLowerCase().includes('already registered');

      if (isDuplicateEmail) {
        userId = String((await findUserIdByEmail(supabaseAdmin, checkoutAny.email)) || '');
        if (!userId) {
          throw new Error(authMessage || 'Usuario nao foi criado');
        }
      } else {
        throw new Error(authMessage || 'Usuario nao foi criado');
      }
    } else {
      userId = String(authData.user.id);
    }

    let establishmentId = '';
    let establishmentCode = '';

    const existingEstablishment = await findEstablishmentForCheckout(supabaseAdmin, {
      ownerId: userId,
      establishmentName: checkoutAny.establishment_name,
    });

    if (existingEstablishment?.id) {
      establishmentId = existingEstablishment.id;
      establishmentCode = existingEstablishment.code || (await generateUniqueEstablishmentCode(supabaseAdmin));
    } else {
      establishmentCode = await generateUniqueEstablishmentCode(supabaseAdmin);
      const recurringAmountCents = Number(
        checkoutAny.original_amount_cents || checkoutAny.amount_cents || plan.amountCents
      );

      const { data: establishment, error: establishmentError } = await supabaseAdmin
        .from('establishments')
        .insert({
          name: checkoutAny.establishment_name,
          code: establishmentCode,
          description: `Estabelecimento criado automaticamente pelo site para ${checkoutAny.client_name}`,
          owner_id: userId,
          business_hours: defaultBusinessHours,
          services_with_prices: [],
          professionals: [],
          profile_image_url: null,
          affiliate_link: null,
          custom_photo_1_url: null,
          custom_photo_2_url: null,
          custom_photo_3_url: null,
          custom_photo_4_url: null,
          custom_photo_5_url: null,
          custom_photo_6_url: null,
          custom_photo_7_url: null,
          carousel_position: 'below',
          has_wifi: false,
          has_parking: false,
          has_accessibility: false,
          wifi_password: null,
          pin_password: null,
          professionals_pins: [],
          whatsapp: checkoutAny.client_whatsapp || null,
          payment_status: 'paid',
          plan_type: 'monthly',
          payment_due_date: toISODate(addMonths(new Date(), 1)),
          payment_paid_at: nowIso,
          payment_alert_enabled: false,
          is_deleted: false,
          is_blocked: false,
          onboarding_step: 1,
          plan_prata_active: plan.planPrataActive,
          admin_profit_value: recurringAmountCents / 100,
          mercadopago_billing_amount: recurringAmountCents / 100,
        } as any)
        .select('id')
        .single();

      if (establishmentError || !establishment?.id) {
        throw new Error(establishmentError?.message || 'Estabelecimento nao foi criado');
      }

      establishmentId = String((establishment as any).id);
    }

    const partnerReferralResult = await createPartnerReferralAfterConversion(supabaseAdmin, {
      checkout: { ...checkoutAny, id: checkoutId },
      referredEstablishmentId: establishmentId,
      referredOwnerId: userId,
      paymentId: paymentContext.paymentId || checkoutAny.payment_id || null,
    });

    await markCheckoutConverted(supabaseAdmin, {
      checkoutId,
      checkoutAny,
      planKey,
      plan,
      userId,
      establishmentId,
      establishmentCode,
      paymentContext,
      partnerReferralResult,
      nowIso,
    });

    return {
      handled: true,
      created: true,
      establishmentId,
      userId,
      partnerReferral: partnerReferralResult,
    };
  } catch (conversionError: any) {
    const message = String(conversionError?.message || 'Falha ao converter checkout em conta');

    const { data: latestCheckout } = await supabaseAdmin
      .from('site_registration_checkouts')
      .select('*')
      .eq('id', checkoutId)
      .maybeSingle();

    if ((latestCheckout as any)?.created_establishment_id) {
      return finalizeExistingConvertedCheckout(
        supabaseAdmin,
        checkoutId,
        latestCheckout as any,
        paymentContext
      );
    }

    await supabaseAdmin
      .from('site_registration_checkouts')
      .update({
        status: 'conversion_failed',
        metadata: { ...(checkoutAny.metadata || {}), conversion_error: message },
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', checkoutId)
      .is('created_establishment_id', null);

    return { handled: true, created: false, reason: 'conversion_failed', error: message };
  }
}
