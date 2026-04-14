import { format, parse, parseISO } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Clock, Coins, Crown, Package, Phone, Plus, Trash2, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CANCELLATION_SOURCE } from '../utils/appointmentCancellationMeta';
import { openWhatsAppWithBusinessPriority } from '../utils/whatsapp';
import { ChangeAppointmentServiceModal } from './ChangeAppointmentServiceModal';
import { ProfessionalInfoModal } from './ProfessionalInfoModal';
import { RescheduleAppointmentModal } from './RescheduleAppointmentModal';
import { useToast } from './ui/Toaster';

interface Professional {
  id: string;
  name: string;
  photo_url?: string;
  percentage?: number;
  goal?: number;
  hide_gross_in_financial?: boolean;
  lock_appointments_with_owner_pin?: boolean;
  lock_financial_with_owner_pin?: boolean;
}

interface ProfessionalPin {
  professional_id: string;
  pin: string;
}

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
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  duration: number;
  price: number;
  total_price?: number;
  payment_method?: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'transferencia' | 'pagar_local' | 'multi';
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
  subscription_id?: string | null;
  is_child_service?: boolean;
  is_avulso?: boolean;
  is_squeeze?: boolean; // Indica se é um encaixe
  created_at?: string;
  is_establishment_booking?: boolean;
  /** Gorjeta 100% para o profissional (fora da % do serviço) */
  professional_tip_amount?: number | null;
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

interface SqueezeKnownClientOption {
  id: string;
  client_id?: string;
  name: string;
  whatsapp: string;
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
  onGenerateNF?: (appointment: Appointment) => void;
  onOpenReminderModal?: (appointment: Appointment) => void;
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
  onCancelAppointment?: (appointmentId: string) => void;
  onClientNoShow?: (appointment: Appointment) => void;
  onAppointmentDetailsOpen?: () => void;
  use15MinuteInterval?: boolean;
  use20MinuteSchedule?: boolean;
  use60MinuteSchedule?: boolean;
  useLightLayout?: boolean;
  canViewBarbershopCash?: boolean;
  pendingOpenBarbershopCash?: boolean;
  onConsumePendingOpenBarbershopCash?: () => void;
  onRequestBarbershopCashAccess?: () => void;
  serviceSubcategories?: ServiceSubcategoryLabel[];
  unlockedAppointmentsByProfessional?: Record<string, boolean>;
  unlockedFinancialByProfessional?: Record<string, boolean>;
  onRequestAppointmentsUnlock?: (professionalId: string) => void;
  onRequestFinancialUnlock?: (professionalId: string) => void;
}

export const AllProfessionalsAppointmentsView: React.FC<
  AllProfessionalsAppointmentsViewProps
