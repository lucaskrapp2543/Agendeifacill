import {
  Building,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Filter,
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

interface NewRegistrationsProps {
  onClose: () => void;
}

export const NewRegistrations: React.FC<NewRegistrationsProps> = ({ onClose }) => {
  const [registrations, setRegistrations] = useState<RegistrationForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRegistration, setSelectedRegistration] = useState<RegistrationForm | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [filterAccountType, setFilterAccountType] = useState<'all' | 'paid' | 'test'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');

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

    try {
      const { data: currentAdminUser } = await supabase.auth.getUser();
      const token = String(currentAdminUser?.session?.access_token || '');
      if (!token) {
        toast.error('Sessão do admin inválida. Faça login novamente.');
        return;
      }

      const resp = await fetch('/.netlify/functions/admin-create-establishment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ registrationId: registration.id, mode: 'create' }),
      });

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload?.ok) {
        console.error('Erro ao criar conta (fn):', payload);
        if (resp.status === 404) {
          toast.error('Função não encontrada no localhost. Rode o projeto com `netlify dev` ou teste no deploy.');
        } else {
          toast.error(payload?.error || 'Erro ao criar conta');
        }
        return;
      }

      toast.success(`Conta criada com sucesso! Código: ${payload.establishmentCode}. O usuário pode fazer login imediatamente.`);
      setSelectedRegistration(null);
      fetchRegistrations();
    } catch (error) {
      console.error('Erro ao criar conta:', error);
      toast.error('Erro ao criar conta');
    }
  };

  const repairLogin = async (registration: RegistrationForm) => {
    if (!confirm(`Reparar login de ${registration.establishment_name}? Isso vai confirmar o e-mail e redefinir a senha para a senha salva na inscrição.`)) {
      return;
    }
    try {
      const { data: currentAdminUser } = await supabase.auth.getUser();
      const token = String(currentAdminUser?.session?.access_token || '');
      if (!token) {
        toast.error('Sessão do admin inválida. Faça login novamente.');
        return;
      }

      const resp = await fetch('/.netlify/functions/admin-create-establishment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ registrationId: registration.id, mode: 'repair' }),
      });

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || !payload?.ok) {
        console.error('Erro ao reparar login (fn):', payload);
        if (resp.status === 404) {
          toast.error('Função não encontrada no localhost. Rode o projeto com `netlify dev` ou teste no deploy.');
        } else {
          toast.error(payload?.error || 'Erro ao reparar login');
        }
        return;
      }

      toast.success(`Login reparado! Agora o usuário deve conseguir entrar. Código: ${payload.establishmentCode}`);
      fetchRegistrations();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao reparar login.');
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
        </div>

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

                {/* Botão REPARAR LOGIN (para aprovados) */}
                {selectedRegistration.status === 'approved' && (
                  <button
                    onClick={() => repairLogin(selectedRegistration)}
                    className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 mb-3"
                    title="Confirma e-mail e redefine a senha usando a senha salva na inscrição"
                  >
                    <Lock className="w-4 h-4" />
                    REPARAR LOGIN
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
      </div>
    </div>
  );
};
