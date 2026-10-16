import { format } from 'date-fns';
import { useCallback, useMemo, useRef, useState } from 'react';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import {
  buildBusinessHoursForDate,
  getMinimumAdvanceMinutes,
  loadExistingAppointmentsForDate,
  type SimpleProfessional,
  type SimpleService,
} from '../utils/bookingSimpleEngine';

/**
 * "👀 Ver vagas" (todas as páginas de agendamento: completa, chat e /af).
 *
 * Mostra os horários LIVRES dia a dia (hoje → "Ver amanhã" → "Ver sáb 18/10"…).
 * As vagas saem do MESMO TimeSlotSelector das telas de horário, montado escondido
 * (um por profissional/dia/duração): vaga mostrada = vaga que dá para marcar.
 *
 *  - Vaga do dia: horário em que cabe pelo menos o serviço mais curto de algum profissional.
 *  - Horário escolhido: só os serviços que cabem ali e só quem está livre para eles.
 *
 * Só leitura: não grava nada. A trava do banco continua valendo no final.
 */

const BUSINESS_HOURS_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export type SlotMatch = { pro: SimpleProfessional; service: SimpleService };
export type SlotServiceOption = {
  key: string;
  name: string;
  prices: number[];
  /** Duração (min) do serviço — a maior entre os profissionais, para o aviso "leva 1h". */
  duration: number;
  /** Quem atende este serviço no horário escolhido (vazio = não cabe nesse horário). */
  matches: SlotMatch[];
  /** true = cabe no horário escolhido com pelo menos um profissional. */
  fits: boolean;
  /** Horários do MESMO dia em que esse serviço cabe (os mais próximos do escolhido). */
  suggestions: string[];
};

