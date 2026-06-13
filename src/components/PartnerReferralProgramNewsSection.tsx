import { Bell } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchPartnerReferralProgramNews,
  formatPartnerReferralNotificationDate,
  markPartnerReferralProgramNewsRead,
  type PartnerReferralNotificationRow,
} from '../lib/partnerReferralProgramNews';

type PartnerReferralProgramNewsSectionProps = {
  establishmentId?: string | null;
  variant?: 'default' | 'ganhe-dinheiro';
};

const notificationToneClass = (type: PartnerReferralNotificationRow['notificationType'], isRead: boolean) => {
  if (isRead) return 'border-gray-200 bg-gray-50/80';
  if (type === 'referral_inactive') return 'border-amber-300 bg-amber-50/90';
  if (type === 'started_earning') return 'border-emerald-300 bg-emerald-50/90';
  if (type === 'free_monthly_unlocked') return 'border-orange-300 bg-orange-50/90';
  return 'border-blue-300 bg-blue-50/90';
};

export const PartnerReferralProgramNewsSection: React.FC<PartnerReferralProgramNewsSectionProps> = ({
  establishmentId,
  variant = 'default',
}) => {
  const [items, setItems] = useState<PartnerReferralNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  const loadNews = useCallback(async () => {
    const id = String(establishmentId || '').trim();
    if (!id) {
      setItems([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchPartnerReferralProgramNews(id);
      setItems(result.items);
      setUnreadCount(result.unreadCount);
    } finally {
      setIsLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void loadNews();
  }, [loadNews]);

  const handleMarkAllRead = async () => {
    const id = String(establishmentId || '').trim();
    if (!id || unreadCount === 0) return;

    setIsMarkingRead(true);
    try {
      const result = await markPartnerReferralProgramNewsRead(id);
      if (result.ok) {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
      }
    } finally {
      setIsMarkingRead(false);
    }
  };

  const isDark = variant === 'ganhe-dinheiro';

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${
        isDark
          ? 'border-white/10 bg-white/[0.03]'
          : 'border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-violet-50 shadow-lg'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="relative w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-md">
            <Bell className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h3 className={`text-xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              🔔 Novidades do Programa
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              Avisos exclusivos do programa de indicações.
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={isMarkingRead}
            onClick={() => void handleMarkAllRead()}
            className={`text-xs font-bold disabled:opacity-50 ${
              isDark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-700 hover:text-indigo-900'
            }`}
          >
            {isMarkingRead ? 'Marcando...' : 'Marcar todas como lidas'}
          </button>
        )}
      </div>

      {isLoading ? (
        <p className={`text-sm text-center py-4 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
          Carregando novidades...
        </p>
      ) : items.length === 0 ? (
        <div
          className={`rounded-xl border border-dashed p-6 text-center text-sm ${
            isDark ? 'border-white/15 bg-black/20 text-white/50' : 'border-indigo-200 bg-white/70 text-gray-600'
          }`}
        >
          Nenhuma novidade ainda. Quando houver indicações ou marcos, aparecerão aqui.
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition-colors ${
                isDark
                  ? item.isRead
                    ? 'border-white/10 bg-black/20'
                    : 'border-indigo-400/40 bg-indigo-500/10'
                  : notificationToneClass(item.notificationType, item.isRead)
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'} ${item.isRead ? 'opacity-80' : ''}`}>
                  {item.title}
                </p>
                {!item.isRead && (
                  <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    Nova
                  </span>
                )}
              </div>
              <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-white/75' : 'text-gray-700'}`}>
                {item.message}
              </p>
              <p className={`mt-2 text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                {formatPartnerReferralNotificationDate(item.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
