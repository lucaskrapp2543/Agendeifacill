import { supabase } from './supabase';
import { buildMonthlyGoalView, type MonthlyGoalView } from '../utils/monthlyGoal';

/**
 * 🏆 Meta Mensal — leitura do progresso pelo ESTABELECIMENTO.
 *
 * O ledger `admin_mp_commissions` é somente-admin, então o estabelecimento lê
 * pela RPC `get_establishment_monthly_goal` (SECURITY DEFINER), que devolve só o
 * agregado dele. Nada é gravado aqui — Etapa 4 é somente leitura.
 *
 * Se a migration ainda não tiver sido aplicada, degrada em silêncio (o menu
 * simplesmente não mostra números), sem quebrar o dashboard.
 */

export type MonthlyGoalCounts = {
  validPayments: number;
  pixCount: number;
  creditCount: number;
  appointmentCount: number;
  subscriptionCount: number;
  commissionCents: number;
  planAmountCents: number;
  referenceMonth: string;
};

export type MonthlyGoalResult =
  | { ok: true; counts: MonthlyGoalCounts; view: MonthlyGoalView }
  | { ok: false; reason: 'not_available' | 'forbidden' | 'error'; message?: string };

/** Migration ainda não aplicada — não é erro do usuário, só ausência de recurso. */
function isMissingMonthlyGoalFunction(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  const code = String((error as any)?.code || '');
  if (code === '42883' || code === 'PGRST202') return true;
  return (
    msg.includes('get_establishment_monthly_goal') ||
    (msg.includes('does not exist') && msg.includes('function')) ||
    msg.includes('schema cache')
  );
}

export type MonthlyGoalHistoryItem = {
  referenceMonth: string;
  validPayments: number;
  goalTarget: number;
  percent: number;
  planAmountCents: number;
  discountCents: number;
  finalAmountCents: number;
  status: string;
  notes?: string | null;
};

/** Histórico dos meses já fechados (dono ou admin). Degrada em silêncio. */
export async function fetchMonthlyGoalHistory(
  establishmentId: string,
  limit = 12
): Promise<{ ok: boolean; items: MonthlyGoalHistoryItem[]; notAvailable?: boolean }> {
  const id = String(establishmentId || '').trim();
  if (!id) return { ok: false, items: [] };

  try {
    const { data, error } = await supabase.rpc('list_establishment_monthly_goal_history', {
      p_establishment_id: id,
      p_limit: limit,
    });

    if (error) {
      if (isMissingMonthlyGoalFunction(error)) return { ok: false, items: [], notAvailable: true };
      console.warn('⚠️ Meta Mensal: erro ao carregar histórico:', error);
      return { ok: false, items: [] };
    }

    const payload = (data || {}) as any;
    if (!payload?.ok) return { ok: false, items: [] };

    const items: MonthlyGoalHistoryItem[] = (Array.isArray(payload.items) ? payload.items : []).map((raw: any) => ({
      referenceMonth: String(raw?.reference_month || '').slice(0, 10),
      validPayments: Number(raw?.valid_payments_count || 0),
      goalTarget: Number(raw?.goal_target || 160),
      percent: Number(raw?.percent_final || 0),
      planAmountCents: Number(raw?.plan_amount_cents || 0),
      discountCents: Number(raw?.discount_cents || 0),
      finalAmountCents: Number(raw?.final_amount_cents || 0),
      status: String(raw?.status || 'closed'),
      notes: raw?.notes ? String(raw.notes) : null,
    }));

    return { ok: true, items };
  } catch (error) {
    if (isMissingMonthlyGoalFunction(error)) return { ok: false, items: [], notAvailable: true };
    return { ok: false, items: [] };
  }
}

export type MonthlyGoalCredit = {
  available: boolean;
  percent: number;
  referenceMonth: string;
  validPayments: number;
};

/**
 * Crédito de desconto disponível (último mês fechado com percentual > 0).
 *
 * SOMENTE LEITURA — quem consome o crédito é o servidor, na hora de gerar o PIX.
 * A função de consumo nem sequer é executável pelo navegador (GRANT só para
 * service_role), então este valor serve apenas para MOSTRAR o botão.
 *
 * Degrada em silêncio: sem a migration aplicada, devolve indisponível.
 */
export async function fetchMonthlyGoalCredit(establishmentId: string): Promise<MonthlyGoalCredit> {
  const empty: MonthlyGoalCredit = { available: false, percent: 0, referenceMonth: '', validPayments: 0 };
  const id = String(establishmentId || '').trim();
  if (!id) return empty;

  try {
    const { data, error } = await supabase.rpc('get_monthly_goal_credit', { p_establishment_id: id });

    if (error) {
      if (!isMissingMonthlyGoalFunction(error)) {
        console.warn('⚠️ Meta Mensal: erro ao verificar crédito:', error);
      }
      return empty;
    }

    const payload = (data || {}) as any;
    if (!payload?.ok || payload?.available !== true) return empty;

    const percent = Math.min(100, Math.max(0, Math.floor(Number(payload.percent) || 0)));
    if (percent <= 0) return empty;

    return {
      available: true,
      percent,
      referenceMonth: String(payload.reference_month || '').slice(0, 10),
      validPayments: Number(payload.valid_payments || 0),
    };
  } catch (error) {
    if (!isMissingMonthlyGoalFunction(error)) {
      console.warn('⚠️ Meta Mensal: falha ao verificar crédito:', error);
    }
    return empty;
  }
}

