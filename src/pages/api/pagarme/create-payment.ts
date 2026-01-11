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
      split_rules,
      metadata,
      card,
    } = req.body;

    // Validação
    if (!amount || !payment_method || !customer?.name) {
      return res.status(400).json({ 
        error: 'Dados do pagamento incompletos',
        required: ['amount', 'payment_method', 'customer.name']
      });
    }

    // No frontend o amount já vem em CENTAVOS. (No passado este endpoint multiplicava por 100)
    const amountCents = Math.round(Number(amount));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        error: 'Valor inválido',
        userMessage: 'Valor do pagamento inválido.',
      });
    }

    // Montar split compatível com pagarme-server
    const rawSplitRules = Array.isArray(split) ? split : Array.isArray(split_rules) ? split_rules : [];
    const normalizedSplit =
      rawSplitRules.length > 0
        ? rawSplitRules.map((rule: any) => ({
            recipient_id: rule.recipient_id,
            amount: Math.round(Number(rule.amount)),
            type: 'flat' as const,
            liable: rule.liable ?? true,
            charge_processing_fee: rule.charge_processing_fee ?? false,
            charge_remainder_fee: rule.charge_remainder_fee ?? true,
          }))
        : undefined;

    // Cartão: normalizar dados e exigir documento (muitos PSPs exigem)
    const pm = String(payment_method);
    const isCard = pm === 'credit_card' || pm === 'debit_card';
    const cleanDocument = customer.document?.replace(/\D/g, '') || undefined;
    if (isCard && (!cleanDocument || (cleanDocument.length !== 11 && cleanDocument.length !== 14))) {
      return res.status(400).json({
        error: 'Documento inválido',
        userMessage: 'Informe um CPF/CNPJ válido para pagar no cartão.',
      });
    }

    const normalizeExpYear = (yy: string) => {
      const digits = String(yy || '').replace(/\D/g, '');
      if (digits.length === 2) return `20${digits}`;
      return digits;
    };

    // Criar pagamento
    const result = await createPayment({
      amount: amountCents, // já em centavos
      payment_method: pm as any,
      customer: {
        name: customer.name,
        email: customer.email,
        document: cleanDocument,
        phones: customer.phone ? {
          mobile_phone: {
            country_code: '55',
            area_code: customer.phone.substring(0, 2),
            number: customer.phone.substring(2).replace(/\D/g, ''),
          },
        } : undefined,
      },
      split: normalizedSplit,
      metadata,
      ...(isCard
        ? {
            card: {
              number: String(card?.number || '').replace(/\D/g, ''),
              holder_name: String(card?.holder_name || '').trim(),
              exp_month: String(card?.exp_month || '').replace(/\D/g, ''),
              exp_year: normalizeExpYear(String(card?.exp_year || '')),
              cvv: String(card?.cvv || '').replace(/\D/g, ''),
            },
          }
        : {}),
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ Erro ao criar pagamento:', error);
    const details = (error as any)?.__capturedDetails || undefined;
    return res.status(500).json({ 
      error: error.message || 'Erro ao processar pagamento',
      details,
    });
  }
}








