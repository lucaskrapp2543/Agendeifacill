import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { checkMPPaymentStatus } from '../../src/lib/mercadopago/mp-service';
import {
  getPlatformMercadoPagoAccessToken,
  isPlatformCollectedPayment,
  recordPlatformCollectedPayment,
} from '../../src/lib/mercadopago/platformWallet';
import { recordAdminMpCommission } from '../../src/lib/mercadopago/adminMpCommission';
import { getQueryParam, json } from './_utils';

// Supabase Admin (bypass RLS)
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

async function getValidMercadoPagoAccessToken(establishmentId: string): Promise<string> {
  if (!supabaseAdmin) throw new Error('Supabase admin não configurado');

  const { data: establishment, error } = await supabaseAdmin
    .from('establishments')
    .select('mercadopago_access_token, mercadopago_refresh_token, mercadopago_token_expires_at')
    .eq('id', establishmentId)
    .single();

  if (error || !establishment) throw new Error('Estabelecimento não encontrado');

  const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
  const refreshToken = String((establishment as any)?.mercadopago_refresh_token || '').trim();
  const expiresAtRaw = (establishment as any)?.mercadopago_token_expires_at as string | null | undefined;

  if (!accessToken) {
    const noAccountErr: any = new Error('Estabelecimento não possui conta do Mercado Pago conectada');
    noAccountErr.code = 'NO_MP_ACCOUNT';
    throw noAccountErr;
  }
  if (!expiresAtRaw) return accessToken;

  const expiresAt = new Date(expiresAtRaw);
  const now = Date.now();
  const safetyMs = 2 * 60 * 1000;
  if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > now + safetyMs) {
    return accessToken;
  }

  if (!refreshToken) throw new Error('Mercado Pago expirado e sem refresh_token. Reconecte o Mercado Pago.');

  const refreshed = await refreshAccessToken(refreshToken);
  const newAccessToken = String(refreshed.access_token || '').trim();
  const newRefreshToken = String(refreshed.refresh_token || refreshToken).trim();
  const expiresIn = Number(refreshed.expires_in || 21600);
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  if (!newAccessToken) throw new Error('Falha ao atualizar token do Mercado Pago');

  await supabaseAdmin
    .from('establishments')
    .update({
      mercadopago_access_token: newAccessToken,
      mercadopago_refresh_token: newRefreshToken,
      mercadopago_token_expires_at: newExpiresAt,
    } as any)
    .eq('id', establishmentId);

  console.log('✅ [MP Check Status] access_token renovado automaticamente', { establishmentId });
  return newAccessToken;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
  }

  try {
    const paymentId = getQueryParam(event, 'paymentId');
    const establishmentId = getQueryParam(event, 'establishmentId');

    if (!paymentId || !establishmentId) {
      return json(400, {
        error: 'paymentId e establishmentId são obrigatórios',
      });
    }

    // Buscar access_token do estabelecimento
    if (!supabaseAdmin) {
      return json(500, {
        error: 'Supabase admin não configurado',
      });
    }

    // Estabelecimento sem Mercado Pago: o pagamento foi criado pela conta da
    // plataforma, então a consulta também é feita com o token da plataforma.
    let accessToken: string;
    let collectedByPlatform = false;
    try {
      accessToken = await getValidMercadoPagoAccessToken(String(establishmentId));
    } catch (e: any) {
      const msg = String(e?.message || 'Falha ao obter token do Mercado Pago');
      // Aqui é só CONSULTA (não cobra nada): se o token da barbearia não serve — sem conta,
      // ou MP caiu (refresh recusado) e o create-payment cobrou pela PLATAFORMA — consulta
      // com o token da plataforma. Antes só caía aqui sem conta, e com MP caído o cliente
      // pagava e via "tempo limite" (o pagamento estava na conta da plataforma).
      const platformToken = getPlatformMercadoPagoAccessToken();
      if (!platformToken) {
        return json(400, { error: msg });
      }
      accessToken = platformToken;
      collectedByPlatform = true;
    }

    // Verificar status
    let payment: Awaited<ReturnType<typeof checkMPPaymentStatus>>;
    try {
      payment = await checkMPPaymentStatus(Number(paymentId), String(accessToken));
    } catch (fetchErr) {
      // Estabelecimento conectou o MP depois de um pagamento criado pela conta da
      // plataforma: o token dele não enxerga esse pagamento — tenta com o da plataforma.
      const platformToken = collectedByPlatform ? '' : getPlatformMercadoPagoAccessToken();
      if (!platformToken) throw fetchErr;
      payment = await checkMPPaymentStatus(Number(paymentId), platformToken);
    }

    // Pagamento pela plataforma aprovado (metadata.collector = 'platform'): credita a
    // carteira do estabelecimento (idempotente; o webhook faz o mesmo — quem chegar primeiro grava).
    if (isPlatformCollectedPayment(payment) && supabaseAdmin) {
      const appointmentId = String((payment as any)?.metadata?.appointment_id || '').trim() || null;
      await recordPlatformCollectedPayment(supabaseAdmin, {
        establishmentId: String(establishmentId),
        appointmentId,
        payment,
      });
      // Ledger "Meus R$1": não depende do webhook chegar (mesma source_key, sem duplicar).
      const st = String((payment as any)?.status || '').toLowerCase();
      if ((st === 'approved' || st === 'authorized') && appointmentId) {
        const methodId = String((payment as any)?.payment_method_id || '').toLowerCase();
        await recordAdminMpCommission(supabaseAdmin, {
          establishmentId: String(establishmentId),
          sourceType: 'appointment',
          sourceId: appointmentId,
          paymentId: String(paymentId),
          externalReference: String((payment as any)?.external_reference || '') || null,
          paymentMethod: methodId === 'pix' ? 'pix' : 'credito',
          grossAmountCents: Math.round(Number((payment as any)?.transaction_amount || 0) * 100) || null,
          paidAt: String((payment as any)?.date_approved || (payment as any)?.date_created || '') || null,
          metadata: {
            origin: 'mercadopago_check_status_platform',
            payment_status: (payment as any)?.status || null,
            payment_method_id: (payment as any)?.payment_method_id || null,
            collector: 'platform',
          },
        });
      }
    }

    return json(200, payment);
  } catch (error: any) {
    console.error('❌ [MP Check Status] Erro:', error);
    return json(500, {
      error: error.message || 'Erro ao verificar status do pagamento',
    });
  }
};
