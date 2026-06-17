import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Crown,
  Search,
  Sparkles,
  Star,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';

export const ReservarModalFrame: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, onClose, children }) => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10020] p-3 sm:p-4">
    <div className="bg-[#121314] rounded-2xl shadow-2xl shadow-black/60 max-w-2xl w-full max-h-[90dvh] overflow-hidden flex flex-col border border-gray-800/80 isolation-isolate">
      <div className="relative px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-gray-800/80 bg-[#1a1b1c] flex-shrink-0">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            {icon && (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight">{title}</h2>
              {subtitle && <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1 leading-snug">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="overflow-y-auto overscroll-contain p-3 sm:p-6 max-h-[calc(90dvh-5.5rem)] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-gray-100 [&_.text-gray-900]:text-gray-100 [&_.text-gray-800]:text-gray-100 [&_.text-gray-700]:text-gray-300 [&_.text-gray-600]:text-gray-400 [&_.text-gray-500]:text-gray-500 [&_input:not([type=checkbox]):not([type=radio])]:bg-[#1a1b1c] [&_input:not([type=checkbox]):not([type=radio])]:border-gray-700 [&_input:not([type=checkbox]):not([type=radio])]:text-white [&_select]:bg-[#1a1b1c] [&_select]:border-gray-700 [&_select]:text-white [&_.bg-white]:bg-[#1a1b1c] [&_.bg-gray-50]:bg-[#1a1b1c]/80 [&_.bg-gray-100]:bg-[#252628] [&_.border-gray-300]:border-gray-700 [&_.border-gray-200]:border-gray-800 [&_.hover\\:bg-gray-50:hover]:bg-[#252628] [&_.hover\\:border-black:hover]:border-gray-500">
        {children}
      </div>
    </div>
  </div>
);

export const ReservarStepHeader: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
}> = ({ title, subtitle, icon, onBack, backLabel = 'Voltar' }) => (
  <div className="flex items-start justify-between gap-3 mb-5">
    <div className="min-w-0">
      <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
        {icon}
        <span>{title}</span>
      </h3>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors flex-shrink-0 px-2 py-1 rounded-lg hover:bg-white/5"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>
    )}
  </div>
);

