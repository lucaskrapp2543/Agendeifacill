import { addMonths, endOfMonth, format, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, ScissorsLineDashed, Sparkles, User, X } from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import { useToast } from '../components/ui/Toaster';
import { storagePublicUrlForBrowser } from '../utils/storagePublicUrl';
import {
  isClientAfcoinsEnabledForEstablishment,
  registerAfcoinBookingEvent,
  registerAfcoinLocalPayBundle,
} from '../utils/afcoin';
import { AFCOIN_POINTS_LOCAL, AFCOIN_POINTS_ONLINE, isLocalAfcoinPaymentMethod } from '../utils/appointmentPayment';
import {
  buildBusinessHoursForDate,
  buildNormalPayload,
  buildPendingPaymentPayload,
  checkAppointmentConflict,
  ensureGuestSession,
  getMinimumAdvanceMinutes,
  getScheduleIntervalMinutes,
  loadEstablishmentAndServices,
  loadExistingAppointmentsForDate,
  resolvePaymentRequirement,
  supabase,
  withTimeout,
  type PaymentRequirement,
  type SimpleProfessional,
  type SimpleService,
} from '../utils/bookingSimpleEngine';

/**
 * Página de agendamento simples — /booking/:id/af
 *
 * Versão ultra-simplificada da página /booking/:id (BookingPage.tsx), feita para
 * clientes com pouca familiaridade com tecnologia: uma pergunta por tela, botões
 * grandes, sem chat, sem login. Usa o mesmo banco de dados e cria agendamentos
 * 100% compatíveis com o dashboard do estabelecimento.
 *
 * Esta página é totalmente isolada de BookingPage.tsx — ver src/utils/bookingSimpleEngine.ts
 * para a lógica de agendamento copiada (não compartilhada) de lá.
 */

type WizardStep = 'welcome' | 'name' | 'phone' | 'professional' | 'service' | 'datetime' | 'summary' | 'payment_mode' | 'payment' | 'success';

const STEP_ORDER: WizardStep[] = ['welcome', 'name', 'phone', 'professional', 'service', 'datetime', 'summary'];

interface WizardState {
  clientName: string;
  clientWhatsapp: string;
  professional: SimpleProfessional | null;
  services: SimpleService[];
  selectedDate: string; // yyyy-MM-dd
  selectedTime: string;
}

const INITIAL_STATE: WizardState = {
  clientName: '',
  clientWhatsapp: '',
  professional: null,
  services: [],
  selectedDate: '',
  selectedTime: '',
};

const GOLD = '#E6C78B';

const BIG_BUTTON = 'w-full min-h-[58px] rounded-2xl text-lg font-extrabold transition-colors px-6 py-4';
const PRIMARY_BUTTON = `${BIG_BUTTON} bg-[#E6C78B] text-black hover:bg-[#f0d69c] disabled:opacity-30 disabled:cursor-not-allowed`;
const INPUT_CLASS =
  'w-full px-4 py-4 text-lg rounded-2xl bg-[#1c1d20] border-2 border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#E6C78B] transition-colors';
const CARD_BASE = 'flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-colors';
const CARD_UNSELECTED = 'border-gray-700 bg-[#1c1d20] hover:border-gray-500';
const CARD_SELECTED = 'border-[#E6C78B] bg-[#E6C78B]/10';

const formatPrice = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

/** Limita a 11 dígitos (DDD + número) e formata como (99) 99999-9999 enquanto digita. */
const formatPhoneDisplay = (raw: string): string => {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const WEEKDAY_LABELS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const BUSINESS_HOURS_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const timeToMinutes = (time: string): number => {
  const [h, m] = String(time || '').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** "00:00"/vazio/igual ao primeiro turno = não é um segundo turno de verdade, é só campo zerado no banco. */
const hasMeaningfulSecondShift = (open1?: string, open2?: string, close2?: string): boolean => {
  if (!open2 || !close2) return false;
  if (open2 === '00:00' && close2 === '00:00') return false;
  if (open2 === open1) return false;
  return true;
};

/** Calcula se o estabelecimento está aberto agora, com base no dia/horário atual e nos turnos cadastrados. */
const isEstablishmentOpenNow = (establishment: any): boolean => {
  const now = new Date();
  const dayKey = BUSINESS_HOURS_DAY_KEYS[now.getDay()];
  const day = establishment?.business_hours?.[dayKey];
  if (!day?.enabled) return false;
  const open1 = day.open1 ?? day.open;
  const close1 = day.close1 ?? day.close;
  if (!open1 || !close1) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes >= timeToMinutes(open1) && nowMinutes < timeToMinutes(close1)) return true;
  const open2 = day.open2;
  const close2 = day.close2;
  if (hasMeaningfulSecondShift(open1, open2, close2) && nowMinutes >= timeToMinutes(open2) && nowMinutes < timeToMinutes(close2)) {
    return true;
  }
  return false;
};

/** Monta a grade do mês (células vazias de preenchimento + dias), para o calendário de "Escolher outro dia". */
const buildCalendarGrid = (monthDate: Date) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const leadingBlanks = monthStart.getDay();
  const days: Date[] = [];
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    days.push(new Date(monthStart.getFullYear(), monthStart.getMonth(), d));
  }
  return { leadingBlanks, days };
};

