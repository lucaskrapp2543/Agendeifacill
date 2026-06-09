import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { checkWhatsAppSubscriber as checkNewSubscriber } from '../lib/subscriberSystem';
import { checkWhatsAppSubscriber as checkLegacySubscriber, supabase } from '../lib/supabase';
import { checkMonthlyLimit } from '../utils/monthlyLimitValidation';
import { validatePendingClientBookingLimit } from '../utils/pendingClientBookingValidation';
import { validateSameDayReschedule } from '../utils/sameDayRescheduleValidation';
import { getEffectiveAppointmentBaseDurationMinutes } from '../utils/effectiveAppointmentDuration';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { TimeSlotSelector } from './TimeSlotSelector';
import { filterTimesAlignedToScheduleGrid, getScheduleIntervalMinutes } from '../utils/scheduleGrid';
import { registerAfcoinBookingEvent } from '../utils/afcoin';

type ChatStep =
  | 'name'
  | 'phone'
  | 'subscriberChoice'
  | 'expiredSubscriberChoice'
  | 'professional'
  | 'service'
  | 'datetime'
  | 'products'
  | 'confirm';

interface BookingChatFlowProps {
  establishment: any;
  guestClientData: { name: string; phone: string } | null;
  onGuestClientDataCollected?: (name: string, phone: string) => void;
  /** Abre o mesmo modal de renovação PIX do booking (dados do assinante vencido no chat). */
  onOpenRenewSubscription?: (detectedSubscriber: any) => void;
  onCloseChat?: () => void;
  existingAppointments: any[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSubmit: (appointmentData: any) => Promise<void>;
  requireAdvancePayment: boolean;
  subscriberServices?: any[];
  subscriberExtraServiceCategories?: any[];
  bookingHighlightedProducts?: Array<{
    id: string;
    name: string;
    sale_price: number;
    image_url?: string | null;
    stock_quantity?: number | null;
    highlight_for_client_booking?: boolean | null;
  }>;
}

const toMoney = (value: number): string => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const DEFAULT_SERVICE_IMAGE_URL = '/SERVIÇOS2.png';
const toBRDateFromDateOnly = (value: string): string => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};
const formatDuration = (minutes: number): string => `${Math.max(0, Number(minutes || 0))} min`;
const onlyDigits = (raw: string) => String(raw || '').replace(/\D/g, '');
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
};
/** Duração em minutos; 0/null não pode virar 1 (isso liberava slots no meio do atendimento). */
const parseDurationMinutes = (value: unknown, fallback = 30): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Math.round(value) : fallback;
  }
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2]);
    const total = hours * 60 + minutes;
    return Number.isFinite(total) && total > 0 ? total : fallback;
  }
  const normalized = raw.replace(',', '.');
  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const extracted = Number(normalized.replace(/[^\d.]/g, ''));
  if (Number.isFinite(extracted) && extracted > 0) return Math.round(extracted);
  return fallback;
};
const normalizeSpecificService = (raw: any, fallbackKey: string) => {
  const name = String(raw?.name || raw?.service_name || '').trim();
  const price = Number(raw?.price ?? raw?.service_price ?? 0);
  const duration = Number(raw?.duration ?? raw?.service_duration_minutes ?? 0);
  const rawId = String(raw?.id || raw?.service_id || '').trim();
  if (!name || !Number.isFinite(price) || price <= 0) return null;
  return {
    id: rawId || `specific-generated-${fallbackKey}`,
    name,
    price,
    duration: Number.isFinite(duration) && duration > 0 ? duration : 30,
  };
};
const formatPhoneChat = (raw: string) => {
  const digits = onlyDigits(raw).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 3) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 3)} ${digits.slice(3)}`;
};
const normalizeWhatsappForStorage = (raw: string): string => {
  let digits = onlyDigits(raw);
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits;
};
const formatCpfChat = (raw: string) => {
  const digits = onlyDigits(raw).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const buildLoyaltyPhoneLookupVariants = (rawPhone: string): string[] => {
  const digits = onlyDigits(rawPhone);
  if (!digits) return [];

  const withoutCountry = digits.startsWith('55') && digits.length > 2 ? digits.slice(2) : digits;
  const baseCandidates = new Set<string>([withoutCountry]);

  // Compatibilidade BR: alguns históricos antigos podem existir com/sem o "9" local.
  if (withoutCountry.length === 10) {
    baseCandidates.add(`${withoutCountry.slice(0, 2)}9${withoutCountry.slice(2)}`);
  }
  if (withoutCountry.length === 11 && withoutCountry.slice(2, 3) === '9') {
    baseCandidates.add(`${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`);
  }

  const out = new Set<string>();
  baseCandidates.forEach((base) => {
    const clean = onlyDigits(base);
    if (!clean) return;
    out.add(clean);
    out.add(`55${clean}`);
  });
  return Array.from(out);
};

const weekdayPtMap: Record<string, string> = {
  monday: 'segunda-feira',
  tuesday: 'terça-feira',
  wednesday: 'quarta-feira',
  thursday: 'quinta-feira',
  friday: 'sexta-feira',
  saturday: 'sábado',
  sunday: 'domingo',
};

const getWeekdayKey = (date: Date): string => {
  const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return keys[date.getDay()] || 'sunday';
};

const buildBusinessHoursForDate = (establishment: any, selectedDate: Date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = days[selectedDate.getDay()];
  const raw = establishment?.business_hours?.[dayKey];
  if (!raw) return { enabled: false, open1: '', close1: '', open2: null, close2: null };
  const formatTime = (time: string | null | undefined) => {
    if (!time) return '';
    const [h, m] = String(time).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return {
    enabled: Boolean(raw?.enabled),
    open1: formatTime(raw?.open1 ?? raw?.open),
    close1: formatTime(raw?.close1 ?? raw?.close),
    open2: raw?.open2 ? formatTime(raw?.open2) : null,
    close2: raw?.close2 ? formatTime(raw?.close2) : null,
  };
};

const getMinimumAdvanceMinutes = (establishment: any): number => {
  const rawMinutes = Number((establishment as any)?.booking_min_advance_minutes ?? 0);
  if (Number.isFinite(rawMinutes) && rawMinutes > 0) return Math.max(0, Math.floor(rawMinutes));
  const rawHours = Number((establishment as any)?.booking_min_advance_hours ?? 0);
  if (!Number.isFinite(rawHours) || rawHours <= 0) return 0;
  return Math.max(0, Math.floor(rawHours * 60));
};

export function BookingChatFlow({
  establishment,
  guestClientData,
  onGuestClientDataCollected,
  onOpenRenewSubscription,
  onCloseChat,
  existingAppointments,
  selectedDate,
  onSelectDate,
  onSubmit,
  requireAdvancePayment,
  subscriberServices = [],
  subscriberExtraServiceCategories = [],
  bookingHighlightedProducts = [],
}: BookingChatFlowProps) {
  const [step, setStep] = useState<ChatStep>('name');
  const [chatClientName, setChatClientName] = useState(String(guestClientData?.name || '').trim());
  const [chatClientPhone, setChatClientPhone] = useState(formatPhoneChat(String(guestClientData?.phone || '').trim()));
  const [draftInput, setDraftInput] = useState('');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSubscriber, setIsCheckingSubscriber] = useState(false);
  const [isCheckingPendingClientBooking, setIsCheckingPendingClientBooking] = useState(false);
  const [pendingClientBookingMessage, setPendingClientBookingMessage] = useState<string | null>(null);
  const [sameDayRescheduleMessage, setSameDayRescheduleMessage] = useState<string | null>(null);
  const [detectedSubscriber, setDetectedSubscriber] = useState<any>(null);
  const [expiredSubscriberRecord, setExpiredSubscriberRecord] = useState<any>(null);
  const [expiredSubscriberAction, setExpiredSubscriberAction] = useState<'renew' | 'skip' | null>(null);
  const [isSubscriberFlow, setIsSubscriberFlow] = useState(false);
  const [selectedSubscriberServiceId, setSelectedSubscriberServiceId] = useState('');
  const [selectedSubscriberServiceIds, setSelectedSubscriberServiceIds] = useState<string[]>([]);
  const [selectedSubscriberExtraIds, setSelectedSubscriberExtraIds] = useState<string[]>([]);
  const [selectedBookingProductIds, setSelectedBookingProductIds] = useState<string[]>([]);
  const [selectedBookingProductImagePreview, setSelectedBookingProductImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [showSubscriberSelectionHint, setShowSubscriberSelectionHint] = useState(false);
  const [chatClientCpf, setChatClientCpf] = useState('');
  const [invalidSubscriberDateMessage, setInvalidSubscriberDateMessage] = useState('');
  const [visibleSlotsCountForSelectedProfessional, setVisibleSlotsCountForSelectedProfessional] = useState<number | null>(null);
  const [subscriberLimitStatus, setSubscriberLimitStatus] = useState<{
    isLoading: boolean;
    canBook: boolean;
    currentUsage: number;
    monthlyLimit: number | string;
    remaining: number | null;
  }>({
    isLoading: false,
    canBook: true,
    currentUsage: 0,
    monthlyLimit: 'Ilimitado',
    remaining: null,
  });
  const [subscriberServiceLimitMap, setSubscriberServiceLimitMap] = useState<Record<string, {
    canBook: boolean;
    currentUsage: number;
    monthlyLimit: number | null;
    remaining: number | null;
    errorMessage?: string;
  }>>({});
  const [isLoadingSubscriberServiceLimits, setIsLoadingSubscriberServiceLimits] = useState(false);
  const [publicLoyaltyRow, setPublicLoyaltyRow] = useState<{ cycle_goal: number; cycle_progress: number } | null>(null);
  const [publicLoyaltyLoading, setPublicLoyaltyLoading] = useState(false);
  const [publicLoyaltyRedeemApplied, setPublicLoyaltyRedeemApplied] = useState(false);
  const [afcoinPhoneAwarded, setAfcoinPhoneAwarded] = useState(false);
  const [afcoinScheduleAwarded, setAfcoinScheduleAwarded] = useState(false);
  const afcoinsEnabled = Boolean(String((establishment as any)?.mercadopago_access_token || '').trim());

  const markAfcoinScheduleMilestone = () => {
    if (!afcoinsEnabled || afcoinScheduleAwarded) return;
    toast.success('✨ Você ganhou mais +10 AFCoins');
    setAfcoinScheduleAwarded(true);
  };

  const professionals = useMemo(() => {
    const visibleProfessionals = Array.isArray(establishment?.professionals)
      ? establishment.professionals.filter((p: any) => !p?.hidden_from_booking)
      : [];
    const lockedProfessionalId = String((detectedSubscriber as any)?.subscriber_professional_id || '').trim();
    if (!isSubscriberFlow || !lockedProfessionalId) return visibleProfessionals;
    const lockedList = visibleProfessionals.filter((p: any) => String(p?.id || '').trim() === lockedProfessionalId);
    return lockedList.length > 0 ? lockedList : visibleProfessionals;
  }, [detectedSubscriber, establishment?.professionals, isSubscriberFlow]);

  const selectedProfessional = useMemo(
    () => professionals.find((professional: any) => String(professional?.id || '') === String(selectedProfessionalId || '')),
    [professionals, selectedProfessionalId]
  );
  useEffect(() => {
    if (!selectedProfessionalId) return;
    const stillAvailable = professionals.some((professional: any) => String(professional?.id || '') === String(selectedProfessionalId || ''));
    if (!stillAvailable) {
      setSelectedProfessionalId('');
    }
  }, [professionals, selectedProfessionalId]);

  const enabledPaymentMethods = useMemo(() => {
    const defaults = ['pix', 'credito', 'debito', 'dinheiro', 'pagar_local'];
    const raw = Array.isArray((establishment as any)?.payment_methods_enabled)
      ? ((establishment as any).payment_methods_enabled as any[])
      : [];
    const normalized = raw
      .map((method) => String(method || '').trim().toLowerCase())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : defaults;
  }, [establishment]);

  const shouldSkipPaymentMethodQuestion = useMemo(() => {
    const hasMercadoPagoConnected = Boolean(String((establishment as any)?.mercadopago_access_token || '').trim());
    const hasAdvancePixEnabled = (establishment as any)?.exigir_pagamento_antecipado_mercadopago === true;
    return hasMercadoPagoConnected && hasAdvancePixEnabled;
  }, [establishment]);

  const shouldAskPaymentMethod = !isSubscriberFlow && !requireAdvancePayment && !shouldSkipPaymentMethodQuestion;

  useEffect(() => {
    if (!shouldAskPaymentMethod && selectedPaymentMethod) {
      setSelectedPaymentMethod('');
    }
  }, [shouldAskPaymentMethod, selectedPaymentMethod]);

  const allServices = useMemo(() => {
    const legacyServices = Array.isArray((establishment as any)?.legacy_services_with_prices)
      ? ((establishment as any).legacy_services_with_prices as any[])
      : [];
    const resolvedServices = Array.isArray(establishment?.services_with_prices)
      ? (establishment.services_with_prices as any[])
      : [];
    const specificRaw = Array.isArray((selectedProfessional as any)?.specific_services)
      ? (selectedProfessional as any).specific_services
      : [];
    const normalizedSpecific = specificRaw
      .map((service: any, index: number) =>
        normalizeSpecificService(
          service,
          `${String(selectedProfessionalId || 'prof')}-${index}-${String(service?.name || service?.service_name || '')}`
        )
      )
      .filter(Boolean)
      .map((service: any, index: number) => ({
        id: `specific-${service.id}`,
        name: service.name,
        price: Number(service.price || 0),
        duration: parseDurationMinutes(service.duration, 30),
        image_url: String((service as any)?.image_url || '').trim() || null,
        loyalty_points: Math.max(0, Math.floor(Number(service?.loyalty_points ?? 0))),
        __source_index: index,
      }));

    // Regra exigida: se profissional tem serviços específicos, mostrar APENAS eles.
    if (normalizedSpecific.length > 0) {
      return normalizedSpecific;
    }

    // Sem específico: seguir o mesmo serviço geral do fluxo antigo.
    const source = resolvedServices.length > 0 ? resolvedServices : legacyServices;
    const normalized = source.map((service: any, index: number) => {
      const normalizedName = String(service?.name || service?.service_name || '').trim();
      const rawId = String(service?.id || '').trim();
      const rawDuration = service?.duration ?? service?.service_duration ?? service?.service_duration_minutes;
      return {
        ...service,
        id: rawId || `service-${index}-${normalizedName || 'item'}`,
        name: normalizedName || `Serviço ${index + 1}`,
        price: Number(service?.price || service?.service_price || 0),
        duration: parseDurationMinutes(rawDuration, 30),
        image_url: String(service?.image_url || service?.service_image_url || '').trim() || null,
        loyalty_points: Math.max(0, Math.floor(Number(service?.loyalty_points ?? 0))),
        __source_index: index,
      };
    });

    const hasDisplayOrder = normalized.some((service: any) => Number.isFinite(Number(service?.display_order)));
    if (!hasDisplayOrder) return normalized;

    return [...normalized].sort((a: any, b: any) => {
      const aOrder = Number(a?.display_order);
      const bOrder = Number(b?.display_order);
      const aHas = Number.isFinite(aOrder);
      const bHas = Number.isFinite(bOrder);
      if (aHas && bHas && aOrder !== bOrder) return aOrder - bOrder;
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return Number(a?.__source_index || 0) - Number(b?.__source_index || 0);
    });
  }, [establishment?.legacy_services_with_prices, establishment?.services_with_prices, selectedProfessional, selectedProfessionalId]);

  const groupedServices = useMemo(() => {
    const map = new Map<string, { id: string; name: string; services: any[] }>();
    allServices.forEach((service: any) => {
      const categoryId = String(service?.category_id || 'sem-categoria');
      const categoryName = String(service?.category_name || 'Serviços');
      const key = `${categoryId}::${categoryName}`;
      if (!map.has(key)) map.set(key, { id: categoryId, name: categoryName, services: [] });
      map.get(key)!.services.push(service);
    });
    return Array.from(map.values());
  }, [allServices]);

  const selectedServices = useMemo(
    () => allServices.filter((service: any) => selectedServiceIds.includes(String(service?.id || ''))),
    [allServices, selectedServiceIds]
  );

  const subscriberServiceOptions = useMemo(() => {
    const allRaw = Array.isArray(subscriberServices) ? subscriberServices : [];
    const expanded = allRaw.flatMap((plan: any) => {
      const planId = String(plan?.id || '').trim();
      const dividedEnabled = Boolean(plan?.divide_services_enabled);
      const divided = Array.isArray(plan?.divided_services) ? plan.divided_services : [];
      if (!dividedEnabled || divided.length === 0) {
        return [{
          ...plan,
          subscription_id: planId || String(plan?.subscription_id || '').trim() || null,
          service_id: String((plan as any)?.service_id || '').trim() || null,
          service_limit: Number((plan as any)?.service_limit || 0) || null,
          booking_service_name: String((plan as any)?.booking_service_name || plan?.name || '').trim() || null,
          service_duration: Number((plan as any)?.service_duration || (plan as any)?.duration || 30) || 30,
          duration: Number((plan as any)?.service_duration || (plan as any)?.duration || 30) || 30,
        }];
      }

      return divided
        .map((entry: any, index: number) => {
          const entryId = String(entry?.id || '').trim();
          const entryName = String(entry?.name || '').trim();
          const entryDuration = Number(entry?.duration || 0);
          const entryLimit = Number(entry?.limit || 0);
          if (!entryName || !Number.isFinite(entryDuration) || entryDuration <= 0) return null;
          return {
            ...plan,
            id: `${planId || 'subscription'}::${entryId || `service-${index}`}`,
            subscription_id: planId || null,
            service_id: entryId || null,
            service_limit: Number.isFinite(entryLimit) && entryLimit > 0 ? entryLimit : null,
            booking_service_name: entryName,
            name: entryName,
            service_duration: entryDuration,
            duration: entryDuration,
          };
        })
        .filter(Boolean);
    });

    const detectedPlanId = String(
      (detectedSubscriber as any)?.subscription_id ||
      (detectedSubscriber as any)?.subscriptions?.id ||
      ''
    ).trim();
    if (!detectedPlanId) return expanded;
    const filtered = expanded.filter((service: any) => {
      const servicePlanId = String((service as any)?.subscription_id || service?.id || '').trim();
      return servicePlanId === detectedPlanId;
    });
    return filtered.length > 0 ? filtered : expanded;
  }, [detectedSubscriber, subscriberServices]);
  const selectedSubscriberService = useMemo(
    () => subscriberServiceOptions.find((service: any) => String(service?.id || '') === String(selectedSubscriberServiceId || '')),
    [selectedSubscriberServiceId, subscriberServiceOptions]
  );
  const selectedSubscriberServices = useMemo(
    () => subscriberServiceOptions.filter((service: any) => selectedSubscriberServiceIds.includes(String(service?.id || ''))),
    [selectedSubscriberServiceIds, subscriberServiceOptions]
  );
  const selectedPrimarySubscriberService = useMemo(
    () => selectedSubscriberService || selectedSubscriberServices[0] || null,
    [selectedSubscriberService, selectedSubscriberServices]
  );
  const isDividedSubscriberPlan = useMemo(
    () => subscriberServiceOptions.some((service: any) => Boolean(service?.divide_services_enabled)),
    [subscriberServiceOptions]
  );
  useEffect(() => {
    if (!selectedSubscriberServiceId) return;
    const stillExists = subscriberServiceOptions.some((service: any) => String(service?.id || '') === String(selectedSubscriberServiceId || ''));
    if (!stillExists) {
      setSelectedSubscriberServiceId('');
      setSelectedSubscriberExtraIds([]);
    }
  }, [selectedSubscriberServiceId, subscriberServiceOptions]);
  useEffect(() => {
    if (selectedSubscriberServiceIds.length === 0) return;
    const validIds = new Set(subscriberServiceOptions.map((service: any) => String(service?.id || '')));
    const next = selectedSubscriberServiceIds.filter((id) => validIds.has(String(id)));
    if (next.length !== selectedSubscriberServiceIds.length) {
      setSelectedSubscriberServiceIds(next);
    }
  }, [selectedSubscriberServiceIds, subscriberServiceOptions]);
  useEffect(() => {
    if (!isSubscriberFlow) return;
    if (isDividedSubscriberPlan) {
      const next = selectedSubscriberServiceIds.filter((id) => subscriberServiceLimitMap[String(id)]?.canBook !== false);
      if (next.length !== selectedSubscriberServiceIds.length) {
        setSelectedSubscriberServiceIds(next);
      }
      return;
    }
    if (!selectedSubscriberServiceId) return;
    if (subscriberServiceLimitMap[String(selectedSubscriberServiceId)]?.canBook === false) {
      setSelectedSubscriberServiceId('');
    }
  }, [isDividedSubscriberPlan, isSubscriberFlow, selectedSubscriberServiceId, selectedSubscriberServiceIds, subscriberServiceLimitMap]);

  const subscriberExtraServicesFlat = useMemo(() => {
    const categories = Array.isArray(subscriberExtraServiceCategories) ? subscriberExtraServiceCategories : [];
    return categories.flatMap((category: any) => (Array.isArray(category?.services) ? category.services : []));
  }, [subscriberExtraServiceCategories]);

  const selectedSubscriberExtraServices = useMemo(
    () => subscriberExtraServicesFlat.filter((service: any) => selectedSubscriberExtraIds.includes(String(service?.id || ''))),
    [selectedSubscriberExtraIds, subscriberExtraServicesFlat]
  );

  const availableBookingProducts = useMemo(() => {
    return (Array.isArray(bookingHighlightedProducts) ? bookingHighlightedProducts : []).filter((product: any) => {
      const highlighted = Boolean(product?.highlight_for_client_booking);
      const stock = Number(product?.stock_quantity ?? 0);
      const hasStock = !Number.isFinite(stock) || stock > 0;
      return highlighted && hasStock;
    });
  }, [bookingHighlightedProducts]);
  const hasBookingHighlightedProducts = availableBookingProducts.length > 0;

  const selectedBookingProducts = useMemo(
    () => availableBookingProducts.filter((product: any) => selectedBookingProductIds.includes(String(product?.id || ''))),
    [availableBookingProducts, selectedBookingProductIds]
  );

  const bookingProductsTotal = useMemo(
    () => selectedBookingProducts.reduce((sum: number, product: any) => sum + (Number(product?.sale_price) || 0), 0),
    [selectedBookingProducts]
  );

  useEffect(() => {
    const validIds = new Set(availableBookingProducts.map((product: any) => String(product?.id || '')));
    setSelectedBookingProductIds((previous) => previous.filter((id) => validIds.has(String(id))));
  }, [availableBookingProducts]);

  const computedSelection = useMemo(() => {
    if (isSubscriberFlow) {
      const baseServices = isDividedSubscriberPlan ? selectedSubscriberServices : (selectedPrimarySubscriberService ? [selectedPrimarySubscriberService] : []);
      const baseDuration = Math.max(
        0,
        baseServices.reduce(
          (sum: number, service: any) => sum + parseDurationMinutes((service as any)?.service_duration ?? (service as any)?.duration, 30),
          0
        )
      );
      const extraDuration = selectedSubscriberExtraServices.reduce((sum: number, service: any) => sum + (Number(service?.duration) || 0), 0);
      const extraPrice = selectedSubscriberExtraServices.reduce((sum: number, service: any) => sum + (Number(service?.price) || 0), 0);
      const baseName = baseServices
        .map((service: any) => String((service as any)?.booking_service_name || (service as any)?.name || '').trim())
        .filter(Boolean)
        .join(' + ');
      const extraNames = selectedSubscriberExtraServices.map((service: any) => String(service?.name || '').trim()).filter(Boolean);
      return {
        duration: Math.max(1, (baseDuration || 0) + extraDuration),
        price: extraPrice,
        serviceName: extraNames.length ? `${baseName} + Extra: ${extraNames.join(' + ')}` : baseName,
        loyaltyPointsAwarded: 0,
      };
    }

    const duration = selectedServices.reduce(
      (sum: number, service: any) => sum + parseDurationMinutes(
        service?.duration ?? service?.service_duration ?? service?.service_duration_minutes,
        0
      ),
      0
    );
    const price = selectedServices.reduce((sum: number, service: any) => sum + (Number(service?.price) || 0), 0);
    const serviceName = selectedServices.map((service: any) => String(service?.name || '').trim()).filter(Boolean).join(' + ');
    const loyaltyPointsAwarded = selectedServices.reduce(
      (sum: number, service: any) => sum + Math.max(0, Number(service?.loyalty_points ?? 0)),
      0
    );
    return { duration, price, serviceName, loyaltyPointsAwarded };
  }, [isDividedSubscriberPlan, isSubscriberFlow, selectedPrimarySubscriberService, selectedServices, selectedSubscriberExtraServices, selectedSubscriberServices]);

  const subscriberAllowedWeekdays = useMemo(() => {
    if (!isSubscriberFlow) return [] as string[];
    const weekdays = Array.isArray((selectedPrimarySubscriberService as any)?.weekdays) ? (selectedPrimarySubscriberService as any).weekdays : [];
    return weekdays.map((day: any) => String(day || '').toLowerCase().trim()).filter(Boolean);
  }, [isSubscriberFlow, selectedPrimarySubscriberService]);

  const isSelectedDateAllowedForSubscriber = useMemo(() => {
    if (!isSubscriberFlow) return true;
    if (subscriberAllowedWeekdays.length === 0) return true;
    return subscriberAllowedWeekdays.includes(getWeekdayKey(selectedDate));
  }, [isSubscriberFlow, selectedDate, subscriberAllowedWeekdays]);

  const fetchPublicLoyaltyProgress = async (
    establishmentId: string,
    phoneRaw: string
  ): Promise<{ cycle_goal: number; cycle_progress: number } | null> => {
    const phoneVariants = buildLoyaltyPhoneLookupVariants(phoneRaw);
    if (!establishmentId || phoneVariants.length === 0) return null;

    let rows: Array<{ cycle_goal?: number; cycle_progress?: number }> = [];
    for (const variant of phoneVariants) {
      const { data, error } = await supabase.rpc('get_public_loyalty_progress', {
        p_establishment_id: establishmentId,
        p_client_whatsapp: variant,
      });
      if (error) {
        const m = String(error.message || '').toLowerCase();
        const isKnownMissingFn = m.includes('function') || m.includes('does not exist') || m.includes('schema cache');
        if (!isKnownMissingFn) {
          console.warn('Fidelidade (resumo público):', error);
        }
        continue;
      }

      const parsed = (Array.isArray(data) ? data[0] : data) as
        | { cycle_goal?: number; cycle_progress?: number }
        | null
        | undefined;
      if (!parsed || parsed.cycle_goal == null) continue;

      const goal = Number(parsed.cycle_goal);
      const prog = Number(parsed.cycle_progress ?? 0);
      if (!Number.isFinite(goal) || goal < 2) continue;
      if (!Number.isFinite(prog)) continue;
      rows.push({ cycle_goal: goal, cycle_progress: Math.max(0, prog) });
    }

    if (rows.length === 0) return null;

    const resolvedGoal = Math.max(...rows.map((r) => Number(r.cycle_goal || 0)));
    const progresses = rows
      .map((r) => Math.max(0, Number(r.cycle_progress || 0)))
      .filter((x) => Number.isFinite(x));

    const hasZero = progresses.some((x) => x === 0);
    const nonZero = progresses.filter((x) => x > 0);

    // Heurística de compatibilidade:
    // - Se houver mistura de 0 e >0 entre variações do mesmo telefone, prioriza >0
    //   (evita esconder progresso real recém acumulado para o cliente).
    // - Fora isso, mantém critério conservador (menor valor).
    const resolvedProgress =
      hasZero && nonZero.length > 0
        ? Math.max(...nonZero)
        : Math.min(...progresses);

    if (rows.length > 1) {
      console.warn('Fidelidade: variacoes de telefone com progresso divergente no chat.', {
        phoneVariants,
        rows,
        resolvedGoal,
        resolvedProgress,
      });
    }

    return { cycle_goal: resolvedGoal, cycle_progress: Math.min(resolvedGoal, Math.max(0, resolvedProgress)) };
  };

  const effectiveSelectedService = useMemo(
    () => ({
      id: isSubscriberFlow ? String((selectedPrimarySubscriberService as any)?.id || 'subscriber-service') : 'normal-service',
      name: computedSelection.serviceName || 'Serviço',
      price: computedSelection.price || 0,
      duration: computedSelection.duration || 30,
    }),
    [computedSelection.duration, computedSelection.price, computedSelection.serviceName, isSubscriberFlow, selectedPrimarySubscriberService]
  );

  const businessHoursForDate = useMemo(() => buildBusinessHoursForDate(establishment, selectedDate), [establishment, selectedDate]);
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const subscriberDateLimitMessage = useMemo(() => {
    if (!isSubscriberFlow) return '';
    const endDateStr = String((detectedSubscriber as any)?.end_date || '').slice(0, 10);
    const paymentStatus = String((detectedSubscriber as any)?.payment_status || '').toLowerCase().trim();
    if (paymentStatus === 'unpaid') {
      return 'Sua assinatura está com pagamento pendente. Renove a assinatura ou agende como cliente normal.';
    }
    if (endDateStr && endDateStr < selectedDateKey) {
      return `Sua assinatura vence em ${toBRDateFromDateOnly(endDateStr)}. Para agendar em ${toBRDateFromDateOnly(selectedDateKey)}, renove a assinatura ou agende como cliente normal.`;
    }
    return '';
  }, [detectedSubscriber, isSubscriberFlow, selectedDateKey]);
  const filteredExistingAppointments = useMemo(() => {
    const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
    const selectedProfessionalIdNorm = norm(selectedProfessionalId);
    const selectedProfessionalNameNorm = norm((selectedProfessional as any)?.name);
    if (!selectedProfessionalIdNorm && !selectedProfessionalNameNorm) return [];

    return (Array.isArray(existingAppointments) ? existingAppointments : []).filter((appointment: any) => {
      const appointmentDateStr = appointment?.appointment_date == null
        ? ''
        : String(appointment.appointment_date).slice(0, 10);
      if (appointmentDateStr !== selectedDateKey) return false;

      const appointmentProfessionalNorm = norm(appointment?.professional);
      const appointmentProfessionalIdNorm = norm(appointment?.professional_id);
      const appointmentProfessionalNameNorm = norm(appointment?.professional_name);

      const matchesById =
        selectedProfessionalIdNorm.length > 0 &&
        (
          appointmentProfessionalNorm === selectedProfessionalIdNorm ||
          appointmentProfessionalIdNorm === selectedProfessionalIdNorm
        );

      const matchesByName =
        selectedProfessionalNameNorm.length > 0 &&
        (
          appointmentProfessionalNorm === selectedProfessionalNameNorm ||
          appointmentProfessionalNameNorm === selectedProfessionalNameNorm
        );

      return matchesById || matchesByName;
    });
  }, [existingAppointments, selectedDateKey, selectedProfessional?.name, selectedProfessionalId]);
  const scheduleIntervalMinutes = useMemo(
    () => getScheduleIntervalMinutes({
      use60MinuteSchedule: Boolean(establishment?.use_60_minute_schedule),
      use20MinuteSchedule: Boolean(establishment?.use_20_minute_schedule),
      use15MinuteInterval: Boolean(establishment?.use_15_minute_interval),
    }),
    [establishment?.use_15_minute_interval, establishment?.use_20_minute_schedule, establishment?.use_60_minute_schedule]
  );
  const professionalBlockedHours = useMemo(
    () => filterTimesAlignedToScheduleGrid((selectedProfessional as any)?.blocked_hours?.[selectedDateKey] || [], scheduleIntervalMinutes),
    [scheduleIntervalMinutes, selectedProfessional, selectedDateKey]
  );
  const professionalAbsences = useMemo(
    () => (((selectedProfessional as any)?.absences || []) as string[]),
    [selectedProfessional]
  );
  const professionalWorkHours = useMemo(
    () => ((selectedProfessional as any)?.work_hours || null),
    [selectedProfessional]
  );
  const selectedServiceDuration = Math.max(1, Number(effectiveSelectedService?.duration || 30));
  const minimumAdvanceMinutes = getMinimumAdvanceMinutes(establishment);

  const getAvailableSlotsCountForProfessional = (professional: any): number => {
    if (!professional) return 0;
    if (!businessHoursForDate?.enabled) return 0;

    const interval = scheduleIntervalMinutes;

    const selectedDateString = selectedDateKey;
    const dayOfWeek = getWeekdayKey(selectedDate);
    const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase();
    const professionalIdNorm = normalize(professional?.id);
    const professionalNameNorm = normalize(professional?.name);

    const hasMeaningfulProfessionalSchedule = (() => {
      const rawHours = (professional as any)?.work_hours;
      if (!rawHours || typeof rawHours !== 'object') return false;
      return Object.values(rawHours).some((rawDay: any) => {
        if (!rawDay || typeof rawDay !== 'object') return false;
        const hasWindow = Boolean(rawDay.entry_time || rawDay.exit_time);
        const hasBreak = Boolean(rawDay.break_start || rawDay.break_end);
        const isExplicitlyEnabled = rawDay.enabled === true;
        return hasWindow || hasBreak || isExplicitlyEnabled;
      });
    })();

    const currentWorkDay = (professional as any)?.work_hours?.[dayOfWeek];
    if (
      hasMeaningfulProfessionalSchedule &&
      currentWorkDay &&
      typeof currentWorkDay.enabled === 'boolean' &&
      currentWorkDay.enabled === false
    ) {
      return 0;
    }

    let effectiveHours = businessHoursForDate;
    if (currentWorkDay?.enabled && currentWorkDay?.entry_time && currentWorkDay?.exit_time) {
      effectiveHours = {
        enabled: true,
        open1: String(currentWorkDay.entry_time),
        close1: String(currentWorkDay.exit_time),
        open2: null,
        close2: null,
      };
    }

    if (!effectiveHours?.enabled || !effectiveHours?.open1 || !effectiveHours?.close1) return 0;

    const absences = Array.isArray((professional as any)?.absences) ? (professional as any).absences : [];
    if (absences.includes(selectedDateString)) return 0;

    const blockedHours = filterTimesAlignedToScheduleGrid(
      ((professional as any)?.blocked_hours?.[selectedDateString] || []) as string[],
      interval
    );
    const blockedSlotDuration = interval;

    const relevantAppointments = (Array.isArray(existingAppointments) ? existingAppointments : []).filter((appointment: any) => {
      const appointmentDateStr = appointment?.appointment_date == null ? '' : String(appointment.appointment_date).slice(0, 10);
      if (appointmentDateStr !== selectedDateString) return false;
      if (String(appointment?.status || '').toLowerCase() === 'cancelled') return false;

      const appointmentProfessionalNorm = normalize(appointment?.professional);
      const appointmentProfessionalIdNorm = normalize(appointment?.professional_id);
      const appointmentProfessionalNameNorm = normalize(appointment?.professional_name);

      const matchesById =
        professionalIdNorm.length > 0 &&
        (appointmentProfessionalNorm === professionalIdNorm || appointmentProfessionalIdNorm === professionalIdNorm);
      const matchesByName =
        professionalNameNorm.length > 0 &&
        (appointmentProfessionalNorm === professionalNameNorm || appointmentProfessionalNameNorm === professionalNameNorm);
      return matchesById || matchesByName;
    });

    const getAppointmentDurationMinutes = (appointment: any): number => {
      const baseDuration = getEffectiveAppointmentBaseDurationMinutes(
        appointment,
        interval,
        Array.isArray(subscriberServices) ? subscriberServices : []
      );
      const extraDuration = Array.isArray(appointment?.additional_products)
        ? appointment.additional_products.reduce(
            (sum: number, item: any) => sum + parseDurationMinutes(item?.duration, 0),
            0
          )
        : 0;
      return Math.max(1, baseDuration + extraDuration);
    };

    const isTimeInPast = (timeString: string): boolean => {
      const now = new Date();
      const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (selectedDay.getTime() < today.getTime()) return true;
      if (selectedDay.getTime() > today.getTime()) return false;
      const [hours, minutes] = String(timeString).split(':').map(Number);
      const slotDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hours || 0, minutes || 0, 0);
      if (minimumAdvanceMinutes > 0) {
        const minAllowedDate = new Date(now.getTime() + minimumAdvanceMinutes * 60 * 1000);
        return slotDate.getTime() < minAllowedDate.getTime();
      }
      return slotDate.getTime() <= now.getTime();
    };

    const buildPeriodMinutes = (start: number, end: number): number[] => {
      const period: number[] = [];
      for (let minute = start; minute < end; minute += interval) period.push(minute);
      return period;
    };

    const hasBreakWindow = Boolean(currentWorkDay?.enabled && currentWorkDay?.break_start && currentWorkDay?.break_end);
    const breakStart = hasBreakWindow ? timeToMinutes(String(currentWorkDay.break_start)) : 0;
    const breakEnd = hasBreakWindow ? timeToMinutes(String(currentWorkDay.break_end)) : 0;

    const periods: Array<{ start: string; end: string }> = [];
    if (effectiveHours.open1 && effectiveHours.close1) periods.push({ start: effectiveHours.open1, end: effectiveHours.close1 });
    if (effectiveHours.open2 && effectiveHours.close2) periods.push({ start: effectiveHours.open2, end: effectiveHours.close2 });

    let availableCount = 0;
    for (const period of periods) {
      const periodStart = timeToMinutes(period.start);
      const periodEnd = timeToMinutes(period.end);
      const periodMinutes = buildPeriodMinutes(periodStart, periodEnd);

      for (const startMinute of periodMinutes) {
        const endMinute = startMinute + selectedServiceDuration;
        if (endMinute >= 24 * 60) continue;
        if (endMinute > periodEnd) continue;

        const timeString = `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`;
        if (isTimeInPast(timeString)) continue;

        let hasConflict = false;

        for (const blockedTime of blockedHours) {
          const blockedStart = timeToMinutes(blockedTime);
          const blockedEnd = blockedStart + blockedSlotDuration;
          const overlapsBlocked = startMinute < blockedEnd && blockedStart < endMinute;
          if (overlapsBlocked) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) continue;

        if (hasBreakWindow) {
          const overlapsBreak = startMinute < breakEnd && breakStart < endMinute;
          if (overlapsBreak) continue;
        }

        for (const appointment of relevantAppointments) {
          const appointmentStart = timeToMinutes(String(appointment?.appointment_time || '00:00'));
          const appointmentEnd = appointmentStart + getAppointmentDurationMinutes(appointment);
          const overlapsAppointment = startMinute < appointmentEnd && appointmentStart < endMinute;
          if (overlapsAppointment) {
            hasConflict = true;
            break;
          }
        }
        if (hasConflict) continue;

        availableCount += 1;
      }
    }

    return availableCount;
  };

  const suggestedProfessionalsForDate = useMemo(() => {
    if (step !== 'datetime') return [] as Array<any>;
    if (!selectedProfessionalId) return [] as Array<any>;
    if (!computedSelection?.duration || computedSelection.duration <= 0) return [] as Array<any>;
    if (isSubscriberFlow && !isSelectedDateAllowedForSubscriber) return [] as Array<any>;

    return professionals
      .map((professional: any) => ({
        professional,
        availableCount: getAvailableSlotsCountForProfessional(professional),
      }))
      .filter(({ professional, availableCount }) => String(professional?.id || '') !== String(selectedProfessionalId) && availableCount > 0)
      .sort((a, b) => b.availableCount - a.availableCount)
      .slice(0, 6);
  }, [
    computedSelection?.duration,
    existingAppointments,
    isSelectedDateAllowedForSubscriber,
    isSubscriberFlow,
    professionals,
    selectedDate,
    selectedDateKey,
    selectedProfessionalId,
    step,
    businessHoursForDate,
    establishment?.use_15_minute_interval,
    establishment?.use_20_minute_schedule,
    establishment?.use_60_minute_schedule,
    subscriberServices,
  ]);

  useEffect(() => {
    setVisibleSlotsCountForSelectedProfessional(null);
  }, [selectedProfessionalId, selectedDateKey, computedSelection.duration, step]);

  const isPhoneValid = (raw: string) => onlyDigits(raw).length === 11;
  const shouldRequireCpf = Boolean(establishment?.require_cpf) && !isSubscriberFlow;
  const isCpfValidForRequiredBooking = !shouldRequireCpf || onlyDigits(chatClientCpf).length === 11;

  const canProceedFromStep = () => {
    if (step === 'name') return String(draftInput || '').trim().length >= 3;
    if (step === 'phone') return isPhoneValid(draftInput);
    if (step === 'service') {
      if (isSubscriberFlow) {
        if (isDividedSubscriberPlan) return selectedSubscriberServiceIds.length > 0;
        return Boolean(selectedSubscriberServiceId);
      }
      return selectedServiceIds.length > 0;
    }
    return true;
  };

  const resolveSubscriberAfterPhone = async (
    phoneRaw: string
  ): Promise<{ status: 'active' | 'expired' | 'none'; data: any }> => {
    const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
    if (!establishmentId) return { status: 'none', data: null };
    const isSubscriberRecordExpired = (record: any): boolean => {
      if (Boolean(record?.is_expired)) return true;
      const paymentStatus = String(record?.payment_status || '').toLowerCase().trim();
      if (paymentStatus === 'unpaid') return true;
      const endDateStr = String(record?.end_date || '').slice(0, 10);
      if (!endDateStr) return true;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(`${endDateStr}T00:00:00`);
      return Number.isNaN(endDate.getTime()) || endDate.getTime() < today.getTime();
    };
    try {
      const { data: firstData, error: firstError } = await checkNewSubscriber(phoneRaw, establishmentId);
      if (firstData && !firstError) {
        const isExpired = isSubscriberRecordExpired(firstData);
        if (!isExpired) return { status: 'active', data: firstData };
        return { status: 'expired', data: firstData };
      }
    } catch {
      // ignore and fallback
    }
    try {
      const { data: secondData, error: secondError } = await checkLegacySubscriber(phoneRaw, establishmentId);
      if (secondData && !secondError) {
        const isExpired = isSubscriberRecordExpired(secondData);
        if (!isExpired) return { status: 'active', data: secondData };
        return { status: 'expired', data: secondData };
      }
    } catch {
      // ignore
    }
    return { status: 'none', data: null };
  };

  const refreshSubscriberLimitStatus = async (phoneRaw: string) => {
    const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
    if (!establishmentId) return;
    try {
      setSubscriberLimitStatus((prev) => ({ ...prev, isLoading: true }));
      const limit = await checkMonthlyLimit(phoneRaw, establishmentId, selectedDate);
      const limitRaw = (limit as any)?.monthlyLimit;
      const usageRaw = Number((limit as any)?.currentUsage || 0);
      const numericLimit = Number(limitRaw);
      const hasNumericLimit = Number.isFinite(numericLimit) && numericLimit > 0;
      const isUnlimited = !hasNumericLimit;
      const remaining = isUnlimited ? null : Math.max(0, numericLimit - usageRaw);

      setSubscriberLimitStatus({
        isLoading: false,
        canBook: Boolean((limit as any)?.canBook ?? true),
        currentUsage: usageRaw,
        monthlyLimit: isUnlimited ? 'Ilimitado' : numericLimit,
        remaining,
      });
    } catch {
      setSubscriberLimitStatus((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const validatePendingClientBlocking = async (phoneRaw: string) => {
    const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
    const normalizedPhone = String(phoneRaw || '').trim();

    if (!establishmentId || !normalizedPhone) {
      return { blocked: false, message: null as string | null };
    }

    const validation = await validatePendingClientBookingLimit(
      normalizedPhone,
      establishmentId,
      Boolean(establishment?.limit_client_pending_booking)
    );

    return {
      blocked: !validation.canBook,
      message:
        validation.message ||
        'Voce ainda tem servico pendente nesta barbearia. Aguarde o profissional concluir o atendimento para fazer um novo agendamento.',
    };
  };

  const validateSameDayRescheduleBlocking = async (phoneRaw: string, dateForCheck: Date) => {
    if (!isSubscriberFlow) {
      return { blocked: false, message: null as string | null };
    }

    const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
    const normalizedPhone = String(phoneRaw || '').trim();
    if (!establishmentId || !normalizedPhone) {
      return { blocked: false, message: null as string | null };
    }

    const result = await validateSameDayReschedule(
      normalizedPhone,
      establishmentId,
      format(dateForCheck, 'yyyy-MM-dd'),
      true
    );

    return {
      blocked: !result.canBook,
      message: result.canBook
        ? null
        : result.message ||
          'Você cancelou um agendamento para este dia e não pode remarcar para a mesma data. Escolha outro dia.',
    };
  };

  useEffect(() => {
    if (step !== 'datetime' && step !== 'confirm') {
      setSameDayRescheduleMessage(null);
      return;
    }
    if (!isSubscriberFlow || !String(chatClientPhone || '').trim()) {
      setSameDayRescheduleMessage(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const validation = await validateSameDayRescheduleBlocking(chatClientPhone, selectedDate);
      if (cancelled) return;
      setSameDayRescheduleMessage(validation.blocked ? validation.message : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [step, isSubscriberFlow, chatClientPhone, selectedDateKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const phoneRaw = String(chatClientPhone || '').trim();
      const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
      const hasSubscriber = Boolean(detectedSubscriber);
      if (!hasSubscriber || !phoneRaw || !establishmentId || subscriberServiceOptions.length === 0) {
        setSubscriberServiceLimitMap({});
        setIsLoadingSubscriberServiceLimits(false);
        return;
      }

      setIsLoadingSubscriberServiceLimits(true);
      try {
        const entries = await Promise.all(
          subscriberServiceOptions.map(async (service: any) => {
            const serviceIdKey = String(service?.id || '').trim();
            if (!serviceIdKey) return null;
            const serviceName = String(service?.booking_service_name || service?.name || '').trim();
            const perServiceLimit = Number((service as any)?.service_limit || 0) || null;
            const limitCheck = await checkMonthlyLimit(
              phoneRaw,
              establishmentId,
              selectedDate,
              {
                id: String((service as any)?.service_id || '').trim() || null,
                name: serviceName || null,
                limit: perServiceLimit,
              }
            );

            const monthlyLimit = Number.isFinite(Number(limitCheck.monthlyLimit))
              ? Number(limitCheck.monthlyLimit)
              : null;
            const currentUsage = Number(limitCheck.currentUsage || 0);
            return [
              serviceIdKey,
              {
                canBook: Boolean(limitCheck.canBook),
                currentUsage,
                monthlyLimit,
                remaining: monthlyLimit && monthlyLimit > 0 ? Math.max(0, monthlyLimit - currentUsage) : null,
                errorMessage: limitCheck.errorMessage,
              },
            ] as const;
          })
        );

        if (cancelled) return;
        const nextMap: Record<string, {
          canBook: boolean;
          currentUsage: number;
          monthlyLimit: number | null;
          remaining: number | null;
          errorMessage?: string;
        }> = {};
        entries.forEach((entry) => {
          if (!entry) return;
          nextMap[entry[0]] = entry[1];
        });
        setSubscriberServiceLimitMap(nextMap);
      } catch {
        if (!cancelled) setSubscriberServiceLimitMap({});
      } finally {
        if (!cancelled) setIsLoadingSubscriberServiceLimits(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [chatClientPhone, detectedSubscriber, establishment?.establishment_id, establishment?.id, selectedDate, subscriberServiceOptions]);

  const goNext = async () => {
    if (!canProceedFromStep()) {
      if (step === 'service') {
        if (isSubscriberFlow) {
          toast.error('Selecione sua assinatura antes de prosseguir.');
          setShowSubscriberSelectionHint(true);
          if (serviceIntroRef.current) {
            serviceIntroRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          toast.error('Selecione pelo menos um serviço antes de prosseguir.');
        }
      }
      return;
    }
    if (step === 'name') {
      setChatClientName(String(draftInput || '').trim());
      setDraftInput(formatPhoneChat(chatClientPhone || ''));
      setStep('phone');
      return;
    }
    if (step === 'phone') {
      const nextPhone = formatPhoneChat(String(draftInput || '').trim());
      setChatClientPhone(nextPhone);
      setPendingClientBookingMessage(null);
      const nextName = String(chatClientName || '').trim();
      if (nextName && nextPhone && onGuestClientDataCollected) {
        onGuestClientDataCollected(nextName, nextPhone);
      }

      setIsCheckingPendingClientBooking(true);
      try {
        const pendingValidation = await validatePendingClientBlocking(nextPhone);
        if (pendingValidation.blocked) {
          setPendingClientBookingMessage(pendingValidation.message);
          toast.error(pendingValidation.message || 'Cliente com atendimento pendente nesta barbearia.');
          setDraftInput(nextPhone);
          setStep('phone');
          return;
        }
      } catch (error) {
        console.error('Erro ao validar pendencia no chat:', error);
      } finally {
        setIsCheckingPendingClientBooking(false);
      }

      const hasMercadoPagoConnected = Boolean(String((establishment as any)?.mercadopago_access_token || '').trim());
      if (hasMercadoPagoConnected && !afcoinPhoneAwarded) {
        toast.success('🎉 Parabéns! Você ganhou +5 AFCoins');
        setAfcoinPhoneAwarded(true);
        void registerAfcoinBookingEvent({
          establishmentId: String(establishment?.id || establishment?.establishment_id || ''),
          clientPhone: nextPhone,
          clientName: chatClientName || guestClientData?.name || 'Cliente',
          rule: 'name_phone_5',
        });
      }

      setIsCheckingSubscriber(true);
      const resolved = await resolveSubscriberAfterPhone(nextPhone);
      setIsCheckingSubscriber(false);
      if (resolved.status === 'active' && resolved.data) {
        setDetectedSubscriber(resolved.data);
        setExpiredSubscriberRecord(null);
        setExpiredSubscriberAction(null);
        await refreshSubscriberLimitStatus(nextPhone);
        setStep('subscriberChoice');
      } else if (resolved.status === 'expired' && resolved.data) {
        setDetectedSubscriber(null);
        setIsSubscriberFlow(false);
        setExpiredSubscriberRecord(resolved.data);
        setExpiredSubscriberAction(null);
        setSubscriberLimitStatus({
          isLoading: false,
          canBook: true,
          currentUsage: 0,
          monthlyLimit: 'Ilimitado',
          remaining: null,
        });
        setStep('expiredSubscriberChoice');
      } else {
        setDetectedSubscriber(null);
        setExpiredSubscriberRecord(null);
        setExpiredSubscriberAction(null);
        setIsSubscriberFlow(false);
        setSubscriberLimitStatus({
          isLoading: false,
          canBook: true,
          currentUsage: 0,
          monthlyLimit: 'Ilimitado',
          remaining: null,
        });
        setStep('professional');
      }
      setDraftInput('');
      return;
    }
    if (step === 'service') {
      setSelectedTime('');
      setStep('datetime');
      return;
    }
  };

  const goBack = () => {
    const sequence: ChatStep[] = [
      'name',
      'phone',
      ...(expiredSubscriberRecord ? (['expiredSubscriberChoice'] as ChatStep[]) : []),
      ...(detectedSubscriber ? (['subscriberChoice'] as ChatStep[]) : []),
      'professional',
      'service',
      'datetime',
      ...(hasBookingHighlightedProducts ? (['products'] as ChatStep[]) : []),
      'confirm'
    ];
    const currentIndex = sequence.indexOf(step);
    if (currentIndex <= 0) {
      if (onCloseChat) onCloseChat();
      return;
    }
    const prevStep = sequence[currentIndex - 1];
    if (prevStep === 'name') setDraftInput(chatClientName || '');
    if (prevStep === 'phone') setDraftInput(chatClientPhone || '');
    if (step === 'expiredSubscriberChoice' && prevStep === 'phone') {
      setExpiredSubscriberRecord(null);
      setExpiredSubscriberAction(null);
    }
    if (step === 'professional' && prevStep === 'expiredSubscriberChoice') {
      setExpiredSubscriberAction(null);
    }
    setStep(prevStep);
  };

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((previous) => (previous.includes(serviceId) ? previous.filter((id) => id !== serviceId) : [...previous, serviceId]));
  };

  const toggleSubscriberExtra = (serviceId: string) => {
    setSelectedSubscriberExtraIds((previous) => {
      if (previous.includes(serviceId)) return previous.filter((id) => id !== serviceId);
      if (previous.length >= 4) {
        toast.error('Você pode selecionar no máximo 4 serviços extras.');
        return previous;
      }
      return [...previous, serviceId];
    });
  };
  const toggleSubscriberService = (serviceId: string) => {
    setSelectedSubscriberServiceIds((previous) => (
      previous.includes(serviceId)
        ? previous.filter((id) => id !== serviceId)
        : [...previous, serviceId]
    ));
  };

  const handleConfirmBooking = async () => {
    if (!chatClientName || !chatClientPhone || !selectedProfessionalId || !selectedTime) return;
    if (!computedSelection.serviceName || computedSelection.duration <= 0) return;
    if (shouldAskPaymentMethod && !selectedPaymentMethod) {
      toast.error('Selecione a forma de pagamento para continuar.');
      return;
    }
    if (pendingClientBookingMessage) {
      toast.error(pendingClientBookingMessage);
      return;
    }
    if (sameDayRescheduleMessage) {
      toast.error(sameDayRescheduleMessage);
      return;
    }
    if (isSubscriberFlow) {
      const sameDayValidation = await validateSameDayRescheduleBlocking(chatClientPhone, selectedDate);
      if (sameDayValidation.blocked) {
        setSameDayRescheduleMessage(sameDayValidation.message);
        toast.error(sameDayValidation.message || 'Remarcação no mesmo dia não permitida.');
        return;
      }
      setSameDayRescheduleMessage(null);
    }
    if (isSubscriberFlow && !isSelectedDateAllowedForSubscriber) {
      const allowedDays = subscriberAllowedWeekdays.map((day) => weekdayPtMap[day] || day).join(', ');
      toast.error(`Esse plano permite agendamento somente em: ${allowedDays}.`);
      return;
    }
    if (isSubscriberFlow && subscriberDateLimitMessage) {
      toast.error(subscriberDateLimitMessage);
      return;
    }
    if (isSubscriberFlow) {
      const blockedSelected = (isDividedSubscriberPlan ? selectedSubscriberServices : [selectedPrimarySubscriberService])
        .filter(Boolean)
        .find((service: any) => subscriberServiceLimitMap[String(service?.id || '')]?.canBook === false);
      if (blockedSelected) {
        const blockedName = String((blockedSelected as any)?.booking_service_name || (blockedSelected as any)?.name || 'serviço').trim();
        toast.error(`O serviço "${blockedName}" atingiu o limite desta assinatura. Escolha outro serviço.`);
        return;
      }
    }
    if (isSubscriberFlow && subscriberLimitStatus.canBook === false) {
      const limitLabel = subscriberLimitStatus.monthlyLimit;
      toast.error(`Limite mensal atingido: ${subscriberLimitStatus.currentUsage}/${limitLabel}.`);
      return;
    }
    if (shouldRequireCpf && !isCpfValidForRequiredBooking) {
      toast.error('Este estabelecimento exige CPF. Informe um CPF válido com 11 dígitos para confirmar.');
      return;
    }
    let latestLoyaltyRow = publicLoyaltyRow;
    if (!isSubscriberFlow) {
      const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
      try {
        latestLoyaltyRow = await fetchPublicLoyaltyProgress(establishmentId, chatClientPhone);
      } catch (error) {
        console.warn('Fidelidade: falha ao revalidar no confirmar agendamento:', error);
      }
      setPublicLoyaltyRow(latestLoyaltyRow);
    }

    const loyaltyFree =
      !isSubscriberFlow &&
      publicLoyaltyRedeemApplied &&
      latestLoyaltyRow != null &&
      latestLoyaltyRow.cycle_goal >= 2 &&
      latestLoyaltyRow.cycle_progress >= latestLoyaltyRow.cycle_goal;
    if (publicLoyaltyRedeemApplied && !loyaltyFree) {
      toast.error('Não foi possível aplicar o benefício de fidelidade. Atualize a página e tente novamente.');
      return;
    }
    setIsSubmitting(true);
    try {
      const bookingProductsPayload =
        loyaltyFree
          ? []
          : selectedBookingProducts.map((product: any) => ({
            product_id: String(product?.id || '').trim(),
            name: String(product?.name || '').trim() || 'Produto',
            price: Number(product?.sale_price || 0),
            duration: 0,
            quantity: 1,
            item_type: 'booking_product',
          })).filter((item: any) => item.product_id && Number.isFinite(item.price) && item.price > 0);

      const subscriberExtraPayload = isSubscriberFlow
        ? selectedSubscriberExtraServices
          .map((service: any) => ({
            product_id: `subscriber_extra_${String(service?.id || '').trim() || String(service?.name || '').trim()}`,
            name: `Extra assinatura: ${String(service?.name || '').trim() || 'Servico extra'}`,
            price: 0,
            duration: Number(service?.duration || 0),
            quantity: 1,
            item_type: 'subscriber_extra',
          }))
          .filter((item: any) => {
            const hasId = String(item.product_id || '').trim().length > 0;
            const hasDuration = Number.isFinite(Number(item.duration)) && Number(item.duration) > 0;
            return hasId && hasDuration;
          })
        : [];

      const combinedAdditionalProducts = [...bookingProductsPayload, ...subscriberExtraPayload];
      const payload = {
        client_name: chatClientName,
        client_whatsapp: normalizeWhatsappForStorage(chatClientPhone),
        service: computedSelection.serviceName,
        professional: selectedProfessionalId,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: selectedTime,
        client_cpf: shouldRequireCpf ? onlyDigits(chatClientCpf) : null,
        duration: computedSelection.duration,
        price: loyaltyFree ? 0 : computedSelection.price,
        total_price: loyaltyFree ? 0 : Number(computedSelection.price || 0) + Number(bookingProductsTotal || 0),
        additional_products:
          loyaltyFree
            ? null
            : combinedAdditionalProducts.length > 0
              ? combinedAdditionalProducts
              : null,
        payment_method: isSubscriberFlow
          ? 'assinante'
          : (
            requireAdvancePayment
              ? 'pendente'
              : (shouldAskPaymentMethod ? selectedPaymentMethod : 'pagar_local')
          ),
        is_child_service: false,
        is_subscriber: isSubscriberFlow,
        is_loyalty_reward: loyaltyFree,
        loyalty_points_awarded: isSubscriberFlow
          ? undefined
          : loyaltyFree
            ? 0
            : Math.max(0, Number((computedSelection as any).loyaltyPointsAwarded ?? 0)),
        subscription_id: isSubscriberFlow
          ? String((selectedPrimarySubscriberService as any)?.subscription_id || (selectedPrimarySubscriberService as any)?.id || (detectedSubscriber as any)?.subscription_id || '').trim() || null
          : null,
        subscriber_service_id: isSubscriberFlow && selectedSubscriberServices.length === 1
          ? String((selectedSubscriberServices[0] as any)?.service_id || '').trim() || null
          : (isSubscriberFlow && !isDividedSubscriberPlan ? String((selectedPrimarySubscriberService as any)?.service_id || '').trim() || null : null),
        subscriber_service_name: isSubscriberFlow
          ? (
            isDividedSubscriberPlan
              ? selectedSubscriberServices.map((service: any) => String(service?.name || '').trim()).filter(Boolean).join(' + ')
              : String((selectedPrimarySubscriberService as any)?.name || '').trim()
          ) || null
          : null,
        subscriber_service_limit: isSubscriberFlow && selectedSubscriberServices.length === 1
          ? Number((selectedSubscriberServices[0] as any)?.service_limit || 0) || null
          : (isSubscriberFlow && !isDividedSubscriberPlan ? Number((selectedPrimarySubscriberService as any)?.service_limit || 0) || null : null),
      };
      await onSubmit(payload);
    } finally {
      setIsSubmitting(false);
    }
  };

  const barberPhoto = String(establishment?.profile_image_url || establishment?.logo_url || establishment?.photo_url || '').trim();

  const chatMessages = useMemo(() => {
    const messages: Array<{ id: string; role: 'bot' | 'user'; text: string }> = [];
    const bizName = establishment?.name || 'Barbearia';
    messages.push({
      id: 'bot-welcome-name',
      role: 'bot',
      text: `Seja bem-vindo à ${bizName}, vamos fazer seu agendamento.\nPrimeiro, qual é o seu nome e sobrenome, por gentileza?`
    });
    if (chatClientName) {
      messages.push({ id: 'user-name', role: 'user', text: chatClientName });
      messages.push({ id: 'bot-phone', role: 'bot', text: 'Perfeito! Agora me informe seu número de telefone para realizarmos o agendamento.' });
    }
    if (chatClientPhone) {
      messages.push({ id: 'user-phone', role: 'user', text: chatClientPhone });
    }
    if (expiredSubscriberRecord) {
      messages.push({
        id: 'bot-expired-subscriber',
        role: 'bot',
        text: 'Sua assinatura nesse estabelecimento está vencida.'
      });
      if (step !== 'expiredSubscriberChoice') {
        if (expiredSubscriberAction === 'renew') {
          messages.push({ id: 'user-expired-renew', role: 'user', text: 'Renovar assinatura' });
        } else if (expiredSubscriberAction === 'skip') {
          messages.push({ id: 'user-expired-skip', role: 'user', text: 'Agendar sem assinatura' });
        }
      }
    }
    if (detectedSubscriber) {
      messages.push({
        id: 'bot-subscriber-choice',
        role: 'bot',
        text: 'Opa! Você é cliente assinante. Deseja usar sua assinatura ou agendar sem ela?'
      });
      if (subscriberLimitStatus.isLoading) {
        messages.push({
          id: 'bot-subscriber-limit-loading',
          role: 'bot',
          text: 'Consultando limite mensal da assinatura...'
        });
      } else {
        const limitLabel = String(subscriberLimitStatus.monthlyLimit);
        const remainingText = subscriberLimitStatus.remaining === null
          ? 'Sem limite mensal de atendimentos.'
          : `Restam ${subscriberLimitStatus.remaining} agendamento(s) neste mês.`;

        messages.push({
          id: 'bot-subscriber-limit',
          role: 'bot',
          text: subscriberLimitStatus.canBook
            ? `Assinatura: ${subscriberLimitStatus.currentUsage}/${limitLabel} utilizados. ${remainingText}`
            : `Limite mensal atingido: ${subscriberLimitStatus.currentUsage}/${limitLabel}. Você pode agendar sem assinatura ou aguardar o próximo mês.`
        });
      }
      if (step !== 'subscriberChoice') {
        messages.push({
          id: 'user-subscriber-choice',
          role: 'user',
          text: isSubscriberFlow ? 'Usar assinatura' : 'Agendar sem assinatura'
        });
      }
    }
    const shouldShowProfessionalPrompt =
      Boolean(chatClientPhone) &&
      (!detectedSubscriber || step !== 'subscriberChoice') &&
      !(expiredSubscriberRecord && step === 'expiredSubscriberChoice');

    if (shouldShowProfessionalPrompt) {
      messages.push({
        id: 'bot-professional',
        role: 'bot',
        text: isSubscriberFlow
          ? 'Pronto, assinatura ativada. Qual profissional você deseja agendar?'
          : 'Maravilha! Agora me diga qual profissional você deseja para o seu agendamento.'
      });
    }

    if (selectedProfessional?.name) {
      messages.push({ id: 'user-professional', role: 'user', text: selectedProfessional.name });
      messages.push({
        id: 'bot-service',
        role: 'bot',
        text: isSubscriberFlow
          ? 'Perfeito! Escolha os serviços da assinatura e os extras (se houver).'
          : 'Perfeito! Agora me diga quais desses serviços você deseja fazer. Você pode selecionar um ou mais.'
      });
    }
    if (computedSelection.serviceName && step !== 'service') {
      messages.push({ id: 'user-service', role: 'user', text: computedSelection.serviceName });
      messages.push({ id: 'bot-datetime', role: 'bot', text: 'Qual data você deseja para o agendamento? Abaixo já estão os horários disponíveis.' });
    }
    if (invalidSubscriberDateMessage || subscriberDateLimitMessage) {
      messages.push({ id: 'bot-invalid-subscriber-date', role: 'bot', text: invalidSubscriberDateMessage || subscriberDateLimitMessage });
    }
    if (selectedTime) {
      messages.push({ id: 'user-date-time', role: 'user', text: `${format(selectedDate, 'dd/MM/yyyy')} • ${selectedTime}` });
      if (hasBookingHighlightedProducts) {
        messages.push({ id: 'bot-products', role: 'bot', text: 'Quer aproveitar e garantir também?' });
        if (selectedBookingProducts.length > 0) {
          const productsSummary = selectedBookingProducts
            .map((product: any) => String(product?.name || 'Produto').trim())
            .filter(Boolean)
            .join(' + ');
          messages.push({ id: 'user-products', role: 'user', text: productsSummary });
        }
      }
      if (step === 'confirm') {
        messages.push({ id: 'bot-confirm', role: 'bot', text: 'Perfeito! Revise os dados e confirme seu agendamento.' });
      }
    }
    return messages;
  }, [chatClientName, chatClientPhone, computedSelection.serviceName, detectedSubscriber, establishment?.name, expiredSubscriberAction, expiredSubscriberRecord, hasBookingHighlightedProducts, invalidSubscriberDateMessage, isSubscriberFlow, selectedBookingProducts, selectedDate, selectedProfessional?.name, selectedTime, step, subscriberDateLimitMessage, subscriberLimitStatus]);

  useEffect(() => {
    if (step !== 'confirm') return;
    let cancelled = false;

    const run = async () => {
      const phoneRaw = String(chatClientPhone || '').trim();
      if (!phoneRaw) {
        if (!cancelled) setPendingClientBookingMessage(null);
        return;
      }

      setIsCheckingPendingClientBooking(true);
      try {
        const pendingValidation = await validatePendingClientBlocking(phoneRaw);
        if (cancelled) return;
        if (pendingValidation.blocked) {
          setPendingClientBookingMessage(pendingValidation.message);
        } else {
          setPendingClientBookingMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Erro ao validar pendencia na confirmacao do chat:', error);
        }
      } finally {
        if (!cancelled) setIsCheckingPendingClientBooking(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [step, chatClientPhone, establishment?.id, establishment?.establishment_id, establishment?.limit_client_pending_booking]);

  useEffect(() => {
    if (step !== 'confirm' || isSubscriberFlow) {
      setPublicLoyaltyRow(null);
      setPublicLoyaltyLoading(false);
      return;
    }
    const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
    const phoneDigits = onlyDigits(chatClientPhone);
    if (!establishmentId || phoneDigits.length < 8) {
      setPublicLoyaltyRow(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setPublicLoyaltyRow(null); // evita manter valor antigo na tela durante nova checagem
      setPublicLoyaltyLoading(true);
      try {
        const row = await fetchPublicLoyaltyProgress(establishmentId, phoneDigits);
        if (cancelled) return;
        setPublicLoyaltyRow(row);
      } finally {
        if (!cancelled) setPublicLoyaltyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, isSubscriberFlow, establishment?.id, establishment?.establishment_id, chatClientPhone]);

  useEffect(() => {
    if (!publicLoyaltyRow || publicLoyaltyRow.cycle_progress < publicLoyaltyRow.cycle_goal) {
      setPublicLoyaltyRedeemApplied(false);
    }
  }, [publicLoyaltyRow]);

  const loyaltyFreeBooking = useMemo(
    () =>
      !isSubscriberFlow &&
      publicLoyaltyRedeemApplied &&
      publicLoyaltyRow != null &&
      publicLoyaltyRow.cycle_goal >= 2 &&
      publicLoyaltyRow.cycle_progress >= publicLoyaltyRow.cycle_goal,
    [isSubscriberFlow, publicLoyaltyRedeemApplied, publicLoyaltyRow]
  );

  const confirmDisplayServicePrice = useMemo(
    () => (loyaltyFreeBooking ? 0 : Number(computedSelection.price || 0)),
    [loyaltyFreeBooking, computedSelection.price]
  );

  const confirmDisplayTotalPrice = useMemo(
    () =>
      loyaltyFreeBooking ? 0 : Number(computedSelection.price || 0) + Number(bookingProductsTotal || 0),
    [loyaltyFreeBooking, computedSelection.price, bookingProductsTotal]
  );

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const serviceIntroRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (step === 'service' && serviceIntroRef.current) {
      serviceIntroRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if ((step === 'phone' || step === 'professional' || step === 'subscriberChoice' || step === 'expiredSubscriberChoice') && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, step]);

  useEffect(() => {
    if (step !== 'service' || !isSubscriberFlow) {
      setShowSubscriberSelectionHint(false);
      return;
    }
    const hasSelection = isDividedSubscriberPlan
      ? selectedSubscriberServiceIds.length > 0
      : Boolean(String(selectedSubscriberServiceId || '').trim());
    if (hasSelection) {
      setShowSubscriberSelectionHint(false);
    }
  }, [step, isSubscriberFlow, isDividedSubscriberPlan, selectedSubscriberServiceId, selectedSubscriberServiceIds]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl border border-white/10 bg-[#111111] shadow-[0_25px_80px_rgba(0,0,0,0.65)] text-white">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3 min-w-0">
            {barberPhoto ? (
              <img src={barberPhoto} alt="Barbearia" className="w-10 h-10 rounded-full object-cover border border-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#E6C78B] text-black font-black flex items-center justify-center">
                {String(establishment?.name || 'B').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold truncate">Chat de Agendamento</h2>
              <p className="text-xs text-white/70 truncate">{establishment?.name || 'Barbearia'}</p>
            </div>
          </div>
          <div />
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(92vh-78px)] space-y-4" ref={chatScrollRef}>
          {chatMessages.map((message) => (
            <div
              key={message.id}
              ref={message.id === 'bot-service' ? serviceIntroRef : null}
              className={`flex ${message.role === 'bot' ? 'items-start gap-2' : 'justify-end'}`}
            >
              {message.role === 'bot' && (
                barberPhoto ? (
                  <img src={barberPhoto} alt="Barbearia" className="w-8 h-8 rounded-full object-cover border border-white/20 mt-1" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#E6C78B] text-black font-black flex items-center justify-center mt-1">
                    {String(establishment?.name || 'B').trim().charAt(0).toUpperCase()}
                  </div>
                )
              )}
              <div
                className={`max-w-[88%] px-4 py-2.5 text-sm whitespace-pre-line ${message.role === 'bot'
                  ? 'rounded-2xl rounded-tl-md bg-white/10 border border-white/15 text-[#E6C78B]'
                  : 'rounded-2xl rounded-tr-md bg-[#2b6ee7] text-white'
                  }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          <div className="rounded-xl bg-black/25 border border-white/10 p-4">
            {(step === 'name' || step === 'phone') && (
              <div className="space-y-2">
                <input
                  type={step === 'phone' ? 'tel' : 'text'}
                  value={draftInput}
                  onChange={(e) => {
                    if (step === 'phone') {
                      setPendingClientBookingMessage(null);
                      setDraftInput(formatPhoneChat(e.target.value));
                      return;
                    }
                    setDraftInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void goNext();
                    }
                  }}
                  placeholder={
                    step === 'phone'
                      ? 'Qual seu número de telefone? Ex: 99 9 99999999'
                      : 'Qual seu nome e sobrenome?'
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#151515] border border-white/20"
                />
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={!canProceedFromStep() || isCheckingSubscriber || isCheckingPendingClientBooking}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-semibold ${canProceedFromStep() && !isCheckingSubscriber && !isCheckingPendingClientBooking ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-white/10 text-white/60 cursor-not-allowed'}`}
                >
                  {isCheckingPendingClientBooking
                    ? 'Validando pendencias...'
                    : isCheckingSubscriber
                      ? 'Verificando assinante...'
                      : 'Enviar'}
                </button>
                {step === 'phone' && pendingClientBookingMessage && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {pendingClientBookingMessage}
                  </div>
                )}
              </div>
            )}

            {step === 'subscriberChoice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubscriberFlow(true);
                    setSelectedSubscriberServiceId('');
                    setSelectedSubscriberServiceIds([]);
                    setSelectedSubscriberExtraIds([]);
                    setStep('professional');
                  }}
                  className="px-3 py-2 rounded-lg border bg-emerald-600 border-emerald-500"
                >
                  Usar assinatura
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSubscriberFlow(false);
                    setSelectedSubscriberServiceId('');
                    setSelectedSubscriberServiceIds([]);
                    setSelectedSubscriberExtraIds([]);
                    setStep('professional');
                  }}
                  className="px-3 py-2 rounded-lg border bg-white/10 border-white/20"
                >
                  Agendar sem assinatura
                </button>
              </div>
            )}

            {step === 'expiredSubscriberChoice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setExpiredSubscriberAction('renew');
                    const payload = {
                      subscription_id: expiredSubscriberRecord?.subscription_id,
                      display_name: String(
                        expiredSubscriberRecord?.display_name || expiredSubscriberRecord?.subscriber_name || chatClientName || ''
                      ).trim(),
                      subscriber_name: String(expiredSubscriberRecord?.subscriber_name || '').trim(),
                      whatsapp: String(
                        expiredSubscriberRecord?.whatsapp ||
                        expiredSubscriberRecord?.subscriber_whatsapp ||
                        expiredSubscriberRecord?.client_whatsapp ||
                        onlyDigits(chatClientPhone) ||
                        ''
                      ).trim(),
                    };
                    if (onOpenRenewSubscription) {
                      onOpenRenewSubscription(payload);
                    } else {
                      toast.error('Renovação indisponível no momento. Entre em contato com o estabelecimento.');
                    }
                  }}
                  className="px-3 py-2 rounded-lg border border-amber-400/80 bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                >
                  Renovar assinatura
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpiredSubscriberAction('skip');
                    setIsSubscriberFlow(false);
                    setSelectedSubscriberServiceId('');
                    setSelectedSubscriberServiceIds([]);
                    setSelectedSubscriberExtraIds([]);
                    setStep('professional');
                  }}
                  className="px-3 py-2 rounded-lg border bg-white/10 border-white/20"
                >
                  Agendar sem assinatura
                </button>
              </div>
            )}

            {step === 'professional' && (
              <div className="space-y-2">
                {professionals.map((professional: any) => (
                  <button
                    key={professional.id}
                    type="button"
                    onClick={() => {
                      setSelectedProfessionalId(String(professional.id));
                      setStep('service');
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border ${String(selectedProfessionalId) === String(professional.id) ? 'bg-emerald-600 border-emerald-500' : 'bg-white/10 border-white/20'}`}
                  >
                    <div className="flex items-center gap-3">
                      {String(professional?.photo_url || '').trim() ? (
                        <img src={String(professional.photo_url)} alt={String(professional?.name || 'Profissional')} className="w-8 h-8 rounded-full object-cover border border-white/20" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold">
                          {String(professional?.name || 'P').trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{professional.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 'service' && !isSubscriberFlow && (
              <div className="space-y-3">
                {allServices.map((service: any) => {
                  const serviceId = String(service?.id || '');
                  const selected = selectedServiceIds.includes(serviceId);
                  const serviceDuration = Number(service?.duration || 0);
                  const serviceImageUrl = String(service?.image_url || '').trim() || DEFAULT_SERVICE_IMAGE_URL;
                  return (
                    <div key={serviceId} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleService(serviceId)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selected ? 'bg-emerald-600 border-emerald-500' : 'bg-white/10 border-white/20 hover:bg-white/15'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={serviceImageUrl}
                              alt={`Foto de ${service.name}`}
                              className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover border border-white/25 shrink-0 bg-black/20"
                              loading="lazy"
                              decoding="async"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">{service.name}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/80">
                                <span className="font-bold">{toMoney(Number(service?.price || 0))}</span>
                                <span>•</span>
                                <span>{formatDuration(serviceDuration > 0 ? serviceDuration : 30)}</span>
                              </div>
                              {Math.max(0, Math.floor(Number(service?.loyalty_points ?? 0))) > 0 ? (
                                <div className="text-[11px] text-[#E6C78B] mt-0.5 font-semibold">
                                  +{Math.max(0, Math.floor(Number(service?.loyalty_points ?? 0)))} pt(s) fidelidade ao concluir
                                </div>
                              ) : null}
                            </div>
                          </div>
                          {selected && (
                            <span className="text-[10px] font-black px-2 py-1 rounded-full bg-black/30 text-white shrink-0">
                              SELECIONADO
                            </span>
                          )}
                        </div>
                      </button>
                      {selected && (
                        <button
                          type="button"
                          onClick={() => void goNext()}
                          className="w-full rounded-xl bg-[#E6C78B] px-4 py-2.5 text-sm font-black text-black shadow-lg shadow-black/20 hover:bg-[#f0d69c] transition-colors"
                        >
                          Agendar com {selectedServiceIds.length} serviço{selectedServiceIds.length > 1 ? 's' : ''} selecionado{selectedServiceIds.length > 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {step === 'service' && isSubscriberFlow && (
              <div className="space-y-3">
                {showSubscriberSelectionHint && (
                  <button
                    type="button"
                    onClick={() => {
                      if (serviceIntroRef.current) {
                        serviceIntroRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-400/70 bg-amber-500/15 px-3 py-2 text-xs sm:text-sm font-extrabold text-amber-200 animate-bounce"
                  >
                    👉 Clique aqui para selecionar sua assinatura
                  </button>
                )}
                <div className="space-y-2">
                  {isDividedSubscriberPlan && (
                    <div className="text-xs text-white/70">
                      Você pode selecionar um ou mais serviços da assinatura.
                    </div>
                  )}
                  {subscriberServiceOptions.map((service: any) => {
                    const serviceId = String(service?.id || '');
                    const serviceLimitData = subscriberServiceLimitMap[serviceId];
                    const blockedByLimit = serviceLimitData?.canBook === false;
                    const selected = isDividedSubscriberPlan
                      ? selectedSubscriberServiceIds.includes(serviceId)
                      : String(selectedSubscriberServiceId) === serviceId;
                    return (
                      <button
                        key={`subscriber-service-${service.id}`}
                        type="button"
                        onClick={() => {
                          if (blockedByLimit) {
                            const defaultLimitText = serviceLimitData?.monthlyLimit
                              ? `${serviceLimitData.currentUsage}/${serviceLimitData.monthlyLimit}`
                              : 'limite atingido';
                            toast.error(serviceLimitData?.errorMessage || `Esse serviço já atingiu o limite (${defaultLimitText}).`);
                            return;
                          }
                          if (isDividedSubscriberPlan) {
                            toggleSubscriberService(serviceId);
                            setShowSubscriberSelectionHint(false);
                            return;
                          }
                          setSelectedSubscriberServiceId(serviceId);
                          setShowSubscriberSelectionHint(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg border ${blockedByLimit
                            ? 'bg-red-500/10 border-red-500/40 opacity-80'
                            : (selected
                              ? 'bg-emerald-600 border-emerald-500'
                              : (showSubscriberSelectionHint ? 'bg-white/10 border-amber-400/70 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]' : 'bg-white/10 border-white/20'))
                          }`}
                      >
                        <div className="font-semibold">{service.name}</div>
                        <div className="text-xs text-white/80">Duração: {formatDuration(parseDurationMinutes(service?.service_duration ?? service?.duration, 30))}</div>
                        {isLoadingSubscriberServiceLimits ? (
                          <div className="text-[11px] text-white/60 mt-1">Consultando limite deste serviço...</div>
                        ) : serviceLimitData?.monthlyLimit && serviceLimitData.monthlyLimit > 0 ? (
                          <div className={`text-[11px] mt-1 ${blockedByLimit ? 'text-red-200' : 'text-emerald-200'}`}>
                            Limite: {serviceLimitData.currentUsage}/{serviceLimitData.monthlyLimit} • Restam {Math.max(0, serviceLimitData.remaining || 0)}
                          </div>
                        ) : (
                          <div className="text-[11px] text-white/60 mt-1">Sem limite para este serviço</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {subscriberExtraServiceCategories.map((category: any) => (
                  <div key={`extra-category-${category.id}`}>
                    <div className="text-xs font-bold text-white/80 mb-1">{category.name}</div>
                    <div className="space-y-2">
                      {(category.services || []).map((service: any) => {
                        const serviceId = String(service?.id || '');
                        const selected = selectedSubscriberExtraIds.includes(serviceId);
                        return (
                          <button
                            key={`extra-service-${serviceId}`}
                            type="button"
                            onClick={() => toggleSubscriberExtra(serviceId)}
                            className={`w-full text-left px-3 py-2 rounded-lg border ${selected ? 'bg-violet-600 border-violet-500' : 'bg-white/10 border-white/20'}`}
                          >
                            <div className="font-semibold">{service.name}</div>
                            <div className="text-xs text-white/80">+{formatDuration(Number(service?.duration || 0))} • {toMoney(Number(service?.price || 0))}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 'datetime' && (
              <div className="space-y-2">
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(event) => {
                    const value = String(event.target.value || '').trim();
                    if (!value) return;
                    const [year, month, day] = value.split('-').map(Number);
                    if (!year || !month || !day) return;
                    const nextDate = new Date(year, month - 1, day, 12, 0, 0);
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const normalizedNext = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
                    if (normalizedNext.getTime() < today.getTime()) {
                      toast.error('Nao e permitido agendar em data passada. Selecione hoje ou uma data futura.');
                      return;
                    }
                    onSelectDate(nextDate);
                    setSelectedTime('');
                    if (isSubscriberFlow && subscriberAllowedWeekdays.length > 0) {
                      const nextDayKey = getWeekdayKey(nextDate);
                      const allowed = subscriberAllowedWeekdays.includes(nextDayKey);
                      if (!allowed) {
                        const allowedDays = subscriberAllowedWeekdays.map((weekDay) => weekdayPtMap[weekDay] || weekDay).join(', ');
                        setInvalidSubscriberDateMessage(`Infelizmente esse plano só permite agendar em ${allowedDays}. Selecione um desses dias para continuar.`);
                        return;
                      }
                    }
                    setInvalidSubscriberDateMessage('');
                    void (async () => {
                      if (isSubscriberFlow) {
                        const sameDayValidation = await validateSameDayRescheduleBlocking(chatClientPhone, nextDate);
                        if (sameDayValidation.blocked) {
                          setSameDayRescheduleMessage(sameDayValidation.message);
                          toast.error(sameDayValidation.message || 'Remarcação no mesmo dia não permitida.');
                          return;
                        }
                        setSameDayRescheduleMessage(null);
                      }
                    })();
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#151515] border border-white/20"
                />
                {sameDayRescheduleMessage && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 font-semibold">
                    {sameDayRescheduleMessage}
                  </div>
                )}
                {isSubscriberFlow && (!isSelectedDateAllowedForSubscriber || subscriberDateLimitMessage) ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    {subscriberDateLimitMessage || invalidSubscriberDateMessage || 'Esse dia não está disponível para sua assinatura. Escolha um dia permitido.'}
                  </div>
                ) : (
                  <>
                    <TimeSlotSelector
                      selectedDate={selectedDate}
                      selectedService={effectiveSelectedService}
                      existingAppointments={filteredExistingAppointments}
                      selectedTime={selectedTime}
                      onTimeSelect={(value) => {
                        setSelectedTime(value);
                        setInvalidSubscriberDateMessage('');
                        if (hasBookingHighlightedProducts) {
                          setStep('products');
                          return;
                        }
                        void (async () => {
                          const pendingValidation = await validatePendingClientBlocking(chatClientPhone);
                          if (pendingValidation.blocked) {
                            setPendingClientBookingMessage(pendingValidation.message);
                            toast.error(pendingValidation.message || 'Cliente com atendimento pendente nesta barbearia.');
                            return;
                          }
                          if (isSubscriberFlow) {
                            const sameDayValidation = await validateSameDayRescheduleBlocking(chatClientPhone, selectedDate);
                            if (sameDayValidation.blocked) {
                              setSameDayRescheduleMessage(sameDayValidation.message);
                              toast.error(sameDayValidation.message || 'Remarcação no mesmo dia não permitida.');
                              setSelectedTime('');
                              return;
                            }
                            setSameDayRescheduleMessage(null);
                          }
                          setPendingClientBookingMessage(null);
                          markAfcoinScheduleMilestone();
                          setStep('confirm');
                        })();
                      }}
                      filterPastTimes={true}
                      minimumAdvanceMinutes={minimumAdvanceMinutes}
                      businessHours={businessHoursForDate}
                      use15MinuteInterval={Boolean(establishment?.use_15_minute_interval)}
                      use20MinuteSchedule={Boolean(establishment?.use_20_minute_schedule)}
                      use60MinuteSchedule={Boolean(establishment?.use_60_minute_schedule)}
                      closedTimeEnabled={Boolean(establishment?.closed_time_enabled)}
                      selectedProfessional={selectedProfessionalId}
                      professionalAbsences={professionalAbsences}
                      professionalBlockedHours={professionalBlockedHours}
                      professionalWorkHours={professionalWorkHours}
                      hideIntervalSlots={true}
                      onVisibleSlotsChange={(count) => setVisibleSlotsCountForSelectedProfessional(count)}
                      subscriptionPlansForDuration={Array.isArray(subscriberServices) ? subscriberServices : []}
                    />
                    {visibleSlotsCountForSelectedProfessional === 0 && suggestedProfessionalsForDate.length > 0 && (
                      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
                        <p className="text-sm text-emerald-200 font-semibold">
                          Mas temos esses profissionais com essa data disponível:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {suggestedProfessionalsForDate.map(({ professional, availableCount }) => (
                            <button
                              key={`available-professional-${professional.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedProfessionalId(String(professional.id));
                                setSelectedTime('');
                              }}
                              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-400/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100"
                            >
                              {String(professional?.name || 'Profissional')} ({availableCount} horários)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {step === 'products' && hasBookingHighlightedProducts && (
              <div
                className="space-y-3 rounded-xl border p-3"
                style={{
                  background: 'linear-gradient(160deg, rgba(230,199,139,0.18) 0%, rgba(17,17,17,0.98) 45%, rgba(17,17,17,1) 100%)',
                  borderColor: 'rgba(230,199,139,0.35)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black px-2 py-1 rounded-full" style={{ background: 'rgba(230,199,139,0.22)', color: '#F5E7C2' }}>
                    ✨ Vitrine Premium
                  </span>
                </div>
                <div className="text-base font-extrabold text-[#F5E7C2]">Quer aproveitar e garantir também?</div>
                {availableBookingProducts.length === 0 ? (
                  <div className="text-xs text-white/70">
                    Nenhum produto adicional disponível agora.
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-white/70">
                      Selecione um ou mais produtos para adicionar ao agendamento.
                    </div>
                    {availableBookingProducts.map((product: any) => {
                      const productId = String(product?.id || '');
                      const selected = selectedBookingProductIds.includes(productId);
                      const imageUrl = String(product?.image_url || '').trim();
                      return (
                        <div key={`chat-booking-product-${productId}`} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBookingProductIds((previous) => (
                                previous.includes(productId)
                                  ? previous.filter((id) => id !== productId)
                                  : [...previous, productId]
                              ));
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selected
                                ? 'text-white'
                                : 'bg-white/10 border-white/20 hover:bg-white/15'
                              }`}
                            style={
                              selected
                                ? {
                                  background: 'linear-gradient(135deg, rgba(230,199,139,0.32) 0%, rgba(16,185,129,0.45) 100%)',
                                  borderColor: 'rgba(230,199,139,0.9)',
                                  boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
                                }
                                : undefined
                            }
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={String(product?.name || 'Produto')}
                                    className="h-9 w-9 rounded-lg object-cover border border-white/25 shrink-0"
                                    loading="lazy"
                                  />
                                ) : null}
                                <div className="font-semibold truncate">{String(product?.name || 'Produto')}</div>
                              </div>
                              {selected && <span className="text-[10px] font-black px-2 py-1 rounded-full bg-black/30 shrink-0">SELECIONADO</span>}
                            </div>
                            <div className="text-xs text-white/80">+ {toMoney(Number(product?.sale_price || 0))}</div>
                          </button>
                          {imageUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedBookingProductImagePreview({
                                  url: imageUrl,
                                  name: String(product?.name || 'Produto')
                                })
                              }
                              className="text-[11px] px-2 py-1 rounded-md border border-[#E6C78B]/60 text-[#F5E7C2] hover:bg-[#E6C78B]/15 transition-colors"
                            >
                              Ver foto
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                    <div className="text-xs font-semibold text-[#E6C78B]">
                      Total de produtos: {toMoney(Number(bookingProductsTotal || 0))}
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    const pendingValidation = await validatePendingClientBlocking(chatClientPhone);
                    if (pendingValidation.blocked) {
                      setPendingClientBookingMessage(pendingValidation.message);
                      toast.error(pendingValidation.message || 'Cliente com atendimento pendente nesta barbearia.');
                      return;
                    }
                    if (isSubscriberFlow) {
                      const sameDayValidation = await validateSameDayRescheduleBlocking(chatClientPhone, selectedDate);
                      if (sameDayValidation.blocked) {
                        setSameDayRescheduleMessage(sameDayValidation.message);
                        toast.error(sameDayValidation.message || 'Remarcação no mesmo dia não permitida.');
                        return;
                      }
                      setSameDayRescheduleMessage(null);
                    }
                    setPendingClientBookingMessage(null);
                    markAfcoinScheduleMilestone();
                    setStep('confirm');
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#E6C78B] hover:bg-[#f1ddb0] text-black text-sm font-extrabold transition-colors"
                >
                  Continuar para confirmação
                </button>
              </div>
            )}

            {step === 'confirm' && (
              <div className="space-y-2 text-sm">
                {pendingClientBookingMessage && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 font-semibold">
                    {pendingClientBookingMessage}
                  </div>
                )}
                {sameDayRescheduleMessage && (
                  <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 font-semibold">
                    {sameDayRescheduleMessage}
                  </div>
                )}
                {afcoinsEnabled && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 font-semibold">
                    ✅ Etapa concluída: você ganhou <strong>+10 AFCoins</strong> neste agendamento.
                  </div>
                )}
                <div><strong>Cliente:</strong> {chatClientName}</div>
                <div><strong>WhatsApp:</strong> {chatClientPhone}</div>
                <div><strong>Profissional:</strong> {selectedProfessional?.name || '-'}</div>
                <div><strong>Serviço:</strong> {computedSelection.serviceName || '-'}</div>
                <div><strong>Data:</strong> {format(selectedDate, 'dd/MM/yyyy')} às {selectedTime || '--:--'}</div>
                <div><strong>Duração:</strong> {formatDuration(computedSelection.duration)}</div>
                {!isSubscriberFlow && (publicLoyaltyLoading || publicLoyaltyRow) ? (
                  <div className="rounded-lg border border-[#E6C78B]/35 bg-[#E6C78B]/10 px-3 py-2 text-xs text-[#F5E7C2] space-y-1">
                    <div className="font-extrabold text-[#E6C78B] text-[11px] uppercase tracking-wide">Fidelidade</div>
                    {publicLoyaltyLoading ? (
                      <div className="text-white/70">Carregando pontos...</div>
                    ) : publicLoyaltyRow ? (
                      publicLoyaltyRow.cycle_progress >= publicLoyaltyRow.cycle_goal ? (
                        <div className="space-y-2">
                          <p>
                            <strong className="text-emerald-300">Meta atingida</strong> ({publicLoyaltyRow.cycle_goal}{' '}
                            ponto(s) no ciclo). Use o benefício para este agendamento sair <strong>gratuito</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={() => setPublicLoyaltyRedeemApplied((v) => !v)}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition-colors"
                          >
                            {publicLoyaltyRedeemApplied ? 'Cancelar uso do benefício' : 'Usar benefício'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          Pontos neste ciclo: <strong>{publicLoyaltyRow.cycle_progress}</strong> de{' '}
                          <strong>{publicLoyaltyRow.cycle_goal}</strong>
                          {' — '}
                          faltam <strong>{publicLoyaltyRow.cycle_goal - publicLoyaltyRow.cycle_progress}</strong> ponto(s) para liberar o benefício.
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}
                <div><strong>Valor:</strong> {toMoney(confirmDisplayServicePrice)}</div>
                {!loyaltyFreeBooking && selectedBookingProducts.length > 0 && (
                  <div>
                    <strong>Produtos adicionais:</strong>{' '}
                    {selectedBookingProducts.map((product: any) => String(product?.name || 'Produto')).join(' + ')} ({toMoney(bookingProductsTotal)})
                  </div>
                )}
                <div><strong>Total final:</strong> {toMoney(confirmDisplayTotalPrice)}</div>
                {!isSubscriberFlow && !requireAdvancePayment && shouldSkipPaymentMethodQuestion && (
                  <div className="text-xs text-cyan-200/90">
                    Pagamento via Mercado Pago ativo: a escolha de pagamento acontece no checkout, sem precisar selecionar aqui.
                  </div>
                )}
                {shouldAskPaymentMethod && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-white/90">
                      Forma de pagamento
                    </label>
                    <PaymentMethodSelector
                      selectedMethod={selectedPaymentMethod || null}
                      onMethodSelect={(method) => setSelectedPaymentMethod(String(method || '').trim().toLowerCase())}
                      showPixOptions={Boolean((establishment as any)?.pix_key)}
                      enabledMethods={enabledPaymentMethods}
                    />
                    <p className="text-xs text-white/70">
                      Escolha como pretende pagar no estabelecimento.
                    </p>
                  </div>
                )}
                {shouldRequireCpf && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-white/90">
                      CPF obrigatório para confirmar
                    </label>
                    <input
                      type="tel"
                      value={chatClientCpf}
                      onChange={(event) => setChatClientCpf(formatCpfChat(event.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 rounded-lg bg-[#151515] border border-white/20"
                    />
                    <div className={`text-xs ${isCpfValidForRequiredBooking ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {isCpfValidForRequiredBooking
                        ? 'CPF preenchido com sucesso.'
                        : 'Informe CPF com 11 dígitos para continuar.'}
                    </div>
                  </div>
                )}
                {requireAdvancePayment && !isSubscriberFlow && (
                  <div className="text-amber-300 font-semibold">
                    Pagamento antecipado obrigatório: ao confirmar, abrirá a tela de pagamento.
                  </div>
                )}
                {isSubscriberFlow && (
                  <div className="text-emerald-400 font-semibold">Agendamento com assinatura</div>
                )}
              </div>
            )}
          </div>

          <div className="pt-1 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
            >
              Voltar
            </button>
            {step === 'service' && (
              <button
                type="button"
                onClick={() => void goNext()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold"
              >
                Próximo
              </button>
            )}
            {step === 'confirm' && !pendingClientBookingMessage && !sameDayRescheduleMessage && (
              <button
                type="button"
                onClick={handleConfirmBooking}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold"
                disabled={isSubmitting || !isCpfValidForRequiredBooking || isCheckingPendingClientBooking}
              >
                {isSubmitting ? 'Confirmando...' : 'Confirmar Agendamento'}
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedBookingProductImagePreview && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedBookingProductImagePreview(null)}
        >
          <div
            className="max-w-2xl w-full rounded-2xl border border-[#E6C78B]/40 bg-[#111] p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-[#F5E7C2]">
                {selectedBookingProductImagePreview.name}
              </h4>
              <button
                type="button"
                onClick={() => setSelectedBookingProductImagePreview(null)}
                className="text-xs px-2 py-1 rounded bg-white/10 text-white hover:bg-white/20"
              >
                Fechar
              </button>
            </div>
            <img
              src={selectedBookingProductImagePreview.url}
              alt={selectedBookingProductImagePreview.name}
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}


