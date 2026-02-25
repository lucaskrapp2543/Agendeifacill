import React from 'react';
import { Crown, ExternalLink, Instagram, X } from 'lucide-react';

export interface TopMonthlyWinnerCardData {
  establishmentId: string;
  establishmentName: string;
  establishmentCode?: string;
  appointmentCount: number;
  instagramUrl?: string;
  imageUrl?: string;
  isCurrentEstablishment?: boolean;
}

interface TopMonthlyWinnerCardProps {
  winner: TopMonthlyWinnerCardData;
  className?: string;
  onDismiss?: () => void;
}

export const TopMonthlyWinnerCard: React.FC<TopMonthlyWinnerCardProps> = ({ winner, className = '', onDismiss }) => {
  const content = (
    <div
      className={`relative w-full rounded-2xl border border-amber-300/60 bg-gradient-to-r from-[#1e1300] via-[#2a1a00] to-[#0f172a] shadow-[0_12px_40px_rgba(251,191,36,0.28)] p-3 sm:p-5 ${className}`}
    >
      {onDismiss && (
        <button
          type="button"
          aria-label="Ocultar destaque até o próximo mês"
          title="Não quero ver isso até o próximo mês"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-md border border-white/20 bg-black/20 hover:bg-black/35 text-white/85 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 pr-10 sm:pr-0">
        <div className="relative shrink-0">
          {winner.imageUrl ? (
            <img
              src={winner.imageUrl}
              alt={`Logo ${winner.establishmentName}`}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-amber-300/80 shadow-lg"
            />
          ) : (
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border-2 border-amber-300/80 bg-amber-200/20 flex items-center justify-center">
              <Crown className="w-7 h-7 sm:w-8 sm:h-8 text-amber-300" />
            </div>
          )}
          <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black uppercase tracking-wide shadow-md">
            Top 1
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.15em] text-amber-200/90 font-bold">
            Top 1 Agendei Fácil
          </p>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <Crown className="w-4 h-4 text-amber-300 shrink-0" />
            <h3 className="text-[17px] leading-5 sm:text-lg font-extrabold text-white break-words">
              {winner.establishmentName}
              {winner.establishmentCode ? ` (${winner.establishmentCode})` : ''}
            </h3>
          </div>
          <p className="mt-1 text-[13px] leading-4 sm:text-sm text-amber-100/90 font-semibold">
            {winner.appointmentCount} agendamentos no mês atual
            {winner.isCurrentEstablishment ? ' • É VOCÊ 👊' : ''}
          </p>
        </div>

        {winner.instagramUrl && (
          <a
            href={winner.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir Instagram do Top 1"
            title="Abrir Instagram do Top 1"
            onClick={(e) => e.stopPropagation()}
            className="self-start sm:shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-pink-200 transition-colors text-xs sm:text-sm"
          >
            <Instagram className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </a>
        )}
      </div>
    </div>
  );

  return content;
};

