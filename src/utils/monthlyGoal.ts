/**
 * 🏆 Meta Mensal — desconto POR FAIXA na mensalidade do estabelecimento.
 *
 * Quanto mais pagamentos online válidos o estabelecimento gera no mês, maior o
 * desconto na mensalidade seguinte. 160 pagamentos = 100% (mensalidade grátis).
 *
 * FONTE DA CONTAGEM: tabela `admin_mp_commissions` (o mesmo ledger que alimenta o
 * card oficial "Meus R$1" do admin) — linhas com status='paid' e paid_at no mês.
 * Conta-se LINHAS, não centavos: assim a meta não quebra se a taxa mudar de valor.
 *
 * Este arquivo é 100% puro (sem I/O, sem Supabase) para o cálculo poder ser
 * conferido isoladamente. Nada aqui altera cobrança — Etapa 3 é só leitura.
 */

/** Pagamentos online válidos necessários para 100% de desconto. */
export const MONTHLY_GOAL_TARGET = 160;

/** Faixas de desconto. É a fonte da verdade do cálculo — não são só visuais. */
export const MONTHLY_GOAL_MILESTONES = [
  { percent: 25, payments: 40, label: 'Desconto de 25%', emoji: '🟢' },
  { percent: 50, payments: 80, label: 'Metade da mensalidade', emoji: '🟢' },
  { percent: 75, payments: 120, label: 'Quase grátis', emoji: '🟢' },
  { percent: 100, payments: 160, label: 'Mensalidade gratuita', emoji: '🏆' },
] as const;

export type MonthlyGoalStatus =
  | 'in_progress'
  | 'closed'
  | 'awaiting'
  | 'applied'
  | 'cancelled'
  | 'expired'
  | 'superseded';

const toSafeInt = (value: unknown): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Percentual conquistado — POR FAIXA FECHADA (não é progressivo).
 *
 * O desconto só sobe quando o número cheio da faixa é atingido, e permanece
 * nele até bater a próxima. Não existe valor intermediário:
 *
 *    0 a  39 pagamentos ->   0%
 *   40 a  79 pagamentos ->  25%
 *   80 a 119 pagamentos ->  50%
 *  120 a 159 pagamentos ->  75%
 *       160+            -> 100%
 *
 * Ex.: 87 pagamentos = 50% (passou de 80, não chegou a 120).
 *      119 pagamentos = 50% também — NÃO é "quase 75%".
 *
 * As faixas vêm de MONTHLY_GOAL_MILESTONES: mudar lá muda tudo (UI e cálculo).
 */
export function computeGoalPercent(validPayments: unknown, _target: number = MONTHLY_GOAL_TARGET): number {
  const count = Math.max(0, toSafeInt(validPayments));
  let percent = 0;
  for (const milestone of MONTHLY_GOAL_MILESTONES) {
    if (count >= milestone.payments) percent = milestone.percent;
  }
  return Math.min(100, Math.max(0, percent));
}

/**
 * Desconto e valor final, sempre em CENTAVOS (evita erro de ponto flutuante).
 *
 * Arredondamento: Math.round na fração de centavo. A regra "nunca arredondar para
 * cima" vale para o PERCENTUAL (159 pagamentos = 99%), não para o dinheiro — os
 * exemplos oficiais confirmam: R$67,90 a 32% = 2172,8 centavos = R$21,73.
 * Em 100% o desconto é o valor cheio, então a mensalidade fica exatamente R$0,00.
 */
export function computeGoalDiscount(
  planAmountCents: unknown,
  percent: unknown
): { planCents: number; discountCents: number; finalCents: number } {
  const planCents = Math.max(0, toSafeInt(planAmountCents));
  const pct = Math.min(100, Math.max(0, toSafeInt(percent)));
  const rawDiscount = Math.round((planCents * pct) / 100);
  const discountCents = Math.min(planCents, Math.max(0, rawDiscount));
  return {
    planCents,
    discountCents,
    finalCents: Math.max(0, planCents - discountCents),
  };
}

/** Quantos pagamentos ainda faltam para 100%. */
export function remainingToGoal(validPayments: unknown, target: number = MONTHLY_GOAL_TARGET): number {
  const count = Math.max(0, toSafeInt(validPayments));
  const goal = Math.max(0, toSafeInt(target) || MONTHLY_GOAL_TARGET);
  return Math.max(0, goal - count);
}

