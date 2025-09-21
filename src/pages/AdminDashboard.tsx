import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AppDownloadLinks } from '../components/AppDownloadLinks';
import { PWADownloadLink } from '../components/PWADownloadLink';
import { NewRegistrations } from '../components/NewRegistrations';
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
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  FileText,
  Bell
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
  is_blocked?: boolean;
}

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [deletedEstablishments, setDeletedEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'expired'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'monthly' | 'annual'>('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showNewRegistrations, setShowNewRegistrations] = useState(false);
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [emailToCheck, setEmailToCheck] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  // Verificar se é a conta de suporte
  const isSupportAccount = user?.email === 'suporteagendeifacil@gmail.com';

  // Função de logout personalizada que redireciona
  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso!');
      navigate('/'); // Redireciona para a página inicial
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  useEffect(() => {
    // Verificar autenticação a cada renderização
    const checkAuth = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          navigate('/login');
          return;
        }
        
        // Verificar se é conta de suporte
        const isSupport = currentUser.email === 'suporteagendeifacil@gmail.com';
        
        if (!isSupport) {
          toast.error('Acesso negado. Apenas conta de suporte pode acessar esta página.');
          navigate('/');
          return;
        }
        
        // Se chegou até aqui, pode carregar dados
        fetchEstablishments();
        fetchPendingRegistrationsCount();
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        navigate('/login');
      }
    };
    
    checkAuth();
  }, []);

  // Auto-refresh das inscrições a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(async () => {
      setIsAutoRefreshing(true);
      await fetchPendingRegistrationsCount();
      setIsAutoRefreshing(false);
    }, 5000); // 5 segundos

    return () => clearInterval(interval);
  }, []);

  const fetchPendingRegistrationsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('registration_forms')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) {
        console.error('Erro ao buscar contagem de inscrições:', error);
        return;
      }

      const newCount = count || 0;
      
      // Se o número aumentou, mostrar notificação
      if (newCount > pendingRegistrationsCount && pendingRegistrationsCount > 0) {
        toast.success(`🎉 Nova inscrição detectada! Total: ${newCount}`, {
          duration: 4000,
          icon: '📝'
        });
      }
      
      setPendingRegistrationsCount(newCount);
    } catch (error) {
      console.error('Erro:', error);
    }
  };

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
        const processedEstablishment = {
          ...establishment,
          owner_email: profile?.name || 'Email não encontrado',
          payment_status: establishment.payment_status || 'unpaid',
          plan_type: establishment.plan_type || 'monthly',
          payment_due_date: establishment.payment_due_date || establishment.created_at,
          is_blocked: establishment.is_blocked || false
        };
        
                 return processedEstablishment;
      });

      // Combinar dados dos estabelecimentos excluídos
      const deletedWithEmails = deletedData.map(establishment => {
        const profile = profilesData.find(p => p.id === establishment.owner_id);
        return {
          ...establishment,
          owner_email: profile?.name || 'Email não encontrado',
          payment_status: establishment.payment_status || 'unpaid',
          plan_type: establishment.plan_type || 'monthly',
          payment_due_date: establishment.payment_due_date || establishment.created_at,
          is_blocked: establishment.is_blocked || false
        };
      });

      setEstablishments(establishmentsWithEmails);
      setDeletedEstablishments(deletedWithEmails);
      
      // Verificar e atualizar status vencidos automaticamente
      await checkAndUpdateExpiredStatus();
    } catch (error) {
      console.error('Erro ao buscar estabelecimentos:', error);
      toast.error('Erro ao carregar estabelecimentos');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePaymentStatus = async (establishmentId: string, status: 'paid' | 'unpaid' | 'expired') => {
    try {
      let updateData: any = { payment_status: status };
      
      // Se está marcando como PAGO, calcular próximo vencimento
      if (status === 'paid') {
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        updateData.payment_due_date = nextMonth.toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('establishments')
        .update(updateData)
        .eq('id', establishmentId);

      if (error) throw error;

      setEstablishments(prev => 
        prev.map(est => 
          est.id === establishmentId 
            ? { 
                ...est, 
                payment_status: status,
                payment_due_date: status === 'paid' ? updateData.payment_due_date : est.payment_due_date
              }
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

  // Função para bloquear/desbloquear estabelecimento
  const toggleBlockEstablishment = async (establishmentId: string, isBlocked: boolean) => {
    try {
      
      const { data, error } = await supabase
        .from('establishments')
        .update({ is_blocked: !isBlocked })
        .eq('id', establishmentId)
        .select();

      if (error) {
        console.error('Erro no Supabase:', error);
        throw error;
      }

      setEstablishments(prev => 
        prev.map(est => 
          est.id === establishmentId 
            ? { ...est, is_blocked: !isBlocked }
            : est
        )
      );

      toast.success(isBlocked ? 'Estabelecimento desbloqueado!' : 'Estabelecimento bloqueado!');
    } catch (error) {
      console.error('Erro ao alterar status de bloqueio:', error);
      toast.error('Erro ao alterar status de bloqueio');
    }
  };

  // Função para remover para a lixeira (mover para estabelecimentos excluídos)
  const removeFromList = async (establishmentId: string) => {
    let establishmentToDelete: Establishment | undefined;
    
    try {
      // Encontrar o estabelecimento para adicionar à lista de excluídos
      establishmentToDelete = establishments.find(est => est.id === establishmentId);
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

      toast.success('Estabelecimento movido para a lixeira!');
    } catch (error) {
      console.error('Erro ao mover para lixeira:', error);
      toast.error('Erro ao mover para lixeira');
      // Reverter mudanças se deu erro
      if (establishmentToDelete) {
        setEstablishments(prev => [...prev, establishmentToDelete]);
        setDeletedEstablishments(prev => prev.filter(est => est.id !== establishmentId));
      }
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

  // Função para verificar senha do usuário
  const checkUserPassword = async () => {
    if (!emailToCheck.trim()) {
      toast.error('Digite um email válido');
      return;
    }

    setIsLoadingPassword(true);
    try {
      // Usar a função RPC para descobrir a senha real
      const { data: userData, error: userError } = await supabase
        .rpc('discover_real_password', {
          user_email: emailToCheck.trim()
        });

      if (userError || !userData?.success) {
        console.error('Erro RPC:', userError);
        toast.error(userData?.error || 'Usuário não encontrado');
        return;
      }

      // Mostrar a senha real e informações do usuário
      setUserPassword(userData.real_password || 'Senha não encontrada');
      setUserInfo(userData);
      
      if (userData.password_found) {
        toast.success('Usuário encontrado! Senha descoberta!');
      } else {
        toast.warning('Usuário encontrado, mas senha não é comum');
      }
      
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      toast.error('Erro ao buscar usuário');
    } finally {
      setIsLoadingPassword(false);
    }
  };

  // Função para fechar modal e limpar dados
  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setEmailToCheck('');
    setUserPassword('');
    setShowPassword(false);
    setUserInfo(null);
  };

  // Função para criar segunda senha
  const createSecondPassword = async (establishmentId: string, establishmentName: string) => {
    try {
      // Gerar senha aleatória
      const secondPassword = Math.random().toString(36).slice(-8);
      
      console.log('🔑 Criando segunda senha:', secondPassword);
      
      const { data, error } = await supabase
        .rpc('set_second_password', {
          establishment_id: establishmentId,
          second_password: secondPassword
        });

      if (error || !data?.success) {
        console.error('❌ ERRO:', error);
        toast.error('Erro ao criar segunda senha');
        return;
      }

      console.log('✅ SEGUNDA SENHA CRIADA!');
      console.log('📊 Dados retornados:', data);
      
      // Verificar se foi salva
      const { data: checkData, error: checkError } = await supabase
        .rpc('get_establishment_second_password', {
          establishment_id: establishmentId
        });

      if (checkError) {
        console.error('❌ ERRO AO VERIFICAR:', checkError);
      } else {
        console.log('✅ VERIFICAÇÃO:', checkData);
      }
      
      toast.success(`🔑 Segunda senha criada: ${secondPassword}`);
      
    } catch (error) {
      console.error('💥 ERRO:', error);
      toast.error(`Erro: ${error.message}`);
    }
  };

  // Função para verificar e atualizar status vencidos automaticamente
  const checkAndUpdateExpiredStatus = async () => {
    try {
      const today = new Date();
      
      // 1. Verificar estabelecimentos que venceu (não pagos)
      const expiredEstablishments = establishments.filter(est => {
        if (est.payment_status === 'paid') return false; // Pulos não podem estar vencidos
        const dueDate = new Date(est.payment_due_date);
        return dueDate < today;
      });

      // 2. Verificar estabelecimentos PAGOS que venceu (deve voltar para unpaid)
      const paidExpiredEstablishments = establishments.filter(est => {
        if (est.payment_status !== 'paid') return false; // Só verificar pagos
        const dueDate = new Date(est.payment_due_date);
        return dueDate < today;
      });

      // Atualizar status para vencido no banco (não pagos)
      for (const est of expiredEstablishments) {
        await supabase
          .from('establishments')
          .update({ payment_status: 'expired' })
          .eq('id', est.id);
      }

      // Atualizar status para unpaid no banco (pagos que venceu)
      for (const est of paidExpiredEstablishments) {
        await supabase
          .from('establishments')
          .update({ payment_status: 'unpaid' })
          .eq('id', est.id);
      }

      // Atualizar estado local
      setEstablishments(prev => 
        prev.map(est => {
          const dueDate = new Date(est.payment_due_date);
          
          if (est.payment_status === 'paid' && dueDate < today) {
            // Pagos que venceu → voltar para unpaid
            return { ...est, payment_status: 'unpaid' };
          } else if (est.payment_status !== 'paid' && dueDate < today) {
            // Não pagos que venceu → marcar como expired
            return { ...est, payment_status: 'expired' };
          }
          
          return est;
        })
      );

      const totalUpdated = expiredEstablishments.length + paidExpiredEstablishments.length;
      if (totalUpdated > 0) {
        console.log(`🔄 ${expiredEstablishments.length} vencidos, ${paidExpiredEstablishments.length} pagos vencidos = ${totalUpdated} total atualizados`);
      }
    } catch (error) {
      console.error('Erro ao verificar status vencidos:', error);
    }
  };

  const getStatusColor = (establishment: Establishment) => {
    if (establishment.is_blocked) return 'text-red-600';
    if (establishment.payment_status === 'paid') return 'text-green-600';
    if (establishment.payment_status === 'expired' || isExpired(establishment.payment_due_date)) {
      return 'text-red-600';
    }
    return 'text-yellow-600';
  };

  const getStatusIcon = (establishment: Establishment) => {
    if (establishment.is_blocked) return <Lock className="h-5 w-5 text-red-600" />;
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
              {/* Botão Novas Inscrições */}
              <button
                onClick={() => setShowNewRegistrations(true)}
                className="relative flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                title={isAutoRefreshing ? "Atualizando automaticamente..." : "Atualiza a cada 5 segundos"}
              >
                <FileText className={`h-4 w-4 ${isAutoRefreshing ? 'animate-pulse' : ''}`} />
                <span>Novas Inscrições</span>
                {pendingRegistrationsCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse">
                    {pendingRegistrationsCount}
                  </span>
                )}
                {isAutoRefreshing && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                )}
              </button>
              
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Eye className="h-4 w-4" />
                <span>Ver Senha de Acesso</span>
              </button>
              <span className="text-sm text-gray-600">Suporte</span>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>

             <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-6 py-6">
                 {/* Stats */}
         <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
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

                     <div className="bg-white rounded-lg shadow p-6">
             <div className="flex items-center">
               <Lock className="h-8 w-8 text-red-600" />
               <div className="ml-4">
                 <p className="text-sm font-medium text-gray-600">Bloqueados</p>
                 <p className="text-2xl font-bold text-gray-900">
                   {establishments.filter(e => e.is_blocked).length}
                 </p>
               </div>
             </div>
           </div>

           <div className="bg-white rounded-lg shadow p-6">
             <div className="flex items-center">
               <Trash2 className="h-8 w-8 text-gray-600" />
               <div className="ml-4">
                 <p className="text-sm font-medium text-gray-600">Na Lixeira</p>
                 <p className="text-2xl font-bold text-gray-900">
                   {deletedEstablishments.length}
                 </p>
               </div>
             </div>
           </div>
        </div>

                 {/* Filters */}
         <div className="bg-white rounded-lg shadow p-4 mb-6">
           <div className="flex flex-col sm:flex-row gap-3">
             <div className="flex-1">
               <div className="relative">
                 <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                 <input
                   type="text"
                   placeholder="Buscar..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                 />
               </div>
             </div>
             
             <select
               value={filterStatus}
               onChange={(e) => setFilterStatus(e.target.value as any)}
               className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
             >
               <option value="all">Todos Status</option>
               <option value="paid">Pagos</option>
               <option value="unpaid">Pendentes</option>
               <option value="expired">Vencidos</option>
             </select>
             
             <select
               value={filterPlan}
               onChange={(e) => setFilterPlan(e.target.value as any)}
               className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
             >
               <option value="all">Todos Planos</option>
               <option value="monthly">Mensal</option>
               <option value="annual">Anual</option>
             </select>
             
             <button
               onClick={fetchEstablishments}
               className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1 text-sm"
             >
               <RefreshCw className="h-4 w-4" />
               <span>Atualizar</span>
             </button>
             
             <button
               onClick={checkAndUpdateExpiredStatus}
               className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-1 text-sm"
               title="Verificar e atualizar status vencidos"
             >
               <AlertTriangle className="h-4 w-4" />
               <span>Verificar Vencidos</span>
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
                     <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                       Estabelecimento
                     </th>
                     <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                       Código
                     </th>
                     <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                       Status
                     </th>
                     <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                       Plano
                     </th>
                     <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                       Vencimento
                     </th>
                     <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                       Ações
                     </th>
                   </tr>
                 </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                                     {filteredEstablishments.map((establishment) => (
                     <tr key={establishment.id} className={isExpired(establishment.payment_due_date) ? 'bg-red-50' : ''}>
                       <td className="px-3 py-4">
                         <div className="text-sm font-medium text-gray-900 truncate">{establishment.name}</div>
                         <div className="text-xs text-gray-500">
                           {new Date(establishment.created_at).toLocaleDateString('pt-BR')}
                         </div>
                       </td>
                       
                       <td className="px-2 py-4">
                         <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                           {establishment.code}
                         </span>
                       </td>
                       
                       <td className="px-2 py-4">
                         <div className="flex items-center">
                           {getStatusIcon(establishment)}
                           <span className={`ml-1 text-xs font-medium ${getStatusColor(establishment)}`}>
                             {establishment.is_blocked ? 'Bloqueado' : 
                              establishment.payment_status === 'paid' ? 'Pago' : 
                              establishment.payment_status === 'expired' || isExpired(establishment.payment_due_date) ? 'Vencido' : 'Pendente'}
                           </span>
                         </div>
                       </td>
                       
                       <td className="px-2 py-4">
                         <select
                           value={establishment.plan_type}
                           onChange={(e) => updatePlanType(establishment.id, e.target.value as 'monthly' | 'annual')}
                           className="text-xs border border-gray-300 rounded px-1 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 w-full"
                         >
                           <option value="monthly">Mensal</option>
                           <option value="annual">Anual</option>
                         </select>
                       </td>
                       
                       <td className="px-2 py-4">
                         <input
                           type="date"
                           value={establishment.payment_due_date.split('T')[0]}
                           onChange={(e) => updatePaymentDueDate(establishment.id, e.target.value)}
                           className="text-xs border border-gray-300 rounded px-1 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 w-full"
                         />
                       </td>
                       
                       <td className="px-3 py-4 text-sm font-medium">
                                                 <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => createSecondPassword(establishment.id, establishment.name)}
                            className="text-green-600 hover:text-green-900 text-xs px-2 py-0.5 border border-green-300 rounded hover:bg-green-50 font-medium"
                            title="Criar Segunda Senha"
                          >
                            2ª Senha
                          </button>
                           <button
                             onClick={() => updatePaymentStatus(establishment.id, 'paid')}
                             className="text-green-600 hover:text-green-900 text-xs px-1 py-0.5 border border-green-300 rounded hover:bg-green-50"
                             title="Marcar Pago"
                           >
                             Pago
                           </button>
                           <button
                             onClick={() => updatePaymentStatus(establishment.id, 'unpaid')}
                             className="text-yellow-600 hover:text-yellow-900 text-xs px-1 py-0.5 border border-yellow-300 rounded hover:bg-yellow-50"
                             title="Marcar Pendente"
                           >
                             Pend
                           </button>
                           <button
                             onClick={() => updatePaymentStatus(establishment.id, 'expired')}
                             className="text-red-600 hover:text-red-900 text-xs px-1 py-0.5 border border-red-300 rounded hover:bg-red-50"
                             title="Marcar Vencido"
                           >
                             Venc
                           </button>
                           <button
                             onClick={() => toggleBlockEstablishment(establishment.id, establishment.is_blocked || false)}
                             className={`text-xs px-1 py-0.5 border rounded flex items-center ${
                               establishment.is_blocked 
                                 ? 'text-green-600 border-green-300 hover:bg-green-50 hover:text-green-900' 
                                 : 'text-red-600 border-red-300 hover:bg-red-50 hover:text-red-900'
                             }`}
                             title={establishment.is_blocked ? 'Desbloquear' : 'Bloquear'}
                           >
                             {establishment.is_blocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                           </button>
                           <button
                             onClick={() => removeFromList(establishment.id)}
                             className="text-gray-600 hover:text-gray-900 text-xs px-1 py-0.5 border border-gray-300 rounded hover:bg-gray-50"
                             title="Remover da Lista"
                           >
                             <Trash2 className="h-3 w-3" />
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

                                                           {/* Estabelecimentos Excluídos - Lixeira */}
                {deletedEstablishments.length > 0 && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <Trash2 className="h-5 w-5 text-gray-500 mr-2" />
                        Lixeira ({deletedEstablishments.length})
                      </h3>
                      <button
                        onClick={() => setShowDeleted(!showDeleted)}
                        className="text-sm text-gray-600 hover:text-gray-900"
                      >
                        {showDeleted ? 'Ocultar' : 'Mostrar'} lixeira
                      </button>
                    </div>
                    
                    {showDeleted && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="space-y-3">
                          {deletedEstablishments.map(establishment => (
                            <div key={establishment.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                              <div className="flex items-center space-x-4">
                                <div>
                                  <span className="text-sm font-medium text-gray-900">{establishment.name}</span>
                                  <div className="flex space-x-2 mt-1">
                                    <span className="text-xs text-gray-500">Código: {establishment.code}</span>
                                    <span className="text-xs text-gray-500">•</span>
                                    <span className="text-xs text-gray-500">{establishment.owner_email}</span>
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => restoreEstablishment(establishment.id)}
                                className="text-blue-600 hover:text-blue-900 text-xs px-3 py-1 border border-blue-300 rounded hover:bg-blue-50 flex items-center"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
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
          )}
        </div>
      </div>

      {/* Modal para Ver Senha de Acesso */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Ver Senha de Acesso</h3>
              <button
                onClick={closePasswordModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email do Usuário
                </label>
                <input
                  id="email"
                  type="email"
                  value={emailToCheck}
                  onChange={(e) => setEmailToCheck(e.target.value)}
                  placeholder="Digite o email do usuário"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={checkUserPassword}
                disabled={isLoadingPassword}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoadingPassword ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eye className="h-4 w-4 mr-2" />
                )}
                Ver Acesso
              </button>
              
              {userInfo && (
                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Informações do Usuário</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Email:</span> {userInfo.user_email}</p>
                      <p><span className="font-medium">ID:</span> {userInfo.user_id}</p>
                      <p><span className="font-medium">Criado em:</span> {new Date(userInfo.created_at).toLocaleDateString('pt-BR')}</p>
                      {userInfo.has_establishment && (
                        <div className="mt-2 pt-2 border-t border-blue-200">
                          <p><span className="font-medium">Estabelecimento:</span> {userInfo.establishment_name}</p>
                          <p><span className="font-medium">Código:</span> {userInfo.establishment_code}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg border ${userInfo.password_found ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Senha Real do Usuário:
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={userPassword}
                        readOnly
                        className={`flex-1 px-3 py-2 border rounded-lg bg-white text-gray-900 text-sm font-mono ${
                          userInfo.password_found ? 'border-green-300 text-green-800' : 'border-yellow-300 text-yellow-800'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className={`text-xs mt-1 ${userInfo.password_found ? 'text-green-600' : 'text-yellow-600'}`}>
                      {userInfo.password_found 
                        ? '✅ Senha descoberta com sucesso!' 
                        : '⚠️ Senha não é comum (não foi possível descobrir)'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={closePasswordModal}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novas Inscrições */}
      {showNewRegistrations && (
        <NewRegistrations
          onClose={() => {
            setShowNewRegistrations(false);
            fetchPendingRegistrationsCount(); // Atualizar contagem ao fechar
          }}
        />
      )}

      {/* Seção de Links de Download */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* PWA Link (App Web) */}
          <PWADownloadLink />
          
          {/* Links de Lojas */}
          <AppDownloadLinks />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 