/**
 * Fecha o mês (somente admin). Idempotente: rodar de novo não duplica nem altera
 * o que já foi fechado. NÃO cria e NÃO altera nenhuma cobrança.
 * Sem argumento, fecha o mês ANTERIOR (o mês corrente ainda pode subir).
 */
export async function adminCloseMonthlyGoals(referenceMonth?: string): Promise<{
  ok: boolean;
  message: string;
  inserted?: number;
  alreadyClosed?: number;
  supersededByReferral?: number;
}> {
  try {
    const { data, error } = await supabase.rpc('admin_close_monthly_goals', {
      ...(referenceMonth ? { p_month: referenceMonth } : {}),
    });

    if (error) {
      if (isMissingMonthlyGoalFunction(error)) {
        return { ok: false, message: 'Funcionalidade ainda não instalada no banco. Aplique a migration.' };
      }
      return { ok: false, message: error.message || 'Erro ao fechar o mês.' };
    }

    const payload = (data || {}) as any;
    if (!payload?.ok) {
      if (payload?.error === 'month_still_open') {
        return { ok: false, message: payload?.message || 'Só é possível fechar um mês que já terminou.' };
      }
      if (payload?.error === 'forbidden') {
        return { ok: false, message: 'Apenas o administrador pode fechar o mês.' };
      }
      return { ok: false, message: String(payload?.error || 'Erro ao fechar o mês.') };
    }

    const inserted = Number(payload.inserted || 0);
    const alreadyClosed = Number(payload.already_closed || 0);
    const superseded = Number(payload.superseded_by_referral || 0);

    return {
      ok: true,
      inserted,
      alreadyClosed,
      supersededByReferral: superseded,
      message:
        inserted === 0
          ? `Mês já estava fechado (${alreadyClosed} registros). Nada foi alterado.`
          : `Mês fechado: ${inserted} registrados${alreadyClosed > 0 ? `, ${alreadyClosed} já existiam` : ''}${superseded > 0 ? `, ${superseded} com indicação (benefício maior)` : ''}.`,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Erro ao fechar o mês.' };
  }
}

export async function fetchEstablishmentMonthlyGoal(
  establishmentId: string,
  referenceMonth?: string
): Promise<MonthlyGoalResult> {
  const id = String(establishmentId || '').trim();
  if (!id) return { ok: false, reason: 'error', message: 'Estabelecimento não informado.' };

  try {
    const { data, error } = await supabase.rpc('get_establishment_monthly_goal', {
      p_establishment_id: id,
      ...(referenceMonth ? { p_month: referenceMonth } : {}),
    });

    if (error) {
      if (isMissingMonthlyGoalFunction(error)) return { ok: false, reason: 'not_available' };
      console.warn('⚠️ Meta Mensal: erro ao carregar progresso:', error);
      return { ok: false, reason: 'error', message: error.message };
    }

    const payload = (data || {}) as any;
    if (!payload?.ok) {
      if (String(payload?.error || '') === 'forbidden') return { ok: false, reason: 'forbidden' };
      return { ok: false, reason: 'error', message: String(payload?.error || 'Erro desconhecido') };
    }

    const counts: MonthlyGoalCounts = {
      validPayments: Number(payload.valid_payments || 0),
      pixCount: Number(payload.pix_count || 0),
      creditCount: Number(payload.credit_count || 0),
      appointmentCount: Number(payload.appointment_count || 0),
      subscriptionCount: Number(payload.subscription_count || 0),
      commissionCents: Number(payload.commission_cents || 0),
      planAmountCents: Number(payload.plan_amount_cents || 0),
      referenceMonth: String(payload.reference_month || '').slice(0, 10),
    };

    const revenuePerPaymentCents =
      counts.validPayments > 0 ? Math.round(counts.commissionCents / counts.validPayments) : 0;

    const view = buildMonthlyGoalView({
      validPayments: counts.validPayments,
      planAmountCents: counts.planAmountCents,
      referenceMonth: counts.referenceMonth || undefined,
      revenuePerPaymentCents,
    });

    return { ok: true, counts, view };
  } catch (error: any) {
    if (isMissingMonthlyGoalFunction(error)) return { ok: false, reason: 'not_available' };
    console.warn('⚠️ Meta Mensal: falha inesperada:', error);
    return { ok: false, reason: 'error', message: error?.message };
  }
}
