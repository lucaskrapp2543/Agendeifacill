import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { confirmPendingAppointmentFromMpPaymentMetadata } from '../../src/lib/mercadopago/confirmAppointmentFromMpPayment';
import { refreshAccessToken } from '../../src/lib/mercadopago/mp-oauth';
import { checkMPPaymentStatus } from '../../src/lib/mercadopago/mp-service';
import { json, parseJsonBody } from './_utils';

// Supabase Admin (bypass RLS)
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
const PLATFORM_MP_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

const normalizeBillingStatus = (raw: unknown): 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' => {
  const status = String(raw || '').toLowerCase().trim();
  if (status === 'approved' || status === 'authorized') return 'paid';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  if (status === 'rejected') return 'failed';
  return 'pending';
};

const getNextDueDate = (planTypeRaw: unknown): string => {
  const planType = String(planTypeRaw || 'monthly').toLowerCase().trim();
  const today = new Date();
  let next = new Date(today);

  if (planType === 'annual') {
    next = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  } else if (planType === 'trial') {
    next = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    next = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  }

  return next.toISOString().split('T')[0];
};

const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

const normalizeSubscriptionPaymentStatus = (raw: unknown): 'paid' | 'pending' | 'failed' | 'cancelled' => {
  const status = String(raw || '').toLowerCase().trim();
  if (status === 'approved' || status === 'authorized' || status === 'paid') return 'paid';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'rejected' || status === 'refused' || status === 'failed') return 'failed';
  return 'pending';
};

