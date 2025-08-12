import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toaster';
import { 
  Building2, 
  Calendar, 
  DollarSign, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  LogOut,
  Search,
  Filter,
  Trash2
} from 'lucide-react';

interface Establishment {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  created_at: string;
  payment_status: 'paid' | 'unpaid' | 'expired';
  plan_type: 'monthly' | 'annual';
  payment_due_date: string;
  owner_email?: string;
  is_deleted?: boolean;
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [deletedEstablishments, setDeletedEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'expired'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'monthly' | 'annual'>('all');

  // Verificar se é a conta de suporte
  const isSupportAccount = user?.email === 'suporteagendeifacil@gmail.com';

  useEffect(() => {
    if (!user) return; // Aguardar o usuário carregar
    
    if (!isSupportAccount) {
      toast.error('Acesso negado. Apenas conta de suporte pode acessar esta página.');
      return;
    }
    
    fetchEstablishments();
  }, [user, isSupportAccount]);

    const fetchEstablishments = async () => {
    try {
      setIsLoading(true);
      
      // Buscar todos os estabelecimentos (não excluídos)
      const { data: establishmentsData, error: establishmentsError } = await supabase
        .from('establishments')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });

      if (establishmentsError) throw establishmentsError;

      // Buscar estabelecimentos excluídos
      const { data: deletedData, error: deletedError } = await supabase
        .from('establishments')
        .select('*')
        .eq('is_deleted', true)
        .order('created_at', { ascending: false });

      if (deletedError) throw deletedError;

      // Buscar emails dos proprietários
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name');

      if (profilesError) throw profilesError;

      // Combinar dados dos estabelecimentos ativos
      const establishmentsWithEmails = establishmentsData.map(establishment => {
        const profile = profilesData.find(p => p.id === establishment.owner_id);
        return {
          ...establishment,
          owner_email: profile?.name || 'Email não encontrado',
          payment_status: establishment.payment_status || 'unpaid',
          plan_type: establishment.plan_type || 'monthly',
          payment_due_date: establishment.payment_due_date || establishment.created_at
        };
      });

      // Combinar dados dos estabelecimentos excluídos
      const deletedWithEmails = deletedData.map(establishment => {
        const profile = profilesData.find(p => p.id === establishment.owner_id);
        return {
          ...establishment,
          owner_email: profile?.name || 'Email não encontrado',
          payment_status: establishment.payment_status || 'unpaid',
          plan_type: establishment.plan_type || 'monthly',
          payment_due_date: establishment.payment_due_date || establishment.created_at
        };
      });

      setEstablishments(establishmentsWithEmails);
      setDeletedEstablishments(deletedWithEmails);
    } catch (error) {
      console.error('Erro ao buscar estabelecimentos:', error);
      toast.error('Erro ao carregar estabelecimentos');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentStatus = async (establishmentId: string, status: 'paid' | 'unpaid' | 'expired') => {
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ payment_status: status })
        .eq('id', establishmentId);

      if (error) throw error;

      setEstablishments(prev => 
        prev.map(est => 
          est.id === establishmentId 
            ? { ...est, payment_status: status }
            : est
        )
      );

