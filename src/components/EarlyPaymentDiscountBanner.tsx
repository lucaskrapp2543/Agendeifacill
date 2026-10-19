import { Flame } from 'lucide-react';
import {
  EARLY_PAYMENT_DISCOUNT_PERCENT,
  computeEarlyPaymentDiscount,
  formatDateOnlyBR,
  getEarlyPaymentDeadline,
  parseDateOnlyParts,
} from '../lib/earlyPaymentDiscount';

interface EarlyPaymentDiscountBannerProps {
  /** Valor da mensalidade (R$). 0 = não conhecido: a faixa fala só em "15% de desconto". */
  amountBrl: number;
  /** Vencimento como vem do banco (AAAA-MM-DD...). */
  dueDateRaw: string;
  /** Dias até o vencimento (1 a 3). */
  daysUntilDue: number;
  onPay: () => void;
  compact?: boolean;
}

const formatCents = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

/**
 * 🔥 Faixa "Pague adiantado e ganhe 15%": aparece de 3 a 1 dia antes do vencimento,
 * no topo de Meus Agendamentos e no cabeçalho das outras abas. Só abre o modal de
 * pagamento — quem aplica o desconto de verdade é o servidor.
 */
export function EarlyPaymentDiscountBanner({
  amountBrl,
  dueDateRaw,
  daysUntilDue,
  onPay,
  compact = false,
}: EarlyPaymentDiscountBannerProps) {
  const amountCents = Math.round(Math.max(0, Number(amountBrl) || 0) * 100);
  const preview = amountCents > 0 ? computeEarlyPaymentDiscount(amountCents) : null;
  const dueLabel = formatDateOnlyBR(parseDateOnlyParts(dueDateRaw));
  const deadlineLabel = daysUntilDue === 1 ? 'hoje' : formatDateOnlyBR(getEarlyPaymentDeadline(dueDateRaw));
  const whenLabel = daysUntilDue === 1 ? 'Seu sistema vence amanhã' : `Faltam ${daysUntilDue} dias para o vencimento`;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 shadow-lg shadow-amber-900/20 bg-[#1a1408]">
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black shadow">
            <Flame className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-200/90">
              {whenLabel} · oferta por tempo limitado
            </p>
            <h3 className="text-base font-black leading-tight text-white sm:text-lg">
              Pague adiantado e ganhe {EARLY_PAYMENT_DISCOUNT_PERCENT}% de desconto
            </h3>
            <p className="mt-1 text-sm text-amber-50/90">
              {preview ? (
                <>
                  Pagando hoje, sua mensalidade sai por{' '}
                  <strong className="text-base text-emerald-300">{formatCents(preview.finalCents)}</strong> em vez de{' '}
                  <span className="text-amber-100/70 line-through">{formatCents(amountCents)}</span> — você economiza{' '}
                  <strong className="text-white">{formatCents(preview.discountCents)}</strong>.
                </>
              ) : (
                <>Pagando hoje você ganha {EARLY_PAYMENT_DISCOUNT_PERCENT}% de desconto na sua mensalidade.</>
              )}
            </p>
            <p className="mt-1 text-[11px] text-amber-100/75">
              Vale só até {deadlineLabel} e só no PIX. No dia {dueLabel} volta ao valor cheio. E você não perde nenhum dia:
              o próximo vencimento conta a partir de {dueLabel}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onPay}
          className="shrink-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 text-sm font-black text-black shadow-lg transition-colors hover:from-amber-300 hover:to-orange-400"
        >
          💳 Pagar agora com {EARLY_PAYMENT_DISCOUNT_PERCENT}% OFF
        </button>
      </div>
    </div>
  );
}

export default EarlyPaymentDiscountBanner;
