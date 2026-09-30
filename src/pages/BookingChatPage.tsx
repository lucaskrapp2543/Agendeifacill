import { format } from 'date-fns';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCheck, Loader2, Mic, MoreVertical, Phone, Send, Smile, Video } from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { SubscriptionPixModal } from '../components/SubscriptionPixModal';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import { useToast } from '../components/ui/Toaster';
import { storagePublicUrlForBrowser } from '../utils/storagePublicUrl';
import { establishmentHasMercadoPago } from '../utils/establishmentPaymentFlags';
import type { BookingPayMethod } from '../components/BookingPaymentChoice';
import { buildWhatsappSuccessNote, fetchBookingWhatsappInfo, formatReminderOffset, type BookingWhatsappInfo } from '../lib/bookingWhatsappInfo';
import {
  isClientAfcoinsEnabledForEstablishment,
  registerAfcoinBookingEvent,
  registerAfcoinLocalPayBundle,
  registerAfcoinOnlinePayBundle,
} from '../utils/afcoin';
import { AFCOIN_POINTS_LOCAL, AFCOIN_POINTS_ONLINE, isLocalAfcoinPaymentMethod } from '../utils/appointmentPayment';
import { checkMonthlyLimit } from '../utils/monthlyLimitValidation';
import {
  buildCouponPayloadFields,
  computeCouponDiscount,
  validateDiscountCoupon,
  type AppliedCoupon,
} from '../utils/discountCoupon';
import {
  buildBusinessHoursForDate,
  buildNormalPayload,
  buildPhoneCandidates,
  buildPendingPaymentPayload,
  buildSubscriberPayload,
  checkAppointmentConflict,
  ensureGuestSession,
  getMinimumAdvanceMinutes,
  getScheduleIntervalMinutes,
  loadEstablishmentAndServices,
  loadExistingAppointmentsForDate,
  loadSubscriberPlanOptions,
  loadSubscriptionPlanForRenewal,
  resolvePaymentRequirement,
  resolveSubscriberByPhone,
  supabase,
  withTimeout,
  type PaymentRequirement,
  type SimpleProfessional,
  type SimpleService,
  type SimpleSubscriberOption,
} from '../utils/bookingSimpleEngine';

/**
 * Página de agendamento em formato de CHAT (estilo WhatsApp) — /booking/:id/chat
 *
 * Terceira página pública de agendamento. A conversa é conduzida pelo
 * "estabelecimento" (nome, foto e status online no cabeçalho) e o cliente
 * responde como num chat: nome e WhatsApp digitados; serviço, dia, horário e
 * pagamento escolhidos em botões dentro das mensagens.
 *
 * MOTOR: exatamente o mesmo da página simples (/af) — src/utils/bookingSimpleEngine.ts:
 * disponibilidade, conflito, assinante, cupom, AFCoins, pagamento obrigatório /
 * opcional, Mercado Pago e Pagar.me. Nada de regra nova de negócio aqui: só a
 * apresentação mudou. Os agendamentos criados são idênticos aos das outras páginas.
 */

// ---------------------------------------------------------------------------
// Cores do WhatsApp (tema escuro)
// ---------------------------------------------------------------------------
const WA = {
  bg: '#0b141a',
  header: '#202c33',
  incoming: '#202c33',
  outgoing: '#005c4b',
  accent: '#00a884',
  accentDark: '#008f72',
  text: '#e9edef',
  muted: '#8696a0',
  ticks: '#53bdeb',
  chip: '#2a3942',
  chipBorder: '#3b4a54',
  notice: '#182229',
  noticeText: '#ffd279',
};

