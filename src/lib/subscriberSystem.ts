/**
 * Sistema independente de assinantes
 * Não depende da lista de clientes existentes
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

export interface SubscriberData {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  subscription_name: string;
  subscription_value: number;
  start_date: string;
  end_date: string;
  payment_status: string;
}

export interface CreateSubscriberData {
  name: string;
  whatsapp: string;
  email?: string;
  subscription_id: string;
  establishment_id: string;
  start_date: string;
  end_date: string;
}

/**
 * Criar um novo assinante independente
 */
export const createIndependentSubscriber = async (data: CreateSubscriberData) => {
  try {
    console.log('🆕 Criando assinante independente:', data);

    const { data: result, error } = await supabase
      .from('client_subscriptions')
      .insert([
        {
          client_id: uuidv4(), // Gerar UUID válido para assinantes
          subscription_id: data.subscription_id,
          establishment_id: data.establishment_id,
          start_date: data.start_date,
          end_date: data.end_date,
          payment_status: 'unpaid',
          last_payment_date: null,
          // Novos campos para dados completos do assinante
          subscriber_name: data.name,
          subscriber_whatsapp: data.whatsapp,
          subscriber_email: data.email || null
        }
      ])
      .select(`
        *,
        subscriptions (name, value, duration_months)
      `)
      .single();

    if (error) {
      console.error('❌ Erro ao criar assinante:', error);
      throw error;
    }

    console.log('✅ Assinante criado com sucesso:', result);
    return { data: result, error: null };
  } catch (error) {
    console.error('❌ Erro ao criar assinante independente:', error);
    return { data: null, error };
  }
};

/**
 * Verificar se um WhatsApp é de assinante ativo
 */
export const checkWhatsAppSubscriber = async (whatsapp: string, establishmentId: string) => {
  try {
    console.log('🔍 MOBILE DEBUG - Verificando se WhatsApp é assinante (novo sistema):', {
      whatsapp,
      establishmentId,
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    });

    // Normalizar o número (remover caracteres não numéricos)
    const normalizedWhatsapp = whatsapp.replace(/\D/g, '');

    // SOLUÇÃO: Usar função RPC que funciona sem autenticação
    console.log('🔍 Tentando função RPC para verificar assinante...');
    const { data, error } = await supabase
      .rpc('check_subscriber_by_whatsapp', {
        p_whatsapp: normalizedWhatsapp,
        p_establishment_id: establishmentId
      });

    if (error) {
      console.error('❌ Erro ao verificar assinante via RPC:', error);
      return { data: null, error };
    }

    console.log('📋 Resultado da verificação RPC:', data);

    // Se encontrou assinante
    if (data && data.length > 0) {
      const subscriber = data[0];

      console.log('🔍 DEBUG - Dados completos do assinante:', subscriber);
      console.log('🔍 DEBUG - Weekdays recebidos:', subscriber.weekdays);
      console.log('🔍 DEBUG - Subscription name:', subscriber.subscription_name);

      if (subscriber.is_expired) {
        console.log('⚠️ Assinante vencido encontrado:', subscriber);
        return {
          data: {
            ...subscriber,
            is_expired: true,
            expiration_message: subscriber.expiration_message
          },
          error: null
        };
      } else {
        console.log('✅ Assinante ativo encontrado:', subscriber);
        return { data: subscriber, error: null };
      }
    }

    console.log('❌ Nenhum assinante encontrado para WhatsApp:', whatsapp);
    return { data: null, error: null };
  } catch (error) {
    console.error('❌ Erro na verificação de assinante:', error);
    return { data: null, error };
  }
};

/**
 * Buscar assinante por WhatsApp
 */
export const getSubscriberByWhatsapp = async (whatsapp: string, establishmentId: string) => {
  try {
    console.log('🔍 Buscando assinante por WhatsApp:', { whatsapp, establishmentId });

    const normalizedWhatsapp = whatsapp.replace(/\D/g, '');

    const { data, error } = await supabase
      .rpc('get_subscriber_by_whatsapp', {
        p_whatsapp: normalizedWhatsapp,
        p_establishment_id: establishmentId
      });

    if (error) {
      console.error('❌ Erro ao buscar assinante:', error);
      return { data: null, error };
    }

    const result = data?.[0];
    console.log('📋 Assinante encontrado:', result);

    return { data: result, error: null };
  } catch (error) {
    console.error('❌ Erro ao buscar assinante por WhatsApp:', error);
    return { data: null, error };
  }
};

/**
 * Buscar todos os assinantes de um estabelecimento
 */
export const getEstablishmentSubscribers = async (establishmentId: string) => {
  try {
    console.log('🔍 Buscando assinantes do estabelecimento:', establishmentId);

    const { data, error } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions (name, value, duration_months)
      `)
      .eq('establishment_id', establishmentId)
      .not('subscriber_name', 'is', null)
      .not('subscriber_whatsapp', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar assinantes:', error);
      return { data: null, error };
    }

    console.log('📋 Assinantes encontrados:', data?.length || 0);
    return { data: data || [], error: null };
  } catch (error) {
    console.error('❌ Erro ao buscar assinantes do estabelecimento:', error);
    return { data: null, error };
  }
};

/**
 * Atualizar status de pagamento do assinante
 */
export const updateSubscriberPaymentStatus = async (
  subscriberId: string,
  status: 'paid' | 'unpaid'
) => {
  try {
    console.log('💳 Atualizando status de pagamento:', { subscriberId, status });

    const updateData: any = {
      payment_status: status
    };

    if (status === 'paid') {
      updateData.last_payment_date = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('client_subscriptions')
      .update(updateData)
      .eq('id', subscriberId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao atualizar status de pagamento:', error);
      throw error;
    }

    console.log('✅ Status de pagamento atualizado:', data);
    return { data, error: null };
  } catch (error) {
    console.error('❌ Erro ao atualizar status de pagamento:', error);
    return { data: null, error };
  }
};

/**
 * Remover assinante
 */
export const removeSubscriber = async (subscriberId: string) => {
  try {
    console.log('🗑️ Removendo assinante:', subscriberId);

    const { error } = await supabase
      .from('client_subscriptions')
      .delete()
      .eq('id', subscriberId);

    if (error) {
      console.error('❌ Erro ao remover assinante:', error);
      throw error;
    }

    console.log('✅ Assinante removido com sucesso');
    return { data: true, error: null };
  } catch (error) {
    console.error('❌ Erro ao remover assinante:', error);
    return { data: null, error };
  }
};
