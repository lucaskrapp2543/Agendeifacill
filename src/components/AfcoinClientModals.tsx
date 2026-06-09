import { Gift, Scissors, Sparkles, Trophy, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { AFCOIN_EARN_HINT, AFCOIN_REDEEM_THRESHOLD } from '../utils/afcoin';
import {
  AFCOIN_POINTS_LOCAL,
  AFCOIN_POINTS_ONLINE,
  AFCOIN_PROGRAM_START_DATE,
} from '../utils/appointmentPayment';

type AfcoinHowItWorksModalProps = {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  maxPerShop: number;
};

type AfcoinUseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  maxPerShop: number;
  missing: number;
  canUse: boolean;
  establishmentName?: string | null;
};

const benefitCards = [
  {
    icon: Gift,
    title: 'Benefícios exclusivos na barbearia',
    text: `Junte ${AFCOIN_REDEEM_THRESHOLD.toLocaleString('pt-BR')} AFCoins em uma barbearia e desbloqueie vantagens especiais — descontos, brindes e surpresas no seu próximo agendamento.`,
    accent: '#E6C78B',
  },
  {
    icon: Scissors,
    title: 'Concorra a corte 100% grátis',
    text: 'Quanto mais você acumula, mais chances de ganhar um corte completo sem pagar nada.',
    accent: '#4ADE80',
  },
  {
    icon: Sparkles,
    title: 'Produtos da barbearia',
    text: 'Pomadas, kits e produtos exclusivos podem ser resgatados com suas moedas em parceiros selecionados.',
    accent: '#60A5FA',
  },
  {
    icon: Users,
    title: 'Corte amigo',
    text: 'Indique amigos, agende junto e desbloqueie benefícios especiais para você e para quem você convidar.',
    accent: '#F472B6',
  },
  {
    icon: Trophy,
    title: 'Vantagens exclusivas',
    text: 'Prioridade em horários, surpresas e campanhas só para quem acumula AFCoins no Agendei Fácil.',
    accent: '#FBBF24',
  },
];

const earnSteps = [
  { points: '+5', label: 'Informar telefone no agendamento' },
  { points: '+10', label: 'Confirmar data e horário' },
  { points: `+${AFCOIN_POINTS_LOCAL}`, label: 'Pagar no estabelecimento (5+10+3)' },
  { points: `+${AFCOIN_POINTS_ONLINE}`, label: 'Pagar online via PIX ou cartão (5+10+45)' },
];

