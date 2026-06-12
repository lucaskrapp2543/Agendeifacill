import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { checkMPPaymentStatus } from '../../src/lib/mercadopago/mp-service';
import { convertSiteRegistrationCheckoutIfPaid } from '../../src/lib/siteRegistrationCheckoutConversion';
import { getQueryParam, json } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PLATFORM_MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
  }

  try {
    if (!supabaseAdmin) return json(500, { error: 'Supabase admin nao configurado' });

    const checkoutId = String(getQueryParam(event, 'checkout_id') || '').trim();
    if (!checkoutId) {
      return json(400, { error: 'checkout_id obrigatorio' });
    }

    const { data, error } = await supabaseAdmin
      .from('site_registration_checkouts')
      .select('id,status,selected_plan,amount_cents,payment_method,payment_id,preapproval_id,created_establishment_id,converted_at,expires_at')
      .eq('id', checkoutId)
      .maybeSingle();

    if (error) return json(500, { error: 'Erro ao consultar checkout', details: error.message });
    if (!data) return json(404, { error: 'Checkout nao encontrado' });

    let conversionResult: any = null;
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
    } else if (status !== 'converted' && paymentId && PLATFORM_MP_ACCESS_TOKEN) {
      const payment = await checkMPPaymentStatus(Number(paymentId), PLATFORM_MP_ACCESS_TOKEN);
      conversionResult = await convertSiteRegistrationCheckoutIfPaid(supabaseAdmin, checkoutId, {
        status: (payment as any)?.status,
        paymentId,
        paymentMethod: String((data as any).payment_method || '') === 'recurring_card' ? 'recurring_card' : 'pix',
      });
    } else if (status !== 'converted' && preapprovalId && PLATFORM_MP_ACCESS_TOKEN) {
      const preapprovalResp = await axios.get(
        `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(preapprovalId)}`,
        { headers: { Authorization: `Bearer ${PLATFORM_MP_ACCESS_TOKEN}` } }
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

    return json(200, { ok: true, checkout: refreshed || data, conversion: conversionResult });
  } catch (error: any) {
    return json(500, { error: String(error?.message || 'Erro ao consultar checkout') });
  }
};
