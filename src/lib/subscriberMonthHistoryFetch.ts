/**
 * Consultas da regra "com histórico" (ver subscriberMonthHistory.ts).
 * Separadas do cálculo puro para o cálculo poder ser testado fora do navegador.
 * Lançam erro em falha: quem chama decide o fallback (normalmente: seguir com a
 * regra antiga, sem quebrar a tela).
 */
import { supabase } from './supabase';
import {
  agruparEstadosPorAssinante,
  normalizarAgendaAssinantes,
  type AgendaAssinanteMesRow,
  type HistoricoEstadoAssinante,
} from './subscriberMonthHistory';

const pad = (n: number) => String(n).padStart(2, '0');

/** Estados gravados em client_subscription_history com início ou pagamento no mês, por assinante. */
export async function fetchHistoricoEstadosDoMes(
  establishmentId: string,
  year: number,
  month0: number
): Promise<Map<string, HistoricoEstadoAssinante[]>> {
  const prefixoMes = `${year}-${pad(month0 + 1)}`;
  const { data, error } = await supabase
    .from('client_subscription_history')
    .select('client_subscription_id, created_at, operation, new_row')
    .eq('establishment_id', establishmentId)
    .in('operation', ['SNAPSHOT', 'INSERT', 'UPDATE'])
    .or(`new_row->>last_payment_date.like.${prefixoMes}%,new_row->>start_date.like.${prefixoMes}%`)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) throw error;
  return agruparEstadosPorAssinante((data || []) as any[]);
}

/** Atendimentos concluídos de assinante no mês (para reconstruir "ativos" de mês fechado). */
export async function fetchAgendaAssinantesDoMes(
  establishmentId: string,
  year: number,
  month0: number
): Promise<AgendaAssinanteMesRow[]> {
  const inicio = `${year}-${pad(month0 + 1)}-01`;
  const fim = `${year}-${pad(month0 + 1)}-${pad(new Date(year, month0 + 1, 0).getDate())}`;
  const { data, error } = await supabase
    .from('appointments')
    .select('client_name, client_whatsapp, subscription_id, appointment_date, is_loyalty_reward')
    .eq('establishment_id', establishmentId)
    .eq('status', 'completed')
    .gte('appointment_date', inicio)
    .lte('appointment_date', fim)
    .or('is_subscriber.eq.true,payment_method.eq.assinante,subscription_id.not.is.null,subscriber_service_name.not.is.null')
    .limit(1000);
  if (error) throw error;
  return normalizarAgendaAssinantes((data || []) as any[]);
}
