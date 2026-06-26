import { BarChart3, Calendar, CheckCircle2, Clock, Crown, DollarSign, Eye, EyeOff, Flame, Gem, RefreshCw, Scissors, Star, TrendingUp, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatSubscriberPeriodFilterLabel,
  type SubscriberPerformancePeriod,
  useProfessionalSubscriberControl,
} from '../hooks/useProfessionalSubscriberControl';
import { supabase } from '../lib/supabase';
import { ProfessionalAttendedClientsModal } from './ProfessionalAttendedClientsModal';

interface ProfessionalInfoModalProps {
  professional: {
    id: string;
    name: string;
    photo_url?: string;
    percentage?: number;
    hide_gross_in_financial?: boolean;
  };
  professionalPin?: string;
  dailyGross: number;
  dailyNet: number;
  monthlyGross: number;
  monthlyNet: number;
  appointmentsToday: number;
  appointmentsMonth: number;
  subscriberMonthlyAccumulated?: number;
  subscriberMonthlyPaid?: number;
  subscriberMonthlyPending?: number;
  subscriberAttendanceCount?: number;
  subscriberClientsCount?: number;
  subscriberSalesCount?: number;
  subscriberDailyAttendanceCount?: number;
  subscriberDailyAccumulated?: number;
  establishmentId?: string;
  selectedMonth?: Date;
  basePercentage?: number;
  metaBonusPercentage?: number;
  metaGoalReached?: boolean;
  metaServiceCount?: number;
  serviceInsights?: Array<{
    name: string;
    count: number;
    gross: number;
    sharePercent: number;
  }>;
  cancelledInsights?: {
    totalCancelled: number;
    lostGross: number;
    lostNet: number;
    byService: Array<{
      name: string;
      count: number;
      gross: number;
      sharePercent: number;
    }>;
  };
  topClientInsight?: {
    name: string;
    count: number;
    gross: number;
    lastAppointmentDate: string;
  } | null;
  financialAppointments?: Array<{
    id?: string;
    appointment_date?: string;
    status?: string;
    service?: string;
    price?: number;
    total_price?: number;
    additional_products?: Array<{ price?: number }> | null;
    payment_method?: string;
    is_subscriber?: boolean;
    subscription_id?: string | null;
    client_name?: string;
  }>;
  dormantClientsSource?: Array<{
    name: string;
    whatsapp?: string;
    lastVisitDate: string;
    daysWithoutBooking: number;
    favoriteService: string;
    totalSpent: number;
    appointmentCount?: number;
  }>;
  onRefreshDormantClientsSource?: () => Promise<void> | void;
  onClose: () => void;
}

interface ProfessionalPaymentHistoryItem {
  id: string;
  amount: number;
  payment_date: string;
  payment_source?: string | null;
  for_month?: string | null;
}

interface AppointmentForOperationalPending {
  id: string;
  professional?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  status?: string | null;
  price?: number | null;
  total_price?: number | null;
  additional_products?: Array<{ price?: number | null }> | null;
  professional_tip_amount?: number | null;
}

interface DormantClientInsight {
  name: string;
  whatsapp?: string;
  lastVisitDate: string;
  daysWithoutBooking: number;
  favoriteService: string;
  totalSpent: number;
}

interface CancellationPeriodInsight {
  totalCancelled: number;
  lostGross: number;
  lostNet: number;
  byService: Array<{
    name: string;
    count: number;
    gross: number;
    sharePercent: number;
  }>;
}

interface PerformanceAppointmentRow {
  id?: string;
  client_id?: string | null;
  client_name?: string | null;
  client_whatsapp?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  status?: string | null;
  service?: string | null;
  price?: number | null;
  total_price?: number | null;
  additional_products?: Array<{ price?: number | null }> | null;
  payment_method?: string | null;
  is_subscriber?: boolean | null;
  subscription_id?: string | null;
  professional?: string | null;
  professional_id?: string | null;
  professional_name?: string | null;
}

interface PerformanceDayItem {
  date: string;
  label: string;
  net: number;
  attendances: number;
  serviceCount: number;
}

interface PerformanceMonthItem {
  key: string;
  label: string;
  net: number;
  attendances: number;
  growthPercent: number | null;
}

