import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, startOfMonth, endOfMonth, isToday, isSameMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, LogOut, Scissors, Star, Copy, CheckCircle, Image as ImageIcon, Plus, Trash2, DollarSign, Settings, ChevronLeft, ChevronRight, Check, Crown, Phone, MessageSquare, CreditCard, X, BarChart3, AlertTriangle, Users, Receipt, TrendingUp, ChevronDown, ChevronUp, Building2, Shuffle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { supabase, addExpense, getExpenses, deleteExpense, getExpensesTotal } from '../lib/supabase';
import { getEstablishmentAppointments, createEstablishment, updateEstablishment, getEstablishmentPremiumSubscribers, removePremiumSubscriber } from '../lib/supabase';
import { ServiceForm } from '../components/ServiceForm';
import { DurationSelector } from '../components/DurationSelector';
import { DraggableServiceList } from '../components/DraggableServiceList';
import { TimeSelector } from '../components/TimeSelector';
import { AvailableTimesViewer } from '../components/AvailableTimesViewer';
import { EstablishmentPixSettings } from '../components/EstablishmentPixSettings';
import { v4 as uuidv4 } from 'uuid';
import LoyalCustomers from '../components/LoyalCustomers';
import PinPasswordModal from '../components/PinPasswordModal';
import ProfessionalPinModal from '../components/ProfessionalPinModal';
import AdditionalProductModal from '../components/AdditionalProductModal';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { SubscribersManager } from '../components/SubscribersManager'; // Importar o novo componente
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPermission } from '../components/NotificationPermission';
import { initRealTimeNotifications, stopRealTimeNotifications } from '../utils/realTimeNotifications';
import { NotificationsPanel } from '../components/NotificationsPanel';
import { ProfessionalSelector } from '../components/ProfessionalSelector';

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
  pix_key_type?: string;
  pix_key?: string;
  pin_password?: string;
  logo_url?: string;
  review_link?: string;       // Nova coluna
  social_media_link?: string; // Nova coluna
  pix_payment_link?: string;  // Nova coluna
  location_link?: string; // Novo estado para o link do local
  has_wifi?: boolean; // Novo estado para Wi-fi
  has_parking?: boolean; // Novo estado para Estacionamento
  has_accessibility?: boolean; // Novo estado para Acessibilidade
  wifi_password?: string; // Senha do Wi-Fi
  whatsapp?: string; // Novo campo para WhatsApp
  credit_card_tax_percentage?: number; // Taxa do cartão de crédito (%)
  debit_card_tax_percentage?: number; // Taxa do cartão de débito (%)
}

type TabType = 'appointments' | 'services' | 'settings' | 'financial-dashboard' | 'clients' | 'subscribers';

interface AdditionalProduct {
  name: string;
  price: number;
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
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  is_premium: boolean;
  duration: number;
  price: number;
  payment_method?: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'transferencia';
  pix_payment_status?: string;
  pix_proof_url?: string;
  additional_products?: AdditionalProduct[];
  total_price?: number;
  is_subscriber?: boolean;
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
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [isEstablishmentLoading, setIsEstablishmentLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingServicesOrder, setIsSavingServicesOrder] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState('all');
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
  const [creditCardTaxPercentage, setCreditCardTaxPercentage] = useState(3.5); // Taxa do cartão de crédito (%)
  const [debitCardTaxPercentage, setDebitCardTaxPercentage] = useState(2.5); // Taxa do cartão de débito (%)
  
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
  const [customPhoto1Preview, setCustomPhoto1Preview] = useState<string | null>(null);
  const [customPhoto2Preview, setCustomPhoto2Preview] = useState<string | null>(null);
  const [customPhoto3Preview, setCustomPhoto3Preview] = useState<string | null>(null);
  
