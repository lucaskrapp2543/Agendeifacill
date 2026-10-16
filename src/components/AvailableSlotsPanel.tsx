import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatSlotDuration, slotDayLabel, useAvailableSlots, type SlotMatch } from '../hooks/useAvailableSlots';
import { storagePublicUrlForBrowser, fallbackToOriginalStorageImage } from '../utils/storagePublicUrl';
import type { SimpleProfessional, SimpleService } from '../utils/bookingSimpleEngine';

const brl = (value: number) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const initialsOf = (name: string) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || '?';

const nextDayButtonLabel = (dateStr: string) => {
  const label = slotDayLabel(dateStr);
  return label === 'Amanhã' ? 'Ver amanhã' : `Ver ${label}`;
};

/**
 * Grade de vagas: um dia embaixo do outro, horários livres em VERDE
 * (mesmo visual de "Horários disponíveis" do barbeiro) e "Ver amanhã" no fim.
 */
export function SlotDaysGrid({
  days,
  timesByDay,
  nextDay,
  onShowNextDay,
  onPickTime,
  disabled = false,
}: {
  days: string[];
  timesByDay: Record<string, { ready: boolean; times: string[] }>;
  nextDay: string | null;
  onShowNextDay: () => void;
  onPickTime: (date: string, time: string) => void;
  disabled?: boolean;
}) {
  if (days.length === 0) {
    return <p className="text-sm text-gray-300">Não temos dias abertos para agendamento nos próximos dias 😕</p>;
  }
  return (
    <div className="space-y-4 text-white">
      {days.map((date) => {
        const day = timesByDay[date];
        return (
          <div key={date}>
            <p className="mb-2 text-sm font-extrabold text-white">
              {slotDayLabel(date)}
              <span className="ml-1.5 font-normal text-gray-400">{date.split('-').reverse().slice(0, 2).join('/')}</span>
            </p>
            {!day || !day.ready ? (
              <p className="text-sm text-gray-400">Buscando vagas… 🔎</p>
            ) : day.times.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-300">
                Sem vagas livres neste dia 😕
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {day.times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPickTime(date, time)}
                    className="min-h-[44px] rounded-xl bg-green-600 text-[15px] font-bold text-white shadow-sm transition-all hover:bg-green-500 active:scale-[0.97] disabled:opacity-50"
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {nextDay && (
        <button
          type="button"
          disabled={disabled}
          onClick={onShowNextDay}
          className="w-full rounded-xl border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm font-bold text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-50"
        >
          {nextDayButtonLabel(nextDay)} ›
        </button>
      )}
    </div>
  );
}

type Stage = 'times' | 'services' | 'professionals';

/**
 * "👀 Ver vagas" completo (página completa e /af): dia/horário → serviço → profissional.
 * Ao terminar chama onPick com tudo escolhido; a página segue para nome/WhatsApp/resumo.
 */
export function AvailableSlotsPanel({
  establishment,
  professionals,
  servicesForProfessional,
  forceFullDay = false,
  closedTimeEnabled = false,
  variant = 'inline',
  onPick,
  onClose,
}: {
  establishment: any;
  professionals: SimpleProfessional[];
  servicesForProfessional: (pro: SimpleProfessional) => SimpleService[];
  forceFullDay?: boolean;
  closedTimeEnabled?: boolean;
  variant?: 'inline' | 'modal';
  onPick: (pick: { date: string; time: string; professional: SimpleProfessional; service: SimpleService }) => void;
  onClose: () => void;
}) {
  const slots = useAvailableSlots({
    enabled: true,
    establishment,
    professionals,
    servicesForProfessional,
    forceFullDay,
    closedTimeEnabled,
  });
  const [stage, setStage] = useState<Stage>('times');
  const [serviceKey, setServiceKey] = useState('');
  // Serviço que não cabe no horário escolhido: mostra os horários do dia em que ele cabe.
  const [noFitKey, setNoFitKey] = useState('');

  useEffect(() => {
    slots.start();
    // só ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = slots.pick;
  const group = slots.serviceOptions.options.find((g) => g.key === serviceKey) || null;

  const finish = (match: SlotMatch) => {
    if (!pick) return;
    onPick({ date: pick.date, time: pick.time, professional: match.pro, service: match.service });
  };

  const backToTimes = () => {
    slots.setPick(null);
    setServiceKey('');
    setStage('times');
  };

  const content = (
    <div className="text-white">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold text-white">👀 Vagas livres</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {stage === 'times'
              ? 'Toque no horário que você quer.'
              : pick
                ? `${slotDayLabel(pick.date)} às ${pick.time}`
                : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-gray-300 hover:bg-white/10 hover:text-white"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {stage === 'times' && (
        <SlotDaysGrid
          days={slots.days}
          timesByDay={slots.timesByDay}
          nextDay={slots.nextDay}
          onShowNextDay={slots.showNextDay}
          onPickTime={(date, time) => {
            slots.setPick({ date, time });
            setServiceKey('');
            setNoFitKey('');
            setStage('services');
          }}
        />
      )}

      {stage === 'services' && (() => {
        const fitting = slots.serviceOptions.options.filter((option) => option.fits);
        const notFitting = slots.serviceOptions.options.filter((option) => !option.fits);
        return (
          <div className="space-y-2.5">
            <p className="text-base font-bold text-white">Qual serviço você quer?</p>
            {!slots.serviceOptions.ready ? (
              <p className="text-sm text-gray-400">Vendo os serviços que cabem nesse horário… 🔎</p>
            ) : fitting.length === 0 && notFitting.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-300">
                Poxa, esse horário acabou de ser ocupado 😕 Escolha outro.
              </p>
            ) : (
              <>
                {fitting.length === 0 && (
                  <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
                    Nenhum serviço cabe inteiro às {pick?.time}. Toque no serviço para ver os horários em que ele cabe 👇
                  </p>
                )}
                {fitting.map((option) => {
                  const minPrice = Math.min(...option.prices);
                  const maxPrice = Math.max(...option.prices);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => {
                        setServiceKey(option.key);
                        if (option.matches.length === 1) {
                          finish(option.matches[0]);
                          return;
                        }
                        setStage('professionals');
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.09]"
                    >
                      <span className="min-w-0">
                        <span className="block font-bold text-white">{option.name}</span>
                        <span className="block text-xs text-gray-400">⏱ {formatSlotDuration(option.duration)}</span>
                      </span>
                      <span className="shrink-0 text-sm text-gray-300">
                        {minPrice !== maxPrice ? `a partir de ${brl(minPrice)}` : brl(minPrice)}
                      </span>
                    </button>
                  );
                })}
                {notFitting.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Não cabem às {pick?.time}</p>
                    {notFitting.map((option) => {
                      const open = noFitKey === option.key;
                      return (
                        <div key={option.key} className="rounded-2xl border border-white/10 bg-black/20">
                          <button
                            type="button"
                            onClick={() => setNoFitKey(open ? '' : option.key)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                          >
                            <span className="min-w-0">
                              <span className="block font-semibold text-gray-300">{option.name}</span>
                              <span className="block text-xs text-gray-500">⏱ {formatSlotDuration(option.duration)} · não cabe nesse horário</span>
                            </span>
                            <span className="shrink-0 text-xs font-bold text-green-300">{open ? 'Fechar' : 'Ver horários'}</span>
                          </button>
                          {open && (
                            <div className="border-t border-white/10 px-4 py-3">
                              <p className="text-sm text-gray-200">
                                ⏱ <strong className="text-white">{option.name}</strong> leva {formatSlotDuration(option.duration)} e não cabe às {pick?.time}.
                              </p>
                              {option.suggestions.length > 0 ? (
                                <>
                                  <p className="mt-2 text-xs text-gray-400">
                                    Horários de {pick ? slotDayLabel(pick.date).toLowerCase() : ''} em que ele cabe:
                                  </p>
                                  <div className="mt-2 grid grid-cols-4 gap-2">
                                    {option.suggestions.map((time) => (
                                      <button
                                        key={time}
                                        type="button"
                                        onClick={() => {
                                          if (!pick) return;
                                          slots.setPick({ date: pick.date, time });
                                          setServiceKey(option.key);
                                          setNoFitKey('');
                                          setStage('professionals');
                                        }}
                                        className="min-h-[40px] rounded-xl bg-green-600 text-sm font-bold text-white hover:bg-green-500"
                                      >
                                        {time}
                                      </button>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <p className="mt-2 text-xs text-gray-400">
                                  Nesse dia ele não cabe mais 😕 Toque em "Escolher outro horário" e veja outro dia.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            <button type="button" onClick={backToTimes} className="pt-1 text-sm font-semibold text-gray-400 underline underline-offset-4 hover:text-white">
              ‹ Escolher outro horário
            </button>
          </div>
        );
      })()}

      {stage === 'professionals' && (
        <div className="space-y-2.5">
          <p className="text-base font-bold text-white">Com quem você prefere?</p>
          {!slots.serviceOptions.ready ? (
            <p className="text-sm text-gray-400">Vendo quem está livre… 🔎</p>
          ) : !group || group.matches.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-gray-300">
              Poxa, esse horário acabou de ser ocupado 😕 Escolha outro.
            </p>
          ) : (
            group.matches.map((match) => (
              <button
                key={match.pro.id}
                type="button"
                onClick={() => finish(match)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] p-2.5 text-left transition-colors hover:bg-white/[0.09]"
              >
                {match.pro.photo_url ? (
                  <img
                    src={storagePublicUrlForBrowser(match.pro.photo_url, 'avatar')}
                    alt={match.pro.name}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                    onError={(e) => {
                      fallbackToOriginalStorageImage(e.currentTarget);
                    }}
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-700 font-bold text-white">
                    {initialsOf(match.pro.name)}
                  </span>
                )}
                <span className="flex-1 font-bold text-white">{match.pro.name}</span>
                <span className="shrink-0 text-sm text-gray-300">{brl(Number(match.service.price) || 0)}</span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setStage('services')}
            className="pt-1 text-sm font-semibold text-gray-400 underline underline-offset-4 hover:text-white"
          >
            ‹ Trocar o serviço
          </button>
        </div>
      )}

      {slots.probesElement}
    </div>
  );

  if (variant === 'inline') {
    return <div className="w-full rounded-3xl border border-white/10 bg-[#141517] p-4 sm:p-5">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#111214] p-4 shadow-2xl sm:p-5">
        {content}
      </div>
    </div>
  );
}

export default AvailableSlotsPanel;
