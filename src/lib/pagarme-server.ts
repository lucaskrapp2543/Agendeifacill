/**
 * Integração com Pagar.me v5 - BACKEND ONLY
 * 
 * ⚠️ IMPORTANTE: Este arquivo NUNCA deve ser importado no frontend!
 * A chave secreta da API nunca deve ser exposta ao cliente.
 * 
 * Use este arquivo apenas em:
 * - Edge Functions do Supabase
 * - Serverless Functions (Vercel, Netlify)
 * - API Routes do Next.js
 * - Qualquer ambiente de servidor
 */

// Variável de ambiente do SERVIDOR (não do frontend)
// Nota: Esta variável é lida quando o módulo é importado
// Certifique-se de que dotenv.config() foi chamado antes de importar este módulo
let PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY || '';

// Função para obter a chave (permite recarregar após dotenv)
export function getPagarMeSecretKey(): string {
  return process.env.PAGARME_SECRET_KEY || '';
}

// API Pagar.me v5
// IMPORTANTE: Verificar se a URL está correta na documentação oficial
const PAGARME_API_URL = 'https://api.pagar.me/core/v5';

/**
 * Fetch com timeout (evita ficar "carregando para sempre" quando a Pagar.me demora/trava)
 */
async function fetchJsonWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<{ ok: true; status: number; data: any } | { ok: false; status: number; data: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw ? { raw } : null;
    }

    if (!response.ok) {
      return { ok: false, status: response.status, data };
    }

    return { ok: true, status: response.status, data };
  } catch (err: any) {
    // AbortError costuma acontecer quando estoura o timeout
    if (err?.name === 'AbortError') {
      const error: any = new Error('Timeout ao comunicar com a Pagar.me. Tente novamente em alguns segundos.');
      error.code = 'PAGARME_TIMEOUT';
      throw error;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tokenizar cartão (Core v5)
 * A API de cartão exige card_token/card_id/network_token/card_payment_payload.
 * Vamos gerar um card_token a partir dos dados do cartão e usá-lo no pedido.
 */
async function createCardToken(client: ReturnType<typeof createPagarMeClient>, card: {
  number: string;
  holder_name: string;
  exp_month: string;
  exp_year: string;
  cvv: string;
}): Promise<string> {
  // A rota /tokens não aceita a mesma auth do Core v5 (secret key) em várias contas.
  // Normalmente ela exige a ENCRYPTION_KEY (pública) da Pagar.me.
  const encryptionKey = String(
    process.env.PAGARME_ENCRYPTION_KEY ||
      process.env.PAGARME_PUBLIC_KEY ||
      process.env.VITE_PAGARME_ENCRYPTION_KEY ||
      ''
  ).trim();

  if (!encryptionKey) {
    const error: any = new Error(
      'Cartão indisponível: configure PAGARME_ENCRYPTION_KEY (chave pública de criptografia) no servidor.'
    );
    error.name = 'PagarMeError';
    error.__capturedDetails = {
      step: 'tokenize_card',
      missingEnv: ['PAGARME_ENCRYPTION_KEY'],
    };
    throw error;
  }

  // Guardrail: muita gente confunde e cola a "Chave pública" (pk_) aqui.
  // Para tokenização (/tokens), a Pagar.me normalmente exige a "Encryption Key" (geralmente ek_).
  if (encryptionKey.startsWith('pk_')) {
    const error: any = new Error(
      'Cartão indisponível: você configurou uma chave pk_ (chave pública). Para tokenizar cartão, configure a Encryption Key (geralmente começa com ek_).'
    );
    error.name = 'PagarMeError';
    error.__capturedDetails = {
      step: 'tokenize_card',
      wrongKeyPrefix: 'pk_',
      expectedPrefixHint: 'ek_',
    };
    throw error;
  }

  // Auth do token: Basic base64(encryptionKey + ":")
  const tokenAuthHeader = `Basic ${Buffer.from(`${encryptionKey}:`).toString('base64')}`;

  const requestBody: any = {
    type: 'card',
    card: {
      number: card.number,
      holder_name: card.holder_name,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      cvv: card.cvv,
    },
  };

  const result = await fetchJsonWithTimeout(
    `${client.baseURL}/tokens`,
    {
      method: 'POST',
      headers: {
        ...client.headers,
        Authorization: tokenAuthHeader,
      },
      body: JSON.stringify(requestBody),
    },
    20000
  );

  if (!result.ok) {
    console.error('❌ Erro ao tokenizar cartão na Pagar.me:', result.data);
    const error: any = new Error(result.data?.message || `Erro ${result.status} ao tokenizar cartão`);
    error.name = 'PagarMeError';
    error.__capturedDetails = {
      status: result.status,
      response: result.data,
      requestBody,
      step: 'tokenize_card',
    };
    throw error;
  }

  const tokenId = result.data?.id || result.data?.token || result.data?.card_token;
  if (!tokenId) {
    const error: any = new Error('Token do cartão não retornado pela Pagar.me');
    error.name = 'PagarMeError';
    error.__capturedDetails = { response: result.data, step: 'tokenize_card' };
    throw error;
  }

  return String(tokenId);
}

/**
 * Verifica se a chave da API está configurada
 */
function validateApiKey(): void {
  // Sempre ler do process.env diretamente (em caso de carregamento tardio do dotenv)
  const key = process.env.PAGARME_SECRET_KEY || PAGARME_SECRET_KEY;
  if (!key) {
    console.error('❌ PAGARME_SECRET_KEY não encontrada!');
    console.error('   process.env.PAGARME_SECRET_KEY:', process.env.PAGARME_SECRET_KEY ? 'existe' : 'NÃO existe');
    throw new Error('PAGARME_SECRET_KEY não configurada no servidor');
  }
}

/**
 * Cria o cliente HTTP para requisições à Pagar.me v5
 */
function createPagarMeClient() {
  validateApiKey();

  // Sempre usar process.env diretamente
  const key = process.env.PAGARME_SECRET_KEY || PAGARME_SECRET_KEY;

  return {
    baseURL: PAGARME_API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
    },
  };
}

/**
 * Interface para dados bancários
 */
export interface BankAccountData {
  bank_code: string;
  agencia: string;
  agencia_dv?: string;
  conta: string;
  conta_dv?: string;
  type: 'conta_corrente' | 'conta_poupanca';
  document_number: string; // CPF ou CNPJ
  legal_name: string; // Nome do titular
}

/**
 * Interface para criar recebedor
 */
export interface CreateRecipientRequest {
  bank_account: BankAccountData;
  transfer_enabled?: boolean;
  transfer_interval?: 'Daily' | 'Weekly' | 'Monthly';
  transfer_day?: number;
  automatic_anticipation_enabled?: boolean;
}

/**
 * Interface para resposta de criação de recebedor
 */
export interface CreateRecipientResponse {
  id: string;
  status: string;
  bank_account: BankAccountData;
  transfer_settings?: {
    transfer_enabled: boolean;
    transfer_interval: string;
    transfer_day?: number;
  };
}

/**
 * Interface para criar pagamento
 */
export interface CreatePaymentRequest {
  amount: number; // Valor em centavos
  payment_method: 'pix' | 'credit_card' | 'debit_card';
  customer: {
    name: string;
    email?: string;
    document?: string;
    phones?: {
      mobile_phone?: {
        country_code: string;
        area_code: string;
        number: string;
      };
    };
  };
  split?: Array<{
    recipient_id: string;
    amount: number; // Valor em centavos
    type: 'flat' | 'percentage';
    liable?: boolean;
    charge_processing_fee?: boolean;
    // Na Pagar.me, pelo menos 1 recebedor deve ser responsável pela "taxa de resto"
    // (centavos residuais / arredondamentos / etc). Em muitos casos o "principal" (estabelecimento) assume.
    charge_remainder_fee?: boolean;
  }>;
  metadata?: Record<string, string>;
  /**
   * Token do cartão gerado no FRONTEND (Core v5 /tokens?appId=pk_...).
   * Ex: "token_xxxxx" (como retorna na doc).
   *
   * Quando presente, evita a necessidade de tokenizar no servidor (ek_).
   */
  card_token?: string;
  /**
   * Endereço de cobrança (billing) — exigido para cartão em várias contas Pagar.me.
   * Campos mínimos comuns: line_1, zip_code, city, state, country.
   */
  billing_address?: {
    line_1: string;
    zip_code: string;
    city: string;
    state: string; // UF (2 letras) em BR
    country: string; // "BR"
  };
  // Dados do cartão (quando payment_method = credit_card/debit_card)
  card?: {
    number: string;
    holder_name: string;
    exp_month: string;
    exp_year: string;
    cvv: string;
  };
}

/**
 * Interface para resposta de pagamento
 */
export interface CreatePaymentResponse {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
  amount: number;
  currency: string;
  payment_method: string;
  pix?: {
    qr_code?: string;
    qr_code_url?: string;
  };
  charges?: Array<{
    id: string;
    status: string;
    amount: number;
  }>;
}

/**
 * Cria uma conta de recebimento (recipient) na Pagar.me v5
 * 
 * @param bankData - Dados bancários do recebedor
 * @returns ID do recebedor criado
 */
export async function createRecipient(
  bankData: {
    cpfCnpj: string;
    bankName: string;
    agency: string;
    account: string;
    accountType?: 'conta_corrente' | 'conta_poupanca';
    legalName: string;
    email: string;
    phone?: string; // whatsapp/telefone do estabelecimento (para register_information.phone_numbers)
    // Campos adicionais exigidos pela Pagar.me quando type = individual
    registerName?: string;
    birthdate?: string; // YYYY-MM-DD
    monthlyIncome?: number; // em centavos
    professionalOccupation?: string;
    address?: {
      zip_code?: string;
      street?: string;
      street_number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      country?: string;
      complementary?: string;
      reference_point?: string;
    };
  }
): Promise<{ recipient_id: string; errorDetails?: any }> {
  validateApiKey();

  const client = createPagarMeClient();

  // Mapear nome do banco para código do banco
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
    'nu bank': '260',
    'nu': '260',
    'original': '212',
    'neon': '735',
  };

  const bankNameLower = bankData.bankName.toLowerCase().trim();
  let bankCode = '001'; // Default: Banco do Brasil

  // Tentar encontrar o código do banco
  for (const [key, code] of Object.entries(bankCodeMap)) {
    if (bankNameLower.includes(key) || key.includes(bankNameLower)) {
      bankCode = code;
      console.log(`🏦 Banco "${bankData.bankName}" mapeado para código: ${bankCode}`);
      break;
    }
  }

  // Se não encontrou, avisar
  if (bankCode === '001' && !bankNameLower.includes('banco do brasil')) {
    console.warn(`⚠️ Banco "${bankData.bankName}" não encontrado no mapeamento, usando código padrão 001`);
  }

  // Separar agência e dígito
  const agencyParts = bankData.agency.replace(/\D/g, '');
  let agency = agencyParts;
  let agencyDv: string | undefined = undefined;
  
  // Para Nubank (260), agência é sempre "0001" sem dígito verificador
  if (bankCode === '260') {
    agency = '0001';
    agencyDv = undefined;
  } else if (agencyParts.length > 4) {
    // Para outros bancos, se tiver mais de 4 dígitos, o último pode ser o DV
    agency = agencyParts.slice(0, -1);
    agencyDv = agencyParts.slice(-1);
  }
  
  console.log(`🏦 Agência processada: "${agency}" (DV: ${agencyDv || 'não informado'})`);

  // Separar conta e dígito
  const accountParts = bankData.account.replace(/\D/g, '');
  let account = accountParts;
  let accountDv: string | undefined = undefined;
  
  // A Pagar.me v5 pode exigir o dígito verificador da conta (account_check_digit).
  // Para Nubank (260), normalmente o DV é o ÚLTIMO dígito da conta informada (ex.: 75828718-2).
  if (bankCode === '260') {
    if (accountParts.length >= 2) {
      account = accountParts.slice(0, -1);
      accountDv = accountParts.slice(-1);
    }
  } else if (accountParts.length > 8) {
    // Para outros bancos, se tiver mais de 8 dígitos, o último pode ser o DV
    account = accountParts.slice(0, -1);
    accountDv = accountParts.slice(-1);
  }
  
  console.log(`💳 Conta processada: "${account}" (DV: ${accountDv || 'não informado'})`);

  // Limpar CPF/CNPJ
  const documentNumber = bankData.cpfCnpj.replace(/\D/g, '');
  const phoneRaw = (bankData.phone || '').trim();
  const phoneDigitsOriginal = phoneRaw.replace(/\D/g, '');
  const phoneDigits =
    phoneDigitsOriginal.startsWith('55') && phoneDigitsOriginal.length > 11
      ? phoneDigitsOriginal.slice(2)
      : phoneDigitsOriginal;

  // Extrair DDD + número (para register_information.phone_numbers)
  let phoneDdd: string | null = null;
  let phoneNumber: string | null = null;
  if (phoneDigits.length >= 10) {
    phoneDdd = phoneDigits.slice(0, 2);
    phoneNumber = phoneDigits.slice(2);
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 PROCESSANDO DADOS BANCÁRIOS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🏦 Banco: ${bankData.bankName} (código: ${bankCode})`);
  console.log(`📄 CPF/CNPJ original: ${bankData.cpfCnpj}`);
  console.log(`📄 CPF/CNPJ processado: ${documentNumber} (${documentNumber.length} dígitos)`);
  console.log(`🏛️ Agência original: ${bankData.agency}`);
  console.log(`🏛️ Agência processada: ${agency} (DV: ${agencyDv || 'não informado'})`);
  console.log(`💳 Conta original: ${bankData.account}`);
  console.log(`💳 Conta processada: ${account} (DV: ${accountDv || 'não informado'})`);
  console.log(`👤 Nome: ${bankData.legalName}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  
  // Validar tamanho mínimo
  if (agency.length < 4) {
    throw new Error('Agência deve ter pelo menos 4 dígitos');
  }
  if (account.length < 5) {
    throw new Error('Conta deve ter pelo menos 5 dígitos');
  }
  if (documentNumber.length !== 11 && documentNumber.length !== 14) {
    throw new Error(`CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos. Recebido: ${documentNumber.length} dígitos`);
  }
  if (!phoneDdd || !phoneNumber) {
    throw new Error(
      'Telefone/WhatsApp do estabelecimento é obrigatório para criar o recebedor na Pagar.me. ' +
        'Cadastre um WhatsApp válido no estabelecimento (com DDD).'
    );
  }

  // ✅ Pagar.me v5 exige `default_bank_account`
  // Erro real retornado: "recipient.default_bank_account is required"
  //
  // Importante: os nomes dos campos aqui são os usados na API Core v5.
  const holderType = documentNumber.length === 11 ? 'individual' : 'company';
  const accountType =
    (bankData.accountType || 'conta_corrente') === 'conta_poupanca' ? 'savings' : 'checking';

  const defaultBankAccount: any = {
    holder_name: bankData.legalName,
    holder_type: holderType,
    holder_document: documentNumber,
    bank: bankCode,
    branch_number: agency,
    account_number: account,
    type: accountType,
  };

  // Dígitos verificadores (quando existirem)
  if (agencyDv && agencyDv.length === 1) {
    defaultBankAccount.branch_check_digit = agencyDv;
  }
  if (accountDv && accountDv.length === 1) {
    defaultBankAccount.account_check_digit = accountDv;
  }

  // Payload do recipient (v5)
  const registerInformation: any = {
    email: bankData.email,
    // A Pagar.me exige estes campos dentro de register_information também:
    document: documentNumber,
    type: holderType,
    phone_numbers: [
      {
        ddd: phoneDdd,
        number: phoneNumber,
        type: 'mobile',
      },
    ],
  };

  // Quando o documento é CPF (individual), a Pagar.me exige dados adicionais de cadastro (KYC).
  if (holderType === 'individual') {
    const registerName = (bankData.registerName || '').trim();
    const birthdateRaw = (bankData.birthdate || '').trim();
    const monthlyIncome = Number.isFinite(bankData.monthlyIncome) ? Number(bankData.monthlyIncome) : NaN;
    const professionalOccupation = (bankData.professionalOccupation || '').trim();
    const addr = bankData.address || {};

    if (!registerName) throw new Error('Nome completo do titular (CPF) é obrigatório para criar o recebedor.');
    if (!birthdateRaw) throw new Error('Data de nascimento do titular é obrigatória para criar o recebedor.');
    if (!Number.isFinite(monthlyIncome) || monthlyIncome <= 0) {
      throw new Error('Renda mensal do titular é obrigatória e deve ser um valor válido.');
    }
    if (!professionalOccupation) throw new Error('Profissão do titular é obrigatória para criar o recebedor.');
    // Endereço mínimo exigido para KYC (campos complementares podem ser opcionais dependendo do caso)
    if (!addr.zip_code || !addr.street || !addr.street_number || !addr.neighborhood || !addr.city || !addr.state) {
      throw new Error('Endereço do titular é obrigatório (CEP, rua, número, bairro, cidade e UF).');
    }

    // A Pagar.me valida UF com rigor: normalmente precisa ser sigla (2 letras).
    const uf = String(addr.state || '').trim().toUpperCase();
    const ufsValidas = new Set([
      'AC',
      'AL',
      'AP',
      'AM',
      'BA',
      'CE',
      'DF',
      'ES',
      'GO',
      'MA',
      'MT',
      'MS',
      'MG',
      'PA',
      'PB',
      'PR',
      'PE',
      'PI',
      'RJ',
      'RN',
      'RS',
      'RO',
      'RR',
      'SC',
      'SP',
      'SE',
      'TO',
    ]);
    if (!ufsValidas.has(uf)) {
      throw new Error('UF inválida. Use a sigla do estado (ex: SP, RJ, MG).');
    }

    registerInformation.name = registerName;

    // Pagar.me exige o formato dd/mm/aaaa para birthdate no register_information
    let birthdatePagarme = birthdateRaw;
    if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(birthdateRaw)) {
      const [yyyy, mm, dd] = birthdateRaw.split('-');
      birthdatePagarme = `${dd}/${mm}/${yyyy}`;
    }
    if (!/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/.test(birthdatePagarme)) {
      throw new Error('Data de nascimento inválida. Use o formato DD/MM/AAAA.');
    }

    registerInformation.birthdate = birthdatePagarme;
    registerInformation.monthly_income = monthlyIncome;
    registerInformation.professional_occupation = professionalOccupation;
    registerInformation.address = {
      country: (addr.country || 'BR').toString(),
      state: uf,
      city: addr.city?.toString(),
      neighborhood: addr.neighborhood?.toString(),
      street: addr.street?.toString(),
      street_number: addr.street_number?.toString(),
      zip_code: addr.zip_code?.toString(),
      ...(addr.complementary ? { complementary: addr.complementary?.toString() } : {}),
      ...(addr.reference_point ? { reference_point: addr.reference_point?.toString() } : {}),
    };
  }

  const recipientData: any = {
    payment_mode: 'bank_transfer',
    // IMPORTANTE (Pagar.me Core v5):
    // Quando `register_information` está presente, os campos de identificação
    // no nível do recipient (name/document/type) NÃO podem ser enviados.
    register_information: registerInformation,
    default_bank_account: defaultBankAccount,
    // manter explícito, mas no formato v5
    transfer_settings: {
      transfer_enabled: true,
      // A Pagar.me v5 valida `transfer_day` em função do intervalo:
      // - Daily  => transfer_day DEVE ser 0
      // - Weekly/Monthly => transfer_day é obrigatório e varia conforme o intervalo
      transfer_interval: 'Daily',
      transfer_day: 0,
    },
    automatic_anticipation_settings: {
      enabled: true,
    },
  };
  
  try {
    console.log('📤 ENVIANDO PARA PAGAR.ME:');
    console.log(JSON.stringify(recipientData, null, 2));
    console.log('');
    
    const response = await fetch(`${client.baseURL}/recipients`, {
      method: 'POST',
      headers: {
        ...client.headers,
        'Accept': 'application/json',
      },
      body: JSON.stringify(recipientData),
    });

    if (!response.ok) {
      let errorData: any;
      let errorText: string = '';
      
      // Ler a resposta como texto primeiro para garantir que capturamos tudo
      errorText = await response.text();
      
      console.error('🔴 RESPOSTA RAW DA PAGAR.ME (TEXTO):');
      console.error(errorText);
      console.error('🔴 FIM DA RESPOSTA RAW');
      
      try {
        errorData = JSON.parse(errorText);
        console.error('🔴 RESPOSTA DA PAGAR.ME (JSON):');
        console.error(JSON.stringify(errorData, null, 2));
        console.error('🔴 FIM DA RESPOSTA JSON');
      } catch (e) {
        console.error('🔴 ERRO AO FAZER PARSE DA RESPOSTA:', e);
        errorData = { 
          message: `Erro ${response.status}: ${response.statusText}`,
          rawResponse: errorText
        };
      }
      
      console.error('═══════════════════════════════════════════════════════════');
      console.error('❌ ERRO DA PAGAR.ME:');
      console.error('═══════════════════════════════════════════════════════════');
      console.error('Status HTTP:', response.status);
      console.error('Status Text:', response.statusText);
      console.error('URL:', `${client.baseURL}/recipients`);
      console.error('Dados enviados:', JSON.stringify(recipientData, null, 2));
      console.error('Resposta completa:', JSON.stringify(errorData, null, 2));
      console.error('Resposta raw:', errorText);
      console.error('═══════════════════════════════════════════════════════════');
      
      // Se a Pagar.me retornou erros específicos, mostrar cada um
      if (errorData.errors && Array.isArray(errorData.errors)) {
        console.error('📋 Erros específicos da Pagar.me:');
        errorData.errors.forEach((err: any, index: number) => {
          console.error(`   ${index + 1}. Campo: ${err.field || 'N/A'}`);
          console.error(`      Mensagem: ${err.message || 'N/A'}`);
        });
      }
      
      // Extrair mensagem de erro mais específica
      let errorMessage = 'The request is invalid';
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        const errorMessages = errorData.errors.map((e: any) => {
          if (typeof e === 'string') return e;
          if (e.message) return e.message;
          if (e.field && e.message) return `${e.field}: ${e.message}`;
          return JSON.stringify(e);
        });
        errorMessage = errorMessages.join('; ');
      } else if (errorData.error) {
        errorMessage = errorData.error;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      }
      
      // Criar um objeto de erro customizado que preserva TODOS os dados
      // IMPORTANTE: Adicionar os detalhes como propriedade que será serializada
      const error: any = new Error(errorMessage);
      error.name = 'PagarMeError';
      
      // Adicionar os detalhes como propriedades que SERÃO serializadas pelo Express
      // Usar uma propriedade que o Express vai serializar
      error.pagarmeErrorDetails = errorData; // Esta será a propriedade principal
      error.pagarmeErrorData = errorData;
      error.errorDetails = errorData;
      error.fullError = errorData;
      error.errorData = errorData;
      error.pagarmeError = errorData;
      error.originalError = errorData;
      error.response = {
        data: errorData,
        status: response.status,
        statusText: response.statusText,
        text: errorText
      };
      error.errors = errorData.errors || [];
      
      // Adicionar também como propriedade direta no objeto (não apenas no prototype)
      Object.defineProperty(error, 'pagarmeErrorDetails', {
        value: errorData,
        enumerable: true,
        writable: false,
        configurable: false
      });
      
      throw error;
    }

    const data: CreateRecipientResponse = await response.json();
    console.log('✅ Recebedor criado na Pagar.me:', data.id);

    return { recipient_id: data.id };
  } catch (error: any) {
    console.error('❌ Erro ao criar recebedor na Pagar.me:', error);
    // IMPORTANTE:
    // Não "embrulhar" o erro em um new Error() sem copiar os detalhes,
    // senão perdemos o corpo retornado pela Pagar.me (errorData/response)
    // e o frontend só vê "The request is invalid." sem o campo que falhou.
    //
    // Se já vier com detalhes, re-throw do jeito que está.
    const hasUsefulDetails =
      !!(error && (error.pagarmeErrorDetails || error.errorDetails || error.response?.data || error.errors));

    if (hasUsefulDetails) {
      throw error;
    }

    // Fallback: criar erro amigável mas preservando a causa
    const wrapped: any = new Error(`Erro ao criar conta na Pagar.me: ${error?.message || 'Erro desconhecido'}`);
    wrapped.name = 'PagarMeError';
    wrapped.cause = error;

    // Copiar o máximo possível para ajudar a debugar (sem vazar chave)
    if (error?.response) wrapped.response = error.response;
    if (error?.errors) wrapped.errors = error.errors;
    if (error?.stack) wrapped.stack = error.stack;

    throw wrapped;
  }
}

