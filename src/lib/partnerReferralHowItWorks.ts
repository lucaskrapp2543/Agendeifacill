import {
  PARTNER_REFERRAL_COMMISSION_BRL,
  PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD,
} from './partnerReferralDashboard';

export type PartnerReferralHowItWorksStep = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  highlight?: boolean;
  exampleLabel?: string;
};

export type PartnerReferralEarningsScenario = {
  activeCount: number;
  label: string;
  profitLabel: string;
  isFree?: boolean;
  isMax?: boolean;
};

export const PARTNER_REFERRAL_HOW_IT_WORKS_STEPS: PartnerReferralHowItWorksStep[] = [
  {
    id: 'create-coupon',
    emoji: '1️⃣',
    title: 'Crie seu cupom',
    description: 'Crie seu cupom exclusivo e compartilhe com outros barbeiros.',
    exampleLabel: 'BITELO',
  },
  {
    id: 'share',
    emoji: '2️⃣',
    title: 'Compartilhe seu cupom',
    description: 'Divulgue no Instagram, WhatsApp ou envie para barbeiros conhecidos.',
  },
  {
    id: 'diamond',
    emoji: '3️⃣',
    title: 'Novo barbeiro contrata o Diamante',
    description: 'Quando alguém contratar o plano Diamante usando seu cupom, ele vira seu parceiro.',
  },
  {
    id: 'free-three',
    emoji: '4️⃣',
    title: '3 parceiros ativos = sistema grátis',
    description: 'Com 3 parceiros ativos sua mensalidade fica grátis enquanto eles permanecerem ativos.',
    highlight: true,
  },
  {
    id: 'profit-four-plus',
    emoji: '5️⃣',
    title: 'Acima de 3 = lucro mensal',
    description: `A partir do 4º parceiro ativo você começa a lucrar R$${PARTNER_REFERRAL_COMMISSION_BRL}/mês por parceiro.`,
  },
];

export function calcPartnerReferralMonthlyProfit(activeCount: number): number {
  const safeCount = Math.max(0, Math.floor(activeCount));
  return Math.max(0, safeCount - PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD) * PARTNER_REFERRAL_COMMISSION_BRL;
}

export function formatPartnerReferralProfitLabel(activeCount: number): string {
  const profit = calcPartnerReferralMonthlyProfit(activeCount);
  if (activeCount <= PARTNER_REFERRAL_FREE_ACTIVE_THRESHOLD) {
    return 'Sistema grátis';
  }
  return `R$${profit.toLocaleString('pt-BR')}/mês`;
}

export const PARTNER_REFERRAL_MAX_ACTIVE_PARTNERS = 5000;

export const PARTNER_REFERRAL_EARNINGS_SCENARIOS: PartnerReferralEarningsScenario[] = [
  { activeCount: 3, label: '3 parceiros', profitLabel: 'Sistema grátis', isFree: true },
  { activeCount: 5, label: '5 parceiros', profitLabel: formatPartnerReferralProfitLabel(5) },
  { activeCount: 10, label: '10 parceiros', profitLabel: formatPartnerReferralProfitLabel(10) },
  { activeCount: 50, label: '50 parceiros', profitLabel: formatPartnerReferralProfitLabel(50) },
  { activeCount: 100, label: '100 parceiros', profitLabel: formatPartnerReferralProfitLabel(100) },
  {
    activeCount: 1000,
    label: '1000 parceiros',
    profitLabel: `Aproximadamente ${formatPartnerReferralProfitLabel(1000)}`,
  },
  {
    activeCount: PARTNER_REFERRAL_MAX_ACTIVE_PARTNERS,
    label: '5000 parceiros',
    profitLabel: `Aproximadamente ${formatPartnerReferralProfitLabel(PARTNER_REFERRAL_MAX_ACTIVE_PARTNERS)}`,
    isMax: true,
  },
];

export const PARTNER_REFERRAL_HOW_IT_WORKS_MILESTONE_PREVIEW = [
  { threshold: 3, emoji: '🎯', title: 'Sistema grátis' },
  { threshold: 100, emoji: '🏅', title: 'Pulseira AF' },
  { threshold: 200, emoji: '🏆', title: 'Placa 10K' },
  { threshold: 500, emoji: '💎', title: 'Elite AF' },
  { threshold: 1000, emoji: '👑', title: 'Hall dos grandes parceiros' },
];

export const PARTNER_REFERRAL_PROFIT_EXAMPLES = [4, 10, 50, 100].map((count) => ({
  activeCount: count,
  profitLabel: formatPartnerReferralProfitLabel(count),
}));
