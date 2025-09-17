import { supabase } from '../lib/supabase';
import { checkWhatsAppSubscriber } from '../lib/supabase';

/**
 * Verifica se um estabelecimento tem limitação de remarcação no mesmo dia
 */
export const hasPreventSameDayReschedule = async (establishmentId: string): Promise<boolean> => {
  try {
    console.log('🔒 Verificando limitação de remarcação no mesmo dia para:', establishmentId);
    
    const { data: establishment, error } = await supabase
      .from('establishments')
      .select('prevent_same_day_reschedule')
      .eq('id', establishmentId)
      .single();

    if (error) {
      console.error('❌ Erro ao verificar limitação de remarcação:', error);
      return false;
    }

    const hasLimit = establishment?.prevent_same_day_reschedule || false;
    console.log('🔒 Tem limitação de remarcação no mesmo dia?', hasLimit);
    
    return hasLimit;
  } catch (error) {
    console.error('❌ Erro ao verificar limitação de remarcação:', error);
    return false;
  }
};

/**
 * Verifica se um cliente é assinante ativo
 */
export const isClientSubscriber = async (clientWhatsapp: string, establishmentId: string): Promise<boolean> => {
  try {
    console.log('🔍 Verificando se é assinante:', { clientWhatsapp, establishmentId });
    
    const { data: subscriber, error } = await checkWhatsAppSubscriber(clientWhatsapp, establishmentId);
    
    if (error) {
      console.error('❌ Erro ao verificar assinante:', error);
      return false;
    }

    const isSubscriber = !!subscriber;
    console.log('👤 Resultado da verificação:', { isSubscriber, subscriber });
    
    return isSubscriber;
  } catch (error) {
    console.error('❌ Erro ao verificar assinante:', error);
    return false;
  }
};

/**
 * Verifica se um cliente cancelou um agendamento no mesmo dia
 */
export const hasSubscriberCancelledToday = async (
  clientWhatsapp: string, 
  establishmentId: string, 
  selectedDate: Date
): Promise<boolean> => {
  try {
    console.log('🔍 Verificando se cliente cancelou hoje:', {
      clientWhatsapp,
      establishmentId,
      selectedDate: selectedDate.toISOString()
    });

    // Normalizar o número de telefone
    const normalizedWhatsapp = clientWhatsapp.replace(/\D/g, '');
    
    // Buscar agendamentos cancelados no mesmo dia
    const { data: cancelledAppointments, error } = await supabase
      .from('appointments')
      .select('id, client_whatsapp, appointment_date, status, created_at')
      .eq('establishment_id', establishmentId)
      .eq('appointment_date', selectedDate.toISOString().split('T')[0])
      .eq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar agendamentos cancelados:', error);
      return false;
    }

    // Verificar se algum agendamento cancelado é do mesmo WhatsApp
    const hasCancelledToday = cancelledAppointments?.some(appointment => {
      const appointmentPhone = appointment.client_whatsapp?.replace(/\D/g, '') || '';
      return appointmentPhone === normalizedWhatsapp;
    }) || false;

    console.log('📅 Cliente cancelou hoje?', hasCancelledToday);
    console.log('📋 Agendamentos cancelados encontrados:', cancelledAppointments?.length || 0);

    return hasCancelledToday;
  } catch (error) {
    console.error('❌ Erro ao verificar cancelamentos do dia:', error);
    return false;
  }
};

/**
 * Valida se um cliente pode agendar em uma data específica (considerando cancelamentos do mesmo dia)
 */
export const validateSameDayReschedule = async (
  clientWhatsapp: string, 
  establishmentId: string, 
  selectedDate: Date
): Promise<{ canBook: boolean; message?: string }> => {
  try {
    console.log('🔍 Validando remarcação no mesmo dia:', {
      clientWhatsapp,
      establishmentId,
      selectedDate: selectedDate.toISOString()
    });

    // Verificar se o cliente é assinante
    const isSubscriber = await isClientSubscriber(clientWhatsapp, establishmentId);
    console.log('👤 É assinante?', isSubscriber);
    
    if (!isSubscriber) {
      return { canBook: true }; // Cliente não é assinante, pode agendar normalmente
    }

    // Verificar se o estabelecimento tem limitação de remarcação no mesmo dia
    const hasLimit = await hasPreventSameDayReschedule(establishmentId);
    console.log('🔒 Tem limitação de remarcação?', hasLimit);
    
    if (!hasLimit) {
      return { canBook: true }; // Sem limitação, pode agendar normalmente
    }

    // Verificar se o assinante cancelou um agendamento no mesmo dia
    const hasCancelledToday = await hasSubscriberCancelledToday(clientWhatsapp, establishmentId, selectedDate);
    console.log('📅 Cancelou hoje?', hasCancelledToday);
    
    if (hasCancelledToday) {
      console.log('❌ Agendamento bloqueado - assinante cancelou hoje');
      return { 
        canBook: false, 
        message: '❌ Você já cancelou um agendamento hoje. Não é possível remarcar para o mesmo dia.' 
      };
    }

    console.log('✅ Agendamento permitido');
    return { canBook: true };
  } catch (error) {
    console.error('❌ Erro ao validar remarcação no mesmo dia:', error);
    return { canBook: true }; // Em caso de erro, permitir agendamento
  }
};
