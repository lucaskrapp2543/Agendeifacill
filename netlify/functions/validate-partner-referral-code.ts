import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  SITE_REGISTRATION_DIAMANTE_AMOUNT_CENTS,
  validatePartnerReferralForSiteRegistration,
} from '../../src/lib/partnerReferralCheckout';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) return json(500, { error: 'Supabase admin nao configurado' });

    const body = parseJsonBody<any>(event) || {};
    const planKey = String(body?.plan || 'diamante').toLowerCase().trim();
    const result = await validatePartnerReferralForSiteRegistration(supabaseAdmin, {
      planKey,
      rawCode: body?.code,
      registrationEmail: body?.email,
      baseAmountCents: SITE_REGISTRATION_DIAMANTE_AMOUNT_CENTS,
    });

    if (!result.ok) {
      return json(200, {
        ok: false,
        valid: false,
        message: result.message,
        reason: result.reason,
      });
    }

    return json(200, {
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
    return json(500, { error: String(error?.message || 'Erro ao validar cupom') });
  }
};
