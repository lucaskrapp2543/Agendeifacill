import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toaster';
import { 
  getClientAppointments, 
  createAppointment, 
  getEstablishmentByCode, 
  testClientAppointmentsAccess, 
  cancelAppointment
} from '../lib/supabase';
import { Calendar, Clock, Scissors, LogOut, Star, User, Plus, Trash2, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Appointment, Establishment, Service } from '../types/supabase';
import { supabase } from '../lib/supabase';
import { BusinessHoursSelector } from '../components/BusinessHoursSelector';
import { useNavigate } from 'react-router-dom';


type TabType = 'appointments' | 'book' | 'favorites';

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

const ClientDashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('appointments');
  
  const [establishmentCode, setEstablishmentCode] = useState('');
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [service, setService] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [professional, setProfessional] = useState('');
  const [clientName, setClientName] = useState('');
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [favoriteEstablishments, setFavoriteEstablishments] = useState<FavoriteEstablishment[]>([]);
  const [isAddingFavorite, setIsAddingFavorite] = useState(false);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // Debug wrapper para setAppointmentTime
  const setAppointmentTimeWithDebug = (time: string) => {
    console.log('🕐 ClientDashboard - setAppointmentTime chamado com:', time);
    console.log('🕐 ClientDashboard - Timezone atual:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('🕐 ClientDashboard - Data atual:', new Date().toString());
    setAppointmentTime(time);
  };

  useEffect(() => {
    if (user) {
      // Executar teste de diagnóstico primeiro
      testClientAppointmentsAccess(user.id).then(result => {
        console.log('🧪 Resultado do teste RLS:', result);
      });
      
      fetchAppointments();
      loadFavoriteEstablishments();
    }
  }, [user]);

  // Mostrar popup quando entrar na aba "Meus Agendamentos"
  useEffect(() => {
    if (activeTab === 'appointments') {
      setShowWelcomePopup(true);
    }
  }, [activeTab]);

  const fetchAppointments = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      console.log('🔍 Buscando agendamentos para user:', user.id);
      console.log('🔍 User email:', user.email);
      
      const { data, error } = await getClientAppointments(user.id);
      
      console.log('📊 Resultado getClientAppointments:');
      console.log('  - Data:', data);
      console.log('  - Error:', error);
      console.log('  - Quantidade:', data?.length || 0);
      
      if (error) {
        console.error('❌ Erro ao buscar agendamentos:', error);
        throw error;
      }
      
      // Se não há dados no Supabase, tentar localStorage
      if (!data || data.length === 0) {
        console.log('⚠️ Nenhum dado no Supabase, tentando localStorage...');
        const localAppointments = JSON.parse(localStorage.getItem(`appointments_${user.id}`) || '[]');
        
        if (localAppointments.length > 0) {
          console.log('💾 Agendamentos locais encontrados:', localAppointments.length);
          setAppointments(localAppointments);
          toast('⚠️ Usando dados locais (problema de RLS detectado)', 'warning');
        } else {
          setAppointments([]);
        }
      } else {
        setAppointments(data);
      }
      
      // Debug adicional - verificar se há agendamentos criados hoje
      const finalData = data && data.length > 0 ? data : JSON.parse(localStorage.getItem(`appointments_${user.id}`) || '[]');
      const today = new Date().toISOString().split('T')[0];
      const todayAppointments = finalData?.filter((apt: any) => apt.created_at?.startsWith(today) || apt.local_save_date?.startsWith(today));
      console.log('📅 Agendamentos criados hoje:', todayAppointments?.length || 0);
      
    } catch (error: any) {
      console.error('❌ Erro completo:', error);
      
      // Em caso de erro total, tentar usar apenas dados locais
      console.log('🆘 Fallback total para localStorage...');
      const localAppointments = JSON.parse(localStorage.getItem(`appointments_${user.id}`) || '[]');
      
      if (localAppointments.length > 0) {
        setAppointments(localAppointments);
        toast('⚠️ Usando apenas dados locais (erro de conexão)', 'warning');
      } else {
        setAppointments([]);
        toast(error.message || 'Erro ao buscar agendamentos', 'error');
      }
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
      
      // Limpar o formulário
      setEstablishment(null);
      setEstablishmentCode('');
      
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
    if (!establishmentId || !date) return;
    
    console.log('🔍 fetchExistingAppointments called with:');
    console.log('  establishmentId:', establishmentId);
    console.log('  date:', date);
    console.log('  professional:', professional);
    console.log('  current user:', user?.email);
    
    try {
      // ABORDAGEM 1: Tentar view pública (sem RLS)
      console.log('🔄 Tentativa 1: View pública...');
      const { data: publicData, error: publicError } = await supabase
        .from('appointment_availability')
        .select('appointment_date, appointment_time, duration, professional, status')
        .eq('establishment_id', establishmentId)
        .eq('appointment_date', date)
        .neq('status', 'cancelled');
        
      if (!publicError && publicData && publicData.length > 0) {
        console.log('✅ View pública funcionou! Total appointments:', publicData.length);
        console.log('📊 Public view data:', publicData);
        setExistingAppointments(publicData || []);
        return;
      }
      
      console.log('❌ View pública falhou ou vazia:', publicError);
      
      // ABORDAGEM 2: Query direta com diferentes parâmetros
      console.log('🔄 Tentativa 2: Query direta com diferentes estratégias...');
      
      // Tentar sem .from() usando SQL direto
      const { data: sqlData, error: sqlError } = await supabase
        .rpc('get_establishment_appointments', {
          establishment_id: establishmentId,
          appointment_date: date
        });
        
      if (!sqlError && sqlData) {
        console.log('✅ RPC SQL funcionou! Total appointments:', sqlData.length);
        console.log('📊 RPC data:', sqlData);
        setExistingAppointments(sqlData || []);
        return;
      }
      
      console.log('❌ RPC SQL falhou:', sqlError);
      
      // ABORDAGEM 3: Query direta normal
      console.log('🔄 Tentativa 3: Query direta normal...');
      const { data: directData, error: directError } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, duration, professional, status, client_id')
        .eq('establishment_id', establishmentId)
        .eq('appointment_date', date)
        .neq('status', 'cancelled');
        
      console.log('📊 Query direta - resultados:', directData);
      console.log('📊 Query direta - erro:', directError);
      
      if (directError) {
        console.warn('Query direta falhou:', directError);
      } else {
        console.log('✅ Query direta funcionou! Total appointments:', directData?.length);
        console.log('📊 Appointments for professional', professional, ':', directData?.filter((apt: any) => apt.professional === professional));
        setExistingAppointments(directData || []);
        return;
      }
      
      // ABORDAGEM 4: Tentar com RLS bypassado (se tivermos permissão)
      console.log('🔄 Tentativa 4: Bypass RLS...');
      const { data: adminData, error: adminError } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('appointment_date', date);
        
      console.log('📊 Admin query - resultados:', adminData);
      console.log('📊 Admin query - erro:', adminError);
      
      if (!adminError && adminData) {
        console.log('✅ Admin query funcionou! Total appointments:', adminData?.length);
        setExistingAppointments(adminData.filter((apt: any) => apt.status !== 'cancelled') || []);
        return;
      }
      
      // Se chegou aqui, algo está muito errado
      console.error('❌ Todas as tentativas falharam!');
      console.error('❌ Isso indica problema de RLS (Row Level Security) no Supabase');
      console.error('❌ SOLUÇÃO TEMPORÁRIA: Desativar RLS na tabela appointments');
      
      // Como fallback, definir array vazio para não quebrar a interface
      setExistingAppointments([]);
      
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      toast(error.message || 'Erro ao buscar agendamentos', 'error');
    }
  };

  useEffect(() => {
    if (establishment && appointmentDate) {
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
        toast('Estabelecimento não encontrado com este código', 'error');
        return;
      }
      
      setEstablishment(data);
      fetchExistingAppointments(data.id, appointmentDate, professional);
      toast(`Estabelecimento encontrado: ${data.name}`, 'success');
      
    } catch (error: any) {
      toast(error.message || 'Erro ao buscar estabelecimento', 'error');
      setEstablishment(null);
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

  return (
    <div className="min-h-screen bg-[#101112]">
      {/* Popup de Boas-vindas */}
      {showWelcomePopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg border border-gray-800 max-w-md w-full relative">
            <button 
              onClick={() => setShowWelcomePopup(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6 text-center">
              <img 
                src="/AGORA AGENDAR FICOU FACIL.svg" 
                alt="Agora agendar ficou fácil" 
                className="w-full h-auto max-h-80 mx-auto mb-4"
              />
              <button 
                onClick={() => setShowWelcomePopup(false)}
                className="btn-primary w-full mt-4"
              >
                Começar a usar
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-[#1a1b1c] border-b border-gray-800">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <span className="text-lg md:text-xl font-bold text-white">AgendaFácil</span>
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
                <span className="md:hidden">⭐ Favoritos</span>
                <span className="hidden md:inline">Meus Estabelecimentos</span>
              </button>
            </nav>
          </div>

          {activeTab === 'appointments' ? (
            <div className="animate-fade-in">
              {/* Último Estabelecimento Agendado */}
              {appointments.length > 0 && (
                <div className="mb-6 md:mb-8 p-4 md:p-6 rounded-lg bg-[#1a1b1c] border border-gray-800">
                  <h2 className="text-lg md:text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    Último Estabelecimento Agendado
                  </h2>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-base md:text-lg font-medium text-white">
                        {appointments[0].establishment_name}
                      </h3>
                      <p className="text-sm md:text-base text-gray-400">
                        Próximo agendamento: {format(parseISO(appointments[0].appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/establishment/${appointments[0].establishment_code}`)}
                      className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto text-sm md:text-base px-4 py-2"
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="hidden sm:inline">Agendar Novamente</span>
                      <span className="sm:hidden">Agendar</span>
                    </button>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                  <p className="text-gray-400">Você ainda não tem agendamentos</p>
                  <button
                    onClick={() => setActiveTab('book')}
                    className="mt-4 text-primary hover:underline font-medium"
                  >
                    Agendar agora
                  </button>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {appointments.map((appointment) => (
                    <div key={appointment.id} className="p-3 md:p-4 rounded-lg bg-[#242628] border border-gray-800">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-white text-sm md:text-base">{appointment.service}</h3>
                          <p className="text-xs md:text-sm text-gray-400">{appointment.establishment?.name}</p>
                          <p className="text-xs md:text-sm text-gray-400">Cliente: {appointment.client_name || user?.user_metadata?.full_name || 'Cliente'}</p>
                        </div>
                        {appointment.is_premium && (
                          <span className="px-2 py-1 text-xs font-medium bg-primary/20 text-primary rounded-full self-start">
                            Premium
                          </span>
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-gray-400 space-y-1 mb-3">
                        <p>Data: {format(new Date(appointment.appointment_date), 'dd/MM/yyyy')}</p>
                        <p>Horário: {appointment.appointment_time}</p>
                        <p>Profissional: {appointment.professional}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {appointment.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancelAppointment(appointment.id)}
                            className="btn-outline text-xs md:text-sm py-2 px-3 flex-1 sm:flex-none"
                          >
                            Cancelar
                          </button>
                        )}
                        <button
                          onClick={() => window.open(`https://wa.me/${appointment.establishment?.whatsapp}`, '_blank')}
                          className="btn-primary text-xs md:text-sm py-2 px-3 flex-1 sm:flex-none"
                        >
                          WhatsApp
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'book' ? (
            <div className="animate-fade-in">
              <div className="max-w-md mx-auto px-2">
                {!establishment ? (
                  <form onSubmit={handleSearchEstablishment} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Código do Estabelecimento
                      </label>
                      <input
                        type="text"
                        value={establishmentCode}
                        onChange={(e) => setEstablishmentCode(e.target.value)}
                        className="input-field text-sm md:text-base"
                        placeholder="Digite o código do estabelecimento"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching}
                      className={`btn-primary w-full py-3 text-sm md:text-base ${isSearching && 'opacity-50 cursor-not-allowed'}`}
                    >
                      {isSearching ? 'Buscando...' : 'Buscar Estabelecimento'}
                    </button>
                  </form>
                ) : (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-white mb-2">{establishment.name}</h3>
                      <p className="text-sm text-gray-400">{establishment.description}</p>
                    </div>

                    <form onSubmit={handleBookAppointment} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Nome do Cliente
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
                          Serviço
                        </label>
                        <select
                          value={selectedService?.id || ''}
                          onChange={e => {
                            const service = establishment?.services_with_prices.find(s => s.id === e.target.value);
                            setSelectedService(service || null);
                          }}
                          className="input-field"
                          required
                        >
                          <option value="">Selecione um serviço</option>
                          {establishment?.services_with_prices.map(service => (
                            <option key={service.id} value={service.id}>
                              {service.name} - R$ {service.price ? service.price.toFixed(2).replace('.', ',') : '0,00'} ({service.duration || 0}min)
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
                          onChange={e => setProfessional(e.target.value)}
                          className="input-field"
                          required
                        >
                          <option value="">Selecione um profissional</option>
                          {establishment?.professionals.map(prof => (
                            <option key={prof.id} value={prof.id}>{prof.name}</option>
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
                          onChange={(e) => setAppointmentDate(e.target.value)}
                          min={format(new Date(), 'yyyy-MM-dd')}
                          className="input-field"
                          required
                        />
                      </div>

                      {appointmentDate && selectedService && (
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Horário
                          </label>
                          <BusinessHoursSelector
                            value={appointmentTime}
                            onChange={setAppointmentTimeWithDebug}
                            selectedDate={new Date(appointmentDate + 'T00:00:00')}
                            businessHours={establishment?.business_hours || {}}
                            className="input-field"
                            existingAppointments={existingAppointments}
                            selectedProfessional={professional}
                            selectedServiceDuration={selectedService?.duration || 30}
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
                          {isBooking ? 'Agendando...' : 'Confirmar Agendamento'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ) : (
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
                                Salvo em {format(new Date(favorite.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
          )}
        </div>
      </main>
    </div>
  );
};

export default ClientDashboard;