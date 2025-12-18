import type { Handler } from '@netlify/functions';
import { checkPaymentStatus } from '../../src/lib/pagarme-server';
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
    const result = await checkPaymentStatus(orderId);
    return json(200, result);
  } catch (error: any) {
    return json(500, { error: error.message || 'Erro ao verificar status do pagamento' });
  }
};


