import type { Handler } from '@netlify/functions';
import { createPayment, getRecipientStatus } from '../../src/lib/pagarme-server';
import { json, parseJsonBody } from './_utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  const body = parseJsonBody<any>(event) || {};
  const { amount, payment_method, customer, split_rules, metadata } = body;

  if (!amount || !payment_method || !customer?.name) {
    return json(400, {
      error: 'Dados do pagamento incompletos',
      required: ['amount', 'payment_method', 'customer.name'],
    });
  }

  const platformRecipientId = String(process.env.PAGARME_PLATFORM_RECIPIENT_ID || '').trim();
  const platformFeeCents = Number(process.env.PLATFORM_FEE_CENTS || 100); // padrão: R$ 1,00
  const amountCents = Math.round(Number(amount));
  const barberRecipientId = String(split_rules?.[0]?.recipient_id || '').trim();

  // Guardrail: impedir pagamento antecipado enquanto o recebedor ainda está em afiliação/pendente.
  if (barberRecipientId) {
    try {
      const recipient = await getRecipientStatus(barberRecipientId);
      const normalizedStatus = String((recipient as any)?.status || '').toLowerCase();
      if (normalizedStatus !== 'active') {
        return json(400, {
          error: 'Recebedor do estabelecimento ainda não está ativo',
          userMessage:
            'O recebedor do estabelecimento ainda está em análise/afiliação (Pagar.me). Para evitar problemas no repasse, finalize a ativação do recebedor e tente novamente.',
          details: { recipient_status: normalizedStatus },
        });
      }
    } catch {
      // Se falhar, não bloqueia: mantém o mesmo comportamento do backend local
    }
  }

  if (platformRecipientId && barberRecipientId && platformRecipientId === barberRecipientId) {
    return json(400, {
      error: 'Recebedor do estabelecimento inválido',
      userMessage:
        'O recebedor do estabelecimento não pode ser o mesmo da plataforma (AgendeiFácil). Cadastre/seleciona um recebedor diferente para a barbearia e tente novamente.',
      details: {
        platformRecipientIdPreview: `${platformRecipientId.slice(0, 6)}...${platformRecipientId.slice(-4)}`,
      },
    });
  }

  // Split (plataforma + estabelecimento)
  let split =
    split_rules?.map((rule: any) => ({
      recipient_id: rule.recipient_id,
      amount: rule.amount,
      type: 'flat' as const,
      liable: rule.liable ?? true,
      charge_processing_fee: rule.charge_processing_fee ?? false,
      charge_remainder_fee: rule.charge_remainder_fee ?? true,
    })) || [];

  if (platformRecipientId && barberRecipientId) {
    if (amountCents <= platformFeeCents) {
      return json(400, {
        error: 'Valor do pagamento é muito baixo para aplicar a taxa da plataforma.',
        details: { amountCents, platformFeeCents },
      });
    }

    const barberAmountCents = amountCents - platformFeeCents;
    split = [
      {
        recipient_id: platformRecipientId,
        amount: platformFeeCents,
        type: 'flat' as const,
        liable: false,
        charge_processing_fee: false,
        charge_remainder_fee: false,
      },
      {
        recipient_id: barberRecipientId,
        amount: barberAmountCents,
        type: 'flat' as const,
        liable: true,
        charge_processing_fee: true,
        charge_remainder_fee: true,
      },
    ];
  }

  try {
    const cleanDocument = customer.document?.replace(/\D/g, '') || undefined;
    const customerType =
      cleanDocument && cleanDocument.length === 11
        ? 'individual'
        : cleanDocument && cleanDocument.length === 14
          ? 'company'
          : undefined;

    const result = await createPayment({
      amount: amountCents,
      payment_method,
      customer: {
        name: customer.name,
        email: customer.email,
        document: cleanDocument,
        ...(customerType ? { type: customerType } : {}),
        phones: customer.phone
          ? {
              mobile_phone: {
                country_code: '55',
                area_code: String(customer.phone).replace(/\D/g, '').substring(0, 2),
                number: String(customer.phone).replace(/\D/g, '').substring(2),
              },
            }
          : undefined,
      },
      split,
      metadata,
    });

    return json(200, result);
  } catch (error: any) {
    const details = (error as any)?.__capturedDetails || (error as any)?.pagarmeErrorDetails || undefined;
    const isTimeout = (error as any)?.code === 'PAGARME_TIMEOUT' || String(error?.message || '').toLowerCase().includes('timeout');
    return json(isTimeout ? 504 : 500, {
      error: error.message || 'Erro ao processar pagamento',
      userMessage: isTimeout ? 'O servidor de pagamentos demorou demais para responder. Tente novamente em alguns segundos.' : undefined,
      details,
    });
  }
};