/**
 * Cria um pagamento na Pagar.me v5
 * 
 * @param paymentData - Dados do pagamento
 * @returns Dados do pagamento criado
 */
export async function createPayment(
  paymentData: CreatePaymentRequest
): Promise<CreatePaymentResponse> {
  validateApiKey();

  const client = createPagarMeClient();

  try {
    // PIX expiração (em segundos). Padrão: 90s (1:30).
    // Configure no ambiente do servidor: PIX_EXPIRES_IN_SECONDS=90
    const pixExpiresIn = (() => {
      const n = Number(process.env.PIX_EXPIRES_IN_SECONDS || 90);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3600;
    })();

    const hasSplit = Boolean(paymentData.split && paymentData.split.length > 0);
    // ✅ Formato correto do Marketplace Split (Core v5):
    // payments[0].split: [{ amount, recipient_id, type, options: { liable, charge_processing_fee, charge_remainder_fee } }]
    // Obs: a API pode IGNORAR `split_rules`, então usamos `split` (conforme docs).
    const splitForPagarme = hasSplit
      ? paymentData.split!.map(rule => ({
          recipient_id: rule.recipient_id,
          amount: rule.amount,
          type: rule.type,
          options: {
            liable: rule.liable,
            charge_processing_fee: rule.charge_processing_fee,
            charge_remainder_fee: rule.charge_remainder_fee,
          },
        }))
      : undefined;

    // Cartão: usar token enviado pelo frontend (preferencial) OU gerar token no servidor (fallback)
    const normalizeExpYear = (yy: string) => {
      const digits = String(yy || '').replace(/\D/g, '');
      if (digits.length === 2) return `20${digits}`;
      return digits;
    };

    const isCardMethod = paymentData.payment_method === 'credit_card' || paymentData.payment_method === 'debit_card';
    const cardTokenFromClient = isCardMethod ? String(paymentData.card_token || '').trim() : '';

    const cardToken =
      isCardMethod && cardTokenFromClient
        ? cardTokenFromClient
        : isCardMethod && paymentData.card
          ? await createCardToken(client, {
              number: String(paymentData.card.number || '').replace(/\D/g, ''),
              holder_name: String(paymentData.card.holder_name || '').trim(),
              exp_month: String(paymentData.card.exp_month || '').replace(/\D/g, ''),
              exp_year: normalizeExpYear(String(paymentData.card.exp_year || '')),
              cvv: String(paymentData.card.cvv || '').replace(/\D/g, ''),
            })
          : null;

    // Billing é obrigatório para cartão em muitas integrações (erro: billing.value is required).
    const billingAddress =
      isCardMethod && paymentData.billing_address
        ? {
            line_1: String(paymentData.billing_address.line_1 || '').trim(),
            zip_code: String(paymentData.billing_address.zip_code || '').replace(/\D/g, ''),
            city: String(paymentData.billing_address.city || '').trim(),
            state: String(paymentData.billing_address.state || '').trim().toUpperCase(),
            country: String(paymentData.billing_address.country || 'BR').trim().toUpperCase(),
          }
        : null;

    if (isCardMethod) {
      if (!billingAddress?.zip_code || billingAddress.zip_code.length !== 8) {
        const error: any = new Error('Endereço de cobrança inválido: informe um CEP válido (8 dígitos).');
        error.name = 'PagarMeError';
        error.__capturedDetails = { step: 'validate_billing_address', missing: 'zip_code' };
        throw error;
      }
      if (!billingAddress?.line_1) {
        const error: any = new Error('Endereço de cobrança inválido: informe rua e número.');
        error.name = 'PagarMeError';
        error.__capturedDetails = { step: 'validate_billing_address', missing: 'line_1' };
        throw error;
      }
      if (!billingAddress?.city) {
        const error: any = new Error('Endereço de cobrança inválido: informe a cidade.');
        error.name = 'PagarMeError';
        error.__capturedDetails = { step: 'validate_billing_address', missing: 'city' };
        throw error;
      }
      if (!billingAddress?.state || billingAddress.state.length !== 2) {
        const error: any = new Error('Endereço de cobrança inválido: informe a UF (2 letras, ex: SC).');
        error.name = 'PagarMeError';
        error.__capturedDetails = { step: 'validate_billing_address', missing: 'state' };
        throw error;
      }
    }

    const isSubscriptionFlow = Boolean(paymentData.metadata && (paymentData.metadata as any).subscription_id);
    const subscriptionName = isSubscriptionFlow
      ? String(((paymentData.metadata as any).subscription_name || 'Assinatura') as any)
      : '';

    // Pagar.me exige `items[].code` (obrigatório). Usamos códigos estáveis e curtos.
    const itemCode = isSubscriptionFlow ? 'ASSINATURA' : 'AGENDAMENTO';
    const itemDescription = isSubscriptionFlow
      ? `Assinatura - ${subscriptionName || 'Plano'}`
      : 'Pagamento de agendamento';

    const requestBody = {
      items: [
        {
          code: itemCode,
          amount: paymentData.amount,
          description: itemDescription,
          quantity: 1,
          // Split fica no payment (payments[0].split). Não enviar split no item para evitar inconsistências.
        },
      ],
      customer: paymentData.customer,
      payments: [
        {
          payment_method: paymentData.payment_method,
          ...(paymentData.payment_method === 'pix' && {
            pix: {
              expires_in: pixExpiresIn,
            },
          }),
          ...(paymentData.payment_method === 'credit_card' && {
            credit_card: {
              installments: 1,
              statement_descriptor: 'AGENDAMENTO',
              ...(cardToken ? { card_token: cardToken } : {}),
              ...(billingAddress ? { billing_address: billingAddress } : {}),
            },
          }),
          ...(paymentData.payment_method === 'debit_card' && {
            debit_card: {
              statement_descriptor: 'AGENDAMENTO',
              ...(cardToken ? { card_token: cardToken } : {}),
              ...(billingAddress ? { billing_address: billingAddress } : {}),
            },
          }),
          ...(splitForPagarme ? { split: splitForPagarme } : {}),
        },
      ],
      metadata: paymentData.metadata || {},
    };

    const result = await fetchJsonWithTimeout(
      `${client.baseURL}/orders`,
      {
        method: 'POST',
        headers: client.headers,
        body: JSON.stringify(requestBody),
      },
      30000
    );

    if (!result.ok) {
      console.error('❌ Erro ao criar pagamento na Pagar.me:', result.data);
      const error: any = new Error(result.data?.message || `Erro ${result.status} ao criar pagamento`);
      error.name = 'PagarMeError';
      error.__capturedDetails = {
        status: result.status,
        response: result.data,
        requestBody,
      };
      throw error;
    }

    const data = result.data;
    console.log('✅ Pagamento criado na Pagar.me:', data.id);

    // Extrair dados do pagamento da resposta
    const charge = data.charges?.[0];
    const lastTransaction = charge?.last_transaction;
    const pixQrCode =
      lastTransaction?.qr_code ||
      lastTransaction?.pix_qr_code ||
      lastTransaction?.pixQrCode ||
      undefined;
    const pixQrCodeUrl =
      lastTransaction?.qr_code_url ||
      lastTransaction?.pix_qr_code_url ||
      lastTransaction?.pixQrCodeUrl ||
      undefined;
    
    return {
      id: data.id,
      status: charge?.status || 'pending',
      amount: paymentData.amount,
      currency: 'BRL',
      payment_method: paymentData.payment_method,
      pix:
        paymentData.payment_method === 'pix' && (pixQrCode || pixQrCodeUrl)
          ? {
              qr_code: pixQrCode,
              qr_code_url: pixQrCodeUrl,
              expires_in: pixExpiresIn,
            }
          : undefined,
      charges: data.charges,
    };
  } catch (error: any) {
    console.error('❌ Erro ao criar pagamento na Pagar.me:', error);
    // Preservar detalhes quando existirem (para o Express devolver pro frontend)
    const hasUsefulDetails = !!(error && (error.__capturedDetails || error.response?.data || error.errors));
    if (hasUsefulDetails) throw error;

    throw new Error(`Erro ao processar pagamento: ${error.message}`);
  }
}

