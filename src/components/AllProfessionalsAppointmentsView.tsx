import { addDays, format, isSameDay, parse, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, Coins, Crown, Eye, EyeOff, Lock, Package, Phone, Plus, Trash2, User, UserPlus, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { buildSubscriberAttendanceSnapshotFields, computeSubscriberRepassValue, findClientSubscriptionForAppointment, findExistingSubscriberAttendance, insertSubscriberAttendanceOnce, removeSubscriberAttendanceForCancelledAppointment, resolveAppointmentProfessionalForSubscriber } from '../lib/subscriberSystem';
import {
  buildCompletionPaymentPatch,
  buildSubscriptionsByNameMap,
  buildSubscriptionsByPhoneMap,
  clientNameHasSubscriberLabel,
  enrichAppointmentsWithSubscriberFlags,
  findMatchingSubscriptionForAppointment,
  findMatchingSubscriptionRelaxed,
  formatSubscriberAgendaClientName,
  isDateInsidePaidSubscription,
  isSubscriberAppointmentForAgendaDisplay,
  isSubscriberAppointmentForProfessionalControl,
  isSubscriberAppointmentFromFields,
  parseSubscriberBoolean,
  resolveEffectivePaymentMethod,
  sanitizeAppointmentServiceDisplay,
  type ClientSubscriptionRowLite,
} from '../lib/subscriberAppointmentFlags';
import { CANCELLATION_SOURCE, describeCancellationSourcePt, updateAppointmentCancelledWithSource } from '../utils/appointmentCancellationMeta';
import { getEffectiveAppointmentBaseDurationMinutes } from '../utils/effectiveAppointmentDuration';
import { isUsageInContinuousWindow, resolveContinuousUsageWindow } from '../utils/subscriptionUsagePeriod';
import {
  buildExclusiveProfessionalBookingLink,
  isExclusiveBookingLinkEnabledForProfessional,
} from '../utils/exclusiveProfessionalBookingLink';
import { openWhatsAppWithBusinessPriority } from '../utils/whatsapp';
import { resolveAuditActorName } from '../lib/appointmentAuditLog';
import { isServicePaymentSource } from '../lib/professionalPaymentSources';
import { AppointmentAuditTimeline } from './AppointmentAuditTimeline';
import { ChangeAppointmentServiceModal } from './ChangeAppointmentServiceModal';
import { ProfessionalInfoModal } from './ProfessionalInfoModal';
import { RescheduleAppointmentModal } from './RescheduleAppointmentModal';
import { SqueezeServicePickerModal } from './SqueezeServicePickerModal';
import { useToast } from './ui/Toaster';
import { ValidityDisplay } from './ValidityDisplay';

interface Professional {
  id: string;
  name: string;
  photo_url?: string;
  percentage?: number;
  goal?: number;
  hide_gross_in_financial?: boolean;
  lock_appointments_with_owner_pin?: boolean;
  lock_financial_with_owner_pin?: boolean;
  exclusive_booking_link_disabled?: boolean;
}

interface ProfessionalPin {
  professional_id: string;
  pin: string;
}

/** Chave estável para cruzar nome do profissional (agenda x assinantes), ignorando emojis/acentos. */
const normalizeProfessionalNameKey = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

interface AdditionalProduct {
  name: string;
  price: number;
  // Duração extra (em minutos) para somar à duração base do agendamento e bloquear horários
  duration?: number;
}

interface SoldProduct {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PaymentSplitDetail {
  method: string;
  amount: number;
  card_brand?: string | null;
}

interface Appointment {
  id: string;
  client_id: string;
  client_name: string;
  client_whatsapp?: string;
  client_cpf?: string;
  client_street?: string;
  service: string;
  professional: string;
  professional_id?: string;
  professional_name?: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  duration: number;
  price: number;
  total_price?: number;
  payment_method?: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'transferencia' | 'pagar_local' | 'multi' | 'assinante';
  card_brand?: string;
  payment_split_details?: PaymentSplitDetail[] | null;
  pix_payment_status?: string;
  pix_proof_url?: string;
  additional_products?: AdditionalProduct[];
  sold_products?: SoldProduct[];
  observation?: string;
  establishment_observation?: string;
  is_premium?: boolean;
  is_subscriber?: boolean;
  /** Benefício gratuito do programa de fidelidade (não assinante). */
  is_loyalty_reward?: boolean;
  subscription_id?: string | null;
  is_child_service?: boolean;
  is_avulso?: boolean;
  is_squeeze?: boolean; // Indica se é um encaixe
  created_at?: string;
  is_establishment_booking?: boolean;
  /** Gorjeta 100% para o profissional (fora da % do serviço) */
  professional_tip_amount?: number | null;
  manual_status_override?: boolean | null;
  cancellation_source?: string | null;
  cancellation_detail?: string | null;
}

interface ProfessionalServiceInsight {
  name: string;
  count: number;
  gross: number;
  sharePercent: number;
}

interface ProfessionalCancelledInsight {
  totalCancelled: number;
  lostGross: number;
  lostNet: number;
  byService: ProfessionalServiceInsight[];
}

interface ProfessionalTopClientInsight {
  name: string;
  count: number;
  gross: number;
  lastAppointmentDate: string;
}

interface ServiceSubcategoryLabel {
  name: string;
  label_name?: string;
  label_color?: string;
}

interface TimeSlot {
  time: string;
  appointment?: Appointment;
  isEmpty: boolean;
  isOccupied: boolean;
  isBlocked: boolean;
  isPast?: boolean;
  parentAppointment?: Appointment;
  squeezes?: Appointment[]; // Encaixes para este slot
}

function timeToMinutesHM(t: string): number {
  const parts = String(t || '0:0').split(':');
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

function getProfessionalDayEndAndBreak(
  professional: Professional,
  businessHours: {
    [key: string]: {
      enabled: boolean;
      open1: string;
      close1: string;
      open2: string | null;
      close2: string | null;
    };
  },
  selectedDate: Date
): { endTime: string; breakRange: { start: string; end: string } | null } | null {
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    selectedDate.getDay()
  ];
  const dayHours = businessHours[dayOfWeek];
  if (!dayHours?.enabled) return null;
  const professionalWorkHours = (professional as any).work_hours?.[dayOfWeek];
  let endTime: string;
  let breakRange: { start: string; end: string } | null = null;
  if (professionalWorkHours?.enabled) {
    endTime = professionalWorkHours.exit_time || dayHours.close1;
    if (professionalWorkHours.break_start && professionalWorkHours.break_end) {
      breakRange = {
        start: String(professionalWorkHours.break_start),
        end: String(professionalWorkHours.break_end),
      };
    }
  } else {
    endTime = dayHours.close1;
  }
  return { endTime, breakRange };
}

/** Tempo livre (min) a partir do slot até o próximo conflito na grade ou fim do expediente (com teto no intervalo/almoço). */
function computeMaxReserveMinutesFromSlotGrid(
  timeSlots: TimeSlot[],
  slotTime: string,
  dayEndHHmm: string,
  breakRange: { start: string; end: string } | null
): number {
  const startM = timeToMinutesHM(slotTime);
  let boundaryM = timeToMinutesHM(dayEndHHmm);
  const sorted = [...timeSlots].sort((a, b) => timeToMinutesHM(a.time) - timeToMinutesHM(b.time));
  for (const s of sorted) {
    const t = timeToMinutesHM(s.time);
    if (t <= startM) continue;
    if (!s.isEmpty) {
      boundaryM = Math.min(boundaryM, t);
      break;
    }
  }
  let maxMin = Math.max(0, boundaryM - startM);
  if (breakRange) {
    const bs = timeToMinutesHM(breakRange.start);
    if (startM < bs && startM + maxMin > bs) {
      maxMin = Math.max(0, bs - startM);
    }
  }
  return maxMin;
}

interface SqueezeKnownClientOption {
  id: string;
  client_id?: string;
  name: string;
  whatsapp: string;
}

interface SqueezeSubscriberClientOption {
  id: string;
  client_id?: string;
  name: string;
  whatsapp: string;
  subscription_id: string;
}

interface AppointmentChangeLog {
  id: string;
  event_type: string;
  description?: string | null;
  changed_by_name?: string | null;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  created_at: string;
}

interface ProfessionalGoalMonthlyConfig {
  goalAmount: number;
  bonusPercentage: number;
  selectedServiceNames: string[];
}

interface AllProfessionalsAppointmentsViewProps {
  professionals: Professional[];
  appointments: Appointment[];
  monthlyAppointments: Appointment[];
  /** Telefones normalizados de clientes recorrentes (≥1 concluído). null = ainda carregando. */
  returningClientPhones?: Set<string> | null;
  selectedDate: Date;
  professionalPins?: ProfessionalPin[];
  businessHours: {
    [key: string]: {
      enabled: boolean;
      open1: string;
      close1: string;
      open2: string | null;
      close2: string | null;
    };
  };
  establishment?: any;
  onDateChange: (date: Date) => void;
  onAppointmentUpdate?: () => void;
  onOpenTransferModal?: (appointment: Appointment) => void;
  onOpenObservationModal?: (appointmentId: string, currentObservation?: string) => void;
  onOpenAdditionalProductModal?: (appointmentId: string) => void;
  onOpenProductV2Modal?: (appointmentId: string) => void;
  onProfessionalPhotoChange?: (professionalId: string, file: File | undefined) => Promise<void> | void;
  onProfessionalPhotoRemove?: (professionalId: string) => Promise<void> | void;
  onGenerateNF?: (appointment: Appointment) => void;
  onOpenReminderModal?: (appointment: Appointment) => void;
  onSendThankYou?: (appointment: Appointment) => void;
  /**
   * 💳 Cobrança PIX de balcão. Opcionais de propósito: sem eles o botão
   * simplesmente não aparece e esta tela continua como sempre foi.
   */
  canChargeAppointmentLocally?: (appointment: any) => boolean;
  localChargesByAppointment?: Record<string, { status?: string }>;
  onChargeClient?: (appointment: any) => void;
  onOpenFinishEarlyModal?: (appointment: Appointment) => void;
  onGoToProfessionalConfig?: (professionalId: string) => void;
  onOpenBlockHoursModal?: (professionalId: string) => void;
  /** Bloqueia/desbloqueia um único slot (mesmo `blocked_hours` do modal), só no dia visível. */
  onToggleProfessionalSlotBlocked?: (params: {
    professionalId: string;
    dateKey: string;
    time: string;
    block: boolean;
  }) => Promise<void>;
  onOpenAbsenceModal?: (professionalId: string) => void;
  onGoToClients?: (professionalId?: string) => void;
  /** Abre Reservar Cliente com data/hora do slot e limite de duração até o próximo conflito/expediente. */
  onOpenReserveFromSlot?: (params: {
    professionalId: string;
    dateKey: string;
    time: string;
    maxDurationMinutes: number;
  }) => void;
  onCancelAppointment?: (appointmentId: string) => void;
  onOpenQuickSubscriberModal?: (professionalId?: string) => void;
  /** Venda avulsa de produto já com este profissional selecionado (mesma venda de "Meus produtos"). */
  onOpenSellProduct?: (professionalId: string, professionalName: string) => void;
  onClientNoShow?: (appointment: Appointment) => void;
  onAppointmentDetailsOpen?: () => void;
  use15MinuteInterval?: boolean;
  use20MinuteSchedule?: boolean;
  use60MinuteSchedule?: boolean;
  useLightLayout?: boolean;
  realIsLight?: boolean;
  /** WhatsApp tinha sessão e caiu (connecting/reconnecting/error) — mostra alerta acima da validade. */
  whatsappAlert?: boolean;
  whatsappSilentAlert?: boolean;
  whatsappSilentAlertCount?: number;
  onOpenWhatsAppReminders?: () => void;
  canViewBarbershopCash?: boolean;
  pendingOpenBarbershopCash?: boolean;
  onConsumePendingOpenBarbershopCash?: () => void;
  onRequestBarbershopCashAccess?: () => void;
  serviceSubcategories?: ServiceSubcategoryLabel[];
  unlockedAppointmentsByProfessional?: Record<string, boolean>;
  unlockedFinancialByProfessional?: Record<string, boolean>;
  onRequestAppointmentsUnlock?: (professionalId: string) => void;
  onRequestFinancialUnlock?: (professionalId: string) => void;
  onRefreshDormantClientsSource?: () => Promise<void> | void;
  dormantClientsByProfessional?: Record<string, Array<{
    name: string;
    whatsapp: string;
    lastVisitDate: string;
    daysWithoutBooking: number;
    favoriteService: string;
    totalSpent: number;
    appointmentCount: number;
  }>>;
  forceProfessionalId?: string | null;
  isCollaboratorView?: boolean;
  collaboratorAllowedAgendaIds?: string[];
  isSecretaryModeActive?: boolean;
  bypassOwnerPinLocks?: boolean;
  bypassFinancialPinForProfessionalId?: string | null;
  hiddenProfessionalIds?: string[];
  /** Nome exibido no histórico de auditoria (ex.: profissional logado no PIN). */
  auditActorName?: string | null;
  /** Lista de produtos do estoque, usada para exibir comissão por profissional no Caixa/Geral. */
  establishmentProducts?: Array<{ id: string; name: string; commission_percentages?: Record<string, number> }>;
  /** Líquido de produtos por profissional (nome -> valor), já calculado em "Meus Produtos". */
  productPayoutByProfessionalName?: Record<string, number>;
  /** Mesmo valor, restrito ao dia selecionado. */
  productPayoutTodayByProfessionalName?: Record<string, number>;
}

export const AllProfessionalsAppointmentsView: React.FC<
  AllProfessionalsAppointmentsViewProps
> = ({
  professionals,
  appointments,
  monthlyAppointments,
  returningClientPhones,
  selectedDate,
  professionalPins = [],
  businessHours,
  establishment,
  onDateChange,
  onAppointmentUpdate,
  onOpenTransferModal,
  onOpenObservationModal,
  onOpenAdditionalProductModal,
  onOpenProductV2Modal,
  onProfessionalPhotoChange,
  onProfessionalPhotoRemove,
  onGenerateNF,
  onOpenReminderModal,
  onSendThankYou,
  canChargeAppointmentLocally,
  localChargesByAppointment,
  onChargeClient,
  onOpenFinishEarlyModal,
  onGoToProfessionalConfig,
  onOpenBlockHoursModal,
  onToggleProfessionalSlotBlocked,
  onOpenAbsenceModal,
  onGoToClients,
  onOpenReserveFromSlot,
  onCancelAppointment,
  onOpenQuickSubscriberModal,
  onOpenSellProduct,
  onClientNoShow,
  onAppointmentDetailsOpen,
  use15MinuteInterval,
  use20MinuteSchedule,
  use60MinuteSchedule,
  useLightLayout = false,
  realIsLight = false,
  whatsappAlert = false,
  whatsappSilentAlert = false,
  whatsappSilentAlertCount = 0,
  onOpenWhatsAppReminders,
  canViewBarbershopCash = false,
  pendingOpenBarbershopCash = false,
  onConsumePendingOpenBarbershopCash,
  onRequestBarbershopCashAccess,
  serviceSubcategories = [],
  unlockedAppointmentsByProfessional = {},
  unlockedFinancialByProfessional = {},
  onRequestAppointmentsUnlock,
  onRequestFinancialUnlock,
  onRefreshDormantClientsSource,
  dormantClientsByProfessional = {},
  forceProfessionalId = null,
  isCollaboratorView = false,
  collaboratorAllowedAgendaIds = [],
  isSecretaryModeActive = false,
  bypassOwnerPinLocks = false,
  bypassFinancialPinForProfessionalId = null,
  hiddenProfessionalIds = [],
  auditActorName = null,
  establishmentProducts = [],
  productPayoutByProfessionalName = {},
  productPayoutTodayByProfessionalName = {},
}) => {
    const { toast } = useToast();
    const { user } = useAuth();

    const normalizeProfessionalPercentage = (raw: unknown): number => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return 100;
      if (parsed < 0) return 0;
      if (parsed > 100) {
        const legacyScaled = parsed / 10;
        if (legacyScaled <= 100) return legacyScaled;
        return 100;
      }
      return parsed;
    };

    const isOwnerProfessional = (professional?: { percentage?: unknown } | null): boolean => {
      return normalizeProfessionalPercentage(professional?.percentage) === 100;
    };

    const normalizeServiceToken = (value: unknown): string =>
      String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const resolveGoalSelectedServiceNames = (selectedServices: string[]): string[] => {
      const safeSelected = Array.isArray(selectedServices) ? selectedServices : [];
      const byKey = new Map<string, string>();
      const byNameNormalized = new Map<string, string>();

      const establishmentServices = Array.isArray(establishment?.services_with_prices)
        ? establishment.services_with_prices
        : [];

      establishmentServices.forEach((service: any) => {
        const key = String(service?.id || '').trim();
        const name = String(service?.name || '').trim();
        if (key && name) byKey.set(key, name);
        if (name) byNameNormalized.set(normalizeServiceToken(name), name);
      });

      (serviceSubcategories || []).forEach((subcategory: any) => {
        const key = `subcategory_${String(subcategory?.id || '').trim()}`;
        const name = String(subcategory?.name || '').trim();
        if (key && name) byKey.set(key, name);
        if (name) byNameNormalized.set(normalizeServiceToken(name), name);
      });

      return safeSelected
        .map((raw) => {
          const key = String(raw || '').trim();
          if (!key) return '';
          return byKey.get(key) || byNameNormalized.get(normalizeServiceToken(key)) || key;
        })
        .map((name) => String(name || '').trim())
        .filter(Boolean);
    };

    const DEFAULT_PAYMENT_METHODS = ['pix', 'credito', 'debito', 'dinheiro', 'pagar_local'] as const;
    const defaultPaymentMethodSet = new Set<string>(DEFAULT_PAYMENT_METHODS as unknown as string[]);
    const getCustomPaymentMethods = (): string[] => {
      const enabled = Array.isArray(establishment?.payment_methods_enabled)
        ? (establishment.payment_methods_enabled as any[])
        : [];
      return enabled
        .map((m) => String(m || '').trim())
        .filter((m) => m.length > 0 && !defaultPaymentMethodSet.has(m));
    };
    const [modalAptId, setModalAptId] = useState<string | null>(null);
    const [agendaSubscriberRows, setAgendaSubscriberRows] = useState<ClientSubscriptionRowLite[]>([]);
    const [hiddenAppointmentsOpenByProfessional, setHiddenAppointmentsOpenByProfessional] = useState<Record<string, boolean>>({});
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(
      professionals.length > 0 ? professionals[0].id : ''
    );
    const [visibleProfessionalIds, setVisibleProfessionalIds] = useState<string[]>([]);
    const [selectedProfessionalForInfo, setSelectedProfessionalForInfo] = useState<string | null>(null);
    const [modalViewingMonth, setModalViewingMonth] = useState<Date | null>(null);
    const [pastMonthPendingForModal, setPastMonthPendingForModal] = useState<number | null>(null);
    const [pastMonthValidPaidForModal, setPastMonthValidPaidForModal] = useState<number | null>(null);
    const [selectedProfessionalForPhotoModal, setSelectedProfessionalForPhotoModal] = useState<string | null>(null);
    const [isUpdatingProfessionalPhoto, setIsUpdatingProfessionalPhoto] = useState(false);
    const [showColorLegend, setShowColorLegend] = useState<'red' | 'yellow' | 'green' | 'gold' | null>(null);
    const [showReminderInfo, setShowReminderInfo] = useState(false);
    const [showPendingWarning, setShowPendingWarning] = useState(false);
    const [collapsedMenuProfessionals, setCollapsedMenuProfessionals] = useState<Set<string>>(() => {
      try {
        const saved = localStorage.getItem('prof_menu_collapsed');
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch { return new Set(); }
    });
    const toggleProfessionalMenu = (profId: string) => {
      setCollapsedMenuProfessionals((prev) => {
        const next = new Set(prev);
        if (next.has(profId)) { next.delete(profId); } else { next.add(profId); }
        try { localStorage.setItem('prof_menu_collapsed', JSON.stringify([...next])); } catch {}
        return next;
      });
    };
    const [showMonthPendingModal, setShowMonthPendingModal] = useState(false);
    const [monthPendingAppointments, setMonthPendingAppointments] = useState<Appointment[]>([]);
    const [isLoadingMonthPending, setIsLoadingMonthPending] = useState(false);
    const [monthPendingFilterDate, setMonthPendingFilterDate] = useState('');
    const [showCancelledHistoryModal, setShowCancelledHistoryModal] = useState(false);
    const [exclusiveLinkModalProfessional, setExclusiveLinkModalProfessional] = useState<Professional | null>(null);
    const [showStatusDetailsModal, setShowStatusDetailsModal] = useState(false);
    const [statusDetailsRows, setStatusDetailsRows] = useState<Appointment[]>([]);
    const [statusDetailsType, setStatusDetailsType] = useState<'pending' | 'completed'>('pending');
    const [statusDetailsProfessionalName, setStatusDetailsProfessionalName] = useState('');
    const [statusDetailsDate, setStatusDetailsDate] = useState('');
    const [cancelledHistoryRows, setCancelledHistoryRows] = useState<Appointment[]>([]);
    const [cancelledHistoryProfessionalName, setCancelledHistoryProfessionalName] = useState('');
    const [cancelledHistoryDate, setCancelledHistoryDate] = useState('');
    const [editingAppointmentValue, setEditingAppointmentValue] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');
    const [appointmentContactById, setAppointmentContactById] = useState<Record<string, { cpf?: string; street?: string }>>({});
    const [editingContactAppointmentId, setEditingContactAppointmentId] = useState<string | null>(null);
    const [editingContactCpf, setEditingContactCpf] = useState('');
    const [editingContactStreet, setEditingContactStreet] = useState('');
    const [isSavingAppointmentContact, setIsSavingAppointmentContact] = useState(false);
    const [editingAvulsoNameId, setEditingAvulsoNameId] = useState<string | null>(null);
    const [editingAvulsoNameValue, setEditingAvulsoNameValue] = useState<string>('');
    const [localClientNameOverrides, setLocalClientNameOverrides] = useState<Record<string, string>>({});
    const [squeezeNameDrafts, setSqueezeNameDrafts] = useState<Record<string, string>>({});
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedAppointmentForReschedule, setSelectedAppointmentForReschedule] = useState<Appointment | null>(null);
    const [showChangeServiceModal, setShowChangeServiceModal] = useState(false);
    const [selectedAppointmentForServiceChange, setSelectedAppointmentForServiceChange] = useState<Appointment | null>(null);
    const [showAppointmentHistoryModal, setShowAppointmentHistoryModal] = useState(false);
    const [selectedAppointmentForHistory, setSelectedAppointmentForHistory] = useState<Appointment | null>(null);
    // Quando o agendamento foi CRIADO (dia/hora que o cliente agendou) — a lista da
    // agenda nem sempre carrega created_at, então o modal busca por id se faltar.
    const [appointmentHistoryCreatedAt, setAppointmentHistoryCreatedAt] = useState<string | null>(null);
    const [appointmentHistoryRows, setAppointmentHistoryRows] = useState<AppointmentChangeLog[]>([]);
    const [isLoadingAppointmentHistory, setIsLoadingAppointmentHistory] = useState(false);
    const [showSubscriberAttendanceModal, setShowSubscriberAttendanceModal] = useState(false);
    const [tipModalAppointment, setTipModalAppointment] = useState<Appointment | null>(null);
    const [tipModalInput, setTipModalInput] = useState('');
    const [isSavingProfessionalTip, setIsSavingProfessionalTip] = useState(false);
    const [subscriberOptions, setSubscriberOptions] = useState<Array<{
      id: string;
      display_name: string;
      whatsapp: string;
      plan_name?: string;
      monthly_limit?: number | null;
    }>>([]);
    const [subscriberOptionsLoading, setSubscriberOptionsLoading] = useState(false);
    const [subscriberSearch, setSubscriberSearch] = useState('');
    const [selectedSubscriberOptionId, setSelectedSubscriberOptionId] = useState<string>('');
    const [slotBlockBusyKey, setSlotBlockBusyKey] = useState<string | null>(null);
    const [quickSlotActionModal, setQuickSlotActionModal] = useState<{
      professionalId: string;
      professionalName: string;
      time: string;
      dateKey: string;
      maxReserveMinutes: number;
      canReserve: boolean;
      canBlock: boolean;
      isPast: boolean;
    } | null>(null);
    const [selectedAppointmentForSubscriberAttendance, setSelectedAppointmentForSubscriberAttendance] = useState<Appointment | null>(null);
    const [isSavingSubscriberAttendance, setIsSavingSubscriberAttendance] = useState(false);
    const [showBarbershopCashModal, setShowBarbershopCashModal] = useState(false);
    const [barbershopCashOpeningInput, setBarbershopCashOpeningInput] = useState('');
    const [barbershopCashOpeningValue, setBarbershopCashOpeningValue] = useState(0);
    const [barbershopCashRealInput, setBarbershopCashRealInput] = useState('');
    const [isLoadingBarbershopCashOpening, setIsLoadingBarbershopCashOpening] = useState(false);
    const [isSavingBarbershopCashOpening, setIsSavingBarbershopCashOpening] = useState(false);
    const [barbershopCashFeatureUnavailable, setBarbershopCashFeatureUnavailable] = useState(false);
    const [barbershopCashHistoryLoading, setBarbershopCashHistoryLoading] = useState(false);
    const [barbershopCashHistory, setBarbershopCashHistory] = useState<Array<{
      cash_date: string;
      opening_amount: number;
      updated_at?: string;
    }>>([]);
    // Assinaturas do estabelecimento para exibir duração correta de agendamentos de assinante
    const [subscriptionDurations, setSubscriptionDurations] = useState<Array<{
      id: string;
      name: string;
      service_duration: number;
      divide_services_enabled: boolean;
      divided_services: Array<{ name: string; duration: number }>;
      label_color?: string | null;
    }>>([]);
    const [showSplitPaymentModal, setShowSplitPaymentModal] = useState(false);
    const [selectedAppointmentForSplitPayment, setSelectedAppointmentForSplitPayment] = useState<Appointment | null>(null);
    const [splitPaymentRows, setSplitPaymentRows] = useState<Array<{ method: string; amount: string; card_brand?: string }>>([]);
    const [isSavingSplitPayment, setIsSavingSplitPayment] = useState(false);
    const [subscriberFinancialByProfessional, setSubscriberFinancialByProfessional] = useState<
      Record<string, {
        accumulated: number;
        paid: number;
        pending: number;
        attendanceCount: number;
        uniqueClientsCount: number;
        saleCommissionCount: number;
        dailyAttendanceCount: number;
        dailyAccumulated: number;
      }>
    >({});
    const [professionalGoalConfigs, setProfessionalGoalConfigs] = useState<Record<string, ProfessionalGoalMonthlyConfig>>({});
    const selectedDateIso = format(selectedDate, 'yyyy-MM-dd');
    const professionalVisibilityStorageKey = establishment?.id
      ? `agendeifacil:appointments-visible-professionals:${establishment.id}`
      : '';
    const professionalVisibilityLoadedKeyRef = useRef('');
    const datePickerContainerRef = useRef<HTMLDivElement>(null);
    const datePickerInputRef = useRef<HTMLInputElement>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const hasOwnerConfigPin = Boolean(
      establishment?.pin_password &&
      String(establishment.pin_password || '').trim().length > 0 &&
      String(establishment.pin_password || '').trim() !== '0000'
    );
    const [pendingVisibilityUnlockProfessionalId, setPendingVisibilityUnlockProfessionalId] = useState<string | null>(null);
    const collaboratorVisibilitySignatureRef = useRef<string>('');
    const hiddenProfessionalIdSet = useMemo(
      () => new Set((hiddenProfessionalIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
      [hiddenProfessionalIds]
    );

    const hasValidProfessionalAppointmentPin = (professionalId: string): boolean => {
      const normalizedId = String(professionalId || '').trim();
      if (!normalizedId) return false;
      const pin = String(
        professionalPins.find((item) => String(item?.professional_id || '').trim() === normalizedId)?.pin ||
        establishment?.professionals_pins?.find((item: ProfessionalPin) => String(item?.professional_id || '').trim() === normalizedId)?.pin ||
        ''
      ).trim();
      return /^\d{4}$/.test(pin) && pin !== '0000';
    };

    const isProfessionalAppointmentsProtected = (professional: Professional): boolean => {
      if (bypassOwnerPinLocks) return false;
      // Agenda liberada explicitamente para este colaborador/secretaria ver: o dono já autorizou na configuração,
      // então não exige de novo a senha do dono para abrir.
      if (isCollaboratorView) {
        const targetId = String(professional?.id || '').trim();
        const isAllowedAgenda = (collaboratorAllowedAgendaIds || [])
          .map((id) => String(id || '').trim())
          .includes(targetId);
        if (isAllowedAgenda) return false;
      }
      return Boolean((professional as any)?.lock_appointments_with_owner_pin) && hasValidProfessionalAppointmentPin(professional.id);
    };

    const isProfessionalAppointmentsUnlocked = (professionalId: string): boolean =>
      Boolean(unlockedAppointmentsByProfessional[String(professionalId || '').trim()]);

    const canShowProfessionalInAgenda = (professional: Professional): boolean => {
      if (hiddenProfessionalIdSet.has(String(professional?.id || '').trim())) return false;
      if (!isProfessionalAppointmentsProtected(professional)) return true;
      return isProfessionalAppointmentsUnlocked(professional.id);
    };

    const getSelectableProfessionalIds = () =>
      professionals
        .filter(canShowProfessionalInAgenda)
        .map((professional) => String(professional.id || '').trim())
        .filter(Boolean);

    const persistProfessionalVisibilityPreference = (professionalIds: string[]) => {
      if (!professionalVisibilityStorageKey) return;
      professionalVisibilityLoadedKeyRef.current = professionalVisibilityStorageKey;
      try {
        localStorage.setItem(professionalVisibilityStorageKey, JSON.stringify(professionalIds));
      } catch {
        // Preferencia local opcional; se o navegador bloquear, a agenda continua funcionando.
      }
    };

    useEffect(() => {
      if (isCollaboratorView) return;
      const currentIds = professionals.map((professional) => String(professional.id || '').trim()).filter(Boolean);
      if (currentIds.length === 0) {
        setVisibleProfessionalIds([]);
        return;
      }
      const selectableIds = getSelectableProfessionalIds();

      let savedIds: string[] | null = null;
      let hasSavedPreference = false;
      if (professionalVisibilityStorageKey) {
        try {
          const raw = localStorage.getItem(professionalVisibilityStorageKey);
          hasSavedPreference = raw !== null;
          const parsed = raw ? JSON.parse(raw) : null;
          if (Array.isArray(parsed)) {
            savedIds = parsed.map((id) => String(id || '').trim()).filter(Boolean);
          }
        } catch {
          savedIds = null;
        }
      }

      const nextIds = hasSavedPreference && savedIds && savedIds.length > 0
        ? savedIds.filter((id) => currentIds.includes(id))
        : selectableIds;

      setVisibleProfessionalIds(nextIds);
      professionalVisibilityLoadedKeyRef.current = professionalVisibilityStorageKey || 'no-storage-key';
    }, [
      professionals,
      professionalVisibilityStorageKey,
      unlockedAppointmentsByProfessional,
      professionalPins,
      establishment?.professionals_pins,
      hiddenProfessionalIdSet,
      isCollaboratorView,
    ]);

    const visibleProfessionals = useMemo(
      () =>
        visibleProfessionalIds.length > 0
          ? professionals.filter((professional) => (
            visibleProfessionalIds.includes(String(professional.id || '').trim()) &&
            canShowProfessionalInAgenda(professional)
          ))
          : [],
      [professionals, visibleProfessionalIds, unlockedAppointmentsByProfessional, hiddenProfessionalIdSet]
    );

    useEffect(() => {
      if (visibleProfessionals.length === 0) return;
      if (!visibleProfessionals.some((professional) => professional.id === selectedProfessionalId)) {
        setSelectedProfessionalId(visibleProfessionals[0].id);
      }
    }, [selectedProfessionalId, visibleProfessionals]);

    useEffect(() => {
      const establishmentId = String(establishment?.id || '').trim();
      if (!establishmentId) {
        setAgendaSubscriberRows([]);
        return;
      }

      let cancelled = false;
      void (async () => {
        try {
          // Config do plano junto (para o chip de repasse 💰 no card). Se a query rica
          // falhar por qualquer motivo, cai no select original para não perder o selo 👑.
          let { data, error } = await supabase
            .from('client_subscriptions')
            .select(`
              id,
              subscription_id,
              payment_status,
              start_date,
              end_date,
              subscriber_name,
              subscriber_whatsapp,
              client_name_override,
              client_whatsapp,
              monthly_limit,
              subscriptions (
                id,
                name,
                value,
                fixed_commission_value,
                divide_total_enabled,
                divide_total_attendances,
                divided_services
              )
            `)
            .eq('establishment_id', establishmentId);

          if (error) {
            ({ data, error } = await supabase
              .from('client_subscriptions')
              .select(`
                id,
                subscription_id,
                payment_status,
                start_date,
                end_date,
                subscriber_name,
                subscriber_whatsapp,
                client_name_override,
                client_whatsapp
              `)
              .eq('establishment_id', establishmentId));
          }

          if (cancelled) return;
          if (error) throw error;
          setAgendaSubscriberRows(Array.isArray(data) ? (data as ClientSubscriptionRowLite[]) : []);
        } catch (error) {
          console.warn('Falha ao carregar assinantes para selo da agenda:', error);
          if (!cancelled) setAgendaSubscriberRows([]);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [establishment?.id]);

    const appointmentsForDisplay = useMemo(
      () => enrichAppointmentsWithSubscriberFlags(appointments || [], agendaSubscriberRows),
      [appointments, agendaSubscriberRows]
    );

    const isAgendaSubscriberAppointment = useCallback(
      (apt: Appointment | null | undefined) =>
        isSubscriberAppointmentForAgendaDisplay(apt as any, agendaSubscriberRows),
      [agendaSubscriberRows]
    );

    // Repasse do profissional por atendimento de assinatura (chip 💰 no card).
    // Usa os MESMOS matchers e a MESMA fórmula da engine (computeSubscriberRepassValue),
    // então o valor do chip = o valor que entra em Meus Assinantes/modal ao concluir.
    const subscriberRepassMaps = useMemo(
      () => ({
        byPhone: buildSubscriptionsByPhoneMap(agendaSubscriberRows as any[]),
        byName: buildSubscriptionsByNameMap(agendaSubscriberRows as any[]),
      }),
      [agendaSubscriberRows]
    );

    const getSubscriberRepassForAppointment = useCallback(
      (apt: Appointment): number => {
        try {
          const matched =
            findMatchingSubscriptionForAppointment(apt as any, subscriberRepassMaps.byPhone, subscriberRepassMaps.byName) ||
            findMatchingSubscriptionRelaxed(apt as any, subscriberRepassMaps.byPhone, subscriberRepassMaps.byName);
          if (!matched) return 0;
          return computeSubscriberRepassValue({
            subscription: (matched as any)?.subscriptions,
            monthlyLimit: Number((matched as any)?.monthly_limit || 0),
            appointmentPrice: Number((apt as any)?.price || 0),
          });
        } catch {
          return 0;
        }
      },
      [subscriberRepassMaps]
    );

    useEffect(() => {
      if (!pendingVisibilityUnlockProfessionalId) return;
      if (!isProfessionalAppointmentsUnlocked(pendingVisibilityUnlockProfessionalId)) return;
      setVisibleProfessionalIds((current) => {
        if (current.includes(pendingVisibilityUnlockProfessionalId)) return current;
        const next = [...current, pendingVisibilityUnlockProfessionalId];
        persistProfessionalVisibilityPreference(next);
        toast('Preferência salva neste aparelho.', 'success');
        return next;
      });
      setSelectedProfessionalId(pendingVisibilityUnlockProfessionalId);
      setPendingVisibilityUnlockProfessionalId(null);
    }, [pendingVisibilityUnlockProfessionalId, unlockedAppointmentsByProfessional]);

    useEffect(() => {
      if (!isCollaboratorView) return;
      const forcedId = String(forceProfessionalId || '').trim();
      if (!forcedId) return;

      const extraIds = (collaboratorAllowedAgendaIds || [])
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== forcedId)
        .filter((id) => professionals.some((professional) => String(professional.id || '').trim() === id));

      const visibleIds = isSecretaryModeActive
        ? extraIds
        : Array.from(new Set([forcedId, ...extraIds]));

      // Só re-inicializa a visão quando o CONJUNTO de agendas liberadas muda.
      // Assim o colaborador pode ocultar uma agenda pelo X sem ela reaparecer a cada atualização.
      const collaboratorVisibilitySignature = `${isSecretaryModeActive ? 's' : 'c'}:${visibleIds.slice().sort().join(',')}`;
      if (collaboratorVisibilitySignature === collaboratorVisibilitySignatureRef.current) return;
      collaboratorVisibilitySignatureRef.current = collaboratorVisibilitySignature;

      if (visibleIds.length === 0) {
        if (isSecretaryModeActive) {
          setVisibleProfessionalIds([]);
          return;
        }
        setSelectedProfessionalId(forcedId);
        setVisibleProfessionalIds([forcedId]);
        persistProfessionalVisibilityPreference([forcedId]);
        return;
      }

      setSelectedProfessionalId(visibleIds[0]);
      setVisibleProfessionalIds(visibleIds);
      persistProfessionalVisibilityPreference(visibleIds);
    }, [
      isCollaboratorView,
      isSecretaryModeActive,
      forceProfessionalId,
      collaboratorAllowedAgendaIds,
      professionals,
    ]);

    const collaboratorCanToggleAgenda = (professionalId: string): boolean => {
      const normalizedId = String(professionalId || '').trim();
      if (!normalizedId) return false;
      const forcedId = String(forceProfessionalId || '').trim();
      const allowedSet = new Set(
        [forcedId, ...(collaboratorAllowedAgendaIds || []).map((id) => String(id || '').trim())].filter(Boolean)
      );
      return allowedSet.has(normalizedId);
    };

    const toggleProfessionalVisibility = (professionalId: string) => {
      const normalizedId = String(professionalId || '').trim();
      if (!normalizedId) return;
      // Colaborador pode mostrar/ocultar apenas as agendas que tem permissão (a própria + as liberadas pelo dono).
      if (isCollaboratorView && !collaboratorCanToggleAgenda(normalizedId)) return;
      const targetProfessional = professionals.find((professional) => String(professional.id || '').trim() === normalizedId);
      if (!targetProfessional) return;
      const isProtectedAndLocked =
        isProfessionalAppointmentsProtected(targetProfessional) && !isProfessionalAppointmentsUnlocked(normalizedId);

      if (isProtectedAndLocked) {
        setPendingVisibilityUnlockProfessionalId(normalizedId);
        onRequestAppointmentsUnlock?.(normalizedId);
        return;
      }

      setVisibleProfessionalIds((current) => {
        const validIds = professionals.map((professional) => String(professional.id || '').trim()).filter(Boolean);
        const base = current.filter((id) => validIds.includes(id));
        const isVisible = base.includes(normalizedId);

        if (isVisible && base.length <= 1) {
          toast('Deixe pelo menos um profissional aparecendo na agenda.', 'warning');
          return base;
        }

        if (isVisible) {
          const next = base.filter((id) => id !== normalizedId);
          persistProfessionalVisibilityPreference(next);
          toast('Preferência salva neste aparelho.', 'success');
          return next;
        }

        const next = [...base, normalizedId];
        persistProfessionalVisibilityPreference(next);
        toast('Preferência salva neste aparelho.', 'success');
        return next;
      });
    };

    const selectOnlyProfessional = (professionalId: string) => {
      const normalizedId = String(professionalId || '').trim();
      if (!normalizedId) return;
      // Colaborador pode focar apenas nas agendas que tem permissão (a própria + as liberadas pelo dono).
      if (isCollaboratorView && !collaboratorCanToggleAgenda(normalizedId)) return;
      const targetProfessional = professionals.find((professional) => String(professional.id || '').trim() === normalizedId);
      if (!targetProfessional) return;
      const isProtectedAndLocked =
        isProfessionalAppointmentsProtected(targetProfessional) && !isProfessionalAppointmentsUnlocked(normalizedId);
      if (isProtectedAndLocked) {
        setPendingVisibilityUnlockProfessionalId(normalizedId);
        onRequestAppointmentsUnlock?.(normalizedId);
        return;
      }
      persistProfessionalVisibilityPreference([normalizedId]);
      setVisibleProfessionalIds([normalizedId]);
      setSelectedProfessionalId(normalizedId);
      toast('Preferência salva neste aparelho.', 'success');
    };

    const selectAllProfessionals = () => {
      const selectableIds = getSelectableProfessionalIds();
      persistProfessionalVisibilityPreference(selectableIds);
      setVisibleProfessionalIds(selectableIds);
      if (selectableIds.length === 0) {
        toast('Todos os profissionais estão protegidos por senha. Selecione um e digite a senha para exibir.', 'warning');
      } else {
        toast('Preferência salva neste aparelho.', 'success');
      }
    };

    useEffect(() => {
      let cancelled = false;

      const loadProfessionalGoalsForMonth = async () => {
        if (!establishment?.id) {
          if (!cancelled) setProfessionalGoalConfigs({});
          return;
        }

        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth() + 1;

        try {
          let rows: any[] | null = null;
          let error: any = null;

          const withBonus = await supabase
            .from('professional_goals')
            .select('professional_id, goal_amount, selected_services, bonus_percentage')
            .eq('establishment_id', establishment.id)
            .eq('year', year)
            .eq('month', month);

          rows = withBonus.data as any[] | null;
          error = withBonus.error;

          // Compatibilidade: coluna nova ainda não aplicada no banco.
          if (error?.code === '42703') {
            const fallback = await supabase
              .from('professional_goals')
              .select('professional_id, goal_amount, selected_services')
              .eq('establishment_id', establishment.id)
              .eq('year', year)
              .eq('month', month);
            rows = fallback.data as any[] | null;
            error = fallback.error;
          }

          if (error) throw error;

          const nextConfigs: Record<string, ProfessionalGoalMonthlyConfig> = {};
          (rows || []).forEach((row: any) => {
            const professionalId = String(row?.professional_id || '').trim();
            if (!professionalId) return;
            nextConfigs[professionalId] = {
              goalAmount: Number(row?.goal_amount || 0),
              bonusPercentage: Number(row?.bonus_percentage || 0),
              selectedServiceNames: resolveGoalSelectedServiceNames(
                Array.isArray(row?.selected_services) ? row.selected_services : []
              ),
            };
          });

          if (!cancelled) setProfessionalGoalConfigs(nextConfigs);
        } catch (err) {
          console.error('Erro ao carregar metas mensais dos profissionais:', err);
          if (!cancelled) setProfessionalGoalConfigs({});
        }
      };

      void loadProfessionalGoalsForMonth();
      return () => {
        cancelled = true;
      };
    }, [establishment?.id, selectedDate, serviceSubcategories, establishment?.services_with_prices]);

    const writeAppointmentChangeLog = async (params: {
      appointmentId: string;
      eventType: string;
      description: string;
      oldValues?: Record<string, any> | null;
      newValues?: Record<string, any> | null;
      metadata?: Record<string, any> | null;
    }) => {
      const establishmentId = String(establishment?.id || '').trim();
      const appointmentId = String(params.appointmentId || '').trim();
      if (!establishmentId || !appointmentId) return;

      try {
        const payload = {
          establishment_id: establishmentId,
          appointment_id: appointmentId,
          changed_by_user_id: String(user?.id || '').trim() || null,
          changed_by_name: resolveAuditActorName({
            explicitName: auditActorName,
            user,
          }),
          event_type: String(params.eventType || '').trim() || null,
          description: String(params.description || '').trim() || null,
          old_values: params.oldValues || null,
          new_values: params.newValues || null,
          metadata: params.metadata || null,
        };

        const { error } = await (supabase as any).from('appointment_change_logs').insert(payload);
        if (error) {
          const msg = String((error as any)?.message || '').toLowerCase();
          const tableMissing =
            msg.includes('appointment_change_logs') &&
            (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache') || msg.includes('column'));
          if (tableMissing) return;
          console.warn('⚠️ Falha ao gravar histórico do agendamento:', error);
        }
      } catch (logError) {
        console.warn('⚠️ Erro inesperado ao gravar histórico do agendamento:', logError);
      }
    };

    const logAppointmentCardActionClick = async (
      appointment: Appointment,
      action: string,
      description: string,
      metadata?: Record<string, any>
    ) => {
      const appointmentId = String(appointment?.id || '').trim();
      if (!appointmentId) return;
      await writeAppointmentChangeLog({
        appointmentId,
        eventType: 'card_action_clicked',
        description,
        oldValues: {
          status: String(appointment?.status || '').trim() || null,
          payment_method: String((appointment as any)?.payment_method || '').trim() || null,
        },
        newValues: null,
        metadata: {
          action,
          clicked_at: format(new Date(), 'dd/MM/yyyy HH:mm:ss'),
          selected_date: format(selectedDate, 'dd/MM/yyyy'),
          selected_time: String(appointment?.appointment_time || ''),
          ...metadata,
        },
      });
    };

    useEffect(() => {
      if (!establishment?.id) {
        setSubscriptionDurations([]);
        return;
      }
      let cancelled = false;
      (async () => {
        let { data, error } = await supabase
          .from('subscriptions')
          .select('id, name, service_duration, divide_services_enabled, divided_services, label_color')
          .eq('establishment_id', establishment.id);
        if (error && String((error as any)?.message || '').toLowerCase().includes('label_color')) {
          ({ data } = await supabase
            .from('subscriptions')
            .select('id, name, service_duration, divide_services_enabled, divided_services')
            .eq('establishment_id', establishment.id));
        }
        if (cancelled || !data) return;
        setSubscriptionDurations(
          (data || []).map((row: any) => ({
            id: String(row?.id || ''),
            name: String(row?.name ?? '').trim(),
            service_duration: Number(row?.service_duration) || 30,
            divide_services_enabled: Boolean(row?.divide_services_enabled),
            divided_services: Array.isArray(row?.divided_services)
              ? row.divided_services
                .map((service: any) => ({
                  name: String(service?.name ?? '').trim(),
                  duration: Number(service?.duration || 0),
                }))
                .filter((service: any) => service.name && Number.isFinite(service.duration) && service.duration > 0)
              : [],
            label_color: String(row?.label_color || '').trim() || null,
          }))
        );
      })();
      return () => { cancelled = true; };
    }, [establishment?.id]);

    const refreshSubscriberFinancialByProfessional = useCallback(async () => {
      if (!establishment?.id) {
        setSubscriberFinancialByProfessional({});
        return;
      }

      try {
        const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

        const [attendancesResult, saleCommissionsResult, paymentsResult] = await Promise.all([
          supabase
            .from('subscriber_attendances')
            .select('professional_name, professional_id, repass_value, client_subscription_id, attendance_date')
            .eq('establishment_id', establishment.id)
            .gte('attendance_date', format(start, 'yyyy-MM-dd'))
            .lte('attendance_date', format(end, 'yyyy-MM-dd')),
          supabase
            .from('subscription_sale_commissions')
            .select('professional_name, commission_amount')
            .eq('establishment_id', establishment.id)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString()),
          supabase
            .from('professional_payments')
            .select('professional_id, professional_name, amount, payment_source, payment_date, for_month')
            .eq('establishment_id', establishment.id)
            .in('payment_source', ['subscription', 'assinatura'])
            .gte('payment_date', start.toISOString())
            .lte('payment_date', end.toISOString()),
        ]);

        if (attendancesResult.error) throw attendancesResult.error;
        if (saleCommissionsResult.error) throw saleCommissionsResult.error;
        if (paymentsResult.error) throw paymentsResult.error;

        const [subsCfgRes, clientSubsCfgRes] = await Promise.all([
          supabase
            .from('subscriptions')
            .select('id, fixed_commission_value, divide_total_enabled')
            .eq('establishment_id', establishment.id),
          supabase
            .from('client_subscriptions')
            .select('id, subscription_id')
            .eq('establishment_id', establishment.id),
        ]);
        if (subsCfgRes.error) throw subsCfgRes.error;
        if (clientSubsCfgRes.error) throw clientSubsCfgRes.error;

        const parseDivideApptView = (v: unknown): boolean => {
          if (typeof v === 'boolean') return v;
          if (typeof v === 'number') return v === 1;
          const s = String(v ?? '').trim().toLowerCase();
          return s === 'true' || s === '1' || s === 't' || s === 'sim' || s === 'yes' || s === 'on';
        };
        const subscriptionPointsModeApptView = new Map<string, boolean>();
        ((subsCfgRes.data as any[]) || []).forEach((row: any) => {
          const id = String(row?.id || '').trim();
          if (!id) return;
          const fixed = Number(row?.fixed_commission_value || 0);
          const divide = parseDivideApptView(row?.divide_total_enabled);
          subscriptionPointsModeApptView.set(id, !divide && !(fixed > 0));
        });
        const pointsModeByClientSubApptView = new Map<string, boolean>();
        ((clientSubsCfgRes.data as any[]) || []).forEach((row: any) => {
          const cid = String(row?.id || '').trim();
          const sid = String(row?.subscription_id || '').trim();
          if (!cid || !sid) return;
          if (subscriptionPointsModeApptView.get(sid) === true) {
            pointsModeByClientSubApptView.set(cid, true);
          }
        });

        const totalsByName: Record<
          string,
          {
            accumulated: number;
            paid: number;
            attendanceCount: number;
            uniqueClientIds: Set<string>;
            saleCommissionCount: number;
            dailyAttendanceCount: number;
            dailyAccumulated: number;
          }
        > = {};

        const ownerProfessionalNameKeys = new Set(
          (professionals || [])
            .filter((p) => isOwnerProfessional(p))
            .map((p) => normalizeProfessionalNameKey(p?.name || ''))
            .filter(Boolean)
        );

        const ensure = (professionalNameRaw: string) => {
          const name = String(professionalNameRaw || '').trim();
          if (!name) return null;
          const key = normalizeProfessionalNameKey(name);
          if (!key || ownerProfessionalNameKeys.has(key)) return null;
          if (!totalsByName[key]) {
            totalsByName[key] = {
              accumulated: 0,
              paid: 0,
              attendanceCount: 0,
              uniqueClientIds: new Set<string>(),
              saleCommissionCount: 0,
              dailyAttendanceCount: 0,
              dailyAccumulated: 0,
            };
          }
          return key;
        };

        const professionalIdToName: Record<string, string> = {};
        (professionals || []).forEach((p) => {
          const id = String(p?.id || '').trim();
          const name = String(p?.name || '').trim();
          if (id && name) professionalIdToName[id] = name;
        });

        ((attendancesResult.data as any[]) || []).forEach((row: any) => {
            const storedId = String(row?.professional_id || '').trim();
            const storedName = String(row?.professional_name || '').trim();
            const key =
              (storedId && professionalIdToName[storedId]
                ? ensure(professionalIdToName[storedId])
                : null) || ensure(storedName);
            if (!key) return;
          const subId = String(row?.client_subscription_id || '').trim();
          const skipMoneyRepass = Boolean(subId) && pointsModeByClientSubApptView.get(subId) === true;
          const repassValue = skipMoneyRepass ? 0 : Number(row?.repass_value || 0);
          if (repassValue > 0) {
            totalsByName[key].accumulated += repassValue;
          }
          totalsByName[key].attendanceCount += 1;
          if (subId) totalsByName[key].uniqueClientIds.add(subId);

          if (String(row?.attendance_date || '').slice(0, 10) === selectedDateStr) {
            totalsByName[key].dailyAttendanceCount += 1;
            if (repassValue > 0) {
              totalsByName[key].dailyAccumulated += repassValue;
            }
          }
        });

        ((saleCommissionsResult.data as any[]) || []).forEach((row: any) => {
          const key = ensure(String(row?.professional_name || ''));
          if (!key) return;
          totalsByName[key].accumulated += Number(row?.commission_amount || 0);
          totalsByName[key].saleCommissionCount += 1;
        });

        const selectedMonthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;

        ((paymentsResult.data as any[]) || []).forEach((row: any) => {
          const forMonth = String(row?.for_month || '').trim();
          if (forMonth && forMonth !== selectedMonthKey) {
            return;
          }
          const professionalName =
            String(row?.professional_name || '').trim() ||
            professionalIdToName[String(row?.professional_id || '').trim()] ||
            '';
          const key = ensure(professionalName);
          if (!key) return;
          const amount = Number(row?.amount || 0);
          if (amount > 0) totalsByName[key].paid += amount;
        });

        const byProfessionalName = Object.entries(totalsByName).reduce((acc, [key, row]) => {
          acc[key] = {
            accumulated: Math.max(0, Number(row.accumulated || 0)),
            paid: Math.max(0, Number(row.paid || 0)),
            pending: Math.max(0, Number(row.accumulated || 0) - Number(row.paid || 0)),
            attendanceCount: Number(row.attendanceCount || 0),
            uniqueClientsCount: row.uniqueClientIds.size,
            saleCommissionCount: Number(row.saleCommissionCount || 0),
            dailyAttendanceCount: Number(row.dailyAttendanceCount || 0),
            dailyAccumulated: Math.max(0, Number(row.dailyAccumulated || 0)),
          };
          return acc;
        }, {} as Record<string, {
          accumulated: number;
          paid: number;
          pending: number;
          attendanceCount: number;
          uniqueClientsCount: number;
          saleCommissionCount: number;
          dailyAttendanceCount: number;
          dailyAccumulated: number;
        }>);

        setSubscriberFinancialByProfessional(byProfessionalName);
      } catch (error) {
        console.error('Erro ao carregar financeiro de assinaturas por profissional (modal):', error);
        setSubscriberFinancialByProfessional({});
      }
    }, [establishment?.id, selectedDate, professionals]);

    useEffect(() => {
      void refreshSubscriberFinancialByProfessional();
    }, [refreshSubscriberFinancialByProfessional]);

    const getSupabaseErrorMessage = (error: any, fallback: string): string => {
      if (!error) return fallback;
      const message = String(error?.message || '').trim();
      const code = String(error?.code || '').trim();
      const details = String(error?.details || '').trim();
      const hint = String(error?.hint || '').trim();
      return [message || fallback, code ? `code: ${code}` : '', details ? `details: ${details}` : '', hint ? `hint: ${hint}` : '']
        .filter(Boolean)
        .join(' | ');
    };

    const loadBarbershopCashOpening = async () => {
      if (!establishment?.id || !canViewBarbershopCash || barbershopCashFeatureUnavailable) return;

      setIsLoadingBarbershopCashOpening(true);
      try {
        const { data, error } = await supabase
          .from('barbershop_daily_cash')
          .select('opening_amount')
          .eq('establishment_id', establishment.id)
          .eq('cash_date', selectedDateIso)
          .maybeSingle();
        if (error) throw error;
        const opening = Number((data as any)?.opening_amount || 0);
        setBarbershopCashOpeningValue(opening > 0 ? opening : 0);
        setBarbershopCashOpeningInput(opening > 0 ? String(opening) : '');
      } catch (error: any) {
        console.error('Erro ao carregar caixa da barbearia:', error);
        if (String(error?.code || '') === '42P01') {
          setBarbershopCashFeatureUnavailable(true);
          return;
        }
        toast.error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar o caixa da barbearia.'));
      } finally {
        setIsLoadingBarbershopCashOpening(false);
      }
    };

    const loadBarbershopCashHistory = async () => {
      if (!establishment?.id || !canViewBarbershopCash || barbershopCashFeatureUnavailable) return;

      setBarbershopCashHistoryLoading(true);
      try {
        const { data, error } = await supabase
          .from('barbershop_daily_cash')
          .select('cash_date, opening_amount, updated_at')
          .eq('establishment_id', establishment.id)
          .order('cash_date', { ascending: false })
          .limit(20);
        if (error) throw error;

        setBarbershopCashHistory(
          ((data || []) as any[]).map((row) => ({
            cash_date: String(row?.cash_date || ''),
            opening_amount: Number(row?.opening_amount || 0),
            updated_at: row?.updated_at ? String(row.updated_at) : undefined,
          }))
        );
      } catch (error: any) {
        console.error('Erro ao carregar historico de caixa da barbearia:', error);
        if (String(error?.code || '') === '42P01') {
          setBarbershopCashFeatureUnavailable(true);
          return;
        }
        toast.error(getSupabaseErrorMessage(error, 'Nao foi possivel carregar o historico de aberturas.'));
      } finally {
        setBarbershopCashHistoryLoading(false);
      }
    };

    useEffect(() => {
      if (!canViewBarbershopCash) {
        setShowBarbershopCashModal(false);
        return;
      }
      void loadBarbershopCashOpening();
      void loadBarbershopCashHistory();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canViewBarbershopCash, establishment?.id, selectedDateIso]);

    useEffect(() => {
      if (!pendingOpenBarbershopCash) return;
      if (canViewBarbershopCash) {
        setShowBarbershopCashModal(true);
      }
      onConsumePendingOpenBarbershopCash?.();
    }, [pendingOpenBarbershopCash, canViewBarbershopCash, onConsumePendingOpenBarbershopCash]);

    const normalizeSearch = (v: string): string => {
      // remove acentos e padroniza
      return String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    };

    const matchesSubscriberQuery = (s: any, rawQuery: string): boolean => {
      const qRaw = String(rawQuery || '');
      const q = normalizeSearch(qRaw);
      if (!q) return true;

      const qDigits = qRaw.replace(/\D/g, '');
      const wDigits = String(s?.whatsapp || '').replace(/\D/g, '');
      if (qDigits && wDigits.includes(qDigits)) return true;

      const name = normalizeSearch(String(s?.display_name || ''));
      const plan = normalizeSearch(String(s?.plan_name || ''));
      const tokens = q.split(/\s+/).filter(Boolean);
      return tokens.every((t) => name.includes(t) || plan.includes(t));
    };

    const handleOpenRescheduleModal = (apt: Appointment) => {
      setSelectedAppointmentForReschedule(apt);
      setShowRescheduleModal(true);
    };

    const handleCloseRescheduleModal = () => {
      setShowRescheduleModal(false);
      setSelectedAppointmentForReschedule(null);
    };

    const handleOpenChangeServiceModal = (apt: Appointment) => {
      setSelectedAppointmentForServiceChange(apt);
      setShowChangeServiceModal(true);
    };

    const handleCloseChangeServiceModal = () => {
      setShowChangeServiceModal(false);
      setSelectedAppointmentForServiceChange(null);
    };

    const getAppointmentOriginLabel = (apt: Appointment): string => {
      const isInternalByFlag = Boolean((apt as any)?.is_establishment_booking === true);
      const isAvulsoLike = Boolean(apt.is_avulso) || Boolean(apt.is_squeeze);

      if (isInternalByFlag || isAvulsoLike) {
        return 'Interno (criado dentro da barbearia)';
      }

      if (String(apt.client_id || '').trim()) {
        return 'Cliente (booking externo)';
      }

      return 'Origem não identificada (legado)';
    };

    const handleOpenAppointmentHistoryModal = async (apt: Appointment) => {
      const establishmentId = String(establishment?.id || '').trim();
      if (!establishmentId || !apt?.id) {
        toast('Não foi possível carregar o histórico desse agendamento.', 'error');
        return;
      }

      setSelectedAppointmentForHistory(apt);
      setShowAppointmentHistoryModal(true);
      setIsLoadingAppointmentHistory(true);

      // "Agendado em": usa o created_at se a lista já trouxe; senão busca só esse
      // campo por id (leve, sem travar o carregamento dos logs abaixo).
      const aptCreatedAt = String((apt as any)?.created_at || '').trim();
      setAppointmentHistoryCreatedAt(aptCreatedAt || null);
      if (!aptCreatedAt) {
        void supabase
          .from('appointments')
          .select('created_at')
          .eq('id', String(apt.id))
          .maybeSingle()
          .then(({ data: createdRow }) => {
            const value = String((createdRow as any)?.created_at || '').trim();
            if (value) setAppointmentHistoryCreatedAt(value);
          });
      }

      try {
        const { data, error } = await (supabase as any)
          .from('appointment_change_logs')
          .select('id, event_type, description, changed_by_name, old_values, new_values, metadata, created_at')
          .eq('establishment_id', establishmentId)
          .eq('appointment_id', String(apt.id))
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          const msg = String((error as any)?.message || '').toLowerCase();
          const historyTableMissing =
            msg.includes('appointment_change_logs') &&
            (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache') || msg.includes('column'));
          if (historyTableMissing) {
            toast('Histórico ainda não disponível neste banco. Rode a migration nova.', 'warning');
            setAppointmentHistoryRows([]);
            return;
          }
          throw error;
        }

        setAppointmentHistoryRows(Array.isArray(data) ? (data as AppointmentChangeLog[]) : []);
      } catch (error: any) {
        console.error('❌ Erro ao carregar histórico do agendamento:', error);
        toast(error?.message || 'Erro ao carregar histórico.', 'error');
        setAppointmentHistoryRows([]);
      } finally {
        setIsLoadingAppointmentHistory(false);
      }
    };

    const handleCloseAppointmentHistoryModal = () => {
      setShowAppointmentHistoryModal(false);
      setSelectedAppointmentForHistory(null);
      setAppointmentHistoryRows([]);
      setIsLoadingAppointmentHistory(false);
      setAppointmentHistoryCreatedAt(null);
    };

    const handleConfirmChangeService = async (services: Array<{ id: string; name: string; price: number; duration: number }>) => {
      const apt = selectedAppointmentForServiceChange;
      if (!apt) return;

      try {
        const toNumberSafe = (value: any, fallback = 0): number => {
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          const raw = String(value ?? '').trim();
          if (!raw) return fallback;
          // Suporta "120,50", "R$ 120,50", "120.50"
          const normalized = raw
            .replace(/\s/g, '')
            .replace(/[Rr]\$/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[^0-9.-]/g, '');
          const parsed = Number(normalized);
          return Number.isFinite(parsed) ? parsed : fallback;
        };

        const serviceNames = (services || []).map((s) => String(s?.name || '').trim()).filter(Boolean);
        const basePrice = (services || []).reduce((sum, s) => sum + toNumberSafe((s as any)?.price, 0), 0);
        const baseDuration = (services || []).reduce((sum, s) => sum + toNumberSafe((s as any)?.duration, 0), 0);

        const extraProductsTotal = (apt.additional_products || []).reduce(
          (sum: number, p: any) => sum + toNumberSafe(p?.price, 0),
          0
        );
        const soldProductsTotal = (apt.sold_products || []).reduce(
          (sum: number, p: any) => sum + toNumberSafe(p?.total, 0),
          0
        );
        const nextTotal = toNumberSafe(basePrice, 0) + extraProductsTotal + soldProductsTotal;
        const nextDuration = Math.max(1, Math.round(toNumberSafe(baseDuration, 30)));

        // Evita erro confuso do backend: valida conflito ignorando o próprio agendamento
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        const startToMinutes = (time: string) => {
          const [h, m] = String(time || '00:00').split(':').map(Number);
          return h * 60 + m;
        };
        const targetStart = startToMinutes(apt.appointment_time);
        const targetEnd = targetStart + nextDuration;
        const conflicting = (appointments || []).find((other: any) => {
          if (!other) return false;
          if (String(other.id) === String(apt.id)) return false; // ignorar ele mesmo
          if (String(other.professional || '') !== String(apt.professional || '')) return false;
          if (String(other.appointment_date || '').slice(0, 10) !== selectedDateStr) return false;
          if (String(other.status || '').toLowerCase() === 'cancelled') return false;

          const otherStart = startToMinutes(other.appointment_time);
          const otherDuration = Math.max(1, Math.round(toNumberSafe(other.duration, 30)));
          const otherEnd = otherStart + otherDuration;
          return !(targetEnd <= otherStart || targetStart >= otherEnd);
        });

        if (conflicting) {
          const conflictMsg = `Esse serviço não cabe no mesmo horário. Ele conflita com ${String(conflicting.appointment_time || '')} (${String(conflicting.client_name || 'outro cliente')}).`;
          toast.error(conflictMsg);
          const handledError: any = new Error(conflictMsg);
          handledError.handled = true;
          throw handledError;
        }

        const payload: any = {
          service: serviceNames.join(', '),
          price: toNumberSafe(basePrice, 0),
          duration: nextDuration,
          total_price: nextTotal,
        };

        let { error } = await supabase.from('appointments').update(payload).eq('id', apt.id);
        if (error) {
          const msg = String((error as any)?.message || '').toLowerCase();
          if (msg.includes('total_price') && (msg.includes('column') || msg.includes('schema cache'))) {
            const fallbackPayload: any = { ...payload };
            delete fallbackPayload.total_price;
            ({ error } = await supabase.from('appointments').update(fallbackPayload).eq('id', apt.id));
          }
          // Compatibilidade para schemas legados: alguns bancos usam service_name/service_price/service_duration_minutes
          if (error) {
            const msg2 = String((error as any)?.message || '').toLowerCase();
            const isSchemaColumnError =
              (error as any)?.code === '42703' ||
              msg2.includes('column') ||
              msg2.includes('schema cache');

            if (isSchemaColumnError) {
              const legacyPayload: any = {
                service_name: payload.service,
                service_price: payload.price,
                service_duration_minutes: payload.duration,
                total_price: payload.total_price,
              };
              ({ error } = await supabase.from('appointments').update(legacyPayload).eq('id', apt.id));

              if (error) {
                const legacyWithoutTotal = { ...legacyPayload };
                delete legacyWithoutTotal.total_price;
                ({ error } = await supabase.from('appointments').update(legacyWithoutTotal).eq('id', apt.id));
              }
            }
          }
        }
        if (error) throw error;

        await writeAppointmentChangeLog({
          appointmentId: apt.id,
          eventType: 'service_changed',
          description: 'Serviço do agendamento alterado.',
          oldValues: {
            service: String(apt.service || ''),
            price: Number(apt.price || 0),
            duration: Number(apt.duration || 0),
            total_price: Number((apt as any).total_price || 0),
          },
          newValues: {
            service: String(payload.service || ''),
            price: Number(payload.price || 0),
            duration: Number(payload.duration || 0),
            total_price: Number(payload.total_price || 0),
          },
        });

        toast.success('Serviço alterado com sucesso!');
        if (onAppointmentUpdate) onAppointmentUpdate();
      } catch (e) {
        const err: any = e;
        console.error('❌ Erro ao trocar serviço:', {
          message: err?.message,
          code: err?.code,
          details: err?.details,
          hint: err?.hint,
          raw: err,
        });
        if (err?.handled) throw e;
        const detailMessage = [err?.message, err?.details, err?.hint].filter(Boolean).join(' | ');
        toast.error(detailMessage || 'Erro ao trocar serviço. Tente novamente.');
        throw e;
      }
    };

    const handleRescheduleAppointment = async (appointmentId: string, newDate: string, newTime: string) => {
      const isTransientError = (err: any) => {
        const msg = String(err?.message || '').toLowerCase();
        return (
          msg.includes('failed to fetch') ||
          msg.includes('network') ||
          msg.includes('service unavailable') ||
          msg.includes('insufficient resources') ||
          String(err?.status || '') === '503'
        );
      };

      try {
        const appointment = appointments.find((apt) => String(apt.id) === String(appointmentId));
        if (!appointment) {
          toast.error('Agendamento não encontrado.');
          return;
        }
        const oldDate = String(appointment.appointment_date || '').slice(0, 10);
        const oldTime = String(appointment.appointment_time || '');

        // 1. Cancela o horário antigo com source 'rescheduled_by_staff' (remarcação/transferência).
        //    O scheduler WhatsApp reconhece esse motivo e NÃO envia "agendamento cancelado".
        const tryCancel = async () => {
          const { error } = await updateAppointmentCancelledWithSource(
            supabase,
            { id: appointmentId },
            {
              cancellation_source: CANCELLATION_SOURCE.RESCHEDULED,
              cancellation_detail: 'Horário remarcado/transferido pelo painel do estabelecimento.',
            }
          );
          if (error) throw error;
        };
        try {
          await tryCancel();
        } catch (firstError: any) {
          if (!isTransientError(firstError)) throw firstError;
          await new Promise((resolve) => setTimeout(resolve, 450));
          await tryCancel();
        }

        // 2. Cria novo agendamento — cópia exata com novo horário/data.
        //    created_at = NOW() automático: scheduler detecta como novo e agenda lembrete WhatsApp no horário correto.
        const establishmentId = String(establishment?.id || '').trim();
        const newPayload: Record<string, unknown> = {
          client_id: appointment.client_id,
          establishment_id: establishmentId,
          professional: appointment.professional,
          service: appointment.service,
          client_name: appointment.client_name,
          client_whatsapp: appointment.client_whatsapp || null,
          appointment_date: newDate,
          appointment_time: newTime,
          status: 'pending',
          price: appointment.price,
          // ⚠️ total_price PRECISA ser copiado. "Trocar horário" não move o agendamento:
          // ele cria um NOVO copiando os campos daqui. Como total_price ficava de fora,
          // o novo nascia zerado no financeiro enquanto a tela mostrava o preço normal
          // (a comanda lê `price`). Resultado: atendimento concluído valendo R$ 0,00,
          // profissional sem comissão e dinheiro fora do caixa, sem ninguém perceber.
          total_price: (appointment as any).total_price ?? appointment.price,
          // Extras e gorjeta também se perdiam ao remarcar — mesma causa.
          additional_products: (appointment as any).additional_products ?? null,
          professional_tip_amount: (appointment as any).professional_tip_amount ?? null,
          duration: appointment.duration,
          payment_method: appointment.payment_method || 'dinheiro',
          is_subscriber: appointment.is_subscriber ?? false,
          is_avulso: appointment.is_avulso ?? false,
          is_squeeze: appointment.is_squeeze ?? false,
          is_establishment_booking: appointment.is_establishment_booking ?? true,
          observation: appointment.observation || null,
        };
        if (appointment.professional_id) newPayload.professional_id = appointment.professional_id;
        if (appointment.subscription_id) newPayload.subscription_id = appointment.subscription_id;
        if ((appointment as any).subscriber_service_id) newPayload.subscriber_service_id = (appointment as any).subscriber_service_id;
        if ((appointment as any).subscriber_service_name) newPayload.subscriber_service_name = (appointment as any).subscriber_service_name;

        const tryInsert = async (payload: Record<string, unknown>) =>
          supabase.from('appointments').insert(payload).select('id').single();

        let insertResult = await tryInsert(newPayload);
        if (insertResult.error) {
          const errMsg = String((insertResult.error as any)?.message || '').toLowerCase();
          const isMissingCol =
            errMsg.includes('schema cache') ||
            errMsg.includes('could not find the') ||
            (errMsg.includes('column') && errMsg.includes('does not exist'));
          if (isMissingCol) {
            const fallback = { ...newPayload };
            delete fallback.professional_id;
            delete fallback.subscriber_service_id;
            delete fallback.subscriber_service_name;
            insertResult = await tryInsert(fallback);
          }
        }

        if (insertResult.error) throw insertResult.error;
        const newApt = insertResult.data;

        const newAppointmentId = String(newApt?.id || '');
        const eventType = oldDate !== newDate ? 'date_changed' : 'rescheduled';
        if (newAppointmentId) {
          await writeAppointmentChangeLog({
            appointmentId: newAppointmentId,
            eventType,
            description: `Agendamento remarcado de ${oldDate} às ${oldTime}.`,
            oldValues: {
              appointment_date: oldDate || null,
              appointment_time: oldTime || null,
              original_appointment_id: appointmentId,
            },
            newValues: {
              appointment_date: newDate,
              appointment_time: newTime,
            },
          });
        }

        toast.success('Horário alterado com sucesso!');
        if (onAppointmentUpdate) onAppointmentUpdate();
      } catch (e: any) {
        console.error('❌ Erro ao trocar horário:', e);
        const detailed = [e?.message, e?.details, e?.hint].filter(Boolean).join(' | ');
        toast.error(detailed || 'Erro ao trocar horário. Tente novamente.');
        throw e;
      }
    };

    const getProfessionalNameById = (professionalId: string): string => {
      const p = professionals.find((x) => String(x.id) === String(professionalId));
      return String(p?.name || professionalId || 'Profissional');
    };

    const resolveAppointmentProfessionalName = (apt: Appointment): string => {
      const refs = (professionals || []).map((pro) => ({
        id: String(pro.id || ''),
        name: String(pro.name || ''),
      }));
      return resolveAppointmentProfessionalForSubscriber(apt as any, refs).professionalName;
    };

    const resolveAppointmentProfessionalRecord = (apt: Appointment) => {
      const refs = (professionals || []).map((pro) => ({
        id: String(pro.id || ''),
        name: String(pro.name || ''),
      }));
      return resolveAppointmentProfessionalForSubscriber(apt as any, refs);
    };

    const normalizePhoneDigitsForSubscriber = (value: unknown): string => {
      const digits = String(value || '').replace(/\D/g, '');
      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits.slice(2);
      return digits;
    };

    const parseSubscriberBoolean = (value: unknown): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      const raw = String(value ?? '').trim().toLowerCase();
      return raw === 'true' || raw === '1' || raw === 't' || raw === 'yes' || raw === 'sim' || raw === 'on';
    };

    const shouldAutoRegisterSubscriberAttendance = (apt: Appointment): boolean =>
      isSubscriberAppointmentForProfessionalControl(apt as any, agendaSubscriberRows);

    const resolveAutoSubscriberAttendanceContext = async (apt: Appointment): Promise<{
      clientSubscriptionId: string;
      subscriberName: string;
      subscriberWhatsapp: string;
      monthlyLimit: number;
      subscription: any;
    } | null> => {
      const establishmentId = String(establishment?.id || '').trim();
      if (!establishmentId) return null;

      const appointmentDate = String((apt as any)?.appointment_date || '').slice(0, 10) || format(selectedDate, 'yyyy-MM-dd');

      const matched = await findClientSubscriptionForAppointment({
        establishmentId,
        clientWhatsapp: String((apt as any)?.client_whatsapp || ''),
        clientName: String(apt.client_name || ''),
        appointmentDate,
      });

      if (!matched?.id) return null;

      return {
        clientSubscriptionId: String(matched.id),
        subscriberName: String(matched.client_name_override || matched.subscriber_name || apt.client_name || '').trim(),
        subscriberWhatsapp: String(matched.client_whatsapp || matched.subscriber_whatsapp || (apt as any)?.client_whatsapp || '').trim(),
        monthlyLimit: Number((matched as any).monthly_limit || 0),
        subscription: (matched as any).subscriptions || null,
      };
    };

    const getDisplayedService = (apt: Appointment): string =>
      sanitizeAppointmentServiceDisplay((apt as any)?.service);

    const registerSubscriberAttendanceAutomatically = async (apt: Appointment): Promise<void> => {
      const appointmentId = String(apt?.id || '').trim();
      const establishmentId = String(establishment?.id || '').trim();
      const writeAutoSubscriberLog = async (
        eventType: 'subscriber_attendance_marked' | 'subscriber_attendance_auto_failed' | 'subscriber_attendance_auto_skipped',
        description: string,
        metadata?: Record<string, any>
      ) => {
        if (!appointmentId) return;
        await writeAppointmentChangeLog({
          appointmentId,
          eventType,
          description,
          oldValues: { status: String((apt as any)?.status || '').trim() || null },
          newValues: { status: 'completed' },
          metadata: {
            action: 'Auto assinatura na conclusão',
            source: 'auto_on_complete',
            selected_date: format(selectedDate, 'dd/MM/yyyy'),
            selected_time: String((apt as any)?.appointment_time || ''),
            ...metadata,
          },
        });
      };

      try {
        if (!shouldAutoRegisterSubscriberAttendance(apt)) return;
        if (!appointmentId || !establishmentId) return;

        const context = await resolveAutoSubscriberAttendanceContext(apt);
        if (!context || !context.clientSubscriptionId) {
          await writeAutoSubscriberLog(
            'subscriber_attendance_auto_failed',
            'Não foi possível localizar a assinatura do cliente para auto-registro.',
            { reason: 'subscription_not_found' }
          );
          return;
        }

        const attendanceDate = String((apt as any)?.appointment_date || '').slice(0, 10) || format(selectedDate, 'yyyy-MM-dd');
        if (!attendanceDate) {
          await writeAutoSubscriberLog(
            'subscriber_attendance_auto_failed',
            'Não foi possível determinar a data do atendimento para auto-registro de assinatura.',
            { reason: 'attendance_date_missing' }
          );
          return;
        }

        try {
          const professionalRecord = resolveAppointmentProfessionalRecord(apt);
          const existingId = await findExistingSubscriberAttendance({
            establishmentId,
            appointmentId,
            clientSubscriptionId: context.clientSubscriptionId,
            attendanceDate,
            professionalId: professionalRecord.professionalId,
            professionalName: professionalRecord.professionalName,
          });
          if (existingId) return;
        } catch {
          // Compatibilidade: se colunas opcionais não existirem, segue para insert com guarda.
        }

        const monthStart = format(new Date(`${attendanceDate}T00:00:00`), 'yyyy-MM-01');
        const monthEndDate = new Date(`${monthStart}T00:00:00`);
        monthEndDate.setMonth(monthEndDate.getMonth() + 1);
        monthEndDate.setDate(0);
        const monthEnd = format(monthEndDate, 'yyyy-MM-dd');

        if (Number.isFinite(context.monthlyLimit) && context.monthlyLimit > 0) {
          const { data: countRows, error: countError } = await (supabase as any)
            .from('subscriber_attendances')
            .select('id')
            .eq('establishment_id', establishmentId)
            .eq('client_subscription_id', context.clientSubscriptionId)
            .gte('attendance_date', monthStart)
            .lte('attendance_date', monthEnd);
          if (countError) throw countError;
          const currentCount = Array.isArray(countRows) ? countRows.length : 0;
          if (currentCount >= context.monthlyLimit) {
            await writeAutoSubscriberLog(
              'subscriber_attendance_auto_skipped',
              'Auto-registro de assinatura ignorado porque o limite mensal já foi atingido.',
              {
                reason: 'monthly_limit_reached',
                monthly_limit: context.monthlyLimit,
                current_count: currentCount,
                subscriber_id: context.clientSubscriptionId,
              }
            );
            return;
          }
        }

        const divideEnabled = parseSubscriberBoolean(context.subscription?.divide_total_enabled);
        const fixedCommission = Number(context.subscription?.fixed_commission_value || 0);
        const pointsModeSubscription = !divideEnabled && !(fixedCommission > 0);
        const subscriptionValue = Number(context.subscription?.value || 0);

        let multiplier = 1;
        try {
          const { data: saleRow, error: saleError } = await (supabase as any)
            .from('subscription_sale_commissions')
            .select('commission_percent, commission_amount')
            .eq('establishment_id', establishmentId)
            .eq('client_subscription_id', context.clientSubscriptionId)
            .maybeSingle();
          if (!saleError) {
            const salePercent = Number(String(saleRow?.commission_percent || '').replace(',', '.'));
            if (Number.isFinite(salePercent) && salePercent > 0) {
              multiplier = Math.max(0, 1 - salePercent / 100);
            } else {
              const saleAmount = Number(saleRow?.commission_amount || 0);
              if (Number.isFinite(saleAmount) && saleAmount > 0 && Number.isFinite(subscriptionValue) && subscriptionValue > 0) {
                const inferredPercent = Math.min(100, Math.max(0, (saleAmount / subscriptionValue) * 100));
                multiplier = Math.max(0, 1 - inferredPercent / 100);
              }
            }
          }
        } catch {
          // sem bloqueio
        }

        const divideFromSubscription = Number(context.subscription?.divide_total_attendances || 0);
        const divideFallbackFromClientLimit = Number(context.monthlyLimit || 0);
        const divideCountPreview =
          Number.isFinite(divideFromSubscription) && divideFromSubscription > 0
            ? divideFromSubscription
            : Number.isFinite(divideFallbackFromClientLimit) && divideFallbackFromClientLimit > 0
              ? divideFallbackFromClientLimit
              : 0;
        if (divideEnabled && (!Number.isFinite(divideCountPreview) || divideCountPreview <= 0)) {
          await writeAutoSubscriberLog(
            'subscriber_attendance_auto_failed',
            'Auto-registro de assinatura falhou: assinatura com dividir valor total, mas sem quantidade de atendimentos.',
            {
              reason: 'divide_total_without_attendances',
              subscriber_id: context.clientSubscriptionId,
            }
          );
          return;
        }

        const round2 = (v: number) => Math.round(v * 100) / 100;
        const baseRepass = computeSubscriberRepassValue({
          subscription: context.subscription,
          monthlyLimit: context.monthlyLimit,
          appointmentPrice: Number((apt as any)?.price || 0),
        });
        if (!pointsModeSubscription && baseRepass <= 0) {
          await writeAutoSubscriberLog(
            'subscriber_attendance_auto_failed',
            'Auto-registro de assinatura falhou: repasse não configurado ou inválido.',
            {
              reason: 'invalid_repass_value',
              subscriber_id: context.clientSubscriptionId,
            }
          );
          return;
        }
        const repassValue = round2(baseRepass * multiplier);

        const professionalRecord = resolveAppointmentProfessionalRecord(apt);
        const payload: Record<string, unknown> = {
          establishment_id: establishmentId,
          client_subscription_id: context.clientSubscriptionId,
          professional_name: professionalRecord.professionalName,
          professional_id: professionalRecord.professionalId,
          attendance_date: attendanceDate,
          repass_value: repassValue,
          appointment_id: appointmentId,
          client_name_snapshot: context.subscriberName || 'Cliente',
          subscription_name_snapshot: String(context.subscription?.name || 'Plano').trim() || 'Plano',
        };
        if (user?.id) payload.created_by = user.id;

        const { error: insertError, inserted } = await insertSubscriberAttendanceOnce(payload);
        if (insertError) throw insertError;
        if (!inserted) return;

        await writeAutoSubscriberLog(
          'subscriber_attendance_marked',
          'Atendimento assinatura registrado automaticamente ao concluir o agendamento.',
          {
            subscriber_id: context.clientSubscriptionId,
            subscriber_name: context.subscriberName,
            subscriber_whatsapp: context.subscriberWhatsapp,
            attendance_date: attendanceDate,
          }
        );
        void refreshSubscriberFinancialByProfessional();
      } catch (error) {
        console.warn('⚠️ Falha ao registrar assinatura automaticamente:', error);
        await writeAutoSubscriberLog(
          'subscriber_attendance_auto_failed',
          'Erro inesperado no auto-registro de assinatura ao concluir o agendamento.',
          {
            reason: 'unexpected_error',
            error_message: String((error as any)?.message || ''),
          }
        );
      }
    };

    const loadSubscriberOptions = async () => {
      if (!establishment?.id) return;
      setSubscriberOptionsLoading(true);
      try {
        // Traz assinantes do "Meus Assinantes" (client_subscriptions)
        const supabaseAny = supabase as any;
        const { data, error } = await supabaseAny
          .from('client_subscriptions')
          .select(`
            id,
            subscription_id,
            subscriber_name,
            subscriber_whatsapp,
            client_name_override,
            client_whatsapp,
            monthly_limit,
            bonus_credits,
            start_date,
            last_payment_date,
            usage_reset_at,
            subscriptions (
              id,
              name,
              value,
              fixed_commission_value,
              divide_total_enabled,
              divide_total_attendances,
              divided_services
            )
          `)
          .eq('establishment_id', String(establishment.id))
          .order('created_at', { ascending: false });

        if (error) throw error;

        const rows = Array.isArray(data) ? data : [];
        const mapped = rows
          .map((row: any) => {
            const display_name = String(row?.client_name_override || row?.subscriber_name || '').trim();
            const whatsapp = String(row?.client_whatsapp || row?.subscriber_whatsapp || '').trim();
            const plan_name = String(row?.subscriptions?.name || '').trim();
            const monthly_limit = row?.monthly_limit ?? null;
            if (!display_name || !whatsapp) return null;
            return {
              id: String(row.id),
              subscription_id: String(row?.subscription_id || ''),
              display_name,
              whatsapp,
              plan_name: plan_name || undefined,
              monthly_limit: monthly_limit !== null && monthly_limit !== undefined ? Number(monthly_limit) : null,
              bonus_credits: Number(row?.bonus_credits || 0),
              start_date: row?.start_date || null,
              last_payment_date: row?.last_payment_date || null,
              usage_reset_at: row?.usage_reset_at || null,
              subscription: row?.subscriptions || null,
            };
          })
          .filter(Boolean);

        setSubscriberOptions(mapped as any);
      } catch (e) {
        console.error('❌ Erro ao carregar assinantes:', e);
        toast('Erro ao carregar assinantes. Tente novamente.', 'error');
        setSubscriberOptions([]);
      } finally {
        setSubscriberOptionsLoading(false);
      }
    };

    const handleOpenSubscriberAttendanceModal = async (apt: Appointment) => {
      setSelectedAppointmentForSubscriberAttendance(apt);
      setSelectedSubscriberOptionId('');
      setSubscriberSearch('');
      setShowSubscriberAttendanceModal(true);
      if (subscriberOptions.length === 0) {
        await loadSubscriberOptions();
      }
    };

    const handleCloseSubscriberAttendanceModal = () => {
      if (isSavingSubscriberAttendance) return;
      setShowSubscriberAttendanceModal(false);
      setSelectedAppointmentForSubscriberAttendance(null);
      setSelectedSubscriberOptionId('');
      setSubscriberSearch('');
    };

    const handleConfirmSubscriberAttendance = async () => {
      if (!selectedAppointmentForSubscriberAttendance) return;
      if (!selectedSubscriberOptionId) {
        toast('Selecione um assinante.', 'error');
        return;
      }

      const apt = selectedAppointmentForSubscriberAttendance;
      const establishmentId = String(establishment?.id || '');
      if (!establishmentId) {
        toast('Estabelecimento não carregado.', 'error');
        return;
      }

      setIsSavingSubscriberAttendance(true);
      try {
        const oldStatus = String(apt.status || '').trim().toLowerCase();
        // ✅ Verificar limite do assinante (não permitir 5/4)
        const selectedSub = subscriberOptions.find((s) => String(s.id) === String(selectedSubscriberOptionId));
        // Limite do plano + atendimentos extras (bônus). Só soma quando há limite base definido.
        const baseSubLimit = Number(selectedSub?.monthly_limit || 0);
        const bonusSubCredits = Number((selectedSub as any)?.bonus_credits || 0);
        const limit = Number.isFinite(baseSubLimit) && baseSubLimit > 0 ? baseSubLimit + (Number.isFinite(bonusSubCredits) && bonusSubCredits > 0 ? Math.floor(bonusSubCredits) : 0) : 0;
        // ✅ Assinatura contínua: conta desde o marco (início/renovação/reset), não só o mês
        const continuousOn = Boolean((establishment as any)?.continuous_subscription_enabled);
        const continuousWin = continuousOn ? resolveContinuousUsageWindow(selectedSub as any) : null;
        if (Number.isFinite(limit) && limit > 0) {
          // Usar a data do dia da agenda (selectedDate) para evitar dia anterior por UTC
          const y = selectedDate.getFullYear();
          const m = selectedDate.getMonth();
          const first = new Date(y, m, 1);
          const last = new Date(y, m + 1, 0);
          const min = continuousWin ? continuousWin.windowStartDate : format(first, 'yyyy-MM-dd');
          const max = continuousWin ? '2999-12-31' : format(last, 'yyyy-MM-dd');

          const { data: countRows, error: countErr } = await (supabase as any)
            .from('subscriber_attendances')
            .select('id, attendance_date, created_at')
            .eq('establishment_id', establishmentId)
            .eq('client_subscription_id', String(selectedSubscriberOptionId))
            .gte('attendance_date', min)
            .lte('attendance_date', max);

          if (countErr) throw countErr;
          const usableRows = continuousWin
            ? (Array.isArray(countRows) ? countRows : []).filter((row: any) =>
              isUsageInContinuousWindow(String(row?.attendance_date || ''), row?.created_at, continuousWin)
            )
            : (Array.isArray(countRows) ? countRows : []);
          const currentCount = usableRows.length;
          if (currentCount >= limit) {
            toast(
              continuousWin
                ? `Assinatura contínua: o cliente já usou todos os atendimentos (${currentCount}/${limit}). Resete a contagem em Meus Assinantes para liberar.`
                : `Limite atingido (${limit}/${limit}). Aumente o limite do cliente para registrar mais atendimentos.`,
              'error'
            );
            return;
          }
        }

        // 1) Concluir o agendamento
        const { error: updErr } = await supabase
          .from('appointments')
          .update({ status: 'completed' } as any)
          .eq('id', apt.id);
        if (updErr) throw updErr;

        // 2) Registrar atendimento no assinante
        const professionalRecord = resolveAppointmentProfessionalRecord(apt);
        // ✅ Calcular repasse automaticamente (usando configurações da assinatura)
        const round2 = (v: number) => Math.round(v * 100) / 100;

        // Buscar config da assinatura (já veio no loadSubscriberOptions)
        const subCfg: any = (selectedSub as any)?.subscription || null;
        const divideEnabled = Boolean(subCfg?.divide_total_enabled);
        const subscriptionValue = Number(subCfg?.value || 0);
        const fallbackFromAppointmentPrice = Number((apt as any)?.price || 0);
        const configuredFixed = Number(subCfg?.fixed_commission_value || 0);
        // Repasse explícito na assinatura (>0) sempre manda.
        // Com "Dividir valor total" e sem repasse fixo: mantém compat (100% do valor da assinatura).
        // Sem divisão e repasse 0%: modo pontos — não gravar valor financeiro no atendimento (repasse R$ 0).
        let baseFixed = 0;
        if (Number.isFinite(configuredFixed) && configuredFixed > 0) {
          baseFixed = configuredFixed;
        } else if (divideEnabled) {
          baseFixed =
            Number.isFinite(subscriptionValue) && subscriptionValue > 0
              ? subscriptionValue
              : Number.isFinite(fallbackFromAppointmentPrice) && fallbackFromAppointmentPrice > 0
                ? fallbackFromAppointmentPrice
                : 0;
          if (baseFixed > 0) {
            toast('Repasse não configurado nesta assinatura. Calculando automaticamente como 100% do valor da assinatura.', 'warning');
          }
        } else {
          baseFixed = 0;
        }

        // Comissão de venda (se existir) => atendimentos saem do valor restante
        let multiplier = 1;
        try {
          const { data: saleRow, error: saleErr } = await (supabase as any)
            .from('subscription_sale_commissions')
            .select('commission_percent, commission_amount')
            .eq('establishment_id', establishmentId)
            .eq('client_subscription_id', String(selectedSubscriberOptionId))
            .maybeSingle();
          if (!saleErr) {
            const salePercent = Number(String(saleRow?.commission_percent || '').replace(',', '.'));
            if (Number.isFinite(salePercent) && salePercent > 0) {
              multiplier = Math.max(0, 1 - salePercent / 100);
            } else {
              // Compatibilidade com dados legados: quando só existe commission_amount.
              const saleAmount = Number(saleRow?.commission_amount || 0);
              const subscriptionValue = Number(subCfg?.value || 0);
              if (Number.isFinite(saleAmount) && saleAmount > 0 && Number.isFinite(subscriptionValue) && subscriptionValue > 0) {
                const inferredPercent = Math.min(100, Math.max(0, (saleAmount / subscriptionValue) * 100));
                multiplier = Math.max(0, 1 - inferredPercent / 100);
              }
            }
          }
        } catch {
          // ignore
        }

        const divideFromSubscription = Number(subCfg?.divide_total_attendances || 0);
        const divideFallbackFromClientLimit = Number(selectedSub?.monthly_limit || 0);
        const divideCount =
          Number.isFinite(divideFromSubscription) && divideFromSubscription > 0
            ? divideFromSubscription
            : Number.isFinite(divideFallbackFromClientLimit) && divideFallbackFromClientLimit > 0
              ? divideFallbackFromClientLimit
              : 0;

        if (divideEnabled && (!Number.isFinite(divideCount) || divideCount <= 0)) {
          toast('“Dividir valor total” está ativo na assinatura, mas sem “Qtd. atendimentos”. Edite a assinatura e preencha (ex: 4).', 'error');
          return;
        }

        // Regra:
        // - sem "Dividir valor total": lança repasse normal da assinatura.
        // - com divisão ativa: divide o repasse pelo número de atendimentos.
        let repassValue = round2(baseFixed * multiplier);
        if (divideEnabled) {
          repassValue = round2(repassValue / divideCount);
        }

        // Data do dia da agenda (evita mostrar dia anterior em Meus Assinantes por causa de UTC)
        const attendanceDateStr = format(selectedDate, 'yyyy-MM-dd');
        const payload: any = {
          establishment_id: establishmentId,
          client_subscription_id: String(selectedSubscriberOptionId),
          professional_name: professionalRecord.professionalName,
          professional_id: professionalRecord.professionalId,
          attendance_date: attendanceDateStr,
          repass_value: repassValue,
          appointment_id: String(apt.id || '').trim() || undefined,
          ...buildSubscriberAttendanceSnapshotFields({
            subscriber_name: selectedSub?.display_name,
            subscriptions: { name: selectedSub?.plan_name },
          }),
        };
        if (user?.id) payload.created_by = user.id;

        const { error: insErr, inserted: didInsert } = await insertSubscriberAttendanceOnce(payload);
        if (insErr) throw insErr;
        if (!didInsert) {
          toast('Atendimento de assinatura já estava registrado para este agendamento.', 'warning');
          return;
        }

        const subscriberPointsModeSuccess = !divideEnabled && !(Number(configuredFixed) > 0);

        const clickedAt = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
        await writeAppointmentChangeLog({
          appointmentId: apt.id,
          eventType: 'subscriber_attendance_marked',
          description: 'Atendimento assinatura registrado e agendamento concluído pelo botão de assinatura.',
          oldValues: { status: oldStatus || null },
          newValues: { status: 'completed' },
          metadata: {
            action: 'Atendimento assinatura',
            subscriber_id: String(selectedSubscriberOptionId),
            subscriber_name: String(selectedSub?.display_name || ''),
            subscriber_whatsapp: String(selectedSub?.whatsapp || ''),
            attendance_date: attendanceDateStr,
            clicked_at: clickedAt,
            selected_date: format(selectedDate, 'dd/MM/yyyy'),
            selected_time: String(apt.appointment_time || ''),
          },
        });

        toast(
          subscriberPointsModeSuccess
            ? '✅ Atendimento registrado (1 ponto — modo pontos, sem repasse em R$). Agendamento concluído!'
            : '✅ Atendimento registrado e agendamento concluído!',
          'success'
        );
        void refreshSubscriberFinancialByProfessional();
        handleCloseSubscriberAttendanceModal();
        if (onAppointmentUpdate) onAppointmentUpdate();
      } catch (e) {
        console.error('❌ Erro ao registrar atendimento da assinatura:', e);
        toast('Erro ao registrar atendimento da assinatura. Tente novamente.', 'error');
      } finally {
        setIsSavingSubscriberAttendance(false);
      }
    };

    const getDisplayedClientName = (apt: Appointment): string => {
      return localClientNameOverrides[apt.id] ?? apt.client_name ?? '';
    };

    const getDisplayedClientNameWithSubscriberLabel = (apt: Appointment): string => {
      const name = getDisplayedClientName(apt);
      if (!isAgendaSubscriberAppointment(apt)) return name;
      return formatSubscriberAgendaClientName(name);
    };

    const getAppointmentClientDisplayName = (apt: Appointment): string => {
      if (apt.is_squeeze) {
        return isAgendaSubscriberAppointment(apt) ? 'ENCAIXE ASSINANTE' : 'ENCAIXE';
      }
      return getDisplayedClientNameWithSubscriberLabel(apt);
    };

    const renderAppointmentClientNameRow = (
      apt: Appointment,
      serviceLabels: Array<{ name: string; color: string }>,
      options?: { variant?: 'compact' | 'expanded' }
    ) => {
      const isSubscriber = isAgendaSubscriberAppointment(apt);
      const displayName = getAppointmentClientDisplayName(apt);
      const isCompleted = String(apt.status || '').toLowerCase() === 'completed';
      const variant = options?.variant || 'compact';

      const serviceLabelNodes = serviceLabels.map((label) => (
        <span
          key={`${variant}-${apt.id}-${label.name}-${label.color}`}
          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-white/30 shrink-0"
          style={{ backgroundColor: label.color, color: getLabelTextColor(label.color) }}
          title={`Etiqueta: ${label.name}`}
        >
          {label.name}
        </span>
      ));

      const avulsoEditButton =
        isAvulsoLike(apt) && !apt.is_squeeze ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModalAptId(apt.id);
              startEditAvulsoName(apt);
            }}
            className="shrink-0 text-white/80 hover:text-white text-xs"
            title="Editar nome do cliente avulso"
          >
            ✏️
          </button>
        ) : null;

      if (!isSubscriber) {
        if (variant === 'expanded') {
          return <span className="text-white font-semibold">{displayName}</span>;
        }
        return (
          <div className="text-white font-semibold text-sm mb-1 truncate">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">{displayName}</span>
              {serviceLabelNodes}
              {avulsoEditButton}
            </div>
          </div>
        );
      }

      const subscriberBadge = isCompleted ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-green-600 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          Assinante atendido
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-amber-300/50 bg-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-100">
          👑 Assinante
        </span>
      );

      const subscriberRepassForChip = getSubscriberRepassForAppointment(apt);
      const subscriberRepassChip =
        subscriberRepassForChip > 0 ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-emerald-300/60 bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm"
            title="Quanto o profissional recebe por este atendimento de assinatura"
          >
            💰 {formatCurrency(subscriberRepassForChip)}
          </span>
        ) : null;

      const goldNameStrip = (
        <div className="rounded-lg border border-amber-400/70 bg-gradient-to-r from-amber-950/95 via-amber-900 to-yellow-950 px-2.5 py-1.5 ring-1 ring-amber-500/30 shadow-inner shadow-black/25">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="truncate text-amber-50 font-bold text-sm min-w-0 flex-1">{displayName}</span>
            {subscriberRepassChip}
            {subscriberBadge}
            {serviceLabelNodes}
            {avulsoEditButton}
          </div>
        </div>
      );

      if (variant === 'expanded') {
        return goldNameStrip;
      }

      return <div className="mb-1.5">{goldNameStrip}</div>;
    };

    const handleOpenMonthPendingModal = async () => {
      if (!establishment?.id) {
        toast.error('Estabelecimento não identificado.');
        return;
      }

      const start = format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), 'yyyy-MM-dd');
      setIsLoadingMonthPending(true);
      setShowMonthPendingModal(true);
      setMonthPendingFilterDate('');
      try {
        const baseSelect = `
            id,
            client_id,
            client_name,
            client_whatsapp,
            client_cpf,
            service,
            professional,
            appointment_date,
            appointment_time,
            status,
            duration,
            price,
            total_price,
            payment_method,
            card_brand,
            pix_payment_status,
            pix_proof_url,
            additional_products,
            sold_products,
            observation,
            establishment_observation,
            is_premium,
            is_subscriber,
            is_child_service,
            is_avulso,
            is_squeeze
          `;
        let { data, error } = await supabase
          .from('appointments')
          .select(baseSelect)
          .eq('establishment_id', establishment.id)
          .gte('appointment_date', start)
          .lt('appointment_date', selectedDateIso)
          .eq('status', 'pending')
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true });

        const missingSoldProductsColumn =
          error &&
          String(error?.message || '').toLowerCase().includes('sold_products') &&
          String(error?.message || '').toLowerCase().includes('column');

        if (missingSoldProductsColumn) {
          const legacySelect = `
            id,
            client_id,
            client_name,
            client_whatsapp,
            client_cpf,
            service,
            professional,
            appointment_date,
            appointment_time,
            status,
            duration,
            price,
            total_price,
            payment_method,
            card_brand,
            pix_payment_status,
            pix_proof_url,
            additional_products,
            observation,
            establishment_observation,
            is_premium,
            is_subscriber,
            is_child_service,
            is_avulso,
            is_squeeze
          `;
          const retry = await supabase
            .from('appointments')
            .select(legacySelect)
            .eq('establishment_id', establishment.id)
            .gte('appointment_date', start)
            .lt('appointment_date', selectedDateIso)
            .eq('status', 'pending')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true });
          data = retry.data as any;
          error = retry.error as any;
        }

        if (error) throw error;
        setMonthPendingAppointments((data as Appointment[]) || []);
      } catch (error: any) {
        console.error('Erro ao carregar pendentes do mês:', error);
        toast.error(error?.message || 'Erro ao carregar pendentes do mês.');
        setMonthPendingAppointments([]);
      } finally {
        setIsLoadingMonthPending(false);
      }
    };

    const monthPendingTotal = monthPendingAppointments.length;
    const monthPendingVisibleAppointments = monthPendingFilterDate
      ? monthPendingAppointments.filter((apt) => String(apt.appointment_date || '') === monthPendingFilterDate)
      : monthPendingAppointments;
    const monthPendingVisibleTotal = monthPendingVisibleAppointments.length;

    const normalizeServiceKey = (value: string): string => {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    };

    const normalizeLabelColor = (rawColor?: string): string => {
      const color = String(rawColor || '').trim();
      return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : '#111827';
    };

    const getLabelTextColor = (hexColor?: string): string => {
      const normalized = normalizeLabelColor(hexColor).slice(1);
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.65 ? '#111827' : '#FFFFFF';
    };

    const getAppointmentServiceLabels = (apt: Appointment): Array<{ name: string; color: string }> => {
      if (!apt?.service || serviceSubcategories.length === 0) return [];
      const normalizedParts = String(apt.service)
        .split(',')
        .map((part) => normalizeServiceKey(part))
        .filter(Boolean);
      if (normalizedParts.length === 0) return [];

      const directMatches = serviceSubcategories.filter((subcategory) => {
        const key = normalizeServiceKey(subcategory.name);
        return normalizedParts.includes(key);
      });

      const candidates = directMatches.length > 0
        ? directMatches
        : serviceSubcategories.filter((subcategory) => {
          const key = normalizeServiceKey(subcategory.name);
          return normalizedParts.some((part) => part.includes(key) || key.includes(part));
        });

      const unique = new Map<string, { name: string; color: string }>();
      for (const candidate of candidates) {
        const labelName = String(candidate.label_name || '').trim();
        if (!labelName) continue;
        const color = normalizeLabelColor(candidate.label_color);
        const mapKey = `${labelName}__${color}`;
        if (!unique.has(mapKey)) unique.set(mapKey, { name: labelName, color });
      }
      return Array.from(unique.values()).slice(0, 2);
    };

    const getSubscriptionLabelColor = (apt: Appointment): string | null => {
      if (!apt?.is_subscriber) return null;
      const aptSubscriptionId = String((apt as any)?.subscription_id || '').trim();
      if (aptSubscriptionId) {
        const byId = subscriptionDurations.find((sub) => String(sub?.id || '') === aptSubscriptionId);
        const color = normalizeLabelColor(String(byId?.label_color || ''));
        if (byId?.label_color && color !== '#111827') return color;
      }

      const serviceStr = String(apt?.service || '').trim();
      if (!serviceStr) return null;
      const byName = subscriptionDurations.find((sub) => {
        const subName = String(sub?.name || '').trim();
        return subName && (serviceStr.includes(subName) || subName.includes(serviceStr));
      });
      if (!byName?.label_color) return null;
      const color = normalizeLabelColor(byName.label_color);
      return color === '#111827' ? null : color;
    };

    const isAvulsoLike = (apt: Appointment): boolean => {
      const name = getDisplayedClientName(apt);
      return Boolean(apt.is_avulso) || /^CLIENTE\s+AVULSO(\s*-)?/i.test(String(name || '').trim());
    };

    const stripPrefixForEditing = (name: string): string => {
      return String(name || '')
        .replace(/^CLIENTE\s+AVULSO\s*-\s*/i, '')
        .replace(/^ASSINANTE\s*-\s*/i, '')
        .trim();
    };

    const startEditAvulsoName = (apt: Appointment) => {
      const current = getDisplayedClientName(apt);
      setEditingAvulsoNameId(apt.id);
      setEditingAvulsoNameValue(stripPrefixForEditing(current));
    };

    const cancelEditAvulsoName = () => {
      setEditingAvulsoNameId(null);
      setEditingAvulsoNameValue('');
    };

    const saveAvulsoName = async (apt: Appointment) => {
      const raw = editingAvulsoNameValue.trim();
      const finalName = raw.length > 0 ? raw : 'CLIENTE AVULSO';

      try {
        const { error } = await supabase
          .from('appointments')
          .update({ client_name: finalName })
          .eq('id', apt.id);
        if (error) throw error;

        setLocalClientNameOverrides((prev) => ({ ...prev, [apt.id]: finalName }));
        cancelEditAvulsoName();
        toast.success('Nome atualizado!');
        if (onAppointmentUpdate) onAppointmentUpdate();
      } catch (error) {
        console.error('Erro ao atualizar nome (avulso):', error);
        toast.error('Erro ao atualizar nome');
      }
    };

    const getSqueezeInputValue = (apt: Appointment): string => {
      if (Object.prototype.hasOwnProperty.call(squeezeNameDrafts, apt.id)) {
        return squeezeNameDrafts[apt.id];
      }
      const persisted = String(localClientNameOverrides[apt.id] ?? apt.client_name ?? '');
      return persisted === 'ENCAIXE' ? '' : persisted;
    };

    const saveSqueezeName = async (apt: Appointment, rawValue: string) => {
      const trimmed = String(rawValue || '').trim();
      const finalName = trimmed.length > 0 ? trimmed : 'ENCAIXE';
      const currentPersisted = String(localClientNameOverrides[apt.id] ?? apt.client_name ?? 'ENCAIXE').trim() || 'ENCAIXE';

      // Evita update desnecessário quando não houve mudança.
      if (finalName === currentPersisted) {
        setSqueezeNameDrafts((prev) => {
          const next = { ...prev };
          delete next[apt.id];
          return next;
        });
        return;
      }

      try {
        const { error } = await supabase
          .from('appointments')
          .update({ client_name: finalName })
          .eq('id', apt.id);
        if (error) throw error;

        setLocalClientNameOverrides((prev) => ({ ...prev, [apt.id]: finalName }));
        setSqueezeNameDrafts((prev) => {
          const next = { ...prev };
          delete next[apt.id];
          return next;
        });
        if (onAppointmentUpdate) onAppointmentUpdate();
      } catch (error) {
        console.error('Erro ao atualizar nome do encaixe:', error);
        toast.error('Erro ao atualizar nome');
      }
    };

    // Estados para criar encaixe
    const [showSqueezeModal, setShowSqueezeModal] = useState(false);
    const [selectedProfessionalForSqueeze, setSelectedProfessionalForSqueeze] = useState<string | null>(null);
    const [showSqueezeServiceModal, setShowSqueezeServiceModal] = useState(false);
    const [showSqueezeTimeModal, setShowSqueezeTimeModal] = useState(false);
    const [selectedSqueezeService, setSelectedSqueezeService] = useState<any>(null);
    const [squeezeStartTime, setSqueezeStartTime] = useState('');
    const [squeezeEndTime, setSqueezeEndTime] = useState('');
    const [showSqueezeClientModal, setShowSqueezeClientModal] = useState(false);
    const [squeezeClientType, setSqueezeClientType] = useState<'avulso' | 'known'>('avulso');
    const [squeezeKnownClients, setSqueezeKnownClients] = useState<SqueezeKnownClientOption[]>([]);
    const [squeezeKnownClientsLoading, setSqueezeKnownClientsLoading] = useState(false);
    const [squeezeKnownClientSearch, setSqueezeKnownClientSearch] = useState('');
    const [selectedSqueezeKnownClientId, setSelectedSqueezeKnownClientId] = useState<string>('');
    const [showSqueezeProfessionalModal, setShowSqueezeProfessionalModal] = useState(false);
    const [showSqueezeSubscriberClientModal, setShowSqueezeSubscriberClientModal] = useState(false);
    const [selectedSqueezeSubscriberClient, setSelectedSqueezeSubscriberClient] = useState<SqueezeSubscriberClientOption | null>(null);
    const [squeezeSubscriptionClients, setSqueezeSubscriptionClients] = useState<SqueezeSubscriberClientOption[]>([]);
    const [squeezeSubscriptionClientsLoading, setSqueezeSubscriptionClientsLoading] = useState(false);
    const [squeezeSubscriptionClientSearch, setSqueezeSubscriptionClientSearch] = useState('');

    const squeezeUsageAppointments = useMemo(() => {
      const byKey = new Map<string, (typeof appointments)[number]>();
      [...monthlyAppointments, ...appointments].forEach((apt) => {
        const key = String(apt.id || `${apt.appointment_date}_${apt.appointment_time}_${apt.service}`);
        if (!byKey.has(key)) byKey.set(key, apt);
      });
      return Array.from(byKey.values());
    }, [monthlyAppointments, appointments]);

    // Modal: Horários disponíveis (somente visualização, para print)
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [availabilityProfessionalId, setAvailabilityProfessionalId] = useState<string | null>(null);
    const [availabilityProfessionalName, setAvailabilityProfessionalName] = useState<string>('');
    const [availabilitySlots, setAvailabilitySlots] = useState<TimeSlot[]>([]);

    const isAppointmentsLockedForProfessional = (professional: Professional): boolean => {
      if (!isProfessionalAppointmentsProtected(professional)) return false;
      return !Boolean(unlockedAppointmentsByProfessional[String(professional.id)]);
    };

    const isFinancialLockedForProfessional = (professional: Professional): boolean => {
      if (bypassOwnerPinLocks) return false;
      const bypassFinancialProfessionalId = String(bypassFinancialPinForProfessionalId || '').trim();
      if (bypassFinancialProfessionalId && String(professional?.id || '').trim() === bypassFinancialProfessionalId) {
        return false;
      }
      if (!hasOwnerConfigPin) return false;
      if (!Boolean((professional as any)?.lock_financial_with_owner_pin)) return false;
      return !Boolean(unlockedFinancialByProfessional[String(professional.id)]);
    };

    const isClientNoShowCancellation = (apt: Appointment): boolean => {
      if (apt.status !== 'cancelled') return false;
      const source = String((apt as any)?.cancellation_source || '').toLowerCase();
      const detail = String((apt as any)?.cancellation_detail || '').toLowerCase();
      return (
        source.includes('no_show') ||
        detail.includes('falt') ||
        detail.includes('nao comparec') ||
        detail.includes('não comparec')
      );
    };

    const getCancellationActorInfo = (apt: Appointment): { label: string; tone: 'client' | 'internal' | 'system' | 'unknown' } => {
      const source = String(apt.cancellation_source || '').trim().toLowerCase();
      const detail = String(apt.cancellation_detail || '').trim().toLowerCase();
      const appointmentOrigin = getAppointmentOriginLabel(apt).toLowerCase();

      if (source === CANCELLATION_SOURCE.RESCHEDULED) {
        return { label: 'Remarcado/transferido para outro horário', tone: 'internal' };
      }

      if (source === CANCELLATION_SOURCE.CLIENT || detail.includes('cliente')) {
        return { label: 'Cliente cancelou pelo app/link público', tone: 'client' };
      }

      if (
        source === CANCELLATION_SOURCE.ESTABLISHMENT_STAFF ||
        detail.includes('painel') ||
        detail.includes('interno') ||
        detail.includes('barbearia') ||
        detail.includes('estabelecimento')
      ) {
        return { label: 'Cancelado dentro do sistema/barbearia', tone: 'internal' };
      }

      if (
        source === CANCELLATION_SOURCE.SYSTEM_ABANDONED_CHECKOUT ||
        source === CANCELLATION_SOURCE.SYSTEM_PAYMENT_TIMEOUT ||
        source === CANCELLATION_SOURCE.PAYMENT_REJECTED ||
        detail.includes('limpeza automática') ||
        detail.includes('pagamento')
      ) {
        return { label: describeCancellationSourcePt(source), tone: 'system' };
      }

      if (!source && !detail && appointmentOrigin.includes('interno')) {
        return {
          label: 'Registro antigo sem origem salva; agendamento criado dentro da barbearia',
          tone: 'internal',
        };
      }

      if (!source && !detail && appointmentOrigin.includes('cliente')) {
        return {
          label: 'Registro antigo sem origem salva; agendamento veio do cliente',
          tone: 'client',
        };
      }

      if (!source && !detail) {
        return {
          label: 'Registro antigo sem origem salva; não dá para confirmar quem cancelou',
          tone: 'unknown',
        };
      }

      return {
        label: describeCancellationSourcePt(source),
        tone: 'unknown',
      };
    };

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    };

    // 👁️ Privacidade: ocultar valores dos cards da agenda (ex.: gravar tela sem expor preços).
    // Só afeta a EXIBIÇÃO nos cards — nenhum cálculo/financeiro muda. Persiste por aparelho.
    const [hideCardValues, setHideCardValues] = useState<boolean>(() => {
      try { return localStorage.getItem('agenda:hideCardValues') === 'true'; } catch { return false; }
    });
    const toggleHideCardValues = () => {
      setHideCardValues((current) => {
        const next = !current;
        try { localStorage.setItem('agenda:hideCardValues', next ? 'true' : 'false'); } catch { /* ignore */ }
        return next;
      });
    };
    const displayCardMoney = (value: number) => (hideCardValues ? 'R$ ••••' : formatCurrency(value));

    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
      }
      return `${mins}min`;
    };

    const formatAppointmentCreatedAt = (createdAtRaw: unknown) => {
      const raw = String(createdAtRaw || '').trim();
      if (!raw) return 'Não disponível';
      try {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return raw;
        return format(parsed, 'dd/MM/yyyy HH:mm');
      } catch {
        return raw;
      }
    };

    // Compatibilidade com bases legadas: evita crash quando datas vêm nulas/invalidas.
    const formatDateSafe = (rawValue: unknown, fallback = 'Data não informada') => {
      const raw = String(rawValue || '').trim();
      if (!raw) return fallback;
      try {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return fallback;
        return format(parsed, 'dd/MM/yyyy');
      } catch {
        return fallback;
      }
    };

    const formatDateTimeSafe = (rawValue: unknown, fallback = 'Não disponível') => {
      const raw = String(rawValue || '').trim();
      if (!raw) return fallback;
      try {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return fallback;
        return format(parsed, 'dd/MM/yyyy HH:mm');
      } catch {
        return fallback;
      }
    };

    const calculateTotalPrice = (apt: Appointment) => {
      // Total para COBRAR DO CLIENTE: serviço + serviços extra + produtos (Produto V2)
      let total = apt.price || 0;
      if (apt.additional_products) {
        total += apt.additional_products.reduce((sum, p) => sum + p.price, 0);
      }
      if (apt.sold_products) {
        total += apt.sold_products.reduce((sum, p) => sum + p.total, 0);
      }
      return total;
    };

    const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

    const getSplitEnabledMethods = (): string[] => {
      const baseMethods = ['dinheiro', 'pix', 'credito', 'debito', 'pagar_local'];
      const custom = getCustomPaymentMethods()
        .map((method) => String(method || '').trim())
        .filter(Boolean);
      return Array.from(new Set([...baseMethods, ...custom]));
    };

    const parsePaymentSplitDetails = (apt: Appointment | null | undefined): PaymentSplitDetail[] => {
      const raw = (apt as any)?.payment_split_details;
      if (!Array.isArray(raw)) return [];
      return raw
        .map((row: any) => ({
          method: String(row?.method || '').trim(),
          amount: round2(Number(row?.amount || 0)),
          card_brand: row?.card_brand ? String(row.card_brand) : null,
        }))
        .filter((row) => row.method && Number.isFinite(row.amount) && row.amount > 0);
    };

    const getPaymentMethodTax = (method: string, cardBrand?: string | null) => {
      // Compatível com botão "Taxas do cliente" do dashboard:
      // quando ativo, não desconta taxa nos cálculos.
      let clientPaysCardFees = false;
      try {
        const key = establishment?.id ? `taxas_cliente_${establishment.id}` : '';
        if (key) {
          clientPaysCardFees = localStorage.getItem(key) === 'true';
        }
      } catch {
        clientPaysCardFees = false;
      }
      if (clientPaysCardFees) return 0;

      const creditBaseRate = Number(establishment?.credit_card_tax_percentage);
      const debitBaseRate = Number(establishment?.debit_card_tax_percentage);
      if (method === 'credito' && Number.isFinite(creditBaseRate) && creditBaseRate <= 0) return 0;
      if (method === 'debito' && Number.isFinite(debitBaseRate) && debitBaseRate <= 0) return 0;

      const resolveBrandTaxByMethod = (
        rawBrandTax: unknown,
        paymentMethod: 'credito' | 'debito',
        fallbackRate: number
      ): number => {
        const parseRate = (value: unknown): number | null => {
          const n = Number(value);
          return Number.isFinite(n) && n >= 0 ? n : null;
        };

        if (typeof rawBrandTax === 'number') {
          const parsed = parseRate(rawBrandTax);
          return parsed !== null ? parsed : fallbackRate;
        }

        if (rawBrandTax && typeof rawBrandTax === 'object') {
          const key = paymentMethod === 'credito' ? 'credito' : 'debito';
          const alt = paymentMethod === 'credito' ? 'credit' : 'debit';
          const direct = parseRate((rawBrandTax as any)?.[key] ?? (rawBrandTax as any)?.[alt]);
          if (direct !== null) return direct;
          const otherSide = parseRate(
            paymentMethod === 'credito'
              ? (rawBrandTax as any)?.debito ?? (rawBrandTax as any)?.debit
              : (rawBrandTax as any)?.credito ?? (rawBrandTax as any)?.credit
          );
          if (otherSide !== null) return otherSide;
        }

        return fallbackRate;
      };

      if ((method === 'credito' || method === 'debito') && cardBrand && cardBrand !== 'bandeira') {
        const fallbackRate = method === 'credito'
          ? (Number.isFinite(creditBaseRate) ? creditBaseRate : 3.5)
          : (Number.isFinite(debitBaseRate) ? debitBaseRate : 2.5);
        const brandRateRaw = (establishment as any)?.card_brand_taxes?.[cardBrand];
        return resolveBrandTaxByMethod(
          brandRateRaw,
          method as 'credito' | 'debito',
          fallbackRate
        );
      }
      switch (method) {
        case 'credito':
          return Number.isFinite(creditBaseRate) ? creditBaseRate : 3.5;
        case 'debito':
          return Number.isFinite(debitBaseRate) ? debitBaseRate : 2.5;
        default:
          return 0;
      }
    };

    const getCardTaxAmountForServiceBase = (apt: Appointment, serviceBaseValue: number): number => {
      const base = Number(serviceBaseValue || 0);
      if (!(base > 0)) return 0;

      const splitRows = parsePaymentSplitDetails(apt);
      if (splitRows.length > 0) {
        const totalCharge = calculateTotalPrice(apt);
        if (!(totalCharge > 0)) return 0;
        const ratio = Math.max(0, Math.min(1, base / totalCharge));
        return round2(
          splitRows.reduce((sum, row) => {
            if (row.method !== 'credito' && row.method !== 'debito') return sum;
            const rate = getPaymentMethodTax(row.method, row.card_brand || null);
            if (!(rate > 0)) return sum;
            const servicePortion = row.amount * ratio;
            return sum + (servicePortion * rate) / 100;
          }, 0)
        );
      }

      if (apt.payment_method === 'credito' || apt.payment_method === 'debito') {
        const rate = getPaymentMethodTax(String(apt.payment_method || ''), apt.card_brand || null);
        if (rate > 0) return round2((base * rate) / 100);
      }
      return 0;
    };

    const getCashAmountForAppointment = (apt: Appointment): number => {
      const splitRows = parsePaymentSplitDetails(apt);
      if (splitRows.length > 0) {
        return round2(
          splitRows
            .filter((row) => row.method === 'dinheiro')
            .reduce((sum, row) => sum + row.amount, 0)
        );
      }
      if (String(apt.payment_method || '').trim() === 'dinheiro') {
        return calculateTotalPrice(apt);
      }
      return 0;
    };

    const dailyCashSalesTotal = appointments
      .filter((apt) =>
        apt.appointment_date === selectedDateIso &&
        apt.status === 'completed'
      )
      .reduce((sum, apt) => sum + getCashAmountForAppointment(apt), 0);

    const barbershopCashTotal = barbershopCashOpeningValue + dailyCashSalesTotal;
    const barbershopCashRealAmount = Number(String(barbershopCashRealInput || '').replace(',', '.').trim());
    const hasBarbershopCashRealAmount = Number.isFinite(barbershopCashRealAmount) && barbershopCashRealInput.trim() !== '';
    const barbershopCashDifference = hasBarbershopCashRealAmount ? round2(barbershopCashRealAmount - barbershopCashTotal) : 0;

    const handleOpenBarbershopCash = () => {
      if (barbershopCashFeatureUnavailable) {
        toast.error('Estrutura do caixa da barbearia ainda nao existe no banco. Rode a migration SQL dessa feature.');
        return;
      }
      if (!canViewBarbershopCash) {
        onRequestBarbershopCashAccess?.();
        return;
      }
      setShowBarbershopCashModal(true);
    };

    const handleSaveBarbershopCashOpening = async () => {
      if (!establishment?.id) return;
      const openingAmount = Number(String(barbershopCashOpeningInput || '').replace(',', '.').trim());
      if (!Number.isFinite(openingAmount) || openingAmount < 0) {
        toast.error('Informe um valor valido para o caixa inicial do dia.');
        return;
      }

      setIsSavingBarbershopCashOpening(true);
      try {
        const { error } = await supabase.from('barbershop_daily_cash').upsert(
          {
            establishment_id: establishment.id,
            cash_date: selectedDateIso,
            opening_amount: openingAmount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'establishment_id,cash_date' }
        );
        if (error) throw error;

        setBarbershopCashOpeningValue(openingAmount);
        setBarbershopCashOpeningInput(String(openingAmount));
        await Promise.all([
          loadBarbershopCashOpening(),
          loadBarbershopCashHistory(),
        ]);
        toast.success('Caixa da barbearia atualizado com sucesso.');
      } catch (error: any) {
        console.error('Erro ao salvar caixa da barbearia:', error);
        if (String(error?.code || '') === '42P01') {
          setBarbershopCashFeatureUnavailable(true);
        }
        toast.error(getSupabaseErrorMessage(error, 'Nao foi possivel salvar o caixa da barbearia.'));
      } finally {
        setIsSavingBarbershopCashOpening(false);
      }
    };

    const calculateServiceTotal = (apt: Appointment) => {
      // Total do SERVIÇO (financeiro do barbeiro): serviço base + serviços extras (sem produtos V2)
      let total = apt.price || 0;
      if (apt.additional_products) {
        total += apt.additional_products.reduce((sum, p) => sum + p.price, 0);
      }
      // Compatibilidade com bases legadas: evita inflar quando total_price é menor que a soma manual.
      const cappedTotal = Number((apt as any)?.total_price || 0);
      if (Number.isFinite(cappedTotal) && cappedTotal > 0 && total > cappedTotal) return cappedTotal;
      return total;
    };

    const getProfessionalTipAmount = (apt: Appointment): number => {
      const n = Number((apt as any)?.professional_tip_amount ?? 0);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.round(n * 100) / 100;
    };

    const getIntervaloAgendaMinutos = (): number => {
      // Mesma regra usada no backend do estabelecimento / configs
      const use15 = use15MinuteInterval ?? Boolean(establishment?.use_15_minute_interval);
      const use20 = use20MinuteSchedule ?? Boolean(establishment?.use_20_minute_schedule);
      const use60 = use60MinuteSchedule ?? Boolean((establishment as any)?.use_60_minute_schedule);
      if (use60) return 60;
      if (use20) return 20;
      if (use15) return 30;
      return 15;
    };

    const normalizeName = (value: string): string =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const parseDurationMinutes = (raw: unknown, fallback: number): number => {
      if (typeof raw === 'number') {
        return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
      }
      const rawText = String(raw || '').trim();
      if (!rawText) return fallback;
      const direct = Number(rawText);
      if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
      const match = rawText.match(/(\d+)/);
      if (!match) return fallback;
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    };

    const normalizeTimeText = (rawValue: unknown, fallback = '00:00'): string => {
      const raw = String(rawValue || '').trim();
      const normalizedFallback = /^\d{2}:\d{2}$/.test(fallback) ? fallback : '00:00';
      const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
      if (!hhmm) return normalizedFallback;
      const hour = Number(hhmm[1]);
      const minute = Number(hhmm[2]);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return normalizedFallback;
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return normalizedFallback;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    };

    const parseTimeSafe = (rawValue: unknown, baseDate: Date, fallback = '00:00'): Date => {
      return parse(normalizeTimeText(rawValue, fallback), 'HH:mm', baseDate);
    };

    // Duração base: assinantes usam util que alinha plano vs. valor salvo (evita 30min no DB com plano 60min).
    const getEffectiveBaseDuration = (apt: Appointment, interval: number): number => {
      return getEffectiveAppointmentBaseDurationMinutes(apt as any, interval, subscriptionDurations);
    };

    const getDuracaoTotalAgendamento = (apt: Appointment, interval: number): number => {
      const base = getEffectiveBaseDuration(apt, interval);
      const extra = (apt.additional_products || []).reduce(
        (sum, p) => sum + parseDurationMinutes((p as any)?.duration, 0),
        0
      );
      // Importante: respeitar duração real (ex.: "Terminei Antes" com 5min),
      // sem forçar arredondamento para o intervalo da grade.
      return Math.max(1, base + extra);
    };

    const appointmentBelongsToProfessionalColumn = (apt: Appointment, professional: Professional): boolean => {
      const normalizeProfessionalToken = (value: unknown): string =>
        String(value ?? '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase();
      const isUuidValue = (value: string): boolean =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

      const professionalId = String(professional?.id || '').trim();
      const professionalNameNorm = normalizeProfessionalToken((professional as any)?.name || '');
      const aptProfessional = String((apt as any)?.professional || '').trim();
      const aptProfessionalId = String((apt as any)?.professional_id || '').trim();
      const aptProfessionalName = String((apt as any)?.professional_name || '').trim();

      const normalizedProfessionalId = professionalId.toLowerCase();
      if (
        (aptProfessionalId && aptProfessionalId.toLowerCase() === normalizedProfessionalId) ||
        (aptProfessional && aptProfessional.toLowerCase() === normalizedProfessionalId)
      ) {
        return true;
      }

      const nameCandidates = [
        aptProfessionalName,
        isUuidValue(aptProfessional) ? '' : aptProfessional,
      ]
        .map((value) => normalizeProfessionalToken(value))
        .filter(Boolean);

      return Boolean(professionalNameNorm) && nameCandidates.includes(professionalNameNorm);
    };

    const intervaloAgendaMinutos = getIntervaloAgendaMinutos();

    // Gerar todos os horários possíveis do dia com agendamentos mesclados
    const generateTimeSlotsWithAppointments = (professional: Professional): TimeSlot[] => {
      const dayOfWeek = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ][selectedDate.getDay()];

      const dayHours = businessHours[dayOfWeek];
      if (!dayHours || !dayHours.enabled) {
        return [];
      }

      const professionalWorkHours = (professional as any).work_hours?.[dayOfWeek];

      let startTime: string;
      let endTime: string;

      if (professionalWorkHours && professionalWorkHours.enabled) {
        startTime = professionalWorkHours.entry_time || dayHours.open1;
        endTime = professionalWorkHours.exit_time || dayHours.close1;
      } else {
        startTime = dayHours.open1;
        endTime = dayHours.close1;
      }

      const allSlots: string[] = [];
      const start = parseTimeSafe(startTime, selectedDate, '08:00');
      const end = parseTimeSafe(endTime, selectedDate, '18:00');

      // ✅ Ocultar horários do intervalo (break) na visualização "Horários disponíveis"
      // O booking já trata intervalo; aqui é uma grade de visualização/print e não deve mostrar o intervalo.
      const breakStart = professionalWorkHours?.break_start
        ? parseTimeSafe(professionalWorkHours.break_start, selectedDate)
        : null;
      const breakEnd = professionalWorkHours?.break_end
        ? parseTimeSafe(professionalWorkHours.break_end, selectedDate)
        : null;

      // Determinar o intervalo baseado nas configurações do estabelecimento
      const interval = intervaloAgendaMinutos;

      let current = start;
      while (current < end) {
        const isInBreak =
          Boolean(breakStart && breakEnd) && current >= (breakStart as Date) && current < (breakEnd as Date);

        if (!isInBreak) {
          allSlots.push(format(current, 'HH:mm'));
        }
        current = new Date(current.getTime() + interval * 60000);
      }

      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

      // Separar encaixes dos agendamentos normais
      const normalAppointments = appointmentsForDisplay.filter((apt) =>
        appointmentBelongsToProfessionalColumn(apt, professional) &&
        apt.appointment_date === selectedDateStr &&
        String(apt.status || '').toLowerCase() !== 'cancelled' &&
        !apt.is_squeeze
      );

      const squeezeAppointments = appointmentsForDisplay.filter((apt) =>
        appointmentBelongsToProfessionalColumn(apt, professional) &&
        apt.appointment_date === selectedDateStr &&
        String(apt.status || '').toLowerCase() !== 'cancelled' &&
        apt.is_squeeze
      );

      const professionalAppointments = [...normalAppointments, ...squeezeAppointments].sort(
        (a, b) =>
          parseTimeSafe(a.appointment_time, selectedDate).getTime() -
          parseTimeSafe(b.appointment_time, selectedDate).getTime()
      );

      // Incluir só horário de TÉRMINO fora do grid (ex: 14:50) — não adicionar 16:30, 16:50 etc. se já estão na grade ou não há agendamento terminando ali
      const periodStartMins = parseTimeSafe(startTime, selectedDate, '08:00').getTime();
      const periodEndMins = parseTimeSafe(endTime, selectedDate, '18:00').getTime();

      // ✅ Incluir INÍCIO de agendamento fora da grade (ex.: 12:05) para exibir card no horário real.
      professionalAppointments.forEach((apt) => {
        const aptStart = parseTimeSafe(apt.appointment_time, selectedDate);
        const startTimeStr = format(aptStart, 'HH:mm');
        const [sh, sm] = startTimeStr.split(':').map(Number);
        const aptStartMins = sh * 60 + sm;
        const isOffGridStart = aptStartMins % interval !== 0;
        const inPeriod = aptStart.getTime() >= periodStartMins && aptStart.getTime() < periodEndMins;
        if (isOffGridStart && inPeriod && !allSlots.includes(startTimeStr)) {
          allSlots.push(startTimeStr);
        }
      });

      professionalAppointments.forEach((apt) => {
        const aptStart = parseTimeSafe(apt.appointment_time, selectedDate);
        const duration = getDuracaoTotalAgendamento(apt, interval);
        const aptEnd = new Date(aptStart.getTime() + duration * 60000);
        const endTimeStr = format(aptEnd, 'HH:mm');
        const [eh, em] = endTimeStr.split(':').map(Number);
        const aptEndMins = eh * 60 + em;
        const isOffGrid = aptEndMins % interval !== 0;
        const inPeriod = aptEnd.getTime() >= periodStartMins && aptEnd.getTime() < periodEndMins;
        if (isOffGrid && inPeriod && !allSlots.includes(endTimeStr)) {
          allSlots.push(endTimeStr);
        }
      });

      // ✅ Encaixes fora da grade: incluir horários reais na grade para ficarem visíveis.
      // Ex.: abre 09:00, mas encaixe 08:20-08:55 deve aparecer na grade.
      squeezeAppointments.forEach((squeeze) => {
        const squeezeStartTotal = timeToMinutes(squeeze.appointment_time);
        const squeezeDuration = getDuracaoTotalAgendamento(squeeze, interval);
        const squeezeEndTotal = squeezeStartTotal + squeezeDuration;

        for (let currentTotal = squeezeStartTotal; currentTotal < squeezeEndTotal; currentTotal += interval) {
          const slotTime = minutesToHHmm(currentTotal);
          if (!allSlots.includes(slotTime)) {
            allSlots.push(slotTime);
          }
        }
      });

      allSlots.sort((a, b) => {
        const [ah, am] = a.split(':').map(Number);
        const [bh, bm] = b.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
      });

      const occupiedSlots = new Map<string, { appointment?: Appointment; isOccupied: boolean; parentAppointment?: Appointment; isSqueeze?: boolean }>();
      const squeezeSlotsMap = new Map<string, Appointment[]>(); // Mapa de slot -> encaixes

      // Processar agendamentos normais (ordenados por horário).
      // Importante: um agendamento que COMEÇA às 11:30 não pode sobrescrever o slot 11:30 já marcado
      // como continuação (ex.: 11:00–60min), senão a grade mostra 11:30 "livre" para novo booking.
      normalAppointments.forEach((apt) => {
        const startTime = apt.appointment_time;
        const duration = getDuracaoTotalAgendamento(apt, interval);

        const existingAtStart = occupiedSlots.get(startTime);
        if (
          existingAtStart?.isOccupied &&
          existingAtStart.parentAppointment &&
          existingAtStart.parentAppointment.id !== apt.id
        ) {
          occupiedSlots.set(startTime, {
            isOccupied: true,
            parentAppointment: existingAtStart.parentAppointment,
            conflictingAppointment: apt,
          });
        } else {
          occupiedSlots.set(startTime, { appointment: apt, isOccupied: false });
        }

        const startDate = parseTimeSafe(startTime, selectedDate);
        for (let i = interval; i < duration; i += interval) {
          const occupiedTime = format(new Date(startDate.getTime() + i * 60000), 'HH:mm');
          const prev = occupiedSlots.get(occupiedTime);
          if (prev?.appointment && prev.appointment.id !== apt.id) {
            continue;
          }
          occupiedSlots.set(occupiedTime, { isOccupied: true, parentAppointment: apt });
        }
      });

      // Marcar como OCUPADOS todos os slots que caem DENTRO da duração (ex: 13:50 60min → 14:00, 14:20, 14:40)
      // O loop acima só preenche horários no grid start+k*interval (ex: 14:10, 14:30); slots como 14:00/14:20/14:40 ficavam livres
      normalAppointments.forEach((apt) => {
        const [startH, startM] = apt.appointment_time.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const duration = getDuracaoTotalAgendamento(apt, interval);
        const endTotal = startTotal + duration;
        allSlots.forEach((slot) => {
          const [sh, sm] = slot.split(':').map(Number);
          const slotTotal = sh * 60 + sm;
          if (slotTotal > startTotal && slotTotal < endTotal) {
            const existing = occupiedSlots.get(slot);
            if (!existing?.appointment) {
              occupiedSlots.set(slot, { isOccupied: true, parentAppointment: apt });
            }
          }
        });
      });

      // Processar encaixes - adicionar como appointment no slot mais próximo e bloquear horários
      squeezeAppointments.forEach((squeeze) => {
        const squeezeStartTime = squeeze.appointment_time;
        const [startHours, startMins] = squeezeStartTime.split(':').map(Number);
        const squeezeStartTotal = startHours * 60 + startMins;

        // Encontrar o slot mais próximo
        let nearestSlot = allSlots[0];
        let minDiff = Math.abs(squeezeStartTotal - allSlots[0].split(':').map(Number).reduce((h, m) => h * 60 + m));

        allSlots.forEach(slot => {
          const [slotHours, slotMins] = slot.split(':').map(Number);
          const slotTotal = slotHours * 60 + slotMins;
          const diff = Math.abs(squeezeStartTotal - slotTotal);
          if (diff < minDiff) {
            minDiff = diff;
            nearestSlot = slot;
          }
        });

        // Adicionar encaixe como appointment no slot mais próximo (para aparecer como agendamento normal)
        if (!occupiedSlots.has(nearestSlot)) {
          occupiedSlots.set(nearestSlot, { appointment: squeeze, isOccupied: false });
        } else {
          // Se o slot já tem algo, adicionar encaixe abaixo (em squeezes)
          if (!squeezeSlotsMap.has(nearestSlot)) {
            squeezeSlotsMap.set(nearestSlot, []);
          }
          squeezeSlotsMap.get(nearestSlot)!.push(squeeze);
        }

        // Bloquear todos os horários dentro do intervalo do encaixe
        const squeezeDuration = getDuracaoTotalAgendamento(squeeze, interval);
        const squeezeStartDate = parseTimeSafe(squeezeStartTime, selectedDate);

        allSlots.forEach(slot => {
          if (slot === nearestSlot) return; // Não bloquear o slot principal onde o encaixe aparece

          const [slotHours, slotMins] = slot.split(':').map(Number);
          const slotTotal = slotHours * 60 + slotMins;
          const squeezeEndTotal = squeezeStartTotal + squeezeDuration;

          // Se o slot está dentro do intervalo do encaixe, marcar como ocupado pelo encaixe
          if (slotTotal >= squeezeStartTotal && slotTotal < squeezeEndTotal) {
            if (!occupiedSlots.has(slot)) {
              occupiedSlots.set(slot, { isOccupied: true, parentAppointment: squeeze, isSqueeze: true });
            } else {
              // Se já tem algo, adicionar como ocupado pelo encaixe
              const existing = occupiedSlots.get(slot)!;
              if (!existing.appointment) {
                occupiedSlots.set(slot, { ...existing, isOccupied: true, parentAppointment: squeeze, isSqueeze: true });
              }
            }
          }
        });
      });

      // Verificar horários bloqueados para este profissional na data selecionada.
      // Compatibilidade: alguns legados salvaram data/hora em formatos diferentes.
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      const legacyDateKeyBr = format(selectedDate, 'dd/MM/yyyy');
      const legacyDateKeyBrShort = format(selectedDate, 'd/M/yyyy');
      const normalizeBlockedTime = (raw: unknown): string => {
        const value = String(raw || '').trim().replace(';', ':');
        if (!value) return '';
        if (/^\d{1,2}:\d{1,2}$/.test(value)) {
          const [hRaw, mRaw] = value.split(':');
          const h = Number(hRaw);
          const m = Number(mRaw);
          if (Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        }
        const digits = value.replace(/\D/g, '');
        if (digits.length === 3) {
          const h = Number(digits.slice(0, 1));
          const m = Number(digits.slice(1));
          if (Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        }
        if (digits.length === 4) {
          const h = Number(digits.slice(0, 2));
          const m = Number(digits.slice(2));
          if (Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        }
        return '';
      };
      const blockedMap = ((professional as any).blocked_hours || {}) as Record<string, unknown>;
      const blockedHours = Array.from(new Set([
        ...(Array.isArray(blockedMap[dateKey]) ? (blockedMap[dateKey] as unknown[]) : []),
        ...(Array.isArray(blockedMap[legacyDateKeyBr]) ? (blockedMap[legacyDateKeyBr] as unknown[]) : []),
        ...(Array.isArray(blockedMap[legacyDateKeyBrShort]) ? (blockedMap[legacyDateKeyBrShort] as unknown[]) : []),
      ]
        .map((item) => normalizeBlockedTime(item))
        .filter(Boolean)));
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const isToday = dateKey === todayKey;
      const now = new Date();

      const result: TimeSlot[] = allSlots.map((slot) => {
        const occupied = occupiedSlots.get(slot);
        const isBlocked = blockedHours.includes(slot);
        const squeezesForSlot = squeezeSlotsMap.get(slot) || [];
        const slotDateTime = parseTimeSafe(slot, selectedDate);
        const isPast = isToday && slotDateTime <= now;

        if (occupied?.appointment) {
          return {
            time: slot,
            appointment: occupied.appointment,
            isEmpty: false,
            isOccupied: false,
            isBlocked: false,
            isPast,
          };
        } else if (occupied?.isOccupied && occupied.isSqueeze) {
          // Slot ocupado por encaixe
          return {
            time: slot,
            isEmpty: false,
            isOccupied: true,
            isBlocked: false,
            isPast,
            parentAppointment: occupied.parentAppointment,
          };
        } else if (occupied?.isOccupied) {
          return {
            time: slot,
            isEmpty: false,
            isOccupied: true,
            isBlocked: false,
            isPast,
            parentAppointment: occupied.parentAppointment,
          };
        } else if (isBlocked) {
          return {
            time: slot,
            isEmpty: false,
            isOccupied: false,
            isBlocked: true,
            isPast,
          };
        } else {
          return {
            time: slot,
            isEmpty: true,
            isOccupied: false,
            isBlocked: false,
            isPast,
          };
        }
      });

      // Adicionar encaixes aos slots (para exibição abaixo do horário)
      result.forEach(slot => {
        const squeezes = squeezeSlotsMap.get(slot.time);
        if (squeezes && squeezes.length > 0) {
          // Adicionar encaixes ao slot
          (slot as any).squeezes = squeezes;
        }
      });

      return result;
    };

    useEffect(() => {
      if (!showAvailabilityModal || !availabilityProfessionalId) return;
      const professional = professionals.find((p) => String(p.id) === String(availabilityProfessionalId));
      if (!professional) return;
      setAvailabilityProfessionalName(professional.name);
      setAvailabilitySlots(generateTimeSlotsWithAppointments(professional));
      // Atualiza automaticamente o modal quando agendamentos/data mudarem,
      // mantendo a mesma lógica visual do Booking.
    }, [showAvailabilityModal, availabilityProfessionalId, appointments, selectedDate, professionals]);

    const toggleAppointmentExpansion = (appointmentId: string) => {
      setModalAptId((prev) => {
        if (prev === appointmentId) return null;
        onAppointmentDetailsOpen?.();
        return appointmentId;
      });
    };

    const syncBookingProductsToStockOnCompletion = async (appointment: Appointment) => {
      const extraItems = Array.isArray(appointment?.additional_products) ? appointment.additional_products : [];
      const bookingProducts = extraItems
        .map((item: any) => ({
          product_id: String(item?.product_id || '').trim(),
          name: String(item?.name || 'Produto').trim() || 'Produto',
          price: Number(item?.price || 0),
          item_type: String(item?.item_type || '').trim().toLowerCase(),
        }))
        .filter((item: any) => item.item_type === 'booking_product' && item.product_id);

      if (bookingProducts.length === 0) return;

      const { data: existingRows, error: existingError } = await supabase
        .from('appointment_products')
        .select('product_id')
        .eq('appointment_id', appointment.id);

      if (existingError) throw existingError;

      const existingProductIds = new Set(
        (Array.isArray(existingRows) ? existingRows : []).map((row: any) => String(row?.product_id || '').trim())
      );

      const toInsert = bookingProducts.filter((item: any) => !existingProductIds.has(item.product_id));
      if (toInsert.length === 0) return;

      for (const product of toInsert) {
        const { data: currentProduct, error: productError } = await supabase
          .from('establishment_products')
          .select('stock_quantity,sold_quantity')
          .eq('id', product.product_id)
          .maybeSingle();

        if (productError) throw productError;
        if (!currentProduct) continue;

        const currentStock = Number((currentProduct as any)?.stock_quantity || 0);
        const currentSold = Number((currentProduct as any)?.sold_quantity || 0);
        if (currentStock <= 0) {
          toast(`Sem estoque para ${product.name}. Produto não foi baixado no estoque.`, 'warning');
          continue;
        }

        const { error: insertError } = await supabase
          .from('appointment_products')
          .insert({
            appointment_id: appointment.id,
            product_id: product.product_id,
            quantity: 1,
            unit_price: Number.isFinite(product.price) && product.price > 0 ? product.price : 0,
            professional_id: appointment.professional || null,
          } as any);

        if (insertError) throw insertError;

        const { error: stockError } = await supabase
          .from('establishment_products')
          .update({
            stock_quantity: Math.max(0, currentStock - 1),
            sold_quantity: currentSold + 1,
          } as any)
          .eq('id', product.product_id);

        if (stockError) throw stockError;
      }
    };

    const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
      try {
        const isMissingManualStatusOverrideError = (errorLike: any): boolean => {
          const code = String(errorLike?.code || '').toUpperCase();
          const message = String(errorLike?.message || '').toLowerCase();
          const details = String(errorLike?.details || '').toLowerCase();
          const hint = String(errorLike?.hint || '').toLowerCase();
          const text = `${message} ${details} ${hint}`;
          const mentionsColumn = text.includes('manual_status_override');
          const looksMissingColumn =
            code === '42703' ||
            code === 'PGRST204' ||
            text.includes('could not find') ||
            text.includes('does not exist') ||
            text.includes('column');
          return mentionsColumn && looksMissingColumn;
        };
        const appointment = (appointments || []).find((apt) => String(apt.id) === String(appointmentId));
        const previousStatus = String(appointment?.status || '').trim().toLowerCase();

        // ── AVISO DE ATENDIMENTO JÁ PAGO ────────────────────────────────────────
        // Desfazer um atendimento CONCLUÍDO (voltar para pendente, cancelar, marcar
        // "cliente faltou") tira o valor da conta do profissional — mas se o acerto
        // dele já foi feito, o dinheiro JÁ SAIU do caixa. O sistema então abatia essa
        // diferença do acerto seguinte em silêncio, e o barbeiro via um valor a pagar
        // menor do que o profissional tinha produzido, sem nenhuma explicação na tela
        // (caso real: R$ 556,83 a pagar para quem havia produzido R$ 1.100 no período).
        // Aqui a pessoa decide sabendo o que vai acontecer.
        if (previousStatus === 'completed' && newStatus !== 'completed') {
          const professionalKey = String((appointment as any)?.professional || '').trim();
          let alreadyPaidAfter = false;
          try {
            const { data: paymentRows } = await supabase
              .from('professional_payments')
              .select('payment_date, amount')
              .eq('establishment_id', String((appointment as any)?.establishment_id || ''))
              .eq('professional_id', professionalKey)
              .gt('amount', 0)
              .order('payment_date', { ascending: false })
              .limit(1);
            const lastPaymentAt = (paymentRows as any[])?.[0]?.payment_date;
            const aptDateKey = String((appointment as any)?.appointment_date || '').slice(0, 10);
            if (lastPaymentAt && aptDateKey) {
              // O acerto foi feito DEPOIS do dia do atendimento => já pagou por ele.
              alreadyPaidAfter = String(lastPaymentAt).slice(0, 10) >= aptDateKey;
            }
          } catch {
            // Consulta é só para o aviso: se falhar, segue sem bloquear a ação.
          }

          if (alreadyPaidAfter) {
            const valorApt = Number((appointment as any)?.total_price ?? (appointment as any)?.price ?? 0);
            const ok = window.confirm(
              `Atenção: este atendimento já foi pago ao profissional.\n\n` +
              `Cliente: ${String((appointment as any)?.client_name || '—')}\n` +
              `Valor: ${formatCurrency(valorApt)}\n\n` +
              `Se você desfizer, o dinheiro continua com ele e a diferença será descontada do próximo acerto.\n\n` +
              `Deseja continuar mesmo assim?`
            );
            if (!ok) return;
          }
        }

        const todayDateKey = format(new Date(), 'yyyy-MM-dd');
        const isTodayAppointment = String((appointment as any)?.appointment_date || '') === todayDateKey;
        const isBlockedByHourError = (err: any): boolean => {
          const code = String(err?.code || '').trim();
          const message = String(err?.message || '').toLowerCase();
          return code === 'P0001' && message.includes('bloqueado para este profissional');
        };

        const cancelPayload =
          newStatus === 'cancelled'
            ? ({
              status: 'cancelled',
              manual_status_override: false,
              cancellation_source: CANCELLATION_SOURCE.ESTABLISHMENT_STAFF,
              cancellation_detail: 'Cancelado pelo painel de agenda (ações rápidas).',
            } as Record<string, unknown>)
            : ({
              status: newStatus,
              ...(newStatus === 'pending' || newStatus === 'confirmed'
                ? { manual_status_override: true }
                : { manual_status_override: false }),
              ...(newStatus === 'completed' && appointment
                ? buildCompletionPaymentPatch(appointment as any)
                : {}),
            } as Record<string, unknown>);

        let { error } = await supabase.from('appointments').update(cancelPayload as any).eq('id', appointmentId);

        if (error && newStatus === 'cancelled' && isMissingManualStatusOverrideError(error)) {
          const fb = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId);
          error = fb.error;
        }
        if (error && isMissingManualStatusOverrideError(error)) {
          const fb = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId);
          error = fb.error;
        }

        // Compatibilidade: se o banco estiver com trigger de bloqueio estrito e for concluir no dia atual,
        // tenta novamente com override explícito (sem quebrar bancos legados).
        if (error && newStatus === 'completed' && isTodayAppointment && isBlockedByHourError(error)) {
          const retry = await supabase
            .from('appointments')
            .update({
              status: newStatus,
              allow_blocked_override: true,
              ...(appointment ? buildCompletionPaymentPatch(appointment as any) : {}),
            } as any)
            .eq('id', appointmentId);
          error = retry.error;
        }

        if (error) throw error;

        if (appointment && newStatus === 'completed' && previousStatus !== 'completed') {
          await syncBookingProductsToStockOnCompletion(appointment);
          await registerSubscriberAttendanceAutomatically(appointment);
        }

        if (appointment && newStatus === 'cancelled' && previousStatus === 'completed') {
          const { removedCount, error: removeAttendanceError } =
            await removeSubscriberAttendanceForCancelledAppointment({
              establishmentId: String(establishment?.id || ''),
              appointmentId: String(appointment.id || ''),
              appointmentDate: String((appointment as any)?.appointment_date || '').slice(0, 10),
              professionalName: resolveAppointmentProfessionalName(appointment),
              clientWhatsapp: String((appointment as any)?.client_whatsapp || ''),
            });
          if (removeAttendanceError) {
            console.warn('⚠️ Falha ao remover atendimento de assinatura ao cancelar:', removeAttendanceError);
          }
          if (removedCount > 0) {
            void refreshSubscriberFinancialByProfessional();
          }
        }

        const actionLabelByStatus: Record<string, string> = {
          pending: 'Botão Pendente',
          confirmed: 'Botão Confirmado',
          cancelled: 'Botão Cancelar',
          completed: 'Botão Concluído',
        };
        const clickedAt = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
        await writeAppointmentChangeLog({
          appointmentId,
          eventType: 'status_changed',
          description: `Status alterado para ${String(newStatus || '').toUpperCase()} pelo card de ações.`,
          oldValues: { status: previousStatus || null },
          newValues: { status: newStatus },
          metadata: {
            action: actionLabelByStatus[String(newStatus)] || 'Alteração de status',
            clicked_at: clickedAt,
            selected_date: format(selectedDate, 'dd/MM/yyyy'),
            selected_time: String(appointment?.appointment_time || ''),
          },
        });

        const statusMessages = {
          'pending': 'Agendamento marcado como PENDENTE',
          'confirmed': 'Agendamento confirmado',
          'cancelled': 'Agendamento cancelado',
          'completed': 'Agendamento marcado como CONCLUÍDO'
        };

        toast(statusMessages[newStatus]);

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao atualizar status:', error);
        toast(error.message || 'Erro ao atualizar status do agendamento');
      }
    };

    const handleRestoreCancelledAppointment = async (appointment: Appointment) => {
      try {
        // Primeiro tenta restaurar normalmente.
        const { error } = await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', appointment.id);

        if (!error) {
          await writeAppointmentChangeLog({
            appointmentId: appointment.id,
            eventType: 'appointment_restored',
            description: 'Agendamento cancelado restabelecido.',
            oldValues: { status: String(appointment.status || 'cancelled') },
            newValues: { status: 'confirmed' },
          });
          toast('Agendamento restabelecido com sucesso');
          onAppointmentUpdate?.();
          return;
        }

        const errorMessage = String(error?.message || '').toLowerCase();
        const isConflictError = errorMessage.includes('já está reservado') || errorMessage.includes('horário');
        if (!isConflictError) {
          throw error;
        }

        // Conflito de horário: permitir forçar restabelecimento
        // cancelando os agendamentos ativos que colidem com este horário.
        const toMinutes = (hhmm: string): number => {
          const [h, m] = String(hhmm || '00:00').split(':').map(Number);
          return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
        };
        const overlaps = (startA: number, durA: number, startB: number, durB: number): boolean => {
          const endA = startA + durA;
          const endB = startB + durB;
          return startA < endB && startB < endA;
        };

        const targetStart = toMinutes(appointment.appointment_time);
        const targetDur = getDuracaoTotalAgendamento(appointment, intervaloAgendaMinutos);
        const conflictingAppointments = appointments.filter((apt) =>
          apt.id !== appointment.id &&
          apt.professional === appointment.professional &&
          apt.appointment_date === appointment.appointment_date &&
          apt.status !== 'cancelled' &&
          overlaps(
            targetStart,
            targetDur,
            toMinutes(apt.appointment_time),
            getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos)
          )
        );

        if (conflictingAppointments.length === 0) {
          throw error;
        }

        const shouldForce = window.confirm(
          `Esse horário está ocupado por ${conflictingAppointments.length} agendamento(s) ativo(s). Deseja cancelar o(s) conflito(s) e restabelecer este agendamento?`
        );
        if (!shouldForce) return;

        const conflictingIds = conflictingAppointments.map((apt) => apt.id);
        const { error: cancelConflictsError } = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .in('id', conflictingIds);
        if (cancelConflictsError) throw cancelConflictsError;

        const { error: restoreError } = await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', appointment.id);
        if (restoreError) throw restoreError;

        await writeAppointmentChangeLog({
          appointmentId: appointment.id,
          eventType: 'appointment_restored',
          description: 'Agendamento restabelecido após resolver conflito de horário.',
          oldValues: { status: String(appointment.status || 'cancelled') },
          newValues: { status: 'confirmed' },
          metadata: {
            conflicting_cancelled_count: conflictingAppointments.length,
          },
        });

        toast('Agendamento restabelecido com sucesso');
        onAppointmentUpdate?.();
      } catch (restoreError: any) {
        console.error('Erro ao restabelecer agendamento:', restoreError);
        toast(restoreError?.message || 'Erro ao restabelecer agendamento');
      }
    };

    const handleEditAppointmentValue = (appointmentId: string, currentValue: number) => {
      setEditingAppointmentValue(appointmentId);
      setEditingValue(currentValue.toFixed(2).replace('.', ','));
    };

    const handleCancelEditValue = () => {
      setEditingAppointmentValue(null);
      setEditingValue('');
    };

    const handleSaveAppointmentValue = async (appointmentId: string) => {
      try {
        const numericValue = parseFloat(editingValue.replace(',', '.'));
        if (isNaN(numericValue) || numericValue < 0) {
          toast('Valor inválido');
          return;
        }

        const appointment = appointments.find(apt => apt.id === appointmentId);
        const soldProductsTotal = appointment?.sold_products?.reduce((sum, p) =>
          sum + (p.quantity * p.unit_price), 0) ?? 0;
        const additionalProductsTotal = appointment?.additional_products?.reduce((sum, p) =>
          sum + (p.price ?? 0), 0) ?? 0;
        const correctTotal = numericValue + soldProductsTotal + additionalProductsTotal;

        const { error } = await supabase
          .from('appointments')
          .update({ price: numericValue, total_price: correctTotal })
          .eq('id', appointmentId);

        if (error) throw error;

        const oldPrice = Number(appointment?.price || 0);
        const oldTotal = Number((appointment as any)?.total_price || oldPrice);

        await writeAppointmentChangeLog({
          appointmentId,
          eventType: 'price_changed',
          description: `Valor alterado de ${formatCurrency(oldPrice)} para ${formatCurrency(numericValue)}.`,
          oldValues: {
            price: oldPrice,
            total_price: oldTotal,
          },
          newValues: {
            price: numericValue,
            total_price: correctTotal,
          },
        });

        toast('Valor atualizado com sucesso!');
        setEditingAppointmentValue(null);
        setEditingValue('');

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao atualizar valor:', error);
        toast(error.message || 'Erro ao atualizar valor');
      }
    };

    const handleCloseTipModal = () => {
      if (isSavingProfessionalTip) return;
      setTipModalAppointment(null);
      setTipModalInput('');
    };

    const handleSaveProfessionalTip = async () => {
      if (!tipModalAppointment) return;
      const rawTrim = String(tipModalInput || '').trim();
      let rounded = 0;
      if (rawTrim !== '') {
        const numericValue = parseFloat(rawTrim.replace(/\./g, '').replace(',', '.'));
        if (Number.isNaN(numericValue) || numericValue < 0) {
          toast('Informe um valor válido (ex.: 10 ou 10,50) ou deixe vazio para zerar.');
          return;
        }
        rounded = Math.round(numericValue * 100) / 100;
      }
      setIsSavingProfessionalTip(true);
      try {
        const payload: any = { professional_tip_amount: rounded };
        let { error } = await supabase.from('appointments').update(payload).eq('id', tipModalAppointment.id);
        if (error) {
          const msg = String((error as any)?.message || '').toLowerCase();
          if (msg.includes('professional_tip') || (msg.includes('column') && msg.includes('tip'))) {
            toast.error(
              'Coluna de gorjeta ainda não existe no banco. Cole o SQL da migration no Supabase (arquivo supabase/migrations/20260410120000_add_professional_tip_amount_to_appointments.sql).'
            );
            throw error;
          }
          throw error;
        }

        const clickedAt = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
        await writeAppointmentChangeLog({
          appointmentId: tipModalAppointment.id,
          eventType: 'professional_tip_updated',
          description: `Gorjeta registrada: R$ ${rounded.toFixed(2).replace('.', ',')} (100% para o profissional).`,
          oldValues: { professional_tip_amount: (tipModalAppointment as any).professional_tip_amount ?? null },
          newValues: { professional_tip_amount: rounded },
          metadata: {
            action: 'Gorjeta',
            clicked_at: clickedAt,
            selected_date: format(selectedDate, 'dd/MM/yyyy'),
          },
        });

        toast.success(rounded > 0 ? `Gorjeta salva: R$ ${rounded.toFixed(2).replace('.', ',')}` : 'Gorjeta removida.');
        setTipModalAppointment(null);
        setTipModalInput('');
        onAppointmentUpdate?.();
      } catch (e: any) {
        console.error('Erro ao salvar gorjeta:', e);
        const em = String(e?.message || '').toLowerCase();
        if (!em.includes('professional_tip') && !(em.includes('column') && em.includes('tip'))) {
          toast.error(getSupabaseErrorMessage(e, 'Não foi possível salvar a gorjeta.'));
        }
      } finally {
        setIsSavingProfessionalTip(false);
      }
    };

    const handleStartEditAppointmentContact = (apt: Appointment) => {
      const current = appointmentContactById[apt.id];
      setEditingContactAppointmentId(apt.id);
      setEditingContactCpf(String(current?.cpf || apt.client_cpf || ''));
      setEditingContactStreet(String(current?.street || (apt as any).client_street || ''));
    };

    const handleSaveAppointmentContact = async (apt: Appointment) => {
      if (!establishment?.id) {
        toast('Estabelecimento não identificado.');
        return;
      }
      const normalizedCpf = String(editingContactCpf || '').replace(/\D/g, '');
      const normalizedStreet = String(editingContactStreet || '').trim();
      if (normalizedCpf && normalizedCpf.length !== 11) {
        toast('CPF inválido. Informe 11 dígitos ou deixe em branco.');
        return;
      }

      setIsSavingAppointmentContact(true);
      try {
        const normalizedWhatsapp = normalizeWhatsappKey(apt.client_whatsapp || '');
        if (normalizedWhatsapp) {
          const payloadBase: any = {
            establishment_id: establishment?.id,
            whatsapp: normalizedWhatsapp.startsWith('55') ? normalizedWhatsapp : `55${normalizedWhatsapp}`,
            name: String(apt.client_name || 'Cliente').trim() || 'Cliente',
            updated_at: new Date().toISOString(),
          };
          let upsertError: any = null;
          const withExtra = {
            ...payloadBase,
            cpf: normalizedCpf || null,
            street: normalizedStreet || null,
          };
          const withExtraResult = await supabase
            .from('manual_clients')
            .upsert(withExtra, { onConflict: 'establishment_id,whatsapp' });
          upsertError = withExtraResult.error;

          if (upsertError) {
            const message = String(upsertError?.message || '').toLowerCase();
            const missingColumn =
              message.includes('column') &&
              (message.includes('cpf') || message.includes('street'));
            if (missingColumn) {
              const fallback = await supabase
                .from('manual_clients')
                .upsert(payloadBase, { onConflict: 'establishment_id,whatsapp' });
              upsertError = fallback.error;
            }
          }

          if (upsertError) throw upsertError;

          try {
            const storageKey = `manual_clients_${establishment?.id}`;
            const localManual = JSON.parse(localStorage.getItem(storageKey) || '{}');
            const key55 = payloadBase.whatsapp;
            const keyNo55 = key55.startsWith('55') ? key55.slice(2) : key55;
            if (keyNo55 && localManual[keyNo55]) delete localManual[keyNo55];
            localManual[key55] = {
              ...(localManual[key55] || {}),
              name: payloadBase.name,
              whatsapp: key55,
              cpf: normalizedCpf || null,
              street: normalizedStreet || null,
            };
            localStorage.setItem(storageKey, JSON.stringify(localManual));
          } catch {
            // ignore fallback storage errors
          }
        }

        if (normalizedCpf) {
          const { error } = await supabase
            .from('appointments')
            .update({ client_cpf: normalizedCpf })
            .eq('id', apt.id);
          if (error) {
            console.warn('⚠️ Falha ao salvar CPF no appointments:', error);
          }
        }

        setAppointmentContactById((prev) => ({
          ...prev,
          [apt.id]: { cpf: normalizedCpf || '', street: normalizedStreet || '' },
        }));
        setEditingContactAppointmentId(null);
        setEditingContactCpf('');
        setEditingContactStreet('');
        toast('Contato do cliente salvo com sucesso!');
        onAppointmentUpdate?.();
      } catch (error: any) {
        console.error('Erro ao salvar contato do cliente:', error);
        toast(String(error?.message || 'Erro ao salvar contato do cliente.'));
      } finally {
        setIsSavingAppointmentContact(false);
      }
    };

    const handleRemoveAdditionalProduct = async (appointmentId: string, productIndex: number) => {
      try {
        const appointment = appointments.find(apt => apt.id === appointmentId);
        if (!appointment || !appointment.additional_products) return;

        const currentAdditionalProducts = appointment.additional_products;
        const removedProduct = currentAdditionalProducts[productIndex];
        const updatedProducts = currentAdditionalProducts.filter((_, index) => index !== productIndex);

        const basePrice = Number(appointment.price || 0);
        const soldProductsTotal = appointment.sold_products?.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0) ?? 0;
        const oldTotal = Number((appointment as any).total_price || basePrice);
        const newTotal = basePrice + updatedProducts.reduce((sum, p) => sum + (p.price ?? 0), 0) + soldProductsTotal;

        const { error } = await supabase
          .from('appointments')
          .update({ additional_products: updatedProducts, total_price: newTotal })
          .eq('id', appointmentId);

        if (error) throw error;

        await writeAppointmentChangeLog({
          appointmentId,
          eventType: 'additional_service_removed',
          description: 'Serviço extra removido do agendamento.',
          oldValues: {
            additional_products_count: currentAdditionalProducts.length,
            total_price: oldTotal,
          },
          newValues: {
            additional_products_count: updatedProducts.length,
            total_price: newTotal,
          },
          metadata: {
            product_removed: removedProduct
              ? {
                name: String(removedProduct.name || ''),
                price: Number(removedProduct.price || 0),
                duration: Number((removedProduct as any).duration || 0),
              }
              : null,
            removed_index: productIndex,
          },
        });

        toast('Produto removido com sucesso!');

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao remover produto:', error);
        toast(error.message || 'Erro ao remover produto');
      }
    };

    const handleRemoveProductFromAppointment = async (appointmentId: string, productId: string, productName: string) => {
      try {
        const appointment = appointments.find(apt => apt.id === appointmentId);
        if (!appointment || !appointment.sold_products) return;

        const productToRemove = appointment.sold_products.find((p: SoldProduct) => p.product_id === productId);
        if (!productToRemove) return;

        const updatedProducts = appointment.sold_products.filter((p: SoldProduct) => p.product_id !== productId);

        const { error } = await supabase
          .from('appointments')
          .update({ sold_products: updatedProducts })
          .eq('id', appointmentId);

        if (error) {
          const msg = String(error?.message || '').toLowerCase();
          const missingSoldProductsColumn =
            msg.includes('sold_products') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find'));

          // Compatibilidade com bancos sem coluna sold_products:
          // remove os itens da tabela appointment_products (fonte real dos produtos V2).
          if (missingSoldProductsColumn) {
            const { error: deleteError } = await supabase
              .from('appointment_products')
              .delete()
              .eq('appointment_id', appointmentId)
              .eq('product_id', productId);

            if (deleteError) throw deleteError;
          } else {
            throw error;
          }
        }

        // Devolver o produto ao estoque
        if (establishment?.id) {
          const { data: currentEstablishment } = await supabase
            .from('establishments')
            .select('products')
            .eq('id', establishment.id)
            .single();

          if (currentEstablishment?.products) {
            const updatedEstablishmentProducts = currentEstablishment.products.map((p: any) => {
              if (p.id === productId) {
                return {
                  ...p,
                  quantity: (p.quantity || 0) + productToRemove.quantity
                };
              }
              return p;
            });

            await supabase
              .from('establishments')
              .update({ products: updatedEstablishmentProducts })
              .eq('id', establishment.id);
          }
        }

        await writeAppointmentChangeLog({
          appointmentId,
          eventType: 'sold_product_removed',
          description: `Produto removido: ${productName}.`,
          oldValues: {
            sold_products_count: appointment.sold_products.length,
          },
          newValues: {
            sold_products_count: updatedProducts.length,
          },
          metadata: {
            product_removed: {
              name: String(productToRemove.name || productName),
              price: Number(productToRemove.unit_price || 0) * Number(productToRemove.quantity || 1),
              quantity: Number(productToRemove.quantity || 1),
            },
          },
        });

        toast(`${productName} removido e devolvido ao estoque!`);

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao remover produto:', error);
        toast(error.message || 'Erro ao remover produto');
      }
    };

    const shouldRetryWithoutSplitColumn = (error: any): boolean => {
      const msg = String(error?.message || '').toLowerCase();
      return msg.includes('payment_split_details') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find'));
    };

    const handleOpenSplitPaymentModal = (apt: Appointment) => {
      const existing = parsePaymentSplitDetails(apt);
      const initialRows =
        existing.length > 0
          ? existing.map((row) => ({
            method: row.method,
            amount: String(row.amount),
            card_brand: row.card_brand && row.card_brand !== 'bandeira' ? row.card_brand : 'bandeira',
          }))
          : [{ method: 'dinheiro', amount: String(round2(calculateTotalPrice(apt))), card_brand: 'bandeira' }];
      setSelectedAppointmentForSplitPayment(apt);
      setSplitPaymentRows(initialRows.slice(0, 4));
      setShowSplitPaymentModal(true);
    };

    const handleSaveSplitPayment = async () => {
      if (!selectedAppointmentForSplitPayment) return;

      const apt = selectedAppointmentForSplitPayment;
      const maxValue = round2(calculateTotalPrice(apt));
      const cleanedRows = splitPaymentRows
        .map((row) => ({
          method: String(row.method || '').trim(),
          amount: round2(Number(String(row.amount || '').replace(',', '.'))),
          card_brand: row.card_brand && row.card_brand !== 'bandeira' ? row.card_brand : null,
        }))
        .filter((row) => row.method && Number.isFinite(row.amount) && row.amount > 0);

      if (cleanedRows.length === 0) {
        toast.error('Adicione pelo menos 1 forma de pagamento válida.');
        return;
      }
      if (cleanedRows.length > 4) {
        toast.error('Você pode usar no máximo 4 formas de pagamento.');
        return;
      }
      const uniqueMethods = new Set(cleanedRows.map((row) => row.method));
      if (uniqueMethods.size !== cleanedRows.length) {
        toast.error('Não repita a mesma forma de pagamento. Use uma de cada.');
        return;
      }
      const totalSplit = round2(cleanedRows.reduce((sum, row) => sum + row.amount, 0));
      if (totalSplit > maxValue) {
        toast.error(`A soma das formas (${formatCurrency(totalSplit)}) não pode passar do valor do serviço (${formatCurrency(maxValue)}).`);
        return;
      }
      if (Math.abs(totalSplit - maxValue) > 0.009) {
        toast.error(`A soma das formas deve fechar exatamente ${formatCurrency(maxValue)}.`);
        return;
      }
      const hasCardWithoutBrand = cleanedRows.some(
        (row) => (row.method === 'credito' || row.method === 'debito') && !row.card_brand
      );
      if (hasCardWithoutBrand) {
        toast.error('Selecione a bandeira para pagamentos em crédito/débito.');
        return;
      }

      setIsSavingSplitPayment(true);
      try {
        let { error } = await supabase
          .from('appointments')
          .update({
            payment_method: 'multi',
            status: 'completed',
            card_brand: null,
            payment_split_details: cleanedRows,
          } as any)
          .eq('id', apt.id);

        if (error && shouldRetryWithoutSplitColumn(error)) {
          const retry = await supabase
            .from('appointments')
            .update({
              payment_method: 'multi',
              status: 'completed',
              card_brand: null,
            } as any)
            .eq('id', apt.id);
          error = retry.error as any;
          if (!error) {
            toast.success('Forma de pagamento múltipla salva sem histórico detalhado (coluna ainda não aplicada no banco).');
          }
        }

        if (error) throw error;

        await writeAppointmentChangeLog({
          appointmentId: apt.id,
          eventType: 'payment_method_changed',
          description: 'Forma de pagamento múltipla registrada.',
          oldValues: {
            payment_method: String(apt.payment_method || '') || null,
            status: String(apt.status || '') || null,
          },
          newValues: {
            payment_method: 'multi',
            status: 'completed',
          },
          metadata: {
            split_details: cleanedRows,
          },
        });

        await registerSubscriberAttendanceAutomatically(apt);

        if (!showSplitPaymentModal) return;
        toast.success('Formas de pagamento salvas com sucesso!');
        setShowSplitPaymentModal(false);
        setSelectedAppointmentForSplitPayment(null);
        setSplitPaymentRows([]);
        if (onAppointmentUpdate) onAppointmentUpdate();
      } catch (error: any) {
        console.error('Erro ao salvar formas de pagamento:', error);
        toast.error(error.message || 'Erro ao salvar formas de pagamento');
      } finally {
        setIsSavingSplitPayment(false);
      }
    };

    const handlePaymentMethodChange = async (appointment: Appointment, paymentMethod: string) => {
      if (paymentMethod === 'multi') {
        handleOpenSplitPaymentModal(appointment);
        return;
      }
      try {
        const previousMethod = String(appointment.payment_method || '').trim() || null;
        const previousStatus = String(appointment.status || '').trim() || null;

        let { error } = await supabase
          .from('appointments')
          .update({
            payment_method: paymentMethod === 'pendente' ? null : paymentMethod,
            status: paymentMethod === 'pendente' ? 'pending' : 'completed',
            payment_split_details: null,
          })
          .eq('id', appointment.id);

        if (error && shouldRetryWithoutSplitColumn(error)) {
          const retry = await supabase
            .from('appointments')
            .update({
              payment_method: paymentMethod === 'pendente' ? null : paymentMethod,
              status: paymentMethod === 'pendente' ? 'pending' : 'completed',
            })
            .eq('id', appointment.id);
          error = retry.error as any;
        }

        if (error) throw error;

        await writeAppointmentChangeLog({
          appointmentId: appointment.id,
          eventType: 'payment_method_changed',
          description: 'Forma de pagamento alterada pelo card.',
          oldValues: {
            payment_method: previousMethod,
            status: previousStatus,
          },
          newValues: {
            payment_method: paymentMethod === 'pendente' ? null : paymentMethod,
            status: paymentMethod === 'pendente' ? 'pending' : 'completed',
          },
        });

        toast('Forma de pagamento atualizada');

        const completedNow = paymentMethod !== 'pendente';
        if (completedNow) {
          const enrichedAppointment = {
            ...appointment,
            status: 'completed',
            payment_method: paymentMethod === 'pendente' ? null : paymentMethod,
            is_subscriber: isSubscriberAppointmentFromFields({
              ...appointment,
              payment_method: paymentMethod,
            } as any)
              ? true
              : (appointment as any)?.is_subscriber,
          } as Appointment;
          await registerSubscriberAttendanceAutomatically(enrichedAppointment);
        }

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao atualizar forma de pagamento:', error);
        toast(error.message || 'Erro ao atualizar forma de pagamento');
      }
    };

    const handleCardBrandChange = async (appointmentId: string, cardBrand: string) => {
      try {
        const appointment = (appointments || []).find((apt) => String(apt.id) === String(appointmentId));
        const previousBrand = String((appointment as any)?.card_brand || '').trim() || null;
        const nextBrand = cardBrand === 'bandeira' ? null : cardBrand;

        const { error } = await supabase
          .from('appointments')
          .update({ card_brand: nextBrand })
          .eq('id', appointmentId);

        if (error) throw error;

        if (appointment) {
          await writeAppointmentChangeLog({
            appointmentId,
            eventType: 'card_brand_changed',
            description: 'Bandeira do cartão alterada.',
            oldValues: { card_brand: previousBrand },
            newValues: { card_brand: nextBrand },
          });
        }

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao atualizar bandeira:', error);
        toast(error.message || 'Erro ao atualizar bandeira do cartão');
      }
    };

    const handleDeleteAppointment = async (appointmentId: string) => {
      if (!confirm('Tem certeza que deseja EXCLUIR este agendamento permanentemente?')) {
        return;
      }

      try {
        const appointment = appointments.find((apt) => String(apt.id) === String(appointmentId));

        if (appointment) {
          await writeAppointmentChangeLog({
            appointmentId,
            eventType: 'appointment_deleted',
            description: 'Agendamento excluído permanentemente.',
            oldValues: {
              client_name: String(appointment.client_name || ''),
              service: String(appointment.service || ''),
              price: Number(appointment.price || 0),
              total_price: Number((appointment as any).total_price || appointment.price || 0),
              status: String(appointment.status || ''),
            },
            newValues: null,
            metadata: {
              client_name: String(appointment.client_name || ''),
              service: String(appointment.service || ''),
              appointment_date: String(appointment.appointment_date || '').slice(0, 10),
              appointment_time: String(appointment.appointment_time || ''),
            },
          });
        }

        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', appointmentId);

        if (error) throw error;

        toast('Agendamento excluído com sucesso');

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao excluir agendamento:', error);
        toast(error.message || 'Erro ao excluir agendamento');
      }
    };

    const handlePreviousDay = () => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 1);
      onDateChange(newDate);
    };

    const handleNextDay = () => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      onDateChange(newDate);
    };

    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDate = new Date(e.target.value + 'T00:00:00');
      onDateChange(newDate);
      setShowDatePicker(false);
    };

    useEffect(() => {
      if (!showDatePicker) return;

      const handleOutside = (event: MouseEvent | TouchEvent) => {
        const target = event.target as Node | null;
        if (datePickerContainerRef.current && target && !datePickerContainerRef.current.contains(target)) {
          setShowDatePicker(false);
        }
      };

      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);

      const timer = window.setTimeout(() => {
        const input = datePickerInputRef.current;
        if (!input) return;
        try {
          if (typeof input.showPicker === 'function') {
            void input.showPicker();
            return;
          }
        } catch {
          // fallback abaixo
        }
        input.focus();
      }, 80);

      return () => {
        document.removeEventListener('mousedown', handleOutside);
        document.removeEventListener('touchstart', handleOutside);
        window.clearTimeout(timer);
      };
    }, [showDatePicker]);

    const calendarToday = startOfDay(new Date());
    const selectedDay = startOfDay(selectedDate);
    const isSelectedToday = isSameDay(selectedDay, calendarToday);
    const isSelectedYesterday = isSameDay(selectedDay, addDays(calendarToday, -1));
    const isSelectedTomorrow = isSameDay(selectedDay, addDays(calendarToday, 1));

    const goToQuickDate = (target: 'yesterday' | 'today' | 'tomorrow') => {
      if (target === 'today') {
        onDateChange(calendarToday);
        return;
      }
      if (target === 'yesterday') {
        onDateChange(addDays(calendarToday, -1));
        return;
      }
      onDateChange(addDays(calendarToday, 1));
    };

    const runToggleSlotBlock = async (professionalId: string, slotTime: string, block: boolean) => {
      if (!onToggleProfessionalSlotBlocked) return;
      const busyKey = `${professionalId}__${slotTime}`;
      if (slotBlockBusyKey) return;
      setSlotBlockBusyKey(busyKey);
      try {
        await onToggleProfessionalSlotBlocked({
          professionalId,
          dateKey: format(selectedDate, 'yyyy-MM-dd'),
          time: slotTime,
          block,
        });
      } catch (error: any) {
        const details = [error?.message, error?.code, error?.details, error?.hint]
          .filter(Boolean)
          .map((part) => String(part))
          .join(' | ');
        toast.error(details ? `Erro ao salvar bloqueio: ${details}` : 'Erro ao salvar bloqueio.');
      } finally {
        setSlotBlockBusyKey(null);
      }
    };

    const getSlotColor = (slot: TimeSlot): string => {
      if (slot.isEmpty) {
        return 'bg-white border-gray-300';
      }

      const appointment = slot.appointment || slot.parentAppointment;
      if (!appointment) return 'bg-gray-100 border-gray-300';

      // Encaixe: cinza (status segue cor normal só fora do encaixe)
      if (appointment.is_squeeze) {
        if (slot.isOccupied) {
          return 'bg-gray-700/60 border-gray-600';
        }
        return 'bg-gray-700 border-gray-600';
      }

      // Aguardando pagamento: roxo
      if (appointment.status === 'pending_payment') {
        return slot.isOccupied
          ? 'bg-purple-700/60 border-purple-600'
          : 'bg-purple-700 border-purple-600';
      }

      if (slot.isOccupied) {
        switch (appointment.status) {
          case 'cancelled':
            return 'bg-red-800/60 border-red-700';
          case 'completed':
            return 'bg-green-700/90 border-green-800';
          case 'pending':
          case 'confirmed':
            return 'bg-yellow-600/60 border-yellow-700';
          default:
            return 'bg-gray-600/60 border-gray-500';
        }
      }

      switch (appointment.status) {
        case 'cancelled':
          return 'bg-red-800/90 border-red-700';
        case 'completed':
          return 'bg-green-700 border-green-800';
        case 'pending':
        case 'confirmed':
          return 'bg-yellow-600 border-yellow-700';
        default:
          return 'bg-gray-600 border-gray-500';
      }
    };

    const getProfessionalName = (professionalId: string) => {
      return professionals.find(p => p.id === professionalId)?.name || 'Desconhecido';
    };

    const getGoalProgressForProfessional = (professionalId: string) => {
      const goal = professionalGoalConfigs[professionalId];
      if (!goal || goal.goalAmount <= 0) {
        return { completed: 0, goalReached: false, ...goal };
      }

      const completed = monthlyAppointments.filter((apt) => {
        if (apt.professional !== professionalId) return false;
        if (apt.status !== 'completed') return false;
        if (apt.is_subscriber) return false;
        if (!goal.selectedServiceNames || goal.selectedServiceNames.length === 0) return false;
        const aptServiceToken = normalizeServiceToken(apt.service);
        return goal.selectedServiceNames.some(
          (serviceName) => normalizeServiceToken(serviceName) === aptServiceToken
        );
      }).length;

      return {
        ...goal,
        completed,
        goalReached: completed >= goal.goalAmount,
      };
    };

    const getEffectiveProfessionalPercentageForAppointment = (apt: Appointment, professional?: Professional | null): number => {
      const basePercentage = normalizeProfessionalPercentage(professional?.percentage);
      if (!professional || isOwnerProfessional(professional)) return basePercentage;

      const goalProgress = getGoalProgressForProfessional(professional.id);
      if (!goalProgress.goalReached) return basePercentage;
      if (!Number.isFinite(goalProgress.bonusPercentage) || goalProgress.bonusPercentage <= 0) return basePercentage;
      if (!Array.isArray(goalProgress.selectedServiceNames) || goalProgress.selectedServiceNames.length === 0) {
        return basePercentage;
      }

      const aptServiceToken = normalizeServiceToken(apt.service);
      const isMetaService = goalProgress.selectedServiceNames.some(
        (serviceName) => normalizeServiceToken(serviceName) === aptServiceToken
      );

      return isMetaService
        ? normalizeProfessionalPercentage(goalProgress.bonusPercentage)
        : basePercentage;
    };

    // Calcular valores do profissional para o modal
    const calculateProfessionalValues = (professionalId: string) => {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const selectedMonthKey = format(selectedDate, 'yyyy-MM');
      const professionalRef: Professional =
        professionals.find((p) => p.id === professionalId) || { id: professionalId, name: '' };
      const getAppointmentDateOnly = (raw: unknown): string => String(raw || '').slice(0, 10);
      const getAppointmentMonthKey = (raw: unknown): string => String(raw || '').slice(0, 7);
      const getAppointmentStatus = (raw: unknown): string => String(raw || '').trim().toLowerCase();
      const isSubscriberFinancialAppointment = (apt: Appointment): boolean =>
        isSubscriberAppointmentFromFields(apt as any);
      const isAppointmentFromSelectedDay = (apt: Appointment) =>
        getAppointmentDateOnly(apt.appointment_date) === selectedDateStr;

      // Debug: verificar todos os appointments
      console.log('🔍 DEBUG calculateProfessionalValues:');
      console.log('  - Professional ID:', professionalId);
      console.log('  - Selected Date:', selectedDateStr);
      console.log('  - Total appointments:', appointments.length);
      console.log(
        '  - Appointments do profissional:',
        appointments.filter((apt) => appointmentBelongsToProfessionalColumn(apt, professionalRef)).length
      );
      console.log(
        '  - Appointments do profissional na data:',
        appointments.filter(
          (apt) =>
            appointmentBelongsToProfessionalColumn(apt, professionalRef) &&
            isAppointmentFromSelectedDay(apt)
        ).length
      );

      // Valores do Dia e "Agendamentos hoje": apenas CONCLUÍDOS (status === 'completed').
      // Pendentes/confirmados não contam — batendo com o contador verde da agenda.
      const dailyAppointments = appointments.filter((apt) => {
        return (
          appointmentBelongsToProfessionalColumn(apt, professionalRef) &&
          isAppointmentFromSelectedDay(apt) &&
          getAppointmentStatus(apt.status) === 'completed' &&
          !isSubscriberFinancialAppointment(apt)
        );
      });

      console.log('  - Appointments concluídos hoje (valores + contagem):', dailyAppointments.length);
      console.log('  - Detalhes:', dailyAppointments.map(apt => ({ id: apt.id, status: apt.status, date: apt.appointment_date })));

      // Une dados do mês vindos de fontes diferentes para evitar oscilação visual (ex.: recém concluído).
      const mergedMonthAppointmentsMap = new Map<string, Appointment>();
      monthlyAppointments.forEach((apt) => {
        if (getAppointmentMonthKey(apt.appointment_date) !== selectedMonthKey) return;
        mergedMonthAppointmentsMap.set(String(apt.id || `${apt.appointment_date}-${apt.appointment_time}-${apt.client_name}`), apt);
      });
      appointments.forEach((apt) => {
        if (getAppointmentMonthKey(apt.appointment_date) !== selectedMonthKey) return;
        mergedMonthAppointmentsMap.set(String(apt.id || `${apt.appointment_date}-${apt.appointment_time}-${apt.client_name}`), apt);
      });
      const mergedMonthAppointments = Array.from(mergedMonthAppointmentsMap.values());

      // Para valores mensais do modal, usar a mesma base do financeiro: apenas concluídos.
      const monthlyCompletedAppointmentsForPro = mergedMonthAppointments.filter((apt) => {
        const status = getAppointmentStatus(apt.status);
        return (
          appointmentBelongsToProfessionalColumn(apt, professionalRef) &&
          status === 'completed' &&
          !isSubscriberFinancialAppointment(apt)
        );
      });

      // Para contagem mensal, manter alinhado ao total de concluídos no período.
      const monthlyAppointmentsForCount = monthlyCompletedAppointmentsForPro;

      const dailyGross = dailyAppointments.reduce(
        // ✅ No saldo do barbeiro, NÃO contar produtos V2. Apenas serviço + serviços extra.
        (sum, apt) => sum + calculateServiceTotal(apt),
        0
      );
      const monthlyGross = monthlyCompletedAppointmentsForPro.reduce(
        // ✅ No saldo do barbeiro, NÃO contar produtos V2. Apenas serviço + serviços extra.
        (sum, apt) => sum + calculateServiceTotal(apt),
        0
      );

      const professional = professionals.find((p) => p.id === professionalId);
      const percentage = normalizeProfessionalPercentage(professional?.percentage);
      const goalProgress = getGoalProgressForProfessional(professionalId);
      const professionalNameKey = normalizeProfessionalNameKey(professional?.name || '');
      const subscriberFinancial = subscriberFinancialByProfessional[professionalNameKey] || {
        accumulated: 0,
        paid: 0,
        pending: 0,
        attendanceCount: 0,
        uniqueClientsCount: 0,
        saleCommissionCount: 0,
        dailyAttendanceCount: 0,
        dailyAccumulated: 0,
      };

      // Calcular líquido diário: verificar se taxa é descontada do estabelecimento ou do profissional
      const dailyNet = dailyAppointments.reduce((total, apt) => {
        const baseValue = calculateServiceTotal(apt);
        const cardTaxAmount = getCardTaxAmountForServiceBase(apt, baseValue);
        const baseAfterTax = establishment?.tax_deducted_by_establishment ? baseValue : Math.max(0, baseValue - cardTaxAmount);
        const effectivePercentage = getEffectiveProfessionalPercentageForAppointment(apt, professional);
        const tip = getProfessionalTipAmount(apt);
        return total + (baseAfterTax * effectivePercentage) / 100 + tip;
      }, 0);

      // Calcular líquido mensal: verificar se taxa é descontada do estabelecimento ou do profissional
      const monthlyNet = monthlyCompletedAppointmentsForPro.reduce((total, apt) => {
        const baseValue = calculateServiceTotal(apt);
        const cardTaxAmount = getCardTaxAmountForServiceBase(apt, baseValue);
        const baseAfterTax = establishment?.tax_deducted_by_establishment ? baseValue : Math.max(0, baseValue - cardTaxAmount);
        const effectivePercentage = getEffectiveProfessionalPercentageForAppointment(apt, professional);
        const tip = apt.status === 'completed' ? getProfessionalTipAmount(apt) : 0;
        return total + (baseAfterTax * effectivePercentage) / 100 + tip;
      }, 0);

      // 👑 SERVIÇO EXTRA pago dentro de atendimento de ASSINATURA: entra no líquido normal
      // (mesma regra do extra em atendimento avulso). O repasse por visita (ex.: R$18,75)
      // segue no trilho de assinatura (linha 👑 do modal, via engine) — sem duplicação.
      // Gorjeta em atendimento de assinatura continua de fora (regra atual).
      const subscriberExtrasNetFor = (apt: Appointment): number => {
        const extrasBase = (apt.additional_products || []).reduce(
          (sum, p) => sum + (Number((p as any)?.price) || 0),
          0
        );
        if (!(extrasBase > 0)) return 0;
        const cardTaxAmount = getCardTaxAmountForServiceBase(apt, extrasBase);
        const afterTax = establishment?.tax_deducted_by_establishment
          ? extrasBase
          : Math.max(0, extrasBase - cardTaxAmount);
        return (afterTax * getEffectiveProfessionalPercentageForAppointment(apt, professional)) / 100;
      };
      const dailySubscriberExtrasNet = appointments
        .filter(
          (apt) =>
            appointmentBelongsToProfessionalColumn(apt, professionalRef) &&
            isAppointmentFromSelectedDay(apt) &&
            getAppointmentStatus(apt.status) === 'completed' &&
            isSubscriberFinancialAppointment(apt)
        )
        .reduce((sum, apt) => sum + subscriberExtrasNetFor(apt), 0);
      const monthlySubscriberExtrasNet = mergedMonthAppointments
        .filter(
          (apt) =>
            appointmentBelongsToProfessionalColumn(apt, professionalRef) &&
            getAppointmentStatus(apt.status) === 'completed' &&
            isSubscriberFinancialAppointment(apt)
        )
        .reduce((sum, apt) => sum + subscriberExtrasNetFor(apt), 0);

      const professionalMonthAppointments = mergedMonthAppointments
        .filter((apt) => appointmentBelongsToProfessionalColumn(apt, professionalRef))
        .map((apt) => {
          const status = getAppointmentStatus(apt.status);
          if (status !== 'completed' || isSubscriberFinancialAppointment(apt)) return { ...apt, _computedNet: 0 };
          const baseValue = calculateServiceTotal(apt);
          const cardTaxAmount = getCardTaxAmountForServiceBase(apt, baseValue);
          const baseAfterTax = establishment?.tax_deducted_by_establishment ? baseValue : Math.max(0, baseValue - cardTaxAmount);
          const effectivePct = getEffectiveProfessionalPercentageForAppointment(apt, professional);
          const tip = getProfessionalTipAmount(apt);
          return { ...apt, _computedNet: (baseAfterTax * effectivePct) / 100 + tip };
        });

      const serviceInsightsRaw = Array.from(
        monthlyCompletedAppointmentsForPro.reduce((acc, apt) => {
          const name = String(apt.service || '').trim() || 'Serviço sem nome';
          const current = acc.get(name) || { count: 0, gross: 0 };
          current.count += 1;
          current.gross += calculateServiceTotal(apt);
          acc.set(name, current);
          return acc;
        }, new Map<string, { count: number; gross: number }>())
      )
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return b.gross - a.gross;
        });
      const totalCompletedForInsight = serviceInsightsRaw.reduce((sum, item) => sum + item.count, 0);
      const serviceInsights: ProfessionalServiceInsight[] = serviceInsightsRaw.map((item) => ({
        ...item,
        sharePercent: totalCompletedForInsight > 0 ? (item.count / totalCompletedForInsight) * 100 : 0,
      }));

      const cancelledRowsForPro = mergedMonthAppointments.filter((apt) => {
        const status = getAppointmentStatus(apt.status);
        return (
          appointmentBelongsToProfessionalColumn(apt, professionalRef) &&
          status === 'cancelled' &&
          !isSubscriberFinancialAppointment(apt)
        );
      });
      const cancelledByServiceRaw = Array.from(
        cancelledRowsForPro.reduce((acc, apt) => {
          const name = String(apt.service || '').trim() || 'Serviço sem nome';
          const current = acc.get(name) || { count: 0, gross: 0 };
          current.count += 1;
          current.gross += calculateServiceTotal(apt);
          acc.set(name, current);
          return acc;
        }, new Map<string, { count: number; gross: number }>())
      )
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => {
          if (b.gross !== a.gross) return b.gross - a.gross;
          return b.count - a.count;
        });
      const totalCancelledForInsight = cancelledByServiceRaw.reduce((sum, item) => sum + item.count, 0);
      const cancelledInsightsByService: ProfessionalServiceInsight[] = cancelledByServiceRaw.map((item) => ({
        ...item,
        sharePercent: totalCancelledForInsight > 0 ? (item.count / totalCancelledForInsight) * 100 : 0,
      }));
      const cancelledLostGross = cancelledRowsForPro.reduce((sum, apt) => sum + calculateServiceTotal(apt), 0);
      const cancelledLostNet = cancelledRowsForPro.reduce((sum, apt) => {
        const baseValue = calculateServiceTotal(apt);
        const cardTaxAmount = getCardTaxAmountForServiceBase(apt, baseValue);
        const baseAfterTax = establishment?.tax_deducted_by_establishment
          ? baseValue
          : Math.max(0, baseValue - cardTaxAmount);
        const effectivePercentage = getEffectiveProfessionalPercentageForAppointment(apt, professional);
        return sum + (baseAfterTax * effectivePercentage) / 100;
      }, 0);
      const cancelledInsights: ProfessionalCancelledInsight = {
        totalCancelled: cancelledRowsForPro.length,
        lostGross: cancelledLostGross,
        lostNet: cancelledLostNet,
        byService: cancelledInsightsByService,
      };

      const isPlaceholderTopClientName = (name: string): boolean => {
        const normalized = String(name || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase();
        if (!normalized) return true;
        return (
          normalized === 'cliente' ||
          normalized === 'cliente sem nome' ||
          normalized === 'cliente avulso' ||
          normalized.startsWith('cliente avulso -') ||
          normalized === 'encaixe' ||
          normalized.includes('horario bloqueado') ||
          normalized.includes('horario livre')
        );
      };

      // Top cliente = quem mais RETORNOU no mês com o profissional
      // (apenas atendimentos concluídos), ignorando placeholders.
      const topClientBaseRowsRaw = mergedMonthAppointments.filter((apt) => {
        const status = getAppointmentStatus(apt.status);
        if (!appointmentBelongsToProfessionalColumn(apt, professionalRef)) return false;
        if (status !== 'completed') return false;
        if (Boolean((apt as any)?.is_avulso) || Boolean((apt as any)?.is_squeeze)) return false;
        const clientName = String((apt as any)?.client_name || '').trim();
        return !isPlaceholderTopClientName(clientName);
      });

      // Deduplicação defensiva para evitar contagem inflada quando a mesma visita
      // aparece em fontes diferentes com id ausente em uma delas.
      const topClientRowsMap = new Map<string, Appointment>();
      topClientBaseRowsRaw.forEach((apt) => {
        const date = String((apt as any)?.appointment_date || '').slice(0, 10);
        const time = String((apt as any)?.appointment_time || '').slice(0, 5);
        const clientId = String((apt as any)?.client_id || '').trim();
        const whatsapp = String((apt as any)?.client_whatsapp || '').replace(/\D/g, '');
        const clientName = String((apt as any)?.client_name || '').trim().toLowerCase();
        const service = String((apt as any)?.service || '').trim().toLowerCase();
        const signature = `${date}|${time}|${clientId || whatsapp || clientName}|${service}`;
        topClientRowsMap.set(signature, apt);
      });
      const topClientBaseRows = Array.from(topClientRowsMap.values());

      const topClientRaw = Array.from(
        topClientBaseRows.reduce((acc, apt) => {
          const clientName = String((apt as any)?.client_name || '').trim() || 'Cliente sem nome';
          const clientId = String((apt as any)?.client_id || '').trim();
          const clientWhatsapp = String((apt as any)?.client_whatsapp || '').replace(/\D/g, '');
          const key = clientId || clientWhatsapp || clientName.toLowerCase();
          const current = acc.get(key) || {
            name: clientName,
            count: 0,
            gross: 0,
            lastAppointmentDate: '',
          };
          current.count += 1;
          current.gross += calculateServiceTotal(apt);
          const aptDate = String(apt.appointment_date || '').slice(0, 10);
          if (aptDate && (!current.lastAppointmentDate || aptDate > current.lastAppointmentDate)) {
            current.lastAppointmentDate = aptDate;
          }
          acc.set(key, current);
          return acc;
        }, new Map<string, ProfessionalTopClientInsight>())
      )
        .map(([, value]) => value)
        .filter((item) => item.count > 1)
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          if (b.gross !== a.gross) return b.gross - a.gross;
          return String(b.lastAppointmentDate || '').localeCompare(String(a.lastAppointmentDate || ''));
        });
      const topClientInsight: ProfessionalTopClientInsight | null = topClientRaw[0] || null;

      return {
        dailyGross,
        // Líquidos = normal + SERVIÇO EXTRA pago em atendimentos de assinatura (gorjeta de
        // assinatura fica fora). O repasse por visita fica FORA daqui: o modal soma a
        // assinatura na exibição usando a engine de Meus Assinantes — sem duplicar.
        dailyNet: dailyNet + dailySubscriberExtrasNet,
        monthlyGross: monthlyGross + (isOwnerProfessional(professional) ? 0 : subscriberFinancial.pending),
        monthlyNet: monthlyNet + monthlySubscriberExtrasNet,
        basePercentage: percentage,
        metaBonusPercentage: Number(goalProgress?.bonusPercentage || 0),
        metaGoalReached: Boolean(goalProgress?.goalReached),
        metaServiceCount: Array.isArray(goalProgress?.selectedServiceNames) ? goalProgress.selectedServiceNames.length : 0,
        metaSelectedServiceNames: Array.isArray(goalProgress?.selectedServiceNames) ? (goalProgress.selectedServiceNames as string[]) : [],
        appointmentsToday: dailyAppointments.length, // Apenas concluídos (igual ao contador verde da agenda)
        appointmentsMonth: monthlyAppointmentsForCount.length, // Contagem: todos não cancelados
        subscriberMonthlyAccumulated: subscriberFinancial.accumulated,
        subscriberMonthlyPaid: subscriberFinancial.paid,
        subscriberMonthlyPending: subscriberFinancial.pending,
        subscriberAttendanceCount: subscriberFinancial.attendanceCount,
        subscriberClientsCount: subscriberFinancial.uniqueClientsCount,
        subscriberSalesCount: subscriberFinancial.saleCommissionCount,
        subscriberDailyAttendanceCount: subscriberFinancial.dailyAttendanceCount,
        subscriberDailyAccumulated: subscriberFinancial.dailyAccumulated,
        serviceInsights,
        cancelledInsights,
        topClientInsight,
        financialAppointments: professionalMonthAppointments,
      };
    };

    // When the professional info modal navigates to a past month, load that month's
    // appointments (all establishment, filtered client-side) + payments and compute pending.
    useEffect(() => {
      if (!modalViewingMonth || !selectedProfessionalForInfo || !establishment?.id) {
        setPastMonthPendingForModal(null);
        return;
      }
      const monthKey = `${modalViewingMonth.getFullYear()}-${String(modalViewingMonth.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey === currentMonthKey) { setPastMonthPendingForModal(null); return; }

      const professionalRef = professionals.find((p) => p.id === selectedProfessionalForInfo) || { id: selectedProfessionalForInfo, name: '' };
      const monthStart = `${monthKey}-01`;
      const lastDay = new Date(modalViewingMonth.getFullYear(), modalViewingMonth.getMonth() + 1, 0).getDate();
      const monthEnd = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
      let cancelled = false;

      void (async () => {
        try {
          const [aptResult, payResult] = await Promise.all([
            supabase
              .from('appointments')
              .select('id,appointment_date,status,price,total_price,additional_products,professional_tip_amount,payment_method,is_subscriber,subscription_id,professional_id,professional_name,professional,collaborator_id')
              .eq('establishment_id', establishment.id)
              .eq('status', 'completed')
              .gte('appointment_date', monthStart)
              .lte('appointment_date', monthEnd),
            supabase
              .from('professional_payments')
              .select('id,amount,payment_date,for_month,payment_source')
              .eq('establishment_id', establishment.id)
              .eq('professional_id', selectedProfessionalForInfo)
              .gt('amount', 0),
          ]);
          if (cancelled) return;

          const allApts = ((aptResult.data || []) as unknown as Appointment[]);
          const proApts = allApts.filter((apt) => appointmentBelongsToProfessionalColumn(apt, professionalRef as Professional));
          const proCompletedApts = proApts.filter((apt) => !isSubscriberAppointmentFromFields(apt as any));

          const netFn = (apt: Appointment): number => {
            if (String((apt as any)?.payment_method || '').toLowerCase() === 'assinante') return 0;
            const baseValue = calculateServiceTotal(apt);
            const cardTaxAmount = getCardTaxAmountForServiceBase(apt, baseValue);
            const baseAfterTax = establishment?.tax_deducted_by_establishment ? baseValue : Math.max(0, baseValue - cardTaxAmount);
            const effectivePct = getEffectiveProfessionalPercentageForAppointment(apt, professionalRef as Professional);
            return (baseAfterTax * effectivePct) / 100 + getProfessionalTipAmount(apt);
          };

          let cumulative = 0;
          const timeline = proCompletedApts
            .map((apt) => ({ net: netFn(apt), dateMs: new Date(String((apt as any).appointment_date || '').slice(0, 10) + 'T00:00:00').getTime() }))
            .filter((r) => r.net > 0 && Number.isFinite(r.dateMs))
            .sort((a, b) => a.dateMs - b.dateMs)
            .map((r) => { cumulative += r.net; return { ...r, cumulative }; });

          const totalNet = cumulative;
          const getRealizedUntil = (ms: number) => {
            let realized = 0;
            for (const row of timeline) { if (row.dateMs <= ms) realized = row.cumulative; else break; }
            return realized;
          };

          const monthPayments = ((payResult.data || []) as any[]).filter((p) => {
            if (!isServicePaymentSource(p.payment_source)) return false;
            const forM = String(p.for_month || '').trim();
            if (forM) return forM.startsWith(monthKey);
            const dt = new Date(p.payment_date);
            return dt.getFullYear() === modalViewingMonth.getFullYear() && dt.getMonth() === modalViewingMonth.getMonth();
          });

          let validPaid = 0;
          const EPSILON = 0.009;
          monthPayments
            .filter((p) => Number(p.amount) > 0)
            .sort((a: any, b: any) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
            .forEach((p: any) => {
              const amt = Number(p.amount);
              const ms = new Date(String(p.payment_date).slice(0, 10) + 'T00:00:00').getTime();
              if (!Number.isFinite(ms)) return;
              const realized = getRealizedUntil(ms);
              const allowed = Math.max(0, realized - validPaid);
              if (amt <= allowed + EPSILON) validPaid += amt;
              else if (allowed > EPSILON) validPaid += allowed;
            });

          if (!cancelled) {
            setPastMonthPendingForModal(Math.max(0, totalNet - validPaid));
            setPastMonthValidPaidForModal(validPaid);
          }
        } catch {
          if (!cancelled) { setPastMonthPendingForModal(null); setPastMonthValidPaidForModal(null); }
        }
      })();
      return () => { cancelled = true; };
    }, [modalViewingMonth, selectedProfessionalForInfo, establishment?.id, selectedDate]);

    const getPaymentMethodLabel = (method: unknown): string => {
      const key = String(method || '').trim();
      const labels: Record<string, string> = {
        pix: 'PIX',
        dinheiro: 'Dinheiro',
        credito: 'Crédito',
        debito: 'Débito',
        transferencia: 'Transferência',
        pagar_local: 'Pagamento no local',
        multi: 'Misto',
        assinante: 'Assinante',
        pendente: 'Pagamento no local',
      };
      return labels[key] || (key ? key : 'Pagamento no local');
    };

    const getStatusLabel = (status: unknown): string => {
      const key = String(status || '').trim();
      const labels: Record<string, string> = {
        completed: 'Concluído',
        confirmed: 'Em andamento',
        pending: 'Pendente',
        cancelled: 'Não compareceu',
      };
      return labels[key] || 'Pendente';
    };

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const sanitizeCashLabel = (raw: unknown): string => {
      const value = String(raw || '').trim();
      if (!value) return '';
      const withoutUndefined = value
        .replace(/\(\s*undefined\s*\)/gi, '')
        .replace(/\bundefined\b/gi, '')
        .replace(/\bnull\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return withoutUndefined;
    };

    const getCashAppointmentProfessionalLabel = (apt: Appointment): string => {
      const byName = sanitizeCashLabel(apt.professional_name);
      if (byName) return byName;

      const byProfessionalId = String(apt.professional_id || '').trim();
      if (byProfessionalId) {
        const fromId = professionals.find((p) => String(p.id || '').trim() === byProfessionalId);
        const name = sanitizeCashLabel(fromId?.name);
        if (name) return name;
      }

      const rawProfessional = String(apt.professional || '').trim();
      if (rawProfessional && !UUID_REGEX.test(rawProfessional)) {
        return sanitizeCashLabel(rawProfessional);
      }

      const fromLegacyId = professionals.find((p) => String(p.id || '').trim() === rawProfessional);
      const legacyName = sanitizeCashLabel(fromLegacyId?.name);
      if (legacyName) return legacyName;

      return 'Profissional não informado';
    };

    const getCashAppointmentServiceLabel = (apt: Appointment): string => {
      const service = sanitizeCashLabel(apt.service);
      return service || 'Serviço não informado';
    };

    const selectedDayAppointments = appointments
      .filter((apt) => String(apt.appointment_date || '').slice(0, 10) === selectedDateIso)
      .sort((a, b) => String(a.appointment_time || '').localeCompare(String(b.appointment_time || '')));

    const completedDayAppointments = selectedDayAppointments.filter((apt) => apt.status === 'completed');

    const getPaymentAmountsForAppointment = (apt: Appointment): Record<string, number> => {
      const splitRows = parsePaymentSplitDetails(apt);
      if (splitRows.length > 0) {
        return splitRows.reduce<Record<string, number>>((acc, row) => {
          const method = row.method || 'pagar_local';
          acc[method] = round2((acc[method] || 0) + row.amount);
          return acc;
        }, {});
      }

      const method = resolveEffectivePaymentMethod(apt as any);
      return { [method]: calculateTotalPrice(apt) };
    };

    const paymentSummary = completedDayAppointments.reduce<Record<string, number>>((acc, apt) => {
      const amounts = getPaymentAmountsForAppointment(apt);
      Object.entries(amounts).forEach(([method, amount]) => {
        acc[method] = round2((acc[method] || 0) + amount);
      });
      return acc;
    }, {});

    const dayGrossRevenue = completedDayAppointments.reduce((sum, apt) => sum + calculateServiceTotal(apt), 0);
    const dayTotalReceived = completedDayAppointments.reduce((sum, apt) => sum + calculateTotalPrice(apt), 0);
    const dayProfessionalPayout = completedDayAppointments.reduce((sum, apt) => {
      const professional = professionals.find((p) => appointmentBelongsToProfessionalColumn(apt, p)) || null;
      const baseValue = calculateServiceTotal(apt);
      const cardTaxAmount = getCardTaxAmountForServiceBase(apt, baseValue);
      const baseAfterTax = establishment?.tax_deducted_by_establishment ? baseValue : Math.max(0, baseValue - cardTaxAmount);
      const percentage = getEffectiveProfessionalPercentageForAppointment(apt, professional);
      const tip = getProfessionalTipAmount(apt);
      return sum + (baseAfterTax * percentage) / 100 + tip;
    }, 0);
    const dayBarbershopNet = Math.max(0, round2(dayGrossRevenue - dayProfessionalPayout));

    // Produtos vendidos hoje (via "Adicionar Produto" nos agendamentos concluídos)
    const todaySoldProducts = completedDayAppointments.flatMap(apt => {
      const prof = professionals.find(p => appointmentBelongsToProfessionalColumn(apt, p)) || null;
      return (apt.sold_products || []).map(sp => {
        const productDef = establishmentProducts.find(p => p.id === sp.product_id);
        const commissionPct = (prof && productDef?.commission_percentages?.[prof.name]) || 0;
        return {
          ...sp,
          professionalName: prof?.name || '—',
          commissionPct,
          commissionAmount: round2(sp.total * commissionPct / 100),
          netAmount: round2(sp.total * (1 - commissionPct / 100)),
          clientName: apt.client_name || 'Cliente avulso',
        };
      });
    });
    const dayProductsRevenue = round2(todaySoldProducts.reduce((sum, p) => sum + p.total, 0));
    const dayProductsPayout = round2(todaySoldProducts.reduce((sum, p) => sum + p.commissionAmount, 0));
    const dayProductsNet = round2(dayProductsRevenue - dayProductsPayout);

    const pendingAppointmentsCount = selectedDayAppointments.filter((apt) => apt.status === 'pending' || apt.status === 'confirmed').length;
    const missingPaymentMethodCount = selectedDayAppointments.filter((apt) => apt.status !== 'cancelled' && !String(apt.payment_method || '').trim()).length;
    const completedAppointmentsCount = completedDayAppointments.length;
    const cancelledAppointmentsCount = selectedDayAppointments.filter((apt) => apt.status === 'cancelled').length;

    // Função para calcular duração em minutos entre dois horários
    const calculateDuration = (startTime: string, endTime: string): number => {
      const [startHours, startMins] = startTime.split(':').map(Number);
      const [endHours, endMins] = endTime.split(':').map(Number);

      const startTotal = startHours * 60 + startMins;
      const endTotal = endHours * 60 + endMins;

      return endTotal - startTotal;
    };

    // Função para encontrar o horário mais próximo no grid
    const findNearestSlot = (time: string, slots: string[]): string => {
      const [hours, mins] = time.split(':').map(Number);
      const timeTotal = hours * 60 + mins;

      let nearest = slots[0];
      let minDiff = Math.abs(
        timeTotal - slots[0].split(':').map(Number).reduce((h, m) => h * 60 + m)
      );

      slots.forEach(slot => {
        const [slotHours, slotMins] = slot.split(':').map(Number);
        const slotTotal = slotHours * 60 + slotMins;
        const diff = Math.abs(timeTotal - slotTotal);

        if (diff < minDiff) {
          minDiff = diff;
          nearest = slot;
        }
      });

      return nearest;
    };

    const minutesToHHmm = (minutes: number): string => {
      const safeMinutes = Math.max(0, Math.floor(minutes));
      const hours = Math.floor(safeMinutes / 60);
      const mins = safeMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const timeToMinutes = (hhmm: string): number => {
      const [h, m] = String(hhmm || '').split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
      return h * 60 + m;
    };

    const hasTimeOverlap = (startA: number, endA: number, startB: number, endB: number): boolean => {
      return startA < endB && startB < endA;
    };

    const normalizeWhatsappKey = (raw: any) => {
      let digits = String(raw || '').replace(/\D/g, '');
      if (!digits) return '';
      while (digits.startsWith('55') && digits.length > 11) {
        digits = digits.slice(2);
      }
      if (digits.startsWith('55')) {
        const after = digits.slice(2);
        if (after.length === 10 || after.length === 11) return after;
      }
      if (digits.length > 11) return digits.slice(-11);
      return digits;
    };

    const getWhatsappLookupKeys = (raw: any): string[] => {
      const digits = String(raw || '').replace(/\D/g, '');
      const normalized = normalizeWhatsappKey(raw);
      if (!digits && !normalized) return [];
      const keys = new Set<string>();
      if (digits) keys.add(digits);
      if (normalized) keys.add(normalized);
      if (digits.startsWith('55') && digits.length > 2) keys.add(digits.slice(2));
      if (normalized && (normalized.length === 10 || normalized.length === 11)) {
        keys.add(`55${normalized}`);
      }
      return Array.from(keys).filter(Boolean);
    };

    const formatCpfDisplay = (cpfRaw?: string | null): string => {
      const digits = String(cpfRaw || '').replace(/\D/g, '');
      if (digits.length !== 11) return '';
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    };

    useEffect(() => {
      if (!establishment?.id || !Array.isArray(appointments) || appointments.length === 0) {
        setAppointmentContactById({});
        return;
      }

      let cancelled = false;
      const hydrateContacts = async () => {
        const nextById: Record<string, { cpf?: string; street?: string }> = {};
        const whatsappKeys = Array.from(
          new Set(
            appointments
              .flatMap((apt) => getWhatsappLookupKeys(apt.client_whatsapp))
              .map((w) => String(w || '').replace(/\D/g, ''))
              .filter(Boolean)
          )
        );

        const contactsByKey = new Map<string, { cpf?: string; street?: string }>();
        const whatsappKeySet = new Set(whatsappKeys);
        const mergeContact = (key: string, nextCpfRaw: any, nextStreetRaw: any) => {
          if (!key) return;
          const nextCpf = String(nextCpfRaw || '').replace(/\D/g, '');
          const nextStreet = String(nextStreetRaw || '').trim();
          const current = contactsByKey.get(key) || {};
          const currentCpf = String(current.cpf || '').replace(/\D/g, '');
          const currentStreet = String(current.street || '').trim();
          contactsByKey.set(key, {
            cpf: currentCpf || nextCpf || '',
            street: currentStreet || nextStreet || '',
          });
        };

        try {
          if (whatsappKeys.length > 0) {
            let rows: any[] = [];
            const isLocalDev =
              typeof window !== 'undefined' &&
              (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const manualClientsSafeMode =
              isLocalDev ||
              typeof window !== 'undefined' &&
              window.sessionStorage.getItem('manual_clients_safe_select') === '1';

            const withExtra = manualClientsSafeMode
              ? await supabase
                .from('manual_clients')
                .select('whatsapp')
                .eq('establishment_id', establishment.id)
                .limit(10000)
              : await supabase
                .from('manual_clients')
                .select('whatsapp, cpf, street')
                .eq('establishment_id', establishment.id)
                .limit(10000);

            if (withExtra.error) {
              if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('manual_clients_safe_select', '1');
              }
              const legacy = await supabase
                .from('manual_clients')
                .select('whatsapp')
                .eq('establishment_id', establishment.id)
                .limit(10000);
              if (legacy.error) throw legacy.error;
              rows = (legacy.data || []) as any[];
            } else {
              rows = (withExtra.data || []) as any[];
            }

            rows.forEach((row: any) => {
              const rowDigits = String(row?.whatsapp || '').replace(/\D/g, '');
              if (!rowDigits || !whatsappKeySet.has(rowDigits)) return;
              const keys = getWhatsappLookupKeys(row?.whatsapp).map((w) =>
                String(w || '').replace(/\D/g, '')
              );
              keys.forEach((key) => {
                mergeContact(key, row?.cpf, row?.street);
              });
            });
          }
        } catch (error) {
          console.warn('⚠️ Erro ao buscar CPF/endereço no manual_clients:', error);
        }

        // Fallback no localStorage para não depender só do banco.
        try {
          const storageKey = `manual_clients_${establishment.id}`;
          const localManual = JSON.parse(localStorage.getItem(storageKey) || '{}');
          Object.values(localManual || {}).forEach((raw: any) => {
            const keys = getWhatsappLookupKeys((raw as any)?.whatsapp || '').map((w) =>
              String(w || '').replace(/\D/g, '')
            );
            keys.forEach((key) => {
              mergeContact(key, (raw as any)?.cpf, (raw as any)?.street);
            });
          });
        } catch {
          // ignore fallback errors
        }

        appointments.forEach((apt) => {
          const aptKeys = getWhatsappLookupKeys(apt.client_whatsapp).map((w) =>
            String(w || '').replace(/\D/g, '')
          );
          const merged = aptKeys.map((k) => contactsByKey.get(k)).find(Boolean);
          nextById[apt.id] = {
            cpf: String(apt.client_cpf || '').replace(/\D/g, '') || String(merged?.cpf || ''),
            street: String((apt as any).client_street || merged?.street || '').trim(),
          };
        });

        if (!cancelled) {
          setAppointmentContactById(nextById);
        }
      };

      void hydrateContacts();
      return () => {
        cancelled = true;
      };
    }, [appointments, establishment?.id]);

    const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

    const getSqueezeSubscriptionPlanId = (service: any): string => {
      const raw = String(service?.subscription_plan_id || '').trim();
      if (raw) return raw;
      const id = String(service?.id || '');
      if (id.startsWith('subscription_')) return id.slice('subscription_'.length);
      return '';
    };

    const formatSubscriberSqueezeClientName = (name: string): string => {
      const base = String(name || '').trim() || 'Cliente';
      return clientNameHasSubscriberLabel(base) ? base : `${base} (ASSINANTE)`;
    };

    const resetSqueezeFlowState = () => {
      setShowSqueezeServiceModal(false);
      setShowSqueezeTimeModal(false);
      setShowSqueezeClientModal(false);
      setShowSqueezeProfessionalModal(false);
      setShowSqueezeSubscriberClientModal(false);
      setSelectedSqueezeService(null);
      setSelectedSqueezeSubscriberClient(null);
      setSqueezeSubscriptionClients([]);
      setSqueezeSubscriptionClientSearch('');
      setSqueezeStartTime('');
      setSqueezeEndTime('');
      setSelectedSqueezeKnownClientId('');
      setSqueezeKnownClientSearch('');
      setSelectedProfessionalForSqueeze(null);
    };

    const loadSqueezeSubscriptionClients = async (subscriptionPlanId: string, professionalId: string) => {
      if (!establishment?.id || !subscriptionPlanId) return;
      setSqueezeSubscriptionClientsLoading(true);
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        let { data, error } = await supabase
          .from('client_subscriptions')
          .select(
            'id, subscription_id, client_id, subscriber_name, subscriber_whatsapp, client_whatsapp, client_name_override, payment_status, start_date, end_date, subscriber_professional_id, subscriber_professional_ids'
          )
          .eq('establishment_id', establishment.id)
          .eq('subscription_id', subscriptionPlanId);

        // Fallback para banco ainda sem a coluna nova (lista de profissionais)
        if (error && String(error.message || '').toLowerCase().includes('subscriber_professional_ids')) {
          ({ data, error } = await supabase
            .from('client_subscriptions')
            .select(
              'id, subscription_id, client_id, subscriber_name, subscriber_whatsapp, client_whatsapp, client_name_override, payment_status, start_date, end_date, subscriber_professional_id'
            )
            .eq('establishment_id', establishment.id)
            .eq('subscription_id', subscriptionPlanId));
        }

        if (error) throw error;

        const clients = (data || [])
          .filter((row: any) => isDateInsidePaidSubscription(dateStr, row))
          .filter((row: any) => {
            // Novo: lista de profissionais vinculados; fallback para o campo antigo (único)
            const multiIds = Array.isArray(row?.subscriber_professional_ids)
              ? row.subscriber_professional_ids.map((x: any) => String(x || '').trim()).filter(Boolean)
              : [];
            const singleId = String(row?.subscriber_professional_id || '').trim();
            const linkedIds = multiIds.length > 0 ? multiIds : (singleId ? [singleId] : []);
            if (linkedIds.length === 0) return true;
            return linkedIds.includes(String(professionalId || '').trim());
          })
          .map((row: any) => {
            const name =
              String(row?.client_name_override || row?.subscriber_name || '').trim() || 'Cliente';
            const whatsapp = String(row?.subscriber_whatsapp || row?.client_whatsapp || '').trim();
            return {
              id: String(row?.id || ''),
              client_id: String(row?.client_id || '').trim() || undefined,
              name,
              whatsapp,
              subscription_id: String(row?.subscription_id || subscriptionPlanId),
            } satisfies SqueezeSubscriberClientOption;
          })
          .filter((row) => row.id.length > 0)
          .sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
          );

        setSqueezeSubscriptionClients(clients);
      } catch (error) {
        console.error('Erro ao carregar assinantes do plano para encaixe:', error);
        toast.error('Erro ao carregar assinantes deste plano');
        setSqueezeSubscriptionClients([]);
      } finally {
        setSqueezeSubscriptionClientsLoading(false);
      }
    };

    const handleSelectSqueezeProfessional = async (professionalId: string) => {
      if (!selectedSqueezeService) return;
      const planId = getSqueezeSubscriptionPlanId(selectedSqueezeService);
      if (!planId) {
        toast.error('Plano de assinatura inválido.');
        return;
      }
      setSelectedProfessionalForSqueeze(professionalId);
      setSelectedSqueezeSubscriberClient(null);
      setSqueezeSubscriptionClientSearch('');
      setShowSqueezeProfessionalModal(false);
      await loadSqueezeSubscriptionClients(planId, professionalId);
      setShowSqueezeSubscriberClientModal(true);
    };

    const handleSelectSqueezeSubscriberClient = (client: SqueezeSubscriberClientOption) => {
      setSelectedSqueezeSubscriberClient(client);
      setShowSqueezeSubscriberClientModal(false);
      setShowSqueezeTimeModal(true);
    };

    const loadSqueezeKnownClients = async () => {
      if (!establishment?.id) return;
      setSqueezeKnownClientsLoading(true);
      try {
        const map = new Map<string, SqueezeKnownClientOption>();

        const { data, error } = await supabase
          .from('appointments')
          .select('client_id, client_name, client_whatsapp')
          .eq('establishment_id', establishment.id)
          .not('client_name', 'is', null)
          .not('client_whatsapp', 'is', null)
          .order('created_at', { ascending: false });
        if (error) throw error;

        (data || []).forEach((row: any) => {
          const key = normalizeWhatsappKey(row?.client_whatsapp);
          if (!key || map.has(key)) return;
          map.set(key, {
            id: key,
            client_id: String(row?.client_id || '').trim() || undefined,
            name: String(row?.client_name || '').trim() || 'Cliente',
            whatsapp: String(row?.client_whatsapp || '').trim(),
          });
        });

        // Completar com clientes manuais (mesma fonte usada em "Meus Clientes")
        try {
          const { data: manualRows, error: manualError } = await supabase
            .from('manual_clients')
            .select('name, whatsapp')
            .eq('establishment_id', establishment.id);

          if (manualError) {
            // Fallback para localStorage quando tabela não existe/erro de permissão
            const storageKey = `manual_clients_${establishment.id}`;
            const manualLocal = JSON.parse(localStorage.getItem(storageKey) || '{}');
            Object.values(manualLocal || {}).forEach((raw: any) => {
              const key = normalizeWhatsappKey((raw as any)?.whatsapp || '');
              if (!key || map.has(key)) return;
              map.set(key, {
                id: key,
                name: String((raw as any)?.name || '').trim() || 'Cliente',
                whatsapp: String((raw as any)?.whatsapp || '').trim(),
              });
            });
          } else {
            (manualRows || []).forEach((row: any) => {
              const key = normalizeWhatsappKey(row?.whatsapp);
              if (!key || map.has(key)) return;
              map.set(key, {
                id: key,
                name: String(row?.name || '').trim() || 'Cliente',
                whatsapp: String(row?.whatsapp || '').trim(),
              });
            });
          }
        } catch {
          const storageKey = `manual_clients_${establishment.id}`;
          const manualLocal = JSON.parse(localStorage.getItem(storageKey) || '{}');
          Object.values(manualLocal || {}).forEach((raw: any) => {
            const key = normalizeWhatsappKey((raw as any)?.whatsapp || '');
            if (!key || map.has(key)) return;
            map.set(key, {
              id: key,
              name: String((raw as any)?.name || '').trim() || 'Cliente',
              whatsapp: String((raw as any)?.whatsapp || '').trim(),
            });
          });
        }

        const clients = Array.from(map.values()).sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { sensitivity: 'base' })
        );
        setSqueezeKnownClients(clients);
      } catch (error) {
        console.error('Erro ao carregar clientes conhecidos para encaixe:', error);
        toast.error('Erro ao carregar clientes conhecidos');
      } finally {
        setSqueezeKnownClientsLoading(false);
      }
    };

    const openSqueezeClientModal = async () => {
      if (!selectedSqueezeService || !squeezeStartTime || !squeezeEndTime || !selectedProfessionalForSqueeze || !establishment) {
        toast.error('Preencha todos os campos');
        return;
      }
      const duration = calculateDuration(squeezeStartTime, squeezeEndTime);
      if (duration <= 0) {
        toast.error('O horário de término deve ser depois do horário de início');
        return;
      }
      setSqueezeClientType('avulso');
      setSelectedSqueezeKnownClientId('');
      setSqueezeKnownClientSearch('');
      setShowSqueezeTimeModal(false);
      setShowSqueezeClientModal(true);
      await loadSqueezeKnownClients();
    };

    // Função para criar encaixe
    const handleCreateSqueeze = async (selectedClient?: SqueezeKnownClientOption | null) => {
      if (!selectedSqueezeService || !squeezeStartTime || !squeezeEndTime || !selectedProfessionalForSqueeze || !establishment) {
        toast.error('Preencha todos os campos');
        return;
      }

      // Validar que o horário de término é depois do início
      const duration = calculateDuration(squeezeStartTime, squeezeEndTime);
      if (duration <= 0) {
        toast.error('O horário de término deve ser depois do horário de início');
        return;
      }

      try {
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
        const newStart = timeToMinutes(squeezeStartTime);
        const newEnd = timeToMinutes(squeezeEndTime);

        // Diagnóstico local antes do insert para explicar conflitos "invisíveis".
        const conflictingLocal = appointments.find((apt) => {
          if (apt.professional !== selectedProfessionalForSqueeze) return false;
          if (apt.appointment_date !== selectedDateStr) return false;
          if (apt.status === 'cancelled') return false;
          const aptStart = timeToMinutes(apt.appointment_time);
          const aptEnd = aptStart + getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos);
          return hasTimeOverlap(newStart, newEnd, aptStart, aptEnd);
        });

        if (conflictingLocal) {
          const conflictClient = String(conflictingLocal.client_name || 'Cliente').trim() || 'Cliente';
          const conflictStart = String(conflictingLocal.appointment_time || '').trim() || 'sem horário';
          const conflictDuration = getDuracaoTotalAgendamento(conflictingLocal, intervaloAgendaMinutos);
          const conflictEndMins = timeToMinutes(conflictStart) + conflictDuration;
          const conflictEnd = `${String(Math.floor(conflictEndMins / 60)).padStart(2, '0')}:${String(conflictEndMins % 60).padStart(2, '0')}`;
          toast.error(
            `Conflito: ${conflictClient} já ocupa ${conflictStart} até ${conflictEnd}. Verifique também "Agendamentos ocultos".`
          );
          return;
        }

        // Buscar owner_id como fallback para client_id (necessário para FK em auth.users)
        const { data: establishmentData } = await supabase
          .from('establishments')
          .select('owner_id')
          .eq('id', establishment.id)
          .single();

        const fallbackClientId = String(user?.id || establishmentData?.owner_id || '').trim();
        if (!fallbackClientId) {
          toast.error('Não foi possível identificar o usuário para criar o encaixe.');
          return;
        }

        const isSubscriptionSqueeze = Boolean((selectedSqueezeService as any)?.is_subscription);
        const squeezePrice = isSubscriptionSqueeze ? 0 : Number(selectedSqueezeService?.price || 0);
        const subscriptionPlanId = isSubscriptionSqueeze
          ? getSqueezeSubscriptionPlanId(selectedSqueezeService)
          : '';

        let clientName = 'ENCAIXE';
        let clientWhatsapp = '';
        let knownClientId = '';
        let isAvulsoSqueeze = true;

        if (isSubscriptionSqueeze) {
          const subClient = selectedSqueezeSubscriberClient;
          if (!subClient) {
            toast.error('Selecione o assinante deste plano.');
            return;
          }
          if (!subscriptionPlanId) {
            toast.error('Plano de assinatura inválido.');
            return;
          }
          clientName = formatSubscriberSqueezeClientName(subClient.name);
          clientWhatsapp = String(subClient.whatsapp || '').trim();
          knownClientId = String(subClient.client_id || '').trim();
          isAvulsoSqueeze = false;
        } else if (selectedClient) {
          clientName = String(selectedClient.name || 'Cliente').trim() || 'Cliente';
          clientWhatsapp = String(selectedClient.whatsapp || '').trim();
          knownClientId = String(selectedClient.client_id || '').trim();
          isAvulsoSqueeze = false;
        }

        // Assinantes independentes têm client_id gerado (uuid) que não existe em auth.users.
        // Encaixe interno usa owner/staff como client_id (mesmo padrão de ReservarCliente).
        const clientIdForInsert = isSubscriptionSqueeze
          ? fallbackClientId
          : knownClientId && isUuid(knownClientId)
            ? knownClientId
            : fallbackClientId;

        const insertPayload: Record<string, unknown> = {
          client_id: clientIdForInsert,
          establishment_id: establishment.id,
          professional: selectedProfessionalForSqueeze,
          service: selectedSqueezeService.name,
          client_name: clientName,
          client_whatsapp: clientWhatsapp,
          appointment_date: selectedDateStr,
          appointment_time: squeezeStartTime,
          status: 'confirmed',
          price: squeezePrice,
          total_price: squeezePrice,
          duration: duration,
          payment_method: isSubscriptionSqueeze ? 'assinante' : 'dinheiro',
          is_avulso: isAvulsoSqueeze,
          is_subscriber: isSubscriptionSqueeze,
          is_squeeze: true,
          is_establishment_booking: true,
        };
        if (subscriptionPlanId) {
          insertPayload.subscription_id = subscriptionPlanId;
        }

        const { error } = await supabase.from('appointments').insert(insertPayload);

        if (error) throw error;

        toast.success('Encaixe criado com sucesso!');

        resetSqueezeFlowState();

        // Atualizar agendamentos
        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao criar encaixe:', error);
        toast.error(error.message || 'Erro ao criar encaixe');
      }
    };

    if (professionals.length === 0) {
      return (
        <div className="text-center py-12">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 text-lg">Nenhum profissional cadastrado</p>
          <p className="text-gray-500 text-sm mt-2">
            Adicione profissionais na aba "Profissionais" para visualizar os agendamentos
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2 md:space-y-4">
        {/* Alerta: WhatsApp tinha sessão e caiu — acima da validade */}
        {whatsappAlert && (
          <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${realIsLight ? 'bg-red-50 border-red-300' : 'bg-red-500/10 border-red-500/40'}`}>
            <p className={`text-xs font-bold ${realIsLight ? 'text-red-700' : 'text-red-200'}`}>
              📵 Seu WhatsApp desconectou
            </p>
            <button
              type="button"
              onClick={() => { if (onOpenWhatsAppReminders) onOpenWhatsAppReminders(); }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              Conectar
            </button>
          </div>
        )}
        {/* Alerta extra: WhatsApp diz "conectado" mas não enviou NADA hoje (sessão travada).
            Detecção por evidência: 10+ agendamentos de hoje já passaram e 0 envios no log. */}
        {!whatsappAlert && whatsappSilentAlert && (
          <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${realIsLight ? 'bg-amber-50 border-amber-300' : 'bg-amber-500/10 border-amber-500/40'}`}>
            <p className={`text-xs font-bold ${realIsLight ? 'text-amber-700' : 'text-amber-200'}`}>
              ⚠️ Seu WhatsApp pode estar travado: {whatsappSilentAlertCount} agendamentos hoje e nenhuma mensagem enviada. Desconecte e conecte de novo.
            </p>
            <button
              type="button"
              onClick={() => { if (onOpenWhatsAppReminders) onOpenWhatsAppReminders(); }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
            >
              Verificar
            </button>
          </div>
        )}
        {/* Validade do sistema — fora do header sticky */}
        {establishment?.id && (
          <ValidityDisplay establishmentId={establishment.id} dark={!realIsLight} />
        )}

        {/* Cabeçalho compacto clean — no modo escuro funde com o fundo (sem borda/sombra) */}
        <div className={`sticky top-0 z-30 -mt-1 md:mt-0 mb-1 md:mb-2 rounded-xl backdrop-blur-md ${useLightLayout ? 'border border-white/10 bg-[#0b0b0c]/95 shadow-lg shadow-black/30' : 'bg-[#0b0b0c]'}`}>
          <div className="px-2.5 py-2 md:px-3 md:py-2.5 space-y-1.5 md:space-y-2">
            {isCollaboratorView && isSecretaryModeActive && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5">
                <p className="text-[11px] font-extrabold text-emerald-200">Modo secretaria ativo</p>
                {!canViewBarbershopCash && (
                  <p className="text-[10px] text-emerald-200/70 mt-0.5">Caixa pede senha de 4 dígitos.</p>
                )}
              </div>
            )}

            {/* Linha 1: seta ← | data central | HOJE | seta → | calendário */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePreviousDay}
                className="shrink-0 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/15"
                aria-label="Dia anterior"
              >
                <ChevronLeft className="h-5 w-5" strokeWidth={3} />
              </button>

              <div className="flex-1 text-center leading-tight py-1">
                <span className="block text-xs md:text-sm font-extrabold text-white">
                  {isSelectedToday ? 'HOJE' : isSelectedYesterday ? 'ONTEM' : isSelectedTomorrow ? 'AMANHÃ' : format(selectedDate, 'dd/MM', { locale: ptBR })}
                </span>
                <span className="block text-[10px] md:text-[11px] font-bold text-white/50 uppercase">
                  {format(selectedDate, 'EEEE', { locale: ptBR })}
                </span>
              </div>

              {!isSelectedToday && (
                <button
                  type="button"
                  onClick={() => goToQuickDate('today')}
                  className="shrink-0 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-amber-200 text-[9px] md:text-[10px] font-bold border border-white/15 transition-colors whitespace-nowrap"
                >
                  ← Voltar para hoje
                </button>
              )}

              <button
                type="button"
                onClick={handleNextDay}
                className="shrink-0 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/15"
                aria-label="Próximo dia"
              >
                <ChevronRight className="h-5 w-5" strokeWidth={3} />
              </button>

              {/* Calendário picker */}
              <div ref={datePickerContainerRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDatePicker((open) => !open)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1.5 py-1.5 text-[10px] font-bold text-amber-200/90 hover:bg-white/10 whitespace-nowrap"
                  aria-expanded={showDatePicker}
                  aria-haspopup="dialog"
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline capitalize">{format(selectedDate, "dd/MM", { locale: ptBR })}</span>
                </button>
                {showDatePicker && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-xl border border-white/15 bg-[#141516] p-3 shadow-2xl shadow-black/50">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/55">Selecionar data</p>
                    <input
                      ref={datePickerInputRef}
                      type="date"
                      value={format(selectedDate, 'yyyy-MM-dd')}
                      onChange={handleDateInputChange}
                      className="w-full rounded-lg border border-white/20 bg-[#0b0b0c] px-3 py-2 text-sm text-white [color-scheme:dark]"
                      aria-label="Escolher data"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Linha 2: cards profissionais com foto + botão caixa */}
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="flex-1 overflow-x-auto hide-scrollbar">
                <div className="flex items-end gap-1.5 md:gap-2 pb-0.5">
                  {professionals.length > 0 && (
                    <>
                      {isCollaboratorView && isSecretaryModeActive ? (
                        visibleProfessionals.length > 0 ? (
                          visibleProfessionals.map((professional) => (
                            <div
                              key={`secretary-${professional.id}`}
                              className="shrink-0 flex flex-col items-center gap-0.5"
                            >
                              <div className="relative">
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-emerald-500/50 overflow-hidden bg-white/10">
                                  <img
                                    src={professional.photo_url || '/fotopessoa.png'}
                                    alt={professional.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/fotopessoa.png'; }}
                                  />
                                </div>
                              </div>
                              <span className="text-[9px] md:text-[10px] font-bold text-emerald-200 max-w-[52px] md:max-w-[64px] truncate text-center">
                                {professional.name}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-amber-200/90 py-2">Nenhuma agenda liberada.</p>
                        )
                      ) : (
                        professionals.map((professional) => {
                          const isVisible = visibleProfessionals.some((v) => v.id === professional.id);
                          const isProtectedAndLocked =
                            isProfessionalAppointmentsProtected(professional) &&
                            !isProfessionalAppointmentsUnlocked(professional.id);
                          return (
                            <button
                              key={`pro-card-${professional.id}`}
                              type="button"
                              onClick={() => toggleProfessionalVisibility(professional.id)}
                              onDoubleClick={() => selectOnlyProfessional(professional.id)}
                              title={
                                isProtectedAndLocked
                                  ? 'Agenda protegida. Clique para digitar a senha.'
                                  : 'Clique para marcar/desmarcar. Dois cliques = só este.'
                              }
                              className="shrink-0 flex flex-col items-center gap-0.5 group"
                            >
                              <div className="relative">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 overflow-hidden transition-all ${isVisible
                                  ? 'border-emerald-400 shadow-md shadow-emerald-500/25'
                                  : isProtectedAndLocked
                                    ? 'border-amber-500/50 opacity-60'
                                    : 'border-white/20 opacity-50 group-hover:opacity-75'
                                }`}>
                                  <img
                                    src={professional.photo_url || '/fotopessoa.png'}
                                    alt={professional.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/fotopessoa.png'; }}
                                  />
                                </div>
                                {isVisible ? (
                                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 md:w-4.5 md:h-4.5 rounded-full bg-red-500 border border-[#0b0b0c] flex items-center justify-center cursor-pointer">
                                    <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                  </div>
                                ) : isProtectedAndLocked ? (
                                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border border-[#0b0b0c] flex items-center justify-center">
                                    <Lock className="w-2 h-2 text-black" strokeWidth={3} />
                                  </div>
                                ) : (
                                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 md:w-4.5 md:h-4.5 rounded-full bg-emerald-500 border border-[#0b0b0c] flex items-center justify-center">
                                    <Plus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                  </div>
                                )}
                              </div>
                              <span className={`text-[9px] md:text-[10px] font-bold max-w-[52px] md:max-w-[64px] truncate text-center leading-tight ${isVisible
                                ? 'text-emerald-200'
                                : isProtectedAndLocked
                                  ? 'text-amber-200/70'
                                  : 'text-white/45 group-hover:text-white/65'
                              }`}>
                                {professional.name}
                              </span>
                            </button>
                          );
                        })
                      )}
                      {professionals.length > 1 && !isCollaboratorView && (
                        <button
                          type="button"
                          onClick={selectAllProfessionals}
                          className="shrink-0 flex flex-col items-center gap-0.5 group"
                        >
                          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-dashed border-amber-400/40 bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <Users className="w-4 h-4 md:w-5 md:h-5 text-amber-300/70 group-hover:text-amber-200" />
                          </div>
                          <span className="text-[9px] md:text-[10px] font-bold text-amber-300/70 group-hover:text-amber-200">
                            Todos
                          </span>
                        </button>
                      )}
                      {/* 👁️ Ocultar valores dos cards (privacidade p/ gravar tela) */}
                      <button
                        type="button"
                        onClick={toggleHideCardValues}
                        className="shrink-0 flex flex-col items-center gap-0.5 group"
                        title={hideCardValues ? 'Valores ocultos — toque para mostrar' : 'Ocultar os valores dos agendamentos (privacidade para gravar a tela)'}
                      >
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center transition-colors ${hideCardValues
                          ? 'border-violet-400 bg-violet-500/20'
                          : 'border-dashed border-white/25 bg-white/5 group-hover:bg-white/10'
                        }`}>
                          {hideCardValues ? (
                            <EyeOff className="w-4 h-4 md:w-5 md:h-5 text-violet-200" />
                          ) : (
                            <Eye className="w-4 h-4 md:w-5 md:h-5 text-white/60 group-hover:text-white/85" />
                          )}
                        </div>
                        <span className={`text-[9px] md:text-[10px] font-bold ${hideCardValues ? 'text-violet-200' : 'text-white/45 group-hover:text-white/65'}`}>
                          {hideCardValues ? 'Ocultos' : 'Valores'}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Caixa — pill compacto */}
              <button
                type="button"
                onClick={handleOpenBarbershopCash}
                data-tutorial-id="appointments-caixa"
                disabled={isLoadingBarbershopCashOpening}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-600/20 px-2 py-1 text-[10px] font-extrabold text-emerald-100 hover:bg-emerald-600/30 disabled:opacity-60 transition-colors whitespace-nowrap"
              >
                💰 Caixa {format(selectedDate, 'dd/MM')}
              </button>
            </div>

            {visibleProfessionals.length === 0 && professionals.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-amber-200">
                Nenhum profissional visível. Informe a senha para exibir agenda protegida.
              </div>
            )}
          </div>
        </div>

        {showBarbershopCashModal && canViewBarbershopCash && (
          <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl shadow-2xl border border-emerald-500/30 bg-gradient-to-b from-[#07110f] via-[#0b0b0c] to-black">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-extrabold text-2xl">Caixa / Geral</div>
                    <div className="text-xs text-white/70 mt-1">{format(selectedDate, 'dd/MM/yyyy')}</div>
                    <p className="text-sm text-white/80 mt-2">Controle o dinheiro que entra e sai do seu caixa físico no dia.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBarbershopCashModal(false)}
                    className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
                    title="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="max-h-[calc(92vh-150px)] overflow-y-auto p-4 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">Status do caixa</p>
                    <h3 className="mt-2 text-xl font-extrabold text-white">
                      {barbershopCashOpeningValue > 0 ? 'Caixa aberto' : 'Caixa sem abertura'}
                    </h3>
                    <p className="mt-1 text-sm text-white/65">
                      {barbershopCashOpeningValue > 0
                        ? `Valor inicial informado: ${formatCurrency(barbershopCashOpeningValue)}`
                        : 'Abertura opcional. O painel continua funcionando normalmente.'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-white/55">Abertura do dia</p>
                    <p className="mt-1 text-[11px] text-white/45">Quanto em dinheiro físico você tem no caixa agora? Coloque o valor aqui.</p>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 150,00"
                      value={barbershopCashOpeningInput}
                      onChange={(e) => setBarbershopCashOpeningInput(e.target.value.replace(',', '.'))}
                      className="mt-2 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/20 text-white text-lg font-medium placeholder:text-white/40 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      disabled={isSavingBarbershopCashOpening}
                      onClick={handleSaveBarbershopCashOpening}
                      className="mt-3 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:pointer-events-none text-black font-bold py-3 transition-colors"
                    >
                      {isSavingBarbershopCashOpening ? 'Salvando...' : barbershopCashOpeningValue > 0 ? 'Atualizar abertura' : 'Abrir caixa'}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-white/55">Fechamento do caixa</p>
                    <p className="mt-1 text-[11px] text-white/45">No final do dia, conte o dinheiro do caixa e coloque o valor aqui. O sistema calcula se está tudo certo.</p>
                    <p className="mt-2 text-sm text-white/70">Total esperado: <span className="font-extrabold text-emerald-300">{formatCurrency(barbershopCashTotal)}</span></p>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Quanto você contou no caixa?"
                      value={barbershopCashRealInput}
                      onChange={(e) => setBarbershopCashRealInput(e.target.value.replace(',', '.'))}
                      className="mt-2 w-full px-4 py-3 rounded-xl bg-black/30 border border-white/20 text-white text-base font-medium placeholder:text-white/40 focus:outline-none focus:border-emerald-400"
                    />
                    <div className={`mt-2 rounded-xl px-3 py-2 text-sm font-bold ${!hasBarbershopCashRealAmount
                      ? 'bg-white/5 text-white/50'
                      : barbershopCashDifference === 0
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : barbershopCashDifference > 0
                          ? 'bg-blue-500/15 text-blue-200'
                          : 'bg-red-500/15 text-red-200'
                      }`}>
                      {!hasBarbershopCashRealAmount
                        ? 'Digite o valor real para ver a diferença.'
                        : barbershopCashDifference === 0
                          ? 'Caixa batendo certinho.'
                          : barbershopCashDifference > 0
                            ? `Sobrou ${formatCurrency(Math.abs(barbershopCashDifference))}`
                            : `Faltou ${formatCurrency(Math.abs(barbershopCashDifference))}`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-xs text-white/55 font-bold">Faturamento bruto do dia</p>
                    <p className="mt-1 text-2xl font-black text-white">{formatCurrency(dayGrossRevenue + dayProductsRevenue)}</p>
                    {dayProductsRevenue > 0 && (
                      <p className="text-[10px] text-white/40 mt-1">Serviços {formatCurrency(dayGrossRevenue)} + Produtos {formatCurrency(dayProductsRevenue)}</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                    <p className="text-xs text-emerald-100/70 font-bold">Lucro líquido da barbearia <span className="font-normal text-emerald-200/40">(já descontando % dos profissionais)</span></p>
                    <p className="mt-1 text-2xl font-black text-emerald-200">{formatCurrency(dayBarbershopNet + dayProductsNet)}</p>
                    {dayProductsRevenue > 0 && (
                      <p className="text-[10px] text-emerald-200/40 mt-1">Serviços {formatCurrency(dayBarbershopNet)} + Produtos {formatCurrency(dayProductsNet)}</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                    <p className="text-xs text-white/55 font-bold">Total recebido</p>
                    <p className="mt-1 text-2xl font-black text-white">{formatCurrency(dayTotalReceived)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-sm font-extrabold text-white mb-3">Formas de pagamento</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['pix', 'dinheiro', 'debito', 'credito', 'transferencia', 'pagar_local', 'multi', 'assinante'].map((method) => (
                      <div key={method} className="rounded-xl bg-black/25 border border-white/10 p-3">
                        <p className="text-[11px] font-bold text-white/55">{getPaymentMethodLabel(method)}</p>
                        <p className="mt-1 text-base font-black text-white">{formatCurrency(paymentSummary[method] || 0)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-extrabold text-white mb-3">Atendimentos do dia</p>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {selectedDayAppointments.length === 0 ? (
                        <p className="text-sm text-white/55">Nenhum atendimento encontrado para este dia.</p>
                      ) : selectedDayAppointments.map((apt) => (
                        <div key={apt.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                          {(() => {
                            const serviceLabel = getCashAppointmentServiceLabel(apt);
                            const professionalLabel = getCashAppointmentProfessionalLabel(apt);
                            return (
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                <div>
                                  <p className="text-sm font-extrabold text-white">{apt.client_name || 'Cliente sem nome'}</p>
                                  <p className="text-xs text-white/55">{apt.appointment_time} • {serviceLabel} • {professionalLabel}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${apt.status === 'completed' ? 'bg-emerald-500/20 text-emerald-200' : apt.status === 'cancelled' ? 'bg-red-500/20 text-red-200' : 'bg-amber-500/20 text-amber-200'}`}>
                                    {getStatusLabel(apt.status)}
                                  </span>
                                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${apt.payment_method ? 'bg-blue-500/20 text-blue-200' : 'bg-red-500/20 text-red-200'}`}>
                                    {getPaymentMethodLabel(apt.payment_method)}
                                  </span>
                                  <span className="rounded-full px-2 py-1 text-[11px] font-black bg-white/10 text-white">
                                    {formatCurrency(calculateTotalPrice(apt))}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                    <p className="text-sm font-extrabold text-amber-100 mb-3">Pendências do dia</p>
                    <div className="space-y-2 text-sm">
                      <p className="flex justify-between text-white/80"><span>Clientes não concluídos</span><strong>{pendingAppointmentsCount}</strong></p>
                      <p className="flex justify-between text-white/80"><span>Sem forma de pagamento</span><strong>{missingPaymentMethodCount}</strong></p>
                      <p className="flex justify-between text-white/80"><span>Concluídos</span><strong>{completedAppointmentsCount}</strong></p>
                      <p className="flex justify-between text-white/80"><span>Não compareceu/cancelado</span><strong>{cancelledAppointmentsCount}</strong></p>
                    </div>
                    <div className="mt-4 rounded-xl bg-black/25 border border-white/10 p-3 text-xs text-white/60">
                      A abertura do caixa é opcional. Sem abertura, o valor inicial considerado é R$ 0,00.
                    </div>
                  </div>
                </div>

                {/* Produtos vendidos hoje */}
                {todaySoldProducts.length > 0 && (
                  <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-extrabold text-white">Produtos vendidos hoje</p>
                      <span className="text-xs font-bold text-purple-300 bg-purple-500/20 border border-purple-500/30 rounded-full px-2 py-0.5">
                        {formatCurrency(dayProductsRevenue)} total
                      </span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {todaySoldProducts.map((sp, idx) => (
                        <div key={`${sp.product_id}-${idx}`} className="rounded-xl bg-black/25 border border-white/10 p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">{sp.name}</p>
                            <p className="text-xs text-white/50">{sp.clientName} • {sp.professionalName} • {sp.quantity}× {formatCurrency(sp.unit_price)}</p>
                          </div>
                          <div className="flex flex-col items-end shrink-0 gap-0.5">
                            <span className="text-sm font-black text-white">{formatCurrency(sp.total)}</span>
                            {sp.commissionPct > 0 ? (
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/20 rounded px-1.5 py-0.5">
                                {sp.commissionPct}% prof → {formatCurrency(sp.commissionAmount)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                                100% barbearia
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-between text-xs text-white/60">
                      <span>Líquido barbearia (produtos)</span>
                      <span className="font-bold text-emerald-300">{formatCurrency(dayProductsNet)}</span>
                    </div>
                  </div>
                )}

                <div className="border border-white/10 rounded-xl p-3 bg-white/[0.03]">
                  <p className="text-xs font-semibold text-white/80 mb-2">Histórico de abertura (diário)</p>
                  {barbershopCashHistoryLoading ? (
                    <p className="text-xs text-white/60">Carregando historico...</p>
                  ) : barbershopCashHistory.length === 0 ? (
                    <p className="text-xs text-white/60">Nenhuma abertura registrada ainda.</p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {barbershopCashHistory.map((item) => {
                        const isSelectedDate = String(item.cash_date) === selectedDateIso;
                        return (
                          <button
                            key={`${item.cash_date}-${item.updated_at || ''}`}
                            type="button"
                            onClick={() => {
                              setBarbershopCashOpeningInput(String(item.opening_amount || 0));
                              if (isSelectedDate) {
                                setBarbershopCashOpeningValue(Number(item.opening_amount || 0));
                              }
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${isSelectedDate
                              ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
                              : 'bg-white/5 hover:bg-white/10 text-white/80'
                              }`}
                            title="Clique para reutilizar esse valor no campo"
                          >
                            <span className="font-semibold">{formatDateSafe(`${item.cash_date || ''}T00:00:00`)}</span>
                            <span className="ml-2">{formatCurrency(Number(item.opening_amount || 0))}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-white/10 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBarbershopCashModal(false)}
                  className="flex-1 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium py-3 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Modal de Informações sobre Lembretes */}
        {showReminderInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowReminderInfo(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
                <h2 className="text-2xl font-bold">💡 Dica Importante</h2>
                <button
                  onClick={() => setShowReminderInfo(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-700 text-base leading-relaxed">
                  Você pode reforçar a presença do seu cliente e evitar esquecimentos! ✂️
                </p>

                <p className="text-gray-700 text-base leading-relaxed">
                  Caso ele não tenha ativado as notificações automáticas, basta clicar em <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded font-semibold">"Enviar lembrete"</span> dentro do agendamento. 📅
                </p>

                <p className="text-gray-700 text-base leading-relaxed">
                  Assim, o sistema envia uma mensagem completa no WhatsApp do cliente, com todas as informações do agendamento — horário, serviço e profissional — pra ele não esquecer de comparecer. 🕒
                </p>

                <div className="bg-gray-100 border-l-4 border-gray-600 p-4 rounded-r-lg">
                  <p className="text-gray-800 text-sm leading-relaxed">
                    <strong>💬💈 Dica profissional:</strong> Muitos barbeiros usam esse recurso no dia dos atendimentos para lembrar todos os clientes de forma rápida e prática!
                  </p>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t">
                <button
                  onClick={() => setShowReminderInfo(false)}
                  className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal da Legenda */}
        {showColorLegend && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowColorLegend(null)}>
            <div className="bg-gray-800 p-6 rounded-lg max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center ${showColorLegend === 'red' ? 'bg-red-600' :
                  showColorLegend === 'yellow' ? 'bg-yellow-600' :
                    showColorLegend === 'gold' ? 'bg-gradient-to-br from-amber-500 to-yellow-600' :
                    'bg-green-600'
                  }`}>
                  {showColorLegend === 'red' && <span className="text-white text-2xl">❌</span>}
                  {showColorLegend === 'yellow' && <span className="text-white text-2xl">⏳</span>}
                  {showColorLegend === 'green' && <span className="text-white text-2xl">✅</span>}
                  {showColorLegend === 'gold' && <span className="text-white text-2xl">👑</span>}
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  {showColorLegend === 'red' ? 'Agendamentos Cancelados' :
                    showColorLegend === 'yellow' ? 'Clientes que ainda não pagaram' :
                      showColorLegend === 'gold' ? 'Faixa dourada = Assinante' :
                      'Agendamentos Concluídos ou Pagos'}
                </h3>

                <p className="text-gray-300 mb-4">
                  {showColorLegend === 'red' ? 'Agendamentos que foram cancelados pelo cliente ou estabelecimento.' :
                    showColorLegend === 'yellow' ? 'Agendamentos agendados mas ainda não realizados ou pagos.' :
                      showColorLegend === 'gold'
                        ? 'Card verde = concluído (igual avulso). A faixa dourada no nome mostra que é assinante 👑. Quando atendido, aparece o selo verde “Assinante atendido ✓”.'
                        : 'Agendamentos concluídos com sucesso (verde). Assinante também fica verde — veja a faixa dourada no nome.'}
                </p>

                <button
                  onClick={() => setShowColorLegend(null)}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors font-medium"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Modal de Aviso sobre Pendentes */}
        {showPendingWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowPendingWarning(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold mb-1">⚠️ Como contabilizar valores</h2>
                </div>
                <button
                  onClick={() => setShowPendingWarning(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-gray-700 text-base leading-relaxed">
                  Coloque seu agendamento como <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded font-semibold">concluído</span>, para o dashboard reconhecer que você recebeu o valor de fato.
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-b-2xl border-t">
                <button
                  onClick={() => setShowPendingWarning(false)}
                  className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Pendentes do mês */}
        {showMonthPendingModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowMonthPendingModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-yellow-700 to-yellow-800 text-white p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">⏳ Pendentes do mês</h2>
                  <p className="text-xs text-yellow-100">
                    {format(selectedDate, 'MM/yyyy')}
                  </p>
                </div>
                <button
                  onClick={() => setShowMonthPendingModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {!isLoadingMonthPending && (
                  <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Filtrar por dia (opcional)
                        </label>
                        <input
                          type="date"
                          value={monthPendingFilterDate}
                          onChange={(e) => setMonthPendingFilterDate(e.target.value)}
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMonthPendingFilterDate(selectedDateIso)}
                          className="px-2 py-1.5 text-xs font-semibold rounded-md border border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 transition-colors"
                        >
                          Usar dia da agenda
                        </button>
                        <button
                          type="button"
                          onClick={() => setMonthPendingFilterDate('')}
                          className="px-2 py-1.5 text-xs font-semibold rounded-md border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          Ver mês todo
                        </button>
                      </div>
                    </div>
                    {monthPendingFilterDate ? (
                      <p className="mt-2 text-[11px] text-gray-600">
                        Mostrando apenas: <strong>{monthPendingFilterDate.split('-').reverse().join('/')}</strong>
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-gray-600">
                        Mostrando todos os pendentes acumulados (dias anteriores ao dia selecionado).
                      </p>
                    )}
                  </div>
                )}
                {!isLoadingMonthPending && (
                  <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-2">
                    <div className="text-xs text-yellow-900 font-semibold">
                      Pendentes acumulados até a data atual: <strong>{monthPendingTotal}</strong>
                    </div>
                    <div className="mt-1 text-[11px] text-yellow-700">
                      Visíveis agora: <strong>{monthPendingVisibleTotal}</strong>
                    </div>
                  </div>
                )}
                {isLoadingMonthPending ? (
                  <div className="py-8 text-center text-gray-600">Carregando pendentes...</div>
                ) : monthPendingVisibleAppointments.length === 0 ? (
                  <div className="py-8 text-center text-gray-600">
                    {monthPendingFilterDate
                      ? 'Nenhum agendamento pendente nesse dia.'
                      : 'Nenhum agendamento pendente acumulado nos dias anteriores.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {monthPendingVisibleAppointments.map((apt) => (
                      <div key={`month-pending-${apt.id}`} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-gray-900 truncate">
                              {String(getDisplayedClientName(apt) || apt.client_name || 'Cliente')}
                            </div>
                            <div className="text-xs text-gray-700 truncate">{getDisplayedService(apt)}</div>
                            <div className="text-[11px] text-gray-600">
                              {String(apt.appointment_date || '').slice(0, 10).split('-').reverse().join('/')} às {apt.appointment_time} • {getProfessionalName(String(apt.professional || ''))}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs font-bold text-yellow-700">
                              {apt.status === 'confirmed' ? 'CONFIRMADO' : 'PENDENTE'}
                            </div>
                            <div className="text-xs text-gray-700 font-semibold">
                              {formatCurrency(calculateTotalPrice(apt))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {showStatusDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowStatusDetailsModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className={`text-white p-4 flex items-center justify-between ${statusDetailsType === 'completed'
                ? 'bg-gradient-to-r from-green-700 to-green-800'
                : 'bg-gradient-to-r from-yellow-700 to-yellow-800'
                }`}>
                <div>
                  <h2 className="text-lg font-bold">
                    {statusDetailsType === 'completed' ? '✅ Histórico de concluídos' : '⏳ Histórico de pendentes'}
                  </h2>
                  <p className={`text-xs ${statusDetailsType === 'completed' ? 'text-green-100' : 'text-yellow-100'}`}>
                    {statusDetailsProfessionalName || 'Profissional'} • {String(statusDetailsDate || '').split('-').reverse().join('/')}
                  </p>
                </div>
                <button
                  onClick={() => setShowStatusDetailsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {statusDetailsRows.length === 0 ? (
                  <div className="py-8 text-center text-gray-600">
                    {statusDetailsType === 'completed'
                      ? 'Nenhum agendamento concluído nesse dia para este profissional.'
                      : 'Nenhum agendamento pendente nesse dia para este profissional.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {statusDetailsRows.map((apt) => (
                      <div
                        key={`status-details-${statusDetailsType}-${apt.id}`}
                        className={`rounded-lg border p-3 ${statusDetailsType === 'completed'
                          ? 'border-green-200 bg-green-50'
                          : 'border-yellow-200 bg-yellow-50'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-gray-900 truncate">
                              {String(getDisplayedClientName(apt) || apt.client_name || 'Cliente')}
                            </div>
                            <div className="text-xs text-gray-700 truncate">{getDisplayedService(apt) || 'Serviço não informado'}</div>
                            <div className="text-[11px] text-gray-700 mt-1">
                              Data: {String(apt.appointment_date || '').slice(0, 10).split('-').reverse().join('/')} • Horário: {String(apt.appointment_time || '--:--')}
                            </div>
                            <div className="text-[11px] text-gray-700">
                              Origem: {getAppointmentOriginLabel(apt)}
                            </div>
                            <div className="text-[11px] text-gray-700">
                              Duração: {formatDuration(getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos))}
                            </div>
                            <div className="text-[11px] text-gray-700">
                              Agendado em: {formatAppointmentCreatedAt((apt as any)?.created_at)}
                            </div>
                            {apt.client_whatsapp && (
                              <div className="text-[11px] text-gray-700">
                                WhatsApp: {apt.client_whatsapp}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className={`text-[11px] font-bold ${statusDetailsType === 'completed' ? 'text-green-700' : 'text-yellow-700'}`}>
                              {apt.status === 'completed' ? 'CONCLUÍDO' : apt.status === 'confirmed' ? 'CONFIRMADO' : 'PENDENTE'}
                            </div>
                            <div className="text-xs text-gray-700">
                              Base: {formatCurrency(Number(apt.price || 0))}
                            </div>
                            <div className="text-xs font-semibold text-gray-900">
                              Total: {formatCurrency(calculateTotalPrice(apt))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {exclusiveLinkModalProfessional && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4"
            onClick={() => setExclusiveLinkModalProfessional(null)}
          >
            <div
              className="bg-[#161718] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Link exclusivo 🔗</h2>
                  <p className="text-sm text-[#E6C78B] font-semibold mt-1">
                    {exclusiveLinkModalProfessional.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExclusiveLinkModalProfessional(null)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/80"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-white/80 leading-relaxed">
                É o <strong className="text-white">mesmo booking</strong> da barbearia, só que quando o cliente entra por
                este link ele <strong className="text-white">só vê você</strong> na hora de agendar — os outros profissionais
                não aparecem.
              </p>
              <p className="text-sm text-white/70 mt-3 leading-relaxed">
                Perfeito para divulgar no Instagram ou WhatsApp sem medo do cliente agendar com outro barbeiro. 💈
              </p>

              <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/50 mb-1">Seu link</p>
                <p className="text-xs text-white/90 break-all">
                  {buildExclusiveProfessionalBookingLink(
                    String(establishment?.code || ''),
                    String(exclusiveLinkModalProfessional.id || '')
                  )}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExclusiveLinkModalProfessional(null)}
                  className="px-3 py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/15 text-sm font-semibold"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const establishmentCode = String(establishment?.code || '').trim();
                    const professionalId = String(exclusiveLinkModalProfessional.id || '').trim();
                    if (!establishmentCode || !professionalId) {
                      toast('Não foi possível gerar o link exclusivo.', 'error');
                      return;
                    }
                    const link = buildExclusiveProfessionalBookingLink(establishmentCode, professionalId);
                    try {
                      await navigator.clipboard.writeText(link);
                      toast(`Link de ${exclusiveLinkModalProfessional.name} copiado!`, 'success');
                    } catch {
                      toast('Não foi possível copiar. Tente novamente.', 'error');
                    }
                  }}
                  className="px-3 py-2.5 rounded-lg bg-[#E6C78B] text-black hover:bg-[#f3e7c7] text-sm font-extrabold"
                >
                  Copiar link
                </button>
              </div>
            </div>
          </div>
        )}

        {showCancelledHistoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowCancelledHistoryModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-red-700 to-red-800 text-white p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">❌ Histórico de cancelados</h2>
                  <p className="text-xs text-red-100">
                    {cancelledHistoryProfessionalName || 'Profissional'} • {String(cancelledHistoryDate || '').split('-').reverse().join('/')}
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelledHistoryModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {cancelledHistoryRows.length === 0 ? (
                  <div className="py-8 text-center text-gray-600">
                    Nenhum agendamento cancelado nesse dia para este profissional.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cancelledHistoryRows.map((apt) => {
                      const cancellationActor = getCancellationActorInfo(apt);
                      const cancellationToneClass =
                        cancellationActor.tone === 'client'
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : cancellationActor.tone === 'internal'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : cancellationActor.tone === 'system'
                              ? 'border-purple-200 bg-purple-50 text-purple-800'
                              : 'border-gray-200 bg-gray-50 text-gray-700';

                      return (
                        <div key={`cancelled-history-${apt.id}`} className="rounded-lg border border-red-200 p-3 bg-red-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-extrabold text-gray-900 truncate">
                                {String(getDisplayedClientName(apt) || apt.client_name || 'Cliente')}
                              </div>
                              <div className="text-xs text-gray-700 truncate">{getDisplayedService(apt) || 'Serviço não informado'}</div>
                              <div className={`mt-2 inline-flex max-w-full items-center rounded-md border px-2 py-1 text-[11px] font-extrabold ${cancellationToneClass}`}>
                                Quem cancelou: {cancellationActor.label}
                              </div>
                              <div className="text-[11px] text-gray-700 mt-1">
                                Data: {String(apt.appointment_date || '').slice(0, 10).split('-').reverse().join('/')} • Horário: {String(apt.appointment_time || '--:--')}
                              </div>
                              <div className="text-[11px] text-gray-700">
                                Origem do agendamento: {getAppointmentOriginLabel(apt)}
                              </div>
                              <div className="text-[11px] text-gray-700">
                                Duração: {formatDuration(getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos))}
                              </div>
                              <div className="text-[11px] text-gray-700">
                                Agendado em: {formatAppointmentCreatedAt((apt as any)?.created_at)}
                              </div>
                              {apt.client_whatsapp && (
                                <div className="text-[11px] text-gray-700">
                                  WhatsApp: {apt.client_whatsapp}
                                </div>
                              )}
                              {apt.payment_method && (
                                <div className="text-[11px] text-gray-700">
                                  Forma de PG: {String(apt.payment_method)}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`text-[11px] font-bold ${isClientNoShowCancellation(apt) ? 'text-orange-700' : 'text-red-700'}`}>
                                {isClientNoShowCancellation(apt) ? 'AUSENTE (FALTA)' : 'CANCELADO'}
                              </div>
                              <div className="text-xs text-gray-700">
                                Base: {formatCurrency(Number(apt.price || 0))}
                              </div>
                              <div className="text-xs font-semibold text-gray-900">
                                Total: {formatCurrency(calculateTotalPrice(apt))}
                              </div>
                              {apt.cancellation_detail ? (
                                <div className="mt-1 text-[10px] text-gray-600 max-w-[170px] whitespace-normal break-words">
                                  Detalhe: {String(apt.cancellation_detail)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Layout Horizontal Scrollável - MOBILE E DESKTOP */}
        {/* Modo claro: caixa branca. Modo escuro: transparente (deixa o fundo escuro geral aparecer). */}
        <div className={`rounded-lg overflow-hidden md:mt-0 ${useLightLayout ? 'bg-white border border-gray-200' : 'bg-transparent'}`}>
          <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
            <div
              className="grid gap-3 w-full"
              style={{
                gridTemplateColumns: `repeat(${Math.max(visibleProfessionals.length, 1)}, minmax(280px, 1fr))`,
                minWidth: `${Math.max(visibleProfessionals.length, 1) * 292}px`,
              }}
            >
              {visibleProfessionals.map((professional, index) => {
                const appointmentsLocked = isAppointmentsLockedForProfessional(professional);
                const financialLocked = isFinancialLockedForProfessional(professional);
                const timeSlots = generateTimeSlotsWithAppointments(professional);
                const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                const isProfessionalAbsentOnSelectedDate = ((professional as any)?.absences as string[] | undefined)?.includes(selectedDateStr) ?? false;
                const slotTimeSet = new Set(timeSlots.map((s) => s.time));

                // ✅ Agendamentos com horário "picado" (fora do intervalo), que não entram na grade
                const hiddenAppointments = appointments
                  .filter((apt) =>
                    appointmentBelongsToProfessionalColumn(apt, professional) &&
                    apt.appointment_date === selectedDateStr &&
                    apt.status !== 'cancelled' &&
                    !slotTimeSet.has(String(apt.appointment_time || '').trim())
                  )
                  .sort((a, b) =>
                    parseTimeSafe(a.appointment_time, selectedDate).getTime() -
                    parseTimeSafe(b.appointment_time, selectedDate).getTime()
                  );

                // Contar TODOS os agendamentos do dia (sem depender da grade)
                const professionalAppointmentsCount = appointments.filter((apt) =>
                  appointmentBelongsToProfessionalColumn(apt, professional) &&
                  apt.appointment_date === selectedDateStr &&
                  apt.status !== 'cancelled'
                ).length;

                const pendingCount = appointments.filter((apt) =>
                  appointmentBelongsToProfessionalColumn(apt, professional) &&
                  apt.appointment_date === selectedDateStr &&
                  (apt.status === 'pending' || apt.status === 'confirmed')
                ).length;

                const pendingAppointments = appointments
                  .filter((apt) =>
                    appointmentBelongsToProfessionalColumn(apt, professional) &&
                    apt.appointment_date === selectedDateStr &&
                    (apt.status === 'pending' || apt.status === 'confirmed')
                  )
                  .sort((a, b) =>
                    parseTimeSafe(a.appointment_time, selectedDate).getTime() -
                    parseTimeSafe(b.appointment_time, selectedDate).getTime()
                  );

                const completedCount = appointments.filter((apt) =>
                  appointmentBelongsToProfessionalColumn(apt, professional) &&
                  apt.appointment_date === selectedDateStr &&
                  apt.status === 'completed'
                ).length;

                const completedAppointments = appointments
                  .filter((apt) =>
                    appointmentBelongsToProfessionalColumn(apt, professional) &&
                    apt.appointment_date === selectedDateStr &&
                    apt.status === 'completed'
                  )
                  .sort((a, b) =>
                    parseTimeSafe(a.appointment_time, selectedDate).getTime() -
                    parseTimeSafe(b.appointment_time, selectedDate).getTime()
                  );

                const cancelledAppointments = appointments
                  .filter((apt) =>
                    appointmentBelongsToProfessionalColumn(apt, professional) &&
                    apt.appointment_date === selectedDateStr &&
                    apt.status === 'cancelled'
                  )
                  .sort((a, b) =>
                    parseTimeSafe(a.appointment_time, selectedDate).getTime() -
                    parseTimeSafe(b.appointment_time, selectedDate).getTime()
                  );

                const cancelledCount = cancelledAppointments.length;
                const openFinancialModal = () => {
                  if (financialLocked) {
                    onRequestFinancialUnlock?.(professional.id);
                    return;
                  }
                  setSelectedProfessionalForInfo(professional.id);
                  const prevMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1);
                  setModalViewingMonth(prevMonth);
                  setPastMonthPendingForModal(null);
                  setPastMonthValidPaidForModal(null);
                };
                const openAvailabilityModal = () => {
                  if (appointmentsLocked) {
                    onRequestAppointmentsUnlock?.(professional.id);
                    return;
                  }
                  setAvailabilityProfessionalId(professional.id);
                  setAvailabilityProfessionalName(professional.name);
                  setAvailabilitySlots(timeSlots);
                  setShowAvailabilityModal(true);
                };
                const sideActionButtonClass = useLightLayout
                  ? 'w-full min-h-[64px] md:min-h-[40px] px-2.5 py-2 md:py-1 text-xs font-bold rounded-xl transition-colors text-white bg-[#17191f] hover:bg-[#1f222a] border border-white/10'
                  : 'w-full min-h-[64px] md:min-h-[40px] px-2.5 py-2 md:py-1 text-xs font-bold rounded-xl transition-colors text-white bg-[#17191f] hover:bg-[#1f222a] border border-white/10';
                const actionCardButtonClass = useLightLayout
                  ? 'w-full min-h-[64px] md:min-h-[40px] px-3 py-2 md:py-1 rounded-xl transition-colors text-white bg-[#17191f] hover:bg-[#1f222a] border border-white/10 active:scale-[0.98]'
                  : 'w-full min-h-[64px] md:min-h-[40px] px-3 py-2 md:py-1 rounded-xl transition-colors text-white bg-[#17191f] hover:bg-[#1f222a] border border-white/10 active:scale-[0.98]';
                const statusCardButtonClass = 'w-full min-h-[44px] md:min-h-[30px] px-2 py-1.5 md:py-1 rounded-xl border text-white transition-colors';

                const hiddenOpen =
                  hiddenAppointments.length > 0 &&
                  (hiddenAppointmentsOpenByProfessional[professional.id] ?? true);

                return (
                  <div
                    key={professional.id}
                    data-professional-column-id={professional.id}
                    data-tutorial-id="appointments-professional-area"
                    className="px-1.5 pb-3 min-w-0"
                  >
                    {/* Cabeçalho do Profissional + opções individuais */}
                    <div className={`p-1.5 md:p-2 sticky top-0 z-10 ${useLightLayout
                      ? 'bg-white border border-gray-300 border-b-0 rounded-t-xl'
                      : 'bg-[#121419] border border-white/10 border-b-0 rounded-t-xl'
                      }`}>
                      <div className="flex flex-col items-center w-full">
                        <div className="w-full flex items-center gap-2 md:gap-3">
                          <button
                            onClick={() => setSelectedProfessionalForPhotoModal(professional.id)}
                            className="group relative shrink-0"
                            title="Ver e alterar foto do profissional"
                          >
                            {professional.photo_url ? (
                              <img
                                src={professional.photo_url}
                                alt={professional.name}
                                className={`w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 group-hover:scale-105 transition-transform cursor-pointer ${useLightLayout ? 'border-gray-300' : 'border-slate-500'
                                  }`}
                              />
                            ) : (
                              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-full bg-white flex items-center justify-center text-xl md:text-2xl border-2 group-hover:scale-105 transition-transform cursor-pointer ${useLightLayout ? 'border-gray-300' : 'border-slate-500'
                                }`}>
                                👤
                              </div>
                            )}
                            <div className={`absolute inset-0 rounded-full transition-colors flex items-center justify-center ${useLightLayout
                              ? 'bg-black/0 group-hover:bg-gray-300/20'
                              : 'bg-black/0 group-hover:bg-white/20'
                              }`}>
                              <span className={`opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold ${useLightLayout ? 'text-gray-900' : 'text-white'
                                }`}>
                                abrir
                              </span>
                            </div>
                          </button>
                          <div className="flex-1 px-1 md:px-3 py-1 md:py-2 text-center min-w-0">
                            <h3 className={`font-bold text-sm md:text-base leading-tight truncate ${useLightLayout ? 'text-gray-900' : 'text-white'}`}>
                              {professional.name}
                            </h3>
                            <p className={`text-[11px] md:text-xs mt-0.5 md:mt-1 ${useLightLayout ? 'text-gray-600' : 'text-gray-300'}`}>
                              {appointmentsLocked ? 'agenda protegida' : `${professionalAppointmentsCount} agendamentos`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleProfessionalMenu(professional.id)}
                          className="w-full mt-1 mb-1 text-[11px] font-semibold text-gray-400 hover:text-gray-200 transition-colors py-1 border border-gray-700/50 rounded-lg"
                        >
                          {collapsedMenuProfessionals.has(professional.id) ? '▼ Abrir menu' : '▲ Recolher menu'}
                        </button>
                        {!collapsedMenuProfessionals.has(professional.id) && (
                        <>
                        <div className="w-full grid grid-cols-2 gap-2 mt-2">
                          {onGoToClients && (
                            <button
                              onClick={() => onGoToClients(professional.id)}
                              data-tutorial-id="appointments-criar-reserva"
                              className={sideActionButtonClass}
                              title="Ir para Meus Clientes"
                            >
                              <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                                <UserPlus className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                                <span className="text-xs font-bold mt-1 md:mt-0">Agendar cliente</span>
                              </span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (appointmentsLocked) {
                                onRequestAppointmentsUnlock?.(professional.id);
                                return;
                              }
                              setSelectedProfessionalForSqueeze(professional.id);
                              setShowSqueezeServiceModal(true);
                            }}
                            data-tutorial-id="appointments-criar-encaixe"
                            className={sideActionButtonClass}
                            title="Criar Encaixe"
                            disabled={appointmentsLocked}
                          >
                            <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                              {appointmentsLocked ? (
                                <Lock className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                              ) : (
                                <Plus className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                              )}
                              <span className="text-xs font-bold mt-1 md:mt-0">
                                {appointmentsLocked ? 'Agenda protegida' : 'Criar encaixe'}
                              </span>
                            </span>
                          </button>

                          {onOpenBlockHoursModal && (
                            <button
                              onClick={() => onOpenBlockHoursModal(professional.id)}
                              data-tutorial-id="appointments-bloquear-horarios"
                              className={`${actionCardButtonClass}`}
                              title="Bloquear horários deste profissional"
                              disabled={appointmentsLocked}
                            >
                              <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                                <Lock className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                                <span className="text-xs font-bold mt-1 md:mt-0">
                                  {appointmentsLocked ? 'Agenda protegida' : 'Bloquear horários'}
                                </span>
                              </span>
                            </button>
                          )}
                          {onOpenAbsenceModal && (
                            <button
                              onClick={() => onOpenAbsenceModal(professional.id)}
                              data-tutorial-id="appointments-ausencia"
                              className={`${actionCardButtonClass}`}
                              title="Configurar dias de ausência deste profissional"
                              disabled={appointmentsLocked}
                            >
                              <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                                <Calendar className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                                <span className="text-xs font-bold mt-1 md:mt-0">
                                  {appointmentsLocked ? 'Agenda protegida' : 'Bloquear dia inteiro'}
                                </span>
                              </span>
                            </button>
                          )}

                          {onOpenQuickSubscriberModal && (
                            <button
                              onClick={() => {
                                if (appointmentsLocked) {
                                  onRequestAppointmentsUnlock?.(professional.id);
                                  return;
                                }
                                onOpenQuickSubscriberModal(professional.id);
                              }}
                              className={`${actionCardButtonClass}`}
                              title="Cadastrar Assinante"
                              disabled={appointmentsLocked}
                            >
                              <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                                {appointmentsLocked ? (
                                  <Lock className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                                ) : (
                                  <Users className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                                )}
                                <span className="text-xs font-bold mt-1 md:mt-0">
                                  {appointmentsLocked ? 'Agenda protegida' : 'Cadastrar assinante'}
                                </span>
                              </span>
                            </button>
                          )}

                          <button
                            onClick={openAvailabilityModal}
                            className={`${actionCardButtonClass}`}
                            title="Ver horários disponíveis (somente visualização)"
                            disabled={appointmentsLocked}
                          >
                            <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                              <Calendar className="w-4 h-4 md:w-3 md:h-3 text-white/90" />
                              <span className="text-xs font-bold mt-1 md:mt-0">
                                {appointmentsLocked ? 'Agenda protegida' : 'Horários disponíveis'}
                              </span>
                            </span>
                          </button>

                          <button
                            onClick={openFinancialModal}
                            data-tutorial-id="appointments-financeiro"
                            className={`${actionCardButtonClass} col-span-2`}
                            title="Abrir financeiro do profissional"
                          >
                            <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                              <Coins className="w-4 h-4 md:w-3 md:h-3 mb-1 md:mb-0 text-white/90" />
                              <span>Financeiro / desempenho</span>
                              {financialLocked && <span className="text-[10px] opacity-90">desbloquear</span>}
                            </span>
                          </button>

                          {onOpenSellProduct && (
                            <button
                              onClick={() => {
                                if (appointmentsLocked) {
                                  onRequestAppointmentsUnlock?.(professional.id);
                                  return;
                                }
                                onOpenSellProduct(String(professional.id), String(professional.name || ''));
                              }}
                              className={`${actionCardButtonClass} col-span-2`}
                              title="Vender produto avulso (sem agendamento) para este profissional"
                              disabled={appointmentsLocked}
                            >
                              <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                                {appointmentsLocked ? (
                                  <Lock className="w-4 h-4 md:w-3 md:h-3 mb-1 md:mb-0 text-white/90" />
                                ) : (
                                  <Package className="w-4 h-4 md:w-3 md:h-3 mb-1 md:mb-0 text-white/90" />
                                )}
                                <span>{appointmentsLocked ? 'Agenda protegida' : 'Vender produto'}</span>
                              </span>
                            </button>
                          )}
                        </div>

                        {isExclusiveBookingLinkEnabledForProfessional(professional) && (
                          <button
                            type="button"
                            onClick={() => setExclusiveLinkModalProfessional(professional)}
                            className="mt-2 w-full text-center text-xs font-semibold text-[#E6C78B] hover:text-[#f3e7c7] transition-colors underline underline-offset-2"
                            title="Abrir explicação e copiar link exclusivo"
                          >
                            ( link exclusivo )
                          </button>
                        )}

                        {/* Contadores de Status por Profissional */}
                        <div className="mt-2 md:mt-1.5 grid grid-cols-3 gap-1.5 md:gap-1.5 text-xs w-full">
                          <button
                            type="button"
                            onClick={() => {
                              if (appointmentsLocked) {
                                onRequestAppointmentsUnlock?.(professional.id);
                                return;
                              }
                              setCancelledHistoryRows(cancelledAppointments);
                              setCancelledHistoryProfessionalName(professional.name);
                              setCancelledHistoryDate(selectedDateStr);
                              setShowCancelledHistoryModal(true);
                            }}
                            className={`${statusCardButtonClass} bg-red-700/90 border-red-800 hover:bg-red-700`}
                            title="Ver histórico de cancelados deste profissional no dia"
                          >
                            <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                              {appointmentsLocked ? (
                                <Lock className="w-4 h-4 md:w-3 md:h-3 text-white/95" />
                              ) : (
                                <X className="w-4 h-4 md:w-3 md:h-3 text-white/95" />
                              )}
                              <span className="text-[11px] font-bold mt-0.5 md:mt-0">{appointmentsLocked ? '-' : cancelledCount}</span>
                              <span className="text-[10px] opacity-90">Cancelados</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (appointmentsLocked) {
                                onRequestAppointmentsUnlock?.(professional.id);
                                return;
                              }
                              setStatusDetailsRows(pendingAppointments);
                              setStatusDetailsType('pending');
                              setStatusDetailsProfessionalName(professional.name);
                              setStatusDetailsDate(selectedDateStr);
                              setShowStatusDetailsModal(true);
                            }}
                            className={`${statusCardButtonClass} bg-yellow-700/90 border-yellow-800 hover:bg-yellow-700`}
                            title="Ver agendamentos pendentes deste profissional no dia"
                          >
                            <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                              {appointmentsLocked ? (
                                <Lock className="w-4 h-4 md:w-3 md:h-3 text-white/95" />
                              ) : (
                                <Clock className="w-4 h-4 md:w-3 md:h-3 text-white/95" />
                              )}
                              <span className="text-[11px] font-bold mt-0.5 md:mt-0">{appointmentsLocked ? '-' : pendingCount}</span>
                              <span className="text-[10px] opacity-90">Pendentes</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (appointmentsLocked) {
                                onRequestAppointmentsUnlock?.(professional.id);
                                return;
                              }
                              setStatusDetailsRows(completedAppointments);
                              setStatusDetailsType('completed');
                              setStatusDetailsProfessionalName(professional.name);
                              setStatusDetailsDate(selectedDateStr);
                              setShowStatusDetailsModal(true);
                            }}
                            className={`${statusCardButtonClass} bg-green-700/90 border-green-800 hover:bg-green-700`}
                            title="Ver agendamentos concluídos deste profissional no dia"
                          >
                            <span className="flex flex-col md:flex-row items-center justify-center md:gap-1.5 leading-tight">
                              {appointmentsLocked ? (
                                <Lock className="w-4 h-4 md:w-3 md:h-3 text-white/95" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 md:w-3 md:h-3 text-white/95" />
                              )}
                              <span className="text-[11px] font-bold mt-0.5 md:mt-0">{appointmentsLocked ? '-' : completedCount}</span>
                              <span className="text-[10px] opacity-90">Realizados</span>
                            </span>
                          </button>
                        </div>
                        <div className={`mt-2 w-full rounded-lg border px-3 py-1.5 text-center ${useLightLayout ? 'bg-gray-100 border-gray-300 text-gray-700' : 'bg-white/5 border-white/10 text-white/75'}`}>
                          <p className="text-[11px] font-semibold">
                            Clique no horário desejado, para interagir.
                          </p>
                        </div>
                        </> )} {/* fim do bloco recolhível */}

                        {/* Meta do Profissional */}
                        {professional.goal && professional.goal > 0 && (
                          <div className={`mt-2 px-2 py-1 rounded text-xs text-center ${useLightLayout
                            ? 'bg-gray-200 text-gray-900 border border-gray-300'
                            : 'bg-gray-800 text-white border border-gray-600'
                            }`}>
                            🎯 Meta: {formatCurrency(professional.goal)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Todos os Horários (Livres e Ocupados) */}
                    <div className={`p-1.5 md:p-2 min-h-0 md:min-h-[500px] rounded-b-xl border border-t-0 ${useLightLayout ? 'bg-gray-100 border-gray-300' : 'bg-[#121419] border-white/10'
                      }`}>
                      {appointmentsLocked ? (
                        <div className="rounded-lg border-2 border-amber-500/60 bg-amber-100 p-3 mb-2">
                          <p className="text-sm font-semibold text-amber-800 text-center">
                            Agenda protegida por senha do profissional.
                          </p>
                          <p className="text-xs text-amber-700 text-center mt-1">
                            Desbloqueie para ver, transferir ou cancelar agendamentos deste profissional.
                          </p>
                          <button
                            type="button"
                            onClick={() => onRequestAppointmentsUnlock?.(professional.id)}
                            className="mt-3 w-full px-3 py-2 rounded-md bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
                          >
                            Desbloquear agenda
                          </button>
                        </div>
                      ) : null}
                      <div className={`space-y-1 ${appointmentsLocked ? 'hidden' : ''}`}>
                        {timeSlots.length > 0 ? (
                          timeSlots.map((slot, slotIndex) => {
                            const slotColor = getSlotColor(slot);

                            if (slot.isBlocked) {
                              const blockBusy =
                                slotBlockBusyKey === `${professional.id}__${slot.time}`;
                              return (
                                <div
                                  key={`${slot.time}-${slotIndex}`}
                                  className="rounded-xl border-2 shadow-sm overflow-hidden bg-red-700/90 border-red-800"
                                >
                                  <div className="flex items-stretch gap-0 min-h-[48px]">
                                    <div className="flex-1 flex flex-col justify-center px-3 py-2.5 min-w-0">
                                      <span className="text-white font-extrabold text-base tracking-tight">
                                        {slot.time}
                                      </span>
                                      <span className="text-white/90 text-[11px] font-semibold mt-0.5">
                                        🔒 Bloqueado para clientes
                                      </span>
                                    </div>
                                    {onToggleProfessionalSlotBlocked ? (
                                      <button
                                        type="button"
                                        disabled={!!slotBlockBusyKey}
                                        onClick={() => runToggleSlotBlock(professional.id, slot.time, false)}
                                        className="shrink-0 px-3 py-2 text-xs font-bold text-white border-l border-white/25 transition-colors disabled:opacity-50 bg-red-700 hover:bg-red-800"
                                      >
                                        {blockBusy ? '…' : 'Desbloquear'}
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            } else if (slot.isEmpty) {
                              // Horário disponível (ou dia de ausência) - pode ter encaixes abaixo
                              const squeezes = (slot as any).squeezes || [];
                              const isAbsentSlot = isProfessionalAbsentOnSelectedDate;
                              const isPastSlot = !isAbsentSlot && !!slot.isPast;
                              const canQuickBlock = !!onToggleProfessionalSlotBlocked;
                              const dayBounds = getProfessionalDayEndAndBreak(
                                professional,
                                businessHours,
                                selectedDate
                              );
                              const maxReserveMinutes =
                                dayBounds && onOpenReserveFromSlot
                                  ? computeMaxReserveMinutesFromSlotGrid(
                                    timeSlots,
                                    slot.time,
                                    dayBounds.endTime,
                                    dayBounds.breakRange
                                  )
                                  : 0;
                              const dateKey = format(selectedDate, 'yyyy-MM-dd');
                              const showReservePill = !!onOpenReserveFromSlot;
                              const canOpenQuickAction =
                                (Boolean(canQuickBlock) || Boolean(showReservePill)) && !isAbsentSlot;
                              return (
                                <div key={`${slot.time}-${slotIndex}`}>
                                  <div
                                    onClick={() => {
                                      if (!canOpenQuickAction) return;
                                      setQuickSlotActionModal({
                                        professionalId: professional.id,
                                        professionalName: professional.name,
                                        time: slot.time,
                                        dateKey,
                                        maxReserveMinutes: Math.max(maxReserveMinutes, intervaloAgendaMinutos),
                                        canReserve: Boolean(showReservePill),
                                        canBlock: Boolean(canQuickBlock),
                                        isPast: Boolean(isPastSlot),
                                      });
                                    }}
                                    className={`rounded-xl border shadow-sm overflow-hidden flex items-stretch ${isPastSlot
                                      ? 'min-h-[36px] md:min-h-[26px] border-gray-300 bg-gray-200/80'
                                      : isAbsentSlot
                                        ? 'min-h-[44px] md:min-h-[38px] border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100/90'
                                        : 'min-h-[44px] md:min-h-[38px] border-2 border-emerald-300 bg-emerald-50'
                                      } ${canOpenQuickAction ? 'cursor-pointer' : ''}`}
                                  >
                                    <div className={`flex-1 min-w-0 ${isPastSlot
                                      ? 'flex items-center gap-2 px-3 py-1 md:py-0.5 md:px-2'
                                      : 'flex flex-col items-center justify-center text-center px-3 py-2.5 md:py-1 md:px-2'
                                    }`}>
                                      {isAbsentSlot ? (
                                        <>
                                          <span className="font-extrabold text-base md:text-[13px] tracking-tight text-amber-900">
                                            {slot.time}
                                          </span>
                                          <span className="text-[11px] md:text-[10px] font-bold mt-0.5 text-amber-800">
                                            📅 Ausência neste dia
                                          </span>
                                        </>
                                      ) : isPastSlot ? (
                                        <>
                                          <span className="font-bold text-xs md:text-[11px] text-gray-600 shrink-0">
                                            {slot.time}
                                          </span>
                                          <span className="text-[10px] md:text-[9px] text-gray-500">
                                            Já passou
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="font-extrabold text-base md:text-[14px] leading-tight tracking-tight text-emerald-800">
                                            {slot.time}
                                          </span>
                                          <span className="text-[11px] md:text-[10px] font-extrabold mt-0.5 text-emerald-800 uppercase">
                                            HORARIO LIVRE
                                          </span>
                                          <span className="text-[10px] font-semibold mt-0.5 text-emerald-700/80 md:hidden">
                                            Clique aqui
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {/* Exibir encaixes abaixo do horário */}
                                  {squeezes.map((squeeze: Appointment) => {
                                    const isExpanded = modalAptId === squeeze.id;
                                    return (
                                      <div
                                        key={squeeze.id}
                                        className="bg-gray-700 border-2 border-gray-600 rounded-lg mt-1 overflow-hidden"
                                      >
                                        <div className="px-3 py-2 md:py-1.5 md:px-2.5">
                                          <div
                                            onClick={() => toggleAppointmentExpansion(squeeze.id)}
                                            className="cursor-pointer"
                                          >
                                            <div className="flex items-center justify-between mb-1 md:mb-0.5">
                                              <span className="text-white font-bold text-sm md:text-xs">
                                                {squeeze.appointment_time} 🟣 {isAgendaSubscriberAppointment(squeeze) ? 'ENCAIXE ASSINANTE' : 'ENCAIXE'}
                                              </span>
                                              <span className="text-white text-xs font-bold">
                                                {displayCardMoney(calculateTotalPrice(squeeze))}
                                              </span>
                                            </div>
                                            <div className="text-white font-semibold text-sm md:text-xs mb-1 md:mb-0.5 truncate">
                                              {squeeze.service}
                                            </div>
                                            <div className="text-white/70 text-xs mt-1 md:mt-0">
                                              {getDuracaoTotalAgendamento(squeeze, intervaloAgendaMinutos)} min • Ver detalhes
                                            </div>
                                          </div>
                                        </div>
                                        {/* Versão expandida do encaixe */}
                                        {isExpanded && (
                                          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) setModalAptId(null); }}>
                                            <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl bg-[#1a1b1c] p-4" onClick={(e) => e.stopPropagation()}>
                                              <button onClick={() => setModalAptId(null)} className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold">×</button>
                                            <div className="mb-3">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-white font-semibold">
                                                  {isAgendaSubscriberAppointment(squeeze) ? 'ENCAIXE ASSINANTE' : 'ENCAIXE'}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="mb-3 text-xs text-white/90 space-y-1">
                                              <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDateSafe(squeeze.appointment_date)}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {squeeze.appointment_time} • {formatDuration(getDuracaoTotalAgendamento(squeeze, intervaloAgendaMinutos))}
                                              </div>
                                            </div>
                                            <div className="bg-white/10 rounded p-2 mb-3">
                                              <div className="space-y-1">
                                                <div className="text-sm font-bold text-white">
                                                  Cobrar do cliente: {formatCurrency(calculateTotalPrice(squeeze))}
                                                </div>
                                                <div className="text-xs text-white/80">
                                                  Valor do serviço (financeiro): {formatCurrency(calculateServiceTotal(squeeze))}
                                                </div>
                                              </div>
                                            </div>
                                            {/* Botões de ação para encaixe */}
                                            <div className="flex gap-2 mt-3">
                                              <button
                                                onClick={() => {
                                                  if (onCancelAppointment) {
                                                    onCancelAppointment(squeeze.id);
                                                  }
                                                }}
                                                className="flex-1 px-3 py-2 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors"
                                              >
                                                Cancelar
                                              </button>
                                              {onOpenTransferModal && (
                                                <button
                                                  onClick={() => onOpenTransferModal(squeeze)}
                                                  className="flex-1 px-3 py-2 bg-black text-white text-xs rounded hover:bg-gray-800 transition-colors"
                                                >
                                                  Transferir
                                                </button>
                                              )}
                                            </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } else if (slot.isOccupied && slot.parentAppointment) {
                              // Não renderizar slots intermediários ocupados por duração.
                              // Ex.: 16:40 ocupado por 30min -> não mostrar 16:45/17:00 no grid.
                              return null;
                            } else if (slot.appointment) {
                              // Agendamento real
                              const apt = slot.appointment;
                              const isExpanded = modalAptId === apt.id;
                              const serviceLabels = getAppointmentServiceLabels(apt);
                              const subscriptionLabelColor = getSubscriptionLabelColor(apt);
                              const contactOverride = appointmentContactById[apt.id] || {};
                              const displayedCpf = String(contactOverride.cpf || apt.client_cpf || '').replace(/\D/g, '');
                              const displayedStreet = String(contactOverride.street || (apt as any).client_street || '').trim();

                              return (
                                <div
                                  key={apt.id}
                                  className={`${slotColor} border rounded-lg overflow-hidden`}
                                >
                                  {/* Versão Compacta - Sempre visível */}
                                  <div className={(apt.status === 'completed' || apt.status === 'pending' || apt.status === 'confirmed') ? 'flex items-stretch' : ''}>
                                    {/* Faixa lateral esquerda de status (concluído / pendente) — conteúdo fica espremido à direita */}
                                    {(apt.status === 'completed' || apt.status === 'pending' || apt.status === 'confirmed') && (
                                      <div className="shrink-0 w-20 md:w-24 bg-black/25 border-r-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-0.5 px-1.5 text-center select-none leading-tight">
                                        <span className="text-[11px] md:text-xs font-extrabold text-white">Serviço</span>
                                        <span className="text-[11px] md:text-xs font-extrabold text-white">{apt.status === 'completed' ? 'concluído' : 'em espera'}</span>
                                        <span className="text-xl md:text-2xl leading-none mt-0.5">{apt.status === 'completed' ? '✅' : '⏳'}</span>
                                      </div>
                                    )}
                                    <div className="px-2.5 py-2 md:py-1.5 flex-1 min-w-0">
                                    <div
                                      onClick={() => toggleAppointmentExpansion(apt.id)}
                                      data-tutorial-id="appointments-detalhes-agendamento"
                                      className="cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between mb-1 md:mb-0.5">
                                        <span className="text-white font-bold text-sm md:text-xs">
                                          {apt.is_squeeze ? apt.appointment_time : slot.time}{' '}
                                          {apt.is_squeeze && '🟣'}
                                          {apt.is_squeeze && apt.status === 'completed' && (
                                            <span className="ml-1" title="Encaixe concluído">
                                              ✅
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-white text-xs font-bold">
                                          {displayCardMoney(calculateTotalPrice(apt))}
                                        </span>
                                      </div>
                                      {renderAppointmentClientNameRow(apt, serviceLabels, { variant: 'compact' })}
                                      {(() => {
                                        if (!returningClientPhones) return null; // ainda carregando
                                        if (apt.status === 'cancelled') return null;
                                        if (isAgendaSubscriberAppointment(apt)) return null;
                                        let phone = String(apt.client_whatsapp || '').replace(/\D/g, '');
                                        if (!phone) return null;
                                        while (phone.startsWith('55') && phone.length > 11) phone = phone.slice(2);
                                        if (returningClientPhones.has(phone) || returningClientPhones.has('55' + phone)) return null;
                                        return (
                                          <div className="mb-1">
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white">
                                              🆕 PRIMEIRO AGENDAMENTO
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <div className="text-white/90 text-xs truncate">
                                        {subscriptionLabelColor && (
                                          <span
                                            className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle border border-white/70"
                                            style={{ backgroundColor: subscriptionLabelColor }}
                                            title="Etiqueta da assinatura"
                                          />
                                        )}
                                        {getDisplayedService(apt)}
                                      </div>
                                      {/* Breakdown de pagamento online — só mostra quando houve pagamento online com 50% */}
                                      {(() => {
                                        const pm = String(apt.payment_method || '').toLowerCase();
                                        const isOnlineMethod = pm === 'pix' || pm === 'credito' || pm === 'debito';
                                        // Evidência REAL de pagamento online (como o webhook grava ao aprovar):
                                        // payment_status='paid', transação registrada ou PIX aprovado/confirmado.
                                        // payment_method sozinho NÃO prova pagamento — ele também guarda como o
                                        // cliente pretende pagar NO LOCAL (mostrava "Pago online" sem pagamento).
                                        const pixSt = String((apt as any).pix_payment_status || '').toLowerCase();
                                        const hasRealOnlinePayment =
                                          String((apt as any).payment_status || '').toLowerCase() === 'paid' ||
                                          Boolean(String((apt as any).payment_transaction_id || '').trim()) ||
                                          pixSt === 'aprovado' || pixSt === 'approved' || pixSt === 'confirmado';
                                        const isPaidOnline = isOnlineMethod && hasRealOnlinePayment;
                                        const advPercent = (establishment as any)?.advance_payment_percentage;
                                        const is50 = advPercent === 50;
                                        const totalPrice = calculateTotalPrice(apt);

                                        if (isPaidOnline && (apt.status === 'confirmed' || apt.status === 'completed')) {
                                          const paidOnline = is50 ? Math.round(totalPrice * 0.5) : totalPrice;
                                          const remaining = totalPrice - paidOnline;
                                          return (
                                            <div className="text-[10px] mt-1 space-y-0.5">
                                              <div className="flex justify-between text-emerald-300">
                                                <span>💳 Pago online:</span>
                                                <span className="font-bold">{displayCardMoney(paidOnline)}</span>
                                              </div>
                                              {remaining > 0 ? (
                                                <div className="flex justify-between text-amber-300">
                                                  <span>🏪 Restante no salão:</span>
                                                  <span className="font-bold">{displayCardMoney(remaining)}</span>
                                                </div>
                                              ) : (
                                                <div className="flex justify-between text-emerald-400">
                                                  <span>✅ Pago integralmente online</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}

                                      <div className="text-white/70 text-xs mt-1 md:mt-0.5 flex items-center justify-between gap-1">
                                        <span>{getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos)} min • Ver detalhes</span>
                                        {/* Concluído e Pendente agora são a faixa lateral esquerda do card (não mais selo aqui dentro) */}
                                        {apt.status === 'pending_payment' && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/40 text-purple-100 shrink-0">
                                            💳 AGUARDANDO PAGAMENTO
                                          </span>
                                        )}
                                        {apt.status === 'cancelled' && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/40 text-white shrink-0">
                                            ❌ CANCELADO
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* 💳 COBRAR CLIENTE — PIX de balcão, só para atendimento
                                        SEM pagamento online. Não altera o agendamento. */}
                                    {!isExpanded && apt.status !== 'cancelled' && canChargeAppointmentLocally?.(apt) && (
                                      <div className="mt-2 pt-2 md:mt-1 md:pt-1 border-t border-white/20">
                                        {localChargesByAppointment?.[apt.id]?.status === 'paid' ? (
                                          <div className="w-full px-2 py-1.5 md:py-1 text-[11px] font-bold rounded bg-emerald-600 text-white text-center leading-tight">
                                            ✅ Pago no local via PIX
                                          </div>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onChargeClient?.(apt);
                                            }}
                                            className="w-full px-2 py-1.5 md:py-1 text-[11px] font-extrabold rounded transition-colors bg-emerald-500 text-black hover:bg-emerald-400 leading-tight"
                                            title="Gerar um PIX na hora para o cliente pagar"
                                          >
                                            💳 COBRAR CLIENTE
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Botão Enviar Lembrete - Aparece quando NÃO expandido */}
                                    {!isExpanded && apt.status !== 'cancelled' && (
                                      <div className="mt-2 pt-2 md:mt-1 md:pt-1 border-t border-white/20 grid grid-cols-2 gap-1.5 md:gap-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenReminderModal) onOpenReminderModal(apt);
                                          }}
                                          className="px-1.5 py-1.5 md:py-0.5 text-[10px] font-medium rounded transition-colors bg-black text-white hover:bg-gray-800 leading-tight"
                                          title="Enviar lembrete via WhatsApp"
                                        >
                                          📱 Enviar lembrete
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onSendThankYou) onSendThankYou(apt);
                                          }}
                                          className="px-1.5 py-1.5 md:py-0.5 text-[10px] font-medium rounded transition-colors bg-[#E6C78B] text-black hover:bg-[#f3e7c7] leading-tight"
                                          title="Enviar agradecimento e pedir avaliação via WhatsApp"
                                        >
                                          ⭐ Enviar agradecimento
                                        </button>
                                      </div>
                                    )}
                                    </div>
                                  </div>

                                  {/* Versão Expandida - Popup modal centrado */}
                                  {isExpanded && (
                                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70" onClick={(e) => { if (e.target === e.currentTarget) setModalAptId(null); }}>
                                      <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl bg-[#1a1b1c] p-4" onClick={(e) => e.stopPropagation()}>
                                        <button onClick={() => setModalAptId(null)} className="absolute top-3 right-3 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold">×</button>
                                      {/* Cliente Info */}
                                      <div className="mb-3">
                                        <div className="flex items-center gap-2 mb-2">
                                          <User className="w-4 h-4 text-white shrink-0" />
                                          {renderAppointmentClientNameRow(apt, serviceLabels, { variant: 'expanded' })}
                                          {isAvulsoLike(apt) && !apt.is_squeeze && editingAvulsoNameId !== apt.id && (
                                            <button
                                              type="button"
                                              onClick={() => startEditAvulsoName(apt)}
                                              className="text-white/80 hover:text-white text-xs"
                                              title="Editar nome do cliente avulso"
                                            >
                                              ✏️
                                            </button>
                                          )}
                                          {apt.is_premium && !apt.is_subscriber && <Crown className="w-4 h-4 text-gray-300" />}
                                          {apt.is_loyalty_reward && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-violet-300 bg-violet-900/40 text-violet-100">
                                              FIDELIDADE
                                            </span>
                                          )}
                                          {apt.is_squeeze && <span className="text-gray-300 text-xs">🟣</span>}
                                        </div>
                                        {isAvulsoLike(apt) && !apt.is_squeeze && (
                                          <>
                                            {editingAvulsoNameId === apt.id ? (
                                              <div className="mb-2 flex items-center gap-2">
                                                <input
                                                  type="text"
                                                  value={editingAvulsoNameValue}
                                                  onChange={(e) => setEditingAvulsoNameValue(e.target.value)}
                                                  placeholder="Nome do cliente (ex.: Ricardo)"
                                                  className="flex-1 px-2 py-1 text-sm bg-white/20 border border-white/30 rounded text-white placeholder-gray-300"
                                                  autoFocus
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveAvulsoName(apt);
                                                    if (e.key === 'Escape') cancelEditAvulsoName();
                                                  }}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => saveAvulsoName(apt)}
                                                  className="text-white text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                                                  title="Salvar"
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={cancelEditAvulsoName}
                                                  className="text-white text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
                                                  title="Cancelar"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="text-white/80 text-[11px] mb-2">
                                                Dica: clique no ✏️ para trocar “CLIENTE AVULSO” pelo nome do cliente.
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {apt.is_squeeze && (
                                          <div className="mb-2">
                                            <input
                                              type="text"
                                              value={getSqueezeInputValue(apt)}
                                              onChange={(e) => {
                                                const nextValue = e.target.value;
                                                setSqueezeNameDrafts((prev) => ({ ...prev, [apt.id]: nextValue }));
                                              }}
                                              onBlur={(e) => {
                                                void saveSqueezeName(apt, e.target.value);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  void saveSqueezeName(apt, (e.target as HTMLInputElement).value);
                                                }
                                                if (e.key === 'Escape') {
                                                  setSqueezeNameDrafts((prev) => {
                                                    const next = { ...prev };
                                                    delete next[apt.id];
                                                    return next;
                                                  });
                                                }
                                              }}
                                              placeholder="Nome do cliente (opcional)"
                                              className="w-full px-2 py-1 text-sm bg-white/20 border border-white/30 rounded text-white placeholder-gray-400"
                                            />
                                          </div>
                                        )}
                                        {apt.client_whatsapp && (
                                          <div className="text-white/90 text-xs flex items-center gap-2">
                                            {/* Número como TEXTO (não clicável) — evita abrir WhatsApp sem querer ao tentar fechar a comanda */}
                                            <span className="flex items-center gap-1">
                                              <Phone className="w-3 h-3" />
                                              {apt.client_whatsapp}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const phoneNumber = `55${String(apt.client_whatsapp || '').replace(/\D/g, '')}`;
                                                openWhatsAppWithBusinessPriority(phoneNumber, '');
                                              }}
                                              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 transition-colors"
                                              title="Abrir conversa no WhatsApp"
                                            >
                                              💬 WhatsApp
                                            </button>
                                          </div>
                                        )}
                                        <div className="text-white/80 text-xs mt-1">
                                          CPF: {displayedCpf ? formatCpfDisplay(displayedCpf) : 'Não informado'}
                                        </div>
                                        <div className="text-white/80 text-xs mt-1">
                                          Endereço: {displayedStreet || 'Não informado'}
                                        </div>
                                        {editingContactAppointmentId === apt.id ? (
                                          <div className="mt-2 space-y-2">
                                            <input
                                              type="text"
                                              value={editingContactCpf}
                                              onChange={(e) => setEditingContactCpf(e.target.value)}
                                              placeholder="CPF (opcional)"
                                              className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500"
                                            />
                                            <input
                                              type="text"
                                              value={editingContactStreet}
                                              onChange={(e) => setEditingContactStreet(e.target.value)}
                                              placeholder="Rua / Endereço (opcional)"
                                              className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-500"
                                            />
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                disabled={isSavingAppointmentContact}
                                                onClick={() => void handleSaveAppointmentContact(apt)}
                                                className="text-white text-xs px-2 py-1 bg-green-600 rounded hover:bg-green-500 disabled:opacity-60"
                                              >
                                                Salvar contato
                                              </button>
                                              <button
                                                type="button"
                                                disabled={isSavingAppointmentContact}
                                                onClick={() => {
                                                  setEditingContactAppointmentId(null);
                                                  setEditingContactCpf('');
                                                  setEditingContactStreet('');
                                                }}
                                                className="text-white text-xs px-2 py-1 bg-gray-700 rounded hover:bg-gray-600"
                                              >
                                                Cancelar
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleStartEditAppointmentContact(apt)}
                                            className="text-white/90 text-[11px] underline mt-1"
                                          >
                                            {displayedCpf || displayedStreet ? 'Editar CPF/endereço' : 'Adicionar CPF/endereço'}
                                          </button>
                                        )}
                                      </div>

                                      {/* Serviço e Data */}
                                      <div className="mb-3 text-xs text-white/90 space-y-1">
                                        <div className="flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          {formatDateSafe(apt.appointment_date)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {apt.appointment_time} • {formatDuration(getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos))}
                                        </div>
                                      </div>

                                      {/* Valores */}
                                      <div className="bg-white/10 rounded p-2 mb-3">
                                        <div className="text-xs text-white/80 mb-1">Valor base:</div>
                                        <div className="flex items-center gap-2">
                                          {editingAppointmentValue === apt.id ? (
                                            <>
                                              <input
                                                type="text"
                                                value={editingValue}
                                                onChange={(e) => setEditingValue(e.target.value)}
                                                className="px-2 py-1 text-xs bg-white/20 border border-white/30 rounded text-white w-20"
                                                placeholder="0,00"
                                              />
                                              <button
                                                onClick={() => handleSaveAppointmentValue(apt.id)}
                                                className="text-white hover:text-gray-200 text-xs px-2 py-1 bg-gray-700 rounded"
                                                title="Salvar"
                                              >
                                                ✓
                                              </button>
                                              <button
                                                onClick={handleCancelEditValue}
                                                className="text-white hover:text-gray-200 text-xs px-2 py-1 bg-gray-800 rounded"
                                                title="Cancelar"
                                              >
                                                ✕
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <div className="text-white font-bold">{formatCurrency(apt.price)}</div>
                                              {!apt.is_subscriber && (
                                                <button
                                                  onClick={() => handleEditAppointmentValue(apt.id, apt.price || 0)}
                                                  className="text-gray-300 hover:text-white text-xs"
                                                  title="Editar valor"
                                                >
                                                  ✏️
                                                </button>
                                              )}
                                            </>
                                          )}
                                        </div>

                                        {apt.additional_products && apt.additional_products.length > 0 && (
                                          <div className="mt-2">
                                            <div className="text-xs text-white/80 mb-1">Serviços Extras:</div>
                                            <div className="flex flex-wrap gap-1">
                                              {apt.additional_products.map((prod, idx) => (
                                                <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/10 text-white rounded group">
                                                  <span>
                                                    {prod.name}: {formatCurrency(prod.price)}
                                                    {Number(prod.duration) > 0 ? ` • +${prod.duration}min` : ''}
                                                  </span>
                                                  <button
                                                    onClick={() => handleRemoveAdditionalProduct(apt.id, idx)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                                    title="Remover"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {apt.sold_products && apt.sold_products.length > 0 && (
                                          <div className="mt-2">
                                            <div className="text-xs text-white/80 mb-1">Produtos:</div>
                                            <div className="flex flex-wrap gap-1">
                                              {apt.sold_products.map((prod) => (
                                                <div key={prod.id} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-800/50 text-white rounded border border-gray-600 group">
                                                  <Package className="h-3 w-3" />
                                                  <span>{prod.name} ({prod.quantity}x): {formatCurrency(prod.total)}</span>
                                                  <button
                                                    onClick={() => handleRemoveProductFromAppointment(apt.id, prod.product_id, prod.name)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-white"
                                                    title="Remover produto"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <div className="mt-2 pt-2 border-t border-white/20">
                                          <div className="space-y-1">
                                            <div className="text-sm font-bold text-white">
                                              Cobrar do cliente: {formatCurrency(calculateTotalPrice(apt))}
                                            </div>
                                            <div className="text-xs text-white/80">
                                              Valor do serviço (financeiro): {formatCurrency(calculateServiceTotal(apt))}
                                            </div>
                                            {getProfessionalTipAmount(apt) > 0 && (
                                              <div className="text-xs text-amber-200 font-semibold mt-0.5">
                                                Gorjeta (100% profissional): {formatCurrency(getProfessionalTipAmount(apt))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Forma de Pagamento */}
                                      {apt.status !== 'cancelled' && (
                                        <div className="mb-3">
                                          <select
                                            value={apt.payment_method || 'pendente'}
                                            onChange={(e) => {
                                              if (e.target.value === 'multi') setModalAptId(null);
                                              handlePaymentMethodChange(apt, e.target.value);
                                            }}
                                            className="w-full bg-white/20 text-white text-xs rounded px-2 py-1 border border-white/30"
                                          >
                                            <option value="pendente" className="bg-gray-800">Forma de Pagamento</option>
                                            <option value="multi" className="bg-gray-800">Várias formas de PG</option>
                                            <option value="pix" className="bg-gray-800">PIX</option>
                                            <option value="credito" className="bg-gray-800">Cartão de Crédito</option>
                                            <option value="debito" className="bg-gray-800">Cartão de Débito</option>
                                            <option value="dinheiro" className="bg-gray-800">Dinheiro</option>
                                            <option value="pagar_local" className="bg-gray-800">Pagar no Local</option>
                                            {getCustomPaymentMethods().map((custom) => (
                                              <option key={custom} value={custom} className="bg-gray-800">
                                                ⭐ {custom}
                                              </option>
                                            ))}
                                          </select>

                                          {(apt.payment_method === 'credito' || apt.payment_method === 'debito') && (
                                            <select
                                              value={apt.card_brand || 'bandeira'}
                                              onChange={(e) => handleCardBrandChange(apt.id, e.target.value)}
                                              className="w-full mt-1 bg-white/20 text-white text-xs rounded px-2 py-1 border border-white/30"
                                            >
                                              <option value="bandeira" className="bg-gray-800">Bandeira</option>
                                              <option value="visa" className="bg-gray-800">Visa</option>
                                              <option value="mastercard" className="bg-gray-800">Mastercard</option>
                                              <option value="elo" className="bg-gray-800">Elo</option>
                                            </select>
                                          )}

                                          {parsePaymentSplitDetails(apt).length > 0 && (
                                            <div className="mt-1 rounded border border-white/20 bg-black/25 p-2">
                                              <div className="text-[10px] text-white/70 mb-1">Histórico formas de PG:</div>
                                              <div className="space-y-0.5">
                                                {parsePaymentSplitDetails(apt).map((row, idx) => (
                                                  <div key={`${apt.id}-split-${idx}`} className="text-[10px] text-white/90 flex items-center justify-between">
                                                    <span>
                                                      {row.method}
                                                      {(row.method === 'credito' || row.method === 'debito') && row.card_brand
                                                        ? ` (${row.card_brand})`
                                                        : ''}
                                                    </span>
                                                    <strong>{formatCurrency(row.amount)}</strong>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Observações */}
                                      {apt.observation && (
                                        <div className="bg-gray-800/50 rounded p-2 mb-2 border border-gray-600">
                                          <div className="text-xs text-white/80 mb-1">Obs. Cliente:</div>
                                          <div className="text-xs text-white">{apt.observation}</div>
                                        </div>
                                      )}

                                      {apt.establishment_observation && (
                                        <div className="bg-gray-700/50 rounded p-2 mb-2 border border-gray-500">
                                          <div className="text-xs text-white/80 mb-1">Minhas Obs.:</div>
                                          <div className="text-xs text-white">{apt.establishment_observation}</div>
                                        </div>
                                      )}

                                      {/* Botões de Ação */}
                                      {apt.status !== 'cancelled' ? (
                                        <div className="space-y-2.5">
                                          {/* Botões principais */}
                                          <div className="grid grid-cols-2 gap-2">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'produto_v2', 'Clique em Adicionar Produto.');
                                                setModalAptId(null);
                                                if (onOpenProductV2Modal) onOpenProductV2Modal(apt.id);
                                              }}
                                              data-tutorial-id="appointments-detalhes-produto"
                                              className="px-2 py-3 text-sm bg-black text-white rounded hover:bg-gray-800 flex items-center justify-center gap-1"
                                            >
                                              <Package className="w-3 h-3" />
                                              Adicionar Produto
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'servico_extra', 'Clique em Serviço Extra.');
                                                setModalAptId(null);
                                                if (onOpenAdditionalProductModal) onOpenAdditionalProductModal(apt.id);
                                              }}
                                              data-tutorial-id="appointments-detalhes-servico-extra"
                                              className="px-2 py-3 text-sm bg-white/20 text-white rounded hover:bg-white/30 flex items-center justify-center gap-1"
                                            >
                                              <Plus className="w-3 h-3" />
                                              Serviço Extra
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'status_completed_click', 'Clique em Concluído.');
                                                handleUpdateAppointmentStatus(apt.id, 'completed');
                                              }}
                                              data-tutorial-id="appointments-detalhes-concluido"
                                              className={`px-2 py-3 text-sm text-white rounded transition-colors ${apt.is_squeeze ? 'bg-gray-700 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700'
                                                }`}
                                            >
                                              {apt.is_squeeze ? (
                                                <>
                                                  {apt.status === 'completed' ? '✅ ' : ''}
                                                  CONCLUÍDO
                                                </>
                                              ) : (
                                                '✅ CONCLUÍDO'
                                              )}
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'status_pending_click', 'Clique em Pendente.');
                                                handleUpdateAppointmentStatus(apt.id, 'pending');
                                              }}
                                              data-tutorial-id="appointments-detalhes-pendente"
                                              className="px-2 py-3 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                            >
                                              ⏳ PENDENTE
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'transferir_click', 'Clique em Transferir.');
                                                setModalAptId(null);
                                                if (onOpenTransferModal) onOpenTransferModal(apt);
                                              }}
                                              data-tutorial-id="appointments-detalhes-transferir"
                                              className="px-2 py-3 text-sm bg-black text-white rounded hover:bg-gray-800"
                                            >
                                              🔄 TRANSFERIR
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'terminei_antes_click', 'Clique em Terminei Antes.');
                                                setModalAptId(null);
                                                if (onOpenFinishEarlyModal) onOpenFinishEarlyModal(apt);
                                              }}
                                              data-tutorial-id="appointments-detalhes-terminei-antes"
                                              className="px-2 py-3 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                              title="Terminei antes do tempo planejado"
                                            >
                                              ⏱️ Terminei Antes
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'cancelar_click', 'Clique em Cancelar.');
                                                setModalAptId(null);
                                                if (onCancelAppointment) {
                                                  onCancelAppointment(apt.id);
                                                } else {
                                                  handleUpdateAppointmentStatus(apt.id, 'cancelled');
                                                }
                                              }}
                                              data-tutorial-id="appointments-detalhes-cancelar"
                                              className="px-2 py-3 text-sm bg-red-700 text-white rounded hover:bg-red-800"
                                            >
                                              ❌ CANCELAR
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const establishmentCode = establishment?.code || 'codigo';
                                                const message = `Desculpa, houve um imprevisto, não irei conseguir atender você. Acesse agendeifacil.com/booking/${establishmentCode} para agendar novamente.`;
                                                let phoneNumber = (apt.client_whatsapp || '').replace(/\D/g, '');
                                                const countryCodes = [
                                                  { code: '351', minLength: 12 },
                                                  { code: '244', minLength: 12 },
                                                  { code: '54', minLength: 12 },
                                                  { code: '56', minLength: 11 },
                                                  { code: '55', minLength: 12 },
                                                  { code: '34', minLength: 11 },
                                                  { code: '1', minLength: 11 }
                                                ];
                                                const hasCountryCode = countryCodes.some(({ code, minLength }) =>
                                                  phoneNumber.startsWith(code) && phoneNumber.length >= minLength
                                                );
                                                if (!hasCountryCode && phoneNumber.length >= 10 && phoneNumber.length <= 11) {
                                                  phoneNumber = '55' + phoneNumber;
                                                }
                                                void logAppointmentCardActionClick(apt, 'imprevisto_click', 'Clique em Imprevisto (envio WhatsApp).', {
                                                  whatsapp_target: phoneNumber,
                                                });
                                                openWhatsAppWithBusinessPriority(phoneNumber, message);
                                              }}
                                              data-tutorial-id="appointments-detalhes-imprevisto"
                                              className="px-2 py-3 text-sm bg-gray-800 text-white rounded hover:bg-gray-700"
                                              title="Enviar mensagem de imprevisto"
                                            >
                                              IMPREVISTO
                                            </button>

                                            {onGenerateNF && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  void logAppointmentCardActionClick(apt, 'baixar_nf_click', 'Clique em Baixar NF.');
                                                  setModalAptId(null);
                                                  onGenerateNF({
                                                    ...apt,
                                                    client_cpf: displayedCpf || apt.client_cpf,
                                                    client_street: displayedStreet || (apt as any).client_street,
                                                  });
                                                }}
                                                data-tutorial-id="appointments-detalhes-baixar-nf"
                                                className="col-span-2 px-2 py-3 text-sm bg-emerald-700 text-white rounded hover:bg-emerald-800 font-extrabold"
                                                title="Baixar nota fiscal do atendimento"
                                              >
                                                🧾 BAIXAR NF
                                              </button>
                                            )}

                                            <div
                                              className={
                                                onClientNoShow ? 'col-span-2 grid grid-cols-2 gap-1' : 'col-span-2'
                                              }
                                            >
                                              {onClientNoShow && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const clientName = apt.client_name || 'este cliente';
                                                    if (!window.confirm(`Tem certeza que deseja marcar que ${clientName} faltou? O agendamento será cancelado.`)) return;
                                                    void logAppointmentCardActionClick(apt, 'cliente_faltou_click', 'Clique em Cliente Faltou.');
                                                    setModalAptId(null);
                                                    onClientNoShow(apt);
                                                  }}
                                                  data-tutorial-id="appointments-detalhes-cliente-faltou"
                                                  className="px-2 py-3 text-sm bg-orange-700 text-white rounded hover:bg-orange-800"
                                                  title="Registrar que o cliente faltou (mesma função de Meus clientes)"
                                                >
                                                  Cliente Faltou
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  void logAppointmentCardActionClick(apt, 'gorjeta_click', 'Clique em Gorjeta.');
                                                  setModalAptId(null);
                                                  setTipModalAppointment(apt);
                                                  const cur = getProfessionalTipAmount(apt);
                                                  setTipModalInput(cur > 0 ? String(cur).replace('.', ',') : '');
                                                }}
                                                data-tutorial-id="appointments-detalhes-gorjeta"
                                                className={`px-2 py-3 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 font-semibold flex items-center justify-center gap-1 ${onClientNoShow ? '' : 'w-full'}`}
                                                title="Gorjeta: 100% para o profissional, fora da % sobre o serviço"
                                              >
                                                <Coins className="h-3.5 w-3.5 shrink-0" />
                                                Gorjeta
                                              </button>
                                            </div>
                                          </div>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'trocar_horario_click', 'Clique em Trocar horário.');
                                              setModalAptId(null);
                                              handleOpenRescheduleModal(apt);
                                            }}
                                            data-tutorial-id="appointments-detalhes-trocar-horario"
                                            className="w-full px-2 py-3 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 font-extrabold"
                                            title="Trocar a data/horário deste agendamento"
                                          >
                                            🕒 Trocar horário
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'trocar_servico_click', 'Clique em Trocar serviço.');
                                              setModalAptId(null);
                                              handleOpenChangeServiceModal(apt);
                                            }}
                                            data-tutorial-id="appointments-detalhes-trocar-servico"
                                            className="w-full px-2 py-3 text-sm bg-black text-white rounded hover:bg-gray-800 font-extrabold"
                                            title="Trocar o serviço (altera valor e duração)"
                                          >
                                            ✂️ Trocar serviço
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'minhas_observacoes_click', 'Clique em Minhas Observações.');
                                              setModalAptId(null);
                                              if (onOpenObservationModal) onOpenObservationModal(apt.id, apt.establishment_observation);
                                            }}
                                            data-tutorial-id="appointments-detalhes-observacoes"
                                            className="w-full px-2 py-3 text-sm bg-gray-700 text-white rounded hover:bg-gray-600"
                                          >
                                            📝 Minhas Observações
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setModalAptId(null);
                                              void handleOpenAppointmentHistoryModal(apt);
                                            }}
                                            className="w-full px-2 py-3 text-sm bg-amber-700 text-white rounded hover:bg-amber-800"
                                            title="Ver histórico de alterações desse agendamento"
                                          >
                                            📜 Ver histórico
                                          </button>

                                          {apt.is_child_service !== undefined && (
                                            <div className="text-center">
                                              <span className={`inline-block px-2 py-1 text-xs rounded ${apt.is_child_service ? 'bg-gray-700' : 'bg-gray-600'} text-white border border-gray-500`}>
                                                {apt.is_child_service ? '👶 Infantil' : '👤 Adulto'}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <div className="text-center text-white/70 text-xs py-2">
                                            ❌ CANCELADO
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleRestoreCancelledAppointment(apt);
                                            }}
                                            className="w-full px-2 py-3 text-sm bg-emerald-700 text-white rounded hover:bg-emerald-800 flex items-center justify-center gap-1"
                                          >
                                            ↩️ Restabelecer agendamento
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteAppointment(apt.id);
                                            }}
                                            className="w-full px-2 py-3 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 flex items-center justify-center gap-1"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            🗑️ EXCLUIR
                                          </button>
                                        </div>
                                      )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            return null;
                          })
                        ) : (
                          <div className="text-center py-8">
                            <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p className="text-gray-500 text-sm">Sem horário de trabalho hoje</p>
                          </div>
                        )}

                        {/* ✅ Agendamentos picados (fora da grade padrão) */}
                        {hiddenAppointments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-black/10">
                            <button
                              type="button"
                              onClick={() =>
                                setHiddenAppointmentsOpenByProfessional((prev) => ({
                                  ...prev,
                                  [professional.id]: !Boolean(prev[professional.id]),
                                }))
                              }
                              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                              title="Agendamentos com horário picado (ex: 12:05), fora da grade padrão"
                            >
                              <span className="text-xs font-extrabold text-amber-900">
                                Horários picados ({hiddenAppointments.length})
                              </span>
                              <span className="text-xs text-amber-800 font-semibold">
                                {hiddenOpen ? 'Ocultar' : 'Ver'}
                              </span>
                            </button>

                            {hiddenOpen && (
                              <div className="mt-2 space-y-2">
                                {hiddenAppointments.map((apt) => {
                                  const hiddenServiceLabels = getAppointmentServiceLabels(apt);
                                  const hiddenSubscriptionLabelColor = getSubscriptionLabelColor(apt);
                                  return (
                                    <div
                                      key={`hidden-${apt.id}`}
                                      className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-xs font-extrabold text-amber-900">
                                            ⛔ {apt.appointment_time} • {apt.is_squeeze
                                              ? (isAgendaSubscriberAppointment(apt) ? 'ENCAIXE ASSINANTE' : 'ENCAIXE')
                                              : (getDisplayedClientNameWithSubscriberLabel(apt) || 'Cliente')}
                                          </div>
                                          <div className="text-[11px] text-amber-900/90 truncate">
                                            {hiddenSubscriptionLabelColor && (
                                              <span
                                                className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle border border-amber-900/30"
                                                style={{ backgroundColor: hiddenSubscriptionLabelColor }}
                                                title="Etiqueta da assinatura"
                                              />
                                            )}
                                            {getDisplayedService(apt)}
                                          </div>
                                          {hiddenServiceLabels.length > 0 && (
                                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                                              {hiddenServiceLabels.map((label) => (
                                                <span
                                                  key={`hidden-${apt.id}-${label.name}-${label.color}`}
                                                  className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-amber-900/20"
                                                  style={{ backgroundColor: label.color, color: getLabelTextColor(label.color) }}
                                                  title={`Etiqueta: ${label.name}`}
                                                >
                                                  {label.name}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          <div className="mt-2 space-y-1 text-[10px] text-amber-900/90">
                                            <div>
                                              <span className="font-bold">Origem:</span> {getAppointmentOriginLabel(apt)}
                                            </div>
                                            <div>
                                              <span className="font-bold">Quem criou:</span>{' '}
                                              {Boolean((apt as any)?.is_establishment_booking === true)
                                                ? 'Equipe/Barbearia (interno)'
                                                : String(apt.client_id || '').trim()
                                                  ? 'Cliente'
                                                  : 'Não identificado (legado)'}
                                            </div>
                                            <div>
                                              <span className="font-bold">Status:</span> {String(apt.status || 'indefinido').toUpperCase()}
                                              {apt.payment_method ? (
                                                <>
                                                  {' '}• <span className="font-bold">PG:</span> {String(apt.payment_method)}
                                                </>
                                              ) : null}
                                            </div>
                                            {String(apt.client_whatsapp || '').trim() && (
                                              <div>
                                                <span className="font-bold">WhatsApp:</span> {String(apt.client_whatsapp || '').trim()}
                                              </div>
                                            )}
                                            <div>
                                              <span className="font-bold">Criado em:</span>{' '}
                                              {formatDateTimeSafe((apt as any)?.created_at)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="shrink-0 text-[11px] font-extrabold text-amber-900">
                                          {formatCurrency(calculateTotalPrice(apt))}
                                        </div>
                                      </div>

                                      <div className="mt-2 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenRescheduleModal(apt)}
                                          className="flex-1 px-3 py-2 rounded bg-black text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
                                        >
                                          🕒 Trocar horário
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { void handleOpenAppointmentHistoryModal(apt); }}
                                          className="px-3 py-2 rounded bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 transition-colors"
                                          title="Ver histórico completo desse agendamento"
                                        >
                                          📜 Histórico
                                        </button>
                                      </div>
                                      <div className="mt-2 text-[10px] text-amber-900/80">
                                        Esse agendamento está fora do intervalo configurado da agenda e por isso não aparece nos horários normais.
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {quickSlotActionModal && (
          <div
            className="fixed inset-0 z-[9998] bg-black/55 flex items-center justify-center p-4"
            onClick={() => setQuickSlotActionModal(null)}
          >
            <div
              className="w-full max-w-xs rounded-2xl border border-white/15 bg-[#111827] text-white overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-xs text-white/70">
                  {quickSlotActionModal.professionalName} • {quickSlotActionModal.time}
                </p>
                <p className="text-sm font-bold mt-0.5">Escolha uma ação rápida</p>
                {quickSlotActionModal.isPast && (
                  <p className="text-[11px] text-amber-300 mt-1">
                    Horário encerrado. Você ainda pode interagir por aqui.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <button
                  type="button"
                  disabled={!quickSlotActionModal.canReserve}
                  onClick={() => {
                    if (!quickSlotActionModal.canReserve) return;
                    onOpenReserveFromSlot?.({
                      professionalId: quickSlotActionModal.professionalId,
                      dateKey: quickSlotActionModal.dateKey,
                      time: quickSlotActionModal.time,
                      maxDurationMinutes: quickSlotActionModal.maxReserveMinutes,
                    });
                    setQuickSlotActionModal(null);
                  }}
                  className="px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-700/40 disabled:text-white/50 text-black text-xs font-extrabold uppercase tracking-wide transition-colors"
                >
                  Reservar
                </button>
                <button
                  type="button"
                  disabled={
                    !quickSlotActionModal.canBlock ||
                    slotBlockBusyKey === `${quickSlotActionModal.professionalId}__${quickSlotActionModal.time}`
                  }
                  onClick={async () => {
                    if (!quickSlotActionModal.canBlock) return;
                    await runToggleSlotBlock(
                      quickSlotActionModal.professionalId,
                      quickSlotActionModal.time,
                      true
                    );
                    setQuickSlotActionModal(null);
                  }}
                  className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wide transition-colors"
                >
                  Bloquear
                </button>
              </div>
              <div className="px-3 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProfessionalForSqueeze(quickSlotActionModal.professionalId);
                    setSqueezeStartTime(quickSlotActionModal.time);
                    setSqueezeEndTime('');
                    setSelectedSqueezeService(null);
                    setShowSqueezeServiceModal(true);
                    setQuickSlotActionModal(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold uppercase tracking-wide transition-colors"
                >
                  ✂️ Encaixe
                </button>
              </div>
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => setQuickSlotActionModal(null)}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Horários disponíveis (somente leitura) */}
        {showAvailabilityModal && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-amber-500/30 bg-gradient-to-b from-[#0b0b0c] to-black">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-extrabold text-lg">Horários disponíveis</div>
                    <div className="text-xs text-white/70 mt-1">
                      {availabilityProfessionalName} • {format(selectedDate, 'dd/MM/yyyy')}
                    </div>
                    <div className="text-[11px] text-white/60 mt-1">
                      Visualização para print (não dá pra clicar/agendar).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAvailabilityModal(false)}
                    className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
                    title="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto">
                {/* Grade no estilo do Booking (TimeSlotSelector) */}
                <div className="grid grid-cols-4 gap-2">
                  {availabilitySlots
                    .filter((slot) => !Boolean((slot as any).isPast))
                    .map((slot, idx) => {
                      const appointment = slot.appointment || slot.parentAppointment;
                      const isPast = Boolean((slot as any).isPast);
                      const isAvailable = slot.isEmpty && !slot.isBlocked && !isPast;
                      const isBlocked = slot.isBlocked;
                      const isAvulso = Boolean((appointment as any)?.is_avulso);
                      const isSqueeze = Boolean((appointment as any)?.is_squeeze);
                      const isCancelled = String((appointment as any)?.status || '').toLowerCase() === 'cancelled';
                      const isReserved = Boolean(appointment) && !isCancelled && !isAvulso && !isSqueeze;

                      const isDisabled = !isAvailable || isReserved || isAvulso || isBlocked || isSqueeze || isPast;

                      const badgeText = isAvulso
                        ? 'RESERVA'
                        : isSqueeze
                          ? (isAgendaSubscriberAppointment(appointment as Appointment) ? 'ENCAIXE ASSINANTE' : 'ENCAIXE')
                          : isPast
                            ? 'Já passou'
                            : isBlocked
                              ? 'Horário Fechado'
                              : isReserved
                                ? 'Horário Reservado'
                                : '';

                      return (
                        <button
                          type="button"
                          key={`${slot.time}-${idx}`}
                          // Só visualização: não faz nada ao clicar
                          onClick={() => { }}
                          className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-default
                        ${isAvulso
                              ? 'bg-orange-100 text-orange-800'
                              : isSqueeze
                                ? 'bg-purple-700 text-white'
                                : isPast
                                  ? 'bg-zinc-700 text-white'
                                  : isDisabled
                                    ? 'bg-red-600 text-white'
                                    : 'bg-green-600 text-white'
                            }
                      `}
                          aria-disabled="true"
                        >
                          <div className="flex flex-col items-center">
                            <span>{slot.time}</span>
                            {badgeText && (
                              <span className={`text-xs mt-1 ${isAvulso ? 'text-orange-600' : 'text-white'}`}>
                                {badgeText}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="p-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAvailabilityModal(false)}
                  className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold py-3 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedProfessionalForPhotoModal && (
          <div
            className="fixed inset-0 z-[9999] bg-black/65 flex items-center justify-center p-4"
            onClick={() => {
              if (isUpdatingProfessionalPhoto) return;
              setSelectedProfessionalForPhotoModal(null);
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111827] text-white overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Foto do profissional</p>
                  <p className="text-xs text-white/70">
                    {(professionals.find((p) => p.id === selectedProfessionalForPhotoModal)?.name) || 'Profissional'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isUpdatingProfessionalPhoto) return;
                    setSelectedProfessionalForPhotoModal(null);
                  }}
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 py-5 flex flex-col items-center">
                <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-white/20 bg-black mb-4">
                  <img
                    src={(professionals.find((p) => p.id === selectedProfessionalForPhotoModal) as any)?.photo_url || '/fotopessoa.png'}
                    alt={(professionals.find((p) => p.id === selectedProfessionalForPhotoModal)?.name) || 'Profissional'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/fotopessoa.png';
                    }}
                  />
                </div>

                <div className="w-full space-y-2">
                  <input
                    type="file"
                    accept="image/*,image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,image/gif,image/bmp,image/jfif"
                    id="professional-photo-inline-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file || !selectedProfessionalForPhotoModal || !onProfessionalPhotoChange) return;
                      try {
                        setIsUpdatingProfessionalPhoto(true);
                        await onProfessionalPhotoChange(selectedProfessionalForPhotoModal, file);
                      } catch (error: any) {
                        const msg = String(error?.message || '').trim() || 'Erro ao alterar foto do profissional.';
                        toast.error(msg);
                      } finally {
                        setIsUpdatingProfessionalPhoto(false);
                      }
                    }}
                    disabled={isUpdatingProfessionalPhoto}
                  />
                  <label
                    htmlFor="professional-photo-inline-upload"
                    className={`w-full px-3 py-2 rounded-lg text-sm font-semibold text-center cursor-pointer block transition-colors ${
                      isUpdatingProfessionalPhoto
                        ? 'bg-white/10 text-white/60 cursor-not-allowed'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {isUpdatingProfessionalPhoto ? 'Enviando...' : 'Alterar foto'}
                  </label>

                  {Boolean((professionals.find((p) => p.id === selectedProfessionalForPhotoModal) as any)?.photo_url) && (
                    <button
                      type="button"
                      disabled={isUpdatingProfessionalPhoto || !onProfessionalPhotoRemove}
                      onClick={async () => {
                        if (!selectedProfessionalForPhotoModal || !onProfessionalPhotoRemove) return;
                        try {
                          setIsUpdatingProfessionalPhoto(true);
                          await onProfessionalPhotoRemove(selectedProfessionalForPhotoModal);
                        } catch (error: any) {
                          const msg = String(error?.message || '').trim() || 'Erro ao remover foto do profissional.';
                          toast.error(msg);
                        } finally {
                          setIsUpdatingProfessionalPhoto(false);
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isUpdatingProfessionalPhoto
                          ? 'bg-red-700/40 text-white/60 cursor-not-allowed'
                          : 'bg-red-700 text-white hover:bg-red-800'
                      }`}
                    >
                      Apagar foto
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Histórico de auditoria do agendamento */}
        {showAppointmentHistoryModal && selectedAppointmentForHistory && (
          <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#1a1b1c] text-white">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-lg">Histórico de auditoria</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {String(getDisplayedClientName(selectedAppointmentForHistory) || selectedAppointmentForHistory.client_name || 'Cliente')} •{' '}
                      {String(selectedAppointmentForHistory.appointment_date || '').slice(0, 10).split('-').reverse().join('/')} às{' '}
                      {String(selectedAppointmentForHistory.appointment_time || '--:--')}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      Registro completo de alterações — valor, serviço, horário, produtos, status e pagamento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAppointmentHistoryModal}
                    className="h-9 w-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center shrink-0"
                    title="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[72vh] overflow-y-auto space-y-4">
                {(() => {
                  const originLabel = getAppointmentOriginLabel(selectedAppointmentForHistory);
                  const originLower = originLabel.toLowerCase();
                  const originClass = originLower.includes('interno')
                    ? 'text-amber-300 font-semibold'
                    : originLower.includes('externo') || originLower.includes('booking')
                      ? 'text-sky-300 font-semibold'
                      : 'text-gray-300';

                  return (
                <div className="rounded-xl border border-gray-700/70 bg-[#141516] p-3">
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-gray-500 mb-2">Resumo atual</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-300">
                    <div>
                      <span className="text-gray-500">Profissional:</span>{' '}
                      {getProfessionalName(String(selectedAppointmentForHistory.professional || ''))}
                    </div>
                    <div>
                      <span className="text-gray-500">Serviço:</span>{' '}
                      {String(selectedAppointmentForHistory.service || 'Não informado')}
                    </div>
                    <div>
                      <span className="text-gray-500">Valor:</span>{' '}
                      <span className="font-bold text-amber-300">{formatCurrency(calculateTotalPrice(selectedAppointmentForHistory))}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>{' '}
                      {getStatusLabel(selectedAppointmentForHistory.status)}
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-gray-500">Origem:</span>{' '}
                      <span className={originClass}>{originLabel}</span>
                    </div>
                    {(() => {
                      const raw = String(
                        appointmentHistoryCreatedAt || (selectedAppointmentForHistory as any)?.created_at || ''
                      ).trim();
                      if (!raw) return null;
                      const created = new Date(raw);
                      if (Number.isNaN(created.getTime())) return null;
                      return (
                        <div className="md:col-span-2">
                          <span className="text-gray-500">Agendado em:</span>{' '}
                          <span className="font-semibold text-emerald-300">
                            {created.toLocaleDateString('pt-BR')} às{' '}
                            {created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                  );
                })()}

                <AppointmentAuditTimeline
                  rows={appointmentHistoryRows}
                  isLoading={isLoadingAppointmentHistory}
                  emptyMessage="Nenhuma alteração registrada ainda. Alterações feitas a partir de agora aparecerão aqui com detalhes."
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal: Trocar horário */}
        {showRescheduleModal && selectedAppointmentForReschedule && (
          <RescheduleAppointmentModal
            isOpen={showRescheduleModal}
            onClose={handleCloseRescheduleModal}
            onConfirm={handleRescheduleAppointment}
            appointment={selectedAppointmentForReschedule as any}
            establishment={{
              id: String(establishment?.id || ''),
              business_hours: businessHours,
              professionals: Array.isArray(establishment?.professionals) ? establishment.professionals : [],
            } as any}
            use15MinuteInterval={Boolean((establishment as any)?.use_15_minute_interval)}
            use20MinuteSchedule={Boolean((establishment as any)?.use_20_minute_schedule)}
            use60MinuteSchedule={Boolean((establishment as any)?.use_60_minute_schedule)}
            closedTimeEnabled={Boolean((establishment as any)?.closed_time_enabled)}
          />
        )}

        {/* Modal: Trocar serviço */}
        {showChangeServiceModal && selectedAppointmentForServiceChange && establishment?.id && (
          <ChangeAppointmentServiceModal
            isOpen={showChangeServiceModal}
            onClose={handleCloseChangeServiceModal}
            establishmentId={String(establishment.id)}
            appointment={selectedAppointmentForServiceChange as any}
            onConfirm={handleConfirmChangeService}
          />
        )}

        {/* Modal: Gorjeta (100% para o profissional) */}
        {tipModalAppointment && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#1a1b1c] text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-700 flex items-start justify-between gap-3">
                <div>
                  <div className="font-extrabold text-lg flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-400" />
                    Gorjeta
                  </div>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Valor inteiro vai para o profissional deste atendimento — não entra na % de comissão sobre o serviço
                    (ex.: serviço R$ 100 com 50% = R$ 50; gorjeta R$ 10 → total R$ 60).
                  </p>
                  <p className="text-xs text-gray-500 mt-2 truncate" title={tipModalAppointment.client_name}>
                    {tipModalAppointment.client_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseTipModal}
                  className="h-9 w-9 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center shrink-0"
                  disabled={isSavingProfessionalTip}
                  title="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <label className="block text-xs text-gray-400">Valor (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={tipModalInput}
                  onChange={(e) => setTipModalInput(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 rounded-lg bg-[#2a2b2c] border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                  disabled={isSavingProfessionalTip}
                />
                <p className="text-[11px] text-gray-500">Use 0 ou vazio e salve para remover a gorjeta.</p>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseTipModal}
                    disabled={isSavingProfessionalTip}
                    className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfessionalTip}
                    disabled={isSavingProfessionalTip}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-extrabold hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isSavingProfessionalTip ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Atendimento assinatura */}
        {showSubscriberAttendanceModal && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-white">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-gray-900 font-extrabold text-lg">Atendimento assinatura</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Selecione o assinante para registrar 1 atendimento concluído.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseSubscriberAttendanceModal}
                    className="h-9 w-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center"
                    title="Fechar"
                    disabled={isSavingSubscriberAttendance}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3">
                  <input
                    type="text"
                    autoFocus
                    value={subscriberSearch}
                    onChange={(e) => setSubscriberSearch(e.target.value)}
                    placeholder="Pesquisar assinante por nome ou WhatsApp..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    disabled={subscriberOptionsLoading || isSavingSubscriberAttendance}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={loadSubscriberOptions}
                    className="text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                    disabled={subscriberOptionsLoading || isSavingSubscriberAttendance}
                  >
                    {subscriberOptionsLoading ? 'Carregando...' : 'Recarregar lista'}
                  </button>
                  <div className="text-xs text-gray-600">
                    {(() => {
                      const q = String(subscriberSearch || '');
                      const filtered = (subscriberOptions || []).filter((s: any) => matchesSubscriberQuery(s, q));
                      return q ? `${filtered.length} de ${subscriberOptions.length} assinante(s)` : `${subscriberOptions.length} assinante(s)`;
                    })()}
                  </div>
                </div>

                <div className="max-h-[45vh] overflow-y-auto border border-gray-200 rounded-lg">
                  {(() => {
                    const q = String(subscriberSearch || '');
                    const filtered = (subscriberOptions || []).filter((s: any) => matchesSubscriberQuery(s, q));

                    if (subscriberOptions.length === 0) {
                      return (
                        <div className="p-4 text-sm text-gray-600">
                          Nenhum assinante encontrado. Clique em “Recarregar lista”.
                        </div>
                      );
                    }

                    if (String(q || '').trim() && filtered.length === 0) {
                      return (
                        <div className="p-4 text-sm text-gray-600">
                          Nenhum assinante encontrado para "{subscriberSearch}".
                        </div>
                      );
                    }

                    return filtered.map((s: any) => {
                      const selected = String(selectedSubscriberOptionId) === String(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => setSelectedSubscriberOptionId(s.id)}
                          className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 ${selected ? 'bg-emerald-50' : ''
                            }`}
                          disabled={isSavingSubscriberAttendance}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {s.display_name}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {String(s.whatsapp || '').replace(/\D/g, '')}
                                {s.plan_name ? ` • ${s.plan_name}` : ''}
                              </div>
                            </div>
                            {selected && (
                              <span className="text-xs font-bold text-emerald-700">SELECIONADO</span>
                            )}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseSubscriberAttendanceModal}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm"
                  disabled={isSavingSubscriberAttendance}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubscriberAttendance}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSavingSubscriberAttendance || !selectedSubscriberOptionId}
                >
                  {isSavingSubscriberAttendance ? 'Salvando...' : 'Concluir e registrar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSplitPaymentModal && selectedAppointmentForSplitPayment && (
          <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#111214] shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-white">Várias formas de pagamento</h3>
                  <p className="text-xs text-white/70">
                    Valor do serviço: <strong>{formatCurrency(calculateTotalPrice(selectedAppointmentForSplitPayment))}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isSavingSplitPayment) return;
                    setShowSplitPaymentModal(false);
                    setSelectedAppointmentForSplitPayment(null);
                    setSplitPaymentRows([]);
                  }}
                  className="text-white/70 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                {splitPaymentRows.map((row, idx) => (
                  <div key={`split-row-${idx}`} className="rounded-lg border border-white/10 bg-black/25 p-2 space-y-2">
                    <div className="grid grid-cols-12 gap-2">
                      <select
                        value={row.method}
                        onChange={(e) =>
                          setSplitPaymentRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, method: e.target.value } : r))
                          )
                        }
                        className="col-span-6 bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20"
                        disabled={isSavingSplitPayment}
                      >
                        <option value="" className="bg-gray-800">Método</option>
                        {getSplitEnabledMethods().map((method) => (
                          <option key={`split-method-${method}`} value={method} className="bg-gray-800">
                            {method}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(e) =>
                          setSplitPaymentRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r))
                          )
                        }
                        className="col-span-4 bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20"
                        placeholder="Valor"
                        disabled={isSavingSplitPayment}
                      />
                      <button
                        type="button"
                        onClick={() => setSplitPaymentRows((prev) => prev.filter((_, i) => i !== idx))}
                        className="col-span-2 rounded bg-red-600/80 hover:bg-red-600 text-white text-xs"
                        disabled={isSavingSplitPayment || splitPaymentRows.length <= 1}
                      >
                        Rem
                      </button>
                    </div>

                    {(row.method === 'credito' || row.method === 'debito') && (
                      <select
                        value={row.card_brand || 'bandeira'}
                        onChange={(e) =>
                          setSplitPaymentRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, card_brand: e.target.value } : r))
                          )
                        }
                        className="w-full bg-white/10 text-white text-xs rounded px-2 py-1 border border-white/20"
                        disabled={isSavingSplitPayment}
                      >
                        <option value="bandeira" className="bg-gray-800">Bandeira</option>
                        <option value="visa" className="bg-gray-800">Visa</option>
                        <option value="mastercard" className="bg-gray-800">Mastercard</option>
                        <option value="elo" className="bg-gray-800">Elo</option>
                      </select>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (splitPaymentRows.length >= 4) return;
                      setSplitPaymentRows((prev) => [...prev, { method: '', amount: '', card_brand: 'bandeira' }]);
                    }}
                    className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs"
                    disabled={isSavingSplitPayment || splitPaymentRows.length >= 4}
                  >
                    + Adicionar forma ({splitPaymentRows.length}/4)
                  </button>
                  <div className="text-xs text-white/80">
                    Soma:{' '}
                    <strong>
                      {formatCurrency(
                        round2(
                          splitPaymentRows.reduce(
                            (sum, row) => sum + Number(String(row.amount || '').replace(',', '.')),
                            0
                          )
                        )
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isSavingSplitPayment) return;
                    setShowSplitPaymentModal(false);
                    setSelectedAppointmentForSplitPayment(null);
                    setSplitPaymentRows([]);
                  }}
                  className="px-3 py-1.5 rounded bg-white/10 text-white text-xs hover:bg-white/20"
                  disabled={isSavingSplitPayment}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSplitPayment}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                  disabled={isSavingSplitPayment}
                >
                  {isSavingSplitPayment ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Informações do Profissional */}
        {selectedProfessionalForInfo && !isFinancialLockedForProfessional(
          professionals.find((p) => p.id === selectedProfessionalForInfo) || { id: '', name: '' }
        ) && (
            <ProfessionalInfoModal
              professional={
                professionals.find((p) => p.id === selectedProfessionalForInfo) || {
                  id: '',
                  name: '',
                }
              }
              professionalPin={
                String(bypassFinancialPinForProfessionalId || '').trim() === String(selectedProfessionalForInfo || '').trim()
                  ? undefined
                  : professionalPins.find((pin) => pin.professional_id === selectedProfessionalForInfo)?.pin
              }
              establishmentId={establishment?.id}
              getCardTaxAmountForServiceBase={getCardTaxAmountForServiceBase}
              taxDeductedByEstablishment={Boolean((establishment as any)?.tax_deducted_by_establishment)}
              selectedMonth={selectedDate}
              productPayout={
                productPayoutByProfessionalName[
                  String(
                    professionals.find((p) => p.id === selectedProfessionalForInfo)?.name || ''
                  ).trim()
                ] || 0
              }
              productPayoutToday={
                productPayoutTodayByProfessionalName[
                  String(
                    professionals.find((p) => p.id === selectedProfessionalForInfo)?.name || ''
                  ).trim()
                ] || 0
              }
              {...calculateProfessionalValues(selectedProfessionalForInfo)}
              onRefreshDormantClientsSource={onRefreshDormantClientsSource}
              dormantClientsSource={(() => {
                const selected = professionals.find((p) => String(p.id || '') === String(selectedProfessionalForInfo || ''));
                const selectedIdKey = String(selectedProfessionalForInfo || '').trim();
                const selectedNameKey = String(selected?.name || '').trim();
                const normalizeToken = (value: unknown): string =>
                  String(value || '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .trim()
                    .toLowerCase();
                const selectedIdToken = normalizeToken(selectedIdKey);
                const selectedNameToken = normalizeToken(selectedNameKey);
                const listById = selectedIdKey ? (dormantClientsByProfessional[selectedIdKey] || []) : [];
                const listByName = selectedNameKey ? (dormantClientsByProfessional[selectedNameKey] || []) : [];
                const listByNormalizedKey = Object.entries(dormantClientsByProfessional).flatMap(([key, rows]) => {
                  const keyToken = normalizeToken(key);
                  if (!keyToken) return [];
                  if (
                    (selectedIdToken && keyToken === selectedIdToken) ||
                    (selectedNameToken && keyToken === selectedNameToken)
                  ) {
                    return rows || [];
                  }
                  return [];
                });
                const merged = new Map<string, any>();
                [...listById, ...listByName, ...listByNormalizedKey].forEach((item) => {
                  const key = `${String(item?.whatsapp || '').trim()}|${String(item?.lastVisitDate || '').trim()}|${String(item?.name || '').trim()}`;
                  if (!merged.has(key)) merged.set(key, item);
                });
                return Array.from(merged.values());
              })()}
              preComputedPastMonthPending={pastMonthPendingForModal}
              preComputedPastMonthValidPaid={pastMonthValidPaidForModal}
              financialDisplayMonth={modalViewingMonth}
              onViewingMonthChange={(month) => {
                setModalViewingMonth(month);
                setPastMonthPendingForModal(null);
                setPastMonthValidPaidForModal(null);
              }}
              onClose={() => {
                setSelectedProfessionalForInfo(null);
                setModalViewingMonth(null);
                setPastMonthPendingForModal(null);
                setPastMonthValidPaidForModal(null);
              }}
            />
          )}

        {/* Modal de Seleção de Serviço para Encaixe */}
        <SqueezeServicePickerModal
          open={showSqueezeServiceModal}
          establishmentId={establishment?.id}
          selectedProfessionalId={selectedProfessionalForSqueeze}
          professionals={professionals}
          appointments={squeezeUsageAppointments}
          onSelect={(service) => {
            setSelectedSqueezeService(service);
            setSelectedSqueezeSubscriberClient(null);
            setShowSqueezeServiceModal(false);
            if (service?.is_subscription) {
              setShowSqueezeProfessionalModal(true);
            } else {
              setShowSqueezeTimeModal(true);
            }
          }}
          onClose={() => {
            setShowSqueezeServiceModal(false);
            setSelectedProfessionalForSqueeze(null);
          }}
        />

        {/* Modal de Profissional para Encaixe de Assinatura */}
        {showSqueezeProfessionalModal && selectedSqueezeService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Escolher profissional do encaixe</h3>
                <button
                  onClick={() => resetSqueezeFlowState()}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-amber-200 mb-3">
                Plano: <span className="text-white font-semibold">{selectedSqueezeService.name}</span>
              </p>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {professionals.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nenhum profissional cadastrado.</p>
                ) : (
                  professionals.map((pro) => {
                    const isPreselected = String(selectedProfessionalForSqueeze || '') === String(pro.id);
                    return (
                      <button
                        key={pro.id}
                        type="button"
                        onClick={() => void handleSelectSqueezeProfessional(pro.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          isPreselected
                            ? 'bg-amber-900/40 border-amber-500 text-white'
                            : 'bg-[#2a2b2c] border-gray-600 text-gray-200 hover:border-gray-500'
                        }`}
                      >
                        <div className="font-semibold">{pro.name}</div>
                        {isPreselected && (
                          <div className="text-xs text-amber-200 mt-1">Profissional da coluna selecionada</div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSqueezeProfessionalModal(false);
                  setShowSqueezeServiceModal(true);
                }}
                className="w-full mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Assinante do Plano para Encaixe */}
        {showSqueezeSubscriberClientModal && selectedSqueezeService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Escolher assinante do plano</h3>
                <button
                  onClick={() => resetSqueezeFlowState()}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Plano: <span className="text-white">{selectedSqueezeService.name}</span>
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Somente assinantes ativos e pagos deste plano
                {selectedProfessionalForSqueeze
                  ? ' (vinculados ao profissional selecionado ou sem profissional fixo)'
                  : ''}
                .
              </p>
              <input
                type="text"
                value={squeezeSubscriptionClientSearch}
                onChange={(e) => setSqueezeSubscriptionClientSearch(e.target.value)}
                placeholder="Buscar por nome ou WhatsApp"
                className="w-full px-3 py-2 mb-3 bg-[#2a2b2c] border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-white"
              />
              <div className="max-h-56 overflow-y-auto space-y-2 border border-gray-700 rounded-lg p-2 bg-[#111213]">
                {squeezeSubscriptionClientsLoading ? (
                  <p className="text-sm text-gray-400 text-center py-4">Carregando assinantes...</p>
                ) : (() => {
                  const q = String(squeezeSubscriptionClientSearch || '').trim().toLowerCase();
                  const qDigits = q.replace(/\D/g, '');
                  const filtered = squeezeSubscriptionClients.filter((c) => {
                    if (!q) return true;
                    const name = String(c.name || '').toLowerCase();
                    const digits = String(c.whatsapp || '').replace(/\D/g, '');
                    return name.includes(q) || (qDigits && digits.includes(qDigits));
                  });
                  if (filtered.length === 0) {
                    return (
                      <p className="text-sm text-gray-400 text-center py-4">
                        Nenhum assinante ativo encontrado neste plano para o profissional selecionado.
                      </p>
                    );
                  }
                  return filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectSqueezeSubscriberClient(c)}
                      className="w-full text-left px-3 py-2 rounded-lg border bg-amber-900/20 border-amber-500/40 text-gray-100 hover:bg-amber-800/30 transition-colors"
                    >
                      <div className="text-sm font-semibold">👑 {c.name}</div>
                      <div className="text-xs text-amber-200">
                        {String(c.whatsapp || '').replace(/\D/g, '') || 'Sem WhatsApp'}
                      </div>
                    </button>
                  ));
                })()}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSqueezeSubscriberClientModal(false);
                  setShowSqueezeProfessionalModal(true);
                }}
                className="w-full mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* Modal de Horário para Encaixe */}
        {showSqueezeTimeModal && selectedSqueezeService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Definir Horário do Encaixe
                </h3>
                <button
                  onClick={() => {
                    setShowSqueezeTimeModal(false);
                    if ((selectedSqueezeService as any)?.is_subscription) {
                      setShowSqueezeSubscriberClientModal(true);
                      return;
                    }
                    setSelectedSqueezeService(null);
                    setSqueezeStartTime('');
                    setSqueezeEndTime('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Serviço: <span className="text-white">{selectedSqueezeService.name}</span>
                  </label>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor: <span className="text-white">{formatCurrency(selectedSqueezeService.price)}</span>
                  </label>
                  {(selectedSqueezeService as any)?.is_subscription && selectedSqueezeSubscriberClient && (
                    <>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Assinante:{' '}
                        <span className="text-white">{selectedSqueezeSubscriberClient.name}</span>
                      </label>
                      {selectedProfessionalForSqueeze && (
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Profissional:{' '}
                          <span className="text-white">
                            {professionals.find((p) => p.id === selectedProfessionalForSqueeze)?.name ||
                              'Profissional'}
                          </span>
                        </label>
                      )}
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Horário de Início
                  </label>
                  <input
                    type="time"
                    value={squeezeStartTime}
                    onChange={(e) => setSqueezeStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2a2b2c] border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Horário de Término
                  </label>
                  <input
                    type="time"
                    value={squeezeEndTime}
                    onChange={(e) => setSqueezeEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2a2b2c] border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      if ((selectedSqueezeService as any)?.is_subscription) {
                        setShowSqueezeTimeModal(false);
                        setShowSqueezeSubscriberClientModal(true);
                        return;
                      }
                      setShowSqueezeTimeModal(false);
                      setSelectedSqueezeService(null);
                      setSqueezeStartTime('');
                      setSqueezeEndTime('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {(selectedSqueezeService as any)?.is_subscription ? 'Voltar' : 'Cancelar'}
                  </button>
                  {(selectedSqueezeService as any)?.is_subscription ? (
                    <button
                      onClick={() => void handleCreateSqueeze()}
                      className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                      Criar encaixe assinante
                    </button>
                  ) : (
                    <button
                      onClick={openSqueezeClientModal}
                      className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Escolher cliente
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Seleção de Cliente para Encaixe */}
        {showSqueezeClientModal && selectedSqueezeService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Escolher cliente do encaixe</h3>
                <button
                  onClick={() => {
                    setShowSqueezeClientModal(false);
                    setShowSqueezeTimeModal(true);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSqueezeClientType('avulso')}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${squeezeClientType === 'avulso'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-[#2a2b2c] text-gray-300 border-gray-600 hover:border-gray-500'
                      }`}
                  >
                    Cliente avulso
                  </button>
                  <button
                    type="button"
                    onClick={() => setSqueezeClientType('known')}
                    className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${squeezeClientType === 'known'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#2a2b2c] text-gray-300 border-gray-600 hover:border-gray-500'
                      }`}
                  >
                    Cliente conhecido
                  </button>
                </div>

                {squeezeClientType === 'known' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={squeezeKnownClientSearch}
                      onChange={(e) => setSqueezeKnownClientSearch(e.target.value)}
                      placeholder="Buscar por nome ou WhatsApp"
                      className="w-full px-3 py-2 bg-[#2a2b2c] border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white"
                    />
                    <div className="max-h-56 overflow-y-auto space-y-2 border border-gray-700 rounded-lg p-2 bg-[#111213]">
                      {squeezeKnownClientsLoading ? (
                        <p className="text-sm text-gray-400 text-center py-4">Carregando clientes...</p>
                      ) : (() => {
                        const q = String(squeezeKnownClientSearch || '').trim().toLowerCase();
                        const qDigits = q.replace(/\D/g, '');
                        const filtered = squeezeKnownClients.filter((c) => {
                          if (!q) return true;
                          const name = String(c.name || '').toLowerCase();
                          const digits = String(c.whatsapp || '').replace(/\D/g, '');
                          return name.includes(q) || (qDigits && digits.includes(qDigits));
                        });
                        if (filtered.length === 0) {
                          return <p className="text-sm text-gray-400 text-center py-4">Nenhum cliente encontrado.</p>;
                        }
                        return filtered.map((c) => {
                          const selected = selectedSqueezeKnownClientId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedSqueezeKnownClientId(c.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${selected
                                ? 'bg-blue-600/30 border-blue-500 text-white'
                                : 'bg-[#1f2937] border-gray-600 text-gray-200 hover:border-gray-500'
                                }`}
                            >
                              <div className="text-sm font-semibold">{c.name}</div>
                              <div className="text-xs text-gray-300">{String(c.whatsapp || '').replace(/\D/g, '')}</div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <p className="text-xs text-gray-400">
                      Para cliente conhecido, o encaixe salva nome + WhatsApp e segue o mesmo caminho de lembrete do agendamento normal.
                    </p>
                  </div>
                )}

                {squeezeClientType === 'avulso' && (
                  <div className="rounded-lg border border-gray-700 bg-[#111213] p-3">
                    <p className="text-sm text-gray-300">
                      O encaixe será criado como <strong className="text-white">cliente avulso</strong>, mantendo o fluxo atual.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowSqueezeClientModal(false);
                    setShowSqueezeTimeModal(true);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (squeezeClientType === 'known') {
                      const selectedClient = squeezeKnownClients.find((c) => c.id === selectedSqueezeKnownClientId) || null;
                      if (!selectedClient) {
                        toast.error('Selecione um cliente conhecido.');
                        return;
                      }
                      if (!String(selectedClient.whatsapp || '').trim()) {
                        toast.error('Cliente conhecido sem WhatsApp. Escolha outro cliente ou use avulso.');
                        return;
                      }
                      void handleCreateSqueeze(selectedClient);
                      return;
                    }
                    void handleCreateSqueeze(null);
                  }}
                  className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Criar encaixe
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Card de Legenda de Cores - MOVIDO PARA BAIXO */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <p className="text-xs text-white mb-3 text-center">Clique na cor para ver o significado</p>

          {/* Layout para mobile - 3 colunas */}
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <button
              onClick={() => setShowColorLegend('red')}
              className="px-2 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            >
              Cancelado
            </button>
            <button
              onClick={() => setShowColorLegend('yellow')}
              className="px-2 py-2 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
            >
              Pendente
            </button>
            <button
              onClick={() => setShowColorLegend('green')}
              className="px-2 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
            >
              Concluído
            </button>
            <button
              onClick={() => setShowColorLegend('gold')}
              className="px-2 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white text-xs rounded hover:from-amber-600 hover:to-yellow-700 transition-colors"
            >
              👑 Faixa assinante
            </button>
          </div>

          {/* Layout para desktop - horizontal */}
          <div className="hidden sm:flex justify-center gap-4 flex-wrap">
            <button
              onClick={() => setShowColorLegend('red')}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              ❌ Cancelado
            </button>
            <button
              onClick={() => setShowColorLegend('yellow')}
              className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
            >
              ⏳ Pendente
            </button>
            <button
              onClick={() => setShowColorLegend('green')}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              ✅ Concluído
            </button>
            <button
              onClick={() => setShowColorLegend('gold')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-white text-sm rounded hover:from-amber-600 hover:to-yellow-700 transition-colors"
            >
              👑 Faixa assinante
            </button>
          </div>

          {/* Botão de lembrete para clientes */}
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setShowReminderInfo(true)}
              className="px-3 py-2 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
              title="Dicas sobre envio de lembretes"
            >
              📬 Enviar lembrete para clientes
            </button>
          </div>

          <div className="mt-2 flex justify-center">
            <button
              onClick={() => void handleOpenMonthPendingModal()}
              className="px-3 py-2 text-xs font-medium rounded transition-colors bg-yellow-700 text-white hover:bg-yellow-800"
              title="Listar todos os pendentes do mês selecionado"
            >
              ⏳ Pendentes do mês
            </button>
          </div>
        </div>

        {/* Alerta sobre valores pendentes - MOVIDO PARA BAIXO */}
        <div className="bg-gray-100 border-l-4 border-gray-600 rounded-r-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-gray-700 text-lg flex-shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1">
              <button
                onClick={() => setShowPendingWarning(true)}
                className="text-orange-800 text-sm font-bold text-left hover:underline"
              >
                Agendamento pendente não conta valor no dashboard - <span className="text-orange-600">clique para entender</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
