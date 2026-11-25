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

// ─────────────────────────────────────────────────────────────────────────
// "Cancelar pelo WhatsApp (pedido de cancelamento)" — opção do painel
// (coluna establishments.require_cancellation_request).
//
// Com ela valendo, o cliente NÃO cancela sozinho: no lugar do "Cancelar
// Agendamento" aparece um botão que abre o WhatsApp da barbearia com o pedido
// de cancelamento pronto.
//
// A opção sempre existiu no painel, mas nenhuma tela do cliente olhava para
// ela: o trecho que olhava saiu em 23/09/2025 junto com a "punição ao cancelar"
// e, em 29/12/2025, a página "Meus agendamentos" passou a cancelar sempre direto.
// Em 25/11/2026 voltou a valer, primeiro só para quem reclamou (lista abaixo) e,
// no mesmo dia, por decisão do Lucas, para TODA barbearia que marcou a opção.
//
// Para voltar a valer só para a lista: troque para `false`.
// ─────────────────────────────────────────────────────────────────────────
const CANCELAMENTO_SO_PELO_WHATSAPP_PARA_TODOS = true;
const CANCELAMENTO_SO_PELO_WHATSAPP_IDS: readonly string[] = [
  '300ec968-f932-485d-8351-e479cab58dcc', // 7130 — Studio Barber Juliana Ramos
];

/** WhatsApp da barbearia só com números e com o 55 na frente; '' se não houver número válido. */
function digitosWhatsAppDaBarbearia(establishment: unknown): string {
  let digitos = String((establishment as { whatsapp?: unknown } | null | undefined)?.whatsapp || '').replace(/\D/g, '');
  if (!digitos) return '';
  if (digitos.length >= 10 && digitos.length <= 11) digitos = `55${digitos}`;
  return digitos.length >= 12 ? digitos : '';
}

/**
 * true = nesta barbearia o cliente só PEDE o cancelamento pelo WhatsApp.
 * Precisa de: opção marcada no painel + barbearia na lista (ou PARA_TODOS) + WhatsApp cadastrado.
 * Sem WhatsApp cadastrado o cliente ficaria sem saída, então vale o cancelamento normal.
 */
export function cancelamentoSoPeloWhatsApp(establishment: unknown): boolean {
  const e = establishment as { id?: unknown; require_cancellation_request?: unknown } | null | undefined;
  if (!e || e.require_cancellation_request !== true) return false;
  if (
    !CANCELAMENTO_SO_PELO_WHATSAPP_PARA_TODOS &&
    !CANCELAMENTO_SO_PELO_WHATSAPP_IDS.includes(String(e.id || '').trim().toLowerCase())
  ) {
    return false;
  }
  return digitosWhatsAppDaBarbearia(establishment) !== '';
}

/** Link do WhatsApp da barbearia com o pedido de cancelamento já escrito; '' se não houver número. */
export function linkPedidoCancelamentoWhatsApp(
  establishment: unknown,
  appointment: {
    appointment_date?: string | null;
    appointment_time?: string | null;
    service?: string | null;
    service_name?: string | null;
    professional_name?: string | null;
    client_name?: string | null;
  }
): string {
  const digitos = digitosWhatsAppDaBarbearia(establishment);
  if (!digitos) return '';
  const data = String(appointment.appointment_date || '').slice(0, 10).split('-').reverse().join('/');
  const hora = String(appointment.appointment_time || '').slice(0, 5);
  const linhas = ['Olá, queria cancelar agendamento:', ''];
  if (data) linhas.push(`*Data:* ${data}`);
  if (hora) linhas.push(`*Horário:* ${hora}`);
  const servico = String(appointment.service_name || appointment.service || '').trim();
  if (servico) linhas.push(`*Serviço:* ${servico}`);
  const profissional = String(appointment.professional_name || '').trim();
  if (profissional) linhas.push(`*Profissional:* ${profissional}`);
  const cliente = String(appointment.client_name || '').trim();
  if (cliente) linhas.push(`*Cliente:* ${cliente}`);
  linhas.push('', 'Motivo é: ');
  return `https://wa.me/${digitos}?text=${encodeURIComponent(linhas.join('\n'))}`;
}

export function estadoCancelamentoParaAgendamentoCliente(
  appointment: { appointment_date?: string | null; appointment_time?: string | null },
  establishment: unknown,
  agora: Date = new Date()
): { permitido: boolean; motivo?: string; pedirPeloWhatsApp?: boolean } {
  const minutos = minutosEfetivosCancelamentoCliente(establishment);
  const pelaRegraDePrazo = podeCancelarAgendamento(
    {
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
    },
    agora,
    minutos
  );

  if (cancelamentoSoPeloWhatsApp(establishment)) {
    const dataHora = obterDataHoraAgendamentoLocal(appointment.appointment_date, appointment.appointment_time);
    // Horário que já passou (ou data ilegível): continua a mensagem de sempre.
    if (!dataHora || dataHora.getTime() <= agora.getTime()) return pelaRegraDePrazo;
    return {
      permitido: false,
      pedirPeloWhatsApp: true,
      motivo: 'Nesta barbearia o cancelamento é pedido pelo WhatsApp. Fale com a barbearia para cancelar.',
    };
  }

  return pelaRegraDePrazo;
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
