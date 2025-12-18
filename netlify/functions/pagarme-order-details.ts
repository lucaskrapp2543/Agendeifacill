import type { Handler } from '@netlify/functions';
import { getOrderDetails } from '../../src/lib/pagarme-server';
import { getQueryParam, json } from './_utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
  }

  const orderId = getQueryParam(event, 'orderId');
  if (!orderId) {
    return json(400, { error: 'orderId é obrigatório' });
  }

  try {
    const details = await getOrderDetails(orderId);
    const splitMasked = (details.split || []).map((s: any) => ({
      ...s,
      recipient_id: s.recipient_id ? `${s.recipient_id.slice(0, 6)}...${s.recipient_id.slice(-4)}` : s.recipient_id,
    }));

    return json(200, {
      id: details.id,
      status: details.status,
      amount: details.amount,
      created_at: details.created_at,
      closed_at: details.closed_at,
      charge: details.charge,
      split: splitMasked,
      metadata: details.metadata,
    });
  } catch (error: any) {
    const details = (error as any)?.__capturedDetails || undefined;
    return json(500, { error: error.message || 'Erro ao buscar detalhes do pedido', details });
  }
};


