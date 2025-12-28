export const LIMITE_CANCELAMENTO_HORAS = 3;

export function obterDataHoraAgendamentoLocal(
  appointmentDate: string | null | undefined,
  appointmentTime: string | null | undefined
): Date | null {
  try {
    const [year, month, day] = String(appointmentDate || '').split('-').map(Number);
    if (!year || !month || !day) return null;

    const [hours, minutes] = String(appointmentTime || '00:00').split(':').map(Number);
    const safeHours = Number.isFinite(hours) ? hours : 0;
    const safeMinutes = Number.isFinite(minutes) ? minutes : 0;

    // timezone local (evita parsing ambíguo)
    return new Date(year, month - 1, day, safeHours, safeMinutes, 0, 0);
  } catch {
    return null;
  }
}

export function podeCancelarAgendamento(
  params: {
    appointment_date?: string | null;
    appointment_time?: string | null;
  },
  agora: Date = new Date(),
  limiteHoras: number = LIMITE_CANCELAMENTO_HORAS
): { permitido: boolean; motivo?: string } {
  const appointmentDateTime = obterDataHoraAgendamentoLocal(params.appointment_date, params.appointment_time);

  if (!appointmentDateTime) {
    // Se não dá pra interpretar data/hora, melhor não permitir para evitar cancelamentos indevidos
    return { permitido: false, motivo: 'Não foi possível validar a data/hora desse agendamento para cancelamento.' };
  }

  const diffMs = appointmentDateTime.getTime() - agora.getTime();

  if (diffMs <= 0) {
    return { permitido: false, motivo: 'Esse agendamento já passou e não pode mais ser cancelado.' };
  }

  const limiteMs = limiteHoras * 60 * 60 * 1000;
  if (diffMs < limiteMs) {
    return {
      permitido: false,
      motivo: `Faltam menos de ${limiteHoras} horas para o serviço. Não é possível cancelar por aqui.`,
    };
  }

  return { permitido: true };
}


