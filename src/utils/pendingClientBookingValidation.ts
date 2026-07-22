import { supabase } from '../lib/supabase';
import { fetchClientAppointmentsSecure } from './secureAppointmentReads';

type PendingClientBookingValidationResult = {
  canBook: boolean;
  message?: string;
};

const normalizeDigits = (raw: string): string => String(raw || '').replace(/\D/g, '');
const pendingLimitFlagCache = new Map<string, boolean>();

const parseEnabledFlag = (value: unknown): boolean => {
  if (value === false || value === 0 || value === '0') return false;
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'false' || text === 'off' || text === 'no' || text === 'disabled') return false;
  return Boolean(value);
};

const buildLocalPhoneVariants = (localDigitsRaw: string): string[] => {
  const localDigits = normalizeDigits(localDigitsRaw);
  if (!localDigits) return [];

  const variants = new Set<string>([localDigits]);

  // BR: algumas bases antigas salvam celular sem o 9º dígito (DDD + 8 dígitos = 10).
  // Ex.: 24 9 9951-6123 (11) <-> 24 9951-6123 (10)
  if (localDigits.length === 11 && localDigits[2] === '9') {
    variants.add(`${localDigits.slice(0, 2)}${localDigits.slice(3)}`);
  }

  return Array.from(variants).filter(Boolean);
};

const getPhoneCandidates = (rawPhone: string): string[] => {
  const digits = normalizeDigits(rawPhone);
  if (!digits) return [];

  const candidates = new Set<string>([digits, ...buildLocalPhoneVariants(digits)]);

  if (digits.startsWith('55') && digits.length > 11) {
    const localDigits = digits.slice(2);
    candidates.add(localDigits);
    for (const variant of buildLocalPhoneVariants(localDigits)) {
      candidates.add(variant);
    }
  }

  const tail11 = digits.length >= 11 ? digits.slice(-11) : '';
  if (tail11) {
    candidates.add(tail11);
    for (const variant of buildLocalPhoneVariants(tail11)) {
      candidates.add(variant);
    }
  }

  const tail10 = digits.length >= 10 ? digits.slice(-10) : '';
  if (tail10) {
    candidates.add(tail10);
  }

  return Array.from(candidates).filter(Boolean);
};

const phonesMatch = (a: string, b: string): boolean => {
  const aCandidates = new Set(getPhoneCandidates(a));
  const bCandidates = getPhoneCandidates(b);
  return bCandidates.some((candidate) => aCandidates.has(candidate));
};

const isPendingAttendanceStatus = (rawStatus: unknown): boolean => {
  const status = String(rawStatus || '').toLowerCase().trim();
  if (!status) return false;

  const finishedStatuses = new Set([
    'completed',
    'concluido',
    'concluida',
    'finalizado',
    'finalizada',
    'done',
    'cancelled',
    'canceled',
    'cancelado',
    'cancelada',
    'failed',
  ]);

  return !finishedStatuses.has(status);
};

export const validatePendingClientBookingLimit = async (
  clientWhatsapp: string,
  establishmentId: string,
  isLimitEnabled: boolean
): Promise<PendingClientBookingValidationResult> => {
  try {
    if (!clientWhatsapp || !establishmentId) return { canBook: true };

    let limitEnabled = parseEnabledFlag(isLimitEnabled);

    // Defesa extra contra estado stale no frontend:
    // se o flag veio falso/ausente no client, confirma no banco uma vez e cacheia.
    if (!limitEnabled) {
      if (pendingLimitFlagCache.has(establishmentId)) {
        limitEnabled = Boolean(pendingLimitFlagCache.get(establishmentId));
      } else {
        const { data: establishmentFlagData, error: establishmentFlagError } = await supabase
          .from('establishments')
          .select('limit_client_pending_booking')
          .eq('id', establishmentId)
          .maybeSingle();

        if (!establishmentFlagError) {
          limitEnabled = parseEnabledFlag((establishmentFlagData as any)?.limit_client_pending_booking);
          pendingLimitFlagCache.set(establishmentId, limitEnabled);
        }
      }
    }

    console.log('🛡️ [PendingBookingValidation] Flag resolvida', {
      establishmentId,
      inputLimitEnabled: isLimitEnabled,
      resolvedLimitEnabled: limitEnabled,
      cacheHit: pendingLimitFlagCache.has(establishmentId),
    });

    if (!limitEnabled) return { canBook: true };

    const phoneCandidates = getPhoneCandidates(clientWhatsapp);
    if (phoneCandidates.length === 0) return { canBook: true };

    // Caminho seguro: função por telefone (sem CPF). Se responder, decide aqui.
    const secure = await fetchClientAppointmentsSecure(clientWhatsapp, establishmentId, null, null);
    if (secure) {
      const hasPendingServiceSecure = secure.some((appointment: any) =>
        isPendingAttendanceStatus(appointment?.status)
      );
      if (hasPendingServiceSecure) {
        return {
          canBook: false,
          message:
            'Voce ainda tem servico pendente nesta barbearia. Aguarde o profissional concluir o atendimento para fazer um novo agendamento.'
        };
      }
      return { canBook: true };
    }

    // Primeira tentativa: filtrar no banco pelos candidatos de telefone.
    // Isso evita depender da leitura/comparação local de client_whatsapp.
    const { data: directMatches, error: directError } = await supabase
      .from('appointments')
      .select('id,status,client_whatsapp')
      .eq('establishment_id', establishmentId)
      .in('client_whatsapp', phoneCandidates)
      .neq('status', 'cancelled');

    if (!directError) {
      const hasPendingServiceDirect = (directMatches || []).some((appointment: any) =>
        isPendingAttendanceStatus(appointment?.status)
      );

      console.log('🛡️ [PendingBookingValidation] Resultado da validacao (direct)', {
        establishmentId,
        inputPhone: clientWhatsapp,
        phoneCandidates,
        totalMatchesFetched: (directMatches || []).length,
        statusesSample: (directMatches || []).slice(0, 20).map((item: any) => String(item?.status || '')),
        hasPendingService: hasPendingServiceDirect,
      });

      if (hasPendingServiceDirect) {
        return {
          canBook: false,
          message:
            'Voce ainda tem servico pendente nesta barbearia. Aguarde o profissional concluir o atendimento para fazer um novo agendamento.'
        };
      }

      // Só libera direto se houve correspondência explícita de telefone e nenhuma pendência.
      // Se não houve match, cai no fallback para cobrir bases antigas (telefone com máscara/espaço/formatação).
      if ((directMatches || []).length > 0) {
        return { canBook: true };
      }
    }

    // Fallback legado: busca ampla e compara em memória.
    const { data: activeAppointments, error } = await supabase
      .from('appointments')
      .select('id,status,client_whatsapp')
      .eq('establishment_id', establishmentId)
      .neq('status', 'cancelled');

    if (error || directError) {
      console.error('Erro ao validar limite de cliente pendente:', error || directError);
      return { canBook: true };
    }

    const hasPendingService = (activeAppointments || []).some((appointment: any) =>
      isPendingAttendanceStatus(appointment?.status) &&
      phonesMatch(clientWhatsapp, String(appointment?.client_whatsapp || ''))
    );

    console.log('🛡️ [PendingBookingValidation] Resultado da validacao', {
      establishmentId,
      inputPhone: clientWhatsapp,
      phoneCandidates,
      totalAppointmentsFetched: (activeAppointments || []).length,
      statusesSample: (activeAppointments || []).slice(0, 20).map((item: any) => String(item?.status || '')),
      hasPendingService,
    });

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
