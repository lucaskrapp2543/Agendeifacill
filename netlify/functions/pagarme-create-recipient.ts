import type { Handler } from '@netlify/functions';
import { createRecipient } from '../../src/lib/pagarme-server';
import { json, parseJsonBody } from './_utils';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  const body = parseJsonBody<any>(event) || {};
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
  } = body;

  if (!cpfCnpj || !bankName || !agency || !account || !legalName || !email || !phone) {
    return json(400, {
      error: 'Dados bancários incompletos',
      required: ['cpfCnpj', 'bankName', 'agency', 'account', 'legalName', 'email', 'phone'],
    });
  }

  try {
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
    });

    return json(200, result);
  } catch (error: any) {
    const rawMessage: string = error?.message || 'Erro ao criar recebedor na Pagar.me';
    const isValidationError =
      typeof rawMessage === 'string' &&
      (rawMessage.includes('obrigatório') ||
        rawMessage.includes('deve ter') ||
        rawMessage.toLowerCase().includes('inválida') ||
        rawMessage.toLowerCase().includes('invalida'));
    const isActionForbidden =
      typeof rawMessage === 'string' &&
      (rawMessage.includes('action_forbidden') ||
        rawMessage.toLowerCase().includes('not allowed to create a recipient'));

    const details = (error as any)?.__capturedDetails || (error as any)?.pagarmeErrorDetails || (error as any)?.response?.data;
    const statusCode = isValidationError ? 400 : isActionForbidden ? 403 : 500;

    return json(statusCode, {
      error: rawMessage,
      userMessage:
        rawMessage === 'PAGARME_SECRET_KEY não configurada no servidor'
          ? 'A chave PAGARME_SECRET_KEY não está disponível para as Netlify Functions. Verifique as variáveis no Netlify (escopo Functions) e faça um novo deploy.'
          : isActionForbidden
            ? 'Sua conta Pagar.me não tem permissão para criar recebedor (Recipient/Marketplace). Normalmente é necessário: conta aprovada/ativa em produção e habilitação de Marketplace/Recipients (split).'
            : undefined,
      details,
    });
  }
};


