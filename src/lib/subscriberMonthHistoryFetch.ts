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

const LINHAS_POR_PAGINA = 1000;
const MAX_PAGINAS = 20;

/** Só o que o cálculo usa do estado gravado: mantém a consulta leve mesmo com muita alteração. */
const CAMPOS_DO_ESTADO = [
  'payment_status',
  'start_date',
  'end_date',
  'last_payment_date',
  'subscription_id',
  'custom_subscription_value',
  'extra_charge_value',
  'archived_at',
  'subscriber_name',
  'subscriber_whatsapp',
  'subscriber_payment_method',
  'subscription_payment_provider',
];

/**
 * Linha do tempo das fichas da barbearia, para calcular um mês. Vem inteira até 45
 * dias depois do fim do mês: o começo mostra o estado anterior de cada ficha, e o
 * que acontece bem depois (vencer, renovar) não muda mais o que entrou naquele mês.
 */
export async function fetchHistoricoEstadosDoMes(
  establishmentId: string,
  year: number,
  month0: number
): Promise<Map<string, HistoricoEstadoAssinante[]>> {
  const limite = new Date(Date.UTC(year, month0 + 1, 45)).toISOString();
  const colunas = [
    'client_subscription_id',
    'created_at',
    'operation',
    ...CAMPOS_DO_ESTADO.map((campo) => `${campo}:new_row->>${campo}`),
  ].join(',');

  const linhas: any[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * LINHAS_POR_PAGINA;
    const { data, error } = await supabase
      .from('client_subscription_history')
      .select(colunas)
      .eq('establishment_id', establishmentId)
      .lte('created_at', limite)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(de, de + LINHAS_POR_PAGINA - 1);
    if (error) throw error;
    const lote = (data || []) as any[];
    linhas.push(...lote);
    if (lote.length < LINHAS_POR_PAGINA) break;
  }

  return agruparEstadosPorAssinante(
    linhas.map((linha) => {
      const operation = String(linha?.operation || '');
      const estado: Record<string, any> = {};
      for (const campo of CAMPOS_DO_ESTADO) estado[campo] = linha?.[campo] ?? null;
      return {
        client_subscription_id: linha?.client_subscription_id,
        created_at: linha?.created_at,
        operation,
        new_row: operation === 'DELETE' ? null : estado,
      };
    })
  );
}

/** Atendimentos concluídos de assinante no mês (para reconstruir "ativos" de mês fechado). */
export async function fetchAgendaAssinantesDoMes(
  establishmentId: string,
  year: number,
  month0: number
): Promise<AgendaAssinanteMesRow[]> {
  const inicio = `${year}-${pad(month0 + 1)}-01`;
  const fim = `${year}-${pad(month0 + 1)}-${pad(new Date(year, month0 + 1, 0).getDate())}`;
  const linhas: any[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const de = pagina * LINHAS_POR_PAGINA;
    const { data, error } = await supabase
      .from('appointments')
      .select('client_name, client_whatsapp, subscription_id, appointment_date, is_loyalty_reward')
      .eq('establishment_id', establishmentId)
      .eq('status', 'completed')
      .gte('appointment_date', inicio)
      .lte('appointment_date', fim)
      .or('is_subscriber.eq.true,payment_method.eq.assinante,subscription_id.not.is.null,subscriber_service_name.not.is.null')
      .order('id', { ascending: true })
      .range(de, de + LINHAS_POR_PAGINA - 1);
    if (error) throw error;
    const lote = (data || []) as any[];
    linhas.push(...lote);
    if (lote.length < LINHAS_POR_PAGINA) break;
  }
  return normalizarAgendaAssinantes(linhas);
}