export const ReservarSearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accent?: 'blue' | 'amber';
}> = ({ value, onChange, placeholder, accent = 'blue' }) => {
  const ring = accent === 'amber' ? 'focus:ring-amber-500/40 focus:border-amber-500/50' : 'focus:ring-blue-500/40 focus:border-blue-500/50';
  return (
    <div className="relative mb-4">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pl-10 pr-4 py-2.5 bg-[#1a1b1c] border border-gray-700 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 ${ring}`}
      />
    </div>
  );
};

export const SubscriberFlowBanner: React.FC<{ planName?: string; clientName?: string }> = ({
  planName,
  clientName,
}) => (
  <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-950/50 to-purple-950/30 border border-amber-500/30">
    <Star className="h-4 w-4 text-amber-400 flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-sm font-semibold text-amber-100">
        {clientName ? `Assinante: ${clientName}` : 'Atendimento de assinatura'}
      </p>
      {planName && <p className="text-xs text-amber-200/80 truncate">{planName}</p>}
    </div>
  </div>
);

export type ReservarSubscriberServiceOption = {
  id?: string | null;
  name: string;
  duration: number;
  limit: number;
};

export const ReservarSubscriberServicesSection: React.FC<{
  subscriptions: Array<{ id: string; name: string }>;
  offeredBySubscription: Record<string, ReservarSubscriberServiceOption[]>;
  formatDuration: (minutes: number) => string;
  onSelectService: (subscription: { id: string; name: string }, service: ReservarSubscriberServiceOption) => void;
  clientName?: string;
  emptySearch?: boolean;
}> = ({ subscriptions, offeredBySubscription, formatDuration, onSelectService, clientName, emptySearch }) => {
  if (subscriptions.length === 0) {
    if (emptySearch) {
      return (
        <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3">
          <p className="text-sm text-amber-200/80">Nenhuma assinatura encontrada para essa busca.</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-500/55 bg-gradient-to-br from-amber-950/50 via-amber-950/25 to-[#141516] p-4 shadow-xl shadow-amber-500/15 ring-1 ring-amber-400/25">
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/35 flex items-center justify-center flex-shrink-0">
          <Crown className="h-5 w-5 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400/90">Selecione o serviço do plano</p>
          <h4 className="text-base sm:text-lg font-bold text-amber-50 mt-0.5">
            {clientName ? `Assinatura de ${clientName}` : 'Serviços do assinante'}
          </h4>
          <p className="text-xs text-amber-200/70 mt-1">Estes serviços são gratuitos dentro do ciclo do plano.</p>
        </div>
      </div>

      <div className="space-y-3">
        {subscriptions.map((subscription) => {
          const offered = offeredBySubscription[String(subscription.id)] || [];
          return (
            <div
              key={subscription.id}
              className="rounded-xl border border-amber-500/35 bg-black/20 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 px-0.5">
                <h5 className="font-semibold text-amber-50 truncate">{subscription.name}</h5>
                <span className="text-[10px] uppercase tracking-wide font-bold text-amber-400/90 shrink-0">👑 Plano</span>
              </div>
              {offered.length === 0 ? (
                <p className="text-sm text-amber-200/80 px-0.5">
                  Nenhum serviço configurado neste plano. Edite a assinatura e defina os serviços oferecidos.
                </p>
              ) : (
                <div className="space-y-2">
                  {offered.map((svc) => (
                    <button
                      key={`${subscription.id}-${svc.id || 'noid'}-${svc.name}`}
                      type="button"
                      onClick={() => onSelectService(subscription, svc)}
                      className="group w-full p-4 rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/40 to-[#1a1b1c] hover:border-amber-400/70 hover:from-amber-900/35 transition-all text-left hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/10"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate group-hover:text-amber-50">{svc.name}</p>
                          <p className="text-sm text-amber-200/75 mt-0.5">
                            {formatDuration(svc.duration)} •{' '}
                            <span className="text-amber-300 font-bold">GRATUITO</span>
                            {svc.limit > 0 ? (
                              <span className="text-amber-200/60"> • até {svc.limit} uso(s) no ciclo</span>
                            ) : null}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-amber-600 group-hover:text-amber-300 shrink-0 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

type ChoiceCardVariant = 'known' | 'avulso' | 'subscriber';

export const ReservarChoiceCard: React.FC<{
  variant: ChoiceCardVariant;
  title: string;
  description: string;
  cta: string;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}> = ({ variant, title, description, cta, disabled, disabledHint, onClick }) => {
  const styles: Record<ChoiceCardVariant, { border: string; glow: string; iconBg: string; icon: React.ReactNode }> = {
    known: {
      border: 'border-blue-500/30 hover:border-blue-400/60',
      glow: 'hover:shadow-blue-500/10',
      iconBg: 'bg-blue-500/15 text-blue-300',
      icon: <User className="h-6 w-6 sm:h-7 sm:w-7" />,
    },
    avulso: {
      border: 'border-gray-600/60 hover:border-gray-400/50',
      glow: 'hover:shadow-white/5',
      iconBg: 'bg-gray-500/15 text-gray-200',
      icon: <Zap className="h-6 w-6 sm:h-7 sm:w-7" />,
    },
    subscriber: {
      border: 'border-gray-600/60 hover:border-gray-400/50',
      glow: 'hover:shadow-white/5',
      iconBg: 'bg-amber-500/15 text-amber-300',
      icon: <Star className="h-6 w-6 sm:h-7 sm:w-7" />,
    },
  };

  const s = styles[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group w-full text-left rounded-xl sm:rounded-2xl border bg-gradient-to-br from-[#1a1b1c] to-[#141516] transition-all duration-200 ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-gray-800 p-4'
          : `${s.border} ${s.glow} p-4 sm:p-5 active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:shadow-lg`
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
          {s.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-base sm:text-lg font-bold text-white">{title}</h4>
          <p className="text-xs sm:text-sm text-gray-400 leading-snug mt-0.5 line-clamp-2 sm:line-clamp-none">
            {disabled && disabledHint ? disabledHint : description}
          </p>
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold mt-3 transition-all ${
              disabled ? 'text-gray-500' : 'text-white/70 group-hover:text-white'
            }`}
          >
            {cta}
            {!disabled && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </span>
        </div>
        {!disabled && (
          <ArrowRight className="h-5 w-5 text-gray-500 group-hover:text-white flex-shrink-0 sm:hidden transition-colors" />
        )}
      </div>
    </button>
  );
};

export const ReservarPlanCard: React.FC<{
  name: string;
  priceLabel: string;
  activeCount: number;
  onClick: () => void;
}> = ({ name, priceLabel, activeCount, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full text-left p-4 sm:p-5 rounded-2xl border border-amber-800/40 bg-[#1e1a14] hover:border-amber-600/60 hover:bg-[#231f17] transition-colors duration-200"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 className="font-bold text-white flex items-center gap-2 text-base sm:text-lg">
          <Star className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span className="truncate">{name}</span>
        </h4>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs sm:text-sm text-gray-300">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            {activeCount} cliente{activeCount === 1 ? '' : 's'} ativo{activeCount === 1 ? '' : 's'}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-200">
            <Sparkles className="h-3.5 w-3.5" />
            {priceLabel}
          </span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-amber-400/80 font-bold group-hover:text-amber-300 flex-shrink-0 mt-1">
        Selecionar →
      </span>
    </div>
  </button>
);

export const ReservarKnownClientCard: React.FC<{
  name: string;
  whatsapp: string;
  appointmentCount?: number;
  isSubscriber?: boolean;
  subscriberPlanName?: string;
  onClick: () => void;
}> = ({ name, whatsapp, appointmentCount, isSubscriber, subscriberPlanName, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group w-full text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
      isSubscriber
        ? 'border-amber-500/45 bg-gradient-to-br from-amber-950/40 to-[#141516] hover:border-amber-400/70 hover:from-amber-900/35 hover:shadow-amber-500/15'
        : 'border-gray-700/80 bg-gradient-to-br from-[#1c1d1e] to-[#141516] hover:border-gray-500/80 hover:from-[#252628] hover:to-[#1a1b1c] hover:shadow-black/40'
    }`}
  >
    <div className="flex items-start gap-3">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${
          isSubscriber
            ? 'bg-amber-500/15 border-amber-500/30'
            : 'bg-white/5 border-white/10'
        }`}
      >
        {isSubscriber ? (
          <Crown className="h-5 w-5 text-amber-300" />
        ) : (
          <User className="h-5 w-5 text-gray-400 group-hover:text-gray-200 transition-colors" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-white truncate">{name}</h4>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{whatsapp}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {appointmentCount !== undefined && (
            <span className="text-[11px] text-gray-500">
              {appointmentCount} agendamento{appointmentCount !== 1 ? 's' : ''}
            </span>
          )}
          {isSubscriber && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-200 border border-amber-500/35 font-medium">
              👑 Assinante{subscriberPlanName ? ` • ${subscriberPlanName}` : ''}
            </span>
          )}
        </div>
      </div>
      <ArrowRight
        className={`h-4 w-4 flex-shrink-0 mt-1 transition-colors ${
          isSubscriber ? 'text-amber-600 group-hover:text-amber-300' : 'text-gray-600 group-hover:text-gray-300'
        }`}
      />
    </div>
  </button>
);

export const ReservarSubscriberClientCard: React.FC<{
  name: string;
  whatsapp: string;
  planName?: string;
  lastVisitLabel?: string;
  isFrequent?: boolean;
  onClick: () => void;
}> = ({ name, whatsapp, planName, lastVisitLabel, isFrequent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full text-left p-4 rounded-2xl border border-gray-700/80 bg-gradient-to-br from-[#1c1d1e] to-[#141516] hover:border-amber-500/40 hover:from-amber-950/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30"
  >
    <div className="flex items-start gap-3">
      <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
        <User className="h-5 w-5 text-amber-300" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-white truncate">{name}</h4>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{whatsapp || 'Sem WhatsApp'}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {lastVisitLabel && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-700">
              📅 {lastVisitLabel}
            </span>
          )}
          {isFrequent && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-950/60 text-orange-300 border border-orange-500/30">
              🔥 Cliente frequente
            </span>
          )}
          {planName && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950/60 text-purple-300 border border-purple-500/30">
              🟣 {planName}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-600 group-hover:text-amber-400 transition-colors flex-shrink-0 mt-1" />
    </div>
  </button>
);

export const ReservarEmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
}> = ({ icon, title, description }) => (
  <div className="text-center py-12 px-4 border border-dashed border-gray-700 rounded-2xl bg-[#1a1b1c]/50">
    {icon && <div className="flex justify-center mb-3 opacity-40">{icon}</div>}
    <p className="text-gray-300 font-medium">{title}</p>
    {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
  </div>
);

export const getReservarModalHeader = (
  step: string
): { title: string; subtitle: string; icon: React.ReactNode } => {
  switch (step) {
    case 'subscriber_plan':
      return {
        title: 'Escolher assinatura',
        subtitle: 'Selecione qual assinatura deseja usar neste atendimento.',
        icon: <Star className="h-5 w-5 text-amber-400" />,
      };
    case 'subscriber_client':
      return {
        title: 'Selecionar assinante',
        subtitle: 'Mostrando somente clientes desta assinatura.',
        icon: <Users className="h-5 w-5 text-amber-400" />,
      };
    case 'client':
      return {
        title: 'Selecionar cliente',
        subtitle: 'Escolha um cliente da sua agenda.',
        icon: <User className="h-5 w-5 text-blue-400" />,
      };
    case 'professional':
      return {
        title: 'Escolher profissional',
        subtitle: 'Quem vai realizar este atendimento?',
        icon: <User className="h-5 w-5 text-gray-300" />,
      };
    case 'service':
      return {
        title: 'Escolher serviço',
        subtitle: 'Selecione o serviço desta reserva.',
        icon: <Crown className="h-5 w-5 text-gray-300" />,
      };
    case 'time':
      return {
        title: 'Escolher horário',
        subtitle: 'Defina data e hora do agendamento.',
        icon: <Calendar className="h-5 w-5 text-gray-300" />,
      };
    case 'confirm':
      return {
        title: 'Confirmar reserva',
        subtitle: 'Revise os detalhes antes de finalizar.',
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
      };
    default:
      return {
        title: 'Nova Reserva',
        subtitle: 'Escolha como deseja criar este agendamento.',
        icon: <Calendar className="h-5 w-5 text-white" />,
      };
  }
};

export const formatLastVisitLabel = (dateStr?: string | null): string | undefined => {
  const raw = String(dateStr || '').trim().slice(0, 10);
  if (!raw) return undefined;
  try {
    const visit = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(visit.getTime())) return undefined;
    const now = new Date();
    const diffMs = now.getTime() - visit.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays <= 0) return 'Último atendimento: hoje';
    if (diffDays === 1) return 'Último atendimento: ontem';
    if (diffDays < 60) return `Último atendimento: há ${diffDays} dias`;
    return `Último atendimento: ${visit.toLocaleDateString('pt-BR')}`;
  } catch {
    return undefined;
  }
};
