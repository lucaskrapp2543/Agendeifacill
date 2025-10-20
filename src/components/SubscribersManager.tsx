import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit, Plus, Trash2, Users, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createIndependentSubscriber,
  getEstablishmentSubscribers,
  removeSubscriber
} from '../lib/subscriberSystem';
import { createSubscription, deleteSubscription, getClientSubscriptions, getSubscriptions, supabase } from '../lib/supabase'; // Adicionar esta importação
import { Database } from '../types/supabase';
import { ClientRecoveryModal } from './ClientRecoveryModal';
import { useToast } from './ui/Toaster';

type Subscription = Database['public']['Tables']['subscriptions']['Row'];
type ClientSubscription = Database['public']['Tables']['client_subscriptions']['Row'] & {
  subscriptions: Subscription;
  profiles: { full_name: string; is_subscriber: boolean };
};
type Profile = Database['public']['Tables']['profiles']['Row'];

interface Client {
  id: string;
  whatsapp: string;
  name: string;
  appointmentCount: number;
  isSubscriber: boolean;
}

interface SubscribersManagerProps {
  establishmentId: string;
  clients: Client[]; // Usar Client ao invés de Profile
  onClientUpdated?: () => void; // Nova prop para notificar atualizações
  establishment?: {
    limit_subscriber_bookings?: boolean;
    prevent_same_day_reschedule?: boolean;
    limit_subscribers_one_week?: boolean;
  };
  onEstablishmentUpdate?: () => void;
}

