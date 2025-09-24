import { supabase } from '../lib/supabase';

export interface SameDayRescheduleValidation {
  canBook: boolean;
  message: string;
}

export async function validateSameDayReschedule(
  userId: string,
  establishmentId: string,
  appointmentDate: Date,
  isSubscriber: boolean
): Promise<SameDayRescheduleValidation> {
  try {
    console.log('🔍 Validando remarcação no mesmo dia...', {
      userId,
      establishmentId,
      appointmentDate,
      isSubscriber
    });

    // Se não é assinante, permitir agendamento
    if (!isSubscriber) {
      return {
        canBook: true,
        message: 'Cliente não é assinante, agendamento permitido'
      };
    }

    // Verificar se o estabelecimento tem a configuração ativada
    const { data: establishment, error: establishmentError } = await supabase
      .from('establishments')
      .select('prevent_same_day_reschedule')
      .eq('id', establishmentId)
      .single();

    if (establishmentError) {
      console.error('Erro ao buscar configuração do estabelecimento:', establishmentError);
      return {
        canBook: true,
        message: 'Erro ao verificar configuração, permitindo agendamento'
      };
    }

    // Se a configuração não está ativada, permitir agendamento
    if (!establishment?.prevent_same_day_reschedule) {
      return {
        canBook: true,
        message: 'Configuração de remarcação no mesmo dia não está ativada'
      };
    }

    // Buscar agendamentos cancelados do mesmo cliente no mesmo dia
    // Usar o dia do agendamento, não o dia atual
    const appointmentDay = new Date(appointmentDate);
    const startOfDay = new Date(appointmentDay);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDay);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: cancelledAppointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, appointment_date, status, created_at')
      .eq('client_id', userId)
      .eq('establishment_id', establishmentId)
      .eq('status', 'cancelled')
      .gte('appointment_date', startOfDay.toISOString().split('T')[0])
      .lte('appointment_date', endOfDay.toISOString().split('T')[0])
      .order('created_at', { ascending: false });

    if (appointmentsError) {
      console.error('Erro ao buscar agendamentos cancelados:', appointmentsError);
      return {
        canBook: true,
        message: 'Erro ao verificar agendamentos cancelados, permitindo agendamento'
      };
    }

    // Se não há agendamentos cancelados no mesmo dia, permitir
    if (!cancelledAppointments || cancelledAppointments.length === 0) {
      return {
        canBook: true,
        message: 'Nenhum agendamento cancelado no mesmo dia encontrado'
      };
    }

    // Verificar se algum agendamento foi cancelado recentemente (últimas 24 horas)
    const now = new Date();
    const recentCancellations = cancelledAppointments.filter(apt => {
      const cancelledAt = new Date(apt.created_at);
      const hoursDiff = (now.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 24; // Cancelado nas últimas 24 horas
    });

    if (recentCancellations.length > 0) {
      return {
        canBook: false,
        message: 'Você cancelou um agendamento hoje e não pode remarcar para o mesmo dia. Tente agendar para outro dia.'
      };
    }

    return {
      canBook: true,
      message: 'Agendamento permitido'
    };

  } catch (error) {
    console.error('Erro na validação de remarcação no mesmo dia:', error);
    return {
      canBook: true,
      message: 'Erro na validação, permitindo agendamento'
    };
  }
}
