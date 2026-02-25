import { supabase } from '../lib/supabase';

type PendingClientBookingValidationResult = {
  canBook: boolean;
  message?: string;
};

const normalizeDigits = (raw: string): string => String(raw || '').replace(/\D/g, '');

const getPhoneCandidates = (rawPhone: string): string[] => {
  const digits = normalizeDigits(rawPhone);
  if (!digits) return [];

  const candidates = new Set<string>([digits]);

  if (digits.startsWith('55') && digits.length > 11) {
    candidates.add(digits.slice(2));
  }
  if (digits.length >= 11) {
    candidates.add(digits.slice(-11));
  }
  if (digits.length >= 10) {
    candidates.add(digits.slice(-10));
  }

  return Array.from(candidates).filter(Boolean);
};

const phonesMatch = (a: string, b: string): boolean => {
  const aCandidates = new Set(getPhoneCandidates(a));
  const bCandidates = getPhoneCandidates(b);
  return bCandidates.some((candidate) => aCandidates.has(candidate));
};

export const validatePendingClientBookingLimit = async (
  clientWhatsapp: string,
  establishmentId: string,
  isLimitEnabled: boolean
): Promise<PendingClientBookingValidationResult> => {
  try {
    if (!isLimitEnabled) return { canBook: true };
    if (!clientWhatsapp || !establishmentId) return { canBook: true };

    const { data: activeAppointments, error } = await supabase
      .from('appointments')
      .select('id,status,client_whatsapp')
      .eq('establishment_id', establishmentId)
      .in('status', ['pending', 'confirmed', 'pending_payment']);

    if (error) {
      console.error('Erro ao validar limite de cliente pendente:', error);
      return { canBook: true };
    }

    const hasPendingService = (activeAppointments || []).some((appointment: any) =>
      phonesMatch(clientWhatsapp, String(appointment?.client_whatsapp || ''))
    );

    if (!hasPendingService) return { canBook: true };

    return {
      canBook: false,
      message:
        'Voce ainda tem servico pendente nesta barbearia. Aguarde o profissional concluir o atendimento para fazer um novo agendamento.'
    };
  } catch (error) {
    console.error('Erro inesperado ao validar bloqueio por cliente pendente:', error);
    return { canBook: true };
  }
};
