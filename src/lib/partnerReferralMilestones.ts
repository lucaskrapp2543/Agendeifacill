export type PartnerReferralMilestoneTier =
  | 'starter'
  | 'pulseira'
  | 'placa10k'
  | 'placaElite'
  | 'placa1000'
  | 'placa2000'
  | 'hall';

export type PartnerReferralMilestone = {
  id: PartnerReferralMilestoneTier;
  threshold: number;
  emoji: string;
  title: string;
  subtitle: string;
  estimateLabel?: string;
};

export const PARTNER_REFERRAL_MILESTONES: PartnerReferralMilestone[] = [
  {
    id: 'starter',
    threshold: 3,
    emoji: '✅',
    title: 'Sistema grátis',
    subtitle: 'Mensalidade grátis com 3 clientes ativos',
  },
  {
    id: 'pulseira',
    threshold: 100,
    emoji: '🏅',
    title: 'Pulseira / premiação especial AF',
    subtitle: 'Reconhecimento exclusivo Agendei Fácil',
  },
  {
    id: 'placa10k',
    threshold: 200,
    emoji: '🏆',
    title: 'Placa 10K',
    subtitle: 'Marco de parceiro em ascensão',
  },
  {
    id: 'placaElite',
    threshold: 500,
    emoji: '💎',
    title: 'Placa Elite AF',
    subtitle: 'Elite entre os parceiros do programa',
  },
  {
    id: 'placa1000',
    threshold: 1000,
    emoji: '👑',
    title: 'Placa 1000 parceiros',
    subtitle: 'Estimativa: R$8.000/mês',
    estimateLabel: 'R$8.000/mês',
  },
  {
    id: 'placa2000',
    threshold: 2000,
    emoji: '🚀',
    title: 'Placa 2000 parceiros',
    subtitle: 'Estimativa: R$16.000/mês',
    estimateLabel: 'R$16.000/mês',
  },
  {
    id: 'hall',
    threshold: 5000,
    emoji: '🔥',
    title: 'Hall da Fama Agendei Fácil',
    subtitle: 'Estimativa: R$40.000/mês',
    estimateLabel: 'R$40.000/mês',
  },
];

export type PartnerReferralMilestoneStatus = 'unlocked' | 'next' | 'locked';

export type PartnerReferralMilestoneWithStatus = PartnerReferralMilestone & {
  status: PartnerReferralMilestoneStatus;
};

export type PartnerReferralMilestoneProgress = {
  activeCount: number;
  currentMilestone: PartnerReferralMilestone | null;
  nextMilestone: PartnerReferralMilestone | null;
  remainingToNext: number;
  progressPercent: number;
  progressMessage: string;
  milestones: PartnerReferralMilestoneWithStatus[];
};

export function formatPartnerReferralMilestoneCount(count: number): string {
  return count.toLocaleString('pt-BR');
}

export function buildPartnerReferralMilestoneProgress(activeCount: number): PartnerReferralMilestoneProgress {
  const safeCount = Math.max(0, Math.floor(activeCount));
  const milestones = PARTNER_REFERRAL_MILESTONES;

  let currentMilestone: PartnerReferralMilestone | null = null;
  let nextMilestone: PartnerReferralMilestone | null = null;

  for (const milestone of milestones) {
    if (safeCount >= milestone.threshold) {
      currentMilestone = milestone;
    } else if (!nextMilestone) {
      nextMilestone = milestone;
      break;
    }
  }

  const remainingToNext = nextMilestone ? Math.max(0, nextMilestone.threshold - safeCount) : 0;
  const progressPercent = nextMilestone
    ? Math.min(100, Math.round((safeCount / nextMilestone.threshold) * 100))
    : 100;

  const progressMessage = nextMilestone
    ? `Você está em ${formatPartnerReferralMilestoneCount(safeCount)}/${formatPartnerReferralMilestoneCount(nextMilestone.threshold)} clientes para desbloquear a próxima premiação.`
    : `Parabéns! Você alcançou o topo do programa com ${formatPartnerReferralMilestoneCount(safeCount)} clientes ativos.`;

  const milestonesWithStatus: PartnerReferralMilestoneWithStatus[] = milestones.map((milestone) => {
    if (safeCount >= milestone.threshold) {
      return { ...milestone, status: 'unlocked' };
    }
    if (nextMilestone?.id === milestone.id) {
      return { ...milestone, status: 'next' };
    }
    return { ...milestone, status: 'locked' };
  });

  return {
    activeCount: safeCount,
    currentMilestone,
    nextMilestone,
    remainingToNext,
    progressPercent,
    progressMessage,
    milestones: milestonesWithStatus,
  };
}
