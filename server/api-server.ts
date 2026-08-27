/**
 * Servidor Express para rotas de API
 * 
 * Este servidor processa todas as requisições /api/* que precisam
 * de acesso a variáveis de ambiente do servidor (como PAGARME_SECRET_KEY)
 */

// Carregar variáveis de ambiente do arquivo .env
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual (compatível com ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env da raiz do projeto (1 nível acima de server/)
const envPath = path.resolve(__dirname, '..', '.env');
console.log('🔍 Procurando .env em:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Erro ao carregar .env:', result.error);
  console.error('   Tentando carregar .env da raiz do processo...');
  // Fallback: tentar carregar da raiz do processo atual
  dotenv.config();
} else {
  console.log('✅ .env carregado com sucesso');
}

// Debug: verificar se a variável foi carregada
console.log('🔑 PAGARME_SECRET_KEY existe?', !!process.env.PAGARME_SECRET_KEY);
if (process.env.PAGARME_SECRET_KEY) {
  console.log('   Tamanho da chave:', process.env.PAGARME_SECRET_KEY.length, 'caracteres');
}

// Debug: verificar variáveis do Mercado Pago
console.log('🔑 MERCADOPAGO_CLIENT_ID existe?', !!process.env.MERCADOPAGO_CLIENT_ID);
console.log('🔑 MERCADOPAGO_CLIENT_SECRET existe?', !!process.env.MERCADOPAGO_CLIENT_SECRET);
console.log('🔑 MERCADOPAGO_REDIRECT_URI existe?', !!process.env.MERCADOPAGO_REDIRECT_URI);
if (process.env.MERCADOPAGO_CLIENT_ID) {
  console.log('   Client ID:', process.env.MERCADOPAGO_CLIENT_ID.substring(0, 4) + '...');
}
if (process.env.MERCADOPAGO_REDIRECT_URI) {
  console.log('   Redirect URI:', process.env.MERCADOPAGO_REDIRECT_URI);
}

import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { recordAdminMpCommission } from '../src/lib/mercadopago/adminMpCommission';
import { checkMPPaymentStatus } from '../src/lib/mercadopago/mp-service';
import {
  checkPaymentStatus,
  createPayment,
  createRecipient,
  getOrderDetails,
  getRecipientStatus,
} from '../src/lib/pagarme-server';
import mercadopagoRoutes from './mercadopago/mp.routes';
import { initializeWhatsAppServices } from './services/whatsapp';
import whatsappRoutes from './whatsapp/whatsapp.routes';

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// Supabase Admin (bypass RLS) - usado para registrar assinaturas pagas no Booking público
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
const SUPPORT_ADMIN_EMAILS = String(process.env.SUPPORT_ADMIN_EMAILS || 'suporteagendeifacil@gmail.com')
  .split(',')
  .map((email) => String(email || '').trim().toLowerCase())
  .filter(Boolean);

// Middleware
app.use(cors());
app.use(express.json());

// Health check - DEVE ser a primeira rota para garantir resposta mesmo em caso de erro nas outras
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'agendei-api', timestamp: new Date().toISOString() });
});

// Rotas do Mercado Pago
app.use('/api/mercadopago', mercadopagoRoutes);
app.use('/api/whatsapp', whatsappRoutes);

const onlyDigits = (v: string) => String(v || '').replace(/\D/g, '');
const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Ajuste para meses menores (ex: 31 -> 30/28)
  if (d.getDate() < day) d.setDate(0);
  return d;
};

const getSubscriberPaymentMethodFromProvider = (providerRaw: unknown): string | null => {
  const provider = String(providerRaw || '').toLowerCase().trim();
  if (!provider) return null;
  if (provider.includes('pix')) return 'pix';
  if (provider.includes('debit') || provider.includes('debito')) return 'debito';
  if (provider.includes('credit') || provider.includes('card') || provider.includes('credito')) return 'credito';
  if (provider.includes('dinheiro')) return 'dinheiro';
  return null;
};


/**
 * Pagamento avulso NÃO pode rebaixar quem já tem recorrência.
 *
 * O assinante é localizado pelo TELEFONE e a linha é reescrita por inteiro. Quando
 * alguém com renovação automática ativa pagava avulso, o provider caía para
 * 'mercadopago_card' e o sistema perdia o rastro da recorrência: parava de renovar
 * sozinho, o cliente voltava para a lista de "ativação pendente" e o barbeiro
 * tendia a mandar OUTRO link — criando uma segunda recorrência e cobrando o
 * cliente duas vezes por mês.
 *
 * O pagamento continua sendo registrado normalmente (status, datas, método);
 * só o vínculo da recorrência é preservado.
 */
const preserveRecurringProvider = (existingRow: any, payload: any): void => {
  const current = String(existingRow?.subscription_payment_provider || '').toLowerCase().trim();
  const isRecurring = current === 'mercadopago_card_recurring' || current === 'mercadopago_card_recurring_pending';
  if (!isRecurring) return;
  const incoming = String(payload?.subscription_payment_provider || '').toLowerCase();
  if (incoming.includes('recurring')) return;
  delete payload.subscription_payment_provider;
};
const findExistingSubscriberByPhone = async (
  supabaseClient: any,
  establishmentId: string,
  subscriptionId: string,
  customerWhatsapp: string
) => {
  const estId = String(establishmentId || '').trim();
  const subId = String(subscriptionId || '').trim();
  const phone = String(customerWhatsapp || '').trim();
  if (!estId || !subId || !phone) return { data: null, error: null };

  const attempts: Array<{ column: 'subscriber_whatsapp' | 'client_whatsapp'; sameSubscriptionFirst: boolean }> = [
    { column: 'subscriber_whatsapp', sameSubscriptionFirst: true },
    { column: 'subscriber_whatsapp', sameSubscriptionFirst: false },
    { column: 'client_whatsapp', sameSubscriptionFirst: true },
    { column: 'client_whatsapp', sameSubscriptionFirst: false },
  ];

  let lastError: any = null;

  for (const attempt of attempts) {
    let query = supabaseClient
      .from('client_subscriptions')
      .select('id, subscription_id, created_at, subscription_payment_provider')
      .eq('establishment_id', estId)
      // @ts-expect-error colunas legadas podem não existir no tipo
      .eq(attempt.column, phone)
      .order('created_at', { ascending: false })
      .limit(1);

    if (attempt.sameSubscriptionFirst) {
      query = query.eq('subscription_id', subId);
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data?.id) {
      return { data, error: null };
    }
    if (error) {
      lastError = error;
    }
  }

  return { data: null, error: lastError };
};

