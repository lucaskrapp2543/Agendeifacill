import React, { useState, useEffect } from 'react';
import { format, parseISO, startOfDay, endOfDay, addDays, subDays, startOfMonth, endOfMonth, isToday, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, LogOut, Scissors, Star, Copy, CheckCircle, Image as ImageIcon, Plus, Trash2, DollarSign, Settings, ChevronLeft, ChevronRight, Check, Crown, Phone, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { supabase } from '../lib/supabase';
import { getEstablishmentAppointments, createEstablishment, updateEstablishment, removePremiumSubscriber, supabase } from '../lib/supabase';
import type { Appointment } from '../types/supabase';
import { ServiceForm } from '../components/ServiceForm';
import { DurationSelector } from '../components/DurationSelector';

interface BusinessHours {
  open: string;
  close: string;
  enabled: boolean;
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
}

type TabType = 'appointments' | 'services' | 'settings' | 'premium-clients';

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
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [premiumSubscribers, setPremiumSubscribers] = useState<any[]>([]);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [isEstablishmentLoading, setIsEstablishmentLoading] = useState(false);
  
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentDescription, setEstablishmentDescription] = useState('');
  const [establishmentCode, setEstablishmentCode] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  
  const [businessHours, setBusinessHours] = useState<Record<string, BusinessHours>>({
    monday: { open: '09:00', close: '18:00', enabled: true },
    tuesday: { open: '09:00', close: '18:00', enabled: true },
    wednesday: { open: '09:00', close: '18:00', enabled: true },
    thursday: { open: '09:00', close: '18:00', enabled: true },
    friday: { open: '09:00', close: '18:00', enabled: true },
    saturday: { open: '09:00', close: '18:00', enabled: false },
    sunday: { open: '09:00', close: '18:00', enabled: false }
  });
  
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
  const [servicesWithPrices, setServicesWithPrices] = useState<Service[]>([]);
  
  const [isCreating, setIsCreating] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedProfessional, setSelectedProfessional] = useState<string>('all'); // 'all' ou id do profissional

  const [monthlyAppointments, setMonthlyAppointments] = useState<Appointment[]>([]);

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

  const handleBusinessHoursChange = (day: keyof typeof businessHours, field: 'open' | 'close' | 'enabled', value: string | boolean) => {
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
      toast('Por favor, informe o nome do estabelecimento', 'warning');
      return;
    }

    if (!establishmentCode.trim() || establishmentCode.length !== 4) {
      toast('Por favor, informe um código de 4 dígitos válido', 'warning');
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
        profile_image: profileImage
      };
      
      console.log('Dados do estabelecimento a serem criados:', establishmentData);
      
      const { data, error } = await createEstablishment(establishmentData);
      
      if (error) {
        throw error;
      }
      
      console.log('Estabelecimento criado:', data);
      
      if (data?.[0]) {
        setEstablishment(data[0]);
        toast('Estabelecimento criado com sucesso!', 'success');
      } else {
        throw new Error('Erro ao criar estabelecimento: dados não retornados');
      }
    } catch (error: any) {
      console.error('Erro ao criar estabelecimento:', error);
      toast(error.message || 'Erro ao criar estabelecimento', 'error');
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
    
    toast('Código copiado para a área de transferência!', 'success');
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
        affiliate_link: affiliateLink.trim()
      };
      
      const { data, error } = await updateEstablishment(establishment.id, establishmentData);
      
      if (error) {
        throw error;
      }
      
      setEstablishment(data?.[0]);
      toast('Estabelecimento atualizado com sucesso!', 'success');
      
    } catch (error: any) {
      toast(error.message || 'Erro ao atualizar estabelecimento', 'error');
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

      toast('Agendamento cancelado com sucesso', 'success');
      fetchAppointments();
      fetchMonthlyAppointments();
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      toast(error.message || 'Erro ao cancelar agendamento', 'error');
    }
  };

  const fetchPremiumSubscribers = async () => {
    if (!establishment) {
      console.log('Estabelecimento não encontrado');
      return;
    }
    
    setIsLoadingSubscribers(true);
    
    try {
      const { data, error } = await supabase
        .from('premium_subscriptions')
        .select(`
          id,
          display_name,
          whatsapp,
          created_at,
          user_id
        `)
        .eq('establishment_id', establishment.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao buscar assinantes premium:', error);
        throw error;
      }
      
      setPremiumSubscribers(data || []);
    } catch (error: any) {
      console.error('Error fetching premium subscribers:', error);
      toast(error.message || 'Erro ao carregar assinantes premium', 'error');
    } finally {
      setIsLoadingSubscribers(false);
    }
  };

  const handleDrawWinners = async () => {
    if (!establishment) return;
    
    if (premiumSubscribers.length < 20) {
      toast('É necessário ter pelo menos 20 assinantes premium para realizar o sorteio', 'warning');
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

      setPremiumSubscribers(updatedSubscribers);
      toast('Sorteio realizado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao realizar sorteio:', error);
      toast(error.message || 'Erro ao realizar sorteio', 'error');
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
          price
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
          price
        `)
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true });
      
      if (error) throw error;
      
      setMonthlyAppointments(data as Appointment[] || []);
    } catch (error: any) {
      console.error('Error fetching monthly appointments:', error);
      toast(error.message || 'Erro ao carregar agendamentos mensais', 'error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setIsEstablishmentLoading(true);
        const { data: establishments, error } = await supabase
          .from('establishments')
          .select('*')
          .eq('owner_id', user.id)
          .single();
        
        if (error) throw error;
        
        if (establishments) {
          setEstablishment(establishments);
          setEstablishmentName(establishments.name);
          setEstablishmentDescription(establishments.description || '');
          setEstablishmentCode(establishments.code);
          setAffiliateLink(establishments.affiliate_link || '');
          setBusinessHours(establishments.business_hours);
          setProfessionals(establishments.professionals || []);
          setServicesWithPrices(establishments.services_with_prices || []);
        }
      } catch (error: any) {
        console.error('Error fetching establishment:', error);
        toast(error.message || 'Erro ao carregar estabelecimento', 'error');
      } finally {
        setIsEstablishmentLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (establishment && activeTab === 'premium') {
      fetchPremiumSubscribers();
    }
  }, [establishment, activeTab]);

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
        return isNotCancelled && isProfessionalMatch;
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
        return isInMonth && isNotCancelled && isProfessionalMatch;
      })
      .reduce((total, appointment) => total + (appointment.price || 0), 0);
  };

  // Filtrar agendamentos por profissional selecionado
  const filteredAppointments = appointments.filter(appointment => {
    return selectedProfessional === 'all' || appointment.professional === selectedProfessional;
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

  if (isEstablishmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101112]">
      <header className="bg-[#1a1b1c] border-b border-gray-800">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-white">Dashboard do Estabelecimento</span>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={signOut} className="btn-outline">
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        {isEstablishmentLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : !establishment ? (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Configure seu Estabelecimento</h2>
              <p className="text-gray-600">
                Para começar a receber agendamentos, você precisa configurar o perfil do seu estabelecimento.
              </p>
            </div>

            <form onSubmit={handleCreateEstablishment} className="space-y-6">
              {/* Informações Básicas */}
              <div className="space-y-4">
                <h4 className="text-md font-medium">Informações Básicas</h4>
                
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
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Este código será usado pelos clientes para encontrar seu estabelecimento.
                  </p>
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
              </div>

              {/* Horário de Funcionamento */}
              <div className="space-y-4">
                <h4 className="text-md font-medium">Horário de Funcionamento</h4>
                
                {Object.entries(businessHours).map(([day, hours]) => (
                  <div key={day} className="flex items-center space-x-4">
                    <div className="w-32">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={hours.enabled}
                          onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'enabled', e.target.checked)}
                          className="form-checkbox h-4 w-4 text-secondary"
                        />
                        <span className="ml-2 capitalize">{day}</span>
                      </label>
                    </div>
                    
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open', e.target.value)}
                      disabled={!hours.enabled}
                      className="input-field w-32"
                    />
                    
                    <span className="text-gray-500">até</span>
                    
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close', e.target.value)}
                      disabled={!hours.enabled}
                      className="input-field w-32"
                    />
                  </div>
                ))}
              </div>

              {/* Profissionais */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-md font-medium">Profissionais</h4>
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
                  <h4 className="text-md font-medium">Serviços e Preços</h4>
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
                    <div key={service.id} className="flex items-center gap-4">
                      <input
                        type="text"
                        value={service.name}
                        onChange={(e) => handleServiceChange(service.id, 'name', e.target.value)}
                        placeholder="Nome do serviço"
                        className="input-field flex-1"
                      />
                      <input
                        type="number"
                        value={service.price}
                        onChange={(e) => handleServiceChange(service.id, 'price', Number(e.target.value))}
                        placeholder="Preço"
                        className="input-field w-32"
                      />
                      <select
                        value={service.duration}
                        onChange={(e) => handleServiceChange(service.id, 'duration', Number(e.target.value))}
                        className="input-field w-40"
                      >
                        {durationOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(service.id)}
                        className="text-error hover:text-error/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                  disabled={isCreating}
                  className="btn-secondary w-full flex justify-center items-center"
                >
                  {isCreating ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    'Criar Estabelecimento'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="flex space-x-4 mb-8">
                  <button
                    onClick={() => setActiveTab('appointments')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      activeTab === 'appointments'
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    Agendamentos
                  </button>
                  <button
                    onClick={() => setActiveTab('services')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      activeTab === 'services'
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Scissors className="w-4 h-4" />
                    Serviços
                  </button>

                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      activeTab === 'settings'
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Configurações
                  </button>

                  <button
                    onClick={() => setActiveTab('premium-clients')}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      activeTab === 'premium-clients'
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Star className="w-4 h-4" />
                    CLIENTES PREMIUM
                  </button>
                </div>
              </div>
              <button onClick={signOut} className="btn-outline flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-6 rounded-lg bg-[#1a1b1c] border border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-medium text-white">Saldo Hoje</h2>
                </div>
                <p className="text-3xl font-bold text-green-500">
                  R$ {calculateDailyBalance(appointments).toFixed(2).replace('.', ',')}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {appointments.length} agendamentos hoje
                </p>
              </div>

              <div className="p-6 rounded-lg bg-[#1a1b1c] border border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-medium text-white">Saldo do Mês</h2>
                </div>
                <p className="text-3xl font-bold text-blue-500">
                  R$ {calculateMonthlyBalance(monthlyAppointments).toFixed(2).replace('.', ',')}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {monthlyAppointments.length} agendamentos este mês
                </p>
              </div>
            </div>

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
                        onClick={() => setSelectedProfessional('all')}
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
                          onClick={() => setSelectedProfessional(professional.id)}
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

                <h2 className="text-2xl font-bold text-white">Agendamentos do Dia</h2>
                <p className="text-gray-400 mb-4">
                  {selectedProfessional === 'all' ? 'Todos os profissionais' : `Profissional: ${getProfessionalName(selectedProfessional)}`}
                </p>
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
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              appointment.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                              appointment.status === 'confirmed' ? 'bg-green-500/10 text-green-500' :
                              appointment.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                              'bg-blue-500/10 text-blue-500'
                            }`}>
                              {appointment.status === 'pending' ? 'Pendente' : 
                               appointment.status === 'confirmed' ? 'Confirmado' :
                               appointment.status === 'cancelled' ? 'Cancelado' : 'Concluído'}
                            </span>
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

            {/* Seção de Serviços */}
            {activeTab === 'services' && (
              <div className="space-y-6">
                {/* ... existing code ... */}
              </div>
            )}

            {/* Seção de Configurações */}
            {activeTab === 'settings' && establishment && (
              <form onSubmit={handleUpdateEstablishment} className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Editar Estabelecimento</h2>
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium">Informações Básicas</h4>
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
                </div>

                {/* Código do Estabelecimento */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium">Código do Estabelecimento</h4>
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
                  <h4 className="text-md font-medium">Seu Link Afiliado Aqui</h4>
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
                  <h4 className="text-md font-medium">Horário de Funcionamento</h4>
                  {Object.entries(businessHours).map(([day, hours]) => (
                    <div key={day} className="flex items-center space-x-4">
                      <div className="w-32">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={hours.enabled}
                            onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'enabled', e.target.checked)}
                            className="form-checkbox h-4 w-4 text-secondary"
                          />
                          <span className="ml-2 capitalize">{day}</span>
                        </label>
                      </div>
                      <input
                        type="time"
                        value={hours.open}
                        onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'open', e.target.value)}
                        disabled={!hours.enabled}
                        className="input-field w-32"
                      />
                      <span className="text-gray-500">até</span>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={(e) => handleBusinessHoursChange(day as keyof typeof businessHours, 'close', e.target.value)}
                        disabled={!hours.enabled}
                        className="input-field w-32"
                      />
                    </div>
                  ))}
                </div>
                {/* Profissionais */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-md font-medium">Profissionais</h4>
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
                    <h4 className="text-md font-medium">Serviços e Preços</h4>
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
                      <div key={service.id} className="flex items-center gap-4">
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => handleServiceChange(service.id, 'name', e.target.value)}
                          placeholder="Nome do serviço"
                          className="input-field flex-1"
                        />
                        <input
                          type="number"
                          value={service.price}
                          onChange={(e) => handleServiceChange(service.id, 'price', Number(e.target.value))}
                          placeholder="Preço"
                          className="input-field w-32"
                        />
                        <select
                          value={service.duration}
                          onChange={(e) => handleServiceChange(service.id, 'duration', Number(e.target.value))}
                          className="input-field w-40"
                        >
                          {durationOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(service.id)}
                          className="text-error hover:text-error/80"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

            {/* Seção de Clientes Premium */}
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
          </>
        )}
      </main>
    </div>
  );
};

export default EstablishmentDashboard;