> = ({
  professionals,
  appointments,
  monthlyAppointments,
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
  onGenerateNF,
  onOpenReminderModal,
  onOpenFinishEarlyModal,
  onGoToProfessionalConfig,
  onOpenBlockHoursModal,
  onToggleProfessionalSlotBlocked,
  onOpenAbsenceModal,
  onGoToClients,
  onCancelAppointment,
  onClientNoShow,
  onAppointmentDetailsOpen,
  use15MinuteInterval,
  use20MinuteSchedule,
  use60MinuteSchedule,
  useLightLayout = false,
  canViewBarbershopCash = false,
  pendingOpenBarbershopCash = false,
  onConsumePendingOpenBarbershopCash,
  onRequestBarbershopCashAccess,
  serviceSubcategories = [],
  unlockedAppointmentsByProfessional = {},
  unlockedFinancialByProfessional = {},
  onRequestAppointmentsUnlock,
  onRequestFinancialUnlock,
}) => {
    console.log('📋 AllProfessionalsAppointmentsView - Total de appointments recebidos:', appointments.length);
    console.log('📅 Data selecionada:', selectedDate.toISOString());
    console.log('🔍 Appointments:', appointments);

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
    const [expandedAppointments, setExpandedAppointments] = useState<{ [key: string]: boolean }>({});
    const [hiddenAppointmentsOpenByProfessional, setHiddenAppointmentsOpenByProfessional] = useState<Record<string, boolean>>({});
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(
      professionals.length > 0 ? professionals[0].id : ''
    );
    const [selectedProfessionalForInfo, setSelectedProfessionalForInfo] = useState<string | null>(null);
    const [showColorLegend, setShowColorLegend] = useState<'red' | 'yellow' | 'green' | null>(null);
    const [showReminderInfo, setShowReminderInfo] = useState(false);
    const [showPendingWarning, setShowPendingWarning] = useState(false);
    const [showMonthPendingModal, setShowMonthPendingModal] = useState(false);
    const [monthPendingAppointments, setMonthPendingAppointments] = useState<Appointment[]>([]);
    const [isLoadingMonthPending, setIsLoadingMonthPending] = useState(false);
    const [monthPendingFilterDate, setMonthPendingFilterDate] = useState('');
    const [showCancelledHistoryModal, setShowCancelledHistoryModal] = useState(false);
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
    const [selectedAppointmentForSubscriberAttendance, setSelectedAppointmentForSubscriberAttendance] = useState<Appointment | null>(null);
    const [isSavingSubscriberAttendance, setIsSavingSubscriberAttendance] = useState(false);
    const [showBarbershopCashModal, setShowBarbershopCashModal] = useState(false);
    const [barbershopCashOpeningInput, setBarbershopCashOpeningInput] = useState('');
    const [barbershopCashOpeningValue, setBarbershopCashOpeningValue] = useState(0);
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
      }>
    >({});
    const [professionalGoalConfigs, setProfessionalGoalConfigs] = useState<Record<string, ProfessionalGoalMonthlyConfig>>({});
    const selectedDateIso = format(selectedDate, 'yyyy-MM-dd');

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
          changed_by_name: String(user?.email || '').trim() || null,
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

    useEffect(() => {
      if (!establishment?.id) {
        setSubscriberFinancialByProfessional({});
        return;
      }

      let cancelled = false;

      const loadSubscriberProfessionalFinancial = async () => {
        try {
          const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

          const [attendancesResult, saleCommissionsResult, paymentsResult] = await Promise.all([
            supabase
              .from('subscriber_attendances')
              .select('professional_name, repass_value, client_subscription_id')
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
              .select('professional_id, professional_name, amount, payment_source, payment_date')
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

          const normalizeKey = (value: string) => String(value || '').trim().toLowerCase();
          const totalsByName: Record<
            string,
            {
              accumulated: number;
              paid: number;
              attendanceCount: number;
              uniqueClientIds: Set<string>;
              saleCommissionCount: number;
            }
          > = {};

          const ownerProfessionalNameKeys = new Set(
            (professionals || [])
              .filter((p) => isOwnerProfessional(p))
              .map((p) => String(p?.name || '').trim().toLowerCase())
              .filter(Boolean)
          );

          const ensure = (professionalNameRaw: string) => {
            const name = String(professionalNameRaw || '').trim();
            if (!name) return null;
            if (ownerProfessionalNameKeys.has(name.toLowerCase())) return null;
            const key = normalizeKey(name);
            if (!totalsByName[key]) {
              totalsByName[key] = {
                accumulated: 0,
                paid: 0,
                attendanceCount: 0,
                uniqueClientIds: new Set<string>(),
                saleCommissionCount: 0,
              };
            }
            return key;
          };

          ((attendancesResult.data as any[]) || []).forEach((row: any) => {
            const key = ensure(String(row?.professional_name || ''));
            if (!key) return;
            const subId = String(row?.client_subscription_id || '').trim();
            const skipMoneyRepass = Boolean(subId) && pointsModeByClientSubApptView.get(subId) === true;
            if (!skipMoneyRepass) {
              totalsByName[key].accumulated += Number(row?.repass_value || 0);
            }
            totalsByName[key].attendanceCount += 1;
            if (subId) totalsByName[key].uniqueClientIds.add(subId);
          });

          ((saleCommissionsResult.data as any[]) || []).forEach((row: any) => {
            const key = ensure(String(row?.professional_name || ''));
            if (!key) return;
            totalsByName[key].accumulated += Number(row?.commission_amount || 0);
            totalsByName[key].saleCommissionCount += 1;
          });

          const professionalIdToName: Record<string, string> = {};
          (professionals || []).forEach((p) => {
            const id = String(p?.id || '').trim();
            const name = String(p?.name || '').trim();
            if (id && name) professionalIdToName[id] = name;
          });

          ((paymentsResult.data as any[]) || []).forEach((row: any) => {
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
            };
            return acc;
          }, {} as Record<string, {
            accumulated: number;
            paid: number;
            pending: number;
            attendanceCount: number;
            uniqueClientsCount: number;
            saleCommissionCount: number;
          }>);

          if (!cancelled) setSubscriberFinancialByProfessional(byProfessionalName);
        } catch (error) {
          console.error('Erro ao carregar financeiro de assinaturas por profissional (modal):', error);
          if (!cancelled) setSubscriberFinancialByProfessional({});
        }
      };

      void loadSubscriberProfessionalFinancial();

      return () => {
        cancelled = true;
      };
    }, [establishment?.id, selectedDate, professionals]);

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

    const getHistoryEventLabel = (eventType: string): string => {
      const key = String(eventType || '').trim().toLowerCase();
      if (key === 'service_changed') return 'Serviço alterado';
      if (key === 'finished_early') return 'Terminou antes';
      if (key === 'additional_service_added') return 'Extra adicionado';
      if (key === 'additional_service_removed') return 'Extra removido';
      if (key === 'status_changed') return 'Status alterado';
      if (key === 'subscriber_attendance_marked') return 'Atendimento assinatura registrado';
      return key || 'Evento';
    };

    const toFiniteNumberOrNull = (value: unknown): number | null => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    const formatCurrencyMaybe = (value: unknown): string | null => {
      const n = toFiniteNumberOrNull(value);
      if (n === null) return null;
      return formatCurrency(n);
    };

    const formatDurationMaybe = (value: unknown): string | null => {
      const n = toFiniteNumberOrNull(value);
      if (n === null) return null;
      return `${Math.round(n)} min`;
    };

    const buildHistoryHighlights = (row: AppointmentChangeLog): string[] => {
      const oldV = (row.old_values || {}) as Record<string, any>;
      const newV = (row.new_values || {}) as Record<string, any>;
      const meta = (row.metadata || {}) as Record<string, any>;
      const lines: string[] = [];
      const key = String(row.event_type || '').trim().toLowerCase();

      if (key === 'service_changed') {
        const oldService = String(oldV.service || '').trim();
        const newService = String(newV.service || '').trim();
        if (oldService || newService) lines.push(`Serviço: ${oldService || '-'} -> ${newService || '-'}`);

        const oldPrice = formatCurrencyMaybe(oldV.price);
        const newPrice = formatCurrencyMaybe(newV.price);
        if (oldPrice || newPrice) lines.push(`Valor do serviço: ${oldPrice || '-'} -> ${newPrice || '-'}`);

        const oldDuration = formatDurationMaybe(oldV.duration);
        const newDuration = formatDurationMaybe(newV.duration);
        if (oldDuration || newDuration) lines.push(`Duração: ${oldDuration || '-'} -> ${newDuration || '-'}`);

        const oldTotal = formatCurrencyMaybe(oldV.total_price);
        const newTotal = formatCurrencyMaybe(newV.total_price);
        if (oldTotal || newTotal) lines.push(`Total para cobrar: ${oldTotal || '-'} -> ${newTotal || '-'}`);
      } else if (key === 'finished_early') {
        const oldDuration = formatDurationMaybe(oldV.duration);
        const newDuration = formatDurationMaybe(newV.duration);
        if (oldDuration || newDuration) lines.push(`Duração real: ${oldDuration || '-'} -> ${newDuration || '-'}`);

        const released = toFiniteNumberOrNull(meta.time_released_minutes);
        if (released !== null) lines.push(`Tempo liberado: ${Math.round(released)} min`);

        const newEnd = String(meta.new_end_time || '').trim();
        const oldEnd = String(meta.original_end_time || '').trim();
        if (newEnd || oldEnd) lines.push(`Janela liberada: ${newEnd || '-'} até ${oldEnd || '-'}`);
      } else if (key === 'additional_service_added') {
        const p = (meta.product_added || {}) as Record<string, any>;
        const pName = String(p.name || '').trim() || 'Extra';
        const pPrice = formatCurrencyMaybe(p.price);
        const pDuration = formatDurationMaybe(p.duration);
        lines.push(`Item: ${pName}${pPrice ? ` • ${pPrice}` : ''}${pDuration ? ` • ${pDuration}` : ''}`);

        const oldCount = toFiniteNumberOrNull(oldV.additional_products_count);
        const newCount = toFiniteNumberOrNull(newV.additional_products_count);
        if (oldCount !== null || newCount !== null) lines.push(`Qtd. de extras: ${oldCount ?? '-'} -> ${newCount ?? '-'}`);

        const oldTotal = formatCurrencyMaybe(oldV.total_price);
        const newTotal = formatCurrencyMaybe(newV.total_price);
        if (oldTotal || newTotal) lines.push(`Total para cobrar: ${oldTotal || '-'} -> ${newTotal || '-'}`);
      } else if (key === 'additional_service_removed') {
        const p = (meta.product_removed || {}) as Record<string, any>;
        const pName = String(p.name || '').trim() || 'Extra';
        const pPrice = formatCurrencyMaybe(p.price);
        const pDuration = formatDurationMaybe(p.duration);
        lines.push(`Item removido: ${pName}${pPrice ? ` • ${pPrice}` : ''}${pDuration ? ` • ${pDuration}` : ''}`);

        const oldCount = toFiniteNumberOrNull(oldV.additional_products_count);
        const newCount = toFiniteNumberOrNull(newV.additional_products_count);
        if (oldCount !== null || newCount !== null) lines.push(`Qtd. de extras: ${oldCount ?? '-'} -> ${newCount ?? '-'}`);

        const oldTotal = formatCurrencyMaybe(oldV.total_price);
        const newTotal = formatCurrencyMaybe(newV.total_price);
        if (oldTotal || newTotal) lines.push(`Total para cobrar: ${oldTotal || '-'} -> ${newTotal || '-'}`);
      } else if (key === 'status_changed') {
        const oldStatus = String(oldV.status || '').trim().toUpperCase();
        const newStatus = String(newV.status || '').trim().toUpperCase();
        if (oldStatus || newStatus) lines.push(`Status: ${oldStatus || '-'} -> ${newStatus || '-'}`);

        const action = String(meta.action || '').trim();
        if (action) lines.push(`Ação: ${action}`);

        const clickedAt = String(meta.clicked_at || '').trim();
        if (clickedAt) lines.push(`Clique registrado em: ${clickedAt}`);
      } else if (key === 'subscriber_attendance_marked') {
        const oldStatus = String(oldV.status || '').trim().toUpperCase();
        const newStatus = String(newV.status || '').trim().toUpperCase();
        if (oldStatus || newStatus) lines.push(`Status: ${oldStatus || '-'} -> ${newStatus || '-'}`);

        const subscriberName = String(meta.subscriber_name || '').trim();
        if (subscriberName) lines.push(`Assinante: ${subscriberName}`);

        const subscriberWhatsapp = String(meta.subscriber_whatsapp || '').trim();
        if (subscriberWhatsapp) lines.push(`WhatsApp: ${subscriberWhatsapp}`);

        const attendanceDate = String(meta.attendance_date || '').trim();
        if (attendanceDate) lines.push(`Data do atendimento: ${attendanceDate}`);

        const clickedAt = String(meta.clicked_at || '').trim();
        if (clickedAt) lines.push(`Clique registrado em: ${clickedAt}`);
      }

      if (lines.length === 0 && row.description) lines.push(String(row.description));
      return lines;
    };

    const formatJsonPreview = (value: unknown): string => {
      try {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'string') return value || '-';
        return JSON.stringify(value, null, 2);
      } catch {
        return '-';
      }
    };

    const getAppointmentOriginLabel = (apt: Appointment): string => {
      const isInternalByFlag = Boolean((apt as any)?.is_establishment_booking === true);
      const isAvulsoLike = Boolean(apt.is_avulso) || Boolean(apt.is_squeeze);
      const ownerCreated = String(apt.client_id || '').trim() !== '' && String(apt.client_id || '').trim() === String(user?.id || '').trim();

      if (isInternalByFlag || isAvulsoLike || ownerCreated) {
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
      try {
        const { error } = await supabase
          .from('appointments')
          .update({
            appointment_date: newDate,
            appointment_time: newTime,
          } as any)
          .eq('id', appointmentId);

        if (error) throw error;

        toast.success('Horário alterado com sucesso!');
        if (onAppointmentUpdate) onAppointmentUpdate();
      } catch (e) {
        console.error('❌ Erro ao trocar horário:', e);
        toast.error('Erro ao trocar horário. Tente novamente.');
        throw e;
      }
    };

    const getProfessionalNameById = (professionalId: string): string => {
      const p = professionals.find((x) => String(x.id) === String(professionalId));
      return String(p?.name || professionalId || 'Profissional');
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
            subscriptions (
              id,
              name,
              value,
              fixed_commission_value,
              divide_total_enabled,
              divide_total_attendances
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
        const limit = Number(selectedSub?.monthly_limit || 0);
        if (Number.isFinite(limit) && limit > 0) {
          // Usar a data do dia da agenda (selectedDate) para evitar dia anterior por UTC
          const y = selectedDate.getFullYear();
          const m = selectedDate.getMonth();
          const first = new Date(y, m, 1);
          const last = new Date(y, m + 1, 0);
          const min = format(first, 'yyyy-MM-dd');
          const max = format(last, 'yyyy-MM-dd');

          const { data: countRows, error: countErr } = await (supabase as any)
            .from('subscriber_attendances')
            .select('id, attendance_date')
            .eq('establishment_id', establishmentId)
            .eq('client_subscription_id', String(selectedSubscriberOptionId))
            .gte('attendance_date', min)
            .lte('attendance_date', max);

          if (countErr) throw countErr;
          const currentCount = Array.isArray(countRows) ? countRows.length : 0;
          if (currentCount >= limit) {
            toast(`Limite atingido (${limit}/${limit}). Aumente o limite do cliente para registrar mais atendimentos.`, 'error');
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
        const professionalName = getProfessionalNameById(String(apt.professional || ''));
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
          professional_name: professionalName,
          attendance_date: attendanceDateStr,
          repass_value: repassValue,
        };
        if (user?.id) payload.created_by = user.id;

        const { error: insErr } = await (supabase as any)
          .from('subscriber_attendances')
          .insert(payload);
        if (insErr) throw insErr;

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
      if (!apt.is_subscriber) return name;
      const base = (name || '').trim().toUpperCase() === 'ASSINANTE' || !(name || '').trim() ? 'Assinante' : name;
      const alreadyHasLabel = (name || '').includes('(ASSINANTE)');
      return alreadyHasLabel ? `${base} 👑` : `${base} (ASSINANTE) 👑`;
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

    // Modal: Horários disponíveis (somente visualização, para print)
    const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
    const [availabilityProfessionalId, setAvailabilityProfessionalId] = useState<string | null>(null);
    const [availabilityProfessionalName, setAvailabilityProfessionalName] = useState<string>('');
    const [availabilitySlots, setAvailabilitySlots] = useState<TimeSlot[]>([]);

    const hasOwnerConfigPin = Boolean(
      establishment?.pin_password &&
      String(establishment.pin_password || '').trim().length > 0 &&
      String(establishment.pin_password || '').trim() !== '0000'
    );

    const isAppointmentsLockedForProfessional = (professional: Professional): boolean => {
      if (!hasOwnerConfigPin) return false;
      if (!Boolean((professional as any)?.lock_appointments_with_owner_pin)) return false;
      return !Boolean(unlockedAppointmentsByProfessional[String(professional.id)]);
    };

    const isFinancialLockedForProfessional = (professional: Professional): boolean => {
      if (!hasOwnerConfigPin) return false;
      if (!Boolean((professional as any)?.lock_financial_with_owner_pin)) return false;
      return !Boolean(unlockedFinancialByProfessional[String(professional.id)]);
    };

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value);
    };

    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
      }
      return `${mins}min`;
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

    // Para assinantes: priorizar sempre a duração salva no agendamento.
    // Isso evita regressão visual (ex.: cair para 30min) quando o plano/serviços mudam depois.
    const getEffectiveBaseDuration = (apt: Appointment, interval: number): number => {
      const fallback = parseDurationMinutes((apt as any)?.duration, interval);
      if (!apt.service || subscriptionDurations.length === 0) return fallback;

      const isSubscriberAppointment =
        Boolean((apt as any)?.is_subscriber) ||
        String((apt as any)?.client_name || '').toUpperCase().includes('(ASSINANTE)');
      if (!isSubscriberAppointment) return fallback;

      const storedDuration = parseDurationMinutes((apt as any)?.duration, 0);
      if (storedDuration > 0) return storedDuration;

      const serviceStr = String(apt.service).trim();
      const normalizedService = normalizeName(serviceStr);
      const aptSubscriptionId = String((apt as any)?.subscription_id || '').trim();

      // Fluxo novo: assinatura com "dividir serviços" (duração por serviço específico).
      for (const sub of subscriptionDurations) {
        if (aptSubscriptionId && String(sub?.id || '') !== aptSubscriptionId) continue;
        if (!sub?.divide_services_enabled || !Array.isArray(sub?.divided_services) || sub.divided_services.length === 0) {
          continue;
        }
        const matchedDividedService = sub.divided_services.find((svc) => {
          const current = normalizeName(svc?.name || '');
          return current && (normalizedService === current || normalizedService.includes(current) || current.includes(normalizedService));
        });
        if (matchedDividedService && matchedDividedService.duration > 0) {
          return matchedDividedService.duration;
        }
      }

      // Fluxo legado: assinatura com duração única.
      const sub = subscriptionDurations.find(
        (s) => s.name && (serviceStr.includes(s.name) || s.name.includes(serviceStr))
      );
      if (sub && sub.service_duration > 0) return sub.service_duration;
      return fallback;
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
      const aptProfessional = String(apt?.professional || '').trim();
      if (!aptProfessional) return false;
      if (aptProfessional === String(professional?.id || '').trim()) return true;
      const professionalName = String((professional as any)?.name || '').trim();
      return professionalName
        ? aptProfessional.toLowerCase() === professionalName.toLowerCase()
        : false;
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
      const start = parse(startTime, 'HH:mm', selectedDate);
      const end = parse(endTime, 'HH:mm', selectedDate);

      // ✅ Ocultar horários do intervalo (break) na visualização "Horários disponíveis"
      // O booking já trata intervalo; aqui é uma grade de visualização/print e não deve mostrar o intervalo.
      const breakStart = professionalWorkHours?.break_start
        ? parse(professionalWorkHours.break_start, 'HH:mm', selectedDate)
        : null;
      const breakEnd = professionalWorkHours?.break_end
        ? parse(professionalWorkHours.break_end, 'HH:mm', selectedDate)
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
      const normalAppointments = appointments.filter((apt) =>
        appointmentBelongsToProfessionalColumn(apt, professional) &&
        apt.appointment_date === selectedDateStr &&
        String(apt.status || '').toLowerCase() !== 'cancelled' &&
        !apt.is_squeeze
      );

      const squeezeAppointments = appointments.filter((apt) =>
        appointmentBelongsToProfessionalColumn(apt, professional) &&
        apt.appointment_date === selectedDateStr &&
        String(apt.status || '').toLowerCase() !== 'cancelled' &&
        apt.is_squeeze
      );

      const professionalAppointments = [...normalAppointments, ...squeezeAppointments].sort(
        (a, b) =>
          parse(a.appointment_time, 'HH:mm', selectedDate).getTime() -
          parse(b.appointment_time, 'HH:mm', selectedDate).getTime()
      );

      // Incluir só horário de TÉRMINO fora do grid (ex: 14:50) — não adicionar 16:30, 16:50 etc. se já estão na grade ou não há agendamento terminando ali
      const periodStartMins = parse(startTime, 'HH:mm', selectedDate).getTime();
      const periodEndMins = parse(endTime, 'HH:mm', selectedDate).getTime();

      // ✅ Incluir INÍCIO de agendamento fora da grade (ex.: 12:05) para exibir card no horário real.
      professionalAppointments.forEach((apt) => {
        const aptStart = parse(apt.appointment_time, 'HH:mm', selectedDate);
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
        const aptStart = parse(apt.appointment_time, 'HH:mm', selectedDate);
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

      // Processar agendamentos normais
      normalAppointments.forEach((apt) => {
        const startTime = apt.appointment_time;
        const duration = getDuracaoTotalAgendamento(apt, interval);

        occupiedSlots.set(startTime, { appointment: apt, isOccupied: false });

        const startDate = parse(startTime, 'HH:mm', selectedDate);
        for (let i = interval; i < duration; i += interval) {
          const occupiedTime = format(new Date(startDate.getTime() + i * 60000), 'HH:mm');
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
        const squeezeStartDate = parse(squeezeStartTime, 'HH:mm', selectedDate);

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

      // Verificar horários bloqueados para este profissional na data selecionada
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      const blockedHours = (professional as any).blocked_hours?.[dateKey] || [];
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const isToday = dateKey === todayKey;
      const now = new Date();

      const result: TimeSlot[] = allSlots.map((slot) => {
        const occupied = occupiedSlots.get(slot);
        const isBlocked = blockedHours.includes(slot);
        const squeezesForSlot = squeezeSlotsMap.get(slot) || [];
        const slotDateTime = parse(slot, 'HH:mm', selectedDate);
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
      setExpandedAppointments(prev => {
        const nextIsExpanded = !prev[appointmentId];
        if (nextIsExpanded) {
          onAppointmentDetailsOpen?.();
        }
        return {
          ...prev,
          [appointmentId]: nextIsExpanded
        };
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
        const appointment = (appointments || []).find((apt) => String(apt.id) === String(appointmentId));
        const previousStatus = String(appointment?.status || '').trim().toLowerCase();
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
              cancellation_source: CANCELLATION_SOURCE.ESTABLISHMENT_STAFF,
              cancellation_detail: 'Cancelado pelo painel de agenda (ações rápidas).',
            } as Record<string, unknown>)
            : { status: newStatus };

        let { error } = await supabase.from('appointments').update(cancelPayload as any).eq('id', appointmentId);

        if (error && newStatus === 'cancelled' && String((error as any).code || '') === '42703') {
          const fb = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId);
          error = fb.error;
        }

        // Compatibilidade: se o banco estiver com trigger de bloqueio estrito e for concluir no dia atual,
        // tenta novamente com override explícito (sem quebrar bancos legados).
        if (error && newStatus === 'completed' && isTodayAppointment && isBlockedByHourError(error)) {
          const retry = await supabase
            .from('appointments')
            .update({ status: newStatus, allow_blocked_override: true } as any)
            .eq('id', appointmentId);
          error = retry.error;
        }

        if (error) throw error;

        if (appointment && newStatus === 'completed' && previousStatus !== 'completed') {
          await syncBookingProductsToStockOnCompletion(appointment);
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

        const updatedProducts = appointment.additional_products.filter((_, index) => index !== productIndex);

        const { error } = await supabase
          .from('appointments')
          .update({ additional_products: updatedProducts })
          .eq('id', appointmentId);

        if (error) throw error;

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
      await logAppointmentCardActionClick(
        appointment,
        'forma_pagamento_change_click',
        'Alteração da forma de pagamento pelo card.',
        { requested_payment_method: paymentMethod }
      );
      if (paymentMethod === 'multi') {
        handleOpenSplitPaymentModal(appointment);
        return;
      }
      try {
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

        toast('Forma de pagamento atualizada');

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
        if (appointment) {
          await logAppointmentCardActionClick(
            appointment,
            'bandeira_change_click',
            'Alteração de bandeira do cartão pelo card.',
            { requested_card_brand: cardBrand }
          );
        }
        const { error } = await supabase
          .from('appointments')
          .update({ card_brand: cardBrand === 'bandeira' ? null : cardBrand })
          .eq('id', appointmentId);

        if (error) throw error;

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

      // Se for encaixe, usar cinza escuro
      if (appointment.is_squeeze) {
        if (slot.isOccupied) {
          return 'bg-gray-700/60 border-gray-600';
        }
        return 'bg-gray-700 border-gray-600';
      }

      if (slot.isOccupied) {
        switch (appointment.status) {
          case 'cancelled':
            return 'bg-red-800/60 border-red-700';
          case 'completed':
            return 'bg-green-600/60 border-green-700';
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
          return 'bg-green-600 border-green-700';
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

      // Debug: verificar todos os appointments
      console.log('🔍 DEBUG calculateProfessionalValues:');
      console.log('  - Professional ID:', professionalId);
      console.log('  - Selected Date:', selectedDateStr);
      console.log('  - Total appointments:', appointments.length);
      console.log('  - Appointments do profissional:', appointments.filter(apt => apt.professional === professionalId).length);
      console.log('  - Appointments do profissional na data:', appointments.filter(apt => apt.professional === professionalId && apt.appointment_date === selectedDateStr).length);

      // Valores do Dia e "Agendamentos hoje": apenas CONCLUÍDOS (status === 'completed').
      // Pendentes/confirmados não contam — batendo com o contador verde da agenda.
      const dailyAppointments = appointments.filter(
        (apt) =>
          apt.professional === professionalId &&
          apt.appointment_date === selectedDateStr &&
          apt.status === 'completed'
      );

      console.log('  - Appointments concluídos hoje (valores + contagem):', dailyAppointments.length);
      console.log('  - Detalhes:', dailyAppointments.map(apt => ({ id: apt.id, status: apt.status, date: apt.appointment_date })));

      // Para valores financeiros mensais, usar apenas confirmados/completos
      const monthlyAppointmentsForPro = monthlyAppointments.filter(
        (apt) =>
          apt.professional === professionalId &&
          (apt.status === 'confirmed' || apt.status === 'completed')
      );

      // Para contagem mensal, usar todos não cancelados
      const monthlyAppointmentsForCount = monthlyAppointments.filter(
        (apt) =>
          apt.professional === professionalId &&
          apt.status !== 'cancelled'
      );

      const dailyGross = dailyAppointments.reduce(
        // ✅ No saldo do barbeiro, NÃO contar produtos V2. Apenas serviço + serviços extra.
        (sum, apt) => sum + calculateServiceTotal(apt),
        0
      );
      const monthlyGross = monthlyAppointmentsForPro.reduce(
        // ✅ No saldo do barbeiro, NÃO contar produtos V2. Apenas serviço + serviços extra.
        (sum, apt) => sum + calculateServiceTotal(apt),
        0
      );

      const professional = professionals.find((p) => p.id === professionalId);
      const percentage = normalizeProfessionalPercentage(professional?.percentage);
      const goalProgress = getGoalProgressForProfessional(professionalId);
      const professionalNameKey = String(professional?.name || '').trim().toLowerCase();
      const subscriberFinancial = subscriberFinancialByProfessional[professionalNameKey] || {
        accumulated: 0,
        paid: 0,
        pending: 0,
        attendanceCount: 0,
        uniqueClientsCount: 0,
        saleCommissionCount: 0,
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
      const monthlyNet = monthlyAppointmentsForPro.reduce((total, apt) => {
        const baseValue = calculateServiceTotal(apt);
        const cardTaxAmount = getCardTaxAmountForServiceBase(apt, baseValue);
        const baseAfterTax = establishment?.tax_deducted_by_establishment ? baseValue : Math.max(0, baseValue - cardTaxAmount);
        const effectivePercentage = getEffectiveProfessionalPercentageForAppointment(apt, professional);
        const tip = apt.status === 'completed' ? getProfessionalTipAmount(apt) : 0;
        return total + (baseAfterTax * effectivePercentage) / 100 + tip;
      }, 0);

      return {
        dailyGross,
        dailyNet,
        monthlyGross: monthlyGross + (isOwnerProfessional(professional) ? 0 : subscriberFinancial.pending),
        monthlyNet: monthlyNet + (isOwnerProfessional(professional) ? 0 : subscriberFinancial.pending),
        basePercentage: percentage,
        metaBonusPercentage: Number(goalProgress?.bonusPercentage || 0),
        metaGoalReached: Boolean(goalProgress?.goalReached),
        metaServiceCount: Array.isArray(goalProgress?.selectedServiceNames) ? goalProgress.selectedServiceNames.length : 0,
        appointmentsToday: dailyAppointments.length, // Apenas concluídos (igual ao contador verde da agenda)
        appointmentsMonth: monthlyAppointmentsForCount.length, // Contagem: todos não cancelados
        subscriberMonthlyAccumulated: subscriberFinancial.accumulated,
        subscriberMonthlyPaid: subscriberFinancial.paid,
        subscriberMonthlyPending: subscriberFinancial.pending,
        subscriberAttendanceCount: subscriberFinancial.attendanceCount,
        subscriberClientsCount: subscriberFinancial.uniqueClientsCount,
        subscriberSalesCount: subscriberFinancial.saleCommissionCount,
      };
    };

    // Função para buscar serviços do estabelecimento
    const fetchEstablishmentServices = async (professionalId?: string) => {
      if (!establishment?.id) return [];

      try {
        const categoryServices: any[] = [];
        const legacyServices: any[] = [];

        // Buscar serviços de service_subcategories (sistema de categorias)
        const { data: subcategoriesData } = await supabase
          .from('service_subcategories')
          .select(`
          *,
          service_categories!inner (
            establishment_id
          )
        `)
          .eq('service_categories.establishment_id', establishment.id)
          .eq('is_active', true);

        if (subcategoriesData) {
          subcategoriesData.forEach((sub: any) => {
            categoryServices.push({
              id: sub.id,
              name: sub.name,
              price: Number(sub.price),
              duration: Number(sub.duration || 30)
            });
          });
        }

        // Buscar serviços salvos em services_with_prices (sistema antigo)
        const { data: establishmentData } = await supabase
          .from('establishments')
          .select('services_with_prices')
          .eq('id', establishment.id)
          .single();

        if (establishmentData?.services_with_prices) {
          establishmentData.services_with_prices.forEach((service: any) => {
            legacyServices.push({
              id: service.id,
              name: service.name,
              price: Number(service.price),
              duration: Number(service.duration || 30)
            });
          });
        }

        // Serviços específicos do profissional selecionado (fallback quando não há "Meus Serviços")
        const selectedProfessional = professionals.find((p) => p.id === professionalId);
        const specificServicesRaw = Array.isArray((selectedProfessional as any)?.specific_services)
          ? (selectedProfessional as any).specific_services
          : [];
        const specificServices = specificServicesRaw
          .map((service: any, index: number) => ({
            id: service?.id || `specific_${professionalId || 'professional'}_${index}`,
            name: String(service?.name || '').trim(),
            price: Number(service?.price || 0),
            duration: Number(service?.duration || 30),
          }))
          .filter((service: any) => service.name.length > 0);

        // ✅ Compatibilidade:
        // 1) Se houver serviços de categorias (Meus Serviços), mantém o fluxo antigo (categorias + legado)
        // 2) Se NÃO houver categorias e existir serviço específico do profissional, prioriza os específicos
        const generalServices = [...categoryServices, ...legacyServices];
        const selectedSource = categoryServices.length === 0 && specificServices.length > 0
          ? specificServices
          : generalServices;

        // Remover duplicatas por ID
        const uniqueServices = selectedSource.reduce((acc: any[], service: any) => {
          if (!acc.find(s => s.id === service.id)) {
            acc.push(service);
          }
          return acc;
        }, []);

        return uniqueServices;
      } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        return [];
      }
    };

    // Opções de assinatura para encaixe (sem restrição por cliente)
    const fetchEstablishmentSubscriptionsForSqueeze = async () => {
      if (!establishment?.id) return [];
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('id, name, value, service_duration')
          .eq('establishment_id', establishment.id)
          .order('created_at', { ascending: true });

        if (error) throw error;

        return (data || [])
          .map((sub: any) => ({
            id: `subscription_${String(sub?.id || '')}`,
            name: String(sub?.name || '').trim(),
            price: 0,
            duration: Number(sub?.service_duration || 30),
            plan_value: Number(sub?.value || 0),
            is_subscription: true,
          }))
          .filter((sub: any) => sub.name.length > 0);
      } catch (error) {
        console.error('Erro ao buscar assinaturas para encaixe:', error);
        return [];
      }
    };

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
              const message = String(withExtra.error?.message || '').toLowerCase();
              const missingColumn =
                message.includes('column') &&
                (message.includes('cpf') || message.includes('street'));
              if (!missingColumn && typeof window !== 'undefined') {
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
        const clientName = selectedClient
          ? String(selectedClient.name || 'Cliente').trim() || 'Cliente'
          : 'ENCAIXE';
        const clientWhatsapp = selectedClient
          ? String(selectedClient.whatsapp || '').trim()
          : '';
        const knownClientId = selectedClient?.client_id ? String(selectedClient.client_id).trim() : '';
        const clientIdForInsert = knownClientId && isUuid(knownClientId) ? knownClientId : fallbackClientId;
        const isAvulsoSqueeze = !selectedClient;

        const { error } = await supabase
          .from('appointments')
          .insert({
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
            is_squeeze: true // Marcar como encaixe
          });

        if (error) throw error;

        toast.success('Encaixe criado com sucesso!');

        // Fechar modais e limpar estados
        setShowSqueezeServiceModal(false);
        setShowSqueezeTimeModal(false);
        setShowSqueezeClientModal(false);
        setSelectedSqueezeService(null);
        setSqueezeStartTime('');
        setSqueezeEndTime('');
        setSelectedSqueezeKnownClientId('');
        setSqueezeKnownClientSearch('');
        setSelectedProfessionalForSqueeze(null);

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
      <div className="space-y-4">
        {/* Cabeçalho com navegação de data - MOVIDO PARA O TOPO */}
        <div className="bg-white rounded-lg p-2 sm:p-4 border border-gray-300 shadow-sm">
          <h2 className="text-lg sm:text-2xl font-bold text-black mb-2 sm:mb-4">
            Agendamentos do Dia
          </h2>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
            <button
              onClick={handlePreviousDay}
              className="p-1.5 sm:p-2 md:p-3 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors shadow-md flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </button>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={handleDateInputChange}
              className="flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-xs sm:text-sm md:text-base font-semibold text-black bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 transition-colors"
            />
            <button
              onClick={handleNextDay}
              className="p-1.5 sm:p-2 md:p-3 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors shadow-md flex-shrink-0"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </button>
          </div>
          {/* Seletor de Profissional - MOBILE (opcional) */}
          <div className="md:hidden mt-2 sm:mt-4">
            <label className="block text-xs sm:text-sm font-medium text-gray-800 mb-1 sm:mb-2">
              Pular para Profissional (ou arraste abaixo):
            </label>
            <select
              value={selectedProfessionalId}
              onChange={(e) => {
                setSelectedProfessionalId(e.target.value);
                // Scroll horizontal para o profissional selecionado
                setTimeout(() => {
                  const professionalIndex = professionals.findIndex(p => p.id === e.target.value);
                  const scrollContainer = document.querySelector('.mobile-scroll-container');
                  if (scrollContainer && professionalIndex >= 0) {
                    scrollContainer.scrollTo({
                      left: professionalIndex * 280,
                      behavior: 'smooth'
                    });
                  }
                }, 100);
              }}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 bg-white text-black font-semibold text-sm sm:text-base transition-colors"
            >
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id} className="text-black font-normal">
                  {prof.name}
                </option>
              ))}
            </select>
          </div>

          {/* Texto de ajuda */}
          <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2 text-center">
            👈 Arraste para o lado para ver mais profissionais 👉
          </p>
          <div className="mt-3 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleOpenBarbershopCash}
              data-tutorial-id="appointments-caixa"
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              disabled={isLoadingBarbershopCashOpening}
            >
              {`CAIXA DA BARBEARIA (${format(selectedDate, 'dd/MM/yyyy')})`}
            </button>
            {canViewBarbershopCash ? (
              <p className="text-xs text-emerald-700 font-medium text-center">
                Total em caixa hoje: {formatCurrency(barbershopCashTotal)} (abertura {formatCurrency(barbershopCashOpeningValue)} + dinheiro {formatCurrency(dailyCashSalesTotal)})
              </p>
            ) : (
              <p className="text-xs text-gray-500 text-center">
                Valor protegido por senha de 4 digitos.
              </p>
            )}
          </div>
        </div>

        {showBarbershopCashModal && canViewBarbershopCash && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/30 bg-gradient-to-b from-[#0b0b0c] to-black">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-extrabold text-lg">Caixa da barbearia</div>
                    <div className="text-xs text-white/70 mt-1">{format(selectedDate, 'dd/MM/yyyy')}</div>
                    <p className="text-sm text-white/80 mt-2">Informe o valor em especie inicial do dia.</p>
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
              <div className="p-4 space-y-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 150,00"
                  value={barbershopCashOpeningInput}
                  onChange={(e) => setBarbershopCashOpeningInput(e.target.value.replace(',', '.'))}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-lg font-medium placeholder:text-white/50 focus:outline-none focus:border-emerald-400"
                />
                <div className="text-xs text-white/70 space-y-1">
                  <p>Abertura registrada: <span className="font-semibold text-white">{formatCurrency(barbershopCashOpeningValue)}</span></p>
                  <p>Vendas em dinheiro no dia: <span className="font-semibold text-white">{formatCurrency(dailyCashSalesTotal)}</span></p>
                  <p>Total em caixa no dia: <span className="font-semibold text-emerald-300">{formatCurrency(barbershopCashTotal)}</span></p>
                  <p className="text-white/60">* Considera apenas agendamentos concluidos no dia.</p>
                </div>
                <div className="mt-2 border border-white/10 rounded-xl p-3 bg-white/[0.03]">
                  <p className="text-xs font-semibold text-white/80 mb-2">Historico de abertura (diario)</p>
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
                            <span className="font-semibold">{format(parseISO(`${item.cash_date}T00:00:00`), 'dd/MM/yyyy')}</span>
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
                <button
                  type="button"
                  disabled={isSavingBarbershopCashOpening}
                  onClick={handleSaveBarbershopCashOpening}
                  className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:pointer-events-none text-black font-bold py-3 transition-colors"
                >
                  {isSavingBarbershopCashOpening ? 'Salvando...' : 'Salvar abertura'}
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
                    'bg-green-600'
                  }`}>
                  {showColorLegend === 'red' && <span className="text-white text-2xl">❌</span>}
                  {showColorLegend === 'yellow' && <span className="text-white text-2xl">⏳</span>}
                  {showColorLegend === 'green' && <span className="text-white text-2xl">✅</span>}
                </div>

                <h3 className="text-xl font-bold text-white mb-2">
                  {showColorLegend === 'red' ? 'Agendamentos Cancelados' :
                    showColorLegend === 'yellow' ? 'Clientes que ainda não pagaram' :
                      'Agendamentos Concluídos ou Pagos'}
                </h3>

                <p className="text-gray-300 mb-4">
                  {showColorLegend === 'red' ? 'Agendamentos que foram cancelados pelo cliente ou estabelecimento.' :
                    showColorLegend === 'yellow' ? 'Agendamentos agendados mas ainda não realizados ou pagos.' :
                      'Agendamentos que foram concluídos com sucesso e pagos.'}
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
                            <div className="text-xs text-gray-700 truncate">{apt.service}</div>
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
                    {cancelledHistoryRows.map((apt) => (
                      <div key={`cancelled-history-${apt.id}`} className="rounded-lg border border-red-200 p-3 bg-red-50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-gray-900 truncate">
                              {String(getDisplayedClientName(apt) || apt.client_name || 'Cliente')}
                            </div>
                            <div className="text-xs text-gray-700 truncate">{String(apt.service || 'Serviço não informado')}</div>
                            <div className="text-[11px] text-gray-700 mt-1">
                              Data: {String(apt.appointment_date || '').slice(0, 10).split('-').reverse().join('/')} • Horário: {String(apt.appointment_time || '--:--')}
                            </div>
                            <div className="text-[11px] text-gray-700">
                              Duração: {formatDuration(getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos))}
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
                            <div className="text-[11px] font-bold text-red-700">CANCELADO</div>
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

        {/* Layout Horizontal Scrollável - MOBILE E DESKTOP */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <style>{`
          .scroll-container-top {
            overflow-x: auto;
            transform: rotateX(180deg);
          }
          .scroll-content-flip {
            transform: rotateX(180deg);
          }
          .mobile-scroll-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        `}</style>
          <div className="scroll-container-top mobile-scroll-container">
            <div className="flex gap-0 min-w-max scroll-content-flip">
              {professionals.map((professional, index) => {
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
                    parse(a.appointment_time, 'HH:mm', selectedDate).getTime() -
                    parse(b.appointment_time, 'HH:mm', selectedDate).getTime()
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

                const completedCount = appointments.filter((apt) =>
                  appointmentBelongsToProfessionalColumn(apt, professional) &&
                  apt.appointment_date === selectedDateStr &&
                  apt.status === 'completed'
                ).length;

                const cancelledAppointments = appointments
                  .filter((apt) =>
                    appointmentBelongsToProfessionalColumn(apt, professional) &&
                    apt.appointment_date === selectedDateStr &&
                    apt.status === 'cancelled'
                  )
                  .sort((a, b) =>
                    parse(a.appointment_time, 'HH:mm', selectedDate).getTime() -
                    parse(b.appointment_time, 'HH:mm', selectedDate).getTime()
                  );

                const cancelledCount = cancelledAppointments.length;

                const hiddenOpen =
                  hiddenAppointments.length > 0 &&
                  (hiddenAppointmentsOpenByProfessional[professional.id] ?? true);

                return (
                  <div
                    key={professional.id}
                    data-tutorial-id="appointments-professional-area"
                    className={`flex-shrink-0 ${index !== 0
                      ? useLightLayout
                        ? 'border-l border-black/20'
                        : 'border-l-4 border-gray-400'
                      : ''
                      }`}
                    style={{ width: '280px' }}
                  >
                    {/* Cabeçalho do Profissional */}
                    <div className={`p-2 sticky top-0 z-10 ${useLightLayout
                      ? 'bg-gray-100 border-b-2 border-gray-300'
                      : 'bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700'
                      }`}>
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => setSelectedProfessionalForInfo(professional.id)}
                          className="group relative"
                        >
                          {professional.photo_url ? (
                            <img
                              src={professional.photo_url}
                              alt={professional.name}
                              className={`w-14 h-14 rounded-full object-cover border-2 shadow-md group-hover:scale-110 transition-transform cursor-pointer ${useLightLayout ? 'border-gray-300' : 'border-white'
                                }`}
                            />
                          ) : (
                            <div className={`w-14 h-14 rounded-full bg-white flex items-center justify-center text-2xl border-2 shadow-md group-hover:scale-110 transition-transform cursor-pointer ${useLightLayout ? 'border-gray-300' : 'border-white'
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
                              💰
                            </span>
                          </div>
                        </button>
                        <h3 className={`font-bold text-sm mt-1 text-center ${useLightLayout ? 'text-gray-900' : 'text-white'
                          }`}>
                          {professional.name}
                        </h3>
                        <p className={`text-xs ${useLightLayout ? 'text-gray-600' : 'text-gray-300'
                          }`}>
                          {appointmentsLocked ? '🔒 agenda protegida' : `${professionalAppointmentsCount} agend.`}
                        </p>
                        <div className="space-y-1 mt-1">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                if (financialLocked) {
                                  onRequestFinancialUnlock?.(professional.id);
                                  return;
                                }
                                setSelectedProfessionalForInfo(professional.id);
                              }}
                              data-tutorial-id="appointments-financeiro"
                              className={`flex-1 px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                }`}
                            >
                              {financialLocked ? '🔒 Financeiro' : '💰 Financeiro'}
                            </button>
                            {onGoToProfessionalConfig && (
                              <button
                                onClick={() => onGoToProfessionalConfig(professional.id)}
                                data-tutorial-id="appointments-config"
                                className={`flex-1 px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                  ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                  : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                  }`}
                                title="Ir para configurações do profissional"
                              >
                                ⚙️ Config
                              </button>
                            )}
                          </div>
                          {onOpenBlockHoursModal && (
                            <button
                              onClick={() => onOpenBlockHoursModal(professional.id)}
                              data-tutorial-id="appointments-bloquear-horarios"
                              className={`w-full px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                }`}
                              title="Bloquear horários deste profissional"
                              disabled={appointmentsLocked}
                            >
                              {appointmentsLocked ? '🔒 Agenda protegida' : '🔒 Bloquear horários'}
                            </button>
                          )}
                          {onOpenAbsenceModal && (
                            <button
                              onClick={() => onOpenAbsenceModal(professional.id)}
                              data-tutorial-id="appointments-ausencia"
                              className={`w-full px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                }`}
                              title="Configurar dias de ausência deste profissional"
                              disabled={appointmentsLocked}
                            >
                              {appointmentsLocked ? '🔒 Agenda protegida' : '📅 Bloquear dia todo'}
                            </button>
                          )}
                          {onGoToClients && (
                            <button
                              onClick={() => onGoToClients(professional.id)}
                              data-tutorial-id="appointments-criar-reserva"
                              className={`w-full px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                }`}
                              title="Ir para Meus Clientes"
                            >
                              📅 Agendar cliente
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
                            className={`w-full px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                              ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                              : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                              }`}
                            title="Criar Encaixe"
                            disabled={appointmentsLocked}
                          >
                            {appointmentsLocked ? '🔒 Agenda protegida' : '🟣 Criar Encaixe'}
                          </button>

                          <button
                            onClick={() => {
                              if (appointmentsLocked) {
                                onRequestAppointmentsUnlock?.(professional.id);
                                return;
                              }
                              setAvailabilityProfessionalId(professional.id);
                              setAvailabilityProfessionalName(professional.name);
                              setAvailabilitySlots(timeSlots);
                              setShowAvailabilityModal(true);
                            }}
                            className={`w-full px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                              ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                              : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                              }`}
                            title="Ver horários disponíveis (somente visualização)"
                            disabled={appointmentsLocked}
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {appointmentsLocked ? 'Agenda protegida' : 'Horários disponíveis'}
                            </span>
                          </button>
                        </div>

                        {/* Contadores de Status por Profissional */}
                        <div className="mt-2 flex gap-1 text-xs">
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
                            className="px-2 py-1 bg-red-600/80 text-white rounded border border-red-700 hover:bg-red-700 transition-colors"
                            title="Ver histórico de cancelados deste profissional no dia"
                          >
                            {appointmentsLocked ? '🔒' : `❌ ${cancelledCount}`}
                          </button>
                          <span className="px-2 py-1 bg-yellow-600/80 text-white rounded border border-yellow-700">
                            {appointmentsLocked ? '🔒' : `⏳ ${pendingCount}`}
                          </span>
                          <span className="px-2 py-1 bg-green-600/80 text-white rounded border border-green-700">
                            {appointmentsLocked ? '🔒' : `✅ ${completedCount}`}
                          </span>
                        </div>

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
                    <div className={`p-2 min-h-[500px] ${useLightLayout ? 'bg-gray-100' : 'bg-gray-100'
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
                                  className={`rounded-xl border-2 shadow-sm overflow-hidden ${
                                    useLightLayout
                                      ? 'bg-gradient-to-br from-slate-400 to-slate-500 border-slate-600'
                                      : 'bg-gradient-to-br from-gray-500 to-gray-600 border-gray-700'
                                  }`}
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
                                        className={`shrink-0 px-3 py-2 text-xs font-bold text-white border-l border-white/25 transition-colors disabled:opacity-50 ${
                                          useLightLayout
                                            ? 'bg-emerald-700 hover:bg-emerald-800'
                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                        }`}
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
                              const blockBusy =
                                slotBlockBusyKey === `${professional.id}__${slot.time}`;
                              const canQuickBlock =
                                !!onToggleProfessionalSlotBlocked && !slot.isPast;
                              return (
                                <div key={`${slot.time}-${slotIndex}`}>
                                  <div
                                    className={`rounded-xl border-2 shadow-sm overflow-hidden flex items-stretch min-h-[52px] ${
                                      isAbsentSlot
                                        ? 'bg-gradient-to-br from-amber-50 to-amber-100/90 border-amber-400'
                                        : useLightLayout
                                          ? 'bg-gradient-to-br from-white to-emerald-50/80 border-emerald-300'
                                          : 'bg-gradient-to-br from-white to-emerald-50 border-emerald-400/90'
                                    }`}
                                  >
                                    <div className="flex-1 flex flex-col justify-center px-3 py-2.5 min-w-0">
                                      <span
                                        className={`font-extrabold text-base tracking-tight ${
                                          isAbsentSlot ? 'text-amber-900' : 'text-gray-900'
                                        }`}
                                      >
                                        {slot.time}
                                      </span>
                                      <span
                                        className={`text-[11px] font-bold mt-0.5 ${
                                          isAbsentSlot ? 'text-amber-800' : 'text-emerald-700'
                                        }`}
                                      >
                                        {isAbsentSlot ? '📅 Ausência neste dia' : '✓ Livre para agendar'}
                                      </span>
                                    </div>
                                    {canQuickBlock ? (
                                      <button
                                        type="button"
                                        disabled={!!slotBlockBusyKey}
                                        onClick={() => runToggleSlotBlock(professional.id, slot.time, true)}
                                        className={`shrink-0 px-3 py-2 text-xs font-bold text-white border-l border-white/20 transition-colors disabled:opacity-50 ${
                                          useLightLayout
                                            ? 'bg-slate-800 hover:bg-slate-900'
                                            : 'bg-slate-700 hover:bg-slate-800'
                                        }`}
                                        title="Bloqueia só este horário neste dia (igual ao menu Bloquear horários)"
                                      >
                                        {blockBusy ? '…' : 'Bloquear'}
                                      </button>
                                    ) : null}
                                  </div>
                                  {/* Exibir encaixes abaixo do horário */}
                                  {squeezes.map((squeeze: Appointment) => {
                                    const isExpanded = expandedAppointments[squeeze.id];
                                    return (
                                      <div
                                        key={squeeze.id}
                                        className="bg-gray-700 border-2 border-gray-600 rounded-lg mt-1 overflow-hidden"
                                      >
                                        <div className="px-3 py-2">
                                          <div
                                            onClick={() => toggleAppointmentExpansion(squeeze.id)}
                                            className="cursor-pointer"
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-white font-bold text-sm">
                                                {squeeze.appointment_time} 🟣 {squeeze.is_subscriber ? 'ENCAIXE ASSINANTE' : 'ENCAIXE'}
                                              </span>
                                              <span className="text-white text-xs font-bold">
                                                {formatCurrency(calculateTotalPrice(squeeze))}
                                              </span>
                                            </div>
                                            <div className="text-white font-semibold text-sm mb-1 truncate">
                                              {squeeze.service}
                                            </div>
                                            <div className="text-white/70 text-xs mt-1">
                                              {getDuracaoTotalAgendamento(squeeze, intervaloAgendaMinutos)} min • {isExpanded ? 'Ocultar' : 'Ver detalhes'}
                                            </div>
                                          </div>
                                        </div>
                                        {/* Versão expandida do encaixe */}
                                        {isExpanded && (
                                          <div className="border-t-2 border-white/20 p-3 bg-black/10">
                                            <div className="mb-3">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-white font-semibold">
                                                  {squeeze.is_subscriber ? 'ENCAIXE ASSINANTE' : 'ENCAIXE'}
                                                </span>
                                              </div>
                                            </div>
                                            <div className="mb-3 text-xs text-white/90 space-y-1">
                                              <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(parseISO(squeeze.appointment_date), 'dd/MM/yyyy')}
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
                              const isExpanded = expandedAppointments[apt.id];
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
                                  <div className="px-3 py-2">
                                    <div
                                      onClick={() => toggleAppointmentExpansion(apt.id)}
                                      data-tutorial-id="appointments-detalhes-agendamento"
                                      className="cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-white font-bold text-sm">
                                          {apt.is_squeeze ? apt.appointment_time : slot.time}{' '}
                                          {apt.is_squeeze && '🟣'}
                                          {apt.is_squeeze && apt.status === 'completed' && (
                                            <span className="ml-1" title="Encaixe concluído">
                                              ✅
                                            </span>
                                          )}
                                        </span>
                                        <span className="text-white text-xs font-bold">
                                          {formatCurrency(calculateTotalPrice(apt))}
                                        </span>
                                      </div>
                                      <div className="text-white font-semibold text-sm mb-1 truncate">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="truncate">
                                            {apt.is_squeeze
                                              ? (apt.is_subscriber ? 'ENCAIXE ASSINANTE' : 'ENCAIXE')
                                              : getDisplayedClientNameWithSubscriberLabel(apt)}
                                          </span>
                                          {serviceLabels.map((label) => (
                                            <span
                                              key={`${apt.id}-${label.name}-${label.color}`}
                                              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-white/30 shrink-0"
                                              style={{ backgroundColor: label.color, color: getLabelTextColor(label.color) }}
                                              title={`Etiqueta: ${label.name}`}
                                            >
                                              {label.name}
                                            </span>
                                          ))}
                                          {isAvulsoLike(apt) && !apt.is_squeeze && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // abrir detalhes e já focar edição
                                                setExpandedAppointments((prev) => ({ ...prev, [apt.id]: true }));
                                                startEditAvulsoName(apt);
                                              }}
                                              className="shrink-0 text-white/80 hover:text-white text-xs"
                                              title="Editar nome do cliente avulso"
                                            >
                                              ✏️
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-white/90 text-xs truncate">
                                        {subscriptionLabelColor && (
                                          <span
                                            className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle border border-white/70"
                                            style={{ backgroundColor: subscriptionLabelColor }}
                                            title="Etiqueta da assinatura"
                                          />
                                        )}
                                        {apt.service}
                                      </div>
                                      <div className="text-white/70 text-xs mt-1">
                                        {getDuracaoTotalAgendamento(apt, intervaloAgendaMinutos)} min • {isExpanded ? 'Ocultar' : 'Ver detalhes'}
                                      </div>
                                    </div>

                                    {/* Botão Enviar Lembrete - Aparece quando NÃO expandido */}
                                    {!isExpanded && apt.status !== 'cancelled' && (
                                      <div className="mt-2 pt-2 border-t border-white/20">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenReminderModal) onOpenReminderModal(apt);
                                          }}
                                          className="w-full px-2 py-1.5 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
                                          title="Enviar lembrete via WhatsApp"
                                        >
                                          📱 Enviar lembrete
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Versão Expandida - Só aparece quando clicado */}
                                  {isExpanded && (
                                    <div className="border-t-2 border-white/20 p-3 bg-black/10">
                                      {/* Cliente Info */}
                                      <div className="mb-3">
                                        <div className="flex items-center gap-2 mb-2">
                                          <User className="w-4 h-4 text-white" />
                                          <span className="text-white font-semibold">
                                            {apt.is_squeeze
                                              ? (apt.is_subscriber ? 'ENCAIXE ASSINANTE' : 'ENCAIXE')
                                              : getDisplayedClientNameWithSubscriberLabel(apt)}
                                          </span>
                                          {serviceLabels.map((label) => (
                                            <span
                                              key={`expanded-${apt.id}-${label.name}-${label.color}`}
                                              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-white/30"
                                              style={{ backgroundColor: label.color, color: getLabelTextColor(label.color) }}
                                              title={`Etiqueta: ${label.name}`}
                                            >
                                              {label.name}
                                            </span>
                                          ))}
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
                                          <a
                                            href="#"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              const phoneNumber = `55${String(apt.client_whatsapp || '').replace(/\D/g, '')}`;
                                              openWhatsAppWithBusinessPriority(phoneNumber, '');
                                            }}
                                            className="text-white/90 text-xs flex items-center gap-1 hover:text-white"
                                          >
                                            <Phone className="w-3 h-3" />
                                            {apt.client_whatsapp}
                                          </a>
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
                                          {format(parseISO(apt.appointment_date), 'dd/MM/yyyy')}
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
                                            onChange={(e) => handlePaymentMethodChange(apt, e.target.value)}
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
                                        <div className="space-y-2">
                                          {/* Botões principais */}
                                          <div className="grid grid-cols-2 gap-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'produto_v2', 'Clique em Adicionar Produto.');
                                                if (onOpenProductV2Modal) onOpenProductV2Modal(apt.id);
                                              }}
                                              data-tutorial-id="appointments-detalhes-produto"
                                              className="px-2 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800 flex items-center justify-center gap-1"
                                            >
                                              <Package className="w-3 h-3" />
                                              Adicionar Produto
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'servico_extra', 'Clique em Serviço Extra.');
                                                if (onOpenAdditionalProductModal) onOpenAdditionalProductModal(apt.id);
                                              }}
                                              data-tutorial-id="appointments-detalhes-servico-extra"
                                              className="px-2 py-1.5 text-xs bg-white/20 text-white rounded hover:bg-white/30 flex items-center justify-center gap-1"
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
                                              className={`px-2 py-1.5 text-xs text-white rounded transition-colors ${apt.is_squeeze ? 'bg-gray-700 hover:bg-gray-600' : 'bg-green-600 hover:bg-green-700'
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
                                              className="px-2 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                            >
                                              ⏳ PENDENTE
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'transferir_click', 'Clique em Transferir.');
                                                if (onOpenTransferModal) onOpenTransferModal(apt);
                                              }}
                                              data-tutorial-id="appointments-detalhes-transferir"
                                              className="px-2 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800"
                                            >
                                              🔄 TRANSFERIR
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'terminei_antes_click', 'Clique em Terminei Antes.');
                                                if (onOpenFinishEarlyModal) onOpenFinishEarlyModal(apt);
                                              }}
                                              data-tutorial-id="appointments-detalhes-terminei-antes"
                                              className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                              title="Terminei antes do tempo planejado"
                                            >
                                              ⏱️ Terminei Antes
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                void logAppointmentCardActionClick(apt, 'cancelar_click', 'Clique em Cancelar.');
                                                // Se tiver função de cancelamento customizada, usar ela (para pedir senha)
                                                if (onCancelAppointment) {
                                                  onCancelAppointment(apt.id);
                                                } else {
                                                  // Fallback: cancelar direto
                                                  handleUpdateAppointmentStatus(apt.id, 'cancelled');
                                                }
                                              }}
                                              data-tutorial-id="appointments-detalhes-cancelar"
                                              className="px-2 py-1.5 text-xs bg-red-700 text-white rounded hover:bg-red-800"
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
                                              className="px-2 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-700"
                                              title="Enviar mensagem de imprevisto"
                                            >
                                              IMPREVISTO
                                            </button>

                                            {onGenerateNF && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  void logAppointmentCardActionClick(apt, 'baixar_nf_click', 'Clique em Baixar NF.');
                                                  onGenerateNF({
                                                    ...apt,
                                                    client_cpf: displayedCpf || apt.client_cpf,
                                                    client_street: displayedStreet || (apt as any).client_street,
                                                  });
                                                }}
                                                data-tutorial-id="appointments-detalhes-baixar-nf"
                                                className="col-span-2 px-2 py-1.5 text-xs bg-emerald-700 text-white rounded hover:bg-emerald-800 font-extrabold"
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
                                                    onClientNoShow(apt);
                                                  }}
                                                  data-tutorial-id="appointments-detalhes-cliente-faltou"
                                                  className="px-2 py-1.5 text-xs bg-orange-700 text-white rounded hover:bg-orange-800"
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
                                                  setTipModalAppointment(apt);
                                                  const cur = getProfessionalTipAmount(apt);
                                                  setTipModalInput(cur > 0 ? String(cur).replace('.', ',') : '');
                                                }}
                                                data-tutorial-id="appointments-detalhes-gorjeta"
                                                className={`px-2 py-1.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 font-semibold flex items-center justify-center gap-1 ${onClientNoShow ? '' : 'w-full'}`}
                                                title="Gorjeta: 100% para o profissional, fora da % sobre o serviço"
                                              >
                                                <Coins className="h-3.5 w-3.5 shrink-0" />
                                                Gorjeta
                                              </button>
                                            </div>
                                          </div>

                                          {/* Botões secundários */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'atendimento_assinatura_click', 'Clique em Atendimento assinatura.');
                                              handleOpenSubscriberAttendanceModal(apt);
                                            }}
                                            data-tutorial-id="appointments-detalhes-assinatura"
                                            className="w-full px-2 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-extrabold"
                                            title="Selecionar um assinante e registrar 1 atendimento concluído"
                                          >
                                            ✅ Atendimento assinatura
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'trocar_horario_click', 'Clique em Trocar horário.');
                                              handleOpenRescheduleModal(apt);
                                            }}
                                            data-tutorial-id="appointments-detalhes-trocar-horario"
                                            className="w-full px-2 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 font-extrabold"
                                            title="Trocar a data/horário deste agendamento"
                                          >
                                            🕒 Trocar horário
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'trocar_servico_click', 'Clique em Trocar serviço.');
                                              handleOpenChangeServiceModal(apt);
                                            }}
                                            data-tutorial-id="appointments-detalhes-trocar-servico"
                                            className="w-full px-2 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800 font-extrabold"
                                            title="Trocar o serviço (altera valor e duração)"
                                          >
                                            ✂️ Trocar serviço
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'minhas_observacoes_click', 'Clique em Minhas Observações.');
                                              if (onOpenObservationModal) onOpenObservationModal(apt.id, apt.establishment_observation);
                                            }}
                                            data-tutorial-id="appointments-detalhes-observacoes"
                                            className="w-full px-2 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                                          >
                                            📝 Minhas Observações
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void logAppointmentCardActionClick(apt, 'ver_historico_click', 'Clique em Ver histórico.');
                                              void handleOpenAppointmentHistoryModal(apt);
                                            }}
                                            className="w-full px-2 py-1.5 text-xs bg-amber-700 text-white rounded hover:bg-amber-800"
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
                                            className="w-full px-2 py-1.5 text-xs bg-emerald-700 text-white rounded hover:bg-emerald-800 flex items-center justify-center gap-1"
                                          >
                                            ↩️ Restabelecer agendamento
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteAppointment(apt.id);
                                            }}
                                            className="w-full px-2 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 flex items-center justify-center gap-1"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                            🗑️ EXCLUIR
                                          </button>
                                        </div>
                                      )}
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
                                              ? (apt.is_subscriber ? 'ENCAIXE ASSINANTE' : 'ENCAIXE')
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
                                            {apt.service}
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
                                              {(() => {
                                                const createdRaw = String((apt as any)?.created_at || '').trim();
                                                if (!createdRaw) return 'Não disponível';
                                                try {
                                                  return format(parseISO(createdRaw), 'dd/MM/yyyy HH:mm');
                                                } catch {
                                                  return createdRaw;
                                                }
                                              })()}
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
                          ? (apt.is_subscriber ? 'ENCAIXE ASSINANTE' : 'ENCAIXE')
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

        {/* Modal: Histórico do agendamento */}
        {showAppointmentHistoryModal && selectedAppointmentForHistory && (
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-white">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-gray-900 font-extrabold text-lg">Histórico do agendamento</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {String(getDisplayedClientName(selectedAppointmentForHistory) || selectedAppointmentForHistory.client_name || 'Cliente')} • {selectedAppointmentForHistory.appointment_time}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAppointmentHistoryModal}
                    className="h-9 w-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center"
                    title="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="text-xs font-extrabold text-gray-800 mb-2">Resumo do agendamento</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
                    <div>
                      <span className="font-semibold">Cliente:</span>{' '}
                      {String(getDisplayedClientName(selectedAppointmentForHistory) || selectedAppointmentForHistory.client_name || 'Cliente')}
                    </div>
                    <div>
                      <span className="font-semibold">Profissional:</span>{' '}
                      {getProfessionalName(String(selectedAppointmentForHistory.professional || ''))}
                    </div>
                    <div>
                      <span className="font-semibold">Agendado para:</span>{' '}
                      {String(selectedAppointmentForHistory.appointment_date || '').slice(0, 10).split('-').reverse().join('/')} às {String(selectedAppointmentForHistory.appointment_time || '--:--')}
                    </div>
                    <div>
                      <span className="font-semibold">Criado em:</span>{' '}
                      {(() => {
                        const createdRaw = String((selectedAppointmentForHistory as any)?.created_at || '').trim();
                        if (!createdRaw) return 'Não disponível';
                        try {
                          return format(parseISO(createdRaw), 'dd/MM/yyyy HH:mm');
                        } catch {
                          return createdRaw;
                        }
                      })()}
                    </div>
                    <div>
                      <span className="font-semibold">Origem:</span>{' '}
                      {getAppointmentOriginLabel(selectedAppointmentForHistory)}
                    </div>
                    <div>
                      <span className="font-semibold">Tipo:</span>{' '}
                      {selectedAppointmentForHistory.is_subscriber ? 'Assinante' : selectedAppointmentForHistory.is_avulso ? 'Avulso' : 'Normal'}
                    </div>
                    <div>
                      <span className="font-semibold">Serviço:</span>{' '}
                      {String(selectedAppointmentForHistory.service || 'Não informado')}
                    </div>
                    <div>
                      <span className="font-semibold">Valor:</span>{' '}
                      {formatCurrency(calculateTotalPrice(selectedAppointmentForHistory))}
                    </div>
                  </div>
                </div>

                {isLoadingAppointmentHistory ? (
                  <div className="text-sm text-gray-600">Carregando histórico...</div>
                ) : appointmentHistoryRows.length === 0 ? (
                  <div className="text-sm text-gray-600">Sem histórico para este agendamento.</div>
                ) : (
                  appointmentHistoryRows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-extrabold text-gray-900">{getHistoryEventLabel(row.event_type)}</div>
                        <div className="text-xs text-gray-600">
                          {(() => {
                            try {
                              return format(parseISO(String(row.created_at)), 'dd/MM/yyyy HH:mm');
                            } catch {
                              return String(row.created_at || '');
                            }
                          })()}
                        </div>
                      </div>
                      {row.description && (
                        <div className="text-xs text-gray-700 mt-1">{row.description}</div>
                      )}
                      {row.changed_by_name && (
                        <div className="text-[11px] text-gray-500 mt-1">Por: {row.changed_by_name}</div>
                      )}

                      <div className="mt-2 rounded border border-gray-200 bg-white p-2 space-y-1">
                        {buildHistoryHighlights(row).map((line, idx) => (
                          <div key={`${row.id}-line-${idx}`} className="text-xs text-gray-800">
                            • {line}
                          </div>
                        ))}
                      </div>

                      <details className="mt-2 rounded border border-gray-200 bg-white p-2">
                        <summary className="text-[11px] font-semibold text-gray-700 cursor-pointer">
                          Ver detalhes técnicos
                        </summary>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div className="rounded border border-gray-200 bg-gray-50 p-2">
                            <div className="text-[11px] font-bold text-gray-700 mb-1">Antes</div>
                            <pre className="text-[10px] text-gray-700 whitespace-pre-wrap break-words">{formatJsonPreview(row.old_values)}</pre>
                          </div>
                          <div className="rounded border border-gray-200 bg-gray-50 p-2">
                            <div className="text-[11px] font-bold text-gray-700 mb-1">Depois</div>
                            <pre className="text-[10px] text-gray-700 whitespace-pre-wrap break-words">{formatJsonPreview(row.new_values)}</pre>
                          </div>
                          <div className="rounded border border-gray-200 bg-gray-50 p-2">
                            <div className="text-[11px] font-bold text-gray-700 mb-1">Detalhes</div>
                            <pre className="text-[10px] text-gray-700 whitespace-pre-wrap break-words">{formatJsonPreview(row.metadata)}</pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  ))
                )}
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
                professionalPins.find((pin) => pin.professional_id === selectedProfessionalForInfo)
                  ?.pin
              }
              establishmentId={establishment?.id}
              selectedMonth={selectedDate}
              {...calculateProfessionalValues(selectedProfessionalForInfo)}
              onClose={() => setSelectedProfessionalForInfo(null)}
            />
          )}

        {/* Modal de Seleção de Serviço para Encaixe */}
        {showSqueezeServiceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Qual serviço deseja adicionar como encaixe?
                </h3>
                <button
                  onClick={() => {
                    setShowSqueezeServiceModal(false);
                    setSelectedProfessionalForSqueeze(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <SqueezeServiceList
                  establishment={establishment}
                  selectedProfessionalId={selectedProfessionalForSqueeze}
                  onSelectService={async (service) => {
                    setSelectedSqueezeService(service);
                    setShowSqueezeServiceModal(false);
                    setShowSqueezeTimeModal(true);
                  }}
                  onClose={() => {
                    setShowSqueezeServiceModal(false);
                    setSelectedProfessionalForSqueeze(null);
                  }}
                  fetchServices={fetchEstablishmentServices}
                  fetchSubscriptions={fetchEstablishmentSubscriptionsForSqueeze}
                />
              </div>
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
                      setShowSqueezeTimeModal(false);
                      setSelectedSqueezeService(null);
                      setSqueezeStartTime('');
                      setSqueezeEndTime('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={openSqueezeClientModal}
                    className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Escolher cliente
                  </button>
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
          <div className="grid grid-cols-3 gap-2 sm:hidden">
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
          </div>

          {/* Layout para desktop - horizontal */}
          <div className="hidden sm:flex justify-center gap-4">
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

// Componente para lista de serviços no modal de encaixe
const SqueezeServiceList: React.FC<{
  establishment: any;
  selectedProfessionalId?: string | null;
  onSelectService: (service: any) => void;
  onClose: () => void;
  fetchServices: (professionalId?: string) => Promise<any[]>;
  fetchSubscriptions: () => Promise<any[]>;
}> = ({ onSelectService, onClose, fetchServices, fetchSubscriptions, selectedProfessionalId }) => {
  const [services, setServices] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);
      const [fetchedServices, fetchedSubscriptions] = await Promise.all([
        fetchServices(selectedProfessionalId || undefined),
        fetchSubscriptions()
      ]);
      setServices(fetchedServices);
      setSubscriptions(fetchedSubscriptions);
      setLoading(false);
    };
    loadServices();
  }, [fetchServices, fetchSubscriptions, selectedProfessionalId]);

  if (loading) {
    return <div className="text-center py-4 text-gray-400">Carregando serviços...</div>;
  }

  if (services.length === 0 && subscriptions.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400">
        Nenhuma opção encontrada. Adicione serviços ou assinaturas.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {services.length > 0 && (
        <>
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => onSelectService(service)}
              className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
            >
              <div className="font-semibold text-white">{service.name}</div>
              <div className="text-sm text-gray-300">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(service.price)}
              </div>
            </button>
          ))}
        </>
      )}

      {subscriptions.length > 0 && (
        <div className="pt-2">
          <div className="text-xs font-bold text-amber-300 mb-2">ASSINATURAS (sem restrição)</div>
          <div className="space-y-2">
            {subscriptions.map((sub) => (
              <button
                key={sub.id}
                onClick={() => onSelectService(sub)}
                className="w-full text-left px-4 py-3 bg-amber-900/20 hover:bg-amber-800/30 border border-amber-500/40 rounded-lg transition-colors"
              >
                <div className="font-semibold text-white">👑 {sub.name}</div>
                <div className="text-sm text-amber-200">
                  Assinatura • {Number(sub.duration || 30)} min • GRATUITO
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
