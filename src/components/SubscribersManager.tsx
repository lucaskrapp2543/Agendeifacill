import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ui/Toaster';
import { supabase } from '../lib/supabase'; // Adicionar esta importação
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
  const [newSubscriptionDuration, setNewSubscriptionDuration] = useState<number>(1);

  const [selectedSubscriptionToAdd, setSelectedSubscriptionToAdd] = useState<string>('');
  const [selectedClientToAdd, setSelectedClientToAdd] = useState<string>('');

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
    const { data, error } = await getClientSubscriptions(establishmentId);
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
    }
  }, [establishmentId]);

  // Handlers para criação de assinatura
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubscriptionName || !newSubscriptionValue || !newSubscriptionDuration) {
      toast.error('Preencha todos os campos para criar uma assinatura.');
      return;
    }
    try {
      const { error } = await createSubscription(
        establishmentId,
        newSubscriptionName,
        newSubscriptionValue,
        newSubscriptionDuration
      );
      if (error) {
        throw error;
      }
      toast.success('Assinatura criada com sucesso!');
      setNewSubscriptionName('');
      setNewSubscriptionValue(0);
      setNewSubscriptionDuration(1);
      fetchSubscriptions(); // Atualiza a lista
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      toast.error(error.message || 'Erro ao criar assinatura.');
    }
  };

  // Handlers para adicionar assinante
  const handleAddClientSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubscriptionToAdd || !selectedClientToAdd) {
      toast('Por favor, selecione uma assinatura e um cliente.', 'error');
      return;
    }

    try {
      console.log('Cliente selecionado ID:', selectedClientToAdd);
      console.log('Lista de clientes disponíveis:', clients);
      
      // Buscar o cliente na lista local (que já tem o nome correto)
      const clientProfile = clients.find(c => c.id === selectedClientToAdd);
      console.log('Cliente encontrado na lista local:', clientProfile);
      
      if (!clientProfile) {
        toast('Cliente selecionado não encontrado.', 'error');
        return;
      }

      // Usar o nome da lista local
      const clientName = clientProfile.name;
      console.log('Nome do cliente que será salvo:', clientName);

      const { data, error } = await addClientSubscription(
        selectedClientToAdd,
        selectedSubscriptionToAdd,
        establishmentId,
        new Date()
      );
      
      if (error) throw error;
      
      // Atualizar manualmente o status is_subscriber no perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_subscriber: true })
        .eq('id', selectedClientToAdd);
      
      if (updateError) {
        console.error('Erro ao atualizar status de assinante:', updateError);
      } else {
        console.log('✅ Status is_subscriber atualizado para true');
        // Notificar o EstablishmentDashboard para atualizar a lista de clientes
        if (onClientUpdated) {
          onClientUpdated();
        }
      }
      
      toast('Assinante adicionado com sucesso!', 'success');
      setSelectedSubscriptionToAdd('');
      setSelectedClientToAdd('');
      
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
            <label htmlFor="subscriptionDuration" className="block text-sm font-medium text-gray-400 mb-1">Duração (meses)</label>
            <select
              id="subscriptionDuration"
              value={newSubscriptionDuration}
              onChange={(e) => setNewSubscriptionDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 text-white focus:outline-none focus:border-blue-500"
              required
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{month} {month === 1 ? 'mês' : 'meses'}</option>
              ))}
            </select>
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
                  <p className="text-gray-400 text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.value)} / {sub.duration_months} {sub.duration_months === 1 ? 'mês' : 'meses'}</p>
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
        <h2 className="text-xl font-semibold mb-4">Adicionar Assinante</h2>
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
            <label htmlFor="selectClient" className="block text-sm font-medium text-gray-400 mb-1">Escolher Cliente</label>
            <select
              id="selectClient"
              value={selectedClientToAdd}
              onChange={(e) => setSelectedClientToAdd(e.target.value)}
              className="w-full px-3 py-2 bg-[#2a2b2c] rounded-lg border border-gray-600 text-white focus:outline-none focus:border-blue-500"
              required
            >
              <option value="">Selecione um cliente</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
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
    </div>
  );
}; 