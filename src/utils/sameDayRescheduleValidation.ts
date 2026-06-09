import { supabase } from '../lib/supabase';

export interface SameDayRescheduleValidation {
  canBook: boolean;
  message: string;
}

function normalizePhoneDigits(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.slice(2);
  }
  return digits;
}

function buildPhoneMatchKeys(raw: string): Set<string> {
  const normalized = normalizePhoneDigits(raw);
  if (!normalized) return new Set();
  const keys = new Set<string>([normalized]);
  if (normalized.length === 10) {
    keys.add(`${normalized.slice(0, 2)}9${normalized.slice(2)}`);
  }
  if (normalized.length === 11 && normalized.charAt(2) === '9') {
    keys.add(`${normalized.slice(0, 2)}${normalized.slice(3)}`);
  }
  keys.add(`55${normalized}`);
  return keys;
}

function phonesMatch(storedPhone: unknown, targetPhone: string): boolean {
  const targetKeys = buildPhoneMatchKeys(targetPhone);
  if (targetKeys.size === 0) return false;
  const storedKeys = buildPhoneMatchKeys(String(storedPhone || ''));
  for (const key of storedKeys) {
    if (targetKeys.has(key)) return true;
  }
  return false;
}

function toAppointmentDateIso(raw: string | Date): string {
  if (typeof raw === 'string') {
    const iso = raw.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  }
  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function validateSameDayReschedule(
  clientWhatsapp: string,
  establishmentId: string,
  appointmentDate: string | Date,
  isSubscriber: boolean
): Promise<SameDayRescheduleValidation> {
  try {
    const appointmentDateIso = toAppointmentDateIso(appointmentDate);
    const normalizedPhone = normalizePhoneDigits(clientWhatsapp);

    console.log('🔍 Validando remarcação no mesmo dia...', {
      clientWhatsapp: normalizedPhone,
      establishmentId,
      appointmentDateIso,
      isSubscriber,
    });

    if (!isSubscriber) {
      return {
        canBook: true,
        message: 'Cliente não é assinante, agendamento permitido',
      };
    }

    if (!establishmentId || !appointmentDateIso || !normalizedPhone) {
      return {
        canBook: true,
        message: 'Dados insuficientes para validar remarcação no mesmo dia',
      };
    }

    const { data: establishment, error: establishmentError } = await supabase
      .from('establishments')
      .select('prevent_same_day_reschedule')
      .eq('id', establishmentId)
      .single();

    if (establishmentError) {
      console.error('Erro ao buscar configuração do estabelecimento:', establishmentError);
      return {
        canBook: true,
        message: 'Erro ao verificar configuração, permitindo agendamento',
      };
    }

    if (!establishment?.prevent_same_day_reschedule) {
      return {
        canBook: true,
        message: 'Configuração de remarcação no mesmo dia não está ativada',
      };
    }

    const { data: cancelledAppointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, client_whatsapp, appointment_date, status, is_subscriber')
      .eq('establishment_id', establishmentId)
      .eq('status', 'cancelled')
      .eq('appointment_date', appointmentDateIso);

    if (appointmentsError) {
      console.error('Erro ao buscar agendamentos cancelados:', appointmentsError);
      return {
        canBook: true,
        message: 'Erro ao verificar agendamentos cancelados, permitindo agendamento',
      };
    }

    const sameDayCancelledForClient = (cancelledAppointments || []).filter((apt) =>
      phonesMatch(apt?.client_whatsapp, clientWhatsapp)
    );

    if (sameDayCancelledForClient.length === 0) {
      return {
        canBook: true,
        message: 'Nenhum agendamento cancelado no mesmo dia encontrado',
      };
    }

    return {
      canBook: false,
      message:
        'Você cancelou um agendamento para este dia e não pode remarcar para a mesma data. Escolha outro dia.',
    };
  } catch (error) {
    console.error('Erro na validação de remarcação no mesmo dia:', error);
    return {
      canBook: true,
      message: 'Erro na validação, permitindo agendamento',
    };
  }
}