const ProgressBar = ({ stepIndex, total }: { stepIndex: number; total: number }) => (
  <div className="h-1 w-full bg-white/10">
    <div
      className="h-full bg-[#E6C78B] transition-all duration-300"
      style={{ width: `${Math.min(100, Math.max(0, (stepIndex / total) * 100))}%` }}
    />
  </div>
);

const BookingSimplePage = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [establishment, setEstablishment] = useState<any>(null);

  const [step, setStep] = useState<WizardStep>('welcome');
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);

  const [dayAppointments, setDayAppointments] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showMoreDates, setShowMoreDates] = useState(false);

  const [paymentInfo, setPaymentInfo] = useState<{ appointmentId: string; requirement: PaymentRequirement } | null>(null);
  const [paymentPendingNotice, setPaymentPendingNotice] = useState(false);
  const [pendingRequirement, setPendingRequirement] = useState<PaymentRequirement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setLoadError('Código do estabelecimento não informado.');
        setLoading(false);
        return;
      }
      const { establishment: est, error } = await loadEstablishmentAndServices(id);
      if (cancelled) return;
      if (error || !est) {
        setLoadError(error || 'Estabelecimento não encontrado.');
      } else if (est._blocked) {
        setLoadError('Este estabelecimento não está aceitando agendamentos no momento.');
      } else {
        setEstablishment(est);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const visibleProfessionals: SimpleProfessional[] = useMemo(() => {
    const list = Array.isArray(establishment?.professionals) ? establishment.professionals : [];
    return list.filter((p: any) => !p?.hidden_from_booking);
  }, [establishment]);

  const services: SimpleService[] = useMemo(() => {
    const all: SimpleService[] = Array.isArray(establishment?.services_with_prices)
      ? establishment.services_with_prices
      : [];
    // Bloqueio por categoria: não mostrar serviços cuja categoria excluiu o profissional escolhido
    const profId = String(state.professional?.id || '').trim();
    if (!profId) return all;
    return all.filter((service) => {
      const excluded = Array.isArray(service?.excluded_professional_ids) ? service.excluded_professional_ids : [];
      return !excluded.some((x) => String(x || '').trim() === profId);
    });
  }, [establishment, state.professional]);

  const toggleService = (service: SimpleService) => {
    setState((s) => {
      const alreadySelected = s.services.some((sv) => sv.id === service.id);
      return {
        ...s,
        services: alreadySelected ? s.services.filter((sv) => sv.id !== service.id) : [...s.services, service],
      };
    });
  };

  const totalDuration = useMemo(
    () => state.services.reduce((sum, sv) => sum + (Number(sv.duration) || 0), 0),
    [state.services]
  );
  const totalPrice = useMemo(() => state.services.reduce((sum, sv) => sum + (Number(sv.price) || 0), 0), [state.services]);
  const combinedServiceName = useMemo(
    () => state.services.map((sv) => sv.name.trim()).filter(Boolean).join(' + '),
    [state.services]
  );

  const isOpenNow = useMemo(() => isEstablishmentOpenNow(establishment), [establishment]);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const tomorrowStr = useMemo(() => format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'), []);
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const calendarGrid = useMemo(() => buildCalendarGrid(calendarMonth), [calendarMonth]);

  const isDaySelectable = (d: Date): boolean => {
    if (d < todayStart) return false;
    const dayKey = BUSINESS_HOURS_DAY_KEYS[d.getDay()];
    return Boolean(establishment?.business_hours?.[dayKey]?.enabled);
  };

  const pickDate = (dateStr: string) => {
    setState((s) => ({ ...s, selectedDate: dateStr, selectedTime: '' }));
  };

  const selectedDateLabel = useMemo(() => {
    if (!state.selectedDate) return '';
    if (state.selectedDate === todayStr) return 'Hoje';
    if (state.selectedDate === tomorrowStr) return 'Amanhã';
    const [y, m, d] = state.selectedDate.split('-').map(Number);
    const weekday = WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()];
    return `${weekday}, ${state.selectedDate.split('-').reverse().slice(0, 2).join('/')}`;
  }, [state.selectedDate, todayStr, tomorrowStr]);

  useEffect(() => {
    if (step !== 'datetime' || !establishment?.id || !state.selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    loadExistingAppointmentsForDate(establishment.id, state.selectedDate).then((rows) => {
      if (!cancelled) {
        setDayAppointments(rows);
        setLoadingSlots(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, establishment?.id, state.selectedDate]);


  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx >= 0 && idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const handleConfirm = async () => {
    if (!establishment?.id || !state.professional || state.services.length === 0 || !state.selectedDate || !state.selectedTime) {
      toast.error('Preencha todas as informações antes de confirmar.');
      return;
    }

    setSubmitting(true);
    try {
      const { userId, error: sessionError } = await ensureGuestSession(state.clientName.trim(), state.clientWhatsapp);
      if (sessionError || !userId) {
        toast.error(sessionError || 'Não foi possível identificar o cliente.');
        return;
      }

      const intervalMinutes = getScheduleIntervalMinutes({
        use60MinuteSchedule: Boolean(establishment?.use_60_minute_schedule),
        use20MinuteSchedule: Boolean(establishment?.use_20_minute_schedule),
        use15MinuteInterval: Boolean(establishment?.use_15_minute_interval),
      });

      const conflict = await checkAppointmentConflict({
        establishmentId: establishment.id,
        professionalRef: state.professional.id,
        targetDate: state.selectedDate,
        targetTime: state.selectedTime,
        durationMinutes: totalDuration,
        scheduleIntervalMinutes: intervalMinutes,
      });

      if (!conflict.ok) {
        toast.error(conflict.message || 'Horário indisponível.');
        setStep('datetime');
        return;
      }

      const requirement = await resolvePaymentRequirement({
        establishment,
        servicePrice: totalPrice,
        clientPhone: state.clientWhatsapp,
      });

      // Pagamento obrigatório — cria agendamento e abre PaymentModal
      if (requirement.precisaPagamento) {
        const payload = buildPendingPaymentPayload(buildPayloadInput(userId));
        const { data: inserted, error: insertError } = await withTimeout(
          supabase.from('appointments').insert([payload]).select('id').single(),
          20000, 'insert (pending_payment)'
        );
        if (insertError) throw insertError;
        setPaymentInfo({ appointmentId: String(inserted!.id), requirement });
        setStep('payment');
        return;
      }

      // Pagamento opcional — mostra escolha para o cliente
      if (requirement.permitePagamentoOpcional) {
        setPendingRequirement(requirement);
        setStep('payment_mode');
        return;
      }

      // Sem pagamento — cria e vai direto pra sucesso (+ AFCoins se habilitado)
      await doInsertAndSuccess(userId, 'pagar_local');
    } catch (err: any) {
      console.error('Erro ao confirmar agendamento (booking simples):', err);
      toast.error(err?.message || 'Erro ao confirmar agendamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const buildPayloadInput = (userId: string) => ({
    clientId: userId,
    establishmentId: establishment!.id,
    establishmentCode: establishment!.code,
    appointmentDate: state.selectedDate,
    appointmentTime: state.selectedTime,
    professionalId: state.professional!.id,
    professionalName: state.professional!.name,
    serviceName: combinedServiceName,
    price: totalPrice,
    duration: totalDuration,
    clientName: state.clientName.trim(),
    clientWhatsapp: state.clientWhatsapp,
  });

  const doInsertAndSuccess = async (userId: string, paymentMethod: string) => {
    const input = buildPayloadInput(userId);
    const payload = { ...buildNormalPayload(input), payment_method: paymentMethod };
    const { data: inserted, error: insertError } = await withTimeout(
      supabase.from('appointments').insert([payload]).select('id').single(),
      20000, 'insert (normal)'
    );
    if (insertError) throw insertError;
    // AFCoins
    if (isClientAfcoinsEnabledForEstablishment(establishment) && inserted?.id) {
      const afcoinParams = {
        establishmentId: String(establishment!.id),
        appointmentId: inserted.id,
        clientPhone: state.clientWhatsapp,
        clientName: state.clientName.trim(),
        establishment,
      };
      if (isLocalAfcoinPaymentMethod(paymentMethod)) {
        const awarded = await registerAfcoinLocalPayBundle(afcoinParams);
        if (awarded > 0) toast.success(`✨ Você ganhou ${awarded} AFCoins neste agendamento!`);
      } else {
        await registerAfcoinBookingEvent({ ...afcoinParams, rule: 'name_phone_5' });
        const confirmed = await registerAfcoinBookingEvent({ ...afcoinParams, rule: 'booking_confirm_10' });
        if (confirmed) toast.success('✨ Você ganhou +10 AFCoins');
      }
    }
    toast.success('Agendamento confirmado!');
    setStep('success');
  };

  const handlePayLocal = async () => {
    if (!establishment?.id || !state.professional || state.services.length === 0) return;
    setSubmitting(true);
    try {
      const { userId, error } = await ensureGuestSession(state.clientName.trim(), state.clientWhatsapp);
      if (error || !userId) { toast.error('Sessão expirada. Tente novamente.'); return; }
      await doInsertAndSuccess(userId, 'pagar_local');
    } catch (err: any) {
      toast.error(err?.message || 'Erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayOnline = async () => {
    if (!establishment?.id || !state.professional || state.services.length === 0 || !pendingRequirement) return;
    setSubmitting(true);
    try {
      const { userId, error } = await ensureGuestSession(state.clientName.trim(), state.clientWhatsapp);
      if (error || !userId) { toast.error('Sessão expirada. Tente novamente.'); return; }
      const payload = buildPendingPaymentPayload(buildPayloadInput(userId));
      const { data: inserted, error: insertError } = await withTimeout(
        supabase.from('appointments').insert([payload]).select('id').single(),
        20000, 'insert (pending_payment optional)'
      );
      if (insertError) throw insertError;
      setPaymentInfo({ appointmentId: String(inserted!.id), requirement: pendingRequirement });
      setStep('payment');
    } catch (err: any) {
      toast.error(err?.message || 'Erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Chamado quando pagamento é opcional e o cliente fechou o modal — converte pending_payment → pending (pagar local)
  const handlePayLocalFromPending = async () => {
    if (!paymentInfo?.appointmentId || !establishment?.id) return;
    setSubmitting(true);
    try {
      const { error } = await withTimeout(
        supabase
          .from('appointments')
          .update({ status: 'pending', payment_method: 'pagar_local' })
          .eq('id', paymentInfo.appointmentId),
        15000,
        'update to pagar_local'
      );
      if (error) throw error;
      if (isClientAfcoinsEnabledForEstablishment(establishment)) {
        const afcoinParams = {
          establishmentId: String(establishment.id),
          appointmentId: paymentInfo.appointmentId,
          clientPhone: state.clientWhatsapp,
          clientName: state.clientName.trim(),
          establishment,
        };
        const awarded = await registerAfcoinLocalPayBundle(afcoinParams);
        if (awarded > 0) toast.success(`✨ Você ganhou ${awarded} AFCoins neste agendamento!`);
      }
      toast.success('Agendamento confirmado!');
      setStep('success');
    } catch (err: any) {
      toast.error(err?.message || 'Erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1011' }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ backgroundColor: '#0f1011' }}>
        <div>
          <p className="text-xl font-bold text-white mb-2">Não foi possível abrir o agendamento</p>
          <p className="text-gray-400">{loadError}</p>
        </div>
      </div>
    );
  }

  const stepIndex = STEP_ORDER.indexOf(step);
  const showBackButton = stepIndex > 0 && step !== 'welcome';
  const showProgressChrome = step !== 'payment' && step !== 'payment_mode' && step !== 'success';

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0f1011' }}>
      <div className="sticky top-0 z-10" style={{ backgroundColor: 'rgba(15,16,17,0.95)', backdropFilter: 'blur(8px)' }}>
        <div className="border-b border-white/10 px-4 py-3 flex items-center gap-3">
          {showBackButton ? (
            <button type="button" onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Voltar">
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
          ) : (
            <div className="w-10" />
          )}
          <div className="flex-1 text-center">
            <p className="font-bold text-white truncate">{establishment?.name || 'Agendamento'}</p>
            {stepIndex > 0 && showProgressChrome ? (
              <p className="text-xs text-gray-400">
                Passo {stepIndex} de {STEP_ORDER.length - 1}
              </p>
            ) : step === 'welcome' && establishment?.business_hours ? (
              <div className="inline-flex items-center gap-1.5 mt-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${isOpenNow ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className={`text-[11px] font-bold uppercase tracking-wide ${isOpenNow ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {isOpenNow ? 'Aberto agora' : 'Fechado agora'}
                </span>
              </div>
            ) : null}
          </div>
          <div className="w-10" />
        </div>
        {showProgressChrome && <ProgressBar stepIndex={stepIndex} total={STEP_ORDER.length - 1} />}
      </div>

      <div className="flex-1 flex flex-col px-5 py-6 max-w-md w-full mx-auto">
        {step === 'welcome' && (
          <div className="flex-1 flex flex-col items-center text-center gap-6 pt-4">
            {establishment?.logo_url && (
              <img
                src={storagePublicUrlForBrowser(establishment.logo_url)}
                alt={establishment.name}
                className="w-24 h-24 rounded-full object-cover border-2"
                style={{ borderColor: GOLD }}
              />
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-white mb-2">Bem-vindo(a), {establishment?.name}!</h1>
              <p className="text-gray-400 text-lg">Vamos marcar seu horário em poucos passos simples.</p>
            </div>
            <button type="button" className={PRIMARY_BUTTON} onClick={goNext}>
              Começar agendamento
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/view-appointments'; }}
              className="-mt-2 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
            >
              Ver meus agendamentos
            </button>

            {establishment?.business_hours && (
              <div className="mt-8 w-full">
                <div className="flex items-center justify-center gap-2 mb-3 text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Horário de funcionamento</span>
                </div>
                <div className="rounded-2xl border border-gray-800 bg-[#1c1d20] divide-y divide-gray-800 overflow-hidden text-left">
                  {WEEKDAY_LABELS.map((label, i) => {
                    const dayKey = BUSINESS_HOURS_DAY_KEYS[i];
                    const day = (establishment.business_hours as any)?.[dayKey];
                    const isToday = i === new Date().getDay();
                    const enabled = Boolean(day?.enabled);
                    const open1 = day?.open1 ?? day?.open;
                    const close1 = day?.close1 ?? day?.close;
                    const open2 = day?.open2;
                    const close2 = day?.close2;
                    const isOpenDay = enabled && Boolean(open1) && Boolean(close1);
                    const showSecondShift = hasMeaningfulSecondShift(open1, open2, close2);
                    return (
                      <div
                        key={dayKey}
                        className={`flex items-center justify-between px-4 py-3 text-sm ${isToday ? 'bg-white/5' : ''}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isOpenDay ? 'bg-emerald-400' : 'bg-gray-700'}`} />
                          <span className={`font-semibold ${isToday ? 'text-white' : 'text-gray-400'}`}>
                            {label}
                            {isToday && <span className="ml-1.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: GOLD }}>hoje</span>}
                          </span>
                        </div>
                        {isOpenDay ? (
                          <span className={isToday ? 'text-white font-semibold' : 'text-gray-400'}>
                            {open1}–{close1}
                            {showSecondShift ? ` · ${open2}–${close2}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-600 font-semibold">
                            <X className="h-3.5 w-3.5" />
                            Fechado
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'name' && (
          <div className="flex-1 flex flex-col gap-6">
            <h2 className="text-2xl font-extrabold text-white">Qual é o seu nome?</h2>
            <input
              type="text"
              autoFocus
              value={state.clientName}
              onChange={(e) => setState((s) => ({ ...s, clientName: e.target.value }))}
              placeholder="Digite seu nome completo"
              className={INPUT_CLASS}
            />
            <button type="button" className={PRIMARY_BUTTON} disabled={state.clientName.trim().length < 2} onClick={goNext}>
              Próximo
            </button>
          </div>
        )}

        {step === 'phone' && (
          <div className="flex-1 flex flex-col gap-6">
            <h2 className="text-2xl font-extrabold text-white">Qual o seu telefone?</h2>
            <p className="text-gray-400">Usamos para confirmar e lembrar do seu horário.</p>
            <input
              type="tel"
              autoFocus
              inputMode="numeric"
              value={formatPhoneDisplay(state.clientWhatsapp)}
              onChange={(e) => setState((s) => ({ ...s, clientWhatsapp: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              placeholder="(99) 99999-9999"
              maxLength={15}
              className={INPUT_CLASS}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={state.clientWhatsapp.replace(/\D/g, '').length < 10}
              onClick={goNext}
            >
              Próximo
            </button>
          </div>
        )}

        {step === 'professional' && (
          <div className="flex-1 flex flex-col gap-4">
            <h2 className="text-2xl font-extrabold text-white">Escolha o profissional</h2>
            {visibleProfessionals.length === 0 ? (
              <p className="text-gray-400">Nenhum profissional disponível no momento. Fale diretamente com o estabelecimento.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleProfessionals.map((pro) => (
                  <button
                    key={pro.id}
                    type="button"
                    onClick={() => {
                      setState((s) => ({ ...s, professional: pro }));
                      goNext();
                    }}
                    className={`${CARD_BASE} ${state.professional?.id === pro.id ? CARD_SELECTED : CARD_UNSELECTED}`}
                  >
                    {pro.photo_url ? (
                      <img src={storagePublicUrlForBrowser(pro.photo_url)} alt={pro.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-[#242628] flex items-center justify-center shrink-0">
                        <User className="h-7 w-7 text-gray-400" />
                      </div>
                    )}
                    <span className="text-lg font-semibold text-white">{pro.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'service' && (
          <div className="flex-1 flex flex-col gap-4 pb-24">
            <h2 className="text-2xl font-extrabold text-white">Escolha o serviço</h2>
            <p className="text-gray-400">Pode escolher mais de um.</p>
            {services.length === 0 ? (
              <p className="text-gray-400">Nenhum serviço cadastrado. Fale diretamente com o estabelecimento.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {services.map((service, idx) => {
                  const isSelected = state.services.some((sv) => sv.id === service.id);
                  return (
                    <button
                      key={service.id ?? `${service.name}-${idx}`}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={`${CARD_BASE} ${isSelected ? CARD_SELECTED : CARD_UNSELECTED}`}
                    >
                      {service.image_url ? (
                        <img
                          src={storagePublicUrlForBrowser(service.image_url)}
                          alt={service.name}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#242628] flex items-center justify-center shrink-0">
                          <ScissorsLineDashed className="h-6 w-6" style={{ color: GOLD }} />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-white">{service.name}</p>
                        <p className="text-gray-400">
                          {formatPrice(service.price)} · {service.duration} min
                        </p>
                      </div>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                          isSelected ? 'border-[#E6C78B] bg-[#E6C78B]' : 'border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="h-4 w-4 text-black" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'datetime' && state.professional && state.services.length > 0 && (
          <div className="flex-1 flex flex-col gap-4">
            <h2 className="text-2xl font-extrabold text-white">Escolha data e horário</h2>

            {!state.selectedDate ? (
              <div className="flex flex-col gap-3">
                <button type="button" onClick={() => pickDate(todayStr)} className={`${CARD_BASE} ${CARD_UNSELECTED}`}>
                  <div className="w-12 h-12 rounded-xl bg-[#242628] flex items-center justify-center shrink-0">
                    <Sparkles className="h-6 w-6" style={{ color: GOLD }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-white">Hoje</p>
                    <p className="text-gray-400">{todayStr.split('-').reverse().slice(0, 2).join('/')}</p>
                  </div>
                </button>

                {!showMoreDates && (
                  <button
                    type="button"
                    onClick={() => setShowMoreDates(true)}
                    className={`${CARD_BASE} ${CARD_UNSELECTED} justify-center text-center`}
                  >
                    <span className="text-lg font-semibold text-white">Escolher outro dia</span>
                  </button>
                )}

                {showMoreDates && (
                  <div className="rounded-2xl border-2 border-gray-700 bg-[#1c1d20] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
                        disabled={isSameMonth(calendarMonth, todayStart)}
                        className="p-2 rounded-full hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed"
                        aria-label="Mês anterior"
                      >
                        <ChevronLeft className="h-6 w-6 text-white" />
                      </button>
                      <p className="text-lg font-bold text-white">
                        {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                      </p>
                      <button
                        type="button"
                        onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
                        className="p-2 rounded-full hover:bg-white/10"
                        aria-label="Próximo mês"
                      >
                        <ChevronRight className="h-6 w-6 text-white" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
                      {WEEKDAY_SHORT.map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: calendarGrid.leadingBlanks }).map((_, i) => (
                        <div key={`blank-${i}`} />
                      ))}
                      {calendarGrid.days.map((d) => {
                        const dateStr = format(d, 'yyyy-MM-dd');
                        const selectable = isDaySelectable(d);
                        return (
                          <button
                            key={dateStr}
                            type="button"
                            disabled={!selectable}
                            onClick={() => pickDate(dateStr)}
                            className={`aspect-square rounded-xl text-base font-semibold flex items-center justify-center transition-colors ${
                              selectable
                                ? 'bg-[#242628] text-white hover:bg-[#2c2e31] active:scale-95'
                                : 'text-gray-700 cursor-not-allowed'
                            }`}
                          >
                            {d.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setState((s) => ({ ...s, selectedDate: '', selectedTime: '' }));
                    setShowMoreDates(false);
                  }}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl border-2 text-left"
                  style={{ borderColor: GOLD, backgroundColor: 'rgba(230,199,139,0.1)' }}
                >
                  <span className="text-lg font-semibold text-white">{selectedDateLabel}</span>
                  <span className="text-sm font-bold" style={{ color: GOLD }}>
                    Trocar
                  </span>
                </button>

                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
                  </div>
                ) : (
                  <TimeSlotSelector
                    selectedDate={new Date(`${state.selectedDate}T00:00:00`)}
                    selectedDuration={totalDuration}
                    existingAppointments={dayAppointments}
                    selectedTime={state.selectedTime}
                    onTimeSelect={(time) => {
                      setState((s) => ({ ...s, selectedTime: time }));
                      requestAnimationFrame(() => {
                        document.getElementById('confirmar-horario-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      });
                    }}
                    businessHours={buildBusinessHoursForDate(establishment, new Date(`${state.selectedDate}T00:00:00`))}
                    use15MinuteInterval={Boolean(establishment?.use_15_minute_interval)}
                    use20MinuteSchedule={Boolean(establishment?.use_20_minute_schedule)}
                    use60MinuteSchedule={Boolean(establishment?.use_60_minute_schedule)}
                    filterPastTimes
                    hidePastSlots={state.selectedDate === todayStr}
                    minimumAdvanceMinutes={getMinimumAdvanceMinutes(establishment)}
                    selectedProfessional={state.professional.name}
                    professionalAbsences={state.professional.absences || []}
                    professionalBlockedHours={(state.professional.blocked_hours || {})[state.selectedDate] || []}
                    professionalWorkHours={state.professional.work_hours || null}
                  />
                )}
              </>
            )}

            {state.selectedTime && (
              <div
                className="flex items-center gap-3 rounded-2xl border-2 p-4"
                style={{ borderColor: GOLD, backgroundColor: 'rgba(230,199,139,0.08)' }}
              >
                <Clock className="h-5 w-5 shrink-0" style={{ color: GOLD }} />
                <span className="text-white font-semibold">
                  Horário selecionado: <strong style={{ color: GOLD }}>{state.selectedTime}</strong>
                </span>
              </div>
            )}

            <div id="confirmar-horario-btn">
              <button type="button" className={PRIMARY_BUTTON} disabled={!state.selectedTime} onClick={goNext}>
                Confirmar horário
              </button>
            </div>
          </div>
        )}

        {step === 'summary' && state.professional && state.services.length > 0 && (
          <div className="flex-1 flex flex-col gap-6">
            <h2 className="text-2xl font-extrabold text-white">Confirme seu agendamento</h2>
            <div className="rounded-2xl border-2 border-gray-700 bg-[#1c1d20] p-5 space-y-3 text-lg text-white">
              <p>
                <span className="text-gray-400">Cliente:</span> <strong>{state.clientName}</strong>
              </p>
              <p>
                <span className="text-gray-400">Telefone:</span> <strong>{state.clientWhatsapp}</strong>
              </p>
              <p>
                <span className="text-gray-400">Profissional:</span> <strong>{state.professional.name}</strong>
              </p>

              <div className="border-t border-gray-700 pt-3 space-y-1.5">
                {state.services.map((sv) => (
                  <div key={sv.id} className="flex items-center justify-between text-base">
                    <span className="text-gray-300">{sv.name}</span>
                    <span>{formatPrice(sv.price)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1.5 border-t border-gray-700">
                  <span className="text-gray-400">Total ({totalDuration} min)</span>
                  <strong style={{ color: GOLD }}>{formatPrice(totalPrice)}</strong>
                </div>
              </div>

              <p className="border-t border-gray-700 pt-3">
                <span className="text-gray-400">Data:</span> <strong>{state.selectedDate.split('-').reverse().join('/')}</strong>
              </p>
              <p>
                <span className="text-gray-400">Horário:</span> <strong>{state.selectedTime}</strong>
              </p>
            </div>
            <button type="button" className={PRIMARY_BUTTON} disabled={submitting} onClick={handleConfirm}>
              {submitting ? 'Confirmando...' : 'Confirmar agendamento'}
            </button>
          </div>
        )}

        {step === 'payment_mode' && pendingRequirement && (() => {
          const is50 = establishment?.advance_payment_percentage === 50 && pendingRequirement.valorAgendamento < totalPrice;
          const restante = totalPrice - pendingRequirement.valorAgendamento;
          const afcoinsOn = isClientAfcoinsEnabledForEstablishment(establishment);
          return (
            <div className="flex-1 flex flex-col gap-5">
              <div>
                <h2 className="text-2xl font-extrabold text-white mb-1">Como prefere pagar?</h2>
                <p className="text-gray-400">Escolha a melhor opção para você.</p>
              </div>

              {/* ⭐ Pagar agora — opção destaque */}
              <button
                type="button"
                disabled={submitting}
                onClick={handlePayOnline}
                className="flex flex-col gap-3 p-5 rounded-2xl border-2 text-left transition-colors w-full"
                style={{ borderColor: GOLD, backgroundColor: 'rgba(230,199,139,0.07)' }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-extrabold tracking-widest uppercase" style={{ color: GOLD }}>
                    ⭐ Recomendado
                  </span>
                  {is50 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border text-amber-300 border-amber-400/40 bg-amber-500/15">
                      50% agora
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-xl font-extrabold text-white">
                    {is50
                      ? `Pagar ${formatPrice(pendingRequirement.valorAgendamento)} agora`
                      : `Pagar ${formatPrice(pendingRequirement.chargeAmount)} online`}
                  </p>
                  <p className="text-gray-400">PIX ou cartão — rápido e seguro</p>
                </div>

                {is50 && (
                  <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 w-full space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-200">💳 Pagar agora (50%):</span>
                      <span className="font-bold text-amber-200">{formatPrice(pendingRequirement.valorAgendamento)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">🏪 Restante no salão:</span>
                      <span className="font-bold text-white">{formatPrice(restante)}</span>
                    </div>
                  </div>
                )}

                {afcoinsOn && (
                  <p className="text-sm font-semibold text-emerald-400">
                    ✨ Ganhe +{AFCOIN_POINTS_ONLINE} AFCoins pagando online
                  </p>
                )}
              </button>

              {/* Pagar no local — opção secundária */}
              <button
                type="button"
                disabled={submitting}
                onClick={handlePayLocal}
                className={`${CARD_BASE} ${CARD_UNSELECTED}`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#242628] flex items-center justify-center shrink-0">
                  <MapPin className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-white">Pagar no local</p>
                  <p className="text-gray-400">
                    {afcoinsOn
                      ? `+${AFCOIN_POINTS_LOCAL} AFCoins · pague ao chegar`
                      : 'Pague ao chegar na barbearia'}
                  </p>
                </div>
              </button>

              {submitting && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-7 w-7 animate-spin" style={{ color: GOLD }} />
                </div>
              )}
            </div>
          );
        })()}

        {step === 'payment' && paymentInfo && establishment && (
          <div className="flex-1">
            {paymentPendingNotice ? (
              <div className="flex flex-col gap-6 text-center items-center justify-center flex-1 py-10">
                <p className="text-xl font-bold text-white">Pagamento não finalizado</p>
                <p className="text-gray-400">
                  {paymentInfo.requirement.permitePagamentoOpcional
                    ? 'Seu agendamento já está confirmado. Você pode pagar agora ou escolher pagar no local.'
                    : 'Seu horário está reservado aguardando o pagamento. Conclua o pagamento para garantir o horário.'}
                </p>
                <button type="button" className={PRIMARY_BUTTON} onClick={() => setPaymentPendingNotice(false)}>
                  Pagar agora
                </button>
                {paymentInfo.requirement.permitePagamentoOpcional && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handlePayLocalFromPending}
                    className="w-full min-h-[52px] rounded-2xl text-lg font-bold px-6 py-4 bg-transparent border-2 border-gray-600 text-gray-300 hover:border-gray-400 transition-colors disabled:opacity-30"
                  >
                    {submitting ? 'Confirmando...' : 'Pagar no local'}
                  </button>
                )}
              </div>
            ) : (
              <PaymentModal
                isOpen
                onClose={() => setPaymentPendingNotice(true)}
                appointmentId={paymentInfo.appointmentId}
                amount={paymentInfo.requirement.chargeAmount}
                establishmentId={establishment.id}
                recipientId={paymentInfo.requirement.pagarmeRecipientId || undefined}
                customerData={{ name: state.clientName, phone: state.clientWhatsapp }}
                cancelAppointmentOnFailure={!paymentInfo.requirement.permitePagamentoOpcional}
                includesPlatformFee={paymentInfo.requirement.cobrarTaxaCliente}
                onPaymentSuccess={() => setStep('success')}
                onPaymentFailure={() => toast.error('Pagamento não confirmado. Tente novamente.')}
              />
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
            <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
              <CheckCircle2 className="h-14 w-14 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-2">Agendamento confirmado!</h2>
              <p className="text-gray-400 text-lg">
                {state.selectedDate.split('-').reverse().join('/')} às {state.selectedTime} com {state.professional?.name}.
              </p>
            </div>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              onClick={() => {
                const phone = state.clientWhatsapp.replace(/\D/g, '');
                window.location.href = phone
                  ? `/view-appointments?phone=${encodeURIComponent(phone)}`
                  : '/view-appointments';
              }}
            >
              Ver meus agendamentos
            </button>
          </div>
        )}
      </div>

      {step === 'service' && state.services.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-5 pt-6 pointer-events-none">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
            style={{ background: 'linear-gradient(to top, #0f1011 55%, transparent)' }}
          />
          <div className="relative max-w-md mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={goNext}
              className={`${PRIMARY_BUTTON} shadow-xl shadow-black/50 flex items-center justify-center gap-2`}
            >
              <span>
                Continuar · {state.services.length} serviço{state.services.length > 1 ? 's' : ''}
              </span>
              <span className="opacity-60">·</span>
              <span>{formatPrice(totalPrice)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingSimplePage;
