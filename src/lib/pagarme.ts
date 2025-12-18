// Integração com Pagar.me para pagamentos antecipados

const PAGARME_API_KEY = import.meta.env.VITE_PAGARME_API_KEY || '';
const PAGARME_API_URL = 'https://api.pagar.me/1';

interface CreateRecipientData {
  bank_account: {
    bank_code: string;
    agencia: string;
    agencia_dv?: string;
    conta: string;
    conta_dv?: string;
    type: 'conta_corrente' | 'conta_poupanca';
    document_number: string; // CPF ou CNPJ
    legal_name: string; // Nome do titular
  };
  transfer_enabled?: boolean;
  transfer_interval?: 'Daily' | 'Weekly' | 'Monthly';
  transfer_day?: number;
  automatic_anticipation_enabled?: boolean;
}

interface CreatePaymentData {
  amount: number; // Valor em centavos
  payment_method: 'pix' | 'credit_card' | 'debit_card';
  customer: {
    name: string;
    email?: string;
    document_number?: string;
    phone?: {
      ddd: string;
      number: string;
    };
  };
  split_rules: Array<{
    recipient_id: string;
    amount: number; // Valor em centavos
    liable?: boolean;
    charge_processing_fee?: boolean;
  }>;
  metadata?: Record<string, any>;
}

/**
 * Cria uma conta de recebimento na Pagar.me
 */
export async function createPagarMeRecipient(
  bankData: {
    cpfCnpj: string;
    bankName: string;
    agency: string;
    account: string;
    accountType?: 'conta_corrente' | 'conta_poupanca';
    legalName: string;
  }
): Promise<{ recipient_id: string }> {
  if (!PAGARME_API_KEY) {
    throw new Error('Chave da API Pagar.me não configurada');
  }

  // Mapear nome do banco para código do banco (exemplos comuns)
  const bankCodeMap: Record<string, string> = {
    'banco do brasil': '001',
    'bradesco': '237',
    'itau': '341',
    'santander': '033',
    'caixa': '104',
    'banrisul': '041',
    'sicredi': '748',
    'inter': '077',
    'nubank': '260',
    'original': '212',
    'neon': '735',
  };

  const bankNameLower = bankData.bankName.toLowerCase();
  let bankCode = '001'; // Default: Banco do Brasil

  // Tentar encontrar o código do banco
  for (const [key, code] of Object.entries(bankCodeMap)) {
    if (bankNameLower.includes(key)) {
      bankCode = code;
      break;
    }
  }

  // Se não encontrou, tentar extrair números do nome
  const bankCodeMatch = bankNameLower.match(/\d{3}/);
  if (bankCodeMatch) {
    bankCode = bankCodeMatch[0];
  }

  // Separar agência e dígito
  const agencyParts = bankData.agency.replace(/\D/g, '');
  const agency = agencyParts.slice(0, -1) || agencyParts;
  const agencyDv = agencyParts.length > 1 ? agencyParts.slice(-1) : undefined;

  // Separar conta e dígito
  const accountParts = bankData.account.replace(/\D/g, '');
  const account = accountParts.slice(0, -1) || accountParts;
  const accountDv = accountParts.length > 1 ? accountParts.slice(-1) : undefined;

  // Determinar se é CPF ou CNPJ
  const documentNumber = bankData.cpfCnpj.replace(/\D/g, '');
  const isCNPJ = documentNumber.length === 14;

  const recipientData: CreateRecipientData = {
    bank_account: {
      bank_code: bankCode,
      agencia: agency,
      agencia_dv: agencyDv,
      conta: account,
      conta_dv: accountDv,
      type: bankData.accountType || 'conta_corrente',
      document_number: documentNumber,
      legal_name: bankData.legalName,
    },
    transfer_enabled: true,
    transfer_interval: 'Daily',
    automatic_anticipation_enabled: true,
  };

  try {
    const response = await fetch(`${PAGARME_API_URL}/recipients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
      },
      body: JSON.stringify(recipientData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      console.error('❌ Erro ao criar recebedor na Pagar.me:', errorData);
      throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Recebedor criado na Pagar.me:', data.id);

    return { recipient_id: data.id };
  } catch (error: any) {
    console.error('❌ Erro ao criar recebedor na Pagar.me:', error);
    throw new Error(`Erro ao criar conta na Pagar.me: ${error.message}`);
  }
}

/**
 * Cria um pagamento na Pagar.me
 */
export async function createPagarMePayment(
  paymentData: CreatePaymentData
): Promise<{ id: string; status: string; pix_qr_code?: string; pix_qr_code_url?: string }> {
  if (!PAGARME_API_KEY) {
    throw new Error('Chave da API Pagar.me não configurada');
  }

  try {
    const response = await fetch(`${PAGARME_API_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      console.error('❌ Erro ao criar pagamento na Pagar.me:', errorData);
      throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Pagamento criado na Pagar.me:', data.id);

    return {
      id: data.id,
      status: data.status,
      pix_qr_code: data.pix_qr_code,
      pix_qr_code_url: data.pix_qr_code_url,
    };
  } catch (error: any) {
    console.error('❌ Erro ao criar pagamento na Pagar.me:', error);
    throw new Error(`Erro ao processar pagamento: ${error.message}`);
  }
}

/**
 * Verifica o status de um pagamento
 */
export async function checkPaymentStatus(transactionId: string): Promise<{ status: string }> {
  if (!PAGARME_API_KEY) {
    throw new Error('Chave da API Pagar.me não configurada');
  }

  try {
    const response = await fetch(`${PAGARME_API_URL}/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(PAGARME_API_KEY + ':')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { status: data.status };
  } catch (error: any) {
    console.error('❌ Erro ao verificar status do pagamento:', error);
    throw new Error(`Erro ao verificar pagamento: ${error.message}`);
  }
}




