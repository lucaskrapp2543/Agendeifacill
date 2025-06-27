import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, startOfMonth, endOfMonth, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, LogOut, Scissors, Star, Copy, CheckCircle, Image as ImageIcon, Plus, Trash2, DollarSign, Settings, ChevronLeft, ChevronRight, Check, Crown, Phone, MessageSquare, CreditCard } from 'lucide-react';
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
  services_with_prices: Service[];
  profile_image_url?: string;
  affiliate_link?: string;
  custom_photo_1_url?: string;
  custom_photo_2_url?: string;
  custom_photo_3_url?: string;
  pix_key_type?: string;
  pix_key?: string;
}

type TabType = 'appointments' | 'services' | 'settings' | 'available-times';

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

  const handleAddProfessional = () => {
    if (professionals.length >= 10) {
      toast('Limite máximo de 10 profissionais atingido', 'warning');
      return;
    }
    const newProfessional = {
      id: Math.random().toString(36).substring(2),
      name: '',
      specialties: []
    };
    console.log('Adicionando profissional:', newProfessional);
    setProfessionals(prev => [...prev, newProfessional]);
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
          pix_proof_url
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
          services_with_prices: establishmentData.services_with_prices || [],
          profile_image_url: establishmentData.profile_image_url,
          affiliate_link: establishmentData.affiliate_link,
          custom_photo_1_url: establishmentData.custom_photo_1_url,
          custom_photo_2_url: establishmentData.custom_photo_2_url,
          custom_photo_3_url: establishmentData.custom_photo_3_url,
          pix_key_type: establishmentData.pix_key_type,
          pix_key: establishmentData.pix_key
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
    return appointments
      .filter(appointment => appointment.status !== 'cancelled')
      .reduce((total, appointment) => total + (appointment.price || 0), 0);
  };

  const calculateMonthlyBalance = (appointments: Appointment[]): number => {
    return appointments
      .filter(appointment => appointment.status !== 'cancelled')
      .reduce((total, appointment) => total + (appointment.price || 0), 0);
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
    <div className="min-h-screen bg-background">
      <div className="container-custom py-8">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
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
                    onClick={() => setActiveTab('settings')}
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
                          setSelectedProfessional('all');
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
                            setSelectedProfessional(professional.id);
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
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-left">
                  <p className="text-lg font-medium text-white">
                    Hoje: R$ {calculateDailyBalance(filteredAppointments).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-400">
                    Este mês: R$ {calculateMonthlyBalance(monthlyAppointments).toFixed(2)}
                  </p>
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
                  <div className="space-y-4">
                    {filteredAppointments.map(appointment => (
                      <div key={appointment.id} className="p-4 rounded-lg bg-[#242628] border border-gray-800">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-white">{appointment.client_name}</span>
                            </div>
                            {appointment.client_whatsapp && (
                              <a 
                                href={`https://wa.me/55${appointment.client_whatsapp}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors"
                              >
                                <Phone className="h-4 w-4" />
                                {appointment.client_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                              </a>
                            )}
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Scissors className="h-4 w-4" />
                              {appointment.service}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Clock className="h-4 w-4" />
                              {appointment.appointment_time}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            {/* Dropdown de forma de pagamento */}
                            {appointment.status !== 'cancelled' && (
                              <div className="flex flex-col gap-1">
                                <select
                                  value={appointment.payment_method || 'pendente'}
                                  onChange={(e) => handlePaymentMethodChange(appointment.id, e.target.value)}
                                  className={`text-xs px-3 py-2 border-2 rounded-lg font-medium shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                                    appointment.payment_method === 'pix' ? 'bg-green-100 border-green-300 text-green-800' :
                                    appointment.payment_method === 'credito' ? 'bg-blue-100 border-blue-300 text-blue-800' :
                                    appointment.payment_method === 'debito' ? 'bg-purple-100 border-purple-300 text-purple-800' :
                                    appointment.payment_method === 'dinheiro' ? 'bg-yellow-100 border-yellow-300 text-yellow-800' :
                                    appointment.payment_method === 'pagar_local' ? 'bg-orange-100 border-orange-300 text-orange-800' :
                                    'bg-gray-100 border-gray-300 text-gray-800'
                                  }`}
                                >
                                  <option value="pendente">⏳ Pendente</option>
                                  <option value="pix">🟢 PIX</option>
                                  <option value="credito">🔵 Crédito</option>
                                  <option value="debito">🟣 Débito</option>
                                  <option value="dinheiro">🟡 Dinheiro</option>
                                  <option value="pagar_local">🏪 Pagar no Local</option>
                                </select>
                              </div>
                            )}
                            
                            {/* Status cancelado */}
                            {appointment.status === 'cancelled' && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-500/10 text-red-500">
                                Cancelado
                            </span>
                            )}
                            
                            {appointment.status === 'pending' && (
                              <button
                                onClick={() => handleCancelAppointment(appointment.id)}
                                className="btn-outline text-sm py-1"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Detalhes do Pagamento PIX */}
                        {appointment.payment_method === 'pix' && (
                          <div className="mt-4 p-4 bg-[#242628] rounded-lg border border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-400">Status do Pagamento:</span>
                              <select
                                value={appointment.pix_payment_status || 'pendente'}
                                onChange={(e) => handlePixPaymentStatusChange(appointment.id, e.target.value)}
                                className={`text-xs px-3 py-2 border-2 rounded-lg font-medium shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary ${
                                  appointment.pix_payment_status === 'confirmado' ? 'bg-green-100 border-green-300 text-green-800' :
                                  appointment.pix_payment_status === 'enviado' ? 'bg-yellow-100 border-yellow-300 text-yellow-800' :
                                  appointment.pix_payment_status === 'rejeitado' ? 'bg-red-100 border-red-300 text-red-800' :
                                  'bg-gray-100 border-gray-300 text-gray-800'
                                }`}
                              >
                                <option value="pendente">⏳ Pendente</option>
                                <option value="enviado">📤 Enviado</option>
                                <option value="confirmado">✅ Confirmado</option>
                                <option value="rejeitado">❌ Rejeitado</option>
                              </select>
                            </div>

                            {appointment.pix_proof_url && (
                              <div className="mt-2">
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                  Comprovante
                                </label>
                                <div className="relative">
                                  <img
                                    src={appointment.pix_proof_url}
                                    alt="Comprovante PIX"
                                    className="w-full max-w-xs rounded-lg border border-gray-700"
                                  />
                                  <a
                                    href={appointment.pix_proof_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-5 w-5 text-white"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                    >
                                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                    </svg>
                                  </a>
                                </div>
                              </div>
                            )}
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
                {/* ... existing code ... */}
              </div>
            )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800">
                <h3 className="text-lg font-medium text-white mb-4">Informações Básicas</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Nome do Estabelecimento
                    </label>
                    <input
                      type="text"
                      value={establishmentName}
                      onChange={(e) => setEstablishmentName(e.target.value)}
                      className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Nome do seu estabelecimento"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Descrição
                    </label>
                    <textarea
                      value={establishmentDescription}
                      onChange={(e) => setEstablishmentDescription(e.target.value)}
                      className="w-full px-4 py-2 bg-[#242628] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Descreva seu estabelecimento"
                      rows={3}
                    />
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
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-white">Profissionais</h3>
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
                
                <div className="space-y-4">
                  {professionals.map((professional) => (
                    <div key={professional.id} className="bg-[#242628] p-4 rounded-lg space-y-3 border border-gray-700">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={professional.name}
                            onChange={(e) => handleProfessionalChange(professional.id, 'name', e.target.value)}
                            className="w-full px-4 py-2 bg-[#1a1b1c] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="Nome do profissional"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProfessional(professional.id)}
                          className="ml-2 text-red-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
    </div>
  );
};

export default EstablishmentDashboard;