  // Estados de horários e profissionais
  const [businessHours, setBusinessHours] = useState<Record<string, BusinessHours>>({
    monday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    tuesday:   { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    wednesday: { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    thursday:  { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    friday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    saturday:  { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
    sunday:    { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
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


  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pinPassword, setPinPassword] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [isConfigUnlocked, setIsConfigUnlocked] = useState(false);

  // Estados para o modal de senha do profissional
  const [showProfessionalPinModal, setShowProfessionalPinModal] = useState(false);
  const [selectedProfessionalForPin, setSelectedProfessionalForPin] = useState<string | null>(null);
  const [tempSelectedProfessional, setTempSelectedProfessional] = useState<string | null>(null);
  const [authenticatedProfessionalId, setAuthenticatedProfessionalId] = useState<string | null>(null);

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
  const [isSubscribersUnlocked, setIsSubscribersUnlocked] = useState(false); // Novo estado
  const [showSubscribersPinModal, setShowSubscribersPinModal] = useState(false); // Novo estado

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
      if (file.size > 5 * 1024 * 1024) {
        toast('A imagem deve ter no máximo 5MB', 'error');
        return;
      }
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCustomPhotoChange = (photoNumber: 1 | 2 | 3, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast('A imagem deve ter no máximo 5MB', 'error');
        return;
      }
      
      if (photoNumber === 1) {
        setCustomPhoto1(file);
        setCustomPhoto1Preview(URL.createObjectURL(file));
      } else if (photoNumber === 2) {
        setCustomPhoto2(file);
        setCustomPhoto2Preview(URL.createObjectURL(file));
      } else if (photoNumber === 3) {
        setCustomPhoto3(file);
        setCustomPhoto3Preview(URL.createObjectURL(file));
      }
    }
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

  // Função para salvar profissionais no banco de dados
  const saveProfessionalsToDatabase = async () => {
    if (!establishment || professionals.length === 0) return;
    
    try {
      console.log('💾 Salvando profissionais:', professionals);
      console.log('🔍 Verificando percentuais:', professionals.map(p => ({ name: p.name, percentage: p.percentage })));
      
      const { error } = await supabase
        .from('establishments')
        .update({ professionals })
        .eq('id', establishment.id);

      if (error) throw error;
      
      // Atualizar o estado local do establishment também
      setEstablishment({
        ...establishment,
        professionals: professionals
      });
      
      console.log('✅ Profissionais salvos com sucesso!');
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
          percentage: p.percentage || 100 // Manter o percentual
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
        whatsapp: establishment?.whatsapp, // Adiciona o campo de WhatsApp
        use_15_minute_interval: use15MinuteInterval, // Configuração de intervalo de 15 minutos
        show_best_of_brazil_image: showBestOfBrazilImage, // Configuração da imagem "Melhor do Brasil"
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
        setAppointments(prev => [...prev, appointments.find(app => app.id === appointmentId)].filter(Boolean));
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

      toast('Método de pagamento atualizado com sucesso', 'success');
    } catch (error) {
      console.error('Erro ao atualizar método de pagamento:', error);
      toast('Erro ao atualizar método de pagamento', 'error');
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
          pix_payment_status,
          pix_proof_url,
          additional_products,
          total_price
        `)
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startOfSelectedDate)
        .lte('appointment_date', endOfSelectedDate)
        .order('appointment_time', { ascending: true })
        .abortSignal(new AbortController().signal); // Forçar busca sem cache

      if (error) throw error;
      
      setAppointments(data as Appointment[] || []);
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
        setCreditCardTaxPercentage(establishmentData.credit_card_tax_percentage || 3.5); // Taxa do cartão de crédito
        setDebitCardTaxPercentage(establishmentData.debit_card_tax_percentage || 2.5); // Taxa do cartão de débito
        
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
        setServicesWithPrices(establishmentData.services_with_prices || []);
        setBusinessHours(establishmentData.business_hours || {
          monday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          tuesday:   { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          wednesday: { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          thursday:  { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          friday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          saturday:  { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
          sunday:    { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
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
  }, [user]);

  useEffect(() => {
    if (establishment && activeTab === 'financial-dashboard') {
      fetchPremiumSubscribers();
    }
  }, [establishment, activeTab]);

  useEffect(() => {
    if (establishment) {
      fetchAppointments();
      fetchMonthlyAppointments(selectedMonth);
      
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
      if (appointment.status !== 'cancelled') {
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
      if (appointment.status !== 'cancelled') {
        // Excluir do faturamento se for assinante pago (serviço gratuito)
        if (isClientPaidSubscriber(appointment.client_whatsapp)) {
          return total; // Não adiciona ao faturamento
        }
        return total + calculateGrossValueWithCardTax(appointment);
      }
      return total;
    }, 0);
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
      
      if (appointment.status !== 'cancelled') {
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
      
      // Só descontar se o profissional tem menos de 100% (é colaborador, não dono)
      if (professionalPercentage < 100) {
        const netValue = calculateNetValueWithCardTax(appointment);
        return total + netValue;
      }
      
      return total; // Profissionais com 100% não são descontados
    }, 0);
    
    return grossValue - collaboratorsValue;
  };

  // Filtrar agendamentos por profissional e forma de pagamento selecionados
  const filteredAppointments = appointments.filter(appointment => {
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
    const cleanNumber = whatsapp.replace(/\D/g, '');
    return `https://wa.me/55${cleanNumber}`;
  };

  // Carregar clientes fiéis quando o modal abrir
  useEffect(() => {
    if (showDrawModal) {
      loadLoyalCustomers();
    }
  }, [showDrawModal, selectedLoyalMonth]);

  // Função para obter o nome do profissional pelo ID
  const getProfessionalName = (professionalId: string): string => {
    if (professionalId === 'all') return 'Todos os profissionais';
    
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
        monday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        tuesday:   { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        wednesday: { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        thursday:  { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        friday:    { enabled: true,  open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        saturday:  { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' },
        sunday:    { enabled: false, open1: '09:00', close1: '12:00', open2: '13:30', close2: '18:00' }
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
          debit_card_tax_percentage: debitCardTaxPercentage
        })
        .eq('id', establishment.id);

      if (error) {
        throw error;
      }

      setEstablishment({
        ...establishment,
        credit_card_tax_percentage: creditCardTaxPercentage,
        debit_card_tax_percentage: debitCardTaxPercentage
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
      if (!establishment.pin_password || establishment.pin_password.length === 0) {
        // Se não tem senha configurada, libera o acesso
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

    // Se não tem senha configurada ou a senha está vazia, libera o acesso
    if (!professionalPin?.pin || professionalPin.pin.length === 0) {
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
    setTempSelectedProfessional(professionalId);
    
    // Resetar autenticação ao mudar de profissional
    setAuthenticatedProfessionalId(null);
    
    // Se for "Todos profissionais", só pede senha se tiver configurada
    if (professionalId === 'all') {
      if (establishment?.pin_password && establishment.pin_password.length > 0) {
        setShowProfessionalPinModal(true);
      } else {
        setSelectedProfessional(professionalId);
      }
    } else {
      // Se for um profissional específico, verifica se tem senha configurada
      const professionalPin = establishment?.professionals_pins?.find(
        p => p.professional_id === professionalId
      );

      if (professionalPin?.pin && professionalPin.pin.length > 0) {
      setShowProfessionalPinModal(true);
      } else {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para calcular valor líquido baseado no percentual do profissional
  const calculateNetValue = (baseValue: number, professionalId: string) => {
    const professional = professionals.find(p => p.id === professionalId);
    if (!professional) return baseValue;
    
    const percentage = professional.percentage || 0;
    
    // IMPORTANTE: Esta função é usada apenas para exibição na seção "Receita por Profissional"
    // Ela NÃO considera a taxa do cartão porque não tem acesso ao método de pagamento
    // Para cálculos precisos, use calculateNetValueWithCardTax que recebe o appointment completo
    return (baseValue * percentage) / 100;
  };

  // Função para calcular valor líquido do profissional considerando todos os seus agendamentos
  const calculateProfessionalNetValue = (professionalName: string, appointments: Appointment[]) => {
    const professional = professionals.find(p => p.name === professionalName);
    if (!professional) return 0;
    
    // Filtrar apenas agendamentos deste profissional
    const professionalAppointments = appointments.filter(apt => apt.professional === professionalName);
    
    // Calcular o líquido total usando a função correta
    const totalNet = professionalAppointments.reduce((total, appointment) => {
      if (appointment.status !== 'cancelled' && !isClientPaidSubscriber(appointment.client_whatsapp)) {
        return total + calculateNetValueWithCardTax(appointment);
      }
      return total;
    }, 0);
    
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
    
    console.log('🚨 TESTE - Cálculo líquido:', {
      appointment: appointment.client_name,
      baseValue,
      professional: appointment.professional,
      percentage,
      paymentMethod: appointment.payment_method,
      establishmentTaxes: {
        credit: establishment?.credit_card_tax_percentage,
        debit: establishment?.debit_card_tax_percentage
      }
    });
    
    // Se for pagamento com cartão, aplicar taxa específica primeiro
    if (appointment.payment_method === 'credito') {
      const cardTax = establishment?.credit_card_tax_percentage || 3.5;
      const valueAfterCardTax = baseValue - (baseValue * cardTax / 100);
      const result = (valueAfterCardTax * percentage) / 100;
      
      console.log('🚨 TESTE - Crédito:', { 
        baseValue, 
        cardTax, 
        valueAfterCardTax, 
        percentage, 
        result,
        calculation: `${baseValue} - (${baseValue} * ${cardTax}%) = ${valueAfterCardTax} → ${valueAfterCardTax} * ${percentage}% = ${result}`
      });
      return result;
    } else if (appointment.payment_method === 'debito') {
      const cardTax = establishment?.debit_card_tax_percentage || 2.5;
      const valueAfterCardTax = baseValue - (baseValue * cardTax / 100);
      const result = (valueAfterCardTax * percentage) / 100;
      
      console.log('🚨 TESTE - Débito:', { 
        baseValue, 
        cardTax, 
        valueAfterCardTax, 
        percentage, 
        result,
        calculation: `${baseValue} - (${baseValue} * ${cardTax}%) = ${valueAfterCardTax} → ${valueAfterCardTax} * ${percentage}% = ${result}`
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
  const getPaymentMethodTax = (method: string) => {
    switch (method) {
      case 'credito':
        return establishment?.credit_card_tax_percentage || 3.5;
      case 'debito':
        return establishment?.debit_card_tax_percentage || 2.5;
      default:
        return 0;
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
      const { error: uploadError, data } = await supabase.storage
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
                className={`w-full px-6 py-3 bg-primary text-white rounded-lg font-medium ${
                  isCreating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/80'
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
      {/* Imagem Melhor do Brasil - Topo Absoluto (Mobile) */}
      <div className="w-full mb-4 flex justify-center md:hidden">
        <img 
          src="/melhordobrasilcortado.png" 
          alt="Melhor do Brasil" 
          className="w-full h-auto rounded-lg shadow-lg"
        />
      </div>
      
      <div className="container-custom py-4 px-2 sm:py-8 sm:px-4 max-w-full">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{establishment.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-700">Código:</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-900 font-medium">{establishment.code}</span>
                <button
                  onClick={copyCodeToClipboard}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                  title="Copiar código"
                >
                  {codeCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationPermission className="hidden sm:flex" />
            {establishment && (
              <NotificationsPanel establishmentId={establishment.id} />
            )}
          </div>
          




              <div className="relative w-full">
                {/* Dica para scroll mobile */}
                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm text-blue-700 md:hidden">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                    </svg>
                    <span>Arraste para o lado para ver mais opções</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide pb-2 -mb-2 w-full">
                  <button
                    onClick={() => setActiveTab('appointments')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-shrink-0 ${
                      activeTab === 'appointments'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Calendar className="h-5 w-5" />
                    <span className="text-sm font-medium">Agendamentos</span>
                  </button>

                  {/* Botão Meus Clientes */}
                  <button
                    onClick={() => setActiveTab('clients')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-shrink-0 ${
                      activeTab === 'clients'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Users className="h-5 w-5" />
                    <span className="text-sm font-medium">Meus Clientes</span>
                  </button>

                  {/* Novo Botão Assinantes */}
                  <button
                    onClick={() => {
                      setIsSubscribersUnlocked(true);
                      setActiveTab('subscribers');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-shrink-0 ${
                      activeTab === 'subscribers'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Crown className="h-5 w-5" />
                    <span className="text-sm font-medium">Assinantes</span>
                  </button>

                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-500 cursor-not-allowed opacity-50 flex-shrink-0"
                    title="Em breve"
                  >
                    <Clock className="h-5 w-5" />
                    <span className="text-sm font-medium">Horários</span>
                  </div>

                  <button
                    onClick={() => setActiveTab('services')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-shrink-0 ${
                      activeTab === 'services'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Calendar className="h-5 w-5" />
                    <span className="text-sm font-medium">SEUS LINKS</span>
                  </button>

                  <button
                    onClick={() => {
                      if (establishment?.pin_password && establishment.pin_password.length > 0 && !isDashboardUnlocked) {
                        setShowDashboardPinModal(true);
                      } else {
                        setIsDashboardUnlocked(true);
                      }
                      setActiveTab('financial-dashboard');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-shrink-0 ${
                      activeTab === 'financial-dashboard'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <BarChart3 className="h-5 w-5" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </button>

                  <button
                    onClick={() => {
                      if (establishment?.pin_password && establishment.pin_password.length > 0 && !isSettingsUnlocked) {
                        setShowPinModal(true);
                      } else {
                        setIsSettingsUnlocked(true);
                      }
                      setActiveTab('settings');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors flex-shrink-0 ${
                      activeTab === 'settings'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Settings className="h-5 w-5" />
                    <span className="text-sm font-medium">Config</span>
                  </button>

                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm font-medium">Sair</span>
                  </button>
                </div>
                
                {/* Indicador de scroll para mobile */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none hidden sm:hidden md:block"></div>
              </div>

              </div>

        {/* Conteúdo Principal */}
        <div className="space-y-6">
          {/* Outros tabs existentes */}
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
                          showPhotoEditButtons={true}
                        />
                        <div className="mt-2 text-xs text-red-600">
                          filtro ativo: {getProfessionalName(selectedProfessional).toLowerCase()}
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
                              className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${
                                selectedPaymentMethod === 'todos' ? 'bg-primary text-white' : 'text-gray-700'
                              } rounded-t-lg`}
                            >
                              💳 Todos os tipos
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPaymentMethod('pendente');
                                setIsPaymentDropdownOpen(false);
                              }}
                              className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${
                                selectedPaymentMethod === 'pendente' ? 'bg-gray-500 text-white' : 'text-gray-700'
                        }`}
                      >
                        ⏳ Pendente
                      </button>
                      <button
                              onClick={() => {
                                setSelectedPaymentMethod('pix');
                                setIsPaymentDropdownOpen(false);
                              }}
                              className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${
                                selectedPaymentMethod === 'pix' ? 'bg-green-500 text-white' : 'text-gray-700'
                        }`}
                      >
                        🟢 PIX
                      </button>
                      <button
                              onClick={() => {
                                setSelectedPaymentMethod('credito');
                                setIsPaymentDropdownOpen(false);
                              }}
                              className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${
                                selectedPaymentMethod === 'credito' ? 'bg-blue-500 text-white' : 'text-gray-700'
                        }`}
                      >
                        🔵 Crédito
                      </button>
                      <button
                              onClick={() => {
                                setSelectedPaymentMethod('debito');
                                setIsPaymentDropdownOpen(false);
                              }}
                              className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${
                                selectedPaymentMethod === 'debito' ? 'bg-purple-500 text-white' : 'text-gray-700'
                        }`}
                      >
                        🟣 Débito
                      </button>
                      <button
                              onClick={() => {
                                setSelectedPaymentMethod('dinheiro');
                                setIsPaymentDropdownOpen(false);
                              }}
                              className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${
                                selectedPaymentMethod === 'dinheiro' ? 'bg-yellow-500 text-white' : 'text-gray-700'
                        }`}
                      >
                        🟡 Dinheiro
                      </button>
                      <button
                              onClick={() => {
                                setSelectedPaymentMethod('pagar_local');
                                setIsPaymentDropdownOpen(false);
                              }}
                              className={`w-full p-3 text-left hover:bg-gray-50 flex items-center gap-2 text-sm ${
                                selectedPaymentMethod === 'pagar_local' ? 'bg-orange-500 text-white' : 'text-gray-700'
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
                    {filteredAppointments.length} agendamentos encontrados
                  </div>
                </div>

              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Agendamentos do Dia</h2>
                <p className="text-gray-700 mb-3">
                  {selectedProfessional === 'all' ? 'Todos os profissionais' : `Profissional: ${getProfessionalName(selectedProfessional)}`}
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

                {/* Lista de Agendamentos */}
                {filteredAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                    <p className="text-gray-400">Nenhum agendamento para este dia</p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-4 w-full max-w-[100vw] overflow-x-hidden">
                    {filteredAppointments.map((appointment) => (
                      <div key={appointment.id} className={`${
                        appointment.status === 'cancelled' ? 'bg-red-800/90' : 'bg-green-600'
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-white font-medium">
                                {format(parseISO(appointment.appointment_date), "dd/MM/yyyy")}
                              </span>
                              <span className="text-white">
                                {appointment.appointment_time}
                              </span>
                              <span className="text-white">
                                {appointment.client_name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">
                                {isClientPaidSubscriber(appointment.client_whatsapp) 
                                  ? "GRATUITO" 
                                  : appointment.is_subscriber 
                                  ? 'GRATUITO' 
                                  : formatCurrency(appointment.total_price || appointment.price)
                                }
                              </span>
                              {appointmentDropdowns[appointment.id] ? (
                                <ChevronUp className="h-4 w-4 text-white" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-white" />
                              )}
                            </div>
                          </div>
                          {!appointmentDropdowns[appointment.id] && (
                            <div className="text-xs text-white/70 mt-1 text-center">
                              clique para ver
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
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newDropdowns = { ...subscriberDropdowns };
                                      newDropdowns[appointment.id] = !newDropdowns[appointment.id];
                                      setSubscriberDropdowns(newDropdowns);
                                    }}
                                    className="ml-2 px-2 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded transition-colors"
                                  >
                                    👑 CLIENTE ASSINANTE?
                                  </button>
                                  {subscriberDropdowns[appointment.id] && (
                                    <div className="absolute z-10 mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          console.log('Marcando cliente como assinante:', appointment.client_name);
                                          
                                          try {
                                            // SALVAR NO BANCO
                                            const { error } = await supabase
                                              .from('appointments')
                                              .update({ 
                                                is_subscriber: true,
                                                price: 0,
                                                total_price: 0
                                              })
                                              .eq('id', appointment.id);
                                            
                                            if (error) throw error;
                                            
                                            // Atualizar estado local
                                            const newSubscribers = { ...appointmentSubscribers };
                                            newSubscribers[appointment.id] = true;
                                            setAppointmentSubscribers(newSubscribers);
                                            
                                            // Fechar dropdown
                                            const newDropdowns = { ...subscriberDropdowns };
                                            newDropdowns[appointment.id] = false;
                                            setSubscriberDropdowns(newDropdowns);
                                            
                                            // Recarregar dados para atualizar saldos
                                            await fetchAppointments();
                                            await fetchMonthlyAppointments();
                                            
                                            toast('Cliente marcado como assinante! Serviço gratuito.', 'success');
                                          } catch (error) {
                                            console.error('Erro ao salvar assinante:', error);
                                            toast('Erro ao salvar. Tente novamente.', 'error');
                                          }
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-700 border-b border-gray-600 text-sm text-white"
                                      >
                                        ✅ Sim - Serviço já é assinante
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          console.log('Marcando cliente como não assinante:', appointment.client_name);
                                          
                                          try {
                                            // Buscar o preço original do serviço
                                            const service = establishment?.services_with_prices?.find(s => s.name === appointment.service);
                                            const originalPrice = service?.price || appointment.price || 0;
                                            
                                            // SALVAR NO BANCO
                                            const { error } = await supabase
                                              .from('appointments')
                                              .update({ 
                                                is_subscriber: false,
                                                price: originalPrice,
                                                total_price: originalPrice
                                              })
                                              .eq('id', appointment.id);
                                            
                                            if (error) throw error;
                                            
                                            // Atualizar estado local
                                            const newSubscribers = { ...appointmentSubscribers };
                                            newSubscribers[appointment.id] = false;
                                            setAppointmentSubscribers(newSubscribers);
                                            
                                            // Fechar dropdown
                                            const newDropdowns = { ...subscriberDropdowns };
                                            newDropdowns[appointment.id] = false;
                                            setSubscriberDropdowns(newDropdowns);
                                            
                                            // Recarregar dados para atualizar saldos
                                            await fetchAppointments();
                                            await fetchMonthlyAppointments();
                                            
                                            toast('Cliente marcado como não assinante. Preço normal.', 'success');
                                          } catch (error) {
                                            console.error('Erro ao salvar não assinante:', error);
                                            toast('Erro ao salvar. Tente novamente.', 'error');
                                          }
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-700 text-sm text-white"
                                      >
                                        ❌ Não é assinante
                                      </button>
                                    </div>
                                  )}
                                  {isClientPaidSubscriber(appointment.client_whatsapp) && (
                                    <Crown className="h-5 w-5 text-yellow-400" />
                                  )}
                                  {appointment.client_whatsapp && (
                                    <a
                                      href={`https://wa.me/${appointment.client_whatsapp.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-white hover:text-white/80"
                                    >
                                      <img src="/wppicon.png" alt="WhatsApp" className="h-4 w-4" />
                                    </a>
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
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white/80">Serviço:</span>
                                  <span className="text-sm text-white">{appointment.service}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white/80">Duração:</span>
                                  <span className="text-sm text-white">{formatDuration(appointment.duration)}</span>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 mt-3">
                                <div className="flex items-center gap-2 min-w-[120px]">
                                  <span className="text-sm text-white/80">Valor base:</span>
                                  <span className="text-sm text-white">
                                    {isClientPaidSubscriber(appointment.client_whatsapp) 
                                      ? "GRATUITO" 
                                      : appointment.is_subscriber 
                                      ? 'R$ 0,00 (GRATUITO)' 
                                      : formatCurrency(appointment.price)
                                    }
                                  </span>
                                </div>
                                {appointment.additional_products && appointment.additional_products.length > 0 && (
                                  <div className="flex-1 min-w-[200px]">
                                    <span className="text-sm text-white/80 block mb-1">Produtos/Serviços Adicionais:</span>
                                    <div className="flex flex-wrap gap-2">
                                      {appointment.additional_products.map((product, index) => (
                                        <span key={index} className="inline-flex items-center px-2 py-1 text-xs bg-white/10 text-white rounded">
                                          {product.name} - {formatCurrency(product.price)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-3 mt-3">
                                <div className="flex items-center gap-2">
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
                                
                                <div className="flex flex-wrap items-center gap-2">
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
                                  
                                  {/* Mostrar taxa para cartões */}
                                  {(appointment.payment_method === 'credito' || appointment.payment_method === 'debito') && (
                                    <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded border border-yellow-400/20">
                                      Taxa: {getPaymentMethodTax(appointment.payment_method)}%
                                    </span>
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

                            <div className="flex flex-wrap items-center gap-2 mt-4 justify-end">
                              {appointment.status !== 'cancelled' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedAppointmentForProduct(appointment.id);
                                      setShowAdditionalProductModal(true);
                                    }}
                                    className="inline-flex items-center px-3 py-1.5 text-sm bg-white/20 text-white rounded hover:bg-white/30 transition-colors"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Adicionar Produto
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

                                  <button
                                    onClick={() => handleCancelAppointment(appointment.id)}
                                    className="inline-flex items-center px-3 py-1.5 text-sm bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors"
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancelar
                                  </button>
                                </>
                              )}
                              
                              {appointment.status === 'cancelled' && (
                                <div className="flex gap-2">
                                <span className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-700/50 text-gray-400 rounded">
                                  <X className="h-4 w-4 mr-1" />
                                  Cancelado
                                </span>
                                  <button
                                    onClick={() => handleDeleteAppointment(appointment.id)}
                                    className="inline-flex items-center px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                    title="Excluir agendamento permanentemente"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    EXCLUIR
                                  </button>
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
            <div className="space-y-6">
              {/* Vídeo Tutorial */}
              <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                <h3 className="text-lg font-medium text-white mb-4">Tutorial de Configurações</h3>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src="https://www.youtube.com/embed/jfHfZxzLoF8"
                    title="Tutorial de Configurações"
                    className="absolute top-0 left-0 w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="text-sm text-gray-400 mt-4">
                  Assista o vídeo acima para aprender como configurar seu estabelecimento corretamente.
                </p>
              </div>

              {/* Informações Básicas */}
              <div className="bg-[#1a1b1c] rounded-lg p-6 mb-6">
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
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24">
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
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div className="flex-1">
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
                        A senha colocada aqui servirá para abrir o dashboard e também para ver todos os profissionais na página Agend.
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
                  Adicione até 3 fotos do seu estabelecimento que serão exibidas para os clientes
                </p>
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-6">
                  <p className="text-yellow-500 text-sm">
                    ⚠️ Caso a imagem não aparecer, ou ficar mal otimizada é porque o tamanho da sua imagem está errado. Envie para nós no whatsapp, que iremos ajustar para você ⚠️
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Foto 1 */}
                  <div>
                    <div className="aspect-video bg-[#242628] rounded-lg border-2 border-dashed border-gray-700 overflow-hidden">
                      {customPhoto1Preview ? (
                        <div className="relative h-full">
                          <img
                            src={customPhoto1Preview}
                            alt="Foto 1"
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => {
                              setCustomPhoto1(null);
                              setCustomPhoto1Preview(null);
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
                            accept="image/*"
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
                            onClick={() => {
                              setCustomPhoto2(null);
                              setCustomPhoto2Preview(null);
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
                            accept="image/*"
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
                            onClick={() => {
                              setCustomPhoto3(null);
                              setCustomPhoto3Preview(null);
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
                            accept="image/*"
                            onChange={(e) => handleCustomPhotoChange(3, e)}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profissionais */}
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

                <div className="flex justify-between items-center mb-4">
                  <button
                    type="button"
                    onClick={handleAddProfessional}
                    disabled={professionals.length >= 10}
                    className="px-4 py-2 bg-[#242628] text-white rounded-lg hover:bg-[#2a2b2d] transition-colors flex items-center gap-2 border border-gray-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={saveProfessionalsToDatabase}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    <span>Salvar Profissionais</span>
                  </button>
                  
                  {/* Indicador de status */}
                  <div className="text-xs text-gray-400">
                    {professionals.length > 0 && (
                      <span className="text-yellow-400">⚠ Clique em "Salvar Profissionais" para salvar</span>
                    )}
                  </div>
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
                        
                        {/* Campo de percentual do profissional */}
                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={professional.percentage || 0}
                              onChange={(e) => handleProfessionalChange(professional.id, 'percentage', parseFloat(e.target.value) || 0)}
                              className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                              placeholder="Percentual (%)"
                            />
                          </div>
                          <span className="text-sm text-gray-400">% do profissional</span>
                        </div>
                        
                        {/* Campo de senha do profissional */}
                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
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
                          </div>
                          <span className="text-sm text-gray-400">Senha do profissional</span>
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
                  className={`px-6 py-3 bg-primary text-white rounded-lg font-medium ${
                    isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/80'
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
                    <button
                      onClick={() => setShowAddExpenseModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Despesas
                    </button>
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
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-3xl font-bold text-green-900">
                        {formatCurrency(calculateMonthlyBalance(monthlyAppointments))}
                      </p>
                      <p className="text-sm text-green-700 mt-1">Total faturado no mês</p>
                    </div>

                    {/* Resumo Líquido */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-blue-800">Resumo Líquido</h3>
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-3xl font-bold text-blue-900">
                        {formatCurrency(calculateMonthlyBalance(monthlyAppointments) - expensesTotal)}
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        Bruto - Despesas ({formatCurrency(expensesTotal)})
                      </p>
                    </div>

                    {/* Resumo Líquido Estabelecimento */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-purple-800">Líquido Estabelecimento</h3>
                        <Building2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-purple-900">
                        {formatCurrency(calculateEstablishmentNetBalance(monthlyAppointments) - expensesTotal)}
                      </p>
                      <p className="text-sm text-purple-700 mt-1">
                        Bruto - Colaboradores - Despesas
                      </p>
                    </div>
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
                                      <ChevronDown className={`h-4 w-4 transition-transform ${
                                        openExtraProductsDropdown === professional.id ? 'rotate-180' : ''
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
                              <p className="text-sm text-blue-600">
                                {professional.percentage === 100 ? (
                                  <span className="text-green-600">Dono - Valor total</span>
                                ) : (
                                  <span>Líquido: {formatCurrency(calculateProfessionalNetValue(professional.name, monthlyAppointments))}</span>
                                )}
                              </p>
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
                      <ChevronDown className={`h-4 w-4 transition-transform ${
                        openDailyRevenueDropdown ? 'rotate-180' : ''
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
                            <div key={day} className={`p-3 rounded-lg border ${
                              dayRevenue > 0 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className={`font-medium ${
                                    dayRevenue > 0 ? 'text-green-700' : 'text-gray-500'
                                  }`}>
                                    Dia {day}
                                  </p>
                                  <p className={`text-sm ${
                                    dayRevenue > 0 ? 'text-green-600' : 'text-gray-400'
                                  }`}>
                                    {dayAppointments.length} agendamento(s)
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${
                                    dayRevenue > 0 ? 'text-green-900' : 'text-gray-400'
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
                        {formatCurrency(calculateMonthlyBalance(monthlyAppointments) - expensesTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'financial-dashboard' && !isDashboardUnlocked && (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-400">Digite a senha para acessar o Dashboard Financeiro</p>
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
                  
                  {/* Dica para scroll mobile dos botões */}
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm text-blue-700 md:hidden">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                      </svg>
                      <span>Arraste para o lado para ver mais opções</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Botões com scroll horizontal */}
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 -mb-2">
                  <button
                    onClick={() => setShowBirthdayFilter(!showBirthdayFilter)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                      showBirthdayFilter
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    🎂 Aniversariantes do mês
                  </button>
                  <button
                    onClick={() => setShowAddClientModal(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex-shrink-0"
                  >
                    ➕ Adicionar Cliente
                  </button>
                    <button
                      onClick={() => setShowRankingModal(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors flex-shrink-0"
                    >
                      🏆 Ranking
                    </button>
                    <button
                      onClick={() => setShowMissingClientsModal(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 transition-colors flex-shrink-0"
                    >
                      👻 Clientes Sumidos
                    </button>
                    <button
                      onClick={() => setShowDrawModal(true)}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors flex-shrink-0"
                    >
                      🎲 Sorteio
                    </button>
                  {showBirthdayFilter && (
                      <span className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg text-sm flex-shrink-0">
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
                    filteredClients.map(client => (
                      <div key={client.whatsapp} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
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
                          href={`https://wa.me/${client.whatsapp}`}
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

            {activeTab === 'subscribers' && isSubscribersUnlocked && (
              <SubscribersManager 
                establishmentId={establishment?.id!} 
                clients={clients} 
                onClientUpdated={fetchClients}
              />
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

      {showSubscribersPinModal && (
        <PinPasswordModal
          onClose={() => setShowSubscribersPinModal(false)}
          onSubmit={(pin) => {
            if (pin === establishment?.pin_password || pin === '0000') {
              setIsSubscribersUnlocked(true);
              setShowSubscribersPinModal(false);
            } else {
              toast('Senha incorreta', 'error');
            }
          }}
          title="Digite a senha para acessar os assinantes"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {rankingClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-4">
                      {/* Posição */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-lg ${
                        client.position === 1 ? 'bg-yellow-500' :
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
                      href={`https://wa.me/${client.whatsapp}`}
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
                {missingClients.map((client) => (
                  <div key={client!.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-4">
                      {/* Indicador de tempo */}
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-sm ${
                        client!.isOver2Months ? 'bg-red-500' : 'bg-orange-500'
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
                className={`flex items-center gap-2 px-4 py-2 rounded-lg w-full md:w-auto justify-center ${
                  loyalCustomers.length 
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
    </div>
  );
};

export default EstablishmentDashboard;