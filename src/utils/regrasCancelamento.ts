/** Comportamento legado do app antes da configuração por estabelecimento (3 horas). */
export const LIMITE_CANCELAMENTO_HORAS = 3;

export const LEGACY_LIMITE_CANCELAMENTO_MINUTOS = LIMITE_CANCELAMENTO_HORAS * 60;

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

/** Lê minutos configurados no estabelecimento; se ausente/ inválido, mantém o legado de 3h. */
export function minutosEfetivosCancelamentoCliente(establishment: unknown): number {
  const raw = Number((establishment as { booking_min_cancel_minutes?: number | null } | null | undefined)?.booking_min_cancel_minutes);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return LEGACY_LIMITE_CANCELAMENTO_MINUTOS;
}

export function formatarDuracaoMinutosParaTexto(minutos: number): string {
  if (!Number.isFinite(minutos) || minutos <= 0) return '0 minutos';
  if (minutos < 60) return `${minutos} minuto${minutos === 1 ? '' : 's'}`;
  const h = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (resto === 0) return `${h} hora${h === 1 ? '' : 's'}`;
  return `${h} h e ${resto} min`;
}

export function estadoCancelamentoParaAgendamentoCliente(
  appointment: { appointment_date?: string | null; appointment_time?: string | null },
  establishment: unknown,
  agora: Date = new Date()
): { permitido: boolean; motivo?: string } {
  const minutos = minutosEfetivosCancelamentoCliente(establishment);
  return podeCancelarAgendamento(
    {
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
    },
    agora,
    minutos
  );
}

export function podeCancelarAgendamento(
  params: {
    appointment_date?: string | null;
    appointment_time?: string | null;
  },
  agora: Date = new Date(),
  /** Minutos de antecedência mínima exigidos para ainda poder cancelar. 0 = só bloqueia se já passou. */
  limiteMinutos: number = LEGACY_LIMITE_CANCELAMENTO_MINUTOS
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

  if (!Number.isFinite(limiteMinutos) || limiteMinutos <= 0) {
    return { permitido: true };
  }

  const limiteMs = limiteMinutos * 60 * 1000;
  if (diffMs < limiteMs) {
    const prazo = formatarDuracaoMinutosParaTexto(limiteMinutos);
    return {
      permitido: false,
      motivo: `Você não pode cancelar: já está dentro do prazo mínimo deste estabelecimento (é necessário cancelar com pelo menos ${prazo} de antecedência). Se precisar de ajuda, fale com a barbearia.`,
    };
  }

  return { permitido: true };
}
