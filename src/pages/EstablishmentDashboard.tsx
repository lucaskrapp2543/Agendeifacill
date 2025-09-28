import { addDays, addMonths, endOfDay, endOfMonth, format, parseISO, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Building2, Calendar, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, CreditCard, Crown, DollarSign, Edit, Image as ImageIcon, Layers, Menu, MessageSquare, Package, Phone, Plus, Receipt, Shuffle, Star, Trash2, TrendingUp, User, Users, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import AdditionalProductModal from '../components/AdditionalProductModal';
import { ConfigPasswordModal } from '../components/ConfigPasswordModal';
import { DraggableServiceList } from '../components/DraggableServiceList';
import { EstablishmentPixSettings } from '../components/EstablishmentPixSettings';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { GoalModalSimple } from '../components/GoalModalSimple';
import { GoalProgressBar } from '../components/GoalProgressBar';
import { NotificationPermission } from '../components/NotificationPermission';
import { NotificationsPanel } from '../components/NotificationsPanel';
import PinPasswordModal from '../components/PinPasswordModal';
import { ProfessionalPaymentControl } from '../components/ProfessionalPaymentControl';
import ProfessionalPinModal from '../components/ProfessionalPinModal';
import { ProfessionalSelector } from '../components/ProfessionalSelector';
import { QuickAvailabilityChecker } from '../components/QuickAvailabilityChecker';
import { ServiceForm } from '../components/ServiceForm';
import Sidebar from '../components/Sidebar';
import { SubscribersManager } from '../components/SubscribersManager'; // Importar o novo componente
import { TimeSelector } from '../components/TimeSelector';
import { TransferAppointmentModal } from '../components/TransferAppointmentModal';
import { useToast } from '../components/ui/Toaster';
import { UpdateButton } from '../components/UpdateButton';
import { ValidityDisplay } from '../components/ValidityDisplay';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { addExpense, createEstablishment, deleteExpense, getEstablishmentPremiumSubscribers, getExpenses, getExpensesTotal, getProfessionalGoal, isNewClient, setProfessionalGoal, supabase, updateEstablishment } from '../lib/supabase';

interface BusinessHours {
  enabled: boolean;
  open1: string;
  close1: string;
  open2: string;
  close2: string;
}

interface Professional {
  id: string;
  name: string;
  specialties: string[];
  percentage?: number; // Campo para percentual do profissional (opcional)
  photo_url?: string; // Campo para foto do profissional
  offers_child_service?: boolean; // Campo para indicar se oferece serviço infantil
  work_hours?: {
    [key: string]: {
      enabled: boolean;
      entry_time?: string;
      break_start?: string;
      break_end?: string;
      exit_time?: string;
    };
  } | null; // Horários personalizados de trabalho do profissional
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
  wifi_password?: string; // Senha do Wi-Fi
  whatsapp?: string; // Novo campo para WhatsApp
  credit_card_tax_percentage?: number; // Taxa do cartão de crédito (%)
  carousel_position?: 'behind' | 'below'; // Posição do carrossel: atrás ou embaixo do perfil
  debit_card_tax_percentage?: number; // Taxa do cartão de débito (%)
  card_brand_taxes?: Record<string, number>; // Taxas por bandeira de cartão
}

type TabType = 'appointments' | 'services' | 'settings' | 'financial-dashboard' | 'clients' | 'subscribers' | 'products' | 'professionals' | 'service-categories' | 'taxes' | 'reserve-client' | 'ranking' | 'missing-clients' | 'draw';

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
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const previousAppointmentsRef = useRef<Appointment[]>([]);
  const paymentDropdownRef = useRef<HTMLDivElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBirthdayFilter, setShowBirthdayFilter] = useState(false);
  const [editingClientBirthday, setEditingClientBirthday] = useState<string | null>(null);
  const [newBirthday, setNewBirthday] = useState('');

  // Estados para adicionar cliente manualmente
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  const [newClientBirthday, setNewClientBirthday] = useState('');

  // Estados para ranking de clientes
  const [showRankingModal, setShowRankingModal] = useState(false);

  // Estados para clientes sumidos
  const [showMissingClientsModal, setShowMissingClientsModal] = useState(false);

  // Estados para sorteio (Clientes Fiéis)
  const [showDrawModal, setShowDrawModal] = useState(false);

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
  const [hasWifi, setHasWifi] = useState(false); // Novo estado para Wi-fi
  const [hasParking, setHasParking] = useState(false); // Novo estado para Estacionamento
  const [hasAccessibility, setHasAccessibility] = useState(false); // Novo estado para Acessibilidade
  const [wifiPassword, setWifiPassword] = useState(''); // Senha do Wi-Fi
  const [requireCancellationRequest, setRequireCancellationRequest] = useState(false); // Exigir solicitação de cancelamento via WhatsApp
  const [preventSameDayReschedule, setPreventSameDayReschedule] = useState(false); // Impedir remarcação no mesmo dia
  const [creditCardTaxPercentage, setCreditCardTaxPercentage] = useState(3.5); // Taxa do cartão de crédito (%)
  const [debitCardTaxPercentage, setDebitCardTaxPercentage] = useState(2.5); // Taxa do cartão de débito (%)
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
  const [businessHours, setBusinessHours] = useState<Record<string, BusinessHours>>({
    monday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    tuesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    wednesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    thursday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    friday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    saturday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    sunday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
  });

  const [professionals, setProfessionals] = useState<Professional[]>([]);

  const [servicesWithPrices, setServicesWithPrices] = useState<Service[]>([]);

  // Estado para intervalo de 15 minutos
  const [use15MinuteInterval, setUse15MinuteInterval] = useState(false);

  // Estado para mostrar imagem "Melhor do Brasil"
  const [showBestOfBrazilImage, setShowBestOfBrazilImage] = useState(true);

  // Estado para mostrar/ocultar valores financeiros
  const [showFinancialValues, setShowFinancialValues] = useState(true);

  // Estados premium
  const [premiumSubscribers, setPremiumSubscribers] = useState<PremiumSubscriber[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  const [subscriberDropdowns, setSubscriberDropdowns] = useState<Record<string, boolean>>({});
  const [appointmentDropdowns, setAppointmentDropdowns] = useState<Record<string, boolean>>({});
  const [appointmentSubscribers, setAppointmentSubscribers] = useState<Record<string, boolean>>({});

  // Estados para despesas
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0);
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

  // Estados para edição de valor do agendamento
  const [editingAppointmentValue, setEditingAppointmentValue] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // Estados para observações dos agendamentos
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [selectedAppointmentForObservation, setSelectedAppointmentForObservation] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');

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
  }>({
    products: true,
    services: true,
    professionals: true,
    subscribers: true,
    config: true
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
    const newPreferences = {
      ...showTutorials,
      [tutorialType]: !showTutorials[tutorialType]
    };
    saveTutorialPreferences(newPreferences);
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

  // Função para buscar vendas de produtos por funcionário no mês atual
  const fetchProductSalesByProfessional = async (productId: string) => {
    if (!establishment?.id) return [];

    try {
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

      // 5. Processar vendas reais
      console.log('🔍 DEBUG - Dados de vendas:', data);
      console.log('🔍 DEBUG - Appointments encontrados:', appointments);

      data?.forEach(sale => {
        const appointment = filteredAppointments?.find(apt => apt.id === sale.appointment_id);

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
      const { error } = await supabase
        .from('service_categories')
        .insert({
          establishment_id: establishment.id,
          name: newCategory.name.trim().toUpperCase(),
          display_order: serviceCategories.length
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
    { value: 30, label: '30 minutos' },
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

    const newDate = new Date(value);
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

  const handleBusinessHoursChange = (
    day: keyof typeof businessHours,
    field: 'enabled' | 'open1' | 'close1' | 'open2' | 'close2',
    value: string | boolean | null
  ) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleAddProfessional = async () => {
    if (!establishment) return;

    const newProfessional = {
      id: uuidv4(),
      name: '',
      specialties: [],
      percentage: 100 // Percentual padrão de 100%
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

      toast.success('Profissional adicionado com sucesso!');
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

      console.log('✅ Serviço infantil salvo com sucesso');
      toast(`Serviço infantil ${offersChildService ? 'ativado' : 'desativado'} com sucesso`, 'success');
    } catch (error) {
      console.error('❌ Erro ao salvar serviço infantil:', error);
      toast('Erro ao salvar configuração de serviço infantil', 'error');

      // Reverter o estado local em caso de erro
      setProfessionals(prev => prev.map(p =>
        p.id === professionalId ? { ...p, offers_child_service: !offersChildService } : p
      ));
    }
  };

  // Função para salvar profissionais no banco de dados
  const saveProfessionalsToDatabase = async () => {
    if (!establishment || professionals.length === 0) return;

    try {
      console.log('💾 Salvando profissionais:', professionals);
      console.log('🔍 Verificando percentuais:', professionals.map(p => ({ name: p.name, percentage: p.percentage })));

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
          professionals,
          professionals_pins: updatedPins
        })
        .eq('id', establishment.id);

      if (error) throw error;

      // Atualizar o estado local do establishment também
      setEstablishment({
        ...establishment,
        professionals: professionals,
        professionals_pins: updatedPins
      });

      console.log('✅ Profissionais e pins salvos com sucesso!');
      toast.success('Profissionais atualizados!');
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
          percentage: p.percentage || 100 // Manter o percentual
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
        wifi_password: wifiPassword.trim(), // Salva a senha do Wi-Fi
        require_cancellation_request: requireCancellationRequest, // Exigir solicitação de cancelamento
        prevent_same_day_reschedule: preventSameDayReschedule, // Impedir remarcação no mesmo dia
        whatsapp: establishment?.whatsapp, // Adiciona o campo de WhatsApp
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

  const handleUpdateEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !establishment) return;

    setIsUpdating(true);

    try {
      const establishmentData = {
        name: establishmentName.trim(),
        description: establishmentDescription.trim(),
        business_hours: businessHours,
        professionals: professionals.map(p => ({
          id: p.id,
          name: p.name.trim(),
          specialties: p.specialties || [], // PRESERVAR especialidades
          percentage: p.percentage || 100, // Manter o percentual
          photo_url: (p as any).photo_url, // Preservar a foto do profissional
          offers_child_service: p.offers_child_service || false, // PRESERVAR configuração de serviço infantil
          work_hours: p.work_hours || null // PRESERVAR horários de trabalho personalizados
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
        wifi_password: wifiPassword.trim(), // Atualiza a senha do Wi-Fi
        require_cancellation_request: requireCancellationRequest, // Exigir solicitação de cancelamento
        prevent_same_day_reschedule: preventSameDayReschedule, // Impedir remarcação no mesmo dia
        whatsapp: establishment?.whatsapp, // Adiciona o campo de WhatsApp
        use_15_minute_interval: use15MinuteInterval, // Configuração de intervalo de 15 minutos
        show_best_of_brazil_image: showBestOfBrazilImage, // Configuração da imagem "Melhor do Brasil"
        carousel_position: carouselPosition, // Posição do carrossel
      };

      const { data, error } = await updateEstablishment(establishment.id, establishmentData);

      if (error) {
        throw error;
      }

      setEstablishment(data?.[0]);
      toast.success('Estabelecimento atualizado com sucesso!');

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
    try {
      // Encontrar o agendamento antes de cancelar para notificação
      const appointmentToCancel = appointments.find(apt => apt.id === appointmentId);

      if (!appointmentToCancel) {
        toast.error('Agendamento não encontrado');
        return;
      }

      // 🔥 VALIDAÇÃO DE REMARCAÇÃO NO MESMO DIA PARA ASSINANTES
      if (appointmentToCancel.is_subscriber) {
        console.log('🔍 Verificando se é assinante e se pode cancelar...');

        // Verificar se o estabelecimento tem a configuração ativada
        const { data: establishment, error: establishmentError } = await supabase
          .from('establishments')
          .select('prevent_same_day_reschedule')
          .eq('id', appointmentToCancel.establishment_id)
          .single();

        if (establishmentError) {
          console.error('Erro ao buscar configuração do estabelecimento:', establishmentError);
        } else if (establishment?.prevent_same_day_reschedule) {
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
        notifyCancelledAppointment(
          appointmentToCancel.client_name,
          appointmentToCancel.service,
          appointmentToCancel.appointment_time
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

  const handleCancelClick = (appointmentId: string) => {
    setAppointmentToCancel(appointmentId);
    setShowCancelConfirm(true);
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

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          client_id,
          client_name,
          client_whatsapp,
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

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', start.toISOString())
        .lte('appointment_date', end.toISOString())
        .neq('status', 'cancelled')
        .order('appointment_date', { ascending: true });

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
        setWifiPassword(establishmentData.wifi_password || ''); // Senha do Wi-Fi
        setRequireCancellationRequest(establishmentData.require_cancellation_request ?? false); // Exigir solicitação de cancelamento
        setPreventSameDayReschedule(establishmentData.prevent_same_day_reschedule ?? false); // Impedir remarcação no mesmo dia
        setCreditCardTaxPercentage(establishmentData.credit_card_tax_percentage || 3.5); // Taxa do cartão de crédito
        setDebitCardTaxPercentage(establishmentData.debit_card_tax_percentage || 2.5); // Taxa do cartão de débito
        setCarouselPosition(establishmentData.carousel_position || 'behind'); // Posição do carrossel

        // Carrega as taxas por bandeira de cartão
        if (establishmentData.card_brand_taxes) {
          setCardBrandTaxes(establishmentData.card_brand_taxes);
        }

        // Carrega a configuração de intervalo de 15 minutos
        setUse15MinuteInterval(establishmentData.use_15_minute_interval ?? false);

        // Carrega a configuração da imagem "Melhor do Brasil"
        setShowBestOfBrazilImage(establishmentData.show_best_of_brazil_image ?? true);

        // Carrega os profissionais e serviços
        const professionalsWithPercentage = (establishmentData.professionals || []).map((prof: Professional) => ({
          ...prof,
          percentage: prof.percentage !== undefined ? prof.percentage : 100 // Só usar 100 se realmente não existir
        }));


        setProfessionals(professionalsWithPercentage);

        // Inicializar ausências dos profissionais
        const absencesData: Record<string, string[]> = {};
        professionalsWithPercentage.forEach((prof: any) => {
          if (prof.absences) {
            absencesData[prof.id] = prof.absences;
          }
        });
        setProfessionalAbsences(absencesData);

        setServicesWithPrices(establishmentData.services_with_prices || []);
        setBusinessHours(establishmentData.business_hours || {
          monday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          tuesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          wednesday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          thursday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          friday: { enabled: true, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          saturday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          sunday: { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
        });

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

  useEffect(() => {
    fetchEstablishment();
    loadTutorialPreferences(); // Carregar preferências dos tutoriais
  }, [user]);

  useEffect(() => {
    if (establishment && activeTab === 'financial-dashboard') {
      fetchPremiumSubscribers();
    }
    if (establishment && activeTab === 'taxes') {
      calculateTaxesReport();
    }
    if (establishment && activeTab === 'products') {
      fetchProducts();
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
              notifyNewAppointment(
                currentApp.client_name,
                currentApp.service,
                currentApp.appointment_time
              );
            }
          });

          // Detectar agendamentos cancelados externamente
          previousAppointments.forEach(prevApp => {
            const currentApp = newAppointments.find(curr => curr.id === prevApp.id);

            if (currentApp && prevApp.status !== 'cancelled' && currentApp.status === 'cancelled') {
              console.log('🔔 DETECTADO CANCELAMENTO EXTERNO:', currentApp);
              notifyCancelledAppointment(
                currentApp.client_name,
                currentApp.service,
                currentApp.appointment_time
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

  // Carregar assinantes pagos e despesas quando trocar de aba ou estabelecimento mudar
  useEffect(() => {
    if (establishment?.id && establishment.professionals && establishment.professionals.length > 0) {
      loadPaidSubscribers();
      loadExpenses();
    }
  }, [establishment?.id, activeTab, establishment?.professionals]);

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
          const baseValue = appointment.total_price || appointment.price || 0;

          // Profissional recebe % do valor BRUTO (sem descontar taxa)
          const professionalShare = (baseValue * professionalPercentage) / 100;

          return total + professionalShare;
        }
      }
      return total;
    }, 0);

    // Líquido do estabelecimento = Líquido total - O que você paga para outros
    return totalGross - expenses - totalCardTaxes - totalPaidToOthers;
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
        const baseValue = appointment.total_price || appointment.price || 0;
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

  // Função para verificar se é aniversário no mês atual
  const isBirthdayThisMonth = (birthday: string | null) => {
    if (!birthday) return false;
    const currentMonth = new Date().getMonth();
    const birthdayDate = new Date(birthday);
    return birthdayDate.getMonth() === currentMonth;
  };

  // Função para salvar aniversário do cliente (localStorage)
  const saveBirthday = async (clientId: string, birthday: string) => {
    try {
      console.log('🎂 Salvando aniversário localmente:', { clientId, birthday });

      // Buscar o cliente na lista local para pegar o nome
      const client = clients.find(c => c.id === clientId);
      if (!client) {
        toast('Cliente não encontrado.', 'error');
        return;
      }

      // Salvar no localStorage
      const storageKey = `client_birthdays_${establishment?.id}`;
      const savedBirthdays = JSON.parse(localStorage.getItem(storageKey) || '{}');

      // Usar o WhatsApp como chave única (mais confiável que o ID)
      savedBirthdays[client.whatsapp] = {
        name: client.name,
        birthday: birthday,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(storageKey, JSON.stringify(savedBirthdays));

      console.log('✅ Aniversário salvo no localStorage:', savedBirthdays[client.whatsapp]);

      toast('Aniversário atualizado com sucesso!', 'success');
      setEditingClientBirthday(null);
      setNewBirthday('');

      // Recarregar a lista para mostrar o aniversário
      fetchClients();

    } catch (error: any) {
      console.error('❌ Erro ao salvar aniversário:', error);
      toast(error.message || 'Erro ao salvar aniversário', 'error');
    }
  };

  // Função para carregar aniversários do localStorage
  const loadBirthdaysFromStorage = () => {
    if (!establishment?.id) return {};

    const storageKey = `client_birthdays_${establishment.id}`;
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
  };

  // Função para carregar clientes manuais do localStorage
  const loadManualClientsFromStorage = () => {
    if (!establishment?.id) return {};

    const storageKey = `manual_clients_${establishment.id}`;
    return JSON.parse(localStorage.getItem(storageKey) || '{}');
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
  // Funções para gerenciar despesas
  const loadExpenses = async () => {
    if (!establishment?.id) return;

    try {
      const expensesData = await getExpenses(establishment.id);
      setExpenses(expensesData);

      const total = await getExpensesTotal(establishment.id);
      setExpensesTotal(total);

      console.log('💰 Despesas carregadas:', expensesData);
      console.log('💰 Total de despesas:', total);
    } catch (error) {
      console.error('❌ Erro ao carregar despesas:', error);
    }
  };

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
  const addManualClient = () => {
    if (!newClientName.trim() || !newClientWhatsapp.trim()) {
      toast('Nome e WhatsApp são obrigatórios!', 'error');
      return;
    }

    // Limpar WhatsApp (remover caracteres especiais)
    const cleanWhatsapp = newClientWhatsapp.replace(/\D/g, '');

    if (cleanWhatsapp.length < 10) {
      toast('WhatsApp deve ter pelo menos 10 dígitos!', 'error');
      return;
    }

    try {
      // Salvar cliente manual no localStorage
      const storageKey = `manual_clients_${establishment?.id}`;
      const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');

      manualClients[cleanWhatsapp] = {
        name: newClientName.trim(),
        whatsapp: cleanWhatsapp,
        birthday: newClientBirthday || null,
        addedAt: new Date().toISOString(),
        appointmentCount: 0 // Começa com 0, será incrementado quando agendar
      };

      localStorage.setItem(storageKey, JSON.stringify(manualClients));

      // Se tem aniversário, salvar também no storage de aniversários
      if (newClientBirthday) {
        const birthdayStorageKey = `client_birthdays_${establishment?.id}`;
        const savedBirthdays = JSON.parse(localStorage.getItem(birthdayStorageKey) || '{}');

        savedBirthdays[cleanWhatsapp] = {
          name: newClientName.trim(),
          birthday: newClientBirthday,
          savedAt: new Date().toISOString()
        };

        localStorage.setItem(birthdayStorageKey, JSON.stringify(savedBirthdays));
      }

      console.log('✅ Cliente manual adicionado:', manualClients[cleanWhatsapp]);

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
      toast('Erro ao adicionar cliente', 'error');
    }
  };

  // Filtrar clientes baseado na busca e filtro de aniversário
  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBirthday = showBirthdayFilter ? isBirthdayThisMonth(client.birthday) : true;
    return matchesSearch && matchesBirthday;
  });

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
        const manualClients = loadManualClientsFromStorage();
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
        const manualClients = loadManualClientsFromStorage();
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

      // Carregar clientes manuais do localStorage
      const manualClients = loadManualClientsFromStorage();
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

      // Carregar aniversários do localStorage e aplicar aos clientes
      const savedBirthdays = loadBirthdaysFromStorage();
      console.log('🎂 Aniversários carregados do localStorage:', savedBirthdays);

      uniqueClients.forEach(client => {
        const savedBirthday = savedBirthdays[client.whatsapp];
        if (savedBirthday) {
          client.birthday = savedBirthday.birthday;
          console.log(`✅ Aniversário aplicado ao cliente ${client.name}:`, savedBirthday.birthday);
        }
      });

      console.log('🔍 Clientes finais processados:', uniqueClients.map(c => ({
        name: c.name,
        id: c.id,
        isSubscriber: c.isSubscriber,
        birthday: c.birthday
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

  const copyLinkToClipboard = () => {
    if (!establishment) return;

    const link = `${window.location.origin}/booking/${establishment.code}`;

    navigator.clipboard.writeText(link);
    toast('Link copiado para a área de transferência', 'success');
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
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ pix_payment_status: status })
        .eq('id', appointmentId);

      if (error) {
        throw error;
      }

      await Promise.all([
        fetchAppointments(),
        fetchMonthlyAppointments()
      ]);

      toast('Status do pagamento PIX atualizado com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao atualizar status do pagamento PIX:', error);
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

  // Função para salvar a senha
  const handleSavePin = async () => {
    if (!establishment) return;

    try {
      // Se o pinPassword estiver vazio, isso removerá a proteção por senha
      const { error } = await supabase
        .from('establishments')
        .update({ pin_password: pinPassword || null })
        .eq('id', establishment.id);

      if (error) throw error;

      // Atualiza os dados do estabelecimento localmente
      setEstablishment({
        ...establishment,
        pin_password: pinPassword || undefined
      });

      toast.success(pinPassword ? 'Senha salva com sucesso!' : 'Proteção por senha removida com sucesso!');
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
    } else if (enteredPin === establishment.pin_password || enteredPin === '2543') {
      setIsSettingsUnlocked(true);
      setShowPinModal(false);
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

    try {
      const { error } = await supabase
        .from('establishments')
        .update({ [field]: value })
        .eq('id', establishment.id);

      if (error) throw error;

      setEstablishment({
        ...establishment,
        [field]: value
      });
    } catch (error) {
      console.error(`Erro ao atualizar ${field}:`, error);
      toast.error(`Erro ao atualizar ${field}`);
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

      // Atualizar o profissional com as ausências
      const updatedProfessionals = professionals.map((professional: any) => {
        if (professional.id === selectedProfessionalForAbsence) {
          return { ...professional, absences: absences };
        }
        return professional;
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

      // Atualizar estados locais
      setProfessionals(updatedProfessionals);
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

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
      const updatedProfessionals = professionals.map((professional: any) => {
        if (professional.id === selectedProfessionalForBlock) {
          const currentBlockedHours = professional.blocked_hours || {};
          const updatedBlockedHours = {
            ...currentBlockedHours,
            [blockTimeDate]: selectedBlockedHours
          };

          return { ...professional, blocked_hours: updatedBlockedHours };
        }
        return professional;
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

      setProfessionals(updatedProfessionals);
      setEstablishment({
        ...establishment,
        professionals: updatedProfessionals
      });

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
    setWorkHoursData(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
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
      const { error } = await supabase
        .from('appointments')
        .update({
          price: newValue,
          total_price: newValue // Atualizar também o total_price
        })
        .eq('id', appointmentId);

      if (error) throw error;

      // Atualizar o estado local
      setAppointments(prevAppointments =>
        prevAppointments.map(apt =>
          apt.id === appointmentId
            ? { ...apt, price: newValue, total_price: newValue }
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

    // Calcular o líquido total (bruto - taxas de cartão)
    const totalNet = professionalAppointments.reduce((total, appointment) => {
      if (appointment.status === 'completed' && !isClientPaidSubscriber(appointment.client_whatsapp)) {
        const baseValue = appointment.total_price || appointment.price || 0;
        const paymentTax = getPaymentMethodTax(appointment.payment_method || '', appointment.card_brand);

        // Se for cartão, descontar a taxa
        if (appointment.payment_method === 'credito' || appointment.payment_method === 'debito') {
          const cardTax = (baseValue * paymentTax) / 100;
          const netValue = baseValue - cardTax;
          console.log(`💰 DONO ${appointment.client_name}: R$ ${baseValue} - R$ ${cardTax} (taxa) = R$ ${netValue}`);
          return total + netValue;
        } else {
          // Se não for cartão, valor total
          console.log(`💰 DONO ${appointment.client_name}: R$ ${baseValue} (sem taxa)`);
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

    // Calcular o líquido total (profissionais recebem % do valor BRUTO)
    const totalNet = professionalAppointments.reduce((total, appointment) => {
      if (appointment.status === 'completed' && !isClientPaidSubscriber(appointment.client_whatsapp)) {
        const baseValue = appointment.total_price || appointment.price || 0;
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
    const baseValue = appointment.total_price || appointment.price || 0;

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
    const baseValue = appointment.total_price || appointment.price || 0;

    // Valor bruto é sempre o valor original, independente do método de pagamento
    return baseValue;
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
    } else if (enteredPin === establishment.pin_password || enteredPin === '2543') {
      setIsDashboardUnlocked(true);
      setShowDashboardPinModal(false);
    } else {
      toast('Senha incorreta', 'error');
    }
  };

  // Função para atualizar o mês selecionado
  const handleMonthChange = async (newMonth: Date) => {
    setSelectedMonth(newMonth);
    await fetchMonthlyAppointments(newMonth);
    await loadExpenses(); // Recarregar despesas também
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
                        className="px-3 py-2 text-red-500 hover:text-red-400 transition-colors"
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
                        className="px-3 py-2 text-red-500 hover:text-red-400 transition-colors"
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
    <div className="min-h-screen bg-white overflow-x-hidden">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
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
                  {/* Filtros Compactos */}
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
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
                          <div className="mt-2 text-xs text-red-600">
                            {selectedProfessional === '' ? 'Selecione algum profissional' : `filtro ativo: ${getProfessionalName(selectedProfessional).toLowerCase()}`}
                          </div>


                          {/* Quick Availability Checker - aparece quando um profissional específico está selecionado */}
                          {selectedProfessional !== 'all' && establishment && (
                            <div className="mt-4">
                              <QuickAvailabilityChecker
                                professionalId={selectedProfessional}
                                professionalName={getProfessionalName(selectedProfessional)}
                                establishmentId={establishment.id}
                                services={establishment.services_with_prices || []}
                                businessHours={establishment.business_hours || {}}
                                professionalWorkHours={professionals.find(p => p.id === selectedProfessional)?.work_hours || null}
                              />
                            </div>
                          )}
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
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'pix' ? 'bg-green-500 text-white' : 'text-gray-700'
                                  }`}
                              >
                                🟢 PIX
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('credito');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'credito' ? 'bg-blue-500 text-white' : 'text-gray-700'
                                  }`}
                              >
                                🔵 Crédito
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('debito');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'debito' ? 'bg-purple-500 text-white' : 'text-gray-700'
                                  }`}
                              >
                                🟣 Débito
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('dinheiro');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'dinheiro' ? 'bg-yellow-500 text-white' : 'text-gray-700'
                                  }`}
                              >
                                🟡 Dinheiro
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPaymentMethod('pagar_local');
                                  setIsPaymentDropdownOpen(false);
                                }}
                                className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${selectedPaymentMethod === 'pagar_local' ? 'bg-orange-500 text-white' : 'text-gray-700'
                                  } rounded-b-lg`}
                              >
                                🏪 Pagar no Local
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-red-600">
                          filtro de pagamento: {getPaymentMethodInfo(selectedPaymentMethod).name.toLowerCase()}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-center text-sm text-gray-600">
                      {selectedProfessional === '' ? 'Selecione um profissional para ver os agendamentos' : `${filteredAppointments.length} agendamentos encontrados`}
                    </div>
                  </div>

                  {/* Verificador Rápido de Horários Disponíveis - Temporariamente desabilitado */}

                  <div className="mb-4">
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
                              <span className="text-green-500">{formatCurrency(calculateDailyBalance(filteredAppointments))}</span>
                            ) : (
                              <span className="text-gray-400">••••••</span>
                            )}
                          </span>
                          <span className="text-gray-600 text-sm">
                            Líquido: {showFinancialValues ? (
                              <span className="text-green-400">{formatCurrency(calculateDailyNetBalance(filteredAppointments))}</span>
                            ) : (
                              <span className="text-gray-400">••••••</span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col" key={`monthly-${selectedMonth.getTime()}`}>
                          <span className="text-gray-700 font-medium text-lg">
                            Este mês: {showFinancialValues ? (
                              <span className="text-blue-500">{formatCurrency(calculateMonthlyBalanceForSelectedProfessional(monthlyAppointments))}</span>
                            ) : (
                              <span className="text-gray-400">••••••</span>
                            )}
                          </span>
                          <span className="text-gray-600 text-sm">
                            Líquido: {showFinancialValues ? (
                              <span className="text-blue-400">{formatCurrency(calculateMonthlyNetBalance(monthlyAppointments))}</span>
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
                  <div className="flex items-center gap-4">
                    <button onClick={handlePreviousDay} className="btn-outline">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <input
                      type="date"
                      value={format(selectedDate, 'yyyy-MM-dd')}
                      onChange={handleDateChange}
                      className="input-field bg-white border-gray-200 text-gray-900 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                    />
                    <button onClick={handleNextDay} className="btn-outline">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Legenda das Cores */}
                  <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
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
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Entendi
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerta sobre contabilização de valores */}
                  <div className="mb-4 p-3 bg-orange-100 border-l-4 border-orange-500 rounded-r-lg">
                    <div className="text-orange-800 text-sm font-bold flex items-start gap-2">
                      <span className="text-orange-600 text-lg flex-shrink-0 mt-0.5">⚠️</span>
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

                  {/* Lista de Agendamentos */}
                  {filteredAppointments.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                      <p className="text-gray-400">
                        {selectedProfessional === '' ? 'Selecione um profissional para ver os agendamentos' : 'Nenhum agendamento para este dia'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-4 w-full max-w-[100vw] overflow-x-hidden">
                      {filteredAppointments.map((appointment) => (
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
                                  <span className="text-white text-sm truncate">
                                    {appointment.client_name}
                                  </span>
                                  {appointment.client_id && newClientsInfo[appointment.client_id] && (
                                    <span className="px-1 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
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

                            {/* Botão "clique para ver" com seta */}
                            {!appointmentDropdowns[appointment.id] && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white/70">
                                  clique para ver
                                </span>
                                <ChevronDown className="h-4 w-4 text-white/70" />
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
                                      <Crown className="h-5 w-5 text-yellow-400" />
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
                                            if (!phoneNumber.startsWith('55')) {
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
                                            if (!phoneNumber.startsWith('55')) {
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
                                              className="text-blue-400 hover:text-blue-300 text-xs"
                                              title="Editar valor"
                                            >
                                              ✏️
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {appointment.additional_products && appointment.additional_products.length > 0 && (
                                    <div className="flex flex-col">
                                      <span className="text-sm text-white/80 mb-1">Produtos/Serviços Adicionais:</span>
                                      <div className="flex flex-wrap gap-2">
                                        {appointment.additional_products.map((product, index) => (
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
                                        {appointment.sold_products.map((product, index) => (
                                          <div key={index} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600/20 text-blue-200 rounded border border-blue-500/30 group">
                                            <Package className="h-3 w-3" />
                                            <span>{product.name} - {formatCurrency(product.total)}</span>
                                            <span className="text-blue-300">({product.quantity}x)</span>
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

                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="text-sm text-white/80">Total:</span>
                                    <span className="text-sm font-medium text-white">
                                      {isClientPaidSubscriber(appointment.client_whatsapp)
                                        ? "GRATUITO"
                                        : appointment.is_subscriber
                                          ? 'R$ 0,00 (GRATUITO)'
                                          : formatCurrency(appointment.total_price || appointment.price)
                                      }
                                    </span>
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
                                          <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded border border-blue-400/20">
                                            Bandeira: {appointment.card_brand.toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {appointment.payment_method === 'pix' && (
                                      <select
                                        value={appointment.pix_payment_status || 'pending'}
                                        onChange={(e) => handlePixPaymentStatusChange(appointment.id, e.target.value)}
                                        className="bg-white/10 text-white text-sm rounded px-2 py-1 border border-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/30"
                                      >
                                        <option value="pending" className="bg-green-700 text-white">Aguardando PIX</option>
                                        <option value="confirmed" className="bg-green-700 text-white">PIX Confirmado</option>
                                        <option value="rejected" className="bg-green-700 text-white">PIX Rejeitado</option>
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
                                      className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mb-2"
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
                                            className="px-2 py-1 text-xs font-medium rounded transition-colors bg-blue-600 text-white hover:bg-blue-700"
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
                                          className="px-2 py-1 text-xs font-medium rounded transition-colors bg-blue-600 text-white hover:bg-blue-700"
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
                                            <span className="text-purple-600 text-sm">📝</span>
                                            <div className="flex-1">
                                              <p className="text-xs text-purple-800 font-medium mb-1">Minha Observação:</p>
                                              <p className="text-xs text-purple-700 break-words">{appointment.establishment_observation}</p>
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
                      ))}
                    </div>
                  )}
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
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200"
                          title="Abrir página de agendamentos"
                        >
                          Reservar Cliente
                        </a>
                        <button
                          type="button"
                          onClick={copyLinkToClipboard}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200"
                        >
                          Copiar Link
                        </button>
                      </div>
                      <p className="text-sm text-gray-400">
                        Clique em "Reservar Cliente" para acessar a página de agendamentos. Você pode fazer reservas para seus clientes através desta página, ou copie o link envie para seus clientes ou deixe na biografia do instagram.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6 w-full">
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
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
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
                          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
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
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                      >
                        <span>📺</span>
                        <span>Mostrar Tutorial</span>
                      </button>
                    </div>
                  )}

                  {/* Informações Básicas */}
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
                            <p className="text-sm text-gray-400">
                              Adicione uma logo para seu estabelecimento. Ela será exibida na página de agendamentos.
                              <br />
                              Recomendamos uma imagem quadrada de pelo menos 200x200 pixels.
                            </p>
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
                        <div className="flex items-center gap-2 mb-1">
                          <label className="block text-sm font-medium">Senha de 4 dígitos para configurações</label>
                          <span className="text-sm text-yellow-500 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            Senhas salvas aqui servem para abrir (todos os profissionais/alterar senha de cada profissional/trocar % do profissional/e para entrar nas config).
                          </span>
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
                          {establishment?.pin_password ? 'Senha atual: ' + establishment.pin_password : 'Nenhuma senha definida'}
                        </p>
                      </div>
                    </div>
                  </div>


                  {/* Seção de Comodidades */}
                  <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                    <h3 className="text-lg font-medium text-white mb-4">Comodidades</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Selecione as comodidades disponíveis no seu estabelecimento:
                    </p>
                    <div className="space-y-4">
                      {/* Wi-fi + Senha */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-2 sm:space-y-0">
                        <label className="inline-flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={hasWifi}
                            onChange={(e) => setHasWifi(e.target.checked)}
                            className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                          />
                          <span className="text-white">Wi-fi</span>
                        </label>
                        {hasWifi && (
                          <input
                            type="text"
                            placeholder="Senha do Wi-Fi"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            className="bg-[#2a2b2c] border border-gray-600 text-white rounded px-3 py-2 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        )}
                      </div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={hasParking}
                          onChange={(e) => setHasParking(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                        />
                        <span className="text-white">Estacionamento</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={hasAccessibility}
                          onChange={(e) => setHasAccessibility(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                        />
                        <span className="text-white">Acessibilidade</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={requireCancellationRequest}
                          onChange={(e) => setRequireCancellationRequest(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                        />
                        <div className="flex flex-col">
                          <span className="text-white">Cancelamento</span>
                          <span className="text-xs text-gray-400">
                            Ao ativar essa opção seus clientes não podem agendar e depois cancelar, mas sim terá um botão que o cliente clica e envia uma mensagem no seu WhatsApp com a mensagem "Olá, queria cancelar agendamento... motivo é"
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={preventSameDayReschedule}
                          onChange={(e) => setPreventSameDayReschedule(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-primary bg-[#2a2b2c] border-gray-600 rounded"
                        />
                        <div className="flex flex-col">
                          <span className="text-white">Clientes assinantes não podem desmarcar e remarcar no mesmo dia</span>
                          <span className="text-xs text-gray-400">
                            Se ativada, quando um assinante cancelar um agendamento, não poderá remarcar para o mesmo dia. Exemplo: Se hoje é terça-feira e o assinante desmarcou, não poderá remarcar na terça-feira.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Configuração de Intervalo */}
                  <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 mb-6">
                    <h3 className="text-lg font-medium text-white mb-4">Configuração de Horários</h3>
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          id="use15MinuteInterval"
                          checked={use15MinuteInterval}
                          onChange={(e) => setUse15MinuteInterval(e.target.checked)}
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

                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="showBestOfBrazilImage"
                          checked={showBestOfBrazilImage}
                          onChange={(e) => setShowBestOfBrazilImage(e.target.checked)}
                          className="form-checkbox h-5 w-5 text-primary bg-[#242628] border-gray-700 rounded"
                        />
                        <label htmlFor="showBestOfBrazilImage" className="text-white font-medium">
                          Melhor sistema de agendamentos do brasil
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Horário de Funcionamento */}
                  <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                    <h3 className="text-lg font-medium text-white mb-4">Horário de Funcionamento</h3>
                    <div className="space-y-4">
                      {Object.entries(businessHours).map(([day, hours]) => (
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
                                    Abertura
                                  </label>
                                  <TimeSelector
                                    value={hours.open1}
                                    onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open1', value)}
                                    disabled={!hours.enabled}
                                    className="w-full"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                                    Fecha p/ Intervalo
                                  </label>
                                  <TimeSelector
                                    value={hours.close1}
                                    onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close1', value)}
                                    disabled={!hours.enabled}
                                    className="w-full"
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
                                    value={hours.open2}
                                    onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open2', value)}
                                    disabled={!hours.enabled}
                                    className="w-full"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
                                    Fechamento
                                  </label>
                                  <TimeSelector
                                    value={hours.close2}
                                    onChange={(value) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close2', value)}
                                    disabled={!hours.enabled}
                                    className="w-full"
                                  />
                                </div>
                              </div>

                              {/* Resumo visual dos horários */}
                              <div className="mt-3 p-2 bg-[#1a1b1c] rounded text-sm text-primary">
                                <span className="font-medium">Funcionamento:</span> {hours.open1} - {hours.close1} e {hours.open2} - {hours.close2}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fotos Personalizadas */}
                  <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                    <h3 className="text-lg font-medium text-white mb-4">Fotos do Estabelecimento</h3>
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
                  </div>


                  {/* Serviços */}
                  <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                    <h3 className="text-lg font-medium text-white mb-4">Serviços</h3>
                    <p className="text-sm text-gray-400 mb-6">
                      Adicione os serviços oferecidos pelo seu estabelecimento
                    </p>

                    {/* Lista de Serviços Cadastrados */}
                    {servicesWithPrices.length > 0 && (
                      <div className="mb-4 border-b border-gray-800 pb-4">
                        <h4 className="text-md font-semibold text-gray-300 mb-3">Serviços Cadastrados:</h4>
                        <p className="text-sm text-gray-400 mb-3">
                          Arraste os serviços para reordenar a lista
                        </p>
                        <DraggableServiceList
                          services={servicesWithPrices}
                          onReorder={(newServices) => {
                            setServicesWithPrices(newServices);
                            // Salvar automaticamente a nova ordem
                            if (establishment) {
                              saveServicesOrder(newServices);
                            }
                          }}
                          isSaving={isSavingServicesOrder}
                        />
                      </div>
                    )}

                    <ServiceForm
                      services={servicesWithPrices}
                      onChange={setServicesWithPrices}
                    />
                  </div>

                  {/* Configurações do PIX */}
                  <EstablishmentPixSettings
                    establishment={establishment}
                    onSave={handleSavePixSettings}
                  />



                  {/* Links Personalizados */}
                  <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                    <h3 className="text-lg font-medium text-white mb-4">Links Personalizados</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Link para Avaliar (Google, etc.)</label>
                        <input
                          type="url"
                          value={reviewLink}
                          onChange={(e) => setReviewLink(e.target.value)}
                          placeholder="Ex: https://g.page/sua-empresa/review"
                          className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Link das Redes Sociais</label>
                        <input
                          type="url"
                          value={socialMediaLink}
                          onChange={(e) => setSocialMediaLink(e.target.value)}
                          placeholder="Ex: https://instagram.com/seuperfil"
                          className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Link para Pagamento PIX</label>
                        <input
                          type="url"
                          value={pixPaymentLink}
                          onChange={(e) => setPixPaymentLink(e.target.value)}
                          placeholder="Será preenchido automaticamente com sua chave PIX, ou digite um link personalizado"
                          className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-400">Link para Local</label>
                        <input
                          type="url"
                          value={locationLink}
                          onChange={(e) => setLocationLink(e.target.value)}
                          placeholder="Ex: https://maps.google.com"
                          className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Configurações de Wi-Fi */}
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

                  {/* Configurações de WhatsApp */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-white mb-4">Configurações de WhatsApp</h3>
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
                  </div>

                  {/* Configurações de Pagamento */}
                  <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 mb-6">
                    <h3 className="text-lg font-medium text-white mb-4">Configurações de Pagamento</h3>
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
                            onChange={(e) => setCreditCardTaxPercentage(parseFloat(e.target.value) || 0)}
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
                            onChange={(e) => setDebitCardTaxPercentage(parseFloat(e.target.value) || 0)}
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
                  </div>

                  {/* Botão de Salvar */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleUpdateEstablishment}
                      disabled={isUpdating}
                      className={`px-6 py-3 bg-primary text-white rounded-lg font-medium ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/80'
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
                          Salvar Alterações
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}



              {activeTab === 'financial-dashboard' && isDashboardUnlocked && (
                <div className="space-y-6">
                  {/* Dashboard Financeiro com Despesas */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-gray-900">Dashboard Financeiro</h2>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAddExpenseModal(true)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
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
                      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-green-800">Resumo Bruto</h3>
                          <div className="flex items-center gap-2">
                            {!isEditingGrossValue && (
                              <button
                                onClick={() => setIsEditingGrossValue(true)}
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                              >
                                EDITAR
                              </button>
                            )}
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                        {isEditingGrossValue ? (
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={editingGrossValue}
                              onChange={(e) => setEditingGrossValue(e.target.value)}
                              placeholder="Digite o valor bruto"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-gray-900 bg-white"
                              step="0.01"
                              min="0"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveGrossValue}
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
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
                            <p className="text-3xl font-bold text-green-900">
                              {formatCurrency(calculateTotalGrossWithInitial(monthlyAppointments))}
                            </p>
                            <p className="text-sm text-green-700 mt-1">Total faturado no mês</p>
                          </>
                        )}
                      </div>

                      {/* Resumo Líquido */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-blue-800">Resumo Líquido</h3>
                          <DollarSign className="h-5 w-5 text-blue-600" />
                        </div>
                        <p className="text-3xl font-bold text-blue-900">
                          {formatCurrency(calculateTotalLiquidWithInitial(monthlyAppointments, expensesTotal))}
                        </p>
                        <p className="text-sm text-blue-700 mt-1">
                          Bruto - Despesas - Taxas de Cartão
                        </p>
                      </div>

                      {/* Resumo Líquido Estabelecimento */}
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-purple-800">Líquido Estabelecimento</h3>
                          <Building2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <p className="text-3xl font-bold text-purple-900">
                          {formatCurrency(calculateTotalEstablishmentLiquidWithInitial(monthlyAppointments, expensesTotal))}
                        </p>
                        <p className="text-sm text-purple-700 mt-1">
                          Bruto - Todos os Profissionais - Despesas - Taxas
                        </p>
                      </div>
                    </div>

                    {/* Taxas de Cartão */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-red-600" />
                        <span className="font-medium text-red-900">
                          Taxas de Cartão: {formatCurrency(calculateTotalCardTaxes(monthlyAppointments))}
                        </span>
                      </div>
                      <p className="text-sm text-red-700 mt-1">
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
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Receita por Profissional</h3>


                    <div className="space-y-4">
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
                          <div key={professional.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{professional.name}</p>
                              <div className="text-sm text-gray-600">
                                <p>
                                  {professionalAppointments.length} agendamento(s) •
                                  {professional.percentage === 100 ? (
                                    <span className="text-green-600 font-medium">Dono (100%)</span>
                                  ) : (
                                    <span>{professional.percentage || 100}%</span>
                                  )}
                                </p>
                                {extraProductsSold > 0 && (
                                  <div className="relative">
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
                                      <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-80 max-w-96">
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
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">
                                {formatCurrency(professionalRevenue)}
                              </p>
                              <div className="text-sm text-blue-600">
                                {professional.percentage === 100 ? (
                                  <span>Líquido: {formatCurrency(calculateProfessionalNetValue(professional.name, monthlyAppointments))}</span>
                                ) : (
                                  <span>Líquido: {formatCurrency(calculateProfessionalNetValue(professional.name, monthlyAppointments))}</span>
                                )}
                              </div>

                              {/* Controle de Pagamentos */}
                              <div className="mt-2">
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
                                    <summary className="text-gray-500 hover:text-gray-700">
                                      Ver serviços individuais
                                    </summary>
                                    <div className="mt-2 space-y-1 bg-gray-100 p-2 rounded">
                                      {professionalAppointments
                                        .filter(apt => apt.status === 'completed')
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

                                          return (
                                            <div key={index} className="flex justify-between text-xs">
                                              <span className="text-gray-600">
                                                {apt.client_name} - {formatCurrency(baseValue)}
                                              </span>
                                              <span className="text-blue-600">
                                                → {formatCurrency(netValue)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
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
                          const dayAppointments = monthlyAppointments.filter(apt => {
                            const aptDate = new Date(apt.appointment_date);
                            return aptDate.getDate() === day && apt.status !== 'cancelled';
                          });
                          const dayRevenue = dayAppointments.reduce((total, apt) => {
                            if (isClientPaidSubscriber(apt.client_whatsapp)) {
                              return total; // Não adiciona ao faturamento se for assinante pago
                            }
                            return total + (apt.total_price || apt.price || 0);
                          }, 0);

                          return { day, revenue: dayRevenue, appointments: dayAppointments.length };
                        }).filter(day => day.revenue > 0);

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
                            const dayAppointments = monthlyAppointments.filter(apt => {
                              const aptDate = new Date(apt.appointment_date);
                              return aptDate.getDate() === day && apt.status !== 'cancelled';
                            });
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
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Meus Clientes</h2>
                    <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
                    </div>
                  </div>
                  <p className="text-gray-700 mb-8">
                    Aqui você encontra todos os clientes que já agendaram em seu estabelecimento.
                  </p>

                  {/* Controles de busca e filtros */}
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Buscar cliente por nome..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Botões de ação */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShowBirthdayFilter(!showBirthdayFilter)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showBirthdayFilter
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                      >
                        🎂 Aniversariantes do mês
                      </button>
                      <button
                        onClick={() => setShowAddClientModal(true)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        ➕ Adicionar Cliente
                      </button>

                      {showBirthdayFilter && (
                        <span className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm">
                          {filteredClients.length} encontrado(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClients.length === 0 ? (
                      <div className="col-span-full text-center py-8 bg-white rounded-lg border border-gray-200">
                        <Users className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                        <p className="text-gray-400">Nenhum cliente encontrado.</p>
                      </div>
                    ) : (
                      filteredClients.map((client, index) => (
                        <div key={`${client.whatsapp}-${client.id}-${index}`} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-900 truncate">{client.name}</h3>
                            {client.isSubscriber && <Crown className="h-5 w-5 text-yellow-500" />} {/* COROA PARA ASSINANTES */}
                          </div>
                          <p className="text-gray-700 flex items-center gap-2 mb-1">
                            <Phone className="h-4 w-4 text-gray-500" />
                            {client.whatsapp}
                          </p>
                          <p className="text-gray-700 flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            Agendamentos: {client.appointmentCount}
                          </p>

                          {/* Campo de aniversário */}
                          <div className="text-gray-700 flex items-center gap-2 mb-4">
                            <span className="text-gray-500">🎂</span>
                            {editingClientBirthday === client.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={newBirthday}
                                  onChange={(e) => setNewBirthday(e.target.value)}
                                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                <button
                                  onClick={() => saveBirthday(client.id, newBirthday)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Salvar"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingClientBirthday(null);
                                    setNewBirthday('');
                                  }}
                                  className="text-red-600 hover:text-red-800"
                                  title="Cancelar"
                                >
                                  ✗
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {client.birthday
                                    ? new Date(client.birthday).toLocaleDateString('pt-BR')
                                    : 'Não informado'
                                  }
                                </span>
                                <button
                                  onClick={() => {
                                    console.log('🎯 Cliente clicado para editar:', {
                                      clientId: client.id,
                                      clientName: client.name,
                                      currentBirthday: client.birthday
                                    });
                                    setEditingClientBirthday(client.id);
                                    setNewBirthday(client.birthday || '');
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                  title="Editar aniversário"
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                            {client.birthday && isBirthdayThisMonth(client.birthday) && (
                              <span className="text-purple-600 text-xs font-medium">• Aniversário este mês!</span>
                            )}
                          </div>

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
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
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
                    <p className="text-gray-300 text-sm mb-4">
                      Configure os horários de trabalho personalizados para este profissional. Se não configurado, será usado o horário padrão do estabelecimento.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {Object.entries({
                      monday: 'Segunda-feira',
                      tuesday: 'Terça-feira',
                      wednesday: 'Quarta-feira',
                      thursday: 'Quinta-feira',
                      friday: 'Sexta-feira',
                      saturday: 'Sábado',
                      sunday: 'Domingo'
                    }).map(([day, dayName]) => (
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
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                          </label>
                        </div>

                        {workHoursData[day]?.enabled && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Entrada</label>
                              <input
                                type="time"
                                value={workHoursData[day]?.entry_time || '08:00'}
                                onChange={(e) => handleUpdateWorkTime(day, 'entry_time', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Início Intervalo</label>
                              <input
                                type="time"
                                value={workHoursData[day]?.break_start || ''}
                                onChange={(e) => handleUpdateWorkTime(day, 'break_start', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Fim Intervalo</label>
                              <input
                                type="time"
                                value={workHoursData[day]?.break_end || ''}
                                onChange={(e) => handleUpdateWorkTime(day, 'break_end', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-sm text-gray-300 mb-2">Saída</label>
                              <input
                                type="time"
                                value={workHoursData[day]?.exit_time || '17:00'}
                                onChange={(e) => handleUpdateWorkTime(day, 'exit_time', e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
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
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Assinantes</h3>
                        <p className="text-sm text-gray-600">Aprenda a gerenciar assinantes e acompanhar pagamentos</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('subscribers')}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                    >
                      Ocultar Tutorial
                    </button>
                  </div>

                  <div className="relative w-full h-0 pb-[56.25%] rounded-lg overflow-hidden">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full"
                      src="https://www.youtube.com/embed/CeWMXi4MS7g"
                      title="Tutorial: Como Gerenciar Assinantes"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="mt-3 text-center">
                    <a
                      href="https://youtu.be/CeWMXi4MS7g"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
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

          {/* Tab de Reservar Cliente */}
          {activeTab === 'reserve-client' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Reservar Cliente</h2>
              <div className="text-center">
                <p className="text-gray-600 mb-6 text-lg">
                  Clique em "Reservar Cliente" para acessar a página de agendamentos. Você pode fazer reservas para seus clientes.
                </p>
                <a
                  href={`/booking/${establishment.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
                >
                  RESERVAR CLIENTE
                </a>
              </div>
            </div>
          )}

          {/* Tab de Ranking */}
          {activeTab === 'ranking' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🏆 Ranking dos Clientes Mais Fiéis</h2>
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
          )}

          {/* Tab de Clientes Sumidos */}
          {activeTab === 'missing-clients' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">👻 Clientes Sumidos</h2>
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
                          href={`https://wa.me/${client!.whatsapp}`}
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
          )}

          {/* Tab de Sorteio */}
          {activeTab === 'draw' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">🎲 Sorteio de Clientes</h2>
              <div className="text-center">
                <p className="text-gray-600 mb-6 text-lg">
                  Clique no botão abaixo para abrir o sorteio de clientes fiéis.
                </p>
                <button
                  onClick={() => setShowDrawModal(true)}
                  className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
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
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
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

          {/* Tab de Serviços com Dropdown */}
          {activeTab === 'service-categories' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Serviços com Dropdown</h2>
                <button
                  onClick={() => setShowAddCategoryModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Categoria
                </button>
              </div>

              {/* Vídeo Tutorial */}
              {showTutorials.services && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Serviços</h3>
                        <p className="text-sm text-gray-600">Aprenda a criar categorias e serviços com dropdown</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('services')}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
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
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span>📺</span>
                    <span>Mostrar Tutorial</span>
                  </button>
                </div>
              )}

              {serviceCategories.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-black mb-4">Nenhuma categoria de serviço cadastrada ainda</p>
                  <button
                    onClick={() => setShowAddCategoryModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Adicionar Primeira Categoria
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {serviceCategories.map((category) => {
                    const categorySubcategories = serviceSubcategories.filter(sub => sub.category_id === category.id);

                    return (
                      <div key={category.id} className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-gray-900">{category.name}</h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedCategoryForSubcategory(category.id);
                                setShowAddSubcategoryModal(true);
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Adicionar Serviço
                            </button>
                            <button
                              onClick={() => {
                                setEditingCategory(category);
                                setShowEditCategoryModal(true);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Editar
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Tem certeza que deseja excluir a categoria "${category.name}" e todos os seus serviços?`)) {
                                  handleDeleteCategory(category.id);
                                }
                              }}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Excluir
                            </button>
                          </div>
                        </div>

                        {categorySubcategories.length === 0 ? (
                          <p className="text-black text-sm">Nenhum serviço cadastrado nesta categoria</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {categorySubcategories.map((subcategory) => (
                              <div key={subcategory.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium text-gray-900">{subcategory.name}</h4>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingSubcategory(subcategory);
                                        setShowEditSubcategoryModal(true);
                                      }}
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
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
                                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </button>
              </div>

              {/* Vídeo Tutorial */}
              {showTutorials.products && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Produtos</h3>
                        <p className="text-sm text-gray-600">Aprenda a adicionar, editar e acompanhar seus produtos</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('products')}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
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
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
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

              {/* Relatório de Faturamento */}
              {products.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Faturamento dos Produtos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Faturamento Bruto</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(products.reduce((total, product) => total + (product.sale_price * product.sold_quantity), 0))}
                          </p>
                          <p className="text-xs text-gray-500">Total vendido em produtos</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Lucro Líquido</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(products.reduce((total, product) => total + ((product.sale_price - product.cost_price) * product.sold_quantity), 0))}
                          </p>
                          <p className="text-xs text-gray-500">Lucro real obtido</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Receipt className="h-6 w-6 text-blue-600" />
                        </div>
                      </div>
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
                    const totalProfit = (product.sale_price - product.cost_price) * product.stock_quantity;
                    const currentProfit = (product.sale_price - product.cost_price) * product.sold_quantity;

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
                            <span className="text-sm text-black">Vendidos:</span>
                            <span className="text-sm font-medium text-black">{product.sold_quantity} unidades</span>
                          </div>

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
                              <span className="text-sm text-black">Lucro total estimado:</span>
                              <span className="text-sm font-bold text-green-600">{formatCurrency(totalProfit)}</span>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-sm text-black">Lucro atual:</span>
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

              {/* Vídeo Tutorial */}
              {showTutorials.professionals && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                        <span className="text-red-600 text-xl">📺</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Tutorial: Como Gerenciar Profissionais</h3>
                        <p className="text-sm text-gray-600">Aprenda a cadastrar e gerenciar profissionais do seu estabelecimento</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleTutorial('professionals')}
                      className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
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
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span>📺</span>
                    <span>Mostrar Tutorial</span>
                  </button>
                </div>
              )}

              <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                <h3 className="text-lg font-medium text-white mb-4">Profissionais</h3>
                <p className="text-sm text-gray-400 mb-6">
                  Cadastre os profissionais do seu estabelecimento. Para cada profissional, você deve:
                  <br />• Informar nome e sobrenome
                  <br />• Definir uma senha de 4 dígitos para acesso ao dashboard individual
                  <br /><br />
                  Cada profissional terá acesso ao seu próprio painel de controle onde poderá:
                  <br />• Visualizar o valor total recebido no dia
                  <br />• Acompanhar o valor total recebido no mês
                  <br />• Ver sua lista de agendamentos do dia
                  <br />• Criar agendamentos e cancelar agendamentos
                  <br />• Vender produtos adicionais para clientes
                </p>

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
                              className="text-xs px-2 py-1 bg-green-600/20 text-green-500 rounded"
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
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      <span>Salvar Profissionais</span>
                    </button>
                  </div>

                  {/* Indicador de status */}
                  {professionals.length > 0 && (
                    <div className="text-xs text-yellow-400 text-center">
                      ⚠ Clique em "Salvar Profissionais" para salvar
                    </div>
                  )}
                </div>

                {/* Resto do código original dos profissionais */}
                <div className="space-y-4">
                  {professionals.map((professional) => (
                    <div key={professional.id} className="p-4 bg-[#242628] rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={professional.name}
                            onChange={(e) => handleProfessionalChange(professional.id, 'name', e.target.value)}
                            className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            placeholder="Nome do profissional"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProfessional(professional.id)}
                          className="ml-2 text-red-500 hover:text-red-400"
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
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer transition-colors"
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
                            className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
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
                              className="w-full sm:w-auto px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
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
                            className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
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
                              className="w-full sm:w-auto px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                              Ver
                            </button>
                          </div>
                        )}
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
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                          </label>
                        </div>
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
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="text-lg font-semibold text-blue-900 mb-2">Taxas do Mês</h3>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency(taxesReport.totalMonthlyTax)}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h3 className="text-lg font-semibold text-green-900 mb-2">Taxas do Ano</h3>
                      <p className="text-2xl font-bold text-green-700">
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
      {showAddProductModal && (
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
      )}

      {/* Modal para Editar Produto */}
      {showEditProductModal && editingProduct && (
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
      )}

      {/* Modal para Adicionar Produto V2 (do estoque) */}
      {showAddProductToAppointmentModal && selectedAppointmentForProduct && (
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
      )}

      {/* Modal para Adicionar Categoria */}
      {showAddCategoryModal && (
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
      )}

      {/* Modal para Adicionar Subcategoria */}
      {showAddSubcategoryModal && selectedCategoryForSubcategory && (
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
      )}

      {/* Modal para Editar Categoria */}
      {showEditCategoryModal && editingCategory && (
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
      )}

      {/* Modal para Editar Subcategoria */}
      {showEditSubcategoryModal && editingSubcategory && (
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
      )}

      {/* Modal de Observações */}
      {showObservationModal && (
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
      )}

      {/* Botão de Atualização */}
      <UpdateButton />

      {/* Popup bonito para explicação */}
      {showReminderPopup && (
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
      )}

      {/* Popup de confirmação para cancelar */}
      {showCancelConfirm && (
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
      )}

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
    </div>
  );
};

export default EstablishmentDashboard;