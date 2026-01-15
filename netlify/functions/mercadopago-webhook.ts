import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
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

    // Mercado Pago envia diferentes tipos de notificações
    // Para pagamentos, o tipo é "payment" e a ação pode ser "payment.updated", "payment.created", etc.
    if (webhookData.type === 'payment') {
      const paymentId = webhookData.data?.id || webhookData.id;
      
      if (!paymentId) {
        console.warn('⚠️ [MP Webhook] Payment ID não encontrado');
        return json(400, { error: 'Payment ID não encontrado' });
      }

      console.log('💳 [MP Webhook] Processando pagamento:', paymentId);

      // Buscar agendamento pelo payment_transaction_id
      const { data: appointments, error: fetchError } = await supabaseAdmin
        .from('appointments')
        .select('id, establishment_id, payment_transaction_id, payment_method, status')
        .eq('payment_transaction_id', String(paymentId))
        .limit(1);

      if (fetchError) {
        console.error('❌ [MP Webhook] Erro ao buscar agendamento:', fetchError);
        return json(500, { error: 'Erro ao buscar agendamento' });
      }

      if (!appointments || appointments.length === 0) {
        console.warn('⚠️ [MP Webhook] Agendamento não encontrado para payment_id:', paymentId);
        // Retornar 200 mesmo assim (webhook processado, mas não há agendamento relacionado)
        return json(200, { message: 'Webhook recebido, mas agendamento não encontrado' });
      }

      const appointment = appointments[0];
      console.log('📋 [MP Webhook] Agendamento encontrado:', {
        appointmentId: appointment.id,
        currentStatus: appointment.status,
      });

      // Buscar access_token do estabelecimento para verificar status completo
      const { data: establishment, error: estError } = await supabaseAdmin
        .from('establishments')
        .select('mercadopago_access_token')
        .eq('id', appointment.establishment_id)
        .single();

      if (estError || !establishment) {
        console.error('❌ [MP Webhook] Erro ao buscar estabelecimento:', estError);
        return json(500, { error: 'Erro ao buscar estabelecimento' });
      }

      const accessToken = (establishment as any)?.mercadopago_access_token;
      if (!accessToken) {
        console.warn('⚠️ [MP Webhook] Estabelecimento não possui access_token do Mercado Pago');
        return json(200, { message: 'Webhook recebido, mas estabelecimento não configurado' });
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

          const updateData: any = {
            status: 'confirmed',
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
