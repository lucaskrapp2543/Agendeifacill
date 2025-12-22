/**
 * API Route: Criar pagamento na Pagar.me
 * 
 * Esta rota deve ser chamada apenas do servidor/backend
 * Nunca exponha a chave PAGARME_SECRET_KEY ao frontend!
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createPayment } from '../../../lib/pagarme-server';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      amount,
      payment_method,
      customer,
      split,
      metadata,
    } = req.body;

    // Validação
    if (!amount || !payment_method || !customer?.name) {
      return res.status(400).json({ 
        error: 'Dados do pagamento incompletos',
        required: ['amount', 'payment_method', 'customer.name']
      });
    }

    // Criar pagamento
    const result = await createPayment({
      amount: Math.round(amount * 100), // Converter para centavos
      payment_method,
      customer: {
        name: customer.name,
        email: customer.email,
        document: customer.document?.replace(/\D/g, ''),
        phones: customer.phone ? {
          mobile_phone: {
            country_code: '55',
            area_code: customer.phone.substring(0, 2),
            number: customer.phone.substring(2).replace(/\D/g, ''),
          },
        } : undefined,
      },
      split,
      metadata,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ Erro ao criar pagamento:', error);
    return res.status(500).json({ 
      error: error.message || 'Erro ao processar pagamento' 
    });
  }
}







