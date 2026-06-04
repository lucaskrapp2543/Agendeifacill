import { format } from 'date-fns';
import { Accessibility, AlertCircle, Armchair, CalendarDays, CarFront, ChevronDown, ChevronLeft, ChevronRight, Coffee, CupSoda, Download, Home, LogOut, Music2, Snowflake, Star, ThumbsUp, Tv, Users, UtensilsCrossed, Wifi, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppointmentForm } from '../components/AppointmentForm';
import { BookingChatFlow } from '../components/BookingChatFlow';
import { PaymentModal } from '../components/PaymentModal';
import { QuickBookingModal } from '../components/QuickBookingModal';
import ReadMore from '../components/ReadMore';
import { SubscriptionPixModal } from '../components/SubscriptionPixModal';
import { useAuth } from '../context/AuthContext';
import { createGuestClientAndLogin, getSubscriptions, supabase, updateClientLastAccess } from '../lib/supabase';
import { checkMonthlyLimit } from '../utils/monthlyLimitValidation';
import { validateOneWeekLimit } from '../utils/oneWeekLimitValidation';
import { validatePendingClientBookingLimit } from '../utils/pendingClientBookingValidation';
import { validateSameDayReschedule } from '../utils/sameDayRescheduleValidation';
import { validateSubscriberBooking } from '../utils/subscriberBookingValidation';
import {
  buildStalePaymentDetail,
  CANCELLATION_SOURCE,
  PENDING_PAYMENT_NO_TX_MINUTES,
  PENDING_PAYMENT_WITH_TX_MINUTES,
  updateAppointmentCancelledWithSource,
} from '../utils/appointmentCancellationMeta';
import { fireMercadoPagoPendingReconcile } from '../utils/fireMercadoPagoPendingReconcile';
import { filterTimesAlignedToScheduleGrid, getScheduleIntervalMinutes } from '../utils/scheduleGrid';
import { storagePublicUrlForBrowser } from '../utils/storagePublicUrl';

type PublicBookingReview = {
  id: string;
  client_name: string;
  review_text: string;
  created_at: string;
};

type BookingHighlightedProduct = {
  id: string;
  name: string;
  sale_price: number;
  image_url?: string | null;
  stock_quantity?: number | null;
  highlight_for_client_booking?: boolean | null;
};

type BookingCustomAmenity = {
  id: string;
  name: string;
  icon: string;
  enabled?: boolean;
};

const BOOKING_CUSTOM_AMENITY_ICONS: Record<string, LucideIcon> = {
  star: Star,
  snowflake: Snowflake,
  coffee: Coffee,
  cup_soda: CupSoda,
  armchair: Armchair,
  utensils: UtensilsCrossed,
  tv: Tv,
  music: Music2,
  wifi: Wifi,
  parking: CarFront,
  accessibility: Accessibility,
};

