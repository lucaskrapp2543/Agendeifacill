import { useEffect, useMemo, useState } from 'react';
import {
  buildDailyMessageUserKey,
  getDailyMorningMessageForEstablishment,
  getTodayDateKey,
  hasSeenDailyMorningMessage,
  markDailyMorningMessageSeen,
  type DailyMorningMessage,
} from '../lib/dailyMorningMessages';

type DailyMorningMessageModalProps = {
  establishmentId?: string | null;
  userId?: string | null;
  professionalId?: string | null;
  enabled?: boolean;
  blocked?: boolean;
};

export function DailyMorningMessageModal({
  establishmentId,
  userId,
  professionalId,
  enabled = true,
  blocked = false,
}: DailyMorningMessageModalProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<DailyMorningMessage | null>(null);

  const userKey = useMemo(
    () => buildDailyMessageUserKey(userId, professionalId),
    [userId, professionalId]
  );

  const dateKey = useMemo(() => getTodayDateKey(), []);

  useEffect(() => {
    if (!enabled || blocked) {
      setOpen(false);
      return;
    }

    const estId = String(establishmentId || '').trim();
    if (!estId) {
      setOpen(false);
      return;
    }

    try {
      if (hasSeenDailyMorningMessage(estId, userKey, dateKey)) {
        setOpen(false);
        return;
      }

      setMessage(getDailyMorningMessageForEstablishment(estId, dateKey));
      setOpen(true);
    } catch {
      setOpen(false);
    }
  }, [blocked, dateKey, enabled, establishmentId, userKey]);

  const handleClose = () => {
    const estId = String(establishmentId || '').trim();
    if (estId) {
      markDailyMorningMessageSeen(estId, userKey, dateKey);
    }
    setOpen(false);
  };

  if (!open || !message) return null;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-morning-message-title"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-[#1a1428] via-[#12121a] to-[#0b0b10] shadow-2xl shadow-amber-500/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative px-6 pt-7 pb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-orange-500/10 text-3xl shadow-inner shadow-amber-500/10">
            🌅
          </div>

          <h2
            id="daily-morning-message-title"
            className="text-lg font-extrabold tracking-tight text-white"
          >
            Mensagem do Dia
          </h2>

          <blockquote className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
            <p className="text-base font-semibold leading-relaxed text-amber-50">
              “{message.quote}”
            </p>
            {message.reference ? (
              <p className="mt-3 text-sm text-amber-200/75">{message.reference}</p>
            ) : null}
          </blockquote>

          <p className="mt-5 text-sm leading-relaxed text-white/70">
            Que seu dia seja abençoado e produtivo. 💈
          </p>

          <button
            type="button"
            onClick={handleClose}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3.5 text-sm font-extrabold text-black shadow-lg shadow-amber-500/20 transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            Começar o dia
          </button>
        </div>
      </div>
    </div>
  );
}

export default DailyMorningMessageModal;