export const handler: Handler = async (event) => {
  // Webhooks do Mercado Pago podem ser GET (verificação) ou POST (notificação)
  if (event.httpMethod === 'GET') {
    // Verificação de URL (ping do Mercado Pago)
    return json(200, { status: 'ok', message: 'Webhook endpoint ativo' });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST, GET' });
  }

  try {
    if (!supabaseAdmin) {
      return json(500, {
        error: 'Supabase admin não configurado',
      });
    }

    // Parse do body (Mercado Pago envia como x-www-form-urlencoded ou JSON)
    let webhookData: any;

    if (event.headers['content-type']?.includes('application/json')) {
      webhookData = parseJsonBody(event);
    } else if (event.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      // Mercado Pago pode enviar como form-urlencoded
      const params = new URLSearchParams(event.body || '');
      const dataParam = params.get('data');
      if (dataParam) {
        try {
          webhookData = JSON.parse(dataParam);
        } catch {
          webhookData = { id: dataParam };
        }
      } else {
        webhookData = Object.fromEntries(params);
      }
    } else {
      // Tentar parse JSON direto
      webhookData = parseJsonBody(event);
    }

    if (!webhookData) {
      console.warn('⚠️ [MP Webhook] Body vazio ou inválido');
      return json(400, { error: 'Body inválido' });
    }

    console.log('📨 [MP Webhook] Notificação recebida:', {
      type: webhookData.type,
      action: webhookData.action,
      id: webhookData.id,
      data: webhookData.data,
    });

    // Mercado Pago envia diferentes tipos de notificações.
    // Para recorrência real (preapproval), também tratamos o tipo "subscription_preapproval".
    if (webhookData.type === 'subscription_preapproval') {
      const preapprovalId = String(webhookData.data?.id || webhookData.id || '').trim();
      if (!preapprovalId) {
        return json(400, { error: 'preapproval id não encontrado' });
      }

      const { data: rows, error: rowsError } = await supabaseAdmin
        .from('client_subscriptions')
        .select('id, establishment_id, subscription_id, payment_status, subscription_payment_order_id')
        .eq('subscription_payment_order_id', preapprovalId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (rowsError) {
        console.error('❌ [MP Webhook] Erro ao buscar assinantes pelo preapproval_id:', rowsError);
        return json(200, { message: 'Webhook recebido, mas erro ao buscar assinantes' });
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return json(200, { message: 'Webhook preapproval recebido sem assinante vinculado' });
      }

      const establishmentId = String((rows[0] as any)?.establishment_id || '').trim();
      if (!establishmentId) {
        return json(200, { message: 'Webhook preapproval recebido sem establishment_id válido' });
      }

      const { data: establishment } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token')
        .eq('id', establishmentId)
        .single();

      const accessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
      if (!accessToken) {
        return json(200, { message: 'Webhook preapproval recebido, mas estabelecimento sem token MP' });
      }

      const MP_API_BASE_URL = String(process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com').trim();
      const preapprovalResp = await axios.get(
        `${MP_API_BASE_URL}/preapproval/${encodeURIComponent(preapprovalId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const preapproval = preapprovalResp.data || {};
      const status = String(preapproval?.status || '').toLowerCase().trim();
      if (status !== 'authorized') {
        return json(200, {
          message: 'Webhook preapproval recebido (status ainda não autorizado)',
          preapprovalId,
          status,
        });
      }

      const subscriptionIds = Array.from(new Set(rows.map((r: any) => String(r.subscription_id || '').trim()).filter(Boolean)));
      const { data: subscriptionRows } = await supabaseAdmin
        .from('subscriptions')
        .select('id, duration_months')
        .in('id', subscriptionIds);
      const durationBySubscription = new Map<string, number>();
      (subscriptionRows || []).forEach((s: any) => {
        durationBySubscription.set(String(s?.id || ''), Number(s?.duration_months || 1));
      });

      const now = new Date();
      for (const row of rows as any[]) {
        const sid = String(row?.subscription_id || '').trim();
        const durationMonths = durationBySubscription.get(sid) || 1;
        const startDate = toISODate(now);
        const endDate = toISODate(addMonths(now, Number.isFinite(durationMonths) && durationMonths > 0 ? durationMonths : 1));

        const { error: updErr } = await supabaseAdmin
          .from('client_subscriptions')
          .update({
            payment_status: 'paid',
            last_payment_date: startDate,
            start_date: startDate,
            end_date: endDate,
            subscriber_payment_method: 'credito',
            subscription_payment_provider: 'mercadopago_card_recurring',
            subscription_payment_order_id: preapprovalId,
          } as any)
          .eq('id', String(row.id));

        if (updErr) {
          console.error('❌ [MP Webhook] Erro ao ativar assinante por preapproval:', updErr);
        }
      }

      return json(200, {
        message: 'Webhook de assinatura recorrente processado automaticamente',
        preapprovalId,
        updatedSubscribers: rows.length,
      });
    } else if (webhookData.type === 'payment') {
      const paymentId = webhookData.data?.id || webhookData.id;

      if (!paymentId) {
        console.warn('⚠️ [MP Webhook] Payment ID não encontrado');
        return json(400, { error: 'Payment ID não encontrado' });
      }

      console.log('💳 [MP Webhook] Processando pagamento:', paymentId);

      // Buscar agendamento pelo payment_transaction_id (fluxo legado de agendamentos)
      const { data: appointments, error: fetchError } = await supabaseAdmin
        .from('appointments')
        .select('id, establishment_id, payment_transaction_id, payment_method, status, payment_status')
        .eq('payment_transaction_id', String(paymentId))
        .limit(1);

      if (fetchError) {
        console.error('❌ [MP Webhook] Erro ao buscar agendamento:', fetchError);
        return json(500, { error: 'Erro ao buscar agendamento' });
      }

      // Buscar cobrança de regularização da barbearia (novo fluxo)
      const { data: billingRows, error: billingFetchError } = await supabaseAdmin
        .from('establishment_billing_payments')
        .select('id, establishment_id, payment_id, status')
        .eq('payment_id', String(paymentId))
        .limit(1);

      if (billingFetchError) {
        const msg = String((billingFetchError as any)?.message || '').toLowerCase();
        const missingTable =
          msg.includes('relation') ||
          msg.includes('does not exist') ||
          msg.includes('schema cache') ||
          msg.includes('establishment_billing_payments');
        if (missingTable) {
          console.warn('⚠️ [MP Webhook] Tabela establishment_billing_payments indisponível. Seguindo fluxo legado sem bloquear agendamentos.');
        } else {
          console.error('❌ [MP Webhook] Erro ao buscar cobrança de estabelecimento:', billingFetchError);
        }
      }

      const hasAppointment = Array.isArray(appointments) && appointments.length > 0;
      const hasBilling = !billingFetchError && Array.isArray(billingRows) && billingRows.length > 0;

      if (!hasAppointment && !hasBilling) {
        // Fluxo de cobrança recorrente por assinatura no cartão:
        // quando o pagamento não pertence a appointments nem à cobrança PIX avulsa,
        // tentamos identificar pelo external_reference do pagamento.
        let maybeSubscriptionCheckoutHandled = false;
        if (PLATFORM_MP_ACCESS_TOKEN) {
          try {
            const payment = await checkMPPaymentStatus(Number(paymentId), PLATFORM_MP_ACCESS_TOKEN);
            const externalReference = String((payment as any)?.external_reference || '').trim();
            const recurringPrefix = 'establishment_billing_subscription:';
            const isRecurringSubscriptionPayment = externalReference.startsWith(recurringPrefix);
            if (isRecurringSubscriptionPayment) {
              const establishmentId = externalReference.slice(recurringPrefix.length).trim();
              const normalized = normalizeBillingStatus((payment as any)?.status);
              const nowIso = new Date().toISOString();
              const amountCents = Math.round(Number((payment as any)?.transaction_amount || 0) * 100);

              if (establishmentId) {
                const { error: upsertBillingError } = await supabaseAdmin
                  .from('establishment_billing_payments')
                  .upsert(
                    {
                      establishment_id: establishmentId,
                      amount_cents: Number.isFinite(amountCents) && amountCents > 0 ? amountCents : 0,
                      payment_provider: 'mercadopago_subscription',
                      payment_id: String(paymentId),
                      status: normalized,
                      description: 'Cobranca recorrente mensal via cartao',
                      metadata: {
                        type: 'establishment_billing_subscription_payment',
                        external_reference: externalReference,
                      },
                      paid_at: normalized === 'paid' ? nowIso : null,
                      updated_at: nowIso,
                    } as any,
                    { onConflict: 'payment_id' }
                  );

                if (upsertBillingError) {
                  console.error('❌ [MP Webhook] Erro ao salvar pagamento recorrente em billing_payments:', upsertBillingError);
                }

                const { data: estData } = await supabaseAdmin
                  .from('establishments')
                  .select('id, plan_type')
                  .eq('id', establishmentId)
                  .single();

                if (normalized === 'paid' && estData?.id) {
                  const { error: estUpdateError } = await supabaseAdmin
                    .from('establishments')
                    .update({
                      payment_status: 'paid',
                      is_blocked: false,
                      payment_alert_enabled: false,
                      payment_paid_at: nowIso,
                      payment_due_date: getNextDueDate((estData as any)?.plan_type),
                    } as any)
                    .eq('id', String((estData as any).id));
                  if (estUpdateError) {
                    console.error('❌ [MP Webhook] Erro ao regularizar estabelecimento por recorrência:', estUpdateError);
                  }
                }

                const { error: subscriptionUpdateError } = await supabaseAdmin
                  .from('establishment_billing_subscriptions')
                  .update({
                    status: normalized === 'paid' ? 'authorized' : normalized,
                    last_charged_payment_id: String(paymentId),
                    last_charged_at: normalized === 'paid' ? nowIso : null,
                    updated_at: nowIso,
                  } as any)
                  .eq('establishment_id', establishmentId);

                if (subscriptionUpdateError) {
                  const msg = String((subscriptionUpdateError as any)?.message || '').toLowerCase();
                  const missingTable = msg.includes('establishment_billing_subscriptions') || msg.includes('relation') || msg.includes('does not exist');
                  if (!missingTable) {
                    console.error('❌ [MP Webhook] Erro ao atualizar assinatura recorrente:', subscriptionUpdateError);
                  }
                }

                return json(200, {
                  message: 'Webhook de cobrança recorrente processado',
                  establishmentId,
                  paymentStatus: (payment as any)?.status || 'unknown',
                  billingStatus: normalized,
                });
              }
            }

            const subscriptionCheckoutPrefix = 'subscription_checkout:';
            const isSubscriptionCheckoutPayment = externalReference.startsWith(subscriptionCheckoutPrefix);
            if (isSubscriptionCheckoutPayment) {
              const parts = externalReference.split(':');
              const establishmentId = String(parts[1] || '').trim();
              const subscriptionId = String(parts[2] || '').trim();
              const subscriptionStatus = normalizeSubscriptionPaymentStatus((payment as any)?.status);

              if (establishmentId && subscriptionId) {
                const lookupOrderIds = [externalReference, String(paymentId)].filter(Boolean);
                const { data: subscriberRows, error: subscriberFetchError } = await supabaseAdmin
                  .from('client_subscriptions')
                  .select('id, payment_status, subscription_payment_order_id')
                  .eq('establishment_id', establishmentId)
                  .eq('subscription_id', subscriptionId)
                  .in('subscription_payment_order_id', lookupOrderIds)
                  .order('created_at', { ascending: false })
                  .limit(20);

                if (subscriberFetchError) {
                  console.error('❌ [MP Webhook] Erro ao buscar assinaturas pendentes (checkout externo):', subscriberFetchError);
                } else if (Array.isArray(subscriberRows) && subscriberRows.length > 0) {
                  if (subscriptionStatus === 'paid') {
                    const ids = subscriberRows.map((r: any) => String(r.id)).filter(Boolean);
                    if (ids.length > 0) {
                      const { error: subscriberUpdateError } = await supabaseAdmin
                        .from('client_subscriptions')
                        .update({
                          payment_status: 'paid',
                          last_payment_date: toISODate(new Date()),
                          subscriber_payment_method: 'credito',
                          subscription_payment_provider: 'mercadopago_card',
                          subscription_payment_order_id: String(paymentId),
                        } as any)
                        .in('id', ids);

                      if (subscriberUpdateError) {
                        console.error('❌ [MP Webhook] Erro ao marcar assinante como pago automaticamente:', subscriberUpdateError);
                      } else {
                        maybeSubscriptionCheckoutHandled = true;
                        return json(200, {
                          message: 'Webhook de assinatura externa processado automaticamente',
                          establishmentId,
                          subscriptionId,
                          paymentId: String(paymentId),
                          paymentStatus: String((payment as any)?.status || ''),
                          updatedSubscribers: ids.length,
                        });
                      }
                    }
                  } else {
                    maybeSubscriptionCheckoutHandled = true;
                    return json(200, {
                      message: 'Webhook de assinatura externa recebido (ainda não aprovado)',
                      establishmentId,
                      subscriptionId,
                      paymentId: String(paymentId),
                      paymentStatus: String((payment as any)?.status || ''),
                    });
                  }
                }
              }
            }

            const appointmentFallback = await confirmPendingAppointmentFromMpPaymentMetadata(
              supabaseAdmin,
              String(paymentId),
              payment
            );
            if (appointmentFallback.ok) {
              return json(200, {
                message: 'Webhook agendamento confirmado via external_reference/metadata',
                appointmentId: appointmentFallback.appointmentId,
                paymentId: String(paymentId),
              });
            }
          } catch (err) {
            console.warn('⚠️ [MP Webhook] Falha ao tentar identificar cobrança recorrente:', err);
          }
        }

        if (!maybeSubscriptionCheckoutHandled) {
          console.warn('⚠️ [MP Webhook] Nenhum registro encontrado para payment_id:', paymentId);
        }

        return json(200, { message: 'Webhook recebido, mas registro não encontrado' });
      }

      // Fluxo novo: regularização de pagamento do estabelecimento
      if (hasBilling) {
        if (!PLATFORM_MP_ACCESS_TOKEN) {
          console.error('❌ [MP Webhook] MERCADOPAGO_ACCESS_TOKEN não configurado para cobrança de estabelecimento');
          return json(200, { message: 'Webhook recebido, mas token da plataforma não configurado' });
        }

        const billing = billingRows[0] as any;
        const payment = await checkMPPaymentStatus(Number(paymentId), PLATFORM_MP_ACCESS_TOKEN);
        const billingStatus = normalizeBillingStatus((payment as any)?.status);
        const nowIso = new Date().toISOString();

        const billingUpdatePayload: any = {
          status: billingStatus,
          updated_at: nowIso,
        };
        if (billingStatus === 'paid') billingUpdatePayload.paid_at = nowIso;

        const { error: billingUpdateError } = await supabaseAdmin
          .from('establishment_billing_payments')
          .update(billingUpdatePayload)
          .eq('id', String(billing.id));

        if (billingUpdateError) {
          console.error('❌ [MP Webhook] Erro ao atualizar status da cobrança:', billingUpdateError);
          return json(500, { error: 'Erro ao atualizar cobrança' });
        }

        if (billingStatus === 'paid') {
          const { data: estData, error: estDataError } = await supabaseAdmin
            .from('establishments')
            .select('id, plan_type')
            .eq('id', String(billing.establishment_id))
            .single();

          if (estDataError || !estData) {
            console.error('❌ [MP Webhook] Erro ao buscar estabelecimento para regularização:', estDataError);
            return json(500, { error: 'Erro ao buscar estabelecimento para regularização' });
          }

          const { error: estUpdateError } = await supabaseAdmin
            .from('establishments')
            .update({
              payment_status: 'paid',
              is_blocked: false,
              payment_alert_enabled: false,
              payment_paid_at: nowIso,
              payment_due_date: getNextDueDate((estData as any)?.plan_type),
            } as any)
            .eq('id', String((estData as any).id));

          if (estUpdateError) {
            console.error('❌ [MP Webhook] Erro ao regularizar estabelecimento:', estUpdateError);
            return json(500, { error: 'Erro ao regularizar estabelecimento' });
          }
        }

        return json(200, {
          message: 'Webhook de cobrança do estabelecimento processado',
          paymentStatus: (payment as any)?.status || 'unknown',
          billingStatus,
          establishmentId: String(billing.establishment_id || ''),
        });
      }

      const appointment = appointments![0];
      console.log('📋 [MP Webhook] Agendamento encontrado:', {
        appointmentId: appointment.id,
        currentStatus: appointment.status,
      });

      // Buscar access_token do estabelecimento para verificar status completo
      const { data: establishment, error: estError } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token, mercadopago_refresh_token, mercadopago_token_expires_at')
        .eq('id', appointment.establishment_id)
        .single();

      if (estError || !establishment) {
        console.error('❌ [MP Webhook] Erro ao buscar estabelecimento:', estError);
        return json(500, { error: 'Erro ao buscar estabelecimento' });
      }

      const accessTokenRaw = String((establishment as any)?.mercadopago_access_token || '').trim();
      const refreshTokenRaw = String((establishment as any)?.mercadopago_refresh_token || '').trim();
      const expiresAtRaw = (establishment as any)?.mercadopago_token_expires_at as string | null | undefined;

      if (!accessTokenRaw) {
        console.warn('⚠️ [MP Webhook] Estabelecimento não possui access_token do Mercado Pago');
        return json(200, { message: 'Webhook recebido, mas estabelecimento não configurado' });
      }

      // ✅ Auto-refresh do token (evita falhar webhook após ~6h)
      let accessToken = accessTokenRaw;
      if (expiresAtRaw) {
        const expiresAt = new Date(expiresAtRaw);
        const now = Date.now();
        const safetyMs = 2 * 60 * 1000;
        const isExpired = !Number.isFinite(expiresAt.getTime()) ? false : expiresAt.getTime() <= now + safetyMs;
        if (isExpired && refreshTokenRaw) {
          try {
            const refreshed = await refreshAccessToken(refreshTokenRaw);
            const newAccessToken = String(refreshed.access_token || '').trim();
            const newRefreshToken = String(refreshed.refresh_token || refreshTokenRaw).trim();
            const expiresIn = Number(refreshed.expires_in || 21600);
            const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

            if (newAccessToken) {
              accessToken = newAccessToken;
              await supabaseAdmin
                .from('establishments')
                .update({
                  mercadopago_access_token: newAccessToken,
                  mercadopago_refresh_token: newRefreshToken,
                  mercadopago_token_expires_at: newExpiresAt,
                } as any)
                .eq('id', appointment.establishment_id);
              console.log('✅ [MP Webhook] access_token renovado automaticamente', { establishmentId: appointment.establishment_id });
            }
          } catch (e) {
            console.warn('⚠️ [MP Webhook] Falha ao renovar token automaticamente:', e);
          }
        }
      }

      // Verificar status completo do pagamento na API do Mercado Pago
      try {
        const payment = await checkMPPaymentStatus(Number(paymentId), String(accessToken));

        console.log('📊 [MP Webhook] Status do pagamento:', {
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
        });

        // Se o pagamento foi aprovado, atualizar o agendamento
        if (payment.status === 'approved' || payment.status === 'authorized') {
          console.log('✅ [MP Webhook] Pagamento aprovado! Atualizando agendamento...');

          // Converter payment_method_id do Mercado Pago para o formato do sistema
          // Sempre usar o payment_method_id do pagamento (fonte mais confiável)
          const paymentMethodId = String(payment.payment_method_id || '').toLowerCase();
          let paymentMethod = 'pix'; // Padrão

          if (paymentMethodId === 'credit_card') {
            paymentMethod = 'credito';
          } else if (paymentMethodId === 'debit_card') {
            paymentMethod = 'debito';
          } else if (paymentMethodId === 'pix') {
            paymentMethod = 'pix';
          }

          console.log('💳 [MP Webhook] Método de pagamento:', {
            payment_method_id: paymentMethodId,
            payment_method_salvo: paymentMethod,
          });

          const updateData: any = {
            status: 'confirmed',
            payment_status: 'paid',
            payment_method: paymentMethod,
            pix_payment_status: payment.payment_method_id === 'pix' ? 'aprovado' : null,
          };

          const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update(updateData)
            .eq('id', appointment.id);

          if (updateError) {
            console.error('❌ [MP Webhook] Erro ao atualizar agendamento:', updateError);
            return json(500, { error: 'Erro ao atualizar agendamento' });
          }

          console.log('✅ [MP Webhook] Agendamento atualizado com sucesso:', appointment.id);
          return json(200, {
            message: 'Webhook processado com sucesso',
            appointmentId: appointment.id,
            paymentStatus: payment.status,
          });
        } else if (payment.status === 'rejected' || payment.status === 'cancelled' || payment.status === 'refunded') {
          console.log('❌ [MP Webhook] Pagamento recusado/cancelado');

          // Não atualizar o agendamento automaticamente (deixar para o usuário decidir)
          return json(200, {
            message: 'Webhook processado - pagamento recusado',
            paymentStatus: payment.status,
          });
        } else {
          // Pagamento ainda pendente
          console.log('⏳ [MP Webhook] Pagamento ainda pendente:', payment.status);
          return json(200, {
            message: 'Webhook processado - pagamento pendente',
            paymentStatus: payment.status,
          });
        }
      } catch (error: any) {
        console.error('❌ [MP Webhook] Erro ao verificar status do pagamento:', error);
        // Retornar 200 mesmo com erro (para não fazer o Mercado Pago reenviar)
        return json(200, {
          message: 'Webhook recebido, mas erro ao verificar status',
          error: error.message,
        });
      }
    } else {
      // Outro tipo de notificação (não é pagamento)
      console.log('ℹ️ [MP Webhook] Tipo de notificação não processado:', webhookData.type);
      return json(200, {
        message: 'Webhook recebido, mas tipo não processado',
        type: webhookData.type,
      });
    }
  } catch (error: any) {
    console.error('❌ [MP Webhook] Erro ao processar webhook:', error);
    // Retornar 200 para não fazer o Mercado Pago reenviar
    return json(200, {
      error: 'Erro ao processar webhook',
      message: error.message,
    });
  }
};
