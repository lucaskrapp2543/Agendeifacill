import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  X,
  XCircle
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AdminEstablishmentWhatsappReminders } from '../../modules/whatsapp-reminders/ui/AdminEstablishmentWhatsappReminders';
import { AppDownloadLinks } from '../components/AppDownloadLinks';
import { NewRegistrations } from '../components/NewRegistrations';
import { PWADownloadLink } from '../components/PWADownloadLink';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Establishment {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  created_at: string;
  payment_status: 'paid' | 'unpaid' | 'expired';
  plan_type: 'monthly' | 'annual' | 'trial';
  plan_prata_active?: boolean; // ✅ ativado via botão PRATA no Admin
  payment_due_date: string;
  payment_paid_at?: string | null; // Quando foi marcado como pago (para "pagou no mês")
  owner_email?: string;
  is_deleted?: boolean;
  is_blocked?: boolean;
  last_access?: string | null;
  payment_alert_enabled?: boolean;
  promotion_enabled?: boolean; // Indica se a propaganda está ativada
  booking_blocked?: boolean; // Indica se o booking está bloqueado
  admin_notes?: string; // Observações privadas do admin
  admin_profit_value?: number | null; // Valor manual de lucro (admin) para somar no saldo geral
  admin_payment_link?: string | null; // Link de pagamento para envio de cobrança (admin)
  whatsapp?: string; // WhatsApp do estabelecimento
  pagamento_adiantado_liberado_admin?: boolean; // Liberação pelo admin para mostrar "Pagamento adiantado" ao barbeiro
}