/**
 * Verifica o status de um pagamento/ordem
 * 
 * @param orderId - ID da ordem na Pagar.me
 * @returns Status do pagamento
 */
export async function checkPaymentStatus(orderId: string): Promise<{ status: string; reason?: string; details?: any }> {
  validateApiKey();

  const client = createPagarMeClient();

  try {
    const result = await fetchJsonWithTimeout(
      `${client.baseURL}/orders/${orderId}`,
      { method: 'GET', headers: client.headers },
      20000
    );

    if (!result.ok) {
      const error: any = new Error(result.data?.message || `Erro ${result.status} ao verificar status`);
      error.name = 'PagarMeError';
      error.__capturedDetails = { status: result.status, response: result.data };
      throw error;
    }

    const data = result.data || {};
    const charge = data.charges?.[0] || {};
    const lastTx = charge?.last_transaction || {};

    const status = String(charge?.status || data.status || 'unknown');

    // Tentar extrair motivo de recusa/cancelamento (quando houver)
    const reason =
      lastTx?.acquirer_message ||
      lastTx?.acquirer_response ||
      lastTx?.refusal_reason ||
      lastTx?.refuse_reason ||
      lastTx?.status_reason ||
      lastTx?.gateway_response?.errors?.[0]?.message ||
      undefined;

    const details =
      reason
        ? {
            acquirer_code: lastTx?.acquirer_code || lastTx?.acquirer_return_code || lastTx?.acquirer_return_code?.code,
            acquirer_message: lastTx?.acquirer_message,
            type: lastTx?.type,
            status: lastTx?.status,
          }
        : undefined;

    return {
      status,
      ...(reason ? { reason: String(reason) } : {}),
      ...(details ? { details } : {}),
    };
  } catch (error: any) {
    console.error('❌ Erro ao verificar status do pagamento:', error);
    const hasUsefulDetails = !!(error && error.__capturedDetails);
    if (hasUsefulDetails) throw error;
    throw new Error(`Erro ao verificar pagamento: ${error.message}`);
  }
}