// Papel de parede discreto (doodles geométricos), no espírito do WhatsApp.
const WALLPAPER =
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>` +
    `<g fill='none' stroke='#ffffff' stroke-opacity='0.045' stroke-width='1.5' stroke-linecap='round'>` +
    `<circle cx='18' cy='20' r='5'/><circle cx='18' cy='20' r='2'/>` +
    `<path d='M60 12 l6 6 M66 12 l-6 6'/>` +
    `<path d='M92 26 c4 -6 10 -6 14 0'/>` +
    `<circle cx='100' cy='70' r='6'/>` +
    `<path d='M22 78 l8 0 M26 74 l0 8'/>` +
    `<path d='M50 60 l10 10 M54 56 l4 4 M60 62 l4 4'/>` +
    `<path d='M40 100 q6 -8 12 0 q6 8 12 0'/>` +
    `<path d='M84 104 l6 -6 l6 6'/>` +
    `<circle cx='70' cy='36' r='2'/><circle cx='30' cy='48' r='2'/><circle cx='108' cy='48' r='2'/>` +
    `</g></svg>`
  ) +
  "\")";

type ChatStep =
  | 'menu'
  | 'lookup'
  | 'name'
  | 'phone'
  | 'subscriber_choice'
  | 'expired_choice'
  | 'professional'
  | 'services'
  | 'day'
  | 'time'
  | 'summary'
  | 'payment'
  | 'success';

type WidgetKind =
  | 'menu'
  | 'my_appointments'
  | 'card_kind'
  | 'subscriber_choice'
  | 'expired_choice'
  | 'professionals'
  | 'services'
  | 'subscriber_services'
  | 'days'
  | 'times'
  | 'summary'
  | 'payment'
  | 'local_confirm'
  | 'success';

type ChatMessage = {
  id: string;
  from: 'bot' | 'user';
  kind: 'text' | 'typing' | 'searching' | 'widget';
  text?: string;
  widget?: WidgetKind;
  /** Resposta já dada: o widget fica só como registro, sem interação. */
  done?: boolean;
  doneLabel?: string;
  time: string;
};

interface FormState {
  clientName: string;
  clientWhatsapp: string;
  professional: SimpleProfessional | null;
  services: SimpleService[];
  selectedDate: string;
  selectedTime: string;
}

const INITIAL_FORM: FormState = {
  clientName: '',
  clientWhatsapp: '',
  professional: null,
  services: [],
  selectedDate: '',
  selectedTime: '',
};

const WEEKDAY_LABELS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const BUSINESS_HOURS_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const formatPrice = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatPhoneDisplay = (raw: string): string => {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const firstName = (name: string): string => String(name || '').trim().split(/\s+/)[0] || '';

const nowLabel = () => format(new Date(), 'HH:mm');

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Tempo de "digitando…" proporcional ao texto: parece gente, sem enrolar. */
const typingDelayFor = (text: string) => Math.min(1400, Math.max(450, String(text || '').length * 16));

let messageSeq = 0;
const nextId = () => `m${Date.now()}_${messageSeq++}`;

const initialsOf = (name: string) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase() || 'AF';

/** Link "Adicionar ao Google Agenda" (sem fuso: o Google usa o fuso do usuário). */
const buildGoogleCalendarUrl = (params: {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  details: string;
  location: string;
}) => {
  const [y, m, d] = params.date.split('-').map(Number);
  const [hh, mm] = params.time.split(':').map(Number);
  const start = new Date(y, m - 1, d, hh, mm, 0);
  const end = new Date(start.getTime() + Math.max(15, params.durationMinutes) * 60000);
  const stamp = (dt: Date) => format(dt, "yyyyMMdd'T'HHmmss");
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: params.details,
    location: params.location,
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
};

// ---------------------------------------------------------------------------
// Peças visuais
// ---------------------------------------------------------------------------
const BubbleTail = ({ side }: { side: 'left' | 'right' }) => (
  <svg
    viewBox="0 0 8 13"
    width="8"
    height="13"
    className={`absolute top-0 ${side === 'left' ? '-left-2' : '-right-2'}`}
    aria-hidden
  >
    {side === 'left' ? (
      <path d="M8 0 L0 0 C3 2 6 6 8 13 Z" fill={WA.incoming} />
    ) : (
      <path d="M0 0 L8 0 C5 2 2 6 0 13 Z" fill={WA.outgoing} />
    )}
  </svg>
);

const TypingDots = () => (
  <span className="inline-flex items-center gap-1 px-1 py-1" aria-label="digitando">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="inline-block h-2 w-2 rounded-full"
        style={{
          backgroundColor: WA.muted,
          animation: 'wa-bounce 1.2s infinite',
          animationDelay: `${i * 0.18}s`,
        }}
      />
    ))}
  </span>
);

/**
 * Nome do serviço em até 2 linhas. Se o espaço não bastar (mede o corte de
 * verdade, não conta letras), mostra "ver nome completo", que abre o nome
 * inteiro sem marcar o serviço.
 */
const ServiceName = ({ nome, expandido, onExpand }: { nome: string; expandido: boolean; onExpand: () => void }) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [cortado, setCortado] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setCortado(!expandido && el.scrollHeight > el.clientHeight + 1);
    medir();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [nome, expandido]);

  const abrir = (e: { stopPropagation: () => void; preventDefault?: () => void }) => {
    e.stopPropagation();
    e.preventDefault?.();
    onExpand();
  };

  return (
    <>
      <span
        ref={ref}
        className="block font-semibold text-[14px] leading-snug"
        title={nome}
        style={
          expandido
            ? { color: WA.text }
            : { color: WA.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
        }
      >
        {nome}
      </span>
      {cortado && !expandido && (
        <span
          role="button"
          tabIndex={0}
          onClick={abrir}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') abrir(e);
          }}
          className="block text-xs underline underline-offset-2 mt-0.5"
          style={{ color: WA.accent }}
        >
          ver nome completo
        </span>
      )}
    </>
  );
};

const ChipButton = ({
  children,
  onClick,
  disabled,
  selected,
  primary,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  primary?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`min-h-[44px] rounded-2xl px-4 py-2.5 text-[15px] font-semibold transition-all disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98] ${className}`}
    style={{
      backgroundColor: primary ? WA.accent : selected ? 'rgba(0,168,132,0.18)' : WA.chip,
      color: primary ? '#0b141a' : WA.text,
      border: `1px solid ${primary ? WA.accent : selected ? WA.accent : WA.chipBorder}`,
    }}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
const BookingChatPage = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [establishment, setEstablishment] = useState<any>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<ChatStep>('menu');
  const [botTyping, setBotTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputMode, setInputMode] = useState<'name' | 'phone' | 'phone_lookup' | 'coupon' | 'none'>('none');
  const [submitting, setSubmitting] = useState(false);

  // "Ver meus agendamentos": telefone consultado e lista encontrada.
  const knownPhoneRef = useRef<string>('');
  const [myAppointments, setMyAppointments] = useState<any[]>([]);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const formRef = useRef<FormState>(INITIAL_FORM);
  const updateForm = (patch: Partial<FormState>) => {
    formRef.current = { ...formRef.current, ...patch };
    setForm(formRef.current);
  };

  // Seleção em andamento dentro dos widgets
  const [draftServiceIds, setDraftServiceIds] = useState<string[]>([]);
  // Serviços com nome longo que o cliente pediu para ver inteiro ("ver nome completo").
  const [expandedServiceIds, setExpandedServiceIds] = useState<string[]>([]);
  const [dayAppointments, setDayAppointments] = useState<any[]>([]);
  const [daysToShow, setDaysToShow] = useState(14);

  // Assinante
  const [detectedSubscriber, setDetectedSubscriber] = useState<any>(null);
  const [subscriberOptions, setSubscriberOptions] = useState<SimpleSubscriberOption[]>([]);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>([]);
  const [subscriberFlow, setSubscriberFlow] = useState(false);
  const subscriberFlowRef = useRef(false);
  const [subscriberLimits, setSubscriberLimits] = useState<Record<string, { canBook: boolean; remaining: number | null }>>({});
  const [expiredSubscriber, setExpiredSubscriber] = useState<any>(null);
  const [renewalPlan, setRenewalPlan] = useState<any>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);

  // Cupom
  const [cupomAplicado, setCupomAplicado] = useState<AppliedCoupon | null>(null);

  // Pagamento
  const [paymentInfo, setPaymentInfo] = useState<{ appointmentId: string; requirement: PaymentRequirement } | null>(null);
  const [pendingRequirement, setPendingRequirement] = useState<PaymentRequirement | null>(null);
  // PIX / crédito / débito escolhido no chat: o PaymentModal já abre na forma certa
  const [preferredPayMethod, setPreferredPayMethod] = useState<BookingPayMethod | null>(null);
  // Agendamento cujo pagamento online já foi confirmado (o onClose do modal vem depois do sucesso)
  const paymentDoneRef = useRef<string | null>(null);
  // WhatsApp do estabelecimento (conectado? lembra X antes?) para a mensagem final
  const [waInfo, setWaInfo] = useState<BookingWhatsappInfo | null>(null);
  const waInfoRef = useRef<BookingWhatsappInfo | null>(null);
  useEffect(() => {
    waInfoRef.current = waInfo;
  }, [waInfo]);
  // Pagamento obrigatório: o agendamento (pending_payment) já foi criado antes de o cliente escolher PIX/cartão.
  const pendingAppointmentIdRef = useRef<string | null>(null);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------
  // Carregar estabelecimento (mesma função da página simples)
  // ---------------------------------------------------------------------
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
        // Em paralelo: o WhatsApp dele está conectado? (só para a mensagem final)
        void fetchBookingWhatsappInfo(String(est.id || '')).then((info) => {
          if (!cancelled) setWaInfo(info);
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ---------------------------------------------------------------------
  // Derivados (mesma lógica da página simples)
  // ---------------------------------------------------------------------
  const visibleProfessionals: SimpleProfessional[] = useMemo(() => {
    const list = Array.isArray(establishment?.professionals) ? establishment.professionals : [];
    const visible = list.filter((p: any) => !p?.hidden_from_booking);
    if (!subscriberFlow) return visible;
    const lockedMultiIds = Array.isArray(detectedSubscriber?.subscriber_professional_ids)
      ? detectedSubscriber.subscriber_professional_ids.map((x: any) => String(x || '').trim()).filter(Boolean)
      : [];
    const lockedSingleId = String(detectedSubscriber?.subscriber_professional_id || '').trim();
    const lockedIds = lockedMultiIds.length > 0 ? lockedMultiIds : (lockedSingleId ? [lockedSingleId] : []);
    if (lockedIds.length === 0) return visible;
    const locked = visible.filter((p: any) => lockedIds.includes(String(p?.id || '').trim()));
    return locked.length > 0 ? locked : visible;
  }, [establishment, subscriberFlow, detectedSubscriber]);

  const servicesForProfessional = useCallback(
    (professional: SimpleProfessional | null): SimpleService[] => {
      const all: SimpleService[] = Array.isArray(establishment?.services_with_prices) ? establishment.services_with_prices : [];
      const profId = String(professional?.id || '').trim();
      if (!profId) return all;
      return all.filter((service: any) => {
        const excluded = Array.isArray(service?.excluded_professional_ids) ? service.excluded_professional_ids : [];
        return !excluded.some((x: any) => String(x || '').trim() === profId);
      });
    },
    [establishment]
  );

  const selectedSubscriberOptions = useMemo(
    () => subscriberOptions.filter((option) => selectedSubscriberIds.includes(option.id)),
    [selectedSubscriberIds, subscriberOptions]
  );
  const subscriberPlanName = useMemo(
    () => String(subscriberOptions[0]?.plan_name || detectedSubscriber?.subscriptions?.name || '').trim(),
    [subscriberOptions, detectedSubscriber]
  );
  const subscriberWeekdays = useMemo(() => subscriberOptions[0]?.weekdays ?? [], [subscriberOptions]);
  const subscriberEndDate = useMemo(() => String(detectedSubscriber?.end_date || '').slice(0, 10), [detectedSubscriber]);

  const totalDuration = useMemo(() => form.services.reduce((sum, sv) => sum + (Number(sv.duration) || 0), 0), [form.services]);
  const totalPrice = useMemo(() => form.services.reduce((sum, sv) => sum + (Number(sv.price) || 0), 0), [form.services]);
  const combinedServiceName = useMemo(() => form.services.map((sv) => sv.name.trim()).filter(Boolean).join(' + '), [form.services]);
  const subscriberDuration = useMemo(
    () => selectedSubscriberOptions.reduce((sum, option) => sum + (Number(option.duration) || 0), 0),
    [selectedSubscriberOptions]
  );
  const subscriberServiceName = useMemo(
    () => selectedSubscriberOptions.map((option) => option.name.trim()).filter(Boolean).join(' + '),
    [selectedSubscriberOptions]
  );

  const effectiveDuration = subscriberFlow ? subscriberDuration : totalDuration;
  const effectiveServiceName = subscriberFlow ? subscriberServiceName : combinedServiceName;
  const hasServiceSelection = subscriberFlow ? selectedSubscriberOptions.length > 0 : form.services.length > 0;

  const cupomAtivo = !subscriberFlow && totalPrice > 0 ? cupomAplicado : null;
  const cupomDesconto = useMemo(() => computeCouponDiscount(totalPrice, cupomAtivo), [totalPrice, cupomAtivo]);
  const precoFinalComDesconto = subscriberFlow ? 0 : cupomDesconto.finalPrice;

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const tomorrowStr = useMemo(() => format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'), []);

  // Só os agendamentos do profissional escolhido bloqueiam horário (mesmo filtro do
  // chat da página completa, BookingChatFlow ~745). Sem isso, um horário ocupado por
  // outro profissional apareceria como indisponível para todos.
  const filteredDayAppointments = useMemo(() => {
    const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
    const proIdNorm = norm(form.professional?.id);
    const proNameNorm = norm(form.professional?.name);
    if (!proIdNorm && !proNameNorm) return [];
    return (Array.isArray(dayAppointments) ? dayAppointments : []).filter((appointment: any) => {
      const dateStr = appointment?.appointment_date == null ? '' : String(appointment.appointment_date).slice(0, 10);
      if (dateStr !== form.selectedDate) return false;
      const aptPro = norm(appointment?.professional);
      const aptProId = norm(appointment?.professional_id);
      const aptProName = norm(appointment?.professional_name);
      const matchesById = proIdNorm.length > 0 && (aptPro === proIdNorm || aptProId === proIdNorm);
      const matchesByName = proNameNorm.length > 0 && (aptPro === proNameNorm || aptProName === proNameNorm);
      return matchesById || matchesByName;
    });
  }, [dayAppointments, form.professional?.id, form.professional?.name, form.selectedDate]);

  const isDaySelectable = useCallback(
    (d: Date): boolean => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if (d < start) return false;
      const dayKey = BUSINESS_HOURS_DAY_KEYS[d.getDay()];
      if (!establishment?.business_hours?.[dayKey]?.enabled) return false;
      if (subscriberFlowRef.current) {
        if (subscriberWeekdays.length > 0 && !subscriberWeekdays.includes(dayKey)) return false;
        if (subscriberEndDate && format(d, 'yyyy-MM-dd') > subscriberEndDate) return false;
      }
      return true;
    },
    [establishment, subscriberWeekdays, subscriberEndDate]
  );

  const selectableDays = useMemo(() => {
    const out: { dateStr: string; label: string; sub: string }[] = [];
    for (let i = 0; i < 60 && out.length < daysToShow; i++) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + i);
      if (!isDaySelectable(d)) continue;
      const dateStr = format(d, 'yyyy-MM-dd');
      const label = dateStr === todayStr ? 'Hoje' : dateStr === tomorrowStr ? 'Amanhã' : WEEKDAY_SHORT[d.getDay()];
      out.push({ dateStr, label, sub: format(d, 'dd/MM') });
    }
    return out;
  }, [daysToShow, isDaySelectable, todayStr, tomorrowStr]);

  const dateLabel = useCallback(
    (dateStr: string) => {
      if (!dateStr) return '';
      if (dateStr === todayStr) return 'hoje';
      if (dateStr === tomorrowStr) return 'amanhã';
      const [y, m, d] = dateStr.split('-').map(Number);
      return `${WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()].toLowerCase()}, ${dateStr.split('-').reverse().slice(0, 2).join('/')}`;
    },
    [todayStr, tomorrowStr]
  );

  // Limites por serviço do plano (mesma validação central do booking normal)
  useEffect(() => {
    if (!subscriberFlow || !establishment?.id || !detectedSubscriber || subscriberOptions.length === 0) {
      setSubscriberLimits({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const referenceDate = formRef.current.selectedDate ? new Date(`${formRef.current.selectedDate}T12:00:00`) : new Date();
        const entries = await Promise.all(
          subscriberOptions.map(async (option) => {
            const check = await checkMonthlyLimit(formRef.current.clientWhatsapp, establishment.id, referenceDate, {
              id: option.service_id,
              name: option.name || null,
              limit: option.service_limit,
            });
            const numericLimit = Number((check as any)?.monthlyLimit);
            const monthlyLimit = Number.isFinite(numericLimit) && numericLimit > 0 ? numericLimit : null;
            const currentUsage = Number((check as any)?.currentUsage || 0);
            return [option.id, {
              canBook: Boolean((check as any)?.canBook),
              remaining: monthlyLimit ? Math.max(0, monthlyLimit - currentUsage) : null,
            }] as const;
          })
        );
        if (cancelled) return;
        const next: Record<string, { canBook: boolean; remaining: number | null }> = {};
        entries.forEach(([key, value]) => { next[key] = value; });
        setSubscriberLimits(next);
      } catch {
        if (!cancelled) setSubscriberLimits({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subscriberFlow, establishment?.id, detectedSubscriber, subscriberOptions, form.selectedDate]);

  // ---------------------------------------------------------------------
  // Mensagens
  // ---------------------------------------------------------------------
  const pushMessage = useCallback((message: Omit<ChatMessage, 'id' | 'time'> & { id?: string }) => {
    setMessages((prev) => [...prev, { ...message, id: message.id || nextId(), time: nowLabel() }]);
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  /** Marca o último widget de um tipo como respondido (vira registro da conversa). */
  const finishWidget = useCallback((widget: WidgetKind, doneLabel?: string) => {
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.kind === 'widget' && m.widget === widget && !m.done);
      if (idx < 0) return prev;
      const realIdx = prev.length - 1 - idx;
      return prev.map((m, i) => (i === realIdx ? { ...m, done: true, doneLabel } : m));
    });
  }, []);

  const botSay = useCallback(
    async (text: string, delayMs?: number) => {
      if (!mountedRef.current) return;
      const typingId = nextId();
      setBotTyping(true);
      pushMessage({ id: typingId, from: 'bot', kind: 'typing' });
      await sleep(delayMs ?? typingDelayFor(text));
      if (!mountedRef.current) return;
      removeMessage(typingId);
      pushMessage({ from: 'bot', kind: 'text', text });
      setBotTyping(false);
    },
    [pushMessage, removeMessage]
  );

  const botWidget = useCallback(
    async (widget: WidgetKind, text?: string, delayMs = 500) => {
      if (!mountedRef.current) return;
      const typingId = nextId();
      setBotTyping(true);
      pushMessage({ id: typingId, from: 'bot', kind: 'typing' });
      await sleep(delayMs);
      if (!mountedRef.current) return;
      removeMessage(typingId);
      pushMessage({ from: 'bot', kind: 'widget', widget, text });
      setBotTyping(false);
    },
    [pushMessage, removeMessage]
  );

  const userSay = useCallback(
    (text: string) => {
      pushMessage({ from: 'user', kind: 'text', text });
    },
    [pushMessage]
  );

  // A cada mensagem nova, rola até o COMEÇO dela (não até o fim da tela): uma lista
  // longa, como a de serviços, aparece do primeiro item e o cliente desce lendo,
  // em vez de cair no último item e ter que subir.
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  // Momento em que o cliente rolou com o dedo/roda: aí a rolagem automática
  // atrasada não puxa a tela de volta.
  const userScrollAtRef = useRef<number>(0);
  useEffect(() => {
    const el = listRef.current;
    const last = lastMessageRef.current;
    if (!el) return;
    // setTimeout (e não requestAnimationFrame): rAF fica pausado com a aba em
    // segundo plano e a rolagem não aconteceria ao voltar.
    const rolar = (respeitaUsuario: boolean) => {
      if (respeitaUsuario && Date.now() - userScrollAtRef.current < 1500) return;
      if (last) {
        // offsetTop é relativo ao container (ele é `relative`); 16px de folga
        // para o texto da mensagem aparecer inteiro em cima da lista.
        el.scrollTo({ top: Math.max(0, last.offsetTop - 16), behavior: 'smooth' });
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    };
    rolar(false);
    // Reposiciona depois que fotos/fontes carregam e mudam a altura do que está acima.
    const timers = [60, 450, 1200].map((ms) => setTimeout(() => rolar(ms > 100), ms));
    return () => timers.forEach(clearTimeout);
  }, [messages, botTyping]);

  // Abertura da conversa
  useEffect(() => {
    if (!establishment || startedRef.current) return;
    startedRef.current = true;
    const name = String(establishment?.name || 'nosso espaço').trim();
    (async () => {
      await sleep(400);
      await botSay(`Olá! 👋 Seja bem-vindo(a) à *${name}*!`);
      if (!mountedRef.current) return;
      setStep('menu');
      await botWidget('menu', 'O que você deseja hoje?', 600);
    })();
  }, [establishment, botSay, botWidget]);

  // ---------------------------------------------------------------------
  // Passos da conversa
  // ---------------------------------------------------------------------
  const askProfessional = useCallback(async () => {
    const list = visibleProfessionals;
    if (list.length === 0) {
      await botSay('Poxa, no momento não temos profissionais liberados para agendamento online 😕 Chama a gente pelo WhatsApp que a gente te encaixa!');
      setStep('professional');
      setInputMode('none');
      return;
    }
    if (list.length === 1) {
      updateForm({ professional: list[0] });
      await botSay(`Você vai ser atendido(a) por *${list[0].name}* ✂️`);
      await askServices(list[0]);
      return;
    }
    setStep('professional');
    setInputMode('none');
    await botWidget('professionals', 'Com quem você prefere ser atendido(a)?');
  }, [visibleProfessionals, botSay, botWidget]); // eslint-disable-line react-hooks/exhaustive-deps

  const askServices = useCallback(async (professional: SimpleProfessional | null) => {
    setStep('services');
    setInputMode('none');
    setDraftServiceIds([]);
    setSelectedSubscriberIds([]);
    if (subscriberFlowRef.current) {
      await botWidget('subscriber_services', `Perfeito! Qual serviço da sua assinatura você quer usar${professional ? ` com ${firstName(professional.name)}` : ''}? 👑`);
      return;
    }
    await botWidget('services', 'Perfeito! Qual serviço você deseja? Pode escolher mais de um 👇');
  }, [botWidget]);

  const askDay = useCallback(async (intro?: string) => {
    setStep('day');
    setInputMode('none');
    setDaysToShow(14);
    updateForm({ selectedDate: '', selectedTime: '' });
    await botWidget('days', intro || 'Ótima escolha! 😄 Qual dia fica melhor pra você?');
  }, [botWidget]); // eslint-disable-line react-hooks/exhaustive-deps

  const askName = async (intro: string) => {
    await botSay(intro);
    if (!mountedRef.current) return;
    setStep('name');
    setInputMode('name');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ===== Menu inicial: agendar ou ver agendamentos =====
  const handleMenuChoice = async (choice: 'book' | 'view') => {
    finishWidget('menu', choice === 'book' ? 'Fazer um agendamento' : 'Ver meus agendamentos');
    userSay(choice === 'book' ? 'Fazer um agendamento 📅' : 'Ver meus agendamentos 🔎');
    if (choice === 'book') {
      await askName('Boa! Pra começar, me diz seu nome:');
      return;
    }
    await botSay('Me passa seu WhatsApp com DDD que eu busco seus agendamentos:');
    if (!mountedRef.current) return;
    setStep('lookup');
    setInputMode('phone_lookup');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleLookupPhone = async () => {
    const digits = inputValue.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      toast.error('Digite o WhatsApp com DDD, por exemplo (11) 99999-9999.');
      return;
    }
    if (!establishment?.id) return;
    setInputValue('');
    setInputMode('none');
    knownPhoneRef.current = digits;
    updateForm({ clientWhatsapp: digits });
    userSay(formatPhoneDisplay(digits));
    const typingId = nextId();
    setBotTyping(true);
    pushMessage({ id: typingId, from: 'bot', kind: 'typing' });
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, service, professional, status, payment_method, payment_status, price, total_price')
          .eq('establishment_id', establishment.id)
          .in('client_whatsapp', buildPhoneCandidates(digits))
          .gte('appointment_date', todayStr)
          .neq('status', 'cancelled')
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true })
          .limit(10),
        15000,
        'meus agendamentos'
      );
      if (error) throw error;
      const rows = (data || []) as any[];
      removeMessage(typingId);
      setBotTyping(false);
      if (!mountedRef.current) return;
      setMyAppointments(rows);
      if (rows.length === 0) {
        await botSay('Não encontrei nenhum agendamento futuro com esse número 🤔');
        await botWidget('my_appointments', 'Quer marcar um horário agora?', 400);
        return;
      }
      await botWidget('my_appointments', rows.length === 1 ? 'Encontrei este agendamento 👇' : `Encontrei estes ${rows.length} agendamentos 👇`, 500);
    } catch (err: any) {
      removeMessage(typingId);
      setBotTyping(false);
      await botSay(`Não consegui buscar agora 😕 ${String(err?.message || '')}`.trim());
      await botWidget('menu', 'O que você deseja?', 400);
    }
  };

  const handleNewBookingFromList = async () => {
    finishWidget('my_appointments', 'Fazer um agendamento');
    userSay('Fazer um agendamento 📅');
    await askName('Boa! Me diz seu nome:');
  };

  const handleSubmitName = async () => {
    const name = inputValue.trim();
    if (name.length < 2) {
      toast.error('Digite seu nome para continuar.');
      return;
    }
    setInputValue('');
    setInputMode('none');
    updateForm({ clientName: name });
    userSay(name);
    await botSay(`Prazer, ${firstName(name)}! 🙌`);
    // Telefone já informado em "Ver meus agendamentos": não pergunta de novo.
    if (knownPhoneRef.current) {
      const digits = knownPhoneRef.current;
      await botSay(`Vou usar o número ${formatPhoneDisplay(digits)} que você me passou 👍`);
      await continueAfterPhone(digits);
      return;
    }
    await botSay('Agora me passa seu WhatsApp com DDD, é por ele que confirmo seu horário:');
    if (!mountedRef.current) return;
    setStep('phone');
    setInputMode('phone');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSubmitPhone = async () => {
    const digits = inputValue.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      toast.error('Digite o WhatsApp com DDD, por exemplo (11) 99999-9999.');
      return;
    }
    setInputValue('');
    setInputMode('none');
    userSay(formatPhoneDisplay(digits));
    await continueAfterPhone(digits);
  };

  /** Depois do telefone: detecta assinante e segue para o profissional. */
  const continueAfterPhone = async (digits: string) => {
    if (!establishment?.id) return;
    updateForm({ clientWhatsapp: digits });
    setSubmitting(true);
    try {
      const typingId = nextId();
      setBotTyping(true);
      pushMessage({ id: typingId, from: 'bot', kind: 'typing' });
      const resolved = await resolveSubscriberByPhone(establishment.id, digits);
      removeMessage(typingId);
      setBotTyping(false);
      if (!mountedRef.current) return;

      if (resolved.status === 'active' && resolved.data) {
        const options = await loadSubscriberPlanOptions(establishment.id, resolved.data);
        if (options.length > 0) {
          setDetectedSubscriber(resolved.data);
          setSubscriberOptions(options);
          setSelectedSubscriberIds([]);
          setSubscriberFlow(false);
          subscriberFlowRef.current = false;
          setExpiredSubscriber(null);
          setRenewalPlan(null);
          const planName = String(options[0]?.plan_name || resolved.data?.subscriptions?.name || 'assinatura').trim();
          await botSay(`Que bom te ver por aqui, ${firstName(formRef.current.clientName)}! 👑 Vi que você é assinante do plano *${planName}*.`);
          setStep('subscriber_choice');
          await botWidget('subscriber_choice', 'Quer usar sua assinatura neste agendamento?');
          return;
        }
      }
      if (resolved.status === 'expired' && resolved.data) {
        setDetectedSubscriber(null);
        setSubscriberFlow(false);
        subscriberFlowRef.current = false;
        setSubscriberOptions([]);
        setSelectedSubscriberIds([]);
        setExpiredSubscriber(resolved.data);
        setRenewalPlan(await loadSubscriptionPlanForRenewal(establishment.id, resolved.data));
        const venc = String(resolved.data?.end_date || '').slice(0, 10).split('-').reverse().join('/');
        await botSay(`${firstName(formRef.current.clientName)}, sua assinatura venceu${venc ? ` em ${venc}` : ''} 😕`);
        setStep('expired_choice');
        await botWidget('expired_choice', 'Quer renovar agora ou seguir como cliente avulso?');
        return;
      }

      setDetectedSubscriber(null);
      setSubscriberFlow(false);
      subscriberFlowRef.current = false;
      setSubscriberOptions([]);
      setSelectedSubscriberIds([]);
      setExpiredSubscriber(null);
      setRenewalPlan(null);
      await botSay('Anotado! ✅');
      await askProfessional();
    } catch (err: any) {
      setBotTyping(false);
      toast.error(err?.message || 'Não consegui verificar seu número. Tente de novo.');
      setInputMode('phone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubscriberChoice = async (useSubscription: boolean) => {
    finishWidget('subscriber_choice', useSubscription ? 'Usar minha assinatura 👑' : 'Agendar sem a assinatura');
    userSay(useSubscription ? 'Usar minha assinatura 👑' : 'Agendar sem a assinatura');
    setSubscriberFlow(useSubscription);
    subscriberFlowRef.current = useSubscription;
    if (!useSubscription) {
      setSelectedSubscriberIds([]);
    }
    await botSay(useSubscription ? 'Boa! Sua assinatura já cobre o serviço 😉' : 'Sem problema!');
    await askProfessional();
  };

  const handleExpiredChoice = async (renew: boolean) => {
    finishWidget('expired_choice', renew ? 'Renovar assinatura' : 'Agendar como cliente avulso');
    userSay(renew ? 'Renovar assinatura' : 'Agendar como cliente avulso');
    if (renew && renewalPlan) {
      setShowRenewModal(true);
      return;
    }
    if (renew) {
      await botSay('Não encontrei o plano para renovar por aqui. Fala com a gente no WhatsApp que resolvemos! Enquanto isso, vamos agendar normal 😉');
    } else {
      await botSay('Tranquilo! Vamos agendar normalmente.');
    }
    setExpiredSubscriber(null);
    await askProfessional();
  };

  const handlePickProfessional = async (professional: SimpleProfessional) => {
    finishWidget('professionals', professional.name);
    userSay(professional.name);
    updateForm({ professional, services: [] });
    await askServices(professional);
  };

  const handleConfirmServices = async () => {
    if (subscriberFlowRef.current) {
      if (selectedSubscriberOptions.length === 0) return;
      const label = selectedSubscriberOptions.map((o) => o.name).join(' + ');
      finishWidget('subscriber_services', label);
      userSay(`${label} 👑`);
    } else {
      const chosen = servicesForProfessional(formRef.current.professional).filter((s) => draftServiceIds.includes(String(s.id)));
      if (chosen.length === 0) return;
      updateForm({ services: chosen });
      const label = chosen.map((s) => s.name).join(' + ');
      finishWidget('services', label);
      const total = chosen.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
      userSay(`${label} · ${formatPrice(total)}`);
    }
    await askDay();
  };

  const handlePickDay = async (dateStr: string) => {
    if (!establishment?.id) return;
    finishWidget('days', dateLabel(dateStr));
    userSay(dateLabel(dateStr).replace(/^./, (c) => c.toUpperCase()));
    updateForm({ selectedDate: dateStr, selectedTime: '' });
    setStep('time');
    setInputMode('none');
    await botSay('Perfeito, vou puxar os horários disponíveis pra você… 🔎', 600);
    const searchingId = nextId();
    setBotTyping(true);
    pushMessage({ id: searchingId, from: 'bot', kind: 'searching' });
    const startedAt = Date.now();
    let rows: any[] = [];
    try {
      rows = await loadExistingAppointmentsForDate(establishment.id, dateStr);
    } catch {
      rows = [];
    }
    // "Buscando…" por até 2 segundos: mostra o trabalho sem enrolar.
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(0, Math.min(2000, 1300 - elapsed)));
    if (!mountedRef.current) return;
    setDayAppointments(rows);
    removeMessage(searchingId);
    setBotTyping(false);
    pushMessage({ from: 'bot', kind: 'widget', widget: 'times', text: `Esses são os horários livres ${dateLabel(dateStr)} com ${firstName(formRef.current.professional?.name || '')}:` });
  };

  const handleNoSlots = useCallback(async () => {
    finishWidget('times', 'Nenhum horário livre');
    await botSay('Poxa, esse dia já está lotado 😕 Quer tentar outro?');
    await askDay('Escolha outro dia 👇');
  }, [finishWidget, botSay, askDay]);

  const handlePickTime = async (time: string) => {
    finishWidget('times', time);
    userSay(time);
    updateForm({ selectedTime: time });
    setStep('summary');
    await botWidget('summary', 'Fechou! Confere se está tudo certo:');
  };

  // ---------------------------------------------------------------------
  // Confirmação e pagamento (mesma sequência da página simples)
  // ---------------------------------------------------------------------
  const buildPayloadInput = (userId: string) => ({
    clientId: userId,
    establishmentId: establishment!.id,
    establishmentCode: establishment!.code,
    appointmentDate: formRef.current.selectedDate,
    appointmentTime: formRef.current.selectedTime,
    professionalId: formRef.current.professional!.id,
    professionalName: formRef.current.professional!.name,
    serviceName: effectiveServiceName,
    price: precoFinalComDesconto,
    duration: effectiveDuration,
    clientName: formRef.current.clientName.trim(),
    clientWhatsapp: formRef.current.clientWhatsapp,
  });

  const couponFieldsForPayload = () => buildCouponPayloadFields(totalPrice, cupomAtivo);

  const goSuccess = async (appointmentId: string | null, intro?: string) => {
    setCreatedAppointmentId(appointmentId);
    setStep('success');
    setInputMode('none');
    await botSay(intro || `Tudo certo, ${firstName(formRef.current.clientName)}! 🎉 Seu horário está confirmado.`);
    // WhatsApp do estabelecimento conectado: avisa que a confirmação/lembrete chegam lá.
    const waNote = buildWhatsappSuccessNote(waInfoRef.current);
    if (waNote) await botSay(waNote, 500);
    await botWidget('success', undefined, 400);
  };

  // Origem "chat" no agendamento: o admin conta por booking_source (a página simples usa 'af').
  const BOOKING_SOURCE = 'chat';

  const doInsertAndSuccess = async (userId: string, paymentMethod: string) => {
    const payload = { ...buildNormalPayload(buildPayloadInput(userId)), ...couponFieldsForPayload(), payment_method: paymentMethod, booking_source: BOOKING_SOURCE };
    const { data: inserted, error: insertError } = await withTimeout(
      supabase.from('appointments').insert([payload]).select('id').single(),
      20000, 'insert (normal)'
    );
    if (insertError) throw insertError;
    let afcoinNote = '';
    if (isClientAfcoinsEnabledForEstablishment(establishment) && inserted?.id) {
      const afcoinParams = {
        establishmentId: String(establishment!.id),
        appointmentId: inserted.id,
        clientPhone: formRef.current.clientWhatsapp,
        clientName: formRef.current.clientName.trim(),
        establishment,
      };
      if (isLocalAfcoinPaymentMethod(paymentMethod)) {
        const awarded = await registerAfcoinLocalPayBundle(afcoinParams);
        if (awarded > 0) afcoinNote = ` ✨ Você ganhou ${awarded} AFCoins!`;
      } else {
        await registerAfcoinBookingEvent({ ...afcoinParams, rule: 'name_phone_5' });
        const confirmed = await registerAfcoinBookingEvent({ ...afcoinParams, rule: 'booking_confirm_10' });
        if (confirmed) afcoinNote = ' ✨ Você ganhou +10 AFCoins!';
      }
    }
    await goSuccess(String(inserted?.id || ''), `Tudo certo, ${firstName(formRef.current.clientName)}! 🎉 Seu horário está confirmado.${afcoinNote}`);
  };

  const handleConfirmSummary = async () => {
    const f = formRef.current;
    if (!establishment?.id || !f.professional || !hasServiceSelection || !f.selectedDate || !f.selectedTime) {
      toast.error('Faltou alguma informação. Vamos conferir.');
      return;
    }
    finishWidget('summary', 'Confirmado ✅');
    userSay('Confirmar ✅');
    setSubmitting(true);
    const typingId = nextId();
    setBotTyping(true);
    pushMessage({ id: typingId, from: 'bot', kind: 'typing' });
    try {
      const { userId, error: sessionError } = await ensureGuestSession(f.clientName.trim(), f.clientWhatsapp);
      if (sessionError || !userId) {
        throw new Error(sessionError || 'Não foi possível identificar o cliente.');
      }

      const intervalMinutes = getScheduleIntervalMinutes({
        use60MinuteSchedule: Boolean(establishment?.use_60_minute_schedule),
        use20MinuteSchedule: Boolean(establishment?.use_20_minute_schedule),
        use15MinuteInterval: Boolean(establishment?.use_15_minute_interval),
      });
      const conflict = await checkAppointmentConflict({
        establishmentId: establishment.id,
        professionalRef: f.professional.id,
        targetDate: f.selectedDate,
        targetTime: f.selectedTime,
        durationMinutes: effectiveDuration,
        scheduleIntervalMinutes: intervalMinutes,
      });
      if (!conflict.ok) {
        removeMessage(typingId);
        setBotTyping(false);
        await botSay(`Ih, alguém acabou de pegar esse horário 😅 ${conflict.message || ''}`.trim());
        await askDay('Vamos escolher outro dia ou horário 👇');
        return;
      }

      if (subscriberFlowRef.current) {
        if (subscriberEndDate && f.selectedDate > subscriberEndDate) {
          removeMessage(typingId);
          setBotTyping(false);
          await botSay(`Sua assinatura vence em ${subscriberEndDate.split('-').reverse().join('/')}. Escolhe uma data antes disso ou renova com a gente 😉`);
          await askDay('Escolha outro dia 👇');
          return;
        }
        const selectedDayKey = BUSINESS_HOURS_DAY_KEYS[new Date(`${f.selectedDate}T12:00:00`).getDay()];
        if (subscriberWeekdays.length > 0 && !subscriberWeekdays.includes(selectedDayKey)) {
          removeMessage(typingId);
          setBotTyping(false);
          await botSay('Sua assinatura não permite agendar nesse dia da semana.');
          await askDay('Escolha outro dia 👇');
          return;
        }
        for (const option of selectedSubscriberOptions) {
          const check = await checkMonthlyLimit(f.clientWhatsapp, establishment.id, new Date(`${f.selectedDate}T12:00:00`), {
            id: option.service_id,
            name: option.name || null,
            limit: option.service_limit,
          });
          if (!check.canBook) {
            removeMessage(typingId);
            setBotTyping(false);
            await botSay(check.errorMessage || `Limite da assinatura atingido para ${option.name}.`);
            await askServices(f.professional);
            return;
          }
        }
        const subscriptionId = String(selectedSubscriberOptions[0]?.subscription_id || detectedSubscriber?.subscription_id || '').trim() || null;
        const payload = { ...buildSubscriberPayload(buildPayloadInput(userId), subscriptionId), booking_source: BOOKING_SOURCE };
        const { data: inserted, error: insertError } = await withTimeout(
          supabase.from('appointments').insert([payload]).select('id').single(),
          20000, 'insert (assinante)'
        );
        if (insertError) throw insertError;
        removeMessage(typingId);
        setBotTyping(false);
        await goSuccess(String(inserted?.id || ''), `Tudo certo, ${firstName(f.clientName)}! 🎉 Horário confirmado pela sua assinatura 👑`);
        return;
      }

      const requirement = await resolvePaymentRequirement({
        establishment,
        servicePrice: precoFinalComDesconto,
        clientPhone: f.clientWhatsapp,
      });

      if (requirement.precisaPagamento) {
        const payload = { ...buildPendingPaymentPayload(buildPayloadInput(userId)), ...couponFieldsForPayload(), booking_source: BOOKING_SOURCE };
        const { data: inserted, error: insertError } = await withTimeout(
          supabase.from('appointments').insert([payload]).select('id').single(),
          20000, 'insert (pending_payment)'
        );
        if (insertError) throw insertError;
        removeMessage(typingId);
        setBotTyping(false);
        setPaymentInfo(null);
        pendingAppointmentIdRef.current = String(inserted!.id);
        setPendingRequirement(requirement);
        setStep('payment');
        await botSay(`Só falta o pagamento pra garantir seu horário 🔒 Valor: *${formatPrice(requirement.chargeAmount)}*.`);
        await botWidget('payment', 'Como você prefere pagar?', 300);
        return;
      }

      if (requirement.permitePagamentoOpcional) {
        removeMessage(typingId);
        setBotTyping(false);
        setPendingRequirement(requirement);
        setStep('payment');
        await botWidget('payment', `Como você prefere pagar os *${formatPrice(requirement.chargeAmount)}*?`, 500);
        return;
      }

      removeMessage(typingId);
      setBotTyping(false);
      await doInsertAndSuccess(userId, 'pagar_local');
    } catch (err: any) {
      removeMessage(typingId);
      setBotTyping(false);
      console.error('Erro ao confirmar agendamento (booking chat):', err);
      await botSay(`Deu um erro aqui do meu lado 😕 ${String(err?.message || 'Tente de novo.')}`);
      setStep('summary');
      await botWidget('summary', 'Vamos tentar de novo:');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * PIX ou cartão: abre o mesmo modal de pagamento das outras páginas (Mercado Pago /
   * Pagar.me). O modal é quem coleta CPF/e-mail e conclui no método escolhido —
   * PIX aparece primeiro nele. Não mexemos no modal: é peça crítica de pagamento.
   */
  /** "Pagar com cartão": primeiro pergunta crédito ou débito, depois abre o pagamento. */
  const handleCardIntent = async () => {
    finishWidget('payment', 'Pagar com cartão');
    userSay('Pagar com cartão 💳');
    await botWidget('card_kind', 'Crédito ou débito?', 400);
  };

  const handlePayOnline = async (method: 'pix' | 'credit' | 'debit') => {
    if (!establishment?.id || !pendingRequirement) return;
    setPreferredPayMethod(method === 'pix' ? 'pix' : method === 'credit' ? 'credit_card' : 'debit_card');
    if (method === 'pix') {
      finishWidget('payment', 'Pagar com PIX');
      userSay('Pagar com PIX 💠');
      await botSay('Boa! Vou abrir o pagamento seguro por PIX 👇', 500);
    } else {
      const label = method === 'credit' ? 'Crédito' : 'Débito';
      finishWidget('card_kind', label);
      userSay(`${label} 💳`);
      await botSay(`Boa! Vou abrir o pagamento seguro no cartão de ${label.toLowerCase()} 👇`, 500);
    }
    // Pagamento obrigatório: o agendamento já existe (pending_payment) — só abre o modal.
    if (pendingAppointmentIdRef.current) {
      setPaymentInfo({ appointmentId: pendingAppointmentIdRef.current, requirement: pendingRequirement });
      return;
    }
    setSubmitting(true);
    try {
      const { userId, error } = await ensureGuestSession(formRef.current.clientName.trim(), formRef.current.clientWhatsapp);
      if (error || !userId) throw new Error('Sessão expirada. Tente novamente.');
      const payload = { ...buildPendingPaymentPayload(buildPayloadInput(userId)), ...couponFieldsForPayload(), booking_source: BOOKING_SOURCE };
      const { data: inserted, error: insertError } = await withTimeout(
        supabase.from('appointments').insert([payload]).select('id').single(),
        20000, 'insert (pending_payment optional)'
      );
      if (insertError) throw insertError;
      setPaymentInfo({ appointmentId: String(inserted!.id), requirement: pendingRequirement });
    } catch (err: any) {
      toast.error(err?.message || 'Erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  /** "Prefiro pagar no local": antes de aceitar, mostra o que ele perde pagando depois. */
  const handlePayLocalIntent = async () => {
    finishWidget('payment', 'Prefiro pagar no local');
    userSay('Prefiro pagar no local');
    const nome = String(establishment?.name || 'aqui').trim();
    const texto = isClientAfcoinsEnabledForEstablishment(establishment)
      ? `Tem certeza? 🤔 Pagando online agora você ganha *${AFCOIN_POINTS_ONLINE} AFCoins* (no local são só ${AFCOIN_POINTS_LOCAL}) e concorre a *corte 100% grátis* todo mês na ${nome} 🎁`
      : 'Tem certeza? 🤔 Pagando agora seu horário fica garantido e você não precisa se preocupar com isso na hora 😉';
    await botWidget('local_confirm', texto, 600);
  };

  const handleLocalConfirmChoice = async (payNow: boolean) => {
    if (payNow) {
      finishWidget('local_confirm', 'Ok, vou pagar agora');
      userSay('Ok, vou pagar agora 💳');
      await botWidget('payment', 'Boa escolha! 😄 Como prefere pagar?', 500);
      return;
    }
    finishWidget('local_confirm', 'Pagar no local mesmo assim');
    userSay('Pagar no local mesmo assim');
    await handlePayLocalConfirmed();
  };

  const handlePayLocalConfirmed = async () => {
    if (!establishment?.id || !formRef.current.professional || formRef.current.services.length === 0) return;
    setSubmitting(true);
    try {
      const { userId, error } = await ensureGuestSession(formRef.current.clientName.trim(), formRef.current.clientWhatsapp);
      if (error || !userId) throw new Error('Sessão expirada. Tente novamente.');
      await doInsertAndSuccess(userId, 'pagar_local');
    } catch (err: any) {
      toast.error(err?.message || 'Erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Pagamento opcional: cliente fechou o modal sem pagar → vira "pagar no local" (igual à página simples)
  const handlePaymentModalClose = async () => {
    if (!paymentInfo?.appointmentId || !establishment?.id) return;
    // O PaymentModal chama onClose logo DEPOIS de onPaymentSuccess. Se o pagamento já foi
    // confirmado, não pode rebaixar o agendamento para "pagar no local".
    if (paymentDoneRef.current === paymentInfo.appointmentId) return;
    if (!paymentInfo.requirement.permitePagamentoOpcional) {
      // Obrigatório: o modal cancela o agendamento sozinho; oferecemos recomeçar.
      setPaymentInfo(null);
      pendingAppointmentIdRef.current = null;
      setPendingRequirement(null);
      await botSay('O pagamento não foi concluído, então o horário não ficou reservado. Se quiser, é só escolher de novo 👇');
      await askDay('Escolha o dia 👇');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await withTimeout(
        supabase.from('appointments').update({ status: 'pending', payment_method: 'pagar_local' }).eq('id', paymentInfo.appointmentId),
        15000, 'update to pagar_local'
      );
      if (error) throw error;
      let afcoinNote = '';
      if (isClientAfcoinsEnabledForEstablishment(establishment)) {
        const awarded = await registerAfcoinLocalPayBundle({
          establishmentId: String(establishment.id),
          appointmentId: paymentInfo.appointmentId,
          clientPhone: formRef.current.clientWhatsapp,
          clientName: formRef.current.clientName.trim(),
          establishment,
        });
        if (awarded > 0) afcoinNote = ` ✨ Você ganhou ${awarded} AFCoins!`;
      }
      const aptId = paymentInfo.appointmentId;
      setPaymentInfo(null);
      await goSuccess(aptId, `Sem problema, você paga na hora 😉 Seu horário está confirmado!${afcoinNote}`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = async () => {
    const aptId = paymentInfo?.appointmentId || null;
    paymentDoneRef.current = aptId; // evita que o onClose seguinte converta para "pagar no local"
    setPaymentInfo(null);
    // AFCoins do pagamento online (5 + 10 + 45), igual à página completa.
    let afcoinNote = '';
    if (aptId && isClientAfcoinsEnabledForEstablishment(establishment)) {
      try {
        const awarded = await registerAfcoinOnlinePayBundle({
          establishmentId: String(establishment!.id),
          appointmentId: aptId,
          clientPhone: formRef.current.clientWhatsapp,
          clientName: formRef.current.clientName.trim(),
          establishment,
        });
        if (awarded > 0) afcoinNote = ` ✨ Você ganhou ${awarded} AFCoins!`;
      } catch {
        // AFCoins nunca podem atrapalhar a confirmação.
      }
    }
    await goSuccess(aptId, `Pagamento confirmado! ✅ Tudo certo, ${firstName(formRef.current.clientName)}, seu horário está garantido 🎉${afcoinNote}`);
  };

  const handleChangeChoice = async (what: 'services' | 'day' | 'professional') => {
    finishWidget('summary', 'Alterar');
    userSay(what === 'services' ? 'Trocar o serviço' : what === 'day' ? 'Trocar dia/horário' : 'Trocar profissional');
    if (what === 'day') {
      await askDay('Sem problema! Qual dia você prefere?');
      return;
    }
    updateForm({ services: [], selectedDate: '', selectedTime: '' });
    setSelectedSubscriberIds([]);
    if (what === 'professional') {
      updateForm({ professional: null });
      await askProfessional();
      return;
    }
    await askServices(formRef.current.professional);
  };

  const handleApplyCoupon = async () => {
    const code = inputValue.trim();
    if (!code) {
      setInputMode('none');
      return;
    }
    setInputValue('');
    setInputMode('none');
    userSay(`Cupom: ${code.toUpperCase()}`);
    const result = await validateDiscountCoupon(String(establishment?.id || ''), code);
    if (!result.ok) {
      setCupomAplicado(null);
      await botSay(`Hmm, ${result.message} 😕`);
      return;
    }
    setCupomAplicado(result.coupon);
    await botSay(`Cupom aplicado! 🎁 Você ganhou *${result.coupon.percent}%* de desconto.`);
  };

  const handleRestart = () => {
    window.location.reload();
  };

  // ---------------------------------------------------------------------
  // Renderização dos widgets
  // ---------------------------------------------------------------------
  const renderWidget = (message: ChatMessage) => {
    const done = Boolean(message.done);
    switch (message.widget) {
      case 'subscriber_choice':
        return (
          <div className="flex flex-col gap-2 mt-2">
            <ChipButton primary disabled={done} onClick={() => void handleSubscriberChoice(true)}>Usar minha assinatura 👑</ChipButton>
            <ChipButton disabled={done} onClick={() => void handleSubscriberChoice(false)}>Agendar sem a assinatura</ChipButton>
          </div>
        );
      case 'expired_choice':
        return (
          <div className="flex flex-col gap-2 mt-2">
            <ChipButton primary disabled={done} onClick={() => void handleExpiredChoice(true)}>Renovar assinatura 🔄</ChipButton>
            <ChipButton disabled={done} onClick={() => void handleExpiredChoice(false)}>Agendar como cliente avulso</ChipButton>
          </div>
        );
      case 'professionals':
        return (
          <div className="flex flex-col gap-2 mt-2">
            {visibleProfessionals.map((pro) => (
              <button
                key={pro.id}
                type="button"
                disabled={done}
                onClick={() => void handlePickProfessional(pro)}
                className="flex items-center gap-3 rounded-2xl p-2.5 text-left transition-colors disabled:opacity-45 active:scale-[0.99]"
                style={{ backgroundColor: WA.chip, border: `1px solid ${WA.chipBorder}` }}
              >
                {pro.photo_url ? (
                  <img src={storagePublicUrlForBrowser(pro.photo_url)} alt={pro.name} className="h-11 w-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-11 w-11 rounded-full flex items-center justify-center font-bold shrink-0" style={{ backgroundColor: WA.accentDark, color: '#fff' }}>
                    {initialsOf(pro.name)}
                  </div>
                )}
                <span className="font-semibold" style={{ color: WA.text }}>{pro.name}</span>
              </button>
            ))}
          </div>
        );
      case 'services': {
        const list = servicesForProfessional(form.professional);
        const draftTotal = list.filter((s) => draftServiceIds.includes(String(s.id))).reduce((sum, s) => sum + (Number(s.price) || 0), 0);
        // Foto só quando pelo menos um serviço tem imagem cadastrada; senão a lista fica limpa.
        const temFoto = list.some((s: any) => String(s?.image_url || '').trim());
        return (
          <div className="mt-2">
            {list.length === 0 ? (
              <p className="text-sm" style={{ color: WA.muted }}>Nenhum serviço disponível para agendamento online.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((service) => {
                  const id = String(service.id);
                  const selected = draftServiceIds.includes(id);
                  const nome = String(service.name || '').trim();
                  const foto = String((service as any)?.image_url || '').trim();
                  const expandido = expandedServiceIds.includes(id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      disabled={done}
                      onClick={() =>
                        setDraftServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                      }
                      className="flex items-center gap-2.5 rounded-2xl p-2.5 text-left transition-colors disabled:opacity-45 active:scale-[0.99]"
                      style={{
                        backgroundColor: selected ? 'rgba(0,168,132,0.16)' : WA.chip,
                        border: `1px solid ${selected ? WA.accent : WA.chipBorder}`,
                      }}
                    >
                      <span
                        className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: selected ? WA.accent : 'transparent', border: `2px solid ${selected ? WA.accent : WA.muted}` }}
                      >
                        {selected && <Check className="h-4 w-4" style={{ color: '#0b141a' }} />}
                      </span>
                      {temFoto && (
                        foto ? (
                          <img
                            src={storagePublicUrlForBrowser(foto)}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 rounded-xl object-cover shrink-0"
                            style={{ border: `1px solid ${WA.chipBorder}` }}
                          />
                        ) : (
                          <span className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center text-base" style={{ backgroundColor: WA.chipBorder }}>
                            ✂️
                          </span>
                        )
                      )}
                      <span className="flex-1 min-w-0">
                        <ServiceName
                          nome={nome}
                          expandido={expandido}
                          onExpand={() => setExpandedServiceIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
                        />
                        <span className="block text-xs mt-0.5" style={{ color: WA.muted }}>{Number(service.duration) || 30} min</span>
                      </span>
                      <span className="font-bold whitespace-nowrap text-[14px]" style={{ color: WA.text }}>{formatPrice(Number(service.price) || 0)}</span>
                    </button>
                  );
                })}
                {!done && (
                  <ChipButton primary disabled={draftServiceIds.length === 0} onClick={() => void handleConfirmServices()} className="mt-1">
                    {draftServiceIds.length === 0 ? 'Escolha pelo menos um serviço' : `Continuar · ${formatPrice(draftTotal)}`}
                  </ChipButton>
                )}
              </div>
            )}
          </div>
        );
      }
      case 'subscriber_services':
        return (
          <div className="mt-2 flex flex-col gap-2">
            {subscriberOptions.map((option) => {
              const selected = selectedSubscriberIds.includes(option.id);
              const limit = subscriberLimits[option.id];
              const blocked = limit && limit.canBook === false;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={done || Boolean(blocked)}
                  onClick={() =>
                    setSelectedSubscriberIds((prev) => {
                      if (prev.includes(option.id)) return prev.filter((x) => x !== option.id);
                      if (!option.divide_services_enabled) return [option.id];
                      return [...prev, option.id];
                    })
                  }
                  className="flex items-center gap-3 rounded-2xl p-2.5 text-left transition-colors disabled:opacity-45 active:scale-[0.99]"
                  style={{
                    backgroundColor: selected ? 'rgba(0,168,132,0.16)' : WA.chip,
                    border: `1px solid ${selected ? WA.accent : WA.chipBorder}`,
                  }}
                >
                  <span
                    className="h-6 w-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: selected ? WA.accent : 'transparent', border: `2px solid ${selected ? WA.accent : WA.muted}` }}
                  >
                    {selected && <Check className="h-4 w-4" style={{ color: '#0b141a' }} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate" style={{ color: WA.text }}>{option.name}</span>
                    <span className="block text-xs" style={{ color: WA.muted }}>
                      {Number(option.duration) || 30} min
                      {limit?.remaining !== null && limit?.remaining !== undefined ? ` · ${limit.remaining} restante(s) no mês` : ''}
                      {blocked ? ' · limite atingido' : ''}
                    </span>
                  </span>
                  <span className="font-bold whitespace-nowrap" style={{ color: WA.accent }}>Incluso 👑</span>
                </button>
              );
            })}
            {!done && (
              <ChipButton primary disabled={selectedSubscriberIds.length === 0} onClick={() => void handleConfirmServices()} className="mt-1">
                Continuar
              </ChipButton>
            )}
          </div>
        );
      case 'days':
        return (
          <div className="mt-2">
            {selectableDays.length === 0 ? (
              <p className="text-sm" style={{ color: WA.muted }}>Não encontrei dias abertos para agendamento. Fale com a gente pelo WhatsApp.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {selectableDays.map((day) => (
                    <button
                      key={day.dateStr}
                      type="button"
                      disabled={done}
                      onClick={() => void handlePickDay(day.dateStr)}
                      className="rounded-2xl px-2 py-2.5 text-center transition-colors disabled:opacity-45 active:scale-[0.98]"
                      style={{ backgroundColor: WA.chip, border: `1px solid ${WA.chipBorder}` }}
                    >
                      <span className="block font-bold text-[15px]" style={{ color: WA.text }}>{day.label}</span>
                      <span className="block text-xs" style={{ color: WA.muted }}>{day.sub}</span>
                    </button>
                  ))}
                </div>
                {!done && daysToShow < 60 && (
                  <button type="button" onClick={() => setDaysToShow((n) => n + 14)} className="mt-2 text-sm font-semibold" style={{ color: WA.accent }}>
                    Ver mais dias
                  </button>
                )}
              </>
            )}
          </div>
        );
      case 'times':
        return (
          <div className={`mt-2 wa-slots ${done ? 'pointer-events-none opacity-60' : ''}`}>
            {form.professional && form.selectedDate ? (
              <TimeSlotSelector
                selectedDate={new Date(`${form.selectedDate}T00:00:00`)}
                selectedDuration={effectiveDuration}
                existingAppointments={filteredDayAppointments}
                selectedTime={form.selectedTime}
                onTimeSelect={(time) => {
                  if (!done) void handlePickTime(time);
                }}
                businessHours={buildBusinessHoursForDate(establishment, new Date(`${form.selectedDate}T00:00:00`))}
                use15MinuteInterval={Boolean(establishment?.use_15_minute_interval)}
                use20MinuteSchedule={Boolean(establishment?.use_20_minute_schedule)}
                use60MinuteSchedule={Boolean(establishment?.use_60_minute_schedule)}
                filterPastTimes
                hidePastSlots={form.selectedDate === todayStr}
                hideIntervalSlots
                minimumAdvanceMinutes={getMinimumAdvanceMinutes(establishment)}
                selectedProfessional={form.professional.name}
                professionalAbsences={form.professional.absences || []}
                professionalBlockedHours={(form.professional.blocked_hours || {})[form.selectedDate] || []}
                professionalWorkHours={form.professional.work_hours || null}
                onVisibleSlotsChange={(count) => {
                  if (!done && count === 0) void handleNoSlots();
                }}
              />
            ) : null}
          </div>
        );
      case 'summary': {
        const f = form;
        const priceLabel = subscriberFlow
          ? 'Incluso na assinatura 👑'
          : cupomAtivo
            ? `${formatPrice(precoFinalComDesconto)} (cupom -${cupomAtivo.percent}%)`
            : formatPrice(totalPrice);
        return (
          <div className="mt-2">
            <div className="rounded-2xl p-3 space-y-1.5 text-[15px]" style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: WA.text }}>
              <p>👤 <span className="font-semibold">{f.clientName}</span> · {formatPhoneDisplay(f.clientWhatsapp)}</p>
              <p>✂️ {effectiveServiceName || '—'}</p>
              <p>💈 {f.professional?.name || '—'}</p>
              <p>📅 {dateLabel(f.selectedDate).replace(/^./, (c) => c.toUpperCase())} às <span className="font-semibold">{f.selectedTime}</span> · {effectiveDuration} min</p>
              <p>💰 <span className="font-semibold">{priceLabel}</span></p>
            </div>
            {!done && (
              <div className="flex flex-col gap-2 mt-2">
                <ChipButton primary disabled={submitting} onClick={() => void handleConfirmSummary()}>
                  {submitting ? 'Confirmando…' : 'Confirmar ✅'}
                </ChipButton>
                <div className="grid grid-cols-2 gap-2">
                  <ChipButton disabled={submitting} onClick={() => void handleChangeChoice('day')}>Trocar dia/hora</ChipButton>
                  <ChipButton disabled={submitting} onClick={() => void handleChangeChoice('services')}>Trocar serviço</ChipButton>
                </div>
                {visibleProfessionals.length > 1 && (
                  <ChipButton disabled={submitting} onClick={() => void handleChangeChoice('professional')}>Trocar profissional</ChipButton>
                )}
                {!subscriberFlow && totalPrice > 0 && !cupomAtivo && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode('coupon');
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="text-sm font-semibold text-left"
                    style={{ color: WA.accent }}
                  >
                    🎁 Tenho um cupom de desconto
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }
      case 'menu':
        return (
          <div className="flex flex-col gap-2 mt-2">
            <ChipButton primary disabled={done} onClick={() => void handleMenuChoice('book')}>📅 Fazer um agendamento</ChipButton>
            <ChipButton disabled={done} onClick={() => void handleMenuChoice('view')}>🔎 Ver meus agendamentos</ChipButton>
          </div>
        );
      case 'my_appointments': {
        const statusLabel = (a: any): string => {
          const s = String(a?.status || '').toLowerCase();
          if (s === 'confirmed') return 'Confirmado';
          if (s === 'completed') return 'Concluído';
          if (s === 'pending_payment') return 'Aguardando pagamento';
          return 'Agendado';
        };
        const proName = (a: any): string => {
          const list = Array.isArray(establishment?.professionals) ? establishment.professionals : [];
          const pro = list.find((p: any) => String(p?.id || '') === String(a?.professional || ''));
          return String(pro?.name || pro?.full_name || a?.professional || '').trim();
        };
        return (
          <div className="mt-2">
            {myAppointments.length > 0 && (
              <div className="flex flex-col gap-2">
                {myAppointments.map((a: any) => {
                  const dateStr = String(a?.appointment_date || '').slice(0, 10);
                  return (
                    <div key={String(a?.id)} className="rounded-2xl p-3 text-[14px] space-y-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: WA.text }}>
                      <p className="font-semibold">📅 {dateLabel(dateStr).replace(/^./, (c) => c.toUpperCase())} às {String(a?.appointment_time || '').slice(0, 5)}</p>
                      <p>✂️ {String(a?.service || 'Atendimento')}</p>
                      {proName(a) ? <p>💈 {proName(a)}</p> : null}
                      <p className="text-xs" style={{ color: WA.accent }}>{statusLabel(a)}</p>
                    </div>
                  );
                })}
              </div>
            )}
            {!done && (
              <div className="flex flex-col gap-2 mt-2">
                <ChipButton primary disabled={submitting} onClick={() => void handleNewBookingFromList()}>📅 Fazer um agendamento</ChipButton>
              </div>
            )}
          </div>
        );
      }
      case 'card_kind':
        return (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <ChipButton primary disabled={done || submitting} onClick={() => void handlePayOnline('credit')}>Crédito</ChipButton>
            <ChipButton primary disabled={done || submitting} onClick={() => void handlePayOnline('debit')}>Débito</ChipButton>
          </div>
        );
      case 'payment': {
        const optional = Boolean(pendingRequirement?.permitePagamentoOpcional);
        const payRow = (icon: string, label: string, onClick: () => void, primary: boolean) => (
          <button
            type="button"
            disabled={done || submitting}
            onClick={onClick}
            className="w-full min-h-[50px] rounded-2xl px-4 py-2.5 flex items-center gap-3 text-left transition-all disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.98]"
            style={{
              backgroundColor: primary ? WA.accent : WA.chip,
              color: primary ? '#0b141a' : WA.text,
              border: `1px solid ${primary ? WA.accent : WA.chipBorder}`,
            }}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className="flex-1 text-[15px] font-semibold whitespace-nowrap">{label}</span>
            <span className="text-lg leading-none opacity-70">›</span>
          </button>
        );
        return (
          <div className="flex flex-col gap-2 mt-2">
            {payRow('💠', 'Pagar com PIX', () => void handlePayOnline('pix'), true)}
            {payRow('💳', 'Pagar com cartão', () => void handleCardIntent(), false)}
            {optional && !done && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handlePayLocalIntent()}
                className="self-center mt-1 text-[13px] underline underline-offset-2 disabled:opacity-45"
                style={{ color: WA.muted }}
              >
                Prefiro pagar no local
              </button>
            )}
          </div>
        );
      }
      case 'local_confirm':
        return (
          <div className="flex flex-col gap-2 mt-2">
            <ChipButton primary disabled={done || submitting} onClick={() => void handleLocalConfirmChoice(true)}>
              Ok, vou pagar agora 💳
            </ChipButton>
            {!done && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleLocalConfirmChoice(false)}
                className="self-center mt-1 text-[13px] underline underline-offset-2 disabled:opacity-45"
                style={{ color: WA.muted }}
              >
                Pagar no local mesmo assim
              </button>
            )}
          </div>
        );
      case 'success': {
        const f = form;
        const calendarUrl = buildGoogleCalendarUrl({
          title: `${effectiveServiceName || 'Atendimento'} · ${establishment?.name || ''}`,
          date: f.selectedDate,
          time: f.selectedTime,
          durationMinutes: effectiveDuration,
          details: `Profissional: ${f.professional?.name || ''}`,
          location: String(establishment?.address || establishment?.name || ''),
        });
        return (
          <div className="mt-1">
            <div className="rounded-2xl p-3 space-y-1.5 text-[15px]" style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: WA.text }}>
              <p className="font-bold text-base">✅ Agendamento confirmado</p>
              <p>📅 {dateLabel(f.selectedDate).replace(/^./, (c) => c.toUpperCase())} às <span className="font-semibold">{f.selectedTime}</span></p>
              <p>✂️ {effectiveServiceName}</p>
              <p>💈 {f.professional?.name}</p>
              {establishment?.address ? <p>📍 {String(establishment.address)}</p> : null}
              {waInfo?.connected && waInfo.reminderEnabled ? (
                <p>📲 Lembrete no WhatsApp {formatReminderOffset(waInfo.reminderOffsetMinutes)} antes</p>
              ) : null}
              {createdAppointmentId ? <p className="text-xs" style={{ color: WA.muted }}>Código: {createdAppointmentId.slice(0, 8).toUpperCase()}</p> : null}
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] rounded-2xl px-4 py-2.5 text-[15px] font-semibold text-center"
                style={{ backgroundColor: WA.chip, color: WA.text, border: `1px solid ${WA.chipBorder}` }}
              >
                📆 Adicionar ao Google Agenda
              </a>
              <ChipButton onClick={handleRestart}>Fazer outro agendamento</ChipButton>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: WA.bg }}>
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: WA.accent }} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ backgroundColor: WA.bg }}>
        <div>
          <p className="text-xl font-bold mb-2" style={{ color: WA.text }}>Não foi possível abrir o agendamento</p>
          <p style={{ color: WA.muted }}>{loadError}</p>
        </div>
      </div>
    );
  }

  const logoUrl = establishment?.logo_url ? storagePublicUrlForBrowser(establishment.logo_url) : '';
  const isPhoneInput = inputMode === 'phone' || inputMode === 'phone_lookup';
  const inputPlaceholder =
    inputMode === 'name' ? 'Digite seu nome' : isPhoneInput ? '(DDD) 99999-9999' : inputMode === 'coupon' ? 'Digite o cupom' : 'Escolha uma opção acima 👆';
  const canType = inputMode !== 'none' && !submitting;

  const submitInput = () => {
    if (!canType) return;
    if (inputMode === 'name') void handleSubmitName();
    else if (inputMode === 'phone') void handleSubmitPhone();
    else if (inputMode === 'phone_lookup') void handleLookupPhone();
    else if (inputMode === 'coupon') void handleApplyCoupon();
  };

  return (
    // wa-root: `position: fixed; inset: 0` = exatamente a área visível do navegador, sempre.
    // Com `height: 100dvh` o Chrome do Android deixava uma sobra do tamanho da barra de
    // endereço: ao abrir o teclado ele "puxava" a tela para cima e não voltava — o cabeçalho
    // sumia e ficava uma faixa preta embaixo. Só a lista de mensagens rola; a página nunca.
    <div className="wa-root flex flex-col overflow-hidden" style={{ backgroundColor: WA.bg, color: WA.text }}>
      <style>{`
        .wa-root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; width: 100%; }
        html, body { overscroll-behavior-y: none; }
        @keyframes wa-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: .5 } 40% { transform: translateY(-4px); opacity: 1 } }
        .wa-slots .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .wa-slots button:disabled { opacity: .35; filter: grayscale(1); }
        .wa-bubble strong { font-weight: 700; }
      `}</style>

      {/* Cabeçalho */}
      <header className="flex items-center gap-3 px-3 py-2 shrink-0" style={{ backgroundColor: WA.header, paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <ArrowLeft className="h-6 w-6 shrink-0" style={{ color: WA.text }} aria-hidden />
        {logoUrl ? (
          <img src={logoUrl} alt={establishment?.name || 'Estabelecimento'} className="h-10 w-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0" style={{ backgroundColor: WA.accentDark, color: '#fff' }}>
            {initialsOf(establishment?.name || '')}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate leading-tight" style={{ color: WA.text }}>{establishment?.name || 'Agendamento'}</p>
          <p className="text-xs leading-tight" style={{ color: botTyping ? WA.accent : WA.muted }}>
            {botTyping ? 'digitando…' : 'online'}
          </p>
        </div>
        <Video className="h-5 w-5 shrink-0 opacity-80" style={{ color: WA.text }} aria-hidden />
        <Phone className="h-5 w-5 shrink-0 opacity-80" style={{ color: WA.text }} aria-hidden />
        <MoreVertical className="h-5 w-5 shrink-0 opacity-80" style={{ color: WA.text }} aria-hidden />
      </header>

      {/* Conversa */}
      {/* `relative` de propósito: o offsetTop das mensagens fica relativo a este container, que é quem rola.
          `min-h-0` é obrigatório: sem ele o flex não deixa a lista encolher, ela cresce com as mensagens
          e empurra o rodapé para fora da tela (a página passa a rolar em vez da lista). */}
      <div
        ref={listRef}
        className="relative flex-1 min-h-0 overflow-y-auto px-3 py-3"
        style={{ backgroundColor: WA.bg, backgroundImage: WALLPAPER }}
        onTouchStart={() => { userScrollAtRef.current = Date.now(); }}
        onWheel={() => { userScrollAtRef.current = Date.now(); }}
      >
        <div className="max-w-md mx-auto flex flex-col gap-1.5">
          <div className="flex justify-center my-1">
            <span className="text-[12px] px-3 py-1 rounded-lg" style={{ backgroundColor: WA.notice, color: WA.muted }}>Hoje</span>
          </div>
          <div className="flex justify-center mb-2">
            <span className="text-[12px] px-3 py-1.5 rounded-lg text-center max-w-[92%]" style={{ backgroundColor: WA.notice, color: WA.noticeText }}>
              🔒 Atendimento automático de agendamento. Seus dados são usados só para marcar o horário.
            </span>
          </div>

          {messages.map((message, index) => {
            const isUser = message.from === 'user';
            const isLast = index === messages.length - 1;
            const refProp = isLast ? { ref: lastMessageRef } : {};
            if (message.kind === 'typing') {
              return (
                <div key={message.id} className="flex justify-start" {...refProp}>
                  <div className="relative rounded-lg rounded-tl-none px-3 py-1.5" style={{ backgroundColor: WA.incoming }}>
                    <BubbleTail side="left" />
                    <TypingDots />
                  </div>
                </div>
              );
            }
            if (message.kind === 'searching') {
              return (
                <div key={message.id} className="flex justify-start" {...refProp}>
                  <div className="relative rounded-lg rounded-tl-none px-3 py-2 flex items-center gap-2" style={{ backgroundColor: WA.incoming }}>
                    <BubbleTail side="left" />
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: WA.accent }} />
                    <span className="text-sm" style={{ color: WA.muted }}>Buscando horários…</span>
                  </div>
                </div>
              );
            }
            return (
              <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} {...refProp}>
                <div
                  className={`wa-bubble relative max-w-[88%] rounded-lg px-2.5 pt-1.5 pb-1 shadow-sm ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'} ${message.kind === 'widget' ? 'w-[88%]' : ''}`}
                  style={{ backgroundColor: isUser ? WA.outgoing : WA.incoming }}
                >
                  <BubbleTail side={isUser ? 'right' : 'left'} />
                  {message.text ? (
                    <p
                      className="text-[15px] leading-snug whitespace-pre-wrap break-words pr-1"
                      style={{ color: WA.text }}
                      dangerouslySetInnerHTML={{
                        __html: String(message.text)
                          .replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/\*([^*]+)\*/g, '<strong>$1</strong>'),
                      }}
                    />
                  ) : null}
                  {message.kind === 'widget' ? renderWidget(message) : null}
                  {message.kind === 'widget' && message.done && message.doneLabel ? (
                    <p className="text-xs mt-2" style={{ color: WA.muted }}>Você escolheu: {message.doneLabel}</p>
                  ) : null}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[11px]" style={{ color: 'rgba(233,237,239,0.6)' }}>{message.time}</span>
                    {isUser && <CheckCheck className="h-4 w-4" style={{ color: WA.ticks }} aria-label="entregue" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra de digitação */}
      <div className="shrink-0 px-2 py-2 flex items-end gap-2" style={{ backgroundColor: WA.header, paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex-1 flex items-center gap-2 rounded-3xl px-3 min-h-[46px]" style={{ backgroundColor: WA.chip }}>
          <Smile className="h-6 w-6 shrink-0 opacity-70" style={{ color: WA.muted }} aria-hidden />
          <input
            ref={inputRef}
            value={isPhoneInput ? formatPhoneDisplay(inputValue) : inputValue}
            onChange={(e) => setInputValue(isPhoneInput ? e.target.value.replace(/\D/g, '').slice(0, 11) : e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitInput();
              }
            }}
            disabled={!canType}
            placeholder={inputPlaceholder}
            inputMode={isPhoneInput ? 'tel' : 'text'}
            autoComplete={inputMode === 'name' ? 'name' : isPhoneInput ? 'tel' : 'off'}
            className="flex-1 bg-transparent outline-none text-[16px] py-2 disabled:cursor-not-allowed"
            style={{ color: WA.text }}
            aria-label={inputPlaceholder}
          />
        </div>
        <button
          type="button"
          onClick={submitInput}
          disabled={!canType || !inputValue.trim()}
          className="h-[46px] w-[46px] rounded-full flex items-center justify-center shrink-0 transition-opacity disabled:opacity-60"
          style={{ backgroundColor: WA.accent }}
          aria-label="Enviar"
        >
          {inputValue.trim() && canType ? <Send className="h-5 w-5" style={{ color: '#0b141a' }} /> : <Mic className="h-5 w-5" style={{ color: '#0b141a' }} />}
        </button>
      </div>

      {/* Pagamento online — mesmo modal das outras páginas */}
      {paymentInfo && establishment && (
        <PaymentModal
          isOpen
          onClose={() => void handlePaymentModalClose()}
          appointmentId={paymentInfo.appointmentId}
          amount={paymentInfo.requirement.chargeAmount}
          initialMethod={preferredPayMethod || undefined}
          establishmentId={establishment.id}
          recipientId={paymentInfo.requirement.pagarmeRecipientId || undefined}
          customerData={{ name: form.clientName, phone: form.clientWhatsapp }}
          cancelAppointmentOnFailure={!paymentInfo.requirement.permitePagamentoOpcional}
          includesPlatformFee={paymentInfo.requirement.cobrarTaxaCliente}
          onPaymentSuccess={() => void handlePaymentSuccess()}
          onPaymentFailure={() => toast.error('Pagamento não confirmado. Tente novamente.')}
        />
      )}

      {/* Renovação de assinatura vencida — mesmo modal das outras páginas */}
      {showRenewModal && renewalPlan && establishment && (
        <SubscriptionPixModal
          isOpen={showRenewModal}
          onClose={() => {
            setShowRenewModal(false);
            // Re-verifica o telefone: se a renovação foi paga, entra como assinante ativo
            setInputValue(formRef.current.clientWhatsapp);
            void handleSubmitPhone();
          }}
          initialPrefill={{
            name: String(expiredSubscriber?.subscriber_name || form.clientName || '').trim(),
            whatsapp: String(expiredSubscriber?.subscriber_whatsapp || expiredSubscriber?.client_whatsapp || form.clientWhatsapp || '').trim(),
          }}
          establishmentId={String(establishment.id || '')}
          recipientId={String(establishment.pagarme_recipient_id || '')}
          establishmentName={String(establishment.name || 'este estabelecimento')}
          establishmentWhatsapp={String(establishment.whatsapp || '')}
          subscription={{
            id: String(renewalPlan.id),
            name: String(renewalPlan.name || 'Assinatura'),
            value: Number(renewalPlan.value || 0),
            duration_months: renewalPlan.duration_months ?? null,
          }}
          allowedPix={Boolean(renewalPlan?.payment_pix_enabled ?? true)}
          allowedCard={Boolean(renewalPlan?.payment_card_enabled ?? true)}
          initialFlow="default"
          externalPaymentLink={String(renewalPlan.custom_link || '').trim() || undefined}
          paymentProvider={
            Boolean(establishment?.use_mercadopago_subscription_pix === true) && establishmentHasMercadoPago(establishment)
              ? 'mercadopago'
              : 'pagarme'
          }
        />
      )}
    </div>
  );
};

export default BookingChatPage;
