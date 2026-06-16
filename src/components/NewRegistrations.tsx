import { createClient } from '@supabase/supabase-js';
import {
  Building,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  LogIn,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Trash2,
  User,
  UserPlus,
  XCircle
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface RegistrationForm {
  id: string;
  client_name: string;
  establishment_name: string;
  email: string;
  password: string; // SENHA EM TEXTO CLARO
  client_whatsapp?: string; // WHATSAPP DO CLIENTE
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  processed_at?: string;
  processed_by?: string;
  notes?: string;
  ip_address?: string;
  user_agent?: string;
  account_type?: 'paid' | 'test'; // Tipo de conta: paid (cadastroag) ou test (testefree)
}

interface CreateAccountInput {
  client_name: string;
  establishment_name: string;
  email: string;
  password: string;
  client_whatsapp?: string;
  account_type: 'paid' | 'test';
}

interface NewRegistrationsProps {
  onClose: () => void;
}

const defaultBusinessHours = {
  monday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  tuesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  wednesday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  thursday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  friday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  saturday: { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null },
  sunday: { enabled: false, open1: null, close1: null, open2: null, close2: null },
};

const emptyCreateForm = (): CreateAccountInput => ({
  client_name: '',
  establishment_name: '',
  email: '',
  password: '',
  client_whatsapp: '',
  account_type: 'paid',
});

export const NewRegistrations: React.FC<NewRegistrationsProps> = ({ onClose }) => {
  const [registrations, setRegistrations] = useState<RegistrationForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationForm | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterAccountType, setFilterAccountType] = useState<'all' | 'paid' | 'test'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [createForm, setCreateForm] = useState<CreateAccountInput>(emptyCreateForm);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('registration_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar inscrições:', error);
        toast.error('Erro ao carregar inscrições');
        return;
      }

      setRegistrations(data || []);
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar inscrições');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRegistrationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('registration_forms')
        .update({
          status,
          processed_at: new Date().toISOString(),
          processed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: notes.trim() || null
        })
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar status:', error);
        toast.error('Erro ao atualizar status');
        return;
      }

      toast.success(`Inscrição ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`);
      setSelectedRegistration(null);
      setNotes('');
      fetchRegistrations();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const createAccount = async (registration: RegistrationForm) => {
    if (!confirm(`Tem certeza que deseja criar uma conta de estabelecimento para ${registration.establishment_name}?`)) {
      return;
    }

    const result = await provisionEstablishmentAccount(
      {
        client_name: registration.client_name,
        establishment_name: registration.establishment_name,
        email: registration.email,
        password: registration.password,
        client_whatsapp: registration.client_whatsapp,
        account_type: registration.account_type || 'paid',
      },
      registration.id
    );

    if (!result.success) return;

    toast.success(
      `Conta criada com sucesso! Código: ${result.establishmentCode}. Email: ${registration.email}, Senha: ${registration.password}`
    );
    setSelectedRegistration(null);
    fetchRegistrations();
  };

  const validateCreateForm = (): string | null => {
    const email = createForm.email.trim().toLowerCase();
    if (!createForm.client_name.trim()) return 'Nome do cliente é obrigatório.';
    if (!createForm.establishment_name.trim()) return 'Nome do estabelecimento é obrigatório.';
    if (!email) return 'E-mail é obrigatório.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'E-mail inválido.';
    if (!createForm.password || createForm.password.length < 6) return 'Senha deve ter pelo menos 6 caracteres.';
    const cleanWhatsapp = String(createForm.client_whatsapp || '').replace(/\D/g, '');
    if (!cleanWhatsapp) return 'WhatsApp é obrigatório.';
    if (cleanWhatsapp.length < 10 || cleanWhatsapp.length > 11) return 'WhatsApp deve ter 10 ou 11 dígitos.';
    return null;
  };

  const handleCreateManualAccount = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateCreateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (
      !confirm(
        `Criar conta para "${createForm.establishment_name.trim()}"?\n\nEmail: ${createForm.email.trim().toLowerCase()}\nValidade: 30 dias (conta normal).`
      )
    ) {
      return;
    }

    setIsCreatingAccount(true);
    try {
      const payload: CreateAccountInput = {
        client_name: createForm.client_name.trim(),
        establishment_name: createForm.establishment_name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        client_whatsapp: String(createForm.client_whatsapp || '').replace(/\D/g, ''),
        account_type: 'paid',
      };

      const result = await provisionEstablishmentAccount(payload);

      if (!result.success) return;

      toast.success(
        `Conta criada! Código: ${result.establishmentCode} | Email: ${payload.email} | Senha: ${payload.password}`
      );
      setCreateForm(emptyCreateForm());
      setViewMode('list');
      fetchRegistrations();
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const provisionEstablishmentAccount = async (
    input: CreateAccountInput,
    registrationId?: string
  ): Promise<{ success: boolean; establishmentCode?: string }> => {
    try {
      const currentAdminUser = await supabase.auth.getUser();
      const adminUserId = currentAdminUser.data.user?.id;

      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || '',
        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'agendafacil_temp_admin_signup',
          },
        }
      );

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        options: {
          data: {
            role: 'establishment',
            full_name: input.client_name,
            establishment_name: input.establishment_name,
          },
        },
      });

      if (authError) {
        console.error('Erro ao criar usuário:', authError);
        toast.error(`Erro ao criar usuário: ${authError.message}`);
        return { success: false };
      }

      if (!authData.user) {
        toast.error('Erro: usuário não foi criado');
        return { success: false };
      }

      const establishmentCode = Math.floor(1000 + Math.random() * 9000).toString();
      const isTestAccount = input.account_type === 'test';
      const now = new Date();
      const paymentDueDate = isTestAccount
        ? new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { error: establishmentError } = await supabase.from('establishments').insert({
        name: input.establishment_name,
        code: establishmentCode,
        description: `Estabelecimento criado automaticamente para ${input.client_name}`,
        owner_id: authData.user.id,
        business_hours: defaultBusinessHours,
        services_with_prices: [],
        professionals: [],
        profile_image_url: null,
        affiliate_link: null,
        custom_photo_1_url: null,
        custom_photo_2_url: null,
        custom_photo_3_url: null,
        custom_photo_4_url: null,
        custom_photo_5_url: null,
        custom_photo_6_url: null,
        custom_photo_7_url: null,
        carousel_position: 'below',
        has_wifi: false,
        has_parking: false,
        has_accessibility: false,
        wifi_password: null,
        pin_password: null,
        professionals_pins: [],
        whatsapp: input.client_whatsapp || null,
        payment_status: isTestAccount ? 'paid' : 'unpaid',
        plan_type: isTestAccount ? 'trial' : 'monthly',
        payment_due_date: paymentDueDate.toISOString(),
        payment_paid_at: isTestAccount ? now.toISOString() : null,
        payment_alert_enabled: false,
        is_deleted: false,
        is_blocked: false,
        onboarding_step: 1,
      });

      if (establishmentError) {
        console.error('Erro ao criar estabelecimento:', establishmentError);
        toast.error(`Erro ao criar estabelecimento: ${establishmentError.message}`);
        return { success: false };
      }

      const registrationNotes = isTestAccount
        ? `Conta criada. Código: ${establishmentCode}. Email: ${input.email}, Senha: ${input.password}. Login liberado imediatamente.`
        : `Conta criada automaticamente. Código: ${establishmentCode}. Email: ${input.email}, Senha: ${input.password}. O usuário pode fazer login imediatamente.`;

      if (registrationId) {
        const { error: registrationUpdateError } = await supabase
          .from('registration_forms')
          .update({
            status: 'approved',
            processed_at: now.toISOString(),
            processed_by: adminUserId,
            notes: registrationNotes,
          })
          .eq('id', registrationId);

        if (registrationUpdateError) {
          console.error('Erro ao atualizar inscrição:', registrationUpdateError);
          toast.error(`Conta criada, mas falhou ao atualizar a inscrição: ${registrationUpdateError.message}`);
        }
      } else {
        const { error: registrationInsertError } = await supabase.from('registration_forms').insert({
          client_name: input.client_name,
          establishment_name: input.establishment_name,
          email: input.email.trim().toLowerCase(),
          password: input.password,
          client_whatsapp: input.client_whatsapp || null,
          account_type: input.account_type,
          status: 'approved',
          processed_at: now.toISOString(),
          processed_by: adminUserId,
          notes: registrationNotes,
          ip_address: null,
          user_agent: navigator.userAgent,
        });

        if (registrationInsertError) {
          console.error('Erro ao registrar inscrição na lista:', registrationInsertError);
          toast.error(
            `Conta criada (código ${establishmentCode}), mas não entrou na lista: ${registrationInsertError.message}`
          );
        }
      }

      return { success: true, establishmentCode };
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      toast.error('Erro ao criar conta');
      return { success: false };
    }
  };

  const deleteRegistration = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta inscrição?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('registration_forms')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir inscrição:', error);
        toast.error('Erro ao excluir inscrição');
        return;
      }

      toast.success('Inscrição excluída com sucesso!');
      fetchRegistrations();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao excluir inscrição');
    }
  };

  const loginAsRegistration = async (registration: RegistrationForm) => {
    const email = String(registration.email || '').trim();
    const password = String(registration.password || '');
    if (!email || !password) {
      toast.error('Esta inscrição não tem email/senha para preencher o login.');
      return;
    }

    try {
      sessionStorage.setItem('admin_login_email', email);
      sessionStorage.setItem('admin_login_password', password);
      sessionStorage.setItem('admin_login_flag', 'true');

      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao abrir login do estabelecimento:', error);
      toast.error('Erro ao abrir login do estabelecimento.');
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesStatus = filterStatus === 'all' || reg.status === filterStatus;
    const matchesAccountType = filterAccountType === 'all' || (reg.account_type || 'paid') === filterAccountType;
    const matchesSearch = searchTerm === '' ||
      reg.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.establishment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reg.client_whatsapp && reg.client_whatsapp.includes(searchTerm));

    return matchesStatus && matchesAccountType && matchesSearch;
  });

  // Separar por tipo de conta
  const paidRegistrations = filteredRegistrations.filter(reg => (reg.account_type || 'paid') === 'paid');
  const testRegistrations = filteredRegistrations.filter(reg => reg.account_type === 'test');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'approved':
        return 'Aprovado';
      case 'rejected':
        return 'Rejeitado';
      default:
        return 'Desconhecido';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Novas Inscrições</h2>
                <p className="text-blue-100">
                  {paidRegistrations.length} cliente(s) pago(s) | {testRegistrations.length} cliente(s) teste
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                viewMode === 'list' ? 'bg-white text-blue-700' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              Inscrições
            </button>
            <button
              type="button"
              onClick={() => setViewMode('create')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
                viewMode === 'create' ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-500/90 text-white hover:bg-emerald-400'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Criar conta
            </button>
          </div>
        </div>

        {viewMode === 'create' ? (
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="max-w-xl mx-auto">
              <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="text-lg font-bold text-blue-900">Criar conta (uso interno)</h3>
                <p className="text-sm text-blue-800 mt-1">
                  Conta normal do sistema — o barbeiro usa tudo igual (agenda, clientes, WhatsApp etc.).
                  Você cria aqui sem passar pelo pagamento do site. Validade inicial de 30 dias; depois segue o fluxo normal de renovação.
                </p>
              </div>

              <form onSubmit={handleCreateManualAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do cliente</label>
                  <input
                    type="text"
                    value={createForm.client_name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, client_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                    placeholder="Ex.: João Silva"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do estabelecimento</label>
                  <input
                    type="text"
                    value={createForm.establishment_name}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, establishment_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                    placeholder="Ex.: Barbearia Silva"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                    placeholder="email@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      value={createForm.password}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={showCreatePassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showCreatePassword ? 'Ocultar' : 'Ver'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (com DDD)</label>
                  <input
                    type="tel"
                    value={createForm.client_whatsapp}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, client_whatsapp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                    placeholder="48999999999"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingAccount}
                    className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 transition-colors font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    {isCreatingAccount ? 'Criando conta...' : 'Criar conta'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateForm(emptyCreateForm());
                      setViewMode('list');
                    }}
                    className="sm:w-auto px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
        <div className="flex flex-col lg:flex-row h-[calc(90vh-120px)]">
          {/* Lista de inscrições */}
          <div className="flex-1 border-r border-gray-200 overflow-hidden">
            {/* Filtros */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Busca */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por nome, estabelecimento, email ou WhatsApp..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Filtro de status */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendentes</option>
                    <option value="approved">Aprovados</option>
                    <option value="rejected">Rejeitados</option>
                  </select>
                </div>

                {/* Filtro de tipo de conta */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filterAccountType}
                    onChange={(e) => setFilterAccountType(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="all">Todos os tipos</option>
                    <option value="paid">Clientes Pagos</option>
                    <option value="test">Clientes Teste</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto h-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : filteredRegistrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg font-medium">Nenhuma inscrição encontrada</p>
                  <p className="text-sm">Não há inscrições que correspondam aos filtros</p>
                </div>
              ) : (
                <div className="space-y-6 p-4">
                  {/* Seção Clientes Pagos */}
                  {(filterAccountType === 'all' || filterAccountType === 'paid') && paidRegistrations.length > 0 && (
                    <div>
                      <div className="bg-blue-50 border-b-2 border-blue-300 px-4 py-2 mb-2 rounded-t-lg">
                        <h3 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          CLIENTES PAGOS ({paidRegistrations.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {paidRegistrations.map((registration) => (
                          <div
                            key={registration.id}
                            onClick={() => setSelectedRegistration(registration)}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedRegistration?.id === registration.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium text-gray-900 truncate">
                                    {registration.client_name}
                                  </span>
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                                    PAGO
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Building className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600 truncate">
                                    {registration.establishment_name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-500 truncate">
                                    {registration.email}
                                  </span>
                                </div>
                                {registration.client_whatsapp && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-500 truncate">
                                      {registration.client_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(registration.status)}`}>
                                  {getStatusIcon(registration.status)}
                                  {getStatusText(registration.status)}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatDate(registration.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Seção Clientes Teste */}
                  {(filterAccountType === 'all' || filterAccountType === 'test') && testRegistrations.length > 0 && (
                    <div>
                      <div className="bg-green-50 border-b-2 border-green-300 px-4 py-2 mb-2 rounded-t-lg">
                        <h3 className="text-sm font-bold text-green-800 flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          CLIENTES TESTE ({testRegistrations.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {testRegistrations.map((registration) => (
                          <div
                            key={registration.id}
                            onClick={() => setSelectedRegistration(registration)}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedRegistration?.id === registration.id
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium text-gray-900 truncate">
                                    {registration.client_name}
                                  </span>
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">
                                    TESTE
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Building className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600 truncate">
                                    {registration.establishment_name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-500 truncate">
                                    {registration.email}
                                  </span>
                                </div>
                                {registration.client_whatsapp && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-500 truncate">
                                      {registration.client_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(registration.status)}`}>
                                  {getStatusIcon(registration.status)}
                                  {getStatusText(registration.status)}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatDate(registration.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Detalhes da inscrição */}
          {selectedRegistration && (
            <div className="w-full lg:w-96 p-6 overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Detalhes da Inscrição
                  </h3>

                  <div className="space-y-4">
                    {/* Badge de tipo de conta */}
                    <div>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${(selectedRegistration.account_type || 'paid') === 'paid'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                        }`}>
                        {(selectedRegistration.account_type || 'paid') === 'paid' ? 'CLIENTE PAGO' : 'CLIENTE TESTE'}
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Cliente
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{selectedRegistration.client_name}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Estabelecimento
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Building className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{selectedRegistration.establishment_name}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-mail
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{selectedRegistration.email}</span>
                      </div>
                    </div>

                    {selectedRegistration.client_whatsapp && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          WhatsApp
                        </label>
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900 flex-1">
                            {selectedRegistration.client_whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                          </span>
                          <a
                            href={`https://wa.me/55${selectedRegistration.client_whatsapp}?text=${selectedRegistration.account_type === 'test'
                              ? 'Quero%20ativar%20minha%20conta%20de%20teste'
                              : 'Olá,%20seja%20muito%20bem-vindo%20ao%20Agendei%20Fácil!%20🚀%0A%0ASomos%20o%20sistema%20de%20agendamentos%20mais%20completo%20do%20mercado%20e%20a%20sua%20conta%20foi%20criada%20com%20sucesso.%20🎉%0A%0AEu%20sou%20o%20Fernando,%20seu%20suporte%20pessoal,%20e%20estarei%20sempre%20à%20disposição%20para%20te%20ajudar.%0APodemos%20liberar%20seu%20acesso%20agora?%20✅'
                              }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 text-sm"
                            title="Enviar mensagem de boas-vindas no WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Senha (Texto Claro)
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <Lock className="w-4 h-4 text-red-500" />
                        <span className="text-red-900 font-mono font-bold text-lg">
                          {selectedRegistration.password}
                        </span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        ⚠️ Senha em texto claro - visível apenas para admin
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => loginAsRegistration(selectedRegistration)}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      title="Sair do admin e abrir /login com email e senha deste estabelecimento preenchidos"
                    >
                      <LogIn className="w-4 h-4" />
                      Login neste estabelecimento
                    </button>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data de Inscrição
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">
                          {formatDate(selectedRegistration.created_at)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedRegistration.status)}`}>
                        {getStatusIcon(selectedRegistration.status)}
                        {getStatusText(selectedRegistration.status)}
                      </span>
                    </div>

                    {selectedRegistration.notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Observações
                        </label>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-gray-900">{selectedRegistration.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                {selectedRegistration.status === 'pending' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Observações (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Adicione observações sobre esta inscrição..."
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => updateRegistrationStatus(selectedRegistration.id, 'approved')}
                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => updateRegistrationStatus(selectedRegistration.id, 'rejected')}
                        className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Rejeitar
                      </button>
                    </div>
                  </div>
                )}

                {/* Botão CRIAR CONTA */}
                {selectedRegistration.status === 'pending' && (
                  <button
                    onClick={() => createAccount(selectedRegistration)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-3"
                  >
                    <UserPlus className="w-4 h-4" />
                    CRIAR CONTA
                  </button>
                )}

                {/* Botão de exclusão */}
                <button
                  onClick={() => deleteRegistration(selectedRegistration.id)}
                  className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Inscrição
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