export const ProfessionalInfoModal: React.FC<ProfessionalInfoModalProps> = ({
  professional,
  professionalPin,
  dailyGross,
  dailyNet,
  monthlyGross,
  monthlyNet,
  appointmentsToday,
  appointmentsMonth,
  subscriberMonthlyAccumulated = 0,
  subscriberMonthlyPaid = 0,
  subscriberMonthlyPending = 0,
  subscriberAttendanceCount = 0,
  subscriberClientsCount = 0,
  subscriberSalesCount = 0,
  subscriberDailyAttendanceCount = 0,
  subscriberDailyAccumulated = 0,
  establishmentId,
  selectedMonth,
  basePercentage,
  metaBonusPercentage = 0,
  metaGoalReached = false,
  metaServiceCount = 0,
  serviceInsights = [],
  financialAppointments = [],
  dormantClientsSource,
  onRefreshDormantClientsSource,
  onClose,
}) => {
  const [pinInput, setPinInput] = useState('');
  // Considera sem senha se: não existe, está vazio, ou é "0000"
  const hasNoPin = !professionalPin || professionalPin.trim() === '' || professionalPin === '0000';
  const [isAuthenticated, setIsAuthenticated] = useState(hasNoPin);
  const [showError, setShowError] = useState(false);
  const [showValues, setShowValues] = useState(true);
  const [showPerformanceInsights, setShowPerformanceInsights] = useState(false);
  const [showServiceInsights, setShowServiceInsights] = useState(true);
  const [showCancelledInsights, setShowCancelledInsights] = useState(true);
  const [showDormantClients, setShowDormantClients] = useState(false);
  const [cancelStartDate, setCancelStartDate] = useState(() => {
    const base = selectedMonth || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [cancelEndDate, setCancelEndDate] = useState(() => {
    const base = selectedMonth || new Date();
    return new Date(base.getFullYear(), base.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [isLoadingCancelInsights, setIsLoadingCancelInsights] = useState(false);
  const [cancelInsightsPeriod, setCancelInsightsPeriod] = useState<CancellationPeriodInsight>({
    totalCancelled: 0,
    lostGross: 0,
    lostNet: 0,
    byService: [],
  });
  const [isLoadingDormantClients, setIsLoadingDormantClients] = useState(false);
  const [isRefreshingDormantSource, setIsRefreshingDormantSource] = useState(false);
  const [isLoadingPerformanceInsights, setIsLoadingPerformanceInsights] = useState(false);
  const [performanceRows, setPerformanceRows] = useState<PerformanceAppointmentRow[]>([]);
  const performanceCacheRef = useRef<Map<string, PerformanceAppointmentRow[]>>(new Map());
  const [dormantClients, setDormantClients] = useState<DormantClientInsight[]>([]);
  const dormantClientCacheRef = useRef<Map<string, DormantClientInsight[]>>(new Map());
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<ProfessionalPaymentHistoryItem[]>([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(true);
  const [subscriberPerformancePeriod, setSubscriberPerformancePeriod] =
    useState<SubscriberPerformancePeriod>('current');
  const [showSubscriberPerformanceSection, setShowSubscriberPerformanceSection] = useState(false);
  const [showSubscriberClientsModal, setShowSubscriberClientsModal] = useState(false);

  const subscriberControl = useProfessionalSubscriberControl({
    establishmentId,
    professional,
    referenceDate: selectedMonth,
    period: subscriberPerformancePeriod,
    enabled: Boolean(establishmentId && isAuthenticated),
  });

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Senha mestre sempre funciona
    const MASTER_PIN = '2543';

    if (pinInput === MASTER_PIN || pinInput === professionalPin) {
      setIsAuthenticated(true);
      setShowError(false);
    } else {
      setShowError(true);
      setTimeout(() => setShowError(false), 3000);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };
  const hideGrossInFinancial = professional.hide_gross_in_financial === true;
  const topServiceCount = serviceInsights[0]?.count || 1;
  const topCancelledServiceCount = cancelInsightsPeriod.byService[0]?.count || 1;
  const hasDormantClientsSource = Array.isArray(dormantClientsSource) && dormantClientsSource.length > 0;
  const effectiveDormantClients: DormantClientInsight[] = hasDormantClientsSource
    ? ((dormantClientsSource || []) as DormantClientInsight[])
    : dormantClients;
  const dormantDismissStorageKey = useMemo(() => {
    if (!establishmentId || !professional?.id) return '';
    return `professional_financial_dormant_hidden:${String(establishmentId)}:${String(professional.id)}`;
  }, [establishmentId, professional?.id]);
  const [dismissedDormantKeys, setDismissedDormantKeys] = useState<string[]>([]);

  const normalizeWhatsappDigits = (value: unknown): string =>
    String(value || '').replace(/\D/g, '');
  const formatWhatsappDisplay = (value: unknown): string => {
    const digits = normalizeWhatsappDigits(value);
    if (!digits) return '';
    const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
    if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    return local;
  };
  const buildWhatsappLink = (value: unknown): string => {
    const digits = normalizeWhatsappDigits(value);
    if (!digits) return '';
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    return `https://wa.me/${normalized}`;
  };
  const getDormantClientStableKey = (client: DormantClientInsight): string =>
    `${normalizeWhatsappDigits(client.whatsapp)}|${String(client.name || '').trim().toLowerCase()}|${String(client.lastVisitDate || '').trim()}`;
  const visibleDormantClients = useMemo(() => {
    if (!dismissedDormantKeys.length) return effectiveDormantClients;
    const hidden = new Set(dismissedDormantKeys);
    return effectiveDormantClients.filter((client) => !hidden.has(getDormantClientStableKey(client)));
  }, [dismissedDormantKeys, effectiveDormantClients]);

  useEffect(() => {
    if (!dormantDismissStorageKey) {
      setDismissedDormantKeys([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(dormantDismissStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setDismissedDormantKeys(Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []);
    } catch {
      setDismissedDormantKeys([]);
    }
  }, [dormantDismissStorageKey]);

  const persistDismissedDormantKeys = (next: string[]) => {
    setDismissedDormantKeys(next);
    if (!dormantDismissStorageKey) return;
    try {
      window.localStorage.setItem(dormantDismissStorageKey, JSON.stringify(next));
    } catch {
      // Falha de storage local não deve quebrar o modal.
    }
  };

  const handleDismissDormantClient = (client: DormantClientInsight) => {
    const key = getDormantClientStableKey(client);
    if (!key) return;
    if (dismissedDormantKeys.includes(key)) return;
    persistDismissedDormantKeys([...dismissedDormantKeys, key]);
  };

  const handleRestoreHiddenDormantClients = () => {
    persistDismissedDormantKeys([]);
  };
  const handleToggleDormantClients = async () => {
    const next = !showDormantClients;
    setShowDormantClients(next);
    if (!next) return;
    if (hasDormantClientsSource) return;
    if (!onRefreshDormantClientsSource) return;
    try {
      setIsRefreshingDormantSource(true);
      await onRefreshDormantClientsSource();
    } catch (err) {
      console.error('Erro ao recarregar fonte de clientes sumidos:', err);
    } finally {
      setIsRefreshingDormantSource(false);
    }
  };

  const selectedMonthKey = useMemo(() => {
    const base = selectedMonth || new Date();
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  useEffect(() => {
    let cancelled = false;
    let intervalRef: number | null = null;

    const loadPaymentHistory = async () => {
      if (!establishmentId || !professional.id) {
        if (!cancelled) setPaymentHistory([]);
        return;
      }

      setIsLoadingPayments(true);
      try {
        const { data, error } = await supabase
          .from('professional_payments')
          .select('id, amount, payment_date, payment_source, for_month')
          .eq('establishment_id', establishmentId)
          .eq('professional_id', professional.id)
          .order('payment_date', { ascending: false });

        if (error) throw error;

        const rows = ((data || []) as ProfessionalPaymentHistoryItem[])
          .filter((row) => {
            const source = String(row.payment_source || '').trim().toLowerCase();
            if (source && source !== 'normal') return false;

            const forMonth = String(row.for_month || '').trim();
            if (forMonth) return forMonth === selectedMonthKey;

            const dt = new Date(row.payment_date);
            if (Number.isNaN(dt.getTime())) return false;
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            return key === selectedMonthKey;
          })
          .map((row) => ({
            id: String(row.id || ''),
            amount: Number(row.amount || 0),
            payment_date: String(row.payment_date || ''),
            payment_source: row.payment_source || null,
            for_month: row.for_month || null,
          }));

        if (!cancelled) setPaymentHistory(rows);
      } catch (err) {
        console.error('Erro ao carregar histórico financeiro do profissional:', err);
        if (!cancelled) setPaymentHistory([]);
      } finally {
        if (!cancelled) setIsLoadingPayments(false);
      }
    };

    void loadPaymentHistory();
    intervalRef = window.setInterval(() => {
      void loadPaymentHistory();
    }, 15000);

    return () => {
      cancelled = true;
      if (intervalRef) window.clearInterval(intervalRef);
    };
  }, [establishmentId, professional.id, selectedMonthKey]);

  const totalPaid = paymentHistory
    .filter((row) => row.amount > 0)
    .reduce((sum, row) => sum + row.amount, 0);
  const totalWithdrawn = paymentHistory
    .filter((row) => row.amount < 0)
    .reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const totalPaidDisplay = totalPaid;
  const totalWithdrawnDisplay = totalWithdrawn;
  const paymentCount = paymentHistory.filter((row) => row.amount > 0).length;
  const lastPaymentDate = paymentHistory.find((row) => row.amount > 0)?.payment_date || null;
  const reconciledMonthlyNet = totalPaidDisplay;
  const pendingToReceive = Math.max(0, Number(monthlyNet || 0) - totalPaidDisplay);

  const formatDateTime = (value: string) => {
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  const formatDateOnly = (value: string) => {
    const dt = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return String(value || '');
    return dt.toLocaleDateString('pt-BR');
  };

  const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);
  const differenceInDays = (fromDate: string, toDate: Date): number => {
    const from = new Date(`${String(fromDate || '').slice(0, 10)}T00:00:00`);
    if (Number.isNaN(from.getTime())) return 0;
    const to = new Date(`${toIsoDate(toDate)}T00:00:00`);
    const diff = to.getTime() - from.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };
  const getAppointmentTotalForInsight = (apt: any): number => {
    const totalPrice = Number(apt?.total_price ?? 0);
    if (Number.isFinite(totalPrice) && totalPrice > 0) return totalPrice;
    const base = Number(apt?.price ?? 0);
    const extras = Array.isArray(apt?.additional_products)
      ? apt.additional_products.reduce((sum: number, row: any) => sum + Number(row?.price || 0), 0)
      : 0;
    return Math.max(0, base + extras);
  };
  const isSubscriberFinancialAppointment = (apt: any): boolean => {
    const paymentMethod = String(apt?.payment_method || '').trim().toLowerCase();
    if (Boolean(apt?.is_subscriber) || paymentMethod === 'assinante') return true;
    if (String(apt?.subscription_id || '').trim()) return true;
    const clientName = String(apt?.client_name || '').trim().toLowerCase();
    return clientName.includes('assinante') && getAppointmentTotalForInsight(apt) <= 0;
  };
  const normalizeComparableText = (value: unknown): string =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const buildCancellationInsight = (rows: any[]): CancellationPeriodInsight => {
    const safeRows = Array.isArray(rows) ? rows : [];
    const byServiceRaw = Array.from(
      safeRows.reduce((acc, apt) => {
        const name = String(apt?.service || '').trim() || 'Serviço sem nome';
        const current = acc.get(name) || { count: 0, gross: 0 };
        current.count += 1;
        current.gross += getAppointmentTotalForInsight(apt);
        acc.set(name, current);
        return acc;
      }, new Map<string, { count: number; gross: number }>())
    )
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => {
        if (b.gross !== a.gross) return b.gross - a.gross;
        return b.count - a.count;
      });

    const totalCancelled = safeRows.length;
    const lostGross = byServiceRaw.reduce((sum, item) => sum + item.gross, 0);
    const normalizedPercentage = Math.max(0, Math.min(100, Number(basePercentage ?? professional?.percentage ?? 0)));
    const lostNet = lostGross * (normalizedPercentage / 100);
    const byService = byServiceRaw.map((item) => ({
      ...item,
      sharePercent: totalCancelled > 0 ? (item.count / totalCancelled) * 100 : 0,
    }));

    return {
      totalCancelled,
      lostGross,
      lostNet,
      byService,
    };
  };
  const getMonthKey = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const startOfMonthKey = (date: Date): string =>
    new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
  const endOfMonthKey = (date: Date): string =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
  const toDayLabel = (isoDate: string): string => {
    const dt = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return isoDate;
    return dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  };
  const getPerformanceNetValue = (apt: PerformanceAppointmentRow): number => {
    const gross = getAppointmentTotalForInsight(apt);
    const normalizedPercentage = Math.max(0, Math.min(100, Number(basePercentage ?? professional?.percentage ?? 0)));
    return gross * (normalizedPercentage / 100);
  };
  const isCompletedNonSubscriber = (apt: PerformanceAppointmentRow): boolean => {
    const status = String(apt?.status || '').trim().toLowerCase();
    if (status !== 'completed') return false;
    return !isSubscriberFinancialAppointment(apt);
  };
  const isRemainingTodayCandidate = (apt: PerformanceAppointmentRow): boolean => {
    const status = String(apt?.status || '').trim().toLowerCase();
    if (status === 'cancelled' || status === 'completed') return false;
    return !isSubscriberFinancialAppointment(apt);
  };
  const todayKey = toIsoDate(new Date());
  const last7DaysPerformance = useMemo<PerformanceDayItem[]>(() => {
    const days: PerformanceDayItem[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = toIsoDate(day);
      const rows = performanceRows.filter((apt) => String(apt?.appointment_date || '').slice(0, 10) === key && isCompletedNonSubscriber(apt));
      const net = rows.reduce((sum, apt) => sum + getPerformanceNetValue(apt), 0);
      days.push({
        date: key,
        label: toDayLabel(key),
        net,
        attendances: rows.length,
        serviceCount: rows.length,
      });
    }
    return days;
  }, [performanceRows, basePercentage, professional?.percentage]);
  const topLast7DaysNet = useMemo(
    () => Math.max(1, ...last7DaysPerformance.map((item) => item.net)),
    [last7DaysPerformance]
  );
  const currentMonthBestDay = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonthKey(now);
    const monthEnd = endOfMonthKey(now);
    const monthRows = performanceRows.filter((apt) => {
      const date = String(apt?.appointment_date || '').slice(0, 10);
      return date >= monthStart && date <= monthEnd && isCompletedNonSubscriber(apt);
    });
    const byDay = new Map<string, { net: number; attendances: number; services: number; clients: Set<string> }>();
    monthRows.forEach((apt) => {
      const date = String(apt?.appointment_date || '').slice(0, 10);
      if (!date) return;
      const current = byDay.get(date) || { net: 0, attendances: 0, services: 0, clients: new Set<string>() };
      current.net += getPerformanceNetValue(apt);
      current.attendances += 1;
      current.services += 1;
      const clientKey =
        String(apt?.client_id || '').trim() ||
        String(apt?.client_whatsapp || '').replace(/\D/g, '') ||
        normalizeComparableText(apt?.client_name);
      if (clientKey) current.clients.add(clientKey);
      byDay.set(date, current);
    });
    const best = Array.from(byDay.entries())
      .map(([date, value]) => ({
        date,
        net: value.net,
        attendances: value.attendances,
        services: value.services,
        clients: value.clients.size,
      }))
      .sort((a, b) => b.net - a.net)[0];
    return best || null;
  }, [performanceRows, basePercentage, professional?.percentage]);
  const todayRows = useMemo(
    () => performanceRows.filter((apt) => String(apt?.appointment_date || '').slice(0, 10) === todayKey),
    [performanceRows, todayKey]
  );
  const remainingTodayRows = useMemo(
    () => todayRows.filter(isRemainingTodayCandidate),
    [todayRows]
  );
  const remainingPotentialNet = useMemo(
    () => remainingTodayRows.reduce((sum, apt) => sum + getPerformanceNetValue(apt), 0),
    [remainingTodayRows, basePercentage, professional?.percentage]
  );
  const predictedFinalTodayNet = useMemo(
    () => Number(dailyNet || 0) + remainingPotentialNet,
    [dailyNet, remainingPotentialNet]
  );
  const monthlyPerformanceHistory = useMemo<PerformanceMonthItem[]>(() => {
    const months: Array<{ key: string; label: string; start: string; end: string }> = [];
    const base = new Date();
    for (let i = 0; i < 5; i += 1) {
      const cursor = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push({
        key: getMonthKey(cursor),
        label: cursor.toLocaleDateString('pt-BR', { month: 'long' }),
        start: startOfMonthKey(cursor),
        end: endOfMonthKey(cursor),
      });
    }
    const raw = months.map((month) => {
      const rows = performanceRows.filter((apt) => {
        const date = String(apt?.appointment_date || '').slice(0, 10);
        return date >= month.start && date <= month.end && isCompletedNonSubscriber(apt);
      });
      return {
        key: month.key,
        label: month.label,
        net: rows.reduce((sum, apt) => sum + getPerformanceNetValue(apt), 0),
        attendances: rows.length,
      };
    });
    return raw.map((item, idx) => {
      const prev = raw[idx + 1];
      const growthPercent =
        prev && prev.net > 0
          ? ((item.net - prev.net) / prev.net) * 100
          : null;
      return { ...item, growthPercent };
    });
  }, [performanceRows, basePercentage, professional?.percentage]);
  const topMonthlyNet = useMemo(
    () => Math.max(1, ...monthlyPerformanceHistory.map((item) => item.net)),
    [monthlyPerformanceHistory]
  );
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!showPerformanceInsights) return;
    if (!establishmentId || !professional?.id) return;
    const cacheKey = `${String(establishmentId)}:${String(professional.id)}:performance`;
    const cached = performanceCacheRef.current.get(cacheKey);
    if (cached && cached.length > 0) {
      setPerformanceRows(cached);
      return;
    }

    let cancelled = false;
    const loadPerformanceRows = async () => {
      setIsLoadingPerformanceInsights(true);
      try {
        const now = new Date();
        const fiveMonthsStart = new Date(now.getFullYear(), now.getMonth() - 4, 1);
        const startDateKey = toIsoDate(fiveMonthsStart);
        const performanceSelectVariants = [
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_id, professional_name',
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_id',
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_name',
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional',
        ] as const;
        let selectedClause: string | null = null;
        const isMissingColumnError = (error: any): boolean => {
          const msg = String(error?.message || '').toLowerCase();
          return (
            (msg.includes('column') && msg.includes('does not exist')) ||
            msg.includes('could not find the') ||
            msg.includes('schema cache')
          );
        };
        const runFetch = async (selectClause: string) =>
          supabase
            .from('appointments')
            .select(selectClause)
            .eq('establishment_id', establishmentId)
            .gte('appointment_date', startDateKey)
            .lte('appointment_date', todayKey)
            .order('appointment_date', { ascending: false })
            .limit(30000);

        let rows: PerformanceAppointmentRow[] = [];
        if (selectedClause) {
          const { data, error } = await runFetch(selectedClause);
          if (error) throw error;
          rows = (data || []) as PerformanceAppointmentRow[];
        } else {
          let lastError: any = null;
          for (const selectClause of performanceSelectVariants) {
            const { data, error } = await runFetch(selectClause);
            if (!error) {
              selectedClause = selectClause;
              rows = (data || []) as PerformanceAppointmentRow[];
              break;
            }
            lastError = error;
            if (!isMissingColumnError(error)) break;
          }
          if (!rows.length && lastError) throw lastError;
        }

        const selectedProfessionalId = String(professional.id || '').trim();
        const selectedProfessionalName = normalizeComparableText(professional.name);
        const selectedProfessionalNameRaw = String(professional.name || '').trim();
        const filteredRows = (rows || []).filter((apt) => {
          const byIdA = String((apt as any)?.professional_id || '').trim();
          const byIdB = String((apt as any)?.professional || '').trim();
          const byNameA = normalizeComparableText((apt as any)?.professional);
          const byNameB = normalizeComparableText((apt as any)?.professional_name);
          const matchesById =
            selectedProfessionalId.length > 0 &&
            (byIdA === selectedProfessionalId || byIdB === selectedProfessionalId);
          const matchesByName =
            selectedProfessionalName.length > 0 &&
            (byNameA === selectedProfessionalName || byNameB === selectedProfessionalName);
          const matchesRawName =
            selectedProfessionalNameRaw.length > 0 &&
            (String((apt as any)?.professional || '').trim() === selectedProfessionalNameRaw ||
              String((apt as any)?.professional_name || '').trim() === selectedProfessionalNameRaw);
          return matchesById || matchesByName || matchesRawName;
        });

        if (!cancelled) {
          performanceCacheRef.current.set(cacheKey, filteredRows);
          setPerformanceRows(filteredRows);
        }
      } catch (err) {
        console.error('Erro ao carregar seção de desempenho do profissional:', err);
        if (!cancelled) setPerformanceRows([]);
      } finally {
        if (!cancelled) setIsLoadingPerformanceInsights(false);
      }
    };

    void loadPerformanceRows();
    return () => {
      cancelled = true;
    };
  }, [establishmentId, isAuthenticated, professional?.id, professional?.name, showPerformanceInsights, todayKey]);
  useEffect(() => {
    const base = selectedMonth || new Date();
    setCancelStartDate(new Date(base.getFullYear(), base.getMonth(), 1).toISOString().slice(0, 10));
    setCancelEndDate(new Date(base.getFullYear(), base.getMonth() + 1, 0).toISOString().slice(0, 10));
  }, [professional?.id, selectedMonth]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!establishmentId || !professional?.id) return;
    if (!cancelStartDate || !cancelEndDate) return;

    if (cancelStartDate > cancelEndDate) {
      setCancelInsightsPeriod({
        totalCancelled: 0,
        lostGross: 0,
        lostNet: 0,
        byService: [],
      });
      return;
    }

    let cancelled = false;
    const loadCancelledInsightsFromDb = async () => {
      setIsLoadingCancelInsights(true);
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('establishment_id', establishmentId)
          .eq('status', 'cancelled')
          .gte('appointment_date', cancelStartDate)
          .lte('appointment_date', cancelEndDate)
          .order('appointment_date', { ascending: false })
          .limit(20000);

        if (error) throw error;

        const rows = data || [];
        const selectedProfessionalId = String(professional.id || '').trim();
        const selectedProfessionalName = normalizeComparableText(professional.name);

        const filteredRows = rows.filter((apt) => {
          const byIdA = String(apt?.professional_id || '').trim();
          const byIdB = String(apt?.professional || '').trim();
          const byNameA = normalizeComparableText(apt?.professional);
          const byNameB = normalizeComparableText((apt as any)?.professional_name);

          const matchesById =
            selectedProfessionalId.length > 0 &&
            (byIdA === selectedProfessionalId || byIdB === selectedProfessionalId);
          const matchesByName =
            selectedProfessionalName.length > 0 &&
            (byNameA === selectedProfessionalName || byNameB === selectedProfessionalName);

          return (matchesById || matchesByName) && !isSubscriberFinancialAppointment(apt);
        });

        if (!cancelled) {
          setCancelInsightsPeriod(buildCancellationInsight(filteredRows));
        }
      } catch (err) {
        console.error('Erro ao carregar cancelamentos do profissional por período:', err);
        if (!cancelled) {
          const fallbackRows = (financialAppointments || []).filter((apt) => {
            const status = String(apt?.status || '').trim().toLowerCase();
            if (status !== 'cancelled') return false;
            const aptDate = String(apt?.appointment_date || '').slice(0, 10);
            if (!aptDate || aptDate < cancelStartDate || aptDate > cancelEndDate) return false;
            if (isSubscriberFinancialAppointment(apt)) return false;
            return true;
          });
          setCancelInsightsPeriod(buildCancellationInsight(fallbackRows));
        }
      } finally {
        if (!cancelled) setIsLoadingCancelInsights(false);
      }
    };

    void loadCancelledInsightsFromDb();

    return () => {
      cancelled = true;
    };
  }, [
    basePercentage,
    cancelEndDate,
    cancelStartDate,
    establishmentId,
    isAuthenticated,
    professional?.id,
    professional?.name,
    professional?.percentage,
    financialAppointments,
  ]);

  useEffect(() => {
    if (hasDormantClientsSource) return;
    if (!showDormantClients || !isAuthenticated) return;
    if (!establishmentId || !professional?.id) return;

    const cacheKey = `${String(establishmentId)}:${String(professional.id)}`;
    const cached = dormantClientCacheRef.current.get(cacheKey);
    if (cached && cached.length > 0) {
      setDormantClients(cached);
      return;
    }

    let cancelled = false;
    const loadDormantClients = async () => {
      setIsLoadingDormantClients(true);
      try {
        const lookbackDate = new Date();
        lookbackDate.setFullYear(lookbackDate.getFullYear() - 3);
        const lookbackDateKey = toIsoDate(lookbackDate);

        const dormantSelectVariants = [
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_id, professional_name',
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_id',
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_name',
          'id, client_id, client_name, client_whatsapp, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional',
          'id, client_id, client_name, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_id, professional_name',
          'id, client_id, client_name, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_id',
          'id, client_id, client_name, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional, professional_name',
          'id, client_id, client_name, appointment_date, appointment_time, status, service, price, total_price, additional_products, payment_method, is_subscriber, subscription_id, professional',
        ] as const;
        const pageSize = 1000;
        const maxPages = 60; // até 60k registros do profissional
        const selectedProfessionalId = String(professional.id || '').trim();
        const selectedProfessionalName = normalizeComparableText(professional.name);
        const selectedProfessionalNameRaw = String(professional.name || '').trim();
        let resolvedDormantSelect: string | null = null;
        const isMissingColumnError = (error: any): boolean => {
          const msg = String(error?.message || '').toLowerCase();
          return (
            (msg.includes('column') && msg.includes('does not exist')) ||
            msg.includes('could not find the') ||
            msg.includes('schema cache')
          );
        };

        const fetchPage = async (page: number): Promise<any[]> => {
          const from = page * pageSize;
          const to = from + pageSize - 1;
          const runQuery = async (selectClause: string) =>
            supabase
              .from('appointments')
              .select(selectClause)
              .eq('establishment_id', establishmentId)
              .gte('appointment_date', lookbackDateKey)
              .order('appointment_date', { ascending: false })
              .range(from, to);

          if (resolvedDormantSelect) {
            const { data, error } = await runQuery(resolvedDormantSelect);
            if (error) throw error;
            return data || [];
          }

          let lastError: any = null;
          for (const selectClause of dormantSelectVariants) {
            const { data, error } = await runQuery(selectClause);
            if (!error) {
              resolvedDormantSelect = selectClause;
              return data || [];
            }
            lastError = error;
            if (!isMissingColumnError(error)) break;
          }

          throw lastError;
        };

        const rows: any[] = [];
        for (let page = 0; page < maxPages; page += 1) {
          const batch = await fetchPage(page);
          if (batch.length === 0) break;

          const filteredBatch = batch.filter((apt) => {
            const byIdA = String((apt as any)?.professional_id || '').trim();
            const byIdB = String((apt as any)?.professional || '').trim();
            const byNameA = normalizeComparableText((apt as any)?.professional);
            const byNameB = normalizeComparableText((apt as any)?.professional_name);

            const matchesById =
              selectedProfessionalId.length > 0 &&
              (byIdA === selectedProfessionalId || byIdB === selectedProfessionalId);
            const matchesByName =
              selectedProfessionalName.length > 0 &&
              (byNameA === selectedProfessionalName || byNameB === selectedProfessionalName);
            const matchesRawName =
              selectedProfessionalNameRaw.length > 0 &&
              (String((apt as any)?.professional || '').trim() === selectedProfessionalNameRaw ||
                String((apt as any)?.professional_name || '').trim() === selectedProfessionalNameRaw);

            return matchesById || matchesByName || matchesRawName;
          });

          rows.push(...filteredBatch);
          if (batch.length < pageSize) break;
        }

        const grouped = rows.reduce((acc, apt) => {
          const name = String(apt?.client_name || '').trim();
          if (!name) return acc;
          const key = String(apt?.client_id || '').trim() || name.toLowerCase();
          const whatsapp = String(apt?.client_whatsapp || '').trim();
          const current = acc.get(key) || {
            name,
            whatsapp,
            lastVisitDate: '',
            totalSpent: 0,
            serviceCounter: new Map<string, number>(),
          };
          if (!current.whatsapp && whatsapp) {
            current.whatsapp = whatsapp;
          }

          const status = String(apt?.status || '').trim().toLowerCase();
          const aptDate = String(apt?.appointment_date || '').slice(0, 10);
          const isCancelled = status === 'cancelled';
          if (!isCancelled && aptDate && (!current.lastVisitDate || aptDate > current.lastVisitDate)) {
            current.lastVisitDate = aptDate;
          }

          if (status === 'completed' && !isSubscriberFinancialAppointment(apt)) {
            current.totalSpent += getAppointmentTotalForInsight(apt);
            const serviceName = String(apt?.service || '').trim() || 'Serviço sem nome';
            current.serviceCounter.set(serviceName, (current.serviceCounter.get(serviceName) || 0) + 1);
          }

          acc.set(key, current);
          return acc;
        }, new Map<string, { name: string; whatsapp: string; lastVisitDate: string; totalSpent: number; serviceCounter: Map<string, number> }>());

        const today = new Date();
        const normalizedDormant: DormantClientInsight[] = Array.from(grouped.values())
          .map((row) => {
            const favoriteService =
              Array.from(row.serviceCounter.entries())
                .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Sem serviço recorrente';
            const daysWithoutBooking = row.lastVisitDate ? differenceInDays(row.lastVisitDate, today) : 0;
            return {
              name: row.name,
              whatsapp: row.whatsapp,
              lastVisitDate: row.lastVisitDate,
              daysWithoutBooking,
              favoriteService,
              totalSpent: row.totalSpent,
            };
          })
          .filter((row) => row.lastVisitDate && row.daysWithoutBooking > 30)
          .sort((a, b) => {
            if (b.daysWithoutBooking !== a.daysWithoutBooking) return b.daysWithoutBooking - a.daysWithoutBooking;
            return b.totalSpent - a.totalSpent;
          })
          .slice(0, 20);

        if (!cancelled) {
          if (normalizedDormant.length > 0) {
            dormantClientCacheRef.current.set(cacheKey, normalizedDormant);
          } else {
            dormantClientCacheRef.current.delete(cacheKey);
          }
          setDormantClients(normalizedDormant);
        }
      } catch (err) {
        console.error('Erro ao carregar clientes sumidos do profissional:', err);
        if (!cancelled) setDormantClients([]);
      } finally {
        if (!cancelled) setIsLoadingDormantClients(false);
      }
    };

    void loadDormantClients();

    return () => {
      cancelled = true;
    };
  }, [establishmentId, hasDormantClientsSource, isAuthenticated, professional?.id, professional?.name, showDormantClients]);

  if (!isAuthenticated) {
    return (
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-900 to-black text-white p-4 sm:p-6 rounded-t-xl sm:rounded-t-2xl flex justify-between items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold">🔒 Acesso Protegido</h2>
            <button
              onClick={onClose}
              data-tutorial-id="professional-info-close"
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Foto do Profissional */}
          <div className="flex justify-center pt-4 sm:pt-6">
            {professional.photo_url ? (
              <img
                src={professional.photo_url}
                alt={professional.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-gray-300"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl sm:text-4xl">
                👤
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-semibold text-center mb-2">{professional.name}</h3>
            <p className="text-sm sm:text-base text-gray-600 text-center mb-4">
              Este profissional possui senha de proteção. Digite a senha para ver as informações
              financeiras.
            </p>

            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
              <p className="text-gray-800 text-xs text-center">
                💡 <strong>Dica:</strong> Você pode usar a senha do profissional ou a senha mestre do estabelecimento
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha do Profissional
                </label>
                <input
                  type="password"
                  id="pin"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 text-center text-xl sm:text-2xl tracking-widest text-gray-900 bg-white"
                  placeholder="••••"
                  maxLength={4}
                  autoFocus
                />
              </div>

              {showError && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm text-center">
                  ❌ Senha incorreta! Tente novamente.
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                Acessar Informações
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-1.5 sm:p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-[920px] max-h-[96vh] sm:max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-gray-900 to-black text-white px-4 py-3 sm:p-6 rounded-t-xl sm:rounded-t-2xl flex justify-between items-center gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-0.5 sm:mb-1">Informações do Profissional</h2>
              <p className="text-gray-300 text-sm">{professional.name}</p>
            </div>
            <button
              onClick={onClose}
              data-tutorial-id="professional-info-close"
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Foto e Info Básica */}
          <div className="flex flex-col items-center px-4 py-4 sm:p-6 bg-gradient-to-b from-gray-100 to-white">
            {professional.photo_url ? (
              <img
                src={professional.photo_url}
                alt={professional.name}
                className="w-20 h-20 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-gray-300 mb-3 sm:mb-4"
              />
            ) : (
              <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full bg-gray-200 flex items-center justify-center text-4xl sm:text-6xl mb-3 sm:mb-4">
                👤
              </div>
            )}
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{professional.name}</h3>
            {(professional.percentage !== undefined || basePercentage !== undefined) && (
              <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-200 text-gray-800 rounded-full font-semibold text-sm sm:text-base">
                Percentual base: {Number(basePercentage ?? professional.percentage ?? 0).toFixed(2)}%
              </span>
            )}
            {metaGoalReached && metaBonusPercentage > 0 && metaServiceCount > 0 && (
              <span className="mt-2 px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm">
                Meta ativa: serviços da meta em {Number(metaBonusPercentage).toFixed(2)}%
              </span>
            )}
          </div>

          {/* Content */}
          <div className="px-3 py-3 sm:p-6 space-y-3 sm:space-y-4">
            {/* Botão para mostrar/ocultar valores */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowValues(!showValues)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm text-gray-700"
              >
                {showValues ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Ocultar Valores
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Mostrar Valores
                  </>
                )}
              </button>
            </div>

            {/* Valores Diários */}
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 sm:p-5 rounded-xl border-2 border-green-200">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-green-800">
                <DollarSign className="w-5 h-5" />
                Valores do Dia
              </h3>
              <div className={`grid ${hideGrossInFinancial ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-3 sm:gap-4`}>
                {!hideGrossInFinancial && (
                  <div className="bg-white p-3 sm:p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Valor Bruto</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">
                      {showValues ? formatCurrency(dailyGross) : '••••••'}
                    </p>
                  </div>
                )}
                <div className="bg-white p-3 sm:p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Valor Líquido</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-700">
                    {showValues ? formatCurrency(dailyNet) : '••••••'}
                  </p>
                </div>
              </div>
              <div className="mt-3 text-center">
                <p className="text-xs sm:text-sm text-gray-600">
                  Atendimentos concluídos hoje: <span className="font-bold text-green-800">{appointmentsToday}</span>
                </p>
              </div>
            </div>

            {/* Valores Mensais */}
            <div className="bg-gradient-to-r from-gray-100 to-gray-200 p-3 sm:p-5 rounded-xl border-2 border-gray-300">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2 text-gray-800">
                <TrendingUp className="w-5 h-5" />
                Valores do Mês
              </h3>
              <div className={`grid ${hideGrossInFinancial ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-3 sm:gap-4`}>
                {!hideGrossInFinancial && (
                  <div className="bg-white p-3 sm:p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Valor Bruto</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800">
                      {showValues ? formatCurrency(monthlyGross) : '••••••'}
                    </p>
                  </div>
                )}
                <div className="bg-white p-3 sm:p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Valor Pago</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    {showValues ? formatCurrency(reconciledMonthlyNet) : '••••••'}
                  </p>
                </div>
              </div>
              {Math.abs(monthlyNet - reconciledMonthlyNet) > 0.01 && (
                <div className="mt-2 text-xs text-gray-500">
                  Líquido do mês (total): {showValues ? formatCurrency(monthlyNet) : '••••••'}
                </div>
              )}
              <div className="mt-3 text-center">
                <p className="text-xs sm:text-sm text-gray-600">
                  Agendamentos avulsos este mês:{' '}
                  <span className="font-bold text-gray-800">{appointmentsMonth}</span>
                </p>
              </div>
            </div>

            {/* Desempenho inteligente */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-3 sm:p-5 rounded-xl border-2 border-slate-700 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-300" />
                  📈 Desempenho atendimentos
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPerformanceInsights((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold border border-white/20 hover:bg-white/15"
                >
                  {showPerformanceInsights ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showPerformanceInsights && (
                <>
                  {isLoadingPerformanceInsights ? (
                    <div className="space-y-2">
                      <div className="h-14 rounded-lg bg-white/10 animate-pulse" />
                      <div className="h-14 rounded-lg bg-white/10 animate-pulse" />
                      <div className="h-14 rounded-lg bg-white/10 animate-pulse" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-white/15 bg-black/20 p-3">
                        <p className="text-xs uppercase tracking-wide text-cyan-200 font-semibold mb-2">Histórico dos últimos 7 dias</p>
                        <div className="space-y-2">
                          {last7DaysPerformance.map((day) => (
                            <div key={day.date} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-white/90">
                                  {toDayLabel(day.date)} • {formatDateOnly(day.date)}
                                </span>
                                <span className="font-bold text-emerald-300">
                                  {showValues ? formatCurrency(day.net) : '••••••'}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-white/70">
                                {day.attendances} atendimento(s)
                              </div>
                              <div className="mt-2 h-1.5 rounded bg-white/10 overflow-hidden">
                                <div
                                  className="h-1.5 rounded bg-gradient-to-r from-cyan-400 to-emerald-400"
                                  style={{ width: `${Math.max(8, (day.net / topLast7DaysNet) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-300/30 bg-amber-400/10 p-3">
                        <p className="text-xs uppercase tracking-wide text-amber-200 font-semibold mb-1">🏆 Melhor dia do mês</p>
                        {currentMonthBestDay ? (
                          <div className="space-y-1 text-sm">
                            <p className="font-extrabold text-white">{formatDateOnly(currentMonthBestDay.date)}</p>
                            <p className="text-white/90">💰 Lucro líquido: <strong>{showValues ? formatCurrency(currentMonthBestDay.net) : '••••••'}</strong></p>
                            <p className="text-white/90">👥 Clientes atendidos: <strong>{currentMonthBestDay.clients}</strong></p>
                            <p className="text-white/90">✂️ Serviços realizados: <strong>{currentMonthBestDay.services}</strong></p>
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-amber-300/20 border border-amber-300/40 text-[11px] font-bold text-amber-100">
                              <Flame className="w-3 h-3 mr-1" /> Recorde do mês
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-white/70">Sem dados suficientes no mês atual.</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 p-3">
                        <p className="text-xs uppercase tracking-wide text-emerald-200 font-semibold mb-1">📊 Desempenho de hoje</p>
                        <p className="text-sm text-white/90">
                          Já realizado líquido: <strong>{showValues ? formatCurrency(dailyNet) : '••••••'}</strong>
                        </p>
                        <p className="text-sm text-white/90">
                          Concluídos: <strong>{appointmentsToday}</strong> • Faltam: <strong>{remainingTodayRows.length}</strong>
                        </p>
                        <p className="text-sm text-white/90">
                          Ainda pode ganhar: <strong>{showValues ? formatCurrency(remainingPotentialNet) : '••••••'}</strong>
                        </p>
                        <p className="text-sm text-cyan-200 mt-1">
                          💸 Previsão final do dia: <strong>{showValues ? formatCurrency(predictedFinalTodayNet) : '••••••'}</strong>
                        </p>
                        <p className="text-[11px] text-white/70 mt-1">
                          Previsão se todos os serviços forem concluídos.
                        </p>
                      </div>

                      <div className="rounded-lg border border-white/15 bg-black/20 p-3">
                        <p className="text-xs uppercase tracking-wide text-cyan-200 font-semibold mb-2">💰 Histórico salarial (últimos 5 meses)</p>
                        <div className="space-y-2">
                          {monthlyPerformanceHistory.map((month) => (
                            <div key={month.key} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold capitalize">{month.label}</span>
                                <span className="font-bold text-emerald-300">
                                  {showValues ? formatCurrency(month.net) : '••••••'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between mt-1 text-[11px] text-white/70">
                                <span>{month.attendances} atendimentos</span>
                                <span>
                                  {month.growthPercent == null
                                    ? '—'
                                    : month.growthPercent >= 0
                                      ? `⬆️ +${month.growthPercent.toFixed(1)}%`
                                      : `⬇️ ${month.growthPercent.toFixed(1)}%`}
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 rounded bg-white/10 overflow-hidden">
                                <div
                                  className="h-1.5 rounded bg-gradient-to-r from-violet-400 to-cyan-400"
                                  style={{ width: `${Math.max(8, (month.net / topMonthlyNet) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Desempenho em Assinaturas — separado do avulso */}
            <div className="isolation-isolate bg-[#141516] p-3 sm:p-5 rounded-xl border-2 border-violet-500/30 text-white">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                    <Crown className="w-5 h-5 text-violet-300" />
                    💈 Desempenho em Assinaturas
                  </h3>
                  {showSubscriberPerformanceSection ? (
                    <p className="text-xs text-violet-200/70 mt-1">
                      Repasses e atendimentos de plano • {subscriberControl.periodLabel}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSubscriberPerformanceSection((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold border border-white/20 hover:bg-white/15"
                >
                  {showSubscriberPerformanceSection ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {showSubscriberPerformanceSection && (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {(['current', 'previous', 'last3'] as SubscriberPerformancePeriod[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSubscriberPerformancePeriod(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${subscriberPerformancePeriod === key
                            ? 'bg-violet-600 border-violet-400 text-white'
                            : 'bg-white/5 border-white/15 text-violet-100 hover:bg-white/10'
                          }`}
                      >
                        {formatSubscriberPeriodFilterLabel(key)}
                      </button>
                    ))}
                  </div>
                  {subscriberControl.loading ? (
                    <div className="space-y-2">
                      <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5].map((item) => (
                          <div key={item} className="h-14 rounded-xl bg-white/10 animate-pulse" />
                        ))}
                      </div>
                    </div>
                  ) : !subscriberControl.hasData ? (
                    <div className="rounded-xl border border-violet-500/20 bg-black/20 p-6 text-center">
                      <p className="text-sm text-violet-100/80">
                        Nenhum atendimento de assinatura neste período para {professional.name}.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Os dados seguem a mesma base do Controle por Profissional em Meus Assinantes.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {subscriberControl.isOwnerProfessional && (
                        <p className="text-xs text-emerald-300 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                          Dono (100%): repasse de assinatura não gera pagamento para si mesmo.
                        </p>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {[
                          {
                            icon: DollarSign,
                            label: 'Líquido',
                            value: showValues
                              ? subscriberControl.fmtBRL(subscriberControl.metrics.totalValue)
                              : '••••••',
                            accent: 'text-emerald-300',
                          },
                          {
                            icon: BarChart3,
                            label: 'Ticket médio',
                            value:
                              showValues && subscriberControl.metrics.averageTicket > 0
                                ? subscriberControl.fmtBRL(subscriberControl.metrics.averageTicket)
                                : '—',
                            accent: 'text-violet-300',
                          },
                          {
                            icon: CheckCircle2,
                            label: 'Pago',
                            value: showValues
                              ? subscriberControl.fmtBRL(subscriberControl.metrics.totalPaid)
                              : '••••••',
                            accent: 'text-sky-300',
                          },
                          {
                            icon: Clock,
                            label: 'Pendente',
                            value:
                              subscriberControl.metrics.pointsFromAttendances > 0 &&
                                subscriberControl.metrics.totalValue <= 0 &&
                                subscriberControl.metrics.saleCommissionCount === 0
                                ? `${subscriberControl.metrics.pointsFromAttendances} ponto(s)`
                                : showValues
                                  ? subscriberControl.fmtBRL(subscriberControl.metrics.pendingValue)
                                  : '••••••',
                            accent:
                              subscriberControl.metrics.pendingValue > 0 ? 'text-amber-300' : 'text-gray-300',
                          },
                          {
                            icon: Scissors,
                            label: 'Visitas',
                            value: String(subscriberControl.metrics.attendanceCount),
                            accent: 'text-fuchsia-300',
                          },
                        ].map((tile) => (
                          <div
                            key={tile.label}
                            className="rounded-xl border border-violet-500/20 bg-black/25 p-3 min-w-0"
                          >
                            <div className="flex items-center gap-1.5 text-[11px] text-violet-200/70 mb-1.5">
                              <tile.icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{tile.label}</span>
                            </div>
                            <p className={`text-sm sm:text-base font-bold truncate ${tile.accent}`}>{tile.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Líquido diário e semanal */}
                      {(() => {
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                        const d7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                        const sevenDaysAgo = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, '0')}-${String(d7.getDate()).padStart(2, '0')}`;

                        const allAttendances = subscriberControl.subscriberAttendances || [];
                        const myAttendances = allAttendances.filter((a: any) => {
                          const profName = String(a.professional_name || '').trim().toLowerCase();
                          const currentName = String(professional.name || '').trim().toLowerCase();
                          if (profName === currentName) return true;
                          const profId = String(a.professional_id || '').trim();
                          if (profId && profId === String(professional.id || '').trim()) return true;
                          const group = subscriberControl.getProfessionalGroupFromAttendance(a);
                          return group === subscriberControl.groupKey;
                        });

                        const getDate = (a: any) => String(a.attendance_date || '').slice(0, 10);
                        const todayAtts = myAttendances.filter((a: any) => getDate(a) === todayStr);
                        const weekAtts = myAttendances.filter((a: any) => getDate(a) >= sevenDaysAgo);
                        const todayLiquid = todayAtts.reduce((s: number, a: any) => s + Number(a.repass_value || 0), 0);
                        const weekLiquid = weekAtts.reduce((s: number, a: any) => s + Number(a.repass_value || 0), 0);
                        const todayCount = todayAtts.length;
                        const weekCount = weekAtts.length;

                        return (
                          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 min-w-0">
                              <div className="flex items-center gap-1.5 text-[11px] text-emerald-200/70 mb-1.5">
                                <Calendar className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Hoje</span>
                              </div>
                              <p className="text-sm sm:text-base font-bold text-emerald-300">
                                {showValues ? subscriberControl.fmtBRL(todayLiquid) : '••••••'}
                              </p>
                              <p className="text-[10px] text-emerald-200/50 mt-0.5">
                                {todayCount} atendimento{todayCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 min-w-0">
                              <div className="flex items-center gap-1.5 text-[11px] text-sky-200/70 mb-1.5">
                                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">Últimos 7 dias</span>
                              </div>
                              <p className="text-sm sm:text-base font-bold text-sky-300">
                                {showValues ? subscriberControl.fmtBRL(weekLiquid) : '••••••'}
                              </p>
                              <p className="text-[10px] text-sky-200/50 mt-0.5">
                                {weekCount} atendimento{weekCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })()}

                      {(subscriberControl.metrics.pointsFromAttendances > 0 ||
                        subscriberControl.metrics.saleCommissionCount > 0) && (
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            {subscriberControl.metrics.pointsFromAttendances > 0 && (
                              <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                                {subscriberControl.metrics.pointsFromAttendances} ponto(s) sem repasse em R$
                              </span>
                            )}
                            {subscriberControl.metrics.saleCommissionCount > 0 && (
                              <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-violet-200">
                                {subscriberControl.metrics.saleCommissionCount} venda(s) com bônus
                              </span>
                            )}
                          </div>
                        )}

                      <div className="rounded-xl border border-violet-500/20 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <p className="text-xs font-semibold text-violet-100 uppercase tracking-wide">
                            Clientes de assinatura atendidos
                          </p>
                          {subscriberControl.metrics.uniqueClientsCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowSubscriberClientsModal(true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/20 transition-colors"
                            >
                              Ver detalhes ({subscriberControl.metrics.attendanceCount} visitas · {subscriberControl.metrics.uniqueClientsCount} assinantes)
                            </button>
                          )}
                        </div>
                        {subscriberControl.metrics.uniqueClientsCount === 0 ? (
                          <p className="text-xs text-gray-500">Nenhum assinante atendido neste período.</p>
                        ) : (
                          <p className="text-xs text-gray-400">
                            Abra o detalhamento para ver cada atendimento com data, horário, serviço e mensalidade.
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-amber-500/25 bg-[#1e1608] p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Star className="w-4 h-4 text-amber-300" />
                          <p className="text-xs font-semibold text-amber-100 uppercase tracking-wide">
                            Assinantes exclusivos
                          </p>
                        </div>
                        {subscriberControl.exclusiveSubscribers.length === 0 ? (
                          <p className="text-xs text-gray-500">
                            Nenhum assinante configurado para agendar somente com este profissional.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {subscriberControl.exclusiveSubscribers.map((subscriber) => (
                              <span
                                key={subscriber.id}
                                title={subscriber.name}
                                className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-50 transition-all hover:border-amber-300/60 hover:bg-amber-400/20 hover:shadow-md hover:shadow-amber-500/10"
                              >
                                <Gem className="w-3.5 h-3.5 text-amber-300 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate">{subscriber.name}</span>
                                <span className="hidden sm:inline rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                                  EXCLUSIVO
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void subscriberControl.refresh()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/10 transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${subscriberControl.loading ? 'animate-spin' : ''}`} />
                          Atualizar assinaturas
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Serviços mais realizados (mini BI do profissional) */}
            <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 p-3 sm:p-5 rounded-xl border-2 border-indigo-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-base sm:text-lg font-semibold text-indigo-900">Serviços mais realizados</h3>
                <button
                  type="button"
                  onClick={() => setShowServiceInsights((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-white/90 text-indigo-700 text-xs font-semibold border border-indigo-200 hover:bg-white"
                >
                  {showServiceInsights ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showServiceInsights && (
                <>
                  {serviceInsights.length === 0 ? (
                    <p className="text-sm text-gray-600">Sem atendimentos concluídos no período para montar ranking.</p>
                  ) : (
                    <div className="space-y-2">
                      {serviceInsights.slice(0, 8).map((item, idx) => (
                        <div key={`${item.name}-${idx}`} className="rounded-lg border border-indigo-100 bg-white p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-xs sm:text-sm">
                            <span className="font-semibold text-gray-900">{idx + 1}. {item.name}</span>
                            <span className="text-indigo-700 font-bold">{item.count} atendimento(s)</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                            <span>Valor gerado</span>
                            <span className="font-semibold text-emerald-700">{showValues ? formatCurrency(item.gross) : '••••••'}</span>
                          </div>
                          <div className="mt-2 h-2 rounded bg-indigo-100 overflow-hidden">
                            <div
                              className="h-2 rounded bg-gradient-to-r from-indigo-500 to-cyan-500"
                              style={{ width: `${Math.max(8, (item.count / topServiceCount) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-indigo-700 font-semibold">
                            Participação: {item.sharePercent.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cancelamentos (com seletor de período) */}
            <div className="bg-gradient-to-r from-rose-50 to-orange-50 p-3 sm:p-5 rounded-xl border-2 border-rose-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-base sm:text-lg font-semibold text-rose-900">📅 Cancelamentos do período</h3>
                <button
                  type="button"
                  onClick={() => setShowCancelledInsights((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-white/90 text-rose-700 text-xs font-semibold border border-rose-200 hover:bg-white"
                >
                  {showCancelledInsights ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showCancelledInsights && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-rose-800 mb-1">Data inicial</label>
                      <input
                        type="date"
                        value={cancelStartDate}
                        onChange={(e) => setCancelStartDate(e.target.value)}
                        className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-rose-800 mb-1">Data final</label>
                      <input
                        type="date"
                        value={cancelEndDate}
                        onChange={(e) => setCancelEndDate(e.target.value)}
                        className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                    </div>
                  </div>
                  {cancelStartDate > cancelEndDate && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      A data inicial não pode ser maior que a data final.
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                    <div className="rounded-lg border border-rose-200 bg-white p-3">
                      <p className="text-xs text-gray-600">Cancelamentos</p>
                      <p className="text-lg sm:text-xl font-bold text-rose-700">{cancelInsightsPeriod.totalCancelled}</p>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-white p-3">
                      <p className="text-xs text-gray-600">Perdido bruto</p>
                      <p className="text-lg sm:text-xl font-bold text-rose-700">
                        {showValues ? formatCurrency(cancelInsightsPeriod.lostGross) : '••••••'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-white p-3">
                      <p className="text-xs text-gray-600">Perdido líquido (comissão)</p>
                      <p className="text-lg sm:text-xl font-bold text-orange-700">
                        {showValues ? formatCurrency(cancelInsightsPeriod.lostNet) : '••••••'}
                      </p>
                    </div>
                  </div>

                  {cancelInsightsPeriod.byService.length > 0 ? (
                    <div className="space-y-2">
                      {cancelInsightsPeriod.byService.slice(0, 6).map((item, idx) => (
                        <div key={`cancel-${item.name}-${idx}`} className="rounded-lg border border-rose-100 bg-white p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-xs sm:text-sm">
                            <span className="font-semibold text-gray-900">{idx + 1}. {item.name}</span>
                            <span className="text-rose-700 font-bold">{item.count} cancelado(s)</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-xs text-gray-600">
                            <span>Perda bruta</span>
                            <span className="font-semibold text-rose-700">{showValues ? formatCurrency(item.gross) : '••••••'}</span>
                          </div>
                          <div className="mt-2 h-2 rounded bg-rose-100 overflow-hidden">
                            <div
                              className="h-2 rounded bg-gradient-to-r from-rose-500 to-orange-500"
                              style={{ width: `${Math.max(8, (item.count / topCancelledServiceCount) * 100)}%` }}
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-rose-700 font-semibold">
                            Participação nos cancelamentos: {item.sharePercent.toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Sem cancelamentos no período.</p>
                  )}
                </>
              )}
            </div>

            {/* Clientes sumidos */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-100 p-3 sm:p-5 rounded-xl border-2 border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Clientes sumidos (+30 dias)</h3>
                <button
                  type="button"
                  onClick={() => { void handleToggleDormantClients(); }}
                  className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-700 text-xs font-semibold border border-slate-200 hover:bg-white"
                >
                  {showDormantClients ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {showDormantClients && (
                <>
                  {dismissedDormantKeys.length > 0 && (
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleRestoreHiddenDormantClients}
                        className="px-2.5 py-1 rounded-md bg-white text-slate-700 text-xs font-semibold border border-slate-200 hover:bg-slate-50"
                      >
                        Reexibir ocultados
                      </button>
                    </div>
                  )}
                  {(isRefreshingDormantSource || (!hasDormantClientsSource && isLoadingDormantClients)) ? (
                    <p className="text-sm text-gray-600">Carregando clientes sumidos...</p>
                  ) : visibleDormantClients.length === 0 ? (
                    <p className="text-sm text-gray-600">Nenhum cliente acima de 30 dias sem agendar com este profissional.</p>
                  ) : (
                    <div className="space-y-2">
                      {visibleDormantClients.map((client, idx) => {
                        const whatsappUrl = buildWhatsappLink(client.whatsapp);
                        const whatsappDisplay = formatWhatsappDisplay(client.whatsapp);
                        return (
                          <div key={`${client.name}-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900">{client.name}</p>
                              <div className="flex items-center gap-1.5">
                                {whatsappUrl && (
                                  <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-md bg-green-600 text-white text-[11px] font-semibold hover:bg-green-700"
                                  >
                                    WhatsApp
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDismissDormantClient(client)}
                                  className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200 hover:bg-slate-200"
                                  title="Ocultar cliente desta lista"
                                >
                                  X
                                </button>
                              </div>
                            </div>
                            {whatsappDisplay && (
                              <p className="text-xs text-gray-600 mt-1">WhatsApp: {whatsappDisplay}</p>
                            )}
                            <p className="text-xs text-gray-600 mt-1">
                              Última visita: {formatDateOnly(client.lastVisitDate)} ({client.daysWithoutBooking} dias sem aparecer)
                            </p>
                            <p className="text-xs text-gray-600">Serviço recorrente: {client.favoriteService}</p>
                            <p className="text-xs text-gray-700 font-semibold mt-1">
                              Total gasto: {showValues ? formatCurrency(client.totalSpent) : '••••••'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Histórico financeiro do colaborador (igual ao financeiro) */}
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 sm:p-5 rounded-xl border-2 border-blue-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-blue-800">Histórico de pagamentos do mês</h3>
                <button
                  onClick={() => setShowPaymentHistory((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-white/80 text-blue-700 text-xs font-semibold border border-blue-200 hover:bg-white"
                >
                  {showPaymentHistory ? 'Ocultar histórico' : 'Mostrar histórico'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-gray-600">Total pago</p>
                  <p className="text-lg sm:text-xl font-bold text-green-700">
                    {showValues ? formatCurrency(totalPaidDisplay) : '••••••'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-gray-600">Pendente para receber</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-800">
                    {showValues ? formatCurrency(pendingToReceive) : '••••••'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-gray-600">Status</p>
                  <p className={`text-lg sm:text-xl font-bold ${pendingToReceive > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {pendingToReceive > 0 ? 'Pendente' : 'Em dia'}
                  </p>
                </div>
              </div>

              <div className="text-xs text-blue-800 mb-3">
                {paymentCount} pagamento(s) no mês
                {lastPaymentDate ? ` • Último pagamento: ${formatDateTime(lastPaymentDate)}` : ''}
                {totalWithdrawnDisplay > 0 ? ` • Retirado: ${showValues ? formatCurrency(totalWithdrawnDisplay) : '••••••'}` : ''}
              </div>

              {showPaymentHistory && (
                <div className="bg-white rounded-lg border border-blue-100 p-3 max-h-56 overflow-y-auto space-y-2">
                  {isLoadingPayments ? (
                    <p className="text-sm text-gray-500">Carregando histórico...</p>
                  ) : paymentHistory.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum pagamento registrado neste mês.</p>
                  ) : (
                    paymentHistory.map((row) => (
                      <div key={row.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded border border-gray-100 bg-gray-50">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {showValues
                              ? formatCurrency(Math.abs(row.amount))
                              : '••••••'}
                          </p>
                          <p className="text-xs text-gray-500">{formatDateTime(row.payment_date)}</p>
                        </div>
                        <span className={`text-xs font-semibold ${row.amount >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                          {row.amount >= 0 ? 'Pago' : 'Retirado'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Explicação dos valores */}
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-2">💡 Sobre os Valores</h4>
              <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                {!hideGrossInFinancial && <li>• <strong>Valor Bruto:</strong> Total sem descontos</li>}
                <li>• <strong>Valor Pago:</strong> Total de pagamentos já registrados no mês</li>
                <li>• <strong>Líquido do mês (total):</strong> Valor líquido total apurado dos atendimentos do mês</li>
                {(professional.percentage !== undefined || basePercentage !== undefined) && (
                  <li>• <strong>Percentual base:</strong> {Number(basePercentage ?? professional.percentage ?? 0).toFixed(2)}%</li>
                )}
                {metaGoalReached && metaBonusPercentage > 0 && metaServiceCount > 0 && (
                  <li>
                    • <strong>Meta batida:</strong> serviços da meta usam{' '}
                    <strong>{Number(metaBonusPercentage).toFixed(2)}%</strong>; serviços fora da meta seguem no percentual base.
                  </li>
                )}
                <li className="pt-2 text-yellow-700">⚠️ <strong>Importante:</strong> Valores pendentes não são contabilizados</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 p-3 sm:p-4 rounded-b-xl sm:rounded-b-2xl border-t">
            <button
              onClick={onClose}
              className="w-full py-2.5 sm:py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {establishmentId && (
        <ProfessionalAttendedClientsModal
          open={showSubscriberClientsModal}
          onClose={() => setShowSubscriberClientsModal(false)}
          professional={professional.name}
          groupKey={subscriberControl.groupKey}
          subscriberAttendances={subscriberControl.subscriberAttendances}
          clientSubscriptions={subscriberControl.clientSubscriptions}
          selectedMonth={subscriberControl.modalSelectedMonth}
          selectedYear={subscriberControl.modalSelectedYear}
          monthLabel={subscriberControl.monthLabelForModal}
          establishmentId={establishmentId}
          fmtBRL={subscriberControl.fmtBRL}
          getProfessionalGroupFromAttendance={subscriberControl.getProfessionalGroupFromAttendance}
          getAttendanceEffectiveRepass={subscriberControl.getAttendanceEffectiveRepass}
          exclusiveSubscriberIds={subscriberControl.exclusiveSubscriberIds}
          defaultView="timeline"
        />
      )}
    </>
  );
};

