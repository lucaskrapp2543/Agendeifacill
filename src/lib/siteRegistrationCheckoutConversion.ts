const SITE_REGISTRATION_PLAN_CONFIG = {
  prata: { label: 'PRATA', amountCents: 3790, planPrataActive: true },
  diamante: { label: 'DIAMANTE', amountCents: 5790, planPrataActive: false },
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
  if (paymentContext.paymentMethod === 'recurring_card' && !paymentContext.paymentId) {
    return { handled: true, created: false, reason: 'card_payment_required_before_conversion' };
  }

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
  if (checkoutAny.status === 'converted' && checkoutAny.created_establishment_id) {
    return {
      handled: true,
      created: false,
      reason: 'already_converted',
      establishmentId: checkoutAny.created_establishment_id,
    };
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
      throw new Error(authError?.message || 'Usuario nao foi criado');
    }

    const establishmentCode = await generateUniqueEstablishmentCode(supabaseAdmin);
    const { data: establishment, error: establishmentError } = await supabaseAdmin
      .from('establishments')
      .insert({
        name: checkoutAny.establishment_name,
        code: establishmentCode,
        description: `Estabelecimento criado automaticamente pelo site para ${checkoutAny.client_name}`,
        owner_id: authData.user.id,
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
        admin_profit_value: plan.amountCents / 100,
        mercadopago_billing_amount: plan.amountCents / 100,
      } as any)
      .select('id')
      .single();

    if (establishmentError || !establishment?.id) {
      throw new Error(establishmentError?.message || 'Estabelecimento nao foi criado');
    }

    const establishmentId = String((establishment as any).id);
    const method = paymentContext.paymentMethod || checkoutAny.payment_method || 'pix';

    await supabaseAdmin
      .from('site_registration_checkouts')
      .update({
        status: 'converted',
        created_user_id: authData.user.id,
        created_establishment_id: establishmentId,
        payment_id: paymentContext.paymentId || checkoutAny.payment_id || null,
        preapproval_id: paymentContext.preapprovalId || checkoutAny.preapproval_id || null,
        paid_at: nowIso,
        converted_at: nowIso,
        metadata: {
          ...(checkoutAny.metadata || {}),
          converted_by: 'status_or_webhook',
          payment_raw_status: paymentContext.status,
          establishment_code: establishmentCode,
        },
        updated_at: nowIso,
      } as any)
      .eq('id', checkoutId);

    await supabaseAdmin
      .from('registration_forms')
      .insert({
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

    if (paymentContext.paymentId) {
      await supabaseAdmin
        .from('establishment_billing_payments')
        .upsert(
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
      await supabaseAdmin
        .from('establishment_billing_subscriptions')
        .upsert(
          {
            establishment_id: establishmentId,
            preapproval_id: String(paymentContext.preapprovalId),
            status: 'authorized',
            payer_email: String(checkoutAny.email || '').toLowerCase().trim(),
            external_reference: `site_registration_checkout:${checkoutId}`,
            amount_cents: Number(checkoutAny.amount_cents || plan.amountCents),
            payment_provider: 'mercadopago',
            metadata: {
              type: 'site_registration_checkout',
              checkout_id: checkoutId,
              selected_plan: planKey,
              payment_method: method,
            },
            updated_at: nowIso,
          } as any,
          { onConflict: 'preapproval_id' }
        );
    }

    return { handled: true, created: true, establishmentId, userId: authData.user.id };
  } catch (conversionError: any) {
    const message = String(conversionError?.message || 'Falha ao converter checkout em conta');
    await supabaseAdmin
      .from('site_registration_checkouts')
      .update({
        status: 'conversion_failed',
        metadata: { ...(checkoutAny.metadata || {}), conversion_error: message },
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', checkoutId);
    return { handled: true, created: false, reason: 'conversion_failed', error: message };
  }
}