      toast.success('Status de pagamento atualizado!');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const updatePlanType = async (establishmentId: string, planType: 'monthly' | 'annual') => {
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ plan_type: planType })
        .eq('id', establishmentId);

      if (error) throw error;

      setEstablishments(prev => 
        prev.map(est => 
          est.id === establishmentId 
            ? { ...est, plan_type: planType }
            : est
        )
      );

      toast.success('Tipo de plano atualizado!');
    } catch (error) {
      console.error('Erro ao atualizar plano:', error);
      toast.error('Erro ao atualizar plano');
    }
  };

  const updatePaymentDueDate = async (establishmentId: string, dueDate: string) => {
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ payment_due_date: dueDate })
        .eq('id', establishmentId);

      if (error) throw error;

      setEstablishments(prev => 
        prev.map(est => 
          est.id === establishmentId 
            ? { ...est, payment_due_date: dueDate }
            : est
        )
      );

      toast.success('Data de vencimento atualizada!');
    } catch (error) {
      console.error('Erro ao atualizar data:', error);
      toast.error('Erro ao atualizar data');
    }
  };

  const deleteEstablishment = async (establishmentId: string) => {
    try {
      // Encontrar o estabelecimento para adicionar à lista de excluídos
      const establishmentToDelete = establishments.find(est => est.id === establishmentId);
      if (establishmentToDelete) {
        setDeletedEstablishments(prev => [...prev, establishmentToDelete]);
      }
      
      // Remover da lista de estabelecimentos ativos
      setEstablishments(prev => prev.filter(est => est.id !== establishmentId));
      
      // Marcar como excluído no banco de dados
      const { error } = await supabase
        .from('establishments')
        .update({ is_deleted: true })
        .eq('id', establishmentId);

      if (error) throw error;

      toast.success('Estabelecimento removido da lista!');
    } catch (error) {
      console.error('Erro ao excluir estabelecimento:', error);
      toast.error('Erro ao excluir estabelecimento');
      // Reverter mudanças se deu erro
      if (establishmentToDelete) {
        setEstablishments(prev => [...prev, establishmentToDelete]);
        setDeletedEstablishments(prev => prev.filter(est => est.id !== establishmentId));
      }
    }
  };

  const restoreEstablishment = async (establishmentId: string) => {
    try {
      // Encontrar o estabelecimento para restaurar
      const establishmentToRestore = deletedEstablishments.find(est => est.id === establishmentId);
      if (establishmentToRestore) {
        setEstablishments(prev => [...prev, establishmentToRestore]);
      }
      
      // Remover da lista de estabelecimentos excluídos
      setDeletedEstablishments(prev => prev.filter(est => est.id !== establishmentId));
      
      // Marcar como não excluído no banco de dados
      const { error } = await supabase
        .from('establishments')
        .update({ is_deleted: false })
        .eq('id', establishmentId);

      if (error) throw error;

      toast.success('Estabelecimento restaurado!');
    } catch (error) {
      console.error('Erro ao restaurar estabelecimento:', error);
      toast.error('Erro ao restaurar estabelecimento');
      // Reverter mudanças se deu erro
      if (establishmentToRestore) {
        setEstablishments(prev => prev.filter(est => est.id !== establishmentId));
        setDeletedEstablishments(prev => [...prev, establishmentToRestore]);
      }
    }
  };

  const isExpired = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    return due < today;
  };

  const getStatusColor = (establishment: Establishment) => {
    if (establishment.payment_status === 'paid') return 'text-green-600';
    if (establishment.payment_status === 'expired' || isExpired(establishment.payment_due_date)) {
      return 'text-red-600';
    }
    return 'text-yellow-600';
  };

  const getStatusIcon = (establishment: Establishment) => {
    if (establishment.payment_status === 'paid') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (establishment.payment_status === 'expired' || isExpired(establishment.payment_due_date)) {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  };

  const filteredEstablishments = establishments.filter(establishment => {
    const matchesSearch = establishment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         establishment.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         establishment.owner_email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || establishment.payment_status === filterStatus;
    const matchesPlan = filterPlan === 'all' || establishment.plan_type === filterPlan;
    
    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Mostrar loading enquanto verifica autenticação
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <RefreshCw className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Carregando...</h1>
          <p className="text-gray-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isSupportAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Apenas a conta de suporte pode acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Painel Administrativo</h1>
                <p className="text-sm text-gray-600">Gerenciamento de Estabelecimentos</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Suporte</span>
              <button
                onClick={signOut}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Estabelecimentos</p>
                <p className="text-2xl font-bold text-gray-900">{establishments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pagamentos em Dia</p>
                <p className="text-2xl font-bold text-gray-900">
                  {establishments.filter(e => e.payment_status === 'paid').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">
                  {establishments.filter(e => e.payment_status === 'unpaid').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Vencidos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {establishments.filter(e => 
                    e.payment_status === 'expired' || isExpired(e.payment_due_date)
                  ).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, código ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Status</option>
              <option value="paid">Pagos</option>
              <option value="unpaid">Pendentes</option>
              <option value="expired">Vencidos</option>
            </select>
            
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Planos</option>
              <option value="monthly">Mensal</option>
              <option value="annual">Anual</option>
            </select>
            
            <button
              onClick={fetchEstablishments}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Establishments List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Estabelecimentos</h2>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Carregando estabelecimentos...</p>
            </div>
          ) : establishments.length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Carregando dados...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estabelecimento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Proprietário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plano
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEstablishments.map((establishment) => (
                    <tr key={establishment.id} className={isExpired(establishment.payment_due_date) ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{establishment.name}</div>
                        <div className="text-sm text-gray-500">
                          Criado em {new Date(establishment.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {establishment.code}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {establishment.owner_email}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(establishment)}
                          <span className={`ml-2 text-sm font-medium ${getStatusColor(establishment)}`}>
                            {establishment.payment_status === 'paid' ? 'Pago' : 
                             establishment.payment_status === 'expired' || isExpired(establishment.payment_due_date) ? 'Vencido' : 'Pendente'}
                          </span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={establishment.plan_type}
                          onChange={(e) => updatePlanType(establishment.id, e.target.value as 'monthly' | 'annual')}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="monthly">Mensal</option>
                          <option value="annual">Anual</option>
                        </select>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="date"
                          value={establishment.payment_due_date.split('T')[0]}
                          onChange={(e) => updatePaymentDueDate(establishment.id, e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        />
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col space-y-2">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => updatePaymentStatus(establishment.id, 'paid')}
                              className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded hover:bg-green-50"
                            >
                              Marcar Pago
                            </button>
                            <button
                              onClick={() => updatePaymentStatus(establishment.id, 'unpaid')}
                              className="text-yellow-600 hover:text-yellow-900 text-xs px-2 py-1 border border-yellow-300 rounded hover:bg-yellow-50"
                            >
                              Marcar Pendente
                            </button>
                            <button
                              onClick={() => updatePaymentStatus(establishment.id, 'expired')}
                              className="text-red-600 hover:text-red-900 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                            >
                              Marcar Vencido
                            </button>
                          </div>
                          <button
                            onClick={() => deleteEstablishment(establishment.id)}
                            className="text-red-600 hover:text-red-900 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50 flex items-center space-x-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredEstablishments.length === 0 && (
                <div className="text-center py-8">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Nenhum estabelecimento encontrado</p>
                </div>
              )}

                             {/* Estabelecimentos Excluídos */}
               {deletedEstablishments.length > 0 && (
                 <div className="border-t border-gray-200 pt-6">
                   <h3 className="text-lg font-semibold text-gray-900 mb-4">Estabelecimentos Excluídos ({deletedEstablishments.length})</h3>
                   <div className="space-y-2">
                     {deletedEstablishments.map(establishment => (
                       <div key={establishment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                         <div className="flex items-center space-x-4">
                           <span className="text-sm font-medium text-gray-900">{establishment.name}</span>
                           <span className="text-xs text-gray-500">Código: {establishment.code}</span>
                           <span className="text-xs text-gray-500">{establishment.owner_email}</span>
                         </div>
                         <button
                           onClick={() => restoreEstablishment(establishment.id)}
                           className="text-blue-600 hover:text-blue-900 text-xs px-2 py-1 border border-blue-300 rounded hover:bg-blue-50"
                         >
                           Restaurar
                         </button>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 