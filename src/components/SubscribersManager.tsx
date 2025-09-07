import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ui/Toaster';
import { supabase } from '../lib/supabase'; // Adicionar esta importação
import { migrateManualClients, cleanupManualClients } from '../utils/migrateManualClients';
import { ClientRecoveryModal } from './ClientRecoveryModal';
import { 
  createSubscription, 
  getSubscriptions, 
  addClientSubscription, 
  getClientSubscriptions, 
  updateClientSubscriptionPaymentStatus, 
  deleteSubscription, 
  deleteClientSubscription 
} from '../lib/supabase';
import { Crown, Plus, Users, Trash2, Edit, Check, X } from 'lucide-react';
import { format, addMonths, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Database } from '../types/supabase';

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
}

export const SubscribersManager: React.FC<SubscribersManagerProps> = ({ establishmentId, clients, onClientUpdated }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [clientSubscriptions, setClientSubscriptions] = useState<ClientSubscription[]>([]);
  // const [clients, setClients] = useState<Profile[]>([]); // REMOVIDO: Agora vem via prop

  const [newSubscriptionName, setNewSubscriptionName] = useState('');
  const [newSubscriptionValue, setNewSubscriptionValue] = useState<number>(0);
  const [newSubscriptionDuration, setNewSubscriptionDuration] = useState<number>(30); // Duração em minutos
  const [newSubscriptionWeekdays, setNewSubscriptionWeekdays] = useState<string[]>([]);

  const [selectedSubscriptionToAdd, setSelectedSubscriptionToAdd] = useState<string>('');
  const [selectedClientToAdd, setSelectedClientToAdd] = useState<string>('');

  // Novos campos para adicionar assinante
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

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
    // Migrar dados de clientes manuais da chave antiga para a nova
    migrateManualClients(establishmentId);
    
    // Buscar clientes manuais do localStorage - usar a mesma chave que o EstablishmentDashboard
    const storageKey = `manual_clients_${establishmentId}`;
    const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    // Também buscar da chave antiga para compatibilidade
    const oldManualClients = JSON.parse(localStorage.getItem('manualClients') || '{}');
    const allManualClients = { ...oldManualClients, ...manualClients };
    
    // A função getClientSubscriptions agora busca automaticamente no banco se não encontrar no localStorage
    const { data, error } = await getClientSubscriptions(establishmentId, allManualClients);
    if (error) {
      console.error('Erro ao buscar assinaturas de clientes:', error);
      toast.error('Erro ao carregar assinantes.');
    } else {
      setClientSubscriptions(data || []);
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
        newSubscriptionDuration // Adicionar a duração do serviço
      );
      if (error) {
        throw error;
      }
      toast.success('Assinatura criada com sucesso!');
      setNewSubscriptionName('');
      setNewSubscriptionValue(0);
      setNewSubscriptionDuration(30); // Reset para 30 minutos
      setNewSubscriptionWeekdays([]);
      fetchSubscriptions(); // Atualiza a lista
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      toast.error(error.message || 'Erro ao criar assinatura.');
    }
  };


  // Handler para adicionar assinante diretamente
  const handleAddClientSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubscriptionToAdd || !newClientName || !newClientPhone || !newClientEmail || !startDate || !endDate) {
      toast('Por favor, preencha todos os campos.', 'error');
      return;
    }

    try {
      console.log('✅ Adicionando cliente diretamente:', {
        name: newClientName,
        phone: newClientPhone,
        email: newClientEmail,
        startDate,
        endDate,
        subscriptionId: selectedSubscriptionToAdd
      });

      // SALVAR DIRETAMENTE NO BANCO
      const subscriptionToAdd = subscriptions.find(s => s.id === selectedSubscriptionToAdd);
      if (!subscriptionToAdd) {
        toast('Assinatura não encontrada', 'error');
        return;
      }

      // Normalizar número de telefone (remover formatação)
      const normalizedPhone = newClientPhone.replace(/\D/g, '');
      
      // Gerar ID único para o cliente manual
      const manualClientId = `manual_${normalizedPhone}`;

      const { data, error } = await supabase
        .from('client_subscriptions')
        .insert([
          {
            client_id: manualClientId,
            subscription_id: selectedSubscriptionToAdd,
            establishment_id: establishmentId,
            start_date: startDate,
            end_date: endDate,
            payment_status: 'unpaid',
            last_payment_date: null,
            client_name_override: newClientName,
            client_email: newClientEmail,
            client_whatsapp: normalizedPhone // Salvar WhatsApp normalizado para reconhecimento automático
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Salvar cliente manual no localStorage - usar a mesma chave que o EstablishmentDashboard
      const storageKey = `manual_clients_${establishmentId}`;
      const manualClients = JSON.parse(localStorage.getItem(storageKey) || '{}');
      manualClients[normalizedPhone] = {
        name: newClientName,
        whatsapp: normalizedPhone,
        email: newClientEmail || null,
        id: manualClientId,
        addedAt: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(manualClients));
      
      // Também salvar na chave antiga para compatibilidade
      const oldManualClients = JSON.parse(localStorage.getItem('manualClients') || '{}');
      oldManualClients[normalizedPhone] = manualClients[normalizedPhone];
      localStorage.setItem('manualClients', JSON.stringify(oldManualClients));
      
      toast(`✅ ${newClientName} adicionado como assinante!`, 'success');
      setSelectedSubscriptionToAdd('');
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setStartDate('');
      setEndDate('');
      
      // Forçar re-fetch dos dados
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
      const { error } = await updateClientSubscriptionPaymentStatus(
        clientSubscription.id,
        newStatus
      );
      if (error) {
        throw error;
      }
      
      // Se mudou para "pago", atualizar a data do último pagamento
      if (newStatus === 'paid') {
        const today = new Date().toISOString().split('T')[0];
        const { error: dateError } = await supabase
          .from('client_subscriptions')
          .update({ last_payment_date: today })
          .eq('id', clientSubscription.id);
        
        if (dateError) {
          console.error('Erro ao atualizar data de pagamento:', dateError);
        }
      }
      
      toast(`Status alterado para ${newStatus === 'paid' ? 'Pago' : 'Não Pago'}!`, 'success');
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

  // Handler para deletar assinante
  const handleDeleteClientSubscription = async (clientSubscriptionId: string, clientName: string) => {
    if (window.confirm(`Tem certeza que deseja remover ${clientName} da lista de assinantes?`)) {
      try {
        // Buscar o client_id antes de deletar
        const clientSub = clientSubscriptions.find(cs => cs.id === clientSubscriptionId);
        const clientId = clientSub?.client_id;
        
        const { error } = await deleteClientSubscription(clientSubscriptionId);
        if (error) {
          throw error;
        }
        
        // Se conseguiu deletar e temos o client_id, verificar se ainda tem outras assinaturas
        if (clientId) {
          // Verificar se o cliente ainda tem outras assinaturas ativas neste estabelecimento
          const { data: remainingSubscriptions, error: checkError } = await supabase
            .from('client_subscriptions')
            .select('id')
            .eq('client_id', clientId)
            .eq('establishment_id', establishmentId);
          
          if (!checkError) {
            const hasOtherSubscriptions = remainingSubscriptions && remainingSubscriptions.length > 0;
            
            // Se não tem mais assinaturas, atualizar is_subscriber para false
            if (!hasOtherSubscriptions) {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ is_subscriber: false })
                .eq('id', clientId);
              
              if (updateError) {
                console.error('Erro ao atualizar status de assinante para false:', updateError);
              } else {
                console.log('✅ Status is_subscriber atualizado para false');
                // Notificar o EstablishmentDashboard para atualizar a lista de clientes
                if (onClientUpdated) {
                  onClientUpdated();
                }
              }
            }
          }
        }
        
        toast('Assinante removido com sucesso!', 'success');
        fetchClientSubscriptions();
      } catch (error: any) {
        console.error('Erro ao remover assinante:', error);
        toast(error.message || 'Erro ao remover assinante.', 'error');
      }
    }
  };

  // Lógica para resetar status de pagamento baseado na duração do plano
  useEffect(() => {
    const checkAndResetPayments = async () => {
      if (clientSubscriptions.length === 0) return;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
      let hasChanges = false;

      for (const cs of clientSubscriptions) {
        const subscriptionDuration = cs.subscriptions.duration_months;
        const startDate = new Date(cs.start_date);
        
        // Calcular a data de vencimento baseada na data de início + duração
        const dueDate = addMonths(startDate, subscriptionDuration);
        dueDate.setHours(0, 0, 0, 0);
        
        // Calcular quando deve resetar (1 dia após o vencimento)
        const resetDate = new Date(dueDate);
        resetDate.setDate(resetDate.getDate() + 1);
        
        console.log(`📅 Cliente ${cs.profiles.full_name}:`, {
          startDate: startDate.toLocaleDateString('pt-BR'),
          dueDate: dueDate.toLocaleDateString('pt-BR'),
          resetDate: resetDate.toLocaleDateString('pt-BR'),
          today: today.toLocaleDateString('pt-BR'),
          currentStatus: cs.payment_status,
          shouldReset: today >= resetDate && cs.payment_status === 'paid'
        });

        // Se hoje é igual ou após a data de reset E está pago, resetar para 'unpaid'
        if (today >= resetDate && cs.payment_status === 'paid') {
          try {
            await updateClientSubscriptionPaymentStatus(cs.id, 'unpaid');
            hasChanges = true;
            console.log(`🔄 Resetado pagamento para ${cs.profiles.full_name} - Plano de ${subscriptionDuration} meses venceu em ${dueDate.toLocaleDateString('pt-BR')}`);
          } catch (error) {
            console.error(`Erro ao resetar pagamento para ${cs.profiles.full_name}:`, error);
          }
        }
      }
      
      // Só re-fetch se houve mudanças para evitar loop infinito
      if (hasChanges) {
        fetchClientSubscriptions();
      }
    };

    // Executar apenas uma vez ao carregar o componente inicial
    const timeoutId = setTimeout(() => {
      checkAndResetPayments();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [establishmentId]); // Apenas quando establishmentId muda

  // Resumo Financeiro
  const totalArrecadado = clientSubscriptions.reduce((sum, cs) => {
    // Apenas assinaturas ativas e pagas
    const endDate = parseISO(cs.end_date);
    if (!isPast(endDate) && cs.payment_status === 'paid') {
      return sum + cs.subscriptions.value;
    }
    return sum;
  }, 0);

  const totalAssinantes = clientSubscriptions.filter(cs => {
    const endDate = parseISO(cs.end_date);
    return !isPast(endDate); // Apenas assinaturas ativas
  }).length;

  // Contar assinantes não pagos (ativos)
  const assinantesNaoPagos = clientSubscriptions.filter(cs => {
    const endDate = parseISO(cs.end_date);
    return !isPast(endDate) && cs.payment_status === 'unpaid'; // Ativos e não pagos
  }).length;


  return (
    <div className="space-y-6">
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <h2 className="text-xl font-semibold mb-4">Resumo de Assinaturas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-400">Total Arrecadado (Ativo):</p>
            <p className="text-2xl font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalArrecadado)}</p>
          </div>
          <div>
            <p className="text-gray-400">Total de Assinantes:</p>
            <p className="text-2xl font-bold text-primary">{totalAssinantes}</p>
          </div>
          <div>
            <p className="text-gray-400">Não Pagos:</p>
            <p className="text-2xl font-bold text-red-400">{assinantesNaoPagos}</p>
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
            <label htmlFor="subscriptionDuration" className="block text-sm font-medium text-gray-400 mb-1">Duração do Serviço (minutos)</label>
            <select
              id="subscriptionDuration"
              value={newSubscriptionDuration}
              onChange={(e) => setNewSubscriptionDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
              required
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
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
                <button
                  onClick={() => handleDeleteSubscription(sub.id)}
                  className="text-red-500 hover:text-red-400 transition-colors"
                  title="Deletar Assinatura"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
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
      <div className="bg-[#1a1b1c] rounded-lg p-6 border border-gray-800 text-white">
        <h2 className="text-xl font-semibold mb-4">Meus Assinantes</h2>
        {clientSubscriptions.length === 0 ? (
          <p className="text-gray-400 text-center">Nenhum assinante cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {clientSubscriptions.map((cs) => {
              const isPaid = cs.payment_status === 'paid';
              const cardBg = isPaid ? 'bg-green-600' : 'bg-red-800/90';
              const textColor = 'text-white';
              const buttonBg = isPaid ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30';

              return (
                <div key={cs.id} className={`${cardBg} rounded-lg p-3 sm:p-4 w-full overflow-hidden`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-2">
                    <div className="flex flex-col gap-1 flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-lg ${textColor} truncate`}>{cs.profiles?.full_name || 'Cliente Desconhecido'}</span>
                      </div>
                      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${textColor}/90`}>
                        <span>Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cs.subscriptions?.value || 0)}</span>
                        <span>Frequência: {cs.subscriptions?.duration_months === 1 ? 'Mensal' : `${cs.subscriptions?.duration_months} meses`}</span>
                        <span>Duração contratada: {cs.subscriptions?.duration_months} {cs.subscriptions?.duration_months === 1 ? 'mês' : 'meses'}</span>
                        <span>Início: {format(parseISO(cs.start_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        <span>Fim: {format(parseISO(cs.end_date), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      </div>
                      {/* Informações de contato */}
                      <div className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${textColor}/80 mt-1`}>
                        {cs.client_whatsapp && cs.client_whatsapp !== 'N/A' && (
                          <div className="flex items-center gap-1">
                            <span>📱 WhatsApp: {cs.client_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</span>
                            <a
                              href={`https://wa.me/${cs.client_whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-400 hover:text-green-300 transition-colors"
                              title="Abrir WhatsApp"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                              </svg>
                            </a>
                          </div>
                        )}
                        {cs.profiles?.email && (
                          <div className="flex items-center gap-1">
                            <span>📧 Email: {cs.profiles.email}</span>
                            <a
                              href={`mailto:${cs.profiles.email}`}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="Enviar email"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4 justify-end">
                    <div className="relative">
                      <select
                        value={cs.payment_status}
                        onChange={(e) => handleTogglePaymentStatus(cs, e.target.value as 'paid' | 'unpaid')}
                        className={`appearance-none px-4 py-2 pr-8 text-sm font-medium rounded-lg border-0 outline-none transition-all cursor-pointer shadow-sm ${
                          isPaid 
                            ? 'bg-green-600 text-white hover:bg-green-700 focus:bg-green-700' 
                            : 'bg-red-600 text-white hover:bg-red-700 focus:bg-red-700'
                        }`}
                      >
                        <option value="paid" className="bg-white text-green-700">✓ Pago</option>
                        <option value="unpaid" className="bg-white text-red-700">✗ Não Pago</option>
                      </select>
                      {/* Ícone de seta customizado */}
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteClientSubscription(cs.id, cs.profiles?.full_name || 'Cliente')}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remover
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
    </div>
  );
}; 