/** Próximo marco ainda não atingido (null quando já bateu 100%). */
export function nextMilestone(validPayments: unknown): {
  percent: number;
  payments: number;
  label: string;
  emoji: string;
  missing: number;
} | null {
  const count = Math.max(0, toSafeInt(validPayments));
  const target = MONTHLY_GOAL_MILESTONES.find((m) => count < m.payments);
  if (!target) return null;
  return { ...target, missing: Math.max(0, target.payments - count) };
}

/**
 * Receita total estimada que o estabelecimento gerou no mês:
 * (pagamentos válidos × receita por pagamento) + mensalidade restante após desconto.
 *
 * `revenuePerPaymentCents` NÃO é fixado aqui de propósito — deve vir da regra
 * oficial (commission_cents do ledger), não de um número mágico no frontend.
 */
export function computeEstablishmentRevenue(input: {
  validPayments: unknown;
  revenuePerPaymentCents: unknown;
  finalMonthlyCents: unknown;
}): {
  paymentsRevenueCents: number;
  monthlyRevenueCents: number;
  totalRevenueCents: number;
} {
  const count = Math.max(0, toSafeInt(input.validPayments));
  const perPayment = Math.max(0, toSafeInt(input.revenuePerPaymentCents));
  const monthlyRevenueCents = Math.max(0, toSafeInt(input.finalMonthlyCents));
  const paymentsRevenueCents = count * perPayment;
  return {
    paymentsRevenueCents,
    monthlyRevenueCents,
    totalRevenueCents: paymentsRevenueCents + monthlyRevenueCents,
  };
}

export function formatCentsBRL(cents: unknown): string {
  const value = toSafeInt(cents) / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function getMonthlyGoalStatusLabel(status: MonthlyGoalStatus): string {
  switch (status) {
    case 'in_progress':
      return 'Em andamento';
    case 'closed':
      return 'Fechado';
    case 'awaiting':
      return 'Aguardando aplicação';
    case 'applied':
      return 'Aplicado';
    case 'cancelled':
      return 'Cancelado';
    case 'expired':
      return 'Expirado';
    case 'superseded':
      return 'Substituído por outro benefício';
    default:
      return 'Em andamento';
  }
}

/** Mês de referência (1º dia) no fuso de São Paulo — evita erro na virada do mês. */
export function getBrazilReferenceMonth(reference: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(reference);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  return `${year}-${month}-01`;
}

/** Rótulo amigável do mês ("Julho de 2026"). */
export function formatReferenceMonthLabel(referenceMonth: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(String(referenceMonth || ''));
  if (!match) return '—';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Cor da barra por faixa — mesma escala visual usada em GoalProgressBar. */
export function getGoalBarColor(percent: number): string {
  if (percent >= 100) return 'bg-emerald-500';
  if (percent >= 75) return 'bg-blue-500';
  if (percent >= 50) return 'bg-amber-500';
  if (percent >= 25) return 'bg-orange-500';
  return 'bg-gray-400';
}

/**
 * Visão completa da meta, pronta para a UI. Reúne tudo num objeto só para admin
 * e estabelecimento mostrarem exatamente os mesmos números.
 */
export function buildMonthlyGoalView(input: {
  validPayments: unknown;
  planAmountCents: unknown;
  referenceMonth?: string;
  status?: MonthlyGoalStatus;
  revenuePerPaymentCents?: unknown;
}) {
  const validPayments = Math.max(0, toSafeInt(input.validPayments));
  const percent = computeGoalPercent(validPayments);
  const { planCents, discountCents, finalCents } = computeGoalDiscount(input.planAmountCents, percent);
  const referenceMonth = input.referenceMonth || getBrazilReferenceMonth();
  const revenue = computeEstablishmentRevenue({
    validPayments,
    revenuePerPaymentCents: input.revenuePerPaymentCents ?? 0,
    finalMonthlyCents: finalCents,
  });

  return {
    validPayments,
    target: MONTHLY_GOAL_TARGET,
    percent,
    remaining: remainingToGoal(validPayments),
    nextMilestone: nextMilestone(validPayments),
    planCents,
    discountCents,
    finalCents,
    referenceMonth,
    referenceMonthLabel: formatReferenceMonthLabel(referenceMonth),
    status: input.status || 'in_progress',
    statusLabel: getMonthlyGoalStatusLabel(input.status || 'in_progress'),
    barColor: getGoalBarColor(percent),
    progressLabel: `${validPayments} / ${MONTHLY_GOAL_TARGET}`,
    revenue,
  };
}

export type MonthlyGoalView = ReturnType<typeof buildMonthlyGoalView>;
