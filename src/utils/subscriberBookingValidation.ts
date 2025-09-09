import { checkWhatsAppSubscriber } from '../lib/supabase';
import { supabase } from '../lib/supabase';

/**
 * Verifica se um cliente é assinante ativo de um estabelecimento
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
 * Verifica se um estabelecimento tem limitação de agendamentos para assinantes
 */
export const hasSubscriberBookingLimit = async (establishmentId: string): Promise<boolean> => {
  try {
    console.log('🔒 Verificando limitação de agendamentos para:', establishmentId);
    
    const { data: establishment, error } = await supabase
      .from('establishments')
      .select('limit_subscriber_bookings')
      .eq('id', establishmentId)
      .single();

    if (error) {
      console.error('❌ Erro ao verificar limitação de agendamentos:', error);
      return false;
    }

    const hasLimit = establishment?.limit_subscriber_bookings || false;
    console.log('🔒 Tem limitação?', hasLimit);
    
    return hasLimit;
  } catch (error) {
    console.error('❌ Erro ao verificar limitação de agendamentos:', error);
    return false;
  }
};

/**
 * Verifica se uma data está dentro da semana atual
 */
export const isDateInCurrentWeek = (date: Date): boolean => {
  const today = new Date();
  const startOfWeek = new Date(today);
  const endOfWeek = new Date(today);
  
  // Encontrar o início da semana (domingo)
  const dayOfWeek = today.getDay();
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Encontrar o fim da semana (sábado)
  endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));
  endOfWeek.setHours(23, 59, 59, 999);
  
  const isInWeek = date >= startOfWeek && date <= endOfWeek;
  
  console.log('📅 Verificação de semana:', {
    dataSelecionada: date.toISOString().split('T')[0],
    inicioSemana: startOfWeek.toISOString().split('T')[0],
    fimSemana: endOfWeek.toISOString().split('T')[0],
    estaNaSemana: isInWeek
  });
  
  return isInWeek;
};

/**
 * Valida se um assinante pode agendar em uma data específica
 */
export const validateSubscriberBooking = async (
  clientWhatsapp: string, 
  establishmentId: string, 
  selectedDate: Date
): Promise<{ canBook: boolean; message?: string }> => {
  try {
    console.log('🔍 Validando agendamento de assinante:', {
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

    // Verificar se o estabelecimento tem limitação
    const hasLimit = await hasSubscriberBookingLimit(establishmentId);
    console.log('🔒 Tem limitação?', hasLimit);
    
    if (!hasLimit) {
      return { canBook: true }; // Sem limitação, pode agendar normalmente
    }

    // Verificar se a data está na semana atual
    const isInCurrentWeek = isDateInCurrentWeek(selectedDate);
    console.log('📅 Está na semana atual?', isInCurrentWeek);
    
    if (!isInCurrentWeek) {
      console.log('❌ Agendamento bloqueado - fora da semana atual');
      return { 
        canBook: false, 
        message: 'Você só pode agendar dentro da mesma semana.' 
      };
    }

    console.log('✅ Agendamento permitido');
    return { canBook: true };
  } catch (error) {
    console.error('Erro ao validar agendamento de assinante:', error);
    return { canBook: true }; // Em caso de erro, permitir agendamento
  }
};

/**
 * Obtém as datas disponíveis para assinantes (apenas semana atual se limitado)
 */
export const getAvailableDatesForSubscriber = async (
  clientWhatsapp: string,
  establishmentId: string,
  allAvailableDates: Date[]
): Promise<Date[]> => {
  try {
    // Verificar se o cliente é assinante
    const isSubscriber = await isClientSubscriber(clientWhatsapp, establishmentId);
    if (!isSubscriber) {
      return allAvailableDates; // Cliente não é assinante, retornar todas as datas
    }

    // Verificar se o estabelecimento tem limitação
    const hasLimit = await hasSubscriberBookingLimit(establishmentId);
    if (!hasLimit) {
      return allAvailableDates; // Sem limitação, retornar todas as datas
    }

    // Filtrar apenas datas da semana atual
    return allAvailableDates.filter(date => isDateInCurrentWeek(date));
  } catch (error) {
    console.error('Erro ao obter datas disponíveis para assinante:', error);
    return allAvailableDates; // Em caso de erro, retornar todas as datas
  }
};
