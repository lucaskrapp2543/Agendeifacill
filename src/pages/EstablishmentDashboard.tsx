import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, startOfMonth, endOfMonth, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, LogOut, Scissors, Star, Copy, CheckCircle, Image as ImageIcon, Plus, Trash2, DollarSign, Settings, ChevronLeft, ChevronRight, Check, Crown, Phone, MessageSquare, CreditCard, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { supabase } from '../lib/supabase';
import { getEstablishmentAppointments, createEstablishment, updateEstablishment, getEstablishmentPremiumSubscribers, removePremiumSubscriber } from '../lib/supabase';
import { ServiceForm } from '../components/ServiceForm';
import { DurationSelector } from '../components/DurationSelector';
import { TimeSelector } from '../components/TimeSelector';
import { AvailableTimesViewer } from '../components/AvailableTimesViewer';
import { EstablishmentPixSettings } from '../components/EstablishmentPixSettings';
import { v4 as uuidv4 } from 'uuid';
import LoyalCustomers from '../components/LoyalCustomers';
import PinPasswordModal from '../components/PinPasswordModal';
import ProfessionalPinModal from '../components/ProfessionalPinModal';
import AdditionalProductModal from '../components/AdditionalProductModal';

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
}

type TabType = 'appointments' | 'services' | 'settings' | 'available-times' | 'premium-clients';

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
  payment_method?: string;
  pix_payment_status?: string;
  pix_proof_url?: string;
  additional_products?: AdditionalProduct[];
  total_price?: number;
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

const EstablishmentDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados básicos
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [isEstablishmentLoading, setIsEstablishmentLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  
  // Estados do formulário
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentDescription, setEstablishmentDescription] = useState('');
  const [establishmentCode, setEstablishmentCode] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [pixKeyType, setPixKeyType] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');
  
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

  // Estados de agendamentos
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [monthlyAppointments, setMonthlyAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('todos');

  // Estados premium
  const [premiumSubscribers, setPremiumSubscribers] = useState<PremiumSubscriber[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pinPassword, setPinPassword] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [isConfigUnlocked, setIsConfigUnlocked] = useState(false);

  // Estados para o modal de senha do profissional
  const [showProfessionalPinModal, setShowProfessionalPinModal] = useState(false);
  const [selectedProfessionalForPin, setSelectedProfessionalForPin] = useState<string | null>(null);
  const [tempSelectedProfessional, setTempSelectedProfessional] = useState<string | null>(null);

  // Estado para controlar os valores dos inputs de senha
  const [professionalPins, setProfessionalPins] = useState<Record<string, string>>({});

  // Estado para controlar o modal de produtos adicionais
  const [showAdditionalProductModal, setShowAdditionalProductModal] = useState(false);
  const [selectedAppointmentForProduct, setSelectedAppointmentForProduct] = useState<string | null>(null);

  // Novo estado para controlar o modal do comprovante
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);

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

  const generateRandomCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setEstablishmentCode(code);
  };

  useEffect(() => {
    if (!establishmentCode) {
      generateRandomCode();
    }
  }, []);

  const handlePreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value) return;
    setSelectedDate(new Date(value));
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
      specialties: []
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

  const handleProfessionalChange = (id: string, field: keyof Professional, value: string | string[]) => {
    console.log('Atualizando profissional:', { id, field, value });
    setProfessionals(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
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
          specialties: p.specialties.filter(s => s.trim())
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
          name: p.name.trim()
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

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) {
        throw error;
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

  const handleDrawWinners = async () => {
    if (!establishment) return;
    
    setIsDrawing(true);
    try {
      // Filtra os assinantes que ainda não são vencedores
      const eligibleSubscribers = premiumSubscribers.filter(sub => !sub.is_winner);
      
      if (eligibleSubscribers.length === 0) {
        toast('Não há assinantes elegíveis para o sorteio', 'warning');
        return;
      }

      // Sorteia 3 vencedores aleatoriamente
      const winners = [];
      const subscribersCopy = [...eligibleSubscribers];
      
      for (let i = 0; i < 3 && subscribersCopy.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * subscribersCopy.length);
        const winner = subscribersCopy.splice(randomIndex, 1)[0];
        winners.push({ ...winner, winner_position: i + 1 });
      }

      // Atualiza os vencedores no banco de dados
      for (const winner of winners) {
        const { error } = await supabase
          .from('premium_subscribers')
          .update({
            is_winner: true,
            winner_position: winner.winner_position,
            last_draw_date: new Date().toISOString()
          })
          .eq('id', winner.id);

        if (error) {
          console.error('Erro ao atualizar vencedor:', error);
          throw error;
        }
      }

      // Atualiza a lista de assinantes
      await fetchPremiumSubscribers();
      
      toast('Sorteio realizado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao realizar sorteio:', error);
      toast('Erro ao realizar sorteio', 'error');
    } finally {
      setIsDrawing(false);
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
        .order('appointment_time', { ascending: true });

      if (error) throw error;
      
      setAppointments(data as Appointment[] || []);
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      toast(error.message || 'Erro ao carregar agendamentos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyAppointments = async () => {
    if (!establishment) return;

    try {
      // Formatar as datas para YYYY-MM-DD para garantir consistência
      const startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) {
        throw error;
      }

      setMonthlyAppointments(appointmentsData || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos mensais:', error);
      toast('Erro ao buscar agendamentos mensais', 'error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const { data: establishmentData, error: establishmentError } = await supabase
          .from('establishments')
          .select('*')
          .eq('owner_id', user.id)
          .single();

        if (establishmentError) {
          throw establishmentError;
        }

        if (!establishmentData) {
          setIsEstablishmentLoading(false);
          return;
        }

        const establishment: Establishment = {
          id: establishmentData.id,
          name: establishmentData.name,
          description: establishmentData.description,
          code: establishmentData.code,
          owner_id: establishmentData.owner_id,
          business_hours: migrateBusinessHours(establishmentData.business_hours),
          professionals: establishmentData.professionals || [],
          professionals_pins: establishmentData.professionals_pins || [],
          services_with_prices: establishmentData.services_with_prices || [],
          profile_image_url: establishmentData.profile_image_url,
          affiliate_link: establishmentData.affiliate_link,
          custom_photo_1_url: establishmentData.custom_photo_1_url,
          custom_photo_2_url: establishmentData.custom_photo_2_url,
          custom_photo_3_url: establishmentData.custom_photo_3_url,
          pix_key_type: establishmentData.pix_key_type,
          pix_key: establishmentData.pix_key,
          pin_password: establishmentData.pin_password,
        };

        setEstablishment(establishment);
        setEstablishmentName(establishment.name);
        setEstablishmentDescription(establishment.description);
        setEstablishmentCode(establishment.code);
        setAffiliateLink(establishment.affiliate_link || '');
        setPixKeyType(establishment.pix_key_type || '');
        setPixKey(establishment.pix_key || '');
        setBusinessHours(establishment.business_hours);
        setProfessionals(establishment.professionals);
        setServicesWithPrices(establishment.services_with_prices);

        await Promise.all([
          fetchAppointments(),
          fetchMonthlyAppointments(),
          fetchPremiumSubscribers()
        ]);
      } catch (error) {
        console.error('Error fetching establishment:', error);
        toast('Erro ao carregar estabelecimento', 'error');
      } finally {
        setIsEstablishmentLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (establishment && activeTab === 'premium-clients') {
      fetchPremiumSubscribers();
    }
  }, [establishment, activeTab]);

  useEffect(() => {
    if (establishment) {
      fetchAppointments();
      fetchMonthlyAppointments();
    }
  }, [establishment, selectedDate]);

  const calculateDailyBalance = (appointments: Appointment[]): number => {
    return appointments.reduce((total, appointment) => {
      if (appointment.status !== 'cancelled') {
        return total + (appointment.total_price || appointment.price || 0);
      }
      return total;
    }, 0);
  };

  const calculateMonthlyBalance = (appointments: Appointment[]): number => {
    return appointments.reduce((total, appointment) => {
      if (appointment.status !== 'cancelled') {
        return total + (appointment.total_price || appointment.price || 0);
      }
      return total;
    }, 0);
  };

  // Filtrar agendamentos por profissional e forma de pagamento selecionados
  const filteredAppointments = appointments.filter(appointment => {
    const isProfessionalMatch = selectedProfessional === 'all' || appointment.professional === selectedProfessional;
    const isPaymentMethodMatch = selectedPaymentMethod === 'todos' || (appointment.payment_method || 'pendente') === selectedPaymentMethod;
    return isProfessionalMatch && isPaymentMethodMatch;
  });

  // Função para obter o nome do profissional pelo ID
  const getProfessionalName = (professionalId: string): string => {
    const professional = professionals.find(p => p.id === professionalId);
    return professional?.name || 'Profissional não encontrado';
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
      const { error } = await supabase
        .from('establishments')
        .update({
          pix_key: pixKey,
          pix_key_type: pixType
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

  // Função para salvar a senha
  const handleSavePin = async () => {
    if (!establishment) return;
    
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ pin_password: pinPassword })
        .eq('id', establishment.id);

      if (error) throw error;
      
      // Atualiza os dados do estabelecimento localmente
      setEstablishment({
        ...establishment,
        pin_password: pinPassword
      });
      
      toast.success('Senha salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar senha:', error);
      toast.error('Erro ao salvar senha');
    }
  };

  // Função para validar a senha
  const handleValidatePin = async (enteredPin: string) => {
    const MASTER_PIN = '2543';
    if (enteredPin === MASTER_PIN || enteredPin === establishment?.pin_password) {
      setIsConfigUnlocked(true);
      setShowPinModal(false);
      setShowConfigModal(true);
      setActiveTab('settings');
    } else {
      toast.error('Senha incorreta');
    }
  };

  // Função para abrir configurações
  const handleOpenConfig = () => {
    if (establishment?.pin_password) {
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
      if (enteredPin === establishment.pin_password || enteredPin === '2543') {
        setSelectedProfessional(tempSelectedProfessional);
        setShowProfessionalPinModal(false);
        setTempSelectedProfessional(null);
      } else {
        toast.error('Senha incorreta');
      }
      return;
    }

    // Encontra o pin do profissional selecionado
    const professionalPin = establishment.professionals_pins?.find(
      p => p.professional_id === tempSelectedProfessional
    );

    // Se não tem senha definida, usa a senha padrão '0000'
    const correctPin = professionalPin?.pin || '0000';

    if (enteredPin === correctPin || enteredPin === '2543') {
      setSelectedProfessional(tempSelectedProfessional);
      setShowProfessionalPinModal(false);
      setTempSelectedProfessional(null);
    } else {
      toast.error('Senha incorreta');
    }
  };

  // Função para mudar o profissional selecionado
  const handleProfessionalSelect = (professionalId: string) => {
    setTempSelectedProfessional(professionalId);
    
    // Se for "Todos profissionais" e tiver senha nas configurações
    if (professionalId === 'all') {
      if (establishment?.pin_password) {
        setShowProfessionalPinModal(true);
      } else {
        setSelectedProfessional(professionalId);
      }
    } else {
      // Se for um profissional específico, sempre pede senha
      // (se não tiver senha definida, usa a senha padrão '0000')
      setShowProfessionalPinModal(true);
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

  // Adicione antes do return principal
  const handleOpenProof = (url: string) => {
    setSelectedProofUrl(url);
    setShowProofModal(true);
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
      <div className="min-h-screen bg-background">
        <div className="container-custom py-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Criar Novo Estabelecimento</h2>
            <p className="text-gray-400 mb-8">
              Você ainda não tem um estabelecimento cadastrado. Preencha o formulário abaixo para criar seu primeiro estabelecimento.
              </p>
            <form onSubmit={handleCreateEstablishment} className="space-y-6">
                <div>
                <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
                  Nome do Estabelecimento
                  </label>
                  <input
                    type="text"
                  id="name"
                    value={establishmentName}
                    onChange={(e) => setEstablishmentName(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Barbearia do João"
                    required
                  />
                </div>

                <div>
                <label htmlFor="description" className="block text-sm font-medium text-white mb-2">
                  Descrição
                  </label>
                <textarea
                  id="description"
                  value={establishmentDescription}
                  onChange={(e) => setEstablishmentDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Descreva seu estabelecimento..."
                  rows={4}
                />
              </div>

              <div>
                <label htmlFor="code" className="block text-sm font-medium text-white mb-2">
                  Código do Estabelecimento
                </label>
                <div className="flex gap-2">
                    <input
                      type="text"
                    id="code"
                      value={establishmentCode}
                    onChange={(e) => setEstablishmentCode(e.target.value)}
                    className="flex-1 px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Ex: 1234"
                      maxLength={4}
                      required
                    />
                    <button
                      type="button"
                      onClick={generateRandomCode}
                    className="px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white hover:bg-[#242628] transition-colors"
                    >
                    Gerar Código
                    </button>
                  </div>
                <p className="mt-1 text-sm text-gray-400">
                  Este código será usado para acessar a página do seu estabelecimento
                  </p>
                </div>
                
                <div>
                <label htmlFor="profile_image" className="block text-sm font-medium text-white mb-2">
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
                    <div className="px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white hover:bg-[#242628] transition-colors text-center">
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
                <h3 className="text-lg font-medium text-white mb-4">Profissionais</h3>
              <div className="space-y-4">
                  {professionals.map((professional, index) => (
                    <div key={professional.id} className="flex gap-4 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={professional.name}
                            onChange={(e) => handleProfessionalChange(professional.id, 'name', e.target.value)}
                          className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white hover:bg-[#242628] transition-colors"
                  >
                    <Plus className="h-5 w-5 inline-block mr-2" />
                    Adicionar Profissional
                  </button>
                </div>
                </div>
                
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Serviços</h3>
                <div className="space-y-4">
                  {servicesWithPrices.map((service, index) => (
                    <div key={service.id} className="flex gap-4 items-start">
                      <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={service.name}
                            onChange={(e) => handleServiceChange(service.id, 'name', e.target.value)}
                          className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={`Nome do Serviço ${index + 1}`}
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                          <input
                            type="number"
                            value={service.price}
                              onChange={(e) => handleServiceChange(service.id, 'price', parseFloat(e.target.value))}
                              className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container-custom py-4 px-2 sm:py-8 sm:px-4 max-w-full">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">{establishment.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-400">Código:</span>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{establishment.code}</span>
                <button
                  onClick={copyCodeToClipboard}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Copiar código"
                >
                  {codeCopied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

              <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveTab('appointments')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === 'appointments'
                        ? 'bg-primary text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Calendar className="h-5 w-5" />
                    <span className="hidden sm:inline">Agend.</span>
                  </button>

                  <div
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-500 cursor-not-allowed opacity-50"
                    title="Em breve"
                  >
                    <Clock className="h-5 w-5" />
                    <span className="hidden sm:inline">Horários</span>
                  </div>

                  <button
                    onClick={() => setActiveTab('services')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === 'services'
                        ? 'bg-primary text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Calendar className="h-5 w-5" />
                    <span className="hidden sm:inline">SEUS LINKS</span>
                  </button>

                  <button
                    onClick={handleOpenConfig}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === 'settings'
                        ? 'bg-primary text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Settings className="h-5 w-5" />
                    <span className="hidden sm:inline">Config.</span>
                  </button>

                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors rounded-lg"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                </div>
              </div>

        {/* Conteúdo Principal */}
        <div className="space-y-6">
          {/* Tab de Horários Disponíveis */}
          {activeTab === 'available-times' && establishment && (
            <AvailableTimesViewer
              establishment={establishment}
              existingAppointments={appointments}
            />
          )}

          {/* Outros tabs existentes */}
            {activeTab === 'appointments' && (
              <>
                {/* Seleção de Profissionais */}
                {establishment?.professionals && establishment.professionals.length > 0 && (
                  <div className="mb-6 bg-[#1a1b1c] rounded-lg p-4 border border-gray-800">
                    <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Filtrar por Profissional
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          handleProfessionalSelect('all');
                          setSelectedPaymentMethod('todos');
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedProfessional === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                        }`}
                      >
                        👥 Todos os Profissionais
                      </button>
                      {establishment.professionals.map((professional) => (
                        <button
                          key={professional.id}
                          onClick={() => {
                            handleProfessionalSelect(professional.id);
                            setSelectedPaymentMethod('todos');
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            selectedProfessional === professional.id
                              ? 'bg-primary text-white'
                              : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                          }`}
                        >
                          👤 {professional.name}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <p className="text-gray-400">
                        Filtro ativo: <span className="text-primary font-medium">{getProfessionalName(selectedProfessional)}</span>
                      </p>
                      <p className="text-gray-400">
                        {selectedProfessional === 'all' ? filteredAppointments.length : filteredAppointments.length} agendamentos encontrados
                      </p>
                    </div>
                  </div>
                )}

                {/* Filtros por Forma de Pagamento */}
                <div className="mb-6 bg-[#1a1b1c] rounded-lg p-4 border border-gray-800">
                  <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Filtrar por Forma de Pagamento
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedPaymentMethod('todos')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'todos'
                          ? 'bg-primary text-white'
                          : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                      }`}
                    >
                      💳 Todos
                    </button>
                    <button
                      onClick={() => setSelectedPaymentMethod('pendente')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'pendente'
                          ? 'bg-gray-500 text-white'
                          : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                      }`}
                    >
                      ⏳ Pendente
                    </button>
                    <button
                      onClick={() => setSelectedPaymentMethod('pix')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'pix'
                          ? 'bg-green-500 text-white'
                          : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                      }`}
                    >
                      🟢 PIX
                    </button>
                    <button
                      onClick={() => setSelectedPaymentMethod('credito')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'credito'
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                      }`}
                    >
                      🔵 Crédito
                    </button>
                    <button
                      onClick={() => setSelectedPaymentMethod('debito')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'debito'
                          ? 'bg-purple-500 text-white'
                          : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                      }`}
                    >
                      🟣 Débito
                    </button>
                    <button
                      onClick={() => setSelectedPaymentMethod('dinheiro')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'dinheiro'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                      }`}
                    >
                      🟡 Dinheiro
                    </button>
                    <button
                      onClick={() => setSelectedPaymentMethod('pagar_local')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedPaymentMethod === 'pagar_local'
                          ? 'bg-orange-500 text-white'
                          : 'bg-[#242628] text-gray-300 hover:bg-[#2a2b2d] border border-gray-700'
                      }`}
                    >
                      🏪 Pagar no Local
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <p className="text-gray-400">
                      Filtro de pagamento: <span className="text-primary font-medium">
                        {selectedPaymentMethod === 'todos' ? 'Todos os tipos' :
                         selectedPaymentMethod === 'pendente' ? 'Pendente' :
                         selectedPaymentMethod === 'pix' ? 'PIX' :
                         selectedPaymentMethod === 'credito' ? 'Crédito' :
                         selectedPaymentMethod === 'debito' ? 'Débito' :
                         selectedPaymentMethod === 'dinheiro' ? 'Dinheiro' :
                         selectedPaymentMethod === 'pagar_local' ? 'Pagar no Local' : 'Todos'}
                      </span>
                    </p>
                    <p className="text-gray-400">
                      {filteredAppointments.length} agendamentos encontrados
                    </p>
                  </div>
                </div>

              <div className="mb-4">
                <h2 className="text-2xl font-bold text-white mb-2">Agendamentos do Dia</h2>
                <p className="text-gray-400 mb-3">
                  {selectedProfessional === 'all' ? 'Todos os profissionais' : `Profissional: ${getProfessionalName(selectedProfessional)}`}
                </p>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <span className="text-green-500 font-medium text-lg">
                      Hoje: {formatCurrency(calculateDailyBalance(filteredAppointments))}
                    </span>
                    <span className="text-blue-500 font-medium text-lg">
                      Este mês: {formatCurrency(calculateMonthlyBalance(monthlyAppointments))}
                    </span>
                  </div>
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
                    className="input-field bg-[#242628] border-gray-800 text-white"
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
                  <div className="space-y-4 mt-4 w-full max-w-[100vw] overflow-x-hidden">
                    {filteredAppointments.map((appointment) => (
                      <div key={appointment.id} className="bg-[#242628] rounded-lg p-3 sm:p-4 w-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-2">
                          <div className="flex flex-col gap-1 flex-grow min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white truncate">{appointment.client_name}</span>
                              {appointment.client_whatsapp && (
                                <a
                                  href={`https://wa.me/${appointment.client_whatsapp.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-green-500 hover:text-green-400"
                                >
                                  <Phone className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
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
                            <Crown className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>

                        <div className="flex flex-col w-full mt-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">Serviço:</span>
                              <span className="text-sm text-white">{appointment.service}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">Duração:</span>
                              <span className="text-sm text-white">{formatDuration(appointment.duration)}</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-3">
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <span className="text-sm text-gray-400">Valor base:</span>
                              <span className="text-sm text-white">{formatCurrency(appointment.price)}</span>
                            </div>
                            {appointment.additional_products && appointment.additional_products.length > 0 && (
                              <div className="flex-1 min-w-[200px]">
                                <span className="text-sm text-gray-400 block mb-1">Produtos/Serviços Adicionais:</span>
                                <div className="flex flex-wrap gap-2">
                                  {appointment.additional_products.map((product, index) => (
                                    <span key={index} className="inline-flex items-center px-2 py-1 text-xs bg-gray-800 text-gray-300 rounded">
                                      {product.name} - {formatCurrency(product.price)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 mt-3">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">Total:</span>
                              <span className="text-sm font-medium text-white">{formatCurrency(appointment.total_price || appointment.price)}</span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={appointment.payment_method || 'pendente'}
                                onChange={(e) => handlePaymentMethodChange(appointment.id, e.target.value)}
                                className="bg-[#1a1b1c] text-white text-sm rounded px-2 py-1 border border-gray-700"
                              >
                                <option value="pendente">Forma de Pagamento</option>
                                <option value="pix">PIX</option>
                                <option value="credito">Cartão de Crédito</option>
                                <option value="debito">Cartão de Débito</option>
                                <option value="dinheiro">Dinheiro</option>
                                <option value="pagar_local">Pagar no Local</option>
                              </select>
                              
                              {appointment.payment_method === 'pix' && (
                                <select
                                  value={appointment.pix_payment_status || 'pending'}
                                  onChange={(e) => handlePixPaymentStatusChange(appointment.id, e.target.value)}
                                  className="bg-[#1a1b1c] text-white text-sm rounded px-2 py-1 border border-gray-700"
                                >
                                  <option value="pending">Aguardando PIX</option>
                                  <option value="confirmed">PIX Confirmado</option>
                                  <option value="rejected">PIX Rejeitado</option>
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
                                className="inline-flex items-center px-3 py-1.5 text-sm bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
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
                            <span className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-700/50 text-gray-400 rounded">
                              <X className="h-4 w-4 mr-1" />
                              Cancelado
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'services' && (
              <div className="space-y-6">
                {/* ... existing code ... */}
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
                    <label className="block text-sm font-medium mb-1">Senha de 4 dígitos para configurações</label>
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
                <p className="text-sm text-gray-400 mb-6">
                  Adicione até 3 fotos do seu estabelecimento que serão exibidas para os clientes
                </p>
                
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
                </div>
                
                {/* Lista de Profissionais */}
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
                      
                      {/* Campo de senha do profissional */}
                      <div className="flex gap-2 items-center">
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

              {/* Sistema de Clientes Fiéis */}
              <LoyalCustomers establishmentId={establishment.id} />

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
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-3 rounded-md text-xs transition-colors duration-200"
                    onClick={copyLinkToClipboard}
                    title="Copiar link para compartilhar"
                  >
                    Copiar Link
                  </button>
                </div>
                <p className="text-sm text-gray-400">
                  Clique em "Reservar Cliente" para acessar a página de agendamentos. Você pode fazer reservas para seus clientes através desta página.
                </p>
              </div>
            )}
        </div>
      </div>

      {/* Modal de Senha */}
      <PinPasswordModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onValidate={handleValidatePin}
      />

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
    </div>
  );
};

export default EstablishmentDashboard;