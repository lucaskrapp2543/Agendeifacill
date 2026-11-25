// ════════════════════════════════════════════════════════════════════════
// Regras de SEMANA do assinante (opções do painel, em "Meus Assinantes"):
//
//   • "Limitar agendamentos de assinantes"  (establishments.limit_subscriber_bookings)
//       o assinante só agenda dentro da semana atual;
//   • "1 agendamento na semana"             (establishments.limit_subscribers_one_week)
//       se o assinante já tem um horário ativo na semana, não marca outro
//       até esse ser cancelado.
//
// Estas regras só eram conferidas na Página Completa. Em 25/11/2026 passaram
// a valer também na Página Chat e na Página Simples (reclamação da Ls
// Barbearia: um assinante marcou 3 horários no mesmo dia pela Página Chat).
//
// Mesma conta de antes: semana de DOMINGO a SÁBADO; conta como "horário
// ativo" o que está pendente ou confirmado. Só vale para agendamento feito
// COMO ASSINANTE. Se a consulta falhar, NÃO trava o agendamento.
// ════════════════════════════════════════════════════════════════════════
import { fetchClientAppointmentsSecure } from './secureAppointmentReads';
import { isShowcaseEstablishmentId } from './showcaseEstablishment';

const pad2 = (n: number) => String(n).padStart(2, '0');
const paraChave = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** yyyy-MM-dd -> Date ao meio-dia local (meio-dia evita virar o dia por causa de fuso). */
const aoMeioDia = (dateKey: string): Date | null => {
  const [y, m, d] = String(dateKey || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

/** Semana (domingo a sábado) que contém o dia informado. */
export function semanaDoDia(dateKey: string): { min: string; max: string } | null {
  const dia = aoMeioDia(dateKey);
  if (!dia) return null;
  const inicio = new Date(dia);
  inicio.setDate(dia.getDate() - dia.getDay());
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  return { min: paraChave(inicio), max: paraChave(fim) };
}

/** O dia cai na semana de hoje (domingo a sábado)? */
export function diaEstaNaSemanaAtual(dateKey: string, hoje: Date = new Date()): boolean {
  const semana = semanaDoDia(paraChave(hoje));
  const chave = String(dateKey || '').slice(0, 10);
  return !!semana && !!chave && chave >= semana.min && chave <= semana.max;
}

const ultimos9 = (valor: unknown) => String(valor ?? '').replace(/\D/g, '').slice(-9);

/** Mesmo telefone, com ou sem 55 na frente (compara os 9 últimos números, como o banco faz). */
export function mesmoTelefone(a: unknown, b: unknown): boolean {
  const x = ultimos9(a);
  const y = ultimos9(b);
  return x.length === 9 && x === y;
}

/** A barbearia ligou "Limitar agendamentos de assinantes" (só na semana atual)? */
export function assinanteSoNaSemanaAtual(establishment: unknown): boolean {
  const e = establishment as { id?: unknown; limit_subscriber_bookings?: unknown } | null | undefined;
  if (!e || e.limit_subscriber_bookings !== true) return false;
  // Barbearia de apresentação: a agenda fica num dia fixo, fora da semana atual de propósito.
  return !isShowcaseEstablishmentId(e.id);
}

/** A barbearia ligou "1 agendamento na semana"? */
export function assinanteUmPorSemana(establishment: unknown): boolean {
  return (establishment as { limit_subscribers_one_week?: unknown } | null | undefined)?.limit_subscribers_one_week === true;
}

const STATUS_ATIVOS = ['confirmed', 'pending'];

/** Outro horário ativo (pendente/confirmado) desse telefone na mesma semana do dia escolhido. */
export function outroAgendamentoAtivoNaSemana(
  agendamentos: any[] | null | undefined,
  telefone: unknown,
  dateKey: string,
  ignorarId?: string | null
): any | null {
  const semana = semanaDoDia(dateKey);
  if (!semana || !Array.isArray(agendamentos)) return null;
  const ignorar = String(ignorarId || '').trim();
  return (
    agendamentos.find((a) => {
      if (!a) return false;
      if (ignorar && String(a.id || '') === ignorar) return false;
      if (!STATUS_ATIVOS.includes(String(a.status || '').toLowerCase())) return false;
      const dia = String(a.appointment_date || '').slice(0, 10);
      if (!dia || dia < semana.min || dia > semana.max) return false;
      return mesmoTelefone(a.client_whatsapp, telefone);
    }) || null
  );
}

export type ResultadoRegraSemana =
  | { ok: true }
  | { ok: false; rule: 'mesma_semana' | 'um_por_semana'; message: string };

/**
 * Confere as duas regras de semana para um agendamento feito COMO ASSINANTE.
 * `establishment` precisa trazer id, limit_subscriber_bookings e limit_subscribers_one_week
 * (a função pública get_establishment_public já traz).
 */
export async function checkSubscriberWeekRules(params: {
  establishment: unknown;
  clientWhatsapp: string;
  dateKey: string;
  hoje?: Date;
  ignorarAgendamentoId?: string | null;
}): Promise<ResultadoRegraSemana> {
  const estId = String((params.establishment as { id?: unknown } | null | undefined)?.id || '').trim();
  const dateKey = String(params.dateKey || '').slice(0, 10);
  if (!estId || !dateKey) return { ok: true };

  try {
    if (assinanteSoNaSemanaAtual(params.establishment) && !diaEstaNaSemanaAtual(dateKey, params.hoje)) {
      return {
        ok: false,
        rule: 'mesma_semana',
        message: 'Assinantes desta barbearia só podem agendar dentro da mesma semana (até sábado). Escolha um dia desta semana.',
      };
    }

    if (assinanteUmPorSemana(params.establishment)) {
      const semana = semanaDoDia(dateKey);
      if (semana) {
        const agendamentos = await fetchClientAppointmentsSecure(params.clientWhatsapp, estId, semana.min, semana.max);
        const outro = outroAgendamentoAtivoNaSemana(agendamentos, params.clientWhatsapp, dateKey, params.ignorarAgendamentoId);
        if (outro) {
          const dia = String(outro.appointment_date || '').slice(0, 10).split('-').reverse().slice(0, 2).join('/');
          const hora = String(outro.appointment_time || '').slice(0, 5);
          return {
            ok: false,
            rule: 'um_por_semana',
            message: `Você já tem um horário marcado nesta semana (${dia} às ${hora}). Sua assinatura permite um agendamento por semana: para marcar outro, é preciso cancelar esse primeiro.`,
          };
        }
      }
    }
  } catch {
    // Falha de consulta não pode travar o agendamento (mesmo comportamento das regras antigas).
  }

  return { ok: true };
}
