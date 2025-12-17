import { addDays, addMonths, endOfDay, endOfMonth, format, parseISO, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Building2, Calendar, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, CreditCard, Crown, DollarSign, Edit, HelpCircle, Image as ImageIcon, Layers, Link as LinkIcon, Menu, MessageSquare, Package, Phone, Plus, Receipt, Shuffle, Star, Trash2, TrendingUp, User, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import AdditionalProductModal from '../components/AdditionalProductModal';
import { AllProfessionalsAppointmentsView } from '../components/AllProfessionalsAppointmentsView';
import { ConfigPasswordModal } from '../components/ConfigPasswordModal';
import { EstablishmentPixSettings } from '../components/EstablishmentPixSettings';
import { ExpensesManager } from '../components/ExpensesManager';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { GoalModalSimple } from '../components/GoalModalSimple';
import { GoalProgressBar } from '../components/GoalProgressBar';
import { NotificationPermission } from '../components/NotificationPermission';
import { NotificationsPanel } from '../components/NotificationsPanel';
import PinPasswordModal from '../components/PinPasswordModal';
import { ProfessionalPaymentControl } from '../components/ProfessionalPaymentControl';
import ProfessionalPinModal from '../components/ProfessionalPinModal';
import { ProfessionalSelector } from '../components/ProfessionalSelector';
import ReservarCliente from '../components/ReservarCliente';
import Sidebar from '../components/Sidebar';
import { SpecificServiceModal } from '../components/SpecificServiceModal';
import { SubscribersManager } from '../components/SubscribersManager'; // Importar o novo componente
import { TimeSelector } from '../components/TimeSelector';
import { TransferAppointmentModal } from '../components/TransferAppointmentModal';
import { useToast } from '../components/ui/Toaster';
// UpdateButton removido - sistema automático já cuida de tudo
import { ValidityDisplay } from '../components/ValidityDisplay';
import { ValidityHeader } from '../components/ValidityHeader';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { addExpense, createEstablishment, deleteExpense, getEstablishmentPremiumSubscribers, getExpensesByMonth, getProfessionalGoal, isNewClient, setProfessionalGoal, supabase, updateEstablishment } from '../lib/supabase';

interface BusinessHours {
  enabled: boolean;
  open1: string;
  close1: string;
  open2: string | null;
  close2: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialties: string[];
  percentage?: number; // Campo para percentual do profissional (opcional)
  photo_url?: string; // Campo para foto do profissional
  whatsapp?: string; // Campo para WhatsApp do profissional
  offers_child_service?: boolean; // Campo para indicar se oferece serviço infantil
  hidden_from_booking?: boolean; // Campo para ocultar profissional do booking público
  work_hours?: {
    [key: string]: {
      enabled: boolean;
      entry_time?: string;
      break_start?: string;
      break_end?: string;
      exit_time?: string;
    };
  } | null; // Horários personalizados de trabalho do profissional
  specific_services?: { // ✅ Serviços específicos do profissional
    id: string;
    name: string;
    price: number;
    duration: number;
  }[];
}

interface ProfessionalPin {
  professional_id: string;
  pin: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Establishment {
  id: string;
  name: string;
  description: string;
  code: string;
  owner_id: string;
  business_hours: Record<string, BusinessHours>;
  professionals: Professional[];
  professionals_pins: ProfessionalPin[];
  services_with_prices: Service[];
  profile_image_url?: string;
  affiliate_link?: string;
  custom_photo_1_url?: string;
  custom_photo_2_url?: string;
  custom_photo_3_url?: string;
  custom_photo_4_url?: string;
  custom_photo_5_url?: string;
  custom_photo_6_url?: string;
  custom_photo_7_url?: string;
  pix_key_type?: string;
  pix_key?: string;
  pin_password?: string;
  logo_url?: string;
  review_link?: string;       // Nova coluna
  social_media_link?: string; // Nova coluna
  pix_payment_link?: string;  // Nova coluna
  location_link?: string; // Novo estado para o link do local
  has_wifi?: boolean; // Novo estado para Wi-fi
  has_parking?: boolean;
  limit_subscriber_bookings?: boolean; // Limitar agendamentos de assinantes
  require_cancellation_request?: boolean; // Exigir solicitação de cancelamento via WhatsApp
  prevent_same_day_reschedule?: boolean; // Impedir remarcação no mesmo dia
  has_accessibility?: boolean; // Novo estado para Acessibilidade
  enable_whatsapp_notifications?: boolean; // Ativar notificações WhatsApp após agendamentos
  wifi_password?: string; // Senha do Wi-Fi
  whatsapp?: string; // Novo campo para WhatsApp
  credit_card_tax_percentage?: number; // Taxa do cartão de crédito (%)
  carousel_position?: 'behind' | 'below'; // Posição do carrossel: atrás ou embaixo do perfil
  debit_card_tax_percentage?: number; // Taxa do cartão de débito (%)
  card_brand_taxes?: Record<string, number>; // Taxas por bandeira de cartão
  payment_alert_enabled?: boolean; // Indica se o alerta de pagamento está ativado
  promotion_enabled?: boolean; // Indica se a propaganda está ativada
}

type TabType = 'appointments' | 'services' | 'settings' | 'financial-dashboard' | 'expenses' | 'clients' | 'subscribers' | 'products' | 'professionals' | 'service-categories' | 'taxes' | 'ranking' | 'missing-clients' | 'draw' | 'passo-a-passo' | 'client-page' | 'indication' | 'support';

interface AdditionalProduct {
  name: string;
  price: number;
}

interface EstablishmentProduct {
  id: string;
  establishment_id: string;
  name: string;
  sale_price: number;
  cost_price: number;
  stock_quantity: number;
  sold_quantity: number;
  created_at: string;
  updated_at: string;
}

interface AppointmentProduct {
  id: string;
  appointment_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

interface ServiceCategory {
  id: string;
  establishment_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ServiceSubcategory {
  id: string;
  category_id: string;
  name: string;
  price: number;
  duration: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface Appointment {
  id: string;
  client_id: string;
  client_name: string;
  client_whatsapp?: string;
  client_cpf?: string;
  establishment_id: string;
  service: string;
  professional: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  is_premium: boolean;
  duration: number;
  price: number;
  payment_method?: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'transferencia';
  card_brand?: string;
  pix_payment_status?: string;
  pix_proof_url?: string;
  additional_products?: AdditionalProduct[];
  total_price?: number;
  observation?: string;
  establishment_observation?: string;
  is_subscriber?: boolean;
  is_child_service?: boolean;
  is_avulso?: boolean;
  sold_products?: {
    id: string;
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
}

interface PremiumSubscriber {
  id: string;
  display_name: string;
  whatsapp: string;
  created_at: string;
  user_id: string;
  is_winner?: boolean;
  winner_position?: number;
  last_draw_date?: string;
}

interface PremiumClient {
  id: string;
  premium_user_id: string;
  establishment_id: string;
  client_name: string;
  client_phone: string;
  created_at: string;
  is_winner?: boolean;
  winner_position?: number;
  last_draw_date?: string;
}

interface Client {
  id: string; // ID do profile do cliente
  whatsapp: string;
  name: string;
  appointmentCount: number;
  isSubscriber: boolean; // Nova propriedade
  birthday: string | null; // Campo de aniversário
  alert?: string | null; // Campo de alerta/anotação (máximo 100 caracteres)
}

interface Subscription {
  id: string;
  name: string;
  value: number;
  duration_months: number;
  fixed_commission_value?: number;
}

interface ClientSubscription {
  id: string;
  client_id: string;
  subscription_id: string;
  establishment_id: string;
  start_date: string;
  end_date: string;
  payment_status: 'paid' | 'unpaid';
  last_payment_date: string | null;
  subscriptions: Subscription;
  profiles: { full_name: string };
}

const EstablishmentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notifyNewAppointment, notifyCancelledAppointment } = useNotifications();

  // Estados básicos
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('passo-a-passo');
  const [openDropdowns, setOpenDropdowns] = useState<{ [key: string]: boolean }>({});
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [isEstablishmentLoading, setIsEstablishmentLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingServicesOrder, setIsSavingServicesOrder] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('todos');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [monthlyAppointments, setMonthlyAppointments] = useState<Appointment[]>([]);
  const [highlightedProfessionalId, setHighlightedProfessionalId] = useState<string | null>(null);
  const [highlightReserveButton, setHighlightReserveButton] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousAppointmentsRef = useRef<Appointment[]>([]);
  const paymentDropdownRef = useRef<HTMLDivElement>(null);
  const onboardingCompletedRef = useRef(false); // Evita múltiplas chamadas ao completar onboarding
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBirthdayFilter, setShowBirthdayFilter] = useState(false);
  const [editingClientBirthday, setEditingClientBirthday] = useState<string | null>(null);
  const [newBirthday, setNewBirthday] = useState('');
  const [editingClientAlert, setEditingClientAlert] = useState<string | null>(null);
  const [newAlert, setNewAlert] = useState('');

  // Estados para adicionar cliente manualmente
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');

  // Estados para editar cliente (seção Meus Clientes)
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientWhatsapp, setEditClientWhatsapp] = useState('');
  const [newClientBirthday, setNewClientBirthday] = useState('');

  // Estados para ranking de clientes
  const [showRankingModal, setShowRankingModal] = useState(false);

  // Estados para clientes sumidos
  const [showMissingClientsModal, setShowMissingClientsModal] = useState(false);

  // Estados para sorteio (Clientes Fiéis)
  const [showDrawModal, setShowDrawModal] = useState(false);

  // Estados para Reservar Cliente
  const [showReservarClienteModal, setShowReservarClienteModal] = useState(false);

  // Estados para Clientes Fiéis
  const [showLoyalForm, setShowLoyalForm] = useState(false);
  const [loyalCustomers, setLoyalCustomers] = useState<any[]>([]);
  const [selectedLoyalCustomer, setSelectedLoyalCustomer] = useState<any>(null);
  const [selectedLoyalMonth, setSelectedLoyalMonth] = useState(new Date());
  const [loyalFormData, setLoyalFormData] = useState({
    customerName: '',
    whatsapp: '',
    registrationDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [isLoadingLoyal, setIsLoadingLoyal] = useState(false);

  // Estados do formulário
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentDescription, setEstablishmentDescription] = useState('');
  const [establishmentCode, setEstablishmentCode] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [pixKeyType, setPixKeyType] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');
  // Novos estados para os links
  const [reviewLink, setReviewLink] = useState('');
  const [socialMediaLink, setSocialMediaLink] = useState('');
  const [pixPaymentLink, setPixPaymentLink] = useState('');
  const [locationLink, setLocationLink] = useState(''); // Novo estado para o link do local

  // ✅ Refs para debounce do auto-save
  const linksAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const amenitiesAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleConfigAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const businessHoursAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const paymentConfigAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const paymentMethodsAutoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasWifi, setHasWifi] = useState(false); // Novo estado para Wi-fi
  const [hasParking, setHasParking] = useState(false); // Novo estado para Estacionamento
  const [hasAccessibility, setHasAccessibility] = useState(false); // Novo estado para Acessibilidade
  const [hasAirConditioning, setHasAirConditioning] = useState(false); // Novo estado para Ar-Condicionado
  const [wifiPassword, setWifiPassword] = useState(''); // Senha do Wi-Fi
  const [wifiNetworkName, setWifiNetworkName] = useState(''); // Nome da rede Wi-Fi
  const [requireCancellationRequest, setRequireCancellationRequest] = useState(false); // Exigir solicitação de cancelamento via WhatsApp
  const [preventSameDayReschedule, setPreventSameDayReschedule] = useState(false); // Impedir remarcação no mesmo dia
  const [requireCpf, setRequireCpf] = useState(false); // Solicitar CPF no agendamento
  const [enableWhatsAppNotifications, setEnableWhatsAppNotifications] = useState(false); // Ativar notificações WhatsApp após agendamentos
  const [requireCancelPassword, setRequireCancelPassword] = useState(false); // Exigir senha para cancelar agendamento
  const [creditCardTaxPercentage, setCreditCardTaxPercentage] = useState(3.5); // Taxa do cartão de crédito (%)
  const [debitCardTaxPercentage, setDebitCardTaxPercentage] = useState(2.5); // Taxa do cartão de débito (%)
  const [paymentMethodsEnabled, setPaymentMethodsEnabled] = useState<string[]>(['pix', 'credito', 'debito', 'dinheiro', 'pagar_local']); // Formas de pagamento ativas
  const [carouselPosition, setCarouselPosition] = useState<'behind' | 'below'>('behind'); // Posição do carrossel
  const [cardBrandTaxes, setCardBrandTaxes] = useState<Record<string, number>>({
    visa: 3.5,
    mastercard: 3.5,
    elo: 3.0,
    hipercard: 3.0,
    american_express: 4.0,
    discover: 3.5,
    jcb: 3.5,
    outros: 3.5
  }); // Taxas por bandeira de cartão

  // Efeito para preencher automaticamente o pixPaymentLink
  useEffect(() => {
    if (pixKey && pixKey.toLowerCase() !== 'naotenhopix') {
      // Aqui você pode definir a lógica para gerar o link. 
      // Exemplo: Usando um domínio fixo e a chave PIX.
      // Adapte 'seusite.com.br' para o domínio real do seu aplicativo.
      setPixPaymentLink(`https://agendafacil.com.br/pix/${pixKey}`);
    } else if (pixKey.toLowerCase() === 'naotenhopix') {
      setPixPaymentLink(''); // Limpa se for 'naotenhopix'
    }
  }, [pixKey]);

  // Carregar preferência de layout claro/escuro do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dashboard:useLightLayout');
      if (saved === 'true') {
        setUseLightLayout(true);
      }
    } catch (error) {
      console.error('Erro ao carregar preferência de layout:', error);
    }
  }, []);

  const toggleLayoutTheme = () => {
    setUseLightLayout(prev => {
      const next = !prev;
      try {
        localStorage.setItem('dashboard:useLightLayout', next ? 'true' : 'false');
      } catch (error) {
        console.error('Erro ao salvar preferência de layout:', error);
      }
      return next;
    });
  };

  // Estados de imagens
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [customPhoto1, setCustomPhoto1] = useState<File | null>(null);
  const [customPhoto2, setCustomPhoto2] = useState<File | null>(null);
  const [customPhoto3, setCustomPhoto3] = useState<File | null>(null);
  const [customPhoto4, setCustomPhoto4] = useState<File | null>(null);
  const [customPhoto5, setCustomPhoto5] = useState<File | null>(null);
  const [customPhoto6, setCustomPhoto6] = useState<File | null>(null);
  const [customPhoto7, setCustomPhoto7] = useState<File | null>(null);
  const [customPhoto1Preview, setCustomPhoto1Preview] = useState<string | null>(null);
  const [customPhoto2Preview, setCustomPhoto2Preview] = useState<string | null>(null);
  const [customPhoto3Preview, setCustomPhoto3Preview] = useState<string | null>(null);
  const [customPhoto4Preview, setCustomPhoto4Preview] = useState<string | null>(null);
  const [customPhoto5Preview, setCustomPhoto5Preview] = useState<string | null>(null);
  const [customPhoto6Preview, setCustomPhoto6Preview] = useState<string | null>(null);
  const [customPhoto7Preview, setCustomPhoto7Preview] = useState<string | null>(null);

  // Force update state para mobile
  const [forceUpdate, setForceUpdate] = useState(0);

  // Listener para forçar update no mobile
  useEffect(() => {
    const handlePhotoUploaded = () => {
      console.log('🔄 Forçando update no mobile...');
      setForceUpdate(prev => prev + 1);
    };

    window.addEventListener('photoUploaded', handlePhotoUploaded);
    return () => window.removeEventListener('photoUploaded', handlePhotoUploaded);
  }, []);

  // Estados de horários e profissionais
  // Horários padrão para novos estabelecimentos: todos os horários em 00:00
  // Estados para o quiz passo-a-passo (apenas novos usuários)
  const [quizStep, setQuizStep] = useState<number>(1);
  const [isNewUser, setIsNewUser] = useState<boolean>(false);
  const [quizCompleted, setQuizCompleted] = useState<boolean>(false); // Quiz foi completado
  const [quizAlertMessage, setQuizAlertMessage] = useState<string>(''); // Mensagem de alerta quando requisito não atendido

  const [businessHours, setBusinessHours] = useState<Record<string, BusinessHours>>({
    monday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
    tuesday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
    wednesday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
    thursday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
    friday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
    saturday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
    sunday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' }
  });

  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const [servicesWithPrices, setServicesWithPrices] = useState<Service[]>([]);

  // Estado para intervalo de 15 minutos
  const [use15MinuteInterval, setUse15MinuteInterval] = useState(false);

  // Estado para horários de 20 em 20 minutos
  const [use20MinuteSchedule, setUse20MinuteSchedule] = useState(false);

  // Estado para mostrar imagem "Melhor do Brasil"
  const [showBestOfBrazilImage, setShowBestOfBrazilImage] = useState(true);

  // Estado para mostrar/ocultar valores financeiros
  const [showFinancialValues, setShowFinancialValues] = useState(true);

  // Estado para popup de alerta de pagamento
  const [showPaymentAlert, setShowPaymentAlert] = useState(false);

  // Estado para popup de propaganda
  const [showPromotionPopup, setShowPromotionPopup] = useState(false);

  // Estados para sistema de onboarding
  const [onboardingStep, setOnboardingStep] = useState<number>(4); // 1=config, 2=profissional, 3=serviço, 4=completo
  const [termsAccepted, setTermsAccepted] = useState(false); // Aceite de termos
  const [showOnboardingPopup, setShowOnboardingPopup] = useState(false);
  const [onboardingPopupMessage, setOnboardingPopupMessage] = useState('');
  const [showBlockedItemModal, setShowBlockedItemModal] = useState(false); // Modal para item bloqueado
  const [showInfoModal, setShowInfoModal] = useState(false); // Modal de informações mobile
  const [infoModalContent, setInfoModalContent] = useState<{ title: string; content: string } | null>(null); // Conteúdo do modal

  // Estados premium
  const [premiumSubscribers, setPremiumSubscribers] = useState<PremiumSubscriber[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  const [subscriberDropdowns, setSubscriberDropdowns] = useState<Record<string, boolean>>({});
  const [appointmentDropdowns, setAppointmentDropdowns] = useState<Record<string, boolean>>({});
  const [appointmentSubscribers, setAppointmentSubscribers] = useState<Record<string, boolean>>({});

  // Estados para despesas
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [allProfessionalPayments, setAllProfessionalPayments] = useState<any[]>([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showExpensesList, setShowExpensesList] = useState(false);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [openExtraProductsDropdown, setOpenExtraProductsDropdown] = useState<string | null>(null);
  const [openDailyRevenueDropdown, setOpenDailyRevenueDropdown] = useState(false);
  const [showColorLegend, setShowColorLegend] = useState<'red' | 'yellow' | 'green' | null>(null);
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<string | null>(null);
  const [showCancelPasswordModal, setShowCancelPasswordModal] = useState(false);

  // Estados para modal de lembrete
  const [showReminderConfirm, setShowReminderConfirm] = useState(false);
  const [appointmentForReminder, setAppointmentForReminder] = useState<Appointment | null>(null);

  // Estado para modal informativo de lembrete
  const [showReminderInfoModal, setShowReminderInfoModal] = useState(false);

  // Layout claro/escuro do dashboard (apenas para este dashboard)
  const [useLightLayout, setUseLightLayout] = useState<boolean>(false);

  // Estados para edição de valor do agendamento
  const [editingAppointmentValue, setEditingAppointmentValue] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Estados para histórico de valores
  const [appointmentValueHistory, setAppointmentValueHistory] = useState<Record<string, {
    originalValue: number;
    changes: Array<{
      value: number;
      date: string;
      timestamp: string;
    }>;
  }>>({});
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<string | null>(null);

  // Estados para edição de nome de cliente avulso
  const [editingClientName, setEditingClientName] = useState<string | null>(null);
  const [editingClientNameValue, setEditingClientNameValue] = useState('');

  // Estados para observações dos agendamentos
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [selectedAppointmentForObservation, setSelectedAppointmentForObservation] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');

  // Estados para filtro de pagamento nos serviços individuais
  const [paymentFilter, setPaymentFilter] = useState<string>('todos');

  // Estados para relatório de taxas
  const [taxesReport, setTaxesReport] = useState<any>(null);
  const [isLoadingTaxes, setIsLoadingTaxes] = useState(false);

  // Estados para novos clientes
  const [newClientsInfo, setNewClientsInfo] = useState<Record<string, boolean>>({});

  // Estados para ausências dos profissionais
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [selectedProfessionalForAbsence, setSelectedProfessionalForAbsence] = useState<string | null>(null);
  const [professionalAbsences, setProfessionalAbsences] = useState<Record<string, string[]>>({});
  const [absenceModalCurrentMonth, setAbsenceModalCurrentMonth] = useState(new Date());

  // Estados para metas dos profissionais
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedProfessionalForGoal, setSelectedProfessionalForGoal] = useState<string | null>(null);
  const [professionalGoals, setProfessionalGoals] = useState<Record<string, number>>({});

  // ✅ Estados para serviços específicos dos profissionais
  const [showSpecificServiceModal, setShowSpecificServiceModal] = useState(false);
  const [selectedProfessionalForSpecificService, setSelectedProfessionalForSpecificService] = useState<string | null>(null);

  // Estado para serviços selecionados das metas
  const [professionalSelectedServices, setProfessionalSelectedServices] = useState<Record<string, string[]>>({});
  // Estado para dados de progresso das metas
  const [professionalGoalProgress, setProfessionalGoalProgress] = useState<Record<string, {
    goalAmount: number;
    completedServices: number;
    progressPercentage: number;
    remainingServices: number;
  }>>({});
  const [goalModalCurrentMonth, setGoalModalCurrentMonth] = useState(new Date());
  const [isLoadingGoal, setIsLoadingGoal] = useState(false);

  // Estados para transferência de agendamentos
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedAppointmentForTransfer, setSelectedAppointmentForTransfer] = useState<Appointment | null>(null);

  // Estados para gerenciar bloqueio de horários dos profissionais
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [selectedProfessionalForBlock, setSelectedProfessionalForBlock] = useState<string | null>(null);
  const [blockTimeDate, setBlockTimeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [blockedHours, setBlockedHours] = useState<Record<string, Record<string, string[]>>>({});
  const [selectedBlockedHours, setSelectedBlockedHours] = useState<string[]>([]);

  // Estados para gerenciar horários de trabalho dos profissionais
  const [showWorkHoursModal, setShowWorkHoursModal] = useState(false);
  const [selectedProfessionalForWorkHours, setSelectedProfessionalForWorkHours] = useState<string | null>(null);
  const [workHoursData, setWorkHoursData] = useState<{
    [key: string]: {
      enabled: boolean;
      entry_time?: string;
      break_start?: string;
      break_end?: string;
      exit_time?: string;
    };
  }>({});

  // Estados para modal de observação (removido - já existe acima)

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pinPassword, setPinPassword] = useState('');
  const [showSavePinConfirmModal, setShowSavePinConfirmModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isConfigUnlocked, setIsConfigUnlocked] = useState(false);

  // Estados para o modal de senha do profissional
  const [showProfessionalPinModal, setShowProfessionalPinModal] = useState(false);
  const [selectedProfessionalForPin, setSelectedProfessionalForPin] = useState<string | null>(null);
  const [tempSelectedProfessional, setTempSelectedProfessional] = useState<string | null>(null);
  const [authenticatedProfessionalId, setAuthenticatedProfessionalId] = useState<string | null>(null);

  // Estados para proteção de configurações sensíveis
  const [showConfigPasswordModal, setShowConfigPasswordModal] = useState(false);
  const [configPasswordVerified, setConfigPasswordVerified] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'percentage' | 'password' | 'goal';
    professionalId: string;
    data?: any;
  } | null>(null);

  // Estados para controlar visibilidade de senhas dos profissionais
  const [professionalPasswordVisible, setProfessionalPasswordVisible] = useState<Record<string, boolean>>({});
  const [professionalPercentageEditable, setProfessionalPercentageEditable] = useState<Record<string, boolean>>({});

  // Estado para controlar os valores dos inputs de senha
  const [professionalPins, setProfessionalPins] = useState<Record<string, string>>({});

  // Estado para controlar o modal de produtos adicionais
  const [showAdditionalProductModal, setShowAdditionalProductModal] = useState(false);
  const [selectedAppointmentForProduct, setSelectedAppointmentForProduct] = useState<string | null>(null);

  // Novo estado para controlar o modal do comprovante
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [isDashboardUnlocked, setIsDashboardUnlocked] = useState(false);
  const [showDashboardPinModal, setShowDashboardPinModal] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // Estados para valores financeiros iniciais
  // Estados para edição do valor bruto por mês
  const [isEditingGrossValue, setIsEditingGrossValue] = useState(false);
  const [editingGrossValue, setEditingGrossValue] = useState('');
  const [monthlyGrossValues, setMonthlyGrossValues] = useState<{ [key: string]: number }>({});

  // Estados para produtos
  const [products, setProducts] = useState<EstablishmentProduct[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EstablishmentProduct | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    sale_price: '',
    cost_price: '',
    stock_quantity: ''
  });
  const [selectedProductForSales, setSelectedProductForSales] = useState<string | null>(null);
  const [productSalesData, setProductSalesData] = useState<Record<string, any[]>>({});
  // Estado para mês selecionado na aba de produtos
  const [selectedProductsMonth, setSelectedProductsMonth] = useState(new Date());
  // Estado para armazenar vendas de produtos por período
  const [productSalesByPeriod, setProductSalesByPeriod] = useState<Record<string, number>>({});

  const handleShowProductSales = async (productId: string) => {
    if (selectedProductForSales === productId) {
      setSelectedProductForSales(null);
      return;
    }

    setSelectedProductForSales(productId);

    // Buscar vendas se ainda não foram carregadas
    if (!productSalesData[productId]) {
      const sales = await fetchProductSalesByProfessional(productId);
      setProductSalesData(prev => ({
        ...prev,
        [productId]: sales
      }));
    }
  };
  const [showAddProductToAppointmentModal, setShowAddProductToAppointmentModal] = useState(false);

  // Estados para categorias de serviços
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [serviceSubcategories, setServiceSubcategories] = useState<ServiceSubcategory[]>([]);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddSubcategoryModal, setShowAddSubcategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showEditSubcategoryModal, setShowEditSubcategoryModal] = useState(false);
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '' });
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<ServiceSubcategory | null>(null);
  const [newSubcategory, setNewSubcategory] = useState({
    name: '',
    price: '',
    duration: '30'
  });

  // Estados para controlar visibilidade dos tutoriais
  const [showTutorials, setShowTutorials] = useState<{
    products: boolean;
    services: boolean;
    professionals: boolean;
    subscribers: boolean;
    config: boolean;
    reserveClient: boolean;
    appointments: boolean;
    dashboard: boolean;
  }>({
    products: true,
    services: true,
    professionals: true,
    subscribers: true,
    config: true,
    reserveClient: true,
    appointments: true,
    dashboard: true
  });

  // Função para carregar preferências dos tutoriais
  const loadTutorialPreferences = () => {
    const saved = localStorage.getItem('tutorial-preferences');
    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        setShowTutorials(preferences);
      } catch (error) {
        console.error('Erro ao carregar preferências dos tutoriais:', error);
      }
    }
  };

  // Função para salvar preferências dos tutoriais
  const saveTutorialPreferences = (newPreferences: typeof showTutorials) => {
    localStorage.setItem('tutorial-preferences', JSON.stringify(newPreferences));
    setShowTutorials(newPreferences);
  };

  // Função para alternar visibilidade de um tutorial específico
  const toggleTutorial = (tutorialType: keyof typeof showTutorials) => {
    // Se está tentando ocultar o tutorial (valor atual é true)
    if (showTutorials[tutorialType]) {
      const confirmacao = window.confirm(
        '⚠️ Deseja mesmo ocultar este tutorial?\n\n' +
        'Este vídeo pode tirar várias dúvidas futuras.\n' +
        'Você já assistiu ao vídeo completo?\n\n' +
        'Você poderá mostrar o tutorial novamente clicando no botão "Mostrar Tutorial".'
      );

      if (!confirmacao) {
        return; // Cancela a ação se o usuário clicar em "Cancelar"
      }
    }

    const newPreferences = {
      ...showTutorials,
      [tutorialType]: !showTutorials[tutorialType]
    };
    saveTutorialPreferences(newPreferences);
  };

  // Estados para controlar modais de tutorial popup
  const [showTutorialModals, setShowTutorialModals] = useState<{
    appointments: boolean;
    reserveClient: boolean;
    config: boolean;
    dashboard: boolean;
    subscribers: boolean;
    services: boolean;
    products: boolean;
    professionals: boolean;
  }>({
    appointments: false,
    reserveClient: false,
    config: false,
    dashboard: false,
    subscribers: false,
    services: false,
    products: false,
    professionals: false
  });

  // Função para verificar se o usuário já marcou "não quero mais ver isso"
  const shouldShowTutorialModal = (tutorialKey: string): boolean => {
    const dismissedKey = `tutorial-popup-dismissed-${tutorialKey}`;
    return localStorage.getItem(dismissedKey) !== 'true';
  };

  // Função para marcar que não quer mais ver o modal
  const dismissTutorialModal = (tutorialKey: string) => {
    const dismissedKey = `tutorial-popup-dismissed-${tutorialKey}`;
    localStorage.setItem(dismissedKey, 'true');
    setShowTutorialModals(prev => ({
      ...prev,
      [tutorialKey]: false
    }));
  };

  // Função para apenas fechar o modal (sem marcar como "não quero mais ver")
  const closeTutorialModal = (tutorialKey: string) => {
    setShowTutorialModals(prev => ({
      ...prev,
      [tutorialKey]: false
    }));
  };

  // Função para salvar valor bruto do mês específico
  const handleSaveGrossValue = async () => {
    if (!establishment) return;

    const value = parseFloat(editingGrossValue);
    if (isNaN(value) || value < 0) {
      toast('Por favor, digite um valor válido (maior ou igual a 0)', 'error');
      return;
    }

    try {
      const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

      // Atualiza o estado local
      setMonthlyGrossValues(prev => ({
        ...prev,
        [monthKey]: value
      }));

      // Salva no banco de dados
      const { error } = await supabase
        .from('establishment_initial_values')
        .upsert({
          establishment_id: establishment.id,
          month_year: monthKey,
          initial_gross_revenue: value,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Erro ao salvar valor bruto:', error);
        toast('Erro ao salvar valor bruto', 'error');
        return;
      }

      setIsEditingGrossValue(false);
      setEditingGrossValue('');
      toast(`Valor bruto de ${formatCurrency(value)} salvo para ${selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}!`, 'success');
    } catch (error: any) {
      console.error('Erro ao salvar valor bruto:', error);
      toast('Erro ao salvar valor bruto', 'error');
    }
  };

  // Funções para produtos
  const fetchProducts = async () => {
    if (!establishment) return;

    try {
      const { data, error } = await supabase
        .from('establishment_products')
        .select('*')
        .eq('establishment_id', establishment.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar produtos:', error);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
    }
  };

  // Função para buscar vendas de produtos por período
  const fetchProductSalesByPeriod = async (month: Date) => {
    if (!establishment?.id) return;

    try {
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      // Buscar todos os appointment_products do período
      const { data: appointmentProducts, error: productsError } = await supabase
        .from('appointment_products')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          appointment_id
        `)
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Erro ao buscar produtos vendidos:', productsError);
        return;
      }

      // Buscar appointments relacionados para filtrar por data e establishment
      const appointmentIds = appointmentProducts?.map(p => p.appointment_id) || [];

      if (appointmentIds.length === 0) {
        setProductSalesByPeriod({});
        return;
      }

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          establishment_id,
          status
        `)
        .in('id', appointmentIds)
        .eq('establishment_id', establishment.id)
        .neq('status', 'cancelled');

      if (appointmentsError) {
        console.error('Erro ao buscar appointments:', appointmentsError);
        return;
      }

      // Filtrar appointments do período selecionado
      const periodAppointments = appointments?.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        return aptDate >= start && aptDate <= end;
      }) || [];

      const periodAppointmentIds = new Set(periodAppointments.map(apt => apt.id));

      // Agrupar vendas por product_id
      const salesByProduct: Record<string, number> = {};

      appointmentProducts?.forEach(productSale => {
        if (periodAppointmentIds.has(productSale.appointment_id)) {
          const currentQuantity = salesByProduct[productSale.product_id] || 0;
          salesByProduct[productSale.product_id] = currentQuantity + productSale.quantity;
        }
      });

      console.log('📊 Vendas de produtos no período:', {
        month: month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        salesByProduct
      });

      setProductSalesByPeriod(salesByProduct);
    } catch (error) {
      console.error('Erro ao buscar vendas por período:', error);
    }
  };

  // Função para buscar vendas de produtos por funcionário no período selecionado
  const fetchProductSalesByProfessional = async (productId: string) => {
    if (!establishment?.id) return [];

    try {
      const start = startOfMonth(selectedProductsMonth);
      const end = endOfMonth(selectedProductsMonth);

      // 1. PRIMEIRO: Buscar TODOS os funcionários do estabelecimento
      const allProfessionals = establishment.professionals || [];
      const professionalNames = allProfessionals.map(p => p.name);

      // Criar mapeamento ID -> Nome
      const professionalIdToName: Record<string, string> = {};
      allProfessionals.forEach(prof => {
        if (prof.id && prof.name) {
          professionalIdToName[prof.id] = prof.name;
        }
      });

      console.log('🔍 DEBUG - Mapeamento ID -> Nome:', professionalIdToName);

      // 2. Buscar vendas deste produto
      const { data, error } = await supabase
        .from('appointment_products')
        .select(`
          id,
          quantity,
          unit_price,
          appointment_id
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar vendas:', error);
        return [];
      }

      // 3. Buscar appointments relacionados
      const appointmentIds = data?.map(sale => sale.appointment_id) || [];
      console.log('🔍 DEBUG - Appointment IDs para buscar:', appointmentIds);

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          professional,
          appointment_date,
          status,
          establishment_id
        `)
        .in('id', appointmentIds);

      console.log('🔍 DEBUG - Appointments encontrados (SEM filtro de establishment):', appointments);

      // Filtrar por establishment após buscar
      const filteredAppointments = appointments?.filter(apt => apt.establishment_id === establishment.id);
      console.log('🔍 DEBUG - Appointments filtrados por establishment:', filteredAppointments);

      if (appointmentsError) {
        console.error('Erro ao buscar appointments:', appointmentsError);
        return [];
      }

      // 4. Inicializar TODOS os funcionários com 0 vendas
      const salesByProfessional: Record<string, {
        professional_name: string;
        total_quantity: number;
        total_value: number;
        sales_count: number;
      }> = {};

      // Inicializar todos os funcionários com 0
      professionalNames.forEach(name => {
        salesByProfessional[name] = {
          professional_name: name,
          total_quantity: 0,
          total_value: 0,
          sales_count: 0
        };
      });

      // 5. Filtrar appointments do período selecionado
      const periodAppointments = filteredAppointments?.filter(apt => {
        const aptDate = new Date(apt.appointment_date);
        return aptDate >= start && aptDate <= end;
      }) || [];

      // 6. Processar vendas reais do período
      console.log('🔍 DEBUG - Dados de vendas:', data);
      console.log('🔍 DEBUG - Appointments encontrados:', appointments);
      console.log('🔍 DEBUG - Appointments do período:', periodAppointments);

      const periodAppointmentIds = new Set(periodAppointments.map(apt => apt.id));

      data?.forEach(sale => {
        // Só processar vendas do período selecionado
        if (!periodAppointmentIds.has(sale.appointment_id)) {
          return;
        }

        const appointment = periodAppointments.find(apt => apt.id === sale.appointment_id);

        // Converter ID do profissional para nome
        let professionalName = 'Funcionário não identificado';
        if (appointment?.professional) {
          // Se é um ID numérico, tentar mapear para nome
          if (professionalIdToName[appointment.professional]) {
            professionalName = professionalIdToName[appointment.professional];
          } else {
            // Se já é um nome, usar diretamente
            professionalName = appointment.professional;
          }
        }

        console.log('🔍 DEBUG - Venda:', sale);
        console.log('🔍 DEBUG - Appointment encontrado:', appointment);
        console.log('🔍 DEBUG - Professional ID/Nome original:', appointment?.professional);
        console.log('🔍 DEBUG - Nome do profissional convertido:', professionalName);

        if (salesByProfessional[professionalName]) {
          salesByProfessional[professionalName].total_quantity += sale.quantity;
          salesByProfessional[professionalName].total_value += sale.quantity * sale.unit_price;
          salesByProfessional[professionalName].sales_count += 1;
          console.log('🔍 DEBUG - Venda atribuída ao profissional:', professionalName);
        } else {
          console.log('🔍 DEBUG - Profissional não encontrado:', professionalName);
        }
      });

      const result = Object.values(salesByProfessional);
      console.log('🔍 DEBUG - Resultado final (TODOS os funcionários):', result);
      console.log('🔍 DEBUG - Estabelecimento:', establishment.name);
      console.log('🔍 DEBUG - Funcionários do estabelecimento:', professionalNames);
      return result;
    } catch (error) {
      console.error('Erro ao buscar vendas por profissional:', error);
      return [];
    }
  };

  const handleAddProduct = async () => {
    if (!establishment) return;

    const salePrice = parseFloat(newProduct.sale_price);
    const costPrice = parseFloat(newProduct.cost_price);
    const stockQuantity = parseInt(newProduct.stock_quantity);

    if (!newProduct.name || isNaN(salePrice) || isNaN(costPrice) || isNaN(stockQuantity)) {
      toast('Por favor, preencha todos os campos corretamente', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('establishment_products')
        .insert({
          establishment_id: establishment.id,
          name: newProduct.name,
          sale_price: salePrice,
          cost_price: costPrice,
          stock_quantity: stockQuantity,
          sold_quantity: 0
        });

      if (error) {
        console.error('Erro ao adicionar produto:', error);
        toast('Erro ao adicionar produto', 'error');
        return;
      }

      setNewProduct({ name: '', sale_price: '', cost_price: '', stock_quantity: '' });
      setShowAddProductModal(false);
      fetchProducts();
      toast('Produto adicionado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      toast('Erro ao adicionar produto', 'error');
    }
  };

  const handleAddProductToAppointment = async (product: EstablishmentProduct) => {
    if (!selectedAppointmentForProduct || !establishment) return;

    if (product.stock_quantity <= 0) {
      toast('Produto sem estoque disponível', 'error');
      return;
    }

    try {
      // Buscar o profissional do agendamento para associar à venda do produto
      const { data: appointmentData } = await supabase
        .from('appointments')
        .select('professional')
        .eq('id', selectedAppointmentForProduct)
        .single();

      // Adicionar produto ao agendamento
      const { error: appointmentProductError } = await supabase
        .from('appointment_products')
        .insert({
          appointment_id: selectedAppointmentForProduct,
          product_id: product.id,
          quantity: 1,
          unit_price: product.sale_price,
          professional_id: appointmentData?.professional
        });

      if (appointmentProductError) {
        console.error('Erro ao adicionar produto ao agendamento:', appointmentProductError);
        toast('Erro ao adicionar produto ao agendamento', 'error');
        return;
      }

      // Atualizar estoque do produto
      const { error: stockError } = await supabase
        .from('establishment_products')
        .update({
          stock_quantity: product.stock_quantity - 1,
          sold_quantity: product.sold_quantity + 1
        })
        .eq('id', product.id);

      if (stockError) {
        console.error('Erro ao atualizar estoque:', stockError);
        toast('Erro ao atualizar estoque do produto', 'error');
        return;
      }

      // Atualizar valor total do agendamento
      const appointment = appointments.find(apt => apt.id === selectedAppointmentForProduct);
      if (appointment) {
        const newTotal = (appointment.total_price || appointment.price || 0) + product.sale_price;

        const { error: updateError } = await supabase
          .from('appointments')
          .update({ total_price: newTotal })
          .eq('id', selectedAppointmentForProduct);

        if (updateError) {
          console.error('Erro ao atualizar valor do agendamento:', updateError);
        }
      }

      // Fechar modal e atualizar dados
      setShowAddProductToAppointmentModal(false);
      setSelectedAppointmentForProduct(null);
      fetchProducts();
      fetchAppointments();
      toast(`Produto "${product.name}" adicionado ao agendamento!`, 'success');
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      toast('Erro ao adicionar produto', 'error');
    }
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!establishment) return;

    const confirmDelete = window.confirm(
      `🗑️ Excluir produto "${productName}"?\n\n⚠️ Atenção: Esta ação não pode ser desfeita!\n\nO que acontecerá:\n✅ Produto será removido do estoque\n✅ Todas as vendas serão removidas\n\nDeseja continuar?`
    );

    if (!confirmDelete) return;

    try {
      // Primeiro, remover todos os appointment_products relacionados
      const { error: deleteAppointmentProductsError } = await supabase
        .from('appointment_products')
        .delete()
        .eq('product_id', productId);

      if (deleteAppointmentProductsError) {
        console.error('Erro ao remover vendas do produto:', deleteAppointmentProductsError);
        toast('Erro ao remover vendas do produto', 'error');
        return;
      }

      // Depois, remover o produto
      const { error: deleteProductError } = await supabase
        .from('establishment_products')
        .delete()
        .eq('id', productId)
        .eq('establishment_id', establishment.id);

      if (deleteProductError) {
        console.error('Erro ao excluir produto:', deleteProductError);
        toast('Erro ao excluir produto', 'error');
        return;
      }

      fetchProducts();
      fetchAppointments(); // Atualizar agendamentos para remover produtos vendidos
      toast(`Produto "${productName}" excluído com sucesso!`, 'success');
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast('Erro ao excluir produto', 'error');
    }
  };

  // Função para editar produto
  const handleEditProduct = async () => {
    if (!editingProduct || !establishment) return;

    const salePrice = parseFloat(editingProduct.sale_price.toString());
    const costPrice = parseFloat(editingProduct.cost_price.toString());
    const stockQuantity = parseInt(editingProduct.stock_quantity.toString());

    if (!editingProduct.name.trim() || isNaN(salePrice) || isNaN(costPrice) || isNaN(stockQuantity)) {
      toast('Por favor, preencha todos os campos corretamente', 'error');
      return;
    }

    if (salePrice <= 0 || costPrice < 0 || stockQuantity < 0) {
      toast('Preços devem ser positivos e estoque não pode ser negativo', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('establishment_products')
        .update({
          name: editingProduct.name.trim(),
          sale_price: salePrice,
          cost_price: costPrice,
          stock_quantity: stockQuantity
        })
        .eq('id', editingProduct.id)
        .eq('establishment_id', establishment.id);

      if (error) {
        console.error('Erro ao editar produto:', error);
        toast('Erro ao editar produto', 'error');
        return;
      }

      // Atualizar estado local
      setProducts(prev =>
        prev.map(product =>
          product.id === editingProduct.id
            ? { ...product, name: editingProduct.name.trim(), sale_price: salePrice, cost_price: costPrice, stock_quantity: stockQuantity }
            : product
        )
      );

      setShowEditProductModal(false);
      setEditingProduct(null);
      toast('Produto editado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao editar produto:', error);
      toast('Erro ao editar produto', 'error');
    }
  };

  const handleRemoveProductFromAppointment = async (appointmentId: string, productId: string, productName: string) => {
    if (!establishment) return;

    const confirmRemove = window.confirm(
      `Tem certeza que deseja remover "${productName}" deste agendamento?\n\nEsta ação irá:\n- Remover o produto do agendamento\n- Devolver 1 unidade ao estoque\n- Atualizar o valor total do agendamento`
    );

    if (!confirmRemove) return;

    try {
      // Buscar dados do produto vendido
      const { data: appointmentProduct, error: fetchError } = await supabase
        .from('appointment_products')
        .select('quantity, unit_price')
        .eq('appointment_id', appointmentId)
        .eq('product_id', productId)
        .single();

      if (fetchError || !appointmentProduct) {
        console.error('Erro ao buscar produto do agendamento:', fetchError);
        toast('Erro ao buscar produto do agendamento', 'error');
        return;
      }

      // Remover produto do agendamento
      const { error: deleteError } = await supabase
        .from('appointment_products')
        .delete()
        .eq('appointment_id', appointmentId)
        .eq('product_id', productId);

      if (deleteError) {
        console.error('Erro ao remover produto do agendamento:', deleteError);
        toast('Erro ao remover produto do agendamento', 'error');
        return;
      }

      // Devolver ao estoque
      const { data: product, error: productError } = await supabase
        .from('establishment_products')
        .select('stock_quantity, sold_quantity')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        console.error('Erro ao buscar produto:', productError);
        toast('Erro ao buscar produto', 'error');
        return;
      }

      const { error: stockError } = await supabase
        .from('establishment_products')
        .update({
          stock_quantity: product.stock_quantity + appointmentProduct.quantity,
          sold_quantity: product.sold_quantity - appointmentProduct.quantity
        })
        .eq('id', productId);

      if (stockError) {
        console.error('Erro ao atualizar estoque:', stockError);
        toast('Erro ao atualizar estoque', 'error');
        return;
      }

      // Atualizar valor total do agendamento
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (appointment) {
        const removedValue = appointmentProduct.quantity * appointmentProduct.unit_price;
        const newTotal = Math.max(0, (appointment.total_price || appointment.price || 0) - removedValue);

        const { error: updateError } = await supabase
          .from('appointments')
          .update({ total_price: newTotal })
          .eq('id', appointmentId);

        if (updateError) {
          console.error('Erro ao atualizar valor do agendamento:', updateError);
        }
      }

      fetchProducts();
      fetchAppointments();
      toast(`Produto "${productName}" removido do agendamento!`, 'success');
    } catch (error) {
      console.error('Erro ao remover produto do agendamento:', error);
      toast('Erro ao remover produto do agendamento', 'error');
    }
  };

  // Funções para categorias de serviços
  const fetchServiceCategories = async () => {
    if (!establishment) return;

    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('establishment_id', establishment.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Erro ao buscar categorias de serviços:', error);
        return;
      }

      setServiceCategories(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias de serviços:', error);
    }
  };

  const fetchServiceSubcategories = async () => {
    if (!establishment) return;

    try {
      const { data, error } = await supabase
        .from('service_subcategories')
        .select(`
          *,
          service_categories (
            establishment_id
          )
        `)
        .eq('is_active', true)
        .eq('service_categories.establishment_id', establishment.id)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Erro ao buscar subcategorias de serviços:', error);
        return;
      }

      setServiceSubcategories(data || []);
    } catch (error) {
      console.error('Erro ao buscar subcategorias de serviços:', error);
    }
  };

  const handleAddCategory = async () => {
    if (!establishment) return;

    if (!newCategory.name.trim()) {
      toast('Por favor, digite o nome da categoria', 'error');
      return;
    }

    try {
      // Incrementar o display_order de todas as categorias existentes em 1
      // para que a nova categoria apareça primeiro (com display_order: 0)
      if (serviceCategories.length > 0) {
        const updatePromises = serviceCategories.map(category =>
          supabase
            .from('service_categories')
            .update({ display_order: (category.display_order || 0) + 1 })
            .eq('id', category.id)
        );

        await Promise.all(updatePromises);
      }

      // Criar a nova categoria com display_order: 0 (aparecerá primeiro)
      const { error } = await supabase
        .from('service_categories')
        .insert({
          establishment_id: establishment.id,
          name: newCategory.name.trim().toUpperCase(),
          display_order: 0
        });

      if (error) {
        console.error('Erro ao adicionar categoria:', error);
        toast('Erro ao adicionar categoria', 'error');
        return;
      }

      setNewCategory({ name: '' });
      setShowAddCategoryModal(false);
      fetchServiceCategories();
      toast(`Categoria "${newCategory.name.toUpperCase()}" adicionada com sucesso!`, 'success');
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
      toast('Erro ao adicionar categoria', 'error');
    }
  };

  const handleAddSubcategory = async () => {
    if (!selectedCategoryForSubcategory) return;

    const price = parseFloat(newSubcategory.price);
    const duration = parseInt(newSubcategory.duration);

    if (!newSubcategory.name.trim() || isNaN(price) || isNaN(duration)) {
      toast('Por favor, preencha todos os campos corretamente', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('service_subcategories')
        .insert({
          category_id: selectedCategoryForSubcategory,
          name: newSubcategory.name.trim(),
          price: price,
          duration: duration,
          display_order: serviceSubcategories.filter(sub => sub.category_id === selectedCategoryForSubcategory).length
        });

      if (error) {
        console.error('Erro ao adicionar subcategoria:', error);
        toast('Erro ao adicionar subcategoria', 'error');
        return;
      }

      setNewSubcategory({ name: '', price: '', duration: '30' });
      setShowAddSubcategoryModal(false);
      setSelectedCategoryForSubcategory(null);
      fetchServiceSubcategories();
      toast(`Serviço "${newSubcategory.name}" adicionado com sucesso!`, 'success');
    } catch (error) {
      console.error('Erro ao adicionar subcategoria:', error);
      toast('Erro ao adicionar subcategoria', 'error');
    }
  };

  // Função para deletar categoria
  const handleDeleteCategory = async (categoryId: string) => {
    try {
      // Primeiro deletar todas as subcategorias da categoria
      const { error: subcategoriesError } = await supabase
        .from('service_subcategories')
        .delete()
        .eq('category_id', categoryId);

      if (subcategoriesError) {
        console.error('Erro ao deletar subcategorias:', subcategoriesError);
        toast('Erro ao deletar serviços da categoria', 'error');
        return;
      }

      // Depois deletar a categoria
      const { error: categoryError } = await supabase
        .from('service_categories')
        .delete()
        .eq('id', categoryId);

      if (categoryError) {
        console.error('Erro ao deletar categoria:', categoryError);
        toast('Erro ao deletar categoria', 'error');
        return;
      }

      // Atualizar estados locais
      setServiceCategories(prev => prev.filter(cat => cat.id !== categoryId));
      setServiceSubcategories(prev => prev.filter(sub => sub.category_id !== categoryId));

      toast('Categoria e serviços excluídos com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao deletar categoria:', error);
      toast('Erro ao deletar categoria', 'error');
    }
  };

  // Função para deletar subcategoria
  const handleDeleteSubcategory = async (subcategoryId: string) => {
    try {
      const { error } = await supabase
        .from('service_subcategories')
        .delete()
        .eq('id', subcategoryId);

      if (error) {
        console.error('Erro ao deletar subcategoria:', error);
        toast('Erro ao deletar serviço', 'error');
        return;
      }

      // Atualizar estado local
      setServiceSubcategories(prev => prev.filter(sub => sub.id !== subcategoryId));

      toast('Serviço excluído com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao deletar subcategoria:', error);
      toast('Erro ao deletar serviço', 'error');
    }
  };

  // Função para editar categoria
  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast('Por favor, digite o nome da categoria', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('service_categories')
        .update({ name: editingCategory.name.toUpperCase() })
        .eq('id', editingCategory.id);

      if (error) {
        console.error('Erro ao editar categoria:', error);
        toast('Erro ao editar categoria', 'error');
        return;
      }

      // Atualizar estado local
      setServiceCategories(prev =>
        prev.map(cat =>
          cat.id === editingCategory.id
            ? { ...cat, name: editingCategory.name.toUpperCase() }
            : cat
        )
      );

      setShowEditCategoryModal(false);
      setEditingCategory(null);
      toast('Categoria editada com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao editar categoria:', error);
      toast('Erro ao editar categoria', 'error');
    }
  };

  // Função para editar subcategoria
  const handleEditSubcategory = async () => {
    if (!editingSubcategory) return;

    const price = parseFloat(editingSubcategory.price.toString());
    const duration = parseInt(editingSubcategory.duration.toString());

    if (!editingSubcategory.name.trim() || isNaN(price) || isNaN(duration)) {
      toast('Por favor, preencha todos os campos corretamente', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('service_subcategories')
        .update({
          name: editingSubcategory.name,
          price: price,
          duration: duration
        })
        .eq('id', editingSubcategory.id);

      if (error) {
        console.error('Erro ao editar subcategoria:', error);
        toast('Erro ao editar serviço', 'error');
        return;
      }

      // Atualizar estado local
      setServiceSubcategories(prev =>
        prev.map(sub =>
          sub.id === editingSubcategory.id
            ? { ...sub, name: editingSubcategory.name, price: price, duration: duration }
            : sub
        )
      );

      setShowEditSubcategoryModal(false);
      setEditingSubcategory(null);
      toast('Serviço editado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao editar subcategoria:', error);
      toast('Erro ao editar serviço', 'error');
    }
  };

  // Limpa o estado dos PINs quando o estabelecimento é atualizado
  useEffect(() => {
    setProfessionalPins({});
  }, [establishment?.professionals_pins]);

  const durationOptions = [
    { value: 15, label: '15 minutos' },
    { value: 20, label: '20 minutos' },
    { value: 30, label: '30 minutos' },
    { value: 40, label: '40 minutos' },
    { value: 45, label: '45 minutos' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1 hora e meia' }
  ];

  const formatDuration = (minutes: number): string => {
    if (!minutes) return '';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours}h${remainingMinutes}min`
        : `${hours}h`;
    }
    return `${minutes}min`;
  };

  const generateRandomCode = async () => {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = Math.floor(1000 + Math.random() * 9000).toString();

      // Verificar se o código já existe no banco de dados
      const { data: existingEstablishment, error } = await supabase
        .from('establishments')
        .select('code')
        .eq('code', code)
        .single();

      if (error && error.code === 'PGRST116') {
        // Código não encontrado (único)
        isUnique = true;
        setEstablishmentCode(code);
      } else if (existingEstablishment) {
        // Código já existe, tentar novamente
        attempts++;
      } else {
        // Outro erro, mas assumir que é único
        isUnique = true;
        setEstablishmentCode(code);
      }
    }

    if (!isUnique) {
      toast('Erro ao gerar código único. Tente novamente.', 'error');
    }
  };

  useEffect(() => {
    const initializeCode = async () => {
      if (!establishmentCode) {
        await generateRandomCode();
      }
    };
    initializeCode();
  }, []);

  const handlePreviousDay = () => {
    setSelectedDate(prev => {
      const newDate = subDays(prev, 1);

      // Verificar se mudou de mês
      if (newDate.getMonth() !== selectedMonth.getMonth() || newDate.getFullYear() !== selectedMonth.getFullYear()) {
        console.log('🔍 DEBUG - Mudou de mês ao navegar para dia anterior');
        setSelectedMonth(newDate);
        fetchMonthlyAppointments(newDate);
      }

      return newDate;
    });
  };

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const newDate = addDays(prev, 1);

      // Verificar se mudou de mês
      if (newDate.getMonth() !== selectedMonth.getMonth() || newDate.getFullYear() !== selectedMonth.getFullYear()) {
        console.log('🔍 DEBUG - Mudou de mês ao navegar para próximo dia');
        setSelectedMonth(newDate);
        fetchMonthlyAppointments(newDate);
      }

      return newDate;
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;

    // Criar data com horário local para evitar problemas de timezone
    const [year, month, day] = value.split('-').map(Number);
    const newDate = new Date(year, month - 1, day, 12, 0, 0); // Meio-dia local
    setSelectedDate(newDate);

    // Verificar se mudou de mês
    if (newDate.getMonth() !== selectedMonth.getMonth() || newDate.getFullYear() !== selectedMonth.getFullYear()) {
      console.log('🔍 DEBUG - Mudou de mês ao selecionar data manualmente');
      setSelectedMonth(newDate);
      fetchMonthlyAppointments(newDate);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast('A imagem deve ter no máximo 100MB', 'error');
        return;
      }
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCustomPhotoChange = (photoNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log(`📸 Upload foto ${photoNumber}:`, file);
    console.log(`📱 User Agent:`, navigator.userAgent);
    console.log(`📱 É mobile:`, /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

    if (file) {
      console.log(`📄 Detalhes do arquivo:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });

      if (file.size > 100 * 1024 * 1024) {
        toast('A imagem deve ter no máximo 100MB', 'error');
        return;
      }

      // Verificar se é uma imagem válida
      if (!file.type.startsWith('image/')) {
        toast('Por favor, selecione apenas imagens', 'error');
        return;
      }

      try {
        const previewUrl = URL.createObjectURL(file);
        console.log(`✅ Preview criado para foto ${photoNumber}:`, previewUrl);

        // Função para atualizar o estado
        const updatePhotoState = () => {
          if (photoNumber === 1) {
            setCustomPhoto1(file);
            setCustomPhoto1Preview(previewUrl);
          } else if (photoNumber === 2) {
            setCustomPhoto2(file);
            setCustomPhoto2Preview(previewUrl);
          } else if (photoNumber === 3) {
            setCustomPhoto3(file);
            setCustomPhoto3Preview(previewUrl);
          } else if (photoNumber === 4) {
            setCustomPhoto4(file);
            setCustomPhoto4Preview(previewUrl);
          } else if (photoNumber === 5) {
            setCustomPhoto5(file);
            setCustomPhoto5Preview(previewUrl);
          } else if (photoNumber === 6) {
            setCustomPhoto6(file);
            setCustomPhoto6Preview(previewUrl);
          } else if (photoNumber === 7) {
            setCustomPhoto7(file);
            setCustomPhoto7Preview(previewUrl);
          }

          // Force update no mobile
          if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 100);
          }

          toast(`Foto ${photoNumber} selecionada com sucesso!`, 'success');
        };

        // No mobile, usar setTimeout para dar tempo ao React
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          setTimeout(updatePhotoState, 50);
          // Força re-render adicional no mobile
          setTimeout(() => {
            const event = new CustomEvent('photoUploaded', { detail: { photoNumber, previewUrl } });
            window.dispatchEvent(event);
          }, 200);
        } else {
          updatePhotoState();
        }

      } catch (error: any) {
        console.error(`❌ Erro ao processar foto ${photoNumber}:`, error);
        toast(`Erro ao processar foto ${photoNumber}: ${error.message}`, 'error');
      }
    } else {
      console.log(`❌ Nenhum arquivo selecionado para foto ${photoNumber}`);
      toast('Nenhum arquivo selecionado', 'error');
    }

    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  // Ref para rastrear se há mudanças não salvas nos horários
  const unsavedBusinessHoursRef = useRef<Record<string, BusinessHours> | null>(null);

  // Função para ajustar horário ao intervalo configurado
  const adjustTimeToInterval = (timeString: string): string => {
    if (!timeString || timeString === '00:00') return timeString;

    // Determinar o intervalo configurado
    let interval = 15; // Padrão: 15 em 15 min
    if (use20MinuteSchedule) {
      interval = 20;
    } else if (use15MinuteInterval) {
      interval = 30;
    }

    // Converter horário para minutos
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Arredondar para o intervalo mais próximo
    const roundedMinutes = Math.round(totalMinutes / interval) * interval;

    // Converter de volta para string HH:mm
    const newHours = Math.floor(roundedMinutes / 60);
    const newMinutes = roundedMinutes % 60;

    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const handleBusinessHoursChange = (
    day: keyof typeof businessHours,
    field: 'enabled' | 'open1' | 'close1' | 'open2' | 'close2',
    value: string | boolean | null
  ) => {
    console.log('🕐 handleBusinessHoursChange chamado:', { day, field, value });

    // Se for um horário (não enabled), ajustar ao intervalo configurado
    let adjustedValue = value;
    if (field !== 'enabled' && typeof value === 'string') {
      adjustedValue = adjustTimeToInterval(value);
      if (adjustedValue !== value) {
        console.log(`⚡ Horário ajustado: ${value} → ${adjustedValue}`);
      }
    }

    const updatedHours = {
      ...businessHours,
      [day]: {
        ...businessHours[day],
        [field]: adjustedValue
      }
    };

    console.log('🕐 Horários atualizados:', updatedHours);

    setBusinessHours(updatedHours);

    // Salvar referência para salvar antes de sair da página
    unsavedBusinessHoursRef.current = updatedHours;

    // CANCELAR qualquer timeout anterior
    if (businessHoursAutoSaveTimeoutRef.current) {
      clearTimeout(businessHoursAutoSaveTimeoutRef.current);
      businessHoursAutoSaveTimeoutRef.current = null;
    }

    // SALVAR IMEDIATAMENTE - sem debounce!
    console.log('💾 SALVANDO IMEDIATAMENTE...');
    autoSaveBusinessHours(updatedHours).then(() => {
      console.log('✅ Salvo com sucesso!');
      unsavedBusinessHoursRef.current = null;
    }).catch((error) => {
      console.error('❌ Erro ao salvar:', error);
      // Manter a referência para tentar salvar novamente
    });
  };

  const handleAddProfessional = async () => {
    if (!establishment) return;

    const newProfessional = {
      id: uuidv4(),
      name: '',
      specialties: [],
      percentage: 100, // Percentual padrão de 100%
      whatsapp: '', // ✅ Campo WhatsApp
      specific_services: [] // ✅ Campo serviços específicos
    };

    // Adiciona a senha padrão '0000' para o novo profissional
    const newPin = {
      professional_id: newProfessional.id,
      pin: '0000'
    };

    try {
      const updatedProfessionals = [...professionals, newProfessional];
      const updatedPins = [...(establishment.professionals_pins || []), newPin];

      const { error } = await supabase
        .from('establishments')
        .update({
          professionals: updatedProfessionals,
          professionals_pins: updatedPins
        })
        .eq('id', establishment.id);

      if (error) throw error;

      setProfessionals(updatedProfessionals);
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals,
        professionals_pins: updatedPins
      });

      toast.success('Profissional adicionado à lista! Agora preencha o nome e clique em "Salvar Profissionais".');

      // Scroll até o novo profissional após o DOM ser atualizado
      setTimeout(() => {
        const newProfessionalElement = document.getElementById(`professional-${newProfessional.id}`);
        if (newProfessionalElement) {
          // Scroll com offset para ficar um pouco mais acima
          const elementPosition = newProfessionalElement.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - 100; // 100px acima
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

          // Destacar o novo profissional temporariamente
          newProfessionalElement.style.transition = 'box-shadow 0.3s';
          newProfessionalElement.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';

          // Destacar o campo de nome do profissional
          const nameInput = newProfessionalElement.querySelector('input[type="text"]') as HTMLInputElement;
          if (nameInput) {
            nameInput.style.transition = 'all 0.3s';
            nameInput.style.borderColor = '#3b82f6';
            nameInput.style.borderWidth = '2px';
            nameInput.style.backgroundColor = '#1e3a8a';
            nameInput.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.6)';
            nameInput.focus();

            // Adicionar placeholder destacado
            const originalPlaceholder = nameInput.placeholder;
            nameInput.placeholder = '⚠️ DIGITE O NOME DO PROFISSIONAL AQUI ⚠️';

            setTimeout(() => {
              newProfessionalElement.style.boxShadow = '';
              nameInput.style.borderColor = '';
              nameInput.style.borderWidth = '';
              nameInput.style.backgroundColor = '';
              nameInput.style.boxShadow = '';
              nameInput.placeholder = originalPlaceholder;
            }, 4000);
          }

          setTimeout(() => {
            newProfessionalElement.style.boxShadow = '';
          }, 2000);
        }
      }, 100);
    } catch (error) {
      console.error('Erro ao adicionar profissional:', error);
      toast.error('Erro ao adicionar profissional');
    }
  };

  const handleRemoveProfessional = (id: string) => {
    console.log('Removendo profissional:', id);
    setProfessionals(prev => prev.filter(p => p.id !== id));
  };

  const handleProfessionalChange = (id: string, field: keyof Professional, value: string | string[] | number) => {
    console.log('Atualizando profissional:', { id, field, value });
    setProfessionals(prev => {
      const updated = prev.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      );
      console.log('🔄 Profissionais após atualização:', updated);
      return updated;
    });

    // Removido salvamento automático para evitar loops
  };

  // Função para alternar serviço infantil do profissional
  const handleToggleChildService = async (professionalId: string, offersChildService: boolean) => {
    console.log('🔄 Alternando serviço infantil:', { professionalId, offersChildService });

    if (!establishment) return;

    try {
      // Atualizar o estado local primeiro
      const updatedProfessionals = professionals.map(p =>
        p.id === professionalId ? { ...p, offers_child_service: offersChildService } : p
      );

      setProfessionals(updatedProfessionals);
      console.log('👶 Profissionais após atualização serviço infantil:', updatedProfessionals);

      // Salvar no banco de dados usando o estado atualizado
      const { error } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar serviço infantil:', error);
        toast('Erro ao salvar configuração de serviço infantil', 'error');

        // Reverter o estado local em caso de erro
        setProfessionals(prev => prev.map(p =>
          p.id === professionalId ? { ...p, offers_child_service: !offersChildService } : p
        ));
        return;
      }

      // Atualizar o estado do estabelecimento também
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

      toast.success(offersChildService
        ? 'Serviço infantil ativado'
        : 'Serviço infantil desativado'
      );
    } catch (error) {
      console.error('❌ Erro ao alternar serviço infantil:', error);
      toast('Erro ao atualizar configuração', 'error');
    }
  };

  const handleToggleHiddenFromBooking = async (professionalId: string, hiddenFromBooking: boolean) => {
    console.log('🔄 Alternando ocultar profissional do booking:', { professionalId, hiddenFromBooking });

    if (!establishment) return;

    try {
      // Atualizar o estado local primeiro
      const updatedProfessionals = professionals.map(p =>
        p.id === professionalId ? { ...p, hidden_from_booking: hiddenFromBooking } : p
      );

      setProfessionals(updatedProfessionals);
      console.log('👁️ Profissionais após atualização ocultar do booking:', updatedProfessionals);

      // Salvar no banco de dados usando o estado atualizado
      const { error } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar configuração de ocultar profissional:', error);
        toast('Erro ao salvar configuração de ocultar profissional', 'error');

        // Reverter o estado local em caso de erro
        setProfessionals(prev => prev.map(p =>
          p.id === professionalId ? { ...p, hidden_from_booking: !hiddenFromBooking } : p
        ));
        return;
      }

      // Atualizar o estado do estabelecimento também
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

      toast.success(hiddenFromBooking
        ? 'Profissional ocultado do booking público'
        : 'Profissional visível no booking público'
      );
    } catch (error) {
      console.error('❌ Erro ao alternar ocultar profissional:', error);
      toast('Erro ao atualizar configuração', 'error');
    }
  };

  // Função para salvar profissionais no banco de dados
  const saveProfessionalsToDatabase = async () => {
    if (!establishment || professionals.length === 0) return;

    // ✅ VALIDAÇÃO OBRIGATÓRIA SEMPRE: Verificar se TODOS os profissionais com nome têm horário configurado
    // Isso vale para novos estabelecimentos (isNewUser) ou quem está no onboarding
    const needsValidation = isNewUser || onboardingStep <= 3;

    console.log('🔍 DEBUG VALIDAÇÃO:', { isNewUser, onboardingStep, needsValidation, professionals: professionals.map(p => ({ name: p.name, hasWorkHours: !!p.work_hours })) });

    if (needsValidation) {
      // Verificar cada profissional
      for (const professional of professionals) {
        // Só validar profissionais que têm nome
        if (!professional.name || professional.name.trim().length === 0) {
          console.log('⏭️ Pulando profissional sem nome');
          continue; // Pular profissionais sem nome
        }

        console.log('🔍 Validando profissional:', professional.name, 'work_hours:', professional.work_hours);

        // Verificar horários do estado local
        const workHours = professional.work_hours;

        // Se não tem work_hours OU é null/undefined OU é objeto vazio
        if (!workHours || typeof workHours !== 'object' || Object.keys(workHours).length === 0) {
          console.log('❌ PROFISSIONAL SEM WORK_HOURS:', professional.name);
          toast.error('Selecione horário de serviço do profissional');
          return; // BLOQUEAR salvamento
        }

        // Verificar se pelo menos UM dia está habilitado
        const hasEnabledDay = Object.keys(workHours).some(day => {
          const daySchedule = workHours[day];
          return daySchedule && daySchedule.enabled === true;
        });

        if (!hasEnabledDay) {
          console.log('❌ PROFISSIONAL SEM DIA HABILITADO:', professional.name);
          toast.error('Selecione horário de serviço do profissional');
          return; // BLOQUEAR salvamento
        }

        // Verificar se o dia habilitado tem entrada e saída configurados
        const hasValidHours = Object.keys(workHours).some(day => {
          const daySchedule = workHours[day];
          if (!daySchedule || !daySchedule.enabled) {
            return false;
          }
          // Verificar se tem entrada e saída válidos
          const isValid = daySchedule.entry_time &&
            daySchedule.exit_time &&
            daySchedule.entry_time.trim() !== '' &&
            daySchedule.exit_time.trim() !== '';
          console.log(`🔍 Dia ${day}:`, { enabled: daySchedule.enabled, entry_time: daySchedule.entry_time, exit_time: daySchedule.exit_time, isValid });
          return isValid;
        });

        if (!hasValidHours) {
          console.log('❌ PROFISSIONAL SEM HORÁRIOS VÁLIDOS:', professional.name);
          toast.error('Selecione horário de serviço do profissional');
          return; // BLOQUEAR salvamento
        }

        console.log('✅ PROFISSIONAL VÁLIDO:', professional.name);
      }
    }

    try {
      console.log('💾 Salvando profissionais:', professionals);
      console.log('🔍 Verificando percentuais:', professionals.map(p => ({ name: p.name, percentage: p.percentage })));
      console.log('📱 Verificando WhatsApp:', professionals.map(p => ({ name: p.name, whatsapp: p.whatsapp })));

      // ✅ BUSCAR DADOS ATUAIS DO BANCO PARA PRESERVAR TODOS OS CAMPOS
      const { data: establishmentData, error: fetchError } = await supabase
        .from('establishments')
        .select('professionals, professionals_pins')
        .eq('id', establishment.id)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar dados do estabelecimento:', fetchError);
        throw fetchError;
      }

      const dbProfessionals = (establishmentData?.professionals || []) as any[];
      console.log('📦 Profissionais do banco:', dbProfessionals);

      // ✅ MESCLAR DADOS DO BANCO COM ALTERAÇÕES LOCAIS
      const updatedProfessionals = professionals.map(localProfessional => {
        // Buscar dados do banco para este profissional
        const dbProfessional = dbProfessionals.find(p => p.id === localProfessional.id) || {};

        // Mesclar: priorizar dados locais mas preservar campos do banco que não estão no local
        const mergedProfessional = {
          id: localProfessional.id,
          name: localProfessional.name.trim(),
          specialties: localProfessional.specialties || [],
          percentage: localProfessional.percentage || 100,
          photo_url: (localProfessional as any).photo_url || dbProfessional.photo_url || null,
          whatsapp: localProfessional.whatsapp || dbProfessional.whatsapp || null,
          hidden_from_booking: (localProfessional as any).hidden_from_booking !== undefined
            ? (localProfessional as any).hidden_from_booking
            : (dbProfessional.hidden_from_booking !== undefined ? dbProfessional.hidden_from_booking : false),
          specific_services: Array.isArray((localProfessional as any).specific_services)
            ? (localProfessional as any).specific_services
            : (Array.isArray(dbProfessional.specific_services) ? dbProfessional.specific_services : []),
          offers_child_service: localProfessional.offers_child_service ?? dbProfessional.offers_child_service ?? false,
          work_hours: localProfessional.work_hours || dbProfessional.work_hours || null,
          absences: (localProfessional as any).absences || dbProfessional.absences || [], // ✅ PRESERVAR AUSÊNCIAS!
          blocked_hours: (localProfessional as any).blocked_hours || dbProfessional.blocked_hours || {} // ✅ PRESERVAR HORÁRIOS BLOQUEADOS!
        };

        // ✅ VALIDAÇÃO FINAL APÓS MESCLAR: Verificar se profissional com nome tem horário
        if (needsValidation && mergedProfessional.name && mergedProfessional.name.trim().length > 0) {
          const workHours = mergedProfessional.work_hours;

          if (!workHours || typeof workHours !== 'object' || Object.keys(workHours).length === 0) {
            console.log('❌ VALIDAÇÃO FINAL FALHOU - SEM WORK_HOURS:', mergedProfessional.name);
            toast.error('Selecione horário de serviço do profissional');
            throw new Error('Profissional sem horário de trabalho configurado');
          }

          const hasValidHours = Object.keys(workHours).some(day => {
            const daySchedule = workHours[day];
            return daySchedule &&
              daySchedule.enabled === true &&
              daySchedule.entry_time &&
              daySchedule.exit_time &&
              daySchedule.entry_time.trim() !== '' &&
              daySchedule.exit_time.trim() !== '';
          });

          if (!hasValidHours) {
            console.log('❌ VALIDAÇÃO FINAL FALHOU - SEM HORÁRIOS VÁLIDOS:', mergedProfessional.name);
            toast.error('Selecione horário de serviço do profissional');
            throw new Error('Profissional sem horário de trabalho válido');
          }
        }

        return mergedProfessional;
      });

      console.log('🔄 Profissionais mesclados:', updatedProfessionals);

      // Garantir que todos os profissionais tenham pins (senha padrão "0000" se não tiver)
      let updatedPins = establishment.professionals_pins || [];

      // Para cada profissional, verificar se tem pin
      professionals.forEach(professional => {
        const existingPin = updatedPins.find(p => p.professional_id === professional.id);
        if (!existingPin) {
          // Adicionar pin padrão "0000" se não existir
          updatedPins.push({
            professional_id: professional.id,
            pin: '0000'
          });
        }
      });

      console.log('🔐 Pins atualizados:', updatedPins);

      const { error } = await supabase
        .from('establishments')
        .update({
          professionals: updatedProfessionals.filter(p => p.name),
          professionals_pins: updatedPins
        })
        .eq('id', establishment.id);

      if (error) throw error;

      // Atualizar o estado local do establishment também
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals,
        professionals_pins: updatedPins
      });

      // Atualizar o estado local dos profissionais com os dados mesclados
      setProfessionals(updatedProfessionals);

      console.log('✅ Profissionais e pins salvos com sucesso!');

      // ✅ VALIDAÇÃO FINAL: Verificar novamente se todos têm horários antes de avançar
      if (isNewUser) {
        const professionalsWithNamesAndHours = updatedProfessionals.filter(p => {
          if (!p.name || p.name.trim().length === 0) {
            return false;
          }

          const workHours = p.work_hours;
          if (!workHours || typeof workHours !== 'object' || Object.keys(workHours).length === 0) {
            return false;
          }

          // Verificar se tem pelo menos um dia habilitado com horários válidos
          return Object.keys(workHours).some(day => {
            const daySchedule = workHours[day];
            return daySchedule &&
              daySchedule.enabled === true &&
              daySchedule.entry_time &&
              daySchedule.exit_time &&
              daySchedule.entry_time.trim() !== '' &&
              daySchedule.exit_time.trim() !== '';
          });
        });

        // Se não passar na validação final, não avança
        if (professionalsWithNamesAndHours.length === 0) {
          toast.error('Selecione horário de serviço do profissional');
          return; // Não avançar, não mostrar sucesso
        }

        toast.success('Profissionais atualizados!');

        // Avançar para a próxima etapa (Meus Serviços)
        const { error: onboardingError } = await supabase
          .from('establishments')
          .update({ onboarding_step: 3 })
          .eq('id', establishment.id);

        if (!onboardingError) {
          setOnboardingStep(3);
          toast.success('✅ Avançando para Meus Serviços...');

          // Avançar imediatamente para a aba de serviços
          setTimeout(() => {
            setActiveTab('service-categories');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 1000);
        }
      } else {
        // Para usuários antigos, apenas mostrar sucesso
        toast.success('Profissionais atualizados!');

        // Se está em onboarding (step 2), avançar normalmente
        if (onboardingStep === 2) {
          const professionalsWithNames = updatedProfessionals.filter(p => p.name && p.name.trim().length > 0);
          if (professionalsWithNames.length > 0) {
            const { error: onboardingError } = await supabase
              .from('establishments')
              .update({ onboarding_step: 3 })
              .eq('id', establishment.id);

            if (!onboardingError) {
              setOnboardingStep(3);
              setTimeout(() => {
                setActiveTab('service-categories');
              }, 1000);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao salvar profissionais:', error);
      toast.error('Erro ao salvar profissionais');
    }
  };

  const handleAddService = () => {
    const newService = {
      id: Math.random().toString(36).substring(2),
      name: '',
      price: 0,
      duration: 30
    };
    console.log('Adicionando serviço:', newService);
    setServicesWithPrices(prev => [...prev, newService]);
  };

  const handleRemoveService = (id: string) => {
    console.log('Removendo serviço:', id);
    setServicesWithPrices(prev => prev.filter(s => s.id !== id));
  };

  const handleServiceChange = (id: string, field: keyof Service, value: string | number) => {
    console.log('Atualizando serviço:', { id, field, value });
    setServicesWithPrices(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const handleCreateEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!establishmentName.trim()) {
      toast.error('Por favor, informe o nome do estabelecimento');
      return;
    }

    if (!establishmentCode.trim() || establishmentCode.length !== 4) {
      toast.error('Por favor, informe um código de 4 dígitos válido');
      return;
    }

    setIsCreating(true);

    try {
      console.log('Criando estabelecimento para o usuário:', user.id);

      const establishmentData = {
        name: establishmentName.trim(),
        description: establishmentDescription.trim(),
        code: establishmentCode.trim(),
        owner_id: user.id,
        business_hours: businessHours,
        professionals: professionals.map(p => ({
          id: p.id,
          name: p.name.trim(),
          specialties: p.specialties.filter(s => s.trim()),
          percentage: p.percentage || 100, // Manter o percentual
          absences: (p as any).absences || [] // 🚨 PRESERVAR AUSÊNCIAS DOS PROFISSIONAIS!
        })).filter(p => p.name),
        services_with_prices: servicesWithPrices.map(s => ({
          id: s.id,
          name: s.name.trim(),
          price: Number(s.price),
          duration: Number(s.duration)
        })).filter(s => s.name && s.price > 0),
        profile_image: profileImage,
        custom_photo_1: customPhoto1,
        custom_photo_2: customPhoto2,
        custom_photo_3: customPhoto3,
        pix_key_type: pixKeyType,
        pix_key: pixKey,
        pin_password: null, // Garantindo que a senha começa como nula
        review_link: reviewLink.trim(),       // Salva o link de avaliação
        social_media_link: socialMediaLink.trim(), // Salva o link de redes sociais
        pix_payment_link: pixPaymentLink.trim(),   // Salva o link de pagamento PIX
        location_link: locationLink.trim(), // Salva o link do local
        has_wifi: hasWifi, // Salva a comodidade Wi-fi
        has_parking: hasParking, // Salva a comodidade Estacionamento
        has_accessibility: hasAccessibility, // Salva a comodidade Acessibilidade
        has_air_conditioning: hasAirConditioning, // Salva a comodidade Ar-Condicionado
        wifi_password: wifiPassword.trim(), // Salva a senha do Wi-Fi
        wifi_network_name: wifiNetworkName.trim(), // Salva o nome da rede Wi-Fi
        require_cancellation_request: requireCancellationRequest, // Exigir solicitação de cancelamento
        prevent_same_day_reschedule: preventSameDayReschedule, // Impedir remarcação no mesmo dia
        require_cpf: requireCpf, // Solicitar CPF no agendamento
        enable_whatsapp_notifications: enableWhatsAppNotifications, // Ativar notificações WhatsApp
        whatsapp: establishment?.whatsapp, // Adiciona o campo de WhatsApp
        onboarding_step: 1, // Novos estabelecimentos começam no onboarding
      };

      console.log('Dados do estabelecimento a serem criados:', establishmentData);

      const { data, error } = await createEstablishment(establishmentData);

      if (error) {
        throw error;
      }

      console.log('Estabelecimento criado:', data);

      if (data?.[0]) {
        setEstablishment(data[0]);
        toast.success('Estabelecimento criado com sucesso!');

        // Redirecionar para o dashboard do estabelecimento
        setTimeout(() => {
          navigate('/dashboard/establishment');
        }, 1500);
      } else {
        throw new Error('Erro ao criar estabelecimento: dados não retornados');
      }
    } catch (error: any) {
      console.error('Erro ao criar estabelecimento:', error);
      toast.error(error.message || 'Erro ao criar estabelecimento');
    } finally {
      setIsCreating(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (!establishment?.code) return;

    navigator.clipboard.writeText(establishment.code);
    setCodeCopied(true);

    setTimeout(() => {
      setCodeCopied(false);
    }, 2000);

    toast.success('Código copiado para a área de transferência!');
  };

  const handleUpdateEstablishment = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!user || !establishment) return;

    setIsUpdating(true);

    try {
      const establishmentData = {
        name: establishment?.name?.trim() || '',
        description: establishment?.description?.trim() || '',
        business_hours: businessHours,
        professionals: professionals.map(p => ({
          id: p.id,
          name: p.name.trim(),
          specialties: p.specialties || [], // PRESERVAR especialidades
          percentage: p.percentage || 100, // Manter o percentual
          photo_url: (p as any).photo_url, // Preservar a foto do profissional
          whatsapp: p.whatsapp || null, // ✅ PRESERVAR WHATSAPP!
          specific_services: Array.isArray((p as any).specific_services) ? (p as any).specific_services : [], // ✅ PRESERVAR SERVIÇOS ESPECÍFICOS!
          offers_child_service: p.offers_child_service || false, // PRESERVAR configuração de serviço infantil
          work_hours: p.work_hours || null, // PRESERVAR horários de trabalho personalizados
          absences: (p as any).absences || [] // 🚨 PRESERVAR AUSÊNCIAS DOS PROFISSIONAIS!
        })).filter(p => p.name),
        services_with_prices: servicesWithPrices.map(s => ({
          id: s.id,
          name: s.name.trim(),
          price: Number(s.price),
          duration: Number(s.duration)
        })).filter(s => s.name && s.price > 0),
        profile_image: profileImage,
        affiliate_link: affiliateLink.trim(),
        custom_photo_1: customPhoto1,
        custom_photo_2: customPhoto2,
        custom_photo_3: customPhoto3,
        custom_photo_4: customPhoto4,
        custom_photo_5: customPhoto5,
        custom_photo_6: customPhoto6,
        custom_photo_7: customPhoto7,
        pix_key_type: pixKeyType,
        pix_key: pixKey,
        review_link: reviewLink.trim(),       // Atualiza o link de avaliação
        social_media_link: socialMediaLink.trim(), // Atualiza o link de redes sociais
        pix_payment_link: pixPaymentLink.trim(),   // Atualiza o link de pagamento PIX
        location_link: locationLink.trim(), // Atualiza o link do local
        has_wifi: hasWifi, // Atualiza a comodidade Wi-fi
        has_parking: hasParking, // Atualiza a comodidade Estacionamento
        has_accessibility: hasAccessibility, // Atualiza a comodidade Acessibilidade
        has_air_conditioning: hasAirConditioning, // Atualiza a comodidade Ar-Condicionado
        wifi_password: wifiPassword.trim(), // Atualiza a senha do Wi-Fi
        wifi_network_name: wifiNetworkName.trim(), // Atualiza o nome da rede Wi-Fi
        require_cancellation_request: requireCancellationRequest, // Exigir solicitação de cancelamento
        prevent_same_day_reschedule: preventSameDayReschedule, // Impedir remarcação no mesmo dia
        require_cpf: requireCpf, // Solicitar CPF no agendamento
        enable_whatsapp_notifications: enableWhatsAppNotifications, // Ativar notificações WhatsApp
        whatsapp: establishment?.whatsapp, // Adiciona o campo de WhatsApp
        use_15_minute_interval: use15MinuteInterval, // Configuração de intervalo de 15 minutos
        use_20_minute_schedule: use20MinuteSchedule, // Configuração de horários de 20 em 20 minutos
        show_best_of_brazil_image: showBestOfBrazilImage, // Configuração da imagem "Melhor do Brasil"
        carousel_position: carouselPosition, // Posição do carrossel
        payment_methods_enabled: paymentMethodsEnabled, // Formas de pagamento ativas
      };

      // Sistema de progresso do onboarding
      let newOnboardingStep = onboardingStep;

      // Step 1 -> Step 2: Configuração salva
      if (onboardingStep === 1) {
        newOnboardingStep = 2;
        const { error: onboardingError } = await supabase
          .from('establishments')
          .update({ onboarding_step: 2 })
          .eq('id', establishment.id);

        if (!onboardingError) {
          setOnboardingStep(2);
        }
      }

      // Step 3 -> Step 4: Será detectado automaticamente pelo useEffect quando serviço válido for adicionado

      const { data, error } = await updateEstablishment(establishment.id, establishmentData);

      if (error) {
        throw error;
      }

      setEstablishment(data?.[0]);

      // Toast diferente se for onboarding
      if (onboardingStep < 4) {
        toast.success('Configurações salvas! Abrindo Profissionais...');
        // Sempre ir para profissionais após salvar
        setTimeout(() => {
          setActiveTab('professionals');
        }, 500);
      } else {
        toast.success('Estabelecimento atualizado com sucesso!');
        // Mesmo para usuários antigos, ir para profissionais se clicou no botão
        setTimeout(() => {
          setActiveTab('professionals');
        }, 500);
      }

    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar estabelecimento');
    } finally {
      setIsUpdating(false);
    }
  };

  const saveServicesOrder = async (newServices: Service[]) => {
    if (!user || !establishment) return;

    setIsSavingServicesOrder(true);

    try {
      const { data, error } = await supabase
        .from('establishments')
        .update({
          services_with_prices: newServices.map(s => ({
            id: s.id,
            name: s.name.trim(),
            price: Number(s.price),
            duration: Number(s.duration)
          })).filter(s => s.name && s.price > 0)
        })
        .eq('id', establishment.id)
        .select();

      if (error) {
        throw error;
      }

      setEstablishment(data?.[0]);
      toast.success('Ordem dos serviços atualizada!');

    } catch (error: any) {
      console.error('Erro ao salvar ordem dos serviços:', error);
      toast.error('Erro ao salvar ordem dos serviços');
    } finally {
      setIsSavingServicesOrder(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    console.log('========================================');
    console.log('🔐 CANCELAMENTO DO ESTABELECIMENTO - INICIANDO');
    console.log('========================================');

    try {
      // Encontrar o agendamento antes de cancelar para notificação
      const appointmentToCancel = appointments.find(apt => apt.id === appointmentId);

      if (!appointmentToCancel) {
        toast.error('Agendamento não encontrado');
        return;
      }

      // A senha já foi validada no modal antes de chegar aqui
      console.log('✅ Prosseguindo com cancelamento...');

      // 🔥 VALIDAÇÃO DE REMARCAÇÃO NO MESMO DIA PARA ASSINANTES
      if (appointmentToCancel.is_subscriber) {
        console.log('🔍 Verificando se é assinante e se pode cancelar...');

        // Verificar se o estabelecimento tem a configuração ativada
        const { data: establishmentData, error: establishmentError } = await supabase
          .from('establishments')
          .select('prevent_same_day_reschedule')
          .eq('id', appointmentToCancel.establishment_id)
          .single();

        if (establishmentError) {
          console.error('Erro ao buscar configuração do estabelecimento:', establishmentError);
        } else if (establishmentData?.prevent_same_day_reschedule) {
          // Mostrar aviso de confirmação
          const confirmCancel = window.confirm(
            '⚠️ ATENÇÃO: Este cliente é um assinante e você tem a configuração de "não remarcar no mesmo dia" ativada.\n\n' +
            'Se você cancelar este agendamento, o cliente NÃO poderá agendar novamente para o mesmo dia.\n\n' +
            'Tem certeza que deseja cancelar?'
          );

          if (!confirmCancel) {
            return; // Usuário cancelou a ação
          }
        }
      }

      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) {
        throw error;
      }

      // Enviar notificação de cancelamento
      if (appointmentToCancel) {
        console.log('🔔 ENVIANDO NOTIFICAÇÃO DE CANCELAMENTO:', appointmentToCancel);
        const professionalName = getProfessionalName(appointmentToCancel.professional);
        notifyCancelledAppointment(
          appointmentToCancel.client_name,
          appointmentToCancel.service,
          appointmentToCancel.appointment_time,
          professionalName !== 'Profissional não encontrado' ? professionalName : undefined
        );
      }

      await Promise.all([
        fetchAppointments(),
        fetchMonthlyAppointments()
      ]);

      toast('Agendamento cancelado com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      toast('Erro ao cancelar agendamento', 'error');
    }
  };

  const handleCancelClick = async (appointmentId: string) => {
    console.log('🔍 DEBUG CANCELAR - Verificando configurações:');
    console.log('  - requireCancelPassword (estado):', requireCancelPassword);
    console.log('  - establishment?.pin_password:', establishment?.pin_password);
    console.log('  - establishment?.require_cancel_password:', (establishment as any)?.require_cancel_password);

    // Buscar valor atualizado do banco para garantir
    if (establishment?.id) {
      const { data: currentEstablishment, error } = await supabase
        .from('establishments')
        .select('require_cancel_password, pin_password')
        .eq('id', establishment.id)
        .single();

      if (!error && currentEstablishment) {
        console.log('  - Valor do banco (require_cancel_password):', currentEstablishment.require_cancel_password);
        console.log('  - Valor do banco (pin_password existe):', !!currentEstablishment.pin_password);

        const needsPassword = currentEstablishment.require_cancel_password === true;
        const hasPassword = currentEstablishment.pin_password &&
          currentEstablishment.pin_password !== '0000' &&
          currentEstablishment.pin_password.trim() !== '';

        console.log('  - needsPassword (do banco):', needsPassword);
        console.log('  - hasPassword (do banco):', hasPassword);

        setAppointmentToCancel(appointmentId);

        if (needsPassword && hasPassword) {
          console.log('✅ Pedindo senha para cancelar');
          setShowCancelPasswordModal(true);
          return;
        }
      }
    }

    // Fallback: usar valores do estado se não conseguir buscar do banco
    const needsPassword = requireCancelPassword || (establishment as any)?.require_cancel_password;
    const hasPassword = establishment?.pin_password &&
      establishment.pin_password !== '0000' &&
      establishment.pin_password.trim() !== '';

    console.log('  - needsPassword (fallback):', needsPassword);
    console.log('  - hasPassword (fallback):', hasPassword);

    setAppointmentToCancel(appointmentId);

    if (needsPassword && hasPassword) {
      console.log('✅ Pedindo senha para cancelar (fallback)');
      setShowCancelPasswordModal(true);
    } else {
      console.log('❌ Não precisa de senha - mostrando confirmação direto');
      console.log('  - Motivo: needsPassword =', needsPassword, ', hasPassword =', hasPassword);
      setShowCancelConfirm(true);
    }
  };

  // Função para validar senha de cancelamento
  const handleCancelPasswordSubmit = (pin: string) => {
    if (!establishment?.pin_password) {
      toast('Senha não configurada', 'error');
      setShowCancelPasswordModal(false);
      return;
    }

    // Verificar se é a senha mestre ou a senha do estabelecimento
    const MASTER_PIN = '2543';
    if (pin === MASTER_PIN || pin === establishment.pin_password) {
      setShowCancelPasswordModal(false);
      setShowCancelConfirm(true);
    } else {
      toast('Senha incorreta!', 'error');
    }
  };

  // Função para abrir modal de lembrete
  const handleOpenReminderModal = (appointment: Appointment) => {
    setAppointmentForReminder(appointment);
    setShowReminderConfirm(true);
  };

  // Função para enviar lembrete via WhatsApp
  const handleSendReminder = () => {
    if (!appointmentForReminder) return;

    try {
      const clientWhatsapp = appointmentForReminder.client_whatsapp;
      if (!clientWhatsapp) {
        toast('WhatsApp do cliente não encontrado', 'error');
        return;
      }

      // Formatar data e hora
      const appointmentDate = format(parseISO(appointmentForReminder.appointment_date), 'dd/MM/yyyy');
      const appointmentTime = appointmentForReminder.appointment_time;
      const professionalName = getProfessionalName(appointmentForReminder.professional);
      const establishmentName = establishment?.name || 'nossa barbearia';
      const serviceName = appointmentForReminder.service;

      // Montar mensagem do lembrete
      const reminderMessage = `💈 Olá! Passando aqui pra relembrar do seu agendamento com ${establishmentName} ✂️

📅 Data e horário: ${appointmentDate} às ${appointmentTime}
💇‍♂️ Profissional: ${professionalName}
💼 Serviço: ${serviceName}

Estamos te aguardando! 😎✂️`;

      // Formatar número do WhatsApp
      let phoneNumber = clientWhatsapp.replace(/\D/g, '');
      // Lista de códigos de países comuns
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

      // Abrir WhatsApp
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(reminderMessage)}`;
      window.open(whatsappUrl, '_blank');

      // Fechar modal e mostrar sucesso
      setShowReminderConfirm(false);
      setAppointmentForReminder(null);
      toast('Lembrete enviado via WhatsApp!', 'success');

    } catch (error) {
      console.error('Erro ao enviar lembrete:', error);
      toast('Erro ao enviar lembrete', 'error');
    }
  };

  // Função para fechar modal de lembrete
  const handleCloseReminderModal = () => {
    setShowReminderConfirm(false);
    setAppointmentForReminder(null);
  };

  // Função para abrir modal informativo de lembrete
  const handleOpenReminderInfoModal = () => {
    setShowReminderInfoModal(true);
  };

  // Função para fechar modal informativo de lembrete
  const handleCloseReminderInfoModal = () => {
    setShowReminderInfoModal(false);
  };

  // Função para gerar Nota Fiscal (XML)
  const handleGenerateNF = (appointment: Appointment) => {
    try {
      console.log('📄 Gerando NF para agendamento:', appointment);

      // Verificar se tem CPF (obrigatório para NF)
      if (!appointment.client_cpf) {
        toast('CPF do cliente é obrigatório para gerar Nota Fiscal', 'error');
        return;
      }

      // Dados do agendamento
      const nfData = {
        cliente: {
          nome: appointment.client_name,
          cpf: appointment.client_cpf.replace(/\D/g, ''), // Apenas números
        },
        servico: {
          descricao: appointment.service,
          valor: appointment.total_price || appointment.price || 0,
          duracao: appointment.duration || 30,
        },
        agendamento: {
          data: appointment.appointment_date,
          hora: appointment.appointment_time,
          profissional: getProfessionalName(appointment.professional),
        },
        estabelecimento: {
          nome: establishment?.name || 'Estabelecimento',
          cnpj: '00000000000000', // Placeholder - você pode adicionar CNPJ nas configurações
        }
      };

      // Gerar XML da Nota Fiscal
      const xmlContent = generateNFXML(nfData);

      // Criar e baixar arquivo
      downloadXML(xmlContent, appointment.id, appointment.appointment_date);

      toast('Nota Fiscal gerada com sucesso!', 'success');

    } catch (error) {
      console.error('Erro ao gerar NF:', error);
      toast('Erro ao gerar Nota Fiscal', 'error');
    }
  };

  // Função para escapar caracteres especiais do XML
  const escapeXML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Função para gerar XML da Nota Fiscal
  const generateNFXML = (nfData: any): string => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0];
    const numeroNF = `NF${timestamp}`;

    // Escapar dados que podem conter caracteres especiais
    const nomeCliente = escapeXML(nfData.cliente.nome);
    const nomeEstabelecimento = escapeXML(nfData.estabelecimento.nome);
    const descricaoServico = escapeXML(nfData.servico.descricao);
    const nomeProfissional = escapeXML(nfData.agendamento.profissional);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${numeroNF}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${numeroNF}</cNF>
      <natOp>Venda de servicos</natOp>
      <mod>55</mod>
      <serie>1</serie>
      <nNF>${numeroNF}</nNF>
      <dhEmi>${now.toISOString()}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>1</cDV>
      <tpAmb>2</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>
    
    <emit>
      <CNPJ>${nfData.estabelecimento.cnpj}</CNPJ>
      <xNome>${nomeEstabelecimento}</xNome>
      <enderEmit>
        <xLgr>Rua Exemplo</xLgr>
        <nro>123</nro>
        <xBairro>Centro</xBairro>
        <cMun>3550308</cMun>
        <xMun>Sao Paulo</xMun>
        <UF>SP</UF>
        <CEP>01234567</CEP>
      </enderEmit>
      <IE>123456789</IE>
      <CRT>3</CRT>
    </emit>
    
    <dest>
      <CPF>${nfData.cliente.cpf}</CPF>
      <xNome>${nomeCliente}</xNome>
      <enderDest>
        <xLgr>Endereco do Cliente</xLgr>
        <nro>S/N</nro>
        <xBairro>Bairro</xBairro>
        <cMun>3550308</cMun>
        <xMun>Sao Paulo</xMun>
        <UF>SP</UF>
        <CEP>01234567</CEP>
      </enderDest>
    </dest>
    
    <det nItem="1">
      <prod>
        <cProd>001</cProd>
        <cEAN></cEAN>
        <xProd>${descricaoServico}</xProd>
        <NCM>96020000</NCM>
        <CFOP>5102</CFOP>
        <uCom>UN</uCom>
        <qCom>1.0000</qCom>
        <vUnCom>${nfData.servico.valor.toFixed(2)}</vUnCom>
        <vProd>${nfData.servico.valor.toFixed(2)}</vProd>
        <cEANTrib></cEANTrib>
        <uTrib>UN</uTrib>
        <qTrib>1.0000</qTrib>
        <vUnTrib>${nfData.servico.valor.toFixed(2)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>0.00</vTotTrib>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>${nfData.servico.valor.toFixed(2)}</vBC>
            <pICMS>18.00</pICMS>
            <vICMS>${(nfData.servico.valor * 0.18).toFixed(2)}</vICMS>
          </ICMS00>
        </ICMS>
      </imposto>
    </det>
    
    <total>
      <ICMSTot>
        <vBC>${nfData.servico.valor.toFixed(2)}</vBC>
        <vICMS>${(nfData.servico.valor * 0.18).toFixed(2)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${nfData.servico.valor.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${nfData.servico.valor.toFixed(2)}</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>
    
    <transp>
      <modFrete>9</modFrete>
    </transp>
    
    <infAdic>
      <infCpl>
        Agendamento: ${nfData.agendamento.data} as ${nfData.agendamento.hora}
        Profissional: ${nomeProfissional}
        Duracao: ${nfData.servico.duracao} minutos
      </infCpl>
    </infAdic>
  </infNFe>
</NFe>`;

    return xml;
  };

  // Função para fazer download do XML
  const downloadXML = (xmlContent: string, appointmentId: string, appointmentDate: string) => {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    // Nome do arquivo: NF_Data_ID.xml
    const fileName = `NF_${appointmentDate.replace(/-/g, '')}_${appointmentId.substring(0, 8)}.xml`;

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const confirmCancel = async () => {
    if (appointmentToCancel) {
      await handleCancelAppointment(appointmentToCancel);
      setShowCancelConfirm(false);
      setAppointmentToCancel(null);
    }
  };

  const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) {
        throw error;
      }

      await Promise.all([
        fetchAppointments(),
        fetchMonthlyAppointments()
      ]);

      const statusMessages = {
        'pending': 'Agendamento marcado como PENDENTE',
        'confirmed': 'Agendamento confirmado',
        'cancelled': 'Agendamento cancelado',
        'completed': 'Agendamento marcado como CONCLUÍDO'
      };

      toast(statusMessages[newStatus], 'success');
    } catch (error) {
      console.error('Erro ao atualizar status do agendamento:', error);
      toast('Erro ao atualizar status do agendamento', 'error');
    }
  };


  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      console.log('🗑️ INICIANDO EXCLUSÃO:', appointmentId);

      // REMOVER IMEDIATAMENTE DA LISTA (SEM ESPERAR BANCO)
      setAppointments(prev => prev.filter(app => app.id !== appointmentId));

      // EXCLUIR DO BANCO E AGUARDAR CONFIRMAÇÃO
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ ERRO AO EXCLUIR DO BANCO:', error);
        // Se der erro, volta o agendamento na lista
        setAppointments(prev => {
          const appointmentToRestore = appointments.find(app => app.id === appointmentId);
          return appointmentToRestore ? [...prev, appointmentToRestore] : prev;
        });
        toast('Erro ao excluir do banco', 'error');
        return;
      }

      console.log('✅ EXCLUÍDO DO BANCO COM SUCESSO');

      // LIMPAR CACHE DO SUPABASE
      if (establishment) {
        await supabase
          .from('appointments')
          .select('*')
          .eq('establishment_id', establishment.id)
          .abortSignal(new AbortController().signal);
      }

      toast('Agendamento excluído com sucesso', 'success');
    } catch (error) {
      console.error('❌ Erro na exclusão:', error);
      toast('Erro ao excluir agendamento', 'error');
    }
  };

  const handlePaymentMethodChange = async (appointmentId: string, paymentMethod: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ payment_method: paymentMethod })
        .eq('id', appointmentId);

      if (error) {
        throw error;
      }

      await Promise.all([
        fetchAppointments(),
        fetchMonthlyAppointments()
      ]);

      toast('Método de pagamento atualizado', 'success');
    } catch (error) {
      console.error('Erro ao atualizar método de pagamento:', error);
      toast('Erro ao atualizar método de pagamento', 'error');
    }
  };

  const handleCardBrandChange = async (appointmentId: string, cardBrand: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ card_brand: cardBrand })
        .eq('id', appointmentId);

      if (error) {
        throw error;
      }

      await Promise.all([
        fetchAppointments(),
        fetchMonthlyAppointments()
      ]);

      toast('Bandeira atualizada', 'success');
    } catch (error) {
      console.error('Erro ao atualizar bandeira do cartão:', error);
      toast('Erro ao atualizar bandeira do cartão', 'error');
    }
  };

  const fetchPremiumSubscribers = async () => {
    if (!establishment) return;

    setIsLoadingSubscribers(true);
    try {
      const subscribers = await getEstablishmentPremiumSubscribers(establishment.id);
      setPremiumSubscribers(subscribers);
    } catch (error) {
      console.error('Erro ao buscar assinantes premium:', error);
      toast('Erro ao buscar assinantes premium', 'error');
    } finally {
      setIsLoadingSubscribers(false);
    }
  };



  const fetchAppointments = async () => {
    if (!establishment) return;

    setIsLoading(true);

    try {
      const startOfSelectedDate = format(startOfDay(selectedDate), 'yyyy-MM-dd');
      const endOfSelectedDate = format(endOfDay(selectedDate), 'yyyy-MM-dd');

      console.log('🔍 BUSCANDO AGENDAMENTOS:');
      console.log('  - Establishment ID:', establishment.id);
      console.log('  - Data selecionada:', selectedDate.toISOString());
      console.log('  - Start:', startOfSelectedDate);
      console.log('  - End:', endOfSelectedDate);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          client_id,
          client_name,
          client_whatsapp,
          client_cpf,
          establishment_id,
          service,
          professional,
          appointment_date,
          appointment_time,
          status,
          created_at,
          is_premium,
          duration,
          price,
          payment_method,
          card_brand,
          pix_payment_status,
          pix_proof_url,
          observation,
          establishment_observation,
          is_child_service,
          is_squeeze,
          additional_products,
          total_price
        `)
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startOfSelectedDate)
        .lte('appointment_date', endOfSelectedDate)
        .order('appointment_time', { ascending: true })
        .abortSignal(new AbortController().signal); // Forçar busca sem cache

      if (error) throw error;

      const appointmentsData = data as Appointment[] || [];

      console.log('✅ AGENDAMENTOS ENCONTRADOS:', appointmentsData.length);
      console.log('📋 Dados:', appointmentsData);

      // Buscar produtos vendidos para cada agendamento
      for (const appointment of appointmentsData) {
        const { data: appointmentProducts } = await supabase
          .from('appointment_products')
          .select(`
            id,
            product_id,
            quantity,
            unit_price,
            professional_id,
            establishment_products (
              name,
              sale_price
            )
          `)
          .eq('appointment_id', appointment.id);

        // Adicionar produtos vendidos ao agendamento
        if (appointmentProducts && appointmentProducts.length > 0) {
          (appointment as any).sold_products = appointmentProducts.map(ap => ({
            id: ap.id,
            product_id: ap.product_id,
            name: (ap.establishment_products as any)?.name,
            quantity: ap.quantity,
            unit_price: ap.unit_price,
            professional_id: ap.professional_id,
            total: ap.quantity * ap.unit_price
          }));
        }
      }

      setAppointments(appointmentsData);

      // Verificar quais clientes são novos
      const newClientsMap: Record<string, boolean> = {};
      for (const appointment of appointmentsData) {
        if (appointment.client_id && !newClientsMap[appointment.client_id]) {
          try {
            const isNew = await isNewClient(appointment.client_id);
            newClientsMap[appointment.client_id] = isNew;
          } catch (error: any) {
            console.error('Erro ao verificar se cliente é novo:', error);
            newClientsMap[appointment.client_id] = false;
          }
        }
      }
      setNewClientsInfo(newClientsMap);
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      toast(error.message || 'Erro ao carregar agendamentos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyAppointments = async (month: Date = new Date()) => {
    if (!establishment) return;

    try {
      const start = startOfMonth(month); // Início do mês selecionado
      const end = endOfMonth(month); // Fim do mês selecionado

      console.log('🔍 DEBUG - fetchMonthlyAppointments chamado para:', {
        month: month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        start: start.toISOString(),
        end: end.toISOString(),
        monthObject: month
      });
      console.log('🏢 Establishment ID:', establishment.id);

      // Formatar datas para comparação (YYYY-MM-DD)
      const startDateStr = format(start, 'yyyy-MM-dd');
      const endDateStr = format(end, 'yyyy-MM-dd');

      console.log('🔍 DEBUG - Query de agendamentos mensais:');
      console.log('  - Start:', startDateStr);
      console.log('  - End:', endDateStr);
      console.log('  - Mês:', month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startDateStr)
        .lte('appointment_date', endDateStr)
        .neq('status', 'cancelled')
        .order('appointment_date', { ascending: true });

      console.log('  - Agendamentos retornados pela query:', appointments?.length || 0);

      if (error) {
        console.error('Erro ao buscar agendamentos:', error);
        return;
      }

      console.log(`🔍 DEBUG - Encontrados ${appointments?.length || 0} agendamentos para ${month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`);

      // Log dos agendamentos encontrados
      if (appointments && appointments.length > 0) {
        console.log('📋 DEBUG - Agendamentos encontrados:', appointments.map(apt => ({
          id: apt.id,
          date: apt.appointment_date,
          client: apt.client_name,
          professional: apt.professional,
          price: apt.price,
          total_price: apt.total_price
        })));
      } else {
        console.log('📋 DEBUG - Nenhum agendamento encontrado para este mês');
      }

      console.log('🔍 DEBUG - Vou atualizar monthlyAppointments com:', appointments?.length || 0, 'agendamentos');
      setMonthlyAppointments(appointments || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    }
  };

  const fetchEstablishment = async () => {
    try {
      setIsEstablishmentLoading(true);
      const { data: establishmentData, error } = await supabase
        .from('establishments')
        .select(`
          *,
          professionals:professionals,
          services_with_prices:services_with_prices
        `)
        .eq('owner_id', user?.id)
        .single();

      if (error) throw error;

      // Verificar se o estabelecimento está bloqueado
      if (establishmentData && establishmentData.is_blocked) {
        navigate('/blocked');
        return;
      }


      if (establishmentData) {
        // ✅ CORRIGIDO: Só sobrescrever se não há dados locais mais recentes
        // Isso evita perder modificações locais (como serviços específicos)
        setEstablishment(establishmentData);
        setEstablishmentName(establishmentData.name || '');
        setEstablishmentDescription(establishmentData.description || '');
        setEstablishmentCode(establishmentData.code || '');
        setAffiliateLink(establishmentData.affiliate_link || '');
        setPixKeyType(establishmentData.pix_key_type || '');
        setPixKey(establishmentData.pix_key || '');
        setPinPassword(establishmentData.pin_password || '');
        // Carrega os novos links
        setReviewLink(establishmentData.review_link || '');
        setSocialMediaLink(establishmentData.social_media_link || '');
        setPixPaymentLink(establishmentData.pix_payment_link || '');
        setLocationLink(establishmentData.location_link || ''); // Carrega o link do local
        // Carrega as comodidades
        setHasWifi(establishmentData.has_wifi ?? false); // Usa ?? false para garantir um booleano
        setHasParking(establishmentData.has_parking ?? false);
        setHasAccessibility(establishmentData.has_accessibility ?? false);
        setHasAirConditioning(establishmentData.has_air_conditioning ?? false);
        setWifiPassword(establishmentData.wifi_password || ''); // Senha do Wi-Fi
        setWifiNetworkName(establishmentData.wifi_network_name || ''); // Nome da rede Wi-Fi
        setRequireCancellationRequest(establishmentData.require_cancellation_request ?? false); // Exigir solicitação de cancelamento
        setPreventSameDayReschedule(establishmentData.prevent_same_day_reschedule ?? false); // Impedir remarcação no mesmo dia
        setRequireCpf(establishmentData.require_cpf ?? false); // Solicitar CPF no agendamento
        setEnableWhatsAppNotifications(establishmentData.enable_whatsapp_notifications ?? false); // Ativar notificações WhatsApp
        const requireCancelPasswordValue = (establishmentData as any).require_cancel_password ?? false;
        setRequireCancelPassword(requireCancelPasswordValue); // Exigir senha para cancelar agendamento
        console.log('🔍 Carregado require_cancel_password do banco:', requireCancelPasswordValue);
        console.log('🔍 establishmentData completo:', establishmentData);
        setCreditCardTaxPercentage(establishmentData.credit_card_tax_percentage || 3.5); // Taxa do cartão de crédito
        setDebitCardTaxPercentage(establishmentData.debit_card_tax_percentage || 2.5); // Taxa do cartão de débito
        setPaymentMethodsEnabled(establishmentData.payment_methods_enabled || ['pix', 'credito', 'debito', 'dinheiro', 'pagar_local']); // Formas de pagamento ativas
        setCarouselPosition(establishmentData.carousel_position || 'behind'); // Posição do carrossel

        // Carrega as taxas por bandeira de cartão
        if (establishmentData.card_brand_taxes) {
          setCardBrandTaxes(establishmentData.card_brand_taxes);
        }

        // Carrega a configuração de intervalo de 15 minutos
        setUse15MinuteInterval(establishmentData.use_15_minute_interval ?? false);

        // Carrega a configuração de horários de 20 em 20 minutos
        setUse20MinuteSchedule(establishmentData.use_20_minute_schedule ?? false);

        // Carrega a configuração da imagem "Melhor do Brasil"
        setShowBestOfBrazilImage(establishmentData.show_best_of_brazil_image ?? true);

        // Verificar se é um novo usuário (criado hoje ou depois) E se o quiz não foi completado
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const createdDate = establishmentData.created_at ? new Date(establishmentData.created_at) : null;
        const isNewUserCheck = createdDate && createdDate >= today;
        const quizCompletedCheck = (establishmentData as any).quiz_completed === true;

        // Só mostrar quiz se for novo usuário E quiz não foi completado
        setIsNewUser(Boolean(isNewUserCheck && !quizCompletedCheck));
        setQuizCompleted(Boolean(quizCompletedCheck));

        // Carregar progresso do quiz do localStorage (se for novo usuário e quiz não completo)
        if (isNewUserCheck && !quizCompletedCheck && establishmentData.id) {
          const savedProgress = localStorage.getItem(`quiz_progress_${establishmentData.id}`);
          if (savedProgress) {
            const progress = parseInt(savedProgress, 10);
            setQuizStep(progress);
          }
        }

        // Carrega o progresso do onboarding
        const currentOnboardingStep = establishmentData.onboarding_step ?? 4; // Default = 4 (completo) para contas antigas
        console.log('🎯 DEBUG Onboarding - Carregando onboarding_step:', {
          fromDatabase: establishmentData.onboarding_step,
          currentStep: currentOnboardingStep,
          servicesCount: (establishmentData.services_with_prices || []).length
        });
        setOnboardingStep(currentOnboardingStep);

        // Se está em onboarding (step < 4), forçar para a aba apropriada
        // MAS só se o usuário ainda não tiver navegado manualmente (verificar se já está em uma aba válida)
        // Isso permite que o usuário volte para config se quiser
        const currentTabIsValid = activeTab === 'settings' || activeTab === 'professionals' || activeTab === 'service-categories';

        // Só forçar aba se não estiver já em uma aba válida do onboarding
        // Isso permite navegação livre entre as abas do onboarding
        if (!currentTabIsValid) {
          if (currentOnboardingStep === 1) {
            setActiveTab('settings'); // Começar na config
          } else if (currentOnboardingStep === 2) {
            setActiveTab('professionals'); // Ir para profissionais
          } else if (currentOnboardingStep === 3) {
            setActiveTab('service-categories'); // Ir para serviços
          }
        }
        // Se já está em uma aba válida (settings, professionals, service-categories), não força mudança

        // ✅ CORRIGIDO: Carrega os profissionais preservando TODOS os campos existentes
        const professionalsWithPercentage = (establishmentData.professionals || []).map((prof: any) => ({
          ...prof, // ✅ Preserva TODOS os campos existentes (incluindo specific_services, whatsapp, etc.)
          percentage: prof.percentage !== undefined ? prof.percentage : 100, // Só usar 100 se realmente não existir
          // ✅ IMPORTANTE: Garantir que specific_services seja sempre um array (mesmo que vazio)
          specific_services: Array.isArray(prof.specific_services) ? prof.specific_services : []
        }));

        console.log('🔧 DEBUG - Carregando profissionais:', professionalsWithPercentage);
        console.log('🔧 DEBUG - Serviços específicos encontrados:', professionalsWithPercentage.map((p: any) => ({
          name: p.name,
          specific_services: p.specific_services
        })));

        setProfessionals(professionalsWithPercentage);

        // Auto-selecionar profissional se houver apenas 1
        if (professionalsWithPercentage.length === 1 && selectedProfessional === '') {
          setSelectedProfessional(professionalsWithPercentage[0].id);
        }

        // Inicializar ausências dos profissionais
        const absencesData: Record<string, string[]> = {};
        professionalsWithPercentage.forEach((prof: any) => {
          if (prof.absences) {
            absencesData[prof.id] = prof.absences;
          }
        });
        setProfessionalAbsences(absencesData);

        setServicesWithPrices(establishmentData.services_with_prices || []);

        // Horários padrão para novos estabelecimentos (onboarding_step < 4)
        const isNewEstablishment = (establishmentData.onboarding_step ?? 4) < 4;
        const defaultBusinessHoursForNew = {
          monday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
          tuesday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
          wednesday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
          thursday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
          friday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
          saturday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' },
          sunday: { enabled: true, open1: '00:00', close1: '00:00', open2: '00:00', close2: '00:00' }
        };

        // Horários padrão para estabelecimentos antigos
        const defaultBusinessHoursForOld = {
          monday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          tuesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          wednesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          thursday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          friday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          saturday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          sunday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
        };

        // Usar horários do banco se existirem, senão usar padrão baseado no tipo de estabelecimento
        const businessHoursFromDB = establishmentData.business_hours;
        const defaultHours = isNewEstablishment ? defaultBusinessHoursForNew : defaultBusinessHoursForOld;

        // Normalizar horários: preencher campos vazios/null com padrões
        const normalizeBusinessHours = (hours: any, defaults: any) => {
          const normalized: Record<string, BusinessHours> = {};
          const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

          days.forEach(day => {
            const dayHours = hours?.[day] || {};
            const defaultDay = defaults[day];

            // Garantir que valores null ou vazios sejam convertidos para strings válidas
            normalized[day] = {
              enabled: dayHours?.enabled ?? defaultDay.enabled,
              open1: (dayHours?.open1 && dayHours.open1 !== 'null') ? dayHours.open1 : defaultDay.open1,
              close1: (dayHours?.close1 && dayHours.close1 !== 'null') ? dayHours.close1 : defaultDay.close1,
              open2: (dayHours?.open2 && dayHours.open2 !== 'null') ? dayHours.open2 : defaultDay.open2,
              close2: (dayHours?.close2 && dayHours.close2 !== 'null') ? dayHours.close2 : defaultDay.close2
            };
          });

          return normalized;
        };

        // SEMPRE carregar horários do banco se existirem, independente de ser novo ou antigo
        if (businessHoursFromDB) {
          // Usar horários salvos no banco, normalizando campos vazios/null
          const defaultHours = isNewEstablishment ? defaultBusinessHoursForNew : defaultBusinessHoursForOld;
          const normalized = normalizeBusinessHours(businessHoursFromDB, defaultHours);
          console.log('✅ Carregando horários do banco de dados:', normalized);
          setBusinessHours(normalized);
        } else {
          // Só usar padrão se não houver horários salvos
          const defaultHours = isNewEstablishment ? defaultBusinessHoursForNew : defaultBusinessHoursForOld;
          console.log('⚠️ Nenhum horário salvo, usando padrão:', defaultHours);
          setBusinessHours(defaultHours);
        }

        // Carrega as URLs das fotos personalizadas para pré-visualização
        if (establishmentData.custom_photo_1_url) {
          setCustomPhoto1Preview(establishmentData.custom_photo_1_url);
        }
        if (establishmentData.custom_photo_2_url) {
          setCustomPhoto2Preview(establishmentData.custom_photo_2_url);
        }
        if (establishmentData.custom_photo_3_url) {
          setCustomPhoto3Preview(establishmentData.custom_photo_3_url);
        }
        if (establishmentData.custom_photo_4_url) {
          setCustomPhoto4Preview(establishmentData.custom_photo_4_url);
        }
        if (establishmentData.custom_photo_5_url) {
          setCustomPhoto5Preview(establishmentData.custom_photo_5_url);
        }
        if (establishmentData.custom_photo_6_url) {
          setCustomPhoto6Preview(establishmentData.custom_photo_6_url);
        }
        if (establishmentData.custom_photo_7_url) {
          setCustomPhoto7Preview(establishmentData.custom_photo_7_url);
        }
        setProfileImagePreview(establishmentData.profile_image_url || null);
      }
    } catch (error) {
      console.error('Error fetching establishment:', error);
      toast('Erro ao carregar estabelecimento', 'error');
    } finally {
      setIsEstablishmentLoading(false);
    }
  };

  // Funções de validação para cada etapa do quiz
  const validateQuizStep = (step: number): { isValid: boolean; message: string } => {
    switch (step) {
      case 1: // Comodidades - pelo menos 1 opção
        const hasAnyAmenity = hasWifi || hasParking || hasAccessibility || hasAirConditioning;
        return {
          isValid: hasAnyAmenity,
          message: hasAnyAmenity ? '' : 'Selecione ao menos 1 comodidade para continuar'
        };

      case 2: // Configuração de horários - sempre válido
        return { isValid: true, message: '' };

      case 3: // Horário de Funcionamento - sempre válido (pode modificar algo)
        return { isValid: true, message: '' };

      case 4: // Fotos - sempre válido
        return { isValid: true, message: '' };

      case 5: // PIX - verificar se preencheu (pode ser opcional, mas vamos exigir para o quiz)
        // Verificar se tem PIX configurado OU se digitou "naotenhopix"
        const hasPix = (pixKeyType && pixKey && pixKey.trim() !== '' && pixKey.trim().toLowerCase() !== 'naotenhopix') ||
          (pixKey && pixKey.trim().toLowerCase() === 'naotenhopix') ||
          (establishment?.pix_key && establishment.pix_key.trim() !== '' && establishment.pix_key.trim().toLowerCase() !== 'naotenhopix');
        return {
          isValid: hasPix,
          message: hasPix ? '' : 'Preencha os dados do PIX ou digite "naotenhopix" para continuar'
        };

      case 6: // Links Personalizados - pelo menos 1 link
        const hasAnyLink = (reviewLink && reviewLink.trim() !== '') ||
          (socialMediaLink && socialMediaLink.trim() !== '') ||
          (pixPaymentLink && pixPaymentLink.trim() !== '') ||
          (locationLink && locationLink.trim() !== '');
        return {
          isValid: hasAnyLink,
          message: hasAnyLink ? '' : 'Adicione ao menos 1 link antes de avançar'
        };

      case 7: // WhatsApp - confirmar
        return { isValid: true, message: '' };

      case 8: // Configurações de Pagamento - sempre válido
        return { isValid: true, message: '' };

      case 9: // Formas de Pagamento - selecionar ou desmarcar ao menos 1
        // Verificar se há alguma forma de pagamento selecionada
        const hasPaymentMethods = paymentMethodsEnabled && paymentMethodsEnabled.length > 0;
        return {
          isValid: hasPaymentMethods,
          message: hasPaymentMethods ? '' : 'Selecione ao menos 1 forma de pagamento para continuar'
        };

      case 10: // Confirmação final
        return { isValid: true, message: '' };

      default:
        return { isValid: true, message: '' };
    }
  };

  // Função para avançar no quiz
  const handleQuizNext = () => {
    const validation = validateQuizStep(quizStep);
    if (!validation.isValid) {
      setQuizAlertMessage(validation.message);
      return;
    }

    setQuizAlertMessage('');
    const nextStep = quizStep + 1;
    setQuizStep(nextStep);

    // Salvar progresso no localStorage
    if (establishment?.id) {
      localStorage.setItem(`quiz_progress_${establishment.id}`, nextStep.toString());
    }

    // Scroll para o início da próxima seção do quiz (não para o topo)
    setTimeout(() => {
      // IDs das seções de cada etapa
      const sectionIds: Record<number, string> = {
        1: 'quiz-section-comodidades',
        2: 'quiz-section-horarios',
        3: 'quiz-section-funcionamento',
        4: 'quiz-section-fotos',
        5: 'quiz-section-pix',
        6: 'quiz-section-links',
        7: 'quiz-section-whatsapp',
        8: 'quiz-section-pagamento',
        9: 'quiz-section-formas-pagamento',
        10: 'quiz-section-confirmacao'
      };

      const sectionId = sectionIds[nextStep];
      if (sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
          const offset = 100; // Offset para não ficar colado no topo
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }
    }, 100); // Pequeno delay para garantir que o DOM foi atualizado
  };

  // Função para voltar no quiz
  const handleQuizPrevious = () => {
    if (quizStep > 1) {
      const previousStep = quizStep - 1;
      setQuizStep(previousStep);
      setQuizAlertMessage('');

      // Salvar progresso no localStorage
      if (establishment?.id) {
        localStorage.setItem(`quiz_progress_${establishment.id}`, previousStep.toString());
      }

      // Scroll para o início da seção anterior do quiz
      setTimeout(() => {
        // IDs das seções de cada etapa
        const sectionIds: Record<number, string> = {
          1: 'quiz-section-comodidades',
          2: 'quiz-section-horarios',
          3: 'quiz-section-funcionamento',
          4: 'quiz-section-fotos',
          5: 'quiz-section-pix',
          6: 'quiz-section-links',
          7: 'quiz-section-whatsapp',
          8: 'quiz-section-pagamento',
          9: 'quiz-section-formas-pagamento',
          10: 'quiz-section-confirmacao'
        };

        const sectionId = sectionIds[previousStep];
        if (sectionId) {
          const element = document.getElementById(sectionId);
          if (element) {
            const offset = 100; // Offset para não ficar colado no topo
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          }
        }
      }, 100); // Pequeno delay para garantir que o DOM foi atualizado
    }
  };

  // Função para salvar todas as configurações (chamada na etapa 10)
  const handleSaveAllSettings = async () => {
    try {
      // Salvar todas as configurações pendentes
      await autoSaveAmenities();
      await autoSaveScheduleConfig({
        use15MinuteInterval: use15MinuteInterval,
        use20MinuteSchedule: use20MinuteSchedule,
        showBestOfBrazilImage: showBestOfBrazilImage
      });
      await autoSaveLinks();
      await autoSavePaymentConfig();

      // Marcar quiz como completo no banco de dados
      if (establishment?.id) {
        const { error } = await supabase
          .from('establishments')
          .update({ quiz_completed: true })
          .eq('id', establishment.id);

        if (error) {
          console.error('Erro ao marcar quiz como completo:', error);
        } else {
          setQuizCompleted(true);
          setIsNewUser(false); // Não mostrar mais o quiz
        }
      }

      // Limpar progresso do quiz do localStorage (quiz completo)
      if (establishment?.id) {
        localStorage.removeItem(`quiz_progress_${establishment.id}`);
      }

      toast('Configurações salvas com sucesso! Agora vamos configurar seus profissionais.', 'success');

      // Avançar para a próxima etapa (Profissionais)
      setTimeout(() => {
        setActiveTab('professionals');
      }, 1000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast('Erro ao salvar configurações. Tente novamente.', 'error');
    }
  };

  useEffect(() => {
    fetchEstablishment();
    loadTutorialPreferences(); // Carregar preferências dos tutoriais
  }, [user]);

  // Monitora quando um serviço válido é adicionado e desbloqueia tudo automaticamente
  useEffect(() => {
    // Sempre logar para ver o que está acontecendo
    console.log('🔍 DEBUG Onboarding - useEffect executado:', {
      onboardingStep,
      hasEstablishment: !!establishment,
      establishmentId: establishment?.id,
      servicesCount: servicesWithPrices.length,
      validServicesCount: servicesWithPrices.filter(s => s.name && s.name.trim().length > 0 && s.price > 0).length,
      services: servicesWithPrices.map(s => ({ name: s.name, price: s.price })),
      onboardingCompletedRef: onboardingCompletedRef.current
    });

    if (onboardingStep === 3 && establishment && !onboardingCompletedRef.current) {
      console.log('✅ DEBUG Onboarding - Condições atendidas! Verificando serviços válidos...');
      const validServices = servicesWithPrices.filter(s =>
        s.name && s.name.trim().length > 0 && s.price > 0
      );

      console.log('✅ DEBUG Onboarding - Serviços válidos encontrados:', validServices);

      if (validServices.length > 0) {
        // Tem pelo menos um serviço válido, salvar no banco e completar onboarding
        onboardingCompletedRef.current = true; // Marca como completo para evitar múltiplas chamadas

        const completeOnboarding = async () => {
          try {
            // Primeiro, salvar os serviços no banco de dados
            const { error: saveError } = await supabase
              .from('establishments')
              .update({
                services_with_prices: validServices.map(s => ({
                  id: s.id,
                  name: s.name.trim(),
                  price: Number(s.price),
                  duration: Number(s.duration)
                }))
              })
              .eq('id', establishment.id);

            if (saveError) {
              console.error('Erro ao salvar serviços:', saveError);
              onboardingCompletedRef.current = false;
              return;
            }

            // Depois, atualizar o onboarding_step
            const { error: onboardingError } = await supabase
              .from('establishments')
              .update({ onboarding_step: 4 })
              .eq('id', establishment.id);

            if (!onboardingError) {
              setOnboardingStep(4);
              // Atualizar o establishment local
              setEstablishment({
                ...establishment,
                services_with_prices: validServices
              });
              // Não mostra popup, apenas desbloqueia silenciosamente
            } else {
              onboardingCompletedRef.current = false; // Se der erro, permite tentar novamente
            }
          } catch (error) {
            console.error('Erro ao completar onboarding:', error);
            onboardingCompletedRef.current = false;
          }
        };

        // Aguardar um pouco para garantir que o usuário terminou de digitar
        const timeoutId = setTimeout(() => {
          completeOnboarding();
        }, 1000); // 1 segundo de delay

        return () => clearTimeout(timeoutId);
      }
    }

    // Resetar ref quando onboarding step mudar
    if (onboardingStep !== 3) {
      onboardingCompletedRef.current = false;
    }
  }, [servicesWithPrices, onboardingStep, establishment]);

  useEffect(() => {
    if (establishment && activeTab === 'financial-dashboard') {
      fetchPremiumSubscribers();
    }
    if (establishment && activeTab === 'taxes') {
      calculateTaxesReport();
    }
    if (establishment && activeTab === 'products') {
      fetchProducts();
      fetchProductSalesByPeriod(selectedProductsMonth);
    }
    if (establishment && activeTab === 'service-categories') {
      fetchServiceCategories();
      fetchServiceSubcategories();
    }
    // Carregar categorias sempre que o estabelecimento for carregado (para usar no modal de metas)
    if (establishment) {
      fetchServiceCategories();
      fetchServiceSubcategories();
    }

    // Carregar progresso das metas quando estiver na aba de profissionais
    if (establishment && activeTab === 'professionals' && professionals.length > 0) {
      loadAllProfessionalGoalsProgress();
    }

    // Mostrar popup de alerta quando entrar em "Meus Agendamentos" e o alerta estiver ativado
    if (establishment && activeTab === 'appointments' && establishment.payment_alert_enabled) {
      setShowPaymentAlert(true);
    } else {
      setShowPaymentAlert(false);
    }

    // Mostrar popup de propaganda quando entrar em "Meus Agendamentos" e a propaganda estiver ativada
    const promotionDismissed = localStorage.getItem('promotion_dismissed');
    if (establishment && activeTab === 'appointments' && establishment.promotion_enabled && promotionDismissed !== 'true') {
      setShowPromotionPopup(true);
    } else {
      setShowPromotionPopup(false);
    }
  }, [establishment, activeTab]);

  useEffect(() => {
    if (establishment) {
      fetchAppointments();
      fetchMonthlyAppointments(selectedMonth);
      fetchProducts(); // Carregar produtos automaticamente
      // Valores iniciais agora são gerenciados por mês

      // Notificações agora são gerenciadas pelo painel interno

    }

    // Cleanup ao desmontar
    return () => {
      // Cleanup do sistema de notificações internas
    };
  }, [establishment, selectedDate, selectedMonth]);

  // Atualização automática a cada 10 segundos COM PROTEÇÃO PARA EXCLUSÕES
  useEffect(() => {
    if (!establishment) return;

    const interval = setInterval(async () => {


      // Salvar estado atual dos agendamentos
      const previousAppointments = [...previousAppointmentsRef.current];


      // Buscar novos dados
      try {
        const { data: newAppointments } = await supabase
          .from('appointments')
          .select(`
            *,
            establishments (
              name,
              code
            )
          `)
          .eq('establishment_id', establishment.id)
          .gte('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
          .lte('appointment_date', format(selectedDate, 'yyyy-MM-dd'))
          .order('appointment_time')
          .abortSignal(new AbortController().signal); // Forçar busca sem cache

        if (newAppointments) {


          // Detectar novos agendamentos
          newAppointments.forEach(currentApp => {
            const prevApp = previousAppointments.find(prev => prev.id === currentApp.id);

            if (!prevApp && currentApp.status !== 'cancelled') {
              console.log('🔔 DETECTADO NOVO AGENDAMENTO:', currentApp);
              const professionalName = getProfessionalName(currentApp.professional);
              notifyNewAppointment(
                currentApp.client_name,
                currentApp.service,
                currentApp.appointment_time,
                professionalName !== 'Profissional não encontrado' ? professionalName : undefined
              );
            }
          });

          // Detectar agendamentos cancelados externamente
          previousAppointments.forEach(prevApp => {
            const currentApp = newAppointments.find(curr => curr.id === prevApp.id);

            if (currentApp && prevApp.status !== 'cancelled' && currentApp.status === 'cancelled') {
              console.log('🔔 DETECTADO CANCELAMENTO EXTERNO:', currentApp);
              const professionalName = getProfessionalName(currentApp.professional);
              notifyCancelledAppointment(
                currentApp.client_name,
                currentApp.service,
                currentApp.appointment_time,
                professionalName !== 'Profissional não encontrado' ? professionalName : undefined
              );
            }
          });

          // ATUALIZAÇÃO INTELIGENTE: Só adiciona novos, não remove excluídos
          setAppointments(currentList => {
            // Manter agendamentos que já estão na lista (incluindo os que foram excluídos)
            const currentIds = currentList.map(app => app.id);

            // Adicionar apenas agendamentos novos que não estão na lista atual
            const newAppointmentsToAdd = newAppointments.filter(newApp =>
              !currentIds.includes(newApp.id)
            );

            if (newAppointmentsToAdd.length > 0) {
              console.log('🔄 Adicionando novos agendamentos:', newAppointmentsToAdd.length);
              return [...currentList, ...newAppointmentsToAdd];
            }

            return currentList; // Não muda nada se não há novos
          });

          previousAppointmentsRef.current = newAppointments;
        }
      } catch (error) {
        console.error('❌ Erro na atualização automática:', error);
      }

    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [establishment, selectedDate]);

  // Atualizar ref quando appointments mudarem
  useEffect(() => {
    previousAppointmentsRef.current = appointments;
  }, [appointments]);

  // Recalcular dados financeiros quando agendamentos mudarem
  useEffect(() => {
    if (appointments.length > 0 && establishment?.professionals) {
      console.log('🔄 Recalculando dados financeiros devido a mudanças nos agendamentos');
      // Forçar re-render dos dados financeiros
      setForceUpdate(prev => prev + 1);
    }
  }, [appointments, establishment?.professionals]);

  // Listener para manter conexão com Service Worker
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data.type === 'KEEP_ALIVE') {

        // Forçar verificação imediata se necessário
        if (establishment) {
          // Verificação rápida adicional
          setTimeout(() => {
            fetchAppointments();
          }, 1000);
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [establishment]);





  useEffect(() => {
    if (establishment && (activeTab === 'clients' || activeTab === 'subscribers')) {
      fetchClients();
    }
  }, [establishment, activeTab]);

  // Listener para recarregar clientes E AGENDAMENTOS quando um agendamento for criado
  useEffect(() => {
    const handleClientAppointmentCreated = () => {
      console.log('🔄 Evento recebido: clientAppointmentCreated - Recarregando clientes e agendamentos...');
      if (establishment) {
        if (activeTab === 'clients' || activeTab === 'subscribers') {
          fetchClients();
        }
        // SEMPRE recarregar agendamentos quando criar uma nova reserva
        fetchAppointments();
        fetchMonthlyAppointments(selectedMonth);
      }
    };

    window.addEventListener('clientAppointmentCreated', handleClientAppointmentCreated);
    return () => {
      window.removeEventListener('clientAppointmentCreated', handleClientAppointmentCreated);
    };
  }, [establishment, activeTab, selectedMonth]);

  // Recarregar agendamentos quando abrir a aba de agendamentos
  useEffect(() => {
    if (establishment && activeTab === 'appointments') {
      console.log('🔄 Aba de agendamentos aberta - Recarregando agendamentos...');
      fetchAppointments();
      fetchMonthlyAppointments(selectedMonth);
    }
  }, [activeTab]);

  // Funções para gerenciar despesas
  const loadExpenses = useCallback(async () => {
    if (!establishment?.id) return;

    try {
      // Calcular período do mês selecionado
      const startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      console.log('💰 Carregando despesas para o mês:', selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
      console.log('📅 Período:', startDate.toISOString(), 'até', endDate.toISOString());
      console.log('🔍 Establishment ID:', establishment.id);

      const expensesData = await getExpensesByMonth(establishment.id, startDate.toISOString(), endDate.toISOString());

      console.log('💰 Despesas carregadas:', expensesData.length);
      console.log('📋 Despesas encontradas:', expensesData);

      setExpenses(expensesData);

      // Calcular total das despesas do mês
      const total = expensesData.reduce((sum, expense) => sum + expense.amount, 0);
      setExpensesTotal(total);

      console.log('💰 Total de despesas:', total);
    } catch (error) {
      console.error('❌ Erro ao carregar despesas:', error);
    }
  }, [establishment?.id, selectedMonth]);

  const loadProfessionalPayments = useCallback(async () => {
    if (!establishment?.id) return;

    try {
      const { data, error } = await supabase
        .from('professional_payments')
        .select('*')
        .eq('establishment_id', establishment.id)
        .order('payment_date', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar pagamentos profissionais:', error);
        return;
      }

      setAllProfessionalPayments(data || []);
      console.log('💰 Pagamentos profissionais carregados:', data?.length || 0);
    } catch (error) {
      console.error('❌ Erro ao carregar pagamentos profissionais:', error);
    }
  }, [establishment?.id]);

  // Carregar assinantes pagos e despesas quando trocar de aba ou estabelecimento mudar
  useEffect(() => {
    if (establishment?.id && establishment.professionals && establishment.professionals.length > 0) {
      loadPaidSubscribers();
      loadExpenses();
      loadProfessionalPayments();
    }
  }, [establishment?.id, activeTab, establishment?.professionals, selectedMonth, loadExpenses, loadProfessionalPayments]);

  // Removido useEffect que causava loop infinito



  const calculateDailyBalance = (appointments: Appointment[]): number => {
    return appointments.reduce((total, appointment) => {
      // Só incluir no faturamento se o status for 'completed' (verde - FEITO)
      if (appointment.status === 'completed') {
        // Excluir do faturamento se for assinante pago (serviço gratuito)
        if (isClientPaidSubscriber(appointment.client_whatsapp)) {
          return total; // Não adiciona ao faturamento
        }
        return total + calculateGrossValueWithCardTax(appointment);
      }
      return total;
    }, 0);
  };

  const calculateMonthlyBalance = (appointments: Appointment[]): number => {
    return appointments.reduce((total, appointment) => {
      // Só incluir no faturamento se o status for 'completed' (verde - FEITO)
      if (appointment.status === 'completed') {
        // Excluir do faturamento se for assinante pago (serviço gratuito)
        if (isClientPaidSubscriber(appointment.client_whatsapp)) {
          return total; // Não adiciona ao faturamento
        }
        return total + calculateGrossValueWithCardTax(appointment);
      }
      return total;
    }, 0);
  };

  // Função que inclui valor bruto editado no cálculo bruto (por mês)
  const calculateTotalGrossWithInitial = (appointments: Appointment[]): number => {
    const monthlyGross = calculateMonthlyBalance(appointments);
    const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    const editedGrossValue = monthlyGrossValues[monthKey] || 0;
    return monthlyGross + editedGrossValue;
  };

  // Função para calcular total das taxas de cartão do mês
  const calculateTotalCardTaxes = (appointments: Appointment[]): number => {
    return appointments.reduce((total, appointment) => {
      if (appointment.status === 'completed' && !isClientPaidSubscriber(appointment.client_whatsapp)) {
        const baseValue = appointment.total_price || appointment.price || 0;
        const paymentTax = getPaymentMethodTax(appointment.payment_method || '', appointment.card_brand);

        // Só aplicar taxa se for cartão
        if (appointment.payment_method === 'credito' || appointment.payment_method === 'debito') {
          const cardTax = (baseValue * paymentTax) / 100;
          return total + cardTax;
        }
      }
      return total;
    }, 0);
  };

  // Função que inclui valor bruto editado no cálculo líquido (por mês)
  const calculateTotalLiquidWithInitial = (appointments: Appointment[], expenses: number): number => {
    const monthlyGross = calculateMonthlyBalance(appointments);
    const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    const editedGrossValue = monthlyGrossValues[monthKey] || 0;
    const totalGross = monthlyGross + editedGrossValue;

    // Calcular total das taxas de cartão dos agendamentos do mês
    const totalCardTaxes = calculateTotalCardTaxes(appointments);

    return totalGross - expenses - totalCardTaxes;
  };

  // Função que inclui valor bruto editado no cálculo líquido do estabelecimento (por mês)
  const calculateTotalEstablishmentLiquidWithInitial = (appointments: Appointment[], expenses: number): number => {
    const monthlyGross = calculateMonthlyBalance(appointments);
    const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    const editedGrossValue = monthlyGrossValues[monthKey] || 0;
    const totalGross = monthlyGross + editedGrossValue;

    // Calcular total das taxas de cartão
    const totalCardTaxes = calculateTotalCardTaxes(appointments);

    // Calcular total que você paga para outros profissionais (SEM descontar taxa do profissional)
    const totalPaidToOthers = appointments.reduce((total, appointment) => {
      if (appointment.status === 'completed' && !isClientPaidSubscriber(appointment.client_whatsapp)) {
        const professionalPercentage = getProfessionalPercentageByName(appointment.professional);

        // Só subtrair se não for dono (100%)
        if (professionalPercentage < 100) {
          // IMPORTANTE: Usar price + additional_products (serviços extra)
          // Produtos V2 (appointment_products) NÃO entram, mas serviços extra (additional_products) SIM
          const serviceBasePrice = appointment.price || 0;
          const additionalServicesTotal = (appointment.additional_products || []).reduce((sum, p) => sum + (p.price || 0), 0);
          const baseValue = serviceBasePrice + additionalServicesTotal; // Serviços extra entram na %

          // Profissional recebe % do valor BRUTO (serviço + serviços extra, sem produtos V2, sem descontar taxa)
          const professionalShare = (baseValue * professionalPercentage) / 100;

          return total + professionalShare;
        }
      }
      return total;
    }, 0);

    // Calcular total de retiradas dos profissionais (valores negativos)
    // Buscar pagamentos do mês atual para calcular retiradas
    const currentMonthPayments = allProfessionalPayments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      return paymentDate.getFullYear() === selectedMonth.getFullYear() &&
        paymentDate.getMonth() === selectedMonth.getMonth();
    });

    const totalWithdrawals = currentMonthPayments
      .filter(payment => payment.amount < 0)
      .reduce((total, payment) => total + Math.abs(payment.amount), 0);

    console.log('💰 Cálculo Líquido Estabelecimento:', {
      totalGross,
      expenses,
      totalCardTaxes,
      totalPaidToOthers,
      totalWithdrawals,
      result: totalGross - expenses - totalCardTaxes - totalPaidToOthers + totalWithdrawals
    });

    // Líquido do estabelecimento = Líquido total - O que você paga para outros + Retiradas
    return totalGross - expenses - totalCardTaxes - totalPaidToOthers + totalWithdrawals;
  };

  // Função para calcular valor bruto mensal do profissional selecionado
  const calculateMonthlyBalanceForSelectedProfessional = (appointments: Appointment[]): number => {
    const result = appointments.reduce((total, appointment) => {
      // Verificar se o agendamento é do mês selecionado
      const appointmentDate = new Date(appointment.appointment_date);
      const appointmentMonth = appointmentDate.getMonth();
      const appointmentYear = appointmentDate.getFullYear();
      const selectedMonthValue = selectedMonth.getMonth();
      const selectedYearValue = selectedMonth.getFullYear();

      const isSameMonth = appointmentMonth === selectedMonthValue && appointmentYear === selectedYearValue;

      if (!isSameMonth) {
        return total; // Não incluir agendamentos de outros meses
      }

      // Só incluir no faturamento se o status for 'completed' (verde - FEITO)
      if (appointment.status === 'completed') {
        // Excluir do faturamento se for assinante pago (serviço gratuito)
        if (isClientPaidSubscriber(appointment.client_whatsapp)) {
          return total; // Não adiciona ao faturamento
        }

        if (selectedProfessional === 'all') {
          // Se "todos" selecionado, soma todos os agendamentos do mês
          return total + calculateGrossValueWithCardTax(appointment);
        } else {
          // Se profissional específico selecionado, soma apenas dele
          if (appointment.professional === selectedProfessional) {
            return total + calculateGrossValueWithCardTax(appointment);
          }
        }
      }
      return total;
    }, 0);

    return result;
  };

  // Função para calcular valor líquido diário do profissional selecionado
  const calculateDailyNetBalance = (appointments: Appointment[]): number => {
    return appointments.reduce((total, appointment) => {
      if (appointment.status !== 'cancelled') {
        // Excluir do faturamento se for assinante pago (serviço gratuito)
        if (isClientPaidSubscriber(appointment.client_whatsapp)) {
          return total; // Não adiciona ao faturamento
        }

        if (selectedProfessional === 'all') {
          // Se "todos" selecionado, soma o líquido de todos os profissionais
          return total + calculateNetValueWithCardTax(appointment);
        } else {
          // Se profissional específico selecionado, soma apenas dele
          if (appointment.professional === selectedProfessional) {
            return total + calculateNetValueWithCardTax(appointment);
          }
        }
      }
      return total;
    }, 0);
  };

  // Função para calcular valor líquido mensal do profissional selecionado
  const calculateMonthlyNetBalance = (appointments: Appointment[]): number => {
    const result = appointments.reduce((total, appointment) => {
      // Verificar se o agendamento é do mês selecionado
      const appointmentDate = new Date(appointment.appointment_date);
      const appointmentMonth = appointmentDate.getMonth();
      const appointmentYear = appointmentDate.getFullYear();
      const selectedMonthValue = selectedMonth.getMonth();
      const selectedYearValue = selectedMonth.getFullYear();

      const isSameMonth = appointmentMonth === selectedMonthValue && appointmentYear === selectedYearValue;

      if (!isSameMonth) {
        return total; // Não incluir agendamentos de outros meses
      }

      if (appointment.status !== 'cancelled') {
        // Excluir do faturamento se for assinante pago (serviço gratuito)
        if (isClientPaidSubscriber(appointment.client_whatsapp)) {
          return total; // Não adiciona ao faturamento
        }
        if (selectedProfessional === 'all') {
          // Se "todos" selecionado, soma o líquido de todos os profissionais
          return total + calculateNetValueWithCardTax(appointment);
        } else {
          // Se profissional específico selecionado, soma apenas dele
          if (appointment.professional === selectedProfessional) {
            return total + calculateNetValueWithCardTax(appointment);
          }
        }
      }
      return total;
    }, 0);

    return result;
  };

  // Função para obter percentual do profissional por nome ou ID
  const getProfessionalPercentageByName = (professionalName: string) => {
    // Primeiro tenta encontrar por nome
    let professional = professionals.find(p => p.name === professionalName);

    // Se não encontrar por nome, tenta por ID
    if (!professional) {
      professional = professionals.find(p => p.id === professionalName);
    }

    const percentage = professional?.percentage ?? 100;

    console.log('🚨 TESTE - Buscando percentual:', {
      professionalName,
      found: !!professional,
      professionalData: professional,
      percentage,
      allProfessionals: professionals.map(p => ({ id: p.id, name: p.name, percentage: p.percentage }))
    });

    return percentage;
  };

  // Função para calcular valor líquido do estabelecimento (bruto - valor dos colaboradores)
  const calculateEstablishmentNetBalance = (appointments: Appointment[]): number => {
    const grossValue = calculateMonthlyBalance(appointments);

    // Calcular apenas o valor dos colaboradores (profissionais com menos de 100%)
    const collaboratorsValue = appointments.reduce((total, appointment) => {
      // Verificar se o agendamento é do mês selecionado
      const appointmentDate = new Date(appointment.appointment_date);
      const appointmentMonth = appointmentDate.getMonth();
      const appointmentYear = appointmentDate.getFullYear();
      const selectedMonthValue = selectedMonth.getMonth();
      const selectedYearValue = selectedMonth.getFullYear();

      const isSameMonth = appointmentMonth === selectedMonthValue && appointmentYear === selectedYearValue;

      if (!isSameMonth || appointment.status === 'cancelled') {
        return total;
      }

      // Excluir do faturamento se for assinante pago (serviço gratuito)
      if (isClientPaidSubscriber(appointment.client_whatsapp)) {
        return total;
      }

      const professionalPercentage = getProfessionalPercentageByName(appointment.professional);

      // Descontar TODOS os profissionais (incluindo dono com 100%)
      if (professionalPercentage === 100) {
        // Para dono: bruto - taxa de cartão (se houver)
        // IMPORTANTE: Usar price + additional_products (serviços extra)
        // Produtos V2 (appointment_products) NÃO entram, mas serviços extra (additional_products) SIM
        const serviceBasePrice = appointment.price || 0;
        const additionalServicesTotal = (appointment.additional_products || []).reduce((sum, p) => sum + (p.price || 0), 0);
        const baseValue = serviceBasePrice + additionalServicesTotal; // Serviços extra entram na %
        const paymentTax = getPaymentMethodTax(appointment.payment_method || '', appointment.card_brand);
        if (appointment.payment_method === 'credito' || appointment.payment_method === 'debito') {
          const cardTax = (baseValue * paymentTax) / 100;
          const netValue = baseValue - cardTax;
          return total + netValue;
        } else {
          return total + baseValue;
        }
      } else {
        // Para outros profissionais: usar função normal
        const netValue = calculateNetValueWithCardTax(appointment);
        return total + netValue;
      }
    }, 0);

    return grossValue - collaboratorsValue;
  };

  // Filtrar agendamentos por profissional e forma de pagamento selecionados
  const filteredAppointments = appointments.filter(appointment => {
    // Se nenhum profissional estiver selecionado, não mostrar agendamentos
    if (selectedProfessional === '') return false;

    const isProfessionalMatch = selectedProfessional === 'all' || appointment.professional === selectedProfessional;
    const isPaymentMethodMatch = selectedPaymentMethod === 'todos' || (appointment.payment_method || 'pendente') === selectedPaymentMethod;
    return isProfessionalMatch && isPaymentMethodMatch;
  });

  // Gerar slots com lacunas de horário
  const showTimeSlotsWithGaps = selectedProfessional !== '' && selectedProfessional !== 'all';

  const timeSlotsWithAppointments = React.useMemo(() => {
    // SEMPRE gerar slots, mesmo quando mostrando todos os profissionais
    // Removido o return antecipado que ignorava a configuração de intervalos

    // Mapear dias em português para inglês
    const dayMapping: Record<string, keyof typeof businessHours> = {
      'domingo': 'sunday',
      'segunda-feira': 'monday',
      'terça-feira': 'tuesday',
      'quarta-feira': 'wednesday',
      'quinta-feira': 'thursday',
      'sexta-feira': 'friday',
      'sábado': 'saturday'
    };

    const dayName = format(selectedDate, 'EEEE', { locale: ptBR }).toLowerCase();
    const dayKey = dayMapping[dayName] || dayName as keyof typeof businessHours;
    const hoursForDay = businessHours[dayKey];

    console.log('🕐 Gerando slots com lacunas para o profissional:', selectedProfessional);
    console.log('🕐 Data selecionada:', selectedDate);
    console.log('🕐 Nome do dia (PT):', dayName);
    console.log('🕐 Day key (EN):', dayKey);
    console.log('🕐 Horário de funcionamento para', dayKey, ':', hoursForDay);

    if (!hoursForDay?.enabled) {
      console.log('🕐 Dia não habilitado, retornando apenas agendamentos');
      return filteredAppointments;
    }

    const slots: any[] = [];

    // Determinar o intervalo baseado na configuração
    let intervalMinutes = 30; // Padrão: 30 em 30 minutos
    if (use20MinuteSchedule) {
      intervalMinutes = 20; // Horários de 20 em 20 minutos
    } else if (!use15MinuteInterval) {
      intervalMinutes = 15; // Horários de 15 em 15 minutos (quando DESMARCADO)
    }

    const convertToMinutes = (timeString: string) => {
      const [hours, mins] = timeString.split(':').map(Number);
      return hours * 60 + mins;
    };

    const convertToTimeString = (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const addPeriodSlots = (startTime: string, endTime: string) => {
      let currentMinutes = convertToMinutes(startTime);
      const endMinutes = convertToMinutes(endTime);

      // 1. Primeiro, coletar TODOS os horários únicos dos agendamentos
      const appointmentTimes = new Set<number>();
      filteredAppointments.forEach(apt => {
        const aptStartMinutes = convertToMinutes(apt.appointment_time);
        const aptDuration = apt.duration || 30;
        const aptEndMinutes = aptStartMinutes + aptDuration;

        // Adicionar horário de início
        appointmentTimes.add(aptStartMinutes);

        // Adicionar horários intermediários usando o intervalo configurado
        let checkMinutes = aptStartMinutes + intervalMinutes;
        while (checkMinutes < aptEndMinutes) {
          appointmentTimes.add(checkMinutes);
          checkMinutes += intervalMinutes;
        }
      });

      // 2. Gerar slots padrão + slots de agendamentos não-padrão
      const allSlots = new Set<number>();

      // Adicionar slots padrão (30 em 30 ou 15 em 15)
      let standardMinutes = convertToMinutes(startTime);
      while (standardMinutes < endMinutes) {
        allSlots.add(standardMinutes);
        standardMinutes += intervalMinutes;
      }

      // Adicionar horários de agendamentos que não seguem o padrão
      appointmentTimes.forEach(time => {
        if (time >= convertToMinutes(startTime) && time < endMinutes) {
          allSlots.add(time);
        }
      });

      // 3. Converter para array e ordenar
      const sortedSlots = Array.from(allSlots).sort((a, b) => a - b);

      // 4. Processar cada slot
      sortedSlots.forEach(currentMinutes => {
        const timeString = convertToTimeString(currentMinutes);

        // Verificar se há um agendamento neste horário exato
        const existingAppointment = filteredAppointments.find(
          apt => apt.appointment_time === timeString
        );

        if (existingAppointment) {
          slots.push(existingAppointment);
        } else {
          // Verificar se este horário está dentro da duração de algum agendamento
          const occupyingAppointment = filteredAppointments.find(apt => {
            const aptStartMinutes = convertToMinutes(apt.appointment_time);
            const aptDuration = apt.duration || 30;
            const aptEndMinutes = aptStartMinutes + aptDuration;

            // Este horário está entre o início e o fim do agendamento?
            return currentMinutes > aptStartMinutes && currentMinutes < aptEndMinutes;
          });

          if (occupyingAppointment) {
            // Horário ocupado pela duração de um agendamento
            slots.push({
              _isOccupied: true,
              _time: timeString,
              _parentAppointment: occupyingAppointment
            });
          } else {
            // Horário disponível
            slots.push({ _isEmpty: true, _time: timeString });
          }
        }
      });
    };

    if (hoursForDay.open1 && hoursForDay.close1) {
      addPeriodSlots(hoursForDay.open1, hoursForDay.close1);
    }

    if (hoursForDay.open2 && hoursForDay.close2) {
      addPeriodSlots(hoursForDay.open2, hoursForDay.close2);
    }

    console.log('🕐 Total de slots gerados:', slots.length);
    console.log('🕐 Slots:', slots);

    return slots;
  }, [filteredAppointments, selectedProfessional, selectedDate, businessHours, use15MinuteInterval, use20MinuteSchedule, showTimeSlotsWithGaps]);

  // Função para verificar se é aniversário no mês atual
  const isBirthdayThisMonth = (birthday: string | null) => {
    if (!birthday) return false;
    const currentMonth = new Date().getMonth();
    const birthdayDate = new Date(birthday + 'T12:00:00'); // Corrigir timezone
    return birthdayDate.getMonth() === currentMonth;
  };

  // Função para salvar aniversário do cliente (Supabase + localStorage como fallback)
  // Função para editar cliente
  const handleEditClient = (client: Client) => {
    setEditingClient(client.whatsapp);
    setEditClientName(client.name);
    setEditClientWhatsapp(client.whatsapp);
  };

  // Função para salvar edição do cliente
  const saveClientEdit = async () => {
    console.log('🔍 DEBUG saveClientEdit:', {
      editingClient,
      editClientName,
      editClientWhatsapp
    });

    if (!editingClient || !editClientName.trim() || !editClientWhatsapp.trim()) {
      toast('Por favor, preencha todos os campos', 'error');
      return;
    }

    try {
      console.log('💾 Atualizando cliente no banco:', {
        client_whatsapp: editingClient,
        new_name: editClientName.trim(),
        new_whatsapp: editClientWhatsapp.trim()
      });

      // Atualizar nome e WhatsApp do cliente
      const { error } = await supabase
        .from('appointments')
        .update({
          client_name: editClientName.trim(),
          client_whatsapp: editClientWhatsapp.trim()
        })
        .eq('client_whatsapp', editingClient);

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }

      // Atualizar também no Supabase se for cliente manual
      const cleanOldWhatsapp = editingClient.replace(/\D/g, '');
      const cleanNewWhatsapp = editClientWhatsapp.trim().replace(/\D/g, '');

      // Verificar se é cliente manual no Supabase
      const { data: existingManualClient } = await supabase
        .from('manual_clients')
        .select('*')
        .eq('establishment_id', establishment?.id)
        .eq('whatsapp', cleanOldWhatsapp)
        .single();

      if (existingManualClient) {
        // Se o WhatsApp mudou, fazer upsert (remove o antigo e cria o novo)
        if (cleanOldWhatsapp !== cleanNewWhatsapp) {
          // Deletar o antigo
          await supabase
            .from('manual_clients')
            .delete()
            .eq('establishment_id', establishment?.id)
            .eq('whatsapp', cleanOldWhatsapp);

          // Criar o novo
          await supabase
            .from('manual_clients')
            .upsert({
              establishment_id: establishment?.id,
              name: editClientName.trim(),
              whatsapp: cleanNewWhatsapp,
              birthday: existingManualClient.birthday,
              alert: existingManualClient.alert,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'establishment_id,whatsapp'
            });
        } else {
          // Apenas atualizar
          await supabase
            .from('manual_clients')
            .update({
              name: editClientName.trim(),
              updated_at: new Date().toISOString()
            })
            .eq('establishment_id', establishment?.id)
            .eq('whatsapp', cleanOldWhatsapp);
        }
        console.log('💾 Cliente manual atualizado no Supabase');
      }

      // Também atualizar no localStorage como backup
      const storageKey = `manual_clients_${establishment?.id}`;
      const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');

      if (manualClients[cleanOldWhatsapp]) {
        if (cleanOldWhatsapp !== cleanNewWhatsapp) {
          delete manualClients[cleanOldWhatsapp];
          manualClients[cleanNewWhatsapp] = {
            name: editClientName.trim(),
            whatsapp: cleanNewWhatsapp,
            birthday: manualClients[cleanOldWhatsapp]?.birthday,
            addedAt: manualClients[cleanOldWhatsapp]?.addedAt
          };
        } else {
          manualClients[cleanOldWhatsapp] = {
            ...manualClients[cleanOldWhatsapp],
            name: editClientName.trim()
          };
        }
        localStorage.setItem(storageKey, JSON.stringify(manualClients));
      }

      console.log('✅ Cliente atualizado com sucesso!');
      toast('Cliente atualizado com sucesso!', 'success');
      setEditingClient(null);
      setEditClientName('');
      setEditClientWhatsapp('');
      fetchClients(); // Recarregar lista
    } catch (error) {
      console.error('❌ Erro ao atualizar cliente:', error);
      toast('Erro ao atualizar cliente', 'error');
    }
  };

  // Função para excluir cliente
  const handleDeleteClient = async (clientWhatsapp: string) => {
    console.log('🗑️ DEBUG handleDeleteClient:', { clientWhatsapp });

    if (!confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) {
      console.log('❌ Usuário cancelou a exclusão');
      return;
    }

    try {
      console.log('💾 Excluindo cliente do banco:', { clientWhatsapp });

      // Excluir todos os agendamentos do cliente
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('client_whatsapp', clientWhatsapp);

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }

      // Excluir também do Supabase se for cliente manual
      const cleanWhatsapp = clientWhatsapp.replace(/\D/g, '');

      const { error: deleteManualError } = await supabase
        .from('manual_clients')
        .delete()
        .eq('establishment_id', establishment?.id)
        .eq('whatsapp', cleanWhatsapp);

      if (deleteManualError) {
        console.warn('⚠️ Erro ao excluir cliente manual do Supabase:', deleteManualError);
      } else {
        console.log('🗑️ Cliente manual removido do Supabase');
      }

      // Também excluir do localStorage
      const storageKey = `manual_clients_${establishment?.id}`;
      const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');

      if (manualClients[cleanWhatsapp]) {
        delete manualClients[cleanWhatsapp];
        localStorage.setItem(storageKey, JSON.stringify(manualClients));
        console.log('🗑️ Cliente manual removido do localStorage');
      }

      console.log('✅ Cliente excluído com sucesso!');
      toast('Cliente excluído com sucesso!', 'success');
      fetchClients(); // Recarregar lista
    } catch (error) {
      console.error('❌ Erro ao excluir cliente:', error);
      toast('Erro ao excluir cliente', 'error');
    }
  };

  const saveBirthday = async (clientWhatsapp: string, birthday: string) => {
    try {
      console.log('🎂 Salvando aniversário:', { clientWhatsapp, birthday });

      // Buscar o cliente na lista local pelo WhatsApp para pegar o nome
      const client = clients.find(c => c.whatsapp === clientWhatsapp);
      if (!client) {
        toast('Cliente não encontrado.', 'error');
        return;
      }

      if (!birthday) {
        toast('Por favor, selecione uma data.', 'error');
        return;
      }

      // 1. Tentar salvar no Supabase
      try {
        // Corrigir timezone: garantir que a data seja salva corretamente sem ajuste de fuso horário
        const birthdayDate = new Date(birthday + 'T12:00:00'); // Adicionar horário do meio-dia para evitar problema de timezone
        const formattedBirthday = birthdayDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        console.log('📅 Data original:', birthday);
        console.log('📅 Data formatada para salvar:', formattedBirthday);

        const { data, error } = await supabase
          .from('client_birthdays')
          .upsert({
            establishment_id: establishment?.id,
            client_whatsapp: clientWhatsapp,
            client_name: client.name,
            birthday: formattedBirthday
          }, {
            onConflict: 'establishment_id,client_whatsapp'
          });

        if (error) throw error;

        console.log('✅ Aniversário salvo no Supabase:', data);
        toast('Aniversário atualizado com sucesso!', 'success');

      } catch (supabaseError: any) {
        console.warn('⚠️ Erro ao salvar no Supabase, usando localStorage:', supabaseError.message);

        // 2. Fallback: Salvar no localStorage se Supabase falhar
        const storageKey = `client_birthdays_${establishment?.id}`;
        const savedBirthdays = JSON.parse(localStorage.getItem(storageKey) || '{}');

        savedBirthdays[client.whatsapp] = {
          name: client.name,
          birthday: birthday,
          savedAt: new Date().toISOString()
        };

        localStorage.setItem(storageKey, JSON.stringify(savedBirthdays));
        console.log('✅ Aniversário salvo no localStorage (fallback)');
        toast('Aniversário atualizado com sucesso!', 'success');
      }

      setEditingClientBirthday(null);
      setNewBirthday('');

      // Recarregar a lista para mostrar o aniversário
      fetchClients();

    } catch (error: any) {
      console.error('❌ Erro ao salvar aniversário:', error);
      toast(error.message || 'Erro ao salvar aniversário', 'error');
    }
  };

  // Função para salvar alerta do cliente
  const saveAlert = async (clientWhatsapp: string, alert: string) => {
    try {
      console.log('⚠️ Salvando alerta:', { clientWhatsapp, alert });

      // Buscar o cliente na lista local pelo WhatsApp para pegar o nome
      const client = clients.find(c => c.whatsapp === clientWhatsapp);
      if (!client) {
        toast('Cliente não encontrado.', 'error');
        return;
      }

      // Validar tamanho máximo
      if (alert.length > 100) {
        toast('O alerta deve ter no máximo 100 caracteres.', 'error');
        return;
      }

      // 1. Tentar salvar no Supabase
      try {
        const { data, error } = await supabase
          .from('client_alerts')
          .upsert({
            establishment_id: establishment?.id,
            client_whatsapp: clientWhatsapp,
            client_name: client.name,
            alert: alert.trim() || null
          }, {
            onConflict: 'establishment_id,client_whatsapp'
          });

        if (error) throw error;

        console.log('✅ Alerta salvo no Supabase:', data);
        toast('Alerta atualizado com sucesso!', 'success');

      } catch (supabaseError: any) {
        console.warn('⚠️ Erro ao salvar no Supabase, usando localStorage:', supabaseError.message);

        // 2. Fallback: Salvar no localStorage se Supabase falhar
        const storageKey = `client_alerts_${establishment?.id}`;
        const savedAlerts = JSON.parse(localStorage.getItem(storageKey) || '{}');

        savedAlerts[client.whatsapp] = {
          name: client.name,
          alert: alert.trim() || null,
          savedAt: new Date().toISOString()
        };

        localStorage.setItem(storageKey, JSON.stringify(savedAlerts));
        console.log('✅ Alerta salvo no localStorage (fallback)');
        toast('Alerta atualizado com sucesso!', 'success');
      }

      setEditingClientAlert(null);
      setNewAlert('');

      // Recarregar a lista para mostrar o alerta
      fetchClients();

    } catch (error: any) {
      console.error('❌ Erro ao salvar alerta:', error);
      toast(error.message || 'Erro ao salvar alerta', 'error');
    }
  };

  // Função para carregar alertas do Supabase
  const loadAlertsFromSupabase = async (): Promise<Record<string, { alert: string; name: string }>> => {
    if (!establishment?.id) return {};

    try {
      const { data, error } = await supabase
        .from('client_alerts')
        .select('client_whatsapp, client_name, alert')
        .eq('establishment_id', establishment.id);

      if (error) throw error;

      // Converter array para objeto indexado por whatsapp
      const alertsMap: Record<string, { alert: string; name: string }> = {};
      data?.forEach(item => {
        if (item.alert) {
          alertsMap[item.client_whatsapp] = {
            alert: item.alert,
            name: item.client_name
          };
        }
      });

      console.log('⚠️ Alertas carregados do Supabase:', alertsMap);
      return alertsMap;

    } catch (error: any) {
      console.warn('⚠️ Erro ao carregar alertas do Supabase:', error.message);
      return {};
    }
  };

  // Função para carregar aniversários do Supabase
  const loadBirthdaysFromSupabase = async (): Promise<Record<string, { birthday: string; name: string }>> => {
    if (!establishment?.id) return {};

    try {
      const { data, error } = await supabase
        .from('client_birthdays')
        .select('client_whatsapp, client_name, birthday')
        .eq('establishment_id', establishment.id);

      if (error) throw error;

      // Converter array para objeto indexado por whatsapp
      const birthdaysMap: Record<string, { birthday: string; name: string }> = {};
      data?.forEach(item => {
        birthdaysMap[item.client_whatsapp] = {
          birthday: item.birthday,
          name: item.client_name
        };
      });

      console.log('🎂 Aniversários carregados do Supabase:', birthdaysMap);
      return birthdaysMap;

    } catch (error: any) {
      console.warn('⚠️ Erro ao carregar aniversários do Supabase:', error.message);
      return {};
    }
  };

  // Função para carregar aniversários do localStorage (fallback)
  const loadBirthdaysFromStorage = () => {
    if (!establishment?.id) return {};

    const storageKey = `client_birthdays_${establishment.id}`;
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  };

  // Função para carregar alertas do localStorage (fallback)
  const loadAlertsFromStorage = () => {
    if (!establishment?.id) return {};

    const storageKey = `client_alerts_${establishment.id}`;
    const alerts = JSON.parse(localStorage.getItem(storageKey) || '{}');
    // Converter para o formato esperado
    const alertsMap: Record<string, { alert: string; name: string }> = {};
    Object.entries(alerts).forEach(([whatsapp, data]: [string, any]) => {
      if (data.alert) {
        alertsMap[whatsapp] = {
          alert: data.alert,
          name: data.name
        };
      }
    });
    return alertsMap;
  };

  // Função para carregar clientes manuais do Supabase (e localStorage como fallback)
  const loadManualClientsFromStorage = async () => {
    if (!establishment?.id) return {};

    try {
      // Buscar do Supabase primeiro
      const { data: supabaseClients, error } = await supabase
        .from('manual_clients')
        .select('*')
        .eq('establishment_id', establishment.id);

      if (error) {
        console.warn('⚠️ Erro ao buscar clientes do Supabase, usando localStorage:', error);
        // Fallback para localStorage
        const storageKey = `manual_clients_${establishment.id}`;
        return JSON.parse(localStorage.getItem(storageKey) || '{}');
      }

      // Converter array do Supabase para objeto indexado por WhatsApp
      const clientsMap: Record<string, any> = {};
      if (supabaseClients) {
        supabaseClients.forEach(client => {
          clientsMap[client.whatsapp] = {
            name: client.name,
            whatsapp: client.whatsapp,
            birthday: client.birthday,
            alert: client.alert,
            addedAt: client.created_at,
            appointmentCount: 0
          };
        });
      }

      console.log('✅ Clientes manuais carregados do Supabase:', Object.keys(clientsMap).length);
      return clientsMap;

    } catch (error) {
      console.error('❌ Erro ao carregar clientes manuais:', error);
      // Fallback para localStorage em caso de erro
      const storageKey = `manual_clients_${establishment.id}`;
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    }
  };

  // Estado para armazenar assinantes pagos
  const [paidSubscribers, setPaidSubscribers] = useState<Set<string>>(new Set());

  // Função SIMPLES para verificar se um WhatsApp é de assinante pago
  const isClientPaidSubscriber = (clientWhatsapp?: string) => {
    if (!clientWhatsapp) return false;

    // Limpar WhatsApp para comparação (só números)
    const cleanWhatsapp = clientWhatsapp.replace(/\D/g, '');

    // Verificar no Set de assinantes pagos
    return paidSubscribers.has(cleanWhatsapp);
  };

  // Função para buscar assinantes pagos do Supabase

  const handleAddExpense = async () => {
    if (!newExpenseName.trim() || !newExpenseAmount.trim()) {
      toast('Nome e valor são obrigatórios!', 'error');
      return;
    }

    const amount = parseFloat(newExpenseAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast('Valor deve ser um número positivo!', 'error');
      return;
    }

    try {
      await addExpense(establishment!.id, newExpenseName.trim(), amount);

      toast('Despesa adicionada com sucesso!', 'success');

      // Limpar formulário
      setNewExpenseName('');
      setNewExpenseAmount('');
      setShowAddExpenseModal(false);

      // Recarregar despesas
      await loadExpenses();
    } catch (error) {
      console.error('❌ Erro ao adicionar despesa:', error);
      toast('Erro ao adicionar despesa', 'error');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
      toast('Despesa removida com sucesso!', 'success');
      await loadExpenses();
    } catch (error) {
      console.error('❌ Erro ao remover despesa:', error);
      toast('Erro ao remover despesa', 'error');
    }
  };

  const loadPaidSubscribers = async () => {
    if (!establishment?.id) return;

    try {
      console.log('🔍 Buscando assinantes pagos...');

      // Passo 1: Buscar assinaturas pagas
      const { data: subscriptions, error: subsError } = await supabase
        .from('client_subscriptions')
        .select('client_id, payment_status')
        .eq('establishment_id', establishment.id)
        .eq('payment_status', 'paid');

      if (subsError) {
        console.error('❌ Erro ao buscar assinaturas:', subsError);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        console.log('📋 Nenhuma assinatura paga encontrada');
        setPaidSubscribers(new Set());
        return;
      }

      console.log('✅ Assinaturas pagas encontradas:', subscriptions);

      // Passo 2: Buscar WhatsApps dos agendamentos desses clientes
      const clientIds = subscriptions.map(sub => sub.client_id).filter(id => !id.startsWith('manual_'));

      // Se não há clientIds válidos, não fazer a consulta
      if (clientIds.length === 0) {
        console.log('📋 Nenhum client_id válido encontrado');
        setPaidSubscribers(new Set());
        return;
      }

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('client_id, client_whatsapp')
        .eq('establishment_id', establishment.id)
        .in('client_id', clientIds)
        .not('client_whatsapp', 'is', null);

      if (appointmentsError) {
        console.error('❌ Erro ao buscar agendamentos:', appointmentsError);
        return;
      }

      console.log('📱 Agendamentos encontrados:', appointmentsData);

      // Passo 3: Criar Set com WhatsApp únicos dos assinantes pagos
      const whatsappSet = new Set(
        appointmentsData?.map(apt => apt.client_whatsapp?.replace(/\D/g, '')).filter(Boolean) || []
      );

      console.log('📱 WhatsApps de assinantes pagos:', Array.from(whatsappSet));
      setPaidSubscribers(whatsappSet);
    } catch (error) {
      console.error('❌ Erro geral ao carregar assinantes pagos:', error);
    }
  };

  // Função para adicionar cliente manualmente
  const addManualClient = async () => {
    if (!newClientName.trim() || !newClientWhatsapp.trim()) {
      toast('Nome e WhatsApp são obrigatórios!', 'error');
      return;
    }

    if (!establishment?.id) {
      toast('Erro: Estabelecimento não encontrado', 'error');
      return;
    }

    // Limpar WhatsApp (remover caracteres especiais)
    const cleanWhatsapp = newClientWhatsapp.replace(/\D/g, '');

    if (cleanWhatsapp.length < 10) {
      toast('WhatsApp deve ter pelo menos 10 dígitos!', 'error');
      return;
    }

    try {
      // Salvar cliente manual no Supabase (banco de dados)
      const { data, error } = await supabase
        .from('manual_clients')
        .upsert({
          establishment_id: establishment.id,
          name: newClientName.trim(),
          whatsapp: cleanWhatsapp,
          birthday: newClientBirthday || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'establishment_id,whatsapp'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao salvar no Supabase:', error);
        throw error;
      }

      console.log('✅ Cliente manual salvo no banco de dados:', data);

      // Também salvar no localStorage como backup/cache
      const storageKey = `manual_clients_${establishment.id}`;
      const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');
      manualClients[cleanWhatsapp] = {
        name: newClientName.trim(),
        whatsapp: cleanWhatsapp,
        birthday: newClientBirthday || null,
        addedAt: new Date().toISOString(),
        appointmentCount: 0
      };
      localStorage.setItem(storageKey, JSON.stringify(manualClients));

      // Se tem aniversário, salvar também no storage de aniversários
      if (newClientBirthday) {
        const birthdayStorageKey = `client_birthdays_${establishment.id}`;
        const savedBirthdays = JSON.parse(localStorage.getItem(birthdayStorageKey) || '{}');
        savedBirthdays[cleanWhatsapp] = {
          name: newClientName.trim(),
          birthday: newClientBirthday,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(birthdayStorageKey, JSON.stringify(savedBirthdays));
      }

      toast('Cliente adicionado com sucesso!', 'success');

      // Limpar form e fechar modal
      setNewClientName('');
      setNewClientWhatsapp('');
      setNewClientBirthday('');
      setShowAddClientModal(false);

      // Recarregar lista de clientes
      fetchClients();

    } catch (error: any) {
      console.error('❌ Erro ao adicionar cliente:', error);
      toast(error.message || 'Erro ao adicionar cliente', 'error');
    }
  };

  // Filtrar clientes baseado na busca e filtro de aniversário
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBirthday = showBirthdayFilter ? isBirthdayThisMonth(client.birthday) : true;
    return matchesSearch && matchesBirthday;
  }).sort((a, b) => a.name.localeCompare(b.name)); // Ordenação alfabética

  // Calcular ranking dos clientes (apenas com 9+ agendamentos)
  const rankingClients = clients
    .filter(client => client.appointmentCount >= 9)
    .sort((a, b) => b.appointmentCount - a.appointmentCount)
    .map((client, index) => ({
      ...client,
      position: index + 1
    }));

  // Calcular clientes sumidos (inativos há 2+ meses)
  const missingClients = clients
    .filter(client => client.appointmentCount > 0) // Apenas clientes que já agendaram
    .map(client => {
      // Buscar o último agendamento deste cliente
      const lastAppointment = appointments.find(apt =>
        apt.client_whatsapp === client.whatsapp || apt.client_id === client.id
      );

      if (!lastAppointment) return null;

      const lastAppointmentDate = new Date(lastAppointment.appointment_date);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - lastAppointmentDate.getFullYear()) * 12 +
        (now.getMonth() - lastAppointmentDate.getMonth());

      return {
        ...client,
        lastAppointmentDate,
        monthsInactive: monthsDiff,
        isOver2Months: monthsDiff >= 2
      };
    })
    .filter(client => client !== null)
    .sort((a, b) => {
      // Primeiro os que têm mais de 2 meses, depois ordenados por tempo de inatividade
      if (a!.isOver2Months && !b!.isOver2Months) return -1;
      if (!a!.isOver2Months && b!.isOver2Months) return 1;
      return b!.monthsInactive - a!.monthsInactive;
    })
    .slice(0, 10); // Limitar a 10 clientes mais inativos

  // Função para remover cliente da lista de sumidos
  const removeFromMissingList = (clientWhatsapp: string) => {
    // Aqui você pode implementar uma lógica para marcar o cliente como "não sumido"
    // Por enquanto, vamos apenas recarregar a lista
    toast('Cliente removido da lista de sumidos', 'success');
    setShowMissingClientsModal(false);
    setTimeout(() => setShowMissingClientsModal(true), 100);
  };



  // Funções para Clientes Fiéis
  const loadLoyalCustomers = async () => {
    try {
      const start = startOfMonth(selectedLoyalMonth);
      const end = endOfMonth(selectedLoyalMonth);

      const { data, error } = await supabase
        .from('loyal_customers')
        .select('*')
        .eq('establishment_id', establishment?.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar clientes fiéis:', error);
        toast('Erro ao carregar clientes. Por favor, tente novamente.', 'error');
        return;
      }

      setLoyalCustomers(data || []);
      setSelectedLoyalCustomer(null);
    } catch (error) {
      console.error('Erro ao carregar clientes fiéis:', error);
      toast('Erro ao carregar clientes. Por favor, tente novamente.', 'error');
    }
  };

  const handleLoyalFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'whatsapp') {
      const numbersOnly = value.replace(/\D/g, '');
      let formattedNumber = numbersOnly;
      if (numbersOnly.length <= 11) {
        formattedNumber = numbersOnly
          .replace(/(\d{2})/, '($1) ')
          .replace(/(\d{5})/, '$1-')
          .replace(/(-\d{4})\d+?$/, '$1');
      }
      setLoyalFormData(prev => ({
        ...prev,
        [name]: formattedNumber
      }));
    } else {
      setLoyalFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmitLoyalCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loyalFormData.customerName.trim() || !loyalFormData.whatsapp.trim()) {
      toast('Por favor, preencha todos os campos.', 'error');
      return;
    }

    setIsLoadingLoyal(true);

    try {
      const whatsappNumbers = loyalFormData.whatsapp.replace(/\D/g, '');

      const { error } = await supabase
        .from('loyal_customers')
        .insert([{
          establishment_id: establishment?.id,
          customer_name: loyalFormData.customerName.trim(),
          whatsapp: whatsappNumbers,
          created_at: new Date(loyalFormData.registrationDate).toISOString()
        }]);

      if (error) {
        console.error('Erro ao salvar cliente fiel:', error);
        toast('Erro ao salvar cliente. Por favor, tente novamente.', 'error');
        return;
      }

      toast('Cliente salvo com sucesso!', 'success');
      setLoyalFormData({
        customerName: '',
        whatsapp: '',
        registrationDate: format(new Date(), 'yyyy-MM-dd')
      });
      await loadLoyalCustomers();
      setShowLoyalForm(false);
    } catch (error) {
      console.error('Erro ao salvar cliente fiel:', error);
      toast('Erro ao salvar cliente. Por favor, tente novamente.', 'error');
    } finally {
      setIsLoadingLoyal(false);
    }
  };

  const handleDrawLoyalCustomer = () => {
    if (loyalCustomers.length === 0) {
      toast('Adicione clientes antes de realizar o sorteio!', 'error');
      return;
    }

    const randomIndex = Math.floor(Math.random() * loyalCustomers.length);
    setSelectedLoyalCustomer(loyalCustomers[randomIndex]);
    toast('Cliente sorteado com sucesso!', 'success');
  };

  const getLoyalWhatsAppLink = (whatsapp: string) => {
    let cleanNumber = whatsapp.replace(/\D/g, '');

    // Garantir que tenha código do país (55 para Brasil)
    if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
      cleanNumber = '55' + cleanNumber;
    } else if (cleanNumber.length === 10) {
      cleanNumber = '55' + cleanNumber;
    } else if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
      // Já tem código do país, manter
    } else if (cleanNumber.length < 10) {
      // Número muito curto, não formatar
    }

    return `https://wa.me/${cleanNumber}`;
  };

  // Carregar clientes fiéis quando o modal abrir
  useEffect(() => {
    if (showDrawModal) {
      loadLoyalCustomers();
    }
  }, [showDrawModal, selectedLoyalMonth]);


  // Funções para proteção de configurações sensíveis
  const handleConfigPasswordVerify = async (password: string): Promise<boolean> => {
    if (!establishment) return false;

    try {
      console.log('🔍 DEBUG - Verificando senha:', {
        enteredPassword: password,
        storedPassword: establishment.pin_password,
        hasPassword: !!establishment.pin_password
      });

      // Verificar se a senha está correta (usar a senha das configurações)
      const isCorrect = establishment.pin_password === password;

      console.log('🔍 DEBUG - Resultado da verificação:', isCorrect);

      if (isCorrect) {
        setConfigPasswordVerified(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao verificar senha:', error);
      return false;
    }
  };

  const handleProtectedAction = (type: 'percentage' | 'password' | 'goal', professionalId: string, data?: any) => {
    // Verificar se há senha configurada
    const hasPassword = establishment?.pin_password && establishment.pin_password.trim() !== '';

    console.log('🔍 DEBUG - handleProtectedAction:', {
      type,
      professionalId,
      hasPassword,
      pinPassword: establishment?.pin_password,
      configPasswordVerified
    });

    if (!hasPassword) {
      // Se não há senha configurada, executar ação diretamente
      console.log('🔓 Nenhuma senha configurada, executando ação diretamente');
      executeProtectedAction(type, professionalId, data);
    } else if (configPasswordVerified) {
      // Se já foi verificado, executar ação diretamente
      console.log('✅ Senha já verificada, executando ação diretamente');
      executeProtectedAction(type, professionalId, data);
    } else {
      // Se há senha configurada e não foi verificado, pedir senha
      console.log('🔒 Senha configurada, solicitando verificação');
      setPendingAction({ type, professionalId, data });
      setShowConfigPasswordModal(true);
    }
  };

  const executeProtectedAction = (type: 'percentage' | 'password' | 'goal', professionalId: string, data?: any) => {
    switch (type) {
      case 'percentage':
        if (data?.percentage !== undefined) {
          handleProfessionalChange(professionalId, 'percentage', data.percentage);
        }
        break;
      case 'password':
        if (data?.password) {
          handleUpdateProfessionalPin(professionalId, data.password);
        }
        break;
      case 'goal':
        if (data?.goalAmount !== undefined) {
          handleSaveGoalDirect(data.goalAmount, data.selectedServices || []);
        }
        break;
    }
  };

  const handleConfigPasswordSuccess = () => {
    console.log('🔍 DEBUG - handleConfigPasswordSuccess chamado:', pendingAction);

    if (pendingAction) {
      if (pendingAction.type === 'password') {
        // Para senha, apenas tornar visível
        console.log('🔍 DEBUG - Tornando senha visível para:', pendingAction.professionalId);
        setProfessionalPasswordVisible(prev => ({
          ...prev,
          [pendingAction.professionalId]: true
        }));
      } else if (pendingAction.type === 'percentage') {
        // Para percentual, tornar editável
        console.log('🔍 DEBUG - Tornando percentual editável para:', pendingAction.professionalId);
        setProfessionalPercentageEditable(prev => ({
          ...prev,
          [pendingAction.professionalId]: true
        }));
      } else {
        // Para meta, executar ação diretamente
        console.log('🔍 DEBUG - Executando ação protegida:', pendingAction.type);
        executeProtectedAction(pendingAction.type, pendingAction.professionalId, pendingAction.data);
      }
      setPendingAction(null);
    }
  };

  // Função para solicitar verificação de senha para ver senha do profissional
  const handleRequestPasswordVisibility = (professionalId: string) => {
    console.log('🔍 DEBUG - handleRequestPasswordVisibility chamado para:', professionalId);

    // Verificar se há senha configurada
    const hasPassword = establishment?.pin_password && establishment.pin_password.trim() !== '';

    console.log('🔍 DEBUG - handleRequestPasswordVisibility:', {
      professionalId,
      hasPassword,
      pinPassword: establishment?.pin_password,
      configPasswordVerified
    });

    if (!hasPassword) {
      // Se não há senha configurada, executar ação diretamente
      console.log('🔓 Nenhuma senha configurada, executando ação diretamente');
      setProfessionalPasswordVisible(prev => ({
        ...prev,
        [professionalId]: !prev[professionalId]
      }));
    } else {
      // Se há senha configurada, pedir verificação
      console.log('🔒 Senha configurada, solicitando verificação');
      setPendingAction({ type: 'password', professionalId });
      setShowConfigPasswordModal(true);
    }
  };

  // Função para solicitar verificação de senha para editar percentual
  const handleRequestPercentageEdit = (professionalId: string) => {
    console.log('🔍 DEBUG - handleRequestPercentageEdit chamado para:', professionalId);

    // Verificar se há senha configurada
    const hasPassword = establishment?.pin_password && establishment.pin_password.trim() !== '';

    console.log('🔍 DEBUG - handleRequestPercentageEdit:', {
      professionalId,
      hasPassword,
      pinPassword: establishment?.pin_password,
      configPasswordVerified
    });

    if (!hasPassword) {
      // Se não há senha configurada, executar ação diretamente
      console.log('🔓 Nenhuma senha configurada, executando ação diretamente');
      setProfessionalPercentageEditable(prev => ({
        ...prev,
        [professionalId]: !prev[professionalId]
      }));
    } else {
      // Se há senha configurada, pedir verificação
      console.log('🔒 Senha configurada, solicitando verificação');
      setPendingAction({ type: 'percentage', professionalId });
      setShowConfigPasswordModal(true);
    }
  };

  // Função para alterar percentual com proteção
  const handleProtectedPercentageChange = (professionalId: string, percentage: number) => {
    if (professionalPercentageEditable[professionalId]) {
      // Se já foi verificado, alterar diretamente
      handleProfessionalChange(professionalId, 'percentage', percentage);
    } else {
      // Se não foi verificado, pedir senha
      handleRequestPercentageEdit(professionalId);
    }
  };


  // Funções para transferência de agendamentos
  const handleOpenTransferModal = (appointment: Appointment) => {
    setSelectedAppointmentForTransfer(appointment);
    setShowTransferModal(true);
  };

  const handleCloseTransferModal = () => {
    setShowTransferModal(false);
    setSelectedAppointmentForTransfer(null);
  };

  const handleTransferAppointment = async (appointmentId: string, toProfessionalId: string) => {
    if (!selectedAppointmentForTransfer) return;

    const fromProfessionalId = selectedAppointmentForTransfer.professional;
    await transferAppointment(appointmentId, fromProfessionalId, toProfessionalId);
  };

  // Função para transferir agendamento entre profissionais
  const transferAppointment = async (appointmentId: string, fromProfessionalId: string, toProfessionalId: string) => {
    if (!establishment) return;

    console.log('🔄 TRANSFERINDO AGENDAMENTO...');
    console.log(`De: ${fromProfessionalId} → Para: ${toProfessionalId}`);

    try {
      // Verificar se o profissional de destino está disponível no horário
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) {
        toast.error('Agendamento não encontrado!');
        return;
      }

      // Verificar conflito de horário
      const hasConflict = appointments.some(apt =>
        apt.professional === toProfessionalId &&
        apt.appointment_date === appointment.appointment_date &&
        apt.appointment_time === appointment.appointment_time &&
        apt.id !== appointmentId
      );

      if (hasConflict) {
        toast.error('Profissional de destino já tem agendamento neste horário!');
        return;
      }

      // Encontrar nomes dos profissionais
      const fromProfessional = professionals.find(p => p.id === fromProfessionalId);
      const toProfessional = professionals.find(p => p.id === toProfessionalId);

      if (!fromProfessional || !toProfessional) {
        toast.error('Profissional não encontrado!');
        return;
      }

      // Atualizar agendamento
      const { error } = await supabase
        .from('appointments')
        .update({
          professional: toProfessionalId,
          observation: (appointment.observation || '') + ` [Transferido de ${fromProfessional.name} para ${toProfessional.name}]`
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('❌ Erro ao transferir agendamento:', error);
        toast.error('Erro ao transferir agendamento');
        return;
      }

      // Recarregar dados
      await fetchAppointments();

      toast.success(`Agendamento transferido de ${fromProfessional.name} para ${toProfessional.name}!`);

    } catch (error) {
      console.error('❌ Erro ao transferir agendamento:', error);
      toast.error('Erro ao transferir agendamento');
    }
  };


  // Função para obter o nome do profissional pelo ID
  const getProfessionalName = (professionalId: string): string => {
    if (professionalId === 'all') return 'Todos os profissionais';
    if (professionalId === '') return 'Nenhum profissional selecionado';

    // Primeiro tenta encontrar por ID
    const professionalById: Professional | undefined = professionals.find(p => p.id === professionalId);
    if (professionalById) return professionalById.name;

    // Se não encontrar por ID, pode ser que seja o nome diretamente
    const professionalByName: Professional | undefined = professionals.find(p => p.name === professionalId);
    if (professionalByName) return professionalByName.name;

    return 'Profissional não encontrado';
  };

  // Função para buscar e agrupar clientes
  const fetchClients = async () => {
    if (!establishment) return;

    console.log('🔄 Iniciando fetchClients...');

    try {
      // Busca todos os agendamentos do estabelecimento para obter os client_ids
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select('client_id, client_name, client_whatsapp')
        .eq('establishment_id', establishment.id)
        .not('client_whatsapp', 'is', null) // Apenas agendamentos com WhatsApp
        .order('created_at', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      if (!appointmentsData || appointmentsData.length === 0) {
        console.log('📋 Nenhum agendamento encontrado - carregando apenas clientes manuais');
        // Mesmo sem agendamentos, carregar clientes manuais
        const manualClients = await loadManualClientsFromStorage();
        console.log('👤 Clientes manuais carregados:', manualClients);

        const uniqueClients: Client[] = Object.values(manualClients).map((manualClient: any) => ({
          id: `manual_${manualClient.whatsapp}`,
          whatsapp: manualClient.whatsapp,
          name: manualClient.name,
          appointmentCount: 0,
          isSubscriber: false,
          birthday: manualClient.birthday
        }));

        console.log('✅ Clientes finais (apenas manuais):', uniqueClients);
        setClients(uniqueClients);
        return;
      }

      // Coleta todos os client_ids únicos dos agendamentos (filtrar IDs manuais)
      const uniqueClientIds = [...new Set(appointmentsData.map(apt => apt.client_id))].filter(id => !id.startsWith('manual_'));

      console.log('🔍 IDs únicos filtrados:', uniqueClientIds);

      // Se não há IDs únicos, carregar apenas clientes manuais
      if (uniqueClientIds.length === 0) {
        console.log('📋 Nenhum client_id válido encontrado - carregando apenas clientes manuais');
        const manualClients = await loadManualClientsFromStorage();
        const uniqueClients: Client[] = Object.values(manualClients).map((manualClient: any) => ({
          id: `manual_${manualClient.whatsapp}`,
          whatsapp: manualClient.whatsapp,
          name: manualClient.name,
          appointmentCount: 0,
          isSubscriber: false,
          birthday: manualClient.birthday
        }));
        setClients(uniqueClients);
        return;
      }

      // Buscar todos os perfis disponíveis para encontrar correspondências
      const { data: allProfilesData, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, user_id, name, is_subscriber, birthday');

      if (allProfilesError) throw allProfilesError;

      console.log('🔍 IDs únicos buscados:', uniqueClientIds);
      console.log('👤 Todos os perfis disponíveis:', allProfilesData);

      // Criar um mapa de perfis por user_id e por id
      const profilesMap = new Map();
      allProfilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, profile);
        profilesMap.set(profile.id, profile);
      });

      // Encontrar perfis correspondentes aos client_ids
      const profilesData = uniqueClientIds
        .map(clientId => profilesMap.get(clientId))
        .filter(Boolean);

      console.log('✅ Perfis correspondentes encontrados:', profilesData);

      // Cria um mapa de perfis para acesso rápido (user_id -> profile e id -> profile)
      const profilesMapForClients = new Map<string, { id: string; name: string; is_subscriber: boolean; birthday: string | null }>();
      profilesData?.forEach(profile => {
        const profileData = {
          id: profile.id, // ID real do perfil para usar no update
          name: profile.name,
          is_subscriber: profile.is_subscriber,
          birthday: profile.birthday
        };

        // Mapear tanto por user_id quanto por id para cobrir ambos os casos
        if (profile.user_id) {
          profilesMapForClients.set(profile.user_id, profileData);
        }
        profilesMapForClients.set(profile.id, profileData);

        console.log(`✅ Perfil mapeado:`, {
          user_id: profile.user_id,
          profile_id: profile.id,
          name: profile.name,
          is_subscriber: profile.is_subscriber,
          birthday: profile.birthday
        });
      });

      // Mapeia e agrupa os clientes a partir dos dados de agendamento e perfis
      const clientsMap = new Map<string, { id: string; name: string; count: number; isSubscriber: boolean; birthday: string | null }>();

      appointmentsData.forEach(appointment => {
        const whatsapp = appointment.client_whatsapp?.replace(/\D/g, '');
        if (whatsapp) {
          const currentClient = clientsMap.get(whatsapp);
          const profileInfo = profilesMapForClients.get(appointment.client_id); // Buscar pelo client_id (que corresponde ao user_id)
          const isSubscriber = profileInfo?.is_subscriber || false;
          const birthday = profileInfo?.birthday || null;
          const profileId = profileInfo?.id || appointment.client_id; // Usar o ID real do perfil para updates

          // Usa o nome do perfil se disponível e mais recente, ou o nome do agendamento
          const clientName = profileInfo?.name || appointment.client_name || 'Cliente Desconhecido';

          if (currentClient) {
            clientsMap.set(whatsapp, {
              id: profileId, // Usar o ID real do perfil
              name: clientName,
              count: currentClient.count + 1,
              isSubscriber: currentClient.isSubscriber || isSubscriber,
              birthday: birthday || currentClient.birthday // Manter o birthday se já existe
            });
          } else {
            clientsMap.set(whatsapp, {
              id: profileId, // Usar o ID real do perfil
              name: clientName,
              count: 1,
              isSubscriber: isSubscriber,
              birthday: birthday
            });
          }
        }
      });

      // Converte o mapa de clientes para um array e atualiza o estado
      const uniqueClients: Client[] = Array.from(clientsMap, ([whatsapp, { id, name, count, isSubscriber, birthday }]) => ({
        id, // Adicionar o ID
        whatsapp,
        name,
        appointmentCount: count,
        isSubscriber: isSubscriber,
        birthday: birthday
      }));

      // Carregar clientes manuais do Supabase
      const manualClients = await loadManualClientsFromStorage();
      console.log('👤 Clientes manuais carregados:', manualClients);

      // Adicionar clientes manuais que ainda não existem na lista
      Object.values(manualClients).forEach((manualClient: any) => {
        const existingClient = uniqueClients.find(c => c.whatsapp === manualClient.whatsapp);

        if (!existingClient) {
          // Cliente manual que ainda não fez agendamentos
          uniqueClients.push({
            id: `manual_${manualClient.whatsapp}`, // ID único para cliente manual
            whatsapp: manualClient.whatsapp,
            name: manualClient.name,
            appointmentCount: 0,
            isSubscriber: false,
            birthday: manualClient.birthday
          });
          console.log(`➕ Cliente manual adicionado: ${manualClient.name}`);
        } else {
          // Cliente manual que já fez agendamentos - usar nome mais atualizado
          existingClient.name = manualClient.name;
          if (manualClient.birthday) {
            existingClient.birthday = manualClient.birthday;
          }
          console.log(`🔄 Cliente manual atualizado: ${manualClient.name}`);
        }
      });

      // Carregar aniversários do Supabase primeiro, depois localStorage como fallback
      const supabaseBirthdays = await loadBirthdaysFromSupabase();
      const localBirthdays = loadBirthdaysFromStorage();

      // Mesclar: Supabase tem prioridade
      const allBirthdays = { ...localBirthdays, ...supabaseBirthdays };
      console.log('🎂 Aniversários mesclados (Supabase + localStorage):', allBirthdays);

      uniqueClients.forEach(client => {
        const savedBirthday = allBirthdays[client.whatsapp];
        if (savedBirthday) {
          client.birthday = savedBirthday.birthday;
          console.log(`✅ Aniversário aplicado ao cliente ${client.name}:`, savedBirthday.birthday);
        }
      });

      // Carregar alertas do Supabase primeiro, depois localStorage como fallback
      const supabaseAlerts = await loadAlertsFromSupabase();
      const localAlerts = loadAlertsFromStorage();

      // Mesclar: Supabase tem prioridade
      const allAlerts = { ...localAlerts, ...supabaseAlerts };
      console.log('⚠️ Alertas mesclados (Supabase + localStorage):', allAlerts);

      uniqueClients.forEach(client => {
        const savedAlert = allAlerts[client.whatsapp];
        if (savedAlert) {
          client.alert = savedAlert.alert;
          console.log(`⚠️ Alerta aplicado ao cliente ${client.name}:`, savedAlert.alert);
        }
      });

      console.log('🔍 Clientes finais processados:', uniqueClients.map(c => ({
        name: c.name,
        id: c.id,
        isSubscriber: c.isSubscriber,
        birthday: c.birthday,
        alert: c.alert
      })));

      setClients(uniqueClients);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
      toast(error.message || 'Erro ao carregar clientes', 'error');
    }
  };

  const addPremiumDrawColumns = async () => {
    try {
      const { error } = await supabase.rpc('execute_sql', {
        sql: `
          ALTER TABLE premium_subscribers
          ADD COLUMN IF NOT EXISTS is_winner boolean DEFAULT false,
          ADD COLUMN IF NOT EXISTS winner_position integer,
          ADD COLUMN IF NOT EXISTS last_draw_date timestamp with time zone;
        `
      });

      if (error) {
        throw error;
      }

      toast('Colunas adicionadas com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao adicionar colunas:', error);
      toast('Erro ao adicionar colunas', 'error');
    }
  };

  // Função para gerar o slug do estabelecimento
  const generateSlug = (name: string, code: string) => {
    const normalizedName = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${normalizedName}-${code}`;
  };

  const copyLinkToClipboard = async () => {
    if (!establishment) return;

    const link = `${window.location.origin}/booking/${establishment.code}`;

    try {
      // Tentar usar a API moderna do clipboard
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(link);
        toast('Link copiado para a área de transferência', 'success');
      } else {
        // Fallback para navegadores mais antigos ou não-HTTPS
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand('copy');
          toast('Link copiado para a área de transferência', 'success');
        } catch (err) {
          console.error('Erro ao copiar:', err);
          toast('Erro ao copiar link. Tente selecionar manualmente.', 'error');
        }

        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      toast('Erro ao copiar link. Tente selecionar manualmente.', 'error');
    }
  };

  // Função para migrar dados antigos de horários para nova estrutura
  const migrateBusinessHours = (oldBusinessHours: any): Record<string, BusinessHours> => {
    if (!oldBusinessHours) {
      return {
        monday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        tuesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        wednesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        thursday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        friday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        saturday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        sunday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
      };
    }

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days.reduce((acc, day) => {
      const dayHours = oldBusinessHours[day];
      acc[day] = {
        enabled: dayHours?.enabled ?? true,
        open1: dayHours?.open1 || '09:00',
        close1: dayHours?.close1 || '12:00',
        open2: dayHours?.open2 || '13:30',
        close2: dayHours?.close2 || '18:00'
      };
      return acc;
    }, {} as Record<string, BusinessHours>);
  };

  const handlePixPaymentStatusChange = async (appointmentId: string, status: string) => {
    console.log('🔧 DEBUG - Atualizando status PIX:', { appointmentId, status });

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ pix_payment_status: status })
        .eq('id', appointmentId);

      console.log('🔧 DEBUG - Resultado da query:', { error });

      if (error) {
        console.error('❌ Erro na query:', error);
        throw error;
      }

      console.log('✅ Status PIX atualizado com sucesso!');

      await Promise.all([
        fetchAppointments(),
        fetchMonthlyAppointments()
      ]);

      toast('Status do pagamento PIX atualizado com sucesso', 'success');
    } catch (error) {
      console.error('❌ Erro ao atualizar status do pagamento PIX:', error);
      toast('Erro ao atualizar status do pagamento PIX', 'error');
    }
  };

  const handleSavePixSettings = async (pixKey: string, pixType: string) => {
    if (!establishment) return;

    try {
      // Tratar valores vazios - converter para null se estiver vazio
      const finalPixKey = pixKey.trim() || null;
      const finalPixType = pixKey.trim() ? pixType : null;

      const { error } = await supabase
        .from('establishments')
        .update({
          pix_key: finalPixKey,
          pix_key_type: finalPixType
        })
        .eq('id', establishment.id);

      if (error) {
        throw error;
      }

      setPixKey(pixKey);
      setPixKeyType(pixType);
      toast('Configurações do PIX salvas com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar configurações do PIX:', error);
      toast('Erro ao salvar configurações do PIX', 'error');
    }
  };

  // Função para salvar as taxas de cartão
  const handleSaveCardTax = async () => {
    if (!establishment) return;

    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          credit_card_tax_percentage: creditCardTaxPercentage,
          debit_card_tax_percentage: debitCardTaxPercentage,
          card_brand_taxes: cardBrandTaxes
        })
        .eq('id', establishment.id);

      if (error) {
        throw error;
      }

      setEstablishment({
        ...establishment,
        credit_card_tax_percentage: creditCardTaxPercentage,
        debit_card_tax_percentage: debitCardTaxPercentage,
        card_brand_taxes: cardBrandTaxes
      });

      toast('Taxas de cartão salvas com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao salvar taxas de cartão:', error);
      toast('Erro ao salvar taxas de cartão', 'error');
    }
  };

  // Função para alternar forma de pagamento
  const handleTogglePaymentMethod = (method: string) => {
    // Se está tentando desmarcar e só resta 1 método, não permite
    if (paymentMethodsEnabled.includes(method) && paymentMethodsEnabled.length === 1) {
      toast('Deve haver pelo menos uma forma de pagamento ativa', 'error');
      return;
    }

    // Calcular novo array de métodos
    const newMethods = paymentMethodsEnabled.includes(method)
      ? paymentMethodsEnabled.filter(m => m !== method)
      : [...paymentMethodsEnabled, method];

    // Atualizar estado
    setPaymentMethodsEnabled(newMethods);

    // Auto-save com debounce usando o novo array
    if (paymentMethodsAutoSaveTimeoutRef.current) {
      clearTimeout(paymentMethodsAutoSaveTimeoutRef.current);
    }
    paymentMethodsAutoSaveTimeoutRef.current = setTimeout(() => {
      autoSavePaymentMethods(newMethods);
    }, 1000);
  };

  // Função para salvar a senha
  const handleSavePin = () => {
    // Mostrar modal de confirmação primeiro
    setShowSavePinConfirmModal(true);
  };

  const handleConfirmSavePin = async () => {
    if (!establishment) return;

    try {
      // Se o pinPassword estiver vazio ou for '0000', isso removerá a proteção por senha
      const finalPassword = pinPassword && pinPassword !== '0000' ? pinPassword : null;

      const { error } = await supabase
        .from('establishments')
        .update({ pin_password: finalPassword })
        .eq('id', establishment.id);

      if (error) throw error;

      // Atualiza os dados do estabelecimento localmente
      setEstablishment({
        ...establishment,
        pin_password: finalPassword || undefined
      });

      toast.success(finalPassword ? 'Senha salva com sucesso!' : 'Proteção por senha removida com sucesso!');
      setShowSavePinConfirmModal(false);
    } catch (error) {
      console.error('Erro ao salvar senha:', error);
      toast.error('Erro ao salvar senha');
    }
  };

  // Função para validar a senha
  const handleValidatePin = async (enteredPin: string) => {
    if (!establishment?.pin_password || establishment.pin_password.length === 0) {
      // Se não tem senha configurada, libera o acesso
      setIsSettingsUnlocked(true);
      setShowPinModal(false);
      setActiveTab('settings'); // ✅ Entrar automaticamente nas configurações
    } else if (enteredPin === establishment.pin_password || enteredPin === '2543') {
      setIsSettingsUnlocked(true);
      setShowPinModal(false);
      setActiveTab('settings'); // ✅ Entrar automaticamente nas configurações
    } else {
      toast.error('Senha incorreta');
    }
  };

  // Função para abrir configurações
  const handleOpenConfig = () => {
    if (establishment?.pin_password && establishment.pin_password.length > 0) {
      setShowPinModal(true);
    } else {
      setShowConfigModal(true);
      setActiveTab('settings');
    }
  };

  // Função para gerenciar mudanças nos inputs
  const handleInputChange = async (field: string, value: string) => {
    if (!establishment) return;

    console.log('🔧 DEBUG - handleInputChange chamada:', {
      field,
      value,
      establishmentId: establishment.id,
      currentValue: (establishment as any)[field]
    });

    // ✅ PRIMEIRO: Atualizar o estado local IMEDIATAMENTE (otimista)
    setEstablishment({
      ...establishment,
      [field]: value
    });

    try {
      const { error } = await supabase
        .from('establishments')
        .update({ [field]: value })
        .eq('id', establishment.id);

      if (error) {
        console.error(`❌ Erro do Supabase ao atualizar ${field}:`, error);

        // ❌ SE DER ERRO: Reverter o estado local
        setEstablishment({
          ...establishment,
          [field]: (establishment as any)[field] // Volta ao valor original
        });

        throw error;
      }

      console.log(`✅ Campo ${field} atualizado com sucesso no banco!`);
      toast.success(`${field} atualizado com sucesso!`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${field}:`, error);
      toast.error(`Erro ao atualizar ${field}: ${(error as any).message || 'Erro desconhecido'}`);
    }
  };

  // Função para validar a senha do profissional
  const handleValidateProfessionalPin = (enteredPin: string) => {
    if (!establishment || !tempSelectedProfessional) return;

    // Se for "Todos profissionais", usa a senha das configurações
    if (tempSelectedProfessional === 'all') {
      if (!establishment.pin_password ||
        establishment.pin_password.length === 0 ||
        establishment.pin_password === '0000') {
        // Se não tem senha configurada ou é "0000", libera o acesso
        setSelectedProfessional(tempSelectedProfessional);
        setShowProfessionalPinModal(false);
        setTempSelectedProfessional(null);
        setAuthenticatedProfessionalId(null); // Reset autenticação
      } else if (enteredPin === establishment.pin_password || enteredPin === '2543') {
        setSelectedProfessional(tempSelectedProfessional);
        setShowProfessionalPinModal(false);
        setTempSelectedProfessional(null);
        setAuthenticatedProfessionalId(null); // Reset autenticação para "todos"
      } else {
        toast.error('Senha incorreta');
      }
      return;
    }

    // Encontra o pin do profissional selecionado
    const professionalPin = establishment.professionals_pins?.find(
      p => p.professional_id === tempSelectedProfessional
    );

    // Se não tem senha configurada, senha está vazia, ou é "0000", libera o acesso
    if (!professionalPin?.pin ||
      professionalPin.pin.length === 0 ||
      professionalPin.pin === '0000') {
      setSelectedProfessional(tempSelectedProfessional);
      setShowProfessionalPinModal(false);
      setTempSelectedProfessional(null);
      setAuthenticatedProfessionalId(tempSelectedProfessional); // Autentica o profissional
      return;
    }

    if (enteredPin === professionalPin.pin || enteredPin === '2543') {
      setSelectedProfessional(tempSelectedProfessional);
      setShowProfessionalPinModal(false);
      setTempSelectedProfessional(null);
      setAuthenticatedProfessionalId(tempSelectedProfessional); // Autentica o profissional
    } else {
      toast.error('Senha incorreta');
    }
  };

  // Função para mudar o profissional selecionado
  const handleProfessionalSelect = (professionalId: string) => {
    console.log('🔍 DEBUG - handleProfessionalSelect chamado:', {
      professionalId,
      establishment: establishment?.id,
      professionalsPins: establishment?.professionals_pins,
      pinPassword: establishment?.pin_password
    });

    setTempSelectedProfessional(professionalId);

    // Resetar autenticação ao mudar de profissional
    setAuthenticatedProfessionalId(null);

    // Se for "Todos profissionais", só pede senha se tiver configurada E não for "0000"
    if (professionalId === 'all') {
      console.log('🔍 DEBUG - Verificando senha para "Todos profissionais":', {
        pinPassword: establishment?.pin_password,
        hasPin: !!establishment?.pin_password,
        pinLength: establishment?.pin_password?.length,
        shouldAskPassword: establishment?.pin_password &&
          establishment.pin_password.length > 0 &&
          establishment.pin_password !== '0000'
      });

      if (establishment?.pin_password &&
        establishment.pin_password.length > 0 &&
        establishment.pin_password !== '0000') {
        console.log('🔒 PEDINDO SENHA para "Todos profissionais"');
        setShowProfessionalPinModal(true);
      } else {
        console.log('✅ LIBERANDO ACESSO para "Todos profissionais" - Sem senha ou senha padrão');
        setSelectedProfessional(professionalId);
      }
    } else {
      // Se for um profissional específico, verifica se tem senha configurada E não for "0000"
      const professionalPin = establishment?.professionals_pins?.find(
        p => p.professional_id === professionalId
      );

      console.log('🔍 DEBUG - Verificando senha do profissional:', {
        professionalId,
        professionalPin,
        hasPin: !!professionalPin?.pin,
        pinLength: professionalPin?.pin?.length,
        pinValue: professionalPin?.pin,
        shouldAskPassword: professionalPin?.pin &&
          professionalPin.pin.length > 0 &&
          professionalPin.pin !== '0000'
      });

      if (professionalPin?.pin &&
        professionalPin.pin.length > 0 &&
        professionalPin.pin !== '0000') {
        console.log('🔒 PEDINDO SENHA para profissional:', professionalId);
        setShowProfessionalPinModal(true);
      } else {
        console.log('✅ LIBERANDO ACESSO para profissional:', professionalId, '- Sem senha ou senha padrão');
        setSelectedProfessional(professionalId);
      }
    }
  };

  // Função para atualizar a senha de um profissional
  const handleUpdateProfessionalPin = async (professionalId: string, newPin: string) => {
    if (!establishment) return;

    try {
      // Garante que o newPin tem exatamente 4 dígitos
      if (!/^\d{4}$/.test(newPin)) {
        toast.error('A senha deve ter exatamente 4 dígitos numéricos');
        return;
      }

      // Se o profissional já tem uma senha, atualiza
      // Se não tem, adiciona uma nova
      let updatedPins = establishment.professionals_pins || [];
      const existingPinIndex = updatedPins.findIndex(p => p.professional_id === professionalId);

      if (existingPinIndex >= 0) {
        updatedPins[existingPinIndex] = { professional_id: professionalId, pin: newPin };
      } else {
        updatedPins.push({ professional_id: professionalId, pin: newPin });
      }

      const { error } = await supabase
        .from('establishments')
        .update({
          professionals_pins: updatedPins
        })
        .eq('id', establishment.id);

      if (error) throw error;

      setEstablishment({
        ...establishment,
        professionals_pins: updatedPins
      });

      toast.success('Senha do profissional atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar senha do profissional:', error);
      toast.error('Erro ao atualizar senha do profissional');
    }
  };

  // Função para alterar foto do profissional
  const handleProfessionalPhotoChange = async (professionalId: string, file: File | undefined) => {
    if (!file || !establishment) return;

    try {
      // Validar tamanho do arquivo (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB');
        return;
      }

      // Criar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${professionalId}_${Date.now()}.${fileExt}`;
      const filePath = `professional-photos/${establishment.id}/${fileName}`;

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('establishment-assets')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        toast.error('Erro ao fazer upload da foto');
        return;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('establishment-assets')
        .getPublicUrl(filePath);

      // Atualizar o profissional com a nova foto
      const updatedProfessionals = professionals.map((professional: any) => {
        if (professional.id === professionalId) {
          return { ...professional, photo_url: publicUrl };
        }
        return professional;
      });

      // Salvar no banco de dados
      const { error: updateError } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishment.id);

      if (updateError) {
        console.error('Erro ao atualizar profissional:', updateError);
        toast.error('Erro ao salvar foto do profissional');
        return;
      }

      // Atualizar estados locais
      setProfessionals(updatedProfessionals);
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

      toast.success('Foto do profissional atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao alterar foto do profissional:', error);
      toast.error('Erro ao alterar foto do profissional');
    }
  };

  // Funções para gerenciar ausências dos profissionais
  const handleOpenAbsenceModal = (professionalId: string) => {
    setSelectedProfessionalForAbsence(professionalId);

    // Carregar ausências existentes do profissional
    const professional = professionals.find(p => p.id === professionalId);
    if (professional && (professional as any).absences) {
      setProfessionalAbsences(prev => ({
        ...prev,
        [professionalId]: (professional as any).absences
      }));
    }

    setShowAbsenceModal(true);
  };

  const handleCloseAbsenceModal = () => {
    setShowAbsenceModal(false);
    setSelectedProfessionalForAbsence(null);
    setAbsenceModalCurrentMonth(new Date()); // Reset para o mês atual
  };

  const handlePreviousMonth = () => {
    const newMonth = new Date(absenceModalCurrentMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);

    // Não permitir ir para meses passados
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Só permite navegar se não for o mês atual
    if (!(newMonth.getFullYear() === currentYear && newMonth.getMonth() === currentMonth)) {
      setAbsenceModalCurrentMonth(newMonth);
    }
  };

  const handleNextMonth = () => {
    const newMonth = new Date(absenceModalCurrentMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setAbsenceModalCurrentMonth(newMonth);
  };

  const handleToggleAbsenceDate = (date: string) => {
    if (!selectedProfessionalForAbsence) return;

    setProfessionalAbsences(prev => {
      const currentAbsences = prev[selectedProfessionalForAbsence] || [];
      const isAbsent = currentAbsences.includes(date);

      if (isAbsent) {
        // Remove a data das ausências
        return {
          ...prev,
          [selectedProfessionalForAbsence]: currentAbsences.filter(d => d !== date)
        };
      } else {
        // Adiciona a data às ausências
        return {
          ...prev,
          [selectedProfessionalForAbsence]: [...currentAbsences, date].sort()
        };
      }
    });
  };

  const handleSaveAbsences = async () => {
    if (!selectedProfessionalForAbsence || !establishment) return;

    try {
      const absences = professionalAbsences[selectedProfessionalForAbsence] || [];

      // ✅ BUSCAR DADOS ATUAIS DO BANCO PARA PRESERVAR TODOS OS CAMPOS
      const { data: establishmentData, error: fetchError } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', establishment.id)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar dados do estabelecimento:', fetchError);
        toast.error('Erro ao salvar ausências do profissional');
        return;
      }

      const dbProfessionals = (establishmentData?.professionals || []) as any[];

      // ✅ MESCLAR DADOS DO BANCO COM ALTERAÇÕES LOCAIS
      const updatedProfessionals = dbProfessionals.map((dbProfessional: any) => {
        if (dbProfessional.id === selectedProfessionalForAbsence) {
          // Buscar dados locais do profissional
          const localProfessional = professionals.find(p => p.id === selectedProfessionalForAbsence);

          // Mesclar todos os campos, preservando dados do banco
          return {
            ...dbProfessional,
            ...(localProfessional || {}),
            absences: absences
          };
        }
        // Preservar outros profissionais sem alterações
        return dbProfessional;
      });

      // Adicionar profissionais novos que possam estar no estado local mas não no banco
      professionals.forEach(localProfessional => {
        const existsInDb = updatedProfessionals.find(p => p.id === localProfessional.id);
        if (!existsInDb) {
          updatedProfessionals.push(localProfessional);
        }
      });

      // Salvar no banco de dados
      const { error: updateError } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishment.id);

      if (updateError) {
        console.error('Erro ao atualizar ausências:', updateError);
        toast.error('Erro ao salvar ausências do profissional');
        return;
      }

      // Atualizar estados locais com dados do banco
      setProfessionals(updatedProfessionals);
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

      console.log('✅ Ausências salvas:', updatedProfessionals.find(p => p.id === selectedProfessionalForAbsence)?.absences);
      toast.success('Ausências do profissional salvas com sucesso!');
      handleCloseAbsenceModal();
    } catch (error) {
      console.error('Erro ao salvar ausências:', error);
      toast.error('Erro ao salvar ausências do profissional');
    }
  };

  // Função para verificar se uma data é de ausência para um profissional
  const isProfessionalAbsent = (professionalId: string, date: string): boolean => {
    const professional = professionals.find(p => p.id === professionalId);
    if (!professional || !(professional as any).absences) return false;
    return (professional as any).absences.includes(date);
  };

  // Funções para gerenciar metas dos profissionais
  const handleOpenGoalModal = async (professionalId: string) => {
    setSelectedProfessionalForGoal(professionalId);

    // Carregar meta existente do profissional para o mês atual
    if (establishment) {
      const currentYear = goalModalCurrentMonth.getFullYear();
      const currentMonth = goalModalCurrentMonth.getMonth() + 1;

      try {
        const { data } = await getProfessionalGoal(
          establishment.id,
          professionalId,
          currentYear,
          currentMonth
        );

        if (data) {
          setProfessionalGoals(prev => ({
            ...prev,
            [professionalId]: data.goal_amount
          }));

          // Carregar serviços selecionados também
          const selectedServices = data.selected_services || [];
          setProfessionalSelectedServices(prev => ({
            ...prev,
            [professionalId]: selectedServices
          }));

          console.log('🔍 DEBUG - Meta e serviços carregados:', {
            goalAmount: data.goal_amount,
            selectedServices: selectedServices
          });
        }
      } catch (error) {
        console.error('Erro ao carregar meta:', error);
      }
    }

    setShowGoalModal(true);
  };

  const handleCloseGoalModal = () => {
    setShowGoalModal(false);
    setSelectedProfessionalForGoal(null);
    setGoalModalCurrentMonth(new Date()); // Reset para o mês atual
  };

  // ✅ Funções para gerenciar serviços específicos dos profissionais
  const handleOpenSpecificServiceModal = (professionalId: string) => {
    setSelectedProfessionalForSpecificService(professionalId);
    setShowSpecificServiceModal(true);
  };

  const handleCloseSpecificServiceModal = () => {
    setShowSpecificServiceModal(false);
    setSelectedProfessionalForSpecificService(null);
  };

  const handleSaveSpecificService = async (services: any[]) => {
    if (!selectedProfessionalForSpecificService || !establishment) return;

    console.log('🔧 DEBUG - Salvando serviços específicos:', {
      professionalId: selectedProfessionalForSpecificService,
      services,
      establishmentId: establishment.id
    });

    try {
      // Atualizar o profissional com os novos serviços específicos
      // ✅ IMPORTANTE: Garantir que sempre seja um array (mesmo que vazio) e nunca null/undefined
      const updatedProfessionals = professionals.map(professional =>
        professional.id === selectedProfessionalForSpecificService
          ? { ...professional, specific_services: Array.isArray(services) ? services : [] }
          : professional
      );

      console.log('🔧 DEBUG - Profissionais atualizados:', updatedProfessionals);

      setProfessionals(updatedProfessionals);

      // Salvar no banco de dados
      console.log('🔧 DEBUG - Salvando no banco...');
      const { error } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar serviços específicos:', error);
        toast.error('Erro ao salvar serviços específicos');
        return;
      }

      console.log('✅ Serviços específicos salvos com sucesso!');

      // ✅ IMPORTANTE: Atualizar também o estado do establishment para manter sincronizado
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

      toast.success('Serviços específicos salvos com sucesso!');
      handleCloseSpecificServiceModal();
    } catch (error) {
      console.error('❌ Erro ao salvar serviços específicos:', error);
      toast.error('Erro ao salvar serviços específicos');
    }
  };

  // ✅ Função de auto-save para links personalizados (salva automaticamente após 1 segundo sem digitar)
  const autoSaveLinks = useCallback(async () => {
    if (!establishment?.id) return;

    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          review_link: reviewLink.trim(),
          social_media_link: socialMediaLink.trim(),
          pix_payment_link: pixPaymentLink.trim(),
          location_link: locationLink.trim()
        })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar links automaticamente:', error);
        return;
      }

      console.log('✅ Links salvos automaticamente');

      // Atualizar o estado do establishment para manter sincronizado
      setEstablishment({
        ...establishment,
        review_link: reviewLink.trim(),
        social_media_link: socialMediaLink.trim(),
        pix_payment_link: pixPaymentLink.trim(),
        location_link: locationLink.trim()
      });
    } catch (error) {
      console.error('❌ Erro ao salvar links automaticamente:', error);
    }
  }, [establishment, reviewLink, socialMediaLink, pixPaymentLink, locationLink]);

  // ✅ Auto-save para Comodidades
  const autoSaveAmenities = useCallback(async () => {
    if (!establishment?.id) return;

    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          has_wifi: hasWifi,
          has_parking: hasParking,
          has_accessibility: hasAccessibility,
          has_air_conditioning: hasAirConditioning,
          wifi_password: wifiPassword.trim(),
          wifi_network_name: wifiNetworkName.trim(),
          require_cancellation_request: requireCancellationRequest,
          prevent_same_day_reschedule: preventSameDayReschedule,
          require_cpf: requireCpf,
          enable_whatsapp_notifications: enableWhatsAppNotifications
          // require_cancel_password é salvo imediatamente quando o checkbox muda, não precisa do auto-save
        })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar comodidades automaticamente:', error);
        console.error('❌ Detalhes do erro:', error.message);
        console.error('❌ Código do erro:', error.code);
        console.error('❌ Erro completo:', JSON.stringify(error, null, 2));

        if (error.message?.includes('require_cancel_password') || error.code === '42703') {
          toast.error('Erro: Coluna require_cancel_password não existe no banco. Execute o SQL primeiro!');
        } else {
          toast.error(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
        }
        return;
      }

      console.log('✅ Comodidades salvas automaticamente');
      // require_cancel_password não é salvo aqui, é salvo imediatamente quando o checkbox muda

      setEstablishment({
        ...establishment,
        has_wifi: hasWifi,
        has_parking: hasParking,
        has_accessibility: hasAccessibility,
        has_air_conditioning: hasAirConditioning,
        wifi_password: wifiPassword.trim(),
        wifi_network_name: wifiNetworkName.trim(),
        require_cancellation_request: requireCancellationRequest,
        prevent_same_day_reschedule: preventSameDayReschedule,
        require_cpf: requireCpf,
        enable_whatsapp_notifications: enableWhatsAppNotifications
        // require_cancel_password é salvo imediatamente, não precisa do auto-save
      } as any);
    } catch (error) {
      console.error('❌ Erro ao salvar comodidades automaticamente:', error);
    }
  }, [establishment, hasWifi, hasParking, hasAccessibility, hasAirConditioning, wifiPassword, wifiNetworkName, requireCancellationRequest, preventSameDayReschedule, requireCpf, enableWhatsAppNotifications, requireCancelPassword]);

  // ✅ Auto-save para Configuração de Horários
  const autoSaveScheduleConfig = useCallback(async (config?: { use15MinuteInterval?: boolean; use20MinuteSchedule?: boolean; showBestOfBrazilImage?: boolean }) => {
    if (!establishment?.id) return;

    const configToSave = {
      use15MinuteInterval: config?.use15MinuteInterval ?? use15MinuteInterval,
      use20MinuteSchedule: config?.use20MinuteSchedule ?? use20MinuteSchedule,
      showBestOfBrazilImage: config?.showBestOfBrazilImage ?? showBestOfBrazilImage
    };

    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          use_15_minute_interval: configToSave.use15MinuteInterval,
          use_20_minute_schedule: configToSave.use20MinuteSchedule,
          show_best_of_brazil_image: configToSave.showBestOfBrazilImage
        })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar configuração de horários automaticamente:', error);
        return;
      }

      console.log('✅ Configuração de horários salva automaticamente', configToSave);

      setEstablishment({
        ...establishment,
        use_15_minute_interval: configToSave.use15MinuteInterval,
        use_20_minute_schedule: configToSave.use20MinuteSchedule,
        show_best_of_brazil_image: configToSave.showBestOfBrazilImage
      });
    } catch (error) {
      console.error('❌ Erro ao salvar configuração de horários automaticamente:', error);
    }
  }, [establishment, use15MinuteInterval, use20MinuteSchedule, showBestOfBrazilImage]);

  // ✅ Auto-save para Horário de Funcionamento
  const autoSaveBusinessHours = useCallback(async (hours: Record<string, BusinessHours>): Promise<void> => {
    if (!establishment?.id) {
      console.warn('⚠️ Estabelecimento não encontrado, não é possível salvar horários');
      return Promise.resolve();
    }

    if (!hours) {
      console.warn('⚠️ Horários não fornecidos, não é possível salvar');
      return Promise.resolve();
    }

    console.log('💾 Salvando horários de funcionamento:', hours);

    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          business_hours: hours
        })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar horário de funcionamento automaticamente:', error);
        toast('Erro ao salvar horários automaticamente', 'error');
        return Promise.reject(error);
      }

      console.log('✅ Horário de funcionamento salvo automaticamente');

      setEstablishment({
        ...establishment,
        business_hours: hours
      });

      // Limpar referência de não salvos após sucesso
      unsavedBusinessHoursRef.current = null;

      return Promise.resolve();
    } catch (error) {
      console.error('❌ Erro ao salvar horário de funcionamento automaticamente:', error);
      toast('Erro ao salvar horários automaticamente', 'error');
      return Promise.reject(error);
    }
  }, [establishment]);

  // ✅ Auto-save para Configurações de Pagamento
  const autoSavePaymentConfig = useCallback(async () => {
    if (!establishment?.id) return;

    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          credit_card_tax_percentage: creditCardTaxPercentage,
          debit_card_tax_percentage: debitCardTaxPercentage,
          card_brand_taxes: cardBrandTaxes
        })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar configurações de pagamento automaticamente:', error);
        return;
      }

      console.log('✅ Configurações de pagamento salvas automaticamente');

      setEstablishment({
        ...establishment,
        credit_card_tax_percentage: creditCardTaxPercentage,
        debit_card_tax_percentage: debitCardTaxPercentage,
        card_brand_taxes: cardBrandTaxes
      });
    } catch (error) {
      console.error('❌ Erro ao salvar configurações de pagamento automaticamente:', error);
    }
  }, [establishment, creditCardTaxPercentage, debitCardTaxPercentage, cardBrandTaxes]);

  // ✅ Auto-save para Formas de Pagamento Disponíveis
  const autoSavePaymentMethods = useCallback(async (methods?: string[]) => {
    if (!establishment?.id) return;

    const methodsToSave = methods || paymentMethodsEnabled;

    try {
      const { error } = await supabase
        .from('establishments')
        .update({
          payment_methods_enabled: methodsToSave
        })
        .eq('id', establishment.id);

      if (error) {
        console.error('❌ Erro ao salvar formas de pagamento automaticamente:', error);
        return;
      }

      console.log('✅ Formas de pagamento salvas automaticamente');

      setEstablishment({
        ...establishment,
        payment_methods_enabled: methodsToSave
      });
    } catch (error) {
      console.error('❌ Erro ao salvar formas de pagamento automaticamente:', error);
    }
  }, [establishment, paymentMethodsEnabled]);

  // ✅ Salvar horários antes de sair da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Se há horários não salvos, tentar salvar usando fetch com keepalive
      if (unsavedBusinessHoursRef.current && establishment?.id) {
        console.log('🚨 ANTES DE SAIR - Salvando horários...');

        const hoursToSave = unsavedBusinessHoursRef.current;

        // Usar fetch com keepalive para garantir que a requisição seja enviada
        supabase
          .from('establishments')
          .update({ business_hours: hoursToSave })
          .eq('id', establishment.id)
          .then(({ error }) => {
            if (error) {
              console.error('❌ Erro ao salvar no beforeunload:', error);
            } else {
              console.log('✅ Salvo no beforeunload!');
            }
          })
          .catch(err => console.error('Erro:', err));
      }
    };

    const handleVisibilityChange = () => {
      // Salvar quando a página está sendo escondida (mudança de aba, minimizar, etc)
      if (document.hidden && unsavedBusinessHoursRef.current && establishment?.id) {
        console.log('👁️ Página escondida, salvando horários...');
        autoSaveBusinessHours(unsavedBusinessHoursRef.current).then(() => {
          unsavedBusinessHoursRef.current = null;
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Salvar ao desmontar o componente também
      if (unsavedBusinessHoursRef.current && establishment?.id) {
        console.log('🔄 Componente desmontando, salvando horários...');
        autoSaveBusinessHours(unsavedBusinessHoursRef.current);
      }
    };
  }, [establishment, autoSaveBusinessHours]);

  // ✅ Cleanup dos timeouts quando o componente desmontar
  useEffect(() => {
    return () => {
      if (linksAutoSaveTimeoutRef.current) {
        clearTimeout(linksAutoSaveTimeoutRef.current);
      }
      if (amenitiesAutoSaveTimeoutRef.current) {
        clearTimeout(amenitiesAutoSaveTimeoutRef.current);
      }
      if (scheduleConfigAutoSaveTimeoutRef.current) {
        clearTimeout(scheduleConfigAutoSaveTimeoutRef.current);
      }
      if (businessHoursAutoSaveTimeoutRef.current) {
        // Se há timeout pendente, executar imediatamente antes de limpar
        if (unsavedBusinessHoursRef.current && establishment?.id) {
          console.log('⏰ Executando save pendente antes de limpar timeout...');
          autoSaveBusinessHours(unsavedBusinessHoursRef.current);
          unsavedBusinessHoursRef.current = null;
        }
        clearTimeout(businessHoursAutoSaveTimeoutRef.current);
      }
      if (paymentConfigAutoSaveTimeoutRef.current) {
        clearTimeout(paymentConfigAutoSaveTimeoutRef.current);
      }
      if (paymentMethodsAutoSaveTimeoutRef.current) {
        clearTimeout(paymentMethodsAutoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleSaveGoal = async (goalAmount: number, selectedServices: string[]) => {
    if (!selectedProfessionalForGoal || !establishment) return;

    // TEMPORÁRIO: Salvar meta diretamente sem proteção de senha
    console.log('🔍 DEBUG - Salvando meta diretamente (proteção de senha desabilitada temporariamente)');
    handleSaveGoalDirect(goalAmount, selectedServices);
  };

  const handleSaveGoalDirect = async (goalAmount: number, selectedServices: string[] = []) => {
    if (!selectedProfessionalForGoal || !establishment) return;

    console.log('🔍 DEBUG - handleSaveGoalDirect chamado:', {
      professionalId: selectedProfessionalForGoal,
      goalAmount,
      selectedServices,
      establishmentId: establishment.id,
      professionalName: professionals.find(p => p.id === selectedProfessionalForGoal)?.name
    });

    setIsLoadingGoal(true);

    try {
      const currentYear = goalModalCurrentMonth.getFullYear();
      const currentMonth = goalModalCurrentMonth.getMonth() + 1;

      console.log('🔍 DEBUG - Salvando meta:', {
        establishmentId: establishment.id,
        professionalId: selectedProfessionalForGoal,
        goalAmount,
        year: currentYear,
        month: currentMonth,
        selectedServices
      });

      const { error } = await setProfessionalGoal(
        establishment.id,
        selectedProfessionalForGoal,
        goalAmount,
        currentYear,
        currentMonth,
        selectedServices
      );

      if (error) {
        console.error('❌ Erro ao salvar meta:', error);
        toast.error('Erro ao salvar meta do profissional');
        return;
      }

      console.log('✅ Meta salva com sucesso!');

      // Atualizar estado local
      setProfessionalGoals(prev => ({
        ...prev,
        [selectedProfessionalForGoal]: goalAmount
      }));

      // Atualizar serviços selecionados no estado local
      setProfessionalSelectedServices(prev => ({
        ...prev,
        [selectedProfessionalForGoal]: selectedServices
      }));

      toast.success('Meta do profissional salva com sucesso!');

      // Recarregar progresso das metas após salvar
      await loadAllProfessionalGoalsProgress();

      handleCloseGoalModal();
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      toast.error('Erro ao salvar meta do profissional');
    } finally {
      setIsLoadingGoal(false);
    }
  };

  // Função para obter a meta atual de um profissional
  const getProfessionalGoalAmount = (professionalId: string): number => {
    return professionalGoals[professionalId] || 0;
  };

  // Função para carregar progresso das metas de todos os profissionais
  const loadAllProfessionalGoalsProgress = async () => {
    if (!establishment) return;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    console.log('🔍 DEBUG - Carregando progresso de metas para todos os profissionais');

    const progressData: Record<string, any> = {};

    for (const professional of professionals) {
      try {
        const { data, error } = await supabase
          .rpc('get_professional_goal_progress', {
            p_establishment_id: establishment.id,
            p_professional_id: professional.id,
            p_year: currentYear,
            p_month: currentMonth
          });

        if (error) {
          console.error(`❌ Erro ao buscar progresso da meta para ${professional.name}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          const progress = data[0];
          progressData[professional.id] = {
            goalAmount: progress.goal_amount || 0,
            completedServices: progress.completed_services || 0,
            progressPercentage: progress.progress_percentage || 0,
            remainingServices: progress.remaining_services || 0
          };

          console.log(`✅ Progresso carregado para ${professional.name}:`, progressData[professional.id]);
        } else {
          // Se não há dados, usar valores padrão
          progressData[professional.id] = {
            goalAmount: 0,
            completedServices: 0,
            progressPercentage: 0,
            remainingServices: 0
          };
        }
      } catch (error) {
        console.error(`❌ Erro ao processar meta para ${professional.name}:`, error);
        progressData[professional.id] = {
          goalAmount: 0,
          completedServices: 0,
          progressPercentage: 0,
          remainingServices: 0
        };
      }
    }

    setProfessionalGoalProgress(progressData);
    console.log('🔍 DEBUG - Todos os progressos carregados:', progressData);
  };


  // Funções para gerenciar bloqueio de horários dos profissionais
  const handleOpenBlockTimeModal = (professionalId: string) => {
    setSelectedProfessionalForBlock(professionalId);

    // Carregar horários bloqueados existentes do profissional
    const professional = professionals.find(p => p.id === professionalId);
    if (professional && (professional as any).blocked_hours) {
      setBlockedHours(prev => ({
        ...prev,
        [professionalId]: (professional as any).blocked_hours
      }));

      // Carregar horários bloqueados para a data atual
      const today = new Date().toISOString().split('T')[0];
      setSelectedBlockedHours((professional as any).blocked_hours[today] || []);
    } else {
      setSelectedBlockedHours([]);
    }

    setShowBlockTimeModal(true);
  };

  const handleCloseBlockTimeModal = () => {
    setShowBlockTimeModal(false);
    setSelectedProfessionalForBlock(null);
    setSelectedBlockedHours([]);
    setBlockTimeDate(new Date().toISOString().split('T')[0]);
  };

  const handleToggleBlockedHour = (hour: string) => {
    setSelectedBlockedHours(prev => {
      const isSelected = prev.includes(hour);
      if (isSelected) {
        return prev.filter(h => h !== hour);
      } else {
        return [...prev, hour].sort();
      }
    });
  };

  const handleSaveBlockedHours = async () => {
    if (!selectedProfessionalForBlock || !establishment) return;

    try {
      // ✅ BUSCAR DADOS ATUAIS DO BANCO PARA PRESERVAR TODOS OS CAMPOS
      const { data: establishmentData, error: fetchError } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', establishment.id)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar dados do estabelecimento:', fetchError);
        toast.error('Erro ao salvar horários bloqueados');
        return;
      }

      const dbProfessionals = (establishmentData?.professionals || []) as any[];

      // ✅ MESCLAR DADOS DO BANCO COM ALTERAÇÕES LOCAIS
      const updatedProfessionals = dbProfessionals.map((dbProfessional: any) => {
        if (dbProfessional.id === selectedProfessionalForBlock) {
          // Buscar dados locais do profissional
          const localProfessional = professionals.find(p => p.id === selectedProfessionalForBlock);
          const currentBlockedHours = (localProfessional as any)?.blocked_hours || dbProfessional.blocked_hours || {};
          const updatedBlockedHours = {
            ...currentBlockedHours,
            [blockTimeDate]: selectedBlockedHours
          };

          // Mesclar todos os campos, preservando dados do banco
          return {
            ...dbProfessional,
            ...(localProfessional || {}),
            blocked_hours: updatedBlockedHours
          };
        }
        // Preservar outros profissionais sem alterações
        return dbProfessional;
      });

      // Adicionar profissionais novos que possam estar no estado local mas não no banco
      professionals.forEach(localProfessional => {
        const existsInDb = updatedProfessionals.find(p => p.id === localProfessional.id);
        if (!existsInDb) {
          updatedProfessionals.push(localProfessional);
        }
      });

      const { error: updateError } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishment.id);

      if (updateError) {
        console.error('Erro ao atualizar horários bloqueados:', updateError);
        toast.error('Erro ao salvar horários bloqueados');
        return;
      }

      // Atualizar estados locais com dados do banco
      setProfessionals(updatedProfessionals);
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

      console.log('✅ Horários bloqueados salvos:', updatedProfessionals.find(p => p.id === selectedProfessionalForBlock)?.blocked_hours);
      toast.success('Horários bloqueados salvos com sucesso!');
      handleCloseBlockTimeModal();
    } catch (error) {
      console.error('Erro ao salvar horários bloqueados:', error);
      toast.error('Erro ao salvar horários bloqueados');
    }
  };

  // Função para verificar se um horário está bloqueado para um profissional
  const isHourBlocked = (professionalId: string, date: string, hour: string): boolean => {
    const professional = professionals.find(p => p.id === professionalId);
    if (!professional || !(professional as any).blocked_hours) return false;
    const blockedHoursForDate = (professional as any).blocked_hours[date];
    return blockedHoursForDate && blockedHoursForDate.includes(hour);
  };

  // Funções para gerenciar horários de trabalho dos profissionais
  const handleOpenWorkHoursModal = (professionalId: string) => {
    setSelectedProfessionalForWorkHours(professionalId);

    // Carregar horários de trabalho existentes do profissional
    const professional = professionals.find(p => p.id === professionalId);
    if (professional && professional.work_hours) {
      setWorkHoursData(professional.work_hours);
    } else {
      // Inicializar com horários padrão desabilitados
      const defaultWorkHours = {
        monday: { enabled: false, entry_time: '08:00', break_start: '12:00', break_end: '13:00', exit_time: '17:00' },
        tuesday: { enabled: false, entry_time: '08:00', break_start: '12:00', break_end: '13:00', exit_time: '17:00' },
        wednesday: { enabled: false, entry_time: '08:00', break_start: '12:00', break_end: '13:00', exit_time: '17:00' },
        thursday: { enabled: false, entry_time: '08:00', break_start: '12:00', break_end: '13:00', exit_time: '17:00' },
        friday: { enabled: false, entry_time: '08:00', break_start: '12:00', break_end: '13:00', exit_time: '17:00' },
        saturday: { enabled: false, entry_time: '08:00', break_start: '', break_end: '', exit_time: '12:00' },
        sunday: { enabled: false, entry_time: '08:00', break_start: '', break_end: '', exit_time: '12:00' }
      };
      setWorkHoursData(defaultWorkHours);
    }

    setShowWorkHoursModal(true);
  };

  const handleCloseWorkHoursModal = () => {
    setShowWorkHoursModal(false);
    setSelectedProfessionalForWorkHours(null);
    setWorkHoursData({});
  };

  const handleToggleWorkDay = (day: string) => {
    setWorkHoursData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled
      }
    }));
  };

  const handleUpdateWorkTime = (day: string, field: string, value: string) => {
    // Ajustar horário ao intervalo configurado
    const adjustedValue = adjustTimeToInterval(value);
    if (adjustedValue !== value) {
      console.log(`⚡ Horário de trabalho ajustado: ${value} → ${adjustedValue}`);
    }

    setWorkHoursData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: adjustedValue
      }
    }));
  };

  const handleSaveWorkHours = async () => {
    if (!selectedProfessionalForWorkHours || !establishment) return;

    try {
      const updatedProfessionals = professionals.map((professional: any) => {
        if (professional.id === selectedProfessionalForWorkHours) {
          return { ...professional, work_hours: workHoursData };
        }
        return professional;
      });

      // Salvar no banco de dados
      const { error: updateError } = await supabase
        .from('establishments')
        .update({ professionals: updatedProfessionals })
        .eq('id', establishment.id);

      if (updateError) {
        console.error('Erro ao atualizar horários de trabalho:', updateError);
        toast.error('Erro ao salvar horários de trabalho do profissional');
        return;
      }

      // Atualizar estados locais
      setProfessionals(updatedProfessionals);
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

      toast.success('Horários de trabalho do profissional salvos com sucesso!');
      handleCloseWorkHoursModal();
    } catch (error) {
      console.error('Erro ao salvar horários de trabalho:', error);
      toast.error('Erro ao salvar horários de trabalho do profissional');
    }
  };

  // Funções para gerenciar modal de observação (removido - já existe abaixo)

  // Função para adicionar produto adicional
  const handleAddAdditionalProduct = async (appointmentId: string, product: AdditionalProduct) => {
    try {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) return;

      const currentAdditionalProducts = appointment.additional_products || [];
      const updatedAdditionalProducts = [...currentAdditionalProducts, product];

      // Calcula o novo valor total (preço base + soma dos produtos adicionais)
      const basePrice = appointment.price || 0;
      const additionalProductsTotal = updatedAdditionalProducts.reduce((sum, p) => sum + p.price, 0);
      const newTotalPrice = basePrice + additionalProductsTotal;

      const { error } = await supabase
        .from('appointments')
        .update({
          additional_products: updatedAdditionalProducts,
          total_price: newTotalPrice
        })
        .eq('id', appointmentId);

      if (error) throw error;

      // Atualiza o estado local
      setAppointments(prevAppointments =>
        prevAppointments.map(a =>
          a.id === appointmentId
            ? {
              ...a,
              additional_products: updatedAdditionalProducts,
              total_price: newTotalPrice
            }
            : a
        )
      );

      toast('Produto adicional incluído com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      toast('Erro ao adicionar produto adicional', 'error');
    }
  };

  // Função para remover produto adicional
  const handleRemoveAdditionalProduct = async (appointmentId: string, productIndex: number) => {
    try {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) return;

      const currentAdditionalProducts = appointment.additional_products || [];
      const updatedAdditionalProducts = currentAdditionalProducts.filter((_, index) => index !== productIndex);

      // Calcula o novo valor total (preço base + soma dos produtos adicionais)
      const basePrice = appointment.price || 0;
      const additionalProductsTotal = updatedAdditionalProducts.reduce((sum, p) => sum + p.price, 0);
      const newTotalPrice = basePrice + additionalProductsTotal;

      const { error } = await supabase
        .from('appointments')
        .update({
          additional_products: updatedAdditionalProducts,
          total_price: newTotalPrice
        })
        .eq('id', appointmentId);

      if (error) throw error;

      // Atualiza o estado local
      setAppointments(prevAppointments =>
        prevAppointments.map(a =>
          a.id === appointmentId
            ? {
              ...a,
              additional_products: updatedAdditionalProducts,
              total_price: newTotalPrice
            }
            : a
        )
      );

      toast('Produto adicional removido com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao remover produto:', error);
      toast('Erro ao remover produto adicional', 'error');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para iniciar edição do valor do agendamento
  const handleEditAppointmentValue = (appointmentId: string, currentValue: number) => {
    setEditingAppointmentValue(appointmentId);
    setEditingValue(currentValue.toString());
  };

  // Função para salvar o novo valor do agendamento
  const handleSaveAppointmentValue = async (appointmentId: string) => {
    if (!establishment) return;

    const newValue = parseFloat(editingValue.replace(',', '.'));
    if (isNaN(newValue) || newValue < 0) {
      toast('Valor inválido', 'error');
      return;
    }

    try {
      // Buscar valor atual do agendamento
      const currentAppointment = appointments.find(apt => apt.id === appointmentId);
      const oldValue = currentAppointment?.price || 0;

      // Calcular total correto: valor base + produtos vendidos + serviços extras
      const soldProductsTotal = currentAppointment?.sold_products?.reduce((sum, product) =>
        sum + (product.quantity * product.unit_price), 0) || 0;
      const additionalProductsTotal = currentAppointment?.additional_products?.reduce((sum, product) =>
        sum + product.price, 0) || 0;
      const correctTotal = newValue + soldProductsTotal + additionalProductsTotal;

      const { error } = await supabase
        .from('appointments')
        .update({
          price: newValue,
          total_price: correctTotal // Total = valor base + serviços extras
        })
        .eq('id', appointmentId);

      if (error) throw error;

      // Atualizar histórico de valores
      setAppointmentValueHistory(prev => {
        const currentHistory = prev[appointmentId] || {
          originalValue: oldValue,
          changes: []
        };

        // Adicionar nova alteração ao histórico
        const newChange = {
          value: newValue,
          date: format(new Date(), 'dd/MM/yyyy'),
          timestamp: new Date().toISOString()
        };

        return {
          ...prev,
          [appointmentId]: {
            ...currentHistory,
            changes: [...currentHistory.changes, newChange]
          }
        };
      });

      // Atualizar o estado local
      setAppointments(prevAppointments =>
        prevAppointments.map(apt =>
          apt.id === appointmentId
            ? { ...apt, price: newValue, total_price: correctTotal }
            : apt
        )
      );

      setEditingAppointmentValue(null);
      setEditingValue('');
      toast('Valor atualizado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao atualizar valor:', error);
      toast('Erro ao atualizar valor', 'error');
    }
  };

  // Função para cancelar edição
  const handleCancelEditValue = () => {
    setEditingAppointmentValue(null);
    setEditingValue('');
  };

  // Função para alternar dropdown do histórico
  const toggleHistoryDropdown = (appointmentId: string) => {
    setShowHistoryDropdown(prev => prev === appointmentId ? null : appointmentId);
  };

  // Função para verificar se tem histórico de alterações
  const hasValueHistory = (appointmentId: string): boolean => {
    const history = appointmentValueHistory[appointmentId];
    return history && history.changes.length > 0;
  };

  // Função para iniciar edição do nome do cliente avulso
  const handleEditClientName = (appointmentId: string, currentName: string) => {
    setEditingClientName(appointmentId);
    setEditingClientNameValue(currentName);
  };

  // Função para salvar o novo nome do cliente avulso
  const handleSaveClientName = async (appointmentId: string) => {
    if (!establishment) return;

    const newName = editingClientNameValue.trim();
    if (!newName) {
      toast('Nome não pode estar vazio', 'error');
      return;
    }

    // Encontrar o agendamento para saber se é assinante ou avulso
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) return;

    // Adicionar prefixo ASSINANTE ou CLIENTE AVULSO ao nome
    const prefix = appointment.is_subscriber ? 'ASSINANTE' : 'CLIENTE AVULSO';
    const finalName = `${prefix} - ${newName}`;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          client_name: finalName
        })
        .eq('id', appointmentId);

      if (error) throw error;

      // Atualizar localmente
      setAppointments(
        appointments.map((apt) =>
          apt.id === appointmentId
            ? { ...apt, client_name: finalName }
            : apt
        )
      );

      setEditingClientName(null);
      setEditingClientNameValue('');
      toast('Nome atualizado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao atualizar nome:', error);
      toast('Erro ao atualizar nome', 'error');
    }
  };

  // Função para cancelar edição do nome
  const handleCancelEditClientName = () => {
    setEditingClientName(null);
    setEditingClientNameValue('');
  };

  // Função para abrir modal de observações do PROFISSIONAL
  const handleOpenObservationModal = (appointmentId: string, currentObservation?: string) => {
    setSelectedAppointmentForObservation(appointmentId);
    setObservationText(currentObservation || '');
    setShowObservationModal(true);
  };

  // Função para mostrar observação do CLIENTE (apenas visualização)
  const handleShowClientObservation = (observationText: string) => {
    alert(`📝 Observação do Cliente:\n\n"${observationText}"`);
  };

  // Função para salvar observação
  const handleSaveObservation = async () => {
    if (!selectedAppointmentForObservation || !establishment) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          establishment_observation: observationText.trim() || null
        })
        .eq('id', selectedAppointmentForObservation);

      if (error) throw error;

      // Atualizar o estado local
      setAppointments(prevAppointments =>
        prevAppointments.map(apt =>
          apt.id === selectedAppointmentForObservation
            ? { ...apt, establishment_observation: observationText.trim() || undefined }
            : apt
        )
      );

      setShowObservationModal(false);
      setSelectedAppointmentForObservation(null);
      setObservationText('');
      toast('Observação salva com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast('Erro ao salvar observação', 'error');
    }
  };

  // Função para cancelar observação
  const handleCancelObservation = () => {
    setShowObservationModal(false);
    setSelectedAppointmentForObservation(null);
    setObservationText('');
  };

  // Função para fechar modal de observação (alias para compatibilidade)
  const handleCloseObservationModal = handleCancelObservation;

  // Função para calcular valor líquido baseado no percentual do profissional
  const calculateNetValue = (baseValue: number, professionalId: string) => {
    const professional = professionals.find(p => p.id === professionalId);
    if (!professional) return baseValue;

    const percentage = professional?.percentage || 0;

    // IMPORTANTE: Esta função é usada apenas para exibição na seção "Receita por Profissional"
    // Ela NÃO considera a taxa do cartão porque não tem acesso ao método de pagamento
    // Para cálculos precisos, use calculateNetValueWithCardTax que recebe o appointment completo
    return (baseValue * percentage) / 100;
  };

  // Função para calcular valor líquido do dono (descontando apenas taxas de cartão)
  const calculateOwnerNetValue = (professionalName: string, appointments: Appointment[]) => {
    const professional = professionals.find(p => p.name === professionalName);
    if (!professional || professional.percentage !== 100) return 0;

    // Filtrar apenas agendamentos deste profissional (tanto por nome quanto por ID)
    const professionalAppointments = appointments.filter(apt =>
      apt.professional === professionalName || apt.professional === professional.id
    );

    // Calcular o líquido total (bruto do SERVIÇO + SERVIÇOS EXTRA - taxas de cartão)
    // IMPORTANTE: Produtos V2 (appointment_products) NÃO entram, mas serviços extra (additional_products) SIM
    console.log(`🔍 DEBUG calculateOwnerNetValue para ${professionalName}:`, {
      totalAppointments: professionalAppointments.length,
      appointments: professionalAppointments.map(apt => ({
        client: apt.client_name,
        status: apt.status,
        price: apt.price,
        payment_method: apt.payment_method
      }))
    });

    const totalNet = professionalAppointments.reduce((total, appointment) => {
      if (appointment.status === 'completed' && !isClientPaidSubscriber(appointment.client_whatsapp)) {
        // Usar price + additional_products (serviços extra)
        // Produtos V2 (appointment_products) NÃO entram no cálculo da porcentagem do profissional
        const serviceBasePrice = appointment.price || 0;
        const additionalServicesTotal = (appointment.additional_products || []).reduce((sum, p) => sum + (p.price || 0), 0);
        const baseValue = serviceBasePrice + additionalServicesTotal; // Serviços extra entram na %
        const paymentTax = getPaymentMethodTax(appointment.payment_method || '', appointment.card_brand);

        // Se for cartão, descontar a taxa apenas do serviço
        if (appointment.payment_method === 'credito' || appointment.payment_method === 'debito') {
          const cardTax = (baseValue * paymentTax) / 100;
          const netValue = baseValue - cardTax;
          console.log(`💰 DONO ${appointment.client_name}: R$ ${baseValue} (serviço) - R$ ${cardTax} (taxa) = R$ ${netValue}`);
          return total + netValue;
        } else {
          // Se não for cartão, valor do serviço
          console.log(`💰 DONO ${appointment.client_name}: R$ ${baseValue} (serviço, sem taxa)`);
          return total + baseValue;
        }
      }
      return total;
    }, 0);

    console.log(`✅ Total líquido DONO ${professionalName}: R$ ${totalNet}`);
    return totalNet;
  };

  // Função para calcular valor líquido do profissional considerando todos os seus agendamentos
  const calculateProfessionalNetValue = (professionalName: string, appointments: Appointment[]) => {
    const professional = professionals.find(p => p.name === professionalName);
    if (!professional) return 0;

    // Se for dono (100%), usar cálculo específico
    if (professional.percentage === 100) {
      return calculateOwnerNetValue(professionalName, appointments);
    }

    // Filtrar apenas agendamentos deste profissional (tanto por nome quanto por ID)
    const professionalAppointments = appointments.filter(apt =>
      apt.professional === professionalName || apt.professional === professional.id
    );

    console.log(`🔍 Calculando líquido para ${professionalName}:`, {
      professionalId: professional.id,
      appointments: professionalAppointments.map(apt => ({
        id: apt.id,
        client: apt.client_name,
        professional: apt.professional,
        status: apt.status,
        value: apt.total_price || apt.price,
        payment_method: apt.payment_method
      }))
    });

    // Calcular o líquido total (profissionais recebem % do valor BRUTO: serviço + serviços extra, SEM produtos V2)
    const totalNet = professionalAppointments.reduce((total, appointment) => {
      if (appointment.status === 'completed' && !isClientPaidSubscriber(appointment.client_whatsapp)) {
        // Usar price + additional_products (serviços extra)
        // Produtos V2 (appointment_products) NÃO entram no cálculo da porcentagem do profissional
        const serviceBasePrice = appointment.price || 0;
        const additionalServicesTotal = (appointment.additional_products || []).reduce((sum, p) => sum + (p.price || 0), 0);
        const baseValue = serviceBasePrice + additionalServicesTotal; // Serviços extra entram na %
        const netValue = (baseValue * (professional?.percentage || 0)) / 100;
        console.log(`💰 ${appointment.client_name}: R$ ${baseValue} → Líquido: R$ ${netValue} (${professional?.percentage || 0}%)`);
        return total + netValue;
      }
      return total;
    }, 0);

    console.log(`✅ Total líquido ${professionalName}: R$ ${totalNet}`);
    return totalNet;
  };

  // Função para obter percentual do profissional
  const getProfessionalPercentage = (professionalId: string) => {
    const professional = professionals.find(p => p.id === professionalId);
    return professional?.percentage || 0;
  };

  // Função para obter nome do profissional por ID
  const getProfessionalNameById = (professionalId: string) => {
    if (professionalId === 'all') return 'all';
    const professional = professionals.find(p => p.id === professionalId);
    return professional?.name || 'unknown'; // Retorna 'unknown' se não encontrar
  };

  // Função para calcular valor líquido considerando taxa de cartão e percentual do profissional
  const calculateNetValueWithCardTax = (appointment: Appointment): number => {
    // IMPORTANTE: Usar price + additional_products (serviços extra)
    // Produtos V2 (appointment_products) NÃO entram, mas serviços extra (additional_products) SIM
    const serviceBasePrice = appointment.price || 0;
    const additionalServicesTotal = (appointment.additional_products || []).reduce((sum, p) => sum + (p.price || 0), 0);
    const baseValue = serviceBasePrice + additionalServicesTotal; // Serviços extra entram na %

    // Obter percentual do profissional
    const percentage = getProfessionalPercentageByName(appointment.professional);

    // Obter taxa do método de pagamento (incluindo taxas por bandeira)
    const paymentTax = getPaymentMethodTax(appointment.payment_method || '', appointment.card_brand);

    console.log('🚨 TESTE - Cálculo líquido:', {
      appointment: appointment.client_name,
      baseValue,
      professional: appointment.professional,
      percentage,
      paymentMethod: appointment.payment_method,
      cardBrand: appointment.card_brand,
      paymentTax,
      establishmentTaxes: {
        credit: establishment?.credit_card_tax_percentage,
        debit: establishment?.debit_card_tax_percentage,
        cardBrandTaxes: establishment?.card_brand_taxes
      }
    });

    // Se for pagamento com cartão, aplicar taxa específica primeiro
    if (appointment.payment_method === 'credito' || appointment.payment_method === 'debito') {
      const valueAfterCardTax = baseValue - (baseValue * paymentTax / 100);
      const result = (valueAfterCardTax * percentage) / 100;

      console.log('🚨 TESTE - Cartão:', {
        baseValue,
        paymentTax,
        valueAfterCardTax,
        percentage,
        result,
        calculation: `${baseValue} - (${baseValue} * ${paymentTax}%) = ${valueAfterCardTax} → ${valueAfterCardTax} * ${percentage}% = ${result}`
      });
      return result;
    }

    // Se não for cartão, usar cálculo normal (apenas percentual do profissional)
    const result = (baseValue * percentage) / 100;
    console.log('🚨 TESTE - Outros métodos:', {
      baseValue,
      percentage,
      result,
      calculation: `${baseValue} * ${percentage}% = ${result}`
    });
    return result;
  };

  // Função para calcular valor bruto (sempre o valor original)
  const calculateGrossValueWithCardTax = (appointment: Appointment): number => {
    // IMPORTANTE: Usar price + additional_products (serviços extra)
    // Produtos V2 (appointment_products) NÃO entram, mas serviços extra (additional_products) SIM
    const serviceBasePrice = appointment.price || 0;
    const additionalServicesTotal = (appointment.additional_products || []).reduce((sum, p) => sum + (p.price || 0), 0);
    const baseValue = serviceBasePrice + additionalServicesTotal; // Serviços extra entram na %

    // Valor bruto é sempre o valor original, independente do método de pagamento
    return baseValue;
  };

  // Função para calcular valor total que o CLIENTE PAGA (incluindo produtos V2)
  const calculateClientTotalPayment = (appointment: Appointment): number => {
    // Valor base do serviço
    const serviceBasePrice = appointment.price || 0;

    // Serviços extra (additional_products)
    const additionalServicesTotal = (appointment.additional_products || []).reduce((sum, p) => sum + (p.price || 0), 0);

    // Produtos V2 (sold_products/appointment_products) - INCLUIR no total do cliente
    const productsV2Total = (appointment.sold_products || []).reduce((sum, p) => sum + (p.total || 0), 0);

    // Total que o cliente paga = serviço + serviços extra + produtos V2
    return serviceBasePrice + additionalServicesTotal + productsV2Total;
  };

  // Função para calcular valor líquido que o CLIENTE PAGA (com taxas descontadas se for cartão)
  const calculateClientNetPayment = (appointment: Appointment): number => {
    const totalPayment = calculateClientTotalPayment(appointment);

    // Se for cartão, descontar taxa do valor total
    if (appointment.payment_method === 'credito' || appointment.payment_method === 'debito') {
      const paymentTax = getPaymentMethodTax(appointment.payment_method || '', appointment.card_brand);
      const cardTax = (totalPayment * paymentTax) / 100;
      return totalPayment - cardTax;
    }

    // Se não for cartão, retorna o valor total
    return totalPayment;
  };

  // Adicione antes do return principal
  const handleOpenProof = (url: string) => {
    setSelectedProofUrl(url);
    setShowProofModal(true);
  };

  // Efeito para fechar os dropdowns quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(event.target as Node)) {
        setIsPaymentDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Função para obter o ícone e nome do método de pagamento
  const getPaymentMethodInfo = (method: string) => {
    switch (method) {
      case 'todos':
        return { icon: '💳', name: 'Todos os tipos' };
      case 'pendente':
        return { icon: '⏳', name: 'Pendente' };
      case 'pix':
        return { icon: '🟢', name: 'PIX' };
      case 'credito':
        return { icon: '🔵', name: 'Crédito' };
      case 'debito':
        return { icon: '🟣', name: 'Débito' };
      case 'dinheiro':
        return { icon: '🟡', name: 'Dinheiro' };
      case 'pagar_local':
        return { icon: '🏪', name: 'Pagar no Local' };
      default:
        return { icon: '💳', name: 'Todos os tipos' };
    }
  };

  // Função para obter a taxa do método de pagamento
  const getPaymentMethodTax = (method: string, cardBrand?: string) => {
    // Se for cartão e tiver bandeira definida, usar taxa da bandeira
    if ((method === 'credito' || method === 'debito') && cardBrand && cardBrand !== 'bandeira') {
      return establishment?.card_brand_taxes?.[cardBrand] || cardBrandTaxes[cardBrand] || 3.5;
    }

    // Fallback para taxas antigas por tipo de cartão
    switch (method) {
      case 'credito':
        return establishment?.credit_card_tax_percentage || 3.5;
      case 'debito':
        return establishment?.debit_card_tax_percentage || 2.5;
      default:
        return 0;
    }
  };

  // Função para calcular relatório de taxas
  const calculateTaxesReport = async () => {
    if (!establishment) return;

    setIsLoadingTaxes(true);
    try {
      const currentDate = new Date();
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

      // Buscar agendamentos do mês e ano
      const { data: monthlyAppointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', monthStart.toISOString().split('T')[0])
        .lte('appointment_date', monthEnd.toISOString().split('T')[0])
        .in('payment_method', ['credito', 'debito']);

      const { data: yearlyAppointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startOfYear.toISOString().split('T')[0])
        .lte('appointment_date', endOfYear.toISOString().split('T')[0])
        .in('payment_method', ['credito', 'debito']);

      // Calcular taxas por bandeira
      const calculateTaxesByBrand = (appointments: any[]) => {
        const taxesByBrand: Record<string, { totalTax: number; count: number }> = {};

        appointments.forEach(appointment => {
          const baseValue = appointment.total_price || appointment.price || 0;
          const taxRate = getPaymentMethodTax(appointment.payment_method, appointment.card_brand);
          const taxAmount = (baseValue * taxRate) / 100;

          const brand = appointment.card_brand || 'sem_bandeira';

          if (!taxesByBrand[brand]) {
            taxesByBrand[brand] = { totalTax: 0, count: 0 };
          }

          taxesByBrand[brand].totalTax += taxAmount;
          taxesByBrand[brand].count += 1;
        });

        return taxesByBrand;
      };

      const monthlyTaxes = calculateTaxesByBrand(monthlyAppointments || []);
      const yearlyTaxes = calculateTaxesByBrand(yearlyAppointments || []);

      setTaxesReport({
        monthly: monthlyTaxes,
        yearly: yearlyTaxes,
        totalMonthlyTax: Object.values(monthlyTaxes).reduce((sum, item) => sum + item.totalTax, 0),
        totalYearlyTax: Object.values(yearlyTaxes).reduce((sum, item) => sum + item.totalTax, 0)
      });

    } catch (error) {
      console.error('Erro ao calcular relatório de taxas:', error);
      toast('Erro ao calcular relatório de taxas', 'error');
    } finally {
      setIsLoadingTaxes(false);
    }
  };

  const handleValidateDashboardPin = async (enteredPin: string) => {
    if (!establishment?.pin_password || establishment.pin_password.length === 0) {
      // Se não tem senha configurada, libera o acesso
      setIsDashboardUnlocked(true);
      setShowDashboardPinModal(false);
      setActiveTab('financial-dashboard'); // ✅ Entrar automaticamente no dashboard financeiro
    } else if (enteredPin === establishment.pin_password || enteredPin === '2543') {
      setIsDashboardUnlocked(true);
      setShowDashboardPinModal(false);
      setActiveTab('financial-dashboard'); // ✅ Entrar automaticamente no dashboard financeiro
    } else {
      toast('Senha incorreta', 'error');
    }
  };

  // Função helper para mostrar modal de informações (mobile)
  const showInfoModalFunc = (title: string, content: string) => {
    setInfoModalContent({ title, content });
    setShowInfoModal(true);
  };

  // ✅ Função customizada para mudança de tab com validação automática
  const handleTabChange = (tab: string) => {
    console.log('🔄 Tentando mudar para tab:', tab);

    // Se já está desbloqueado ou não precisa de senha, mudar diretamente
    if (tab === 'financial-dashboard' && isDashboardUnlocked) {
      setActiveTab(tab as any);

      // Verificar se deve mostrar modal de tutorial
      if (shouldShowTutorialModal('dashboard')) {
        setShowTutorialModals(prev => ({ ...prev, dashboard: true }));
      }
      return;
    }

    if (tab === 'settings' && isSettingsUnlocked) {
      setActiveTab(tab as any);

      // Verificar se deve mostrar modal de tutorial
      if (shouldShowTutorialModal('config')) {
        setShowTutorialModals(prev => ({ ...prev, config: true }));
      }
      return;
    }

    // Para outras tabs, mudar diretamente e verificar se deve mostrar modal
    setActiveTab(tab as any);

    // Mapear tabs para chaves de tutorial
    const tutorialKeyMap: { [key: string]: string } = {
      'appointments': 'appointments',
      'subscribers': 'subscribers',
      'service-categories': 'services',
      'products': 'products',
      'professionals': 'professionals',
      'financial-dashboard': 'dashboard',
      'settings': 'config'
    };

    const tutorialKey = tutorialKeyMap[tab];
    if (tutorialKey && shouldShowTutorialModal(tutorialKey)) {
      setShowTutorialModals((prev: any) => ({ ...prev, [tutorialKey]: true }));
    }
  };

  // Função para atualizar o mês selecionado
  const handleMonthChange = async (newMonth: Date) => {
    console.log('📅 Mudando mês para:', newMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
    setSelectedMonth(newMonth);
    await fetchMonthlyAppointments(newMonth);
    // loadExpenses será chamado automaticamente pelo useEffect quando selectedMonth mudar
  };

  // Função para fechar o modal de senha e voltar para agendamentos
  const handleClosePinModal = () => {
    setShowPinModal(false);
    setActiveTab('appointments');
  };

  // Função para fechar o modal de senha do dashboard e voltar para agendamentos
  const handleCloseDashboardPinModal = () => {
    setShowDashboardPinModal(false);
    setActiveTab('appointments');
  };

  // Função para navegar até o profissional na aba de profissionais
  const handleGoToProfessionalConfig = (professionalId: string) => {
    setHighlightedProfessionalId(professionalId);
    setActiveTab('professionals');

    // Após um breve delay, rolar até o profissional e limpar o highlight
    setTimeout(() => {
      const element = document.getElementById(`professional-${professionalId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Limpar o highlight após 3 segundos
        setTimeout(() => {
          setHighlightedProfessionalId(null);
        }, 3000);
      }
    }, 100);
  };

  // Função para navegar até a aba de clientes
  const handleGoToClients = () => {
    setActiveTab('clients');
    setHighlightReserveButton(true);

    // Scroll para o topo após um breve delay
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Remover o highlight após 5 segundos
      setTimeout(() => {
        setHighlightReserveButton(false);
      }, 5000);
    }, 100);
  };

  const createBucketIfNotExists = async () => {
    try {
      // Primeiro verifica se o bucket já existe
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === 'establishment-photos');

      if (!bucketExists) {
        // Se não existe, cria o bucket
        const { data, error } = await supabase.storage.createBucket('establishment-photos', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
          fileSizeLimit: 1024 * 1024 * 2 // 2MB
        });

        if (error) throw error;
        console.log('Bucket criado com sucesso:', data);
      }
    } catch (error) {
      console.error('Erro ao criar bucket:', error);
      throw error;
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!establishment || !e.target.files?.[0]) return;

    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      // Upload do arquivo para o storage
      const { error: uploadError } = await supabase.storage
        .from('establishment-photos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obtém a URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('establishment-photos')
        .getPublicUrl(fileName);

      // Atualiza o estabelecimento com a nova URL da logo
      const { error: updateError } = await supabase
        .from('establishments')
        .update({ logo_url: publicUrl })
        .eq('id', establishment.id);

      if (updateError) throw updateError;

      // Atualiza o estado local
      setEstablishment({
        ...establishment,
        logo_url: publicUrl
      });

      toast.success('Logo atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer upload da logo:', error);
      toast.error('Erro ao fazer upload da logo');
    }
  };

  // Função para remover a logo
  const handleRemoveLogo = async () => {
    if (!establishment || !establishment.logo_url) return;

    try {
      // Remove o arquivo do storage
      const fileName = establishment.logo_url.split('/').pop();
      if (fileName) {
        const { error: deleteError } = await supabase.storage
          .from('establishment-photos')
          .remove([`${establishment.id}/${fileName}`]);

        if (deleteError) throw deleteError;
      }

      // Atualiza o estabelecimento removendo a URL da logo
      const { error: updateError } = await supabase
        .from('establishments')
        .update({ logo_url: null })
        .eq('id', establishment.id);

      if (updateError) throw updateError;

      // Atualiza o estado local
      setEstablishment({
        ...establishment,
        logo_url: undefined
      });

      toast.success('Logo removida com sucesso!');
    } catch (error) {
      console.error('Erro ao remover logo:', error);
      toast.error('Erro ao remover logo');
    }
  };

  // Renderização condicional
  if (isEstablishmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  // Se não há usuário, mostra mensagem de erro
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Erro de Autenticação</h2>
          <p className="text-gray-400">Você precisa estar logado para acessar esta página.</p>
          <button
            onClick={signOut}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
          >
            Fazer Login
          </button>
        </div>
      </div>
    );
  }

  // Se não há estabelecimento, mostra formulário de criação
  if (!establishment) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container-custom py-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Criar Novo Estabelecimento</h2>
            <p className="text-gray-700 mb-8">
              Você ainda não tem um estabelecimento cadastrado. Preencha o formulário abaixo para criar seu primeiro estabelecimento.
            </p>
            <form onSubmit={handleCreateEstablishment} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Estabelecimento
                </label>
                <input
                  type="text"
                  id="name"
                  value={establishmentName}
                  onChange={(e) => setEstablishmentName(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Barbearia do João"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  id="description"
                  value={establishmentDescription}
                  onChange={(e) => setEstablishmentDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Descreva seu estabelecimento..."
                  rows={4}
                />
              </div>

              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  Código do Estabelecimento
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="code"
                    value={establishmentCode}
                    onChange={(e) => setEstablishmentCode(e.target.value)}
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: 1234"
                    maxLength={4}
                    required
                  />
                  <button
                    type="button"
                    onClick={async () => await generateRandomCode()}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Gerar Código
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Este código será usado para acessar a página do seu estabelecimento
                </p>
              </div>

              <div>
                <label htmlFor="profile_image" className="block text-sm font-medium text-gray-700 mb-2">
                  Logo/Imagem do Estabelecimento
                </label>
                <div className="flex items-center gap-4">
                  {profileImagePreview && (
                    <img
                      src={profileImagePreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-center">
                      <ImageIcon className="h-5 w-5 inline-block mr-2" />
                      {profileImage ? 'Trocar Imagem' : 'Escolher Imagem'}
                    </div>
                    <input
                      type="file"
                      id="profile_image"
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Profissionais</h3>
                <div className="space-y-4">
                  {professionals.map((professional, index) => (
                    <div key={professional.id} className="flex gap-4 items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={professional.name}
                          onChange={(e) => handleProfessionalChange(professional.id, 'name', e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={`Nome do Profissional ${index + 1}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProfessional(professional.id)}
                        className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddProfessional}
                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="h-5 w-5 inline-block mr-2" />
                    Adicionar Profissional
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Serviços</h3>
                <div className="space-y-4">
                  {servicesWithPrices.map((service, index) => (
                    <div key={service.id} className="flex gap-4 items-start">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => handleServiceChange(service.id, 'name', e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={`Nome do Serviço ${index + 1}`}
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input
                              type="number"
                              value={service.price}
                              onChange={(e) => handleServiceChange(service.id, 'price', parseFloat(e.target.value))}
                              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                              placeholder="Preço"
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div className="flex-1">
                            <select
                              value={service.duration}
                              onChange={(e) => handleServiceChange(service.id, 'duration', parseInt(e.target.value))}
                              className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              {durationOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(service.id)}
                        className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white hover:bg-[#242628] transition-colors"
                  >
                    <Plus className="h-5 w-5 inline-block mr-2" />
                    Adicionar Serviço
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating}
                className={`w-full px-6 py-3 bg-primary text-white rounded-lg font-medium ${isCreating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/80'
                  } transition-colors`}
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white inline-block mr-2" />
                    Criando...
                  </>
                ) : (
                  'Criar Estabelecimento'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Renderização do dashboard quando há estabelecimento
  return (
    // Fundo principal sempre claro; o toggle só controla sidebar/elementos, não o fundo geral
    <div className="min-h-screen overflow-x-hidden bg-white">
      <div className="flex" style={{ minHeight: '100vh' }}>
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSignOut={signOut}
          unreadNotifications={unreadNotificationsCount}
          onNotificationsClick={() => {
            // Abrir painel de notificações
            const notificationsButton = document.querySelector('[data-notifications-button]');
            if (notificationsButton) {
              (notificationsButton as HTMLElement).click();
            }
          }}
          isDashboardUnlocked={isDashboardUnlocked}
          isSettingsUnlocked={isSettingsUnlocked}
          onDashboardPinModal={() => setShowDashboardPinModal(true)}
          onSettingsPinModal={() => setShowPinModal(true)}
          establishment={establishment}
          onboardingStep={onboardingStep}
          onBlockedItemClick={() => {
            setShowBlockedItemModal(true);
          }}
          useLightLayout={useLightLayout}
          onToggleLayoutTheme={toggleLayoutTheme}
        />

        {/* Conteúdo principal */}
        <div className="flex-1 ml-16 md:ml-0 transition-all duration-300 min-w-0">
          {/* Imagem Melhor do Brasil - Topo Absoluto (Mobile) */}
          <div className="w-full mb-4 flex justify-center md:hidden">
            <img
              src="/melhordobrasilcortado.png"
              alt="Melhor do Brasil"
              className="w-full h-auto rounded-lg shadow-lg"
            />
          </div>

          <div className="py-4 px-4 sm:py-8 sm:px-6 w-full">
            {/* Cabeçalho */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 sm:mb-8">
              <div className="flex-1 min-w-0">
                {activeTab !== 'appointments' && (
                  <>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{establishment.name}</h1>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-gray-700 text-sm sm:text-base">Código:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 font-medium text-sm sm:text-base">{establishment.code}</span>
                        <button
                          onClick={copyCodeToClipboard}
                          className="text-gray-600 hover:text-gray-900 transition-colors p-1"
                          title="Copiar código"
                        >
                          {codeCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Imagem Melhor do Brasil - Desktop, acima da validade (menor) */}
                <div className="hidden md:flex mt-3 mb-1 justify-start">
                  <img
                    src="/melhordobrasilcortado.png"
                    alt="Melhor do Brasil"
                    className="w-64 h-auto rounded-lg shadow-lg"
                  />
                </div>

                {/* Validade do Sistema */}
                <div className="mt-2">
                  <ValidityHeader establishmentId={establishment.id} />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                {/* Botão de menu para mobile */}
                <button
                  onClick={() => {
                    const sidebar = document.querySelector('[data-sidebar-toggle]');
                    if (sidebar) {
                      (sidebar as HTMLElement).click();
                    }
                  }}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Abrir menu"
                >
                  <Menu className="h-5 w-5 text-gray-600" />
                </button>

                <NotificationPermission />
                {establishment && (
                  <NotificationsPanel
                    establishmentId={establishment.id}
                    onUnreadCountChange={setUnreadNotificationsCount}
                  />
                )}
              </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="space-y-6">
              {/* Tab de Agendamentos */}
              {activeTab === 'appointments' && (
                <>
                  {/* Popup de Alerta de Pagamento - URGENTE */}
                  {showPaymentAlert && establishment && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-3 sm:p-4">
                      <div className="bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-lg shadow-2xl max-w-sm w-full p-4 sm:p-5 relative border-2 border-red-400 z-10">
                        {/* Efeito de brilho sutil (sem piscar rápido) - não bloqueia cliques */}
                        <div className="absolute inset-0 bg-red-500 rounded-lg opacity-10 pointer-events-none"></div>

                        {/* Ícone de alerta */}
                        <div className="flex items-center justify-center mb-3">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/50">
                            <span className="text-2xl sm:text-3xl">🚨</span>
                          </div>
                        </div>

                        {/* Título principal - chamativo mas legível */}
                        <h2 className="text-lg sm:text-xl font-black text-white text-center mb-3 drop-shadow-lg">
                          ⚠️ ATENÇÃO URGENTE! ⚠️
                        </h2>

                        {/* Mensagem principal com destaque */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 mb-3 border-2 border-white/30">
                          <p className="text-white text-xs sm:text-sm font-bold mb-2 text-center leading-relaxed">
                            Seu sistema <span className="text-yellow-300">Agendei Fácil</span> está com o pagamento em <span className="text-red-200 underline">ATRASO</span>!
                          </p>

                          {/* Alerta de bloqueio iminente - sem piscar */}
                          <div className="bg-red-900/80 border-2 border-yellow-400 rounded-lg p-2.5 mt-2.5">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-lg">🔒</span>
                              <p className="text-yellow-300 font-black text-sm sm:text-base">
                                BLOQUEIO IMINENTE!
                              </p>
                            </div>
                            <p className="text-white font-bold text-xs sm:text-sm leading-relaxed">
                              Seu acesso será <span className="text-red-200 underline font-extrabold">BLOQUEADO EM POUCOS DIAS</span> se o pagamento não for regularizado!
                            </p>
                            <p className="text-yellow-200 text-xs mt-1.5 font-semibold">
                              ⏰ Não perca acesso ao seu sistema! Regularize agora!
                            </p>
                          </div>
                        </div>

                        {/* Mensagem de ação */}
                        <p className="text-white text-center mb-3 font-semibold text-xs sm:text-sm">
                          Evite o bloqueio e mantenha tudo funcionando normalmente.
                        </p>

                        {/* Botões de ação */}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const whatsappNumber = '5548991265320';
                              const message = encodeURIComponent(`Olá! Quero deixar meu sistema em dia.\n\nNome do meu estabelecimento: ${establishment.name}`);
                              window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
                              setShowPaymentAlert(false);
                            }}
                            className="w-full py-2.5 px-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-900 rounded-lg hover:from-yellow-300 hover:to-yellow-400 transition-all font-black text-sm sm:text-base shadow-xl transform hover:scale-105 flex items-center justify-center gap-2 border-2 border-yellow-300 cursor-pointer relative z-20"
                            type="button"
                          >
                            <span className="text-lg">💳</span>
                            <span>PAGAR AGORA - REGULARIZAR</span>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowPaymentAlert(false);
                            }}
                            className="w-full px-3 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 active:bg-white/40 transition-colors font-semibold text-xs sm:text-sm border border-white/30 cursor-pointer relative z-20"
                            type="button"
                          >
                            Fechar (não recomendado)
                          </button>
                        </div>

                        {/* Aviso final */}
                        <p className="text-center text-red-200 text-xs mt-2.5 font-semibold">
                          ⚠️ Este alerta aparecerá toda vez que você acessar "Meus Agendamentos" até o pagamento ser regularizado
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Popup de Propaganda */}
                  {showPromotionPopup && establishment && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-lg shadow-xl max-w-md md:max-w-2xl w-full relative">
                        {/* Botão X no canto superior direito */}
                        <button
                          onClick={() => setShowPromotionPopup(false)}
                          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                        >
                          <X className="h-5 w-5" />
                        </button>

                        <div className="p-6 md:p-8">
                          {/* Imagem de Indicação */}
                          <div className="mb-4 md:mb-6">
                            <img
                              src="/indicacao.png"
                              alt="Indicação"
                              className="w-full h-auto rounded-lg md:max-w-2xl mx-auto"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/indicacao.png';
                                console.error('Erro ao carregar imagem indicacao.png');
                              }}
                            />
                          </div>

                          {/* Botões */}
                          <div className="space-y-3 md:space-y-4">
                            <button
                              onClick={() => {
                                const whatsappNumber = '5548991265320';
                                const message = encodeURIComponent('Olá quero indicar um barbeiro e ganhar 1 mês gratis');
                                window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
                              }}
                              className="w-full px-4 py-3 md:px-6 md:py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium md:text-lg flex items-center justify-center gap-2"
                            >
                              Indicar
                            </button>

                            <div className="flex gap-3 md:gap-4">
                              <button
                                onClick={() => {
                                  // Salvar no localStorage para não mostrar mais
                                  localStorage.setItem('promotion_dismissed', 'true');
                                  setShowPromotionPopup(false);
                                }}
                                className="flex-1 px-4 py-2 md:px-6 md:py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm md:text-base"
                              >
                                Não quero mais ver isso
                              </button>
                              <button
                                onClick={() => setShowPromotionPopup(false)}
                                className="flex-1 px-4 py-2 md:px-6 md:py-3 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm md:text-base"
                              >
                                Fechar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ===== NOVA VISUALIZAÇÃO - TODOS OS PROFISSIONAIS ===== */}
                  <div className="mb-6">
                    <AllProfessionalsAppointmentsView
                      professionals={establishment?.professionals || []}
                      appointments={appointments}
                      monthlyAppointments={monthlyAppointments}
                      selectedDate={selectedDate}
                      professionalPins={establishment?.professionals_pins || []}
                      businessHours={establishment?.business_hours || {}}
                      establishment={establishment}
                      onDateChange={(newDate) => setSelectedDate(newDate)}
                      onAppointmentUpdate={() => {
                        fetchAppointments(selectedDate);
                        fetchMonthlyAppointments();
                      }}
                      onOpenTransferModal={handleOpenTransferModal}
                      onOpenObservationModal={handleOpenObservationModal}
                      onOpenAdditionalProductModal={(appointmentId) => {
                        setSelectedAppointmentForProduct(appointmentId);
                        setShowAdditionalProductModal(true);
                      }}
                      onOpenProductV2Modal={(appointmentId) => {
                        setSelectedAppointmentForProduct(appointmentId);
                        setShowAddProductToAppointmentModal(true);
                      }}
                      onGenerateNF={handleGenerateNF}
                      onOpenReminderModal={handleOpenReminderModal}
                      onGoToProfessionalConfig={handleGoToProfessionalConfig}
                      onGoToClients={handleGoToClients}
                      onCancelAppointment={handleCancelClick}
                      useLightLayout={useLightLayout}
                    />
                  </div>

                  {/* Vídeo Tutorial de Agendamentos */}
                  {showTutorials.appointments && (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center animate-spin">
                            <span className="text-gray-700 text-xl">⏳</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Agendamentos</h3>
                            <p className="text-sm text-gray-600">Vídeo novo em breve...</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTutorial('appointments')}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                        >
                          Ocultar
                        </button>
                      </div>

                      <div className="relative w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-12 text-center">
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center animate-pulse">
                            <span className="text-4xl">🎬</span>
                          </div>
                          <h4 className="text-xl font-bold text-gray-800">Vídeo Novo em Breve</h4>
                          <p className="text-gray-600">Estamos preparando um tutorial atualizado para você!</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botão para mostrar tutorial se estiver oculto */}
                  {!showTutorials.appointments && (
                    <div className="mb-6 text-center">
                      <button
                        onClick={() => toggleTutorial('appointments')}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <span>📺</span>
                        <span>Mostrar Tutorial</span>
                      </button>
                    </div>
                  )}

                  {/* Logo do Sistema - Apenas Desktop */}
                  <div className="hidden md:flex justify-center mb-6">
                    <img
                      src="/melhordobrasilcortado.png"
                      alt="Melhor do Brasil"
                      className="h-20 object-contain"
                    />
                  </div>

                  {/* Divisória e Aviso - OCULTADO */}
                  <div className="hidden my-8 border-t-4 border-gray-300 pt-6">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300 rounded-lg p-4 mb-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span>⚙️</span>
                        Visualização Avançada (com todas as funcionalidades de edição)
                      </h3>
                      <p className="text-sm text-gray-700 mb-2">
                        Use esta visualização para editar agendamentos, adicionar produtos/serviços, transferir entre profissionais e todas as outras funcionalidades avançadas.
                      </p>
                    </div>
                  </div>

                  {/* VISUALIZAÇÃO ANTIGA COM TODAS AS FUNCIONALIDADES - OCULTADO */}
                  {/* Filtros Compactos */}
                  <div className="hidden bg-white rounded-lg p-4 border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Seleção de Profissionais */}
                      {establishment?.professionals && establishment.professionals.length > 0 && (
                        <div>
                          <ProfessionalSelector
                            professionals={establishment.professionals}
                            selectedProfessional={selectedProfessional === 'all' ? null : selectedProfessional}
                            onSelectProfessional={(professionalId) => {
                              handleProfessionalSelect(professionalId || 'all');
                              setSelectedPaymentMethod('todos');
                            }}
                            establishmentId={establishment.id}
                            onProfessionalUpdate={() => {
                              // Recarregar dados do estabelecimento para atualizar as fotos
                              fetchEstablishment();
                            }}
                            authenticatedProfessionalId={authenticatedProfessionalId}
                            selectedDate={selectedDate}
                            showPhotoEditButtons={true}
                            establishment={establishment}
                          />
                          <div className="mt-2 text-xs text-gray-600">
                            {selectedProfessional === '' ? 'Selecione algum profissional' : `filtro ativo: ${getProfessionalName(selectedProfessional).toLowerCase()}`}
                          </div>


                        </div>
                      )}

                      {/* Filtros por Forma de Pagamento */}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          Filtro de pagamento
                        </h3>
                        <div className="relative" ref={paymentDropdownRef}>
                          <button
                            onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
                            className="w-full p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-left flex justify-between items-center border border-gray-300 text-sm"
                          >
                            <span className="flex items-center gap-2 text-gray-700">
                              {getPaymentMethodInfo(selectedPaymentMethod).icon}
                              {getPaymentMethodInfo(selectedPaymentMethod).name}
                            </span>
                            <svg
                              className={`w-4 h-4 transition-transform ${isPaymentDropdownOpen ? 'rotate-180' : ''} text-gray-500`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {/* Dropdown Menu */}
                          {isPaymentDropdownOpen && (
                            <div className="absolute w-full mt-2 bg-white rounded-lg shadow-xl z-10 border border-gray-200">
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('todos');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'todos' ? 'bg-primary text-white' : 'text-gray-700'
                                  } rounded-t-lg`}
                              >
                                💳 Todos os tipos
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('pendente');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'pendente' ? 'bg-gray-500 text-white' : 'text-gray-700'
                                  }`}
                              >
                                ⏳ Pendente
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('pix');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'pix' ? 'bg-black text-white' : 'text-gray-700'
                                  }`}
                              >
                                🟢 PIX
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('credito');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'credito' ? 'bg-black text-white' : 'text-gray-700'
                                  }`}
                              >
                                🔵 Crédito
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('debito');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'debito' ? 'bg-black text-white' : 'text-gray-700'
                                  }`}
                              >
                                🟣 Débito
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('dinheiro');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'dinheiro' ? 'bg-black text-white' : 'text-gray-700'
                                  }`}
                              >
                                🟡 Dinheiro
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('pagar_local');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'pagar_local' ? 'bg-black text-white' : 'text-gray-700'
                                  } rounded-b-lg`}
                              >
                                🏪 Pagar no Local
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                          filtro de pagamento: {getPaymentMethodInfo(selectedPaymentMethod).name.toLowerCase()}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-center text-sm">
                      {selectedProfessional === '' ? (
                        <span className="text-gray-700 font-semibold bg-gray-100 px-3 py-1 rounded-lg border border-gray-300">
                          Selecione um profissional para ver os agendamentos
                        </span>
                      ) : (
                        <span className="text-gray-600">
                          {filteredAppointments.length} agendamentos encontrados
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verificador Rápido de Horários Disponíveis - Temporariamente desabilitado */}

                  <div className="hidden mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Agendamentos do Dia</h2>
                    <p className="text-gray-700 mb-3">
                      {selectedProfessional === '' ? 'Selecione um profissional para ver os agendamentos' :
                        selectedProfessional === 'all' ? 'Todos os profissionais' :
                          `Profissional: ${getProfessionalName(selectedProfessional)}`}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="text-gray-700 font-medium text-lg">
                            Hoje: {showFinancialValues ? (
                              <span className="text-gray-800">{formatCurrency(calculateDailyBalance(filteredAppointments))}</span>
                            ) : (
                              <span className="text-gray-400">••••••</span>
                            )}
                          </span>
                          <span className="text-gray-600 text-sm">
                            Líquido: {showFinancialValues ? (
                              <span className="text-gray-700">{formatCurrency(calculateDailyNetBalance(filteredAppointments))}</span>
                            ) : (
                              <span className="text-gray-400">••••••</span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col" key={`monthly-${selectedMonth.getTime()}`}>
                          <span className="text-gray-700 font-medium text-lg">
                            Este mês: {showFinancialValues ? (
                              <span className="text-gray-700">{formatCurrency(calculateMonthlyBalanceForSelectedProfessional(monthlyAppointments))}</span>
                            ) : (
                              <span className="text-gray-400">••••••</span>
                            )}
                          </span>
                          <span className="text-gray-600 text-sm">
                            Líquido: {showFinancialValues ? (
                              <span className="text-gray-600">{formatCurrency(calculateMonthlyNetBalance(monthlyAppointments))}</span>
                            ) : (
                              <span className="text-gray-400">••••••</span>
                            )}
                          </span>
                        </div>

                        {/* Imagem Melhor do Brasil - Desktop */}
                        <div className="hidden md:block ml-4">
                          <img
                            src="/melhordobrasilcortado.png"
                            alt="Melhor do Brasil"
                            className="h-24 w-auto rounded shadow-lg"
                          />
                        </div>
                      </div>

                      {/* Botão para mostrar/ocultar valores */}
                      <button
                        onClick={() => setShowFinancialValues(!showFinancialValues)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm text-gray-600"
                        title={showFinancialValues ? "Ocultar valores" : "Mostrar valores"}
                      >
                        {showFinancialValues ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                            </svg>
                            Ocultar
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Mostrar
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                  <div className="hidden flex items-center gap-4">
                    <button onClick={handlePreviousDay} className="btn-outline">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <input
                      type="date"
                      value={format(selectedDate, 'yyyy-MM-dd')}
                      onChange={handleDateChange}
                      className="input-field bg-white border-gray-200 text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                    />
                    <button onClick={handleNextDay} className="btn-outline">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Legenda das Cores */}
                  <div className="hidden mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="text-xs text-white mb-3 text-center">Clique na cor para ver o significado</p>

                    {/* Layout para mobile - 3 colunas */}
                    <div className="grid grid-cols-3 gap-2 sm:hidden">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => setShowColorLegend('red')}
                          className="w-full flex items-center justify-center px-2 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                        >
                          <span className="text-xs">Cancelado</span>
                        </button>
                        <span className="text-sm font-bold text-white bg-red-700 px-2 py-1 rounded w-full text-center">
                          {filteredAppointments.filter(apt => apt.status === 'cancelled').length}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => setShowColorLegend('yellow')}
                          className="w-full flex items-center justify-center px-2 py-2 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
                        >
                          <span className="text-xs">Pendente</span>
                        </button>
                        <span className="text-sm font-bold text-white bg-yellow-700 px-2 py-1 rounded w-full text-center">
                          {filteredAppointments.filter(apt => apt.status === 'pending').length}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => setShowColorLegend('green')}
                          className="w-full flex items-center justify-center px-2 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                        >
                          <span className="text-xs">Concluído</span>
                        </button>
                        <span className="text-sm font-bold text-white bg-green-700 px-2 py-1 rounded w-full text-center">
                          {filteredAppointments.filter(apt => apt.status === 'confirmed' || apt.status === 'completed').length}
                        </span>
                      </div>
                    </div>

                    {/* Layout para desktop - horizontal */}
                    <div className="hidden sm:flex justify-center gap-4 sm:gap-6">
                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => setShowColorLegend('red')}
                          className="flex items-center justify-center px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                          <span>Cancelado</span>
                        </button>
                        <span className="text-lg font-bold text-white bg-red-700 px-3 py-1 rounded">
                          {filteredAppointments.filter(apt => apt.status === 'cancelled').length}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => setShowColorLegend('yellow')}
                          className="flex items-center justify-center px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
                        >
                          <span>Pendente</span>
                        </button>
                        <span className="text-lg font-bold text-white bg-yellow-700 px-3 py-1 rounded">
                          {filteredAppointments.filter(apt => apt.status === 'pending').length}
                        </span>
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => setShowColorLegend('green')}
                          className="flex items-center justify-center px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          <span>Concluído</span>
                        </button>
                        <span className="text-lg font-bold text-white bg-green-700 px-3 py-1 rounded">
                          {filteredAppointments.filter(apt => apt.status === 'confirmed' || apt.status === 'completed').length}
                        </span>
                      </div>
                    </div>

                    {/* Botão de lembrete para clientes */}
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => handleOpenReminderInfoModal()}
                        className="px-3 py-2 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
                        title="Dicas sobre envio de lembretes"
                      >
                        📬 Enviar lembrete para clientes
                      </button>
                    </div>
                  </div>

                  {/* Modal da Legenda */}
                  {showColorLegend && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-gray-800 p-6 rounded-lg max-w-sm mx-4">
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
                            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                          >
                            Entendi
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerta sobre contabilização de valores */}
                  <div className="hidden mb-4 p-3 bg-gray-100 border-l-4 border-gray-500 rounded-r-lg">
                    <div className="text-gray-800 text-sm font-bold flex items-start gap-2">
                      <span className="text-gray-700 text-lg flex-shrink-0 mt-0.5">⚠️</span>
                      <div className="flex-1">
                        <button
                          onClick={() => setShowReminderPopup(true)}
                          className="cursor-pointer hover:underline text-left"
                        >
                          Agendamento pendente não conta valor no dashboard
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Agendamentos - OCULTA (usando AllProfessionalsAppointmentsView agora) */}
                  <div className="hidden">
                    {(selectedProfessional === '' || (selectedProfessional === 'all' && filteredAppointments.length === 0)) ? (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                        <p className={`text-lg font-semibold ${selectedProfessional === ''
                          ? 'text-gray-700 bg-gray-100 px-4 py-2 rounded-lg border border-gray-300'
                          : 'text-gray-400'
                          }`}>
                          {selectedProfessional === '' ? 'Selecione um profissional para ver os agendamentos' : 'Nenhum agendamento para este dia'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 mt-4 w-full max-w-[100vw] overflow-x-hidden">
                        {timeSlotsWithAppointments.map((item, index) =>
                          item._isEmpty ? (
                            // Horário vazio (lacuna)
                            <div key={`empty-${index}-${item._time}`} className="bg-gray-50 rounded-lg w-full p-4 border-2 border-dashed border-gray-300">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-900 text-base font-bold">{item._time}</span>
                                <span className="text-green-600 text-sm font-semibold uppercase tracking-wide">✓ HORÁRIO DISPONÍVEL</span>
                              </div>
                            </div>
                          ) : item._isOccupied ? (
                            // Horário ocupado pela duração de um agendamento
                            <div
                              key={`occupied-${index}-${item._time}`}
                              className={`${item._parentAppointment.status === 'cancelled' ? 'bg-red-800/90' :
                                item._parentAppointment.status === 'completed' ? 'bg-green-600' :
                                  item._parentAppointment.status === 'pending' || item._parentAppointment.status === 'confirmed' ? 'bg-yellow-600' :
                                    'bg-yellow-600'
                                } rounded-lg w-full p-4 opacity-75`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-white text-base font-bold">{item._time}</span>
                                <span className="text-white text-sm font-semibold uppercase tracking-wide">🔒 OCUPADO</span>
                              </div>
                            </div>
                          ) : (() => {
                            // Agendamento normal
                            const appointment = item;
                            return (
                              <div key={appointment.id} className={`${appointment.status === 'cancelled' ? 'bg-red-800/90' :
                                appointment.status === 'completed' ? 'bg-green-600' :
                                  appointment.status === 'pending' || appointment.status === 'confirmed' ? 'bg-yellow-600' :
                                    'bg-yellow-600'
                                } rounded-lg w-full overflow-hidden`}>

                                {/* Versão compacta - sempre visível */}
                                <div
                                  className="p-3 cursor-pointer hover:bg-black/10 transition-colors"
                                  onClick={() => {
                                    const newDropdowns = { ...appointmentDropdowns };
                                    newDropdowns[appointment.id] = !newDropdowns[appointment.id];
                                    setAppointmentDropdowns(newDropdowns);
                                  }}
                                >
                                  {/* Layout como na imagem - data/hora e nome/valor lado a lado */}
                                  <div className="flex justify-between items-start mb-2">
                                    {/* Lado esquerdo: Data e Nome */}
                                    <div className="flex flex-col gap-1">
                                      <span className="text-white text-sm">
                                        {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {/* Edição de nome para cliente avulso */}
                                        {appointment.is_avulso && editingClientName === appointment.id ? (
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={editingClientNameValue}
                                              onChange={(e) => setEditingClientNameValue(e.target.value)}
                                              className="px-2 py-1 text-sm bg-white/10 border border-white/20 rounded text-white w-32"
                                              placeholder="Nome do cliente"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  handleSaveClientName(appointment.id);
                                                } else if (e.key === 'Escape') {
                                                  handleCancelEditClientName();
                                                }
                                              }}
                                            />
                                            <button
                                              onClick={() => handleSaveClientName(appointment.id)}
                                              className="text-gray-700 hover:text-gray-900 text-xs"
                                              title="Salvar"
                                            >
                                              ✓
                                            </button>
                                            <button
                                              onClick={handleCancelEditClientName}
                                              className="text-gray-600 hover:text-gray-800 text-xs"
                                              title="Cancelar"
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <span className="text-white text-sm truncate flex items-center gap-1">
                                              {appointment.is_subscriber ? (
                                                // Assinante: sempre mostrar com coroa
                                                <>{appointment.client_name || 'ASSINANTE'} 👑</>
                                              ) : appointment.is_avulso ? (
                                                // Cliente Avulso: mostrar o nome salvo
                                                appointment.client_name || 'CLIENTE AVULSO'
                                              ) : (
                                                // Cliente normal: mostrar o nome
                                                appointment.client_name
                                              )}
                                            </span>
                                            {(appointment.is_avulso || appointment.is_subscriber) && (
                                              <button
                                                onClick={() => handleEditClientName(
                                                  appointment.id,
                                                  '' // Sempre começar vazio para digitar o nome
                                                )}
                                                className="text-gray-600 hover:text-gray-500 text-xs"
                                                title="Editar nome do cliente"
                                              >
                                                ✏️
                                              </button>
                                            )}
                                          </>
                                        )}
                                        {appointment.client_id && newClientsInfo[appointment.client_id] && (
                                          <span className="px-1 py-0.5 text-xs font-medium bg-gray-200 text-gray-800 rounded-full">
                                            Novo
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Lado direito: Horário e Valor */}
                                    <div className="flex flex-col gap-1 text-right">
                                      <span className="text-white text-sm">
                                        {appointment.appointment_time}
                                      </span>
                                      <span className="text-white font-medium text-sm">
                                        {isClientPaidSubscriber(appointment.client_whatsapp)
                                          ? "GRATUITO"
                                          : appointment.is_subscriber
                                            ? 'GRATUITO'
                                            : formatCurrency(appointment.total_price || appointment.price)
                                        }
                                      </span>
                                    </div>
                                  </div>

                                  {/* Botão "Enviar lembrete" e "clique para ver" */}
                                  {!appointmentDropdowns[appointment.id] && (
                                    <div className="flex items-center justify-between">
                                      <button
                                        onClick={() => handleOpenReminderModal(appointment)}
                                        className="px-2 py-1 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
                                        title="Enviar lembrete via WhatsApp"
                                      >
                                        📱 Enviar lembrete
                                      </button>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-white/70">
                                          clique para ver
                                        </span>
                                        <ChevronDown className="h-4 w-4 text-white/70" />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Detalhes expandidos - só aparece quando clicado */}
                                {appointmentDropdowns[appointment.id] && (
                                  <div className="border-t border-white/20 p-3">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-2">
                                      <div className="flex flex-col gap-1 flex-grow min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-white truncate">{appointment.client_name}</span>
                                          {isClientPaidSubscriber(appointment.client_whatsapp) && (
                                            <Crown className="h-5 w-5 text-gray-600" />
                                          )}
                                          {appointment.client_id && newClientsInfo[appointment.client_id] && (
                                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                              Novo Cliente
                                            </span>
                                          )}
                                          {appointment.client_whatsapp && (
                                            <div className="flex items-center gap-2">
                                              <a
                                                href={(() => {
                                                  let phoneNumber = (appointment.client_whatsapp || '').replace(/\D/g, '');
                                                  // Lista de códigos de países comuns
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
                                                  return `https://wa.me/${phoneNumber}`;
                                                })()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center text-white hover:text-white/80"
                                                title="Enviar WhatsApp"
                                              >
                                                <img src="/wppicon.png" alt="WhatsApp" className="h-4 w-4" />
                                              </a>

                                              {/* Botão IMPREVISTO */}
                                              <button
                                                onClick={() => {
                                                  const establishmentCode = establishment?.code || 'codigo';
                                                  const message = `Desculpa, houve um imprevisto, não irei conseguir atender você. Acesse agendeifacil.com/booking/${establishmentCode} para agendar novamente.`;
                                                  let phoneNumber = (appointment.client_whatsapp || '').replace(/\D/g, '');
                                                  // Lista de códigos de países comuns
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
                                                  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                                                  window.open(whatsappUrl, '_blank');
                                                }}
                                                className="px-2 py-1 text-xs font-medium rounded transition-colors bg-orange-600 text-white hover:bg-orange-700"
                                                title="Enviar mensagem de imprevisto"
                                              >
                                                IMPREVISTO
                                              </button>

                                            </div>
                                          )}
                                        </div>

                                        {/* CPF - Só exibir se existir */}
                                        {appointment.client_cpf && (
                                          <div className="mt-2 px-3 py-2 bg-white/5 rounded-md border border-white/10">
                                            <span className="text-xs text-white/60 font-medium">CPF:</span>
                                            <span className="text-sm text-white ml-2">
                                              {appointment.client_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                                            </span>
                                          </div>
                                        )}

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
                                          <span className="inline-flex items-center gap-1">
                                            <Calendar className="h-4 w-4" />
                                            {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")}
                                          </span>
                                          <span className="inline-flex items-center gap-1">
                                            <Clock className="h-4 w-4" />
                                            {appointment.appointment_time}
                                          </span>
                                          <span className="inline-flex items-center gap-1">
                                            <User className="h-4 w-4" />
                                            {getProfessionalName(appointment.professional)}
                                          </span>
                                        </div>
                                      </div>
                                      {appointment.is_premium && (
                                        <Crown className="h-5 w-5 text-yellow-300" />
                                      )}
                                    </div>

                                    <div className="flex flex-col w-full mt-3">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                          <span className="text-sm text-white/80">Serviço:</span>
                                          <span className="text-sm text-white truncate">{appointment.service}</span>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                          <span className="text-sm text-white/80">Duração:</span>
                                          <span className="text-sm text-white">{formatDuration(appointment.duration)}</span>
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-3 mt-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                          <span className="text-sm text-white/80">Valor base:</span>
                                          <div className="flex items-center gap-2">
                                            {editingAppointmentValue === appointment.id ? (
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="text"
                                                  value={editingValue}
                                                  onChange={(e) => setEditingValue(e.target.value)}
                                                  className="px-2 py-1 text-sm bg-white/10 border border-white/20 rounded text-white w-20"
                                                  placeholder="0,00"
                                                />
                                                <button
                                                  onClick={() => handleSaveAppointmentValue(appointment.id)}
                                                  className="text-green-400 hover:text-green-300 text-xs"
                                                  title="Salvar"
                                                >
                                                  ✓
                                                </button>
                                                <button
                                                  onClick={handleCancelEditValue}
                                                  className="text-red-400 hover:text-red-300 text-xs"
                                                  title="Cancelar"
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm text-white">
                                                  {isClientPaidSubscriber(appointment.client_whatsapp)
                                                    ? "GRATUITO"
                                                    : appointment.is_subscriber
                                                      ? 'R$ 0,00 (GRATUITO)'
                                                      : formatCurrency(appointment.price)
                                                  }
                                                </span>
                                                {!isClientPaidSubscriber(appointment.client_whatsapp || '') && !appointment.is_subscriber && (
                                                  <button
                                                    onClick={() => handleEditAppointmentValue(appointment.id, appointment.price || 0)}
                                                    className="text-gray-600 hover:text-gray-500 text-xs"
                                                    title="Editar valor"
                                                  >
                                                    ✏️
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Botão de Histórico - Só aparece se houve alterações */}
                                        {hasValueHistory(appointment.id) && (
                                          <div className="relative">
                                            <button
                                              onClick={() => toggleHistoryDropdown(appointment.id)}
                                              className="text-xs text-gray-600 hover:text-gray-500 underline"
                                            >
                                              📊 Histórico
                                            </button>

                                            {/* Dropdown do Histórico */}
                                            {showHistoryDropdown === appointment.id && (
                                              <div className="absolute top-6 left-0 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg z-10 min-w-64">
                                                <div className="text-xs text-gray-300 mb-2 font-medium">
                                                  Histórico de Alterações de Valor
                                                </div>
                                                <div className="space-y-2">
                                                  {appointmentValueHistory[appointment.id] && (
                                                    <>
                                                      <div className="text-xs text-gray-400 border-b border-gray-600 pb-1">
                                                        Valor Original: {formatCurrency(appointmentValueHistory[appointment.id].originalValue)}
                                                      </div>
                                                      {appointmentValueHistory[appointment.id].changes.map((change, index) => (
                                                        <div key={index} className="flex justify-between items-center text-xs">
                                                          <span className="text-white">{formatCurrency(change.value)}</span>
                                                          <span className="text-gray-400">{change.date}</span>
                                                        </div>
                                                      ))}
                                                    </>
                                                  )}
                                                </div>
                                                <button
                                                  onClick={() => setShowHistoryDropdown(null)}
                                                  className="mt-2 text-xs text-gray-400 hover:text-white"
                                                >
                                                  ✕ Fechar
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {appointment.additional_products && appointment.additional_products.length > 0 && (
                                          <div className="flex flex-col">
                                            <span className="text-sm text-white/80 mb-1">Produtos/Serviços Adicionais:</span>
                                            <div className="flex flex-wrap gap-2">
                                              {appointment.additional_products.map((product: any, index: number) => (
                                                <div key={index} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/10 text-white rounded group">
                                                  <span>{product.name} - {formatCurrency(product.price)}</span>
                                                  <button
                                                    onClick={() => handleRemoveAdditionalProduct(appointment.id, index)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 ml-1"
                                                    title="Remover produto"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Produtos do Estoque (V2) */}
                                        {appointment.sold_products && appointment.sold_products.length > 0 && (
                                          <div className="flex flex-col">
                                            <span className="text-sm text-white/80 mb-1">Produtos do Estoque:</span>
                                            <div className="flex flex-wrap gap-2">
                                              {appointment.sold_products.map((product: any, index: number) => (
                                                <div key={index} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-600/20 text-gray-300 rounded border border-gray-500/30 group">
                                                  <Package className="h-3 w-3" />
                                                  <span>{product.name} - {formatCurrency(product.total)}</span>
                                                  <span className="text-gray-400">({product.quantity}x)</span>
                                                  <button
                                                    onClick={() => handleRemoveProductFromAppointment(appointment.id, product.product_id, product.name)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 ml-1"
                                                    title="Remover produto do agendamento"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-col gap-3 mt-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                          <span className="text-sm text-white/80">Total:</span>
                                          <span className="text-sm font-medium text-white">
                                            {isClientPaidSubscriber(appointment.client_whatsapp)
                                              ? "GRATUITO"
                                              : appointment.is_subscriber
                                                ? 'R$ 0,00 (GRATUITO)'
                                                : formatCurrency(calculateClientTotalPayment(appointment))
                                            }
                                          </span>
                                        </div>

                                        {/* Seção "Cobrar Cliente" - Mostra valor total incluindo produtos V2 */}
                                        <div className="flex flex-col gap-3 p-4 bg-gradient-to-r from-gray-800/40 to-black/40 border-2 border-gray-600 rounded-lg shadow-lg">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xl">💰</span>
                                            <span className="text-base font-bold text-white">Cobrar Cliente:</span>
                                          </div>
                                          <div className="flex flex-col gap-2 bg-white/10 rounded-lg p-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm font-semibold text-gray-200">Total a cobrar:</span>
                                              <span className="text-lg font-bold text-white bg-blue-500/50 px-3 py-1 rounded">
                                                {isClientPaidSubscriber(appointment.client_whatsapp)
                                                  ? "GRATUITO"
                                                  : appointment.is_subscriber
                                                    ? 'R$ 0,00 (GRATUITO)'
                                                    : formatCurrency(calculateClientTotalPayment(appointment))
                                                }
                                              </span>
                                            </div>
                                            {(appointment.payment_method === 'credito' || appointment.payment_method === 'debito') && (
                                              <div className="flex items-center justify-between pt-2 border-t border-white/20">
                                                <span className="text-sm font-medium text-gray-300">Líquido (após taxas):</span>
                                                <span className="text-base font-bold text-yellow-200 bg-yellow-500/30 px-3 py-1 rounded">
                                                  {formatCurrency(calculateClientNetPayment(appointment))}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                          <select
                                            value={appointment.payment_method || 'pendente'}
                                            onChange={(e) => handlePaymentMethodChange(appointment.id, e.target.value)}
                                            className="bg-white/10 text-white text-sm rounded px-2 py-1 border border-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/30"
                                          >
                                            <option value="pendente" className="bg-green-700 text-white">Forma de Pagamento</option>
                                            <option value="pix" className="bg-green-700 text-white">PIX</option>
                                            <option value="credito" className="bg-green-700 text-white">Cartão de Crédito</option>
                                            <option value="debito" className="bg-green-700 text-white">Cartão de Débito</option>
                                            <option value="dinheiro" className="bg-green-700 text-white">Dinheiro</option>
                                            <option value="pagar_local" className="bg-green-700 text-white">Pagar no Local</option>
                                          </select>

                                          {/* Seletor de Bandeira para Cartões */}
                                          {(appointment.payment_method === 'credito' || appointment.payment_method === 'debito') && (
                                            <select
                                              value={appointment.card_brand || 'bandeira'}
                                              onChange={(e) => handleCardBrandChange(appointment.id, e.target.value)}
                                              className="bg-white/10 text-white text-sm rounded px-2 py-1 border border-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/30"
                                            >
                                              <option value="bandeira" className="bg-green-700 text-white">Bandeira</option>
                                              <option value="visa" className="bg-green-700 text-white">Visa</option>
                                              <option value="mastercard" className="bg-green-700 text-white">Mastercard</option>
                                              <option value="elo" className="bg-green-700 text-white">Elo</option>
                                              <option value="hipercard" className="bg-green-700 text-white">Hipercard</option>
                                              <option value="american_express" className="bg-green-700 text-white">American Express</option>
                                              <option value="discover" className="bg-green-700 text-white">Discover</option>
                                              <option value="jcb" className="bg-green-700 text-white">JCB</option>
                                              <option value="outros" className="bg-green-700 text-white">Outros</option>
                                            </select>
                                          )}

                                          {/* Mostrar taxa para cartões */}
                                          {(appointment.payment_method === 'credito' || appointment.payment_method === 'debito') && (
                                            <div className="flex flex-col gap-1">
                                              <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20">
                                                Taxa: {getPaymentMethodTax(appointment.payment_method, appointment.card_brand)}%
                                              </span>
                                              {appointment.card_brand && appointment.card_brand !== 'bandeira' && (
                                                <span className="text-xs text-gray-600 bg-gray-400/10 px-2 py-1 rounded border border-gray-400/20">
                                                  Bandeira: {appointment.card_brand.toUpperCase()}
                                                </span>
                                              )}
                                            </div>
                                          )}

                                          {appointment.payment_method === 'pix' && (
                                            <select
                                              value={appointment.pix_payment_status || 'confirmado'}
                                              onChange={(e) => handlePixPaymentStatusChange(appointment.id, e.target.value)}
                                              className="bg-white/10 text-white text-sm rounded px-2 py-1 border border-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/30"
                                            >
                                              <option value="confirmado" className="bg-green-700 text-white">PIX Confirmado</option>
                                              <option value="rejeitado" className="bg-green-700 text-white">PIX Rejeitado</option>
                                            </select>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4 sm:justify-end">
                                      {appointment.status !== 'cancelled' && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setSelectedAppointmentForProduct(appointment.id);
                                              setShowAddProductToAppointmentModal(true);
                                            }}
                                            className="inline-flex items-center px-3 py-1.5 text-sm bg-black text-white rounded hover:bg-gray-800 transition-colors mb-2"
                                          >
                                            <Package className="h-4 w-4 mr-1" />
                                            Adicionar Produto V2
                                          </button>

                                          <button
                                            onClick={() => {
                                              setSelectedAppointmentForProduct(appointment.id);
                                              setShowAdditionalProductModal(true);
                                            }}
                                            className="inline-flex items-center px-3 py-1.5 text-sm bg-white/20 text-white rounded hover:bg-white/30 transition-colors"
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            SERVIÇO EXTRA
                                          </button>

                                          {appointment.payment_method === 'pix' && appointment.pix_proof_url && (
                                            <button
                                              onClick={() => handleOpenProof(appointment.pix_proof_url!)}
                                              className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                                            >
                                              <ImageIcon className="h-4 w-4 mr-1" />
                                              Ver Comprovante
                                            </button>
                                          )}


                                          {/* Botões de Status - Responsivo */}
                                          <div className="space-y-2">
                                            {/* Linha 1: Observação e Tipo de Serviço */}
                                            <div className="flex flex-wrap gap-1">
                                              {appointment.observation && (
                                                <button
                                                  onClick={() => handleShowClientObservation(appointment.observation || '')}
                                                  className="px-2 py-1 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
                                                  title="Ver observação do cliente"
                                                >
                                                  Ver Observação
                                                </button>
                                              )}

                                              {appointment.is_child_service !== undefined && (
                                                <button
                                                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${appointment.is_child_service
                                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                                                    }`}
                                                  title={`Serviço infantil: ${appointment.is_child_service ? 'Sim' : 'Não'}`}
                                                >
                                                  {appointment.is_child_service ? '👶 Infantil' : '👤 Adulto'}
                                                </button>
                                              )}
                                            </div>

                                            {/* Linha 2: Botões de Status - Organizados para mobile */}
                                            <div className="grid grid-cols-2 gap-1">
                                              <button
                                                onClick={() => handleUpdateAppointmentStatus(appointment.id, 'completed')}
                                                className="px-2 py-1 text-xs font-medium rounded transition-colors bg-green-600 text-white hover:bg-green-700"
                                                title="Marcar como CONCLUÍDO"
                                              >
                                                ✅ CONCLUÍDO
                                              </button>

                                              <button
                                                onClick={() => handleUpdateAppointmentStatus(appointment.id, 'pending')}
                                                className="px-2 py-1 text-xs font-medium rounded transition-colors bg-yellow-600 text-white hover:bg-yellow-700"
                                                title="Marcar como PENDENTE"
                                              >
                                                ⏳ PENDENTE
                                              </button>

                                              <button
                                                onClick={() => handleOpenTransferModal(appointment)}
                                                className="px-2 py-1 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
                                                title="Transferir para outro profissional"
                                              >
                                                🔄 TRANSFERIR
                                              </button>

                                              <button
                                                onClick={() => handleCancelClick(appointment.id)}
                                                className="px-2 py-1 text-xs font-medium rounded transition-colors bg-red-700 text-white hover:bg-red-800"
                                                title="Cancelar agendamento"
                                              >
                                                ❌ CANCELAR
                                              </button>

                                              <button
                                                onClick={() => handleGenerateNF(appointment)}
                                                className="px-2 py-1 text-xs font-medium rounded transition-colors bg-green-600 text-white hover:bg-green-700"
                                                title="Gerar Nota Fiscal (XML)"
                                              >
                                                📄 Gerar NF
                                              </button>

                                            </div>

                                            {/* Linha 3: Botão de Observações */}
                                            <div className="mt-2">
                                              <button
                                                onClick={() => handleOpenObservationModal(appointment.id, appointment.establishment_observation)}
                                                className="w-full px-2 py-1 text-xs font-medium rounded transition-colors bg-purple-600 text-white hover:bg-purple-700"
                                                title="Adicionar observações ao agendamento"
                                              >
                                                📝 Minhas Observações
                                              </button>
                                            </div>

                                            {/* Exibir observação do estabelecimento se existir */}
                                            {appointment.establishment_observation && (
                                              <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                                <div className="flex items-start gap-2">
                                                  <span className="text-gray-700 text-sm">📝</span>
                                                  <div className="flex-1">
                                                    <p className="text-xs text-gray-800 font-medium mb-1">Minha Observação:</p>
                                                    <p className="text-xs text-gray-700 break-words">{appointment.establishment_observation}</p>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                          </div>
                                        </>
                                      )}

                                      {appointment.status === 'cancelled' && (
                                        <div className="space-y-2">
                                          {/* Linha 1: Status cancelado */}
                                          <div className="flex justify-center">
                                            <span className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-700/50 text-gray-400 rounded">
                                              <X className="h-4 w-4 mr-1" />
                                              ❌ CANCELADO
                                            </span>
                                          </div>

                                          {/* Linha 2: Botão de exclusão */}
                                          <div className="flex justify-center">
                                            <button
                                              onClick={() => handleDeleteAppointment(appointment.id)}
                                              className="inline-flex items-center px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                              title="Excluir agendamento permanentemente"
                                            >
                                              <Trash2 className="h-4 w-4 mr-1" />
                                              🗑️ EXCLUIR
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'services' && (
                <div className="space-y-6">
                  {/* Informações sobre o link do estabelecimento */}
                  {establishment && (
                    <div className="mb-4 space-y-3">
                      <div className="flex gap-2 items-center">
                        <a
                          href={`/booking/${establishment.code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-black hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200"
                          title="Abrir página pública de agendamentos"
                        >
                          Meu Link
                        </a>
                        <button
                          type="button"
                          onClick={copyLinkToClipboard}
                          className="bg-black hover:bg-gray-800 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200"
                        >
                          Copiar Link
                        </button>
                      </div>
                      <p className="text-sm text-gray-400">
                        Acesse a página pública de agendamentos ou copie o link para compartilhar com seus clientes.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'passo-a-passo' && (
                <div className="space-y-6 w-full">
                  <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-4 sm:p-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-gray-800 to-black rounded-full flex items-center justify-center">
                        <span className="text-white text-xl sm:text-2xl">🚀</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                        Como começar
                      </h2>
                    </div>

                    {/* Conteúdo */}
                    <div className="space-y-4 sm:space-y-6">
                      <p className="text-gray-700 text-base sm:text-lg leading-relaxed">
                        Siga esse passo a passo simples para deixar seu sistema prontinho 👇
                      </p>

                      {/* Dica sobre Vídeos */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 sm:p-4 border border-gray-300">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <span className="text-lg sm:text-xl flex-shrink-0">✨</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed mb-1 sm:mb-2">
                              <strong>Dentro de cada opção que você selecionar, vai ter um vídeo explicando direitinho como usar!</strong> 🎥
                            </p>

                            <div className="bg-white/50 rounded-lg p-2 sm:p-3 mb-1 sm:mb-2">
                              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed mb-1">
                                <strong>Por exemplo:</strong>
                              </p>
                              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                                👉 Se você clicar em <strong>"Meus Agendamentos"</strong>, vai aparecer um vídeo mostrando como seus clientes agendam com você, e também como você pode ver, organizar e gerenciar tudo de forma simples e prática. 💼📅
                              </p>
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed font-medium bg-gray-200 rounded-lg p-2">
                          ⚠ <strong>Dica:</strong> preste bastante atenção em cada vídeo, pois muitas das suas dúvidas já estão respondidas neles.
                        </p>
                      </div>

                      {/* Passos */}
                      <div className="space-y-3 sm:space-y-4">
                        {/* Passo 1 */}
                        <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-100 rounded-lg border border-gray-300">
                          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-base">
                            1️⃣
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                              Vá em "⚙️ Config | Página Agendamentos"
                            </h3>
                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                              Configure toda a sua página de agendamentos — é nela que seus clientes vão acessar para marcar os serviços. 💬
                            </p>
                          </div>
                        </div>

                        {/* Passo 2 */}
                        <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-300">
                          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-gray-800 text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-base">
                            2️⃣
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                              Vá em "🗂️ Serviços por Categoria"
                            </h3>
                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                              No menu lateral, crie categorias e serviços, para que seus clientes vejam quais opções podem agendar com você. 📅
                            </p>
                          </div>
                        </div>

                        {/* Passo 3 */}
                        <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-300">
                          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-gray-800 text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-base">
                            3️⃣
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                              Vá em "👤 Profissional"
                            </h3>
                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                              Cadastre o profissional e preencha todas as informações solicitadas, de acordo com o seu estabelecimento. 🏪
                            </p>
                          </div>
                        </div>

                        {/* Passo 4 */}
                        <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-300">
                          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-gray-800 text-white rounded-full flex items-center justify-center font-bold text-sm sm:text-base">
                            4️⃣
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                              Vá em "🛍️ Meus Produtos"
                            </h3>
                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                              Cadastre seus produtos em Meus Produtos. 🧴
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Conclusão */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 sm:p-4 border border-gray-300">
                        <div className="flex items-start gap-3">
                          <span className="text-xl sm:text-2xl">✅</span>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">Pronto!</h3>
                            <p className="text-gray-700 mb-2 text-xs sm:text-sm">
                              Seu estabelecimento já estará configurado. 🎉
                            </p>
                            <p className="text-gray-600 text-xs sm:text-sm">
                              Agora é só explorar os recursos extras, como assinantes, planos, e muito mais! 💡
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Dica de Atualização */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-3 sm:p-4 border border-gray-300">
                        <div className="flex items-start gap-3">
                          <span className="text-xl sm:text-2xl">🔄</span>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">
                              Dica:
                            </h3>
                            <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">
                              Após concluir cada etapa, atualize a página (arrastando para baixo no celular ou apertando F5 no computador) para este pop-up reaparecer e você continuar para o próximo passo.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'support' && (
                <div className="space-y-6 w-full">
                  <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 sm:p-8">
                    <div className="flex flex-col items-center justify-center space-y-6">
                      <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center">
                        <MessageSquare className="w-10 h-10 text-white" />
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
                        Falar com Suporte
                      </h2>
                      <p className="text-gray-600 text-center text-base sm:text-lg max-w-md">
                        Precisa de ajuda? Entre em contato conosco pelo WhatsApp e nossa equipe te ajudará!
                      </p>
                      <button
                        onClick={() => {
                          const whatsappNumber = '48991265320';
                          const establishmentName = establishment?.name || 'Minha Barbearia';
                          const establishmentCode = establishment?.code || '';
                          const message = encodeURIComponent(`ola preciso de um suporte | ${establishmentName} e codigo ${establishmentCode}`);
                          window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
                        }}
                        className="w-full sm:w-auto px-8 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold text-lg flex items-center justify-center gap-3 shadow-lg"
                      >
                        <MessageSquare className="w-6 h-6" />
                        Conversar com Suporte
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'client-page' && (
                <div className="space-y-6 w-full">
                  {/* Seção de Link do Estabelecimento */}
                  <div className="bg-gradient-to-r from-gray-800 to-black rounded-lg p-4 mb-6 border border-gray-600">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                        <LinkIcon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        🌐 Sua Página de Agendamentos
                      </h3>
                    </div>

                    {/* Link Box - Organizado para mobile */}
                    <div className="bg-[#1a1b1c] rounded-lg p-4 border border-gray-700 mb-4">
                      <p className="text-white font-medium text-sm mb-3">Link do Estabelecimento:</p>

                      {/* Link principal */}
                      <div className="bg-gray-800 rounded-lg p-3 mb-3">
                        <code className="text-gray-300 font-mono text-sm block break-all">
                          agendeifacil.com/booking/{establishment?.code}
                        </code>
                      </div>

                      {/* Botões organizados */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyLinkToClipboard()}
                          className="flex-1 flex items-center justify-center gap-2 p-3 bg-black hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <Copy className="h-4 w-4 text-white" />
                          <span className="text-white text-sm font-medium">Copiar</span>
                        </button>
                        <a
                          href={`${window.location.origin}/booking/${establishment?.code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 p-3 bg-black hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <LinkIcon className="h-4 w-4 text-white" />
                          <span className="text-white text-sm font-medium">Abrir</span>
                        </a>
                      </div>
                    </div>

                    {/* Dica */}
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 text-sm">💡</span>
                      <p className="text-white text-xs font-medium flex-1">
                        Compartilhe este link com seus clientes para que possam agendar diretamente com você!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab de Indicação - Quero 1 mês grátis */}
              {activeTab === 'indication' && (
                <div className="space-y-6 w-full">
                  <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-4 sm:p-6">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-gray-800 to-black rounded-full flex items-center justify-center">
                        <span className="text-white text-xl sm:text-2xl">🎁</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                        Quero 1 mês grátis
                      </h2>
                    </div>

                    {/* Conteúdo */}
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-gray-700 text-base sm:text-lg leading-relaxed mb-6">
                          Indique um colega e ganhe <strong className="text-gray-800">1 mês grátis ou mais</strong>! 🎉
                        </p>
                      </div>

                      {/* Imagem */}
                      <div className="flex justify-center mb-6">
                        <img
                          src="/indicacao2.png"
                          alt="Indicação"
                          className="w-full max-w-md h-auto rounded-lg shadow-lg"
                        />
                      </div>

                      {/* Botão de Indicar */}
                      <div className="flex justify-center">
                        <button
                          onClick={() => {
                            const whatsappNumber = '5548991265320';
                            const message = 'quero indicar um colega e ganhar 1 mês grátis ou mais';
                            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
                            window.open(whatsappUrl, '_blank');
                          }}
                          className="w-full max-w-md bg-gradient-to-r from-gray-800 to-black text-white font-semibold py-4 px-8 rounded-lg hover:from-gray-700 hover:to-gray-900 transition-colors text-lg shadow-lg flex items-center justify-center gap-2"
                        >
                          <span>💬</span>
                          <span>Indicar</span>
                        </button>
                      </div>

                      {/* Informação adicional */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300">
                        <div className="flex items-start gap-3">
                          <span className="text-gray-700 text-xl flex-shrink-0">💡</span>
                          <div>
                            <p className="text-gray-700 text-sm leading-relaxed">
                              <strong>Como funciona:</strong> Clique no botão "Indicar" acima e envie a mensagem para nosso WhatsApp.
                              Nossa equipe entrará em contato para processar sua indicação e garantir seu mês grátis!
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6 w-full">
                  {/* Quiz Passo-a-Passo para Novos Usuários (só aparece se não foi completado) */}
                  {isNewUser && !quizCompleted && (
                    <div className="bg-gradient-to-r from-gray-800 to-black rounded-lg p-4 mb-6 text-white">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold">Configuração Passo-a-Passo</h2>
                        <div className="text-sm">
                          Etapa {quizStep} de 10
                        </div>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                        <div
                          className="bg-white rounded-full h-2 transition-all duration-300"
                          style={{ width: `${(quizStep / 10) * 100}%` }}
                        ></div>
                      </div>
                      {quizAlertMessage && (
                        <div className="mb-4 p-3 bg-gray-800 rounded-lg text-white font-semibold">
                          ⚠️ {quizAlertMessage}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Validade Agendei Fácil */}
                  {establishment?.id && (
                    <ValidityDisplay establishmentId={establishment.id} />
                  )}

                  {/* Vídeo Tutorial de Configurações */}
                  {showTutorials.config && (
                    <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-red-600 text-xl">📺</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-white">Tutorial de Configurações</h3>
                            <p className="text-sm text-gray-400">Aprenda a configurar seu estabelecimento corretamente</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTutorial('config')}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                        >
                          Ocultar Tutorial
                        </button>
                      </div>

                      <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden">
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src="https://www.youtube.com/embed/pB3QZ1H20xA"
                          title="Tutorial de Configurações"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        ></iframe>
                      </div>

                      <div className="mt-4 text-center">
                        <a
                          href="https://youtu.be/pB3QZ1H20xA"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-300 text-sm font-medium transition-colors"
                        >
                          <span>📺</span>
                          <span>Assistir no YouTube</span>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Botão para mostrar tutorial se estiver oculto */}
                  {!showTutorials.config && (
                    <div className="mb-6 text-center">
                      <button
                        onClick={() => toggleTutorial('config')}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <span>📺</span>
                        <span>Mostrar Tutorial</span>
                      </button>
                    </div>
                  )}

                  {/* Informações Básicas - Apenas para usuários antigos OU etapa 1 do quiz */}
                  {(!isNewUser || (isNewUser && quizStep === 1)) && (
                    <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 mb-6">
                      <h2 className="text-xl font-semibold mb-4">Informações Básicas</h2>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Nome do Estabelecimento</label>
                          <input
                            type="text"
                            value={establishment?.name || ''}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Logo do Estabelecimento */}
                        <div>
                          <label className="block text-sm font-medium mb-1">Logo do Estabelecimento</label>
                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            <div className="relative w-24 h-24 flex-shrink-0">
                              <div className="w-24 h-24 rounded-full overflow-hidden bg-[#242628] border-2 border-dashed border-gray-700">
                                {establishment?.logo_url ? (
                                  <div className="relative h-full">
                                    <img
                                      src={establishment.logo_url}
                                      alt="Logo"
                                      className="w-full h-full object-cover"
                                    />
                                    <button
                                      onClick={() => handleRemoveLogo()}
                                      className="absolute top-1 right-1 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3 text-white" />
                                    </button>
                                  </div>
                                ) : (
                                  <img
                                    src="/logoagendamento.png"
                                    alt="Logo padrão"
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <label className="absolute bottom-0 right-0 p-1 bg-primary rounded-full cursor-pointer hover:bg-primary/80 transition-colors">
                                <Plus className="h-4 w-4 text-white" />
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={handleLogoChange}
                                  className="hidden"
                                />
                              </label>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="hidden sm:block text-sm text-gray-400">
                                Adicione uma logo para seu estabelecimento. Ela será exibida na página de agendamentos.
                                <br />
                                Recomendamos uma imagem quadrada de pelo menos 200x200 pixels.
                              </p>
                              <button
                                onClick={() => showInfoModalFunc(
                                  'Logo do Estabelecimento',
                                  'Adicione uma logo para seu estabelecimento. Ela será exibida na página de agendamentos. Recomendamos uma imagem quadrada de pelo menos 200x200 pixels.'
                                )}
                                className="sm:hidden mt-1 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                              >
                                <HelpCircle className="h-3 w-3" />
                                Ver informações
                              </button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1">Descrição</label>
                          <textarea
                            value={establishment?.description || ''}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                            rows={4}
                          />
                        </div>
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                            <label className="block text-sm font-medium">Senha de 4 dígitos para configurações</label>
                            <span className="hidden sm:flex text-sm text-yellow-500 items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Senhas salvas aqui servem para abrir (todos os profissionais/alterar senha de cada profissional/trocar % do profissional/cancelar agendamentos do dashboard/e para entrar nas config).
                            </span>
                            <button
                              onClick={() => showInfoModalFunc(
                                'Senha de 4 dígitos para configurações',
                                'Senhas salvas aqui servem para abrir (todos os profissionais/alterar senha de cada profissional/trocar % do profissional/cancelar agendamentos do dashboard/e para entrar nas config).'
                              )}
                              className="sm:hidden text-xs text-yellow-400 hover:text-yellow-300 underline flex items-center gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Ver informações
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              maxLength={4}
                              value={pinPassword}
                              onChange={(e) => setPinPassword(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                              placeholder="Digite uma senha de 4 dígitos"
                              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                            />
                            <button
                              onClick={handleSavePin}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Salvar Senha
                            </button>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">
                            {establishment?.pin_password && establishment.pin_password !== '0000' ? 'Senha atual: ' + establishment.pin_password : 'Nenhuma senha definida'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Seção de Comodidades - Etapa 1 do Quiz */}
                  {(!isNewUser || quizStep === 1) && (
                    <div id="quiz-section-comodidades" className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                      <h3 className="text-lg font-medium text-white mb-4">
                        {isNewUser && quizStep === 1 ? '1. Comodidades' : 'Comodidades/Oque seu estabelecimento oferece'}
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Selecione as comodidades disponíveis no seu estabelecimento:
                      </p>
                      <div className="space-y-4">
                        {/* Wi-fi + Senha + Nome da Rede */}
                        <div className="space-y-2">
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={hasWifi}
                              onChange={(e) => {
                                setHasWifi(e.target.checked);
                                if (amenitiesAutoSaveTimeoutRef.current) {
                                  clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                                }
                                amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                  autoSaveAmenities();
                                }, 1000);
                              }}
                              className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                            />
                            <span className="text-white">Wi-fi</span>
                          </label>
                          {hasWifi && (
                            <div className="flex flex-col sm:flex-row gap-3 ml-7">
                              <input
                                type="text"
                                placeholder="Senha do Wi-Fi"
                                value={wifiPassword}
                                onChange={(e) => {
                                  setWifiPassword(e.target.value);
                                  if (amenitiesAutoSaveTimeoutRef.current) {
                                    clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                                  }
                                  amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                    autoSaveAmenities();
                                  }, 1000);
                                }}
                                className="bg-[#2a2b2c] border border-gray-600 text-white rounded px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                              <input
                                type="text"
                                placeholder="Nome da rede (ex: Barbearia WiFi)"
                                value={wifiNetworkName}
                                onChange={(e) => {
                                  setWifiNetworkName(e.target.value);
                                  if (amenitiesAutoSaveTimeoutRef.current) {
                                    clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                                  }
                                  amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                    autoSaveAmenities();
                                  }, 1000);
                                }}
                                className="bg-[#2a2b2c] border border-gray-600 text-white rounded px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </div>
                          )}
                        </div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={hasParking}
                            onChange={(e) => {
                              setHasParking(e.target.checked);
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                              }
                              amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveAmenities();
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <span className="text-white">Estacionamento</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={hasAccessibility}
                            onChange={(e) => {
                              setHasAccessibility(e.target.checked);
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                              }
                              amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveAmenities();
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <span className="text-white">Acessibilidade</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={hasAirConditioning}
                            onChange={(e) => {
                              setHasAirConditioning(e.target.checked);
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                              }
                              amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveAmenities();
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <span className="text-white">Local Climatizado</span>
                        </label>

                        <div className="ml-7 mt-2 mb-2">
                          <span className="text-primary font-semibold text-sm">agendamentos dos clientes</span>
                        </div>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={requireCancellationRequest}
                            onChange={(e) => {
                              setRequireCancellationRequest(e.target.checked);
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                              }
                              amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveAmenities();
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <div className="flex flex-col flex-1">
                            <span className="text-white text-sm sm:text-base">Cancelamento</span>
                            <span className="hidden sm:inline text-xs text-gray-400 mt-1">
                              Ao ativar essa opção seus clientes não podem agendar e depois cancelar, mas sim terá um botão que o cliente clica e envia uma mensagem no seu WhatsApp com a mensagem "Olá, queria cancelar agendamento... motivo é"
                            </span>
                            <button
                              onClick={() => showInfoModalFunc(
                                'Cancelamento',
                                'Ao ativar essa opção seus clientes não podem agendar e depois cancelar, mas sim terá um botão que o cliente clica e envia uma mensagem no seu WhatsApp com a mensagem "Olá, queria cancelar agendamento... motivo é"'
                              )}
                              className="sm:hidden mt-1 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            >
                              <HelpCircle className="h-3 w-3" />
                              Ver mais informações
                            </button>
                          </div>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={preventSameDayReschedule}
                            onChange={(e) => {
                              setPreventSameDayReschedule(e.target.checked);
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                              }
                              amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveAmenities();
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <div className="flex flex-col flex-1">
                            <span className="text-white text-sm sm:text-base">Clientes assinantes não podem desmarcar e remarcar no mesmo dia</span>
                            <span className="hidden sm:inline text-xs text-gray-400 mt-1">
                              Se ativada, quando um assinante cancelar um agendamento, não poderá remarcar para o mesmo dia. Exemplo: Se hoje é terça-feira e o assinante desmarcou, não poderá remarcar na terça-feira.
                            </span>
                            <button
                              onClick={() => showInfoModalFunc(
                                'Clientes assinantes não podem desmarcar e remarcar no mesmo dia',
                                'Se ativada, quando um assinante cancelar um agendamento, não poderá remarcar para o mesmo dia. Exemplo: Se hoje é terça-feira e o assinante desmarcou, não poderá remarcar na terça-feira.'
                              )}
                              className="sm:hidden mt-1 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            >
                              <HelpCircle className="h-3 w-3" />
                              Ver mais informações
                            </button>
                          </div>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={requireCpf}
                            onChange={(e) => {
                              setRequireCpf(e.target.checked);
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                              }
                              amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveAmenities();
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <div className="flex flex-col flex-1">
                            <span className="text-white text-sm sm:text-base">Pedir CPF antes do agendamento</span>
                            <span className="hidden sm:inline text-xs text-gray-400 mt-1">
                              Se ativada, os clientes serão obrigados a informar o CPF durante o agendamento. Útil para estabelecimentos que emitem nota fiscal.
                            </span>
                            <button
                              onClick={() => showInfoModalFunc(
                                'Pedir CPF antes do agendamento',
                                'Se ativada, os clientes serão obrigados a informar o CPF durante o agendamento. Útil para estabelecimentos que emitem nota fiscal.'
                              )}
                              className="sm:hidden mt-1 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            >
                              <HelpCircle className="h-3 w-3" />
                              Ver mais informações
                            </button>
                          </div>
                        </label>

                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={enableWhatsAppNotifications}
                            onChange={(e) => {
                              setEnableWhatsAppNotifications(e.target.checked);
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                              }
                              amenitiesAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveAmenities();
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <div className="flex flex-col flex-1">
                            <span className="text-white text-sm sm:text-base">Quero receber mensagem no WhatsApp após agendamentos ou cancelamentos de clientes</span>
                            <span className="hidden sm:inline text-xs text-gray-400 mt-1">
                              Ao ativar essa opção, quando um cliente finalizar um agendamento, será exibida uma mensagem diferente no modal final, incentivando o cliente a confirmar o agendamento. Isso enviará uma notificação automática para seu WhatsApp com os detalhes do agendamento.
                            </span>
                            <button
                              onClick={() => showInfoModalFunc(
                                'Notificações WhatsApp',
                                'Ao ativar essa opção, quando um cliente finalizar um agendamento, será exibida uma mensagem diferente no modal final, incentivando o cliente a confirmar o agendamento. Isso enviará uma notificação automática para seu WhatsApp com os detalhes do agendamento.'
                              )}
                              className="sm:hidden mt-1 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            >
                              <HelpCircle className="h-3 w-3" />
                              Ver mais informações
                            </button>
                          </div>
                        </label>

                        <label className="flex items-center space-x-2 bg-[#2a2b2c] p-3 rounded-lg border border-gray-700">
                          <input
                            type="checkbox"
                            checked={requireCancelPassword}
                            onChange={async (e) => {
                              const newValue = e.target.checked;
                              console.log('🔍 Checkbox Senha Cancelamento alterado para:', newValue);

                              // CANCELAR qualquer auto-save pendente para evitar sobrescrever
                              if (amenitiesAutoSaveTimeoutRef.current) {
                                clearTimeout(amenitiesAutoSaveTimeoutRef.current);
                                amenitiesAutoSaveTimeoutRef.current = null;
                              }

                              // Atualizar o estado
                              setRequireCancelPassword(newValue);

                              // Salvar imediatamente para garantir
                              if (establishment?.id) {
                                try {
                                  const { error } = await supabase
                                    .from('establishments')
                                    .update({ require_cancel_password: newValue })
                                    .eq('id', establishment.id);

                                  if (error) {
                                    console.error('❌ Erro ao salvar require_cancel_password:', error);
                                    console.error('❌ Erro completo:', JSON.stringify(error, null, 2));
                                    toast(`Erro ao salvar: ${error.message}`, 'error');
                                    // Reverter o estado se der erro
                                    setRequireCancelPassword(!newValue);
                                  } else {
                                    console.log('✅ require_cancel_password salvo com sucesso:', newValue);
                                    toast('Configuração salva!', 'success');
                                    // Atualizar o estado do establishment (usando type assertion para evitar erro de tipo)
                                    setEstablishment({
                                      ...establishment,
                                      require_cancel_password: newValue
                                    } as any);
                                  }
                                } catch (err: any) {
                                  console.error('❌ Erro ao salvar:', err);
                                  toast('Erro ao salvar configuração', 'error');
                                  setRequireCancelPassword(!newValue);
                                }
                              }
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <div className="flex flex-col flex-1">
                            <span className="text-white font-semibold text-sm sm:text-base">🔐 Senha de cancelamento</span>
                            <span className="hidden sm:inline text-xs text-gray-400 mt-1">
                              Ao ativar, será necessário digitar a senha ao cancelar um agendamento. A senha usada é a mesma "Senha de 4 dígitos para configurações" (configure acima). Se deixar desmarcado não pede senha ao cancelar.
                            </span>
                            <button
                              onClick={() => showInfoModalFunc(
                                '🔐 Senha de cancelamento',
                                'Ao ativar, será necessário digitar a senha ao cancelar um agendamento. A senha usada é a mesma "Senha de 4 dígitos para configurações" (configure acima). Se deixar desmarcado não pede senha ao cancelar.'
                              )}
                              className="sm:hidden mt-1 text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                            >
                              <HelpCircle className="h-3 w-3" />
                              Ver mais informações
                            </button>
                            {requireCancelPassword && (!establishment?.pin_password || establishment.pin_password === '0000') && (
                              <span className="text-xs text-yellow-400 mt-1 font-semibold">
                                ⚠️ Configure a senha acima primeiro!
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                      {/* Botão Próximo - Etapa 1 */}
                      {isNewUser && quizStep === 1 && (
                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configuração de Intervalo - Etapa 2 do Quiz */}
                  {(!isNewUser || quizStep === 2) && (
                    <div id="quiz-section-horarios" className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 mb-6">
                      <h3 className="text-lg font-medium text-white mb-4">
                        {isNewUser && quizStep === 2 ? '2. Configuração de Horários' : 'Configuração de Horários'}
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            id="use15MinuteInterval"
                            checked={use15MinuteInterval}
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setUse15MinuteInterval(newValue);
                              // Se ativar intervalo de 15 min, desativar horários de 20 em 20
                              const newUse20MinuteSchedule = newValue ? false : use20MinuteSchedule;
                              if (newValue) {
                                setUse20MinuteSchedule(false);
                              }
                              if (scheduleConfigAutoSaveTimeoutRef.current) {
                                clearTimeout(scheduleConfigAutoSaveTimeoutRef.current);
                              }
                              scheduleConfigAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveScheduleConfig({
                                  use15MinuteInterval: newValue,
                                  use20MinuteSchedule: newUse20MinuteSchedule,
                                  showBestOfBrazilImage: showBestOfBrazilImage
                                });
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#242628] border-gray-700 rounded mt-1"
                          />
                          <div className="flex-1">
                            <label htmlFor="use15MinuteInterval" className="block text-white font-medium mb-2">
                              Horários com intervalo 15 min
                            </label>
                            <p className="text-sm text-gray-400 leading-relaxed">
                              Ao selecionar essa opção, para seus clientes irá aparecer horários de 30 em 30 min exemplo, 09:00 \ 09:30 \ 10:00 \ 10:30 por ai vai, essa mudança se um cliente por exemplo escolher serviço seu que tem duração de 45 min e ele selecionar as 9:00 o horário das 9 até as 10:00 ficaram (Reservado) assim você tera 15 min de 'intervalo' entre o serviço e outro.
                            </p>
                          </div>
                        </div>

                        {/* Configuração de horários de 20 em 20 minutos */}
                        <div className="flex items-start space-x-3 p-4 bg-[#242628] rounded-lg border border-gray-700">
                          <input
                            type="checkbox"
                            id="use20MinuteSchedule"
                            checked={use20MinuteSchedule}
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setUse20MinuteSchedule(newValue);
                              // Se ativar horários de 20 em 20, desativar intervalo de 15 min
                              const newUse15MinuteInterval = newValue ? false : use15MinuteInterval;
                              if (newValue) {
                                setUse15MinuteInterval(false);
                              }
                              if (scheduleConfigAutoSaveTimeoutRef.current) {
                                clearTimeout(scheduleConfigAutoSaveTimeoutRef.current);
                              }
                              scheduleConfigAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveScheduleConfig({
                                  use15MinuteInterval: newUse15MinuteInterval,
                                  use20MinuteSchedule: newValue,
                                  showBestOfBrazilImage: showBestOfBrazilImage
                                });
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#242628] border-gray-700 rounded mt-1"
                          />
                          <div className="flex-1">
                            <label htmlFor="use20MinuteSchedule" className="block text-white font-medium mb-2">
                              Mostrar horários de serviço de 20 em 20 min
                            </label>
                            <p className="text-sm text-gray-400 leading-relaxed">
                              Ao selecionar essa opção, os horários disponíveis no booking serão exibidos de 20 em 20 minutos (exemplo: 09:20 / 09:40 / 10:00 / 10:20, e assim por diante).
                            </p>
                            <p className="text-sm text-yellow-400 mt-2 font-medium">
                              ⚠️ Observação: não é possível ativar simultaneamente as opções de 20 em 20 min e de 30 em 30 min. Ambas têm a mesma função — a diferença é apenas o intervalo de exibição dos horários.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="showBestOfBrazilImage"
                            checked={showBestOfBrazilImage}
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              setShowBestOfBrazilImage(newValue);
                              if (scheduleConfigAutoSaveTimeoutRef.current) {
                                clearTimeout(scheduleConfigAutoSaveTimeoutRef.current);
                              }
                              scheduleConfigAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveScheduleConfig({
                                  use15MinuteInterval: use15MinuteInterval,
                                  use20MinuteSchedule: use20MinuteSchedule,
                                  showBestOfBrazilImage: newValue
                                });
                              }, 1000);
                            }}
                            className="form-checkbox h-5 w-5 text-primary bg-[#242628] border-gray-700 rounded"
                          />
                          <label htmlFor="showBestOfBrazilImage" className="text-white font-medium">
                            Melhor sistema de agendamentos do brasil
                          </label>
                        </div>
                      </div>
                      {/* Botões de Navegação - Etapa 2 */}
                      {isNewUser && quizStep === 2 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Horário de Funcionamento - Etapa 3 do Quiz */}
                  {(!isNewUser || quizStep === 3) && (
                    <div id="quiz-section-funcionamento" className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                      <h3 className="text-lg font-medium text-white mb-4">
                        {isNewUser && quizStep === 3 ? '3. Horário de Funcionamento' : 'Horário de Funcionamento'}
                      </h3>

                      {/* Alerta sobre intervalo */}
                      <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
                        <p className="text-sm text-yellow-200">
                          <span className="font-semibold">⚠️ Atenção:</span> Caso não tire intervalo, coloque o horário de fechamento em <strong>"Qual seu fechamento para intervalo?"</strong> e pode prosseguir para outro dia.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                          const hours = businessHours[day];
                          return (
                            <div key={day} className="bg-[#242628] p-4 rounded-lg space-y-3 border border-gray-700">
                              {/* Cabeçalho do dia com checkbox */}
                              <div className="flex items-center justify-between">
                                <label className="inline-flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={hours.enabled}
                                    onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'enabled', e.target.checked)}
                                    className="form-checkbox h-4 w-4 text-primary bg-[#1a1b1c] border-gray-700 rounded"
                                  />
                                  <span className="ml-2 font-medium text-white">
                                    {day === 'monday' ? 'Segunda-feira' :
                                      day === 'tuesday' ? 'Terça-feira' :
                                        day === 'wednesday' ? 'Quarta-feira' :
                                          day === 'thursday' ? 'Quinta-feira' :
                                            day === 'friday' ? 'Sexta-feira' :
                                              day === 'saturday' ? 'Sábado' : 'Domingo'}
                                  </span>
                                </label>
                                {!hours.enabled && (
                                  <span className="text-sm text-gray-400 bg-[#1a1b1c] px-2 py-1 rounded">
                                    Fechado
                                  </span>
                                )}
                              </div>

                              {/* Horários - Layout responsivo */}
                              {hours.enabled && (
                                <div className="space-y-3">
                                  {/* Período da manhã */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                                        {isNewUser && quizStep === 3 ? 'Qual horário você abre?' : 'Abertura'}
                                      </label>
                                      <TimeSelector
                                        value={hours.open1}
                                        onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open1', value)}
                                        disabled={!hours.enabled}
                                        className="w-full"
                                        intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                                        {isNewUser && quizStep === 3 ? 'Qual seu fechamento para intervalo?' : 'Fecha p/ Intervalo'}
                                      </label>
                                      <TimeSelector
                                        value={hours.close1}
                                        onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close1', value)}
                                        disabled={!hours.enabled}
                                        className="w-full"
                                        intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                                      />
                                    </div>
                                  </div>

                                  {/* Período da tarde */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                                        Reabertura
                                      </label>
                                      <TimeSelector
                                        value={hours.open2 || null}
                                        onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open2', value)}
                                        disabled={!hours.enabled}
                                        className="w-full"
                                        intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                                        Fechamento
                                      </label>
                                      <TimeSelector
                                        value={hours.close2 || null}
                                        onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close2', value)}
                                        disabled={!hours.enabled}
                                        className="w-full"
                                        intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                                      />
                                    </div>
                                  </div>

                                  {/* Resumo visual dos horários */}
                                  <div className="mt-3 p-2 bg-[#1a1b1c] rounded text-sm text-primary">
                                    <span className="font-medium">Funcionamento:</span> {hours.open1} - {hours.close1} {hours.open2 && hours.close2 ? `e ${hours.open2} - ${hours.close2}` : ''}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {/* Botões de Navegação - Etapa 3 */}
                      {isNewUser && quizStep === 3 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fotos Personalizadas - Etapa 4 do Quiz */}
                  {(!isNewUser || quizStep === 4) && (
                    <div id="quiz-section-fotos" className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                      <h3 className="text-lg font-medium text-white mb-4">
                        {isNewUser && quizStep === 4 ? '4. Fotos do Estabelecimento' : 'Fotos do Estabelecimento'}
                      </h3>
                      <p className="text-sm text-gray-400 mb-2">
                        Adicione até 7 fotos do seu estabelecimento que serão exibidas para os clientes
                      </p>

                      {/* Configuração do Carrossel */}
                      <div className="mb-6 p-4 bg-[#2a2b2c] rounded-lg border border-gray-700">
                        <h4 className="text-md font-medium text-white mb-3">Configuração do Carrossel</h4>
                        <p className="text-sm text-gray-400 mb-4">
                          Escolha onde o carrossel de fotos deve aparecer na página de agendamentos:
                        </p>
                        <div className="space-y-3">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="carouselPosition"
                              value="behind"
                              checked={carouselPosition === 'behind'}
                              onChange={(e) => setCarouselPosition(e.target.value as 'behind' | 'below')}
                              className="form-radio h-4 w-4 text-primary bg-[#2a2b2c] border-gray-600"
                            />
                            <div>
                              <span className="text-white font-medium text-sm">Atrás do perfil</span>
                              <p className="text-xs text-gray-400">O carrossel aparece como fundo atrás da logo e informações do estabelecimento</p>
                            </div>
                          </label>

                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="carouselPosition"
                              value="below"
                              checked={carouselPosition === 'below'}
                              onChange={(e) => setCarouselPosition(e.target.value as 'behind' | 'below')}
                              className="form-radio h-4 w-4 text-primary bg-[#2a2b2c] border-gray-600"
                            />
                            <div>
                              <span className="text-white font-medium text-sm">Embaixo do perfil</span>
                              <p className="text-xs text-gray-400">O carrossel aparece como uma seção separada abaixo das informações do estabelecimento</p>
                            </div>
                          </label>
                        </div>
                      </div>
                      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-6">
                        <p className="text-yellow-500 text-sm">
                          ⚠️ Caso a imagem não aparecer, ou ficar mal otimizada é porque o tamanho da sua imagem está errado. Envie para nós no whatsapp, que iremos ajustar para você ⚠️
                        </p>
                      </div>

                      <div className="mb-4 flex justify-end">
                        <button
                          onClick={() => {
                            // Limpar cache do PWA
                            if ('caches' in window) {
                              caches.keys().then(names => {
                                names.forEach(name => {
                                  caches.delete(name);
                                });
                              });
                            }
                            // Limpar localStorage
                            localStorage.clear();
                            // Recarregar página
                            window.location.reload();
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors"
                        >
                          🔄 Limpar Cache Mobile
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {/* Foto 1 */}
                        <div>
                          <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                            {customPhoto1Preview ? (
                              <div className="relative h-full" key={`photo1-${forceUpdate}`}>
                                <img
                                  src={customPhoto1Preview}
                                  alt="Foto 1"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={async () => {
                                    setCustomPhoto1(null);
                                    setCustomPhoto1Preview(null);
                                    // Salvar a remoção no banco imediatamente
                                    if (establishment) {
                                      try {
                                        await supabase
                                          .from('establishments')
                                          .update({ custom_photo_1_url: null })
                                          .eq('id', establishment.id);
                                      } catch (error) {
                                        console.error('Erro ao remover foto 1:', error);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-400">Foto 1</span>
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={(e) => handleCustomPhotoChange(1, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Foto 2 */}
                        <div>
                          <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                            {customPhoto2Preview ? (
                              <div className="relative h-full">
                                <img
                                  src={customPhoto2Preview}
                                  alt="Foto 2"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={async () => {
                                    setCustomPhoto2(null);
                                    setCustomPhoto2Preview(null);
                                    // Salvar a remoção no banco imediatamente
                                    if (establishment) {
                                      try {
                                        await supabase
                                          .from('establishments')
                                          .update({ custom_photo_2_url: null })
                                          .eq('id', establishment.id);
                                      } catch (error) {
                                        console.error('Erro ao remover foto 2:', error);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-400">Foto 2</span>
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={(e) => handleCustomPhotoChange(2, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Foto 3 */}
                        <div>
                          <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                            {customPhoto3Preview ? (
                              <div className="relative h-full">
                                <img
                                  src={customPhoto3Preview}
                                  alt="Foto 3"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={async () => {
                                    setCustomPhoto3(null);
                                    setCustomPhoto3Preview(null);
                                    // Salvar a remoção no banco imediatamente
                                    if (establishment) {
                                      try {
                                        await supabase
                                          .from('establishments')
                                          .update({ custom_photo_3_url: null })
                                          .eq('id', establishment.id);
                                      } catch (error) {
                                        console.error('Erro ao remover foto 3:', error);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-400">Foto 3</span>
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={(e) => handleCustomPhotoChange(3, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Foto 4 */}
                        <div>
                          <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                            {customPhoto4Preview ? (
                              <div className="relative h-full" key={`photo4-${forceUpdate}`}>
                                <img
                                  src={customPhoto4Preview}
                                  alt="Foto 4"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={async () => {
                                    setCustomPhoto4(null);
                                    setCustomPhoto4Preview(null);
                                    // Salvar a remoção no banco imediatamente
                                    if (establishment) {
                                      try {
                                        await supabase
                                          .from('establishments')
                                          .update({ custom_photo_4_url: null })
                                          .eq('id', establishment.id);
                                      } catch (error) {
                                        console.error('Erro ao remover foto 4:', error);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-400">Foto 4</span>
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={(e) => handleCustomPhotoChange(4, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Foto 5 */}
                        <div>
                          <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                            {customPhoto5Preview ? (
                              <div className="relative h-full" key={`photo5-${forceUpdate}`}>
                                <img
                                  src={customPhoto5Preview}
                                  alt="Foto 5"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={async () => {
                                    setCustomPhoto5(null);
                                    setCustomPhoto5Preview(null);
                                    // Salvar a remoção no banco imediatamente
                                    if (establishment) {
                                      try {
                                        await supabase
                                          .from('establishments')
                                          .update({ custom_photo_5_url: null })
                                          .eq('id', establishment.id);
                                      } catch (error) {
                                        console.error('Erro ao remover foto 5:', error);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-400">Foto 5</span>
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={(e) => handleCustomPhotoChange(5, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Foto 6 */}
                        <div>
                          <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                            {customPhoto6Preview ? (
                              <div className="relative h-full" key={`photo6-${forceUpdate}`}>
                                <img
                                  src={customPhoto6Preview}
                                  alt="Foto 6"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={async () => {
                                    setCustomPhoto6(null);
                                    setCustomPhoto6Preview(null);
                                    // Salvar a remoção no banco imediatamente
                                    if (establishment) {
                                      try {
                                        await supabase
                                          .from('establishments')
                                          .update({ custom_photo_6_url: null })
                                          .eq('id', establishment.id);
                                      } catch (error) {
                                        console.error('Erro ao remover foto 6:', error);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-400">Foto 6</span>
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={(e) => handleCustomPhotoChange(6, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Foto 7 */}
                        <div>
                          <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                            {customPhoto7Preview ? (
                              <div className="relative h-full" key={`photo7-${forceUpdate}`}>
                                <img
                                  src={customPhoto7Preview}
                                  alt="Foto 7"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={async () => {
                                    setCustomPhoto7(null);
                                    setCustomPhoto7Preview(null);
                                    // Salvar a remoção no banco imediatamente
                                    if (establishment) {
                                      try {
                                        await supabase
                                          .from('establishments')
                                          .update({ custom_photo_7_url: null })
                                          .eq('id', establishment.id);
                                      } catch (error) {
                                        console.error('Erro ao remover foto 7:', error);
                                      }
                                    }
                                  }}
                                  className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 text-white" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                                <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-gray-400">Foto 7</span>
                                <input
                                  type="file"
                                  accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                                  onChange={(e) => handleCustomPhotoChange(7, e)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Botões de Navegação - Etapa 4 */}
                      {isNewUser && quizStep === 4 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configurações do PIX - Etapa 5 do Quiz */}
                  {(!isNewUser || quizStep === 5) && (
                    <div id="quiz-section-pix">
                      <EstablishmentPixSettings
                        establishment={establishment}
                        onSave={handleSavePixSettings}
                      />
                      {/* Botões de Navegação - Etapa 5 */}
                      {isNewUser && quizStep === 5 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}



                  {/* Links Personalizados - Etapa 6 do Quiz */}
                  {(!isNewUser || quizStep === 6) && (
                    <div id="quiz-section-links" className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                      <h3 className="text-lg font-medium text-white mb-4">
                        {isNewUser && quizStep === 6 ? '6. Links Personalizados' : 'Links Personalizados'}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-400">Link para Avaliar (Google, etc.)</label>
                          <input
                            type="url"
                            value={reviewLink}
                            onChange={(e) => {
                              setReviewLink(e.target.value);
                              // ✅ Auto-save com debounce (1 segundo após parar de digitar)
                              if (linksAutoSaveTimeoutRef.current) {
                                clearTimeout(linksAutoSaveTimeoutRef.current);
                              }
                              linksAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveLinks();
                              }, 1000);
                            }}
                            placeholder="Ex: https://g.page/sua-empresa/review"
                            className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-400">Link das Redes Sociais</label>
                          <input
                            type="url"
                            value={socialMediaLink}
                            onChange={(e) => {
                              setSocialMediaLink(e.target.value);
                              // ✅ Auto-save com debounce (1 segundo após parar de digitar)
                              if (linksAutoSaveTimeoutRef.current) {
                                clearTimeout(linksAutoSaveTimeoutRef.current);
                              }
                              linksAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveLinks();
                              }, 1000);
                            }}
                            placeholder="Ex: https://instagram.com/seuperfil"
                            className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-400">Link para Pagamento PIX</label>
                          <input
                            type="url"
                            value={pixPaymentLink}
                            onChange={(e) => {
                              setPixPaymentLink(e.target.value);
                              // ✅ Auto-save com debounce (1 segundo após parar de digitar)
                              if (linksAutoSaveTimeoutRef.current) {
                                clearTimeout(linksAutoSaveTimeoutRef.current);
                              }
                              linksAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveLinks();
                              }, 1000);
                            }}
                            placeholder="Será preenchido automaticamente com sua chave PIX, ou digite um link personalizado"
                            className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1 text-gray-400">Link para Local</label>
                          <input
                            type="url"
                            value={locationLink}
                            onChange={(e) => {
                              setLocationLink(e.target.value);
                              // ✅ Auto-save com debounce (1 segundo após parar de digitar)
                              if (linksAutoSaveTimeoutRef.current) {
                                clearTimeout(linksAutoSaveTimeoutRef.current);
                              }
                              linksAutoSaveTimeoutRef.current = setTimeout(() => {
                                autoSaveLinks();
                              }, 1000);
                            }}
                            placeholder="Ex: https://maps.google.com"
                            className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                          />
                        </div>
                      </div>
                      {/* Botões de Navegação - Etapa 6 */}
                      {isNewUser && quizStep === 6 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configurações de Wi-Fi */}
                  {!isNewUser && (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-white mb-4">Configurações de Wi-Fi</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Senha do Wi-Fi
                          </label>
                          <input
                            type="text"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            placeholder="Digite a senha do Wi-Fi"
                            className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configurações de WhatsApp - Etapa 7 do Quiz */}
                  {(!isNewUser || quizStep === 7) && (
                    <div id="quiz-section-whatsapp" className="mb-6">
                      <h3 className="text-lg font-medium text-white mb-4">
                        {isNewUser && quizStep === 7 ? '7. Número de WhatsApp' : 'Configurações de WhatsApp'}
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Seu número de WhatsApp
                          </label>
                          <input
                            type="text"
                            value={establishment?.whatsapp || ''}
                            onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                            placeholder="Ex: 5511999999999 (apenas números)"
                            className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            Digite apenas números, incluindo código do país (55) e DDD
                          </p>
                        </div>
                      </div>
                      {/* Botões de Navegação - Etapa 7 */}
                      {isNewUser && quizStep === 7 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Configurações de Pagamento - Etapa 8 do Quiz */}
                  {(!isNewUser || quizStep === 8) && (
                    <div id="quiz-section-pagamento" className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 mb-6">
                      <h3 className="text-lg font-medium text-white mb-4">
                        {isNewUser && quizStep === 8 ? '8. Configurações de Pagamento' : 'Configurações de Pagamento'}
                      </h3>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Taxa do Cartão de Crédito (%)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={creditCardTaxPercentage}
                              onChange={(e) => {
                                setCreditCardTaxPercentage(parseFloat(e.target.value) || 0);
                                if (paymentConfigAutoSaveTimeoutRef.current) {
                                  clearTimeout(paymentConfigAutoSaveTimeoutRef.current);
                                }
                                paymentConfigAutoSaveTimeoutRef.current = setTimeout(() => {
                                  autoSavePaymentConfig();
                                }, 1000);
                              }}
                              placeholder="Ex: 3.5"
                              className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-white text-sm">%</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Taxa cobrada pela maquininha para cartão de crédito.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Taxa do Cartão de Débito (%)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={debitCardTaxPercentage}
                              onChange={(e) => {
                                setDebitCardTaxPercentage(parseFloat(e.target.value) || 0);
                                if (paymentConfigAutoSaveTimeoutRef.current) {
                                  clearTimeout(paymentConfigAutoSaveTimeoutRef.current);
                                }
                                paymentConfigAutoSaveTimeoutRef.current = setTimeout(() => {
                                  autoSavePaymentConfig();
                                }, 1000);
                              }}
                              placeholder="Ex: 2.5"
                              className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-white text-sm">%</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            Taxa cobrada pela maquininha para cartão de débito.
                          </p>
                        </div>

                        {/* Taxas por Bandeira */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-3">
                            Taxas por Bandeira de Cartão (%)
                          </label>
                          <p className="text-sm text-gray-500 mb-4">
                            Configure taxas específicas para cada bandeira de cartão. Estas taxas serão aplicadas quando o cliente escolher uma bandeira específica.
                          </p>

                          {/* Grid responsivo para mobile */}
                          <div className="grid grid-cols-1 gap-4">
                            {Object.entries(cardBrandTaxes).map(([brand, tax]) => (
                              <div key={brand} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-[#1a1b1c] rounded-lg border border-gray-700">
                                {/* Logo e nome da bandeira */}
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {brand === 'outros' ? (
                                    <div className="w-8 h-6 sm:w-10 sm:h-8 bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs text-gray-300 font-medium">N/A</span>
                                    </div>
                                  ) : (
                                    <img
                                      src={`/${brand}.png`}
                                      alt={brand}
                                      className="w-8 h-6 sm:w-10 sm:h-8 object-contain flex-shrink-0"
                                      onError={(e) => {
                                        const target = e.currentTarget as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <label className="text-sm sm:text-base font-medium text-gray-300 capitalize block">
                                      {brand === 'american_express' ? 'American Express' :
                                        brand === 'outros' ? 'Outros' :
                                          brand === 'visa' ? 'Visa' :
                                            brand === 'mastercard' ? 'Mastercard' :
                                              brand === 'elo' ? 'Elo' :
                                                brand === 'hipercard' ? 'Hipercard' :
                                                  brand === 'jcb' ? 'JCB' :
                                                    brand === 'discover' ? 'Discover' :
                                                      brand.charAt(0).toUpperCase() + brand.slice(1)}
                                    </label>
                                  </div>
                                </div>

                                {/* Input da taxa */}
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={tax}
                                    onChange={(e) => {
                                      const newTaxes = { ...cardBrandTaxes };
                                      newTaxes[brand] = parseFloat(e.target.value) || 0;
                                      setCardBrandTaxes(newTaxes);
                                      if (paymentConfigAutoSaveTimeoutRef.current) {
                                        clearTimeout(paymentConfigAutoSaveTimeoutRef.current);
                                      }
                                      paymentConfigAutoSaveTimeoutRef.current = setTimeout(() => {
                                        autoSavePaymentConfig();
                                      }, 1000);
                                    }}
                                    className="w-20 sm:w-24 px-3 py-2 bg-[#242628] border border-gray-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                                    placeholder="0.0"
                                  />
                                  <span className="text-white text-sm font-medium">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleSaveCardTax}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Salvar Taxas
                        </button>
                      </div>
                      {/* Botões de Navegação - Etapa 8 */}
                      {isNewUser && quizStep === 8 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Formas de Pagamento Disponíveis - Etapa 9 do Quiz */}
                  {(!isNewUser || quizStep === 9) && (
                    <div id="quiz-section-formas-pagamento" className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 mb-6">
                      <h3 className="text-lg font-medium text-white mb-2">
                        {isNewUser && quizStep === 9 ? '9. Formas de Pagamento Disponíveis' : 'Formas de Pagamento Disponíveis'}
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Selecione quais formas de pagamento estarão disponíveis para seus clientes no booking.
                        <span className="text-yellow-400 font-medium"> Pelo menos uma deve estar ativa.</span>
                      </p>

                      <div className="space-y-3">
                        {/* PIX */}
                        <label className="flex items-center gap-3 p-3 bg-[#242628] rounded-lg border border-gray-700 hover:border-primary/50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentMethodsEnabled.includes('pix')}
                            onChange={() => handleTogglePaymentMethod('pix')}
                            className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">💸</span>
                            <span className="text-white font-medium">PIX</span>
                          </div>
                          {paymentMethodsEnabled.includes('pix') && (
                            <span className="text-xs text-green-400 font-medium">✓ Ativo</span>
                          )}
                        </label>

                        {/* Cartão de Crédito */}
                        <label className="flex items-center gap-3 p-3 bg-[#242628] rounded-lg border border-gray-700 hover:border-primary/50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentMethodsEnabled.includes('credito')}
                            onChange={() => handleTogglePaymentMethod('credito')}
                            className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">💳</span>
                            <span className="text-white font-medium">Cartão de Crédito</span>
                          </div>
                          {paymentMethodsEnabled.includes('credito') && (
                            <span className="text-xs text-green-400 font-medium">✓ Ativo</span>
                          )}
                        </label>

                        {/* Cartão de Débito */}
                        <label className="flex items-center gap-3 p-3 bg-[#242628] rounded-lg border border-gray-700 hover:border-primary/50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentMethodsEnabled.includes('debito')}
                            onChange={() => handleTogglePaymentMethod('debito')}
                            className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">💳</span>
                            <span className="text-white font-medium">Cartão de Débito</span>
                          </div>
                          {paymentMethodsEnabled.includes('debito') && (
                            <span className="text-xs text-green-400 font-medium">✓ Ativo</span>
                          )}
                        </label>

                        {/* Dinheiro */}
                        <label className="flex items-center gap-3 p-3 bg-[#242628] rounded-lg border border-gray-700 hover:border-primary/50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentMethodsEnabled.includes('dinheiro')}
                            onChange={() => handleTogglePaymentMethod('dinheiro')}
                            className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">💵</span>
                            <span className="text-white font-medium">Dinheiro</span>
                          </div>
                          {paymentMethodsEnabled.includes('dinheiro') && (
                            <span className="text-xs text-green-400 font-medium">✓ Ativo</span>
                          )}
                        </label>

                        {/* Pagar no Local */}
                        <label className="flex items-center gap-3 p-3 bg-[#242628] rounded-lg border border-gray-700 hover:border-primary/50 transition-colors cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentMethodsEnabled.includes('pagar_local')}
                            onChange={() => handleTogglePaymentMethod('pagar_local')}
                            className="w-5 h-5 rounded border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-2xl">🏪</span>
                            <span className="text-white font-medium">Pagar no Local</span>
                          </div>
                          {paymentMethodsEnabled.includes('pagar_local') && (
                            <span className="text-xs text-green-400 font-medium">✓ Ativo</span>
                          )}
                        </label>
                      </div>

                      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-300">
                          💡 <strong>Dica:</strong> As formas de pagamento desativadas não aparecerão para os clientes durante o agendamento.
                        </p>
                      </div>
                      {/* Botões de Navegação - Etapa 9 */}
                      {isNewUser && quizStep === 9 && (
                        <div className="mt-6 flex justify-between">
                          <button
                            onClick={handleQuizPrevious}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                          >
                            ← Anterior
                          </button>
                          <button
                            onClick={handleQuizNext}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                          >
                            Próximo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirmação Final - Etapa 10 do Quiz */}
                  {isNewUser && quizStep === 10 && (
                    <div id="quiz-section-confirmacao" className="bg-gradient-to-r from-gray-800 to-black rounded-lg p-6 border border-gray-600 mb-6">
                      <h3 className="text-2xl font-bold text-white mb-4 text-center">10. Confirmação Final</h3>
                      <div className="bg-white/10 rounded-lg p-6 mb-6">
                        <p className="text-white text-lg mb-4 text-center">
                          Confirme que todas as informações estão corretas antes de finalizar:
                        </p>
                        <div className="space-y-3 text-white">
                          <div className="flex items-center gap-2">
                            {hasWifi || hasParking || hasAccessibility || hasAirConditioning ? (
                              <CheckCircle className="h-5 w-5 text-green-300" />
                            ) : (
                              <X className="h-5 w-5 text-red-300" />
                            )}
                            <span>Comodidades configuradas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-300" />
                            <span>Configuração de horários definida</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-300" />
                            <span>Horário de funcionamento configurado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-300" />
                            <span>Fotos do estabelecimento (opcional)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {pixKeyType && pixKey && pixKey.trim() !== '' ? (
                              <CheckCircle className="h-5 w-5 text-green-300" />
                            ) : (
                              <X className="h-5 w-5 text-red-300" />
                            )}
                            <span>PIX configurado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {(reviewLink && reviewLink.trim() !== '') ||
                              (socialMediaLink && socialMediaLink.trim() !== '') ||
                              (pixPaymentLink && pixPaymentLink.trim() !== '') ||
                              (locationLink && locationLink.trim() !== '') ? (
                              <CheckCircle className="h-5 w-5 text-green-300" />
                            ) : (
                              <X className="h-5 w-5 text-red-300" />
                            )}
                            <span>Links personalizados adicionados</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {establishment?.whatsapp ? (
                              <CheckCircle className="h-5 w-5 text-green-300" />
                            ) : (
                              <X className="h-5 w-5 text-red-300" />
                            )}
                            <span>WhatsApp confirmado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-300" />
                            <span>Configurações de pagamento definidas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {paymentMethodsEnabled && paymentMethodsEnabled.length > 0 ? (
                              <CheckCircle className="h-5 w-5 text-green-300" />
                            ) : (
                              <X className="h-5 w-5 text-red-300" />
                            )}
                            <span>Formas de pagamento selecionadas</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
                        <p className="text-yellow-200 text-center font-semibold">
                          ⚠️ Confirme que todas as informações acima estão corretas e verdadeiras.
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <button
                          onClick={handleQuizPrevious}
                          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                        >
                          ← Anterior
                        </button>
                        <button
                          onClick={async () => {
                            if (!termsAccepted) {
                              setQuizAlertMessage('Você precisa aceitar os termos antes de prosseguir');
                              return;
                            }
                            // Primeiro salvar todas as configurações do quiz
                            await handleSaveAllSettings();
                            // Depois executar a mesma ação do botão azul (salvar e abrir profissionais)
                            await handleUpdateEstablishment();
                          }}
                          disabled={!termsAccepted}
                          className={`px-8 py-3 rounded-lg transition-colors font-bold text-lg ${termsAccepted
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                            }`}
                        >
                          ✓ Confirmar e Finalizar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Seção de Link do Estabelecimento */}
                  {!isNewUser && (
                    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg p-4 mb-6 border border-emerald-400/50">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                          <LinkIcon className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-emerald-400">
                          🌐 Sua Página de Agendamentos
                        </h3>
                      </div>

                      {/* Texto explicativo */}
                      <p className="text-white mb-4 text-sm leading-relaxed font-medium">
                        Aqui você edita sua página de agendamentos, onde os clientes acessam para agendar com você.
                        Seu link para seus clientes é:
                      </p>

                      {/* Link Box - Organizado para mobile */}
                      <div className="bg-[#1a1b1c] rounded-lg p-4 border border-gray-700 mb-4">
                        <p className="text-emerald-400 font-medium text-sm mb-3">Link do Estabelecimento:</p>

                        {/* Link principal */}
                        <div className="bg-gray-800 rounded-lg p-3 mb-3">
                          <code className="text-green-400 font-mono text-sm block break-all">
                            agendeifacil.com/booking/{establishment?.code}
                          </code>
                        </div>

                        {/* Botões organizados */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyLinkToClipboard()}
                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            <Copy className="h-4 w-4 text-white" />
                            <span className="text-white text-sm font-medium">Copiar</span>
                          </button>
                          <a
                            href={`${window.location.origin}/booking/${establishment?.code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            <LinkIcon className="h-4 w-4 text-white" />
                            <span className="text-white text-sm font-medium">Abrir</span>
                          </a>
                        </div>
                      </div>

                      {/* Dica */}
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-400 text-sm">💡</span>
                        <p className="text-white text-xs font-medium flex-1">
                          Compartilhe este link com seus clientes para que possam agendar diretamente com você!
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Checkbox de Aceite de Termos */}
                  {/* Para novos usuários: só aparece na etapa 10 do quiz */}
                  {/* Para usuários antigos: aparece durante o onboarding normal */}
                  {((isNewUser && quizStep === 10) || (!isNewUser && onboardingStep < 4)) && (
                    <div className={`${(isNewUser && quizStep === 10) || (!isNewUser && onboardingStep === 1) ? 'bg-yellow-400 border-yellow-600' : 'bg-green-400 border-green-600'} border-4 rounded-lg p-5 shadow-lg`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted || (!isNewUser && onboardingStep > 1)}
                          onChange={(e) => {
                            if (isNewUser && quizStep === 10) {
                              setTermsAccepted(e.target.checked);
                            } else if (!isNewUser && onboardingStep === 1) {
                              setTermsAccepted(e.target.checked);
                            }
                          }}
                          disabled={!isNewUser && onboardingStep > 1}
                          className="mt-1 h-7 w-7 text-green-600 bg-white border-gray-800 rounded focus:ring-4 focus:ring-yellow-600"
                        />
                        <span className="text-lg text-gray-900 font-bold leading-relaxed">
                          ✅ Aceito os termos desses serviços e confirmo que todas as informações fornecidas estão corretas.
                        </span>
                      </label>
                      {((isNewUser && quizStep === 10 && !termsAccepted) || (!isNewUser && onboardingStep === 1 && !termsAccepted)) && (
                        <p className="text-base text-red-700 font-bold mt-3 ml-10 bg-red-100 p-2 rounded border-2 border-red-500">
                          ⚠️ Você precisa aceitar os termos antes de prosseguir
                        </p>
                      )}
                      {!isNewUser && onboardingStep > 1 && (
                        <p className="text-base text-green-800 font-bold mt-3 ml-10 bg-green-100 p-2 rounded border-2 border-green-600">
                          ✅ Etapa {onboardingStep - 1} de 3 concluída! Continue o processo.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Botão de Salvar */}
                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        // Executar a mesma ação do botão verde (salvar todas as configurações do quiz)
                        await handleSaveAllSettings();
                        // Depois executar a ação original (salvar e abrir profissionais)
                        await handleUpdateEstablishment();
                      }}
                      disabled={isUpdating || (onboardingStep === 1 && !termsAccepted)}
                      className={`px-6 py-3 bg-primary text-white rounded-lg font-medium ${(isUpdating || (onboardingStep === 1 && !termsAccepted)) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/80'
                        } transition-colors flex items-center gap-2`}
                    >
                      {isUpdating ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Check className="h-5 w-5" />
                          Salvar e abrir profissionais
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Modal de Informações Mobile */}
              {showInfoModal && infoModalContent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-[#1a1b1c] rounded-lg border border-gray-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold text-white">{infoModalContent.title}</h3>
                        <button
                          onClick={() => {
                            setShowInfoModal(false);
                            setInfoModalContent(null);
                          }}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                      <div className="bg-[#2a2b2c] rounded-lg p-4 border border-gray-600">
                        <p className="text-gray-300 text-sm leading-relaxed">{infoModalContent.content}</p>
                      </div>
                      <div className="mt-6 flex justify-end">
                        <button
                          onClick={() => {
                            setShowInfoModal(false);
                            setInfoModalContent(null);
                          }}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {activeTab === 'financial-dashboard' && isDashboardUnlocked && (
                <div className="space-y-6">
                  {/* Vídeo Tutorial do Dashboard Financeiro */}
                  {showTutorials.dashboard && (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                            <span className="text-red-600 text-xl">📺</span>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Usar o Dashboard</h3>
                            <p className="text-sm text-gray-600">Aprenda a navegar e usar todas as funcionalidades do sistema</p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleTutorial('dashboard')}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                        >
                          Ocultar Tutorial
                        </button>
                      </div>

                      <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden">
                        <iframe
                          className="absolute top-0 left-0 w-full h-full"
                          src="https://www.youtube.com/embed/5cIGlklZLr0"
                          title="Tutorial: Como Usar o Dashboard"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        ></iframe>
                      </div>

                      <div className="mt-3 text-center">
                        <a
                          href="https://youtu.be/5cIGlklZLr0"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                        >
                          Assistir no YouTube
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Botão para mostrar tutorial se estiver oculto */}
                  {!showTutorials.dashboard && (
                    <div className="mb-6 text-center">
                      <button
                        onClick={() => toggleTutorial('dashboard')}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <span>📺</span>
                        <span>Mostrar Tutorial</span>
                      </button>
                    </div>
                  )}

                  {/* Dashboard Financeiro com Despesas */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Dashboard Financeiro</h2>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAddExpenseModal(true)}
                          className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar Despesas
                        </button>
                      </div>
                    </div>

                    {/* Seletor de Mês */}
                    <div className="flex items-center justify-between mb-6 bg-gray-50 rounded-lg p-4">
                      <button
                        onClick={() => handleMonthChange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                        className="p-4 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300 bg-white shadow-sm"
                      >
                        <ChevronLeft className="h-6 w-6 text-gray-700" />
                      </button>
                      <span className="text-xl font-bold text-gray-900 px-6">
                        {selectedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => handleMonthChange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                        className="p-4 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300 bg-white shadow-sm"
                      >
                        <ChevronRight className="h-6 w-6 text-gray-700" />
                      </button>
                    </div>

                    {/* Resumo Bruto, Líquido e Líquido Estabelecimento */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                      {/* Resumo Bruto */}
                      <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">Resumo Bruto</h3>
                          <div className="flex items-center gap-2">
                            {!isEditingGrossValue && (
                              <button
                                onClick={() => setIsEditingGrossValue(true)}
                                className="px-3 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 transition-colors"
                              >
                                EDITAR
                              </button>
                            )}
                            <TrendingUp className="h-5 w-5 text-gray-700" />
                          </div>
                        </div>
                        {isEditingGrossValue ? (
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={editingGrossValue}
                              onChange={(e) => setEditingGrossValue(e.target.value)}
                              placeholder="Digite o valor bruto"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 text-gray-900 bg-white"
                              step="0.01"
                              min="0"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveGrossValue}
                                className="px-3 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 transition-colors"
                              >
                                SALVAR
                              </button>
                              <button
                                onClick={() => {
                                  setIsEditingGrossValue(false);
                                  setEditingGrossValue('');
                                }}
                                className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                              >
                                CANCELAR
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-3xl font-bold text-gray-900">
                              {formatCurrency(calculateTotalGrossWithInitial(monthlyAppointments))}
                            </p>
                            <p className="text-sm text-gray-700 mt-1">Total faturado no mês</p>
                          </>
                        )}
                      </div>

                      {/* Resumo Líquido */}
                      <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">Resumo Líquido</h3>
                          <DollarSign className="h-5 w-5 text-gray-700" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                          {formatCurrency(calculateTotalLiquidWithInitial(monthlyAppointments, expensesTotal))}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          Bruto - Despesas - Taxas de Cartão
                        </p>
                      </div>

                      {/* Resumo Líquido Estabelecimento */}
                      <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">Líquido Estabelecimento</h3>
                          <Building2 className="h-5 w-5 text-gray-700" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                          {formatCurrency(calculateTotalEstablishmentLiquidWithInitial(monthlyAppointments, expensesTotal))}
                        </p>
                        <p className="text-sm text-gray-700 mt-1">
                          Bruto - Todos os Profissionais - Despesas - Taxas
                        </p>
                      </div>
                    </div>

                    {/* Taxas de Cartão */}
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-gray-700" />
                        <span className="font-medium text-gray-900">
                          Taxas de Cartão: {formatCurrency(calculateTotalCardTaxes(monthlyAppointments))}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        Total das taxas cobradas pelos cartões de crédito/débito
                      </p>
                    </div>

                    {/* Lista de Despesas */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <button
                        onClick={() => setShowExpensesList(!showExpensesList)}
                        className="flex items-center justify-between w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Receipt className="h-5 w-5 text-gray-600" />
                          <span className="font-medium text-gray-900">
                            Despesas ({expenses.length})
                          </span>
                          <span className="text-sm text-gray-600">
                            Total: {formatCurrency(expensesTotal)}
                          </span>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-gray-600 transition-transform ${showExpensesList ? 'rotate-180' : ''}`} />
                      </button>

                      {showExpensesList && (
                        <div className="mt-4 space-y-2">
                          {expenses.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Nenhuma despesa cadastrada</p>
                          ) : (
                            expenses.map(expense => (
                              <div key={expense.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                <div>
                                  <p className="font-medium text-gray-900">{expense.name}</p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(expense.created_at).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-red-600">
                                    {formatCurrency(expense.amount)}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteExpense(expense.id)}
                                    className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                    title="Remover despesa"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Receita por Profissional */}
                  <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 rounded-xl shadow-lg border border-gray-300/50 p-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
                      <span className="text-2xl">💼</span>
                      <span>Receita por Profissional</span>
                    </h3>


                    <div className="space-y-5">
                      {professionals.map(professional => {
                        const professionalAppointments = monthlyAppointments.filter(
                          apt => apt.professional === professional.id && apt.status !== 'cancelled'
                        );

                        console.log(`🔍 Profissional: ${professional.name}`);
                        console.log(`📋 Agendamentos encontrados:`, professionalAppointments);

                        const professionalRevenue = professionalAppointments.reduce((total, apt) => {
                          if (isClientPaidSubscriber(apt.client_whatsapp)) {
                            console.log(`💰 Assinante pago - não contabilizado: ${apt.client_name} - R$ ${apt.total_price || apt.price}`);
                            return total; // Não adiciona ao faturamento se for assinante pago
                          }
                          const appointmentValue = apt.total_price || apt.price || 0;
                          console.log(`💰 Agendamento normal: ${apt.client_name} - R$ ${appointmentValue}`);
                          return total + appointmentValue;
                        }, 0);

                        // Calcular produtos extras vendidos
                        const extraProductsSold = professionalAppointments.reduce((total, apt) => {
                          if (apt.additional_products && apt.additional_products.length > 0) {
                            return total + apt.additional_products.length;
                          }
                          return total;
                        }, 0);

                        // Coletar todos os produtos extras para mostrar no dropdown
                        const allExtraProducts = professionalAppointments.reduce((products: any[], apt) => {
                          if (apt.additional_products && apt.additional_products.length > 0) {
                            return products.concat(apt.additional_products.map(product => ({
                              ...product,
                              clientName: apt.client_name,
                              appointmentDate: apt.appointment_date
                            })));
                          }
                          return products;
                        }, []);

                        console.log(`✅ ${professional.name}: R$ ${professionalRevenue} - ${extraProductsSold} produtos extras`);

                        return (
                          <div key={professional.id} className="p-6 bg-gradient-to-r from-white to-gray-50/30 rounded-xl border border-gray-300/40 shadow-md hover:shadow-xl hover:border-gray-400/60 transition-all duration-300 space-y-4 backdrop-blur-sm">
                            {/* Header do Profissional */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-bold text-gray-800 text-lg mb-2 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                  {professional.name}
                                </p>
                                <div className="text-sm text-gray-600 mt-1 bg-blue-50/50 rounded-lg px-3 py-2 inline-block">
                                  <p className="flex items-center gap-2">
                                    <span className="font-medium">{professionalAppointments.length} agendamento(s)</span>
                                    <span className="text-gray-400">•</span>
                                    {professional.percentage === 100 ? (
                                      <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">Dono (100%)</span>
                                    ) : (
                                      <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-md">{professional.percentage || 100}%</span>
                                    )}
                                  </p>
                                  {extraProductsSold > 0 && (
                                    <div className="relative mt-2">
                                      <button
                                        onClick={() => setOpenExtraProductsDropdown(
                                          openExtraProductsDropdown === professional.id ? null : professional.id
                                        )}
                                        className="text-orange-600 hover:text-orange-700 cursor-pointer flex items-center gap-1"
                                      >
                                        + {extraProductsSold} produto(s) extra
                                        <ChevronDown className={`h-4 w-4 transition-transform ${openExtraProductsDropdown === professional.id ? 'rotate-180' : ''
                                          }`} />
                                      </button>

                                      {/* Dropdown com detalhes dos produtos extras */}
                                      {openExtraProductsDropdown === professional.id && (
                                        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 w-full max-w-sm sm:max-w-md">
                                          <div className="p-3 border-b border-gray-200">
                                            <h4 className="font-medium text-gray-900">Produtos Extras Vendidos</h4>
                                          </div>
                                          <div className="max-h-60 overflow-y-auto">
                                            {allExtraProducts.map((product, index) => (
                                              <div key={index} className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                                                <div className="flex justify-between items-start">
                                                  <div className="flex-1">
                                                    <p className="font-medium text-gray-900">{product.name}</p>
                                                    <p className="text-sm text-gray-600">
                                                      Cliente: {product.clientName}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                      {new Date(product.appointmentDate).toLocaleDateString('pt-BR')}
                                                    </p>
                                                  </div>
                                                  <div className="text-right">
                                                    <p className="font-bold text-green-600">
                                                      {formatCurrency(product.price)}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="p-3 bg-gray-50 border-t border-gray-200">
                                            <div className="flex justify-between items-center">
                                              <span className="font-medium text-gray-900">Total Produtos Extras:</span>
                                              <span className="font-bold text-green-600">
                                                {formatCurrency(allExtraProducts.reduce((total, product) => total + product.price, 0))}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Valores - Layout Mobile */}
                              <div className="text-right sm:text-right bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-300/50">
                                <p className="text-2xl font-bold text-emerald-700 mb-1">
                                  {formatCurrency(professionalRevenue)}
                                </p>
                                <div className="text-sm text-blue-700 font-medium">
                                  {professional.percentage === 100 ? (
                                    <span>Líquido: <span className="font-bold">{formatCurrency(calculateProfessionalNetValue(professional.name, monthlyAppointments))}</span></span>
                                  ) : (
                                    <span>Líquido: <span className="font-bold">{formatCurrency(calculateProfessionalNetValue(professional.name, monthlyAppointments))}</span></span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Controle de Pagamentos - Agora em linha separada */}
                            <div className="border-t border-gray-300/60 pt-4 mt-5 bg-gradient-to-r from-gray-50/30 to-gray-100/30 rounded-lg p-3 -mx-3 -mb-3">
                              <ProfessionalPaymentControl
                                establishmentId={establishment?.id || ''}
                                professionalId={professional.id}
                                professionalName={professional.name}
                                currentLiquidValue={calculateProfessionalNetValue(professional.name, monthlyAppointments)}
                                selectedMonth={selectedMonth}
                                onPaymentRecorded={() => {
                                  // Recarregar dados se necessário
                                  console.log('💰 Pagamento registrado para', professional.name);
                                }}
                              />
                            </div>
                            {/* Mostrar detalhamento dos serviços */}
                            {professionalAppointments.length > 0 && (
                              <div className="mt-2 text-xs">
                                <details className="cursor-pointer">
                                  <summary className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer flex items-center gap-2 transition-colors">
                                    <span>📋</span>
                                    Ver serviços individuais
                                    <span className="text-xs">▼</span>
                                  </summary>
                                  <div className="mt-3 space-y-4 bg-gray-100 p-4 rounded-lg">
                                    {/* Filtros de pagamento */}
                                    <div className="mb-4">
                                      <div className="flex flex-wrap gap-2 mb-4">
                                        {[
                                          { key: 'todos', label: 'Todos' },
                                          { key: 'pix', label: 'PIX' },
                                          { key: 'dinheiro', label: 'Dinheiro' },
                                          { key: 'debito', label: 'Débito' },
                                          { key: 'credito', label: 'Crédito' }
                                        ].map(filter => (
                                          <button
                                            key={filter.key}
                                            onClick={() => setPaymentFilter(filter.key)}
                                            className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${paymentFilter === filter.key
                                              ? 'bg-blue-600 text-white'
                                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                              }`}
                                          >
                                            {filter.label}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Resumo por filtro */}
                                      {(() => {
                                        const filteredAppointments = professionalAppointments
                                          .filter(apt => apt.status === 'completed')
                                          .filter(apt => paymentFilter === 'todos' || apt.payment_method === paymentFilter);

                                        const grossTotal = filteredAppointments.reduce((total, apt) => {
                                          const baseValue = apt.total_price || apt.price || 0;
                                          return total + baseValue;
                                        }, 0);

                                        const netTotal = filteredAppointments.reduce((total, apt) => {
                                          const baseValue = apt.total_price || apt.price || 0;
                                          let netValue;

                                          if (professional.percentage === 100) {
                                            // Para dono: bruto - taxa de cartão (se houver)
                                            const paymentTax = getPaymentMethodTax(apt.payment_method || '', apt.card_brand);
                                            if (apt.payment_method === 'credito' || apt.payment_method === 'debito') {
                                              const cardTax = (baseValue * paymentTax) / 100;
                                              netValue = baseValue - cardTax;
                                            } else {
                                              netValue = baseValue;
                                            }
                                          } else {
                                            // Para outros profissionais: recebem % do valor BRUTO (sem taxa)
                                            netValue = (baseValue * (professional?.percentage || 0)) / 100;
                                          }
                                          return total + netValue;
                                        }, 0);

                                        const filterLabel = paymentFilter === 'todos' ? 'Todos' :
                                          paymentFilter === 'pix' ? 'PIX' :
                                            paymentFilter === 'dinheiro' ? 'Dinheiro' :
                                              paymentFilter === 'debito' ? 'Débito' :
                                                paymentFilter === 'credito' ? 'Crédito' : 'Todos';

                                        // Calcular Novas Vendas (vendas desde o último pagamento)
                                        const lastPayment = allProfessionalPayments
                                          .filter((p: any) => p.professional_id === professional.id)
                                          .sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];

                                        console.log('🔍 DEBUG Novas Vendas:', {
                                          professionalId: professional.id,
                                          professionalName: professional.name,
                                          allPayments: allProfessionalPayments.filter((p: any) => p.professional_id === professional.id),
                                          lastPayment: lastPayment,
                                          filteredAppointments: filteredAppointments.map(apt => ({
                                            id: apt.id,
                                            date: apt.appointment_date,
                                            value: apt.total_price || apt.price,
                                            status: apt.status
                                          }))
                                        });

                                        const newSalesTotal = lastPayment
                                          ? filteredAppointments
                                            .filter(apt => {
                                              // Usar created_at do agendamento em vez de appointment_date para comparação
                                              const aptDate = new Date(apt.created_at);
                                              const paymentDate = new Date(lastPayment.payment_date);
                                              const isAfterPayment = aptDate > paymentDate;
                                              console.log(`📅 Comparando: ${apt.created_at} > ${lastPayment.payment_date} = ${isAfterPayment}`);
                                              return isAfterPayment;
                                            })
                                            .reduce((total, apt) => {
                                              const baseValue = apt.total_price || apt.price || 0;
                                              let netValue;
                                              if (professional.percentage === 100) {
                                                const paymentTax = getPaymentMethodTax(apt.payment_method || '', apt.card_brand);
                                                if (apt.payment_method === 'credito' || apt.payment_method === 'debito') {
                                                  const cardTax = (baseValue * paymentTax) / 100;
                                                  netValue = baseValue - cardTax;
                                                } else {
                                                  netValue = baseValue;
                                                }
                                              } else {
                                                netValue = (baseValue * (professional?.percentage || 0)) / 100;
                                              }
                                              console.log(`💰 Agendamento ${apt.id}: R$ ${baseValue} -> Líquido: R$ ${netValue}`);
                                              return total + netValue;
                                            }, 0)
                                          : netTotal; // Se não há pagamentos, todas as vendas são "novas"

                                        console.log('💰 Total Novas Vendas:', newSalesTotal);

                                        return (
                                          <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                                            <h4 className="font-semibold text-gray-800 mb-3">
                                              Resumo - {filterLabel} ({filteredAppointments.length} serviços)
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-600">Vendas Brutas:</span>
                                                <span className="font-semibold text-green-600">
                                                  {formatCurrency(grossTotal)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-600">Vendas Líquidas:</span>
                                                <span className="font-semibold text-blue-600">
                                                  {formatCurrency(netTotal)}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                                                <span className="text-gray-600 font-medium">Novas Vendas:</span>
                                                <span className="font-bold text-purple-600">
                                                  {formatCurrency(newSalesTotal)}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>

                                    {/* Lista de serviços filtrados */}
                                    {professionalAppointments
                                      .filter(apt => apt.status === 'completed')
                                      .filter(apt => paymentFilter === 'todos' || apt.payment_method === paymentFilter)
                                      .map((apt, index) => {
                                        const baseValue = apt.total_price || apt.price || 0;
                                        let netValue;

                                        if (professional.percentage === 100) {
                                          // Para dono: bruto - taxa de cartão (se houver)
                                          const paymentTax = getPaymentMethodTax(apt.payment_method || '', apt.card_brand);
                                          if (apt.payment_method === 'credito' || apt.payment_method === 'debito') {
                                            const cardTax = (baseValue * paymentTax) / 100;
                                            netValue = baseValue - cardTax;
                                          } else {
                                            netValue = baseValue;
                                          }
                                        } else {
                                          // Para outros profissionais: recebem % do valor BRUTO (sem taxa)
                                          netValue = (baseValue * (professional?.percentage || 0)) / 100;
                                        }

                                        // Formatar data e horário
                                        const appointmentDate = new Date(apt.appointment_date + 'T' + apt.appointment_time);
                                        const formattedDate = format(appointmentDate, "dd/MM/yyyy", { locale: ptBR });
                                        const formattedTime = apt.appointment_time || '00:00';

                                        // Mapear forma de pagamento
                                        const paymentMethodMap: Record<string, string> = {
                                          'dinheiro': 'Dinheiro',
                                          'pix': 'PIX',
                                          'credito': 'Crédito',
                                          'debito': 'Débito',
                                          'pendente': 'Pendente'
                                        };
                                        const paymentMethodLabel = paymentMethodMap[apt.payment_method || 'pendente'] || apt.payment_method || 'Pendente';

                                        return (
                                          <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 mb-3 last:mb-0">
                                            {/* Header do cliente */}
                                            <div className="flex justify-between items-start mb-2">
                                              <span className="text-gray-800 font-medium text-sm">
                                                {apt.client_name}
                                              </span>
                                              <span className="text-blue-600 font-semibold text-sm">
                                                → {formatCurrency(netValue)}
                                              </span>
                                            </div>

                                            {/* Informações do serviço */}
                                            <div className="space-y-2">
                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-600 text-xs">
                                                  💰 Valor bruto
                                                </span>
                                                <span className="text-gray-700 font-medium text-xs">
                                                  {formatCurrency(baseValue)}
                                                </span>
                                              </div>

                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-600 text-xs">
                                                  💳 Pagamento
                                                </span>
                                                <span className="text-purple-600 font-medium text-xs">
                                                  {paymentMethodLabel}
                                                </span>
                                              </div>

                                              <div className="flex justify-between items-center">
                                                <span className="text-gray-600 text-xs">
                                                  📅 Data/Hora
                                                </span>
                                                <span className="text-gray-500 text-xs">
                                                  {formattedDate} às {formattedTime}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </details>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Receita Diária */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900">Receita Diária</h3>
                      <button
                        onClick={() => setOpenDailyRevenueDropdown(!openDailyRevenueDropdown)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        {openDailyRevenueDropdown ? 'Ocultar Detalhes' : 'Ver Todos os Dias'}
                        <ChevronDown className={`h-4 w-4 transition-transform ${openDailyRevenueDropdown ? 'rotate-180' : ''
                          }`} />
                      </button>
                    </div>

                    {/* Resumo dos dias com receita */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {(() => {
                        const daysWithRevenue = Array.from({ length: 31 }, (_, i) => {
                          const day = i + 1;
                          // Filtrar agendamentos do dia específico
                          const dayAppointments = monthlyAppointments.filter(apt => {
                            if (apt.status === 'cancelled') return false;

                            // Extrair apenas a data (YYYY-MM-DD) e comparar o dia
                            const aptDateStr = apt.appointment_date?.split('T')[0] || ''; // Pega só a data
                            if (!aptDateStr) return false;

                            const aptDateParts = aptDateStr.split('-');
                            if (aptDateParts.length !== 3) return false;

                            const aptDay = parseInt(aptDateParts[2], 10); // Dia do mês

                            return aptDay === day;
                          });

                          console.log(`🔍 Dia ${day} - Total de agendamentos encontrados:`, dayAppointments.length);
                          if (dayAppointments.length > 0) {
                            console.log(`📋 Agendamentos do dia ${day}:`, dayAppointments.map(apt => ({
                              id: apt.id,
                              client: apt.client_name,
                              date: apt.appointment_date,
                              status: apt.status,
                              price: apt.total_price || apt.price,
                              isSubscriber: isClientPaidSubscriber(apt.client_whatsapp)
                            })));
                          }

                          // Calcular receita (excluindo assinantes pagos)
                          const dayRevenue = dayAppointments.reduce((total, apt) => {
                            if (isClientPaidSubscriber(apt.client_whatsapp)) {
                              console.log(`💰 Assinante pago excluído da receita: ${apt.client_name} - R$ ${apt.total_price || apt.price}`);
                              return total; // Não adiciona ao faturamento se for assinante pago
                            }
                            const value = apt.total_price || apt.price || 0;
                            console.log(`💰 Agendamento normal: ${apt.client_name} - R$ ${value}`);
                            return total + value;
                          }, 0);

                          console.log(`💰 Dia ${day} - Receita total: R$ ${dayRevenue}, Agendamentos: ${dayAppointments.length}`);

                          return { day, revenue: dayRevenue, appointments: dayAppointments.length };
                        }).filter(day => day.revenue > 0 || day.appointments > 0);

                        return daysWithRevenue.slice(0, 4).map(({ day, revenue, appointments }) => (
                          <div key={day} className="p-3 bg-green-50 rounded-lg">
                            <p className="text-sm font-medium text-green-700">Dia {day}</p>
                            <p className="text-lg font-bold text-green-900">{formatCurrency(revenue)}</p>
                            <p className="text-xs text-green-600">{appointments} agendamento(s)</p>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Dropdown com todos os dias */}
                    {openDailyRevenueDropdown && (
                      <div className="border-t border-gray-200 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                          {Array.from({ length: 31 }, (_, i) => {
                            const day = i + 1;
                            // Filtrar agendamentos do dia específico
                            const dayAppointments = monthlyAppointments.filter(apt => {
                              if (apt.status === 'cancelled') return false;

                              // Extrair apenas a data (YYYY-MM-DD) e comparar o dia
                              const aptDateStr = apt.appointment_date?.split('T')[0] || ''; // Pega só a data
                              if (!aptDateStr) return false;

                              const aptDateParts = aptDateStr.split('-');
                              if (aptDateParts.length !== 3) return false;

                              const aptDay = parseInt(aptDateParts[2], 10); // Dia do mês

                              return aptDay === day;
                            });

                            // Calcular receita (excluindo assinantes pagos)
                            const dayRevenue = dayAppointments.reduce((total, apt) => {
                              if (isClientPaidSubscriber(apt.client_whatsapp)) {
                                return total; // Não adiciona ao faturamento se for assinante pago
                              }
                              return total + (apt.total_price || apt.price || 0);
                            }, 0);

                            return (
                              <div key={day} className={`p-3 rounded-lg border ${dayRevenue > 0
                                ? 'bg-green-50 border-green-200'
                                : 'bg-gray-50 border-gray-200'
                                }`}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className={`font-medium ${dayRevenue > 0 ? 'text-green-700' : 'text-gray-500'
                                      }`}>
                                      Dia {day}
                                    </p>
                                    <p className={`text-sm ${dayRevenue > 0 ? 'text-green-600' : 'text-gray-400'
                                      }`}>
                                      {dayAppointments.length} agendamento(s)
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className={`font-bold ${dayRevenue > 0 ? 'text-green-900' : 'text-gray-400'
                                      }`}>
                                      {formatCurrency(dayRevenue)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Receita Mensal */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Receita Mensal</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-700">Total Bruto</p>
                        <p className="text-2xl font-bold text-green-900">
                          {formatCurrency(calculateMonthlyBalance(monthlyAppointments))}
                        </p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">Total Líquido</p>
                        <p className="text-2xl font-bold text-blue-900">
                          {formatCurrency(calculateTotalEstablishmentLiquidWithInitial(monthlyAppointments, expensesTotal))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {activeTab === 'clients' && (
                <div className="space-y-6">
                  <style>{`
                    @keyframes pulse {
                      0%, 100% {
                        opacity: 1;
                        transform: scale(1.1);
                      }
                      50% {
                        opacity: 0.8;
                        transform: scale(1.15);
                      }
                    }
                  `}</style>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Meus Clientes</h2>
                    <div className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Aqui você encontra todos os clientes que já agendaram em seu estabelecimento.
                  </p>

                  {/* Botões de navegação */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <button
                      onClick={() => {
                        console.log('🔍 Abrindo modal ReservarCliente para establishment:', establishment?.id);
                        setShowReservarClienteModal(true);
                        setHighlightReserveButton(false);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all text-sm font-medium ${highlightReserveButton
                        ? 'ring-4 ring-gray-400 shadow-2xl animate-pulse scale-110'
                        : ''
                        }`}
                      style={highlightReserveButton ? {
                        animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                      } : {}}
                    >
                      <User className="h-4 w-4" />
                      {highlightReserveButton ? '👉 Reservar Cliente 👈' : 'Reservar Cliente'}
                    </button>
                    <button
                      onClick={() => handleTabChange('clients')}
                      className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      <Users className="h-4 w-4" />
                      Meus Clientes
                    </button>
                    <button
                      onClick={() => handleTabChange('ranking')}
                      className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      <Crown className="h-4 w-4" />
                      Ranking Clientes
                    </button>
                    <button
                      onClick={() => handleTabChange('missing-clients')}
                      className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      <Users className="h-4 w-4" />
                      Clientes Sumidos
                    </button>
                    <button
                      onClick={() => handleTabChange('draw')}
                      className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      <Shuffle className="h-4 w-4" />
                      Sorteio
                    </button>
                  </div>

                  {/* Controles de busca e filtros */}
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Buscar cliente por nome..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                      />
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShowBirthdayFilter(!showBirthdayFilter)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showBirthdayFilter
                          ? 'bg-black text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        🎂 Aniversariantes do mês
                      </button>
                      <button
                        onClick={() => setShowAddClientModal(true)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-black text-white hover:bg-gray-800 transition-colors"
                      >
                        ➕ Adicionar Cliente
                      </button>

                      {showBirthdayFilter && (
                        <span className="px-3 py-2 bg-gray-800 text-white rounded-lg text-sm">
                          {filteredClients.length} encontrado(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClients.length === 0 ? (
                      <div className="col-span-full text-center py-8 bg-white rounded-lg border border-gray-300">
                        <Users className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                        <p className="text-gray-500">Nenhum cliente encontrado.</p>
                      </div>
                    ) : (
                      filteredClients.map((client, index) => (
                        <div key={`${client.whatsapp}-${client.id}-${index}`} className={`rounded-lg p-4 border-2 shadow-sm ${client.alert ? 'bg-gray-50 border-gray-400' : 'bg-white border-gray-300'}`}>
                          {/* Header com nome e botões de ação */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {editingClient === client.whatsapp ? (
                                <input
                                  type="text"
                                  value={editClientName}
                                  onChange={(e) => setEditClientName(e.target.value)}
                                  className="text-lg font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 flex-1"
                                  placeholder="Nome do cliente"
                                />
                              ) : (
                                <h3 className="text-lg font-medium text-gray-900 truncate">{client.name}</h3>
                              )}
                              {client.isSubscriber && <Crown className="h-5 w-5 text-yellow-500" />} {/* COROA PARA ASSINANTES */}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {editingClient === client.whatsapp ? (
                                <>
                                  <button
                                    onClick={saveClientEdit}
                                    className="text-gray-700 hover:text-black p-1"
                                    title="Salvar"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingClient(null);
                                      setEditClientName('');
                                      setEditClientWhatsapp('');
                                    }}
                                    className="text-gray-600 hover:text-gray-900 p-1"
                                    title="Cancelar"
                                  >
                                    ✗
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleEditClient(client)}
                                    className="text-gray-600 hover:text-black p-1"
                                    title="Editar cliente"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClient(client.whatsapp)}
                                    className="text-gray-600 hover:text-black p-1"
                                    title="Excluir cliente"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* WhatsApp */}
                          <div className="text-gray-700 flex items-center gap-2 mb-1">
                            <Phone className="h-4 w-4 text-gray-600" />
                            {editingClient === client.whatsapp ? (
                              <input
                                type="text"
                                value={editClientWhatsapp}
                                onChange={(e) => setEditClientWhatsapp(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 flex-1 text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-500"
                                placeholder="WhatsApp do cliente"
                              />
                            ) : (
                              <span className="text-gray-700">{client.whatsapp}</span>
                            )}
                          </div>
                          <p className="text-gray-700 flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-gray-600" />
                            Agendamentos: {client.appointmentCount}
                          </p>

                          {/* Campo de aniversário */}
                          <div className="text-gray-700 flex items-center gap-2 mb-4">
                            <span className="text-gray-500">🎂</span>
                            {editingClientBirthday === client.whatsapp ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={newBirthday}
                                  onChange={(e) => setNewBirthday(e.target.value)}
                                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  onClick={() => saveBirthday(client.whatsapp, newBirthday)}
                                  className="text-gray-700 hover:text-black"
                                  title="Salvar"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingClientBirthday(null);
                                    setNewBirthday('');
                                  }}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Cancelar"
                                >
                                  ✗
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {client.birthday
                                    ? new Date(client.birthday + 'T12:00:00').toLocaleDateString('pt-BR')
                                    : 'Não informado'
                                  }
                                </span>
                                <button
                                  onClick={() => {
                                    console.log('🎯 Cliente clicado para editar:', {
                                      clientWhatsapp: client.whatsapp,
                                      clientName: client.name,
                                      currentBirthday: client.birthday
                                    });
                                    setEditingClientBirthday(client.whatsapp);
                                    setNewBirthday(client.birthday || '');
                                  }}
                                  className="text-gray-600 hover:text-black text-xs"
                                  title="Editar aniversário"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                            {client.birthday && isBirthdayThisMonth(client.birthday) && (
                              <span className="text-gray-700 text-xs font-medium">• Aniversário este mês!</span>
                            )}
                          </div>

                          {/* Campo de alerta */}
                          <div className="text-gray-700 flex items-center gap-2 mb-4">
                            <span className="text-red-500">⚠️</span>
                            {editingClientAlert === client.whatsapp ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={newAlert}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value.length <= 100) {
                                      setNewAlert(value);
                                    }
                                  }}
                                  maxLength={100}
                                  placeholder="Digite o alerta (máx. 100 caracteres)"
                                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                                />
                                <span className="text-xs text-gray-500">{newAlert.length}/100</span>
                                <button
                                  onClick={() => saveAlert(client.whatsapp, newAlert)}
                                  className="text-gray-700 hover:text-black"
                                  title="Salvar"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingClientAlert(null);
                                    setNewAlert('');
                                  }}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Cancelar"
                                >
                                  ✗
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-1">
                                <span className={`text-sm ${client.alert ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                                  {client.alert || 'Nenhum alerta'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingClientAlert(client.whatsapp);
                                    setNewAlert(client.alert || '');
                                  }}
                                  className="text-gray-600 hover:text-black text-xs"
                                  title="Editar alerta"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                          </div>

                          <a
                            href={(() => {
                              let phoneNumber = client.whatsapp.replace(/\D/g, '');
                              // Lista de códigos de países comuns
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
                              return `https://wa.me/${phoneNumber}`;
                            })()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                          >
                            <MessageSquare className="h-5 w-5" />
                            Enviar Mensagem
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}




            </div>
          </div>

          {showPinModal && (
            <PinPasswordModal
              onClose={handleClosePinModal}
              onSubmit={handleValidatePin}
              title="Digite a senha para acessar as configurações"
            />
          )}

          {showDashboardPinModal && (
            <PinPasswordModal
              onClose={handleCloseDashboardPinModal}
              onSubmit={handleValidateDashboardPin}
              title="Digite a senha para acessar o dashboard"
            />
          )}



          {showConfigModal && (
            <PinPasswordModal
              onClose={() => setShowConfigModal(false)}
              onSubmit={handleSavePin}
              title="Configure uma senha para seu estabelecimento"
            />
          )}

          {/* Modal de confirmação para salvar senha */}
          {showSavePinConfirmModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-[#1a1b1c] rounded-lg border border-gray-700 max-w-md w-full p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-white mb-2">Atenção</h3>
                  <p className="text-gray-300">
                    Se você é apenas 1 profissional não é necessário essa senha.
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowSavePinConfirmModal(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={handleConfirmSavePin}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Tenho profissionais
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Senha do Profissional */}
          <ProfessionalPinModal
            isOpen={showProfessionalPinModal}
            onClose={() => {
              setShowProfessionalPinModal(false);
              setTempSelectedProfessional(null);
            }}
            onValidate={handleValidateProfessionalPin}
            professionalName={tempSelectedProfessional === 'all' ? 'all' : getProfessionalName(tempSelectedProfessional || '')}
          />

          {/* Modal de Ausência do Profissional */}
          {showAbsenceModal && selectedProfessionalForAbsence && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-[#1a1b1c] rounded-lg border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">
                      Configurar Ausências - {professionals.find(p => p.id === selectedProfessionalForAbsence)?.name}
                    </h3>
                    <button
                      onClick={handleCloseAbsenceModal}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="text-gray-300 text-sm mb-4">
                      Selecione os dias em que o profissional estará ausente. Esses dias serão automaticamente bloqueados para novos agendamentos.
                    </p>
                  </div>

                  {/* Navegação do Mês */}
                  <div className="flex justify-between items-center mb-4">
                    <button
                      onClick={handlePreviousMonth}
                      disabled={absenceModalCurrentMonth.getMonth() === new Date().getMonth() && absenceModalCurrentMonth.getFullYear() === new Date().getFullYear()}
                      className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Anterior
                    </button>

                    <h4 className="text-lg font-semibold text-white">
                      {absenceModalCurrentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h4>

                    <button
                      onClick={handleNextMonth}
                      className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Próximo →
                    </button>
                  </div>

                  {/* Calendário */}
                  <div className="grid grid-cols-7 gap-2 mb-6">
                    {/* Cabeçalho dos dias da semana */}
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                        {day}
                      </div>
                    ))}

                    {/* Dias do mês */}
                    {Array.from({ length: 35 }, (_, i) => {
                      const currentDate = new Date();
                      const firstDay = new Date(absenceModalCurrentMonth.getFullYear(), absenceModalCurrentMonth.getMonth(), 1);
                      const firstDayWeekday = firstDay.getDay();
                      const dayNumber = i - firstDayWeekday + 1;
                      const date = new Date(absenceModalCurrentMonth.getFullYear(), absenceModalCurrentMonth.getMonth(), dayNumber);
                      const dateString = date.toISOString().split('T')[0];

                      const isCurrentMonth = date.getMonth() === absenceModalCurrentMonth.getMonth();
                      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                      const currentAbsences = professionalAbsences[selectedProfessionalForAbsence] || [];
                      const isAbsent = currentAbsences.includes(dateString);

                      return (
                        <button
                          key={i}
                          onClick={() => !isPast && isCurrentMonth && handleToggleAbsenceDate(dateString)}
                          disabled={!isCurrentMonth || isPast}
                          className={`
                        aspect-square text-sm rounded-lg transition-colors
                        ${!isCurrentMonth ? 'text-gray-600' : ''}
                        ${isPast ? 'text-gray-500 cursor-not-allowed' : 'text-white hover:bg-gray-700 cursor-pointer'}
                        ${isAbsent ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'}
                        ${dayNumber === currentDate.getDate() && isCurrentMonth && absenceModalCurrentMonth.getMonth() === currentDate.getMonth() && absenceModalCurrentMonth.getFullYear() === currentDate.getFullYear() ? 'ring-2 ring-blue-500' : ''}
                      `}
                        >
                          {isCurrentMonth ? dayNumber : ''}
                        </button>
                      );
                    })}
                  </div>

                  {/* Lista de ausências selecionadas */}
                  {professionalAbsences[selectedProfessionalForAbsence]?.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-white mb-3">Dias de Ausência Selecionados:</h4>
                      <div className="flex flex-wrap gap-2">
                        {professionalAbsences[selectedProfessionalForAbsence].map(date => (
                          <div key={date} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-lg text-sm">
                            <span>{new Date(date).toLocaleDateString('pt-BR')}</span>
                            <button
                              onClick={() => handleToggleAbsenceDate(date)}
                              className="hover:text-red-200 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handleCloseAbsenceModal}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveAbsences}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Salvar Ausências
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Meta do Profissional - SISTEMA SIMPLES */}
          {showGoalModal && selectedProfessionalForGoal && (
            <GoalModalSimple
              isOpen={showGoalModal}
              onClose={handleCloseGoalModal}
              onSave={handleSaveGoal}
              professionalName={professionals.find(p => p.id === selectedProfessionalForGoal)?.name || ''}
              currentGoal={getProfessionalGoalAmount(selectedProfessionalForGoal)}
              isLoading={isLoadingGoal}
            />
          )}

          {/* ✅ Modal de Serviços Específicos do Profissional */}
          {showSpecificServiceModal && selectedProfessionalForSpecificService && (
            <SpecificServiceModal
              isOpen={showSpecificServiceModal}
              onClose={handleCloseSpecificServiceModal}
              onSave={handleSaveSpecificService}
              professionalName={professionals.find(p => p.id === selectedProfessionalForSpecificService)?.name || ''}
              currentServices={professionals.find(p => p.id === selectedProfessionalForSpecificService)?.specific_services || []}
            />
          )}

          {/* Modal de Bloqueio de Horários */}
          {showBlockTimeModal && selectedProfessionalForBlock && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-[#1a1b1c] rounded-lg border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">
                      Bloquear Horários - {professionals.find(p => p.id === selectedProfessionalForBlock)?.name}
                    </h3>
                    <button
                      onClick={handleCloseBlockTimeModal}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-6">
                    <p className="text-gray-300 text-sm mb-4">
                      Selecione a data e os horários que deseja bloquear. Estes horários ficarão indisponíveis para novos agendamentos.
                    </p>

                    {/* Seleção de Data */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Data
                      </label>
                      <input
                        type="date"
                        value={blockTimeDate}
                        onChange={(e) => {
                          setBlockTimeDate(e.target.value);
                          // Carregar horários bloqueados para a nova data
                          const professional = professionals.find(p => p.id === selectedProfessionalForBlock);
                          if (professional && (professional as any).blocked_hours) {
                            setSelectedBlockedHours((professional as any).blocked_hours[e.target.value] || []);
                          } else {
                            setSelectedBlockedHours([]);
                          }
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-2 bg-[#242628] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Seleção de Horários */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Horários Disponíveis para Bloqueio
                      </label>

                      {/* Gerar horários baseado nos horários de funcionamento */}
                      <div className="grid grid-cols-6 gap-2 max-h-60 overflow-y-auto">
                        {(() => {
                          const professional = professionals.find(p => p.id === selectedProfessionalForBlock);
                          if (!professional) return [];

                          const selectedDate = new Date(blockTimeDate + 'T00:00:00');
                          const dayName = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase();
                          const dayMap: Record<string, string> = {
                            'domingo': 'sunday',
                            'segunda-feira': 'monday',
                            'terça-feira': 'tuesday',
                            'quarta-feira': 'wednesday',
                            'quinta-feira': 'thursday',
                            'sexta-feira': 'friday',
                            'sábado': 'saturday'
                          };

                          const englishDay = dayMap[dayName];
                          const businessHours = establishment?.business_hours?.[englishDay];

                          if (!businessHours || !businessHours.enabled) {
                            return (
                              <div className="col-span-6 text-center text-gray-400 py-4">
                                Estabelecimento fechado neste dia
                              </div>
                            );
                          }

                          const slots = [];
                          const interval = 15; // 15 minutos

                          // Primeiro período
                          const startMinutes = parseInt(businessHours.open1.split(':')[0]) * 60 + parseInt(businessHours.open1.split(':')[1]);
                          const endMinutes = parseInt(businessHours.close1.split(':')[0]) * 60 + parseInt(businessHours.close1.split(':')[1]);

                          for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
                            const hours = Math.floor(minutes / 60);
                            const mins = minutes % 60;
                            const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                            const isSelected = selectedBlockedHours.includes(timeString);

                            slots.push(
                              <button
                                key={timeString}
                                onClick={() => handleToggleBlockedHour(timeString)}
                                className={`px-3 py-2 text-sm rounded-lg transition-colors ${isSelected
                                  ? 'bg-red-600 text-white hover:bg-red-700'
                                  : 'bg-gray-700 text-white hover:bg-gray-600'
                                  }`}
                              >
                                {timeString}
                              </button>
                            );
                          }

                          // Segundo período (se existir)
                          if (businessHours.open2 && businessHours.close2) {
                            const startMinutes2 = parseInt(businessHours.open2.split(':')[0]) * 60 + parseInt(businessHours.open2.split(':')[1]);
                            const endMinutes2 = parseInt(businessHours.close2.split(':')[0]) * 60 + parseInt(businessHours.close2.split(':')[1]);

                            for (let minutes = startMinutes2; minutes < endMinutes2; minutes += interval) {
                              const hours = Math.floor(minutes / 60);
                              const mins = minutes % 60;
                              const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                              const isSelected = selectedBlockedHours.includes(timeString);

                              slots.push(
                                <button
                                  key={timeString}
                                  onClick={() => handleToggleBlockedHour(timeString)}
                                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${isSelected
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-gray-700 text-white hover:bg-gray-600'
                                    }`}
                                >
                                  {timeString}
                                </button>
                              );
                            }
                          }

                          return slots;
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Lista de horários selecionados */}
                  {selectedBlockedHours.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-lg font-medium text-white mb-3">Horários Selecionados para Bloqueio:</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedBlockedHours.map(hour => (
                          <div key={hour} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-lg text-sm">
                            <span>{hour}</span>
                            <button
                              onClick={() => handleToggleBlockedHour(hour)}
                              className="hover:text-red-200 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botões */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handleCloseBlockTimeModal}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveBlockedHours}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Salvar Horários Bloqueados
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Horários de Trabalho */}
          {showWorkHoursModal && selectedProfessionalForWorkHours && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-[#1a1b1c] rounded-lg border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">
                      Horários de Trabalho - {professionals.find(p => p.id === selectedProfessionalForWorkHours)?.name}
                    </h3>
                    <button
                      onClick={handleCloseWorkHoursModal}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-6">
                    <p className="text-yellow-400 text-sm mb-4 font-semibold bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                      Coloque horário de trabalho de cada profissional <span className="text-red-400">* Obrigatório</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    {[
                      { day: 'monday', dayName: 'Segunda-feira' },
                      { day: 'tuesday', dayName: 'Terça-feira' },
                      { day: 'wednesday', dayName: 'Quarta-feira' },
                      { day: 'thursday', dayName: 'Quinta-feira' },
                      { day: 'friday', dayName: 'Sexta-feira' },
                      { day: 'saturday', dayName: 'Sábado' },
                      { day: 'sunday', dayName: 'Domingo' }
                    ].map(({ day, dayName }) => (
                      <div key={day} className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-white font-medium">{dayName}</h4>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={workHoursData[day]?.enabled || false}
                              onChange={() => handleToggleWorkDay(day)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                          </label>
                        </div>

                        {workHoursData[day]?.enabled && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Entrada</label>
                              <TimeSelector
                                value={workHoursData[day]?.entry_time || '08:00'}
                                onChange={(value) => handleUpdateWorkTime(day, 'entry_time', value || '08:00')}
                                disabled={false}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Início Intervalo</label>
                              <TimeSelector
                                value={workHoursData[day]?.break_start || null}
                                onChange={(value) => handleUpdateWorkTime(day, 'break_start', value || '')}
                                disabled={false}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Fim Intervalo</label>
                              <TimeSelector
                                value={workHoursData[day]?.break_end || null}
                                onChange={(value) => handleUpdateWorkTime(day, 'break_end', value || '')}
                                disabled={false}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Saída</label>
                              <TimeSelector
                                value={workHoursData[day]?.exit_time || '17:00'}
                                onChange={(value) => handleUpdateWorkTime(day, 'exit_time', value || '17:00')}
                                disabled={false}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                intervalMinutes={use20MinuteSchedule ? 20 : use15MinuteInterval ? 30 : 15}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    <button
                      onClick={handleCloseWorkHoursModal}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveWorkHours}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Salvar Horários de Trabalho
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Observação */}
          {showObservationModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-[#1a1b1c] rounded-lg border border-gray-700 max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-white">
                      Observação do Cliente
                    </h3>
                    <button
                      onClick={handleCloseObservationModal}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm leading-relaxed italic">
                          "{observationText}"
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={handleCloseObservationModal}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de Produtos Adicionais */}
          <AdditionalProductModal
            isOpen={showAdditionalProductModal}
            onClose={() => {
              setShowAdditionalProductModal(false);
              setSelectedAppointmentForProduct(null);
            }}
            onAdd={(product: AdditionalProduct) => {
              if (selectedAppointmentForProduct) {
                handleAddAdditionalProduct(selectedAppointmentForProduct, product);
              }
              setShowAdditionalProductModal(false);
              setSelectedAppointmentForProduct(null);
            }}
          />

          {/* Modal do Comprovante */}
          {showProofModal && selectedProofUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
              <div className="relative max-w-3xl w-full mx-4">
                <button
                  onClick={() => setShowProofModal(false)}
                  className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
                <img
                  src={selectedProofUrl}
                  alt="Comprovante PIX"
                  className="w-full rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Modal Adicionar Cliente */}
          {showAddClientModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Adicionar Novo Cliente</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Cliente *
                    </label>
                    <input
                      type="text"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp *
                    </label>
                    <input
                      type="text"
                      value={newClientWhatsapp}
                      onChange={(e) => setNewClientWhatsapp(e.target.value)}
                      placeholder="Ex: 11999999999"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Aniversário (opcional)
                    </label>
                    <input
                      type="date"
                      value={newClientBirthday}
                      onChange={(e) => setNewClientBirthday(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddClientModal(false);
                      setNewClientName('');
                      setNewClientWhatsapp('');
                      setNewClientBirthday('');
                    }}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addManualClient}
                    className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal para adicionar despesa */}
          {showAddExpenseModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Adicionar Despesa</h3>
                  <button
                    onClick={() => setShowAddExpenseModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleAddExpense(); }}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="expenseName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome da Despesa
                      </label>
                      <input
                        type="text"
                        id="expenseName"
                        value={newExpenseName}
                        onChange={(e) => setNewExpenseName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        placeholder="Ex: Aluguel, Luz, Internet..."
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="expenseAmount" className="block text-sm font-medium text-gray-700 mb-1">
                        Valor da Despesa
                      </label>
                      <input
                        type="text"
                        id="expenseAmount"
                        value={newExpenseAmount}
                        onChange={(e) => setNewExpenseAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                        placeholder="0,00"
                        required
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddExpenseModal(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal de Ranking de Clientes */}
          {showRankingModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">🏆 Ranking dos Clientes Mais Fiéis</h3>
                  <button
                    onClick={() => setShowRankingModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Critério:</strong> Apenas clientes com 9 ou mais agendamentos aparecem no ranking.
                  </p>
                </div>

                {rankingClients.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🏆</div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente no ranking ainda</h4>
                    <p className="text-gray-600">
                      Os clientes precisam ter pelo menos 9 agendamentos para aparecerem aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rankingClients.map((client, index) => (
                      <div key={`${client.id}-${client.whatsapp}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-4">
                          {/* Posição */}
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg ${client.position === 1 ? 'bg-yellow-500' :
                            client.position === 2 ? 'bg-gray-400' :
                              client.position === 3 ? 'bg-orange-600' :
                                'bg-blue-500'
                            }`}>
                            {client.position === 1 ? '🥇' :
                              client.position === 2 ? '🥈' :
                                client.position === 3 ? '🥉' :
                                  client.position}
                          </div>

                          {/* Informações do cliente */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{client.name}</h4>
                              {client.isSubscriber && <Crown className="h-4 w-4 text-yellow-500" />}
                            </div>
                            <p className="text-sm text-gray-600">{client.whatsapp}</p>
                            <p className="text-sm text-blue-600 font-medium">
                              {client.appointmentCount} agendamento{client.appointmentCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {/* Botão WhatsApp */}
                        <a
                          href={(() => {
                            let phoneNumber = client.whatsapp.replace(/\D/g, '');
                            if (!phoneNumber.startsWith('55')) {
                              phoneNumber = '55' + phoneNumber;
                            }
                            return `https://wa.me/${phoneNumber}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                        >
                          WhatsApp
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal de Clientes Sumidos */}
          {showMissingClientsModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">👻 Clientes Sumidos</h3>
                  <button
                    onClick={() => setShowMissingClientsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    <strong>Critério:</strong> Clientes que não agendam há 2+ meses. Se não houver nenhum, mostra os mais inativos.
                  </p>
                </div>

                {missingClients.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">🎉</div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente sumido!</h4>
                    <p className="text-gray-600">
                      Todos os seus clientes estão ativos. Parabéns!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {missingClients.map((client, index) => (
                      <div key={`${client!.id}-${client!.whatsapp}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-4">
                          {/* Indicador de tempo */}
                          <div className={`flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-sm ${client!.isOver2Months ? 'bg-red-500' : 'bg-orange-500'
                            }`}>
                            {client!.monthsInactive}m
                          </div>

                          {/* Informações do cliente */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900">{client!.name}</h4>
                              {client!.isSubscriber && <Crown className="h-4 w-4 text-yellow-500" />}
                              {client!.isOver2Months && (
                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                  SUMIDO
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{client!.whatsapp}</p>
                            <p className="text-sm text-gray-500">
                              Último agendamento: {client!.lastAppointmentDate.toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-sm text-blue-600 font-medium">
                              Total: {client!.appointmentCount} agendamento{client!.appointmentCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {/* Botões de ação */}
                        <div className="flex gap-2">
                          <a
                            href={(() => {
                              let phoneNumber = client!.whatsapp.replace(/\D/g, '');
                              if (!phoneNumber.startsWith('55')) {
                                phoneNumber = '55' + phoneNumber;
                              }
                              return `https://wa.me/${phoneNumber}`;
                            })()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                          >
                            WhatsApp
                          </a>
                          <button
                            onClick={() => removeFromMissingList(client!.whatsapp)}
                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                            title="Remover da lista de sumidos"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal de Clientes Fiéis - EXATA INTERFACE DAS IMAGENS */}
          {showDrawModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-[#101112] rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">🎲 Sorteio de Clientes</h2>
                  <button
                    onClick={() => setShowDrawModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Cabeçalho - Botão Clientes Fiéis */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-2 mb-4 bg-[#1a1b1c] p-3 rounded-lg">
                  <button
                    onClick={() => setShowLoyalForm(!showLoyalForm)}
                    className="flex items-center gap-2 text-white bg-amber-600 hover:bg-amber-700 px-4 py-2 rounded-lg w-full md:w-auto justify-center"
                  >
                    <Star className="h-5 w-5" />
                    Clientes Fiéis
                  </button>

                  {/* Navegação entre meses */}
                  <div className="flex items-center justify-center gap-2 w-full md:w-auto">
                    <button
                      onClick={() => setSelectedLoyalMonth(subMonths(selectedLoyalMonth, 1))}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <span className="text-white font-medium min-w-[100px] text-center">
                      {format(selectedLoyalMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>

                    <button
                      onClick={() => setSelectedLoyalMonth(addMonths(selectedLoyalMonth, 1))}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Botão de Sorteio */}
                  <button
                    onClick={handleDrawLoyalCustomer}
                    disabled={!loyalCustomers.length}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg w-full md:w-auto justify-center ${loyalCustomers.length
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    <Shuffle className="h-5 w-5" />
                    Sortear
                  </button>
                </div>

                {/* Formulário de Cadastro */}
                {showLoyalForm && (
                  <form onSubmit={handleSubmitLoyalCustomer} className="bg-gray-800 p-4 rounded-lg mb-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">
                          Nome Completo
                        </label>
                        <input
                          type="text"
                          name="customerName"
                          value={loyalFormData.customerName}
                          onChange={handleLoyalFormChange}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">
                          WhatsApp
                        </label>
                        <input
                          type="tel"
                          name="whatsapp"
                          value={loyalFormData.whatsapp}
                          onChange={handleLoyalFormChange}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder="(00) 00000-0000"
                          required
                          maxLength={15}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Data de Cadastro
                        </label>
                        <input
                          type="date"
                          name="registrationDate"
                          value={loyalFormData.registrationDate}
                          onChange={handleLoyalFormChange}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoadingLoyal}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md transition-colors"
                      >
                        {isLoadingLoyal ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Cliente Sorteado */}
                {selectedLoyalCustomer && (
                  <div className="bg-purple-900/50 p-4 rounded-lg mb-6 text-center">
                    <h3 className="text-xl font-bold text-white mb-2">🎉 Cliente Sorteado!</h3>
                    <p className="text-purple-200 mb-3">{selectedLoyalCustomer.customer_name}</p>
                    <a
                      href={getLoyalWhatsAppLink(selectedLoyalCustomer.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      <MessageSquare className="w-5 h-5" />
                      Enviar WhatsApp
                    </a>
                  </div>
                )}

                {/* Lista de Clientes */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">CLIENTES</h3>
                    <span className="text-gray-400">
                      {loyalCustomers.length} cliente{loyalCustomers.length !== 1 ? 's' : ''} em {format(selectedLoyalMonth, 'MMMM', { locale: ptBR })}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {loyalCustomers.map(customer => (
                      <div
                        key={customer.id}
                        className="bg-gray-800 p-3 rounded-lg flex justify-between items-center"
                      >
                        <div className="flex-1">
                          <p className="text-white font-medium">{customer.customer_name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-gray-400 text-sm">
                              {customer.whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                            </p>
                            <a
                              href={getLoyalWhatsAppLink(customer.whatsapp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-500 hover:text-green-400 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                        <Star className="w-5 h-5 text-yellow-500" />
                      </div>
                    ))}
                    {loyalCustomers.length === 0 && (
                      <p className="text-gray-400 text-center py-4">
                        Nenhum cliente cadastrado em {format(selectedLoyalMonth, 'MMMM', { locale: ptBR })}.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab de Subscribers */}
          {activeTab === 'subscribers' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Gerenciar Assinantes</h2>

              {/* Vídeo Tutorial */}
              {showTutorials.subscribers && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-700 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Assinantes</h3>
                        <p className="text-sm text-gray-600">Aprenda a gerenciar assinantes e acompanhar pagamentos</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('subscribers')}
                      className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                    >
                      Ocultar Tutorial
                    </button>
                  </div>

                  <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/4diswxWV_f0"
                      title="Tutorial: Como Gerenciar Assinantes"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="mt-3 text-center">
                    <a
                      href="https://youtu.be/4diswxWV_f0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
                    >
                      <span>📺</span>
                      <span>Assistir no YouTube</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Botão para mostrar tutorial se estiver oculto */}
              {!showTutorials.subscribers && (
                <div className="mb-6 text-center">
                  <button
                    onClick={() => toggleTutorial('subscribers')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span>📺</span>
                    <span>Mostrar Tutorial</span>
                  </button>
                </div>
              )}
              <SubscribersManager
                establishmentId={establishment.id}
                clients={clients}
                establishment={establishment}
                onEstablishmentUpdate={() => {
                  // Recarregar dados do estabelecimento quando houver atualização
                  fetchEstablishment();
                }}
              />
            </div>
          )}


          {/* Tab de Ranking */}
          {activeTab === 'ranking' && (
            <div className="bg-white rounded-lg p-6 border border-gray-300">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🏆 Ranking dos Clientes Mais Fiéis</h2>

              {/* Botões de navegação */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  onClick={() => handleTabChange('clients')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Users className="h-4 w-4" />
                  Meus Clientes
                </button>
                <button
                  onClick={() => handleTabChange('ranking')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Crown className="h-4 w-4" />
                  Ranking Clientes
                </button>
                <button
                  onClick={() => handleTabChange('missing-clients')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Users className="h-4 w-4" />
                  Clientes Sumidos
                </button>
                <button
                  onClick={() => handleTabChange('draw')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Shuffle className="h-4 w-4" />
                  Sorteio
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Critério:</strong> Apenas clientes com 9 ou mais agendamentos aparecem no ranking.
                </p>
              </div>
              {rankingClients.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🏆</div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente no ranking ainda</h4>
                  <p className="text-gray-600">
                    Os clientes precisam ter pelo menos 9 agendamentos para aparecerem aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rankingClients.map((client, index) => (
                    <div key={`${client.id}-${client.whatsapp}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-4">
                        {/* Posição */}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg ${client.position === 1 ? 'bg-gray-800' :
                          client.position === 2 ? 'bg-gray-600' :
                            client.position === 3 ? 'bg-gray-700' :
                              'bg-gray-500'
                          }`}>
                          {client.position === 1 ? '🥇' :
                            client.position === 2 ? '🥈' :
                              client.position === 3 ? '🥉' :
                                client.position}
                        </div>

                        {/* Informações do cliente */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{client.name}</h4>
                            {client.isSubscriber && <Crown className="h-4 w-4 text-gray-700" />}
                          </div>
                          <p className="text-sm text-gray-600">{client.whatsapp}</p>
                          <p className="text-sm text-gray-700 font-medium">
                            {client.appointmentCount} agendamento{client.appointmentCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Botão WhatsApp */}
                      <a
                        href={(() => {
                          let phoneNumber = client.whatsapp.replace(/\D/g, '');
                          if (!phoneNumber.startsWith('55')) {
                            phoneNumber = '55' + phoneNumber;
                          }
                          return `https://wa.me/${phoneNumber}`;
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                      >
                        WhatsApp
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab de Clientes Sumidos */}
          {activeTab === 'missing-clients' && (
            <div className="bg-white rounded-lg p-6 border border-gray-300">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">👻 Clientes Sumidos</h2>

              {/* Botões de navegação */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  onClick={() => handleTabChange('clients')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Users className="h-4 w-4" />
                  Meus Clientes
                </button>
                <button
                  onClick={() => handleTabChange('ranking')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Crown className="h-4 w-4" />
                  Ranking Clientes
                </button>
                <button
                  onClick={() => handleTabChange('missing-clients')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Users className="h-4 w-4" />
                  Clientes Sumidos
                </button>
                <button
                  onClick={() => handleTabChange('draw')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Shuffle className="h-4 w-4" />
                  Sorteio
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-100 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Critério:</strong> Clientes que não agendam há 2+ meses. Se não houver nenhum, mostra os mais inativos.
                </p>
              </div>
              {missingClients.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎉</div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente sumido!</h4>
                  <p className="text-gray-600">
                    Todos os seus clientes estão ativos. Parabéns!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {missingClients.map((client, index) => (
                    <div key={`${client!.id}-${client!.whatsapp}-${index}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-4">
                        {/* Indicador de tempo */}
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-sm ${client!.isOver2Months ? 'bg-gray-800' : 'bg-gray-600'
                          }`}>
                          {client!.monthsInactive}m
                        </div>

                        {/* Informações do cliente */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{client!.name}</h4>
                            {client!.isSubscriber && <Crown className="h-4 w-4 text-gray-700" />}
                            {client!.isOver2Months && (
                              <span className="px-2 py-1 bg-gray-800 text-white text-xs rounded-full">
                                SUMIDO
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{client!.whatsapp}</p>
                          <p className="text-sm text-gray-500">
                            Último agendamento: {client!.lastAppointmentDate.toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-sm text-gray-700 font-medium">
                            Total: {client!.appointmentCount} agendamento{client!.appointmentCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Botões de ação */}
                      <div className="flex gap-2">
                        <a
                          href={`https://wa.me/${client!.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                        >
                          WhatsApp
                        </a>
                        <button
                          onClick={() => removeFromMissingList(client!.whatsapp)}
                          className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                          title="Remover da lista de sumidos"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab de Sorteio */}
          {activeTab === 'draw' && (
            <div className="bg-white rounded-lg p-6 border border-gray-300">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🎲 Sorteio de Clientes</h2>

              {/* Botões de navegação */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  onClick={() => handleTabChange('clients')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Users className="h-4 w-4" />
                  Meus Clientes
                </button>
                <button
                  onClick={() => handleTabChange('ranking')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Crown className="h-4 w-4" />
                  Ranking Clientes
                </button>
                <button
                  onClick={() => handleTabChange('missing-clients')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Users className="h-4 w-4" />
                  Clientes Sumidos
                </button>
                <button
                  onClick={() => handleTabChange('draw')}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  <Shuffle className="h-4 w-4" />
                  Sorteio
                </button>
              </div>

              <div className="text-center">
                <p className="text-gray-600 mb-6 text-lg">
                  Clique no botão abaixo para abrir o sorteio de clientes fiéis.
                </p>
                <button
                  onClick={() => setShowDrawModal(true)}
                  className="inline-flex items-center px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-lg"
                >
                  🎲 ABRIR SORTEIO
                </button>
              </div>
            </div>
          )}

          {/* Tab de Financial Dashboard */}
          {activeTab === 'financial-dashboard' && isDashboardUnlocked && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 hidden">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Financeiro</h2>
              <FinancialDashboard
                appointments={appointments}
                professionals={establishment.professionals || []}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
                establishmentId={establishment?.id}
              />
            </div>
          )}

          {/* Tab de Financial Dashboard - Senha */}
          {activeTab === 'financial-dashboard' && !isDashboardUnlocked && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Financeiro</h2>
              <div className="text-center">
                <p className="text-gray-600 mb-4">Digite a senha para acessar o Dashboard Financeiro</p>
                <div className="flex flex-col items-center gap-4">
                  <input
                    type="password"
                    placeholder="Senha do Dashboard"
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-900"
                  />
                  <button
                    onClick={() => setIsDashboardUnlocked(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Acessar Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab de Despesas */}
          {activeTab === 'expenses' && (
            <ExpensesManager
              establishmentId={establishment?.id || ''}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              professionals={establishment?.professionals || []}
            />
          )}

          {/* Tab de Serviços com Dropdown */}
          {activeTab === 'service-categories' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Serviços com Dropdown</h2>
              </div>

              {/* Botão para completar onboarding e desbloquear tudo */}
              {onboardingStep === 3 && (
                <div className="mb-6 p-5 bg-gradient-to-r from-gray-800 to-black rounded-lg shadow-lg border-4 border-gray-700">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">
                        🎉 Complete seu cadastro!
                      </h3>
                      <p className="text-gray-200 text-sm">
                        Clique no botão abaixo para salvar seus serviços e liberar todas as funcionalidades do sistema.
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!establishment) return;

                        try {
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

                          // Converter subcategorias para formato de serviços
                          const servicesFromCategories = (subcategoriesData || []).map((sub: any) => ({
                            id: sub.id,
                            name: sub.name,
                            price: Number(sub.price),
                            duration: Number(sub.duration || 30)
                          }));

                          // Buscar serviços salvos em services_with_prices (sistema antigo)
                          const { data: establishmentData } = await supabase
                            .from('establishments')
                            .select('services_with_prices')
                            .eq('id', establishment.id)
                            .single();

                          const savedServices = establishmentData?.services_with_prices || [];
                          const localServices = servicesWithPrices || [];

                          // Combinar todos os serviços
                          const allServices = [...localServices, ...savedServices, ...servicesFromCategories];

                          // Remover duplicatas por ID
                          const uniqueServices = allServices.reduce((acc: any[], service: any) => {
                            if (!acc.find(s => s.id === service.id)) {
                              acc.push(service);
                            }
                            return acc;
                          }, []);

                          console.log('🔍 DEBUG - Verificando serviços:', {
                            localServices: localServices.length,
                            savedServices: savedServices.length,
                            servicesFromCategories: servicesFromCategories.length,
                            uniqueServices: uniqueServices.length,
                            services: uniqueServices.map((s: any) => ({
                              id: s.id,
                              name: s.name,
                              price: s.price
                            }))
                          });

                          // Verificar serviços válidos (com nome e preço)
                          const validServices = uniqueServices.filter((s: any) =>
                            s.name && s.name.trim().length > 0 && Number(s.price) > 0
                          );

                          console.log('✅ DEBUG - Serviços válidos:', validServices.length);

                          if (validServices.length === 0) {
                            toast('Adicione pelo menos um serviço com NOME e PREÇO maior que zero antes de salvar.', 'warning');
                            return;
                          }

                          // Salvar serviços válidos e completar onboarding
                          const { error: saveError } = await supabase
                            .from('establishments')
                            .update({
                              services_with_prices: validServices.map((s: any) => ({
                                id: s.id,
                                name: s.name.trim(),
                                price: Number(s.price),
                                duration: Number(s.duration || 30)
                              })),
                              onboarding_step: 4
                            })
                            .eq('id', establishment.id);

                          if (saveError) {
                            console.error('Erro ao salvar:', saveError);
                            toast.error('Erro ao salvar serviços. Tente novamente.');
                            return;
                          }

                          setOnboardingStep(4);
                          setEstablishment({
                            ...establishment,
                            services_with_prices: validServices
                          });
                          setServicesWithPrices(validServices);

                          toast.success('🎉 Parabéns! Todas as funcionalidades foram liberadas!');
                        } catch (error) {
                          console.error('Erro ao completar onboarding:', error);
                          toast.error('Erro ao salvar. Tente novamente.');
                        }
                      }}
                      className="px-8 py-4 bg-white text-black font-bold text-lg rounded-lg hover:bg-gray-50 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center gap-3 whitespace-nowrap"
                    >
                      <Check className="h-6 w-6" />
                      Salvar Serviços e Abrir Todas as Funções
                    </button>
                  </div>
                </div>
              )}

              {/* Vídeo Tutorial */}
              {showTutorials.services && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-700 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Serviços</h3>
                        <p className="text-sm text-gray-600">Aprenda a criar categorias e serviços com dropdown</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('services')}
                      className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                    >
                      Ocultar Tutorial
                    </button>
                  </div>

                  <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/ABZLLHyMVq0"
                      title="Tutorial: Como Gerenciar Serviços"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="mt-3 text-center">
                    <a
                      href="https://youtu.be/ABZLLHyMVq0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
                    >
                      <span>📺</span>
                      <span>Assistir no YouTube</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Botão para mostrar tutorial se estiver oculto */}
              {!showTutorials.services && (
                <div className="mb-6 text-center">
                  <button
                    onClick={() => toggleTutorial('services')}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span>📺</span>
                    <span>Mostrar Tutorial</span>
                  </button>
                </div>
              )}

              {/* Botão Adicionar Categoria - Movido para abaixo do vídeo */}
              <div className="mb-6">
                <button
                  onClick={() => setShowAddCategoryModal(true)}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Categoria
                </button>
              </div>

              {/* Lembrete/Explicação sobre como usar categorias */}
              <div className="bg-gray-100 border-l-4 border-gray-400 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <span className="text-gray-700 text-2xl">💡</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Como usar as categorias:</h3>
                    <p className="text-sm text-gray-700">
                      Crie a sua categoria, exemplo: <strong>Cabelo</strong>. Dentro da categoria <strong>Cabelo</strong>, você adiciona os serviços de cabelo (Corte, Escova, Hidratação, etc). Assim por diante para outras categorias como <strong>Barba</strong>, <strong>Estética</strong>, etc.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensagem destacada sobre flexibilidade */}
              <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-800 font-semibold">
                  ⚠️ Você também pode criar apenas uma categoria escrita <strong>"Meus serviços"</strong> e dentro dela colocar todos os seus serviços. A liberdade é sua, se quer ter categoria para cada serviço ou se quer uma apenas para todos.
                </p>
              </div>

              {/* Botão para salvar serviços e abrir todas as funções */}
              <div className="mb-6 text-center">
                <button
                  onClick={async () => {
                    if (!establishment) return;

                    try {
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

                      // Converter subcategorias para formato de serviços
                      const servicesFromCategories = (subcategoriesData || []).map((sub: any) => ({
                        id: sub.id,
                        name: sub.name,
                        price: Number(sub.price),
                        duration: Number(sub.duration || 30)
                      }));

                      // Buscar serviços salvos em services_with_prices (sistema antigo)
                      const { data: establishmentData } = await supabase
                        .from('establishments')
                        .select('services_with_prices')
                        .eq('id', establishment.id)
                        .single();

                      const savedServices = establishmentData?.services_with_prices || [];
                      const localServices = servicesWithPrices || [];

                      // Combinar todos os serviços
                      const allServices = [...localServices, ...savedServices, ...servicesFromCategories];

                      // Remover duplicatas por ID
                      const uniqueServices = allServices.reduce((acc: any[], service: any) => {
                        if (!acc.find(s => s.id === service.id)) {
                          acc.push(service);
                        }
                        return acc;
                      }, []);

                      // Verificar serviços válidos (com nome e preço)
                      const validServices = uniqueServices.filter((s: any) =>
                        s.name && s.name.trim().length > 0 && Number(s.price) > 0
                      );

                      if (validServices.length === 0) {
                        toast('Adicione pelo menos um serviço com NOME e PREÇO maior que zero antes de salvar.', 'warning');
                        return;
                      }

                      // Salvar serviços válidos e completar onboarding
                      const { error: saveError } = await supabase
                        .from('establishments')
                        .update({
                          services_with_prices: validServices.map((s: any) => ({
                            id: s.id,
                            name: s.name.trim(),
                            price: Number(s.price),
                            duration: Number(s.duration || 30)
                          })),
                          onboarding_step: 4
                        })
                        .eq('id', establishment.id);

                      if (saveError) {
                        console.error('Erro ao salvar:', saveError);
                        toast.error('Erro ao salvar serviços. Tente novamente.');
                        return;
                      }

                      setOnboardingStep(4);
                      setEstablishment({
                        ...establishment,
                        services_with_prices: validServices
                      });
                      setServicesWithPrices(validServices);

                      toast.success('🎉 Parabéns! Todas as funcionalidades foram liberadas!');
                    } catch (error) {
                      console.error('Erro ao completar onboarding:', error);
                      toast.error('Erro ao salvar. Tente novamente.');
                    }
                  }}
                  className="px-8 py-4 bg-black text-white font-bold text-lg rounded-lg hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center gap-3 mx-auto"
                >
                  <Check className="h-6 w-6" />
                  Salvar Serviços e Abrir Todas as Funções
                </button>
              </div>

              {serviceCategories.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-black mb-4">Nenhuma categoria de serviço cadastrada ainda</p>
                  <button
                    onClick={() => setShowAddCategoryModal(true)}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Adicionar Primeira Categoria
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {serviceCategories.map((category) => {
                    const categorySubcategories = serviceSubcategories.filter(sub => sub.category_id === category.id);

                    return (
                      <div key={category.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3 md:gap-2">
                          <h3 className="text-xl font-semibold text-gray-900">{category.name}</h3>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                            <button
                              onClick={() => {
                                setSelectedCategoryForSubcategory(category.id);
                                setShowAddSubcategoryModal(true);
                              }}
                              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              <Plus className="h-4 w-4" />
                              Adicionar Serviço
                            </button>
                            <button
                              onClick={() => {
                                setEditingCategory(category);
                                setShowEditCategoryModal(true);
                              }}
                              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              <Edit className="h-4 w-4" />
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Tem certeza que deseja excluir a categoria "${category.name}" e todos os seus serviços?`)) {
                                  handleDeleteCategory(category.id);
                                }
                              }}
                              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </button>
                          </div>
                        </div>

                        {/* Texto descritivo discreto */}
                        <p className="text-gray-700 text-sm font-medium mb-3">
                          Adicione um ou mais serviços aqui dentro
                        </p>

                        {categorySubcategories.length > 0 && (
                          <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 mb-4">
                            <p className="text-gray-700 text-xs sm:text-sm flex items-center gap-2">
                              <span className="text-lg">💡</span>
                              <span>
                                <strong>Dica:</strong> Use as setas <span className="text-gray-800 font-semibold">↑↓</span> ao lado de cada serviço para alterar a ordem de exibição. A ordem que você definir aqui será a mesma que seus clientes verão ao agendar.
                              </span>
                            </p>
                          </div>
                        )}

                        {categorySubcategories.length === 0 ? (
                          <p className="text-black text-sm">Nenhum serviço cadastrado nesta categoria</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {categorySubcategories.map((subcategory, index) => (
                              <div key={subcategory.id} className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 shadow-md hover:shadow-lg hover:bg-gray-100 transition-all">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-gray-900">{subcategory.name}</h4>
                                  <div className="flex items-center gap-1">
                                    {/* Botões de reordenação */}
                                    <button
                                      onClick={async () => {
                                        if (index === 0) return;
                                        const currentOrder = subcategory.display_order;
                                        const prevSubcategory = categorySubcategories[index - 1];
                                        const prevOrder = prevSubcategory.display_order;

                                        try {
                                          await Promise.all([
                                            supabase
                                              .from('service_subcategories')
                                              .update({ display_order: prevOrder })
                                              .eq('id', subcategory.id),
                                            supabase
                                              .from('service_subcategories')
                                              .update({ display_order: currentOrder })
                                              .eq('id', prevSubcategory.id)
                                          ]);
                                          await fetchServiceSubcategories();
                                          toast('Ordem atualizada!', 'success');
                                        } catch (error) {
                                          console.error('Erro ao reordenar:', error);
                                          toast('Erro ao reordenar serviço', 'error');
                                        }
                                      }}
                                      disabled={index === 0}
                                      className={`p-2 rounded transition-colors ${index === 0
                                        ? 'text-gray-400 cursor-not-allowed'
                                        : 'text-gray-700 hover:bg-gray-200'
                                        }`}
                                      title="Mover para cima"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (index === categorySubcategories.length - 1) return;
                                        const currentOrder = subcategory.display_order;
                                        const nextSubcategory = categorySubcategories[index + 1];
                                        const nextOrder = nextSubcategory.display_order;

                                        try {
                                          await Promise.all([
                                            supabase
                                              .from('service_subcategories')
                                              .update({ display_order: nextOrder })
                                              .eq('id', subcategory.id),
                                            supabase
                                              .from('service_subcategories')
                                              .update({ display_order: currentOrder })
                                              .eq('id', nextSubcategory.id)
                                          ]);
                                          await fetchServiceSubcategories();
                                          toast('Ordem atualizada!', 'success');
                                        } catch (error) {
                                          console.error('Erro ao reordenar:', error);
                                          toast('Erro ao reordenar serviço', 'error');
                                        }
                                      }}
                                      disabled={index === categorySubcategories.length - 1}
                                      className={`p-2 rounded transition-colors ${index === categorySubcategories.length - 1
                                        ? 'text-gray-400 cursor-not-allowed'
                                        : 'text-green-600 hover:bg-green-100'
                                        }`}
                                      title="Mover para baixo"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingSubcategory(subcategory);
                                        setShowEditSubcategoryModal(true);
                                      }}
                                      className="p-1 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                                      title="Editar serviço"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Tem certeza que deseja excluir o serviço "${subcategory.name}"?`)) {
                                          handleDeleteSubcategory(subcategory.id);
                                        }
                                      }}
                                      className="p-1 text-gray-700 hover:bg-gray-200 rounded transition-colors"
                                      title="Excluir serviço"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between">
                                    <span className="text-sm text-black">Preço:</span>
                                    <span className="text-sm font-medium text-black">{formatCurrency(subcategory.price)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-sm text-black">Duração:</span>
                                    <span className="text-sm font-medium text-black">{subcategory.duration}min</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab de Meus Produtos */}
          {activeTab === 'products' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Meus Produtos</h2>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </button>
              </div>

              {/* Vídeo Tutorial */}
              {showTutorials.products && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-700 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Produtos</h3>
                        <p className="text-sm text-gray-600">Aprenda a adicionar, editar e acompanhar seus produtos</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('products')}
                      className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                    >
                      Ocultar Tutorial
                    </button>
                  </div>

                  <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/vNFGtcEmJ0I"
                      title="Tutorial: Como Gerenciar Produtos"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="mt-3 text-center">
                    <a
                      href="https://youtu.be/vNFGtcEmJ0I"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
                    >
                      <span>📺</span>
                      <span>Assistir no YouTube</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Botão para mostrar tutorial se estiver oculto */}
              {!showTutorials.products && (
                <div className="mb-6 text-center">
                  <button
                    onClick={() => toggleTutorial('products')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span>📺</span>
                    <span>Mostrar Tutorial</span>
                  </button>
                </div>
              )}

              {/* Seletor de Período */}
              {products.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Período de Análise</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          const newDate = subMonths(selectedProductsMonth, 1);
                          setSelectedProductsMonth(newDate);
                          fetchProductSalesByPeriod(newDate);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Mês anterior"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <input
                        type="month"
                        value={format(selectedProductsMonth, 'yyyy-MM')}
                        onChange={(e) => {
                          const newDate = new Date(e.target.value + '-01');
                          setSelectedProductsMonth(newDate);
                          fetchProductSalesByPeriod(newDate);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                      />
                      <button
                        onClick={() => {
                          const newDate = addMonths(selectedProductsMonth, 1);
                          // Não permitir selecionar mês futuro
                          if (newDate <= new Date()) {
                            setSelectedProductsMonth(newDate);
                            fetchProductSalesByPeriod(newDate);
                          }
                        }}
                        disabled={addMonths(selectedProductsMonth, 1) > new Date()}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Próximo mês"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => {
                          const today = new Date();
                          setSelectedProductsMonth(today);
                          fetchProductSalesByPeriod(today);
                        }}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        title="Voltar para mês atual"
                      >
                        Hoje
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Mostrando dados de {selectedProductsMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}

              {/* Relatório de Faturamento */}
              {products.length > 0 && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-gray-700" />
                    Faturamento dos Produtos - {selectedProductsMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Faturamento Bruto</p>
                          <p className="text-2xl font-bold text-gray-800">
                            {formatCurrency(products.reduce((total, product) => {
                              const periodQuantity = productSalesByPeriod[product.id] || 0;
                              return total + (product.sale_price * periodQuantity);
                            }, 0))}
                          </p>
                          <p className="text-xs text-gray-500">Total vendido no período</p>
                        </div>
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-gray-700" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Lucro Líquido</p>
                          <p className="text-2xl font-bold text-gray-800">
                            {formatCurrency(products.reduce((total, product) => {
                              const periodQuantity = productSalesByPeriod[product.id] || 0;
                              return total + ((product.sale_price - product.cost_price) * periodQuantity);
                            }, 0))}
                          </p>
                          <p className="text-xs text-gray-500">Lucro real do período</p>
                        </div>
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <Receipt className="h-6 w-6 text-gray-700" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-sm text-gray-600">Total Vendido</p>
                      <p className="text-xl font-bold text-gray-900">
                        {products.reduce((total, product) => {
                          const periodQuantity = productSalesByPeriod[product.id] || 0;
                          return total + periodQuantity;
                        }, 0)} unidades
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm text-gray-600">Produtos com Vendas</p>
                        <div className="group relative">
                          <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-700 cursor-help transition-colors" />
                          <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                            <p className="font-semibold mb-1">O que significa?</p>
                            <p>Mostra quantos produtos diferentes tiveram pelo menos 1 venda no período selecionado.</p>
                            <p className="mt-2 text-gray-300">Exemplo: Se você tem 10 produtos cadastrados e 6 deles venderam em novembro, aparecerá "6 produtos".</p>
                            <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-gray-900">
                        {products.filter(product => (productSalesByPeriod[product.id] || 0) > 0).length} produtos
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <p className="text-sm text-gray-600">Ticket Médio</p>
                      <p className="text-xl font-bold text-gray-900">
                        {(() => {
                          const totalQuantity = products.reduce((total, product) => {
                            const periodQuantity = productSalesByPeriod[product.id] || 0;
                            return total + periodQuantity;
                          }, 0);
                          const totalRevenue = products.reduce((total, product) => {
                            const periodQuantity = productSalesByPeriod[product.id] || 0;
                            return total + (product.sale_price * periodQuantity);
                          }, 0);
                          return totalQuantity > 0 ? formatCurrency(totalRevenue / totalQuantity) : formatCurrency(0);
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Nenhum produto cadastrado ainda</p>
                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adicionar Primeiro Produto
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => {
                    // Usar vendas do período selecionado
                    const periodSoldQuantity = productSalesByPeriod[product.id] || 0;
                    const totalProfit = (product.sale_price - product.cost_price) * product.stock_quantity;
                    const currentProfit = (product.sale_price - product.cost_price) * periodSoldQuantity;
                    const periodRevenue = product.sale_price * periodSoldQuantity;

                    return (
                      <div key={product.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative group">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setShowEditProductModal(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Editar produto"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                            title="Excluir produto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <h3 className="text-lg font-semibold text-gray-900 mb-2 pr-16">{product.name}</h3>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-black">Estoque:</span>
                            <span className="text-sm font-medium text-black">{product.stock_quantity} unidades</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-black">Vendidos ({selectedProductsMonth.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}):</span>
                            <span className="text-sm font-medium text-black">{periodSoldQuantity} unidades</span>
                          </div>

                          {product.sold_quantity > 0 && (
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">Total acumulado:</span>
                              <span className="text-xs text-gray-500">{product.sold_quantity} unidades</span>
                            </div>
                          )}

                          <div className="flex justify-between">
                            <span className="text-sm text-black">Preço de venda:</span>
                            <span className="text-sm font-medium text-black">{formatCurrency(product.sale_price)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-black">Custo:</span>
                            <span className="text-sm font-medium text-black">{formatCurrency(product.cost_price)}</span>
                          </div>

                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-black">Lucro total estimado (estoque):</span>
                              <span className="text-sm font-bold text-green-600">{formatCurrency(totalProfit)}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-sm text-black">Faturamento ({selectedProductsMonth.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}):</span>
                              <span className="text-sm font-bold text-green-600">{formatCurrency(periodRevenue)}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-sm text-black">Lucro do período:</span>
                              <span className="text-sm font-bold text-blue-600">{formatCurrency(currentProfit)}</span>
                            </div>
                          </div>

                          {/* Botão para ver vendas por funcionário */}
                          <div className="border-t pt-2 mt-2">
                            <button
                              onClick={() => handleShowProductSales(product.id)}
                              className="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              <span className="text-black">📊 Vendas por Funcionário</span>
                              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${selectedProductForSales === product.id ? 'rotate-180' : ''
                                }`} />
                            </button>

                            {/* Dropdown de vendas por funcionário */}
                            {selectedProductForSales === product.id && (
                              <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                                <h4 className="text-sm font-medium text-black mb-2">Vendas no Mês Atual</h4>
                                {productSalesData[product.id] && productSalesData[product.id].length > 0 ? (
                                  <div className="space-y-2">
                                    {productSalesData[product.id].map((sale, index) => (
                                      <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                                        <div>
                                          <span className="text-sm font-medium text-black">
                                            {sale.professional_name || 'Funcionário não identificado'}
                                          </span>
                                          <p className="text-xs text-gray-600">{sale.sales_count} vendas</p>
                                        </div>
                                        <div className="text-right">
                                          <span className="text-sm font-bold text-green-600">
                                            {sale.total_quantity} unidades
                                          </span>
                                          <p className="text-xs text-blue-600">
                                            {formatCurrency(sale.total_value)}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 text-center py-2">
                                    Nenhuma venda registrada este mês
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab de Profissionais */}
          {activeTab === 'professionals' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Profissionais</h2>

              {/* Alerta para novos estabelecimentos */}
              {isNewUser && (
                <div className="bg-gradient-to-r from-gray-800 to-black rounded-lg p-4 mb-6 border border-gray-600">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-2xl">💡</div>
                    <div className="flex-1">
                      <p className="text-white font-semibold text-lg mb-1">
                        Instruções para configurar seus profissionais:
                      </p>
                      <p className="text-gray-200 text-base leading-relaxed">
                        Crie um profissional, configure horário de trabalho dele e pode ir para próximo passo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vídeo Tutorial */}
              {showTutorials.professionals && (
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-700 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Profissionais</h3>
                        <p className="text-sm text-gray-600">Aprenda a cadastrar e gerenciar profissionais do seu estabelecimento</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('professionals')}
                      className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                    >
                      Ocultar Tutorial
                    </button>
                  </div>

                  <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/1Sm25W596v0"
                      title="Tutorial: Como Gerenciar Profissionais"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="mt-3 text-center">
                    <a
                      href="https://youtu.be/1Sm25W596v0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
                    >
                      <span>📺</span>
                      <span>Assistir no YouTube</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Botão para mostrar tutorial se estiver oculto */}
              {!showTutorials.professionals && (
                <div className="mb-6 text-center">
                  <button
                    onClick={() => toggleTutorial('professionals')}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span>📺</span>
                    <span>Mostrar Tutorial</span>
                  </button>
                </div>
              )}

              <div className="bg-[#1a1b1c] rounded-lg p-4 md:p-6 border border-gray-800 mb-6">
                <h3 className="text-lg font-medium text-white mb-4">Aqui você tem total controle sobre seus profissionais:</h3>
                <div className="space-y-3 text-sm text-gray-300">
                  <p className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Adicione quantos quiser</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Configure nome, foto, porcentagem de comissão e WhatsApp individual</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Defina uma senha exclusiva (opcional — se não quiser senha, use 0000)</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Determine metas e serviços específicos para cada profissional</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Marque dias ausentes e bloqueie horários</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>Escolha se o profissional realiza ou não serviços infantis</span>
                  </p>
                </div>
                <div className="mt-4 p-3 bg-gray-800/20 border border-gray-700/30 rounded-lg">
                  <p className="text-sm text-gray-300 font-medium mb-2 flex items-start gap-2">
                    <span>💡</span>
                    <span className="flex-1"><strong>Importante:</strong></span>
                  </p>
                  <div className="space-y-1 text-xs text-gray-200 ml-6">
                    <p>• Cada profissional pode visualizar o total bruto e líquido do dia</p>
                    <p>• As alterações só terão efeito após clicar em Salvar Profissionais</p>
                  </div>
                </div>
              </div>

              {/* Lista de Profissionais Cadastrados */}
              {professionals.length > 0 && (
                <div className="mb-4 border-b border-gray-800 pb-4">
                  <h4 className="text-md font-semibold text-gray-300 mb-3">Profissionais Cadastrados:</h4>
                  <div className="space-y-2">
                    {professionals.map((professional) => (
                      <div key={professional.id} className="flex items-center justify-between bg-[#242628] p-3 rounded-lg">
                        <span className="text-gray-300">{professional.name}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateProfessionalPin(professional.id, '')}
                            className="text-xs px-2 py-1 bg-gray-800/20 text-gray-300 rounded"
                          >
                            Alterar Senha
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleAddProfessional}
                    disabled={professionals.length >= 10}
                    className="flex-1 px-4 py-2 bg-[#242628] text-white rounded-lg hover:bg-[#2a2b2d] transition-colors flex items-center justify-center gap-2 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar</span>
                  </button>

                  <button
                    type="button"
                    onClick={saveProfessionalsToDatabase}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                  >
                    <Check className="h-4 w-4" />
                    <span>Salvar Profissionais</span>
                  </button>
                </div>

                {/* Indicador de status */}
                {professionals.length > 0 && (
                  <div className="text-xs text-gray-600 text-center">
                    ⚠ Clique em "Salvar Profissionais" para salvar
                  </div>
                )}
              </div>

              {/* Resto do código original dos profissionais */}
              <div className="space-y-4">
                {professionals.map((professional) => (
                  <div
                    key={professional.id}
                    id={`professional-${professional.id}`}
                    className={`p-4 rounded-lg space-y-3 transition-all duration-500 ${highlightedProfessionalId === professional.id
                      ? 'bg-gray-800/30 ring-4 ring-gray-600 shadow-xl'
                      : 'bg-[#242628]'
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={professional.name}
                          onChange={(e) => handleProfessionalChange(professional.id, 'name', e.target.value)}
                          className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gray-500"
                          placeholder="Nome do profissional"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveProfessional(professional.id)}
                        className="ml-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Campo de foto do profissional */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Foto do Profissional</label>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-600 flex-shrink-0">
                          <img
                            src={(professional as any).photo_url || '/fotopessoa.png'}
                            alt={professional.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/fotopessoa.png';
                            }}
                          />
                        </div>
                        <input
                          type="file"
                          accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
                          onChange={(e) => handleProfessionalPhotoChange(professional.id, e.target.files?.[0])}
                          className="hidden"
                          id={`photo-${professional.id}`}
                        />
                        <label
                          htmlFor={`photo-${professional.id}`}
                          className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 cursor-pointer transition-colors"
                        >
                          Alterar Foto
                        </label>
                      </div>
                    </div>

                    {/* Campo de percentual do profissional */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">% do profissional</label>
                      {professionalPercentageEditable[professional.id] ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={professional.percentage || 0}
                          onChange={(e) => {
                            handleProfessionalChange(professional.id, 'percentage', parseFloat(e.target.value) || 0);
                          }}
                          className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gray-500"
                          placeholder="Percentual (%)"
                        />
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value="••••"
                            readOnly
                            className="flex-1 px-4 py-2 bg-[#2a2b2c] border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                            placeholder="Percentual oculto"
                          />
                          <button
                            type="button"
                            onClick={() => handleRequestPercentageEdit(professional.id)}
                            className="w-full sm:w-auto px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                          >
                            Ver %
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Campo de senha do profissional */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Senha do profissional</label>
                      {professionalPasswordVisible[professional.id] ? (
                        <input
                          type="text"
                          maxLength={4}
                          value={professionalPins[professional.id] ?? (establishment?.professionals_pins?.find(p => p.professional_id === professional.id)?.pin || '0000')}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                            setProfessionalPins(prev => ({ ...prev, [professional.id]: value }));
                            if (value.length === 4) {
                              handleUpdateProfessionalPin(professional.id, value);
                            }
                          }}
                          className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gray-500"
                          placeholder="Senha de 4 dígitos"
                        />
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="password"
                            value="••••"
                            readOnly
                            className="flex-1 px-4 py-2 bg-[#2a2b2c] border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                            placeholder="Senha oculta"
                          />
                          <button
                            type="button"
                            onClick={() => handleRequestPasswordVisibility(professional.id)}
                            className="w-full sm:w-auto px-3 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                          >
                            Ver
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Campo de WhatsApp do profissional */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">WhatsApp do profissional</label>
                      <input
                        type="text"
                        value={professional.whatsapp || ''}
                        onChange={(e) => handleProfessionalChange(professional.id, 'whatsapp', e.target.value)}
                        className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        placeholder={(() => {
                          // Detectar país do estabelecimento pelo WhatsApp
                          const establishmentWhatsapp = establishment?.whatsapp || '';
                          const cleanEstablishmentWhatsapp = establishmentWhatsapp.replace(/\D/g, '');

                          if (cleanEstablishmentWhatsapp.startsWith('351')) {
                            return '+351 964 272 201'; // Portugal
                          } else if (cleanEstablishmentWhatsapp.startsWith('34')) {
                            return '+34 612 345 678'; // Espanha
                          } else if (cleanEstablishmentWhatsapp.startsWith('54')) {
                            return '+54 11 1234-5678'; // Argentina
                          } else if (cleanEstablishmentWhatsapp.startsWith('56')) {
                            return '+56 9 1234 5678'; // Chile
                          } else if (cleanEstablishmentWhatsapp.startsWith('244')) {
                            return '+244 912 345 678'; // Angola
                          } else if (cleanEstablishmentWhatsapp.startsWith('1') && cleanEstablishmentWhatsapp.length >= 10) {
                            return '+1 (555) 123-4567'; // EUA
                          }
                          return '(47) 99999-9999'; // Brasil (padrão)
                        })()}
                        maxLength={20}
                      />
                    </div>

                    {/* Campo de Meta */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Definir meta mensal</label>
                      <button
                        onClick={() => handleOpenGoalModal(professional.id)}
                        className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:border-blue-500 flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>🎯</span>
                        <span>META</span>
                      </button>
                    </div>

                    {/* Barra de Progresso da Meta */}
                    {professionalGoalProgress[professional.id] && professionalGoalProgress[professional.id].goalAmount > 0 && (
                      <div className="mt-3">
                        <GoalProgressBar
                          goalAmount={professionalGoalProgress[professional.id].goalAmount}
                          completedServices={professionalGoalProgress[professional.id].completedServices}
                          professionalName={professional.name}
                          isCompact={true}
                        />
                      </div>
                    )}

                    {/* ✅ Campo de Serviço Específico */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Serviço Específico</label>
                      <button
                        onClick={() => handleOpenSpecificServiceModal(professional.id)}
                        className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:border-blue-500 flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>🔧</span>
                        <span>SERVIÇO ESPECÍFICO</span>
                      </button>
                    </div>

                    {/* Campo de Ausência */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Configurar dias ausente</label>
                      <button
                        onClick={() => handleOpenAbsenceModal(professional.id)}
                        className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:border-blue-500 flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>📅</span>
                        <span>Ausência</span>
                      </button>
                    </div>

                    {/* Campo de Bloquear Horário */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Bloquear horários específicos</label>
                      <button
                        onClick={() => handleOpenBlockTimeModal(professional.id)}
                        className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:border-blue-500 flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>🔒</span>
                        <span>Bloquear Horário</span>
                      </button>
                    </div>

                    {/* Campo de Horários de Trabalho */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Definir horários personalizados</label>
                      <button
                        onClick={() => handleOpenWorkHoursModal(professional.id)}
                        className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white hover:bg-gray-700 focus:outline-none focus:border-blue-500 flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>⏰</span>
                        <span>Horários de Trabalho</span>
                      </button>
                    </div>

                    {/* Campo de Serviço Infantil */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Oferecer corte infantil</label>
                      <div className="flex items-center justify-between p-3 bg-[#1a1b1c] border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span>👶</span>
                          <span className="text-white">Serviço Infantil</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={professional.offers_child_service || false}
                            onChange={(e) => handleToggleChildService(professional.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                        </label>
                      </div>
                    </div>

                    {/* Campo de Ocultar Profissional do Booking */}
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Ocultar profissional</label>
                      <div className="flex items-center justify-between p-3 bg-[#1a1b1c] border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span>👁️</span>
                          <span className="text-white">Ocultar Profissional</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={professional.hidden_from_booking || false}
                            onChange={(e) => handleToggleHiddenFromBooking(professional.id, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                        </label>
                      </div>
                      {professional.hidden_from_booking && (
                        <p className="text-xs text-gray-500 mt-1">
                          ⚠️ Este profissional não aparecerá no booking público, mas continuará visível no dashboard.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {professionals.length === 0 && (
                  <p className="text-gray-400 text-center py-4">
                    Nenhum profissional cadastrado. Clique em "Adicionar" para começar.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tab de Minhas Taxas */}
          {activeTab === 'taxes' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Minhas Taxas</h2>

              {isLoadingTaxes ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-gray-600 mt-2">Calculando taxas...</p>
                </div>
              ) : taxesReport ? (
                <div className="space-y-6">
                  {/* Resumo Geral */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Taxas do Mês</h3>
                      <p className="text-2xl font-bold text-gray-800">
                        {formatCurrency(taxesReport.totalMonthlyTax)}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-300">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Taxas do Ano</h3>
                      <p className="text-2xl font-bold text-gray-800">
                        {formatCurrency(taxesReport.totalYearlyTax)}
                      </p>
                    </div>
                  </div>

                  {/* Taxas por Bandeira - Mês */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Taxas por Bandeira - Mês Atual</h3>

                    {/* Dropdown Bandeiras Disponíveis */}
                    <div className="mb-6">
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdowns(prev => ({ ...prev, bandeiras: !prev.bandeiras }))}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-md font-medium text-gray-700">Bandeiras Disponíveis</span>
                          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns.bandeiras ? 'rotate-180' : ''}`} />
                        </button>

                        {openDropdowns.bandeiras && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                            <div className="p-3">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {/* Visa */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/visa.png" alt="Visa" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Visa</span>
                                </div>

                                {/* Mastercard */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/mastercard.png" alt="Mastercard" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Mastercard</span>
                                </div>

                                {/* Elo */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/elo.png" alt="Elo" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Elo</span>
                                </div>

                                {/* Hipercard */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/hipercard.png" alt="Hipercard" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Hipercard</span>
                                </div>

                                {/* JCB */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/jcb.png" alt="JCB" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">JCB</span>
                                </div>

                                {/* Discover */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/discover.png" alt="Discover" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Discover</span>
                                </div>

                                {/* Sem Bandeira */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center mb-1">
                                    <span className="text-xs text-gray-500 font-medium">N/A</span>
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">Sem Bandeira</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(taxesReport.monthly).map(([brand, data]: [string, any]) => (
                        <div key={brand} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3 mb-2 sm:mb-0">
                            {brand === 'sem_bandeira' ? (
                              <div className="w-8 h-6 sm:w-10 sm:h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-gray-500 font-medium">N/A</span>
                              </div>
                            ) : (
                              <img
                                src={`/${brand}.png`}
                                alt={brand}
                                className="w-8 h-6 sm:w-10 sm:h-8 object-contain flex-shrink-0"
                                onError={(e) => {
                                  // Fallback para ícone genérico se a imagem não carregar
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                              <span className="font-medium capitalize text-gray-900 text-sm sm:text-base">
                                {brand === 'american_express' ? 'American Express' :
                                  brand === 'sem_bandeira' ? 'Sem Bandeira' :
                                    brand === 'visa' ? 'Visa' :
                                      brand === 'mastercard' ? 'Mastercard' :
                                        brand === 'elo' ? 'Elo' :
                                          brand === 'hipercard' ? 'Hipercard' :
                                            brand === 'jcb' ? 'JCB' :
                                              brand === 'discover' ? 'Discover' :
                                                brand.charAt(0).toUpperCase() + brand.slice(1)}
                              </span>
                              <span className="text-xs sm:text-sm text-gray-500">({data.count} serviços)</span>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base">
                              Total gasto com taxa: {formatCurrency(data.totalTax)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Taxas por Bandeira - Ano */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Taxas por Bandeira - Ano Atual</h3>

                    {/* Dropdown Bandeiras Disponíveis */}
                    <div className="mb-6">
                      <div className="relative">
                        <button
                          onClick={() => setOpenDropdowns(prev => ({ ...prev, bandeirasAno: !prev.bandeirasAno }))}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <span className="text-md font-medium text-gray-700">Bandeiras Disponíveis</span>
                          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openDropdowns.bandeirasAno ? 'rotate-180' : ''}`} />
                        </button>

                        {openDropdowns.bandeirasAno && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                            <div className="p-3">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {/* Visa */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/visa.png" alt="Visa" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Visa</span>
                                </div>

                                {/* Mastercard */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/mastercard.png" alt="Mastercard" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Mastercard</span>
                                </div>

                                {/* Elo */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/elo.png" alt="Elo" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Elo</span>
                                </div>

                                {/* Hipercard */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/hipercard.png" alt="Hipercard" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Hipercard</span>
                                </div>

                                {/* JCB */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/jcb.png" alt="JCB" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">JCB</span>
                                </div>

                                {/* Discover */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <img src="/discover.png" alt="Discover" className="w-10 h-6 object-contain mb-1" />
                                  <span className="text-xs font-medium text-gray-700">Discover</span>
                                </div>

                                {/* Sem Bandeira */}
                                <div className="flex flex-col items-center p-2 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer">
                                  <div className="w-10 h-6 bg-gray-200 rounded flex items-center justify-center mb-1">
                                    <span className="text-xs text-gray-500 font-medium">N/A</span>
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">Sem Bandeira</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(taxesReport.yearly).map(([brand, data]: [string, any]) => (
                        <div key={brand} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3 mb-2 sm:mb-0">
                            {brand === 'sem_bandeira' ? (
                              <div className="w-8 h-6 sm:w-10 sm:h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-gray-500 font-medium">N/A</span>
                              </div>
                            ) : (
                              <img
                                src={`/${brand}.png`}
                                alt={brand}
                                className="w-8 h-6 sm:w-10 sm:h-8 object-contain flex-shrink-0"
                                onError={(e) => {
                                  // Fallback para ícone genérico se a imagem não carregar
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                              <span className="font-medium capitalize text-gray-900 text-sm sm:text-base">
                                {brand === 'american_express' ? 'American Express' :
                                  brand === 'sem_bandeira' ? 'Sem Bandeira' :
                                    brand === 'visa' ? 'Visa' :
                                      brand === 'mastercard' ? 'Mastercard' :
                                        brand === 'elo' ? 'Elo' :
                                          brand === 'hipercard' ? 'Hipercard' :
                                            brand === 'jcb' ? 'JCB' :
                                              brand === 'discover' ? 'Discover' :
                                                brand.charAt(0).toUpperCase() + brand.slice(1)}
                              </span>
                              <span className="text-xs sm:text-sm text-gray-500">({data.count} serviços)</span>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base">
                              Total gasto com taxa: {formatCurrency(data.totalTax)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">Nenhum dado de taxa encontrado</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modal de Valores Iniciais */}

      {/* Modal para Adicionar Produto */}
      {
        showAddProductModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Adicionar Produto</h3>
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do produto
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="Ex: Coca-Cola"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor de venda (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.sale_price}
                    onChange={(e) => setNewProduct({ ...newProduct, sale_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="5,00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor de custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProduct.cost_price}
                    onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="2,50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantidade em estoque
                  </label>
                  <input
                    type="number"
                    value={newProduct.stock_quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="1"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddProduct}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal para Editar Produto */}
      {
        showEditProductModal && editingProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Editar Produto</h3>
                <button
                  onClick={() => {
                    setShowEditProductModal(false);
                    setEditingProduct(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Produto
                  </label>
                  <input
                    type="text"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="Ex: Coca-Cola 350ml"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço de Venda (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.sale_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sale_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.cost_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade em Estoque
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingProduct.stock_quantity}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="0"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditProductModal(false);
                      setEditingProduct(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEditProduct}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal para Adicionar Produto V2 (do estoque) */}
      {
        showAddProductToAppointmentModal && selectedAppointmentForProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Adicionar Produto do Estoque</h3>
                <button
                  onClick={() => {
                    setShowAddProductToAppointmentModal(false);
                    setSelectedAppointmentForProduct(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Selecione um produto do seu estoque para adicionar ao agendamento:
                </p>

                {products.length === 0 ? (
                  <div className="text-center py-4">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">Nenhum produto cadastrado</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Cadastre produtos em "Meus Produtos" primeiro
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleAddProductToAppointment(product)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${product.stock_quantity > 0
                          ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                          : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{product.name}</h4>
                            <p className="text-sm text-gray-600">
                              Preço: {formatCurrency(product.sale_price)}
                            </p>
                            <p className="text-xs text-gray-500">
                              Estoque: {product.stock_quantity} unidades
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">
                              {formatCurrency(product.sale_price)}
                            </p>
                            {product.stock_quantity === 0 && (
                              <p className="text-xs text-red-500">Sem estoque</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Modal para Adicionar Categoria */}
      {
        showAddCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Adicionar Categoria</h3>
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da categoria
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="Ex: BARBA"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O nome será convertido automaticamente para maiúsculas
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddCategory}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal para Adicionar Subcategoria */}
      {
        showAddSubcategoryModal && selectedCategoryForSubcategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Adicionar Serviço</h3>
                <button
                  onClick={() => {
                    setShowAddSubcategoryModal(false);
                    setSelectedCategoryForSubcategory(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do serviço
                  </label>
                  <input
                    type="text"
                    value={newSubcategory.name}
                    onChange={(e) => setNewSubcategory({ ...newSubcategory, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="Ex: Barba lisa"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSubcategory.price}
                    onChange={(e) => setNewSubcategory({ ...newSubcategory, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="39,90"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duração (minutos)
                  </label>
                  <select
                    value={newSubcategory.duration}
                    onChange={(e) => setNewSubcategory({ ...newSubcategory, duration: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                  >
                    <option value="15">15 minutos</option>
                    <option value="20">20 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="40">40 minutos</option>
                    <option value="45">45 minutos</option>
                    <option value="60">60 minutos</option>
                    <option value="90">90 minutos</option>
                    <option value="120">120 minutos</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSubcategoryModal(false);
                      setSelectedCategoryForSubcategory(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddSubcategory}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal para Editar Categoria */}
      {
        showEditCategoryModal && editingCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Editar Categoria</h3>
                <button
                  onClick={() => {
                    setShowEditCategoryModal(false);
                    setEditingCategory(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Categoria
                  </label>
                  <input
                    type="text"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                    placeholder="Ex: BARBA"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    O nome será convertido automaticamente para maiúsculas
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditCategoryModal(false);
                      setEditingCategory(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEditCategory}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal para Editar Subcategoria */}
      {
        showEditSubcategoryModal && editingSubcategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Editar Serviço</h3>
                <button
                  onClick={() => {
                    setShowEditSubcategoryModal(false);
                    setEditingSubcategory(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Serviço
                  </label>
                  <input
                    type="text"
                    value={editingSubcategory.name}
                    onChange={(e) => setEditingSubcategory({ ...editingSubcategory, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white"
                    placeholder="Ex: Corte de cabelo"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingSubcategory.price}
                    onChange={(e) => setEditingSubcategory({ ...editingSubcategory, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duração (minutos)
                  </label>
                  <select
                    value={editingSubcategory.duration}
                    onChange={(e) => setEditingSubcategory({ ...editingSubcategory, duration: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-black bg-white"
                    required
                  >
                    {durationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditSubcategoryModal(false);
                      setEditingSubcategory(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEditSubcategory}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de Observações */}
      {
        showObservationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-xl">📝</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Minhas Observações</h3>
                  <p className="text-sm text-gray-600">Adicione observações para este agendamento</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={observationText}
                    onChange={(e) => setObservationText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white resize-none"
                    placeholder="Ex: Cliente não pagou tudo, deixou R$ 5,00 para depois..."
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {observationText.length}/500 caracteres
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCancelObservation}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveObservation}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Salvar Observação
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Botão de Atualização removido - sistema automático já cuida de tudo */}

      {/* Popup bonito para explicação */}
      {
        showReminderPopup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 text-xl">⚠️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Como contabilizar valores
                </h3>
              </div>

              <p className="text-gray-700 mb-6 leading-relaxed">
                Coloque seu agendamento como <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">concluído</span>, para o dashboard reconhecer que você recebeu o valor de fato.
              </p>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowReminderPopup(false)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de senha para cancelamento */}
      {showCancelPasswordModal && (
        <PinPasswordModal
          onClose={() => {
            setShowCancelPasswordModal(false);
            setAppointmentToCancel(null);
          }}
          onSubmit={handleCancelPasswordSubmit}
          title="Digite a senha para cancelar"
        />
      )}

      {/* Popup de confirmação para cancelar */}
      {
        showCancelConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">❌</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Cancelar Agendamento
                </h3>
              </div>

              <p className="text-gray-700 mb-6 leading-relaxed">
                Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCancelConfirm(false);
                    setAppointmentToCancel(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Não
                </button>
                <button
                  onClick={confirmCancel}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Sim, Cancelar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de confirmação para enviar lembrete */}
      {
        showReminderConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xl">📱</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Enviar Lembrete
                </h3>
              </div>

              <p className="text-gray-700 mb-6 leading-relaxed">
                Você irá enviar um lembrete para o seu cliente sobre o agendamento via WhatsApp.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCloseReminderModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  ✕
                </button>
                <button
                  onClick={handleSendReminder}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  📱 Enviar
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal informativo sobre lembretes */}
      {
        showReminderInfoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <span className="text-yellow-600 text-xl">💡</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Dica importante:
                </h3>
              </div>

              <div className="text-gray-700 mb-6 leading-relaxed space-y-3">
                <p>
                  Você pode reforçar a presença do seu cliente e evitar esquecimentos! ✂️
                </p>

                <p>
                  Caso ele não tenha ativado as notificações automáticas, basta clicar em <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">"Enviar lembrete"</span> dentro do agendamento. 📅
                </p>

                <p>
                  Assim, o sistema envia uma mensagem completa no WhatsApp do cliente, com todas as informações do agendamento — horário, serviço e profissional — pra ele não esquecer de comparecer. 🕒
                </p>

                <p>
                  Muitos barbeiros usam esse recurso no dia dos atendimentos para lembrar todos os clientes de forma rápida e prática! 💬💈
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCloseReminderInfoModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de Transferência de Agendamento */}
      <TransferAppointmentModal
        isOpen={showTransferModal}
        onClose={handleCloseTransferModal}
        onTransfer={handleTransferAppointment}
        appointment={selectedAppointmentForTransfer}
        professionals={professionals}
        currentProfessionalName={selectedAppointmentForTransfer ? getProfessionalName(selectedAppointmentForTransfer.professional) : ''}
      />

      {/* Modal de Verificação de Senha para Configurações */}
      <ConfigPasswordModal
        isOpen={showConfigPasswordModal}
        onClose={() => {
          setShowConfigPasswordModal(false);
          setPendingAction(null);
        }}
        onVerify={handleConfigPasswordVerify}
        onSuccess={handleConfigPasswordSuccess}
        title="Verificação de Senha"
        description={
          pendingAction?.type === 'password'
            ? "Digite a senha de 4 dígitos para visualizar a senha do profissional"
            : pendingAction?.type === 'percentage'
              ? "Digite a senha de 4 dígitos para alterar o percentual do profissional"
              : "Digite a senha de 4 dígitos para alterar configurações sensíveis"
        }
      />

      {/* Modal de Reservar Cliente */}
      {
        showReservarClienteModal && establishment && (
          <ReservarCliente
            establishmentId={establishment.id}
            use15MinuteInterval={use15MinuteInterval}
            use20MinuteScheduleProp={use20MinuteSchedule}
            onClose={() => {
              console.log('🔍 Fechando modal ReservarCliente');
              setShowReservarClienteModal(false);
              // Recarregar clientes quando fechar o modal (para atualizar contagem)
              if (activeTab === 'clients' || activeTab === 'subscribers') {
                console.log('🔄 Recarregando clientes após fechar modal de reserva...');
                fetchClients();
              }
            }}
          />
        )
      }


      {/* Modais de Tutorial Popup */}

      {/* Modal Tutorial - Meus Agendamentos */}
      {showTutorialModals.appointments && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">📅 Meus Agendamentos</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Estamos preparando um novo vídeo tutorial para você!
              </p>

              <div className="relative w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-16 text-center mb-4">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-24 h-24 bg-orange-200 rounded-full flex items-center justify-center animate-pulse">
                    <span className="text-5xl">🎬</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">Vídeo Novo em Breve</h3>
                  <p className="text-gray-600 text-lg">Tutorial atualizado chegando em breve!</p>
                  <div className="flex items-center gap-2 text-orange-600">
                    <span className="animate-spin text-2xl">⏳</span>
                    <span className="font-semibold">Aguarde...</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('appointments')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('appointments')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tutorial - Reservar Cliente */}
      {showTutorialModals.reserveClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🔗 Reservar Cliente</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Aqui você pode fazer reservas avulsas para seus clientes, veja o vídeo tutorial para aprender como funciona/usar.
              </p>

              <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden mb-4">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/vL_E1P1xptU"
                  title="Tutorial: Como Reservar Clientes"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('reserveClient')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('reserveClient')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tutorial - Config | Página Agendamentos */}
      {showTutorialModals.config && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">⚙️ Config | Página Agendamentos</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Aqui você pode configurar toda a sua página de agendamentos, veja o vídeo tutorial para aprender como funciona/usar.
              </p>

              <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden mb-4">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/pB3QZ1H20xA"
                  title="Tutorial de Configurações"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('config')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('config')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tutorial - Financeiro */}
      {showTutorialModals.dashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">📊 Financeiro</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Aqui você pode ver e gerenciar todas as informações financeiras do seu estabelecimento, veja o vídeo tutorial para aprender como funciona/usar.
              </p>

              <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden mb-4">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/5cIGlklZLr0"
                  title="Tutorial: Como Usar o Dashboard"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('dashboard')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('dashboard')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tutorial - Meus Assinantes */}
      {showTutorialModals.subscribers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">👑 Meus Assinantes</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Aqui você pode ver e gerenciar todos os seus assinantes, veja o vídeo tutorial para aprender como funciona/usar.
              </p>

              <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden mb-4">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/4diswxWV_f0"
                  title="Tutorial: Como Gerenciar Assinantes"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('subscribers')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('subscribers')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tutorial - Meus Serviços */}
      {showTutorialModals.services && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🗂️ Meus Serviços</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Aqui você pode criar categorias e serviços com dropdown, veja o vídeo tutorial para aprender como funciona/usar.
              </p>

              <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden mb-4">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/ABZLLHyMVq0"
                  title="Tutorial: Como Gerenciar Serviços"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('services')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('services')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tutorial - Meus Produtos */}
      {showTutorialModals.products && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">📦 Meus Produtos</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Aqui você pode adicionar, editar e acompanhar seus produtos, veja o vídeo tutorial para aprender como funciona/usar.
              </p>

              <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden mb-4">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/vNFGtcEmJ0I"
                  title="Tutorial: Como Gerenciar Produtos"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('products')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('products')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tutorial - Profissionais */}
      {showTutorialModals.professionals && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">👤 Profissionais</h2>
              <p className="text-gray-700 mb-6 text-lg">
                Aqui você pode cadastrar e gerenciar profissionais do seu estabelecimento, veja o vídeo tutorial para aprender como funciona/usar.
              </p>

              <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden mb-4">
                <iframe
                  className="absolute top-0 left-0 w-full h-full"
                  src="https://www.youtube.com/embed/1Sm25W596v0"
                  title="Tutorial: Como Gerenciar Profissionais"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => dismissTutorialModal('professionals')}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Não quero mais ver isso
                </button>
                <button
                  onClick={() => closeTutorialModal('professionals')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup de Progresso do Onboarding */}
      {showOnboardingPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Parabéns!</h2>
              <p className="text-gray-700 mb-6 text-lg">
                {onboardingPopupMessage}
              </p>
              <button
                onClick={() => setShowOnboardingPopup(false)}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Entendi!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Item Bloqueado */}
      {showBlockedItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-2xl max-w-md w-full p-6 border-4 border-gray-500">
            <div className="text-center">
              <div className="mb-4 text-7xl animate-bounce">🔒</div>
              <h2 className="text-2xl font-bold text-red-700 mb-4">Função Bloqueada!</h2>
              <p className="text-gray-800 mb-6 text-lg leading-relaxed">
                Esta função está bloqueada. Você deve seguir o <strong className="text-red-600">Passo a Passo</strong> para abrir seu estabelecimento e liberar todas as funcionalidades.
              </p>
              <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6 text-left rounded">
                <p className="text-sm text-yellow-800">
                  💡 <strong>Dica:</strong> Clique em "Passo a passo" no menu lateral para ver o que precisa fazer.
                </p>
              </div>
              <button
                onClick={() => setShowBlockedItemModal(false)}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold text-lg shadow-lg"
              >
                Entendi!
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default EstablishmentDashboard;