export const SubscribersManager: React.FC<SubscribersManagerProps> = ({ establishmentId, clients, onClientUpdated, establishment, onEstablishmentUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [clientSubscriptions, setClientSubscriptions] = useState<ClientSubscription[]>([]);
  // const [clients, setClients] = useState<Profile[]>([]); // REMOVIDO: Agora vem via prop

  const [newSubscriptionName, setNewSubscriptionName] = useState('');
  const [newSubscriptionValue, setNewSubscriptionValue] = useState<number>(0);
  const [newFixedCommissionValue, setNewFixedCommissionValue] = useState<number>(0);
  const [newSubscriptionDuration, setNewSubscriptionDuration] = useState<number>(30); // Duração em minutos
  const [newSubscriptionWeekdays, setNewSubscriptionWeekdays] = useState<string[]>([]);
  const [newSubscriptionDescription, setNewSubscriptionDescription] = useState(''); // Nova descrição

  const [selectedSubscriptionToAdd, setSelectedSubscriptionToAdd] = useState<string>('');
  const [selectedClientToAdd, setSelectedClientToAdd] = useState<string>('');

  // Novos campos para adicionar assinante
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // Estado para controlar limitação de agendamentos de assinantes
  const [limitSubscriberBookings, setLimitSubscriberBookings] = useState(
    establishment?.limit_subscriber_bookings || false
  );
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  // Estado para controlar limitação de remarcação no mesmo dia
  const [preventSameDayReschedule, setPreventSameDayReschedule] = useState(
    establishment?.prevent_same_day_reschedule || false
  );
  const [isUpdatingSameDayLimit, setIsUpdatingSameDayLimit] = useState(false);

  // Estado para controlar limitação de 1 agendamento por semana
  const [limitSubscribersOneWeek, setLimitSubscribersOneWeek] = useState(
    establishment?.limit_subscribers_one_week || false
  );
  const [isUpdatingOneWeekLimit, setIsUpdatingOneWeekLimit] = useState(false);


  // Estados para funcionalidade de Adicionar Atendimento
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(false);
  const [selectedClientForAttendance, setSelectedClientForAttendance] = useState<ClientSubscription | null>(null);
  const [attendanceDate, setAttendanceDate] = useState('');
  const [attendanceProfessional, setAttendanceProfessional] = useState('');
  const [attendanceValue, setAttendanceValue] = useState<number>(0);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [subscriberAttendances, setSubscriberAttendances] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);

  // Estados para modal de visualizar atendimentos
  const [showViewAttendancesModal, setShowViewAttendancesModal] = useState(false);
  const [selectedClientForView, setSelectedClientForView] = useState<ClientSubscription | null>(null);

  // Estados para modal de edição de datas
  const [showEditEndDateModal, setShowEditEndDateModal] = useState(false);
  const [selectedClientForEdit, setSelectedClientForEdit] = useState<ClientSubscription | null>(null);
  const [newEndDate, setNewEndDate] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [isSavingEndDate, setIsSavingEndDate] = useState(false);

  // Estados para modal de limite simples
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectedClientForLimit, setSelectedClientForLimit] = useState<ClientSubscription | null>(null);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [isSavingLimit, setIsSavingLimit] = useState(false);

  // Estado para barra de pesquisa
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para edição de descrições
  const [showEditDescriptionModal, setShowEditDescriptionModal] = useState(false);
  const [selectedSubscriptionForEdit, setSelectedSubscriptionForEdit] = useState<Subscription | null>(null);
  const [editDescription, setEditDescription] = useState('');


  // Sincronizar estado quando establishment mudar
  useEffect(() => {
    if (establishment?.limit_subscriber_bookings !== undefined) {
      setLimitSubscriberBookings(establishment.limit_subscriber_bookings);
    }
    if (establishment?.prevent_same_day_reschedule !== undefined) {
      setPreventSameDayReschedule(establishment.prevent_same_day_reschedule);
    }
    if (establishment?.limit_subscribers_one_week !== undefined) {
      setLimitSubscribersOneWeek(establishment.limit_subscribers_one_week);
    }
  }, [establishment?.limit_subscriber_bookings, establishment?.prevent_same_day_reschedule, establishment?.limit_subscribers_one_week]);

  // Função para atualizar limitação de agendamentos de assinantes
  const handleUpdateSubscriberBookingLimit = async (newLimit: boolean) => {
    setIsUpdatingLimit(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ limit_subscriber_bookings: newLimit })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro ao atualizar limitação de agendamentos:', error);
        toast.error('Erro ao atualizar configuração de agendamentos.');
        return;
      }

      setLimitSubscriberBookings(newLimit);
      toast.success(
        newLimit
          ? 'Assinantes agora só podem agendar dentro da mesma semana.'
          : 'Assinantes podem agendar qualquer data disponível.'
      );

      // Notificar o componente pai sobre a atualização
      if (onEstablishmentUpdate) {
        onEstablishmentUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar limitação de agendamentos:', error);
      toast.error('Erro ao atualizar configuração de agendamentos.');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  // Função para atualizar limitação de remarcação no mesmo dia
  const handleUpdatePreventSameDayReschedule = async (newLimit: boolean) => {
    setIsUpdatingSameDayLimit(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ prevent_same_day_reschedule: newLimit })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro ao atualizar limitação de remarcação no mesmo dia:', error);
        toast.error('Erro ao atualizar configuração de remarcação.');
        return;
      }

      setPreventSameDayReschedule(newLimit);
      toast.success(
        newLimit
          ? 'Assinantes não podem mais remarcar no mesmo dia após cancelar.'
          : 'Assinantes podem cancelar e remarcar livremente.'
      );

      // Notificar o componente pai sobre a atualização
      if (onEstablishmentUpdate) {
        onEstablishmentUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar limitação de remarcação no mesmo dia:', error);
      toast.error('Erro ao atualizar configuração de remarcação.');
    } finally {
      setIsUpdatingSameDayLimit(false);
    }
  };

  // Função para atualizar configuração de 1 agendamento por semana
  const handleUpdateOneWeekLimit = async (newLimit: boolean) => {
    setIsUpdatingOneWeekLimit(true);
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ limit_subscribers_one_week: newLimit })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro ao atualizar limitação de 1 agendamento por semana:', error);
        toast.error('Erro ao atualizar configuração de 1 agendamento por semana.');
        return;
      }

      setLimitSubscribersOneWeek(newLimit);
      toast.success(
        newLimit
          ? 'Assinantes limitados a 1 agendamento por semana.'
          : 'Assinantes podem fazer múltiplos agendamentos por semana.'
      );

      // Notificar o componente pai sobre a atualização
      if (onEstablishmentUpdate) {
        onEstablishmentUpdate();
      }
    } catch (error) {
      console.error('Erro ao atualizar limitação de 1 agendamento por semana:', error);
      toast.error('Erro ao atualizar configuração de 1 agendamento por semana.');
    } finally {
      setIsUpdatingOneWeekLimit(false);
    }
  };


  // Função para buscar profissionais do estabelecimento
  const fetchProfessionals = async () => {
    try {
      console.log('🔍 Buscando profissionais do estabelecimento:', establishmentId);

      // Buscar o estabelecimento com os profissionais
      const { data: establishmentData, error: establishmentError } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', establishmentId)
        .single();

      if (establishmentError) {
        console.error('Erro ao buscar estabelecimento:', establishmentError);
        setProfessionals([]);
        return;
      }

      console.log('🏢 Estabelecimento encontrado:', establishmentData);
      console.log('👥 Profissionais do estabelecimento:', establishmentData.professionals);

      // Os profissionais estão em establishment.professionals como array JSONB
      const professionals = (establishmentData.professionals || []).map((prof: any) => ({
        id: prof.id || prof.name, // Usar id se existir, senão usar name como id
        full_name: prof.name
      }));

      console.log('✅ Profissionais mapeados:', professionals);
      setProfessionals(professionals);

    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
      setProfessionals([]);
    }
  };

  // Função para buscar atendimentos de assinantes
  const fetchSubscriberAttendances = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriber_attendances')
        .select(`
          id,
          professional_name,
          attendance_date,
          repass_value,
          created_at,
          client_subscription_id
        `)
        .eq('establishment_id', establishmentId)
        .order('attendance_date', { ascending: false });

      if (error) {
        console.error('Erro ao buscar atendimentos de assinantes:', error);
        return;
      }

      console.log('📋 Atendimentos encontrados:', data);
      setSubscriberAttendances(data || []);
    } catch (error) {
      console.error('Erro ao buscar atendimentos de assinantes:', error);
    }
  };

  // Função para buscar atendimentos de um cliente específico
  const getClientAttendances = (clientSubscriptionId: string) => {
    return subscriberAttendances.filter(attendance =>
      attendance.client_subscription_id === clientSubscriptionId
    );
  };

  // Função para agrupar atendimentos por profissional
  const getClientAttendancesByProfessional = (clientSubscriptionId: string) => {
    const attendances = getClientAttendances(clientSubscriptionId);
    const grouped = attendances.reduce((acc, attendance) => {
      const professional = attendance.professional_name;
      if (!acc[professional]) {
        acc[professional] = {
          count: 0,
          totalValue: 0,
          attendances: []
        };
      }
      acc[professional].count++;
      acc[professional].totalValue += parseFloat(attendance.repass_value) || 0;
      acc[professional].attendances.push(attendance);
      return acc;
    }, {} as { [key: string]: { count: number; totalValue: number; attendances: any[] } });

    return grouped;
  };

  // Função para adicionar atendimento
  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientForAttendance || !attendanceDate || !attendanceProfessional || !attendanceValue) {
      toast.error('Preencha todos os campos para adicionar o atendimento.');
      return;
    }

    setIsSavingAttendance(true);
    try {
      const { error } = await supabase
        .from('subscriber_attendances')
        .insert({
          establishment_id: establishmentId,
          client_subscription_id: selectedClientForAttendance.id,
          professional_name: attendanceProfessional,
          attendance_date: attendanceDate,
          repass_value: attendanceValue,
          created_by: user?.id
        });

      if (error) {
        throw error;
      }

      toast.success(`Atendimento adicionado: ${attendanceProfessional} atendeu ${selectedClientForAttendance.profiles?.full_name} no dia ${new Date(attendanceDate).toLocaleDateString('pt-BR')} e recebeu ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(attendanceValue)}.`);

      // Limpar formulário
      setAttendanceDate('');
      setAttendanceProfessional('');
      setAttendanceValue(0);
      setShowAddAttendanceModal(false);
      setSelectedClientForAttendance(null);

      // Recarregar dados
      await fetchSubscriberAttendances();

    } catch (error: any) {
      console.error('Erro ao adicionar atendimento:', error);
      toast.error(error.message || 'Erro ao adicionar atendimento.');
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Função para remover atendimento
  const handleRemoveAttendance = async (attendanceId: string, professionalName: string, attendanceDate: string, repassValue: number) => {
    if (!confirm(`Tem certeza que deseja remover o atendimento de ${professionalName} em ${new Date(attendanceDate).toLocaleDateString('pt-BR')} (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(repassValue)})?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriber_attendances')
        .delete()
        .eq('id', attendanceId);

      if (error) {
        throw error;
      }

      toast.success('Atendimento removido com sucesso!');

      // Recarregar dados
      await fetchSubscriberAttendances();

    } catch (error: any) {
      console.error('Erro ao remover atendimento:', error);
      toast.error(error.message || 'Erro ao remover atendimento.');
    }
  };

  // Funções de fetch
  const fetchSubscriptions = async () => {
    const { data, error } = await getSubscriptions(establishmentId);
    if (error) {
      console.error('Erro ao buscar tipos de assinatura:', error);
      toast.error('Erro ao carregar tipos de assinatura.');
    } else {
      setSubscriptions(data || []);
    }
  };

  const fetchClientSubscriptions = async () => {
    try {
      // Usar o novo sistema independente de assinantes
      const { data: newSubscribers, error: newError } = await getEstablishmentSubscribers(establishmentId);

      if (newError) {
        console.error('Erro ao buscar assinantes (novo sistema):', newError);
        // Fallback para o sistema antigo se necessário
        const { data: oldData, error: oldError } = await getClientSubscriptions(establishmentId, {});
        if (oldError) {
          console.error('Erro ao buscar assinantes (sistema antigo):', oldError);
          toast.error('Erro ao carregar assinantes.');
          return;
        }
        setClientSubscriptions(oldData || []);
        return;
      }

      // Transformar dados do novo sistema para o formato esperado
      const transformedSubscribers = (newSubscribers || []).map(subscriber => ({
        ...subscriber,
        profiles: {
          full_name: subscriber.subscriber_name || 'Cliente Desconhecido',
          email: subscriber.subscriber_email || null,
          is_subscriber: true
        },
        client_whatsapp: subscriber.subscriber_whatsapp || 'N/A'
      }));

      console.log('📋 Assinantes carregados (novo sistema):', transformedSubscribers.length);
      setClientSubscriptions(transformedSubscribers);
    } catch (error) {
      console.error('Erro ao buscar assinantes:', error);
      toast.error('Erro ao carregar assinantes.');
    }
  };

  // REMOVIDO: A função fetchClients não é mais necessária aqui, pois os clientes vêm via prop
  /*
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, user_id')
        .eq('role', 'client');

      if (error) throw error;
      setClients(data as Profile[] || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      toast.error('Erro ao carregar clientes.');
    }
  };
  */

  useEffect(() => {
    if (establishmentId) {
      fetchSubscriptions();
      fetchClientSubscriptions();
      fetchProfessionals();
      fetchSubscriberAttendances();
      // fetchClients(); // REMOVIDO

      // Recuperação automática de clientes na inicialização
      const autoRecover = async () => {
        try {
          const { autoRecoverClients } = await import('../utils/recoverClientsFromAppointments');
          const result = await autoRecoverClients(establishmentId);

          if (result.recovered > 0) {
            console.log(`🔄 Recuperação automática: ${result.recovered} clientes migrados`);
            // Recarregar dados após recuperação
            fetchClientSubscriptions();
            if (onClientUpdated) onClientUpdated();
          }
        } catch (error) {
          console.error('Erro na recuperação automática:', error);
        }
      };

      // Executar recuperação automática após um pequeno delay
      const timeoutId = setTimeout(autoRecover, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [establishmentId]);


  // Handlers para criação de assinatura
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubscriptionName || !newSubscriptionValue || !newSubscriptionDuration || newSubscriptionWeekdays.length === 0) {
      toast.error('Preencha todos os campos para criar uma assinatura.');
      return;
    }
    try {
      const { error } = await createSubscription(
        establishmentId,
        newSubscriptionName,
        newSubscriptionValue,
        1, // Duração fixa de 1 mês (não será mais usada)
        newSubscriptionWeekdays, // Adicionar os dias da semana
        newSubscriptionDuration, // Adicionar a duração do serviço
        newFixedCommissionValue, // Valor fixo de comissão por serviço diário
        newSubscriptionDescription // Adicionar descrição
      );
      if (error) {
        throw error;
      }
      toast.success('Assinatura criada com sucesso!');
      setNewSubscriptionName('');
      setNewSubscriptionValue(0);
      setNewFixedCommissionValue(0);
      setNewSubscriptionDuration(30); // Reset para 30 minutos
      setNewSubscriptionWeekdays([]);
      setNewSubscriptionDescription(''); // Limpar descrição
      fetchSubscriptions(); // Atualiza a lista
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      toast.error(error.message || 'Erro ao criar assinatura.');
    }
  };


  // Handler para adicionar assinante usando o novo sistema independente
  const handleAddClientSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubscriptionToAdd || !newClientName || !newClientPhone || !startDate || !endDate) {
      toast('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    try {
      console.log('✅ Adicionando assinante independente:', {
        name: newClientName,
        phone: newClientPhone,
        email: newClientEmail,
        startDate,
        endDate,
        subscriptionId: selectedSubscriptionToAdd
      });

      // Normalizar número de telefone (remover formatação)
      const normalizedPhone = newClientPhone.replace(/\D/g, '');

      // Usar o novo sistema independente de assinantes
      const { data, error } = await createIndependentSubscriber({
        name: newClientName,
        whatsapp: normalizedPhone,
        email: newClientEmail || undefined,
        subscription_id: selectedSubscriptionToAdd,
        establishment_id: establishmentId,
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        throw error;
      }

      toast(`✅ ${newClientName} adicionado como assinante!`, 'success');

      // Limpar formulário
      setSelectedSubscriptionToAdd('');
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setStartDate('');
      setEndDate('');

      // Recarregar lista de assinantes
      await fetchClientSubscriptions();

    } catch (error: any) {
      console.error('Erro ao adicionar assinante:', error);
      toast(error.message || 'Erro ao adicionar assinante.', 'error');
    }
  };

  // Handler para mudar status de pagamento
  const handleTogglePaymentStatus = async (clientSubscription: ClientSubscription, newStatus: 'paid' | 'unpaid') => {
    // Se o status não mudou, não fazer nada
    if (clientSubscription.payment_status === newStatus) {
      return;
    }

    try {
      console.log('🔥 FORÇANDO atualização do status:', {
        id: clientSubscription.id,
        newStatus,
        currentStatus: clientSubscription.payment_status
      });

      // FORÇAR atualização direta no banco - SEM lógica automática
      const { error } = await supabase
        .from('client_subscriptions')
        .update({
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', clientSubscription.id);

      if (error) {
        throw error;
      }

      console.log('✅ Status FORÇADO para:', newStatus);
      toast(`Status FORÇADO para ${newStatus === 'paid' ? 'Pago' : 'Não Pago'}!`, 'success');
      fetchClientSubscriptions(); // Atualiza a lista
    } catch (error: any) {
      console.error('Erro ao atualizar status de pagamento:', error);
      toast(error.message || 'Erro ao atualizar status de pagamento.', 'error');
    }
  };

  // Handler para deletar assinatura
  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (window.confirm('Tem certeza que deseja deletar esta assinatura? Todos os assinantes vinculados a ela permanecerão, mas sem a referência da assinatura.')) {
      try {
        const { error } = await deleteSubscription(subscriptionId);
        if (error) {
          throw error;
        }
        toast.success('Assinatura deletada com sucesso!');
        fetchSubscriptions();
      } catch (error: any) {
        console.error('Erro ao deletar assinatura:', error);
        toast.error(error.message || 'Erro ao deletar assinatura.');
      }
    }
  };

  // Função para salvar descrição
  const handleSaveDescription = async () => {
    if (!selectedSubscriptionForEdit) return;

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ description: editDescription.trim() || null })
        .eq('id', selectedSubscriptionForEdit.id);

      if (error) {
        throw error;
      }

      toast.success(selectedSubscriptionForEdit.description ? 'Descrição atualizada com sucesso!' : 'Descrição adicionada com sucesso!');
      setShowEditDescriptionModal(false);
      setSelectedSubscriptionForEdit(null);
      setEditDescription('');
      fetchSubscriptions(); // Atualizar lista
    } catch (error: any) {
      console.error('Erro ao salvar descrição:', error);
      toast.error(error.message || 'Erro ao salvar descrição.');
    }
  };

  // Handler para deletar assinante
  const handleDeleteClientSubscription = async (clientSubscriptionId: string, clientName: string) => {
    if (window.confirm(`Tem certeza que deseja remover ${clientName} da lista de assinantes?`)) {
      try {
        // Buscar o client_id antes de deletar
        const clientSub = clientSubscriptions.find(cs => cs.id === clientSubscriptionId);
        const clientId = clientSub?.client_id;

        // Usar o novo sistema de assinantes
        const { error } = await removeSubscriber(clientSubscriptionId);
        if (error) {
          throw error;
        }

        toast('Assinante removido com sucesso!', 'success');
        fetchClientSubscriptions();
      } catch (error: any) {
        console.error('Erro ao remover assinante:', error);
        toast(error.message || 'Erro ao remover assinante.', 'error');
      }
    }
  };

  // Handler para atualizar data de término
  const handleUpdateEndDate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientForEdit || !newEndDate || !newStartDate) {
      toast.error('Datas de início e término são obrigatórias.');
      return;
    }

    setIsSavingEndDate(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(newEndDate);
      endDate.setHours(0, 0, 0, 0);

      // Determinar novo status baseado na data
      const newStatus = endDate < today ? 'unpaid' : 'paid';

      // Log da alteração para auditoria
      const logData = {
        subscriber_id: selectedClientForEdit.id,
        subscriber_name: selectedClientForEdit.profiles?.full_name || 'Cliente Desconhecido',
        old_end_date: selectedClientForEdit.end_date,
        new_end_date: newEndDate,
        old_status: selectedClientForEdit.payment_status,
        new_status: newStatus,
        changed_by: user?.id,
        changed_at: new Date().toISOString(),
        establishment_id: establishmentId
      };

      // Atualizar no banco de dados
      const { error } = await supabase
        .from('client_subscriptions')
        .update({
          start_date: newStartDate,
          end_date: newEndDate,
          payment_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedClientForEdit.id);

      if (error) {
        throw error;
      }

      // Registrar log de auditoria
      await logAuditChange(logData);

      // Determinar mensagem de sucesso baseada no status
      const statusMessage = newStatus === 'paid' ? 'ativo/pago' : 'vencido';
      const startDateFormatted = new Date(newStartDate).toLocaleDateString('pt-BR');
      const endDateFormatted = new Date(newEndDate).toLocaleDateString('pt-BR');

      toast.success(`Datas atualizadas: ${startDateFormatted} a ${endDateFormatted}. Status: ${statusMessage}`);

      // Fechar modal e limpar dados
      setShowEditEndDateModal(false);
      setSelectedClientForEdit(null);
      setNewEndDate('');
      setNewStartDate('');

      // Recarregar dados
      await fetchClientSubscriptions();

    } catch (error: any) {
      console.error('Erro ao atualizar data de término:', error);
      toast.error(error.message || 'Erro ao atualizar data de término.');
    } finally {
      setIsSavingEndDate(false);
    }
  };

  // Função para abrir modal de edição
  const openEditEndDateModal = (clientSubscription: ClientSubscription) => {
    setSelectedClientForEdit(clientSubscription);
    setNewEndDate(clientSubscription.end_date);
    setNewStartDate(clientSubscription.start_date);
    setShowEditEndDateModal(true);
  };

  const openLimitModal = (clientSubscription: ClientSubscription) => {
    setSelectedClientForLimit(clientSubscription);
    setMonthlyLimit((clientSubscription as any).monthly_limit || null);
    setShowLimitModal(true);
  };

  const handleSaveLimit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClientForLimit) {
      toast.error('Cliente não selecionado.');
      return;
    }

    setIsSavingLimit(true);
    try {
      const { error } = await supabase
        .from('client_subscriptions')
        .update({
          monthly_limit: monthlyLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedClientForLimit.id);

      if (error) throw error;

      const limitText = monthlyLimit ? `${monthlyLimit} agendamentos` : 'sem limite';
      toast.success(`Limite definido: ${limitText} por mês para ${selectedClientForLimit.profiles?.full_name || 'Cliente'}`);

      // Fechar modal e limpar dados
      setShowLimitModal(false);
      setSelectedClientForLimit(null);
      setMonthlyLimit(null);

      // Recarregar dados
      await fetchClientSubscriptions();

    } catch (error: any) {
      console.error('Erro ao salvar limite:', error);
      toast.error(error.message || 'Erro ao salvar limite.');
    } finally {
      setIsSavingLimit(false);
    }
  };

  // Função para registrar logs de auditoria
  const logAuditChange = async (logData: {
    subscriber_id: string;
    subscriber_name: string;
    old_end_date: string;
    new_end_date: string;
    old_status: string;
    new_status: string;
    changed_by: string;
    establishment_id: string;
  }) => {
    try {
      // Criar uma tabela de logs se não existir (opcional)
      // Por enquanto, vamos apenas logar no console e salvar no localStorage para auditoria local
      const auditLog = {
        ...logData,
        timestamp: new Date().toISOString(),
        action: 'end_date_update'
      };

      // Salvar no localStorage para auditoria local
      const existingLogs = JSON.parse(localStorage.getItem('subscriber_audit_logs') || '[]');
      existingLogs.push(auditLog);

      // Manter apenas os últimos 100 logs para não sobrecarregar o localStorage
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }

      localStorage.setItem('subscriber_audit_logs', JSON.stringify(existingLogs));

      console.log('📝 Log de auditoria registrado:', auditLog);

      // Aqui você pode implementar o envio para uma tabela de logs no banco se necessário
      // await supabase.from('audit_logs').insert(auditLog);

    } catch (error) {
      console.error('❌ Erro ao registrar log de auditoria:', error);
    }
  };

  // Função para checagem diária automática de vencimento
  const checkDailyExpiration = async () => {
    if (clientSubscriptions.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let hasChanges = false;

    console.log('🔍 Iniciando checagem diária de vencimento...');

    for (const cs of clientSubscriptions) {
      const endDate = parseISO(cs.end_date);
      endDate.setHours(0, 0, 0, 0);

      // Se a data de término já passou e o status ainda não foi atualizado
      if (endDate < today && cs.payment_status === 'paid') {
        try {
          console.log(`⚠️ Assinante ${cs.profiles?.full_name} venceu em ${endDate.toLocaleDateString('pt-BR')}, atualizando status...`);

          await supabase
            .from('client_subscriptions')
            .update({
              payment_status: 'unpaid',
              updated_at: new Date().toISOString()
            })
            .eq('id', cs.id);

          hasChanges = true;
          console.log(`✅ Status atualizado para ${cs.profiles?.full_name}: VENCIDO`);
        } catch (error) {
          console.error(`❌ Erro ao atualizar status de ${cs.profiles?.full_name}:`, error);
        }
      }
    }

    // Recarregar dados se houve mudanças
    if (hasChanges) {
      console.log('🔄 Recarregando dados após atualizações...');
      await fetchClientSubscriptions();
    }
  };

  // Lógica para resetar status de pagamento baseado na DATA DE FIM
  useEffect(() => {
    const checkAndResetPayments = async () => {
      if (clientSubscriptions.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
      let hasChanges = false;

      for (const cs of clientSubscriptions) {
        const endDate = new Date(cs.end_date);
        endDate.setHours(0, 0, 0, 0);

        console.log(`📅 Cliente ${cs.profiles?.full_name || 'Desconhecido'}:`, {
          endDate: endDate.toLocaleDateString('pt-BR'),
          today: today.toLocaleDateString('pt-BR'),
          currentStatus: cs.payment_status,
          isExpired: today > endDate
        });

        // Se a data de fim passou E está marcado como 'paid', marcar como 'unpaid'
        if (today > endDate && cs.payment_status === 'paid') {
          try {
            console.log(`🔄 Cliente ${cs.profiles?.full_name || 'Desconhecido'} venceu em ${endDate.toLocaleDateString('pt-BR')} - Marcando como não pago`);

            // Atualizar diretamente no banco
            const { error } = await supabase
              .from('client_subscriptions')
              .update({
                payment_status: 'unpaid',
                updated_at: new Date().toISOString()
              })
              .eq('id', cs.id);

            if (error) {
              console.error(`Erro ao marcar como não pago:`, error);
            } else {
              hasChanges = true;
            }
          } catch (error) {
            console.error(`Erro ao resetar pagamento para ${cs.profiles?.full_name || 'Desconhecido'}:`, error);
          }
        }
      }

      // Só re-fetch se houve mudanças para evitar loop infinito
      if (hasChanges) {
        console.log('🔄 Recarregando dados após mudanças de status por data de fim');
        fetchClientSubscriptions();
      }
    };

    // Executar checagem diária e reset baseado na data de fim
    const timeoutId = setTimeout(async () => {
      await checkDailyExpiration(); // Nova função de checagem diária
      await checkAndResetPayments(); // Nova lógica baseada na data de fim
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [establishmentId, clientSubscriptions.length]); // Incluir clientSubscriptions.length para reagir a mudanças

  // Resumo Financeiro
  const totalArrecadado = clientSubscriptions.reduce((sum, cs) => {
    // Apenas assinaturas ativas e pagas
    const endDate = parseISO(cs.end_date);
    if (!isPast(endDate) && cs.payment_status === 'paid') {
      // Compatível com novo e antigo sistema
      const value = cs.subscriptions?.value || cs.subscription_value || 0;
      console.log('💰 Calculando valor:', {
        name: cs.profiles?.full_name,
        value: value,
        subscriptionData: cs.subscriptions,
        paymentStatus: cs.payment_status,
        endDate: cs.end_date
      });
      return sum + value;
    }
    return sum;
  }, 0);

  // Calcular total de repasses (Lucro Líquido = Lucro Bruto - Repasses)
  const totalRepasses = subscriberAttendances.reduce((sum, attendance) => {
    return sum + (parseFloat(attendance.repass_value) || 0);
  }, 0);

  const lucroBruto = totalArrecadado;
  const lucroLiquido = lucroBruto - totalRepasses;

  console.log('📊 Resumo calculado:', {
    totalArrecadado,
    totalAssinantes: clientSubscriptions.length,
    clientSubscriptions: clientSubscriptions.map(cs => ({
      name: cs.profiles?.full_name,
      value: cs.subscriptions?.value || cs.subscription_value,
      paymentStatus: cs.payment_status,
      endDate: cs.end_date
    }))
  });

  const totalAssinantes = clientSubscriptions.filter(cs => {
    const endDate = parseISO(cs.end_date);
    return !isPast(endDate); // Apenas assinaturas ativas
  }).length;

  // Contar assinantes não pagos (ativos e vencidos)
  const assinantesNaoPagos = clientSubscriptions.filter(cs => {
    return cs.payment_status === 'unpaid'; // Todos os não pagos, independente da data
  }).length;

  // Filtrar assinantes pela pesquisa
  const filteredClientSubscriptions = clientSubscriptions.filter(cs => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    const clientName = cs.profiles?.full_name?.toLowerCase() || '';
    const clientEmail = cs.profiles?.email?.toLowerCase() || '';
    const clientWhatsapp = cs.client_whatsapp?.toLowerCase() || '';
    const subscriptionName = cs.subscriptions?.name?.toLowerCase() || '';

    return (
      clientName.includes(searchLower) ||
      clientEmail.includes(searchLower) ||
      clientWhatsapp.includes(searchLower) ||
      subscriptionName.includes(searchLower)
    );
  });


  return (
    <div className="space-y-6">
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800 text-white">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Resumo de Assinaturas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm text-gray-400">Lucro Bruto:</p>
            <p className="text-lg sm:text-2xl font-bold text-green-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroBruto)}</p>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm text-gray-400">Lucro Líquido:</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lucroLiquido)}</p>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm text-gray-400">Total de Assinantes:</p>
            <p className="text-lg sm:text-2xl font-bold text-primary">{totalAssinantes}</p>
          </div>
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm text-gray-400">Não Pagos:</p>
            <p className="text-lg sm:text-2xl font-bold text-red-400">{assinantesNaoPagos}</p>
          </div>
        </div>

        {/* Controle por Profissional */}
        {subscriberAttendances.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Controle por Profissional</h3>
            <div className="space-y-3">
              {Object.entries(
                subscriberAttendances.reduce((acc, attendance) => {
                  const professional = attendance.professional_name;
                  if (!acc[professional]) {
                    acc[professional] = 0;
                  }
                  acc[professional] += parseFloat(attendance.repass_value) || 0;
                  return acc;
                }, {} as { [key: string]: number })
              ).map(([professional, totalValue]) => (
                <div key={professional} className="flex justify-between items-center bg-[#2a2b2c] rounded-lg p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{professional}</p>
                    <p className="text-xs text-gray-400">Valor total acumulado do mês</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-[#2a2b2c] rounded-lg border border-gray-600">
              <p className="text-xs text-gray-400 text-center">
                Aqui irá mostrar quanto cada profissional receberá por atendimento assinante.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Configurações de Agendamento para Assinantes */}
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800 text-white">
        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6">Configurações de Agendamento</h2>
        <div className="space-y-3 sm:space-y-4">

          {/* Primeira opção - Layout melhorado para mobile */}
          <div className="bg-[#2a2b2c] rounded-lg border border-gray-600 overflow-hidden">
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-medium text-white mb-2 leading-tight">
                    Limitar agendamentos de assinantes
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                    Se ativada, os assinantes só poderão agendar dentro da mesma semana.
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-400 mt-1 leading-relaxed">
                    Exemplo: Se hoje é sexta-feira, o assinante só poderá agendar até domingo.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={limitSubscriberBookings}
                      onChange={(e) => handleUpdateSubscriberBookingLimit(e.target.checked)}
                      disabled={isUpdatingLimit}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {isUpdatingLimit && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                  <span className="text-xs sm:text-sm">Atualizando configuração...</span>
                </div>
              </div>
            )}
          </div>

          {/* Segunda opção - Layout melhorado para mobile */}
          <div className="bg-[#2a2b2c] rounded-lg border border-gray-600 overflow-hidden">
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-medium text-white mb-2 leading-tight">
                    Clientes assinantes não podem desmarcar e remarcar no mesmo dia
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                    Se ativada, quando um assinante cancelar um agendamento, não poderá remarcar para o mesmo dia.
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-400 mt-1 leading-relaxed">
                    Exemplo: Se hoje é terça-feira e o assinante desmarcou, não poderá remarcar na terça-feira.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preventSameDayReschedule}
                      onChange={(e) => handleUpdatePreventSameDayReschedule(e.target.checked)}
                      disabled={isUpdatingSameDayLimit}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {isUpdatingSameDayLimit && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                  <span className="text-xs sm:text-sm">Atualizando configuração...</span>
                </div>
              </div>
            )}
          </div>

          {/* Terceira opção - 1 agendamento por semana */}
          <div className="bg-[#2a2b2c] rounded-lg border border-gray-600 overflow-hidden">
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-medium text-white mb-2 leading-tight">
                    1 agendamento na semana
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
                    Ao ativar essa opção seu cliente assinante só poderá fazer um agendamento na mesma semana. Ele ainda pode cancelar agendamento, só assim ele consegue agendar novamente na mesma semana nos respectivos dias do serviço.
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-400 mt-1 leading-relaxed">
                    Exemplo: Se o assinante já tem agendamento na semana, não pode fazer outro até cancelar o atual.
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={limitSubscribersOneWeek}
                      onChange={(e) => handleUpdateOneWeekLimit(e.target.checked)}
                      disabled={isUpdatingOneWeekLimit}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {isUpdatingOneWeekLimit && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <div className="animate-spin h-3 w-3 sm:h-4 sm:w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                  <span className="text-xs sm:text-sm">Atualizando configuração...</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>


      {/* Criação de Assinatura */}
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <h2 className="text-xl font-semibold mb-4">Criar Novo Tipo de Assinatura</h2>
        <form onSubmit={handleCreateSubscription} className="space-y-4">
          <div>
            <label htmlFor="subscriptionName" className="block text-sm font-medium text-gray-400 mb-1">Nome da Assinatura</label>
            <input
              type="text"
              id="subscriptionName"
              value={newSubscriptionName}
              onChange={(e) => setNewSubscriptionName(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Ex: Plano Mensal, Assinatura VIP"
              required
            />
          </div>
          <div>
            <label htmlFor="subscriptionValue" className="block text-sm font-medium text-gray-400 mb-1">Valor da Assinatura (R$)</label>
            <input
              type="number"
              id="subscriptionValue"
              value={newSubscriptionValue}
              onChange={(e) => setNewSubscriptionValue(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div>
            <label htmlFor="fixedCommissionValue" className="block text-sm font-medium text-gray-400 mb-1">
              Valor fixo de comissão por serviço diário dessa assinatura (R$)
            </label>
            <input
              type="number"
              id="fixedCommissionValue"
              value={newFixedCommissionValue}
              onChange={(e) => setNewFixedCommissionValue(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              step="0.01"
              min="0"
              placeholder="Ex: 20, 30, 50 (deixe 0 se quiser preencher manualmente)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Este valor será usado automaticamente ao adicionar atendimentos. Exemplos: R$ 20, 30, 50
            </p>
          </div>
          <div>
            <label htmlFor="subscriptionDuration" className="block text-sm font-medium text-gray-400 mb-1">Duração do Serviço (minutos)</label>
            <select
              id="subscriptionDuration"
              value={newSubscriptionDuration}
              onChange={(e) => setNewSubscriptionDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              required
            >
              <option value={15}>15 minutos</option>
              <option value={20}>20 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={40}>40 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>1 hora</option>
              <option value={75}>1 hora e 15 minutos</option>
              <option value={90}>1 hora e 30 minutos</option>
              <option value={105}>1 hora e 45 minutos</option>
              <option value={120}>2 horas</option>
              <option value={135}>2 horas e 15 minutos</option>
              <option value={150}>2 horas e 30 minutos</option>
              <option value={165}>2 horas e 45 minutos</option>
              <option value={180}>3 horas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Dias da Semana</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'monday', label: 'Segunda-feira' },
                { value: 'tuesday', label: 'Terça-feira' },
                { value: 'wednesday', label: 'Quarta-feira' },
                { value: 'thursday', label: 'Quinta-feira' },
                { value: 'friday', label: 'Sexta-feira' },
                { value: 'saturday', label: 'Sábado' },
                { value: 'sunday', label: 'Domingo' }
              ].map((day) => (
                <label key={day.value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSubscriptionWeekdays.includes(day.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewSubscriptionWeekdays([...newSubscriptionWeekdays, day.value]);
                      } else {
                        setNewSubscriptionWeekdays(newSubscriptionWeekdays.filter(d => d !== day.value));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 bg-[#2a2b2c] border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-300">{day.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="subscriptionDescription" className="block text-sm font-medium text-gray-400 mb-1">
              Descrição (opcional - até 150 caracteres)
            </label>
            <textarea
              id="subscriptionDescription"
              value={newSubscriptionDescription}
              onChange={(e) => setNewSubscriptionDescription(e.target.value)}
              placeholder="Ex: Essa assinatura inclui cortes ilimitados durante o mês."
              maxLength={150}
              rows={3}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
            />
            <p className="text-xs text-gray-500 mt-1">
              {newSubscriptionDescription.length}/150 caracteres
            </p>
          </div>
          <button type="submit" className="btn-primary w-full">
            <Plus className="h-5 w-5 mr-2" /> Criar Assinatura
          </button>
        </form>
      </div>

      {/* Lista de Tipos de Assinatura */}
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <h2 className="text-xl font-semibold mb-4">Tipos de Assinatura Criados</h2>
        {subscriptions.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhum tipo de assinatura criado ainda.</p>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="p-3 rounded-lg bg-[#242628] border border-gray-700 flex justify-between items-center">
                <div>
                  <p className="font-medium text-lg">{sub.name}</p>
                  <p className="text-gray-400 text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.value)}</p>
                  {sub.weekdays && sub.weekdays.length > 0 && (
                    <p className="text-blue-400 text-xs mt-1">
                      📅 {sub.weekdays.map(day => {
                        const dayNames = {
                          'monday': 'Seg',
                          'tuesday': 'Ter',
                          'wednesday': 'Qua',
                          'thursday': 'Qui',
                          'friday': 'Sex',
                          'saturday': 'Sáb',
                          'sunday': 'Dom'
                        };
                        return dayNames[day as keyof typeof dayNames] || day;
                      }).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedSubscriptionForEdit(sub);
                      setEditDescription(sub.description || '');
                      setShowEditDescriptionModal(true);
                    }}
                    className="text-blue-500 hover:text-blue-400 transition-colors"
                    title={sub.description ? "Editar Informações" : "Adicionar Informações"}
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSubscription(sub.id)}
                    className="text-red-500 hover:text-red-400 transition-colors"
                    title="Deletar Assinatura"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar Assinante */}
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Adicionar Assinante</h2>
          <button
            onClick={() => setShowRecoveryModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            title="Recuperar clientes dos agendamentos"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Recuperar Clientes
          </button>
        </div>
        <form onSubmit={handleAddClientSubscription} className="space-y-4">
          <div>
            <label htmlFor="selectSubscription" className="block text-sm font-medium text-gray-400 mb-1">Escolher Serviço/Assinatura</label>
            <select
              id="selectSubscription"
              value={selectedSubscriptionToAdd}
              onChange={(e) => setSelectedSubscriptionToAdd(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Selecione uma assinatura</option>
              {subscriptions.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name} ({new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.value)})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="newClientName" className="block text-sm font-medium text-gray-400 mb-1">Nome do Cliente</label>
            <input
              type="text"
              id="newClientName"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Digite o nome do cliente"
              required
            />
          </div>
          <div>
            <label htmlFor="newClientPhone" className="block text-sm font-medium text-gray-400 mb-1">Número de Telefone</label>
            <input
              type="tel"
              id="newClientPhone"
              value={newClientPhone}
              onChange={(e) => setNewClientPhone(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Digite o número de telefone"
              required
            />
          </div>
          <div>
            <label htmlFor="newClientEmail" className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
            <input
              type="email"
              id="newClientEmail"
              value={newClientEmail}
              onChange={(e) => setNewClientEmail(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Digite o e-mail do cliente"
              required
            />
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-400 mb-1">Data de Início</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-400 mb-1">Data de Término</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full">
            <Users className="h-5 w-5 mr-2" /> Adicionar Assinante
          </button>
        </form>
      </div>

      {/* Lista Meus Assinantes */}
      <div className="bg-[#1a1b1c] rounded-lg p-4 sm:p-6 border border-gray-800 text-white">
        <div className="mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Meus Assinantes</h2>
        </div>

        {/* Barra de Pesquisa - Melhorada para mobile */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Pesquisar assinantes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-8 sm:pl-10 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400 text-sm sm:text-base"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-2 sm:pl-3">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-xs text-gray-400 mt-1 sm:mt-2">
              {filteredClientSubscriptions.length} de {clientSubscriptions.length} assinante(s) encontrado(s)
            </p>
          )}
        </div>
        {clientSubscriptions.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhum assinante cadastrado ainda.</p>
        ) : filteredClientSubscriptions.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhum assinante encontrado para "{searchTerm}".</p>
        ) : (
          <div className="space-y-3">
            {filteredClientSubscriptions.map((cs) => {
              const isPaid = cs.payment_status === 'paid';
              const endDate = parseISO(cs.end_date);
              const isExpired = isPast(endDate);

              // Lógica de status: vencido APENAS se data passou (independente do pagamento)
              const isVencido = isExpired;

              // Estilo visual baseado no status
              const cardBg = isVencido ? 'bg-red-800/90' : 'bg-green-600';
              const textColor = 'text-white';
              const borderStyle = isVencido ? 'border-red-500' : 'border-green-500';

              return (
                <div key={cs.id} className={`${cardBg} rounded-lg p-3 sm:p-4 w-full overflow-hidden border-2 ${borderStyle}`}>
                  {/* Nome do cliente */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold text-base sm:text-lg ${textColor} truncate`}>
                        {cs.profiles?.full_name || 'Cliente Desconhecido'}
                      </h3>
                      {isVencido && (
                        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                          VENCIDO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informações do plano - Layout otimizado para mobile */}
                  <div className="space-y-2 mb-3">
                    <div className={`text-xs sm:text-sm ${textColor}/90 leading-relaxed`}>
                      <span className="font-medium">Plano:</span><br className="sm:hidden" />
                      <span className="sm:inline">{cs.subscriptions?.name || 'Plano não identificado'}</span><br className="sm:hidden" />
                      <span className="sm:inline sm:ml-1">- {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cs.subscriptions?.value || 0)}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div className={`${textColor}/90`}>
                        <span className="font-medium">Início:</span><br />
                        {format(parseISO(cs.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      <div className={`${textColor}/90`}>
                        <span className="font-medium">Fim:</span><br />
                        {format(parseISO(cs.end_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </div>
                  </div>

                  {/* Informações de contato - Layout melhorado para mobile */}
                  <div className="space-y-2 mb-4">
                    {cs.client_whatsapp && cs.client_whatsapp !== 'N/A' && (() => {
                      // Limpar e formatar o número para o WhatsApp
                      let cleanNumber = cs.client_whatsapp.replace(/\D/g, '');

                      // Garantir que tenha código do país (55 para Brasil)
                      if (cleanNumber.length === 11 && cleanNumber.startsWith('11')) {
                        // Número do Rio de Janeiro: 21993908102 -> 5521993908102
                        cleanNumber = '55' + cleanNumber;
                      } else if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
                        // Outros números de 11 dígitos: adicionar 55
                        cleanNumber = '55' + cleanNumber;
                      } else if (cleanNumber.length === 10) {
                        // Números de 10 dígitos: adicionar 55 + DDD
                        cleanNumber = '55' + cleanNumber;
                      } else if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
                        // Já tem código do país, manter
                        cleanNumber = cleanNumber;
                      } else if (cleanNumber.length < 10) {
                        // Número muito curto, não formatar
                        cleanNumber = cleanNumber;
                      }

                      const whatsappNumber = cleanNumber;
                      const displayNumber = cs.client_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');

                      // Debug para verificar formatação
                      console.log('🔍 WhatsApp Debug:', {
                        original: cs.client_whatsapp,
                        cleanNumber,
                        whatsappNumber,
                        displayNumber,
                        finalUrl: `https://wa.me/${whatsappNumber}`
                      });

                      return (
                        <div className={`flex items-center gap-2 text-xs sm:text-sm ${textColor}/80`}>
                          <span className="text-lg">📱</span>
                          <span className="flex-1 truncate">WhatsApp: {displayNumber}</span>
                          <a
                            href={`https://wa.me/${whatsappNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:text-green-300 transition-colors flex-shrink-0"
                            title={`Abrir WhatsApp: ${displayNumber}`}
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                            </svg>
                          </a>
                        </div>
                      );
                    })()}
                    {cs.profiles?.email && (
                      <div className={`flex items-center gap-2 text-xs sm:text-sm ${textColor}/80`}>
                        <span className="text-lg">📧</span>
                        <span className="flex-1 truncate">Email: {cs.profiles.email}</span>
                        <a
                          href={`mailto:${cs.profiles.email}`}
                          className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                          title="Enviar email"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Botões de ação - Layout otimizado para mobile */}
                  <div className="space-y-2 sm:space-y-0">
                    {/* Dropdown de status de pagamento */}
                    <div className="relative">
                      <select
                        value={cs.payment_status}
                        onChange={(e) => handleTogglePaymentStatus(cs, e.target.value as 'paid' | 'unpaid')}
                        className={`w-full appearance-none px-3 py-2 pr-8 text-xs sm:text-sm font-medium rounded-lg border-0 outline-none transition-all cursor-pointer shadow-sm ${isPaid
                          ? 'bg-green-600 text-white hover:bg-green-700 focus:bg-green-700'
                          : 'bg-red-600 text-white hover:bg-red-700 focus:bg-red-700'
                          }`}
                      >
                        <option value="paid" className="bg-white text-green-700">✓ Pago</option>
                        <option value="unpaid" className="bg-white text-red-700">✗ Não Pago</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Botões de ação em grid para mobile */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                      <button
                        onClick={() => {
                          setSelectedClientForView(cs);
                          setShowViewAttendancesModal(true);
                        }}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700 border border-green-600 shadow-md"
                      >
                        <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Atendimentos</span>
                        <span className="sm:hidden">Ver</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedClientForAttendance(cs);
                          // Preencher automaticamente com valor fixo se disponível
                          const subscription = subscriptions.find(sub => sub.id === cs.subscription_id);
                          const fixedCommission = subscription?.fixed_commission_value;
                          setAttendanceValue(fixedCommission && fixedCommission > 0 ? fixedCommission : 0);
                          setShowAddAttendanceModal(true);
                        }}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-md"
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Atendimento</span>
                        <span className="sm:hidden">Add</span>
                      </button>
                      <button
                        onClick={() => openEditEndDateModal(cs)}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-purple-600 text-white hover:bg-purple-700 border border-purple-600 shadow-md"
                        title="Editar data de término"
                      >
                        <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Editar Data</span>
                        <span className="sm:hidden">Data</span>
                      </button>
                      <button
                        onClick={() => openLimitModal(cs)}
                        className="inline-flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 shadow-md"
                        title="Definir limite de agendamentos por mês"
                      >
                        <span className="text-xs sm:text-sm">🔢</span>
                        <span className="hidden sm:inline ml-1">Limitar Cliente</span>
                        <span className="sm:hidden ml-1">Limite</span>
                      </button>
                    </div>

                    {/* Botão remover em linha separada */}
                    <button
                      onClick={() => handleDeleteClientSubscription(cs.id, cs.profiles?.full_name || 'Cliente')}
                      className="w-full inline-flex items-center justify-center px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Recuperação de Clientes */}
      <ClientRecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        establishmentId={establishmentId}
        onClientsRecovered={() => {
          fetchClientSubscriptions();
          if (onClientUpdated) onClientUpdated();
        }}
      />

      {/* Modal para Adicionar Atendimento */}
      {showAddAttendanceModal && selectedClientForAttendance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Adicionar Atendimento</h3>
              <button
                onClick={() => {
                  setShowAddAttendanceModal(false);
                  setSelectedClientForAttendance(null);
                  setAttendanceDate('');
                  setAttendanceProfessional('');
                  setAttendanceValue(0);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-[#2a2b2c] rounded-lg">
              <p className="text-sm text-gray-400">Cliente:</p>
              <p className="text-white font-medium">{selectedClientForAttendance.profiles?.full_name}</p>
            </div>

            <form onSubmit={handleAddAttendance} className="space-y-4">
              <div>
                <label htmlFor="attendanceDate" className="block text-sm font-medium text-gray-400 mb-1">
                  Data do Atendimento
                </label>
                <input
                  type="date"
                  id="attendanceDate"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="attendanceProfessional" className="block text-sm font-medium text-gray-400 mb-1">
                  Profissional que Atendeu
                </label>
                <select
                  id="attendanceProfessional"
                  value={attendanceProfessional}
                  onChange={(e) => setAttendanceProfessional(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                >
                  <option value="">Selecione o profissional</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.full_name}>
                      {professional.full_name}
                    </option>
                  ))}
                </select>
                {professionals.length === 0 && (
                  <p className="text-xs text-yellow-400 mt-1">
                    ⚠️ Nenhum profissional encontrado. Execute o SQL primeiro ou adicione profissionais.
                  </p>
                )}
                {professionals.length > 0 && (
                  <p className="text-xs text-green-400 mt-1">
                    ✅ {professionals.length} profissional(is) encontrado(s)
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="attendanceValue" className="block text-sm font-medium text-gray-400 mb-1">
                  Valor Repassado ao Profissional (R$)
                </label>
                {(() => {
                  const clientSubscription = selectedClientForAttendance;
                  const subscription = subscriptions.find(sub => sub.id === clientSubscription.subscription_id);
                  const fixedCommission = subscription?.fixed_commission_value;

                  if (fixedCommission && fixedCommission > 0) {
                    // Se tem valor fixo, campo vem preenchido e desabilitado
                    return (
                      <>
                        <input
                          type="number"
                          id="attendanceValue"
                          value={fixedCommission}
                          onChange={(e) => setAttendanceValue(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                          step="0.01"
                          min="0"
                          required
                          disabled
                        />
                        <div className="mt-2 p-2 bg-green-900/20 border border-green-600/30 rounded-lg">
                          <p className="text-xs text-green-400">
                            ✅ Valor fixo configurado: R$ {fixedCommission.toFixed(2).replace('.', ',')} (não editável)
                          </p>
                        </div>
                      </>
                    );
                  } else {
                    // Se não tem valor fixo, campo normal para preenchimento manual
                    return (
                      <>
                        <input
                          type="number"
                          id="attendanceValue"
                          value={attendanceValue}
                          onChange={(e) => setAttendanceValue(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                          step="0.01"
                          min="0"
                          required
                        />
                        <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                          <p className="text-xs text-yellow-400">
                            ⚠️ Nenhum valor fixo configurado para esta assinatura. Preencha manualmente.
                          </p>
                        </div>
                      </>
                    );
                  }
                })()}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAttendanceModal(false);
                    setSelectedClientForAttendance(null);
                    setAttendanceDate('');
                    setAttendanceProfessional('');
                    setAttendanceValue(0);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingAttendance}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSavingAttendance ? 'Salvando...' : 'Salvar Atendimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar data de término */}
      {showEditEndDateModal && selectedClientForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Editar Datas do Plano</h3>
              <button
                onClick={() => {
                  setShowEditEndDateModal(false);
                  setSelectedClientForEdit(null);
                  setNewEndDate('');
                  setNewStartDate('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-[#2a2b2c] rounded-lg">
              <p className="text-sm text-gray-400">Cliente:</p>
              <p className="text-white font-medium">{selectedClientForEdit.profiles?.full_name}</p>
              <p className="text-xs text-gray-400 mt-1">
                Início atual: {format(parseISO(selectedClientForEdit.start_date), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
              <p className="text-xs text-gray-400">
                Término atual: {format(parseISO(selectedClientForEdit.end_date), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>

            <form onSubmit={handleUpdateEndDate} className="space-y-4">
              <div>
                <label htmlFor="newStartDate" className="block text-sm font-medium text-gray-400 mb-1">
                  Nova Data de Início
                </label>
                <input
                  type="date"
                  id="newStartDate"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="newEndDate" className="block text-sm font-medium text-gray-400 mb-1">
                  Nova Data de Término
                </label>
                <input
                  type="date"
                  id="newEndDate"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  required
                />
              </div>

              {/* Informações sobre o impacto da mudança */}
              {newStartDate && newEndDate && (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const startDate = new Date(newStartDate);
                const endDate = new Date(newEndDate);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(0, 0, 0, 0);

                const isStartValid = startDate <= endDate;
                const isEndFuture = endDate > today;
                const isEndToday = endDate.getTime() === today.getTime();

                return (
                  <div className={`p-3 rounded-lg border ${isStartValid && isEndFuture
                    ? 'bg-green-900/20 border-green-600/30'
                    : 'bg-red-900/20 border-red-600/30'
                    }`}>
                    <p className={`text-xs ${isStartValid && isEndFuture ? 'text-green-400' : 'text-red-400'
                      }`}>
                      {!isStartValid
                        ? `❌ Data de início deve ser anterior à data de término`
                        : isEndFuture
                          ? `✅ Plano ficará ATIVO de ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} até ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`
                          : isEndToday
                            ? `⚠️ Plano ficará VENCIDO hoje (${format(endDate, 'dd/MM/yyyy', { locale: ptBR })})`
                            : `❌ Plano ficará VENCIDO (venceu em ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })})`
                      }
                    </p>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEndDateModal(false);
                    setSelectedClientForEdit(null);
                    setNewEndDate('');
                    setNewStartDate('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEndDate}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSavingEndDate ? 'Salvando...' : 'Salvar Datas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para visualizar atendimentos do cliente */}
      {showViewAttendancesModal && selectedClientForView && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-2xl border border-gray-800 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Atendimentos do Cliente</h3>
              <button
                onClick={() => {
                  setShowViewAttendancesModal(false);
                  setSelectedClientForView(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-[#2a2b2c] rounded-lg">
              <p className="text-sm text-gray-400">Cliente:</p>
              <p className="text-white font-medium">{selectedClientForView.profiles?.full_name}</p>
            </div>

            {(() => {
              const clientAttendances = getClientAttendances(selectedClientForView.id);
              const attendancesByProfessional = getClientAttendancesByProfessional(selectedClientForView.id);

              if (clientAttendances.length === 0) {
                return (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-sm">Nenhum atendimento registrado para este cliente.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  <div className="bg-[#2a2b2c] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Resumo por Profissional</h4>
                    <div className="space-y-3">
                      {Object.entries(attendancesByProfessional).map(([professional, data]) => (
                        <div key={professional} className="flex justify-between items-center bg-[#1a1b1c] rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-white">{professional}</p>
                            <p className="text-xs text-gray-400">{data.count} atendimento(s)</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-400">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.totalValue)}
                            </p>
                            <p className="text-xs text-gray-400">Total repassado</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#2a2b2c] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-white mb-3">Detalhamento dos Atendimentos</h4>
                    <div className="space-y-2">
                      {clientAttendances.map((attendance, index) => (
                        <div key={index} className="flex justify-between items-center bg-[#1a1b1c] rounded-lg p-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{attendance.professional_name}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(attendance.attendance_date).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold text-blue-400">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(attendance.repass_value)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveAttendance(
                                attendance.id,
                                attendance.professional_name,
                                attendance.attendance_date,
                                attendance.repass_value
                              )}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Remover atendimento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal de Edição de Descrição */}
      {showEditDescriptionModal && selectedSubscriptionForEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {selectedSubscriptionForEdit.description ? 'Editar Descrição' : 'Adicionar Descrição'}
              </h3>
              <button
                onClick={() => setShowEditDescriptionModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Descrição da Assinatura "{selectedSubscriptionForEdit.name}"
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Ex: Essa assinatura inclui cortes ilimitados durante o mês."
                maxLength={150}
                rows={4}
                className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 mt-1">
                {editDescription.length}/150 caracteres
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditDescriptionModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDescription}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {selectedSubscriptionForEdit.description ? 'Atualizar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Definir Limite Simples */}
      {showLimitModal && selectedClientForLimit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Limitar Cliente
              </h3>
              <button
                onClick={() => setShowLimitModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLimit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Limite mensal para <strong>{selectedClientForLimit.profiles?.full_name || 'Cliente'}</strong>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={monthlyLimit || ''}
                  onChange={(e) => setMonthlyLimit(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 text-white"
                  placeholder="Ex: 2 (para 2 agendamentos por mês)"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Deixe vazio para sem limite. O sistema contará quantas vezes este cliente agendou como assinante no mês.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLimitModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingLimit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSavingLimit ? 'Salvando...' : 'Salvar Limite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}; 