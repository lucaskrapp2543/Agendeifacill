import { checkWhatsAppSubscriber, supabase } from '../lib/supabase';
import { getSubscriptionUsageDateRange } from './subscriptionUsagePeriod';

const toDateOnlyString = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toBRDateFromISO = (isoDate: string): string => {
  const s = String(isoDate || '').slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
};

/**
 * Verifica se um cliente é assinante ativo de um estabelecimento (não vencido)
 */
export const isClientSubscriber = async (
  clientWhatsapp: string,
  establishmentId: string,
  bookingDate: Date = new Date()
): Promise<boolean> => {
  try {
    console.log('🔍 Verificando se é assinante ativo:', { clientWhatsapp, establishmentId });
    
    const { data: subscriber, error } = await checkWhatsAppSubscriber(clientWhatsapp, establishmentId);
    
    if (error) {
      console.error('❌ Erro ao verificar assinante:', error);
      return false;
    }

    if (!subscriber) {
      console.log('👤 Não é assinante');
      return false;
    }

    // ✅ Regra correta: precisa estar válido NA DATA do agendamento, não só hoje
    const bookingDateStr = toDateOnlyString(bookingDate);
    const endDateStr = String(subscriber.end_date || '').slice(0, 10);
    const isExpired =
      subscriber.payment_status === 'unpaid' ||
      (endDateStr ? endDateStr < bookingDateStr : Boolean(subscriber.is_expired));
    
    const isActiveSubscriber = !isExpired;
    
    console.log('👤 Resultado da verificação:', { 
      isSubscriber: isActiveSubscriber, 
      isExpired,
      endDate: subscriber.end_date,
      bookingDate: bookingDateStr,
      paymentStatus: subscriber.payment_status,
      subscriber 
    });
    
    return isActiveSubscriber;
  } catch (error) {
    console.error('❌ Erro ao verificar assinante:', error);
    return false;
  }
};

/**
 * Verifica se um assinante excedeu o limite mensal de serviços
 */