// (removido) AdminCostRow

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [deletedEstablishments, setDeletedEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSaldos, setIsLoadingSaldos] = useState(false);
  const [saldosPorEstabelecimento, setSaldosPorEstabelecimento] = useState<Record<string, number>>({});
  const [totalVendasLiquidasPorEstabelecimento, setTotalVendasLiquidasPorEstabelecimento] = useState<Record<string, number>>({});
  const [totalPagoAdminPorEstabelecimento, setTotalPagoAdminPorEstabelecimento] = useState<Record<string, number>>({});
  const [qtdPixPagoPorEstabelecimento, setQtdPixPagoPorEstabelecimento] = useState<Record<string, number>>({});
  const [isPayingByEstablishment, setIsPayingByEstablishment] = useState<Record<string, boolean>>({});
  const [showPayoutHistoryModal, setShowPayoutHistoryModal] = useState(false);
  const [payoutHistoryEstablishment, setPayoutHistoryEstablishment] = useState<Establishment | null>(null);
  const [payoutHistoryRows, setPayoutHistoryRows] = useState<any[]>([]);
  const [isLoadingPayoutHistory, setIsLoadingPayoutHistory] = useState(false);
  const [showWhatsappRemindersModal, setShowWhatsappRemindersModal] = useState(false);
  const [whatsappRemindersEstablishment, setWhatsappRemindersEstablishment] = useState<Establishment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTermDeleted, setSearchTermDeleted] = useState(''); // Busca na lixeira
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'expired'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'monthly' | 'annual'>('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showNewRegistrations, setShowNewRegistrations] = useState(false);
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [showEstablishmentInfoModal, setShowEstablishmentInfoModal] = useState(false);
  const [selectedEstablishmentForInfo, setSelectedEstablishmentForInfo] = useState<Establishment | null>(null);
  const [establishmentInfo, setEstablishmentInfo] = useState<{ email?: string; password?: string; whatsapp?: string } | null>(null);
  const [isLoadingEstablishmentInfo, setIsLoadingEstablishmentInfo] = useState(false);

  // Estados para contagem de agendamentos
  const [selectedDateForAppointments, setSelectedDateForAppointments] = useState<Record<string, Date>>({});
  const [selectedMonthForAppointments, setSelectedMonthForAppointments] = useState<Record<string, Date>>({});
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, { day: number; month: number }>>({});
  const [isLoadingAppointmentCounts, setIsLoadingAppointmentCounts] = useState<Record<string, boolean>>({});

  // (removido) custo por estabelecimento (storage + banco)

  // Função para buscar contagem de agendamentos (dia e mês)
  const fetchAppointmentCounts = async (establishment: Establishment, date: Date, month: Date) => {
    const key = establishment.id;
    setIsLoadingAppointmentCounts(prev => ({ ...prev, [key]: true }));

    try {
      // Contar agendamentos do DIA
      const dayStart = format(startOfDay(date), 'yyyy-MM-dd');
      const dayEnd = format(endOfDay(date), 'yyyy-MM-dd');

      const { count: dayCount, error: dayError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', dayStart)
        .lte('appointment_date', dayEnd);

      if (dayError) {
        console.error('Erro ao contar agendamentos do dia:', dayError);
      }

      // Contar agendamentos do MÊS
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');

      const { count: monthCount, error: monthError } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('establishment_id', establishment.id)
        .gte('appointment_date', monthStart)
        .lte('appointment_date', monthEnd);

      if (monthError) {
        console.error('Erro ao contar agendamentos do mês:', monthError);
      }

      setAppointmentCounts(prev => ({
        ...prev,
        [key]: {
          day: dayCount || 0,
          month: monthCount || 0
        }
      }));
    } catch (error) {
      console.error('Erro ao buscar contagem de agendamentos:', error);
    } finally {
      setIsLoadingAppointmentCounts(prev => ({ ...prev, [key]: false }));
    }
  };

  // Função para inicializar data/mês para um estabelecimento (se ainda não tiver)
  const getSelectedDateForEstablishment = (establishmentId: string): Date => {
    if (!selectedDateForAppointments[establishmentId]) {
      return new Date();
    }
    return selectedDateForAppointments[establishmentId];
  };

  const getSelectedMonthForEstablishment = (establishmentId: string): Date => {
    if (!selectedMonthForAppointments[establishmentId]) {
      return new Date();
    }
    return selectedMonthForAppointments[establishmentId];
  };

  // Função para navegar para o dia anterior
  const navigateDayBack = (establishment: Establishment) => {
    const currentDate = getSelectedDateForEstablishment(establishment.id);
    const newDate = subDays(currentDate, 1);
    setSelectedDateForAppointments(prev => ({ ...prev, [establishment.id]: newDate }));
    fetchAppointmentCounts(establishment, newDate, getSelectedMonthForEstablishment(establishment.id));
  };

  // Função para navegar para o mês anterior
  const navigateMonthBack = (establishment: Establishment) => {
    const currentMonth = getSelectedMonthForEstablishment(establishment.id);
    const newMonth = subMonths(currentMonth, 1);
    setSelectedMonthForAppointments(prev => ({ ...prev, [establishment.id]: newMonth }));
    fetchAppointmentCounts(establishment, getSelectedDateForEstablishment(establishment.id), newMonth);
  };

  // Função para carregar contagem inicial (lazy load - só quando necessário)
  const loadAppointmentCounts = async (establishment: Establishment) => {
    // Evitar carregar múltiplas vezes
    if (isLoadingAppointmentCounts[establishment.id]) return;
    if (appointmentCounts[establishment.id]) return; // Já carregado

    const date = getSelectedDateForEstablishment(establishment.id);
    const month = getSelectedMonthForEstablishment(establishment.id);
    await fetchAppointmentCounts(establishment, date, month);
  };

  // Função para buscar informações do estabelecimento (email, senha, whatsapp)
  const fetchEstablishmentInfo = async (establishment: Establishment) => {
    setIsLoadingEstablishmentInfo(true);
    try {
      // Buscar na tabela registration_forms pelo nome do estabelecimento
      const { data: registrationData, error: regError } = await supabase
        .from('registration_forms')
        .select('email, password, client_whatsapp')
        .eq('establishment_name', establishment.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (regError && regError.code !== 'PGRST116') { // PGRST116 = nenhum resultado
        console.error('Erro ao buscar dados do registration_forms:', regError);
      }

      // Se não encontrar no registration_forms, buscar email do owner_id
      let ownerEmail = '';
      if (establishment.owner_id) {
        try {
          const { data: userData, error: userError } = await supabase.auth.admin.getUserById(establishment.owner_id);
          if (!userError && userData?.user) {
            ownerEmail = userData.user.email || '';
          }
        } catch (err) {
          console.error('Erro ao buscar email do owner:', err);
        }
      }

      setEstablishmentInfo({
        email: registrationData?.email || ownerEmail || establishment.owner_email || 'Não encontrado',
        password: registrationData?.password || 'Não encontrado',
        whatsapp: registrationData?.client_whatsapp || establishment.whatsapp || 'Não encontrado'
      });
    } catch (error) {
      console.error('Erro ao buscar informações:', error);
      toast.error('Erro ao buscar informações do estabelecimento');
    } finally {
      setIsLoadingEstablishmentInfo(false);
    }
  };

  // Função para abrir modal de informações
  const handleOpenEstablishmentInfo = async (establishment: Establishment) => {
    setSelectedEstablishmentForInfo(establishment);
    setShowEstablishmentInfoModal(true);
    await fetchEstablishmentInfo(establishment);
  };

  // Função para logar como estabelecimento
  const handleLoginAsEstablishment = async () => {
    if (!establishmentInfo || !establishmentInfo.email || !establishmentInfo.password) {
      toast.error('Email ou senha não encontrados');
      return;
    }

    if (!selectedEstablishmentForInfo) return;

    try {
      // Salvar credenciais temporariamente no sessionStorage
      sessionStorage.setItem('admin_login_email', establishmentInfo.email);
      sessionStorage.setItem('admin_login_password', establishmentInfo.password);
      sessionStorage.setItem('admin_login_flag', 'true');

      // Fazer logout do admin
      await signOut();

      // Navegar para a página de login
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer login como estabelecimento:', error);
      toast.error('Erro ao fazer logout');
    }
  };
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [emailToCheck, setEmailToCheck] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [editingEstablishment, setEditingEstablishment] = useState<Establishment | null>(null);
  const [notesText, setNotesText] = useState('');

  // ✅ Valor manual por estabelecimento (lucro) + salvar
  const [profitInputByEstablishment, setProfitInputByEstablishment] = useState<Record<string, string>>({});
  const [isSavingProfitByEstablishment, setIsSavingProfitByEstablishment] = useState<Record<string, boolean>>({});

  // ✅ Link de pagamento por estabelecimento (admin)
  const [paymentLinkInputByEstablishment, setPaymentLinkInputByEstablishment] = useState<Record<string, string>>({});
  const [isSavingPaymentLinkByEstablishment, setIsSavingPaymentLinkByEstablishment] = useState<Record<string, boolean>>({});
  const paymentLinkSaveTimeoutRef = useRef<Record<string, any>>({});

  // ✅ Links globais do Plano Ouro e Diamante (admin) - envio não direcionado (abre seletor do WhatsApp)
  const [ouroLink, setOuroLink] = useState('');
  const [isLoadingOuroLink, setIsLoadingOuroLink] = useState(false);
  const [isSavingOuroLink, setIsSavingOuroLink] = useState(false);
  const [prataLink, setPrataLink] = useState('');
  const [isLoadingPrataLink, setIsLoadingPrataLink] = useState(false);
  const [isSavingPrataLink, setIsSavingPrataLink] = useState(false);
  const [diamanteLink, setDiamanteLink] = useState('');
  const [isLoadingDiamanteLink, setIsLoadingDiamanteLink] = useState(false);
  const [isSavingDiamanteLink, setIsSavingDiamanteLink] = useState(false);

  // ✅ Clientes (estabelecimentos) criados no mês selecionado
  const [clientsMonth, setClientsMonth] = useState<Date>(() => new Date());
  const [clientsMonthCount, setClientsMonthCount] = useState<number>(0);
  const [isLoadingClientsMonth, setIsLoadingClientsMonth] = useState(false);

  const togglePagamentoAdiantadoAdmin = async (establishmentId: string, current: boolean) => {
    try {
      const next = !current;

      // Se o admin está DESATIVANDO, forçar o estabelecimento a parar de exigir pagamento antecipado.
      const payload: any = { pagamento_adiantado_liberado_admin: next };
      if (!next) payload.exigir_pagamento_antecipado = false;

      const { error } = await supabase
        .from('establishments')
        .update(payload)
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro ao atualizar pagamento adiantado (admin):', error);
        toast.error('Erro ao atualizar pagamento adiantado');
        return;
      }

      setEstablishments(prev =>
        prev.map(e =>
          e.id === establishmentId
            ? {
              ...e,
              pagamento_adiantado_liberado_admin: next,
            }
            : e
        )
      );

      toast.success(next ? 'Pagamento adiantado liberado para o estabelecimento' : 'Pagamento adiantado bloqueado (e desativado no booking)');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar pagamento adiantado');
    }
  };

  // Verificar se é a conta de suporte
  const isSupportAccount = user?.email === 'suporteagendeifacil@gmail.com';

  const openWhatsappRemindersModal = (establishment: Establishment) => {
    if (!isSupportAccount) return;
    setWhatsappRemindersEstablishment(establishment);
    setShowWhatsappRemindersModal(true);
  };

  // ✅ Botão PRATA no Admin (toggle)
  const togglePlanPrata = async (establishment: Establishment) => {
    try {
      const next = !Boolean(establishment.plan_prata_active);
      const { error } = await supabase
        .from('establishments')
        .update({ plan_prata_active: next })
        .eq('id', establishment.id);
      if (error) throw error;

      setEstablishments(prev =>
        prev.map(e => (e.id === establishment.id ? { ...e, plan_prata_active: next } : e))
      );
      toast.success(next ? 'Plano PRATA ativado' : 'Plano PRATA desativado');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar PRATA');
    }
  };

  const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const normalizarTexto = (v: string) =>
    String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const parseValorCents = (token: string): number | null => {
    const t = String(token || '').trim();
    // Só considera "dinheiro" quando tiver separador decimal (27,90 / 27.90)
    if (!/[,.]/.test(t)) return null;
    const cleaned = t.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  };

  const valorCents = (v: unknown): number | null => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 100);
  };

  const calcularLiquidoPix = (bruto: number) => {
    const taxaPlataforma = 0.5; // R$ 0,50
    const taxaPixPercent = 1.19 / 100; // 1,19%
    const liquido = bruto - taxaPlataforma - bruto * taxaPixPercent;
    return Math.max(0, Math.round(liquido * 100) / 100);
  };

  // (removido) carregarCostMetrics

  const carregarSaldosEmVendas = async (establishmentsList: Establishment[]) => {
    const ids = (establishmentsList || []).map(e => e.id).filter(Boolean);
    if (ids.length === 0) return;

    setIsLoadingSaldos(true);
    try {
      // 1) Payouts (histórico de pagamentos do admin)
      let payouts: any[] = [];
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('establishment_payouts')
        .select('establishment_id,amount')
        .in('establishment_id', ids);

      if (payoutsError) {
        const msg = String((payoutsError as any)?.message || '');
        // se migration ainda não aplicada, seguir com payouts=0
        if (!/establishment_payouts/i.test(msg)) throw payoutsError;
      } else {
        payouts = (payoutsData as any[]) || [];
      }

      const pagoMap: Record<string, number> = {};
      for (const p of payouts) {
        const estId = String(p?.establishment_id || '');
        const amount = Number(p?.amount ?? 0);
        if (!estId || !Number.isFinite(amount)) continue;
        pagoMap[estId] = Math.round(((pagoMap[estId] || 0) + amount) * 100) / 100;
      }

      // 2) Vendas PIX pagas (appointments)
      // Filtrar: confirmed + pix + (payment_status=paid OR pix_payment_status=confirmado)
      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        // ✅ No Supabase de produção pode não existir service_price; usar apenas price
        .select('id,establishment_id,price,payment_status,pix_payment_status,payment_method,payment_transaction_id,status')
        .in('establishment_id', ids)
        .or('payment_status.eq.paid,pix_payment_status.eq.confirmado');

      if (apptsError) throw apptsError;

      const totalLiquidoMap: Record<string, number> = {};
      const qtdMap: Record<string, number> = {};
      const seenByEst = new Map<string, Set<string>>();

      for (const row of (appts as any[]) || []) {
        const estId = String(row?.establishment_id || '');
        const id = String(row?.id || '');
        if (!estId || !id) continue;
        if (!seenByEst.has(estId)) seenByEst.set(estId, new Set());
        const seen = seenByEst.get(estId)!;
        if (seen.has(id)) continue;
        seen.add(id);

        const paymentStatus = String(row?.payment_status || '').toLowerCase();
        const pixPaymentStatus = String(row?.pix_payment_status || '').toLowerCase();
        const hasTransactionId = Boolean(String(row?.payment_transaction_id || '').trim());
        const isPaid = paymentStatus === 'paid' || pixPaymentStatus === 'confirmado';
        if (!isPaid) continue;
        if (paymentStatus === 'paid' && !hasTransactionId && pixPaymentStatus !== 'confirmado') continue;

        const metodo = String(row?.payment_method || '').toLowerCase();
        const isPix =
          metodo === 'pix' ||
          metodo === 'pix_now' ||
          pixPaymentStatus === 'confirmado' ||
          (paymentStatus === 'paid' && hasTransactionId);
        if (!isPix) continue;

        const status = String(row?.status || '').toLowerCase();
        if (status !== 'confirmed') continue; // regra do produto: só entra se finalizou agendamento

        const bruto = Number(row?.price ?? 0);
        if (!Number.isFinite(bruto) || bruto <= 0) continue;

        totalLiquidoMap[estId] = Math.round(((totalLiquidoMap[estId] || 0) + calcularLiquidoPix(bruto)) * 100) / 100;
        qtdMap[estId] = (qtdMap[estId] || 0) + 1;
      }

      const saldoMap: Record<string, number> = {};
      for (const estId of ids) {
        const totalLiquido = totalLiquidoMap[estId] || 0;
        const totalPago = pagoMap[estId] || 0;
        saldoMap[estId] = Math.max(0, Math.round((totalLiquido - totalPago) * 100) / 100);
      }

      setTotalVendasLiquidasPorEstabelecimento(totalLiquidoMap);
      setTotalPagoAdminPorEstabelecimento(pagoMap);
      setQtdPixPagoPorEstabelecimento(qtdMap);
      setSaldosPorEstabelecimento(saldoMap);
    } catch (e: any) {
      console.error('Erro ao carregar saldos em vendas (admin):', e);
      toast.error('Não foi possível calcular os saldos em vendas agora.');
    } finally {
      setIsLoadingSaldos(false);
    }
  };

  const registrarPagamentoSaldoTotal = async (establishment: Establishment) => {
    try {
      const estId = establishment.id;
      const saldoAtual = Number(saldosPorEstabelecimento[estId] || 0);
      if (!saldoAtual || saldoAtual <= 0) {
        toast.error('Saldo zerado. Nada para pagar.');
        return;
      }
      if (!user?.id) {
        toast.error('Usuário não autenticado.');
        return;
      }

      const confirm = window.confirm(`Confirmar pagamento do saldo total?\n${establishment.name} (${establishment.code})\nValor: ${fmtBRL(saldoAtual)}`);
      if (!confirm) return;

      setIsPayingByEstablishment(prev => ({ ...prev, [estId]: true }));

      const { error } = await supabase
        .from('establishment_payouts')
        .insert([
          {
            establishment_id: estId,
            amount: saldoAtual,
            paid_by: user.id,
            note: 'Pagamento registrado pelo admin (zerar saldo)',
          } as any,
        ]);

      if (error) {
        const msg = String((error as any)?.message || '');
        if (/establishment_payouts/i.test(msg)) {
          toast.error('Tabela de histórico não existe ainda. Aplique a migration no Supabase.');
        } else {
          toast.error('Erro ao registrar pagamento.');
        }
        console.error(error);
        return;
      }

      // Atualizar estado local: saldo zera
      setTotalPagoAdminPorEstabelecimento(prev => ({
        ...prev,
        [estId]: Math.round(((prev[estId] || 0) + saldoAtual) * 100) / 100,
      }));
      setSaldosPorEstabelecimento(prev => ({ ...prev, [estId]: 0 }));

      toast.success('Pagamento registrado e saldo zerado!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao registrar pagamento.');
    } finally {
      setIsPayingByEstablishment(prev => ({ ...prev, [establishment.id]: false }));
    }
  };

  const abrirHistoricoPagamentos = async (establishment: Establishment) => {
    setPayoutHistoryEstablishment(establishment);
    setShowPayoutHistoryModal(true);
    setIsLoadingPayoutHistory(true);
    try {
      const { data, error } = await supabase
        .from('establishment_payouts')
        .select('id,amount,created_at,paid_by,note')
        .eq('establishment_id', establishment.id)
        .order('created_at', { ascending: false });

      if (error) {
        const msg = String((error as any)?.message || '');
        if (/establishment_payouts/i.test(msg)) {
          toast.error('Tabela de histórico não existe ainda. Aplique a migration no Supabase.');
          setPayoutHistoryRows([]);
          return;
        }
        throw error;
      }

      setPayoutHistoryRows((data as any[]) || []);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar histórico de pagamentos.');
      setPayoutHistoryRows([]);
    } finally {
      setIsLoadingPayoutHistory(false);
    }
  };

  // Função para formatar o último acesso
  const formatLastAccess = (lastAccess: string | null) => {
    if (!lastAccess) return 'Nunca acessou';

    const lastAccessDate = new Date(lastAccess);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - lastAccessDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Agora mesmo';
    if (diffInMinutes < 60) return `${diffInMinutes} min atrás`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h atrás`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} dias atrás`;

    return lastAccessDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
        loadAdminBillingLinks();
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

  const loadAdminBillingLinks = async () => {
    setIsLoadingOuroLink(true);
    setIsLoadingPrataLink(true);
    setIsLoadingDiamanteLink(true);
    try {
      const { data, error } = await supabase
        .from('admin_billing_links')
        .select('id, ouro_link, prata_link, diamante_link')
        .eq('id', 'global')
        .maybeSingle();

      if (error) throw error;
      setOuroLink(String((data as any)?.ouro_link || ''));
      setPrataLink(String((data as any)?.prata_link || ''));
      setDiamanteLink(String((data as any)?.diamante_link || ''));
    } catch (e) {
      console.error('Erro ao carregar links do admin:', e);
    } finally {
      setIsLoadingOuroLink(false);
      setIsLoadingPrataLink(false);
      setIsLoadingDiamanteLink(false);
    }
  };

  const saveOuroLink = async () => {
    const link = ouroLink.trim();
    setIsSavingOuroLink(true);
    try {
      const { error } = await supabase
        .from('admin_billing_links')
        .upsert(
          {
            id: 'global',
            ouro_link: link.length ? link : null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'id' }
        );

      if (error) {
        toast.error('Erro ao salvar link do Ouro. Aplique a migration `admin_billing_links` no Supabase.');
        console.error(error);
        return;
      }

      toast.success('Link do Ouro salvo!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar link do Ouro.');
    } finally {
      setIsSavingOuroLink(false);
    }
  };

  const sendOuroWhatsapp = async () => {
    const link = ouroLink.trim();
    if (!link) {
      toast.error('Cole o link do Ouro primeiro.');
      return;
    }

    // salvar antes de enviar
    await saveOuroLink();

    const cnpjPix = '57436351000167';
    const valorOuro = 'R$ 47,90';
    const message =
      `🎉 Parabéns! Você está prestes a ser Plano Ouro Agendei Fácil! 🚀\n\n` +
      `✨ Basta acessar esse link e efetuar o pagamento:\n${link}\n\n` +
      `💳 Ou se preferir, faça um PIX direto para esse CNPJ:\n${cnpjPix}\n` +
      `💰 Valor: ${valorOuro}\n\n` +
      `✅ Me avise assim que pagar ou envie o comprovante aqui para seguirmos com sua ativação! 😊`;

    // wa.me sem número => abre seletor de contato
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const savePrataLink = async () => {
    const link = prataLink.trim();
    setIsSavingPrataLink(true);
    try {
      const { error } = await supabase
        .from('admin_billing_links')
        .upsert(
          {
            id: 'global',
            prata_link: link.length ? link : null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'id' }
        );

      if (error) {
        toast.error('Erro ao salvar link do Prata. Aplique a migration `admin_billing_links` no Supabase.');
        console.error(error);
        return;
      }

      toast.success('Link do Prata salvo!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar link do Prata.');
    } finally {
      setIsSavingPrataLink(false);
    }
  };

  const sendPrataWhatsapp = async () => {
    const link = prataLink.trim();
    if (!link) {
      toast.error('Cole o link do Prata primeiro.');
      return;
    }

    // salvar antes de enviar
    await savePrataLink();

    const cnpjPix = '57436351000167';
    // Observação: o valor do PRATA também existe em `PlanosCards.tsx` (WhatsApp). Ajuste quando quiser.
    const valorPrata = 'R$ 27,90';
    const message =
      `🎉 Parabéns! Você está prestes a ser Plano Prata Agendei Fácil! 🥈\n\n` +
      `✨ Basta acessar esse link e efetuar o pagamento:\n${link}\n\n` +
      `💳 Ou se preferir, faça um PIX direto para esse CNPJ:\n${cnpjPix}\n` +
      `💰 Valor: ${valorPrata}\n\n` +
      `✅ Me avise assim que pagar ou envie o comprovante aqui para seguirmos com sua ativação! 😊`;

    // wa.me sem número => abre seletor de contato
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const saveDiamanteLink = async () => {
    const link = diamanteLink.trim();
    setIsSavingDiamanteLink(true);
    try {
      const { error } = await supabase
        .from('admin_billing_links')
        .upsert(
          {
            id: 'global',
            diamante_link: link.length ? link : null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'id' }
        );

      if (error) {
        toast.error('Erro ao salvar link do Diamante. Aplique a migration `admin_billing_links` no Supabase.');
        console.error(error);
        return;
      }

      toast.success('Link do Diamante salvo!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar link do Diamante.');
    } finally {
      setIsSavingDiamanteLink(false);
    }
  };

  const sendDiamanteWhatsapp = async () => {
    const link = diamanteLink.trim();
    if (!link) {
      toast.error('Cole o link do Diamante primeiro.');
      return;
    }

    // salvar antes de enviar
    await saveDiamanteLink();

    const cnpjPix = '57436351000167';
    const valorDiamante = 'R$ 77,90';
    const message =
      `🎉 Parabéns! Você está prestes a ser Plano Diamante Agendei Fácil! 💎\n\n` +
      `✨ Basta acessar esse link e efetuar o pagamento:\n${link}\n\n` +
      `💳 Ou se preferir, faça um PIX direto para esse CNPJ:\n${cnpjPix}\n` +
      `💰 Valor: ${valorDiamante}\n\n` +
      `✅ Me avise assim que pagar ou envie o comprovante aqui para seguirmos com sua ativação! 😊`;

    // wa.me sem número => abre seletor de contato
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
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
      const establishmentsWithEmails = await Promise.all(
        establishmentsData.map(async (establishment) => {
          const profile = profilesData.find(p => p.id === establishment.owner_id);

          // Buscar último agendamento para este estabelecimento
          const { data: lastAppointment } = await supabase
            .from('appointments')
            .select('created_at')
            .eq('establishment_id', establishment.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const processedEstablishment = {
            ...establishment,
            owner_email: profile?.name || 'Email não encontrado',
            payment_status: establishment.payment_status || 'unpaid',
            plan_type: establishment.plan_type || 'monthly',
            plan_prata_active: Boolean((establishment as any).plan_prata_active),
            payment_due_date: establishment.payment_due_date || establishment.created_at,
            payment_paid_at: establishment.payment_paid_at || null,
            is_blocked: establishment.is_blocked || false,
            last_access: lastAppointment?.created_at || null,
            payment_alert_enabled: establishment.payment_alert_enabled || false,
            promotion_enabled: establishment.promotion_enabled || false,
            admin_profit_value: Number(establishment.admin_profit_value ?? 0),
            admin_payment_link: establishment.admin_payment_link || null,
            whatsapp: establishment.whatsapp || ''
          };

          return processedEstablishment;
        })
      );

      // Combinar dados dos estabelecimentos excluídos
      const deletedWithEmails = deletedData.map(establishment => {
        const profile = profilesData.find(p => p.id === establishment.owner_id);
        return {
          ...establishment,
          owner_email: profile?.name || 'Email não encontrado',
          payment_status: establishment.payment_status || 'unpaid',
          plan_type: establishment.plan_type || 'monthly',
          plan_prata_active: Boolean((establishment as any).plan_prata_active),
          payment_due_date: establishment.payment_due_date || establishment.created_at,
          payment_paid_at: establishment.payment_paid_at || null,
          is_blocked: establishment.is_blocked || false,
          payment_alert_enabled: establishment.payment_alert_enabled || false,
          promotion_enabled: establishment.promotion_enabled || false,
          admin_profit_value: Number(establishment.admin_profit_value ?? 0),
          admin_payment_link: establishment.admin_payment_link || null,
          whatsapp: establishment.whatsapp || ''
        };
      });

      setEstablishments(establishmentsWithEmails);
      setDeletedEstablishments(deletedWithEmails);

      // ✅ Carregar saldos em vendas (PIX pago) para controle do admin
      // (saldo = vendas líquidas - pagamentos já feitos)
      await carregarSaldosEmVendas(establishmentsWithEmails);

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

      // Se está marcando como PAGO, calcular próximo vencimento baseado no tipo de plano
      if (status === 'paid') {
        const establishment = establishments.find(est => est.id === establishmentId);
        const today = new Date();
        let nextDueDate: Date;

        if (establishment?.plan_type === 'trial') {
          // Plano de 7 dias: adiciona 7 dias
          nextDueDate = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
        } else if (establishment?.plan_type === 'annual') {
          // Plano anual: adiciona 1 ano
          nextDueDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
        } else {
          // Plano mensal: adiciona 1 mês (padrão)
          nextDueDate = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
        }

        updateData.payment_due_date = nextDueDate.toISOString().split('T')[0];
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
              payment_due_date: status === 'paid' ? updateData.payment_due_date : est.payment_due_date,
              payment_paid_at: est.payment_paid_at
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

  const updatePlanType = async (establishmentId: string, planType: 'monthly' | 'annual' | 'trial') => {
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

  // Função para ativar/desativar alerta de pagamento
  const togglePaymentAlert = async (establishmentId: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ payment_alert_enabled: !isEnabled })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro no Supabase:', error);
        throw error;
      }

      setEstablishments(prev =>
        prev.map(est =>
          est.id === establishmentId
            ? { ...est, payment_alert_enabled: !isEnabled }
            : est
        )
      );

      toast.success(!isEnabled ? 'Alerta de pagamento ativado!' : 'Alerta de pagamento desativado!');
    } catch (error) {
      console.error('Erro ao alterar status do alerta:', error);
      toast.error('Erro ao alterar status do alerta');
    }
  };

  // Função para ativar/desativar propaganda
  const togglePromotion = async (establishmentId: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ promotion_enabled: !isEnabled })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro no Supabase:', error);
        throw error;
      }

      setEstablishments(prev =>
        prev.map(est =>
          est.id === establishmentId
            ? { ...est, promotion_enabled: !isEnabled }
            : est
        )
      );

      toast.success(!isEnabled ? 'Propaganda ativada!' : 'Propaganda desativada!');
    } catch (error) {
      console.error('Erro ao alterar status da propaganda:', error);
      toast.error('Erro ao alterar status da propaganda');
    }
  };

  // Função para bloquear/desbloquear booking
  const toggleBookingBlock = async (establishmentId: string, isBlocked: boolean) => {
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ booking_blocked: !isBlocked })
        .eq('id', establishmentId);

      if (error) {
        console.error('Erro no Supabase:', error);
        throw error;
      }

      setEstablishments(prev =>
        prev.map(est =>
          est.id === establishmentId
            ? { ...est, booking_blocked: !isBlocked }
            : est
        )
      );

      toast.success(!isBlocked ? 'Booking bloqueado!' : 'Booking desbloqueado!');
    } catch (error) {
      console.error('Erro ao alterar status de bloqueio do booking:', error);
      toast.error('Erro ao alterar status de bloqueio do booking');
    }
  };

  // Função para abrir modal de observações
  const openNotesModal = (establishment: Establishment) => {
    setEditingEstablishment(establishment);
    setNotesText(establishment.admin_notes || '');
    setShowNotesModal(true);
  };

  // Função para salvar observações
  const saveNotes = async () => {
    if (!editingEstablishment) return;

    try {
      const { error } = await supabase
        .from('establishments')
        .update({ admin_notes: notesText.trim() || null })
        .eq('id', editingEstablishment.id);

      if (error) {
        console.error('Erro no Supabase:', error);
        throw error;
      }

      setEstablishments(prev =>
        prev.map(est =>
          est.id === editingEstablishment.id
            ? { ...est, admin_notes: notesText.trim() || undefined }
            : est
        )
      );

      toast.success('Observação salva com sucesso!');
      setShowNotesModal(false);
      setEditingEstablishment(null);
      setNotesText('');
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast.error('Erro ao salvar observação');
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

  const isSameMonthYear = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  const fetchClientsMonthCount = async (date: Date) => {
    setIsLoadingClientsMonth(true);
    try {
      const { start, end } = getMonthRange(date);

      const { count, error } = await supabase
        .from('establishments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .or('is_deleted.is.null,is_deleted.eq.false');

      if (error) throw error;
      setClientsMonthCount(count || 0);
    } catch (error) {
      console.error('Erro ao carregar clientes do mês (admin):', error);
      toast.error('Erro ao carregar clientes do mês');
      setClientsMonthCount(0);
    } finally {
      setIsLoadingClientsMonth(false);
    }
  };

  useEffect(() => {
    fetchClientsMonthCount(clientsMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsMonth]);

  // Pré-preencher inputs com o valor salvo (sem sobrescrever quem estiver digitando)
  useEffect(() => {
    setProfitInputByEstablishment(prev => {
      const next = { ...prev };
      for (const est of establishments) {
        if (next[est.id] === undefined) {
          const v = Number(est.admin_profit_value ?? 0);
          next[est.id] = Number.isFinite(v) ? String(v) : '0';
        }
      }
      return next;
    });
  }, [establishments]);

  // Pré-preencher input do link (sem sobrescrever quem estiver digitando)
  useEffect(() => {
    setPaymentLinkInputByEstablishment(prev => {
      const next = { ...prev };
      for (const est of establishments) {
        if (next[est.id] === undefined) {
          next[est.id] = String(est.admin_payment_link || '');
        }
      }
      return next;
    });
  }, [establishments]);

  const parseBRLNumberInput = (raw: string): number => {
    const s = String(raw || '').trim();
    if (!s) return NaN;

    // Mantém apenas dígitos e separadores comuns
    const cleaned = s.replace(/[^\d.,-]/g, '');

    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');

    // Descobrir qual é o separador decimal (se existir)
    let decimalSep: '.' | ',' | null = null;
    if (lastDot !== -1 && lastComma !== -1) {
      decimalSep = lastDot > lastComma ? '.' : ',';
    } else if (lastComma !== -1) {
      decimalSep = ',';
    } else if (lastDot !== -1) {
      decimalSep = '.';
    }

    let normalized = cleaned;
    if (decimalSep === ',') {
      // remover separadores de milhar "." e trocar decimal "," por "."
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (decimalSep === '.') {
      // remover separadores de milhar "," e manter "." como decimal
      normalized = normalized.replace(/,/g, '');
    } else {
      // sem separador decimal: só números (e possível sinal)
      normalized = normalized.replace(/[.,]/g, '');
    }

    return Number(normalized);
  };

  const savePaymentLink = async (establishment: Establishment) => {
    const raw = (paymentLinkInputByEstablishment[establishment.id] ?? '').trim();
    const nextLink = raw.length ? raw : null;

    setIsSavingPaymentLinkByEstablishment(prev => ({ ...prev, [establishment.id]: true }));
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ admin_payment_link: nextLink })
        .eq('id', establishment.id);

      if (error) {
        const msg = String((error as any)?.message || '');
        if (/admin_payment_link/i.test(msg) || /column/i.test(msg)) {
          toast.error('Campo admin_payment_link não existe no banco. Aplique a migration no Supabase.');
        } else {
          toast.error('Erro ao salvar link.');
        }
        console.error(error);
        return;
      }

      setEstablishments(prev =>
        prev.map(e => (e.id === establishment.id ? { ...e, admin_payment_link: nextLink } : e))
      );
      toast.success('Link salvo!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar link.');
    } finally {
      setIsSavingPaymentLinkByEstablishment(prev => ({ ...prev, [establishment.id]: false }));
    }
  };

  const savePaymentLinkById = async (establishmentId: string) => {
    const est = establishments.find(e => e.id === establishmentId);
    if (!est) return;
    await savePaymentLink(est);
  };

  const scheduleAutoSavePaymentLink = (establishmentId: string, delayMs = 600) => {
    const current = paymentLinkSaveTimeoutRef.current[establishmentId];
    if (current) clearTimeout(current);
    paymentLinkSaveTimeoutRef.current[establishmentId] = setTimeout(() => {
      savePaymentLinkById(establishmentId);
    }, delayMs);
  };

  // Limpar timeouts pendentes ao desmontar
  useEffect(() => {
    return () => {
      for (const key of Object.keys(paymentLinkSaveTimeoutRef.current)) {
        clearTimeout(paymentLinkSaveTimeoutRef.current[key]);
      }
      paymentLinkSaveTimeoutRef.current = {};
    };
  }, []);

  const sendChargeWhatsapp = async (establishment: Establishment) => {
    const phoneRaw = String(establishment.whatsapp || '').trim();
    if (!phoneRaw) {
      toast.error('Este estabelecimento não tem WhatsApp cadastrado.');
      return;
    }

    let phoneNumber = phoneRaw.replace(/\D/g, '');
    if (!phoneNumber.startsWith('55')) phoneNumber = `55${phoneNumber}`;

    const valueRaw = profitInputByEstablishment[establishment.id] ?? '';
    const valueNum = parseBRLNumberInput(valueRaw);
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      toast.error('Informe um valor válido (> 0) para enviar a cobrança.');
      return;
    }

    const link = (paymentLinkInputByEstablishment[establishment.id] ?? '').trim();
    if (!link) {
      toast.error('Informe o link de pagamento antes de enviar a cobrança.');
      return;
    }

    // Tentar salvar o link antes de enviar (melhora consistência)
    if (String(establishment.admin_payment_link || '') !== link) {
      await savePaymentLink(establishment);
    }

    const valorFormatado = fmtBRL(valueNum);
    const cnpjPix = '57436351000167';

    const message =
      `Seu Agendei Fácil venceu, não perca seu acesso.\n\n` +
      `Esse é seu link de pagamento valor (${valorFormatado}). ` +
      `Acesse o link, após pagamento avise que deixaremos em dia.\n\n` +
      `${link}\n\n` +
      `Caso link nao funcione, envie direto no nosso CNPJ como PIX (${cnpjPix}). ` +
      `Faça um PIX no valor de (${valorFormatado}).`;

    const waUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  const saveProfitValue = async (establishment: Establishment) => {
    const raw = profitInputByEstablishment[establishment.id] ?? '';
    const value = parseBRLNumberInput(raw);

    if (!Number.isFinite(value) || value < 0) {
      toast.error('Digite um valor válido (>= 0).');
      return;
    }

    setIsSavingProfitByEstablishment(prev => ({ ...prev, [establishment.id]: true }));
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ admin_profit_value: value })
        .eq('id', establishment.id);

      if (error) {
        const msg = String((error as any)?.message || '');
        if (/admin_profit_value/i.test(msg) || /column/i.test(msg)) {
          toast.error('Campo de lucro ainda não existe no banco. Aplique a migration no Supabase.');
        } else {
          toast.error('Erro ao salvar valor.');
        }
        console.error(error);
        return;
      }

      setEstablishments(prev =>
        prev.map(e => (e.id === establishment.id ? { ...e, admin_profit_value: value } : e))
      );
      toast.success('Valor salvo!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar valor.');
    } finally {
      setIsSavingProfitByEstablishment(prev => ({ ...prev, [establishment.id]: false }));
    }
  };

  const isPaidMarkedInCurrentMonth = (establishment: Establishment): boolean => {
    if (!establishment.payment_paid_at) return false;
    const t = new Date(establishment.payment_paid_at).getTime();
    if (!Number.isFinite(t)) return false;
    const now = new Date();
    const { start: monthStart } = getMonthRange(now);
    return t >= monthStart.getTime() && t <= now.getTime();
  };

  // Marca/desmarca manualmente "pagou ESSE MÊS" (sem alterar vencimento/plano/status)
  const togglePaidThisMonth = async (establishment: Establishment) => {
    const key = `paidmonth:${establishment.id}`;
    setIsPayingByEstablishment(prev => ({ ...prev, [key]: true }));

    try {
      const shouldUnmark = isPaidMarkedInCurrentMonth(establishment);
      const nextPaidAt = shouldUnmark ? null : new Date().toISOString();

      const { error } = await supabase
        .from('establishments')
        .update({ payment_paid_at: nextPaidAt })
        .eq('id', establishment.id);

      if (error) {
        const msg = String((error as any)?.message || '');
        if (/payment_paid_at/i.test(msg) || /column/i.test(msg)) {
          toast.error('Campo payment_paid_at não existe no banco. Aplique a migration no Supabase.');
        } else {
          toast.error('Erro ao atualizar marcação do mês.');
        }
        console.error(error);
        return;
      }

      setEstablishments(prev =>
        prev.map(e => (e.id === establishment.id ? { ...e, payment_paid_at: nextPaidAt } : e))
      );
      toast.success(shouldUnmark ? 'Removido do Saldo mês.' : 'Adicionado ao Saldo mês.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar marcação do mês.');
    } finally {
      setIsPayingByEstablishment(prev => ({ ...prev, [key]: false }));
    }
  };

  // "Pago" + "ESSE MÊS" juntos (sempre ativar, nunca desativar)
  const handleMarkPaidAll = async (establishment: Establishment) => {
    const key = `paidall:${establishment.id}`;
    if (isPayingByEstablishment[key]) return;

    setIsPayingByEstablishment(prev => ({ ...prev, [key]: true }));
    try {
      // 1) Marcar como pago (status + próximo vencimento)
      await updatePaymentStatus(establishment.id, 'paid');

      // 2) Marcar "ESSE MÊS" (só se ainda não estiver marcado neste mês)
      if (!isPaidMarkedInCurrentMonth(establishment)) {
        await togglePaidThisMonth(establishment);
      }

      // ✅ REMOVIDO: Ativação automática de "PAGAMENTO AD"
      // O usuário deve ativar "PAGAMENTO AD" manualmente se desejar
    } catch (err) {
      console.error(err);
      toast.error('Erro ao marcar Pago + Esse mês.');
    } finally {
      setIsPayingByEstablishment(prev => ({ ...prev, [key]: false }));
    }
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

  const filteredEstablishments = establishments
    .filter(establishment => {
      const rawTokens = String(searchTerm || '')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);

      const profitCents = valorCents((establishment as any)?.admin_profit_value);
      const isPrataAtivo = Boolean(establishment.plan_prata_active);
      const centsPrata = 2790; // R$ 27,90
      const centsOuro = 4790; // R$ 47,90
      const centsDiamante = 7790; // R$ 77,90

      const planLabel =
        profitCents === centsDiamante
          ? 'diamante'
          : profitCents === centsOuro
            ? 'ouro'
            : profitCents === centsPrata || isPrataAtivo
              ? 'prata'
              : '';

      const statusLabel = establishment.is_blocked
        ? 'bloqueado'
        : establishment.payment_status === 'paid'
          ? 'pago'
          : establishment.payment_status === 'expired' || isExpired(establishment.payment_due_date)
            ? 'vencido'
            : 'pendente';

      const haystack = [
        establishment.name,
        establishment.code,
        establishment.owner_email || '',
        String((establishment as any)?.whatsapp || ''),
        establishment.plan_type || '',
        statusLabel,
        planLabel,
        // permitir buscar pelo valor manual (admin) digitando "27,90" etc.
        profitCents != null ? String(profitCents) : '',
      ].map(normalizarTexto);

      const matchesSearch =
        rawTokens.length === 0 ||
        rawTokens.every(tok => {
          const cents = parseValorCents(tok);
          if (cents != null) {
            // match por valor do plano (via admin_profit_value) ou por PRATA ativo
            if (profitCents != null && profitCents === cents) return true;
            if (isPrataAtivo && cents === centsPrata) return true;
            return false;
          }
          const t = normalizarTexto(tok);
          if (!t) return true;
          return haystack.some(h => h.includes(t));
        });

      const matchesStatus = filterStatus === 'all' || establishment.payment_status === filterStatus;
      const matchesPlan = filterPlan === 'all' || establishment.plan_type === filterPlan;

      return matchesSearch && matchesStatus && matchesPlan;
    })
    .sort((a, b) => {
      // 1) Estabelecimentos vencidos sempre no topo
      const aIsExpired = a.payment_status === 'expired' || isExpired(a.payment_due_date);
      const bIsExpired = b.payment_status === 'expired' || isExpired(b.payment_due_date);

      if (aIsExpired && !bIsExpired) return -1;
      if (!aIsExpired && bIsExpired) return 1;

      // 2) Ordenar por vencimento (mais próximo primeiro)
      const aDue = new Date(a.payment_due_date).getTime();
      const bDue = new Date(b.payment_due_date).getTime();
      const aValid = Number.isFinite(aDue);
      const bValid = Number.isFinite(bDue);

      if (aValid && bValid && aDue !== bDue) return aDue - bDue;
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;

      // 3) Desempate: nome (determinístico)
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    });

  // Filtrar estabelecimentos da lixeira
  const filteredDeletedEstablishments = deletedEstablishments.filter(establishment => {
    const rawTokens = String(searchTermDeleted || '')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);

    const profitCents = valorCents((establishment as any)?.admin_profit_value);
    const isPrataAtivo = Boolean(establishment.plan_prata_active);
    const centsPrata = 2790;
    const centsOuro = 4790;
    const centsDiamante = 7790;

    const planLabel =
      profitCents === centsDiamante
        ? 'diamante'
        : profitCents === centsOuro
          ? 'ouro'
          : profitCents === centsPrata || isPrataAtivo
            ? 'prata'
            : '';

    const haystack = [
      establishment.name,
      establishment.code,
      establishment.owner_email || '',
      String((establishment as any)?.whatsapp || ''),
      planLabel,
      profitCents != null ? String(profitCents) : '',
    ].map(normalizarTexto);

    return (
      rawTokens.length === 0 ||
      rawTokens.every(tok => {
        const cents = parseValorCents(tok);
        if (cents != null) {
          if (profitCents != null && profitCents === cents) return true;
          if (isPrataAtivo && cents === centsPrata) return true;
          return false;
        }
        const t = normalizarTexto(tok);
        if (!t) return true;
        return haystack.some(h => h.includes(t));
      })
    );
  });

  // Saldo (lucro) manual total — não inclui lixeira pois establishments já vem filtrado
  const totalAdminProfit = establishments.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  // Saldo do mês: soma do lucro manual apenas de quem PAGOU neste mês (do dia 1 até AGORA)
  const now = new Date();
  const { start: monthStart } = getMonthRange(now);
  const paidThisMonth = establishments.filter(est => {
    if (!est.payment_paid_at) return false;
    const t = new Date(est.payment_paid_at).getTime();
    if (!Number.isFinite(t)) return false;
    return t >= monthStart.getTime() && t <= now.getTime();
  });
  const saldoMesProfit = paidThisMonth.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

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
        <div className="grid grid-cols-1 md:grid-cols-9 gap-6 mb-8">
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
              <DollarSign className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Saldo (lucro)</p>
                <p className="text-2xl font-bold text-gray-900">{fmtBRL(totalAdminProfit)}</p>
                <p className="text-xs text-gray-500 mt-1">Soma dos valores manuais (não inclui lixeira)</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-700" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-900">Saldo mês</p>
                <p className="text-2xl font-bold text-green-900">{fmtBRL(saldoMesProfit)}</p>
                <p className="text-xs text-green-800/80 mt-1">
                  {paidThisMonth.length} pago(s) de{' '}
                  {monthStart.toLocaleDateString('pt-BR')} até {now.toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-indigo-600" />
              <div className="ml-4 w-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-600">Clientes do mês</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setClientsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 rounded hover:bg-gray-100 text-gray-600"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientsMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      disabled={isSameMonthYear(clientsMonth, new Date())}
                      className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 capitalize">
                  {clientsMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {isLoadingClientsMonth ? '...' : clientsMonthCount}
                </p>
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

        {/* (removido) Custo por estabelecimento (storage + banco) */}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, código, e-mail, WhatsApp, status (pago/vencido), plano (prata/ouro/diamante) ou valor (ex: 27,90)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 bg-white"
                />
              </div>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 bg-white"
            >
              <option value="all">Todos Status</option>
              <option value="paid">Pagos</option>
              <option value="unpaid">Pendentes</option>
              <option value="expired">Vencidos</option>
            </select>

            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 bg-white"
            >
              <option value="all">Todos Planos</option>
              <option value="monthly">Mensal</option>
              <option value="annual">Anual</option>
              <option value="trial">7 dias</option>
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
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Estabelecimentos</h2>

              {/* Botões Ouro e Diamante (responsivo) */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Botão Ouro */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
                  <span className="inline-flex items-center px-2 py-1 text-[11px] font-extrabold rounded bg-yellow-400 text-black border border-yellow-500 whitespace-nowrap">
                    OURO
                  </span>
                  <input
                    type="url"
                    value={ouroLink}
                    onChange={(e) => setOuroLink(e.target.value)}
                    onBlur={saveOuroLink}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                    placeholder={isLoadingOuroLink ? 'Carregando...' : 'Cole o link do Plano Ouro aqui'}
                    disabled={isLoadingOuroLink}
                  />
                  <button
                    type="button"
                    onClick={sendOuroWhatsapp}
                    disabled={isLoadingOuroLink || isSavingOuroLink || !ouroLink.trim()}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold border border-gray-900 bg-gray-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Abrir WhatsApp e escolher contato (Plano Ouro)"
                  >
                    Link
                  </button>
                </div>

                {/* Botão Prata */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
                  <span className="inline-flex items-center px-2 py-1 text-[11px] font-extrabold rounded bg-gray-300 text-black border border-gray-400 whitespace-nowrap">
                    PRATA
                  </span>
                  <input
                    type="url"
                    value={prataLink}
                    onChange={(e) => setPrataLink(e.target.value)}
                    onBlur={savePrataLink}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                    placeholder={isLoadingPrataLink ? 'Carregando...' : 'Cole o link do Plano Prata aqui'}
                    disabled={isLoadingPrataLink}
                  />
                  <button
                    type="button"
                    onClick={sendPrataWhatsapp}
                    disabled={isLoadingPrataLink || isSavingPrataLink || !prataLink.trim()}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold border border-gray-900 bg-gray-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Abrir WhatsApp e escolher contato (Plano Prata)"
                  >
                    Link
                  </button>
                </div>

                {/* Botão Diamante */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1">
                  <span className="inline-flex items-center px-2 py-1 text-[11px] font-extrabold rounded bg-purple-400 text-black border border-purple-500 whitespace-nowrap">
                    DIAMANTE
                  </span>
                  <input
                    type="url"
                    value={diamanteLink}
                    onChange={(e) => setDiamanteLink(e.target.value)}
                    onBlur={saveDiamanteLink}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                    placeholder={isLoadingDiamanteLink ? 'Carregando...' : 'Cole o link do Plano Diamante aqui'}
                    disabled={isLoadingDiamanteLink}
                  />
                  <button
                    type="button"
                    onClick={sendDiamanteWhatsapp}
                    disabled={isLoadingDiamanteLink || isSavingDiamanteLink || !diamanteLink.trim()}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold border border-gray-900 bg-gray-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Abrir WhatsApp e escolher contato (Plano Diamante)"
                  >
                    Link
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Os botões <strong>Link</strong> abrem o WhatsApp para você escolher o contato e já enviam a mensagem pronta.
              </p>
            </div>
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
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
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
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      🕐 Último Acesso
                    </th>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                      Saldo (PIX)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-300">
                  {filteredEstablishments.map((establishment, idx) => {
                    const isRowExpired = isExpired(establishment.payment_due_date) || establishment.payment_status === 'expired';
                    const rowAccent = establishment.is_blocked
                      ? 'border-l-rose-700'
                      : isRowExpired
                        ? 'border-l-red-600'
                        : establishment.payment_status === 'paid'
                          ? 'border-l-emerald-600'
                          : 'border-l-amber-500';

                    // Cor de fundo por status (bem mais visível)
                    const bg = establishment.is_blocked
                      ? 'bg-rose-300'
                      : isRowExpired
                        ? 'bg-red-300'
                        : establishment.payment_status === 'paid'
                          ? 'bg-emerald-300'
                          : 'bg-amber-300';

                    return (
                      <tr
                        key={establishment.id}
                        className={`${bg} ${rowAccent} border-l-8 border-b border-gray-200 hover:bg-blue-50/40 transition-colors`}
                      >
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-medium text-gray-900 truncate">{establishment.name}</div>
                            <button
                              onClick={() => handleOpenEstablishmentInfo(establishment)}
                              className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                              title="Ver informações do estabelecimento"
                            >
                              Informações
                            </button>

                            {/* Contador de Agendamentos */}
                            <div
                              className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg border border-gray-300 text-xs cursor-pointer hover:bg-gray-200 transition-colors"
                              onMouseEnter={() => {
                                // Carregar automaticamente quando passar o mouse (só se ainda não tiver carregado)
                                if (!appointmentCounts[establishment.id]) {
                                  loadAppointmentCounts(establishment);
                                }
                              }}
                              title="Contagem de agendamentos (dia e mês)"
                            >
                              {/* Dia */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigateDayBack(establishment);
                                  }}
                                  className="p-0.5 hover:bg-gray-300 rounded transition-colors"
                                  title="Dia anterior"
                                >
                                  <ChevronLeft className="h-3 w-3 text-gray-600" />
                                </button>
                                <span className="text-gray-700 font-medium">
                                  📅 {isLoadingAppointmentCounts[establishment.id] ? '...' : (appointmentCounts[establishment.id]?.day ?? '-')}
                                </span>
                                <span className="text-gray-500 text-[10px]">
                                  {format(getSelectedDateForEstablishment(establishment.id), 'dd/MM', { locale: ptBR })}
                                </span>
                              </div>

                              <span className="text-gray-400">|</span>

                              {/* Mês */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigateMonthBack(establishment);
                                  }}
                                  className="p-0.5 hover:bg-gray-300 rounded transition-colors"
                                  title="Mês anterior"
                                >
                                  <ChevronLeft className="h-3 w-3 text-gray-600" />
                                </button>
                                <span className="text-gray-700 font-medium">
                                  📆 {isLoadingAppointmentCounts[establishment.id] ? '...' : (appointmentCounts[establishment.id]?.month ?? '-')}
                                </span>
                                <span className="text-gray-500 text-[10px]">
                                  {format(getSelectedMonthForEstablishment(establishment.id), 'MMM/yyyy', { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(establishment.created_at).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={profitInputByEstablishment[establishment.id] ?? ''}
                              onChange={(e) =>
                                setProfitInputByEstablishment(prev => ({ ...prev, [establishment.id]: e.target.value }))
                              }
                              className="w-28 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
                              placeholder="0,00"
                              title="Valor manual de lucro (admin)"
                            />
                            <button
                              type="button"
                              onClick={() => saveProfitValue(establishment)}
                              disabled={Boolean(isSavingProfitByEstablishment[establishment.id])}
                              className="px-2 py-1 text-xs rounded border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Salvar valor"
                            >
                              {isSavingProfitByEstablishment[establishment.id] ? 'Salvando...' : 'Salvar'}
                            </button>
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 text-[11px] font-bold rounded bg-red-600 text-white">
                              LINK
                            </span>
                            <input
                              type="url"
                              value={paymentLinkInputByEstablishment[establishment.id] ?? ''}
                              onChange={(e) =>
                                setPaymentLinkInputByEstablishment(prev => ({ ...prev, [establishment.id]: e.target.value }))
                              }
                              onPaste={() => {
                                // salvar logo após colar (após o state atualizar)
                                setTimeout(() => savePaymentLinkById(establishment.id), 0);
                              }}
                              onInput={() => scheduleAutoSavePaymentLink(establishment.id)}
                              onBlur={() => savePaymentLinkById(establishment.id)}
                              className="w-64 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
                              placeholder="Cole o link aqui"
                              title="Link de pagamento (admin)"
                            />
                            <button
                              type="button"
                              onClick={() => savePaymentLink(establishment)}
                              disabled={Boolean(isSavingPaymentLinkByEstablishment[establishment.id])}
                              className="px-2 py-1 text-xs rounded border border-red-600 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Salvar link"
                            >
                              {isSavingPaymentLinkByEstablishment[establishment.id] ? 'Salvando...' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => sendChargeWhatsapp(establishment)}
                              className="px-3 py-1 text-xs rounded border border-gray-900 bg-gray-900 text-white hover:bg-black"
                              title="Enviar cobrança no WhatsApp"
                            >
                              Enviar cobrança
                            </button>
                          </div>
                        </td>

                        <td className="px-2 py-4">
                          <button
                            onClick={() => {
                              const bookingUrl = `https://agendeifacil.com/booking/${establishment.code}`;
                              window.open(bookingUrl, '_blank');
                            }}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900 transition-colors cursor-pointer"
                            title={`Abrir booking: agendeifacil.com/booking/${establishment.code}`}
                          >
                            {establishment.code}
                          </button>
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
                            onChange={(e) => updatePlanType(establishment.id, e.target.value as 'monthly' | 'annual' | 'trial')}
                            className="text-xs border border-gray-300 rounded px-1 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 w-full"
                          >
                            <option value="monthly">Mensal</option>
                            <option value="annual">Anual</option>
                            <option value="trial">7 dias</option>
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

                        <td className="px-2 py-4">
                          <div className="text-xs">
                            <span className={`font-medium ${establishment.last_access ? 'text-green-600' : 'text-gray-400'
                              }`}>
                              {formatLastAccess(establishment.last_access)}
                            </span>
                          </div>
                        </td>

                        <td className="px-2 py-4">
                          <div className="text-xs font-semibold text-gray-900">
                            {isLoadingSaldos ? '...' : fmtBRL(Number(saldosPorEstabelecimento[establishment.id] || 0))}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {qtdPixPagoPorEstabelecimento[establishment.id]
                              ? `${qtdPixPagoPorEstabelecimento[establishment.id]} PIX pago(s)`
                              : '—'}
                          </div>
                        </td>

                        <td className="px-3 py-4 text-sm font-medium">
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => togglePaymentAlert(establishment.id, establishment.payment_alert_enabled || false)}
                              className={`text-xs px-2 py-0.5 border rounded font-medium ${establishment.payment_alert_enabled
                                ? 'text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100'
                                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              title={establishment.payment_alert_enabled ? 'Desativar Alerta' : 'Ativar Alerta'}
                            >
                              ALERTA
                            </button>
                            <button
                              onClick={() => toggleBookingBlock(establishment.id, establishment.booking_blocked || false)}
                              className={`text-xs px-2 py-0.5 border rounded font-medium ${establishment.booking_blocked
                                ? 'text-red-600 border-red-300 bg-red-50 hover:bg-red-100'
                                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              title={establishment.booking_blocked ? 'Desbloquear PG' : 'Bloquear PG'}
                            >
                              Bloquear PG
                            </button>
                            <button
                              onClick={() => togglePromotion(establishment.id, establishment.promotion_enabled || false)}
                              className={`text-xs px-2 py-0.5 border rounded font-medium ${establishment.promotion_enabled
                                ? 'text-purple-600 border-purple-300 bg-purple-50 hover:bg-purple-100'
                                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              title={establishment.promotion_enabled ? 'Desativar Propaganda' : 'Ativar Propaganda'}
                            >
                              PROPAGANDA
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePlanPrata(establishment)}
                              className={`text-xs px-2 py-0.5 border rounded font-extrabold ${establishment.plan_prata_active
                                ? 'text-white border-gray-900 bg-gray-900 hover:bg-black'
                                : 'text-gray-700 border-gray-300 bg-gray-50 hover:bg-gray-100'
                                }`}
                              title={establishment.plan_prata_active ? 'PRATA ATIVO (clique para desativar)' : 'Ativar PRATA (bloqueia assinantes e produtos)'}
                            >
                              PRATA
                            </button>
                            <button
                              onClick={() => handleMarkPaidAll(establishment)}
                              disabled={Boolean(isPayingByEstablishment[`paidall:${establishment.id}`])}
                              className="text-green-600 hover:text-green-900 text-xs px-1 py-0.5 border border-green-300 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title='Marcar "Pago" + "Esse mês" + "Pagamento AD"'
                            >
                              Pago
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePaidThisMonth(establishment)}
                              disabled={Boolean(isPayingByEstablishment[`paidmonth:${establishment.id}`])}
                              className={`text-xs px-2 py-0.5 border rounded disabled:opacity-50 disabled:cursor-not-allowed ${isPaidMarkedInCurrentMonth(establishment)
                                ? 'text-white border-blue-600 bg-blue-600 hover:bg-blue-700'
                                : 'text-blue-700 border-blue-300 hover:bg-blue-50 hover:text-blue-900'
                                }`}
                              title="Alternar marcação do mês (apenas para o card Saldo mês)"
                            >
                              ESSE MÊS
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
                              onClick={() => openNotesModal(establishment)}
                              className={`text-xs px-2 py-0.5 border rounded flex items-center gap-1 ${establishment.admin_notes
                                ? 'text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100'
                                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              title={establishment.admin_notes ? 'Ver/Editar Observação' : 'Adicionar Observação'}
                            >
                              <FileText className="h-3 w-3" />
                              {establishment.admin_notes && <span className="text-[10px]">Obs</span>}
                            </button>
                            <button
                              onClick={() => toggleBlockEstablishment(establishment.id, establishment.is_blocked || false)}
                              className={`text-xs px-1 py-0.5 border rounded flex items-center ${establishment.is_blocked
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
                            {establishment.whatsapp && (
                              <button
                                onClick={() => {
                                  let phoneNumber = establishment.whatsapp.replace(/\D/g, '');
                                  // Adicionar código do país se não tiver
                                  if (!phoneNumber.startsWith('55')) {
                                    phoneNumber = '55' + phoneNumber;
                                  }
                                  window.open(`https://wa.me/${phoneNumber}`, '_blank');
                                }}
                                className="text-green-600 hover:text-green-900 text-xs px-2 py-0.5 border border-green-300 rounded hover:bg-green-50 font-medium"
                                title="Abrir WhatsApp"
                              >
                                WHATSAPP
                              </button>
                            )}
                            <button
                              onClick={() =>
                                togglePagamentoAdiantadoAdmin(
                                  establishment.id,
                                  Boolean(establishment.pagamento_adiantado_liberado_admin)
                                )
                              }
                              className={`text-xs px-2 py-0.5 border rounded font-medium ${establishment.pagamento_adiantado_liberado_admin
                                ? 'text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
                                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              title={
                                establishment.pagamento_adiantado_liberado_admin
                                  ? 'Bloquear Pagamento Adiantado (e desativar no booking)'
                                  : 'Liberar Pagamento Adiantado para este estabelecimento'
                              }
                            >
                              PAGAMENTO AD
                            </button>
                            <button
                              onClick={() => registrarPagamentoSaldoTotal(establishment)}
                              disabled={Boolean(isPayingByEstablishment[establishment.id]) || Number(saldosPorEstabelecimento[establishment.id] || 0) <= 0}
                              className={`text-xs px-2 py-0.5 border rounded font-medium ${Number(saldosPorEstabelecimento[establishment.id] || 0) > 0
                                ? 'text-green-700 border-green-300 bg-green-50 hover:bg-green-100'
                                : 'text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed'
                                }`}
                              title="Registrar pagamento do saldo total (zera o saldo)"
                            >
                              PAGAR
                            </button>
                            <button
                              onClick={() => abrirHistoricoPagamentos(establishment)}
                              className="text-xs px-2 py-0.5 border rounded font-medium text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100"
                              title="Ver histórico de pagamentos (admin)"
                            >
                              HISTÓRICO
                            </button>
                            {isSupportAccount && (
                              <button
                                onClick={() => openWhatsappRemindersModal(establishment)}
                                className="text-xs px-2 py-0.5 border rounded font-medium text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                                title="Configurar lembretes automáticos por WhatsApp (WaSender)"
                              >
                                📣 Lembretes WhatsApp
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Modal - Histórico de Pagamentos */}
              {showPayoutHistoryModal && payoutHistoryEstablishment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Histórico de Pagamentos</div>
                        <div className="text-xs text-gray-600">
                          {payoutHistoryEstablishment.name} • Código {payoutHistoryEstablishment.code}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowPayoutHistoryModal(false);
                          setPayoutHistoryEstablishment(null);
                          setPayoutHistoryRows([]);
                        }}
                        className="p-2 rounded hover:bg-gray-100"
                        title="Fechar"
                      >
                        <X className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded border bg-gray-50">
                          <div className="text-[11px] text-gray-600">Vendas líquidas (PIX)</div>
                          <div className="text-sm font-extrabold text-gray-900">
                            {fmtBRL(Number(totalVendasLiquidasPorEstabelecimento[payoutHistoryEstablishment.id] || 0))}
                          </div>
                        </div>
                        <div className="p-3 rounded border bg-gray-50">
                          <div className="text-[11px] text-gray-600">Pago (admin)</div>
                          <div className="text-sm font-extrabold text-gray-900">
                            {fmtBRL(Number(totalPagoAdminPorEstabelecimento[payoutHistoryEstablishment.id] || 0))}
                          </div>
                        </div>
                        <div className="p-3 rounded border bg-gray-50">
                          <div className="text-[11px] text-gray-600">Saldo atual</div>
                          <div className="text-sm font-extrabold text-green-700">
                            {fmtBRL(Number(saldosPorEstabelecimento[payoutHistoryEstablishment.id] || 0))}
                          </div>
                        </div>
                      </div>

                      {isLoadingPayoutHistory ? (
                        <div className="py-8 text-center text-sm text-gray-600">Carregando histórico...</div>
                      ) : payoutHistoryRows.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-600">Nenhum pagamento registrado ainda.</div>
                      ) : (
                        <div className="overflow-auto border rounded">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Obs</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {payoutHistoryRows.map((row: any) => (
                                <tr key={row.id}>
                                  <td className="px-3 py-2 text-xs text-gray-700">
                                    {row.created_at ? new Date(row.created_at).toLocaleString('pt-BR') : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-xs font-bold text-gray-900">{fmtBRL(Number(row.amount || 0))}</td>
                                  <td className="px-3 py-2 text-xs text-gray-700">{row.note || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
                      Lixeira ({filteredDeletedEstablishments.length}/{deletedEstablishments.length})
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
                      {/* Campo de busca na lixeira */}
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar na lixeira..."
                            value={searchTermDeleted}
                            onChange={(e) => setSearchTermDeleted(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 bg-white"
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        {filteredDeletedEstablishments.map(establishment => (
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

              {/* Modal - 📣 Lembretes WhatsApp */}
              {showWhatsappRemindersModal && whatsappRemindersEstablishment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div>
                        <div className="text-sm font-bold text-gray-900">📣 Lembretes WhatsApp</div>
                        <div className="text-xs text-gray-600">
                          {whatsappRemindersEstablishment.name} • Código {whatsappRemindersEstablishment.code}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowWhatsappRemindersModal(false);
                          setWhatsappRemindersEstablishment(null);
                        }}
                        className="p-2 rounded hover:bg-gray-100"
                        title="Fechar"
                      >
                        <X className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>

                    <div className="p-4">
                      <AdminEstablishmentWhatsappReminders establishmentId={whatsappRemindersEstablishment.id} />
                    </div>
                  </div>
                </div>
              )}

              {/* (Removido) Modal de upgrade no Admin — PRATA agora é apenas toggle */}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Informações do Estabelecimento */}
      {showEstablishmentInfoModal && selectedEstablishmentForInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Informações - {selectedEstablishmentForInfo.name}
              </h3>
              <button
                onClick={() => {
                  setShowEstablishmentInfoModal(false);
                  setSelectedEstablishmentForInfo(null);
                  setEstablishmentInfo(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {isLoadingEstablishmentInfo ? (
              <div className="p-8 text-center">
                <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Carregando informações...</p>
              </div>
            ) : establishmentInfo ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 break-all">
                    {establishmentInfo.email}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha (Texto Claro)
                  </label>
                  <div className="px-3 py-2 bg-red-50 border-2 border-red-300 rounded-lg text-red-900 font-mono font-bold text-center">
                    {establishmentInfo.password}
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ Senha em texto claro - visível apenas para admin
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    WhatsApp
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900">
                    {establishmentInfo.whatsapp}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">Não foi possível carregar as informações.</p>
            )}

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEstablishmentInfoModal(false);
                  setSelectedEstablishmentForInfo(null);
                  setEstablishmentInfo(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Fechar
              </button>
              {establishmentInfo && establishmentInfo.email && establishmentInfo.password && establishmentInfo.password !== 'Não encontrado' && (
                <button
                  onClick={handleLoginAsEstablishment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Logar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
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
                        className={`flex-1 px-3 py-2 border rounded-lg bg-white text-gray-900 text-sm font-mono ${userInfo.password_found ? 'border-green-300 text-green-800' : 'border-yellow-300 text-yellow-800'
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

      {/* Modal de Observações */}
      {showNotesModal && editingEstablishment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Observações - {editingEstablishment.name}</h2>
                <p className="text-sm text-gray-500 mt-1">Código: {editingEstablishment.code}</p>
              </div>
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setEditingEstablishment(null);
                  setNotesText('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações Privadas
                  </label>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Digite suas observações sobre este estabelecimento (valores pagos, informações importantes, etc)..."
                    className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm text-gray-900 bg-white placeholder-gray-400"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Estas observações são privadas e visíveis apenas para você no painel admin.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setEditingEstablishment(null);
                  setNotesText('');
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveNotes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Salvar Observação
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