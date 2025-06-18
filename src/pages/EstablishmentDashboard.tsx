import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, startOfMonth, endOfMonth, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, LogOut, Scissors, Star, Copy, CheckCircle, Image as ImageIcon, Plus, Trash2, DollarSign, Settings, ChevronLeft, ChevronRight, Check, Crown, Phone, MessageSquare, CreditCard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { getEstablishmentAppointments, createEstablishment, updateEstablishment, getEstablishmentPremiumSubscribers, removePremiumSubscriber } from '../lib/supabase';
import { ServiceForm } from '../components/ServiceForm';
import { DurationSelector } from '../components/DurationSelector';
import { TimeSelector } from '../components/TimeSelector';
import { AvailableTimesViewer } from '../components/AvailableTimesViewer';

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
}

type TabType = 'appointments' | 'services' | 'settings' | 'premium-clients' | 'available-times';

interface Appointment {
  id: string;
  client_id: string;
  client_name: string;
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
}

interface PremiumClient {
  id: string;
  premium_user_id: string;
  establishment_id: string;
  client_name: string;
  client_phone: string;
  created_at: string;
}

const EstablishmentDashboard = () => {
  const { user, signOut } = useAuth();

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
    monday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    tuesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    wednesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    thursday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    friday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
    saturday: { enabled: false, open1: '09:00', close1: '18:00', open2: null, close2: null },
    sunday: { enabled: false, open1: '09:00', close1: '18:00', open2: null, close2: null }
  });
  
  const [professionals, setProfessionals] = useState<Professional[]>([{
    id: '1',
    name: 'Profissional 1',
    specialties: ['Corte', 'Barba']
  }]);
  
  const [servicesWithPrices, setServicesWithPrices] = useState<Service[]>([{
    id: '1',
    name: 'Corte',
    price: 25,
    duration: 30
  }, {
    id: '2',
    name: 'Barba',
    price: 15,
    duration: 20
  }]);

  // Estados de agendamentos
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [monthlyAppointments, setMonthlyAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('todos');

  // Estados premium
  const [premiumSubscribers, setPremiumSubscribers] = useState<any[]>([]);
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
        toast.error('A imagem deve ter no máximo 5MB');
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
        toast.error('A imagem deve ter no máximo 5MB');
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
      toast.error('Limite máximo de 10 profissionais atingido');
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
        custom_photo_3: customPhoto3
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
          window.location.href = '/dashboard/establishment';
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
        custom_photo_3: customPhoto3
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

      if (error) throw error;

      toast.success('Agendamento cancelado com sucesso');
      fetchAppointments();
      fetchMonthlyAppointments();
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      toast.error(error.message || 'Erro ao cancelar agendamento');
    }
  };

  const handlePaymentMethodChange = async (appointmentId: string, paymentMethod: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ payment_method: paymentMethod })
        .eq('id', appointmentId);

      if (error) throw error;

      setAppointments(prev => prev.map(appointment => 
        appointment.id === appointmentId 
          ? { ...appointment, payment_method: paymentMethod }
          : appointment
      ));

      const paymentLabels: { [key: string]: string } = {
        'pix': 'PIX',
        'credito': 'Cartão de Crédito',
        'debito': 'Cartão de Débito',
        'dinheiro': 'Dinheiro',
        'pendente': 'Pendente'
      };

      toast.success(`Forma de pagamento atualizada para ${paymentLabels[paymentMethod]}!`);
    } catch (error: any) {
      console.error('Erro ao atualizar forma de pagamento:', error);
      toast.error('Erro ao atualizar forma de pagamento');
    }
  };

  const fetchPremiumSubscribers = async () => {
    if (!establishment) {
      console.log('Estabelecimento não encontrado');
      return;
    }
    
    setIsLoadingSubscribers(true);
    
    try {
      const { data, error } = await getEstablishmentPremiumSubscribers(establishment.id);
      
      if (error) {
        console.error('Erro ao buscar assinantes premium:', error);
        throw error;
      }
      
      setPremiumSubscribers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching premium subscribers:', error);
      toast.error(error.message || 'Erro ao carregar assinantes premium');
    } finally {
      setIsLoadingSubscribers(false);
    }
  };

  const handleDrawWinners = async () => {
    if (!establishment) return;
    
    if (premiumSubscribers.length < 20) {
      toast.error('É necessário ter pelo menos 20 assinantes premium para realizar o sorteio');
      return;
    }

    setIsDrawing(true);

    try {
      // Resetar vencedores anteriores
      const resetPromises = premiumSubscribers
        .filter(sub => sub.is_winner)
        .map(sub => supabase
          .from('premium_subscriptions')
          .update({
            is_winner: false,
            winner_position: null,
            last_draw_date: null
          })
          .eq('id', sub.id)
        );

      await Promise.all(resetPromises);

      // Aguardar um momento para garantir que os resets foram aplicados
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verificar se os resets foram aplicados corretamente
      const { data: resetSubscribers, error: resetError } = await getEstablishmentPremiumSubscribers(establishment.id);
      
      if (resetError) {
        throw resetError;
      }

      const resetWinners = resetSubscribers?.filter(sub => sub.is_winner);
      if (resetWinners && resetWinners.length > 0) {
        throw new Error('Erro ao resetar vencedores anteriores');
      }

      // Selecionar 2 vencedores aleatórios
      const eligibleSubscribers = [...premiumSubscribers];
      const winners = [];
      
      for (let i = 0; i < 2; i++) {
        const randomIndex = Math.floor(Math.random() * eligibleSubscribers.length);
        const winner = eligibleSubscribers.splice(randomIndex, 1)[0];
        winners.push({
          ...winner,
          is_winner: true,
          winner_position: i + 1,
          last_draw_date: new Date().toISOString()
        });
      }

      // Atualizar vencedores um por um
      for (const winner of winners) {
        const { error: updateError } = await supabase
          .from('premium_subscriptions')
          .update({
            is_winner: winner.is_winner,
            winner_position: winner.winner_position,
            last_draw_date: winner.last_draw_date
          })
          .eq('id', winner.id);

        if (updateError) {
          throw updateError;
        }

        // Aguardar um momento entre cada atualização
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Aguardar um momento para garantir que as atualizações foram aplicadas
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verificar se os vencedores foram atualizados corretamente
      const { data: updatedSubscribers, error: fetchError } = await getEstablishmentPremiumSubscribers(establishment.id);
      
      if (fetchError) {
        throw fetchError;
      }

      const updatedWinners = updatedSubscribers?.filter(sub => sub.is_winner);
      console.log('Vencedores atualizados:', updatedWinners);

      if (!updatedWinners || updatedWinners.length !== 2) {
        throw new Error('Erro ao atualizar vencedores');
      }

      // Verificar se os vencedores têm as propriedades corretas
      updatedWinners.forEach(winner => {
        if (!winner.is_winner) {
          throw new Error('Vencedor encontrado com is_winner = false');
        }
        if (!winner.winner_position) {
          throw new Error('Vencedor encontrado sem winner_position');
        }
        if (!winner.last_draw_date) {
          throw new Error('Vencedor encontrado sem last_draw_date');
        }
      });

      // Verificar se os vencedores têm posições consecutivas
      const positions = updatedWinners.map(winner => winner.winner_position).sort();
      if (positions[0] !== 1 || positions[1] !== 2) {
        throw new Error('Vencedores com posições incorretas');
      }

      setPremiumSubscribers(Array.isArray(updatedSubscribers) ? updatedSubscribers : []);
      toast.success('Sorteio realizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao realizar sorteio:', error);
      toast.error(error.message || 'Erro ao realizar sorteio');
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
          payment_method
        `)
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startOfSelectedDate)
        .lte('appointment_date', endOfSelectedDate)
        .order('appointment_time', { ascending: true });
      
      if (error) throw error;
      
      setAppointments(data as Appointment[] || []);
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      toast.error(error.message || 'Erro ao carregar agendamentos');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyAppointments = async () => {
    if (!establishment) return;
    
    try {
      const startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          client_id,
          client_name,
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
          payment_method
        `)
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true });
      
      if (error) throw error;
      
      setMonthlyAppointments(data as Appointment[] || []);
    } catch (error: any) {
      console.error('Error fetching monthly appointments:', error);
      toast.error(error.message || 'Erro ao carregar agendamentos mensais');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        console.log('Não há usuário logado');
        setIsEstablishmentLoading(false);
        return;
      }
      
      try {
        console.log('Iniciando busca de estabelecimento para usuário:', user.id);
        setIsEstablishmentLoading(true);
        
        const { data: establishments, error } = await supabase
          .from('establishments')
          .select('*')
          .eq('owner_id', user.id)
          .single();
        
        if (error) {
          console.error('Erro ao buscar estabelecimento:', error);
          if (error.code === 'PGRST116') {
            // Nenhum estabelecimento encontrado
            console.log('Nenhum estabelecimento encontrado para o usuário');
            setEstablishment(null);
          } else {
            throw error;
          }
        } else {
          console.log('Estabelecimento encontrado:', establishments);
        if (establishments) {
          setEstablishment(establishments);
          setEstablishmentName(establishments.name);
          setEstablishmentDescription(establishments.description || '');
          setEstablishmentCode(establishments.code);
          setAffiliateLink(establishments.affiliate_link || '');
            
          // Migrar dados antigos para nova estrutura se necessário
          const migratedBusinessHours = migrateBusinessHours(establishments.business_hours);
          setBusinessHours(migratedBusinessHours);
            
            // Configurar profissionais e serviços
            setProfessionals(establishments.professionals || [{
              id: '1',
              name: 'Profissional 1',
              specialties: ['Corte', 'Barba']
            }]);
            
            setServicesWithPrices(establishments.services_with_prices || [{
              id: '1',
              name: 'Corte',
              price: 25,
              duration: 30
            }, {
              id: '2',
              name: 'Barba',
              price: 15,
              duration: 20
            }]);
          
          // Carregar previews das fotos personalizadas existentes
            if (establishments.profile_image_url) {
              setProfileImagePreview(establishments.profile_image_url);
            }
          if (establishments.custom_photo_1_url) {
            setCustomPhoto1Preview(establishments.custom_photo_1_url);
          }
          if (establishments.custom_photo_2_url) {
            setCustomPhoto2Preview(establishments.custom_photo_2_url);
          }
          if (establishments.custom_photo_3_url) {
            setCustomPhoto3Preview(establishments.custom_photo_3_url);
            }
          }
        }
      } catch (error: any) {
        console.error('Erro ao carregar estabelecimento:', error);
        toast.error(error.message || 'Erro ao carregar estabelecimento');
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

  const calculateDailyBalance = (appointments: any[]): number => {
    return appointments
      .filter(appointment => {
        const isNotCancelled = appointment.status !== 'cancelled';
        const isProfessionalMatch = selectedProfessional === 'all' || appointment.professional === selectedProfessional;
        const isPaymentMethodMatch = selectedPaymentMethod === 'todos' || (appointment.payment_method || 'pendente') === selectedPaymentMethod;
        return isNotCancelled && isProfessionalMatch && isPaymentMethodMatch;
      })
      .reduce((total, appointment) => total + (appointment.price || 0), 0);
  };

  const calculateMonthlyBalance = (appointments: any[]): number => {
    return appointments
      .filter(appointment => {
        const appointmentDate = new Date(appointment.appointment_date);
        const isInMonth = isSameMonth(appointmentDate, selectedDate);
        const isNotCancelled = appointment.status !== 'cancelled';
        const isProfessionalMatch = selectedProfessional === 'all' || appointment.professional === selectedProfessional;
        const isPaymentMethodMatch = selectedPaymentMethod === 'todos' || (appointment.payment_method || 'pendente') === selectedPaymentMethod;
        return isInMonth && isNotCancelled && isProfessionalMatch && isPaymentMethodMatch;
      })
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
    if (professionalId === 'all') return 'Todos os Profissionais';
    const professional = establishment?.professionals.find(p => p.id === professionalId);
    return professional?.name || professionalId;
  };

  const addPremiumDrawColumns = async () => {
    try {
      const { error } = await supabase.rpc('add_column_if_not_exists', {
        table_name: 'premium_subscriptions',
        column_name: 'is_winner',
        column_type: 'boolean',
        default_value: 'false'
      });

      if (error) throw error;

      await supabase.rpc('add_column_if_not_exists', {
        table_name: 'premium_subscriptions',
        column_name: 'winner_position',
        column_type: 'smallint',
        default_value: 'null'
      });

      await supabase.rpc('add_column_if_not_exists', {
        table_name: 'premium_subscriptions',
        column_name: 'last_draw_date',
        column_type: 'timestamp with time zone',
        default_value: 'null'
      });
    } catch (error: any) {
      console.error('Error adding premium draw columns:', error);
    }
  };

  // Função para gerar o slug do estabelecimento
  const generateSlug = (name: string, code: string) => {
    const nameSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[ӏ0-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]/g, '') // Remove caracteres especiais
      .slice(0, 20); // Limita tamanho
    return `${nameSlug}${code}`;
  };

  const establishmentLink = establishment
    ? `${window.location.origin}/booking/${establishment.code}`
    : '';

  const copyLinkToClipboard = () => {
    if (!establishmentLink) return;
    navigator.clipboard.writeText(establishmentLink);
    toast.success('Link copiado para a área de transferência!');
  };

  // Função para migrar dados antigos de horários para nova estrutura
  const migrateBusinessHours = (oldBusinessHours: any): Record<string, BusinessHours> => {
    if (!oldBusinessHours) {
      return {
        monday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
        tuesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
        wednesday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
        thursday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
        friday: { enabled: true, open1: '09:00', close1: '18:00', open2: null, close2: null },
        saturday: { enabled: false, open1: '09:00', close1: '18:00', open2: null, close2: null },
        sunday: { enabled: false, open1: '09:00', close1: '18:00', open2: null, close2: null }
          };
        }

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const newBusinessHours: Record<string, BusinessHours> = {};

    days.forEach(day => {
      const dayHours = oldBusinessHours[day];
      newBusinessHours[day] = {
        enabled: dayHours?.enabled ?? true,
        open1: dayHours?.open1 || '09:00',
        close1: dayHours?.close1 || '18:00',
        open2: dayHours?.open2 || null,
        close2: dayHours?.close2 || null
        };
    });
    
    return newBusinessHours;
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

                  <button
              onClick={() => setActiveTab('available-times')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'available-times'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
                    }`}
                  >
              <Clock className="h-5 w-5" />
              <span className="hidden sm:inline">Horários</span>
                  </button>

                  <button
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'services'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
                    }`}
                  >
              <Scissors className="h-5 w-5" />
              <span className="hidden sm:inline">SEUS LINKS</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('premium-clients')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      activeTab === 'premium-clients'
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white'
                    }`}
                  >
              <Star className="h-5 w-5" />
              <span className="hidden sm:inline">Premium</span>
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
                          <div>
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-gray-400" />
                              <span className="text-white font-medium">
                                {appointment.client_name}
                              </span>
                              <span className="text-sm text-gray-400">
                                {appointment.is_premium ? '(Premium)' : '(Comum)'}
                              </span>
                            </div>
                            <div className="mt-2 text-sm text-gray-400">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{appointment.appointment_time}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Scissors className="h-4 w-4" />
                                <span>
                                  {appointment.service} - R$ {appointment.price ? appointment.price.toFixed(2).replace('.', ',') : '0,00'} ({formatDuration(appointment.duration || 0)})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <User className="h-4 w-4" />
                                <span>Profissional: {appointment.professional}</span>
                              </div>
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
              <form onSubmit={handleUpdateEstablishment} className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Editar Estabelecimento</h2>
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-secondary">Informações Básicas</h4>
                  <div>
                    <label htmlFor="establishmentName" className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do estabelecimento
                    </label>
                    <input
                      id="establishmentName"
                      type="text"
                      value={establishmentName}
                      onChange={(e) => setEstablishmentName(e.target.value)}
                      required
                      className="input-field"
                      placeholder="Ex: Barbearia Silva"
                    />
                  </div>
                  <div>
                    <label htmlFor="establishmentDescription" className="block text-sm font-medium text-gray-700 mb-1">
                      Descrição
                    </label>
                    <textarea
                      id="establishmentDescription"
                      value={establishmentDescription}
                      onChange={(e) => setEstablishmentDescription(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Descreva seu estabelecimento brevemente"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Foto do estabelecimento
                    </label>
                    <div className="flex items-center space-x-4">
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                        {profileImagePreview ? (
                          <img
                            src={profileImagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <label className="btn-outline cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                        Escolher imagem
                      </label>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">JPG ou PNG. Máximo 5MB.</p>
                  </div>
                  
                  {/* Fotos Personalizadas para Carrossel */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Fotos do seu trabalho (Carrossel)
                    </label>
                    <p className="text-sm text-gray-500 mb-4">
                      Adicione até 3 fotos que serão exibidas para os clientes na página de agendamento. 
                      Se não adicionar, serão usadas fotos padrão.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Foto 1 */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-600">Foto 1</label>
                        <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300">
                          {customPhoto1Preview ? (
                            <img
                              src={customPhoto1Preview}
                              alt="Foto personalizada 1"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <label className="btn-outline cursor-pointer text-xs w-full text-center block">
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            onChange={(e) => handleCustomPhotoChange(1, e)}
                          />
                          {customPhoto1Preview ? 'Trocar foto' : 'Escolher foto'}
                        </label>
                      </div>
                      
                      {/* Foto 2 */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-600">Foto 2</label>
                        <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300">
                          {customPhoto2Preview ? (
                            <img
                              src={customPhoto2Preview}
                              alt="Foto personalizada 2"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <label className="btn-outline cursor-pointer text-xs w-full text-center block">
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            onChange={(e) => handleCustomPhotoChange(2, e)}
                          />
                          {customPhoto2Preview ? 'Trocar foto' : 'Escolher foto'}
                        </label>
                      </div>
                      
                      {/* Foto 3 */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-600">Foto 3</label>
                        <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300">
                          {customPhoto3Preview ? (
                            <img
                              src={customPhoto3Preview}
                              alt="Foto personalizada 3"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <label className="btn-outline cursor-pointer text-xs w-full text-center block">
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            onChange={(e) => handleCustomPhotoChange(3, e)}
                          />
                          {customPhoto3Preview ? 'Trocar foto' : 'Escolher foto'}
                        </label>
                      </div>
                    </div>
                    
                    <p className="mt-2 text-xs text-gray-500">
                      JPG ou PNG. Máximo 5MB por foto. Recomendado: 800x600px ou similar.
                    </p>
                  </div>
                </div>

                {/* Código do Estabelecimento */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-secondary">Código do Estabelecimento</h4>
                  <div>
                    <label htmlFor="establishmentCode" className="block text-sm font-medium text-gray-700 mb-1">
                      Código do estabelecimento
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="establishmentCode"
                        type="text"
                        value={establishmentCode}
                        onChange={(e) => setEstablishmentCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="input-field w-32 font-mono text-center text-lg tracking-wider"
                        placeholder="0000"
                        maxLength={4}
                        required
                      />
                      <button
                        type="button"
                        onClick={generateRandomCode}
                        className="btn-outline flex items-center gap-2"
                      >
                        <DollarSign className="w-4 h-4" />
                        Gerar código
                      </button>
                      <button
                        type="button"
                        onClick={copyCodeToClipboard}
                        className="btn-outline flex items-center gap-2"
                      >
                        {codeCopied ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Este código é usado pelos clientes para encontrar seu estabelecimento.
                    </p>
                  </div>
                </div>

                {/* Link Afiliado */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-secondary">Seu Link Afiliado Aqui</h4>
                  <div>
                    <label htmlFor="affiliateLink" className="block text-sm font-medium text-gray-700 mb-1">
                      Link do seu site, Instagram ou loja
                    </label>
                    <input
                      id="affiliateLink"
                      type="url"
                      value={affiliateLink}
                      onChange={(e) => setAffiliateLink(e.target.value)}
                      className="input-field"
                      placeholder="Ex: https://www.instagram.com/meuestablecimento ou https://minhaloja.com"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Este link aparecerá para os clientes como um botão "Ver link" nos favoritos.
                    </p>
                  </div>
                </div>

                {/* Horário de Funcionamento */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-secondary">Horário de Funcionamento</h4>
                  {Object.entries(businessHours).map(([day, hours]) => (
                    <div key={day} className="bg-gray-50 p-4 rounded-lg space-y-3">
                      {/* Cabeçalho do dia com checkbox */}
                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={hours.enabled}
                            onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'enabled', e.target.checked)}
                            className="form-checkbox h-4 w-4 text-secondary"
                          />
                          <span className="ml-2 font-medium text-gray-900">
                            {day === 'monday' ? 'Segunda-feira' :
                             day === 'tuesday' ? 'Terça-feira' :
                             day === 'wednesday' ? 'Quarta-feira' :
                             day === 'thursday' ? 'Quinta-feira' :
                             day === 'friday' ? 'Sexta-feira' :
                             day === 'saturday' ? 'Sábado' : 'Domingo'}
                          </span>
                        </label>
                        {!hours.enabled && (
                          <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
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
                              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
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
                              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
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
                              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
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
                              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
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
                          <div className="mt-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                            <span className="font-medium">Funcionamento:</span>{' '}
                            {hours.enabled ? (
                              <>
                                {hours.open1} - {hours.close1}
                                {hours.open2 && hours.close2 && (
                                  <>
                                    {' e '}
                                    {hours.open2} - {hours.close2}
                                  </>
                                )}
                              </>
                            ) : (
                              'Fechado'
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Profissionais */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-md font-medium text-secondary">Profissionais</h4>
                    <button
                      type="button"
                      onClick={handleAddProfessional}
                      disabled={professionals.length >= 10}
                      className="btn-outline flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {professionals.map((professional) => (
                      <div key={professional.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={professional.name}
                              onChange={(e) => handleProfessionalChange(professional.id, 'name', e.target.value)}
                              className="input-field"
                              placeholder="Nome do profissional"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveProfessional(professional.id)}
                            className="ml-2 text-error hover:text-error/80"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {professionals.length === 0 && (
                      <p className="text-gray-500 text-center py-4">
                        Nenhum profissional cadastrado. Clique em "Adicionar" para começar.
                      </p>
                    )}
                  </div>
                </div>
                {/* Serviços e Preços */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-md font-medium text-secondary">Serviços e Preços</h4>
                    <button
                      type="button"
                      onClick={handleAddService}
                      className="btn-outline flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    {servicesWithPrices.map((service) => (
                      <div key={service.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nome do serviço
                            </label>
                            <input
                              type="text"
                              value={service.name}
                              onChange={(e) => handleServiceChange(service.id, 'name', e.target.value)}
                              placeholder="Nome do serviço"
                              className="input-field w-full"
                            />
                          </div>
                          <div className="w-full sm:w-32">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Preço
                            </label>
                            <input
                              type="number"
                              value={service.price}
                              onChange={(e) => handleServiceChange(service.id, 'price', Number(e.target.value))}
                              placeholder="Preço"
                              className="input-field w-full"
                            />
                          </div>
                          <div className="w-full sm:w-40">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Duração
                            </label>
                            <select
                              value={service.duration}
                              onChange={(e) => handleServiceChange(service.id, 'duration', Number(e.target.value))}
                              className="input-field w-full"
                            >
                              {durationOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end justify-end sm:w-10">
                            <button
                              type="button"
                              onClick={() => handleRemoveService(service.id)}
                              className="text-error hover:text-error/80 mb-1"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {servicesWithPrices.length === 0 && (
                      <p className="text-gray-500 text-center py-4">
                        Nenhum serviço cadastrado. Clique em "Adicionar" para começar.
                      </p>
                    )}
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="btn-secondary w-full flex justify-center items-center"
                  >
                    {isUpdating ? (
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'premium-clients' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Star className="h-6 w-6 text-yellow-500" />
                  Clientes Premium
                </h2>
                <p className="text-gray-400">
                  Lista de clientes premium que se cadastraram em seu estabelecimento
                </p>

                {premiumSubscribers.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="h-16 w-16 mx-auto mb-4 text-gray-400 opacity-30" />
                    <p className="text-xl text-gray-400 mb-2">Nenhum cliente premium ainda</p>
                    <p className="text-gray-500">
                      Quando clientes se cadastrarem como premium em seu estabelecimento, eles aparecerão aqui.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {premiumSubscribers.map((client, index) => (
                      <div key={client.id} className="p-6 rounded-lg bg-[#1a1b1c] border border-gray-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                              <Star className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-white text-lg">
                                {client.display_name}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Phone className="h-4 w-4 text-green-500" />
                                <span className="text-green-500 font-medium">
                                  {client.whatsapp}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400 mt-1">
                                Cadastrado em {new Date(client.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://wa.me/55${client.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary flex items-center gap-2 text-sm"
                            >
                              <MessageSquare className="h-4 w-4" />
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Informações sobre o sistema premium */}
                <div className="mt-8 p-6 rounded-lg bg-[#1a1b1c] border border-yellow-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-yellow-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Star className="h-4 w-4 text-yellow-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-2">Como funciona o sistema Premium?</h3>
                      <ul className="text-sm text-gray-400 space-y-1">
                        <li>• Clientes podem se cadastrar como premium em seu estabelecimento</li>
                        <li>• Cada cliente pode estar cadastrado em apenas 1 estabelecimento por vez</li>
                        <li>• Os dados ficam salvos aqui para você entrar em contato</li>
                        <li>• Clientes premium podem participar de sorteios e promoções especiais</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Informações sobre o link do estabelecimento */}
            {establishment && (
              <div className="mb-4 flex gap-2 items-center">
                <button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors duration-200"
                  onClick={() => window.open(establishmentLink, '_blank')}
                  title="Abrir página pública do seu estabelecimento"
                >
                  MEU LINK
                </button>
                <button
                  type="button"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-3 rounded-md text-xs transition-colors duration-200"
                  onClick={copyLinkToClipboard}
                  title="Copiar link para compartilhar"
                >
                  Copiar Link
                </button>
                <span className="text-xs text-gray-500 select-all">{establishmentLink}</span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default EstablishmentDashboard;