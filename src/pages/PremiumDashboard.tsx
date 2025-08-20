import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
import { Calendar, Clock, Scissors, LogOut, Star, User, Plus, Trash2, Heart, Search, X, Crown, PlusCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { TimeSlotSelector } from '../components/TimeSlotSelector';
import type { Establishment } from '../types/supabase';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPermission } from '../components/NotificationPermission';
import { NotificationHistory } from '../components/NotificationHistory';

interface Appointment {
  id: string;
  created_at: string;
  establishment_id: string;
  service: string;
  professional: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  client_id: string;
  client_name: string;
  price: number;
  establishments: Establishment | null | undefined; // Definindo explicitamente o tipo establishments
}

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
  const navigate = useNavigate();
  const { notifyNewAppointment, notifyCancelledAppointment } = useNotifications();
  
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
  const [isBookingFlowStarted, setIsBookingFlowStarted] = useState(false); // Novo estado
  
  // Estados para favoritos
  const [favoriteEstablishments, setFavoriteEstablishments] = useState<FavoriteEstablishment[]>([]);
  const [isAddingFavorite, setIsAddingFavorite] = useState(false);

  // Estados para premium
  const [premiumEstablishmentCode, setPremiumEstablishmentCode] = useState('');
  const [premiumEstablishment, setPremiumEstablishment] = useState<Establishment | null>(null);
  const [clientPhone, setClientPhone] = useState('');
  const [isActivatingPremium, setIsActivatingPremium] = useState(false);
  const [isPremiumSearching, setIsPremiumSearching] = useState(false);
  const [currentPremiumStatus, setCurrentPremiumStatus] = useState<any>(null);

  useEffect(() => {
    fetchAppointments();
    loadFavoriteEstablishments();
    checkPremiumStatus();
  }, [user]);

  useEffect(() => {
    // Reset booking flow when changing tabs away from 'book'
    if (activeTab !== 'book') {
      setIsBookingFlowStarted(false);
      setEstablishment(null); // Also reset establishment when leaving book tab
      setEstablishmentCode('');
    }
  }, [activeTab]);

  // DESABILITADO TEMPORARIAMENTE - estava causando problema de voltar após remoção
  // useEffect(() => {
  //   if (user && activeTab === 'premium') {
  //     console.log('🔄 Aba Premium ativada - Verificando status...');
  //     checkPremiumStatus();
  //   }
  // }, [user, activeTab]);

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
      toast(error.message || 'Erro ao buscar agendamentos');
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
        toast('Este estabelecimento já está nos seus favoritos');
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
      
      toast.success('Estabelecimento adicionado aos favoritos!');
      
    } catch (error: any) {
      toast('Erro ao adicionar aos favoritos');
    } finally {
      setIsAddingFavorite(false);
    }
  };

  const handleRemoveFromFavorites = (favoriteId: string) => {
    const updatedFavorites = favoriteEstablishments.filter(fav => fav.id !== favoriteId);
    saveFavoriteEstablishments(updatedFavorites);
    toast.success('Estabelecimento removido dos favoritos');
  };

  const handleSelectFavoriteEstablishment = (favorite: FavoriteEstablishment) => {
    setEstablishment(favorite.establishment_data);
    setEstablishmentCode(favorite.establishment_code);
    fetchExistingAppointments(favorite.establishment_id, appointmentDate, professional);
    setActiveTab('book');
    setIsBookingFlowStarted(true); // Iniciar fluxo de agendamento ao selecionar favorito
    toast.success(`Estabelecimento selecionado: ${favorite.establishment_name}`);
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
      toast(error.message || 'Erro ao buscar agendamentos existentes');
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
      toast('Por favor, informe o código do estabelecimento');
      return;
    }
    
    setIsSearching(true);
    
    try {
      const { data, error } = await getEstablishmentByCode(establishmentCode.trim());
      
      if (error) {
        throw error;
      }
      
      if (!data) {
        toast('Estabelecimento não encontrado');
        return;
      }
      
      // Criar slug para redirecionamento
      const generateSlug = (name: string, code: string) => {
        const nameSlug = name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/[^a-z0-9]/g, '') // Remove caracteres especiais
          .slice(0, 20); // Limita tamanho
        return `${nameSlug}${code}`;
      };
      
      const slug = generateSlug(data.name, data.code);
      
      // Redirecionar para página dinâmica
      navigate(`/${slug}`);
      
    } catch (error: any) {
      toast(error.message || 'Erro ao buscar estabelecimento');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !establishment) return;
    if (!appointmentTime || !selectedService || !professional || !appointmentDate || !clientName) {
      toast('Preencha todos os campos para agendar');
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
        toast.error('Conflito de horário detectado! Recarregue a página e tente novamente.');
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
      
      // Enviar notificação de novo agendamento
      console.log('🔔 ENVIANDO NOTIFICAÇÃO:', { clientName, service: selectedService.name, time: appointmentTime });
      notifyNewAppointment(clientName, selectedService.name, appointmentTime);
      
      toast.success('Agendamento criado com sucesso!');
      
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
      setIsBookingFlowStarted(false); // Resetar fluxo de agendamento
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar agendamento');
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

      // Encontrar o agendamento cancelado para notificação
      const cancelledAppointment = appointments.find(apt => apt.id === appointmentId);
      if (cancelledAppointment) {
        notifyCancelledAppointment(
          cancelledAppointment.client_name,
          cancelledAppointment.service,
          cancelledAppointment.appointment_time
        );
      }
      
      toast.success('Agendamento cancelado com sucesso');
      
      // Aguardar um pouco e recarregar
      setTimeout(() => {
        fetchAppointments();
      }, 500);
      
      fetchAppointments();
    } catch (error: any) {
      console.error('❌ Error cancelling appointment:', error);
      toast.error(error.message || 'Erro ao cancelar agendamento');
    }
  };

  const handleSearchPremiumEstablishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!premiumEstablishmentCode.trim()) {
      toast('Por favor, informe o código do estabelecimento');
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
        toast('Estabelecimento não encontrado. Verifique o código.');
        return;
      }
      
      setPremiumEstablishment(data);
      toast.success(`Estabelecimento encontrado: ${data.name}`);
      
    } catch (error: any) {
      toast(error.message || 'Erro ao buscar estabelecimento');
    } finally {
      setIsPremiumSearching(false);
    }
  };

  const handleActivatePremium = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !premiumEstablishment || !clientName.trim() || !clientPhone.trim()) {
      toast('Por favor, preencha todos os campos');
      return;
    }

    setIsActivatingPremium(true);

    try {
      console.log('🔍 VERIFICANDO PREMIUM EXISTENTE:');
      console.log('  - User ID:', user.id);
      console.log('  - Establishment ID:', premiumEstablishment.id);
      
      // Verificar se já tem premium ativo NESTE estabelecimento específico
      const { data: existing, error: checkError } = await supabase
        .from('premium_subscriptions')
        .select(`
          *,
          establishments (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('establishment_id', premiumEstablishment.id)
        .maybeSingle(); // Usar maybeSingle() em vez de single() para evitar erro quando não existe

      console.log('📋 RESULTADO DA VERIFICAÇÃO:');
      console.log('  - Erro:', checkError);
      console.log('  - Dados:', existing);

      if (checkError) {
        console.error('❌ ERRO NA VERIFICAÇÃO:', checkError);
        // Se der erro, mas não for "PGRST116" (not found), tratar como erro real
        if (checkError.code !== 'PGRST116') {
          throw checkError;
        }
        console.log('ℹ️ Erro PGRST116 ignorado (normal quando não existe registro)');
      }

      if (existing) {
        const establishmentName = existing.establishments?.name || premiumEstablishment.name;
        console.log('⚠️ JÁ EXISTE PREMIUM:', establishmentName);
        toast(`Você já é premium em ${establishmentName}!`);
        return;
      }

      console.log('✅ PODE ATIVAR PREMIUM - Procedendo...');

      // Ativar premium
      const { error: insertError } = await supabase
        .from('premium_subscriptions')
        .insert({
          user_id: user.id,
          establishment_id: premiumEstablishment.id,
          display_name: clientName,
          whatsapp: clientPhone
        });

      if (insertError) {
        console.error('❌ ERRO AO INSERIR:', insertError);
        throw insertError;
      }

      console.log('🎉 PREMIUM ATIVADO COM SUCESSO');
      toast.success(`🎉 Premium ativado com sucesso em ${premiumEstablishment.name}!`);
      
      // Limpar formulário e atualizar status
      setPremiumEstablishmentCode('');
      setPremiumEstablishment(null);
      setClientName('');
      setClientPhone('');
      
      // Aguardar e verificar status
      setTimeout(() => {
        console.log('🔄 Verificando status após ativação...');
        checkPremiumStatus();
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ ERRO AO ATIVAR PREMIUM:', error);
      toast(error.message || 'Erro ao ativar premium');
    } finally {
      setIsActivatingPremium(false);
    }
  };

  const checkPremiumStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('premium_subscriptions')
        .select(`
          *,
          establishments (
            name,
            code,
            description
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (data && !error) {
        setCurrentPremiumStatus(data);
      }
    } catch (error) {
      // Não tem premium ativo, normal
      setCurrentPremiumStatus(null);
    }
  };

  const handleRemovePremium = async () => {
    if (!currentPremiumStatus) {
      toast('Nenhum premium ativo para remover');
      return;
    }
    
    const establishmentName = currentPremiumStatus.establishments?.name || 'este estabelecimento';
    
    if (!confirm(`🚨 CONFIRMAÇÃO DE REMOÇÃO\n\nTem certeza que deseja remover seu premium do estabelecimento "${establishmentName}"?\n\n⚠️ Esta ação:\n- Remove você da lista de clientes premium\n- Não pode ser desfeita\n- É permanente\n\nDeseja continuar?`)) return;
    
    try {
      console.log('️ INICIANDO REMOÇÃO DE PREMIUM:');
      console.log('  - ID do registro:', currentPremiumStatus.id);
      console.log('  - User ID:', user?.id);
      console.log('  - Establishment ID:', currentPremiumStatus.establishment_id);
      console.log('  - Estabelecimento:', establishmentName);
      
      // ESTRATÉGIA 1: Deletar por user_id + establishment_id (mais seguro para RLS)
      const { data: deleteData, error: deleteError } = await supabase
        .from('premium_subscriptions')
        .delete()
        .eq('user_id', user?.id)
        .eq('establishment_id', currentPremiumStatus.establishment_id)
        .select(); // Retorna os registros deletados

      console.log('🔍 RESULTADO DA DELEÇÃO (por user_id):');
      console.log('  - Erro:', deleteError);
      console.log('  - Dados deletados:', deleteData);
      
      if (deleteError) {
        console.error('❌ ERRO AO DELETAR POR USER_ID:', deleteError);
        
        // ESTRATÉGIA 2: Se falhar, tentar por ID direto
        console.log('🔄 TENTANDO DELEÇÃO POR ID DIRETO...');
        const { data: deleteData2, error: deleteError2 } = await supabase
          .from('premium_subscriptions')
          .delete()
          .eq('id', currentPremiumStatus.id)
          .select();
          
        console.log('🔍 RESULTADO DA DELEÇÃO (por ID):');
        console.log('  - Erro:', deleteError2);
        console.log('  - Dados deletados:', deleteData2);
        
        if (!deleteData2 || deleteData2.length === 0) {
          throw new Error('Nenhum registro foi deletado. Possível problema de permissão RLS.');
        }
        
        console.log(`✅ SUCESSO (Estratégia 2): ${deleteData2.length} registro(s) deletado(s)`);
      } else {
        if (!deleteData || deleteData.length === 0) {
          throw new Error('Nenhum registro foi deletado. Possível problema de permissão RLS.');
        }
        
        console.log(`✅ SUCESSO (Estratégia 1): ${deleteData.length} registro(s) deletado(s)`);
      }
      
      console.log('✅ DELEÇÃO CONCLUÍDA - Limpando estados...');
      
      // Limpar TODOS os estados relacionados IMEDIATAMENTE
      setCurrentPremiumStatus(null);
      setPremiumEstablishmentCode('');
      setPremiumEstablishment(null);
      setClientName('');
      setClientPhone('');
      
      // Mostrar sucesso
      toast.success(`✅ Premium removido com sucesso!\n\nVocê foi removido da lista de clientes premium do estabelecimento "${establishmentName}".`);
      
      console.log('🎉 REMOÇÃO CONCLUÍDA COM SUCESSO - NÃO vai chamar checkPremiumStatus');
      
    } catch (error: any) {
      console.error('❌ ERRO COMPLETO NA REMOÇÃO:', error);
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      toast.error(`❌ Erro ao remover premium: ${error.message}`);
      
      // Se der erro, forçar verificação do status real após delay
      setTimeout(() => {
        console.log('🔄 Verificando status real após erro...');
        checkPremiumStatus();
      }, 2000);
    }
  };

  // Função para testar permissões
  const testPermissions = async () => {
    if (!user) return;
    
    try {
      console.log('🔍 TESTANDO PERMISSÕES:');
      console.log('  - Usuário ID:', user.id);
      
      // Testar SELECT
      const { data: selectData, error: selectError } = await supabase
        .from('premium_subscriptions')
        .select('*')
        .eq('user_id', user.id);
      
      console.log('📖 SELECT TEST:');
      console.log('  - Erro:', selectError);
      console.log('  - Dados:', selectData);
      
      // Testar permissão de DELETE
      const { data: deleteTestData, error: deleteTestError } = await supabase
        .from('premium_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('id', 'test-id-that-does-not-exist');
      
      console.log('🗑️ DELETE TEST (fake ID):');
      console.log('  - Erro:', deleteTestError);
      console.log('  - Resultado:', deleteTestData);
      
      toast('Teste de permissões concluído - veja o console');
      
    } catch (error) {
      console.error('❌ ERRO NO TESTE:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso!');
      navigate('/login');
    } catch (error) {
      toast.error('Erro ao fazer logout');
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
              <NotificationPermission className="hidden sm:flex" />
            <NotificationHistory />
              <span className="text-gray-400 text-sm md:text-base hidden sm:block">{user?.email}</span>
              <button onClick={handleSignOut} className="btn-outline text-sm md:text-base px-3 py-1 md:px-4 md:py-2">
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

                          {appointment.establishments && (
                            <>
                              {appointment.establishments.pix_payment_link && (
                                <button
                                  onClick={() => window.open(appointment.establishments.pix_payment_link, '_blank')}
                                  className="btn-primary text-sm py-1 order-1 md:order-2"
                                >
                                  Pagar com Pix
                                </button>
                              )}

                              {appointment.establishments.review_link && (
                                <button
                                  onClick={() => window.open(appointment.establishments.review_link, '_blank')}
                                  className="btn-secondary text-sm py-1 order-3 md:order-3"
                                >
                                  Avalie no Google
                                </button>
                              )}
                              
                              {appointment.establishments.affiliate_link && (
                                <button
                                  onClick={() => window.open(appointment.establishments.affiliate_link, '_blank')}
                                  className="btn-outline text-sm py-1 order-4 md:order-4"
                                >
                                  Ver link
                                </button>
                              )}
                            </>
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
              
              {!isBookingFlowStarted ? (
                <div className="text-center py-8">
                  <PlusCircle className="h-12 w-12 mx-auto mb-2 text-gray-400 opacity-30" />
                  <p className="text-gray-400">Clique para iniciar um novo agendamento</p>
                  <button
                    onClick={() => setIsBookingFlowStarted(true)}
                    className="mt-4 btn-primary font-medium"
                  >
                    Iniciar Novo Agendamento
                  </button>
                </div>
              ) : (
                <>
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
                              selectedService={selectedService}
                              existingAppointments={existingAppointmentsForSlots}
                              onTimeSelect={setAppointmentTimeWithDebug}
                              selectedTime={appointmentTime}
                              businessHours={establishment.business_hours[new Date(appointmentDate).getDay().toString()] || {
                                enabled: false, open1: '08:00', close1: '18:00', open2: null, close2: null
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
                              setIsBookingFlowStarted(false); // Voltar para o botão inicial
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
                </>
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

                {/* Status Premium Atual */}
                {currentPremiumStatus ? (
                  <div className="mb-6 p-4 bg-[#242628] rounded-lg border border-gray-700">
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-yellow-500" />
                      Status Premium Atual
                    </h3>
                    <div className="text-sm text-gray-400 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span>Você é premium do estabelecimento: <strong className="text-white">{currentPremiumStatus.establishments?.name}</strong></span>
                      </div>
                      <p className="mb-1">Código: <strong className="text-white">{currentPremiumStatus.establishments?.code}</strong></p>
                      <p className="mb-1">Nome cadastrado: <strong className="text-white">{currentPremiumStatus.display_name}</strong></p>
                      <p className="mb-1">WhatsApp: <strong className="text-white">{currentPremiumStatus.whatsapp}</strong></p>
                      <p className="text-xs text-gray-500">Cadastrado em: {new Date(currentPremiumStatus.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="btn-outline text-sm flex-1"
                        onClick={() => checkPremiumStatus()}
                      >
                        🔄 Atualizar Status
                      </button>
                      <button 
                        className="btn-outline text-sm text-red-400 hover:text-red-300 border-red-800 hover:border-red-700"
                        onClick={handleRemovePremium}
                      >
                        🗑️ Remover Premium
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Para trocar de estabelecimento, remova o premium atual primeiro.
                    </p>
                  </div>
                ) : (
                  <div className="mb-6 p-4 bg-[#1a1b1c] rounded-lg border border-gray-800">
                    <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-gray-500" />
                      Status Premium
                    </h3>
                    <div className="text-sm text-gray-400 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <span>Você ainda não é premium de nenhum estabelecimento</span>
                      </div>
                      <p className="text-xs">Use o formulário abaixo para se tornar premium de um estabelecimento.</p>
                    </div>
                    <button 
                      className="btn-outline text-sm w-full"
                      onClick={() => checkPremiumStatus()}
                    >
                      🔄 Verificar Status Premium
                    </button>
                    <button 
                      className="btn-outline text-sm w-full mt-2 text-red-400 border-red-800"
                      onClick={async () => {
                        if (!user) return;
                        if (!confirm('🚨 ATENÇÃO: Isso vai remover TODOS os registros premium deste usuário!\n\nContinuar?')) return;
                        
                        try {
                          console.log('🧹 LIMPEZA FORÇADA - Removendo TODOS os registros do usuário:', user.id);
                          
                          const { data, error } = await supabase
                            .from('premium_subscriptions')
                            .delete()
                            .eq('user_id', user.id)
                            .select();
                          
                          console.log('🗑️ RESULTADO DA LIMPEZA:');
                          console.log('  - Erro:', error);
                          console.log('  - Registros removidos:', data);
                          
                          if (error) {
                            toast.error(`Erro na limpeza: ${error.message}`);
                          } else {
                            toast.success(`🧹 Limpeza concluída! ${data?.length || 0} registro(s) removido(s)`);
                            setCurrentPremiumStatus(null);
                            setPremiumEstablishmentCode('');
                            setPremiumEstablishment(null);
                            setClientName('');
                            setClientPhone('');
                          }
                        } catch (error: any) {
                          console.error('❌ ERRO NA LIMPEZA:', error);
                          toast.error(`Erro na limpeza: ${error.message}`);
                        }
                      }}
                    >
                      🧹 Limpeza Forçada (DEBUG)
                    </button>
                  </div>
                )}

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