/** 30 → "30 min", 60 → "1h", 90 → "1h30" */
export const formatSlotDuration = (minutes: number): string => {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest > 0 ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`;
};

const timeToMinutes = (time: string) => {
  const [h, m] = String(time || '0:0').split(':').map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};

const serviceDuration = (service: SimpleService): number => {
  const minutes = Number(service?.duration);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 30;
};

const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();

/** "Hoje" / "Amanhã" / "sáb 18/10" */
export const slotDayLabel = (dateStr: string): string => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
  if (dateStr === today) return 'Hoje';
  if (dateStr === tomorrow) return 'Amanhã';
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = WEEKDAY_SHORT[new Date(y, m - 1, d).getDay()] || '';
  return `${weekday} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

export function useAvailableSlots(params: {
  enabled: boolean;
  establishment: any;
  professionals: SimpleProfessional[];
  servicesForProfessional: (pro: SimpleProfessional) => SimpleService[];
  forceFullDay?: boolean;
  closedTimeEnabled?: boolean;
}) {
  const { enabled, establishment, professionals, servicesForProfessional, forceFullDay = false, closedTimeEnabled = false } = params;
  const [days, setDays] = useState<string[]>([]);
  const [appointmentsByDay, setAppointmentsByDay] = useState<Record<string, any[]>>({});
  const [probeResults, setProbeResults] = useState<Record<string, string[]>>({});
  const [pick, setPick] = useState<{ date: string; time: string } | null>(null);
  const requestIdRef = useRef(0);

  // Dias em que o estabelecimento abre (próximos 60), na ordem.
  const openDays = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 60 && out.length < 30; i++) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + i);
      const dayKey = BUSINESS_HOURS_DAY_KEYS[d.getDay()];
      if (!establishment?.business_hours?.[dayKey]?.enabled) continue;
      out.push(format(d, 'yyyy-MM-dd'));
    }
    return out;
  }, [establishment]);

  const nextDay = useMemo(() => openDays.find((d) => !days.includes(d)) || null, [openDays, days]);

  const loadDay = useCallback(
    async (date: string, requestId: number) => {
      if (!establishment?.id) return;
      let rows: any[] = [];
      try {
        rows = await loadExistingAppointmentsForDate(String(establishment.id), date);
      } catch {
        rows = [];
      }
      if (requestId !== requestIdRef.current) return; // "Ver vagas" foi reaberto: ignora a busca antiga
      setAppointmentsByDay((prev) => (prev[date] ? prev : { ...prev, [date]: rows }));
    },
    [establishment?.id]
  );

  /** Abre (ou reabre) a lista do zero: só o primeiro dia aberto. */
  const start = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setProbeResults({});
    setAppointmentsByDay({});
    setPick(null);
    const first = openDays[0];
    setDays(first ? [first] : []);
    if (first) void loadDay(first, requestId);
  }, [openDays, loadDay]);

  /** "Ver amanhã" / "Ver sáb 18/10": acrescenta o próximo dia aberto embaixo. */
  const showNextDay = useCallback(() => {
    if (!nextDay) return;
    setDays((prev) => (prev.includes(nextDay) ? prev : [...prev, nextDay]));
    void loadDay(nextDay, requestIdRef.current);
  }, [nextDay, loadDay]);

  const reportProbe = useCallback((key: string, times: string[]) => {
    setProbeResults((prev) => {
      const current = prev[key];
      if (current && current.length === times.length && current.every((t, i) => t === times[i])) return prev;
      return { ...prev, [key]: times };
    });
  }, []);

  const minDurationFor = useCallback(
    (pro: SimpleProfessional): number => {
      const durations = servicesForProfessional(pro).map(serviceDuration);
      return durations.length > 0 ? Math.min(...durations) : 30;
    },
    [servicesForProfessional]
  );

  // Mesmo filtro de agendamentos por profissional das telas de horário.
  const appointmentsFor = useCallback(
    (pro: SimpleProfessional, dateStr: string) => {
      const proId = normalize(pro?.id);
      const proName = normalize(pro?.name);
      return (appointmentsByDay[dateStr] || []).filter((appointment: any) => {
        const day = appointment?.appointment_date == null ? '' : String(appointment.appointment_date).slice(0, 10);
        if (day !== dateStr) return false;
        const aptPro = normalize(appointment?.professional);
        const aptProId = normalize(appointment?.professional_id);
        const aptProName = normalize(appointment?.professional_name);
        const byId = proId.length > 0 && (aptPro === proId || aptProId === proId);
        const byName = proName.length > 0 && (aptPro === proName || aptProName === proName);
        return byId || byName;
      });
    },
    [appointmentsByDay]
  );

  const probes = useMemo(() => {
    if (!enabled || !establishment) return [] as { key: string; pro: SimpleProfessional; date: string; duration: number }[];
    const out: { key: string; pro: SimpleProfessional; date: string; duration: number }[] = [];
    const seen = new Set<string>();
    const add = (pro: SimpleProfessional, date: string, duration: number) => {
      const key = `${date}|${pro.id}|${duration}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ key, pro, date, duration });
    };
    for (const date of days) {
      if (!appointmentsByDay[date]) continue;
      for (const pro of professionals) add(pro, date, minDurationFor(pro));
    }
    if (pick && appointmentsByDay[pick.date]) {
      for (const pro of professionals) {
        for (const service of servicesForProfessional(pro)) add(pro, pick.date, serviceDuration(service));
      }
    }
    return out;
  }, [enabled, establishment, days, appointmentsByDay, pick, professionals, minDurationFor, servicesForProfessional]);

  const timesByDay = useMemo(() => {
    const out: Record<string, { ready: boolean; times: string[] }> = {};
    for (const date of days) {
      if (!appointmentsByDay[date]) {
        out[date] = { ready: false, times: [] };
        continue;
      }
      let ready = true;
      const times = new Set<string>();
      for (const pro of professionals) {
        const found = probeResults[`${date}|${pro.id}|${minDurationFor(pro)}`];
        if (found === undefined) {
          ready = false;
          continue;
        }
        found.forEach((time) => times.add(time));
      }
      out[date] = { ready, times: Array.from(times).sort() };
    }
    return out;
  }, [days, appointmentsByDay, professionals, probeResults, minDurationFor]);

  // Todos os serviços dos profissionais (agrupados por nome). Para cada um: cabe no horário
  // escolhido? com quem? e, se não couber, em quais horários do mesmo dia ele cabe.
  const serviceOptions = useMemo(() => {
    if (!pick) return { ready: false, options: [] as SlotServiceOption[] };
    const groups = new Map<string, SlotServiceOption & { suggestionSet: Set<string> }>();
    let ready = Boolean(appointmentsByDay[pick.date]);
    for (const pro of professionals) {
      for (const service of servicesForProfessional(pro)) {
        const name = String(service?.name || '').trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const duration = serviceDuration(service);
        const group =
          groups.get(key) ||
          { key, name, prices: [], duration, matches: [], fits: false, suggestions: [], suggestionSet: new Set<string>() };
        group.prices.push(Number(service?.price) || 0);
        group.duration = Math.max(group.duration, duration);
        groups.set(key, group);
        const found = probeResults[`${pick.date}|${pro.id}|${duration}`];
        if (found === undefined) {
          ready = false;
          continue;
        }
        found.forEach((time) => group.suggestionSet.add(time));
        if (found.includes(pick.time) && !group.matches.some((m) => String(m.pro.id) === String(pro.id))) {
          group.matches.push({ pro, service });
        }
      }
    }
    const picked = timeToMinutes(pick.time);
    const options: SlotServiceOption[] = Array.from(groups.values()).map(({ suggestionSet, ...group }) => ({
      ...group,
      fits: group.matches.length > 0,
      // Os 8 horários que cabem mais perto do escolhido, em ordem.
      suggestions: Array.from(suggestionSet)
        .filter((time) => time !== pick.time)
        .sort((a, b) => Math.abs(timeToMinutes(a) - picked) - Math.abs(timeToMinutes(b) - picked))
        .slice(0, 8)
        .sort(),
    }));
    return { ready, options };
  }, [pick, appointmentsByDay, professionals, servicesForProfessional, probeResults]);

  // Seletores escondidos que fazem a conta (precisam estar na tela para calcular).
  const probesElement =
    probes.length > 0 && establishment ? (
      <div style={{ display: 'none' }} aria-hidden="true">
        {probes.map((probe) => (
          <TimeSlotSelector
            key={probe.key}
            forceFullDay={forceFullDay}
            selectedDate={new Date(`${probe.date}T00:00:00`)}
            selectedDuration={probe.duration}
            existingAppointments={appointmentsFor(probe.pro, probe.date)}
            selectedTime=""
            onTimeSelect={() => {}}
            businessHours={buildBusinessHoursForDate(establishment, new Date(`${probe.date}T00:00:00`))}
            use15MinuteInterval={Boolean(establishment?.use_15_minute_interval)}
            use20MinuteSchedule={Boolean(establishment?.use_20_minute_schedule)}
            use60MinuteSchedule={Boolean(establishment?.use_60_minute_schedule)}
            closedTimeEnabled={closedTimeEnabled}
            filterPastTimes
            hidePastSlots={probe.date === format(new Date(), 'yyyy-MM-dd')}
            hideIntervalSlots
            minimumAdvanceMinutes={getMinimumAdvanceMinutes(establishment)}
            selectedProfessional={probe.pro.name}
            professionalAbsences={probe.pro.absences || []}
            professionalBlockedHours={(probe.pro.blocked_hours || {})[probe.date] || []}
            professionalWorkHours={probe.pro.work_hours || null}
            onAvailableTimesChange={(times) => reportProbe(probe.key, times)}
          />
        ))}
      </div>
    ) : null;

  return {
    days,
    nextDay,
    timesByDay,
    pick,
    setPick,
    serviceOptions,
    probesElement,
    start,
    showNextDay,
  };
}