/**
 * Busca detalhes de uma ordem/pedido na Pagar.me v5.
 * Retorna um resumo seguro para debug (inclui split e status).
 *
 * @param orderId - ID da ordem na Pagar.me (ex: or_xxx)
 */
export async function getOrderDetails(orderId: string): Promise<{
  id: string;
  status: string;
  amount?: number;
  created_at?: string;
  closed_at?: string;
  customer?: { name?: string; email?: string };
  charge?: { id?: string; status?: string; amount?: number };
  split?: Array<{
    recipient_id: string;
    amount: number;
    type?: string;
    liable?: boolean;
    charge_processing_fee?: boolean;
  }>;
  metadata?: Record<string, any>;
}> {
  validateApiKey();

  const client = createPagarMeClient();

  try {
    const result = await fetchJsonWithTimeout(
      `${client.baseURL}/orders/${orderId}`,
      { method: 'GET', headers: client.headers },
      20000
    );

    if (!result.ok) {
      const error: any = new Error(result.data?.message || `Erro ${result.status} ao buscar detalhes do pedido`);
      error.name = 'PagarMeError';
      error.__capturedDetails = { status: result.status, response: result.data };
      throw error;
    }

    const data = result.data || {};
    const charge = data.charges?.[0] || {};

    // A API pode devolver split em formatos diferentes:
    // - legacy: data.split / data.splits
    // - v5 (marketplace): split_rules dentro do payment (charge.payments[0].split_rules)
    const payment0 = charge?.payments?.[0] || {};
    const splitRaw =
      (Array.isArray(payment0.split_rules) && payment0.split_rules) ||
      (Array.isArray(payment0.split) && payment0.split) ||
      (Array.isArray(data.split) && data.split) ||
      (Array.isArray(data.splits) && data.splits) ||
      [];

    return {
      id: data.id,
      status: String(charge?.status || data.status || 'unknown'),
      amount: typeof data.amount === 'number' ? data.amount : undefined,
      created_at: data.created_at,
      closed_at: data.closed_at,
      customer: {
        name: data.customer?.name,
        email: data.customer?.email,
      },
      charge: {
        id: charge?.id,
        status: charge?.status,
        amount: charge?.amount,
      },
      split: splitRaw
        .filter((s: any) => s && s.recipient_id && typeof s.amount === 'number')
        .map((s: any) => ({
          recipient_id: String(s.recipient_id),
          amount: Number(s.amount),
          type: s.type,
          liable: s.liable,
          charge_processing_fee: s.charge_processing_fee,
          charge_remainder_fee: s.charge_remainder_fee,
        })),
      metadata: data.metadata || {},
    };
  } catch (error: any) {
    console.error('❌ Erro ao buscar detalhes do pedido:', error);
    const hasUsefulDetails = !!(error && error.__capturedDetails);
    if (hasUsefulDetails) throw error;
    throw new Error(`Erro ao buscar detalhes do pedido: ${error.message}`);
  }
}