// (rota /health movida para o topo, antes das rotas de API)

app.post('/api/admin/reset-establishment-password', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado no servidor',
        details: {
          hasUrl: Boolean(SUPABASE_URL),
          hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        },
      });
    }

    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação ausente' });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({
        error: 'Token inválido ou expirado',
        details: authError?.message || undefined,
      });
    }

    const requesterEmail = String(authData.user.email || '').trim().toLowerCase();
    if (!SUPPORT_ADMIN_EMAILS.includes(requesterEmail)) {
      return res.status(403).json({
        error: 'Apenas contas de suporte podem resetar senha por aqui',
        details: { requesterEmail },
      });
    }

    const establishmentId = String(req.body?.establishmentId || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();

    if (!establishmentId || !newPassword) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'newPassword'],
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'A nova senha deve ter no mínimo 6 caracteres',
      });
    }

    const { data: establishment, error: estError } = await supabaseAdmin
      .from('establishments')
      .select('id,name,code,owner_id')
      .eq('id', establishmentId)
      .maybeSingle();

    if (estError) {
      return res.status(500).json({ error: 'Erro ao buscar estabelecimento', details: estError });
    }
    if (!establishment?.owner_id) {
      return res.status(404).json({ error: 'Estabelecimento não encontrado ou sem owner_id' });
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      String(establishment.owner_id),
      { password: newPassword, email_confirm: true }
    );

    if (updateError) {
      return res.status(500).json({
        error: 'Erro ao resetar senha no Auth',
        details: {
          message: updateError.message,
          code: (updateError as any)?.code,
          status: (updateError as any)?.status,
        },
      });
    }

    // Compatibilidade com o painel admin atual:
    // o modal "Informações" ainda lê email/senha de registration_forms.
    // Mantemos os dois sincronizados para não mostrar senha antiga após reset.
    const ownerEmail = String(updatedUser?.user?.email || '').trim().toLowerCase();
    let registrationFormPasswordSynced = false;
    let registrationFormSyncWarning: string | null = null;
    if (ownerEmail) {
      const { error: registrationSyncError } = await supabaseAdmin
        .from('registration_forms')
        .update({ password: newPassword })
        .eq('email', ownerEmail);

      if (registrationSyncError) {
        registrationFormSyncWarning =
          `Senha do Auth foi resetada, mas falhou sincronização em registration_forms: ${registrationSyncError.message}`;
      } else {
        registrationFormPasswordSynced = true;
      }
    } else {
      registrationFormSyncWarning =
        'Senha do Auth foi resetada, mas não foi possível identificar o email do dono para sincronizar registration_forms.';
    }

    return res.status(200).json({
      ok: true,
      establishment: {
        id: establishment.id,
        name: establishment.name,
        code: establishment.code,
        owner_id: establishment.owner_id,
      },
      updatedAuthUserId: updatedUser?.user?.id || establishment.owner_id,
      ownerEmail: ownerEmail || null,
      registrationFormPasswordSynced,
      registrationFormSyncWarning,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Erro ao resetar senha do estabelecimento',
      details: error?.details || error?.hint || error?.code || undefined,
    });
  }
});

/**
 * POST /api/subscribers/create-pending-subscription
 * Cria/atualiza uma assinatura pendente (unpaid) para aparecer no painel do barbeiro,
 * mesmo antes do pagamento ser confirmado.
 */
app.post('/api/subscribers/create-pending-subscription', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado no servidor',
        details: {
          hasUrl: Boolean(SUPABASE_URL),
          hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        },
      });
    }

    const { orderId, establishmentId, subscriptionId, customer, provider } = req.body || {};
    const customerName = String(customer?.name || '').trim();
    const customerWhatsapp = onlyDigits(String(customer?.whatsapp || customer?.phone || ''));
    const customerEmail = String(customer?.email || '').trim() || null;

    if (!orderId || !establishmentId || !subscriptionId || !customerName || !customerWhatsapp) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['orderId', 'establishmentId', 'subscriptionId', 'customer.name', 'customer.whatsapp'],
      });
    }

    // Buscar duração da assinatura
    const { data: subData, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('duration_months')
      .eq('id', String(subscriptionId))
      .single();
    if (subErr) {
      return res.status(500).json({ error: 'Erro ao buscar assinatura', details: subErr });
    }

    const durationMonths = Number((subData as any)?.duration_months || 1);
    const today = new Date();
    const startDate = toISODate(today);
    const endDate = toISODate(addMonths(today, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

    // Se já existir, atualizar
    const { data: existing, error: existingErr } = await findExistingSubscriberByPhone(
      supabaseAdmin,
      String(establishmentId),
      String(subscriptionId),
      customerWhatsapp
    );
    if (existingErr) {
      console.warn('⚠️ Não foi possível checar assinatura existente (pending):', existingErr);
    }

    const providerFinal = String(provider || 'pagarme_pix').toLowerCase().trim() || 'pagarme_pix';
    const subscriberPaymentMethod = getSubscriberPaymentMethodFromProvider(providerFinal);

    const payload: any = {
      subscription_id: String(subscriptionId),
      establishment_id: String(establishmentId),
      start_date: startDate,
      end_date: endDate,
      payment_status: 'unpaid',
      last_payment_date: null,
      subscriber_name: customerName,
      subscriber_whatsapp: customerWhatsapp,
      subscriber_email: customerEmail,
      subscriber_payment_method: subscriberPaymentMethod,
      subscription_payment_provider: providerFinal,
      subscription_payment_order_id: String(orderId),
    };

    preserveRecurringProvider(existing, payload);

    let resultRow: any = null;
    if (existing?.id) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('client_subscriptions')
        .update(payload)
        .eq('id', String(existing.id))
        .select()
        .single();
      if (updErr) return res.status(500).json({ error: 'Erro ao atualizar assinatura pendente', details: updErr });
      resultRow = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('client_subscriptions')
        .insert([{ client_id: uuidv4(), ...payload }])
        .select()
        .single();
      if (insErr) return res.status(500).json({ error: 'Erro ao criar assinatura pendente', details: insErr });
      resultRow = ins;
    }

    return res.status(200).json({ ok: true, status: 'unpaid', subscription: resultRow });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || 'Erro ao criar assinatura pendente',
      details: error?.details || error?.hint || error?.code || undefined,
    });
  }
});

