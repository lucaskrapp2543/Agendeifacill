import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { 
  getClientAppointments, 
  createAppointment, 
  getEstablishmentByCode, 
  cancelAppointment,
  getUserFavoriteEstablishments, 
  addFavoriteEstablishment, 
  removeFavoriteEstablishment,
  checkIfEstablishmentIsFavorite 
} from '../lib/supabase';
import { Calendar, Clock, Scissors, LogOut, Star, User, Plus, Trash2, Heart, Search, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import type { Appointment, Establishment } from '../types/supabase';

type TabType = 'appointments' | 'book' | 'favorites' | 'premium';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Professional {
  id: string;
  name: string;
}

interface FavoriteEstablishment {
  id: string;
  establishment_id: string;
  establishment_name: string;
  establishment_code: string;
  establishment_data: any;
  created_at: string;
}

const PremiumDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  const [clientName, setClientName] = useState('');
  
  // Estados para agendamento
  const [establishmentCode, setEstablishmentCode] = useState('');
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [professional, setProfessional] = useState('');
  const [existingAppointmentsForSlots, setExistingAppointmentsForSlots] = useState<any[]>([]);
  
  // Estados para favoritos
  const [favoriteEstablishments, setFavoriteEstablishments] = useState<FavoriteEstablishment[]>([]);
  const [isAddingFavorite, setIsAddingFavorite] = useState(false);

  // Estados para premium
  const [premiumEstablishmentCode, setPremiumEstablishmentCode] = useState('');
  const [premiumEstablishment, setPremiumEstablishment] = useState<Establishment | null>(null);
  const [clientPhone, setClientPhone] = useState('');
  const [isActivatingPremium, setIsActivatingPremium] = useState(false);
  const [isPremiumSearching, setIsPremiumSearching] = useState(false);

  useEffect(() => {
    fetchAppointments();
    loadFavoriteEstablishments();
  }, [user]);

  // Função para definir o horário com debug
  const setAppointmentTimeWithDebug = (time: string) => {
    console.log('⏰ HORÁRIO SELECIONADO:', time);
    setAppointmentTime(time);
  };

  useEffect(() => {
    if (user) {
      const savedName = localStorage.getItem(`clientName_${user.id}`);
      if (savedName) {
        setClientName(savedName);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && clientName) {
      localStorage.setItem(`clientName_${user.id}`, clientName);
    }
  }, [clientName, user]);

  const fetchAppointments = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await getClientAppointments(user.id);
      
      if (error) {
        throw error;
      }
      
      setAppointments(data || []);
    } catch (error: any) {
      toast(error.message || 'Erro ao buscar agendamentos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadFavoriteEstablishments = () => {
    if (!user) return;
    const favoritesKey = `favorite_establishments_${user.id}`;
    const saved = localStorage.getItem(favoritesKey);
    if (saved) {
      setFavoriteEstablishments(JSON.parse(saved));
    }
  };

  const saveFavoriteEstablishments = (favorites: FavoriteEstablishment[]) => {
    if (!user) return;
    const favoritesKey = `favorite_establishments_${user.id}`;
    localStorage.setItem(favoritesKey, JSON.stringify(favorites));
    setFavoriteEstablishments(favorites);
  };

  const handleAddToFavorites = () => {
    if (!establishment || !user) return;
    
    setIsAddingFavorite(true);
    
    try {
      const existing = favoriteEstablishments.find(
        fav => fav.establishment_id === establishment.id
      );
      
      if (existing) {
        toast('Este estabelecimento já está nos seus favoritos', 'warning');
        return;
      }
      
      const newFavorite: FavoriteEstablishment = {
        id: Date.now().toString(),
        establishment_id: establishment.id,
        establishment_name: establishment.name,
        establishment_code: establishment.code,
        establishment_data: establishment,
        created_at: new Date().toISOString()
      };
      
      const updatedFavorites = [...favoriteEstablishments, newFavorite];
      saveFavoriteEstablishments(updatedFavorites);
      
      toast('Estabelecimento adicionado aos favoritos!', 'success');
      
    } catch (error: any) {
      toast('Erro ao adicionar aos favoritos', 'error');
    } finally {
      setIsAddingFavorite(false);
    }
  };

  const handleRemoveFromFavorites = (favoriteId: string) => {
    const updatedFavorites = favoriteEstablishments.filter(fav => fav.id !== favoriteId);
    saveFavoriteEstablishments(updatedFavorites);
    toast('Estabelecimento removido dos favoritos', 'success');
  };

  const handleSelectFavoriteEstablishment = (favorite: FavoriteEstablishment) => {
    setEstablishment(favorite.establishment_data);
    setEstablishmentCode(favorite.establishment_code);
    fetchExistingAppointments(favorite.establishment_id, appointmentDate, professional);
    setActiveTab('book');
    toast(`Estabelecimento selecionado: ${favorite.establishment_name}`, 'success');
  };

  const fetchExistingAppointments = async (establishmentId: string, date: string, professional: string) => {
    if (!date || !professional) {
      console.log('📅 Aguardando data e profissional para buscar agendamentos...');
      return;
    }

    try {
      console.log('🔍 Buscando agendamentos existentes:', { establishmentId, date, professional });
      
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('appointment_date', date)
        .eq('professional', professional)
        .neq('status', 'cancelled');
      
      if (error) throw error;
      
      console.log('📋 Agendamentos encontrados:', data);
      setExistingAppointmentsForSlots(data || []);
      
    } catch (error: any) {
      console.error('❌ Erro ao buscar agendamentos:', error);
      toast(error.message || 'Erro ao buscar agendamentos existentes', 'error');
      setExistingAppointmentsForSlots([]);
    }
  };

  // Recarregar agendamentos quando data ou profissional mudam
  useEffect(() => {
    if (establishment && appointmentDate && professional) {
      fetchExistingAppointments(establishment.id, appointmentDate, professional);
    }
  }, [establishment, appointmentDate, professional]);

  const handleSearchEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishmentCode.trim()) {
      toast('Por favor, informe o código do estabelecimento', 'warning');
      return;
    }
    
    setIsSearching(true);
    
    try {
      const { data, error } = await getEstablishmentByCode(establishmentCode.trim());
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        toast('Estabelecimento não encontrado', 'error');
        return;
      }
      
      setEstablishment(data);
      toast(`Estabelecimento encontrado: ${data.name}`, 'success');
      
    } catch (error: any) {
      toast(error.message || 'Erro ao buscar estabelecimento', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !establishment) return;
    if (!appointmentTime || !selectedService || !professional || !appointmentDate || !clientName) {
      toast('Preencha todos os campos para agendar', 'warning');
      return;
    }
    
    // DEBUG: Verificar valores antes de salvar
    console.log('🚀 SALVANDO AGENDAMENTO:');
    console.log('  appointmentDate:', appointmentDate);
    console.log('  appointmentTime:', appointmentTime);
    console.log('  professional:', professional);
    console.log('  selectedService:', selectedService);
    
    // 🚨 VERIFICAÇÃO DUPLA DE CONFLITOS NO CLIENTE
    console.log('🔍 VERIFICAÇÃO DUPLA - existingAppointmentsForSlots:', existingAppointmentsForSlots);
    const relevantAppointments = existingAppointmentsForSlots.filter(apt => 
      apt.appointment_date === appointmentDate &&
      apt.professional === professional &&
      apt.status !== 'cancelled'
    );
    
    console.log('🎯 Agendamentos relevantes para verificação dupla:', relevantAppointments);
    
    // Converter tempo para minutos para verificação
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const newStartMinutes = timeToMinutes(appointmentTime);
    const newEndMinutes = newStartMinutes + selectedService.duration;
    
    for (const existing of relevantAppointments) {
      const existingStartMinutes = timeToMinutes(existing.appointment_time);
      const existingEndMinutes = existingStartMinutes + existing.duration;
      
      // Verificar se há sobreposição
      const hasConflict = (newStartMinutes < existingEndMinutes && newEndMinutes > existingStartMinutes);
      
      if (hasConflict) {
        const errorMsg = `🚨 CONFLITO DETECTADO NO CLIENTE! Horário ${appointmentTime} conflita com agendamento existente às ${existing.appointment_time}`;
        console.error(errorMsg);
        toast('Conflito de horário detectado! Recarregue a página e tente novamente.', 'error');
        return;
      }
    }
    
    console.log('✅ VERIFICAÇÃO DUPLA PASSOU - Nenhum conflito detectado no cliente');
    
    setIsBooking(true);
    try {
      const appointmentData = {
        client_id: user.id,
        establishment_id: establishment.id,
        service: selectedService.name,
        professional: professional,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: 'pending',
        client_name: clientName,
        price: selectedService.price,
        duration: selectedService.duration
      };
      
      console.log('📝 DADOS PARA SALVAR:', appointmentData);
      
      const { data, error } = await createAppointment(appointmentData);
      if (error) throw error;
      
      console.log('✅ AGENDAMENTO SALVO:', data);
      
      toast('Agendamento criado com sucesso!', 'success');
      
      // Forçar reload dos agendamentos após 1 segundo para dar tempo do Supabase processar
      setTimeout(() => {
        console.log('🔄 Recarregando agendamentos após sucesso...');
        fetchAppointments();
      }, 1000);
      
      // Também chamar imediatamente
      fetchAppointments();
      await fetchExistingAppointments(establishment.id, appointmentDate, professional);
      // Reset form
      setEstablishmentCode('');
      setEstablishment(null);
      setSelectedService(null);
      setProfessional('');
      setAppointmentDate('');
      setAppointmentTime('');
      setClientName('');
      setActiveTab('appointments');
    } catch (error: any) {
      toast(error.message || 'Erro ao criar agendamento', 'error');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      console.log('🚫 Cancelando agendamento:', appointmentId);
      
      const { error } = await cancelAppointment(appointmentId);

      if (error) {
        console.error('❌ Erro ao cancelar:', error);
        throw error;
      }

      toast('Agendamento cancelado com sucesso', 'success');
      
      // Aguardar um pouco e recarregar
      setTimeout(() => {
        fetchAppointments();
      }, 500);
      
      fetchAppointments();
    } catch (error: any) {
      console.error('❌ Error cancelling appointment:', error);
      toast(error.message || 'Erro ao cancelar agendamento', 'error');
    }
  };

  const handleSearchPremiumEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!premiumEstablishmentCode.trim()) {
      toast('Por favor, informe o código do estabelecimento', 'warning');
      return;
    }

    setIsPremiumSearching(true);
    setPremiumEstablishment(null);

    try {
      const { data, error } = await getEstablishmentByCode(premiumEstablishmentCode);
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        toast('Estabelecimento não encontrado. Verifique o código.', 'error');
        return;
      }
      
      setPremiumEstablishment(data);
      toast(`Estabelecimento encontrado: ${data.name}`, 'success');
      
    } catch (error: any) {
      toast(error.message || 'Erro ao buscar estabelecimento', 'error');
    } finally {
      setIsPremiumSearching(false);
    }
  };

  const handleActivatePremium = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !premiumEstablishment || !clientName.trim() || !clientPhone.trim()) {
      toast('Por favor, preencha todos os campos', 'warning');
      return;
    }

    setIsActivatingPremium(true);

    try {
      // Primeiro, verificar se já tem premium ativo (APENAS UM permitido)
      const { data: existing, error: checkError } = await supabase
        .from('premium_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (existing && !checkError) {
        toast('Você já é premium de um estabelecimento! Remova primeiro para trocar.', 'warning');
        return;
      }

      // Ativar premium
      const { error } = await supabase
        .from('premium_subscriptions')
        .insert({
          user_id: user.id,
          establishment_id: premiumEstablishment.id,
          display_name: clientName,
          whatsapp: clientPhone
        });

      if (error) throw error;

      toast(`🎉 Premium ativado com sucesso em ${premiumEstablishment.name}!`, 'success');
      
      // Limpar formulário
      setPremiumEstablishmentCode('');
      setPremiumEstablishment(null);
      
    } catch (error: any) {
      console.error('Error activating premium:', error);
      toast(error.message || 'Erro ao ativar premium', 'error');
    } finally {
      setIsActivatingPremium(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101112]">
      {/* SEM POPUP DE BOAS-VINDAS - PRINCIPAL DIFERENÇA */}

      <header className="bg-[#1a1b1c] border-b border-gray-800">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <span className="text-lg md:text-xl font-bold text-white">AgendaFácil</span>
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">PREMIUM</span>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <span className="text-gray-400 text-sm md:text-base hidden sm:block">{user?.email}</span>
              <button onClick={signOut} className="btn-outline text-sm md:text-base px-3 py-1 md:px-4 md:py-2">
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-4 md:py-8">
        <div className="card mb-6">
          <div className="border-b border-gray-800 mb-4">
            <nav className="flex space-x-1 md:space-x-8 overflow-x-auto scrollbar-hide pb-1 -mb-px">
              <button
                onClick={() => setActiveTab('appointments')}
                className={`py-2 px-3 md:px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'appointments'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                <span className="md:hidden">📅 Agend.</span>
                <span className="hidden md:inline">Meus Agendamentos</span>
              </button>
              <button
                onClick={() => setActiveTab('book')}
                className={`py-2 px-3 md:px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'book'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                <span className="md:hidden">➕ Novo</span>
                <span className="hidden md:inline">Novo Agendamento</span>
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`py-2 px-3 md:px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'favorites'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                <span className="md:hidden">⭐ Fav.</span>
                <span className="hidden md:inline">Favoritos</span>
              </button>
              <button
                onClick={() => setActiveTab('premium')}
                className={`py-2 px-3 md:px-1 border-b-2 font-medium text-xs md:text-sm whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'premium'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                }`}
              >
                <span className="md:hidden">🎉 Premium</span>
                <span className="hidden md:inline">Ativar Premium</span>
              </button>
            </nav>
          </div>

          {/* Conteúdo das abas */}
          {activeTab === 'appointments' ? (
            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <h2 className="text-lg font-semibold text-white">Seus Agendamentos</h2>
                <button
                  onClick={() => setActiveTab('book')}
                  className="btn-primary text-sm md:text-base w-full md:w-auto"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Novo Agendamento
                </button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map((appointment) => (
                    <div 
                      key={appointment.id} 
                      className={`rounded-lg p-4 border ${
                        appointment.status === 'cancelled' 
                          ? 'bg-red-900/20 border-red-800/50 opacity-75' 
                          : 'bg-[#242628] border-gray-800'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                            <h3 className={`font-medium ${
                              appointment.status === 'cancelled' ? 'text-red-400 line-through' : 'text-white'
                            }`}>
                              {appointment.establishments?.name || 'Estabelecimento'}
                            </h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
                              appointment.status === 'confirmed' 
                                ? 'bg-green-500/20 text-green-500'
                                : appointment.status === 'cancelled'
                                ? 'bg-red-500/20 text-red-500'
                                : 'bg-yellow-500/20 text-yellow-500'
                            }`}>
                              {appointment.status === 'confirmed' ? 'Confirmado' : 
                               appointment.status === 'cancelled' ? 'CANCELADO' : 'Pendente'}
                            </span>
                          </div>
                          
                          <div className={`space-y-1 text-sm ${
                            appointment.status === 'cancelled' ? 'text-red-500/70' : 'text-gray-400'
                          }`}>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {format(parseISO(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>{appointment.appointment_time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Scissors className="w-4 h-4" />
                              <span>{appointment.service}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{appointment.professional}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                          {appointment.status !== 'cancelled' && (
                            <button
                              onClick={() => handleCancelAppointment(appointment.id)}
                              className="btn-outline text-sm py-1 order-2 md:order-1"
                            >
                              Cancelar
                            </button>
                          )}
                          
                          {appointment.establishments?.affiliate_link && (
                            <button
                              onClick={() => window.open(appointment.establishments.affiliate_link, '_blank')}
                              className="btn-primary text-sm py-1 order-1 md:order-2"
                            >
                              Ver link
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                  <p className="text-gray-400">Você não tem agendamentos</p>
                  <button
                    onClick={() => setActiveTab('book')}
                    className="mt-4 text-primary hover:underline font-medium"
                  >
                    Agendar agora
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'book' ? (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-white">Novo Agendamento</h2>
              
              {!establishment ? (
                <div>
                  <form onSubmit={handleSearchEstablishment} className="mb-6">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={establishmentCode}
                        onChange={(e) => setEstablishmentCode(e.target.value)}
                        placeholder="Digite o código do estabelecimento"
                        className="input-field flex-1"
                      />
                      <button
                        type="submit"
                        disabled={isSearching}
                        className="btn-primary px-4 py-2 flex items-center gap-2"
                      >
                        {isSearching ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        <span className="hidden md:inline">Buscar</span>
                      </button>
                    </div>
                  </form>

                  {favoriteEstablishments.length > 0 && (
                    <div>
                      <h3 className="text-md font-medium mb-3 text-gray-300">Seus Favoritos</h3>
                      <div className="grid gap-3 mb-6">
                        {favoriteEstablishments.map((favorite) => (
                          <div
                            key={favorite.id}
                            className="bg-[#242628] rounded-lg p-3 border border-gray-800 cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => handleSelectFavoriteEstablishment(favorite)}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-medium text-white text-sm">
                                  {favorite.establishment_name}
                                </h4>
                                <p className="text-gray-400 text-xs">
                                  Código: {favorite.establishment_code}
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromFavorites(favorite.id);
                                }}
                                className="text-gray-400 hover:text-red-400 transition-colors p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="bg-[#242628] rounded-lg p-4 border border-gray-800 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-white">{establishment.name}</h3>
                        <p className="text-gray-400 text-sm">{establishment.address}</p>
                        <p className="text-gray-400 text-sm">Código: {establishment.code}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAddToFavorites}
                          disabled={isAddingFavorite || favoriteEstablishments.some(fav => fav.establishment_id === establishment.id)}
                          className="btn-outline text-sm px-3 py-1 flex items-center gap-1"
                        >
                          <Heart className="w-4 h-4" />
                          {favoriteEstablishments.some(fav => fav.establishment_id === establishment.id) ? 'Favoritado' : 'Favoritar'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleBookAppointment} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Seu Nome Completo
                      </label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Digite seu nome completo"
                        className="input-field"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Serviço
                      </label>
                      <select
                        value={selectedService?.name || ''}
                        onChange={(e) => {
                          const service = establishment.services_with_prices.find(s => s.name === e.target.value);
                          setSelectedService(service || null);
                        }}
                        className="input-field"
                        required
                      >
                        <option value="">Selecione um serviço</option>
                        {establishment.services_with_prices.map((service) => (
                          <option key={service.name} value={service.name}>
                            {service.name} - R$ {service.price} ({service.duration}min)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Profissional
                      </label>
                      <select
                        value={professional}
                        onChange={(e) => setProfessional(e.target.value)}
                        className="input-field"
                        required
                      >
                        <option value="">Selecione um profissional</option>
                        {establishment.professionals.map((prof) => (
                          <option key={prof.id} value={prof.name}>
                            {prof.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Data
                      </label>
                      <input
                        type="date"
                        value={appointmentDate}
                        onChange={(e) => {
                          setAppointmentDate(e.target.value);
                          setAppointmentTime(''); // Reset time when date changes
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        className="input-field"
                        required
                      />
                    </div>

                    {appointmentDate && professional && selectedService && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Horário Disponível
                        </label>
                        <TimeSlotSelector
                          selectedDate={new Date(appointmentDate + 'T00:00:00')}
                          selectedDuration={selectedService.duration}
                          existingAppointments={existingAppointmentsForSlots}
                          selectedProfessional={professional}
                          onSelectTime={setAppointmentTimeWithDebug}
                          selectedTime={appointmentTime}
                          businessHours={{
                            open: '08:00',
                            close: '18:00'
                          }}
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEstablishment(null);
                          setEstablishmentCode('');
                        }}
                        className="btn-outline"
                      >
                        Voltar
                      </button>
                      <button
                        type="submit"
                        disabled={isBooking}
                        className={`btn-primary flex-1 ${isBooking && 'opacity-50 cursor-not-allowed'}`}
                      >
                        {isBooking ? 'Agendando...' : 'Confirmar Agendamento Premium'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : activeTab === 'favorites' ? (
            <div className="animate-fade-in">
              <div className="max-w-2xl mx-auto px-2">
                <h2 className="text-lg md:text-xl font-semibold text-white mb-4 md:mb-6 flex items-center gap-2">
                  <Star className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  Meus Estabelecimentos Favoritos
                </h2>

                {/* Formulário para adicionar estabelecimento */}
                <div className="card bg-[#1a1b1c] border border-gray-800 p-4 md:p-6 mb-4 md:mb-6">
                  <h3 className="text-base md:text-lg font-medium text-white mb-4">Adicionar Novo Estabelecimento</h3>
                  <form onSubmit={handleSearchEstablishment} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Código do Estabelecimento
                      </label>
                      <input
                        type="text"
                        value={establishmentCode}
                        onChange={(e) => setEstablishmentCode(e.target.value)}
                        className="input-field"
                        placeholder="Digite o código do estabelecimento (4 dígitos)"
                        maxLength={4}
                        required
                      />
                    </div>
                    
                    {establishment && (
                      <div className="p-4 bg-[#242628] rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-white">{establishment.name}</h4>
                            <p className="text-sm text-gray-400">{establishment.description}</p>
                            <p className="text-xs text-gray-500">Código: {establishment.code}</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddToFavorites}
                            disabled={isAddingFavorite}
                            className={`btn-primary ${isAddingFavorite && 'opacity-50 cursor-not-allowed'}`}
                          >
                            {isAddingFavorite ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {!establishment && (
                      <button
                        type="submit"
                        disabled={isSearching}
                        className={`btn-outline w-full ${isSearching && 'opacity-50 cursor-not-allowed'}`}
                      >
                        {isSearching ? 'Buscando...' : 'Buscar Estabelecimento'}
                      </button>
                    )}
                  </form>
                </div>

                {/* Lista de estabelecimentos favoritos */}
                <div className="space-y-4">
                  {favoriteEstablishments.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                      <p className="text-gray-400">Nenhum estabelecimento favorito ainda</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Use o formulário acima para adicionar seus estabelecimentos favoritos
                      </p>
                    </div>
                  ) : (
                    favoriteEstablishments.map((favorite) => (
                      <div key={favorite.id} className="card bg-[#1a1b1c] border border-gray-800 p-3 md:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            {favorite.establishment_data?.profile_image_url ? (
                              <img
                                src={favorite.establishment_data.profile_image_url}
                                alt={favorite.establishment_name}
                                className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#242628] flex items-center justify-center flex-shrink-0">
                                <Scissors className="h-6 w-6 md:h-8 md:w-8 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white text-sm md:text-base truncate">{favorite.establishment_name}</h3>
                              <p className="text-xs md:text-sm text-gray-400">
                                Código: {favorite.establishment_code}
                              </p>
                              <p className="text-xs text-gray-500">
                                Salvo em {format(parseISO(favorite.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => handleSelectFavoriteEstablishment(favorite)}
                              className="btn-primary text-xs md:text-sm py-2 px-3 flex-1 sm:flex-none"
                            >
                              Agendar
                            </button>
                            {favorite.establishment_data?.affiliate_link && (
                              <button
                                onClick={() => window.open(favorite.establishment_data.affiliate_link, '_blank')}
                                className="btn-outline text-xs md:text-sm py-2 px-3 flex-shrink-0"
                                title="Ver link do estabelecimento"
                              >
                                Ver link
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveFromFavorites(favorite.id)}
                              className="btn-outline text-xs md:text-sm py-2 px-3 flex-shrink-0"
                            >
                              <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              <div className="max-w-2xl mx-auto px-2">
                <h2 className="text-lg md:text-xl font-semibold text-white mb-4 md:mb-6 flex items-center gap-2">
                  <Star className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                  Ativar Premium
                </h2>

                <form onSubmit={handleSearchPremiumEstablishment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Código do Estabelecimento
                    </label>
                    <input
                      type="text"
                      value={premiumEstablishmentCode}
                      onChange={(e) => setPremiumEstablishmentCode(e.target.value)}
                      className="input-field"
                      placeholder="Digite o código do estabelecimento (4 dígitos)"
                      maxLength={4}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Seu Nome
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="input-field"
                      placeholder="Digite seu nome completo"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Seu Telefone
                    </label>
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="input-field"
                      placeholder="(11) 99999-9999"
                      required
                    />
                  </div>
                  
                  {premiumEstablishment && (
                    <div className="p-4 bg-[#242628] rounded-lg border border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white">{premiumEstablishment.name}</h4>
                          <p className="text-sm text-gray-400">{premiumEstablishment.description}</p>
                          <p className="text-xs text-gray-500">Código: {premiumEstablishment.code}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleActivatePremium}
                          disabled={isActivatingPremium}
                          className={`btn-primary ${isActivatingPremium && 'opacity-50 cursor-not-allowed'}`}
                        >
                          {isActivatingPremium ? 'Ativando...' : 'Ativar Premium'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {!premiumEstablishment && (
                    <button
                      type="submit"
                      disabled={isPremiumSearching}
                      className={`btn-outline w-full ${isPremiumSearching && 'opacity-50 cursor-not-allowed'}`}
                    >
                      {isPremiumSearching ? 'Buscando...' : 'Buscar Estabelecimento'}
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PremiumDashboard;