import { supabase } from '../lib/supabase';
import { fetchClientAppointmentsSecure } from './secureAppointmentReads';

/**
 * Verifica se um estabelecimento tem limitação de 1 agendamento por semana
 */
export const hasOneWeekLimit = async (establishmentId: string): Promise<boolean> => {
  try {
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
    // Normalizar o número de telefone
    const normalizedWhatsapp = clientWhatsapp.replace(/\D/g, '');
    
    // Calcular início e fim da semana
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay()); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
    endOfWeek.setHours(23, 59, 59, 999);

    // Buscar agendamentos confirmados na mesma semana

    const weekMin = startOfWeek.toISOString().split('T')[0];
    const weekMax = endOfWeek.toISOString().split('T')[0];

    // Caminho seguro: função por telefone (sem CPF). Se não responder, cai no método antigo.
    let existingAppointments: any[] = [];
    const secure = await fetchClientAppointmentsSecure(normalizedWhatsapp, establishmentId, weekMin, weekMax);
    if (secure) {
      existingAppointments = secure.filter((a: any) => ['confirmed', 'pending'].includes(String(a?.status)));
    } else {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, client_whatsapp, appointment_date, status, created_at, is_subscriber')
        .eq('establishment_id', establishmentId)
        .in('status', ['confirmed', 'pending']) // Buscar agendamentos confirmados E pendentes
        .gte('appointment_date', weekMin)
        .lte('appointment_date', weekMax)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar agendamentos existentes:', error);
        return false;
      }
      existingAppointments = data || [];
    }

    // Filtrar agendamentos cancelados (pois o banco não suporta .not() com enum)
    const activeAppointments = existingAppointments?.filter(appointment =>
      appointment.status !== 'cancelled' && appointment.status !== 'canceled'
    ) || [];

    // Verificar se algum agendamento ativo é do mesmo WhatsApp
    const matchingAppointments = activeAppointments.filter(appointment => {
      const appointmentPhone = appointment.client_whatsapp?.replace(/\D/g, '') || '';
      return appointmentPhone === normalizedWhatsapp;
    });

    const hasAppointment = matchingAppointments.length > 0;
    return hasAppointment;
  } catch (error) {
    console.error('❌ Erro ao verificar agendamentos na semana:', error);
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
    // Verificar se o estabelecimento tem limitação de 1 agendamento por semana
    const hasLimit = await hasOneWeekLimit(establishmentId);

    if (!hasLimit) {
      return { canBook: true }; // Sem limitação, pode agendar normalmente
    }

    // Verificar se já tem agendamento confirmado na semana
    const hasAppointment = await hasAppointmentInSameWeek(clientWhatsapp, establishmentId, selectedDate);

    if (hasAppointment) {
      return {
        canBook: false,
        message: '❌ Você já tem um agendamento nesta semana. Cancele o agendamento atual para poder fazer um novo.'
      };
    }

    return { canBook: true };
  } catch (error) {
    console.error('❌ Erro ao validar 1 agendamento por semana:', error);
    return { canBook: true }; // Em caso de erro, permitir agendamento
  }
};