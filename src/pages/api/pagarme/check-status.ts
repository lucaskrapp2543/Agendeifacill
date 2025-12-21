/**
 * API Route: Verificar status de pagamento
 * 
 * Esta rota deve ser chamada apenas do servidor/backend
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { checkPaymentStatus } from '../../../lib/pagarme-server';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas GET ou POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const orderId = req.query.orderId || req.body.orderId;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ 
        error: 'orderId é obrigatório' 
      });
    }

    // Verificar status
    const result = await checkPaymentStatus(orderId);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ Erro ao verificar status:', error);
    return res.status(500).json({ 
      error: error.message || 'Erro ao verificar status do pagamento' 
    });
  }
}





