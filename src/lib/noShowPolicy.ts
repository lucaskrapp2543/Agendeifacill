import { supabase } from './supabase';

/**
 * Política de faltas ("Política do sistema"): o que acontece com o valor pago online
 * se o cliente faltar. Escolha do dono; o cliente vê o aviso só DEPOIS de pagar.
 */
export type NoShowPolicy = 'retain_50' | 'retain_30' | 'retain_20' | 'credit_next';

export const NO_SHOW_POLICY_OPTIONS: Array<{ id: NoShowPolicy; label: string; desc: string }> = [
  { id: 'retain_50', label: 'Retém 50%', desc: 'Falta sem aviso: a plataforma retém metade do valor pago (o valor fica com você)' },
  { id: 'retain_30', label: 'Retém 30%', desc: 'Falta sem aviso: a plataforma retém 30% do valor pago (o valor fica com você)' },
  { id: 'retain_20', label: 'Retém 20%', desc: 'Falta sem aviso: a plataforma retém 20% do valor pago (o valor fica com você)' },
  { id: 'credit_next', label: 'Crédito para o próximo', desc: 'Falta sem aviso: o valor fica guardado para o próximo atendimento' },
];

export const DEFAULT_NO_SHOW_POLICY: NoShowPolicy = 'retain_50';

export function isNoShowPolicy(value: unknown): value is NoShowPolicy {
  return value === 'retain_50' || value === 'retain_30' || value === 'retain_20' || value === 'credit_next';
}

/** Texto que o CLIENTE vê depois de pagar. Tom leve, sem ameaça. */
export function noShowPolicyClientText(policy: NoShowPolicy, establishmentName?: string): { title: string; body: string } {
  const nome = String(establishmentName || '').trim() || 'a barbearia';
  const pct = policy === 'retain_50' ? '50%' : policy === 'retain_30' ? '30%' : policy === 'retain_20' ? '20%' : '';
  // Quem retém é a PLATAFORMA (Agendei Fácil), nunca "a barbearia": evita o cliente
  // ir reclamar com o barbeiro. Tom de aviso rápido, sem ameaça.
  if (policy === 'credit_next') {
    return {
      title: 'Só um aviso rápido 😉',
      body: `Se não puder vir, avisa pelo WhatsApp que a gente reagenda. Em falta sem aviso, o Agendei Fácil (plataforma de agendamentos) guarda o valor como crédito para o seu próximo horário na ${nome}.`,
    };
  }
  return {
    title: 'Só um aviso rápido 😉',
    body: `Se não puder vir, avisa pelo WhatsApp que a gente reagenda. Em falta sem aviso, o Agendei Fácil (plataforma de agendamentos) retém ${pct} do valor pago, conforme a política da plataforma.`,
  };
}

export type NoShowPolicyInfo = { enabled: boolean; policy: NoShowPolicy };

/** Lê a política da barbearia. Erro (coluna ainda não criada, rede) = sem política. */
export async function fetchNoShowPolicy(establishmentId: string): Promise<NoShowPolicyInfo | null> {
  const id = String(establishmentId || '').trim();
  if (!id) return null;
  try {
    const { data, error } = await supabase
      .from('establishments')
      .select('no_show_policy_enabled, no_show_policy')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    const raw = (data as any).no_show_policy;
    return {
      enabled: (data as any).no_show_policy_enabled === true,
      policy: isNoShowPolicy(raw) ? raw : DEFAULT_NO_SHOW_POLICY,
    };
  } catch {
    return null;
  }
}

/** Perdas com faltas e cancelamentos de um mês (agendamentos cancelados, sem contar remarcações). */
export type MonthLosses = { amount: number; count: number; noShows: number; label: string };

export async function fetchMonthLosses(establishmentId: string, year: number, month0: number): Promise<MonthLosses> {
  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const label = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const empty: MonthLosses = { amount: 0, count: 0, noShows: 0, label };
  const id = String(establishmentId || '').trim();
  if (!id) return empty;
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('price, total_price, cancellation_detail, cancellation_source')
      .eq('establishment_id', id)
      .eq('status', 'cancelled')
      .gte('appointment_date', iso(start))
      .lte('appointment_date', iso(end))
      .limit(2000);
    if (error || !Array.isArray(data)) return empty;
    let amount = 0;
    let count = 0;
    let noShows = 0;
    for (const row of data as any[]) {
      // Remarcação não é perda: o horário antigo foi cancelado só porque mudou de lugar
      if (String(row?.cancellation_source || '') === 'rescheduled_by_staff') continue;
      const value = Number(row?.total_price ?? row?.price ?? 0);
      if (!Number.isFinite(value) || value <= 0) continue;
      amount += value;
      count += 1;
      if (String(row?.cancellation_detail || '').toLowerCase().includes('faltou')) noShows += 1;
    }
    return { amount, count, noShows, label };
  } catch {
    return empty;
  }
}
