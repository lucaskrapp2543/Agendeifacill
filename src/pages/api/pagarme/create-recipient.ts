/**
 * API Route: Criar recebedor na Pagar.me
 * 
 * Esta rota deve ser chamada apenas do servidor/backend
 * Nunca exponha a chave PAGARME_SECRET_KEY ao frontend!
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createRecipient } from '../../../lib/pagarme-server';

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
      cpfCnpj,
      bankName,
      agency,
      account,
      accountType,
      legalName,
      email,
      phone,
      // Campos extras para CPF (individual)
      registerName,
      birthdate,
      monthlyIncome,
      professionalOccupation,
      address,
      // Campos extras para CNPJ (corporation)
      annualRevenue,
      mainAddress,
      managingPartners,
    } = req.body || {};

    // Validação
    if (!cpfCnpj || !bankName || !agency || !account || !legalName || !email || !phone) {
      return res.status(400).json({ 
        error: 'Dados bancários incompletos',
        required: ['cpfCnpj', 'bankName', 'agency', 'account', 'legalName', 'email', 'phone']
      });
    }

    // Criar recebedor
    const result = await createRecipient({
      cpfCnpj,
      bankName,
      agency,
      account,
      accountType: accountType || 'conta_corrente',
      legalName,
      email,
      phone,
      registerName,
      birthdate,
      monthlyIncome,
      professionalOccupation,
      address,
      annualRevenue,
      mainAddress,
      managingPartners,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ Erro ao criar recebedor:', error);

    const rawMessage: string = error?.message || 'Erro ao criar recebedor na Pagar.me';
    const details =
      (error as any)?.__capturedDetails || (error as any)?.pagarmeErrorDetails || (error as any)?.response?.data;

    return res.status(500).json({
      error: rawMessage,
      details,
    });
  }
}








