import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { json } from './_utils';

const PENDING_PAYMENT_NO_TX_MINUTES = 15;
const PENDING_PAYMENT_WITH_TX_MINUTES = 12 * 60;

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, null);
  }

  const token = event.queryStringParameters?.token
    || event.headers?.['x-cron-token']
    || event.headers?.authorization?.replace('Bearer ', '');
  const expectedToken = process.env.CLEANUP_PENDING_PAYMENTS_TOKEN || process.env.WHATSAPP_REMINDERS_MASTER_KEY;

  if (expectedToken && token !== expectedToken) {
    return json(401, { error: 'Token inválido' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return json(500, { error: 'Supabase não configurado' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const thresholdNoTxDate = new Date(Date.now() - PENDING_PAYMENT_NO_TX_MINUTES * 60 * 1000).toISOString();
  const thresholdWithTxDate = new Date(Date.now() - PENDING_PAYMENT_WITH_TX_MINUTES * 60 * 1000).toISOString();

  let cancelledNoTx = 0;
  let cancelledWithTx = 0;

  // 1) Sem transaction_id — cliente nunca iniciou pagamento (15 min)
  const { data: noTxData } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      payment_status: 'failed',
      cancellation_source: 'system_abandoned_checkout',
      cancellation_detail: `Limpeza automática: pagamento obrigatório não iniciado (sem ID de transação) por mais de ${PENDING_PAYMENT_NO_TX_MINUTES} min.`,
    } as any)
    .eq('status', 'pending_payment')
    .is('payment_transaction_id', null)
    .lt('created_at', thresholdNoTxDate)
    .select('id');

  cancelledNoTx = noTxData?.length || 0;

  // 2) Com transaction_id — pagamento iniciado mas não confirmado (12h)
  const { data: staleWithTx } = await supabase
    .from('appointments')
    .select('id,payment_status,pix_payment_status')
    .eq('status', 'pending_payment')
    .not('payment_transaction_id', 'is', null)
    .lt('created_at', thresholdWithTxDate);

  if (staleWithTx && staleWithTx.length > 0) {
    const idsToCancel = staleWithTx
      .filter((row: any) => {
        const ps = String(row?.payment_status || '').toLowerCase();
        const pix = String(row?.pix_payment_status || '').toLowerCase();
        return ps !== 'paid' && pix !== 'confirmado' && pix !== 'aprovado';
      })
      .map((row: any) => row.id)
      .filter(Boolean);

    if (idsToCancel.length > 0) {
      await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          payment_status: 'failed',
          cancellation_source: 'system_payment_timeout',
          cancellation_detail: `Limpeza automática: pagamento iniciado mas não confirmado por mais de ${PENDING_PAYMENT_WITH_TX_MINUTES} min (~${Math.round(PENDING_PAYMENT_WITH_TX_MINUTES / 60)}h).`,
        } as any)
        .in('id', idsToCancel);

      cancelledWithTx = idsToCancel.length;
    }
  }

  return json(200, {
    ok: true,
    cancelledNoTx,
    cancelledWithTx,
    total: cancelledNoTx + cancelledWithTx,
    timestamp: new Date().toISOString(),
  });
};

export { handler };