/**
 * POST /api/subscribers/confirm-subscription-pix
 * Confirma pagamento (Pagar.me ou Mercado Pago) e registra o assinante no Supabase (client_subscriptions)
 * - Flow: Booking público -> PIX -> pago -> registrar em "Meus Assinantes"
 */
app.post('/api/subscribers/confirm-subscription-pix', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado no servidor',
        details: {
          hasUrl: Boolean(SUPABASE_URL),
          hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        },
      });
    }

    const { orderId, establishmentId, subscriptionId, customer, provider } = req.body || {};
    const customerName = String(customer?.name || '').trim();
    const customerWhatsapp = onlyDigits(String(customer?.whatsapp || customer?.phone || ''));
    const customerEmail = String(customer?.email || '').trim() || null;

    if (!orderId || !establishmentId || !subscriptionId || !customerName || !customerWhatsapp) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['orderId', 'establishmentId', 'subscriptionId', 'customer.name', 'customer.whatsapp'],
      });
    }

    const providerNormalized = String(provider || 'pagarme_pix').toLowerCase().trim();
    const providerFinal =
      providerNormalized === 'pagarme_card' || providerNormalized === 'pagarme_pix' ||
        providerNormalized === 'mercadopago_card' ||
        providerNormalized === 'mercadopago_pix' ||
        providerNormalized === 'mercadopago_card_recurring'
        ? providerNormalized
        : 'pagarme_pix';
    const subscriberPaymentMethod = getSubscriberPaymentMethodFromProvider(providerFinal);
    const isRecurringCardProvider = providerFinal === 'mercadopago_card_recurring';
    const shouldMarkAsPaid = !isRecurringCardProvider;

    // Validar pagamento no gateway correto
    let normalizedStatus = '';
    let statusDetail: string | undefined;
    let mercadoPagoPaymentContext: any = null;

    if (providerFinal.startsWith('mercadopago')) {
      // Buscar access_token do estabelecimento
      const { data: est, error: estErr } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token')
        .eq('id', String(establishmentId))
        .single();

      if (estErr) {
        return res.status(500).json({ error: 'Erro ao buscar tokens do Mercado Pago', details: estErr });
      }

      const accessToken = String((est as any)?.mercadopago_access_token || '').trim();
      if (!accessToken) {
        return res.status(400).json({
          error: 'Estabelecimento não possui Mercado Pago conectado',
          details: { establishmentId },
        });
      }

      const paymentId = Number(orderId);
      if (Number.isFinite(paymentId) && paymentId > 0) {
        const mpStatus = await checkMPPaymentStatus(paymentId, accessToken);
        mercadoPagoPaymentContext = mpStatus;
        normalizedStatus = String((mpStatus as any)?.status || '').toLowerCase();
        statusDetail = String((mpStatus as any)?.status_detail || '').trim() || undefined;

        // Mercado Pago: pago pode vir como "approved" (ou "authorized" em alguns fluxos)
        if (normalizedStatus !== 'approved' && normalizedStatus !== 'authorized') {
          return res.status(400).json({
            error: 'Pagamento ainda não confirmado',
            details: { status: normalizedStatus, status_detail: statusDetail },
          });
        }
      } else {
        // Recorrência real (preapproval): orderId é preapproval_id
        const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
        const preapprovalResp = await axios.get(
          `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(String(orderId))}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        normalizedStatus = String((preapprovalResp.data as any)?.status || '').toLowerCase();
        mercadoPagoPaymentContext = preapprovalResp.data;
        if (normalizedStatus !== 'authorized') {
          return res.status(400).json({
            error: 'Assinatura recorrente ainda não autorizada',
            details: { status: normalizedStatus },
          });
        }
      }
    } else {
      // Pagar.me
      const statusResult = await checkPaymentStatus(String(orderId));
      normalizedStatus = String((statusResult as any)?.status || '').toLowerCase();
      if (normalizedStatus !== 'paid' && normalizedStatus !== 'authorized') {
        return res.status(400).json({
          error: 'Pagamento ainda não confirmado',
          details: { status: normalizedStatus },
        });
      }
    }

    // Buscar duração da assinatura
    const { data: subData, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('duration_months')
      .eq('id', String(subscriptionId))
      .single();
    if (subErr) {
      return res.status(500).json({ error: 'Erro ao buscar assinatura', details: subErr });
    }

    const durationMonths = Number((subData as any)?.duration_months || 1);
    const today = new Date();
    const startDate = toISODate(today);
    const endDate = toISODate(addMonths(today, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

    // Se já existir, renovar/atualizar
    const { data: existing, error: existingErr } = await findExistingSubscriberByPhone(
      supabaseAdmin,
      String(establishmentId),
      String(subscriptionId),
      customerWhatsapp
    );

    if (existingErr) {
      // não travar: vamos tentar inserir mesmo assim
      console.warn('⚠️ Não foi possível checar assinatura existente:', existingErr);
    }

    const payload: any = {
      subscription_id: String(subscriptionId),
      establishment_id: String(establishmentId),
      start_date: startDate,
      end_date: endDate,
      payment_status: shouldMarkAsPaid ? 'paid' : 'unpaid',
      last_payment_date: shouldMarkAsPaid ? startDate : null,
      // dados do assinante
      subscriber_name: customerName,
      subscriber_whatsapp: customerWhatsapp,
      subscriber_email: customerEmail,
      subscriber_payment_method: subscriberPaymentMethod,
      // marcar origem do pagamento (para saldo de assinantes)
      subscription_payment_provider: providerFinal,
      subscription_payment_order_id: String(orderId),
    };

    preserveRecurringProvider(existing, payload);

    let resultRow: any = null;
    if (existing?.id) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('client_subscriptions')
        .update(payload)
        .eq('id', String(existing.id))
        .select()
        .single();
      if (updErr) return res.status(500).json({ error: 'Erro ao atualizar assinatura', details: updErr });
      resultRow = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('client_subscriptions')
        .insert([
          {
            client_id: uuidv4(),
            ...payload,
          },
        ])
        .select()
        .single();
      if (insErr) return res.status(500).json({ error: 'Erro ao criar assinatura', details: insErr });
      resultRow = ins;
    }

    if (providerFinal.startsWith('mercadopago') && !isRecurringCardProvider) {
      await recordAdminMpCommission(supabaseAdmin, {
        establishmentId: String(establishmentId),
        sourceType: 'subscription',
        sourceId: String(resultRow?.id || existing?.id || ''),
        paymentId: String(orderId),
        externalReference: String(mercadoPagoPaymentContext?.external_reference || '') || null,
        paymentMethod: subscriberPaymentMethod || providerFinal,
        grossAmountCents: Math.round(Number(mercadoPagoPaymentContext?.transaction_amount || 0) * 100) || null,
        paidAt: String(mercadoPagoPaymentContext?.date_approved || mercadoPagoPaymentContext?.date_created || '') || null,
        metadata: {
          origin: 'api_confirm_subscription_pix',
          provider: providerFinal,
          subscription_id: String(subscriptionId),
          payment_status: normalizedStatus,
        },
      });
    }

    return res.status(200).json({
      ok: true,
      status: normalizedStatus,
      payment_confirmed: shouldMarkAsPaid,
      requires_payment_approval: isRecurringCardProvider,
      subscription: resultRow,
      /** `updated` = mesmo registro em client_subscriptions (renovação); `created` = novo assinante */
      operation: existing?.id ? 'updated' : 'created',
    });
  } catch (error: any) {
    console.error('❌ Erro ao confirmar assinatura via PIX:', error);
    return res.status(500).json({
      error: error?.message || 'Erro ao confirmar assinatura via PIX',
      details: error?.__capturedDetails || undefined,
    });
  }
});

/**
 * POST /api/subscribers/claim-subscription-credit
 * Registra uma assinatura como "unpaid" (pendente) após o cliente pagar fora do sistema (link externo).
 * - NÃO valida pagamento em gateway
 * - NÃO marca como paid
 * - Cria/atualiza client_subscriptions para o cliente aparecer em "Meus Assinantes"
 */
app.post('/api/subscribers/claim-subscription-credit', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Supabase admin não configurado no servidor',
        details: {
          hasUrl: Boolean(SUPABASE_URL),
          hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        },
      });
    }

    const { establishmentId, subscriptionId, customer, providerKey } = req.body || {};
    const customerName = String(customer?.name || '').trim();
    const customerWhatsapp = onlyDigits(String(customer?.whatsapp || customer?.phone || ''));
    const customerEmail = String(customer?.email || '').trim() || null;

    if (!establishmentId || !subscriptionId || !customerName || !customerWhatsapp) {
      return res.status(400).json({
        error: 'Dados incompletos',
        required: ['establishmentId', 'subscriptionId', 'customer.name', 'customer.whatsapp'],
      });
    }

    // Buscar duração da assinatura
    const { data: subData, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('duration_months')
      .eq('id', String(subscriptionId))
      .single();
    if (subErr) {
      return res.status(500).json({ error: 'Erro ao buscar assinatura', details: subErr });
    }

    const durationMonths = Number((subData as any)?.duration_months || 1);
    const today = new Date();
    const startDate = toISODate(today);
    const endDate = toISODate(addMonths(today, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

    // Se já existir, atualizar (mantém assinatura pendente e renova datas)
    const { data: existing, error: existingErr } = await findExistingSubscriberByPhone(
      supabaseAdmin,
      String(establishmentId),
      String(subscriptionId),
      customerWhatsapp
    );

    if (existingErr) {
      console.warn('⚠️ Não foi possível checar assinatura existente (crédito):', existingErr);
    }

    const providerFinal = String(providerKey || 'credit_link').toLowerCase().trim() || 'credit_link';
    const subscriberPaymentMethod =
      providerFinal === 'credit_link'
        ? 'credito'
        : getSubscriberPaymentMethodFromProvider(providerFinal);
    const orderId = `credit_${Date.now()}_${uuidv4()}`;

    const payload: any = {
      subscription_id: String(subscriptionId),
      establishment_id: String(establishmentId),
      start_date: startDate,
      end_date: endDate,
      payment_status: 'unpaid', // ✅ Pendente de confirmação
      last_payment_date: null,
      // dados do assinante
      subscriber_name: customerName,
      subscriber_whatsapp: customerWhatsapp,
      subscriber_email: customerEmail,
      subscriber_payment_method: subscriberPaymentMethod,
      // auditoria/origem
      subscription_payment_provider: providerFinal,
      subscription_payment_order_id: orderId,
    };

    preserveRecurringProvider(existing, payload);

    let resultRow: any = null;
    if (existing?.id) {
      const { data: upd, error: updErr } = await supabaseAdmin
        .from('client_subscriptions')
        .update(payload)
        .eq('id', String(existing.id))
        .select()
        .single();
      if (updErr) return res.status(500).json({ error: 'Erro ao atualizar assinatura (crédito)', details: updErr });
      resultRow = upd;
    } else {
      const { data: ins, error: insErr } = await supabaseAdmin
        .from('client_subscriptions')
        .insert([
          {
            client_id: uuidv4(),
            ...payload,
          },
        ])
        .select()
        .single();
      if (insErr) return res.status(500).json({ error: 'Erro ao criar assinatura (crédito)', details: insErr });
      resultRow = ins;
    }

    return res.status(200).json({
      ok: true,
      status: 'unpaid',
      subscription: resultRow,
    });
  } catch (error: any) {
    console.error('❌ Erro ao registrar assinatura via crédito (manual):', error);
    return res.status(500).json({
      error: error?.message || 'Erro ao registrar assinatura via crédito',
      details: error?.__capturedDetails || undefined,
    });
  }
});

/**
 * POST /api/pagarme/create-recipient
 * Cria um recebedor na Pagar.me
 */
app.post('/api/pagarme/create-recipient', async (req, res) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚨 REQUISIÇÃO RECEBIDA: /api/pagarme/create-recipient');
  console.log('═══════════════════════════════════════════════════════════');

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
    } = req.body;

    console.log('📥 Dados recebidos do frontend:');
    console.log(
      JSON.stringify(
        {
          cpfCnpj,
          bankName,
          agency,
          account,
          accountType,
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
        },
        null,
        2
      )
    );

    // Validação
    if (!cpfCnpj || !bankName || !agency || !account || !legalName || !email || !phone) {
      return res.status(400).json({
        error: 'Dados bancários incompletos',
        required: ['cpfCnpj', 'bankName', 'agency', 'account', 'legalName', 'email', 'phone']
      });
    }

    console.log('🔄 Chamando createRecipient...');

    // Variável para armazenar os detalhes do erro ANTES de lançar
    let pagarmeErrorDetails: any = null;

    // Criar recebedor - capturar erro diretamente
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
        annualRevenue,
        mainAddress,
        managingPartners,
      });

      console.log('✅ Recebedor criado com sucesso:', result);
      console.log('═══════════════════════════════════════════════════════════');

      return res.status(200).json(result);
    } catch (recipientError: any) {
      // Capturar os detalhes do erro da Pagar.me ANTES de processar
      console.log('🔍 Erro capturado no try/catch:');
      console.log('   Tipo:', recipientError.constructor.name);
      console.log('   Propriedades:', Object.keys(recipientError));

      // Tentar pegar os detalhes de todas as formas possíveis
      // Prioridade: pagarmeErrorDetails (propriedade enumerable) > outras propriedades
      if ((recipientError as any).pagarmeErrorDetails) {
        pagarmeErrorDetails = (recipientError as any).pagarmeErrorDetails;
        console.log('✅ Capturado via pagarmeErrorDetails (enumerable)');
      } else if (recipientError.errorDetails) {
        pagarmeErrorDetails = recipientError.errorDetails;
        console.log('✅ Capturado via errorDetails');
      } else if (recipientError.pagarmeErrorData) {
        pagarmeErrorDetails = recipientError.pagarmeErrorData;
        console.log('✅ Capturado via pagarmeErrorData');
      } else if (recipientError.fullError) {
        pagarmeErrorDetails = recipientError.fullError;
        console.log('✅ Capturado via fullError');
      } else if (recipientError.errorData) {
        pagarmeErrorDetails = recipientError.errorData;
        console.log('✅ Capturado via errorData');
      } else if (recipientError.response?.data) {
        pagarmeErrorDetails = recipientError.response.data;
        console.log('✅ Capturado via response.data');
      } else if (recipientError.errors) {
        pagarmeErrorDetails = { errors: recipientError.errors };
        console.log('✅ Capturado via errors');
      }

      // Se encontrou detalhes, armazenar para retornar diretamente
      if (pagarmeErrorDetails) {
        console.log('✅ Detalhes capturados:', JSON.stringify(pagarmeErrorDetails, null, 2));
        // Armazenar nos detalhes do erro para o catch externo usar
        (recipientError as any).__capturedDetails = pagarmeErrorDetails;
      } else {
        console.log('⚠️ Nenhum detalhe encontrado no erro!');
        console.log('   Propriedades disponíveis:', Object.keys(recipientError));
        // Tentar serializar o erro completo para debug
        try {
          const errorStr = JSON.stringify(recipientError, Object.getOwnPropertyNames(recipientError), 2);
          console.log('   recipientError serializado:', errorStr.substring(0, 500));
        } catch (e) {
          console.log('   Não foi possível serializar o erro');
        }
      }

      // Re-lançar o erro para ser capturado pelo catch externo
      throw recipientError;
    }
  } catch (error: any) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ ERRO AO CRIAR RECEBEDOR:');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      console.error('Response status:', error.response.status);
    }
    if (error.errors) {
      console.error('Errors:', JSON.stringify(error.errors, null, 2));
    }
    console.error('═══════════════════════════════════════════════════════════');

    // Retornar erro detalhado para o frontend
    const rawMessage: string = error?.message || 'Erro ao criar recebedor na Pagar.me';
    const errorMessage = rawMessage;

    // Melhorar UX: mapear erros conhecidos da Pagar.me para mensagens amigáveis
    const isActionForbidden =
      typeof rawMessage === 'string' &&
      (rawMessage.includes('action_forbidden') ||
        rawMessage.toLowerCase().includes('not allowed to create a recipient'));

    // Coletar todos os detalhes possíveis - verificar TODAS as propriedades
    let errorDetails: any = null;

    // Logar todas as propriedades do erro para debug
    console.log('🔍 Propriedades do erro:', Object.keys(error));
    console.log('🔍 Tipo do erro:', error.constructor.name);

    // Prioridade: __capturedDetails (capturado no try/catch interno) > capturedDetails > pagarmeErrorDetails > errorDetails > pagarmeErrorData > fullError > errorData > etc
    if ((error as any).__capturedDetails) {
      errorDetails = (error as any).__capturedDetails;
      console.log('✅ Usando error.__capturedDetails (capturado no try/catch interno)');
    } else if ((error as any).capturedDetails) {
      errorDetails = (error as any).capturedDetails;
      console.log('✅ Usando error.capturedDetails (capturado no try/catch)');
    } else if ((error as any).pagarmeErrorDetails) {
      errorDetails = (error as any).pagarmeErrorDetails;
      console.log('✅ Usando error.pagarmeErrorDetails (propriedade enumerable)');
    } else if ((error as any).errorDetails) {
      errorDetails = (error as any).errorDetails;
      console.log('✅ Usando error.errorDetails (propriedade da classe)');
    } else if ((error as any).pagarmeErrorData) {
      errorDetails = (error as any).pagarmeErrorData;
      console.log('✅ Usando error.pagarmeErrorData (classe customizada)');
    } else if ((error as any).fullError) {
      errorDetails = (error as any).fullError;
      console.log('✅ Usando error.fullError');
    } else if ((error as any).errorData) {
      errorDetails = (error as any).errorData;
      console.log('✅ Usando error.errorData');
    } else if ((error as any).pagarmeError) {
      errorDetails = (error as any).pagarmeError;
      console.log('✅ Usando error.pagarmeError');
    } else if ((error as any).originalError) {
      errorDetails = (error as any).originalError;
      console.log('✅ Usando error.originalError');
    } else if ((error as any).response?.data) {
      errorDetails = (error as any).response.data;
      console.log('✅ Usando error.response.data');
    } else if ((error as any).errors && Array.isArray((error as any).errors) && (error as any).errors.length > 0) {
      errorDetails = { errors: (error as any).errors };
      console.log('✅ Usando error.errors');
    } else if ((error as any).response) {
      errorDetails = {
        status: (error as any).response.status,
        statusText: (error as any).response.statusText,
        data: (error as any).response.data,
        text: (error as any).response.text
      };
      console.log('✅ Usando error.response completo');
    }

    // Se ainda não tiver detalhes, tentar pegar qualquer propriedade que possa ter informação
    if (!errorDetails) {
      console.log('⚠️ Nenhum detalhe encontrado, tentando propriedades alternativas...');
      // Tentar pegar qualquer propriedade que não seja padrão de Error
      const customProps: any = {};
      for (const key in error) {
        if (key !== 'message' && key !== 'name' && key !== 'stack' && key !== 'cause') {
          const value = (error as any)[key];
          // Não incluir funções ou objetos muito complexos
          if (typeof value !== 'function' && !(value instanceof Error)) {
            try {
              JSON.stringify(value); // Testar se é serializável
              customProps[key] = value;
            } catch {
              // Ignorar se não for serializável
            }
          }
        }
      }
      errorDetails = {
        message: error.message,
        name: error.name,
        ...customProps
      };
    }

    console.error('📤 Enviando erro para frontend:');
    console.error(JSON.stringify({ error: errorMessage, details: errorDetails }, null, 2));

    // Se for bloqueio de permissão, retornar 403 (facilita tratar no frontend)
    const statusCode = isActionForbidden ? 403 : 500;

    return res.status(statusCode).json({
      error: errorMessage,
      // Mensagem mais amigável para exibição (sem "código técnico")
      userMessage: isActionForbidden
        ? 'Sua conta Pagar.me não tem permissão para criar recebedor (Recipient/Marketplace). Normalmente é necessário: conta aprovada/ativa em produção e habilitação de Marketplace/Recipients (split).'
        : undefined,
      details: errorDetails,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * POST /api/pagarme/create-payment
 * Cria um pagamento na Pagar.me
 */
app.post('/api/pagarme/create-payment', async (req, res) => {
  try {
    const {
      amount,
      payment_method,
      customer,
      split_rules,
      metadata,
      card,
      card_token,
      billing_address,
    } = req.body;

    console.log('💳 [create-payment] Requisição recebida:', {
      amount,
      payment_method,
      customerName: customer?.name,
      hasCustomerEmail: Boolean(customer?.email),
      hasCustomerPhone: Boolean(customer?.phone),
      hasCustomerDocument: Boolean(customer?.document),
      hasCard: Boolean(card?.number || card?.holder_name),
      hasCardToken: Boolean(String(card_token || '').trim()),
      recipientIdPreview: split_rules?.[0]?.recipient_id
        ? `${String(split_rules[0].recipient_id).slice(0, 6)}...${String(split_rules[0].recipient_id).slice(-4)}`
        : null,
      appointmentId: metadata?.appointment_id || null,
    });

    // Validação
    if (!amount || !payment_method || !customer?.name) {
      return res.status(400).json({
        error: 'Dados do pagamento incompletos',
        required: ['amount', 'payment_method', 'customer.name']
      });
    }

    // Split (plataforma + estabelecimento)
    // - A plataforma precisa ter um recipient_id próprio (configure no .env)
    // - O frontend manda somente o recipient_id do estabelecimento (em split_rules[0])
    const platformRecipientId = String(process.env.PAGARME_PLATFORM_RECIPIENT_ID || '').trim();
    const platformFeeCents = Number(process.env.PLATFORM_FEE_CENTS || 100); // padrão: R$ 1,00

    const amountCents = Math.round(Number(amount));
    const barberRecipientId = String(split_rules?.[0]?.recipient_id || '').trim();

    // Guardrail: impedir pagamento antecipado enquanto o recebedor ainda está em afiliação/pendente.
    // Isso evita "sumir" no recebedor do estabelecimento e ficar tudo na plataforma enquanto o KYC não finaliza.
    if (barberRecipientId) {
      try {
        const recipient = await getRecipientStatus(barberRecipientId);
        const normalizedStatus = String(recipient.status || '').toLowerCase();
        console.log('👤 [create-payment] Status do recebedor (estabelecimento):', {
          recipientIdPreview: `${barberRecipientId.slice(0, 6)}...${barberRecipientId.slice(-4)}`,
          status: normalizedStatus,
        });

        if (normalizedStatus !== 'active') {
          return res.status(400).json({
            error: 'Recebedor do estabelecimento ainda não está ativo',
            userMessage:
              'O recebedor do estabelecimento ainda está em análise/afiliação (Pagar.me). Para evitar problemas no repasse, finalize a ativação do recebedor e tente novamente.',
            details: { recipient_status: normalizedStatus },
          });
        }
      } catch (e: any) {
        // Se a consulta falhar, não vamos bloquear por erro momentâneo, mas vamos logar para diagnóstico.
        console.warn('⚠️ [create-payment] Não foi possível validar status do recebedor. Prosseguindo mesmo assim.', {
          recipientIdPreview: `${barberRecipientId.slice(0, 6)}...${barberRecipientId.slice(-4)}`,
          error: e?.message,
        });
      }
    }

    // Segurança: evitar configuração errada onde o recebedor da barbearia é o mesmo da plataforma
    if (platformRecipientId && barberRecipientId && platformRecipientId === barberRecipientId) {
      return res.status(400).json({
        error: 'Recebedor do estabelecimento inválido',
        userMessage:
          'O recebedor do estabelecimento não pode ser o mesmo da plataforma (AgendeiFácil). Cadastre/seleciona um recebedor diferente para a barbearia e tente novamente.',
        details: {
          platformRecipientIdPreview: `${platformRecipientId.slice(0, 6)}...${platformRecipientId.slice(-4)}`,
        },
      });
    }

    // Converter split_rules para o formato esperado (fallback)
    let split =
      split_rules?.map((rule: any) => ({
        recipient_id: rule.recipient_id,
        amount: rule.amount,
        type: 'flat' as const,
        liable: rule.liable ?? true,
        charge_processing_fee: rule.charge_processing_fee ?? false,
        // Por padrão, o próprio estabelecimento assume a taxa de resto (quando aplicável).
        charge_remainder_fee: rule.charge_remainder_fee ?? true,
      })) || [];

    // Se tiver plataforma configurada, gerar split corretamente
    if (platformRecipientId && barberRecipientId) {
      if (amountCents <= platformFeeCents) {
        return res.status(400).json({
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
          // Plataforma NÃO paga a taxa de processamento
          charge_processing_fee: false,
          // Plataforma também não assume taxa de resto
          charge_remainder_fee: false,
        },
        {
          recipient_id: barberRecipientId,
          amount: barberAmountCents,
          type: 'flat' as const,
          liable: true,
          // Barbearia paga a taxa de processamento (assim você fica com R$ 1,00 “inteiro” e a taxa sai do restante)
          charge_processing_fee: true,
          // Barbearia assume a taxa de resto
          charge_remainder_fee: true,
        },
      ];
    }

    console.log('🧾 [create-payment] Split aplicado:', split.map((s: any) => ({
      recipient: s.recipient_id ? `${String(s.recipient_id).slice(0, 6)}...${String(s.recipient_id).slice(-4)}` : null,
      amount: s.amount,
      charge_processing_fee: s.charge_processing_fee,
      liable: s.liable,
    })));

    // Criar pagamento
    const cleanDocument = customer.document?.replace(/\D/g, '') || undefined;
    const customerType =
      cleanDocument && cleanDocument.length === 11
        ? 'individual'
        : cleanDocument && cleanDocument.length === 14
          ? 'corporation'
          : undefined;

    const result = await createPayment({
      amount: amountCents, // Garantir que é número inteiro (centavos)
      payment_method,
      customer: {
        name: customer.name,
        email: customer.email,
        document: cleanDocument,
        ...(customerType ? { type: customerType } : {}),
        phones: customer.phone ? {
          mobile_phone: {
            country_code: '55',
            area_code: String(customer.phone).replace(/\D/g, '').substring(0, 2),
            number: String(customer.phone).replace(/\D/g, '').substring(2),
          },
        } : undefined,
      },
      split,
      metadata,
      ...(payment_method === 'credit_card' || payment_method === 'debit_card'
        ? {
          // Preferência: token gerado no frontend (pk_ via /tokens?appId=...)
          card_token: String(card_token || '').trim() || undefined,
          billing_address: billing_address || undefined,
          // Fallback (antigo): dados do cartão (servidor tokeniza via ek_ se configurado)
          ...(card?.number || card?.holder_name
            ? {
              card: {
                number: String(card?.number || '').replace(/\D/g, ''),
                holder_name: String(card?.holder_name || '').trim(),
                exp_month: String(card?.exp_month || '').replace(/\D/g, ''),
                exp_year: String(card?.exp_year || '').replace(/\D/g, ''),
                cvv: String(card?.cvv || '').replace(/\D/g, ''),
              },
            }
            : {}),
        }
        : {}),
    });

    console.log('✅ [create-payment] Resposta Pagar.me (resumo):', {
      id: (result as any)?.id,
      status: (result as any)?.status,
      hasPix: Boolean((result as any)?.pix),
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('❌ Erro ao criar pagamento:', error);
    const details = (error as any)?.__capturedDetails || (error as any)?.pagarmeErrorDetails || undefined;
    const isTimeout = (error as any)?.code === 'PAGARME_TIMEOUT' || String(error?.message || '').toLowerCase().includes('timeout');
    return res.status(isTimeout ? 504 : 500).json({
      error: error.message || 'Erro ao processar pagamento',
      userMessage: isTimeout
        ? 'O servidor de pagamentos demorou demais para responder. Tente novamente em alguns segundos.'
        : undefined,
      details,
    });
  }
});

/**
 * GET /api/pagarme/check-status
 * Verifica o status de um pagamento
 */
app.get('/api/pagarme/check-status', async (req, res) => {
  try {
    const orderId = req.query.orderId as string;

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
});

/**
 * GET /api/pagarme/order-details
 * Retorna um resumo do pedido na Pagar.me (inclui split) para debug.
 *
 * Ex: /api/pagarme/order-details?orderId=or_xxx
 */
app.get('/api/pagarme/order-details', async (req, res) => {
  try {
    const orderId = req.query.orderId as string;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId é obrigatório' });
    }

    const details = await getOrderDetails(orderId);

    // Mascara recipient_id para não vazar IDs completos no frontend por acidente
    const splitMasked = (details.split || []).map(s => ({
      ...s,
      recipient_id: s.recipient_id
        ? `${s.recipient_id.slice(0, 6)}...${s.recipient_id.slice(-4)}`
        : s.recipient_id,
    }));

    return res.status(200).json({
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
    console.error('❌ Erro ao buscar detalhes do pedido:', error);
    const details = (error as any)?.__capturedDetails || undefined;
    return res.status(500).json({
      error: error.message || 'Erro ao buscar detalhes do pedido',
      details,
    });
  }
});

// Iniciar servidor
async function cleanupPendingPayments() {
  try {
    const noTxThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const withTxThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data: noTx } = await supabaseAdmin
      .from('appointments')
      .update({
        status: 'cancelled',
        payment_status: 'failed',
        cancellation_source: 'system_abandoned_checkout',
        cancellation_detail: 'Limpeza automática: pagamento obrigatório não iniciado (sem ID de transação) por mais de 15 min.',
      } as any)
      .eq('status', 'pending_payment')
      .is('payment_transaction_id', null)
      .lt('created_at', noTxThreshold)
      .select('id');

    const { data: staleWithTx } = await supabaseAdmin
      .from('appointments')
      .select('id,payment_status,pix_payment_status')
      .eq('status', 'pending_payment')
      .not('payment_transaction_id', 'is', null)
      .lt('created_at', withTxThreshold);

    let cancelledWithTx = 0;
    if (staleWithTx && staleWithTx.length > 0) {
      const ids = staleWithTx
        .filter((r: any) => {
          const ps = String(r?.payment_status || '').toLowerCase();
          const pix = String(r?.pix_payment_status || '').toLowerCase();
          return ps !== 'paid' && pix !== 'confirmado' && pix !== 'aprovado';
        })
        .map((r: any) => r.id)
        .filter(Boolean);
      if (ids.length > 0) {
        await supabaseAdmin
          .from('appointments')
          .update({
            status: 'cancelled',
            payment_status: 'failed',
            cancellation_source: 'system_payment_timeout',
            cancellation_detail: 'Limpeza automática: pagamento iniciado mas não confirmado por mais de 12h.',
          } as any)
          .in('id', ids);
        cancelledWithTx = ids.length;
      }
    }

    const total = (noTx?.length || 0) + cancelledWithTx;
    if (total > 0) {
      console.log(`🧹 Limpeza de pagamentos pendentes: ${total} cancelados (${noTx?.length || 0} sem tx, ${cancelledWithTx} expirados)`);
    }
  } catch (err) {
    console.error('❌ Erro na limpeza de pagamentos pendentes:', err);
  }
}

app.listen(PORT, () => {
  try {
    initializeWhatsAppServices();
  } catch (err) {
    console.error('❌ Erro ao inicializar WhatsApp services (servidor continua rodando):', err);
  }

  // Limpeza de agendamentos com pagamento pendente expirado (a cada 5 min)
  setInterval(cleanupPendingPayments, 5 * 60 * 1000);
  cleanupPendingPayments();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 SERVIDOR DE API EXPRESS RODANDO!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`📍 URL: http://localhost:${PORT}`);
  const platformRecipientId = String(process.env.PAGARME_PLATFORM_RECIPIENT_ID || '').trim();
  const platformFeeCents = String(process.env.PLATFORM_FEE_CENTS || '100').trim();
  console.log(`💰 Split plataforma configurado? ${platformRecipientId ? 'SIM' : 'NÃO'}`);
  console.log(`   - PAGARME_PLATFORM_RECIPIENT_ID: ${platformRecipientId ? `${platformRecipientId.slice(0, 6)}...` : '(vazio)'}`);
  console.log(`   - PLATFORM_FEE_CENTS: ${platformFeeCents}`);
  console.log(`📡 Rotas disponíveis:`);
  console.log(`   POST /api/pagarme/create-recipient`);
  console.log(`   POST /api/pagarme/create-payment`);
  console.log(`   GET  /api/pagarme/check-status`);
  console.log(`   GET  /api/mercadopago/oauth/authorize`);
  console.log(`   GET  /api/mercadopago/oauth/callback`);
  console.log(`   POST /api/mercadopago/create-payment`);
  console.log(`   GET  /api/mercadopago/check-status`);
  console.log(`   POST /api/mercadopago/reconcile-pending-appointments`);
  console.log(`   POST /api/whatsapp/connect`);
  console.log(`   GET  /api/whatsapp/status`);
  console.log(`   GET  /api/whatsapp/qr`);
  console.log(`   POST /api/whatsapp/disconnect`);
  console.log(`   POST /api/whatsapp/send`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('👀 ATENÇÃO: Os logs das requisições aparecerão AQUI neste terminal!');
  console.log('   Quando você clicar em "Salvar e Ativar" no navegador,');
  console.log('   os logs aparecerão abaixo desta mensagem.');
  console.log('');
});

export default app;