const sanitizeBookingCustomAmenities = (value: any): BookingCustomAmenity[] => {
  if (!Array.isArray(value)) return [];
  const result: BookingCustomAmenity[] = [];
  const unique = new Set<string>();

  value.forEach((item: any) => {
    const name = String(item?.name || '').trim();
    if (!name) return;

    const id = String(item?.id || '').trim() || `${name.toLowerCase().replace(/\s+/g, '-')}-${result.length}`;
    if (unique.has(id)) return;
    unique.add(id);

    const iconId = String(item?.icon || 'star').trim();
    const icon = BOOKING_CUSTOM_AMENITY_ICONS[iconId] ? iconId : 'star';
    const enabled = item?.enabled !== false;
    result.push({ id, name, icon, enabled });
  });

  return result.slice(0, 20);
};

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  console.log('🔍 DEBUG - BookingPage - user:', user);
  console.log('🔍 DEBUG - BookingPage - user.id:', user?.id);

  const [establishment, setEstablishment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBookingBlocked, setIsBookingBlocked] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [forceRender, setForceRender] = useState(0);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [showDemoSuccessModal, setShowDemoSuccessModal] = useState(false); // Novo estado para o modal de demonstração
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [showSubscriptionPixModal, setShowSubscriptionPixModal] = useState(false);
  const [selectedSubscriptionForPix, setSelectedSubscriptionForPix] = useState<any | null>(null);
  const [subscriptionPixInitialFlow, setSubscriptionPixInitialFlow] = useState<'default' | 'credit' | 'whatsapp'>('default');
  const [renewalPrefill, setRenewalPrefill] = useState<{ name: string; whatsapp: string } | null>(null);
  const [showRenewLookupModal, setShowRenewLookupModal] = useState(false);
  const [renewLookupSubscription, setRenewLookupSubscription] = useState<any | null>(null);
  const [renewLookupPhone, setRenewLookupPhone] = useState('');
  const [isRenewLookupLoading, setIsRenewLookupLoading] = useState(false);
  const [showSubscriptionsDropdown, setShowSubscriptionsDropdown] = useState(false);
  const [showBusinessHours, setShowBusinessHours] = useState(false);
  const [duplicateCarouselIndex, setDuplicateCarouselIndex] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [installGuideTitle, setInstallGuideTitle] = useState('Instalar o app');
  const [installGuideSteps, setInstallGuideSteps] = useState<string[]>([]);
  const [secondUnitName, setSecondUnitName] = useState<string | null>(null);
  const [approvedReviews, setApprovedReviews] = useState<PublicBookingReview[]>([]);
  const [isLoadingApprovedReviews, setIsLoadingApprovedReviews] = useState(false);
  const [showApprovedReviewsModal, setShowApprovedReviewsModal] = useState(false);
  const [showCreateReviewModal, setShowCreateReviewModal] = useState(false);
  const [reviewClientName, setReviewClientName] = useState('');
  const [reviewClientPhone, setReviewClientPhone] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewSubmittedModal, setShowReviewSubmittedModal] = useState(false);
  const [bookingHighlightedProducts, setBookingHighlightedProducts] = useState<BookingHighlightedProduct[]>([]);

  // Funções para o carrossel duplicado - Filtrar apenas fotos selecionadas
  const duplicatePhotos = [
    establishment?.custom_photo_1_url,
    establishment?.custom_photo_2_url,
    establishment?.custom_photo_3_url,
    establishment?.custom_photo_4_url,
    establishment?.custom_photo_5_url,
    establishment?.custom_photo_6_url,
    establishment?.custom_photo_7_url,
  ]
    .map((u) => (u ? storagePublicUrlForBrowser(String(u)) : ''))
    .filter(Boolean); // Remove valores undefined/null
  const hasCarouselPhotos = duplicatePhotos.length > 0;
  const customAmenities = sanitizeBookingCustomAmenities(establishment?.custom_amenities);
  const enabledCustomAmenities = customAmenities.filter((item) => item.enabled !== false);

  // Debug: verificar se as fotos estão sendo carregadas
  console.log('🔍 DEBUG FOTOS:');
  console.log('📸 Fotos do carrossel:', duplicatePhotos);
  console.log('📸 Total de fotos:', duplicatePhotos.length);
  console.log('🏢 Estabelecimento:', establishment);
  console.log('📸 Fotos individuais:', {
    photo1: establishment?.custom_photo_1_url,
    photo2: establishment?.custom_photo_2_url,
    photo3: establishment?.custom_photo_3_url,
    photo4: establishment?.custom_photo_4_url,
    photo5: establishment?.custom_photo_5_url,
    photo6: establishment?.custom_photo_6_url,
    photo7: establishment?.custom_photo_7_url,
  });

  const goToPreviousDuplicate = () => {
    if (!hasCarouselPhotos) return;
    setDuplicateCarouselIndex((prevIndex) =>
      prevIndex === 0 ? duplicatePhotos.length - 1 : prevIndex - 1
    );
  };

  const goToNextDuplicate = () => {
    if (!hasCarouselPhotos) return;
    setDuplicateCarouselIndex((prevIndex) => (prevIndex + 1) % duplicatePhotos.length);
  };

  const goToSlideDuplicate = (index: number) => {
    setDuplicateCarouselIndex(index);
  };

  // Estados para agendamento assinante
  const [showSubscriberBooking, setShowSubscriberBooking] = useState(false);
  const [selectedSubscriberService, setSelectedSubscriberService] = useState<any>(null);
  const [selectedDividedSubscriberServices, setSelectedDividedSubscriberServices] = useState<any[]>([]);
  const [hasConfirmedDividedSubscriberServices, setHasConfirmedDividedSubscriberServices] = useState(false);
  const [selectedSubscriberExtraServiceIds, setSelectedSubscriberExtraServiceIds] = useState<string[]>([]);
  const [convertedSubscriberData, setConvertedSubscriberData] = useState<any>(null); // Dados do assinante convertido
  const [showLoginModal, setShowLoginModal] = useState(false); // Estado para controlar o modal de login
  const [subscriberDetectionDisabled, setSubscriberDetectionDisabled] = useState(false); // Estado para desabilitar detecção de assinante
  const [showQuickBookingModal, setShowQuickBookingModal] = useState(false); // Modal de agendamento rápido
  const [guestClientData, setGuestClientData] = useState<{ name: string; phone: string } | null>(null); // Dados do cliente convidado
  const [useLegacyBookingFlow, setUseLegacyBookingFlow] = useState(false);

  // ✅ Fila de espera (booking público)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistEntries, setWaitlistEntries] = useState<any[]>([]);
  const [waitlistEntriesAll, setWaitlistEntriesAll] = useState<any[]>([]);
  const [isLoadingWaitlist, setIsLoadingWaitlist] = useState(false);
  const [showLeaveWaitlistForm, setShowLeaveWaitlistForm] = useState(false);
  const [leaveWaitlistPhone, setLeaveWaitlistPhone] = useState('');
  const [showJoinWaitlistForm, setShowJoinWaitlistForm] = useState(false);
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [waitlistSelectedServiceIds, setWaitlistSelectedServiceIds] = useState<string[]>([]);
  const [waitlistQueueProfessionalId, setWaitlistQueueProfessionalId] = useState<string>(''); // nova: fila por profissional
  const [waitlistQueueCounts, setWaitlistQueueCounts] = useState<Record<string, number>>({});

  // Pagamento antecipado (Pagar.me) no booking público
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number>(0);
  const [pendingCustomerData, setPendingCustomerData] = useState<{ name: string; phone?: string; email?: string; document?: string } | null>(null);
  const [paymentIsOptional, setPaymentIsOptional] = useState(false);
  const [showOptionalPayPrompt, setShowOptionalPayPrompt] = useState(false);

  const bookingFormRef = useRef<HTMLDivElement>(null);
  const retryFetchEstablishmentRef = useRef(0);
  const isReloadingRef = useRef(false); // ✅ Proteção contra reload loops
  const isFetchingApprovedReviewsRef = useRef(false);
  const hasRestoredQuickFlowRef = useRef(false);
  const activeSubscriberPlanId = String(
    convertedSubscriberData?.subscription_id || convertedSubscriberData?.subscriptions?.id || ''
  ).trim();
  const visibleSubscriptions = subscriptions.filter((subscription: any) => !Boolean(subscription?.is_hidden));
  const subscriberServicesForBooking = activeSubscriberPlanId
    ? subscriptions.filter((subscription: any) => String(subscription?.id || '').trim() === activeSubscriberPlanId)
    : subscriptions;

  const getDividedServicesFromSubscription = (subscription: any) => {
    const raw = (subscription as any)?.divided_services;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((service: any) => ({
        id: String(service?.id || '').trim(),
        name: String(service?.name || '').trim(),
        duration: Number(service?.duration || 0),
        limit: Number(service?.limit || 0),
      }))
      .filter((service: any) => service.id && service.name && Number.isFinite(service.duration) && service.duration > 0 && Number.isFinite(service.limit) && service.limit > 0);
  };

  const isDividedServicesEnabled = Boolean((selectedSubscriberService as any)?.divide_services_enabled);
  const dividedServicesForSelectedSubscription = getDividedServicesFromSubscription(selectedSubscriberService);
  const shouldSelectDividedServiceFirst = isDividedServicesEnabled && dividedServicesForSelectedSubscription.length > 0;
  const shouldShowDividedServicesChooser =
    shouldSelectDividedServiceFirst &&
    (!hasConfirmedDividedSubscriberServices || selectedDividedSubscriberServices.length === 0);
  const selectedDividedSubscriberTotalDuration = selectedDividedSubscriberServices.reduce(
    (sum: number, service: any) => sum + (Number(service?.duration || 0) || 0),
    0
  );

  const resetDividedSubscriberSelection = () => {
    setSelectedDividedSubscriberServices([]);
    setHasConfirmedDividedSubscriberServices(false);
  };

  const handleToggleDividedSubscriberService = (serviceRaw: any) => {
    const service = {
      id: String(serviceRaw?.id || '').trim(),
      name: String(serviceRaw?.name || '').trim(),
      duration: Number(serviceRaw?.duration || 0),
      limit: Number(serviceRaw?.limit || 0),
    };
    if (!service.id || !service.name) return;
    setSelectedDividedSubscriberServices((prev) => {
      const exists = prev.some((item: any) => String(item?.id || '').trim() === service.id);
      if (exists) {
        return prev.filter((item: any) => String(item?.id || '').trim() !== service.id);
      }
      return [...prev, service];
    });
    setHasConfirmedDividedSubscriberServices(false);
  };

  const currentSubscriberServiceForBooking = (() => {
    if (!selectedSubscriberService) return null;
    if (!shouldSelectDividedServiceFirst) return selectedSubscriberService;
    if (!hasConfirmedDividedSubscriberServices || selectedDividedSubscriberServices.length === 0) return null;
    const selectedServices = selectedDividedSubscriberServices.map((service: any) => ({
      id: String(service?.id || '').trim(),
      name: String(service?.name || '').trim(),
      duration: Number(service?.duration || 0),
      limit: Number(service?.limit || 0),
    })).filter((service: any) => service.id && service.name);
    if (selectedServices.length === 0) return null;
    if (selectedServices.length === 1) {
      const singleService = selectedServices[0];
      return {
        id: singleService.id,
        name: singleService.name,
        booking_service_name: singleService.name,
        service_duration: Number(singleService.duration || 30),
        duration: Number(singleService.duration || 30),
        weekdays: selectedSubscriberService?.weekdays || [],
        subscription_id: selectedSubscriberService?.id,
        professional_id: selectedSubscriberService?.professional_id || null,
        professional_name: selectedSubscriberService?.professional_name || null,
        service_id: singleService.id,
        service_limit: Number(singleService.limit || 0),
        divided_services_selected: selectedServices,
      };
    }
    const aggregateName = selectedServices.map((service: any) => service.name).join(' + ');
    const totalDuration = selectedServices.reduce(
      (sum: number, service: any) => sum + (Number(service?.duration || 0) || 0),
      0
    );
    return {
      id: String(selectedSubscriberService?.id || '').trim(),
      name: aggregateName,
      booking_service_name: aggregateName,
      service_duration: Number(totalDuration || 30),
      duration: Number(totalDuration || 30),
      weekdays: selectedSubscriberService?.weekdays || [],
      subscription_id: selectedSubscriberService?.id,
      professional_id: selectedSubscriberService?.professional_id || null,
      professional_name: selectedSubscriberService?.professional_name || null,
      // Em seleção múltipla, mantemos por nome (compatível com bancos sem novas colunas).
      service_id: '',
      service_limit: null,
      divided_services_selected: selectedServices,
    };
  })();

  const subscriberExtraServiceCategories = (() => {
    const allServices = Array.isArray((establishment as any)?.services_with_prices)
      ? ((establishment as any)?.services_with_prices as any[])
      : [];

    const allowed = allServices.filter((service: any) => {
      const serviceId = String(service?.id || '').trim();
      const categoryFlag = Boolean(service?.show_for_subscriber_extra);
      return serviceId && categoryFlag;
    });

    const grouped = new Map<string, { id: string; name: string; services: any[] }>();
    allowed.forEach((service: any) => {
      const categoryId = String(service?.category_id || 'legacy-subscriber-extra').trim();
      const categoryName = String(service?.category_name || 'Serviços extras para assinante').trim() || 'Serviços extras para assinante';
      const key = `${categoryId}::${categoryName}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: categoryId,
          name: categoryName,
          services: [],
        });
      }
      grouped.get(key)!.services.push(service);
    });

    return Array.from(grouped.values())
      .map((category) => ({
        ...category,
        services: category.services.sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || ''))),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const subscriberExtraServicesFlat = subscriberExtraServiceCategories.flatMap((category) => category.services);
  const selectedSubscriberExtraServices = subscriberExtraServicesFlat.filter((service: any) =>
    selectedSubscriberExtraServiceIds.includes(String(service?.id || ''))
  );
  const MAX_SUBSCRIBER_EXTRA_SERVICES = 4;
  const subscriberExtraTotalPrice = selectedSubscriberExtraServices.reduce((sum: number, service: any) => sum + (Number(service?.price) || 0), 0);
  const subscriberExtraTotalDuration = selectedSubscriberExtraServices.reduce((sum: number, service: any) => sum + (Number(service?.duration) || 0), 0);

  const handleToggleSubscriberExtraService = (serviceIdRaw: string) => {
    const serviceId = String(serviceIdRaw || '').trim();
    if (!serviceId) return;
    setSelectedSubscriberExtraServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((id) => id !== serviceId);
      }
      if (prev.length >= MAX_SUBSCRIBER_EXTRA_SERVICES) {
        toast.error(`Você pode selecionar no máximo ${MAX_SUBSCRIBER_EXTRA_SERVICES} serviços extras.`);
        return prev;
      }
      return [...prev, serviceId];
    });
  };

  const handleRequestChangeSubscriberService = () => {
    resetDividedSubscriberSelection();
    // UX: voltar para o topo da seção de assinante para o usuário trocar o serviço.
    setTimeout(() => {
      const subscriberSection = document.querySelector('[data-subscriber-booking]');
      if (subscriberSection) {
        subscriberSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 80);
  };

  const scrollToSubscriberProfessionalStep = () => {
    setTimeout(() => {
      const container = document.querySelector('[data-subscriber-appointment-form]') as HTMLElement | null;
      const professionalStep = container?.querySelector('[data-subscriber-professional-step]') as HTMLElement | null;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const containerTop = window.scrollY + containerRect.top;
        const professionalTop = professionalStep
          ? window.scrollY + professionalStep.getBoundingClientRect().top
          : containerTop + 220;
        const gap = Math.max(0, professionalTop - containerTop);
        // Meio-termo: desce um pouco dentro do form, sem pular demais.
        const desiredAdvance = Math.min(150, Math.max(90, gap * 0.45));
        const scrollTop = containerTop + desiredAdvance - 70;
        window.scrollTo({ top: Math.max(scrollTop, 0), behavior: 'smooth' });
      } else {
        window.scrollBy({ top: 240, behavior: 'smooth' });
      }
    }, 80);
  };

  // Persistência leve do fluxo "QUERO AGENDAR" (evita voltar pro início se houver remount/reload no mobile)
  const QUICK_BOOKING_FLOW_KEY = 'agf_quick_booking_flow'; // 'modal' | 'form'
  const QUICK_BOOKING_DATA_KEY = 'agf_quick_booking_data'; // { name, phone }

  const safeSessionGet = (key: string) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const safeSessionSet = (key: string, value: string) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // ignore
    }
  };
  const safeSessionRemove = (key: string) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  };

  // Função para converter agendamento normal para assinante OU de volta para cliente normal
  const handleConvertToSubscriber = (subscriberData: any | false) => {
    if (subscriberData === false) {
      // Converter de volta para cliente normal
      console.log('🔄 Convertendo agendamento para cliente normal');

      // Limpar dados de assinante
      setConvertedSubscriberData(null);
      setSelectedSubscriberService(null);
      resetDividedSubscriberSelection();
      setSelectedSubscriberExtraServiceIds([]);
      setSubscriberDetectionDisabled(true); // ✅ Desabilitar detecção de assinante

      // Fechar formulário de assinante e abrir formulário normal
      setShowSubscriberBooking(false);
      setShowBookingForm(true);

      toast.success('Convertido para agendamento normal! 👤');
      return;
    }

    // Converter para assinante (código original)
    console.log('🔄 Convertendo agendamento para assinante:', subscriberData);

    // Salvar dados do assinante
    setConvertedSubscriberData(subscriberData);

    // Configurar o serviço de assinante - duração vem da RPC (service_duration) ou do join subscriptions
    const planId = subscriberData.subscription_id || subscriberData.subscriptions?.id;
    const matchedSubscription = subscriptions.find((subscription: any) => String(subscription?.id || '') === String(planId || ''));
    const subscriberService = {
      ...(matchedSubscription || {}),
      id: planId,
      name: subscriberData.subscription_name || subscriberData.subscriptions?.name || matchedSubscription?.name,
      service_duration:
        subscriberData.service_duration ??
        subscriberData.subscriptions?.service_duration ??
        matchedSubscription?.service_duration ??
        30,
      weekdays: subscriberData.weekdays || subscriberData.subscriptions?.weekdays || matchedSubscription?.weekdays || [],
      professional_id: String(subscriberData?.subscriber_professional_id || '').trim() || null,
      professional_name: String(subscriberData?.subscriber_professional_name || '').trim() || null,
    };

    console.log('🔧 Serviço de assinante configurado:', subscriberService);
    console.log('🔍 DEBUG - Weekdays do serviço:', subscriberService.weekdays);
    console.log('🔍 DEBUG - Nome do serviço:', subscriberService.name);

    setSelectedSubscriberService(subscriberService);
    resetDividedSubscriberSelection();
    setSelectedSubscriberExtraServiceIds([]);

    // Fechar formulário normal e abrir formulário de assinante
    setShowBookingForm(false);
    setShowSubscriberBooking(true);

    // Scroll para a seção de assinante
    setTimeout(() => {
      const subscriberSection = document.querySelector('[data-subscriber-booking]');
      if (subscriberSection) {
        subscriberSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    toast.success('Convertido para agendamento de assinante! 🎯');
  };

  // Abrir modal de assinatura em modo RENOVAÇÃO (mesmo plano, dados pré-preenchidos; ao pagar atualiza o registro existente)
  const handleOpenRenewSubscription = (detectedSubscriber: any) => {
    const sub = subscriptions.find((s: any) => String(s.id) === String(detectedSubscriber?.subscription_id));
    if (!sub) {
      toast.error('Plano não encontrado. Tente novamente ou entre em contato com o estabelecimento.');
      return;
    }
    setSubscriptionPixInitialFlow('default');
    setSelectedSubscriptionForPix(sub);
    setRenewalPrefill({
      name: String(detectedSubscriber?.display_name || detectedSubscriber?.subscriber_name || '').trim(),
      whatsapp: String(detectedSubscriber?.whatsapp || detectedSubscriber?.subscriber_whatsapp || '').trim(),
    });
    setShowSubscriptionPixModal(true);
  };

  const openRenewLookupForSubscription = (subscription: any) => {
    setRenewLookupSubscription(subscription);
    setRenewLookupPhone('');
    setShowRenewLookupModal(true);
  };

  const buildPhoneCandidates = (rawPhone: string): string[] => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (!digits) return [];
    const candidates = new Set<string>();
    candidates.add(digits);
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      candidates.add(digits.slice(2));
    } else if (digits.length === 10 || digits.length === 11) {
      candidates.add(`55${digits}`);
    }
    return Array.from(candidates).filter(Boolean);
  };

  const findRenewSubscriberByPhone = async () => {
    if (!establishment?.id || !renewLookupSubscription?.id) {
      toast.error('Plano inválido para renovação.');
      return;
    }

    const phoneCandidates = buildPhoneCandidates(renewLookupPhone);
    if (phoneCandidates.length === 0) {
      toast.error('Digite um número de telefone válido.');
      return;
    }

    setIsRenewLookupLoading(true);
    try {
      const safeInList = (arr: string[]) => arr.map((p) => `"${p}"`).join(',');
      let rows: any[] = [];
      let queryError: any = null;

      // Tentativa principal: subscriber_whatsapp (novo padrão)
      {
        const { data, error } = await supabase
          .from('client_subscriptions')
          .select('id, subscription_id, subscriber_name, subscriber_whatsapp, subscriber_email, payment_status, start_date, end_date, created_at')
          .eq('establishment_id', String(establishment.id))
          .eq('subscription_id', String(renewLookupSubscription.id))
          .in('subscriber_whatsapp', phoneCandidates)
          .order('created_at', { ascending: false })
          .limit(5);
        rows = (data as any[]) || [];
        queryError = error;
      }

      // Fallback: client_whatsapp (bases antigas)
      if (rows.length === 0) {
        const { data, error } = await supabase
          .from('client_subscriptions')
          .select('id, subscription_id, subscriber_name, subscriber_whatsapp, subscriber_email, payment_status, start_date, end_date, created_at, client_whatsapp')
          .eq('establishment_id', String(establishment.id))
          .eq('subscription_id', String(renewLookupSubscription.id))
          .in('client_whatsapp', phoneCandidates)
          .order('created_at', { ascending: false })
          .limit(5);
        if (!queryError) queryError = error;
        if ((data as any[])?.length) {
          rows = (data as any[]) || [];
        }
      }

      if (queryError && rows.length === 0) {
        const details = [
          (queryError as any)?.message,
          (queryError as any)?.code,
          (queryError as any)?.details,
          (queryError as any)?.hint,
        ].filter(Boolean).join(' | ');
        throw new Error(details || 'Erro ao localizar assinante para renovação.');
      }

      const found = rows[0];
      if (!found) {
        toast.error('Não encontramos assinante desse plano com esse número.');
        return;
      }

      setSubscriptionPixInitialFlow('default');
      setSelectedSubscriptionForPix(renewLookupSubscription);
      setRenewalPrefill({
        name: String(found?.subscriber_name || '').trim(),
        whatsapp: String(found?.subscriber_whatsapp || found?.client_whatsapp || '').trim(),
      });
      setShowRenewLookupModal(false);
      setRenewLookupSubscription(null);
      setRenewLookupPhone('');
      setShowSubscriptionPixModal(true);
      toast.success('Assinante encontrado! Finalize a renovação.');
    } catch (error: any) {
      console.error('❌ Erro ao localizar assinante para renovação:', error);
      toast.error(error?.message || 'Erro ao localizar assinante para renovação.');
    } finally {
      setIsRenewLookupLoading(false);
    }
  };

  const pulseKeyframes = `
    @keyframes pulse-scale {
      0% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0.7); // Amarelo
      }

      70% {
        transform: scale(1.03); // Levemente mais sutil
        box-shadow: 0 0 0 10px rgba(255, 204, 0, 0);
      }

      100% {
        transform: scale(1);
        box-shadow: 0 0 0 0 rgba(255, 204, 0, 0);
      }
    }

    /* Batimento (não pisca): escala + glow suave */
    @keyframes agf-heartbeat {
      0%   { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
      18%  { transform: scale(1.045); box-shadow: 0 18px 46px rgba(0,0,0,0.72), 0 0 18px rgba(230,199,139,0.25); }
      35%  { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
      52%  { transform: scale(1.03); box-shadow: 0 18px 44px rgba(0,0,0,0.70), 0 0 14px rgba(230,199,139,0.18); }
      70%  { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
      100% { transform: scale(1);    box-shadow: 0 16px 40px rgba(0,0,0,0.65), 0 0 0 rgba(230,199,139,0.0); }
    }

    .agf-heartbeat-cta {
      animation: agf-heartbeat 1.9s ease-in-out infinite;
      will-change: transform, box-shadow;
    }
  `;

  useEffect(() => {
    // Adiciona os keyframes ao head do documento
    const styleSheet = document.createElement("style");
    styleSheet.textContent = pulseKeyframes;
    document.head.appendChild(styleSheet);

    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  // ✅ SOLUÇÃO DEFINITIVA: Limpar cache e Service Worker ao entrar no booking
  useEffect(() => {
    // Limpar Service Workers existentes (especialmente em mobile)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          console.log('🗑️ Removendo Service Worker no booking:', registration.scope);
          registration.unregister().catch(() => { });
        });
      });
    }

    // Limpar caches do navegador
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('agendafacil') || cacheName.includes('booking')) {
            console.log('🗑️ Limpando cache:', cacheName);
            caches.delete(cacheName).catch(() => { });
          }
        });
      });
    }

    // Forçar busca sem cache
    fetchEstablishment();
  }, [id]);

  // ✅ Recuperar fluxo do "quero agendar" se a página remountar (piscadas/reloads em mobile)
  // Regra de compatibilidade:
  // - se chat estiver ativo, não reabrimos automaticamente no refresh para evitar travar usuário em etapa antiga
  // - se chat estiver desativado (fluxo legado), mantém recuperação antiga
  useEffect(() => {
    if (!establishment || hasRestoredQuickFlowRef.current) return;
    hasRestoredQuickFlowRef.current = true;

    const chatEnabled = Boolean((establishment as any)?.booking_chat_enabled ?? true);
    const flow = safeSessionGet(QUICK_BOOKING_FLOW_KEY);
    if (flow === 'modal') {
      if (chatEnabled) {
        safeSessionRemove(QUICK_BOOKING_FLOW_KEY);
        safeSessionRemove(QUICK_BOOKING_DATA_KEY);
        return;
      }
      setShowQuickBookingModal(true);
      return;
    }
    if (flow === 'form') {
      const raw = safeSessionGet(QUICK_BOOKING_DATA_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.name && parsed?.phone) {
            setGuestClientData({ name: String(parsed.name), phone: String(parsed.phone) });
          }
        } catch {
          // ignore
        }
      }
      if (chatEnabled) {
        safeSessionRemove(QUICK_BOOKING_FLOW_KEY);
        safeSessionRemove(QUICK_BOOKING_DATA_KEY);
        return;
      }
      setUseLegacyBookingFlow(true);
      setShowBookingForm(true);
    }
  }, [establishment]);

  // ✅ Retry controlado: evita setTimeout/fetch durante render (isso causa flicker e resets em celular)
  useEffect(() => {
    if (isLoading) return;
    if (establishment) return;
    if (!id) return;

    if (retryFetchEstablishmentRef.current >= 2) return;
    retryFetchEstablishmentRef.current += 1;
    console.log('🔄 Retry controlado: tentando buscar estabelecimento novamente...', retryFetchEstablishmentRef.current);

    const t = setTimeout(() => {
      fetchEstablishment();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, establishment, id]);

  useEffect(() => {
    if (establishment) {
      fetchExistingAppointments();
      fetchSubscriptions();
    }
  }, [establishment, selectedDate]);

  useEffect(() => {
    if (!establishment?.id) return;
    if (establishment?.hide_booking_reviews) {
      setApprovedReviews([]);
      return;
    }
    fetchApprovedReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establishment?.id, establishment?.hide_booking_reviews]);

  // Atualizar último acesso do cliente quando logado
  useEffect(() => {
    const updateLastAccess = async () => {
      if (user && user.phone) {
        try {
          console.log('🕐 Atualizando último acesso para cliente logado:', user.phone);
          await updateClientLastAccess(user.phone);
        } catch (error) {
          console.error('❌ Erro ao atualizar último acesso:', error);
        }
      }
    };

    updateLastAccess();
  }, [user]);

  // Efeito para rolar até o formulário quando ele se torna visível
  useEffect(() => {
    if (showBookingForm && bookingFormRef.current) {
      bookingFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showBookingForm]);

  useEffect(() => {
    const loadBookingHighlightedProducts = async () => {
      const establishmentId = String((establishment as any)?.id || '').trim();
      if (!establishmentId) {
        setBookingHighlightedProducts([]);
        return;
      }

      try {
        const modern = await supabase
          .from('establishment_products')
          .select('id,name,sale_price,stock_quantity,image_url,highlight_for_client_booking')
          .eq('establishment_id', establishmentId)
          .eq('highlight_for_client_booking', true)
          .gt('stock_quantity', 0)
          .order('created_at', { ascending: false });

        if (modern.error) {
          const msg = String(modern.error?.message || '').toLowerCase();
          const missingHighlightColumn = msg.includes('highlight_for_client_booking') || (msg.includes('column') && msg.includes('exist'));
          const missingImageColumn = msg.includes('image_url') || (msg.includes('column') && msg.includes('exist'));
          if (missingImageColumn && !missingHighlightColumn) {
            const fallback = await supabase
              .from('establishment_products')
              .select('id,name,sale_price,stock_quantity,highlight_for_client_booking')
              .eq('establishment_id', establishmentId)
              .eq('highlight_for_client_booking', true)
              .gt('stock_quantity', 0)
              .order('created_at', { ascending: false });

            if (fallback.error) {
              console.warn('Erro ao buscar produtos destacados do booking:', fallback.error);
              setBookingHighlightedProducts([]);
              return;
            }

            const normalizedFallback = ((fallback.data as any[]) || []).map((item) => ({
              ...item,
              image_url: null,
            }));
            setBookingHighlightedProducts(normalizedFallback);
            return;
          }

          if (!missingHighlightColumn) {
            console.warn('Erro ao buscar produtos destacados do booking:', modern.error);
          }
          setBookingHighlightedProducts([]);
          return;
        }

        setBookingHighlightedProducts((modern.data as any[]) || []);
      } catch (error) {
        console.warn('Erro ao carregar produtos destacados para booking:', error);
        setBookingHighlightedProducts([]);
      }
    };

    loadBookingHighlightedProducts();
  }, [establishment?.id, forceRender]);

  // Efeito para fechar o dropdown quando clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.subscriptions-dropdown')) {
        setShowSubscriptionsDropdown(false);
      }
    };

    if (showSubscriptionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSubscriptionsDropdown]);

  // Debug: Monitorar mudanças no estado establishment
  useEffect(() => {
    console.log('🔄 ESTADO ESTABLISHMENT MUDOU:', establishment);
    if (establishment) {
      console.log('✅ Establishment definido:', establishment.name);
    } else {
      console.log('❌ Establishment é null/undefined');
    }
  }, [establishment]);

  // Debug: Monitorar mudanças no estado subscriptions
  useEffect(() => {
    console.log('👑 ESTADO SUBSCRIPTIONS MUDOU:', subscriptions);
    console.log('📊 Total de assinaturas:', subscriptions.length);
    console.log('🔽 Dropdown deve aparecer?', subscriptions.length > 0);
  }, [subscriptions]);

  // Se o estabelecimento optar por mostrar assinaturas por completo, garantir que o dropdown não fique aberto
  useEffect(() => {
    if (!establishment?.id) return;
    let showFull = false;
    try {
      showFull = Boolean((establishment as any)?.show_subscriptions_fullpage === true) ||
        localStorage.getItem(`show_subscriptions_fullpage_${establishment.id}`) === 'true';
    } catch {
      showFull = Boolean((establishment as any)?.show_subscriptions_fullpage === true);
    }
    if (showFull) {
      setShowSubscriptionsDropdown(false);
    }
  }, [establishment?.id, (establishment as any)?.show_subscriptions_fullpage]);

  // Buscar nome da outra unidade (pelo código) para exibir "Nome" + "Descrição" no link
  useEffect(() => {
    const code = String((establishment as any)?.second_unit_booking_code || '').trim();
    if (!code) {
      setSecondUnitName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('establishments').select('name').eq('code', code).maybeSingle();
      if (!cancelled && data?.name) setSecondUnitName(data.name);
      else if (!cancelled) setSecondUnitName(null);
    })();
    return () => { cancelled = true; };
  }, [(establishment as any)?.second_unit_booking_code]);

  const fetchEstablishment = async () => {
    if (!id) {
      console.log('❌ Nenhum código fornecido na URL');
      setIsLoading(false);
      return;
    }

    try {
      console.log('🔍 Buscando estabelecimento com código:', id);
      console.log('🔗 URL do Supabase:', import.meta.env.VITE_SUPABASE_URL || 'NÃO DEFINIDA');
      console.log('🔑 Chave do Supabase:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA');

      // Primeiro, vamos verificar se há estabelecimentos no banco
      console.log('📊 Verificando estabelecimentos disponíveis...');
      const { data: allEstablishments, error: countError } = await supabase
        .from('establishments')
        .select('code, name')
        .limit(10);

      if (countError) {
        console.error('❌ Erro ao verificar estabelecimentos:', countError);
        console.error('❌ Detalhes do erro:', JSON.stringify(countError, null, 2));
      } else {
        console.log('📊 Estabelecimentos disponíveis:', allEstablishments?.map(e => `${e.code} - ${e.name}`) || []);
        console.log('📊 Total encontrados:', allEstablishments?.length || 0);
      }

      console.log('🎯 Buscando especificamente pelo código:', id);
      // ✅ FORÇAR busca sem cache (evita dados antigos)
      const baseSelect = `
            *,
            pix_payment_link,
            review_link,
            social_media_link,
            pix_key,
            whatsapp,
            limit_client_pending_booking,
            custom_photo_4_url,
            custom_photo_5_url,
            custom_photo_6_url,
            custom_photo_7_url,
            carousel_position,
            use_pagarme_subscription_pix,
            pagarme_recipient_id,
            mercadopago_access_token,
            use_mercadopago_subscription_pix
          `;

      // ⚠️ Compatibilidade: se a coluna nova ainda não existir no banco, refaz sem quebrar o booking
      const selectWithFullpage = `${baseSelect}, show_subscriptions_fullpage`;

      let data: any = null;
      let error: any = null;

      {
        const res = await supabase
          .from('establishments')
          .select(selectWithFullpage)
          .eq('code', id)
          .single();
        data = res.data;
        error = res.error;
      }

      if (error && (error.code === '42703' || String(error.message || '').includes('show_subscriptions_fullpage'))) {
        console.warn('⚠️ Coluna show_subscriptions_fullpage não existe ainda. Rebuscando sem ela.');
        const res2 = await supabase
          .from('establishments')
          .select(baseSelect)
          .eq('code', id)
          .single();
        data = res2.data;
        error = res2.error;
      }

      // ✅ Adicionar timestamp para evitar cache do navegador
      const fetchTimestamp = Date.now();
      console.log('⏰ Timestamp da busca:', fetchTimestamp);

      if (error) {
        console.error('❌ Erro ao buscar estabelecimento:', error);
        console.error('❌ Código do erro:', error.code);
        console.error('❌ Mensagem do erro:', error.message);
        console.error('❌ Detalhes completos:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data) {
        console.log('❌ Nenhum estabelecimento encontrado com código:', id);
        throw new Error(`Estabelecimento com código "${id}" não encontrado`);
      }

      // Verificar se o booking está bloqueado
      if (data.booking_blocked) {
        console.log('🚫 Booking bloqueado para este estabelecimento');
        // ✅ Mesmo bloqueado, manter o estabelecimento carregado para permitir ações (ex.: botão para mandar mensagem)
        setEstablishment(data);
        setIsBookingBlocked(true);
        setIsLoading(false);
        return;
      }

      // ✅ Preferir serviços do sistema novo (categorias/subcategorias).
      // Importante: buscar direto via join (!inner) para não depender de listar categorias antes.
      let servicesFromCategories: any[] = [];
      const parseExcludedProfessionalIds = (raw: any): string[] => {
        if (!Array.isArray(raw)) return [];
        return raw
          .map((id: any) => String(id || '').trim())
          .filter(Boolean);
      };
      try {
        const { data: subs, error: subErr } = await supabase
          .from('service_subcategories')
          .select(`*, service_categories!inner(*)`)
          .eq('is_active', true)
          .eq('service_categories.is_active', true)
          .eq('service_categories.establishment_id', data.id)
          .order('service_categories(display_order)', { ascending: true })
          .order('display_order', { ascending: true });

        if (subErr) {
          console.warn('⚠️ BookingPage - erro ao buscar serviços por categorias (subcategorias):', subErr);
        } else {
          const isHidden = (o: any) => Boolean(o?.hidden_from_booking ?? o?.oculto_da_reserva);
          const isActive = (o: any) => o?.is_active !== false;
          const establishmentIdNorm = String(data?.id || '').trim();
          const visible = (subs || []).filter((s: any) => {
            const cat = (s as any)?.service_categories;
            const categoryEstablishmentIdNorm = String((cat as any)?.establishment_id || '').trim();
            const matchesEstablishment = establishmentIdNorm.length > 0 && categoryEstablishmentIdNorm === establishmentIdNorm;
            return (
              matchesEstablishment &&
              isActive(s) &&
              isActive(cat) &&
              !isHidden(s) &&
              !isHidden(cat)
            );
          });

          servicesFromCategories = visible
            .filter((s: any) => s?.id && s?.name)
            .map((s: any) => ({
              id: s.id,
              name: s.name,
              price: Number(s.price || 0),
              duration: Number(s.duration || 30),
              image_url: String((s as any)?.image_url || '').trim() || null,
              loyalty_points: Math.max(0, Math.floor(Number(s.loyalty_points ?? 0))),
              category_id: String((s as any)?.category_id || '').trim() || null,
              category_name: String((s as any)?.service_categories?.name || '').trim() || null,
              show_for_subscriber_extra: Boolean((s as any)?.service_categories?.show_for_subscriber_extra),
              excluded_professional_ids: parseExcludedProfessionalIds((s as any)?.excluded_professional_ids),
            }));
        }
      } catch (e) {
        console.warn('⚠️ BookingPage - erro inesperado ao buscar serviços por categorias:', e);
      }

      const usingCategories = servicesFromCategories.length > 0;
      const resolvedServices = usingCategories
        ? servicesFromCategories
        : (data as any)?.services_with_prices || [];

      console.log('🧩 BOOKING SERVICES SOURCE:', {
        establishmentId: data.id,
        usingCategories,
        categoriesCount: servicesFromCategories.length,
        legacyCount: Array.isArray((data as any)?.services_with_prices) ? (data as any).services_with_prices.length : 0,
        sample: resolvedServices.slice(0, 10).map((s: any) => ({ id: s?.id, name: s?.name })),
      });

      const resolvedEstablishment = {
        ...data,
        legacy_services_with_prices: Array.isArray((data as any)?.services_with_prices)
          ? (data as any).services_with_prices
          : [],
        services_with_prices: resolvedServices,
      };

      console.log('✅ Estabelecimento encontrado:', resolvedEstablishment);
      setEstablishment(resolvedEstablishment);
      setIsBookingBlocked(false);

    } catch (error: any) {
      console.error('❌ Error fetching establishment:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      toast.error(`Estabelecimento com código "${id}" não encontrado`);
    } finally {
      console.log('🏁 Finalizando busca, setIsLoading(false)');
      setIsLoading(false);
    }
  };

  // Capturar o beforeinstallprompt para instalação PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const isPWA = () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSPWA = (window.navigator as any).standalone === true;
    return isStandalone || isIOSPWA;
  };

  const handleDownloadApp = async () => {
    if (deferredPrompt) {
      try {
        // @ts-ignore
        await deferredPrompt.prompt();
        // @ts-ignore
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          return;
        }
      } catch { }
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIOS) {
      setInstallGuideTitle('Como instalar no iPhone');
      setInstallGuideSteps([
        'Toque no botão Compartilhar (□↑)',
        'Escolha "Adicionar à Tela Inicial"',
        'Toque em "Adicionar" para confirmar'
      ]);
    } else if (isAndroid) {
      setInstallGuideTitle('Como instalar no Android');
      setInstallGuideSteps([
        'Toque nos 3 pontos (⋮) do navegador',
        'Selecione "Adicionar à tela inicial"',
        'Confirme tocando em "Adicionar"'
      ]);
    } else {
      setInstallGuideTitle('Como instalar no seu navegador');
      setInstallGuideSteps([
        'Clique nos 3 pontos (⋮) no canto do navegador',
        'Clique em "Instalar Agendei Fácil"',
        'Depois clique em "Instalar" para confirmar'
      ]);
    }
    setShowInstallGuide(true);
  };

  const fetchExistingAppointments = async () => {
    if (!establishment) return;

    try {
      // ✅ Reconciliar com Mercado Pago antes de cancelar pendências (reduz falso positivo)
      await fireMercadoPagoPendingReconcile(establishment.id);

      // ✅ LIMPEZA AUTOMÁTICA: liberar horários presos por pagamento pendente antigo
      // Contexto real: em pagamentos antecipados, criamos um agendamento `pending_payment` para "segurar" a vaga.
      // Se o cliente abandona a tela, esse registro pode ficar preso e travar o horário (inclusive com transaction_id).
      // Estratégia:
      // - Sem transaction_id: cancelar mais rápido (ex.: o cliente nem iniciou o pagamento)
      // - Com transaction_id: dar mais tempo (webhook/polling), mas cancelar se ficar velho demais
      // Obs: a liberação de horário é mais importante que manter pendências antigas indefinidamente.

      const thresholdNoTxMinutes = PENDING_PAYMENT_NO_TX_MINUTES;
      const thresholdWithTxMinutes = PENDING_PAYMENT_WITH_TX_MINUTES;
      const thresholdNoTxDate = new Date(Date.now() - thresholdNoTxMinutes * 60 * 1000).toISOString();
      const thresholdWithTxDate = new Date(Date.now() - thresholdWithTxMinutes * 60 * 1000).toISOString();

      // 1) Pendências sem transaction_id (mais antigas): cancelar
      {
        const payload: Record<string, unknown> = {
          status: 'cancelled',
          payment_status: 'failed',
          cancellation_source: CANCELLATION_SOURCE.SYSTEM_ABANDONED_CHECKOUT,
          cancellation_detail: buildStalePaymentDetail('no_tx'),
        };
        const rNoTx = await supabase
          .from('appointments')
          .update(payload as any)
          .eq('establishment_id', establishment.id)
          .eq('status', 'pending_payment')
          .is('payment_transaction_id', null)
          .lt('created_at', thresholdNoTxDate);
        if (rNoTx.error && String((rNoTx.error as any).code || '') === '42703') {
          await supabase
            .from('appointments')
            .update({ status: 'cancelled', payment_status: 'failed' })
            .eq('establishment_id', establishment.id)
            .eq('status', 'pending_payment')
            .is('payment_transaction_id', null)
            .lt('created_at', thresholdNoTxDate);
        }
      }

      // 2) Pendências com transaction_id (muito antigas) e sem confirmação de pagamento: cancelar
      const { data: staleWithTx, error: staleWithTxError } = await supabase
        .from('appointments')
        .select('id,payment_status,pix_payment_status')
        .eq('establishment_id', establishment.id)
        .eq('status', 'pending_payment')
        .not('payment_transaction_id', 'is', null)
        .lt('created_at', thresholdWithTxDate);

      if (!staleWithTxError && Array.isArray(staleWithTx) && staleWithTx.length > 0) {
        const idsToCancel = staleWithTx
          .filter((row: any) => {
            const paymentStatus = String(row?.payment_status || '').toLowerCase();
            const pixStatus = String(row?.pix_payment_status || '').toLowerCase();
            const isPaid = paymentStatus === 'paid';
            const isPixConfirmed = pixStatus === 'confirmado' || pixStatus === 'aprovado';
            return !isPaid && !isPixConfirmed;
          })
          .map((row: any) => row.id)
          .filter(Boolean);

        if (idsToCancel.length > 0) {
          await updateAppointmentCancelledWithSource(supabase, { ids: idsToCancel }, {
            cancellation_source: CANCELLATION_SOURCE.SYSTEM_PAYMENT_TIMEOUT,
            cancellation_detail: buildStalePaymentDetail('with_tx'),
            payment_status: 'failed',
          });
        }
      }

      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

      const preferredSelect =
        'id,appointment_date,appointment_time,duration,additional_products,status,is_avulso,professional,payment_status,pix_payment_status';
      const legacySafeSelect =
        'id,appointment_date,appointment_time,duration,status,is_avulso,professional';

      let data: any[] = [];
      let usedSchemaFallback = false;

      const { data: preferredData, error: preferredError } = await supabase
        .from('appointments')
        .select(preferredSelect)
        .eq('establishment_id', establishment.id)
        .eq('appointment_date', selectedDateStr)
        .neq('status', 'cancelled');

      if (preferredError) {
        const isMissingColumnError =
          preferredError.code === '42703' ||
          String(preferredError.message || '').toLowerCase().includes('does not exist');

        if (!isMissingColumnError) throw preferredError;

        usedSchemaFallback = true;
        console.warn('⚠️ BookingPage: fallback de schema ativado para appointments (42703).');

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('appointments')
          .select(legacySafeSelect)
          .eq('establishment_id', establishment.id)
          .eq('appointment_date', selectedDateStr)
          .neq('status', 'cancelled');

        if (fallbackError) throw fallbackError;
        data = fallbackData || [];
      } else {
        data = preferredData || [];
      }

      console.log('📅 Agendamentos existentes carregados (booking):', {
        establishmentId: establishment.id,
        selectedDate: selectedDateStr,
        usedSchemaFallback,
        total: (data || []).length
      });
      setExistingAppointments(data || []);
    } catch (error: any) {
      console.error('Error fetching existing appointments:', error);
    }
  };

  const fetchApprovedReviews = async () => {
    if (!establishment?.id) return;
    if (isFetchingApprovedReviewsRef.current) return;
    isFetchingApprovedReviewsRef.current = true;
    setIsLoadingApprovedReviews(true);
    try {
      const { data, error } = await supabase
        .from('establishment_reviews')
        .select('id,client_name,review_text,created_at')
        .eq('establishment_id', establishment.id)
        .eq('is_approved', true)
        .eq('moderation_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        const msg = String(error?.message || '').toLowerCase();
        const tableMissing =
          error?.code === '42P01' ||
          (msg.includes('establishment_reviews') &&
            (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')));
        if (tableMissing) {
          setApprovedReviews([]);
          return;
        }
        throw error;
      }

      setApprovedReviews((data as PublicBookingReview[]) || []);
    } catch (error) {
      console.error('Erro ao buscar avaliações aprovadas:', error);
      setApprovedReviews([]);
    } finally {
      isFetchingApprovedReviewsRef.current = false;
      setIsLoadingApprovedReviews(false);
    }
  };

  const handleSubmitBookingReview = async () => {
    if (!establishment?.id) return;

    const cleanedName = String(reviewClientName || '').trim();
    const cleanedPhone = String(reviewClientPhone || '').replace(/\D/g, '');
    const cleanedText = String(reviewText || '').trim();

    if (!cleanedName) {
      toast.error('Informe seu nome para enviar a avaliação.');
      return;
    }
    if (cleanedPhone.length < 10) {
      toast.error('Informe um telefone válido com DDD.');
      return;
    }
    if (!cleanedText) {
      toast.error('Escreva sua avaliação.');
      return;
    }
    if (cleanedText.length > 200) {
      toast.error('A avaliação deve ter no máximo 200 caracteres.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('establishment_reviews')
        .insert({
          establishment_id: establishment.id,
          client_name: cleanedName,
          client_phone: cleanedPhone,
          review_text: cleanedText,
          moderation_status: 'pending',
          is_approved: false,
        });

      if (error) throw error;

      setShowCreateReviewModal(false);
      setShowReviewSubmittedModal(true);
      setReviewClientName('');
      setReviewClientPhone('');
      setReviewText('');
      toast.success('Avaliação enviada! Ela ficará visível após aprovação.');
    } catch (error: any) {
      const msg = String(error?.message || '').toLowerCase();
      const tableMissing =
        error?.code === '42P01' ||
        (msg.includes('establishment_reviews') &&
          (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache')));

      if (tableMissing) {
        toast.error('Avaliações ainda estão sendo ativadas neste estabelecimento. Tente novamente em instantes.');
        return;
      }

      console.error('Erro ao enviar avaliação:', error);
      toast.error(
        [error?.message || 'Erro ao enviar avaliação', error?.code ? `(código: ${error.code})` : null, error?.details || error?.hint || null]
          .filter(Boolean)
          .join(' ')
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // ✅ Não cancelar no unload/visibility.
  // Em mobile, alternar para app do banco pode disparar hidden/pagehide e causar falso-cancelamento.
  // A limpeza de pendências antigas já trata vagas presas com segurança.
  useEffect(() => {
    if (!showPaymentModal) return;
    if (!pendingAppointmentId) return;
    if (paymentIsOptional) return;

    return () => {
      // noop intencional
    };
  }, [showPaymentModal, pendingAppointmentId, paymentIsOptional]);

  useEffect(() => {
    if (!showSubscriberBooking) return;
    if (!activeSubscriberPlanId) return;
    if (!selectedSubscriberService) return;
    if (String(selectedSubscriberService?.id || '').trim() === activeSubscriberPlanId) return;
    setSelectedSubscriberService(null);
    resetDividedSubscriberSelection();
    setSelectedSubscriberExtraServiceIds([]);
  }, [activeSubscriberPlanId, selectedSubscriberService, showSubscriberBooking]);

  const fetchSubscriptions = async () => {
    if (!establishment) {
      console.log('❌ Establishment não encontrado para buscar assinaturas');
      return;
    }

    console.log('🔍 Buscando assinaturas para establishment:', establishment.id);

    try {
      const { data: subscriptionsData, error } = await getSubscriptions(establishment.id);
      console.log('📋 Assinaturas encontradas:', subscriptionsData);
      console.log('❌ Erro (se houver):', error);

      if (error) {
        console.error('❌ Erro ao buscar assinaturas:', error);
        setSubscriptions([]);
        return;
      }

      if (subscriptionsData && Array.isArray(subscriptionsData)) {
        const visibleCount = subscriptionsData.filter((sub: any) => !sub?.is_hidden).length;

        console.log('📋 Total de assinaturas:', subscriptionsData.length);
        console.log('👁️ Assinaturas ocultas:', subscriptionsData.filter(sub => sub.is_hidden).length);
        console.log('✅ Assinaturas visíveis:', visibleCount);

        // Mantém todas as assinaturas em memória para reconhecer plano oculto de cliente já assinante.
        setSubscriptions(subscriptionsData);
        console.log('✅ Assinaturas carregadas no Booking:', subscriptionsData.length, 'planos (incluindo ocultos)');
      } else {
        setSubscriptions([]);
        console.log('⚠️ Nenhuma assinatura encontrada ou dados inválidos');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar assinaturas:', error);
      setSubscriptions([]);
    }
  };

  const isSubscriptionPixEnabled = (subscription: any): boolean =>
    Boolean(subscription?.payment_pix_enabled ?? true);

  const isSubscriptionCardEnabled = (subscription: any): boolean =>
    Boolean(subscription?.payment_card_enabled ?? true);

  const handleSubscribeClick = (subscriptionInput: any) => {
    const selectedId = String(subscriptionInput?.id || '').trim();
    const selectedName = String(subscriptionInput?.name || '').trim();
    const subscription =
      subscriptions.find((sub: any) => String(sub?.id || '').trim() === selectedId) ||
      subscriptions.find((sub: any) => String(sub?.name || '').trim() === selectedName);
    const hasCustomLink = Boolean(subscription && String(subscription.custom_link || '').trim());
    let showSubscriptionsFullpageEnabled = false;
    try {
      showSubscriptionsFullpageEnabled =
        Boolean((establishment as any)?.show_subscriptions_fullpage === true) ||
        localStorage.getItem(`show_subscriptions_fullpage_${String(establishment?.id || '')}`) === 'true';
    } catch {
      showSubscriptionsFullpageEnabled = Boolean((establishment as any)?.show_subscriptions_fullpage === true);
    }
    const shouldPreferCustomLink = !showSubscriptionsFullpageEnabled;

    // Verificar Pagar.me: SEMPRE priorizar valor do banco de dados
    // Se estiver false no banco, NÃO usar Pagar.me mesmo que localStorage diga true
    const pagarmeRecipientId = String((establishment as any)?.pagarme_recipient_id || '').trim();
    const isPagarmeSubscriptionPixEnabled =
      Boolean((establishment as any)?.use_pagarme_subscription_pix === true) && Boolean(pagarmeRecipientId);

    // Verificar Mercado Pago: SEMPRE priorizar valor do banco de dados
    // ✅ Usar try-catch para evitar erro se coluna não existir ainda
    let isMercadoPagoSubscriptionPixEnabled = false;
    try {
      isMercadoPagoSubscriptionPixEnabled = Boolean((establishment as any)?.use_mercadopago_subscription_pix === true);
    } catch {
      // Coluna ainda não existe no banco, usar false
      isMercadoPagoSubscriptionPixEnabled = false;
    }
    const hasMercadoPagoAccessToken = !!String((establishment as any)?.mercadopago_access_token || '').trim();

    const pixEnabledForThisSubscription = isSubscriptionPixEnabled(subscription);

    // Regra solicitada:
    // Se "Mostrar assinaturas toda na pagina" estiver DESATIVADO, priorizar o link personalizado (custom_link)
    // nesta ocasião específica.
    if (shouldPreferCustomLink && pixEnabledForThisSubscription && hasCustomLink) {
      setSubscriptionPixInitialFlow('default');
      setSelectedSubscriptionForPix(subscription);
      setShowSubscriptionPixModal(true);
      setShowSubscriptionsDropdown(false);
      return;
    }

    // Se Mercado Pago estiver ativado e conectado, usar Mercado Pago
    if (pixEnabledForThisSubscription && isMercadoPagoSubscriptionPixEnabled && hasMercadoPagoAccessToken) {
      if (!subscription) {
        toast.error('Assinatura não encontrada');
        return;
      }
      // Abrir modal de pagamento Mercado Pago
      setSubscriptionPixInitialFlow('default');
      setSelectedSubscriptionForPix(subscription);
      setShowSubscriptionPixModal(true);
      setShowSubscriptionsDropdown(false);
      return;
    }

    // Se Pagar.me PIX estiver ativado, abrir modal de pagamento (sem cobrança automática)
    if (pixEnabledForThisSubscription && isPagarmeSubscriptionPixEnabled) {
      if (!subscription) {
        toast.error('Assinatura não encontrada');
        return;
      }
      setSubscriptionPixInitialFlow('default');
      setSelectedSubscriptionForPix(subscription);
      setShowSubscriptionPixModal(true);
      setShowSubscriptionsDropdown(false);
      return;
    }

    // Se tiver link personalizado, redirecionar para ele
    if (pixEnabledForThisSubscription && subscription && subscription.custom_link && subscription.custom_link.trim()) {
      // ✅ NOVO: manter o mesmo fluxo do modal (cadastro + confirmação), mas no final redirecionar para o link
      setSubscriptionPixInitialFlow('default');
      setSelectedSubscriptionForPix(subscription);
      setShowSubscriptionPixModal(true);
      setShowSubscriptionsDropdown(false);
      return;
    }

    // ✅ Fallback novo (sem PIX/sem link): abrir modal para coletar dados e ENVIAR pedido no WhatsApp
    if (!subscription) {
      toast.error('Assinatura não encontrada');
      return;
    }
    setSubscriptionPixInitialFlow('whatsapp');
    setSelectedSubscriptionForPix(subscription);
    setShowSubscriptionPixModal(true);
    setShowSubscriptionsDropdown(false);
  };

  const handleSaberMaisClick = () => {
    if (!establishment?.whatsapp) {
      toast.error('WhatsApp não configurado para este estabelecimento');
      return;
    }

    const message = 'Quero informações sobre Assinantes.';
    let phoneNumber = establishment.whatsapp.replace(/\D/g, '');

    // Adicionar código do país se não tiver
    if (!phoneNumber.startsWith('55')) {
      phoneNumber = '55' + phoneNumber;
    }

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
    setShowSubscriptionsDropdown(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error(error.message || 'Erro ao sair');
    }
  };

  const handleSubmit = async (appointmentData: any) => {
    if (id === '3814' || id === '3315') {
      // Lógica para agendamento demonstrativo
      toast.success('Atenção! Este foi um agendamento demonstrativo, parabéns! Clique abaixo e volte ao menu iniciar.', {
        duration: 6000 // Aumenta a duração para a mensagem completa
      });
      setShowBookingForm(false); // Esconder formulário após agendamento demonstrativo
      setShowDemoSuccessModal(true); // Exibir modal de sucesso de demonstração

      // REDIRECIONAMENTO ESPECÍFICO: APENAS para /booking/3814
      if (id === '3814') {
        // Aguardar um pouco para o usuário ver a mensagem de sucesso
        setTimeout(() => {
          navigate('/conhecer');
        }, 2000); // 2 segundos de delay
      }

      return; // Sair da função para não salvar no banco
    }

    if (!establishment) return;

    // Regra global de seguranca: booking nunca pode salvar data passada
    // (cobre fluxo legado + chat, mesmo se o cliente burlar UI).
    const targetDateRaw = String(appointmentData?.appointment_date || format(selectedDate, 'yyyy-MM-dd')).slice(0, 10);
    const [targetYear, targetMonth, targetDay] = targetDateRaw.split('-').map(Number);
    const targetDate = new Date(targetYear || 0, (targetMonth || 1) - 1, targetDay || 1);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isValidTargetDate =
      Number.isFinite(targetYear) &&
      Number.isFinite(targetMonth) &&
      Number.isFinite(targetDay) &&
      targetYear > 1900 &&
      targetMonth >= 1 &&
      targetMonth <= 12 &&
      targetDay >= 1 &&
      targetDay <= 31;

    if (!isValidTargetDate) {
      toast.error('Data de agendamento invalida. Selecione novamente a data e o horario.');
      return;
    }

    if (targetDate.getTime() < today.getTime()) {
      toast.error('Nao e permitido agendar data passada. Escolha hoje ou uma data futura.');
      return;
    }

    // Se não tem user, mas tem guestClientData, criar/fazer login automaticamente
    let currentUser = user;
    if (!currentUser && guestClientData) {
      console.log('🔍 Criando/fazendo login para cliente convidado...');
      const { user: newUser, error: createError } = await createGuestClientAndLogin(
        guestClientData.name,
        guestClientData.phone
      );

      if (createError) {
        toast.error('Erro ao criar conta: ' + createError.message);
        return;
      }

      currentUser = newUser;
      console.log('✅ Cliente convidado criado/autenticado:', newUser?.id);
    }

    if (!currentUser) {
      toast.error('Erro: usuário não identificado');
      return;
    }

    // Página aberta por muito tempo pode deixar token inválido em memória.
    // Antes de inserir no banco, validar a sessão real do Supabase.
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const authUser = authData?.user || null;

      if (authError || !authUser) {
        if (guestClientData) {
          const relogin = await createGuestClientAndLogin(
            guestClientData.name,
            guestClientData.phone
          );
          if (relogin.error || !relogin.user) {
            toast.error('Sua sessão expirou. Reabra o agendamento e tente novamente.');
            return;
          }
          currentUser = relogin.user;
        } else {
          toast.error('Sua sessão expirou. Faça login novamente para agendar.');
          return;
        }
      } else {
        currentUser = authUser;
      }
    } catch (sessionError) {
      console.error('Erro ao validar sessão antes do agendamento:', sessionError);
    }

    // Helper: evita ficar preso para sempre em chamadas do Supabase
    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
        )
      ]);
    };

    // Compatibilidade com bancos sem migração de colunas novas de assinatura.
    const removeSubscriberExtraFields = (payload: any) => {
      const cleanPayload: any = { ...(payload || {}) };
      delete cleanPayload.subscription_id;
      delete cleanPayload.subscriber_service_id;
      delete cleanPayload.subscriber_service_name;
      delete cleanPayload.subscriber_service_limit;
      return cleanPayload;
    };

    const removeBookingExtraFieldsByError = (payload: any, error: any) => {
      const cleanPayload: any = { ...(payload || {}) };
      const msg = String(error?.message || '').toLowerCase();
      const missingTotalPrice = msg.includes('total_price') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find'));
      const missingAdditionalProducts = msg.includes('additional_products') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find'));
      const missingLoyaltyReward =
        msg.includes('is_loyalty_reward') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find'));
      const missingLoyaltyPointsAwarded =
        msg.includes('loyalty_points_awarded') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find'));

      if (missingTotalPrice) {
        delete cleanPayload.total_price;
      }
      if (missingAdditionalProducts) {
        delete cleanPayload.additional_products;
        toast.error('Seu banco ainda não tem a coluna additional_products. Rode a migration para salvar produtos extras no agendamento.');
      }
      if (missingLoyaltyReward) {
        delete cleanPayload.is_loyalty_reward;
      }
      if (missingLoyaltyPointsAwarded) {
        delete cleanPayload.loyalty_points_awarded;
      }

      return cleanPayload;
    };

    const shouldRetryWithoutSubscriberFields = (error: any) => {
      const msg = String(error?.message || '').toLowerCase();
      return (
        msg.includes('schema cache') ||
        msg.includes('could not find the') ||
        msg.includes('column') ||
        msg.includes('subscription_id') ||
        msg.includes('subscriber_service_')
      );
    };

    try {
      // Lógica para agendamentos reais
      const isEstablishmentOwner = currentUser?.id === establishment.owner_id;
      const isSubscriberAppointment = appointmentData?.is_subscriber === true;
      const parseDurationMinutesSafe = (rawDuration: any, fallback = 30): number => {
        if (typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0) {
          return Math.round(rawDuration);
        }
        const raw = String(rawDuration || '').trim().toLowerCase();
        if (!raw) return fallback;
        const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (hhmmMatch) {
          const h = Number(hhmmMatch[1]);
          const m = Number(hhmmMatch[2]);
          const total = h * 60 + m;
          return Number.isFinite(total) && total > 0 ? total : fallback;
        }
        const numeric = Number(raw);
        if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);
        const match = raw.match(/(\d+)/);
        if (match) {
          const parsed = Number(match[1]);
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return fallback;
      };
      const requestedDuration = parseDurationMinutesSafe(appointmentData?.duration, 30);
      const planMinimumDuration = isSubscriberAppointment
        ? parseDurationMinutesSafe(
          selectedSubscriberService?.service_duration ?? selectedSubscriberService?.duration,
          0
        )
        : 0;
      const normalizedDuration =
        planMinimumDuration > 0 ? Math.max(requestedDuration, planMinimumDuration) : requestedDuration;
      if (normalizedDuration !== requestedDuration) {
        console.warn('⚠️ [Booking] Ajustando duração para evitar subcontagem de assinante', {
          requestedDuration,
          planMinimumDuration,
          normalizedDuration,
          subscriptionId: selectedSubscriberService?.id || appointmentData?.subscription_id || null,
        });
      }
      appointmentData = {
        ...appointmentData,
        duration: normalizedDuration,
      };
      const bookingClientWhatsapp = String(
        appointmentData?.client_whatsapp || guestClientData?.phone || ''
      ).trim();

      // Trava central: impede novo agendamento quando há atendimento pendente do mesmo cliente.
      // Colocando aqui, a regra vale para formulário clássico e chat guiado.
      if (bookingClientWhatsapp) {
        console.log('🛡️ [Booking] Validando bloqueio por pendencia de atendimento', {
          establishmentId: establishment.id,
          limitPendingBookingEnabled: Boolean((establishment as any)?.limit_client_pending_booking),
          bookingClientWhatsapp,
        });
        const pendingValidation = await validatePendingClientBookingLimit(
          bookingClientWhatsapp,
          establishment.id,
          Boolean((establishment as any)?.limit_client_pending_booking)
        );

        if (!pendingValidation.canBook) {
          toast.error(
            pendingValidation.message ||
            'Voce ainda tem servico pendente nesta barbearia. Aguarde concluir o atendimento.'
          );
          return;
        }
      }

      // Trava de segurança: assinante só agenda com o plano ativo detectado.
      if (isSubscriberAppointment) {
        const subscriberDateValidation = await validateSubscriberBooking(
          String(appointmentData?.client_whatsapp || guestClientData?.phone || ''),
          establishment.id,
          targetDate
        );
        if (!subscriberDateValidation.canBook) {
          toast.error(
            subscriberDateValidation.message ||
            'Sua assinatura não permite agendamento nesta data. Renove a assinatura ou agende como cliente normal.'
          );
          return;
        }

        const selectedPlanId = String(selectedSubscriberService?.id || appointmentData?.subscription_id || '').trim();
        if (activeSubscriberPlanId && selectedPlanId && activeSubscriberPlanId !== selectedPlanId) {
          toast.error('Você só pode agendar usando o seu plano mensal ativo.');
          return;
        }
        if (activeSubscriberPlanId && !selectedPlanId) {
          toast.error('Plano de assinante não identificado. Reabra o agendamento de assinante e tente novamente.');
          return;
        }

        const dividedServicesToValidate = shouldSelectDividedServiceFirst
          ? selectedDividedSubscriberServices
            .map((service: any) => ({
              id: String(service?.id || '').trim(),
              name: String(service?.name || '').trim(),
              limit: Number(service?.limit || 0) || null,
            }))
            .filter((service: any) => service.id && service.name)
          : [];

        if (dividedServicesToValidate.length > 0) {
          for (const dividedService of dividedServicesToValidate) {
            const monthlyLimitCheck = await checkMonthlyLimit(
              String(appointmentData?.client_whatsapp || ''),
              establishment.id,
              new Date(appointmentData?.appointment_date || selectedDate),
              dividedService
            );

            if (!monthlyLimitCheck.canBook) {
              toast.error(
                monthlyLimitCheck.errorMessage ||
                `Voce ja atingiu o limite do servico "${dividedService.name}" nesta assinatura.`
              );
              return;
            }
          }
        } else {
          const monthlyLimitCheck = await checkMonthlyLimit(
            String(appointmentData?.client_whatsapp || ''),
            establishment.id,
            new Date(appointmentData?.appointment_date || selectedDate),
            {
              id: String(appointmentData?.subscriber_service_id || '').trim() || null,
              name: String(appointmentData?.subscriber_service_name || appointmentData?.service || '').trim() || null,
              limit: Number(appointmentData?.subscriber_service_limit || 0) || null,
            }
          );
          if (!monthlyLimitCheck.canBook) {
            toast.error(
              monthlyLimitCheck.errorMessage ||
              'Voce ja atingiu o limite do servico nesta assinatura. Selecione um servico com saldo disponivel.'
            );
            return;
          }
        }
      }

      // ✅ PAGAMENTO ANTECIPADO (Pagar.me ou Mercado Pago) - Booking público
      // Regra: se exigir pagamento antecipado, o agendamento só confirma após pagar.
      const exigirPagamentoAntecipado = (establishment as any)?.exigir_pagamento_antecipado === true;
      const exigirPagamentoAntecipadoMercadoPago = (establishment as any)?.exigir_pagamento_antecipado_mercadopago === true;
      const pagamentoAdiantadoLiberadoAdmin = (establishment as any)?.pagamento_adiantado_liberado_admin === true;
      const pagamentoAdiantadoOpcional = (establishment as any)?.pagamento_adiantado_opcional === true;
      const pagamentoAdiantadoOpcionalMercadoPago = (establishment as any)?.pagamento_adiantado_opcional_mercadopago === true;
      const pagarmeRecipientId = String((establishment as any)?.pagarme_recipient_id || '').trim();
      const mercadopagoAccessToken = String((establishment as any)?.mercadopago_access_token || '').trim();
      const isSubscriber = appointmentData?.is_subscriber === true;
      const valorAgendamento = Number(appointmentData?.price || 0);
      const phoneCandidates = buildPhoneCandidates(
        String(appointmentData?.client_whatsapp || guestClientData?.phone || '')
      );

      // Verificar se tem Pagar.me ou Mercado Pago configurado
      const hasPagarMe = !!pagarmeRecipientId;
      const hasMercadoPago = !!mercadopagoAccessToken;

      // ✅ CORRIGIDO: Cada gateway funciona INDEPENDENTE do outro
      // Se Mercado Pago está configurado para exigir → usar Mercado Pago
      // Se Pagar.me está configurado para exigir → usar Pagar.me
      // Prioridade: Mercado Pago se ambos estiverem marcados
      const usarMercadoPago = hasMercadoPago && exigirPagamentoAntecipadoMercadoPago;
      const usarPagarMe = !usarMercadoPago && hasPagarMe && exigirPagamentoAntecipado;

      // ✅ CORRIGIDO: Remover dependência de pagamento_adiantado_liberado_admin
      // Se algum gateway está configurado para exigir pagamento, funciona independente
      const pagamentoAdiantadoAtivo = (usarPagarMe || usarMercadoPago) && !isSubscriber && valorAgendamento > 0;

      // Cobrança obrigatória por cliente (discreta): se o gateway for MP com modo opcional,
      // clientes marcados no dashboard passam a ser tratados como pagamento obrigatório.
      let forceAdvancePaymentForClient = false;
      if (pagamentoAdiantadoAtivo && usarMercadoPago && pagamentoAdiantadoOpcionalMercadoPago && phoneCandidates.length > 0) {
        const { data: forcedPaymentClient, error: forcedPaymentError } = await supabase
          .from('manual_clients')
          .select('id')
          .eq('establishment_id', establishment.id)
          .in('whatsapp', phoneCandidates as any)
          .eq('force_advance_payment', true)
          .limit(1)
          .maybeSingle();

        if (!forcedPaymentError) {
          forceAdvancePaymentForClient = Boolean(forcedPaymentClient?.id);
        } else {
          const forcedErrorMsg = String(forcedPaymentError?.message || '').toLowerCase();
          const isMissingColumn =
            forcedErrorMsg.includes('force_advance_payment') ||
            forcedErrorMsg.includes('schema cache') ||
            forcedErrorMsg.includes('column');
          if (!isMissingColumn) {
            console.warn('⚠️ Falha ao validar cobrança obrigatória por cliente:', forcedPaymentError);
          }
        }
      }

      const pagamentoOpcionalNoGatewayAtual = usarPagarMe ? pagamentoAdiantadoOpcional : pagamentoAdiantadoOpcionalMercadoPago;
      const forceMandatoryInOptionalMode = pagamentoAdiantadoAtivo && pagamentoOpcionalNoGatewayAtual && forceAdvancePaymentForClient;
      const precisaPagamento = (pagamentoAdiantadoAtivo && !pagamentoOpcionalNoGatewayAtual) || forceMandatoryInOptionalMode;
      const permitePagamentoOpcional =
        pagamentoAdiantadoAtivo &&
        pagamentoOpcionalNoGatewayAtual &&
        !forceMandatoryInOptionalMode;

      // Trava final anti-sobreposição no Booking:
      // mesmo que a grade mostre horário livre por qualquer inconsistência visual,
      // este guard impede gravar dois clientes no mesmo período do mesmo profissional.
      const normalizeText = (raw: any): string =>
        String(raw || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
      const normalizeTimeHHmm = (rawTime: any): string => {
        const value = String(rawTime || '').trim();
        if (!value) return '00:00';
        const [h = '00', m = '00'] = value.split(':');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      };
      const parseDurationMinutes = (rawDuration: any): number => {
        if (typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0) {
          return Math.round(rawDuration);
        }
        const raw = String(rawDuration || '').trim().toLowerCase();
        if (!raw) return 30;

        const hhmmMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (hhmmMatch) {
          const h = Number(hhmmMatch[1]);
          const m = Number(hhmmMatch[2]);
          const total = h * 60 + m;
          return Number.isFinite(total) && total > 0 ? total : 30;
        }

        const numeric = Number(raw);
        if (Number.isFinite(numeric) && numeric > 0) return Math.round(numeric);

        const hourMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)\b/);
        if (hourMatch) {
          const hours = Number(String(hourMatch[1]).replace(',', '.'));
          const total = Math.round(hours * 60);
          return Number.isFinite(total) && total > 0 ? total : 30;
        }

        const minuteMatch = raw.match(/(\d+)\s*(m|min|mins|minuto|minutos)\b/);
        if (minuteMatch) {
          const mins = Number(minuteMatch[1]);
          return Number.isFinite(mins) && mins > 0 ? mins : 30;
        }

        const match = raw.match(/(\d+)/);
        if (match) {
          const parsed = Number(match[1]);
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return 30;
      };
      const getAdditionalProductsDuration = (rawAdditionalProducts: any): number => {
        if (!Array.isArray(rawAdditionalProducts)) return 0;
        return rawAdditionalProducts.reduce((sum: number, item: any) => {
          const duration = parseDurationMinutes(item?.duration);
          return sum + (Number.isFinite(duration) ? duration : 0);
        }, 0);
      };
      const toMinutes = (hhmm: string): number => {
        const [h, m] = String(hhmm || '00:00').split(':').map(Number);
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
      };

      {
        const targetDate = String(appointmentData?.appointment_date || format(selectedDate, 'yyyy-MM-dd')).slice(0, 10);
        const targetProfessionalRefNorm = normalizeText(appointmentData?.professional);
        const targetStart = toMinutes(normalizeTimeHHmm(appointmentData?.appointment_time));
        const targetDuration =
          parseDurationMinutes(appointmentData?.duration) +
          getAdditionalProductsDuration(appointmentData?.additional_products);
        const targetEnd = targetStart + targetDuration;

        // Guard extra: valida com snapshot fresco do banco para evitar booking em horário bloqueado
        // caso o cliente esteja com cache antigo da tela de agendamento.
        let freshProfessionals: any[] = Array.isArray(establishment?.professionals) ? establishment.professionals : [];
        try {
          const { data: freshEstablishmentData, error: freshEstablishmentError } = await supabase
            .from('establishments')
            .select('professionals')
            .eq('id', establishment.id)
            .single();
          if (!freshEstablishmentError && Array.isArray(freshEstablishmentData?.professionals)) {
            freshProfessionals = freshEstablishmentData.professionals;
          } else if (freshEstablishmentError) {
            console.warn('⚠️ Não foi possível atualizar profissionais em tempo real no submit do booking:', freshEstablishmentError);
          }
        } catch (freshSnapshotError) {
          console.warn('⚠️ Falha inesperada ao buscar snapshot fresco de profissionais no booking:', freshSnapshotError);
        }

        let targetProfessionalNameNorm = '';
        let targetProfessionalIdNorm = '';
        const selectedProfessional = Array.isArray(freshProfessionals)
          ? freshProfessionals.find((professional: any) => {
            const professionalId = String(professional?.id || '').trim();
            const professionalNameNorm = normalizeText(professional?.name);
            return (
              (professionalId.length > 0 && professionalId === String(appointmentData?.professional || '').trim()) ||
              (professionalNameNorm.length > 0 && professionalNameNorm === targetProfessionalRefNorm)
            );
          })
          : null;
        if (selectedProfessional?.name) {
          targetProfessionalNameNorm = normalizeText(selectedProfessional.name);
        }
        if (selectedProfessional?.id) {
          targetProfessionalIdNorm = normalizeText(selectedProfessional.id);
        }

        if (selectedProfessional) {
          const normalizedAbsences = Array.isArray((selectedProfessional as any)?.absences)
            ? ((selectedProfessional as any).absences as any[])
              .map((absenceDate: any) => String(absenceDate || '').slice(0, 10))
              .filter(Boolean)
            : [];
          if (normalizedAbsences.includes(targetDate)) {
            toast.error('Este profissional está indisponível neste dia. Escolha outro horário.');
            await fetchExistingAppointments();
            return;
          }

          const blockedMap = ((selectedProfessional as any)?.blocked_hours && typeof (selectedProfessional as any).blocked_hours === 'object')
            ? (selectedProfessional as any).blocked_hours
            : {};
          const currentGridInterval = getScheduleIntervalMinutes({
            use60MinuteSchedule: Boolean((establishment as any)?.use_60_minute_schedule),
            use20MinuteSchedule: Boolean((establishment as any)?.use_20_minute_schedule),
            use15MinuteInterval: Boolean((establishment as any)?.use_15_minute_interval),
          });
          const blockedTimes = filterTimesAlignedToScheduleGrid(
            Array.isArray(blockedMap[targetDate])
              ? blockedMap[targetDate]
                .map((rawTime: any) => normalizeTimeHHmm(rawTime))
                .filter(Boolean)
              : [],
            currentGridInterval
          );

          if (blockedTimes.length > 0) {
            const blockedSlotDuration = currentGridInterval;

            const hasBlockedConflict = blockedTimes.some((blockedTime: string) => {
              const blockedStart = toMinutes(blockedTime);
              const blockedEnd = blockedStart + blockedSlotDuration;
              const startsInBlocked = targetStart >= blockedStart && targetStart < blockedEnd;
              const endsInBlocked = targetEnd > blockedStart && targetEnd <= blockedEnd;
              const encompassesBlocked = targetStart <= blockedStart && targetEnd >= blockedEnd;
              return startsInBlocked || endsInBlocked || encompassesBlocked;
            });

            if (hasBlockedConflict) {
              toast.error('Este horário foi bloqueado pelo profissional. Escolha outro horário.');
              await fetchExistingAppointments();
              return;
            }
          }
        }

        const { data: sameDayAppointments, error: sameDayAppointmentsError } = await supabase
          .from('appointments')
          .select('id, appointment_time, duration, additional_products, status, professional')
          .eq('establishment_id', establishment.id)
          .eq('appointment_date', targetDate)
          .neq('status', 'cancelled');

        if (sameDayAppointmentsError) {
          throw sameDayAppointmentsError;
        }

        const hasConflict = (sameDayAppointments || []).some((existing: any) => {
          const existingProfessionalNorm = normalizeText(existing?.professional);
          const sameByCanonicalId =
            targetProfessionalIdNorm.length > 0 &&
            existingProfessionalNorm.length > 0 &&
            existingProfessionalNorm === targetProfessionalIdNorm;
          const sameProfessional =
            sameByCanonicalId ||
            (targetProfessionalRefNorm.length > 0 && existingProfessionalNorm === targetProfessionalRefNorm) ||
            (targetProfessionalNameNorm.length > 0 && existingProfessionalNorm === targetProfessionalNameNorm);
          if (!sameProfessional) return false;

          const existingStart = toMinutes(normalizeTimeHHmm(existing?.appointment_time));
          const existingDuration =
            parseDurationMinutes(existing?.duration) +
            getAdditionalProductsDuration(existing?.additional_products);
          const existingEnd = existingStart + existingDuration;
          return !(targetEnd <= existingStart || targetStart >= existingEnd);
        });

        if (hasConflict) {
          toast.error('Esse horário acabou de ser ocupado. Escolha outro horário.');
          await fetchExistingAppointments();
          return;
        }
      }

      console.log('💳 DEBUG - BookingPage/handleSubmit pagamento:', {
        exigirPagamentoAntecipado,
        exigirPagamentoAntecipadoMercadoPago,
        pagamentoAdiantadoLiberadoAdmin,
        pagamentoAdiantadoOpcional,
        pagamentoAdiantadoOpcionalMercadoPago,
        isSubscriber,
        valorAgendamento,
        precisaPagamento,
        forceAdvancePaymentForClient,
        usarPagarMe,
        usarMercadoPago,
        hasPagarmeRecipientId: Boolean(pagarmeRecipientId),
        hasMercadoPagoToken: Boolean(mercadopagoAccessToken),
        pagarmeRecipientIdPreview: pagarmeRecipientId ? `${pagarmeRecipientId.slice(0, 6)}...${pagarmeRecipientId.slice(-4)}` : null
      });

      if (precisaPagamento) {
        if (usarPagarMe && !pagarmeRecipientId) {
          toast.error('Este estabelecimento exige pagamento antecipado, mas ainda não configurou o recebedor Pagar.me. Fale com o estabelecimento.');
          return;
        }
        if (usarMercadoPago && !mercadopagoAccessToken) {
          toast.error('Este estabelecimento exige pagamento antecipado, mas ainda não configurou o Mercado Pago. Fale com o estabelecimento.');
          return;
        }

        console.log('🧾 DEBUG - Criando agendamento pending_payment no Supabase...', {
          establishment_id: establishment.id,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          appointment_time: appointmentData?.appointment_time,
          professional: appointmentData?.professional,
          service: appointmentData?.service,
          price: appointmentData?.price
        });

        const pendingBasePayload = {
          client_id: currentUser.id,
          establishment_id: establishment.id,
          establishment_code: establishment.code,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          status: 'pending_payment',
          payment_status: 'pending',
          payment_method: 'pendente',
          ...appointmentData
        };

        let { data: inserted, error: insertError } = await withTimeout(
          supabase
            .from('appointments')
            .insert([pendingBasePayload])
            .select('id')
            .single(),
          20000,
          'insert appointments (pending_payment)'
        );

        if (insertError && shouldRetryWithoutSubscriberFields(insertError)) {
          const legacyPayload = removeSubscriberExtraFields(pendingBasePayload);
          const retry = await withTimeout(
            supabase
              .from('appointments')
              .insert([legacyPayload])
              .select('id')
              .single(),
            20000,
            'insert appointments (pending_payment fallback legacy columns)'
          );
          inserted = retry.data as any;
          insertError = retry.error as any;

          // Segunda tentativa para bancos legados sem colunas modernas do booking (mantém additional_products quando possível).
          if (insertError) {
            const bookingLegacyPayload = removeBookingExtraFieldsByError(legacyPayload, insertError);
            const retryBookingLegacy = await withTimeout(
              supabase
                .from('appointments')
                .insert([bookingLegacyPayload])
                .select('id')
                .single(),
              20000,
              'insert appointments (pending_payment fallback booking legacy columns)'
            );
            inserted = retryBookingLegacy.data as any;
            insertError = retryBookingLegacy.error as any;
          }
        }

        if (insertError) throw insertError;

        console.log('✅ DEBUG - Agendamento pending_payment criado:', inserted?.id);
        setPendingAppointmentId(inserted.id);
        setPendingPaymentAmount(valorAgendamento);
        setPendingCustomerData({
          name: appointmentData?.client_name || guestClientData?.name || 'Cliente',
          phone: appointmentData?.client_whatsapp || guestClientData?.phone,
          email: isEstablishmentOwner ? undefined : (currentUser?.email || undefined),
          document: appointmentData?.client_cpf || undefined,
        });
        setPaymentIsOptional(false);
        setShowPaymentModal(true);
        // Armazenar qual gateway usar (Pagar.me ou Mercado Pago)
        (window as any).__paymentGateway = usarPagarMe ? 'pagarme' : 'mercadopago';
        return;
      }

      // 🔥 VALIDAÇÃO DE 1 AGENDAMENTO POR SEMANA PARA ASSINANTES
      if (appointmentData.is_subscriber && currentUser?.id) {
        console.log('🔍 Validando limitação de 1 agendamento por semana...');

        const validation = await validateOneWeekLimit(
          currentUser.id,
          establishment.id,
          new Date(appointmentData.appointment_date)
        );

        if (!validation.canBook) {
          console.log('🚫 Agendamento bloqueado:', validation.message);
          toast.error(validation.message || 'Erro na validação');
          return;
        }

        console.log('✅ Validação de 1 agendamento por semana passou');
      }

      // 🔥 VALIDAÇÃO DE REMARCAÇÃO NO MESMO DIA PARA ASSINANTES
      if (appointmentData.is_subscriber && currentUser?.id) {
        console.log('🔍 Validando remarcação no mesmo dia...');

        const sameDayValidation = await validateSameDayReschedule(
          currentUser.id,
          establishment.id,
          new Date(appointmentData.appointment_date),
          appointmentData.is_subscriber
        );

        if (!sameDayValidation.canBook) {
          console.log('🚫 Agendamento bloqueado por remarcação no mesmo dia:', sameDayValidation.message);
          toast.error(sameDayValidation.message || 'Erro na validação de remarcação');
          return;
        }

        console.log('✅ Validação de remarcação no mesmo dia passou');
      }

      // 🔥 VALIDAÇÃO DE PUNIÇÃO POR CANCELAMENTO - REMOVIDA
      // Sistema de punição foi removido conforme remove_punishment_feature.sql

      console.log('🧾 DEBUG - Criando agendamento normal no Supabase...', {
        establishment_id: establishment.id,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: appointmentData?.appointment_time,
        professional: appointmentData?.professional,
        service: appointmentData?.service,
        price: appointmentData?.price,
        payment_method: appointmentData?.payment_method
      });

      const normalBasePayload = {
        client_id: currentUser.id,
        establishment_id: establishment.id,
        establishment_code: establishment.code, // Salvar código do estabelecimento
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        ...appointmentData
      };

      let { data: insertedAppointment, error } = await withTimeout(
        supabase
          .from('appointments')
          .insert([normalBasePayload])
          .select('id')
          .single(),
        20000,
        'insert appointments (normal)'
      );

      if (error && shouldRetryWithoutSubscriberFields(error)) {
        const legacyPayload = removeSubscriberExtraFields(normalBasePayload);
        const retry = await withTimeout(
          supabase
            .from('appointments')
            .insert([legacyPayload])
            .select('id')
            .single(),
          20000,
          'insert appointments (normal fallback legacy columns)'
        );
        insertedAppointment = retry.data as any;
        error = retry.error as any;

        // Segunda tentativa para bancos legados sem colunas modernas do booking (mantém additional_products quando possível).
        if (error) {
          const bookingLegacyPayload = removeBookingExtraFieldsByError(legacyPayload, error);
          const retryBookingLegacy = await withTimeout(
            supabase
              .from('appointments')
              .insert([bookingLegacyPayload])
              .select('id')
              .single(),
            20000,
            'insert appointments (normal fallback booking legacy columns)'
          );
          insertedAppointment = retryBookingLegacy.data as any;
          error = retryBookingLegacy.error as any;
        }
      }

      if (error) throw error;

      toast.success('Agendamento realizado com sucesso!');

      // Store appointment data for dashboard reminder modal
      // Buscar o nome do profissional do banco de dados
      let professionalName = 'Não especificado';
      try {
        const { data: professionalData } = await supabase
          .from('establishments')
          .select('professionals')
          .eq('id', establishment.id)
          .single();

        if (professionalData?.professionals) {
          const professional = professionalData.professionals.find((p: any) => p.id === appointmentData.professional);
          professionalName = professional?.name || 'Não especificado';
        }
      } catch (error) {
        console.error('Erro ao buscar nome do profissional:', error);
      }

      const appointmentInfo = {
        serviceName: appointmentData.service || 'Serviço não especificado',
        establishmentName: establishment?.name || '',
        establishmentCode: establishment?.code || '', // Adicionar código do estabelecimento
        appointmentDate: format(selectedDate, 'dd/MM/yyyy'),
        appointmentTime: appointmentData.appointment_time,
        location: establishment?.location || establishment?.address || '',
        professionalName: professionalName,
        paymentMethod: appointmentData.payment_method || 'Não especificada',
        appointmentId: currentUser.id,
        uniqueKey: Date.now().toString() // Chave única baseada no timestamp
      };
      localStorage.setItem('reminder_creation_data', JSON.stringify(appointmentInfo));

      // Atualizar lista de agendamentos após sucesso
      await fetchExistingAppointments();
      setShowBookingForm(false); // Esconder formulário após agendamento

      // Salvar o telefone no localStorage para usar na página de visualização
      const phoneForViewAppointments = (appointmentData?.client_whatsapp || guestClientData?.phone || '').toString();
      if (phoneForViewAppointments) {
        const cleanPhone = phoneForViewAppointments.replace(/\D/g, '');
        localStorage.setItem('last_booking_phone', cleanPhone);
        console.log('📱 Telefone salvo para visualização:', cleanPhone);
      }

      // Se pagamento é opcional, perguntar se deseja pagar agora (mas já salvamos telefone/reminder acima)
      if (permitePagamentoOpcional) {
        const hasPaymentGateway = (usarPagarMe && pagarmeRecipientId) || (usarMercadoPago && mercadopagoAccessToken);
        if (!hasPaymentGateway) {
          // Sem gateway configurado: só seguir como normal
          console.warn('⚠️ Pagamento opcional ativo, mas sem gateway configurado. Seguindo sem pagamento.');
        } else {
          setPendingAppointmentId(insertedAppointment?.id || null);
          setPendingPaymentAmount(valorAgendamento);
          setPendingCustomerData({
            name: appointmentData?.client_name || guestClientData?.name || 'Cliente',
            phone: appointmentData?.client_whatsapp || guestClientData?.phone,
            email: isEstablishmentOwner ? undefined : (currentUser?.email || undefined),
            document: appointmentData?.client_cpf || undefined,
          });
          setPaymentIsOptional(true);
          setShowOptionalPayPrompt(true);
          // Armazenar qual gateway usar (Pagar.me ou Mercado Pago)
          (window as any).__paymentGateway = usarPagarMe ? 'pagarme' : 'mercadopago';
          return;
        }
      }

      // Redirecionar para a página de visualização de agendamentos
      toast.success('Redirecionando para seus agendamentos...');
      setTimeout(() => {
        const cleanPhone = phoneForViewAppointments ? phoneForViewAppointments.replace(/\D/g, '') : '';
        // ✅ Proteção contra múltiplos redirects
        if (isReloadingRef.current) return;
        isReloadingRef.current = true;
        window.location.href = cleanPhone ? `/view-appointments?phone=${encodeURIComponent(cleanPhone)}` : '/view-appointments';
      }, 1000);
    } catch (error: any) {
      // Supabase costuma trazer { message, details, hint, code }
      const code = error?.code || error?.status || undefined;
      const details = error?.details || error?.hint || undefined;
      console.error('Error creating appointment:', error);
      if (String(code) === '42501') {
        toast.error('Permissão negada para agendar (sessão expirada). Atualize a página e faça login novamente.');
        return;
      }
      toast.error(
        [error?.message || 'Erro ao criar agendamento', code ? `(código: ${code})` : null, details ? `- ${details}` : null]
          .filter(Boolean)
          .join(' ')
      );
    } finally {
      setIsLoading(false);
    }
  };



  const handleAgendarClick = () => {
    const isChatEnabled = Boolean((establishment as any)?.booking_chat_enabled ?? true);

    if ((id === '3814' || id === '3315') && !isChatEnabled) {
      setUseLegacyBookingFlow(true);
      setShowBookingForm(true);
      safeSessionSet(QUICK_BOOKING_FLOW_KEY, 'form');
      return;
    }

    if (isChatEnabled) {
      setUseLegacyBookingFlow(false);
      setShowBookingForm(true);
      safeSessionSet(QUICK_BOOKING_FLOW_KEY, 'form');
      return;
    }

    // Fluxo legado: modal rápido para coletar nome/telefone
    setShowQuickBookingModal(true);
    safeSessionSet(QUICK_BOOKING_FLOW_KEY, 'modal');
  };

  const persistGuestClientData = (name: string, phone: string) => {
    setGuestClientData({ name, phone });
    safeSessionSet(QUICK_BOOKING_FLOW_KEY, 'form');
    safeSessionSet(QUICK_BOOKING_DATA_KEY, JSON.stringify({ name, phone }));
  };

  // Função para continuar após preencher nome e telefone
  const handleContinueQuickBooking = (name: string, phone: string) => {
    persistGuestClientData(name, phone);
    setShowQuickBookingModal(false);
    setShowBookingForm(true);
    setUseLegacyBookingFlow(!Boolean((establishment as any)?.booking_chat_enabled ?? true));
  };

  useEffect(() => {
    if (!showBookingForm) return;
    const enabled = Boolean((establishment as any)?.booking_chat_enabled ?? true);
    if (enabled) return;
    if (!useLegacyBookingFlow) {
      setUseLegacyBookingFlow(true);
    }
  }, [establishment, showBookingForm, useLegacyBookingFlow]);

  const normalizePhoneDigits = (phone: string) => String(phone || '').replace(/\D/g, '');
  const normalizeWhatsappForStorage = (input: string): string => {
    const digits = normalizePhoneDigits(input);
    if (!digits) return '';
    // Se já tem código de país conhecido, mantém
    const known = [
      { code: '55', minLength: 12 }, // BR
      { code: '351', minLength: 11 }, // PT
      { code: '34', minLength: 11 }, // ES
      { code: '1', minLength: 11 }, // US/CA
    ];
    const hasCountryCode = known.some(({ code, minLength }) => digits.startsWith(code) && digits.length >= minLength);
    if (hasCountryCode) return digits;
    // Senão, assume BR (10/11 dígitos) e adiciona 55
    if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
    return digits;
  };
  const filaEsperaAtiva = Boolean((establishment as any)?.fila_espera_ativa);
  const filaEsperaFechada = Boolean((establishment as any)?.fila_espera_fechada);
  const filaEsperaProfissionaisIds = (() => {
    const validProfessionalIds = new Set(
      ((((establishment as any)?.professionals || []) as any[])
        .filter((p: any) => !p?.hidden_from_booking)
        .map((p: any) => String(p?.id || '').trim())
        .filter(Boolean))
    );
    const ids = (((establishment as any)?.fila_espera_profissional_ids || []) as any[])
      .map((x: any) => String(x || '').trim())
      .filter((id: string) => Boolean(id) && validProfessionalIds.has(id));
    if (ids.length) return ids;
    const legacyRaw = String((establishment as any)?.fila_espera_profissional_id || '').trim();
    const legacy = legacyRaw && validProfessionalIds.has(legacyRaw) ? legacyRaw : '';
    return legacy ? [legacy] : [];
  })();
  const filaEsperaProfissionais = (() => {
    const profs = (((establishment as any)?.professionals || []) as any[])
      .filter((p: any) => !p?.hidden_from_booking);
    const uniqueIds = Array.from(new Set(filaEsperaProfissionaisIds));
    return uniqueIds.map((pid) => {
      const p = profs.find((x: any) => String(x?.id) === String(pid));
      return { id: pid, name: String(p?.name || 'Profissional').trim() || 'Profissional' };
    });
  })();
  const isFilaPorProfissional = filaEsperaProfissionais.length > 1;

  // Prefill de nome/telefone para fila (se já coletou no fluxo rápido)
  useEffect(() => {
    if (!guestClientData) return;
    if (!waitlistName) setWaitlistName(guestClientData.name || '');
    if (!waitlistPhone) setWaitlistPhone(guestClientData.phone || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestClientData]);

  const fetchWaitlist = async () => {
    if (!establishment?.id) return;
    setIsLoadingWaitlist(true);
    try {
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('id, client_name, client_whatsapp, service_name, service_price, service_duration_minutes, started_at, created_at, professional_id, queue_position')
        .eq('establishment_id', establishment.id)
        .eq('status', 'waiting')
        .order('queue_position', { ascending: true, nullsFirst: false } as any)
        .order('created_at', { ascending: true });

      if (error) {
        const msg = String((error as any)?.message || '');
        // Fallback para banco ainda não migrado (colunas novas não existem)
        if ((msg.includes('does not exist') && msg.includes('waitlist_entries')) || msg.includes('queue_position')) {
          const { data: legacyData, error: legacyError } = await supabase
            .from('waitlist_entries')
            .select('id, client_name, client_whatsapp, service_name, created_at')
            .eq('establishment_id', establishment.id)
            .eq('status', 'waiting')
            .order('created_at', { ascending: true });
          if (legacyError) throw legacyError;
          const allLegacy = ((legacyData as any[]) || []).map((r: any) => ({ ...r }));
          setWaitlistEntriesAll(allLegacy);
          setWaitlistQueueCounts({});
          setWaitlistEntries(allLegacy);
          return;
        }
        throw error;
      }
      const all = (data as any[]) || [];
      setWaitlistEntriesAll(all);

      // Contagem por fila (profissional)
      const counts: Record<string, number> = {};
      for (const r of all) {
        const pid = String((r as any)?.professional_id || '').trim();
        if (!pid) continue;
        counts[pid] = (counts[pid] || 0) + 1;
      }
      setWaitlistQueueCounts(counts);

      // Filtrar conforme fila selecionada (modo por profissional)
      const selectedPid = String(waitlistQueueProfessionalId || '').trim();
      if (isFilaPorProfissional && selectedPid) {
        setWaitlistEntries(all.filter((r: any) => String(r?.professional_id || '').trim() === selectedPid));
      } else {
        setWaitlistEntries(all);
      }
    } catch (e: any) {
      console.error('❌ Erro ao carregar fila (booking):', e);
      toast.error(e?.message || 'Erro ao carregar fila de espera');
    } finally {
      setIsLoadingWaitlist(false);
    }
  };

  useEffect(() => {
    if (!showWaitlistModal) return;
    // Se houver mais de uma fila, escolher a primeira como padrão ao abrir
    const selectedPid = String(waitlistQueueProfessionalId || '').trim();
    const hasSelectedInList = filaEsperaProfissionais.some((p) => String(p.id) === selectedPid);
    if ((!selectedPid || !hasSelectedInList) && filaEsperaProfissionais.length > 0) {
      setWaitlistQueueProfessionalId(filaEsperaProfissionais[0].id);
    }
    fetchWaitlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWaitlistModal, establishment?.id]);

  // Refiltrar lista quando o usuário troca a fila selecionada
  useEffect(() => {
    if (!showWaitlistModal) return;
    if (!isFilaPorProfissional) {
      setWaitlistEntries(waitlistEntriesAll);
      return;
    }
    const selectedPid = String(waitlistQueueProfessionalId || '').trim();
    if (!selectedPid) {
      setWaitlistEntries(waitlistEntriesAll);
      return;
    }
    setWaitlistEntries(waitlistEntriesAll.filter((r: any) => String(r?.professional_id || '').trim() === selectedPid));
  }, [showWaitlistModal, isFilaPorProfissional, waitlistQueueProfessionalId, waitlistEntriesAll]);

  const fmtBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const labelServicoFila = (s: any) => {
    const nome = String(s?.name || 'Serviço').trim() || 'Serviço';
    const preco = Number(s?.price ?? 0);
    const dur = Number(s?.duration ?? s?.service_duration ?? 0);
    const partes: string[] = [nome];
    if (Number.isFinite(preco) && preco > 0) partes.push(fmtBRL(preco));
    if (Number.isFinite(dur) && dur > 0) partes.push(`${dur}min`);
    return partes.join(' — ');
  };

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());

  const calcularResumoServicosFila = (ids: string[]) => {
    const todos = ((establishment as any)?.services_with_prices || []) as any[];
    const selected = (ids || [])
      .map((id) => todos.find((s: any) => String(s.id) === String(id)))
      .filter(Boolean);
    const nomes = selected.map((s: any) => String(s?.name || '').trim()).filter(Boolean);
    const totalPrice = selected.reduce((sum: number, s: any) => sum + Number(s?.price ?? 0), 0);
    const totalDuration = selected.reduce((sum: number, s: any) => sum + Number(s?.duration ?? s?.service_duration ?? 0), 0);
    const serviceName = nomes.length ? nomes.join(' + ') : 'Serviço';
    return { selected, serviceName, totalPrice, totalDuration };
  };

  const calcularMinutosRestantes = (entries: any[], idx: number): number | null => {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const first = entries[0];
    const startedAt = first?.started_at ? new Date(first.started_at) : null;
    const dur0 = Number(first?.service_duration_minutes ?? 0);
    if (!startedAt || !Number.isFinite(dur0) || dur0 <= 0) return null;

    let finish = startedAt.getTime() + dur0 * 60_000;
    for (let i = 1; i <= idx; i++) {
      const d = Number(entries[i]?.service_duration_minutes ?? 0);
      if (i === idx) break;
      if (Number.isFinite(d) && d > 0) finish += d * 60_000;
    }
    // Para o item idx, estimar início = finish; fim = início + duração do idx
    const dIdx = Number(entries[idx]?.service_duration_minutes ?? 0);
    if (idx === 0) {
      // restante do atual
      const ms = finish - Date.now();
      return Math.max(0, Math.ceil(ms / 60_000));
    }
    if (!Number.isFinite(dIdx) || dIdx <= 0) return null;
    const startIdx = finish;
    const ms = startIdx - Date.now();
    return Math.max(0, Math.ceil(ms / 60_000));
  };

  const handleEntrarNaFila = async () => {
    if (!establishment?.id) return;
    if (!filaEsperaAtiva) {
      toast.error('Fila de espera não está ativa neste estabelecimento.');
      return;
    }
    if (filaEsperaFechada) {
      toast.error('Fila de espera está fechada no momento.');
      return;
    }

    const nome = String(waitlistName || '').trim();
    const phoneDigits = normalizeWhatsappForStorage(waitlistPhone);
    const ids = (waitlistSelectedServiceIds || []).map((x) => String(x)).filter(Boolean);

    if (!nome) {
      toast.error('Informe seu nome.');
      return;
    }
    if (!phoneDigits) {
      toast.error('Informe seu telefone/WhatsApp.');
      return;
    }
    if (ids.length === 0) {
      toast.error('Selecione 1 ou mais serviços.');
      return;
    }

    const { selected, serviceName, totalPrice, totalDuration } = calcularResumoServicosFila(ids);
    if (selected.length === 0) {
      toast.error('Seleção inválida. Tente novamente.');
      return;
    }
    if (!Number.isFinite(totalDuration) || totalDuration < 5) {
      toast.error('Selecione serviços que somem pelo menos 5 minutos.');
      return;
    }

    const profissionalPadraoIdLegacy = String((establishment as any)?.fila_espera_profissional_id || '').trim();
    const profissionalFila =
      (isFilaPorProfissional ? String(waitlistQueueProfessionalId || '').trim() : '') ||
      (filaEsperaProfissionais[0]?.id ? String(filaEsperaProfissionais[0].id) : '') ||
      profissionalPadraoIdLegacy;
    if (!profissionalFila) {
      toast.error('Fila de espera ainda não foi configurada com profissional(is). Peça ao estabelecimento para ativar corretamente no dashboard.');
      return;
    }

    try {
      // Garantir que existe um "cliente convidado" logado (sem exigir email/senha)
      const guestRes = await createGuestClientAndLogin(nome, phoneDigits);
      if (guestRes?.error) throw guestRes.error;

      const now = new Date();
      const pad2 = (n: number) => String(n).padStart(2, '0');
      const appointmentDate = format(now, 'yyyy-MM-dd');
      const appointmentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

      const firstId = String(ids[0] || '').trim();
      const serviceIdForDb = isUuid(firstId) ? firstId : null;

      // Criar um "agendamento" ligado à fila para contabilizar no profissional (respeita configs do profissional)
      const insertAppointmentPayload: any = {
        client_id: (guestRes as any)?.user?.id,
        establishment_id: establishment.id,
        establishment_code: establishment.code,
        client_name: nome,
        client_whatsapp: phoneDigits,
        service: serviceName,
        professional: profissionalFila,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        duration: Number.isFinite(totalDuration) ? totalDuration : 0,
        price: Number.isFinite(totalPrice) ? totalPrice : 0,
        status: 'pending',
        is_waitlist: true,
      };

      let insertedAppointmentId: string | null = null;
      {
        const { data: insertedAppointment, error: apptErr } = await supabase
          .from('appointments')
          .insert([insertAppointmentPayload])
          .select('id')
          .single();

        if (apptErr) {
          const msg = String((apptErr as any)?.message || '');
          // Fallback para banco ainda não migrado (coluna is_waitlist não existe)
          if (msg.includes('does not exist') && msg.includes('is_waitlist')) {
            const { data: insertedLegacy, error: apptLegacyErr } = await supabase
              .from('appointments')
              .insert([
                {
                  ...insertAppointmentPayload,
                  is_waitlist: undefined,
                } as any,
              ])
              .select('id')
              .single();
            if (apptLegacyErr) throw apptLegacyErr;
            insertedAppointmentId = insertedLegacy?.id || null;
          } else {
            throw apptErr;
          }
        } else {
          insertedAppointmentId = insertedAppointment?.id || null;
        }
      }

      if (!insertedAppointmentId) {
        throw new Error('Não foi possível criar o agendamento da fila.');
      }

      // Criar entrada na fila referenciando o agendamento
      const waitlistPayload: any = {
        establishment_id: establishment.id,
        appointment_id: insertedAppointmentId,
        client_name: nome,
        client_whatsapp: phoneDigits,
        service_id: serviceIdForDb,
        service_name: serviceName,
        service_price: Number.isFinite(totalPrice) ? totalPrice : null,
        service_duration_minutes: Number.isFinite(totalDuration) ? totalDuration : null,
        service_ids: ids,
        services_json: selected.map((s: any) => ({
          id: String(s?.id ?? ''),
          name: String(s?.name ?? ''),
          price: Number(s?.price ?? 0),
          duration: Number(s?.duration ?? s?.service_duration ?? 0),
        })),
        professional_id: profissionalFila,
        source: 'booking',
        status: 'waiting',
      };

      let insertedEntryId: string | null = null;
      {
        const { data: insertedEntry, error: wlErr } = await supabase
          .from('waitlist_entries')
          .insert(waitlistPayload)
          .select('id')
          .single();

        if (wlErr) {
          const msg = String((wlErr as any)?.message || '');
          // Fallback para banco ainda não migrado (colunas novas não existem)
          if (
            msg.includes('schema cache') ||
            (msg.includes('does not exist') && msg.includes('waitlist_entries')) ||
            msg.includes('column') // ex: column "services_json" does not exist
          ) {
            const { data: insertedLegacy, error: wlLegacyErr } = await supabase
              .from('waitlist_entries')
              .insert({
                establishment_id: establishment.id,
                appointment_id: insertedAppointmentId,
                client_name: nome,
                client_whatsapp: phoneDigits,
                service_id: serviceIdForDb,
                service_name: serviceName,
                service_price: Number.isFinite(totalPrice) ? totalPrice : null,
                service_duration_minutes: Number.isFinite(totalDuration) ? totalDuration : null,
                source: 'booking',
                status: 'waiting',
              } as any)
              .select('id')
              .single();
            if (wlLegacyErr) throw wlLegacyErr;
            insertedEntryId = insertedLegacy?.id || null;
          } else {
            throw wlErr;
          }
        } else {
          insertedEntryId = insertedEntry?.id || null;
        }
      }

      if (!insertedEntryId) {
        throw new Error('Não foi possível criar a entrada da fila.');
      }

      // Link reverso (opcional)
      try {
        await supabase
          .from('appointments')
          .update({ waitlist_entry_id: insertedEntryId } as any)
          .eq('id', insertedAppointmentId);
      } catch {
        // ignore
      }

      toast.success('✅ Você entrou na fila de espera!');
      setShowJoinWaitlistForm(false);
      setWaitlistSelectedServiceIds([]);
      await fetchWaitlist();
    } catch (e: any) {
      console.error('❌ Erro ao entrar na fila:', e);
      toast.error(e?.message || 'Erro ao entrar na fila');
    }
  };

  const handleSairDaFila = async () => {
    if (!establishment?.id) return;
    if (!filaEsperaAtiva) {
      toast.error('Fila de espera não está ativa neste estabelecimento.');
      return;
    }
    if (filaEsperaFechada) {
      toast.error('Fila de espera está fechada no momento.');
      return;
    }

    const phoneDigits = normalizeWhatsappForStorage(leaveWaitlistPhone);
    if (!phoneDigits) {
      toast.error('Informe o telefone/WhatsApp que você usou para entrar na fila.');
      return;
    }
    const phoneAlt =
      phoneDigits.startsWith('55') ? phoneDigits.slice(2) : phoneDigits.length >= 10 ? `55${phoneDigits}` : '';

    try {
      // Pegar a entrada mais recente desse telefone (se a pessoa entrou mais de uma vez)
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('id, appointment_id')
        .eq('establishment_id', establishment.id)
        .eq('status', 'waiting')
        .in('client_whatsapp', [phoneDigits, phoneAlt].filter(Boolean))
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      const entryId = (data as any[])?.[0]?.id;
      const appointmentId = (data as any[])?.[0]?.appointment_id;
      if (!entryId) {
        toast.error('Não encontrei ninguém na fila com esse telefone.');
        return;
      }

      const { error: updErr } = await supabase.from('waitlist_entries').update({ status: 'cancelled' } as any).eq('id', entryId);
      if (updErr) {
        // Dica comum: falta policy de UPDATE pro cliente (RLS)
        const msg = String((updErr as any)?.message || '');
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('rls')) {
          toast.error('Sem permissão para sair da fila. O dono precisa rodar o SQL FINAL atualizado (policy de cancelamento).');
          return;
        }
        throw updErr;
      }

      // Se tiver appointment ligado, cancelar também (se o cliente tiver permissão)
      if (appointmentId) {
        try {
          await supabase.from('appointments').update({ status: 'cancelled' } as any).eq('id', appointmentId);
        } catch {
          // ignore
        }
      }

      toast.success('✅ Você saiu da fila.');
      setShowLeaveWaitlistForm(false);
      setLeaveWaitlistPhone('');
      await fetchWaitlist();
    } catch (e: any) {
      console.error('❌ Erro ao sair da fila:', e);
      toast.error(e?.message || 'Erro ao sair da fila');
    }
  };

  console.log('🔍 RENDER - Estados atuais:');
  console.log('  - isLoading:', isLoading);
  console.log('  - establishment:', establishment);
  console.log('  - establishment existe?', !!establishment);
  console.log('  - forceRender:', forceRender);
  console.log('  - showBookingForm:', showBookingForm);

  // ⛔ Removido retry durante render (causava flicker/instabilidade em mobile)

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f0f6ff' }}>
        <div className="container-custom py-8">
          <div className="flex justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Verificar se o booking está bloqueado
  if (isBookingBlocked) {
    const whatsappRaw = establishment?.whatsapp as string | undefined;
    const whatsappDigits = (whatsappRaw || '').replace(/\D/g, '');
    const whatsappE164 =
      whatsappDigits.length === 0 ? '' : whatsappDigits.startsWith('55') ? whatsappDigits : `55${whatsappDigits}`;

    const handleMandarMensagemBarbeiro = () => {
      if (!whatsappE164) {
        toast.error('WhatsApp do barbeiro não está cadastrado.');
        return;
      }

      const mensagem = encodeURIComponent(
        'Opa, fui agendar no Agendei Fácil e não consegui. O que houve?\n\n' +
        'Preciso agendar e não abriu para mim. Diz: "Página desativada temporariamente".'
      );

      window.open(`https://wa.me/${whatsappE164}?text=${mensagem}`, '_blank', 'noopener,noreferrer');
    };

    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f0f6ff' }}>
        <div className="container-custom py-8">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4 text-gray-900">Estabelecimento Inativo</h1>
            <p className="text-gray-600 mb-4 text-lg">Este estabelecimento está inativo.</p>
            <button
              type="button"
              onClick={handleMandarMensagemBarbeiro}
              className="inline-flex items-center justify-center mt-2 mb-4 px-5 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              Mandar mensagem barbeiro
            </button>
            <div className="mt-1">
              <div className="text-xs text-gray-500">
                {whatsappE164 ? 'Abrirá o WhatsApp para falar com o estabelecimento.' : 'Estabelecimento sem WhatsApp cadastrado.'}
              </div>
            </div>
            <Link to="/" className="text-primary hover:underline">
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f0f6ff' }}>
        <div className="container-custom py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-gray-900">Estabelecimento não encontrado</h1>
            <p className="text-gray-600 mb-4">O estabelecimento que você procura não existe ou foi removido.</p>
            <Link to="/" className="text-primary hover:underline">
              Voltar para a página inicial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  console.log('✅ Estado: RENDERIZANDO PÁGINA PRINCIPAL');
  console.log('🏢 Estabelecimento para renderizar:', establishment);

  // Pegar o dia da semana em inglês (como está no banco de dados)
  const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase(); // segunda-feira -> monday
  const businessHoursForDay = establishment.business_hours[dayOfWeek];

  // Debug para verificar o mapeamento
  console.log('🗓️ Data selecionada:', format(selectedDate, 'dd/MM/yyyy'));
  console.log('📅 Dia da semana (inglês):', dayOfWeek);
  console.log('🏢 Horários do estabelecimento:', establishment.business_hours);
  console.log('⏰ Horários para este dia:', businessHoursForDay);

  // Converter formato dos horários do banco de dados para o formato da interface
  const convertBusinessHours = (businessHours: any) => {
    if (!businessHours) return null;

    const { open, close, enabled } = businessHours;
    return {
      enabled: enabled || false,
      open1: open || '09:00',
      close1: close || '18:00',
      open2: null,
      close2: null
    };
  };

  // Garantir que os horários estão no formato correto (HH:mm)
  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formattedBusinessHours = businessHoursForDay ? {
    enabled: businessHoursForDay.enabled,
    open1: formatTime(businessHoursForDay.open) || '',
    close1: formatTime(businessHoursForDay.close) || '',
    open2: null,
    close2: null
  } : null;

  const bookingRequireAdvancePayment = (() => {
    const hasPagarMe = !!String((establishment as any)?.pagarme_recipient_id || '').trim();
    const exigirPagarMe = (establishment as any)?.exigir_pagamento_antecipado === true;
    const hasMercadoPago = !!String((establishment as any)?.mercadopago_access_token || '').trim();
    const exigirMercadoPago = (establishment as any)?.exigir_pagamento_antecipado_mercadopago === true;
    const usarMercadoPago = hasMercadoPago && exigirMercadoPago;
    const usarPagarMe = hasPagarMe && exigirPagarMe;
    const algumGatewayExigePagamento = usarMercadoPago || usarPagarMe;
    if (!algumGatewayExigePagamento) return false;
    const pagamentoAdiantadoOpcional = usarMercadoPago
      ? (establishment as any)?.pagamento_adiantado_opcional_mercadopago === true
      : (establishment as any)?.pagamento_adiantado_opcional === true;
    return algumGatewayExigePagamento && !pagamentoAdiantadoOpcional;
  })();
  const bookingChatEnabled = Boolean((establishment as any)?.booking_chat_enabled ?? true);
  const isSimpleBookingPageEnabled = Boolean((establishment as any)?.booking_simple_page_enabled ?? false);

  const handleGoToMyAppointments = () => {
    if (establishment?.code) {
      localStorage.setItem('current_establishment_code', establishment.code);
    }
    if (establishment?.id) {
      localStorage.setItem('current_establishment_id', establishment.id);
    }
    navigate('/view-appointments');
  };

  return (
    <div
      className="app-background relative overflow-x-hidden text-white"
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.42) 100%), radial-gradient(circle at top center, #262626 0%, #161616 35%, #0B0B0B 70%), #0B0B0B'
      }}
    >
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <Link to="/" className="flex items-center gap-2 text-white/80 hover:text-[#e6d7b1] transition-colors shrink-0 min-w-0">
              <ChevronLeft className="w-5 h-5 shrink-0" />
              <span className="truncate">Voltar</span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={handleGoToMyAppointments}
                aria-label="Ver meus agendamentos"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6C78B]/55 bg-[#E6C78B]/12 px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-[#F5E7C2] hover:bg-[#E6C78B]/22 hover:border-[#E6C78B]/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E6C78B]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0B]"
              >
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-90" aria-hidden />
                <span className="whitespace-nowrap">Meus Agendamentos</span>
              </button>
              {user && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors text-sm"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Sair</span>
                </button>
              )}
            </div>
          </div>

          {/* Mensagem de Demonstração (apenas para IDs 3814 e 3315) */}
          {(id === '3814' || id === '3315') && (
            <div className="bg-[#1b160b] text-[#f3e7c7] p-4 rounded-2xl flex flex-col items-center justify-center gap-1 mb-4 sm:flex-row sm:gap-2 border border-[#3b2a16]">
              <AlertCircle className="h-8 w-8 sm:h-5 sm:w-5" />
              <p className="font-semibold text-sm sm:text-base text-center animate-pulse-custom-slow">
                Essa é a pagina que seu cliente ira ver ao acessar o seu link, porem com as suas proprias fotos e links personalizados.
              </p>
            </div>
          )}




          {/* Carrossel atrás do perfil (se configurado) */}
          {!isSimpleBookingPageEnabled && establishment?.carousel_position === 'behind' && hasCarouselPhotos && (
            <div className="relative mb-12">
              {/* Container do carrossel */}
              <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-300 shadow-lg">
                {/* Imagem atual */}
                <div className="relative w-full h-full">
                  <img
                    src={duplicatePhotos[duplicateCarouselIndex]}
                    alt={`Foto ${duplicateCarouselIndex + 1}`}
                    className="w-full h-full object-cover transition-opacity duration-500"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const defaultPhotos = ['/barbeiro ft 1.png', '/barbeiro ft 2.png', '/barbeiro ft 3.png'];
                      target.src = defaultPhotos[duplicateCarouselIndex % defaultPhotos.length];
                    }}
                  />

                  {/* Overlay escuro para melhor contraste dos botões */}
                  <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                </div>

                {/* Botão Anterior */}
                <button
                  onClick={goToPreviousDuplicate}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Botão Próximo */}
                <button
                  onClick={goToNextDuplicate}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                  aria-label="Próxima foto"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Indicadores (bolinhas) - No lado esquerdo */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-10">
                  {duplicatePhotos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlideDuplicate(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${index === duplicateCarouselIndex
                        ? 'bg-white'
                        : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                        }`}
                      aria-label={`Ir para foto ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Contador */}
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-10">
                  {duplicateCarouselIndex + 1} / {duplicatePhotos.length}
                </div>
              </div>

              {/* Logo do Estabelecimento - Sobreposta para fora do carrossel */}
              <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 z-20">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-white">
                  <img
                    src={storagePublicUrlForBrowser(establishment?.logo_url) || '/fotopessoa.png'}
                    alt={establishment?.name || 'Logo'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/fotopessoa.png';
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Logo do Estabelecimento - Só aparece quando carrossel não está atrás */}
          {(isSimpleBookingPageEnabled || establishment?.carousel_position !== 'behind' || !hasCarouselPhotos) && (
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/15 shadow-2xl bg-black/30">
                <img
                  src={storagePublicUrlForBrowser(establishment?.logo_url) || '/fotopessoa.png'}
                  alt={establishment?.name || 'Logo'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/fotopessoa.png';
                  }}
                />
              </div>
            </div>
          )}

          {/* Informações do Estabelecimento */}
          <div className="text-center space-y-2 relative z-30" style={{ marginTop: establishment?.carousel_position === 'behind' && hasCarouselPhotos ? '80px' : '20px' }}>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">{establishment?.name}</h1>
            {!isSimpleBookingPageEnabled && establishment?.description && (
              <p className="text-white/70">
                <ReadMore
                  text={establishment.description}
                  maxLength={60}
                  className="text-white/70"
                />
              </p>
            )}

            {!isSimpleBookingPageEnabled && !establishment?.hide_booking_reviews && (
              <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5">
                  <span className="text-[#E6C78B] tracking-wide">⭐⭐⭐⭐⭐</span>
                  <button
                    type="button"
                    onClick={() => setShowApprovedReviewsModal(true)}
                    className="text-sm text-white/85 hover:text-white transition-colors"
                  >
                    Ver avaliações ({isLoadingApprovedReviews ? '...' : approvedReviews.length})
                  </button>
                  <span className="text-white/30">•</span>
                  <button
                    type="button"
                    onClick={() => setShowCreateReviewModal(true)}
                    className="text-sm text-[#E6C78B] hover:text-[#f3e7c7] transition-colors font-semibold"
                  >
                    Avaliar
                  </button>
                </div>
              </div>
            )}

            {/* Botões de Ação Principal */}
            <div className="mt-6 flex flex-col space-y-6 relative z-10">
              {/* Card premium (estilo do exemplo) */}
              <div
                className="w-full rounded-2xl overflow-hidden border shadow-[0_18px_55px_rgba(0,0,0,0.55)]"
                style={{
                  borderColor: 'rgba(230,199,139,0.20)',
                  background:
                    'radial-gradient(140% 140% at 50% 0%, rgba(230,199,139,0.14) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.65) 100%)',
                }}
              >
                <div className="px-4 pt-5 pb-4 text-center">
                  <div
                    className="text-base text-white/80"
                    style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}
                  >
                    Bem-vindo ao nosso
                  </div>
                  <div className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-wide text-[#E6C78B] drop-shadow">
                    ESTABELECIMENTO
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {/* Item 1 */}
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rotate-45 rounded-xl border border-[#E6C78B]/35 bg-black/25 shadow-[0_10px_30px_rgba(0,0,0,0.55)] flex items-center justify-center">
                        <div className="-rotate-45">
                          <Home className="w-6 h-6 text-[#E6C78B]" />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] leading-tight font-semibold text-white/75">
                        Ambiente<br />Aconchegante
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rotate-45 rounded-xl border border-[#E6C78B]/35 bg-black/25 shadow-[0_10px_30px_rgba(0,0,0,0.55)] flex items-center justify-center">
                        <div className="-rotate-45">
                          <Users className="w-6 h-6 text-[#E6C78B]" />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] leading-tight font-semibold text-white/75">
                        Profissionais<br />Experientes
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rotate-45 rounded-xl border border-[#E6C78B]/35 bg-black/25 shadow-[0_10px_30px_rgba(0,0,0,0.55)] flex items-center justify-center">
                        <div className="-rotate-45">
                          <ThumbsUp className="w-6 h-6 text-[#E6C78B]" />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] leading-tight font-semibold text-white/75">
                        Atendimento<br />de Qualidade
                      </div>
                    </div>
                  </div>
                </div>

                <div className="-mt-2">
                  {/* CTA igual ao exemplo: tarja grande + botão menor escuro "encaixado" */}
                  <div className="px-6 pt-3 pb-7 flex justify-center">
                    <div className="w-full max-w-[520px]">
                      {/* Tarja grande dourada */}
                      <button
                        onClick={handleAgendarClick}
                        className="w-full font-extrabold py-4 px-6 text-base sm:text-lg uppercase tracking-wide transition-all duration-300 flex items-center justify-center text-black rounded-2xl border border-[#f3e7c7]/60 bg-gradient-to-r from-[#e6d7b1] to-[#d9c08c] shadow-[0_18px_45px_rgba(0,0,0,0.40)] hover:brightness-105 active:scale-[0.99]"
                      >
                        AGENDE SEU HORÁRIO
                      </button>

                      {/* Botão menor escuro "encaixado" (SEM cortar no rodapé do card) */}
                      <div className="flex justify-center -mt-4">
                        <button
                          onClick={handleAgendarClick}
                          className="w-[230px] sm:w-[260px] font-extrabold py-2.5 px-4 text-sm uppercase tracking-[0.18em] rounded-2xl transition-all duration-300 border border-[#f3e7c7]/60 bg-[#0b0c0f] text-[#E6C78B] hover:bg-black/70 active:scale-[0.99] agf-heartbeat-cta"
                        >
                          RESERVAR AGORA
                        </button>
                      </div>

                      {/* ✅ Botão Fila de Espera (aba/modal) */}
                      {!isSimpleBookingPageEnabled && filaEsperaAtiva && (
                        <div className="flex justify-center mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (filaEsperaFechada) return;
                              setShowWaitlistModal(true);
                              setShowJoinWaitlistForm(false);
                            }}
                            className={`w-[230px] sm:w-[260px] font-extrabold py-2.5 px-4 text-sm uppercase tracking-[0.18em] rounded-2xl transition-all duration-300 border border-white/15 active:scale-[0.99] ${filaEsperaFechada
                              ? 'bg-white/5 text-white/50 cursor-not-allowed'
                              : 'bg-white/5 text-white/90 hover:bg-white/10'
                              }`}
                          >
                            {filaEsperaFechada ? 'FILA FECHADA' : 'FILA DE ESPERA'}
                          </button>
                        </div>
                      )}

                      {/* ✅ Link Segunda Unidade: só mostra se o código estiver preenchido (não zerado) */}
                      {!isSimpleBookingPageEnabled && (() => {
                        const code = String((establishment as any)?.second_unit_booking_code ?? '').trim();
                        return code.length > 0;
                      })() && (
                          <div className="flex justify-center mt-4">
                            <a
                              href={`https://agendeifacil.com/booking/${String((establishment as any).second_unit_booking_code).trim()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full max-w-[340px] rounded-2xl border-2 border-[#E6C78B]/50 bg-gradient-to-b from-[#E6C78B]/15 to-[#d9c08c]/10 py-3 px-4 text-center flex flex-col gap-1 shadow-lg hover:from-[#E6C78B]/25 hover:to-[#d9c08c]/20 hover:border-[#E6C78B]/70 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
                            >
                              <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-[#E6C78B]">Agendar outra unidade</span>
                              <span className="font-bold text-white text-base leading-tight">{secondUnitName || 'Segunda Unidade'}</span>
                              {(establishment as any)?.second_unit_label && (
                                <span className="text-xs font-medium text-white/80">{(establishment as any).second_unit_label}</span>
                              )}
                            </a>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dropdown SER ASSINANTE */}
              {visibleSubscriptions.length > 0 && (
                (() => {
                  let showFull = false;
                  try {
                    showFull = Boolean((establishment as any)?.show_subscriptions_fullpage === true) ||
                      (establishment?.id && localStorage.getItem(`show_subscriptions_fullpage_${establishment.id}`) === 'true');
                  } catch {
                    showFull = Boolean((establishment as any)?.show_subscriptions_fullpage === true);
                  }

                  const SubscriptionsList = ({ compact }: { compact: boolean }) => (
                    <div
                      className={`${compact ? 'absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto' : 'mt-2 overflow-hidden'} bg-[#0f0f10] border border-white/10 rounded-xl shadow-2xl`}
                      style={{ zIndex: 100 }}
                    >
                      {visibleSubscriptions.map((subscription) => (
                        <div
                          key={subscription.id}
                          className="p-3 hover:bg-white/5 border-b border-white/10 last:border-b-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex-1 min-w-0 text-center sm:text-left">
                            <div className="font-semibold text-white text-base leading-tight break-words sm:truncate">
                              {subscription.name || 'Assinatura'}
                            </div>
                            <div className="text-sm text-white/60">
                              R$ {(subscription.value || 0).toFixed(2).replace('.', ',')} / {subscription.duration_months || 1}{' '}
                              {subscription.duration_months === 1 ? 'mês' : 'meses'}
                            </div>
                            {subscription.weekdays && subscription.weekdays.length > 0 && (
                              <div className="text-xs text-[#e6d7b1] mt-1 break-words">
                                📅 {(() => {
                                  const weekdayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                                  const weekdayLabels: Record<string, string> = {
                                    monday: 'Seg',
                                    tuesday: 'Ter',
                                    wednesday: 'Qua',
                                    thursday: 'Qui',
                                    friday: 'Sex',
                                    saturday: 'Sáb',
                                    sunday: 'Dom',
                                  };
                                  const weekdayAlias: Record<string, string> = {
                                    monday: 'monday',
                                    segunda: 'monday',
                                    seg: 'monday',
                                    tuesday: 'tuesday',
                                    terca: 'tuesday',
                                    terça: 'tuesday',
                                    ter: 'tuesday',
                                    wednesday: 'wednesday',
                                    quarta: 'wednesday',
                                    qua: 'wednesday',
                                    thursday: 'thursday',
                                    quinta: 'thursday',
                                    qui: 'thursday',
                                    friday: 'friday',
                                    sexta: 'friday',
                                    sex: 'friday',
                                    saturday: 'saturday',
                                    sabado: 'saturday',
                                    sábado: 'saturday',
                                    sab: 'saturday',
                                    sáb: 'saturday',
                                    sunday: 'sunday',
                                    domingo: 'sunday',
                                    dom: 'sunday',
                                  };

                                  const toCanonical = (rawDay: string) => {
                                    const normalized = String(rawDay || '').trim().toLowerCase();
                                    return weekdayAlias[normalized] || normalized;
                                  };

                                  const orderedLabels = subscription.weekdays
                                    .map((rawDay: string) => toCanonical(rawDay))
                                    .sort((a: string, b: string) => {
                                      const aIndex = weekdayOrder.indexOf(a);
                                      const bIndex = weekdayOrder.indexOf(b);
                                      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, 'pt-BR');
                                      if (aIndex === -1) return 1;
                                      if (bIndex === -1) return -1;
                                      return aIndex - bIndex;
                                    })
                                    .map((day: string) => weekdayLabels[day] || day);

                                  return orderedLabels.join(', ');
                                })()}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto sm:justify-end">
                            {subscription.description && (
                              <button
                                onClick={() => {
                                  alert(`📋 ${subscription.name}\n\n${subscription.description}`);
                                }}
                                className="bg-white/10 hover:bg-white/15 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors border border-white/10"
                                title="Ver informações sobre esta assinatura"
                              >
                                Sobre
                              </button>
                            )}
                            <button
                              onClick={() => {
                                handleSubscribeClick(subscription);
                              }}
                              className="bg-[#e6d7b1] hover:bg-[#f3e7c7] text-black px-3 py-1 rounded-lg text-sm font-extrabold transition-colors"
                            >
                              Assinar
                            </button>
                            <button
                              onClick={() => openRenewLookupForSubscription(subscription)}
                              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg text-sm font-extrabold transition-colors border border-white/20"
                            >
                              Renovar
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Item fixo SABER MAIS */}
                      <div className="p-3 border-t border-white/10 bg-black/30">
                        <button
                          onClick={() => {
                            handleSaberMaisClick();
                          }}
                          className="w-full text-center text-[#e6d7b1] hover:text-[#f3e7c7] font-semibold text-sm transition-colors"
                        >
                          📞 SABER MAIS
                        </button>
                      </div>
                    </div>
                  );

                  // ✅ Novo modo: mostrar todas as assinaturas na página (sem dropdown)
                  if (showFull) {
                    return (
                      <div className="relative" style={{ position: 'relative', zIndex: 100 }}>
                        <div className="flex items-center justify-center gap-2 py-2">
                          <img src="/coroa.png" alt="Coroa" className="h-8 w-8 opacity-80" />
                          <span className="text-white/70 font-extrabold text-sm uppercase tracking-[0.22em]">
                            PLANOS MENSAIS
                          </span>
                        </div>
                        <SubscriptionsList compact={false} />
                      </div>
                    );
                  }

                  // ✅ Modo antigo: dropdown
                  return (
                    <div className="relative subscriptions-dropdown" style={{ position: 'relative', zIndex: 100 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowSubscriptionsDropdown(!showSubscriptionsDropdown);
                        }}
                        className="w-full font-extrabold py-4 px-6 text-base uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-3 relative group text-black rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                      >
                        <img src="/coroa.png" alt="Coroa" className="h-10 w-10 relative z-10" />
                        <span className="relative z-10 text-white/70">PLANOS MENSAIS</span>
                        <ChevronRight className="h-5 w-5 relative z-10 opacity-70" />
                      </button>

                      {showSubscriptionsDropdown && <SubscriptionsList compact={true} />}
                    </div>
                  );
                })()
              )}


              {/* Imagens INSTAGRAM, PIX e WHATSAPP lado a lado */}
              {!isSimpleBookingPageEnabled && (() => {
                const normalizedPixKey = String(establishment?.pix_key || '').trim();
                const hasPixKey = normalizedPixKey.length > 0 && normalizedPixKey.toLowerCase() !== 'naotenhopix';
                const lineOffsetPx = hasPixKey ? 120 : 80;

                return (
                  <div className="flex items-center justify-center gap-6 relative my-10">
                    {/* Linha esquerda - vai da borda até antes do Instagram com distância */}
                    <div
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 h-px bg-white/10"
                      style={{ width: `calc(50% - ${lineOffsetPx}px)` }}
                    ></div>

                    {/* Linha direita - vai depois do WhatsApp até a borda com distância */}
                    <div
                      className="absolute right-0 top-1/2 transform -translate-y-1/2 h-px bg-white/10"
                      style={{ width: `calc(50% - ${lineOffsetPx}px)` }}
                    ></div>
                    {/* Instagram */}
                    <a
                      href={establishment?.social_media_link && !establishment.social_media_link.startsWith('http') ? `https://${establishment.social_media_link}` : establishment.social_media_link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group transition-all duration-200 ${establishment?.social_media_link
                        ? 'cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                        }`}
                    >
                      <div className="booking-social-icon transition-transform duration-200 group-hover:scale-[1.03]">
                        <img
                          src="/INST.png"
                          alt="Instagram"
                          className="absolute inset-0 m-auto h-11 w-11 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                        />
                      </div>
                    </a>

                    {/* PIX (só aparece se tiver chave válida; "naotenhopix" desativa) */}
                    {hasPixKey && (
                      <button
                        onClick={() => {
                          console.log('🔍 PIX Click - establishment:', establishment);
                          console.log('🔍 PIX Click - pix_key:', establishment?.pix_key);

                          // Método que funciona no mobile e desktop
                          const copyToClipboard = (text: string) => {
                            // Criar um input temporário
                            const input = document.createElement('input');
                            input.value = text;
                            input.style.position = 'fixed';
                            input.style.opacity = '0';
                            input.style.left = '-9999px';
                            document.body.appendChild(input);

                            // Selecionar e copiar
                            input.select();
                            input.setSelectionRange(0, 99999); // Para mobile

                            try {
                              const successful = document.execCommand('copy');
                              if (successful) {
                                console.log('✅ PIX copiado com sucesso:', text);
                                toast.success('Chave PIX copiada com sucesso!');
                              } else {
                                throw new Error('Falha na cópia');
                              }
                            } catch (err) {
                              console.error('❌ Erro ao copiar PIX:', err);
                              toast.error('Erro ao copiar chave PIX. Tente novamente.');
                            } finally {
                              // Remover o input temporário
                              document.body.removeChild(input);
                            }
                          };

                          copyToClipboard(normalizedPixKey);
                        }}
                        className="group transition-all duration-200 cursor-pointer"
                      >
                        <div className="booking-social-icon transition-transform duration-200 group-hover:scale-[1.03]">
                          <img
                            src="/PIX.png"
                            alt="PIX"
                            className="absolute inset-0 m-auto h-11 w-11 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                          />
                        </div>
                      </button>
                    )}

                    {/* WhatsApp */}
                    <a
                      href={establishment?.whatsapp ? (() => {
                        let phoneNumber = establishment.whatsapp.replace(/\D/g, '');

                        // Lista de códigos de países com validação de tamanho mínimo
                        const countryCodes = [
                          { code: '351', minLength: 12 },
                          { code: '244', minLength: 12 },
                          { code: '54', minLength: 12 },
                          { code: '56', minLength: 11 },
                          { code: '55', minLength: 12 },
                          { code: '34', minLength: 11 },
                          { code: '1', minLength: 11 }
                        ];

                        // Verificar se o número já começa com algum código de país E tem tamanho válido
                        const hasCountryCode = countryCodes.some(
                          ({ code, minLength }) => phoneNumber.startsWith(code) && phoneNumber.length >= minLength
                        );

                        // Se não tiver código de país e for número brasileiro (10 ou 11 dígitos), adicionar 55
                        if (!hasCountryCode) {
                          if (phoneNumber.length >= 10 && phoneNumber.length <= 11) {
                            phoneNumber = '55' + phoneNumber;
                          }
                        }

                        return `https://wa.me/${phoneNumber}`;
                      })() : '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group transition-all duration-200 ${establishment?.whatsapp
                        ? 'cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                        }`}
                    >
                      <div className="booking-social-icon transition-transform duration-200 group-hover:scale-[1.03]">
                        <img
                          src="/wppicon.png"
                          alt="WhatsApp"
                          className="absolute inset-0 m-auto h-11 w-11 drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]"
                        />
                      </div>
                    </a>
                  </div>
                );
              })()}

              {/* Botões NOS AVALIE e LOCAL - Abaixo dos ícones */}
              {!isSimpleBookingPageEnabled && (
                <div className="flex gap-3 mt-6">
                  {/* Botão NOS AVALIE */}
                  <a
                    href={establishment?.review_link && !establishment.review_link.startsWith('http') ? `https://${establishment.review_link}` : establishment.review_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 font-extrabold py-3 px-4 text-sm uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 relative group rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${establishment?.review_link
                      ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-60'
                      }`}
                  >
                    <img src="/google.png" alt="Google" className="h-5 w-5 relative z-10" />
                    <span className="relative z-10 whitespace-nowrap text-[#e6d7b1]">AVALIE-NOS</span>
                    {establishment?.review_link && <ChevronRight className="h-4 w-4 relative z-10 opacity-80 flex-shrink-0 text-white/70" />}
                  </a>

                  {/* Botão LOCAL */}
                  <a
                    href={establishment?.location_link && !establishment.location_link.startsWith('http') ? `https://${establishment.location_link}` : establishment.location_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex-1 font-extrabold py-3 px-4 text-sm uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 relative group rounded-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${establishment?.location_link
                      ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                      : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed opacity-60'
                      }`}
                  >
                    <img src="/LOCAL.png" alt="Localização" className="h-5 w-5 relative z-10" />
                    <span className="relative z-10 whitespace-nowrap text-[#e6d7b1]">LOCAL</span>
                    {establishment?.location_link && <ChevronRight className="h-4 w-4 relative z-10 opacity-80 flex-shrink-0 text-white/70" />}
                  </a>
                </div>
              )}

              {/* Tela de Agendamento Assinante - Posicionada após os botões */}
              {showSubscriberBooking && (
                <div data-subscriber-booking className="bg-white/5 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] border border-white/10 p-6 text-white mt-4 z-50 relative">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-extrabold">Agendamento Assinante</h2>
                    <button
                      onClick={() => {
                        setShowSubscriberBooking(false);
                        setSelectedSubscriberService(null);
                        resetDividedSubscriberSelection();
                        setSelectedSubscriberExtraServiceIds([]);
                      }}
                      className="text-white/60 hover:text-white text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  {!selectedSubscriberService ? (
                    // Tela de seleção de serviços
                    <div>
                      <p className="text-lg text-white/75 mb-6">Selecione qual é o seu:</p>
                      <div className="space-y-4">
                        {subscriberServicesForBooking.map((subscription) => (
                          <div key={subscription.id} className="border border-white/10 rounded-2xl p-4 bg-black/30 hover:bg-white/5 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-extrabold text-white">{subscription.name}</h3>
                                <p className="text-sm text-white/60">
                                  R$ {subscription.value.toFixed(2).replace('.', ',')}
                                </p>
                                {subscription.weekdays && subscription.weekdays.length > 0 && (
                                  <p className="text-xs text-[#e6d7b1] mt-1">
                                    📅 {subscription.weekdays.map((day: string) => {
                                      const dayNames = {
                                        'monday': 'Seg',
                                        'tuesday': 'Ter',
                                        'wednesday': 'Qua',
                                        'thursday': 'Qui',
                                        'friday': 'Sex',
                                        'saturday': 'Sáb',
                                        'sunday': 'Dom'
                                      };
                                      return dayNames[day as keyof typeof dayNames] || day;
                                    }).join(', ')}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedSubscriberService(subscription);
                                  resetDividedSubscriberSelection();
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                              >
                                Agendar
                              </button>
                            </div>
                          </div>
                        ))}
                        {subscriberServicesForBooking.length === 0 && (
                          <div className="border border-yellow-300/40 rounded-2xl p-4 bg-yellow-500/10 text-yellow-100">
                            Não encontramos o plano ativo deste assinante para agendamento. Peça ao estabelecimento para verificar o cadastro.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Tela de agendamento com restrição de dias
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">
                          {shouldSelectDividedServiceFirst
                            ? `${selectedSubscriberService.name} - Escolha seu servico`
                            : selectedSubscriberService.name}
                        </h3>
                        <button
                          onClick={() => {
                            setSelectedSubscriberService(null);
                            resetDividedSubscriberSelection();
                            setSelectedSubscriberExtraServiceIds([]);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ← Voltar
                        </button>
                      </div>
                      {shouldShowDividedServicesChooser ? (
                        <div className="space-y-3">
                          <p className="text-sm text-white/75">
                            Selecione um ou mais servicos da assinatura antes de escolher o profissional.
                          </p>
                          {dividedServicesForSelectedSubscription.map((service: any) => (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => handleToggleDividedSubscriberService(service)}
                              className={`w-full text-left border rounded-2xl p-4 transition-colors ${selectedDividedSubscriberServices.some((item: any) => String(item?.id || '').trim() === String(service.id || '').trim())
                                  ? 'border-emerald-300/70 bg-emerald-500/20'
                                  : 'border-white/10 bg-black/30 hover:bg-white/5'
                                }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h4 className="font-semibold text-white">{service.name}</h4>
                                  <p className="text-xs text-white/70 mt-1">
                                    Tempo: {service.duration} min • Limite na assinatura: {service.limit}
                                  </p>
                                </div>
                                <span className="px-3 py-1 text-xs rounded-full bg-white/10 text-white/80">
                                  {selectedDividedSubscriberServices.some((item: any) => String(item?.id || '').trim() === String(service.id || '').trim()) ? 'Selecionado' : 'Selecionar'}
                                </span>
                              </div>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setHasConfirmedDividedSubscriberServices(true)}
                            disabled={selectedDividedSubscriberServices.length === 0}
                            className={`w-full rounded-lg py-2.5 font-semibold transition-colors ${selectedDividedSubscriberServices.length === 0
                                ? 'bg-white/10 text-white/50 cursor-not-allowed'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                              }`}
                          >
                            Continuar com {selectedDividedSubscriberServices.length} serviço(s)
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-600 mb-4">
                            📅 Dias disponíveis: {selectedSubscriberService.weekdays?.map((day: string) => {
                              const dayNames = {
                                'monday': 'Segunda',
                                'tuesday': 'Terça',
                                'wednesday': 'Quarta',
                                'thursday': 'Quinta',
                                'friday': 'Sexta',
                                'saturday': 'Sábado',
                                'sunday': 'Domingo'
                              };
                              return dayNames[day as keyof typeof dayNames] || day;
                            }).join(', ') || 'Não configurado'}
                          </p>

                          {shouldSelectDividedServiceFirst && selectedDividedSubscriberServices.length > 0 && (
                            <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                              Serviços selecionados: <strong>{selectedDividedSubscriberServices.map((service: any) => service.name).join(', ')}</strong> ({selectedDividedSubscriberTotalDuration} min no total)
                              <button
                                type="button"
                                onClick={() => setHasConfirmedDividedSubscriberServices(false)}
                                className="ml-2 underline"
                              >
                                editar seleção
                              </button>
                            </div>
                          )}

                          {subscriberExtraServiceCategories.length > 0 && (
                            <div className="mb-4 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h4 className="text-sm font-semibold text-violet-100">
                                  Serviços extras para assinante
                                </h4>
                                <span className="text-xs text-violet-100/90">
                                  {selectedSubscriberExtraServiceIds.length}/{MAX_SUBSCRIBER_EXTRA_SERVICES} selecionados
                                </span>
                              </div>
                              <p className="text-xs text-violet-100/85 mb-3">
                                Você pode marcar até {MAX_SUBSCRIBER_EXTRA_SERVICES} serviços extras.
                              </p>

                              <div className="space-y-3">
                                {subscriberExtraServiceCategories.map((category: any) => (
                                  <div key={`subscriber-extra-dark-${category.id}`}>
                                    <div className="text-xs font-semibold text-violet-100/90 mb-1">
                                      {category.name}
                                    </div>
                                    <div className="space-y-2">
                                      {(category.services || []).map((service: any) => {
                                        const serviceId = String(service?.id || '').trim();
                                        const isSelected = selectedSubscriberExtraServiceIds.includes(serviceId);
                                        const isDisabled = !isSelected && selectedSubscriberExtraServiceIds.length >= MAX_SUBSCRIBER_EXTRA_SERVICES;
                                        return (
                                          <div
                                            key={`subscriber-extra-dark-${serviceId}`}
                                            className={`rounded-lg border p-2 ${isSelected ? 'border-violet-300/70 bg-violet-500/20' : 'border-white/10 bg-black/20'} ${isDisabled ? 'opacity-60' : ''}`}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div>
                                                <div className="text-sm font-medium text-white">{service.name}</div>
                                                <div className="text-xs text-white/75">
                                                  +{Number(service?.duration || 0)} min • R$ {Number(service?.price || 0).toFixed(2).replace('.', ',')}
                                                </div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => handleToggleSubscriberExtraService(serviceId)}
                                                disabled={isDisabled}
                                                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${isSelected ? 'bg-violet-600 text-white border-violet-500' : 'bg-white/10 text-white border-white/20 hover:bg-white/15'} ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                              >
                                                {isSelected ? 'Selecionado' : 'Selecionar'}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-3 text-xs text-violet-100/90">
                                Total extra: <strong>R$ {subscriberExtraTotalPrice.toFixed(2).replace('.', ',')}</strong> • Tempo extra: <strong>{subscriberExtraTotalDuration} min</strong>
                              </div>
                            </div>
                          )}

                          <div className="mb-4">
                            <button
                              type="button"
                              onClick={scrollToSubscriberProfessionalStep}
                              className="w-full rounded-xl bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 transition-colors"
                            >
                              Próximo passo
                            </button>
                          </div>

                          <div data-subscriber-appointment-form>
                            <AppointmentForm
                              establishment={establishment}
                              onSubmit={handleSubmit}
                              selectedDate={selectedDate}
                              onSelectDate={setSelectedDate}
                              existingAppointments={existingAppointments}
                              bookingHighlightedProducts={bookingHighlightedProducts}
                              subscriberService={currentSubscriberServiceForBooking} // Passar o serviço para restringir dias
                              subscriberExtraServices={selectedSubscriberExtraServices}
                              isSubscriberBooking={true} // Indica que é agendamento de assinante
                              guestClientData={guestClientData} // Passar dados do cliente para preenchimento automático
                              onRequestChangeSubscriberService={handleRequestChangeSubscriberService}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Carrossel de Fotos embaixo (se configurado ou padrão) */}
              {!isSimpleBookingPageEnabled && (establishment?.carousel_position === 'below' || !establishment?.carousel_position) && hasCarouselPhotos && (
                <div className="mt-4 mb-2 rounded-lg overflow-hidden">
                  <div className="relative">
                    <div className="relative w-full h-64 md:h-80 lg:h-96 rounded-lg overflow-hidden bg-gray-100">
                      {/* Imagem atual */}
                      <div className="relative w-full h-full">
                        <img
                          src={duplicatePhotos[duplicateCarouselIndex]}
                          alt={`Foto ${duplicateCarouselIndex + 1}`}
                          className="w-full h-full object-cover transition-opacity duration-500"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const defaultPhotos = ['/barbeiro ft 1.png', '/barbeiro ft 2.png', '/barbeiro ft 3.png'];
                            target.src = defaultPhotos[duplicateCarouselIndex % defaultPhotos.length];
                          }}
                        />

                        {/* Overlay escuro para melhor contraste dos botões */}
                        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
                      </div>

                      {/* Botão Anterior */}
                      <button
                        onClick={goToPreviousDuplicate}
                        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                        aria-label="Foto anterior"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      {/* Botão Próximo */}
                      <button
                        onClick={goToNextDuplicate}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200 z-10"
                        aria-label="Próxima foto"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>

                      {/* Indicadores (bolinhas) - No lado esquerdo */}
                      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-10">
                        {duplicatePhotos.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => goToSlideDuplicate(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-200 ${index === duplicateCarouselIndex
                              ? 'bg-white'
                              : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                              }`}
                            aria-label={`Ir para foto ${index + 1}`}
                          />
                        ))}
                      </div>

                      {/* Contador */}
                      <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm z-10">
                        {duplicateCarouselIndex + 1} / {duplicatePhotos.length}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Profissionais (premium) - acima de Comodidades */}
              {!isSimpleBookingPageEnabled && establishment?.professionals && establishment.professionals.filter((p: any) => !p.hidden_from_booking).length > 0 && (
                <div className="mt-8 mb-6">
                  <div
                    className="rounded-2xl px-4 py-4 border shadow-[0_18px_55px_rgba(0,0,0,0.55)]"
                    style={{
                      background:
                        'radial-gradient(120% 140% at 50% 0%, rgba(230,199,139,0.10) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.55) 100%)',
                      borderColor: 'rgba(230,199,139,0.22)'
                    }}
                  >
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="h-px w-10 bg-[#E6C78B]/40" />
                      <div className="text-center">
                        <div className="text-[12px] font-extrabold tracking-[0.22em] text-[#E6C78B] drop-shadow">
                          NOSSOS PROFISSIONAIS
                        </div>
                      </div>
                      <div className="h-px w-10 bg-[#E6C78B]/40" />
                    </div>

                    <div className="overflow-x-auto scrollbar-hide">
                      <div className="flex items-start justify-center gap-5 pb-1 min-w-max px-1">
                        {establishment.professionals
                          .filter((p: any) => !p.hidden_from_booking)
                          .map((professional: any) => (
                            <div
                              key={professional.id}
                              className="flex flex-col items-center flex-shrink-0 select-none"
                              aria-label={`Profissional ${professional.name}`}
                            >
                              <div
                                className="relative w-[68px] h-[68px] rounded-full overflow-hidden"
                                style={{
                                  border: '2px solid rgba(230,199,139,0.60)',
                                  boxShadow: '0 14px 35px rgba(0,0,0,0.55)'
                                }}
                              >
                                <img
                                  src={storagePublicUrlForBrowser((professional as any).photo_url) || '/fotopessoa.png'}
                                  loading="lazy"
                                  decoding="async"
                                  alt={professional.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/fotopessoa.png';
                                  }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                              </div>
                              <span className="mt-2 text-sm font-semibold text-white/90 text-center max-w-[90px] truncate">
                                {professional.name}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Seção de Comodidades - Só mostra se houver pelo menos 1 ativa */}
              {!isSimpleBookingPageEnabled && (establishment?.has_wifi || establishment?.has_parking || establishment?.has_accessibility || establishment?.has_air_conditioning || enabledCustomAmenities.length > 0) && (
                <div
                  className="mt-8 mb-6 p-6"
                  style={{
                    background: '#1A1A1A',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                  }}
                >
                  <h3 className="text-center text-xl font-semibold" style={{ color: '#E6C78B' }}>
                    Comodidades
                  </h3>
                  <p className="text-center text-sm mt-2" style={{ color: '#A1A1A1' }}>
                    Selecione uma comodidade para saber mais.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {/* Wi-Fi */}
                    {establishment?.has_wifi && (
                      <button
                        type="button"
                        onClick={() => {
                          if (establishment?.wifi_password) {
                            navigator.clipboard.writeText(establishment.wifi_password);
                            toast.success('Senha do Wi-Fi copiada!');
                          }
                        }}
                        className="flex flex-col items-center justify-center py-6 px-4 active:scale-[0.97] transition-transform"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                        title={establishment?.wifi_password ? 'Clique para copiar a senha do Wi-Fi' : 'Wi-Fi disponível'}
                      >
                        {establishment?.wifi_network_name && (
                          <span className="text-xs font-semibold mb-2" style={{ color: '#E6C78B' }}>
                            {establishment.wifi_network_name}
                          </span>
                        )}
                        <img
                          src={`/wifi.png?v=${Date.now()}`}
                          alt="Wi-Fi"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Wi-Fi
                        </span>
                      </button>
                    )}

                    {/* Estacionamento */}
                    {establishment?.has_parking && (
                      <div
                        className="flex flex-col items-center justify-center py-6 px-4"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                      >
                        <img
                          src={`/car.png?v=${Date.now()}`}
                          alt="Estacionamento"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Estacionamento
                        </span>
                      </div>
                    )}

                    {/* Acessibilidade */}
                    {establishment?.has_accessibility && (
                      <div
                        className="flex flex-col items-center justify-center py-6 px-4"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                      >
                        <img
                          src={`/wheelchair.png?v=${Date.now()}`}
                          alt="Acessibilidade"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Acessibilidade
                        </span>
                      </div>
                    )}

                    {/* Climatizado */}
                    {establishment?.has_air_conditioning && (
                      <div
                        className="flex flex-col items-center justify-center py-6 px-4"
                        style={{
                          background: '#151515',
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                        }}
                      >
                        <img
                          src={`/arcondicionado.png?v=${Date.now()}`}
                          alt="Climatizado"
                          className="amenity-icon-gold h-8 w-8"
                        />
                        <span className="mt-3 text-base font-semibold" style={{ color: '#A1A1A1' }}>
                          Climatizado
                        </span>
                      </div>
                    )}

                    {enabledCustomAmenities.map((amenity) => {
                      const AmenityIcon = BOOKING_CUSTOM_AMENITY_ICONS[amenity.icon] || Star;
                      return (
                        <div
                          key={amenity.id}
                          className="flex flex-col items-center justify-center py-6 px-4"
                          style={{
                            background: '#151515',
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                          }}
                        >
                          <AmenityIcon className="amenity-icon-gold h-8 w-8" />
                          <span className="mt-3 text-base font-semibold text-center" style={{ color: '#A1A1A1' }}>
                            {amenity.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção de Horário de Atendimento */}
              {!isSimpleBookingPageEnabled && (
                <div className="mt-8 mb-6 bg-white/5 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] border border-white/10">
                  <button
                    onClick={() => setShowBusinessHours(!showBusinessHours)}
                    className="w-full flex items-center justify-between gap-3 mb-4 hover:bg-white/5 p-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center border border-white/10">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-extrabold text-white">Horário de atendimento</h3>
                        <p className="text-sm text-white/60">Clique para ver os horários</p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-white/60 transition-transform duration-200 ${showBusinessHours ? 'rotate-180' : ''
                        }`}
                    />
                  </button>

                  {showBusinessHours && establishment?.business_hours && (
                    <div className="space-y-2">
                      {[
                        { dia: 'Segunda', key: 'monday' },
                        { dia: 'Terça', key: 'tuesday' },
                        { dia: 'Quarta', key: 'wednesday' },
                        { dia: 'Quinta', key: 'thursday' },
                        { dia: 'Sexta', key: 'friday' },
                        { dia: 'Sábado', key: 'saturday' },
                        { dia: 'Domingo', key: 'sunday' }
                      ].map(({ dia, key }) => {
                        const hoje = new Date().getDay();
                        const diaDaSemana = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        const isHoje = diaDaSemana[hoje] === key;
                        const horarios = establishment.business_hours[key];

                        if (!horarios?.enabled) return null;

                        const formatHorario = (horarios: any) => {
                          if (!horarios?.open1) return 'Fechado';

                          const normalizeHHmm = (value: unknown): string => String(value || '').trim();
                          const open1 = normalizeHHmm(horarios.open1);
                          const close1 = normalizeHHmm(horarios.close1);
                          const open2 = normalizeHHmm(horarios.open2);
                          const close2 = normalizeHHmm(horarios.close2);

                          const isRealIntervalTime = (value: string): boolean => {
                            if (!value) return false;
                            if (value === '00:00') return false;
                            return /^\d{2}:\d{2}$/.test(value);
                          };

                          let horario = `${open1} - ${close1}`;

                          // Se não existir intervalo real (ex.: "Sem intervalo", salvo como 00:00),
                          // não exibir os campos de intervalo na página de booking.
                          if (isRealIntervalTime(open2) && isRealIntervalTime(close2)) {
                            horario += ` e ${open2} - ${close2}`;
                          }

                          return horario;
                        };

                        const isOpen = horarios?.enabled && horarios?.open1;
                        const horarioText = formatHorario(horarios);

                        return (
                          <div
                            key={dia}
                            className={`flex justify-between items-center p-3 rounded-xl border border-white/10 ${isOpen ? 'bg-emerald-500/10' : 'bg-white/5'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-white/30'
                                }`}></div>
                              <span className="text-sm font-semibold text-white">{dia}</span>
                              {isHoje && (
                                <span className="text-xs px-2 py-1 bg-emerald-500/15 text-emerald-200 rounded-full border border-emerald-400/20">
                                  Hoje
                                </span>
                              )}
                            </div>
                            <span className={`text-sm font-semibold ${isOpen ? 'text-emerald-200' : 'text-white/60'
                              }`}>
                              {horarioText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Imagem Melhor do Brasil */}
              {!isSimpleBookingPageEnabled && establishment?.show_best_of_brazil_image && (
                <div className="mt-6 mb-4">
                  <img
                    src="/melhordobrasil.png"
                    alt="Melhor do Brasil"
                    className="w-full h-auto rounded-lg shadow-lg"
                  />
                  {/* Botão Baixar App abaixo da imagem */}
                  {!isPWA() && (
                    <div className="mt-3">
                      <button
                        onClick={handleDownloadApp}
                        className="w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/15 transition-colors font-semibold border border-white/10"
                      >
                        <Download className="w-4 h-4" />
                        Baixar app
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Modal bonito com instruções de instalação */}
              {!isSimpleBookingPageEnabled && showInstallGuide && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                  <div className="bg-[#0f0f10] rounded-2xl border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.7)] w-full max-w-md overflow-hidden">
                    <div className="bg-gradient-to-r from-[#e6d7b1] to-[#d9c08c] p-5">
                      <h3 className="text-black text-lg font-extrabold flex items-center gap-2">
                        📲 {installGuideTitle}
                      </h3>
                      <p className="text-black/70 text-sm mt-1">Instale o app do Agendei Fácil e tenha acesso rápido aos seus agendamentos.</p>
                    </div>
                    <div className="p-5 space-y-3 text-white">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✅</span>
                        <p className="text-sm">{installGuideSteps[0]}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✅</span>
                        <p className="text-sm">{installGuideSteps[1]}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-xl">✅</span>
                        <p className="text-sm">{installGuideSteps[2]}</p>
                      </div>
                      <div className="mt-2 rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/70">
                        Dica: após instalar, o app abre em tela cheia e fica no seu menu de apps 📱
                      </div>
                    </div>
                    <div className="p-4 bg-black/30 flex justify-end gap-2 border-t border-white/10">
                      <button
                        onClick={() => setShowInstallGuide(false)}
                        className="px-4 py-2 text-white/80 hover:text-white"
                      >
                        Fechar
                      </button>
                      <button
                        onClick={() => setShowInstallGuide(false)}
                        className="px-4 py-2 bg-[#e6d7b1] text-black rounded-xl hover:bg-[#f3e7c7] font-extrabold"
                      >
                        Entendi
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Link para Agendei Fácil */}
              {!isSimpleBookingPageEnabled && (
                <div className="mt-6 text-center">
                  <a
                    href={id === '8160' ? '/conhecerv4' : 'https://agendeifacil.com'}
                    target={id === '8160' ? '_self' : '_blank'}
                    rel="noopener noreferrer"
                    className="text-[#e6d7b1] hover:text-[#f3e7c7] text-sm font-semibold transition-colors underline"
                  >
                    Quero Agendei Fácil no meu estabelecimento
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Formulário de Agendamento */}
          {showBookingForm && (
            <div
              ref={bookingFormRef}
              className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-6 text-white"
            >
              {(useLegacyBookingFlow || !bookingChatEnabled) ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-extrabold text-white">Fazer Agendamento</h2>
                    {bookingChatEnabled && (
                      <button
                        type="button"
                        onClick={() => setUseLegacyBookingFlow(false)}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
                      >
                        Usar chat guiado
                      </button>
                    )}
                  </div>
                  <AppointmentForm
                    establishment={establishment}
                    onSubmit={handleSubmit}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                    existingAppointments={existingAppointments}
                    bookingHighlightedProducts={bookingHighlightedProducts}
                    requireAdvancePayment={bookingRequireAdvancePayment}
                    onConvertToSubscriber={handleConvertToSubscriber}
                    onOpenRenewSubscription={handleOpenRenewSubscription}
                    subscriberDetectionDisabled={subscriberDetectionDisabled}
                    onSubscriberDetectionDisabledChange={setSubscriberDetectionDisabled}
                    guestClientData={guestClientData}
                  />
                </>
              ) : (
                <BookingChatFlow
                  establishment={establishment}
                  guestClientData={guestClientData}
                  onGuestClientDataCollected={persistGuestClientData}
                  onOpenRenewSubscription={handleOpenRenewSubscription}
                  onCloseChat={() => {
                    setShowBookingForm(false);
                    safeSessionRemove(QUICK_BOOKING_FLOW_KEY);
                    safeSessionRemove(QUICK_BOOKING_DATA_KEY);
                  }}
                  existingAppointments={existingAppointments}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onSubmit={async (appointmentData: any) => {
                    if (bookingRequireAdvancePayment) {
                      setShowBookingForm(false);
                    }
                    await handleSubmit(appointmentData);
                  }}
                  requireAdvancePayment={bookingRequireAdvancePayment}
                  subscriberServices={subscriberServicesForBooking}
                  subscriberExtraServiceCategories={subscriberExtraServiceCategories}
                  bookingHighlightedProducts={bookingHighlightedProducts}
                />
              )}
            </div>
          )}

          {showSubscriberBooking && (
            <div className="bg-red-100 border-4 border-red-500 rounded-lg shadow-md p-6 text-gray-900 mt-4 z-50 relative">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Agendamento Assinante</h2>
                <button
                  onClick={() => {
                    setShowSubscriberBooking(false);
                    setSelectedSubscriberService(null);
                    resetDividedSubscriberSelection();
                    setSelectedSubscriberExtraServiceIds([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {!selectedSubscriberService ? (
                // Tela de seleção de serviços
                <div>
                  <p className="text-lg text-gray-700 mb-6">Selecione qual é o seu:</p>
                  <div className="space-y-4">
                    {subscriberServicesForBooking.map((subscription) => (
                      <div key={subscription.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">{subscription.name}</h3>
                            <p className="text-sm text-gray-600">
                              R$ {subscription.value.toFixed(2).replace('.', ',')}
                            </p>
                            {subscription.weekdays && subscription.weekdays.length > 0 && (
                              <p className="text-xs text-blue-600 mt-1">
                                📅 {subscription.weekdays.map((day: string) => {
                                  const dayNames = {
                                    'monday': 'Seg',
                                    'tuesday': 'Ter',
                                    'wednesday': 'Qua',
                                    'thursday': 'Qui',
                                    'friday': 'Sex',
                                    'saturday': 'Sáb',
                                    'sunday': 'Dom'
                                  };
                                  return dayNames[day as keyof typeof dayNames] || day;
                                }).join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setSelectedSubscriberService(subscription);
                              resetDividedSubscriberSelection();
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          >
                            Agendar
                          </button>
                        </div>
                      </div>
                    ))}
                    {subscriberServicesForBooking.length === 0 && (
                      <div className="border border-yellow-300 rounded-lg p-4 bg-yellow-50 text-yellow-800">
                        Não encontramos o plano ativo deste assinante para agendamento. Peça ao estabelecimento para verificar o cadastro.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // Tela de agendamento com restrição de dias
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      {shouldSelectDividedServiceFirst
                        ? `${selectedSubscriberService.name} - Escolha seu servico`
                        : selectedSubscriberService.name}
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedSubscriberService(null);
                        resetDividedSubscriberSelection();
                        setSelectedSubscriberExtraServiceIds([]);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ← Voltar
                    </button>
                  </div>
                  {shouldShowDividedServicesChooser ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-700">
                        Selecione um ou mais servicos da assinatura antes de escolher o profissional.
                      </p>
                      {dividedServicesForSelectedSubscription.map((service: any) => (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => handleToggleDividedSubscriberService(service)}
                          className={`w-full text-left border rounded-lg p-4 transition-colors ${selectedDividedSubscriberServices.some((item: any) => String(item?.id || '').trim() === String(service.id || '').trim())
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-gray-900">{service.name}</h4>
                              <p className="text-xs text-gray-600 mt-1">
                                Tempo: {service.duration} min • Limite na assinatura: {service.limit}
                              </p>
                            </div>
                            <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                              {selectedDividedSubscriberServices.some((item: any) => String(item?.id || '').trim() === String(service.id || '').trim()) ? 'Selecionado' : 'Selecionar'}
                            </span>
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setHasConfirmedDividedSubscriberServices(true)}
                        disabled={selectedDividedSubscriberServices.length === 0}
                        className={`w-full rounded-lg py-2.5 font-semibold transition-colors ${selectedDividedSubscriberServices.length === 0
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                      >
                        Continuar com {selectedDividedSubscriberServices.length} serviço(s)
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-blue-800">
                          <strong>Dias disponíveis:</strong> {selectedSubscriberService.weekdays?.map((day: string) => {
                            const dayNames = {
                              'monday': 'Segunda-feira',
                              'tuesday': 'Terça-feira',
                              'wednesday': 'Quarta-feira',
                              'thursday': 'Quinta-feira',
                              'friday': 'Sexta-feira',
                              'saturday': 'Sábado',
                              'sunday': 'Domingo'
                            };
                            return dayNames[day as keyof typeof dayNames] || day;
                          }).join(', ') || 'Não configurado'}
                        </p>
                      </div>

                      {shouldSelectDividedServiceFirst && selectedDividedSubscriberServices.length > 0 && (
                        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                          Serviços selecionados: <strong>{selectedDividedSubscriberServices.map((service: any) => service.name).join(', ')}</strong> ({selectedDividedSubscriberTotalDuration} min no total)
                          <button
                            type="button"
                            onClick={() => setHasConfirmedDividedSubscriberServices(false)}
                            className="ml-2 underline"
                          >
                            editar seleção
                          </button>
                        </div>
                      )}

                      {subscriberExtraServiceCategories.length > 0 && (
                        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="text-sm font-semibold text-violet-900">
                              Serviços extras para assinante
                            </h4>
                            <span className="text-xs text-violet-800">
                              {selectedSubscriberExtraServiceIds.length}/{MAX_SUBSCRIBER_EXTRA_SERVICES} selecionados
                            </span>
                          </div>
                          <p className="text-xs text-violet-700 mb-3">
                            Você pode marcar até {MAX_SUBSCRIBER_EXTRA_SERVICES} serviços extras.
                          </p>

                          <div className="space-y-3">
                            {subscriberExtraServiceCategories.map((category: any) => (
                              <div key={`subscriber-extra-light-${category.id}`}>
                                <div className="text-xs font-semibold text-violet-800 mb-1">
                                  {category.name}
                                </div>
                                <div className="space-y-2">
                                  {(category.services || []).map((service: any) => {
                                    const serviceId = String(service?.id || '').trim();
                                    const isSelected = selectedSubscriberExtraServiceIds.includes(serviceId);
                                    const isDisabled = !isSelected && selectedSubscriberExtraServiceIds.length >= MAX_SUBSCRIBER_EXTRA_SERVICES;
                                    return (
                                      <div
                                        key={`subscriber-extra-light-${serviceId}`}
                                        className={`rounded-lg border p-2 ${isSelected ? 'border-violet-300 bg-violet-100' : 'border-violet-100 bg-white'} ${isDisabled ? 'opacity-60' : ''}`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div>
                                            <div className="text-sm font-medium text-gray-900">{service.name}</div>
                                            <div className="text-xs text-gray-600">
                                              +{Number(service?.duration || 0)} min • R$ {Number(service?.price || 0).toFixed(2).replace('.', ',')}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleSubscriberExtraService(serviceId)}
                                            disabled={isDisabled}
                                            className={`px-3 py-1 text-xs rounded-md border transition-colors ${isSelected ? 'bg-violet-600 text-white border-violet-500' : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-100'} ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                          >
                                            {isSelected ? 'Selecionado' : 'Selecionar'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 text-xs text-violet-900">
                            Total extra: <strong>R$ {subscriberExtraTotalPrice.toFixed(2).replace('.', ',')}</strong> • Tempo extra: <strong>{subscriberExtraTotalDuration} min</strong>
                          </div>
                        </div>
                      )}

                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={scrollToSubscriberProfessionalStep}
                          className="w-full rounded-lg bg-indigo-600 text-white py-2.5 font-semibold hover:bg-indigo-700 transition-colors"
                        >
                          Próximo passo
                        </button>
                      </div>

                      <div data-subscriber-appointment-form>
                        <AppointmentForm
                          establishment={establishment}
                          onSubmit={handleSubmit}
                          selectedDate={selectedDate}
                          onSelectDate={setSelectedDate}
                          existingAppointments={existingAppointments}
                          bookingHighlightedProducts={bookingHighlightedProducts}
                          subscriberService={currentSubscriberServiceForBooking} // Passar o serviço para restringir dias
                          subscriberExtraServices={selectedSubscriberExtraServices}
                          isSubscriberBooking={true} // Indica que é agendamento de assinante
                          guestClientData={guestClientData} // Passar dados do cliente para preenchimento automático
                          onRequestChangeSubscriberService={handleRequestChangeSubscriberService}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {showDemoSuccessModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg text-center max-w-sm mx-auto border border-blue-500">
                <h2 className="text-2xl font-bold text-white mb-4">Atenção!</h2>
                <p className="text-gray-300 mb-6">
                  Este foi um agendamento demonstrativo, parabéns! Clique abaixo e volte ao menu iniciar.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md w-full transition-colors"
                >
                  Finaliza
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Modal Fila de Espera */}
      {showWaitlistModal && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-3 sm:p-4 pt-6 sm:pt-4">
          <div
            className="w-full max-w-xl rounded-2xl shadow-2xl border border-white/10 bg-[#0f0f10] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">🕒</span>
                <div className="text-sm font-extrabold text-white">Fila de espera</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWaitlistModal(false);
                  setShowJoinWaitlistForm(false);
                  setShowLeaveWaitlistForm(false);
                }}
                className="p-2 rounded-lg hover:bg-white/5 text-white/90"
                aria-label="Fechar"
                title="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="text-sm text-white/80 leading-relaxed">
                Veja a fila atual por ordem de chegada e entre na fila de espera.
              </div>

              {isFilaPorProfissional && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs text-white/70 mb-2">Escolha a fila (profissional)</div>
                  <div className="flex flex-wrap gap-2">
                    {filaEsperaProfissionais.map((p) => {
                      const active = String(waitlistQueueProfessionalId) === String(p.id);
                      const count = Number(waitlistQueueCounts?.[p.id] || 0);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setWaitlistQueueProfessionalId(p.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-extrabold border transition-colors ${active
                            ? 'bg-white text-black border-white'
                            : 'bg-white/5 text-white/90 border-white/10 hover:bg-white/10'
                            }`}
                        >
                          {p.name} <span className={active ? 'text-black/70' : 'text-white/60'}>({count})</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-[11px] text-white/60">
                    Dica: escolha a fila com menos pessoas para ser atendido mais rápido.
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                {isLoadingWaitlist ? (
                  <div className="text-sm text-white/70">Carregando fila...</div>
                ) : waitlistEntries.length === 0 ? (
                  <div className="text-sm text-white/70">Nenhuma pessoa na fila no momento.</div>
                ) : (
                  <div className="space-y-2">
                    {waitlistEntries.map((e: any, idx: number) => {
                      const isAtual = idx === 0;
                      const isProximo = idx === 1;
                      const boxClass = isAtual
                        ? 'border-emerald-400/40 bg-emerald-500/10'
                        : isProximo
                          ? 'border-amber-400/40 bg-amber-500/10'
                          : 'border-white/10 bg-black/20';

                      return (
                        <div
                          key={e.id}
                          className={`rounded-xl border ${boxClass} p-3 flex items-start justify-between gap-2`}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-white truncate">
                              {isAtual ? `${e.client_name} — em atendimento` : isProximo ? `Próximo: ${e.client_name}` : e.client_name}
                            </div>
                            <div className="text-[11px] text-white/60 space-y-0.5">
                              <div>
                                Serviço: <span className="font-semibold text-white/80">{e.service_name}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1">
                                {Number.isFinite(Number(e.service_price)) && (
                                  <span>
                                    Valor: <span className="font-semibold text-white/85">{fmtBRL(Number(e.service_price))}</span>
                                  </span>
                                )}
                                {Number.isFinite(Number(e.service_duration_minutes)) && Number(e.service_duration_minutes) > 0 && (
                                  <span>
                                    Tempo: <span className="font-semibold text-white/85">{Number(e.service_duration_minutes)}min</span>
                                  </span>
                                )}
                                {idx === 0 && e.started_at && (
                                  <span>
                                    Início: <span className="font-semibold text-white/85">{String(new Date(e.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</span>
                                  </span>
                                )}
                                {(() => {
                                  const min = calcularMinutosRestantes(waitlistEntries, idx);
                                  if (min === null) return null;
                                  return (
                                    <span>
                                      {idx === 0 ? 'Falta:' : 'Estimativa:'}{' '}
                                      <span className="font-semibold text-white/85">{min}min</span>
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {showLeaveWaitlistForm ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="text-sm font-extrabold text-white">Sair da fila</div>
                  <div className="text-xs text-white/70">
                    Digite o mesmo telefone/WhatsApp que você usou para entrar na fila.
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Telefone / WhatsApp</label>
                    <input
                      value={leaveWaitlistPhone}
                      onChange={(e) => setLeaveWaitlistPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                      placeholder="(DD) 9xxxx-xxxx"
                      inputMode="tel"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSairDaFila}
                      className="flex-1 px-4 py-3 rounded-xl font-extrabold bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Confirmar saída
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLeaveWaitlistForm(false);
                        setLeaveWaitlistPhone('');
                      }}
                      className="px-4 py-3 rounded-xl font-extrabold bg-white/10 text-white hover:bg-white/15 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : showJoinWaitlistForm ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
                  <div className="text-sm font-extrabold text-white">Entrar na fila</div>

                  {isFilaPorProfissional && (
                    <div className="space-y-2">
                      <label className="block text-xs text-white/70">Fila (profissional)</label>
                      <select
                        value={waitlistQueueProfessionalId}
                        onChange={(e) => setWaitlistQueueProfessionalId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                      >
                        {filaEsperaProfissionais.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({Number(waitlistQueueCounts?.[p.id] || 0)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Nome</label>
                    <input
                      value={waitlistName}
                      onChange={(e) => setWaitlistName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                      placeholder="Seu nome"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Telefone / WhatsApp</label>
                    <input
                      value={waitlistPhone}
                      onChange={(e) => setWaitlistPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                      placeholder="(DD) 9xxxx-xxxx"
                      inputMode="tel"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">Serviço</label>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-2 max-h-56 overflow-y-auto space-y-2">
                      {(((establishment as any)?.services_with_prices || []) as any[]).map((s: any) => {
                        const id = String(s?.id ?? '');
                        const checked = waitlistSelectedServiceIds.includes(id);
                        const disabled = !checked && waitlistSelectedServiceIds.length >= 4;
                        return (
                          <label
                            key={id}
                            className={`flex items-center gap-2 px-2 py-2 rounded-md border ${checked ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-black/20'
                              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => {
                                setWaitlistSelectedServiceIds((prev) => {
                                  if (prev.includes(id)) return prev.filter((x) => x !== id);
                                  if (prev.length >= 4) return prev;
                                  return [...prev, id];
                                });
                              }}
                            />
                            <span className="text-xs text-white/90">{labelServicoFila(s)}</span>
                          </label>
                        );
                      })}
                    </div>
                    {waitlistSelectedServiceIds.length > 0 && (
                      <div className="text-[11px] text-white/75">
                        {(() => {
                          const { serviceName, totalPrice, totalDuration } = calcularResumoServicosFila(waitlistSelectedServiceIds);
                          return (
                            <>
                              Selecionado: <span className="font-semibold text-white/90">{serviceName}</span>
                              {Number.isFinite(totalPrice) && totalPrice > 0 && (
                                <>
                                  {' '}
                                  • Total: <span className="font-semibold text-white/90">{fmtBRL(totalPrice)}</span>
                                </>
                              )}
                              {Number.isFinite(totalDuration) && totalDuration > 0 && (
                                <>
                                  {' '}
                                  • Tempo: <span className="font-semibold text-white/90">{totalDuration}min</span>
                                </>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleEntrarNaFila}
                      className="flex-1 px-4 py-3 rounded-xl font-extrabold bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowJoinWaitlistForm(false)}
                      className="px-4 py-3 rounded-xl font-extrabold bg-white/10 text-white hover:bg-white/15 transition-colors"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinWaitlistForm(true);
                      setShowLeaveWaitlistForm(false);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl font-extrabold bg-white text-black hover:bg-gray-100 transition-colors"
                  >
                    Entrar na fila
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveWaitlistForm(true);
                      setShowJoinWaitlistForm(false);
                    }}
                    className="px-4 py-3 rounded-xl font-extrabold bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Sair da fila
                  </button>
                  <button
                    type="button"
                    onClick={fetchWaitlist}
                    className="px-4 py-3 rounded-xl font-extrabold bg-white/10 text-white hover:bg-white/15 transition-colors"
                  >
                    Atualizar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {showApprovedReviewsModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#161718] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-xl font-extrabold">Avaliações da barbearia</h3>
              <button
                type="button"
                onClick={() => setShowApprovedReviewsModal(false)}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {isLoadingApprovedReviews ? (
              <div className="text-white/70">Carregando avaliações...</div>
            ) : approvedReviews.length === 0 ? (
              <div className="text-white/70">Ainda não há avaliações aprovadas.</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
                {approvedReviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white">{review.client_name}</span>
                      <span className="text-xs text-white/60">{new Date(review.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="text-[#E6C78B] text-sm mt-1">⭐⭐⭐⭐⭐</div>
                    <p className="text-white/85 text-sm mt-2 whitespace-pre-wrap break-words">{review.review_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateReviewModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161718] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white text-xl font-extrabold">Avaliar barbearia</h3>
              <button
                type="button"
                onClick={() => {
                  if (isSubmittingReview) return;
                  setShowCreateReviewModal(false);
                }}
                className="text-white/70 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-white/80 mb-1">Nome do cliente</label>
                <input
                  type="text"
                  value={reviewClientName}
                  onChange={(e) => setReviewClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-1">Telefone</label>
                <input
                  type="tel"
                  value={reviewClientPhone}
                  onChange={(e) => setReviewClientPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25"
                  placeholder="(DD) 9xxxx-xxxx"
                />
              </div>
              <div>
                <label className="block text-sm text-white/80 mb-1">Avaliação</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value.slice(0, 200))}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white outline-none focus:border-white/25 resize-none"
                  rows={4}
                  placeholder="Escreva sua avaliação (máx. 200 caracteres)"
                />
                <div className="text-right text-xs text-white/50 mt-1">{reviewText.length}/200</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCreateReviewModal(false)}
                disabled={isSubmittingReview}
                className="px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitBookingReview}
                disabled={isSubmittingReview}
                className="px-3 py-2 rounded-lg bg-[#E6C78B] text-black font-extrabold hover:bg-[#f3e7c7] transition-colors disabled:opacity-60"
              >
                {isSubmittingReview ? 'Enviando...' : 'Enviar avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviewSubmittedModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161718] border border-white/10 rounded-2xl p-5">
            <h3 className="text-white text-xl font-extrabold mb-2">Avaliação enviada! ✅</h3>
            <p className="text-white/75 text-sm">
              Obrigado pelo feedback. Sua avaliação será exibida no booking após aprovação do estabelecimento.
            </p>

            {String(establishment?.review_link || '').trim() && (
              <a
                href={
                  String(establishment?.review_link || '').startsWith('http')
                    ? String(establishment?.review_link || '')
                    : `https://${String(establishment?.review_link || '')}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full text-center rounded-lg bg-white text-black font-bold px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                Avalie também no Google e ajude ainda mais esta barbearia
              </a>
            )}

            <button
              type="button"
              onClick={() => setShowReviewSubmittedModal(false)}
              className="mt-3 w-full rounded-lg bg-[#E6C78B] text-black font-extrabold px-3 py-2 hover:bg-[#f3e7c7] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Agendamento Rápido */}
      <QuickBookingModal
        isOpen={showQuickBookingModal}
        onClose={() => {
          setShowQuickBookingModal(false);
          // Se o usuário fechou, não manter o fluxo preso em "modal"
          safeSessionRemove(QUICK_BOOKING_FLOW_KEY);
        }}
        onContinue={handleContinueQuickBooking}
        establishmentName={establishment?.name || 'este estabelecimento'}
        establishmentWhatsapp={establishment?.whatsapp}
      />

      {/* Modal de Pagamento (Pagar.me) - Booking público */}
      {showPaymentModal && pendingAppointmentId && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            // Não cancelar no fechamento do modal. Mantém pendente para permitir confirmação assíncrona.
            if (pendingAppointmentId) {
              supabase
                .from('appointments')
                .update({ payment_status: 'unpaid' } as any)
                .eq('id', pendingAppointmentId);
            }
            toast('Pagamento não concluído agora. Agendamento ficou pendente de confirmação.', 'warning');
          }}
          appointmentId={pendingAppointmentId}
          amount={pendingPaymentAmount}
          establishmentId={String(establishment?.id || '')}
          recipientId={(window as any).__paymentGateway === 'pagarme'
            ? String((establishment as any)?.pagarme_recipient_id || '')
            : undefined}
          onPaymentSuccess={(clientPhone) => {
            setShowPaymentModal(false);
            setPendingAppointmentId(null);

            // Se tiver telefone, redirecionar para view-appointments
            if (clientPhone) {
              const cleanPhone = clientPhone.replace(/\D/g, '');
              localStorage.setItem('last_booking_phone', cleanPhone);
              // ✅ Proteção contra múltiplos redirects
              if (isReloadingRef.current) return;
              isReloadingRef.current = true;
              window.location.href = `/view-appointments?phone=${encodeURIComponent(cleanPhone)}`;
              return;
            }
            setPendingCustomerData(null);
            // Redirecionar para a página de agendamentos
            toast.success('Pagamento confirmado! Redirecionando para seus agendamentos...');
            setTimeout(() => {
              // ✅ Proteção contra múltiplos redirects
              if (isReloadingRef.current) return;
              isReloadingRef.current = true;
              window.location.href = '/view-appointments';
            }, 800);
          }}
          onPaymentFailure={() => {
            setShowPaymentModal(false);
            setPendingAppointmentId(null);
            setPendingCustomerData(null);
            toast('Pagamento não concluído agora. Agendamento ficou pendente de confirmação.', 'warning');
          }}
          cancelAppointmentOnFailure={!paymentIsOptional}
          customerData={{
            name: pendingCustomerData?.name || guestClientData?.name || 'Cliente',
            phone: pendingCustomerData?.phone || guestClientData?.phone,
            email: pendingCustomerData?.email || user?.email || undefined
          }}
        />
      )}

      {showRenewLookupModal && renewLookupSubscription && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1a1b1c] border border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-lg font-bold">Renovar assinatura</h3>
              <button
                onClick={() => {
                  if (isRenewLookupLoading) return;
                  setShowRenewLookupModal(false);
                  setRenewLookupSubscription(null);
                  setRenewLookupPhone('');
                }}
                className="text-gray-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-300 mb-1">
              Plano: <span className="text-white font-semibold">{String(renewLookupSubscription?.name || 'Assinatura')}</span>
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Informe o número do cliente para localizar e preencher automaticamente.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                findRenewSubscriberByPhone();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Número do cliente
                </label>
                <input
                  type="tel"
                  value={renewLookupPhone}
                  onChange={(e) => setRenewLookupPhone(e.target.value)}
                  placeholder="Ex: 47999516120"
                  className="w-full px-3 py-2 rounded-lg bg-[#2a2b2c] border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-[#e6d7b1]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isRenewLookupLoading) return;
                    setShowRenewLookupModal(false);
                    setRenewLookupSubscription(null);
                    setRenewLookupPhone('');
                  }}
                  className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRenewLookupLoading}
                  className="px-3 py-2 rounded-lg bg-[#e6d7b1] hover:bg-[#f3e7c7] text-black font-extrabold transition-colors disabled:opacity-60"
                >
                  {isRenewLookupLoading ? 'Buscando...' : 'Continuar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assinatura via PIX (Pagar.me) */}
      {showSubscriptionPixModal && selectedSubscriptionForPix && (
        <SubscriptionPixModal
          isOpen={showSubscriptionPixModal}
          onClose={() => {
            setShowSubscriptionPixModal(false);
            setSelectedSubscriptionForPix(null);
            setSubscriptionPixInitialFlow('default');
            setRenewalPrefill(null);
          }}
          initialPrefill={renewalPrefill ?? undefined}
          establishmentId={String(establishment?.id || '')}
          recipientId={String((establishment as any)?.pagarme_recipient_id || '')}
          establishmentName={String(establishment?.name || 'este estabelecimento')}
          establishmentWhatsapp={String(establishment?.whatsapp || '')}
          subscription={{
            id: String(selectedSubscriptionForPix.id),
            name: String(selectedSubscriptionForPix.name || 'Assinatura'),
            value: Number(selectedSubscriptionForPix.value || 0),
            duration_months: selectedSubscriptionForPix.duration_months ?? null,
          }}
          allowedPix={isSubscriptionPixEnabled(selectedSubscriptionForPix)}
          allowedCard={isSubscriptionCardEnabled(selectedSubscriptionForPix)}
          initialFlow={subscriptionPixInitialFlow}
          externalPaymentLink={String(selectedSubscriptionForPix.custom_link || '').trim() || undefined}
          paymentProvider={
            (() => {
              try {
                return Boolean((establishment as any)?.use_mercadopago_subscription_pix === true);
              } catch {
                return false;
              }
            })() &&
              !!String((establishment as any)?.mercadopago_access_token || '').trim()
              ? 'mercadopago'
              : 'pagarme'
          }
        />
      )}

      {/* Prompt: Pagamento opcional após agendar */}
      {showOptionalPayPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#1a1b1c] rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-700">
            <h2 className="text-xl font-extrabold text-white mb-2">Parabéns! Agendamento feito ✅</h2>
            <p className="text-gray-300 mb-6 leading-relaxed">
              Quer <span className="font-semibold text-white">pagar agora</span> e já
              <span className="ml-2 inline-block px-2 py-1 rounded-md bg-green-600/20 border border-green-500/40 text-green-300 font-extrabold">
                deixar seu barbeiro feliz
              </span>
              ?
              <span className="block mt-2 text-xs text-gray-400">
                Se você preferir, pode só confirmar e pagar depois.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowOptionalPayPrompt(false);
                  setShowPaymentModal(true);
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Sim, pagar agora
              </button>
              <button
                onClick={() => {
                  setShowOptionalPayPrompt(false);
                  // Seguir fluxo normal (sem pagamento)
                  toast.success('Agendamento confirmado! Redirecionando...');
                  setTimeout(() => {
                    const phone =
                      (pendingCustomerData?.phone || guestClientData?.phone || localStorage.getItem('last_booking_phone') || '').toString();
                    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
                    // ✅ Proteção contra múltiplos redirects
                    if (isReloadingRef.current) return;
                    isReloadingRef.current = true;
                    window.location.href = cleanPhone ? `/view-appointments?phone=${encodeURIComponent(cleanPhone)}` : '/view-appointments';
                  }, 800);
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Não, só confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
} 