/**
 * Busca o status de um recebedor na Pagar.me v5.
 * Útil para bloquear pagamentos quando o recebedor ainda está em "affiliation".
 */
export async function getRecipientStatus(recipientId: string): Promise<{ id: string; status: string }> {
  validateApiKey();

  const client = createPagarMeClient();

  try {
    const result = await fetchJsonWithTimeout(
      `${client.baseURL}/recipients/${recipientId}`,
      { method: 'GET', headers: client.headers },
      20000
    );

    if (!result.ok) {
      const error: any = new Error(result.data?.message || `Erro ${result.status} ao buscar recebedor`);
      error.name = 'PagarMeError';
      error.__capturedDetails = { status: result.status, response: result.data };
      throw error;
    }

    const data = result.data || {};
    return { id: String(data.id || recipientId), status: String(data.status || 'unknown') };
  } catch (error: any) {
    console.error('❌ Erro ao buscar status do recebedor:', error);
    const hasUsefulDetails = !!(error && error.__capturedDetails);
    if (hasUsefulDetails) throw error;
    throw new Error(`Erro ao buscar status do recebedor: ${error.message}`);
  }
}

/**
 * Exporta funções para uso em Edge Functions ou API Routes
 */
export default {
  createRecipient,
  createPayment,
  checkPaymentStatus,
  getOrderDetails,
  getRecipientStatus,
};

