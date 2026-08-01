import type { Handler } from '@netlify/functions';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { createMPPayment, CreateMPPaymentRequest } from '../../src/lib/mercadopago/mp-service';
import { json, parseJsonBody } from './_utils';

const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const PLATFORM_MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
const SUBSCRIPTION_BACK_URL = String(process.env.MERCADOPAGO_SUBSCRIPTION_BACK_URL || '').trim();

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;

const normalizeStatus = (raw: unknown): 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' => {
  const status = String(raw || '').toLowerCase().trim();
  if (status === 'approved' || status === 'authorized') return 'paid';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  if (status === 'rejected') return 'failed';
  return 'pending';
};

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

const getNextDueDate = (planTypeRaw: unknown) => {
  const planType = String(planTypeRaw || 'monthly').toLowerCase().trim();
  const today = new Date();
  if (planType === 'annual') return toISODate(addMonths(today, 12));
  if (planType === 'trial') return toISODate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
  return toISODate(addMonths(today, 1));
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, { error: 'Supabase admin nao configurado' });
    }
    if (!PLATFORM_MP_ACCESS_TOKEN) {
      return json(500, { error: 'MERCADOPAGO_ACCESS_TOKEN nao configurado' });
    }

    const body = parseJsonBody<any>(event) || {};
    const establishmentId = String(body?.establishmentId || '').trim();
    const payerEmailRaw = String(body?.payer?.email || '').trim().toLowerCase();
    const descriptionRaw = String(body?.description || '').trim();

    if (!establishmentId) {
      return json(400, {
        error: 'Dados invalidos',
        required: ['establishmentId'],
      });
    }

    // Preferência: valor por estabelecimento (coluna nova). Fallback seguro para global antigo.
    let establishment: any = null;
    let amountCents = 0;
    const { data: estWithAmount, error: estWithAmountError } = await supabaseAdmin
      .from('establishments')
      .select('id, name, plan_type, mercadopago_billing_amount')
      .eq('id', establishmentId)
      .single();

    if (!estWithAmountError && estWithAmount) {
      establishment = estWithAmount;
      const estAmount = Number((estWithAmount as any)?.mercadopago_billing_amount ?? 0);
      amountCents = Math.round(estAmount * 100);
    } else {
      const errMsg = String((estWithAmountError as any)?.message || '').toLowerCase();
      const missingColumn = errMsg.includes('mercadopago_billing_amount') || errMsg.includes('column');

      const { data: estFallback, error: estFallbackError } = await supabaseAdmin
        .from('establishments')
        .select('id, name, plan_type')
        .eq('id', establishmentId)
        .single();

      if (estFallbackError || !estFallback) {
        return json(404, { error: 'Estabelecimento nao encontrado' });
      }

      establishment = estFallback;
      if (!missingColumn) {
        console.warn('⚠️ [MP Establishment Billing] Falha ao ler mercadopago_billing_amount; usando fallback global.', estWithAmountError);
      }
    }

    if (amountCents <= 0) {
      const { data: adminConfig, error: adminConfigError } = await supabaseAdmin
        .from('admin_billing_links')
        .select('mercadopago_billing_amount')
        .eq('id', 'global')
        .maybeSingle();

      if (!adminConfigError) {
        const amountBRL = Number((adminConfig as any)?.mercadopago_billing_amount ?? 0);
        amountCents = Math.round(amountBRL * 100);
      }
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json(400, {
        error: 'Valor cobranca MP nao configurado para este estabelecimento',
        userMessage: 'Configure o valor de cobrança PIX desta barbearia no Admin.',
      });
    }

    const payerEmail = payerEmailRaw || `billing_${establishmentId.slice(0, 8)}@agendeifacil.com`;
    const description = descriptionRaw || `Regularizacao Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`;

    const metadata = {
      type: 'establishment_billing',
      establishment_id: establishmentId,
      source: 'establishment_dashboard',
      created_at: new Date().toISOString(),
    };

    const tokenRaw = String(body?.token || '').trim();
    const pmIdRaw = String(body?.payment_method_id || '').trim();
    const isCard = Boolean(tokenRaw && pmIdRaw);
    const shouldCreateRecurringSubscription = isCard && body?.create_recurring_subscription === true;

    // -------------------------------------------------------------------------
    // 🏆 META MENSAL — crédito de desconto. SOMENTE no caminho PIX.
    //
    // Por que só PIX: o cartão recorrente grava o valor em `auto_recurring.
    // transaction_amount`, que vira o valor PERMANENTE da assinatura no Mercado
    // Pago. Não existe PUT /preapproval neste projeto, então um desconto ali
    // seria irreversível. O caminho do cartão fica intocado de propósito.
    //
    // O percentual vem SEMPRE do banco (consume_monthly_goal_credit é exclusiva
    // do service_role). O navegador apenas pede "quero usar" — nunca informa
    // quanto. Assim ninguém forja desconto pelo console.
    //
    // Consumimos ANTES de criar a cobrança: se o Mercado Pago falhar, o crédito
    // fica marcado sem cobrança vinculada e volta a ficar disponível sozinho
    // (ver a consulta em 20260730130000_..._history.sql). O caminho inverso
    // seria pior — cobrança com desconto sem o crédito ter sido gasto.
    // -------------------------------------------------------------------------
    const wantsGoalCredit = body?.use_monthly_goal_credit === true;
    const amountCentsBeforeCredit = amountCents;
    let goalCreditApplied = false;
    let goalCreditPercent = 0;
    let goalCreditGoalId = '';
    let goalCreditDiscountCents = 0;

    const revertGoalCredit = async (reason: string) => {
      if (!goalCreditGoalId) return;
      try {
        await supabaseAdmin
          .from('establishment_monthly_goals')
          .update({ status: 'closed', applied_at: null, applied_charge_id: null } as any)
          .eq('id', goalCreditGoalId);
      } catch (revertError: any) {
        console.warn(`⚠️ [MP Establishment Billing] Falha ao devolver crédito (${reason}):`, revertError?.message);
      }
    };

    if (wantsGoalCredit && !isCard) {
      try {
        const { data: creditData, error: creditError } = await supabaseAdmin.rpc('consume_monthly_goal_credit', {
          p_establishment_id: establishmentId,
          p_billing_payment_id: null,
        });

        if (creditError) {
          // Migration da Meta Mensal ainda não aplicada: segue com valor cheio.
          console.warn('⚠️ [MP Establishment Billing] Crédito Meta Mensal indisponível:', creditError?.message);
        } else if ((creditData as any)?.applied === true) {
          const pct = Math.min(100, Math.max(0, Math.floor(Number((creditData as any)?.percent) || 0)));
          if (pct > 0) {
            goalCreditApplied = true;
            goalCreditPercent = pct;
            goalCreditGoalId = String((creditData as any)?.goal_id || '');
            goalCreditDiscountCents = Math.min(
              amountCents,
              Math.max(0, Math.round((amountCents * pct) / 100))
            );
            amountCents = amountCents - goalCreditDiscountCents;
          }
        }
      } catch (creditError: any) {
        // Nunca derruba a cobrança por causa do desconto: sem crédito, valor cheio.
        console.warn('⚠️ [MP Establishment Billing] Falha ao consumir crédito Meta Mensal:', creditError?.message);
      }
    }

    // 100% de desconto: o Mercado Pago rejeita cobrança de R$ 0,00.
    // Decisão do produto: avisar e o admin marca como pago manualmente.
    // O crédito é DEVOLVIDO — nada foi cobrado, então nada foi gasto.
    if (goalCreditApplied && amountCents <= 0) {
      await revertGoalCredit('mensalidade gratuita');
      return json(200, {
        ok: false,
        monthly_goal_free_month: true,
        monthly_goal_percent: goalCreditPercent,
        amount_cents_before_credit: amountCentsBeforeCredit,
        error: 'Mensalidade gratuita pela Meta Mensal',
        userMessage:
          'Parabéns! Você bateu a Meta Mensal e sua mensalidade deste mês é GRATUITA. Não é preciso pagar nada — chame o suporte no WhatsApp para liberar.',
      });
    }

    if (isCard && shouldCreateRecurringSubscription) {
      const payer = body?.payer || {};
      const idType = String(payer?.identification?.type || 'CPF').toUpperCase();
      const idNum = String(payer?.identification?.number || '').replace(/\D/g, '');
      const addr = payer?.address || {};
      if (!payer?.email || !idNum || !(idType === 'CPF' || idType === 'CNPJ')) {
        return json(400, { error: 'Para cartão: payer.email e payer.identification são obrigatórios' });
      }
      if (!addr?.zip_code || !addr?.street_name || addr?.street_number == null || !addr?.city || !addr?.federal_unit) {
        return json(400, { error: 'Para cartão: endereço de cobrança completo é obrigatório' });
      }

      const payerEmailForCard = String(payer.email).trim().toLowerCase();
      const backUrlCandidate = String(body?.backUrl || SUBSCRIPTION_BACK_URL || '').trim();
      const backUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;
      const externalReference = `establishment_billing_subscription:${establishmentId}`;
      const preapprovalPayload: any = {
        reason: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
        payer_email: payerEmailForCard,
        card_token_id: tokenRaw,
        external_reference: externalReference,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: amountCents / 100,
          currency_id: 'BRL',
        },
        status: 'authorized',
      };
      if (backUrl) preapprovalPayload.back_url = backUrl;

      const preapprovalResp = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
        headers: {
          Authorization: `Bearer ${PLATFORM_MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `est_bill_recur_card_${establishmentId}_${tokenRaw.slice(-24)}`,
        },
      });

      const preapproval = preapprovalResp.data || {};
      const preapprovalId = String(preapproval?.id || '').trim();
      if (!preapprovalId) return json(500, { error: 'Mercado Pago nao retornou ID da assinatura.' });

      const normalized = normalizeStatus(preapproval?.status);
      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from('establishment_billing_subscriptions')
        .upsert(
          {
            establishment_id: establishmentId,
            preapproval_id: preapprovalId,
            status: String(preapproval?.status || 'authorized'),
            payer_email: payerEmailForCard,
            amount_cents: amountCents,
            description: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
            init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
            payment_provider: 'mercadopago',
            external_reference: externalReference,
            metadata: {
              type: 'establishment_billing_subscription',
              establishment_id: establishmentId,
              created_from: 'establishment_dashboard_card_token',
            },
            updated_at: nowIso,
          } as any,
          { onConflict: 'preapproval_id' }
        );

      await supabaseAdmin
        .from('establishment_billing_payments')
        .upsert(
          {
            establishment_id: establishmentId,
            amount_cents: amountCents,
            payment_provider: 'mercadopago_card_recurring',
            payment_id: preapprovalId,
            status: normalized,
            description,
            qr_code: null,
            qr_code_base64: null,
            metadata: {
              ...metadata,
              payment_method: 'recurring_card',
              preapproval_id: preapprovalId,
              external_reference: externalReference,
            },
            paid_at: normalized === 'paid' ? nowIso : null,
            updated_at: nowIso,
          } as any,
          { onConflict: 'payment_id' }
        );

      if (normalized === 'paid') {
        await supabaseAdmin
          .from('establishments')
          .update({
            payment_status: 'paid',
            is_blocked: false,
            is_deleted: false,
            payment_alert_enabled: false,
            payment_paid_at: nowIso,
            payment_due_date: getNextDueDate((establishment as any)?.plan_type),
          } as any)
          .eq('id', establishmentId);
      }

      return json(200, {
        id: preapprovalId,
        status: String(preapproval?.status || ''),
        billing_type: 'establishment_billing',
        subscription_type: 'establishment_billing_recurring_card',
        amount_cents_used: amountCents,
        amount_brl_used: amountCents / 100,
        recurrence_created: true,
        preapproval_id: preapprovalId,
      });
    }

    let paymentData: CreateMPPaymentRequest;

    if (isCard) {
      const payer = body?.payer || {};
      const idType = String(payer?.identification?.type || 'CPF').toUpperCase();
      const idNum = String(payer?.identification?.number || '').replace(/\D/g, '');
      const addr = payer?.address || {};
      if (!payer?.email || !idNum || !(idType === 'CPF' || idType === 'CNPJ')) {
        return json(400, { error: 'Para cartão: payer.email e payer.identification são obrigatórios' });
      }
      if (!addr?.zip_code || !addr?.street_name || addr?.street_number == null || !addr?.city || !addr?.federal_unit) {
        return json(400, { error: 'Para cartão: endereço de cobrança completo é obrigatório' });
      }
      paymentData = {
        amount: amountCents,
        description,
        access_token: PLATFORM_MP_ACCESS_TOKEN,
        payment_method_id: pmIdRaw,
        token: tokenRaw,
        issuer_id: String(body?.issuer_id || '').trim() || undefined,
        installments: Number(body?.installments) > 0 ? Number(body?.installments) : 1,
        payer: {
          email: String(payer.email).trim().toLowerCase(),
          first_name: String(payer.first_name || 'Cliente').trim(),
          last_name: String(payer.last_name || 'Cliente').trim(),
          identification: {
            type: idType === 'CNPJ' ? 'CNPJ' : 'CPF',
            number: idNum,
          },
          address: {
            zip_code: String(addr.zip_code).replace(/\D/g, ''),
            street_name: String(addr.street_name || '').trim(),
            street_number: Number(addr.street_number) || 0,
            neighborhood: String(addr.neighborhood || '').trim() || '—',
            city: String(addr.city || '').trim(),
            federal_unit: String(addr.federal_unit || '').trim().slice(0, 2).toUpperCase(),
          },
        },
        metadata,
      };
    } else {
      paymentData = {
        amount: amountCents,
        description,
        payer: { email: payerEmail },
        access_token: PLATFORM_MP_ACCESS_TOKEN,
        payment_method_id: 'pix',
        metadata,
      };
    }

    const payment = await createMPPayment(paymentData);
    const paymentId = String((payment as any)?.id || '').trim();
    if (!paymentId) {
      return json(500, { error: 'Pagamento criado sem ID' });
    }

    const normalized = normalizeStatus((payment as any)?.status);
    const pixData = (payment as any)?.point_of_interaction?.transaction_data || {};

    const { error: saveError } = await supabaseAdmin
      .from('establishment_billing_payments')
      .upsert(
        {
          establishment_id: establishmentId,
          amount_cents: amountCents,
          payment_provider: 'mercadopago',
          payment_id: paymentId,
          status: normalized,
          description,
          qr_code: isCard ? null : String(pixData?.qr_code || '') || null,
          qr_code_base64: isCard ? null : String(pixData?.qr_code_base64 || '') || null,
          metadata: {
            ...metadata,
            ...(isCard ? { payment_method: 'credit_card' } : { payment_method: 'pix' }),
            // Auditoria do desconto: fica registrado quanto era e quanto virou.
            ...(goalCreditApplied
              ? {
                monthly_goal_credit_applied: true,
                monthly_goal_percent: goalCreditPercent,
                monthly_goal_discount_cents: goalCreditDiscountCents,
                monthly_goal_amount_before_cents: amountCentsBeforeCredit,
                monthly_goal_id: goalCreditGoalId || null,
              }
              : {}),
          },
          paid_at: normalized === 'paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'payment_id' }
      );

    if (saveError) {
      console.error('❌ [MP Establishment Billing] Erro ao salvar cobranca:', saveError);
      return json(500, { error: 'Erro ao salvar cobranca', details: saveError.message });
    }

    // Vincula o crédito à cobrança gerada. É o que permite devolver o crédito
    // caso este PIX nunca seja pago (o barbeiro não perde o desconto por ter
    // fechado o app antes de pagar).
    //
    // Feito em consulta SEPARADA de propósito: a cobrança já foi criada no
    // Mercado Pago e salva. Se qualquer coisa falhar daqui para baixo, o PIX
    // continua válido — o vínculo é conveniência, não pré-requisito.
    if (goalCreditApplied && goalCreditGoalId) {
      try {
        const { data: savedPayment } = await supabaseAdmin
          .from('establishment_billing_payments')
          .select('id')
          .eq('payment_id', paymentId)
          .maybeSingle();

        if ((savedPayment as any)?.id) {
          await supabaseAdmin
            .from('establishment_monthly_goals')
            .update({ applied_charge_id: (savedPayment as any).id } as any)
            .eq('id', goalCreditGoalId);
        }
      } catch (linkError: any) {
        console.warn('⚠️ [MP Establishment Billing] Crédito consumido mas não vinculado à cobrança:', linkError?.message);
      }
    }

    let recurrenceCreated = false;
    let preapprovalId = '';
    if (isCard && normalized === 'paid' && shouldCreateRecurringSubscription) {
      const cardId = String((payment as any)?.card?.id || (payment as any)?.card_id || '').trim();
      if (cardId) {
        try {
          const backUrlCandidate = String(body?.backUrl || SUBSCRIPTION_BACK_URL || '').trim();
          const backUrl = /^https:\/\//i.test(backUrlCandidate) ? backUrlCandidate : undefined;
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          const preapprovalPayload: any = {
            reason: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
            payer_email: String(paymentData.payer.email || payerEmail).trim().toLowerCase(),
            card_id: Number(cardId),
            external_reference: `establishment_billing_subscription:${establishmentId}`,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              start_date: nextMonth.toISOString(),
              transaction_amount: amountCents / 100,
              currency_id: 'BRL',
            },
            status: 'authorized',
          };
          if (backUrl) preapprovalPayload.back_url = backUrl;

          const preapprovalResp = await axios.post(`${MP_API_BASE_URL}/preapproval`, preapprovalPayload, {
            headers: {
              Authorization: `Bearer ${PLATFORM_MP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': `est_bill_recur_${paymentId}`,
            },
          });
          const preapproval = preapprovalResp.data || {};
          preapprovalId = String(preapproval?.id || '').trim();
          recurrenceCreated = Boolean(preapprovalId);
          if (preapprovalId) {
            await supabaseAdmin
              .from('establishment_billing_subscriptions')
              .upsert(
                {
                  establishment_id: establishmentId,
                  preapproval_id: preapprovalId,
                  status: String(preapproval?.status || 'authorized'),
                  payer_email: String(paymentData.payer.email || payerEmail).trim().toLowerCase(),
                  amount_cents: amountCents,
                  description: `Assinatura mensal Agendei Facil - ${String((establishment as any)?.name || 'Estabelecimento')}`,
                  init_point: String(preapproval?.init_point || preapproval?.sandbox_init_point || '') || null,
                  payment_provider: 'mercadopago',
                  metadata: {
                    type: 'establishment_billing_subscription',
                    establishment_id: establishmentId,
                    first_payment_id: paymentId,
                    starts_after_first_paid_month: true,
                  },
                  updated_at: new Date().toISOString(),
                } as any,
                { onConflict: 'preapproval_id' }
              );
          }
        } catch (recurrenceError: any) {
          console.warn('⚠️ [MP Establishment Billing] Mensalidade atual paga, mas recorrência não foi criada:', recurrenceError?.response?.data || recurrenceError?.message);
        }
      }
    }

    if (isCard && normalized === 'paid' && shouldCreateRecurringSubscription && !recurrenceCreated) {
      return json(409, {
        ok: false,
        error: 'Mensalidade atual foi paga, mas a recorrência não foi criada no Mercado Pago. Não feche: chame o suporte para vincular a assinatura antes do próximo mês.',
        payment_id: paymentId,
        status: normalized,
        recurrence_created: false,
      });
    }

    return json(200, {
      ...payment,
      billing_type: 'establishment_billing',
      application_fee_cents_expected: 0,
      amount_cents_used: amountCents,
      amount_brl_used: amountCents / 100,
      recurrence_created: recurrenceCreated,
      preapproval_id: preapprovalId || null,
      monthly_goal_credit_applied: goalCreditApplied,
      monthly_goal_percent: goalCreditPercent,
      monthly_goal_discount_cents: goalCreditDiscountCents,
      amount_cents_before_credit: amountCentsBeforeCredit,
    });
  } catch (error: any) {
    console.error('❌ [MP Establishment Billing] Erro:', error);
    return json(500, {
      error: String(error?.message || 'Erro ao criar cobranca PIX'),
    });
  }
};