export const checkSubscriberMonthlyLimit = async (clientWhatsapp: string, establishmentId: string): Promise<{
  canBook: boolean;
  currentUsage: number;
  monthlyLimit: number;
  subscriptionName: string;
  errorMessage?: string;
}> => {
  try {
    console.log('🔍 Verificando limite mensal do assinante:', { clientWhatsapp, establishmentId });
    
    // Limpar o WhatsApp (remover formatação)
    const cleanWhatsapp = clientWhatsapp.replace(/\D/g, '');
    
    // Buscar assinatura ativa do cliente pelo WhatsApp
    const { data: clientSubscription, error: subscriptionError } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        subscriptions!inner(*)
      `)
      .eq('establishment_id', establishmentId)
      .eq('client_whatsapp', cleanWhatsapp)
      .gte('end_date', new Date().toISOString().split('T')[0])
      .lte('start_date', new Date().toISOString().split('T')[0])
      .single();

    if (subscriptionError || !clientSubscription) {
      console.log('❌ Assinante não encontrado ou erro:', subscriptionError);
      return { 
        canBook: true, 
        currentUsage: 0, 
        monthlyLimit: 0, 
        subscriptionName: '' 
      };
    }

    // Verificar se o assinante está ativo (não vencido)
    const isExpired = clientSubscription.is_expired || 
      (new Date(clientSubscription.end_date) < new Date()) || 
      clientSubscription.payment_status === 'unpaid';

    if (isExpired) {
      console.log('❌ Assinante vencido, não aplicando limite');
      return { 
        canBook: true, 
        currentUsage: 0, 
        monthlyLimit: 0, 
        subscriptionName: clientSubscription.subscriptions?.name || '' 
      };
    }

    const usageRange = getSubscriptionUsageDateRange(clientSubscription as any, new Date());

    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date')
      .eq('establishment_id', establishmentId)
      .eq('client_whatsapp', cleanWhatsapp)
      .eq('is_subscriber', true)
      .gte('appointment_date', usageRange.periodMin)
      .lte('appointment_date', usageRange.periodMax)
      .in('status', ['confirmed', 'completed', 'pending']);

    if (appointmentsError) {
      console.error('❌ Erro ao verificar agendamentos:', appointmentsError);
      return { 
        canBook: true, 
        currentUsage: 0, 
        monthlyLimit: 999, 
        subscriptionName: clientSubscription.subscriptions?.name || '' 
      };
    }

    const currentUsage = appointments?.length || 0;
    const monthlyLimit = (clientSubscription as any).monthly_service_limit || 999;
    
    // Se o limite é 999, significa sem limite
    const canBook = monthlyLimit === 999 || currentUsage < monthlyLimit;

    console.log('📊 Limite mensal verificado:', { 
      currentUsage, 
      monthlyLimit, 
      canBook, 
      subscriptionName: clientSubscription.subscriptions?.name 
    });

    if (!canBook) {
      return {
        canBook: false,
        currentUsage,
        monthlyLimit,
        subscriptionName: clientSubscription.subscriptions?.name || '',
        errorMessage: `Atenção: você já atingiu o limite dos seus serviços como assinante no período atual da assinatura. (${currentUsage}/${monthlyLimit} serviços utilizados)`
      };
    }

    return {
      canBook: true,
      currentUsage,
      monthlyLimit,
      subscriptionName: clientSubscription.subscriptions?.name || ''
    };

  } catch (error) {
    console.error('❌ Erro ao verificar limite mensal:', error);
    return { 
      canBook: true, 
      currentUsage: 0, 
      monthlyLimit: 0, 
      subscriptionName: '' 
    };
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

    // ✅ Buscar dados do assinante (precisamos validar pela data do agendamento)
    const { data: subscriber, error } = await checkWhatsAppSubscriber(clientWhatsapp, establishmentId);
    if (error) {
      console.error('❌ Erro ao verificar assinante:', error);
      return { canBook: true }; // Em caso de erro, não bloquear
    }

    if (!subscriber) {
      console.log('👤 Não é assinante');
      return { canBook: true }; // Cliente não é assinante, pode agendar normalmente
    }

    const selectedDateStr = toDateOnlyString(selectedDate);
    const endDateStr = String(subscriber.end_date || '').slice(0, 10);
    const isUnpaid = String(subscriber.payment_status || '').toLowerCase() === 'unpaid';
    const isExpiredForSelectedDate = Boolean(endDateStr) && endDateStr < selectedDateStr;

    // Se não está pago ou a data do agendamento passa do vencimento, não pode agendar COMO ASSINANTE.
    if (isUnpaid) {
      return {
        canBook: false,
        message: 'Sua assinatura está com pagamento pendente. Para agendar como assinante, finalize o pagamento ou agende como cliente normal.',
      };
    }

    if (isExpiredForSelectedDate) {
      return {
        canBook: false,
        message: `Sua assinatura vence em ${toBRDateFromISO(endDateStr)}. Para agendar em ${toBRDateFromISO(selectedDateStr)}, renove a assinatura ou agende como cliente normal.`,
      };
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
    // ✅ Buscar assinante uma única vez e filtrar datas além do vencimento
    const { data: subscriber, error } = await checkWhatsAppSubscriber(clientWhatsapp, establishmentId);
    if (error || !subscriber) {
      return allAvailableDates;
    }

    const endDateStr = String(subscriber.end_date || '').slice(0, 10);
    const isUnpaid = String(subscriber.payment_status || '').toLowerCase() === 'unpaid';
    if (!endDateStr || isUnpaid) {
      // Se não está pago (ou não tem end_date), não aplicar filtro de "assinante"
      return allAvailableDates;
    }

    // Verificar se o estabelecimento tem limitação
    const hasLimit = await hasSubscriberBookingLimit(establishmentId);
    if (!hasLimit) {
      // Mesmo sem limitação, assinante só pode agendar até o vencimento
      return allAvailableDates.filter((d) => toDateOnlyString(d) <= endDateStr);
    }

    // Filtrar apenas datas da semana atual
    return allAvailableDates.filter((date) => isDateInCurrentWeek(date) && toDateOnlyString(date) <= endDateStr);
  } catch (error) {
    console.error('Erro ao obter datas disponíveis para assinante:', error);
    return allAvailableDates; // Em caso de erro, retornar todas as datas
  }
};