function ModalShell({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        style={{
          background: 'linear-gradient(165deg, rgba(230,199,139,0.14) 0%, rgba(10,10,11,0.98) 28%, #0A0A0B 100%)',
          border: '1px solid rgba(230,199,139,0.32)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(230,199,139,0.08)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-white/8 bg-[#0A0A0B]/95 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/afcoin.png"
              alt=""
              className="w-11 h-11 object-contain shrink-0"
              style={{ filter: 'drop-shadow(0 0 10px rgba(230,199,139,0.5))' }}
            />
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">{title}</h2>
              {subtitle ? (
                <p className="text-xs sm:text-sm text-[#E6C78B]/85 mt-0.5">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-xl hover:bg-white/10 transition-colors text-white/70 hover:text-white"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function AfcoinHowItWorksModal({ isOpen, onClose, balance, maxPerShop }: AfcoinHowItWorksModalProps) {
  const progress = Math.min(100, Math.round((maxPerShop / AFCOIN_REDEEM_THRESHOLD) * 100));

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Como funcionam os AFCoins"
      subtitle="Programa de benefícios Agendei Fácil"
    >
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(230,199,139,0.16) 0%, rgba(255,255,255,0.03) 100%)',
          border: '1px solid rgba(230,199,139,0.28)',
        }}
      >
        <p className="text-sm text-white/85 leading-relaxed">
          Cada agendamento em barbearias parceiras gera moedas. Acumule, desbloqueie benefícios e participe de
          campanhas exclusivas — válido para agendamentos a partir de{' '}
          <strong className="text-[#E6C78B]">
            {AFCOIN_PROGRAM_START_DATE.split('-').reverse().join('/')}
          </strong>
          .
        </p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#E6C78B]/80 font-semibold">Seu saldo agora</p>
            <p className="text-3xl font-black text-white">{balance}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-white/55">Meta por barbearia</p>
            <p className="text-sm font-bold text-[#E6C78B]">{maxPerShop} / {AFCOIN_REDEEM_THRESHOLD}</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #B8944A 0%, #E6C78B 100%)',
            }}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#E6C78B] mb-2">Como ganhar moedas</p>
        <div className="space-y-2">
          {earnSteps.map((step) => (
            <div
              key={step.label}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-sm font-black text-[#E6C78B] w-10 shrink-0">{step.points}</span>
              <span className="text-sm text-white/85">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#E6C78B] mb-2">O que você pode ganhar</p>
        <div className="space-y-2.5">
          {benefitCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="flex gap-3 rounded-2xl p-3.5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${card.accent}22`, border: `1px solid ${card.accent}44` }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.accent }} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">{card.title}</p>
                  <p className="text-xs text-white/65 mt-1 leading-relaxed">{card.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[11px] text-white/45 leading-relaxed text-center pt-1">
        {AFCOIN_EARN_HINT} Benefícios válidos em barbearias com Mercado Pago conectado.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="w-full py-3.5 rounded-2xl font-extrabold text-[#0B0B0B] transition-all hover:brightness-110 active:scale-[0.99]"
        style={{
          background: 'linear-gradient(180deg, #E6C78B 0%, #B8944A 100%)',
          boxShadow: '0 8px 24px rgba(230,199,139,0.25)',
        }}
      >
        Entendi, vou acumular!
      </button>
    </ModalShell>
  );
}

export function AfcoinUseModal({
  isOpen,
  onClose,
  balance,
  maxPerShop,
  missing,
  canUse,
  establishmentName,
}: AfcoinUseModalProps) {
  const progress = Math.min(100, Math.round((maxPerShop / AFCOIN_REDEEM_THRESHOLD) * 100));

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={canUse ? 'Benefícios liberados!' : 'Seus benefícios AFCoins'}
      subtitle={canUse ? 'Você atingiu a meta nesta barbearia' : `Faltam ${missing} moedas para desbloquear benefícios`}
    >
      {canUse ? (
        <>
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(74,222,128,0.15) 0%, rgba(230,199,139,0.12) 100%)',
              border: '1px solid rgba(74,222,128,0.35)',
            }}
          >
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-lg font-black text-white">
              Parabéns! Você tem {maxPerShop} AFCoins
            </p>
            {establishmentName ? (
              <p className="text-sm text-[#E6C78B] mt-1 font-semibold">em {establishmentName}</p>
            ) : null}
            <p className="text-sm text-white/75 mt-3 leading-relaxed">
              Você já pode usar <strong className="text-[#4ADE80]">benefícios exclusivos</strong> no próximo
              agendamento nesta barbearia — descontos, cortes grátis, produtos e muito mais. Em breve o resgate
              estará disponível direto na hora de agendar.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {['Descontos', 'Corte grátis', 'Produtos', 'Corte amigo'].map((label) => (
              <div
                key={label}
                className="rounded-xl px-3 py-3 text-center text-sm font-bold text-white/90"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(230,199,139,0.2)' }}
              >
                {label}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div
            className="rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/55">Saldo total</p>
                <p className="text-3xl font-black text-white">{balance}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-white/55">Melhor barbearia</p>
                <p className="text-xl font-black text-[#E6C78B]">{maxPerShop}</p>
              </div>
            </div>

            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #B8944A 0%, #E6C78B 100%)',
                }}
              />
            </div>
            <p className="text-sm text-white/70 text-center">
              Faltam <strong className="text-[#E6C78B]">{missing} AFCoins</strong> para desbloquear{' '}
              <strong className="text-white">benefícios exclusivos</strong> em uma barbearia.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#E6C78B]">Como chegar mais rápido</p>
            <div
              className="rounded-xl px-3 py-2.5 text-sm text-white/80"
              style={{ background: 'rgba(230,199,139,0.08)', border: '1px solid rgba(230,199,139,0.2)' }}
            >
              📍 Pagar no estabelecimento = <strong className="text-[#E6C78B]">{AFCOIN_POINTS_LOCAL} moedas</strong> por agendamento
            </div>
            <div
              className="rounded-xl px-3 py-2.5 text-sm text-white/80"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              💳 PIX ou cartão pelo sistema = <strong className="text-[#4ADE80]">{AFCOIN_POINTS_ONLINE} moedas</strong> por agendamento
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className={`w-full py-3.5 rounded-2xl font-extrabold transition-all active:scale-[0.99] ${
          canUse
            ? 'text-[#0B0B0B] hover:brightness-110'
            : 'text-white hover:bg-white/12'
        }`}
        style={
          canUse
            ? {
                background: 'linear-gradient(180deg, #E6C78B 0%, #B8944A 100%)',
                boxShadow: '0 8px 24px rgba(230,199,139,0.25)',
              }
            : {
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }
        }
      >
        {canUse ? 'Show! Vou agendar de novo' : 'Continuar acumulando'}
      </button>
    </ModalShell>
  );
}
