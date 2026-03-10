import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { checkWhatsAppSubscriber as checkNewSubscriber } from '../lib/subscriberSystem';
import { checkWhatsAppSubscriber as checkLegacySubscriber } from '../lib/supabase';
import { TimeSlotSelector } from './TimeSlotSelector';

type ChatStep = 'name' | 'phone' | 'subscriberChoice' | 'professional' | 'service' | 'datetime' | 'confirm';

interface BookingChatFlowProps {
  establishment: any;
  guestClientData: { name: string; phone: string } | null;
  onGuestClientDataCollected?: (name: string, phone: string) => void;
  onCloseChat?: () => void;
  existingAppointments: any[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onSubmit: (appointmentData: any) => Promise<void>;
  requireAdvancePayment: boolean;
  subscriberServices?: any[];
  subscriberExtraServiceCategories?: any[];
}

const toMoney = (value: number): string => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
const formatDuration = (minutes: number): string => `${Math.max(0, Number(minutes || 0))} min`;
const onlyDigits = (raw: string) => String(raw || '').replace(/\D/g, '');
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
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

export function BookingChatFlow({
  establishment,
  guestClientData,
  onGuestClientDataCollected,
  onCloseChat,
  existingAppointments,
  selectedDate,
  onSelectDate,
  onSubmit,
  requireAdvancePayment,
  subscriberServices = [],
  subscriberExtraServiceCategories = [],
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
  const [detectedSubscriber, setDetectedSubscriber] = useState<any>(null);
  const [isSubscriberFlow, setIsSubscriberFlow] = useState(false);
  const [selectedSubscriberServiceId, setSelectedSubscriberServiceId] = useState('');
  const [selectedSubscriberExtraIds, setSelectedSubscriberExtraIds] = useState<string[]>([]);
  const [invalidSubscriberDateMessage, setInvalidSubscriberDateMessage] = useState('');
  const [visibleSlotsCountForSelectedProfessional, setVisibleSlotsCountForSelectedProfessional] = useState<number | null>(null);

  const professionals = useMemo(
    () => (Array.isArray(establishment?.professionals) ? establishment.professionals.filter((p: any) => !p?.hidden_from_booking) : []),
    [establishment?.professionals]
  );

  const selectedProfessional = useMemo(
    () => professionals.find((professional: any) => String(professional?.id || '') === String(selectedProfessionalId || '')),
    [professionals, selectedProfessionalId]
  );

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
    const hasSpecificForSelectedProfessional = specificRaw.length > 0;
    // Regra definitiva do chat:
    // Se o profissional possui serviços específicos, mostrar SOMENTE os específicos.
    // Isso evita mistura de serviços "fantasmas" vindos de fontes gerais/categorias.
    const generalServices = hasSpecificForSelectedProfessional
      ? []
      : (legacyServices.length > 0 ? legacyServices : resolvedServices);
    const filteredGeneralServices = generalServices.filter((service: any) => {
      const hidden = Boolean(service?.hidden_from_booking ?? service?.oculto_da_reserva);
      if (hidden) return false;
      const excluded = Array.isArray(service?.excluded_professional_ids) ? service.excluded_professional_ids.map((id: any) => String(id)) : [];
      if (selectedProfessionalId && excluded.includes(String(selectedProfessionalId))) return false;
      return true;
    });
    const specificServices = specificRaw
      .map((service: any, index: number) =>
        normalizeSpecificService(
          service,
          `${String(selectedProfessionalId || 'prof')}-${index}-${String(service?.name || service?.service_name || '')}`
        )
      )
      .filter(Boolean)
      .map((service: any) => ({
        id: `specific-${service.id}`,
        name: `${service.name} (${String(selectedProfessional?.name || 'Profissional')})`,
        price: Number(service.price || 0),
        duration: Number(service.duration || 30),
        category_id: 'specific-professional-services',
        category_name: 'Serviços do Profissional',
        excluded_professional_ids: [],
      }));

    const mergedServices = [...filteredGeneralServices, ...specificServices];
    const dedupedById = new Map<string, any>();
    mergedServices.forEach((service: any) => {
      const serviceId = String(service?.id || '').trim();
      if (!serviceId) return;
      if (!dedupedById.has(serviceId)) dedupedById.set(serviceId, service);
    });
    return Array.from(dedupedById.values());
  }, [establishment?.services_with_prices, selectedProfessional as any, selectedProfessionalId]);

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
    const all = Array.isArray(subscriberServices) ? subscriberServices : [];
    const detectedPlanId = String(
      (detectedSubscriber as any)?.subscription_id ||
      (detectedSubscriber as any)?.subscriptions?.id ||
      ''
    ).trim();
    if (!detectedPlanId) return all;
    const filtered = all.filter((service: any) => String(service?.id || '').trim() === detectedPlanId);
    return filtered.length > 0 ? filtered : all;
  }, [detectedSubscriber, subscriberServices]);
  const selectedSubscriberService = useMemo(
    () => subscriberServiceOptions.find((service: any) => String(service?.id || '') === String(selectedSubscriberServiceId || '')),
    [selectedSubscriberServiceId, subscriberServiceOptions]
  );
  useEffect(() => {
    if (!selectedSubscriberServiceId) return;
    const stillExists = subscriberServiceOptions.some((service: any) => String(service?.id || '') === String(selectedSubscriberServiceId || ''));
    if (!stillExists) {
      setSelectedSubscriberServiceId('');
      setSelectedSubscriberExtraIds([]);
    }
  }, [selectedSubscriberServiceId, subscriberServiceOptions]);

  const subscriberExtraServicesFlat = useMemo(() => {
    const categories = Array.isArray(subscriberExtraServiceCategories) ? subscriberExtraServiceCategories : [];
    return categories.flatMap((category: any) => (Array.isArray(category?.services) ? category.services : []));
  }, [subscriberExtraServiceCategories]);

  const selectedSubscriberExtraServices = useMemo(
    () => subscriberExtraServicesFlat.filter((service: any) => selectedSubscriberExtraIds.includes(String(service?.id || ''))),
    [selectedSubscriberExtraIds, subscriberExtraServicesFlat]
  );

  const computedSelection = useMemo(() => {
    if (isSubscriberFlow) {
      const baseDuration = Number((selectedSubscriberService as any)?.service_duration ?? (selectedSubscriberService as any)?.duration ?? 30) || 30;
      const extraDuration = selectedSubscriberExtraServices.reduce((sum: number, service: any) => sum + (Number(service?.duration) || 0), 0);
      const extraPrice = selectedSubscriberExtraServices.reduce((sum: number, service: any) => sum + (Number(service?.price) || 0), 0);
      const baseName = String((selectedSubscriberService as any)?.booking_service_name || (selectedSubscriberService as any)?.name || '').trim();
      const extraNames = selectedSubscriberExtraServices.map((service: any) => String(service?.name || '').trim()).filter(Boolean);
      return {
        duration: baseDuration + extraDuration,
        price: extraPrice,
        serviceName: extraNames.length ? `${baseName} + Extra: ${extraNames.join(' + ')}` : baseName,
      };
    }

    const duration = selectedServices.reduce((sum: number, service: any) => sum + (Number(service?.duration) || 0), 0);
    const price = selectedServices.reduce((sum: number, service: any) => sum + (Number(service?.price) || 0), 0);
    const serviceName = selectedServices.map((service: any) => String(service?.name || '').trim()).filter(Boolean).join(' + ');
    return { duration, price, serviceName };
  }, [isSubscriberFlow, selectedServices, selectedSubscriberExtraServices, selectedSubscriberService]);

  const subscriberAllowedWeekdays = useMemo(() => {
    if (!isSubscriberFlow) return [] as string[];
    const weekdays = Array.isArray((selectedSubscriberService as any)?.weekdays) ? (selectedSubscriberService as any).weekdays : [];
    return weekdays.map((day: any) => String(day || '').toLowerCase().trim()).filter(Boolean);
  }, [isSubscriberFlow, selectedSubscriberService]);

  const isSelectedDateAllowedForSubscriber = useMemo(() => {
    if (!isSubscriberFlow) return true;
    if (subscriberAllowedWeekdays.length === 0) return true;
    return subscriberAllowedWeekdays.includes(getWeekdayKey(selectedDate));
  }, [isSubscriberFlow, selectedDate, subscriberAllowedWeekdays]);

  const effectiveSelectedService = useMemo(
    () => ({
      id: isSubscriberFlow ? String((selectedSubscriberService as any)?.id || 'subscriber-service') : 'normal-service',
      name: computedSelection.serviceName || 'Serviço',
      price: computedSelection.price || 0,
      duration: computedSelection.duration || 30,
    }),
    [computedSelection.duration, computedSelection.price, computedSelection.serviceName, isSubscriberFlow, selectedSubscriberService]
  );

  const businessHoursForDate = useMemo(() => buildBusinessHoursForDate(establishment, selectedDate), [establishment, selectedDate]);
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
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
  const professionalBlockedHours = useMemo(
    () => ((selectedProfessional as any)?.blocked_hours?.[selectedDateKey] || []),
    [selectedProfessional, selectedDateKey]
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

  const getAvailableSlotsCountForProfessional = (professional: any): number => {
    if (!professional) return 0;
    if (!businessHoursForDate?.enabled) return 0;

    const interval = Boolean(establishment?.use_60_minute_schedule)
      ? 60
      : Boolean(establishment?.use_20_minute_schedule)
        ? 20
        : Boolean(establishment?.use_15_minute_interval)
          ? 30
          : 15;

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

    const blockedHours = ((professional as any)?.blocked_hours?.[selectedDateString] || []) as string[];
    const isAligned = (step: number) =>
      blockedHours.every((time) => {
        const minute = Number(String(time).split(':')[1] ?? NaN);
        return Number.isFinite(minute) && minute % step === 0;
      });
    const blockedSlotDuration = (() => {
      if (blockedHours.length === 0) return interval;
      if (Boolean(establishment?.use_60_minute_schedule)) return isAligned(60) ? 60 : 15;
      if (Boolean(establishment?.use_20_minute_schedule)) return isAligned(20) ? 20 : 15;
      if (Boolean(establishment?.use_15_minute_interval)) return isAligned(30) ? 30 : 15;
      return 15;
    })();

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
      const baseDuration = Number(appointment?.duration || 0);
      const extraDuration = Array.isArray(appointment?.additional_products)
        ? appointment.additional_products.reduce((sum: number, item: any) => sum + (Number(item?.duration || 0) || 0), 0)
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
  ]);

  useEffect(() => {
    setVisibleSlotsCountForSelectedProfessional(null);
  }, [selectedProfessionalId, selectedDateKey, computedSelection.duration, step]);

  const isPhoneValid = (raw: string) => onlyDigits(raw).length === 11;

  const canProceedFromStep = () => {
    if (step === 'name') return String(draftInput || '').trim().length >= 3;
    if (step === 'phone') return isPhoneValid(draftInput);
    if (step === 'service') {
      if (isSubscriberFlow) return Boolean(selectedSubscriberServiceId);
      return selectedServiceIds.length > 0;
    }
    return true;
  };

  const detectSubscriber = async (phoneRaw: string) => {
    const establishmentId = String(establishment?.id || establishment?.establishment_id || '').trim();
    if (!establishmentId) return null;
    try {
      const { data: firstData, error: firstError } = await checkNewSubscriber(phoneRaw, establishmentId);
      if (firstData && !firstError) {
        const isExpired = Boolean((firstData as any)?.is_expired) || (new Date((firstData as any)?.end_date) < new Date());
        if (!isExpired) return firstData;
      }
    } catch {
      // ignore and fallback
    }
    try {
      const { data: secondData, error: secondError } = await checkLegacySubscriber(phoneRaw, establishmentId);
      if (secondData && !secondError) {
        const isExpired = new Date((secondData as any)?.end_date) < new Date();
        if (!isExpired) return secondData;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const goNext = async () => {
    if (!canProceedFromStep()) return;
    if (step === 'name') {
      setChatClientName(String(draftInput || '').trim());
      setDraftInput(formatPhoneChat(chatClientPhone || ''));
      setStep('phone');
      return;
    }
    if (step === 'phone') {
      const nextPhone = formatPhoneChat(String(draftInput || '').trim());
      setChatClientPhone(nextPhone);
      const nextName = String(chatClientName || '').trim();
      if (nextName && nextPhone && onGuestClientDataCollected) {
        onGuestClientDataCollected(nextName, nextPhone);
      }
      setIsCheckingSubscriber(true);
      const subscriber = await detectSubscriber(nextPhone);
      setIsCheckingSubscriber(false);
      if (subscriber) {
        setDetectedSubscriber(subscriber);
        setStep('subscriberChoice');
      } else {
        setDetectedSubscriber(null);
        setIsSubscriberFlow(false);
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
    const sequence: ChatStep[] = ['name', 'phone', ...(detectedSubscriber ? (['subscriberChoice'] as ChatStep[]) : []), 'professional', 'service', 'datetime', 'confirm'];
    const currentIndex = sequence.indexOf(step);
    if (currentIndex <= 0) {
      if (onCloseChat) onCloseChat();
      return;
    }
    const prevStep = sequence[currentIndex - 1];
    if (prevStep === 'name') setDraftInput(chatClientName || '');
    if (prevStep === 'phone') setDraftInput(chatClientPhone || '');
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

  const handleConfirmBooking = async () => {
    if (!chatClientName || !chatClientPhone || !selectedProfessionalId || !selectedTime) return;
    if (!computedSelection.serviceName || computedSelection.duration <= 0) return;
    if (isSubscriberFlow && !isSelectedDateAllowedForSubscriber) {
      const allowedDays = subscriberAllowedWeekdays.map((day) => weekdayPtMap[day] || day).join(', ');
      toast.error(`Esse plano permite agendamento somente em: ${allowedDays}.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        client_name: chatClientName,
        client_whatsapp: chatClientPhone,
        service: computedSelection.serviceName,
        professional: selectedProfessionalId,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: selectedTime,
        duration: computedSelection.duration,
        price: computedSelection.price,
        payment_method: isSubscriberFlow ? 'assinante' : (requireAdvancePayment ? 'pendente' : 'pagar_local'),
        is_child_service: false,
        is_subscriber: isSubscriberFlow,
        subscription_id: isSubscriberFlow
          ? String((selectedSubscriberService as any)?.id || (detectedSubscriber as any)?.subscription_id || '').trim() || null
          : null,
        subscriber_service_id: isSubscriberFlow ? String((selectedSubscriberService as any)?.service_id || '').trim() || null : null,
        subscriber_service_name: isSubscriberFlow ? String((selectedSubscriberService as any)?.name || '').trim() || null : null,
        subscriber_service_limit: isSubscriberFlow ? Number((selectedSubscriberService as any)?.service_limit || 0) || null : null,
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
      messages.push({ id: 'bot-phone', role: 'bot', text: 'Perfeito! Agora me informe seu número de telefone para realizarmos seu agendamento.' });
    }
    if (chatClientPhone) {
      messages.push({ id: 'user-phone', role: 'user', text: chatClientPhone });
    }
    if (detectedSubscriber) {
      messages.push({
        id: 'bot-subscriber-choice',
        role: 'bot',
        text: 'Opa! Você é cliente assinante. Deseja usar sua assinatura ou agendar sem ela?'
      });
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
      (!detectedSubscriber || step !== 'subscriberChoice');

    if (shouldShowProfessionalPrompt) {
      messages.push({
        id: 'bot-professional',
        role: 'bot',
        text: isSubscriberFlow
          ? 'Pronto, assinatura ativada. Qual profissional deseja agendar?'
          : 'Maravilha! Agora me diga qual profissional você deseja para o seu agendamento.'
      });
    }

    if (selectedProfessional?.name) {
      messages.push({ id: 'user-professional', role: 'user', text: selectedProfessional.name });
      messages.push({
        id: 'bot-service',
        role: 'bot',
        text: isSubscriberFlow
          ? 'Perfeito! Escolha seu serviço da assinatura e os extras (se houver).'
          : 'Perfeito! Agora me diga quais desses serviços você deseja fazer. Você pode selecionar um ou mais.'
      });
    }
    if (computedSelection.serviceName && step !== 'service') {
      messages.push({ id: 'user-service', role: 'user', text: computedSelection.serviceName });
      messages.push({ id: 'bot-datetime', role: 'bot', text: 'Qual data você deseja para o agendamento? Abaixo já estão os horários disponíveis.' });
    }
    if (invalidSubscriberDateMessage) {
      messages.push({ id: 'bot-invalid-subscriber-weekday', role: 'bot', text: invalidSubscriberDateMessage });
    }
    if (selectedTime) {
      messages.push({ id: 'user-date-time', role: 'user', text: `${format(selectedDate, 'dd/MM/yyyy')} • ${selectedTime}` });
      messages.push({ id: 'bot-confirm', role: 'bot', text: 'Perfeito! Revise os dados e confirme seu agendamento.' });
    }
    return messages;
  }, [chatClientName, chatClientPhone, computedSelection.serviceName, detectedSubscriber, establishment?.name, invalidSubscriberDateMessage, isSubscriberFlow, selectedDate, selectedProfessional?.name, selectedTime, step]);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const serviceIntroRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (step === 'service' && serviceIntroRef.current) {
      serviceIntroRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if ((step === 'phone' || step === 'professional' || step === 'subscriberChoice') && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, step]);

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
                  onChange={(e) => setDraftInput(step === 'phone' ? formatPhoneChat(e.target.value) : e.target.value)}
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
                  disabled={!canProceedFromStep() || isCheckingSubscriber}
                  className={`w-full px-4 py-2 rounded-lg text-sm font-semibold ${canProceedFromStep() && !isCheckingSubscriber ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-white/10 text-white/60 cursor-not-allowed'}`}
                >
                  {isCheckingSubscriber ? 'Verificando assinante...' : 'Enviar'}
                </button>
              </div>
            )}

            {step === 'subscriberChoice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubscriberFlow(true);
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
                {groupedServices.map((category) => (
                  <div key={category.id}>
                    <div className="text-xs font-bold text-white/80 mb-1">{category.name}</div>
                    <div className="space-y-2">
                      {category.services.map((service: any) => {
                        const serviceId = String(service?.id || '');
                        const selected = selectedServiceIds.includes(serviceId);
                        return (
                          <button
                            key={serviceId}
                            type="button"
                            onClick={() => toggleService(serviceId)}
                            className={`w-full text-left px-3 py-2 rounded-lg border ${selected ? 'bg-emerald-600 border-emerald-500' : 'bg-white/10 border-white/20'}`}
                          >
                            <div className="font-semibold">{service.name}</div>
                            <div className="text-xs text-white/80">{toMoney(Number(service?.price || 0))} • {formatDuration(Number(service?.duration || 0))}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 'service' && isSubscriberFlow && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {subscriberServiceOptions.map((service: any) => {
                    const selected = String(selectedSubscriberServiceId) === String(service?.id || '');
                    return (
                      <button
                        key={`subscriber-service-${service.id}`}
                        type="button"
                        onClick={() => setSelectedSubscriberServiceId(String(service.id))}
                        className={`w-full text-left px-3 py-2 rounded-lg border ${selected ? 'bg-emerald-600 border-emerald-500' : 'bg-white/10 border-white/20'}`}
                      >
                        <div className="font-semibold">{service.name}</div>
                        <div className="text-xs text-white/80">Duração: {formatDuration(Number(service?.service_duration || service?.duration || 30))}</div>
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
                  onChange={(event) => {
                    const value = String(event.target.value || '').trim();
                    if (!value) return;
                    const [year, month, day] = value.split('-').map(Number);
                    if (!year || !month || !day) return;
                    const nextDate = new Date(year, month - 1, day, 12, 0, 0);
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
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#151515] border border-white/20"
                />
                {isSubscriberFlow && !isSelectedDateAllowedForSubscriber ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                    {invalidSubscriberDateMessage || 'Esse dia não está disponível para sua assinatura. Escolha um dia permitido.'}
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
                        setStep('confirm');
                      }}
                      filterPastTimes={true}
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

            {step === 'confirm' && (
              <div className="space-y-2 text-sm">
                <div><strong>Cliente:</strong> {chatClientName}</div>
                <div><strong>WhatsApp:</strong> {chatClientPhone}</div>
                <div><strong>Profissional:</strong> {selectedProfessional?.name || '-'}</div>
                <div><strong>Serviço:</strong> {computedSelection.serviceName || '-'}</div>
                <div><strong>Data:</strong> {format(selectedDate, 'dd/MM/yyyy')} às {selectedTime || '--:--'}</div>
                <div><strong>Duração:</strong> {formatDuration(computedSelection.duration)}</div>
                <div><strong>Valor:</strong> {toMoney(computedSelection.price)}</div>
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
                disabled={!canProceedFromStep()}
              >
                Próximo
              </button>
            )}
            {step === 'confirm' && (
              <button
                type="button"
                onClick={handleConfirmBooking}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Confirmando...' : 'Confirmar Agendamento'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

