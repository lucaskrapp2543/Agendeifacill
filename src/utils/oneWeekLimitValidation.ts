import { supabase } from '../lib/supabase';

console.log('🚀 DEBUG - oneWeekLimitValidation.ts carregado!');

/**
 * Verifica se um estabelecimento tem limitação de 1 agendamento por semana
 */
export const hasOneWeekLimit = async (establishmentId: string): Promise<boolean> => {
  try {
    console.log('🔒 Verificando limitação de 1 agendamento por semana para:', establishmentId);
    
    const { data: establishment, error } = await supabase
      .from('establishments')
      .select('limit_subscribers_one_week')
      .eq('id', establishmentId)
      .single();

    if (error) {
      console.error('❌ Erro ao verificar limitação de 1 agendamento por semana:', error);
      return false;
    }

    const hasLimit = establishment?.limit_subscribers_one_week || false;
    console.log('🔒 Tem limitação de 1 agendamento por semana?', hasLimit);
    
    return hasLimit;
  } catch (error) {
    console.error('❌ Erro ao verificar limitação de 1 agendamento por semana:', error);
    return false;
  }
};

/**
 * Verifica se um assinante já tem agendamento confirmado na mesma semana
 */
export const hasAppointmentInSameWeek = async (
  clientWhatsapp: string, 
  establishmentId: string, 
  selectedDate: Date
): Promise<boolean> => {
  try {
    console.log('🔍 DEBUG - Verificando agendamentos na mesma semana:', {
      clientWhatsapp,
      establishmentId,
      selectedDate: selectedDate.toISOString()
    });

    // Normalizar o número de telefone
    const normalizedWhatsapp = clientWhatsapp.replace(/\D/g, '');
    console.log('📱 DEBUG - WhatsApp normalizado:', normalizedWhatsapp);
    
    // Calcular início e fim da semana
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay()); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
    endOfWeek.setHours(23, 59, 59, 999);

        console.log('📅 DEBUG - Período da semana:', {
          selectedDate: selectedDate.toISOString().split('T')[0],
          startOfWeek: startOfWeek.toISOString().split('T')[0],
          endOfWeek: endOfWeek.toISOString().split('T')[0],
          dayOfWeek: selectedDate.getDay() // 0=domingo, 1=segunda, etc.
        });

        // Buscar agendamentos confirmados na mesma semana
        console.log('🔍 DEBUG - Query SQL sendo executada:', {
          establishmentId,
          status: 'confirmed',
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: endOfWeek.toISOString().split('T')[0]
        });

        const { data: existingAppointments, error } = await supabase
          .from('appointments')
          .select('id, client_whatsapp, appointment_date, status, created_at, is_subscriber')
          .eq('establishment_id', establishmentId)
          .in('status', ['confirmed', 'pending']) // Buscar agendamentos confirmados E pendentes
          .gte('appointment_date', startOfWeek.toISOString().split('T')[0])
          .lte('appointment_date', endOfWeek.toISOString().split('T')[0])
          .order('created_at', { ascending: false });

        console.log('🔍 DEBUG - Resultado da query:', {
          appointments: existingAppointments,
          error: error,
          count: existingAppointments?.length || 0
        });

    if (error) {
      console.error('❌ DEBUG - Erro ao buscar agendamentos existentes:', error);
      return false;
    }

        console.log('📋 DEBUG - Todos os agendamentos encontrados na semana:', existingAppointments);
        
        // Filtrar agendamentos cancelados (pois o banco não suporta .not() com enum)
        const activeAppointments = existingAppointments?.filter(appointment => 
          appointment.status !== 'cancelled' && appointment.status !== 'canceled'
        ) || [];
        
        console.log('📋 DEBUG - Agendamentos ativos (não cancelados):', activeAppointments);
        
        // Log detalhado de cada agendamento ativo
        activeAppointments.forEach((appointment, index) => {
          console.log(`📋 DEBUG - Agendamento ativo ${index + 1}:`, {
            id: appointment.id,
            status: appointment.status,
            date: appointment.appointment_date,
            whatsapp: appointment.client_whatsapp,
            isSubscriber: appointment.is_subscriber
          });
        });

    // Verificar se algum agendamento ativo é do mesmo WhatsApp
    const matchingAppointments = activeAppointments.filter(appointment => {
      const appointmentPhone = appointment.client_whatsapp?.replace(/\D/g, '') || '';
      const isMatch = appointmentPhone === normalizedWhatsapp;
      console.log('📱 DEBUG - Comparando:', {
        appointmentPhone,
        normalizedWhatsapp,
        isMatch,
        appointmentDate: appointment.appointment_date,
        status: appointment.status,
        isSubscriber: appointment.is_subscriber
      });
      return isMatch;
    });

    console.log('📋 DEBUG - Agendamentos do mesmo WhatsApp:', matchingAppointments);
    console.log('📋 DEBUG - Quantidade de agendamentos do mesmo WhatsApp:', matchingAppointments.length);

    const hasAppointment = matchingAppointments.length > 0;
    console.log('📅 DEBUG - Cliente já tem agendamento na semana?', hasAppointment);

    return hasAppointment;
  } catch (error) {
    console.error('❌ DEBUG - Erro ao verificar agendamentos na semana:', error);
    return false;
  }
};

/**
 * Valida se um assinante pode fazer um novo agendamento (limitação de 1 por semana)
 */
export const validateOneWeekLimit = async (
  clientWhatsapp: string, 
  establishmentId: string, 
  selectedDate: Date
): Promise<{ canBook: boolean; message?: string }> => {
  try {
    console.log('🔍 DEBUG - INICIANDO VALIDAÇÃO DE 1 AGENDAMENTO POR SEMANA:', {
      clientWhatsapp,
      establishmentId,
      selectedDate: selectedDate.toISOString()
    });

    // Verificar se o estabelecimento tem limitação de 1 agendamento por semana
    const hasLimit = await hasOneWeekLimit(establishmentId);
    console.log('🔒 DEBUG - Tem limitação de 1 agendamento por semana?', hasLimit);
    
    if (!hasLimit) {
      console.log('🔓 DEBUG - Sem limitação, permitindo agendamento');
      return { canBook: true }; // Sem limitação, pode agendar normalmente
    }

    console.log('🔒 DEBUG - Limitação ativa, verificando agendamentos existentes...');

    // Verificar se já tem agendamento confirmado na semana
    const hasAppointment = await hasAppointmentInSameWeek(clientWhatsapp, establishmentId, selectedDate);
    console.log('📅 DEBUG - Já tem agendamento na semana?', hasAppointment);
    
    if (hasAppointment) {
      console.log('🚫 DEBUG - Agendamento bloqueado - já tem agendamento na semana');
      return { 
        canBook: false, 
        message: '❌ Você já tem um agendamento nesta semana. Cancele o agendamento atual para poder fazer um novo.' 
      };
    }

    console.log('✅ DEBUG - Agendamento permitido - nenhum conflito encontrado');
    return { canBook: true };
  } catch (error) {
    console.error('❌ DEBUG - Erro ao validar 1 agendamento por semana:', error);
    return { canBook: true }; // Em caso de erro, permitir agendamento
  }
};