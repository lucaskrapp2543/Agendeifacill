import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronDown,
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
  Trophy,
  Unlock,
  Users,
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
  mercadopago_billing_amount?: number | null; // Valor da cobranca PIX por estabelecimento
  whatsapp?: string; // WhatsApp do estabelecimento
  pagamento_adiantado_liberado_admin?: boolean; // Liberação pelo admin para mostrar "Pagamento adiantado" ao barbeiro
}

/** Mesma regra da coluna STATUS: "Pago" com vencimento futuro pode ocorrer mesmo com payment_status !== 'paid'. */
function getAdminGridDisplayPaymentState(
  establishment: Pick<Establishment, 'payment_status' | 'payment_due_date'>
): 'expired' | 'due_today' | 'paid' | 'pending' {
  const parseDateOnlySafe = (value?: string | null): number => {
    const raw = String(value || '').trim();
    if (!raw) return NaN;
    const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (onlyDate) {
      const y = Number(onlyDate[1]);
      const m = Number(onlyDate[2]) - 1;
      const d = Number(onlyDate[3]);
      return new Date(y, m, d, 12, 0, 0, 0).getTime();
    }
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : NaN;
  };
  const isExpiredDue = (dueDate: string) => {
    const dueAt = parseDateOnlySafe(dueDate);
    if (!Number.isFinite(dueAt)) return false;
    const dueEndOfDay = endOfDay(new Date(dueAt)).getTime();
    return dueEndOfDay < Date.now();
  };
  const isDueTodayDue = (dueDate: string) => {
    const dueAt = parseDateOnlySafe(dueDate);
    if (!Number.isFinite(dueAt)) return false;
    const dueDateLocal = new Date(dueAt);
    const now = new Date();
    return (
      dueDateLocal.getFullYear() === now.getFullYear() &&
      dueDateLocal.getMonth() === now.getMonth() &&
      dueDateLocal.getDate() === now.getDate()
    );
  };
  if (establishment.payment_status === 'expired' || isExpiredDue(establishment.payment_due_date)) {
    return 'expired';
  }
  if (isDueTodayDue(establishment.payment_due_date)) {
    return 'due_today';
  }
  const dueAt = parseDateOnlySafe(establishment.payment_due_date);
  if (Number.isFinite(dueAt)) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    if (dueAt >= todayStart) {
      return 'paid';
    }
  }
  if (establishment.payment_status === 'paid') {
    return 'paid';
  }
  return 'pending';
}

const isAdminGridPaymentEmDia = (establishment: Pick<Establishment, 'payment_status' | 'payment_due_date'>) =>
  getAdminGridDisplayPaymentState(establishment) === 'paid';

interface AdminTopRankingRow {
  establishmentId: string;
  establishmentName: string;
  establishmentCode: string;
  completedAppointments: number;
  hiddenFromPublicTop5: boolean;
}

interface MetaErrorSummaryRow {
  establishmentId: string;
  establishmentName: string;
  establishmentCode: string;
  totalErrors: number;
  lastErrorAt: string | null;
  lastCause: string;
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
  const [qtdCreditoPagoPorEstabelecimento, setQtdCreditoPagoPorEstabelecimento] = useState<Record<string, number>>({});
  const [lucroPixPorEstabelecimento, setLucroPixPorEstabelecimento] = useState<Record<string, number>>({});
  const [lucroCreditoPorEstabelecimento, setLucroCreditoPorEstabelecimento] = useState<Record<string, number>>({});
  const [isPayingByEstablishment, setIsPayingByEstablishment] = useState<Record<string, boolean>>({});
  const [showPayoutHistoryModal, setShowPayoutHistoryModal] = useState(false);
  const [showLastPaymentsModal, setShowLastPaymentsModal] = useState(false);
  const [automaticPaymentInfoByEstablishment, setAutomaticPaymentInfoByEstablishment] = useState<
    Record<string, { timestamp: number; paymentProvider: string }>
  >({});
  const [isLoadingLastPaymentsSources, setIsLoadingLastPaymentsSources] = useState(false);
  const [lastPaymentsSourcesWarning, setLastPaymentsSourcesWarning] = useState('');
  const [showClientesPagosHistoryModal, setShowClientesPagosHistoryModal] = useState(false);
  const [showClientesNovosHistoryModal, setShowClientesNovosHistoryModal] = useState(false);
  const [showTop5DetailsModal, setShowTop5DetailsModal] = useState(false);
  const [showMetaErrorsModal, setShowMetaErrorsModal] = useState(false);
  const [isLoadingMetaErrors, setIsLoadingMetaErrors] = useState(false);
  const [metaErrorRows, setMetaErrorRows] = useState<MetaErrorSummaryRow[]>([]);
  const [isLoadingTop5Details, setIsLoadingTop5Details] = useState(false);
  const [top5DetailsMonth, setTop5DetailsMonth] = useState<Date>(new Date());
  const [top5DetailsRows, setTop5DetailsRows] = useState<AdminTopRankingRow[]>([]);
  const [isAdjustingRenewalByEstablishment, setIsAdjustingRenewalByEstablishment] = useState<Record<string, boolean>>({});
  const [payoutHistoryEstablishment, setPayoutHistoryEstablishment] = useState<Establishment | null>(null);
  const [payoutHistoryRows, setPayoutHistoryRows] = useState<any[]>([]);
  const [isLoadingPayoutHistory, setIsLoadingPayoutHistory] = useState(false);
  const [showWhatsappRemindersModal, setShowWhatsappRemindersModal] = useState(false);
  const [whatsappRemindersEstablishment, setWhatsappRemindersEstablishment] = useState<Establishment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchTermDeleted, setSearchTermDeleted] = useState(''); // Busca na lixeira
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'unpaid' | 'expired'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'prata' | 'ouro' | 'diamante' | 'outros'>('all');
  const [filterActivity, setFilterActivity] = useState<'all' | 'active' | 'inactive'>('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedContainmentIds, setDeletedContainmentIds] = useState<string[]>([]);
  const [showNewRegistrations, setShowNewRegistrations] = useState(false);
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [showEstablishmentInfoModal, setShowEstablishmentInfoModal] = useState(false);
  const [selectedEstablishmentForInfo, setSelectedEstablishmentForInfo] = useState<Establishment | null>(null);
  const [establishmentInfo, setEstablishmentInfo] = useState<{ email?: string; password?: string; whatsapp?: string } | null>(null);
  const [isLoadingEstablishmentInfo, setIsLoadingEstablishmentInfo] = useState(false);
  const [resetOwnerPasswordValue, setResetOwnerPasswordValue] = useState('');
  const [isResettingOwnerPassword, setIsResettingOwnerPassword] = useState(false);

  // Estados para contagem de agendamentos
  const [selectedDateForAppointments, setSelectedDateForAppointments] = useState<Record<string, Date>>({});
  const [selectedMonthForAppointments, setSelectedMonthForAppointments] = useState<Record<string, Date>>({});
  const [appointmentCounts, setAppointmentCounts] = useState<Record<string, { day: number; month: number }>>({});
  const [appointmentCountsFetchedAt, setAppointmentCountsFetchedAt] = useState<Record<string, number>>({});
  const [isLoadingAppointmentCounts, setIsLoadingAppointmentCounts] = useState<Record<string, boolean>>({});

  // Suporte por nome: Lucas, Erlon, Kinkas, usuario 1, usuario 2 (Lucas e Erlon = acesso total; outros = só visualização)
  const SUPPORT_NAMES = ['Lucas', 'Erlon', 'Kinkas', 'usuario 1', 'usuario 2'] as const;
  const SUPPORT_FULL_ACCESS_NAMES = ['Lucas', 'Erlon'];
  const SUPPORT_SESSION_NAME_KEY = 'admin_support_session_name';
  const SUPPORT_REMEMBER_KEY = 'admin_support_remember_v1';
  const SUPPORT_REMEMBER_TTL_MS = 1000 * 60 * 60 * 12; // 12h
  const [supportSessions, setSupportSessions] = useState<Array<{ id: string; name: string; email: string; created_at: string; last_heartbeat_at: string }>>([]);
  const [showSupportSessionsDropdown, setShowSupportSessionsDropdown] = useState(false);
  const [showSupportNamePicker, setShowSupportNamePicker] = useState(false);
  const [supportNameForPin, setSupportNameForPin] = useState<string | null>(null);
  const [supportPinInput, setSupportPinInput] = useState('');
  const [isSubmittingSupportPin, setIsSubmittingSupportPin] = useState(false);
  const supportSessionErrorShownRef = useRef(false);
  const supportSessionAvailableRef = useRef(true);

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
      setAppointmentCountsFetchedAt((prev) => ({
        ...prev,
        [key]: Date.now(),
      }));
    } catch (error) {
      console.error('Erro ao buscar contagem de agendamentos:', error);
    } finally {
      setIsLoadingAppointmentCounts(prev => ({ ...prev, [key]: false }));
    }
  };

  const loadTop5Details = async (targetMonth: Date) => {
    try {
      setIsLoadingTop5Details(true);
      const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd');
      const pageSize = 1000;
      let from = 0;
      let keepFetching = true;
      const completedByEstablishment = new Map<string, number>();

      while (keepFetching) {
        const { data, error } = await supabase
          .from('appointments')
          .select('establishment_id')
          .eq('status', 'completed')
          .gte('appointment_date', monthStart)
          .lte('appointment_date', monthEnd)
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const rows = data || [];
        rows.forEach((row: any) => {
          const establishmentId = String(row?.establishment_id || '');
          if (!establishmentId) return;
          completedByEstablishment.set(establishmentId, (completedByEstablishment.get(establishmentId) || 0) + 1);
        });

        if (rows.length < pageSize) {
          keepFetching = false;
        } else {
          from += pageSize;
        }
      }

      const rows: AdminTopRankingRow[] = Array.from(completedByEstablishment.entries())
        .map(([establishmentId, completedAppointments]) => {
          const establishment = establishments.find((item) => String(item.id) === String(establishmentId));
          return {
            establishmentId,
            establishmentName: establishment?.name || 'Estabelecimento removido/indisponível',
            establishmentCode: establishment?.code || '—',
            completedAppointments,
            hiddenFromPublicTop5: Boolean((establishment as any)?.hide_from_top10_ranking)
          };
        })
        .sort((a, b) => {
          if (b.completedAppointments !== a.completedAppointments) {
            return b.completedAppointments - a.completedAppointments;
          }
          return a.establishmentName.localeCompare(b.establishmentName, 'pt-BR');
        })
        .slice(0, 20);

      setTop5DetailsRows(rows);
    } catch (error: any) {
      console.error('Erro ao carregar detalhamento do Top5 no admin:', error);
      toast.error(error?.message || 'Erro ao carregar ranking detalhado');
      setTop5DetailsRows([]);
    } finally {
      setIsLoadingTop5Details(false);
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
    const key = String(establishment.id || '').trim();
    if (!key) return;
    if (isLoadingAppointmentCounts[key]) return;

    // Evita contador travado: permite refresh automático após curto período.
    const fetchedAt = Number(appointmentCountsFetchedAt[key] || 0);
    const cacheIsFresh = Number.isFinite(fetchedAt) && Date.now() - fetchedAt < 20000;
    if (cacheIsFresh && appointmentCounts[key]) return;

    const date = getSelectedDateForEstablishment(establishment.id);
    const month = getSelectedMonthForEstablishment(establishment.id);
    await fetchAppointmentCounts(establishment, date, month);
  };

  const openTop5DetailsModal = () => {
    setShowTop5DetailsModal(true);
    void loadTop5Details(top5DetailsMonth);
  };

  // Função para buscar informações do estabelecimento (email, senha, whatsapp)
  const fetchEstablishmentInfo = async (establishment: Establishment) => {
    setIsLoadingEstablishmentInfo(true);
    try {
      // Em frontend não podemos usar auth.admin/getUserById com segurança (403).
      // Aqui usamos somente registration_forms com prioridade por combinação forte.
      const normalizeDigits = (value: string | null | undefined) => String(value || '').replace(/\D/g, '');
      const establishmentWhatsapp = normalizeDigits(establishment.whatsapp);
      const establishmentName = String(establishment.name || '').trim().toLowerCase();
      const establishmentCode = String(establishment.code || '').trim();

      const { data: rows, error: regError } = await supabase
        .from('registration_forms')
        .select('email,password,client_whatsapp,establishment_name,notes,created_at')
        .order('created_at', { ascending: false })
        .limit(300);

      if (regError) {
        console.error('Erro ao buscar registration_forms:', regError);
        setEstablishmentInfo({
          email: 'Não encontrado',
          password: 'Não encontrado',
          whatsapp: establishment.whatsapp || 'Não encontrado'
        });
        return;
      }

      const candidates = (rows || []) as Array<{
        email?: string;
        password?: string;
        client_whatsapp?: string;
        establishment_name?: string;
        notes?: string;
        created_at?: string;
      }>;

      const scored = candidates
        .map((item) => {
          let score = 0;
          const rowWhatsapp = normalizeDigits(item.client_whatsapp);
          const rowName = String(item.establishment_name || '').trim().toLowerCase();
          const notes = String(item.notes || '').toLowerCase();

          if (establishmentWhatsapp && rowWhatsapp && establishmentWhatsapp === rowWhatsapp) score += 120;
          if (establishmentName && rowName && establishmentName === rowName) score += 70;
          if (establishmentCode && notes.includes(establishmentCode.toLowerCase())) score += 90;
          if (establishmentCode && notes.includes(`código: ${establishmentCode.toLowerCase()}`)) score += 120;
          if (item.email && item.password) score += 10;

          return { item, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      const best = scored[0]?.item || null;
      setEstablishmentInfo({
        email: best?.email || 'Não encontrado',
        password: best?.password || 'Não encontrado',
        whatsapp: best?.client_whatsapp || establishment.whatsapp || 'Não encontrado'
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
    setResetOwnerPasswordValue('');
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

  const handleResetOwnerPassword = async () => {
    if (!selectedEstablishmentForInfo?.id) {
      toast.error('Estabelecimento não selecionado');
      return;
    }
    if (!canEditEverything()) {
      toast.error('Apenas Lucas e Erlon podem resetar senha por aqui.');
      return;
    }

    const newPassword = String(resetOwnerPasswordValue || '').trim();
    if (!newPassword) {
      toast.error('Digite a nova senha do dono do estabelecimento');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    const confirmed = window.confirm(
      `Resetar senha do estabelecimento "${selectedEstablishmentForInfo.name}" agora?`
    );
    if (!confirmed) return;

    setIsResettingOwnerPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = String(sessionData?.session?.access_token || '').trim();
      if (!accessToken) {
        toast.error('Sessão admin inválida. Faça login novamente.');
        return;
      }

      const response = await fetch('/api/admin/reset-establishment-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          establishmentId: selectedEstablishmentForInfo.id,
          newPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detailsText = [
          payload?.error,
          payload?.details?.message,
          payload?.details?.code,
          payload?.details?.status,
        ]
          .filter(Boolean)
          .join(' | ');
        toast.error(detailsText || 'Não foi possível resetar a senha agora');
        return;
      }

      setEstablishmentInfo((prev) => (prev ? { ...prev, password: newPassword } : prev));
      if (payload?.registrationFormPasswordSynced) {
        toast.success('Senha resetada e sincronizada no painel com sucesso!');
      } else {
        const warn = String(payload?.registrationFormSyncWarning || '').trim();
        toast.success('Senha resetada no Auth com sucesso!');
        if (warn) toast.error(warn);
      }
    } catch (error: any) {
      const details = [error?.message, error?.code, error?.details, error?.hint].filter(Boolean).join(' | ');
      toast.error(details || 'Erro ao resetar senha');
    } finally {
      setIsResettingOwnerPassword(false);
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
  const [billingAmountInputByEstablishment, setBillingAmountInputByEstablishment] = useState<Record<string, string>>({});
  const [isSavingBillingAmountByEstablishment, setIsSavingBillingAmountByEstablishment] = useState<Record<string, boolean>>({});
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
  const [saldoLucroMonth, setSaldoLucroMonth] = useState<Date>(() => new Date());
  const [showSaldoLucroInfo, setShowSaldoLucroInfo] = useState(false);
  const [saldoMesMonth, setSaldoMesMonth] = useState<Date>(() => new Date());
  const [clientesMeusPagosMonth, setClientesMeusPagosMonth] = useState<Date>(() => new Date());
  const [cardsRangeStart, setCardsRangeStart] = useState('');
  const [cardsRangeEnd, setCardsRangeEnd] = useState('');

  // ✅ Saldo do dia: permitir navegar por dia (hoje / dia anterior / etc.)
  const [saldoDiaDate, setSaldoDiaDate] = useState<Date>(() => new Date());
  const [lucroPixMonth, setLucroPixMonth] = useState<Date>(() => new Date());
  const [qtdVendasPixMes, setQtdVendasPixMes] = useState<number>(0);
  const [qtdVendasCreditoMes, setQtdVendasCreditoMes] = useState<number>(0);
  const [qtdPixAgendamentosMes, setQtdPixAgendamentosMes] = useState<number>(0);
  const [qtdPixAssinaturasMes, setQtdPixAssinaturasMes] = useState<number>(0);
  const [qtdCreditoAgendamentosMes, setQtdCreditoAgendamentosMes] = useState<number>(0);
  const [qtdCreditoAssinaturasMes, setQtdCreditoAssinaturasMes] = useState<number>(0);
  const [lucroPixMesDetalhe, setLucroPixMesDetalhe] = useState<number>(0);
  const [lucroCreditoMesDetalhe, setLucroCreditoMesDetalhe] = useState<number>(0);
  const [lucroPixMesTotal, setLucroPixMesTotal] = useState<number>(0);
  const [isLoadingLucroPixMes, setIsLoadingLucroPixMes] = useState(false);
  const DELETED_CONTAINMENT_STORAGE_KEY = `admin_deleted_containment_ids_v2_${String(user?.id || 'global')}`;
  const DELETED_CONTAINMENT_STORAGE_KEY_LEGACY = 'admin_deleted_containment_ids_v1';

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

  const TAXA_PLATAFORMA_PIX_ATUAL = 0.5;
  const TAXA_PLATAFORMA_CREDITO_ATUAL = 1;

  const getTaxaPlataformaPixPorData = (dateLike?: string | Date | null) => {
    // Regra atual solicitada: PIX sempre R$ 0,50 por venda.
    return TAXA_PLATAFORMA_PIX_ATUAL;
  };

  const calcularLiquidoPix = (bruto: number, dateLike?: string | Date | null) => {
    const taxaPlataforma = getTaxaPlataformaPixPorData(dateLike);
    const taxaPixPercent = 1.19 / 100; // 1,19%
    const liquido = bruto - taxaPlataforma - bruto * taxaPixPercent;
    return Math.max(0, Math.round(liquido * 100) / 100);
  };

  const calcularLucroPorMetodo = (metodo: 'pix' | 'credito', qtdPago: number) => {
    const q = Number(qtdPago || 0);
    if (!Number.isFinite(q) || q <= 0) return 0;
    const taxa = metodo === 'credito' ? TAXA_PLATAFORMA_CREDITO_ATUAL : TAXA_PLATAFORMA_PIX_ATUAL;
    return Math.round(q * taxa * 100) / 100;
  };

  const getMetodoPixOuCreditoAppointment = (row: any): 'pix' | 'credito' | null => {
    const paymentStatus = String(row?.payment_status || '').toLowerCase();
    const pixPaymentStatus = String(row?.pix_payment_status || '').toLowerCase();
    const hasTransactionId = Boolean(String(row?.payment_transaction_id || '').trim());
    const isPaid = paymentStatus === 'paid' || pixPaymentStatus === 'confirmado';
    if (!isPaid) return null;
    if (paymentStatus === 'paid' && !hasTransactionId && pixPaymentStatus !== 'confirmado') return null;

    const metodo = String(row?.payment_method || '').toLowerCase();
    const isPixByMethod = metodo === 'pix' || metodo === 'pix_now';
    const isCreditByMethod = metodo === 'credito' || metodo === 'credit_card' || metodo === 'credit';
    const isPixByStatus = pixPaymentStatus === 'confirmado';

    if (isPixByMethod || isPixByStatus) return 'pix';
    if (isCreditByMethod) return 'credito';
    // Sem método confiável, não forçar classificação para evitar inflar PIX.
    return null;
  };

  const getSubscriptionBruto = (sub: any) => {
    const rawSubscription = sub?.subscriptions;
    const relationValue = Array.isArray(rawSubscription)
      ? Number(rawSubscription[0]?.value || 0)
      : Number(rawSubscription?.value || 0);
    if (Number.isFinite(relationValue) && relationValue > 0) return relationValue;

    const customValue = Number(sub?.custom_subscription_value ?? 0);
    if (Number.isFinite(customValue) && customValue > 0) return customValue;

    return 0;
  };

  const getSubscriptionPaymentDate = (sub: any) => {
    const lastPaymentDate = String(sub?.last_payment_date || '').trim();
    if (lastPaymentDate) return lastPaymentDate;
    const createdAt = String(sub?.created_at || '').trim();
    if (createdAt) return createdAt;
    return null;
  };

  const isDateInCurrentMonth = (dateLike?: string | Date | null) => {
    if (!dateLike) return false;
    const dt = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (!Number.isFinite(dt.getTime())) return false;
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  };

  const getMetodoAssinaturaPixOuCredito = (sub: any): 'pix' | 'credito' | null => {
    const provider = String(sub?.subscription_payment_provider || '').toLowerCase().trim();
    const paymentMethod = String(sub?.subscriber_payment_method || '').toLowerCase().trim();
    const isIntegratedProvider = provider.includes('mercadopago') || provider.includes('pagarme');
    if (!isIntegratedProvider) return null;

    if (paymentMethod === 'pix') return 'pix';
    if (paymentMethod === 'credito' || paymentMethod === 'credit_card') return 'credito';
    if (provider.includes('pix')) return 'pix';
    if (provider.includes('card') || provider.includes('credit') || provider.includes('credito')) return 'credito';
    return null;
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
        .select('id,establishment_id,price,payment_status,pix_payment_status,payment_method,payment_transaction_id,status,created_at,appointment_date')
        .in('establishment_id', ids)
        .or('payment_status.eq.paid,pix_payment_status.eq.confirmado');

      if (apptsError) throw apptsError;

      const totalLiquidoMap: Record<string, number> = {};
      const qtdPixMap: Record<string, number> = {};
      const qtdCreditoMap: Record<string, number> = {};
      const lucroPixMap: Record<string, number> = {};
      const lucroCreditoMap: Record<string, number> = {};
      const seenByEst = new Map<string, Set<string>>();

      for (const row of (appts as any[]) || []) {
        const estId = String(row?.establishment_id || '');
        const id = String(row?.id || '');
        if (!estId || !id) continue;
        if (!seenByEst.has(estId)) seenByEst.set(estId, new Set());
        const seen = seenByEst.get(estId)!;
        if (seen.has(id)) continue;
        seen.add(id);

        const metodoVenda = getMetodoPixOuCreditoAppointment(row);
        if (!metodoVenda) continue;

        const status = String(row?.status || '').toLowerCase();
        if (status !== 'confirmed') continue; // regra do produto: só entra se finalizou agendamento

        const bruto = Number(row?.price ?? 0);
        if (!Number.isFinite(bruto) || bruto <= 0) continue;

        const rowDate = row?.created_at || row?.appointment_date || null;
        totalLiquidoMap[estId] = Math.round(((totalLiquidoMap[estId] || 0) + calcularLiquidoPix(bruto, rowDate)) * 100) / 100;
        if (!isDateInCurrentMonth(rowDate)) continue;
        const lucroItem = calcularLucroPorMetodo(metodoVenda, 1);
        if (metodoVenda === 'pix') {
          qtdPixMap[estId] = (qtdPixMap[estId] || 0) + 1;
          lucroPixMap[estId] = Math.round(((lucroPixMap[estId] || 0) + lucroItem) * 100) / 100;
        } else if (metodoVenda === 'credito') {
          qtdCreditoMap[estId] = (qtdCreditoMap[estId] || 0) + 1;
          lucroCreditoMap[estId] = Math.round(((lucroCreditoMap[estId] || 0) + lucroItem) * 100) / 100;
        }
      }

      // 3) Assinaturas PIX/Crédito pagas (client_subscriptions) via integração
      // - Conta também no "Lucro PIX + Crédito" (PIX R$0,50 e Crédito R$1,00 por venda) e no saldo líquido.
      // - Observação: não temos histórico por renovação; aqui conta a venda/assinatura paga atual.
      try {
        const subsQuery = supabase.from('client_subscriptions') as any;
        const { data: subsData, error: subsError } = await subsQuery
          .select(
            'id,establishment_id,payment_status,subscription_payment_provider,subscriber_payment_method,subscription_payment_order_id,created_at,last_payment_date,custom_subscription_value,subscriptions(value)'
          )
          .in('establishment_id', ids)
          .eq('payment_status', 'paid');

        if (subsError) throw subsError;

        for (const sub of (subsData as any[]) || []) {
          const estId = String(sub?.establishment_id || '');
          if (!estId) continue;

          // Dedupe: preferir order id quando existir (mais próximo de "venda"), senão id da assinatura
          const orderKey = String(sub?.subscription_payment_order_id || '').trim();
          const idKey = String(sub?.id || '').trim();
          const uniqKey = orderKey || idKey;
          if (!uniqKey) continue;

          if (!seenByEst.has(estId)) seenByEst.set(estId, new Set());
          const seen = seenByEst.get(estId)!;
          if (seen.has(`sub:${uniqKey}`)) continue;
          seen.add(`sub:${uniqKey}`);

          // Contar assinaturas PIX e crédito (Mercado Pago / Pagar.me)
          const metodoAssinatura = getMetodoAssinaturaPixOuCredito(sub);
          if (!metodoAssinatura) continue;

          const bruto = getSubscriptionBruto(sub);
          if (!Number.isFinite(bruto) || bruto <= 0) continue;

          const rowDate = getSubscriptionPaymentDate(sub);
          totalLiquidoMap[estId] = Math.round(((totalLiquidoMap[estId] || 0) + calcularLiquidoPix(bruto, rowDate)) * 100) / 100;
          if (!isDateInCurrentMonth(rowDate)) continue;
          const lucroItem = calcularLucroPorMetodo(metodoAssinatura, 1);
          if (metodoAssinatura === 'pix') {
            qtdPixMap[estId] = (qtdPixMap[estId] || 0) + 1;
            lucroPixMap[estId] = Math.round(((lucroPixMap[estId] || 0) + lucroItem) * 100) / 100;
          } else if (metodoAssinatura === 'credito') {
            qtdCreditoMap[estId] = (qtdCreditoMap[estId] || 0) + 1;
            lucroCreditoMap[estId] = Math.round(((lucroCreditoMap[estId] || 0) + lucroItem) * 100) / 100;
          }
        }
      } catch (e: any) {
        // Fallback seguro: se o banco não tiver as colunas (schema antigo), ignora sem quebrar o admin
        const msg = String(e?.message || '').toLowerCase();
        const looksLikeMissingColumn =
          msg.includes('column') ||
          msg.includes('schema cache') ||
          msg.includes('subscription_payment_provider') ||
          msg.includes('subscription_payment_order_id');
        if (!looksLikeMissingColumn) {
          console.warn('⚠️ Falha ao incluir assinaturas no cálculo PIX/Crédito (admin):', e);
        }
      }

      const saldoMap: Record<string, number> = {};
      for (const estId of ids) {
        const totalLiquido = totalLiquidoMap[estId] || 0;
        const totalPago = pagoMap[estId] || 0;
        saldoMap[estId] = Math.max(0, Math.round((totalLiquido - totalPago) * 100) / 100);
      }

      setTotalVendasLiquidasPorEstabelecimento(totalLiquidoMap);
      setTotalPagoAdminPorEstabelecimento(pagoMap);
      setQtdPixPagoPorEstabelecimento(qtdPixMap);
      setQtdCreditoPagoPorEstabelecimento(qtdCreditoMap);
      setLucroPixPorEstabelecimento(lucroPixMap);
      setLucroCreditoPorEstabelecimento(lucroCreditoMap);
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

  // ✅ Ativo/Inativo por último acesso
  // Regra: ativo = acessou nos últimos 5 dias. "Nunca acessou" = inativo.
  const isActiveEstablishment = (est: Establishment): boolean => {
    const raw = String((est as any)?.last_access || '').trim();
    if (!raw) return false;
    const d = new Date(raw);
    const t = d.getTime();
    if (!Number.isFinite(t)) return false;
    const now = Date.now();
    const diffMs = now - t;
    // Se der negativo (horário do client/servidor), considerar ativo
    if (diffMs <= 0) return true;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 5;
  };

  // Função de logout personalizada que redireciona
  const handleSignOut = async () => {
    try {
      clearRememberedSupport();
      sessionStorage.removeItem(SUPPORT_SESSION_NAME_KEY);
      await signOut();
      toast.success('Logout realizado com sucesso!');
      navigate('/'); // Redireciona para a página inicial
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  // ---------- Suporte por nome: Lucas, Erlon, Kinkas, usuario 1, usuario 2 ----------
  const getSupportSessionName = (): string | null =>
    sessionStorage.getItem(SUPPORT_SESSION_NAME_KEY);
  const getRememberedSupport = (): { name: string; pin: string; expiresAt: number } | null => {
    try {
      const raw = localStorage.getItem(SUPPORT_REMEMBER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { name?: string; pin?: string; expiresAt?: number };
      const name = String(parsed?.name || '').trim();
      const pin = String(parsed?.pin || '').trim();
      const expiresAt = Number(parsed?.expiresAt || 0);
      if (!name || pin.length !== 4 || !Number.isFinite(expiresAt)) return null;
      if (Date.now() > expiresAt) {
        localStorage.removeItem(SUPPORT_REMEMBER_KEY);
        return null;
      }
      return { name, pin, expiresAt };
    } catch {
      return null;
    }
  };
  const rememberSupport = (name: string, pin: string) => {
    try {
      localStorage.setItem(
        SUPPORT_REMEMBER_KEY,
        JSON.stringify({
          name: String(name || '').trim(),
          pin: String(pin || '').trim(),
          expiresAt: Date.now() + SUPPORT_REMEMBER_TTL_MS,
        })
      );
    } catch {
      // ignore
    }
  };
  const clearRememberedSupport = () => {
    try {
      localStorage.removeItem(SUPPORT_REMEMBER_KEY);
    } catch {
      // ignore
    }
  };
  const canEditEverything = (): boolean =>
    isSupportAccount && SUPPORT_FULL_ACCESS_NAMES.includes(getSupportSessionName() || '');

  const fetchSupportSessions = async () => {
    if (!isSupportAccount || !supportSessionAvailableRef.current) return;
    const { data, error } = await supabase
      .from('support_sessions')
      .select('id, name, email, created_at, last_heartbeat_at')
      .order('name', { ascending: true });
    if (!error) setSupportSessions(data || []);
  };

  const checkSupportSessionStillValid = async (): Promise<boolean> => {
    if (!supportSessionAvailableRef.current) return false;
    const name = getSupportSessionName();
    if (!name) return false;
    const { data, error } = await supabase.from('support_sessions').select('id').eq('name', name).maybeSingle();
    if (error) return true;
    if (data === null) {
      const remembered = getRememberedSupport();
      if (remembered && remembered.name === name) {
        const restored = await registerSupportByName(remembered.name, remembered.pin);
        if (restored) {
          sessionStorage.setItem(SUPPORT_SESSION_NAME_KEY, remembered.name);
          toast.success('Sessão de suporte restaurada neste dispositivo.');
          return true;
        }
      }
      sessionStorage.removeItem(SUPPORT_SESSION_NAME_KEY);
      setSupportNameForPin(null);
      setSupportPinInput('');
      setShowSupportNamePicker(true);
      toast.error('Sessão de suporte expirada. Digite a senha novamente.');
      return false;
    }
    return true;
  };

  const disconnectSupportSession = async (sessionName: string) => {
    const { error } = await supabase.from('support_sessions').delete().eq('name', sessionName);
    if (error) {
      toast.error('Erro ao desconectar.');
      return;
    }
    toast.success(`${sessionName} será deslogado em até 10 segundos.`);
    setSupportSessions(prev => prev.filter(s => s.name !== sessionName));
  };

  const registerSupportByName = async (name: string, pin?: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('register_support_session_by_name', {
      p_name: name,
      p_pin: pin != null ? String(pin).trim() : null
    });
    if (error) {
      supportSessionAvailableRef.current = false;
      if (!supportSessionErrorShownRef.current) {
        supportSessionErrorShownRef.current = true;
        toast.error('Rode o SQL de suporte por nome no Supabase (COLE_SUPABASE_support_por_nome.sql).');
      }
      return false;
    }
    supportSessionErrorShownRef.current = false;
    const res = data as { ok?: boolean; error?: string } | null;
    if (res?.ok === false && res?.error === 'name_in_use') {
      toast.error(`${name} já está logado. Escolha outro nome.`);
      return false;
    }
    if (res?.ok === false && res?.error === 'invalid_pin') {
      toast.error('Senha de 4 dígitos incorreta.');
      return false;
    }
    if (res?.ok === false) return false;
    return true;
  };

  const submitSupportPin = async () => {
    const pin = String(supportPinInput || '').trim();
    const selectedName = supportNameForPin;
    if (!selectedName) {
      toast.error('Selecione um usuário antes de entrar.');
      return;
    }
    if (pin.length !== 4) {
      toast.error('Senha deve ter 4 dígitos.');
      return;
    }

    try {
      setIsSubmittingSupportPin(true);
      const ok = await registerSupportByName(selectedName, pin);
      if (!ok) return;

      sessionStorage.setItem(SUPPORT_SESSION_NAME_KEY, selectedName);
      rememberSupport(selectedName, pin);
      setSupportNameForPin(null);
      setSupportPinInput('');
      setShowSupportNamePicker(false);
      toast.success('Login realizado com sucesso!');
      fetchSupportSessions();
    } finally {
      setIsSubmittingSupportPin(false);
    }
  };

  // Ao abrir o admin: tenta restaurar suporte salvo no dispositivo
  useEffect(() => {
    if (!isSupportAccount || !user) return;
    const remembered = getRememberedSupport();
    if (remembered) {
      sessionStorage.setItem(SUPPORT_SESSION_NAME_KEY, remembered.name);
      setSupportNameForPin(null);
      setSupportPinInput('');
      setShowSupportNamePicker(false);
      (async () => {
        const ok = await registerSupportByName(remembered.name, remembered.pin);
        if (!ok) {
          clearRememberedSupport();
          sessionStorage.removeItem(SUPPORT_SESSION_NAME_KEY);
          setShowSupportNamePicker(true);
          toast.error('Não foi possível restaurar sua sessão salva. Digite a senha novamente.');
          return;
        }
        fetchSupportSessions();
      })();
      return;
    }
    setSupportNameForPin(null);
    setSupportPinInput('');
    setShowSupportNamePicker(true);
  }, [isSupportAccount, user]);

  // Heartbeat a cada 8s; ao voltar na aba verifica na hora
  useEffect(() => {
    if (!isSupportAccount || !supportSessionAvailableRef.current) return;
    const name = getSupportSessionName();
    if (!name) return;
    const interval = setInterval(async () => {
      if (!supportSessionAvailableRef.current) return;
      const n = getSupportSessionName();
      if (!n) return;
      const stillValid = await checkSupportSessionStillValid();
      if (!stillValid) return;
      await supabase.rpc('register_support_session_by_name', { p_name: n });
    }, 8000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkSupportSessionStillValid();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isSupportAccount]);

  // Atualizar lista de sessões a cada 15s
  useEffect(() => {
    if (!isSupportAccount) return;
    fetchSupportSessions();
    const interval = setInterval(fetchSupportSessions, 15000);
    return () => clearInterval(interval);
  }, [isSupportAccount]);

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
        .order('updated_at', { ascending: false })
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
            mercadopago_billing_amount: Number((establishment as any).mercadopago_billing_amount ?? 0),
            whatsapp: establishment.whatsapp || ''
          };

          return processedEstablishment;
        })
      );

      // Em dia na grade (= vencimento futuro / status coerente): alerta não deve permanecer ligado.
      const paidWithAlertIds = establishmentsWithEmails
        .filter((est) => Boolean(est.payment_alert_enabled) && getAdminGridDisplayPaymentState(est) === 'paid')
        .map((est) => est.id);

      if (paidWithAlertIds.length > 0) {
        await Promise.all(
          paidWithAlertIds.map(async (id) => {
            const { error } = await supabase
              .from('establishments')
              .update({ payment_alert_enabled: false })
              .eq('id', id);
            if (error) {
              console.warn('Falha ao desativar alerta automaticamente para estabelecimento pago:', id, error);
            }
          })
        );

        establishmentsWithEmails.forEach((est) => {
          if (paidWithAlertIds.includes(est.id)) {
            est.payment_alert_enabled = false;
          }
        });
      }

      const bookingUnblockEmDiaIds = establishmentsWithEmails
        .filter((est) => Boolean(est.booking_blocked) && getAdminGridDisplayPaymentState(est) === 'paid')
        .map((est) => est.id);

      if (bookingUnblockEmDiaIds.length > 0) {
        await Promise.all(
          bookingUnblockEmDiaIds.map(async (id) => {
            const { error } = await supabase
              .from('establishments')
              .update({ booking_blocked: false })
              .eq('id', id);
            if (error) {
              console.warn('Falha ao desbloquear booking automaticamente (estabelecimento em dia na grade):', id, error);
            }
          })
        );

        establishmentsWithEmails.forEach((est) => {
          if (bookingUnblockEmDiaIds.includes(est.id)) {
            est.booking_blocked = false;
          }
        });
      }

      // ✅ Regra automática: se venceu hoje OU está vencido, alerta deve ficar ligado (quando não está pago).
      const shouldAutoEnableAlert = (est: any) => {
        const paymentStatus = String(est?.payment_status || '').toLowerCase().trim();
        const dueDate = String(est?.payment_due_date || '').trim();
        if (!dueDate) return false;
        return paymentStatus === 'expired' || isExpired(dueDate) || isDueToday(dueDate);
      };

      const shouldEnableAlertIds = establishmentsWithEmails
        .filter((est) => shouldAutoEnableAlert(est) && !Boolean(est.payment_alert_enabled))
        .map((est) => est.id);

      if (shouldEnableAlertIds.length > 0) {
        await Promise.all(
          shouldEnableAlertIds.map(async (id) => {
            const { error } = await supabase
              .from('establishments')
              .update({ payment_alert_enabled: true })
              .eq('id', id);
            if (error) {
              console.warn('Falha ao ativar alerta automaticamente para estabelecimento vencido/vence hoje:', id, error);
            }
          })
        );

        establishmentsWithEmails.forEach((est) => {
          if (shouldEnableAlertIds.includes(est.id)) {
            est.payment_alert_enabled = true;
          }
        });
      }

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
          mercadopago_billing_amount: Number((establishment as any).mercadopago_billing_amount ?? 0),
          whatsapp: establishment.whatsapp || ''
        };
      });

      setEstablishments(establishmentsWithEmails);
      setDeletedEstablishments(deletedWithEmails);

      // ✅ Carregar saldos em vendas (PIX pago) para controle do admin
      // (saldo = vendas líquidas - pagamentos já feitos)
      await carregarSaldosEmVendas(establishmentsWithEmails);

      // Verificar e atualizar status vencidos automaticamente (usa lista recém-buscada).
      await checkAndUpdateExpiredStatus(establishmentsWithEmails);
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
        updateData.payment_alert_enabled = false;
        updateData.booking_blocked = false;
        // Importante para cards de "saldo do dia"/"saldo mês":
        // quando marcar pago manualmente, registrar o instante do pagamento.
        updateData.payment_paid_at = new Date().toISOString();
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
              payment_paid_at: status === 'paid' ? updateData.payment_paid_at : est.payment_paid_at,
              payment_alert_enabled: status === 'paid' ? false : est.payment_alert_enabled,
              booking_blocked: status === 'paid' ? false : est.booking_blocked
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
      const establishment = establishments.find((est) => est.id === establishmentId);
      if (establishment && isAdminGridPaymentEmDia(establishment) && !isEnabled) {
        toast.error('Estabelecimento em dia na grade. O alerta só pode ser ativado quando estiver pendente/vencido.');
        return;
      }

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
      const establishment = establishments.find((est) => est.id === establishmentId);
      if (establishment && isAdminGridPaymentEmDia(establishment)) {
        toast.error(
          'Estabelecimento em dia (vencimento futuro). O bloqueio de PG só pode ser alterado quando estiver pendente/vencido.'
        );
        return;
      }

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
        const nowIso = new Date().toISOString();
        const deletedDraft = {
          ...(establishmentToDelete as any),
          is_deleted: true,
          updated_at: nowIso,
        } as Establishment;
        setDeletedEstablishments(prev => [deletedDraft, ...prev]);
      }

      // Remover da lista de estabelecimentos ativos
      setEstablishments(prev => prev.filter(est => est.id !== establishmentId));

      // Marcar como excluído no banco de dados
      const { error } = await supabase
        .from('establishments')
        .update({ is_deleted: true, updated_at: new Date().toISOString() } as any)
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
        const nowIso = new Date().toISOString();
        const deletedDraft = {
          ...(establishmentToDelete as any),
          is_deleted: true,
          updated_at: nowIso,
        } as Establishment;
        setDeletedEstablishments(prev => [deletedDraft, ...prev]);
      }

      // Remover da lista de estabelecimentos ativos
      setEstablishments(prev => prev.filter(est => est.id !== establishmentId));

      // Marcar como excluído no banco de dados
      const { error } = await supabase
        .from('establishments')
        .update({ is_deleted: true, updated_at: new Date().toISOString() } as any)
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
      setDeletedContainmentIds(prev => prev.filter(id => id !== establishmentId));

      // Marcar como não excluído no banco de dados
      const { error } = await supabase
        .from('establishments')
        .update({ is_deleted: false, updated_at: new Date().toISOString() } as any)
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

  const moveDeletedToContainment = (establishmentId: string) => {
    setDeletedContainmentIds((prev) => {
      if (prev.includes(establishmentId)) return prev;
      const next = [...prev, establishmentId];
      try {
        localStorage.setItem(DELETED_CONTAINMENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // noop
      }
      return next;
    });
    toast.success('Movido para a lixeira de contenção.');
  };

  const moveDeletedBackToNormalTrash = (establishmentId: string) => {
    setDeletedContainmentIds((prev) => {
      const next = prev.filter((id) => id !== establishmentId);
      try {
        localStorage.setItem(DELETED_CONTAINMENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // noop
      }
      return next;
    });
    toast.success('Movido de volta para a lixeira normal.');
  };

  const parseDateOnlySafe = (value?: string | null): number => {
    const raw = String(value || '').trim();
    if (!raw) return NaN;
    const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (onlyDate) {
      const y = Number(onlyDate[1]);
      const m = Number(onlyDate[2]) - 1;
      const d = Number(onlyDate[3]);
      return new Date(y, m, d, 12, 0, 0, 0).getTime();
    }
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : NaN;
  };

  const isExpired = (dueDate: string) => {
    const dueAt = parseDateOnlySafe(dueDate);
    if (!Number.isFinite(dueAt)) return false;
    const dueEndOfDay = endOfDay(new Date(dueAt)).getTime();
    return dueEndOfDay < Date.now();
  };

  const isDueToday = (dueDate: string) => {
    const dueAt = parseDateOnlySafe(dueDate);
    if (!Number.isFinite(dueAt)) return false;
    const dueDateLocal = new Date(dueAt);
    const now = new Date();
    return (
      dueDateLocal.getFullYear() === now.getFullYear() &&
      dueDateLocal.getMonth() === now.getMonth() &&
      dueDateLocal.getDate() === now.getDate()
    );
  };

  const getDisplayPaymentState = (establishment: Establishment) => getAdminGridDisplayPaymentState(establishment);

  const isSameMonthYear = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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
        .lte('created_at', end.toISOString());

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

  const carregarLucroPixPorMes = async (monthDate: Date) => {
    const ids = establishments.map(e => e.id).filter(Boolean);
    if (ids.length === 0) {
      setQtdVendasPixMes(0);
      setQtdVendasCreditoMes(0);
      setQtdPixAgendamentosMes(0);
      setQtdPixAssinaturasMes(0);
      setQtdCreditoAgendamentosMes(0);
      setQtdCreditoAssinaturasMes(0);
      setLucroPixMesDetalhe(0);
      setLucroCreditoMesDetalhe(0);
      setLucroPixMesTotal(0);
      return;
    }
    setIsLoadingLucroPixMes(true);
    try {
      const { start: monthStart, end: monthEnd } = getMonthRange(monthDate);
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

      let countPixAppts = 0;
      let countCreditoAppts = 0;
      let lucroPixAppts = 0;
      let lucroCreditoAppts = 0;
      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select('id,establishment_id,payment_status,pix_payment_status,payment_method,payment_transaction_id,status,appointment_date,created_at')
        .in('establishment_id', ids)
        .gte('appointment_date', monthStartStr)
        .lte('appointment_date', monthEndStr)
        .or('payment_status.eq.paid,pix_payment_status.eq.confirmado');

      if (!apptsError && appts) {
        const seen = new Set<string>();
        for (const row of appts as any[]) {
          const id = String(row?.id || '');
          const estId = String(row?.establishment_id || '');
          if (!estId || !id || seen.has(id)) continue;
          const metodoVenda = getMetodoPixOuCreditoAppointment(row);
          if (!metodoVenda) continue;
          if (String(row?.status || '').toLowerCase() !== 'confirmed') continue;
          seen.add(id);
          const rowDate = row?.created_at || row?.appointment_date || null;
          const lucroItem = calcularLucroPorMetodo(metodoVenda, 1);
          if (metodoVenda === 'pix') {
            countPixAppts++;
            lucroPixAppts = Math.round((lucroPixAppts + lucroItem) * 100) / 100;
          } else if (metodoVenda === 'credito') {
            countCreditoAppts++;
            lucroCreditoAppts = Math.round((lucroCreditoAppts + lucroItem) * 100) / 100;
          }
        }
      }

      let countPixSubs = 0;
      let countCreditoSubs = 0;
      let lucroPixSubs = 0;
      let lucroCreditoSubs = 0;
      try {
        const monthStartTs = monthStart.getTime();
        const monthEndTs = monthEnd.getTime();
        const subsQuery = supabase.from('client_subscriptions') as any;
        const { data: subsData, error: subsError } = await subsQuery
          .select('id,establishment_id,subscription_payment_provider,subscriber_payment_method,last_payment_date,created_at,custom_subscription_value,subscriptions(value)')
          .in('establishment_id', ids)
          .eq('payment_status', 'paid');

        if (!subsError && subsData) {
          for (const sub of subsData as any[]) {
            const paymentDateRaw = getSubscriptionPaymentDate(sub);
            if (!paymentDateRaw) continue;
            const paymentDate = new Date(paymentDateRaw);
            if (!Number.isFinite(paymentDate.getTime())) continue;
            const paymentTs = paymentDate.getTime();
            if (paymentTs < monthStartTs || paymentTs > monthEndTs) continue;

            const bruto = getSubscriptionBruto(sub);
            if (!Number.isFinite(bruto) || bruto <= 0) continue;

            const metodoAssinatura = getMetodoAssinaturaPixOuCredito(sub);
            if (!metodoAssinatura) continue;
            const lucroItem = calcularLucroPorMetodo(metodoAssinatura, 1);
            if (metodoAssinatura === 'pix') {
              countPixSubs++;
              lucroPixSubs = Math.round((lucroPixSubs + lucroItem) * 100) / 100;
            } else if (metodoAssinatura === 'credito') {
              countCreditoSubs++;
              lucroCreditoSubs = Math.round((lucroCreditoSubs + lucroItem) * 100) / 100;
            }
          }
        }
      } catch {
        // schema antigo sem colunas
      }

      const totalPix = countPixAppts + countPixSubs;
      const totalCredito = countCreditoAppts + countCreditoSubs;
      const lucroPix = Math.round((lucroPixAppts + lucroPixSubs) * 100) / 100;
      const lucroCredito = Math.round((lucroCreditoAppts + lucroCreditoSubs) * 100) / 100;
      const lucro = Math.round((lucroPix + lucroCredito) * 100) / 100;
      setQtdVendasPixMes(totalPix);
      setQtdVendasCreditoMes(totalCredito);
      setQtdPixAgendamentosMes(countPixAppts);
      setQtdPixAssinaturasMes(countPixSubs);
      setQtdCreditoAgendamentosMes(countCreditoAppts);
      setQtdCreditoAssinaturasMes(countCreditoSubs);
      setLucroPixMesDetalhe(lucroPix);
      setLucroCreditoMesDetalhe(lucroCredito);
      setLucroPixMesTotal(lucro);
    } catch (e) {
      console.error('Erro ao carregar lucro PIX/Crédito por mês:', e);
      setQtdVendasPixMes(0);
      setQtdVendasCreditoMes(0);
      setQtdPixAgendamentosMes(0);
      setQtdPixAssinaturasMes(0);
      setQtdCreditoAgendamentosMes(0);
      setQtdCreditoAssinaturasMes(0);
      setLucroPixMesDetalhe(0);
      setLucroCreditoMesDetalhe(0);
      setLucroPixMesTotal(0);
    } finally {
      setIsLoadingLucroPixMes(false);
    }
  };

  useEffect(() => {
    carregarLucroPixPorMes(lucroPixMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lucroPixMonth, establishments.length]);

  useEffect(() => {
    fetchClientsMonthCount(clientsMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsMonth]);

  useEffect(() => {
    try {
      const currentRaw = localStorage.getItem(DELETED_CONTAINMENT_STORAGE_KEY);
      const legacyRaw = localStorage.getItem(DELETED_CONTAINMENT_STORAGE_KEY_LEGACY);
      const merged = new Set<string>();
      const loadIds = (raw: string | null) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        parsed.forEach((id) => {
          if (typeof id === 'string' && id.trim().length > 0) merged.add(id.trim());
        });
      };
      loadIds(currentRaw);
      loadIds(legacyRaw);
      const safeIds = Array.from(merged);
      if (safeIds.length > 0) {
        setDeletedContainmentIds(safeIds);
        localStorage.setItem(DELETED_CONTAINMENT_STORAGE_KEY, JSON.stringify(safeIds));
      }
    } catch (error) {
      console.warn('Falha ao carregar lixeira de contenção:', error);
    }
  }, [DELETED_CONTAINMENT_STORAGE_KEY, DELETED_CONTAINMENT_STORAGE_KEY_LEGACY]);

  useEffect(() => {
    try {
      localStorage.setItem(DELETED_CONTAINMENT_STORAGE_KEY, JSON.stringify(deletedContainmentIds));
    } catch (error) {
      console.warn('Falha ao salvar lixeira de contenção:', error);
    }
  }, [DELETED_CONTAINMENT_STORAGE_KEY, deletedContainmentIds]);

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

  useEffect(() => {
    setBillingAmountInputByEstablishment(prev => {
      const next = { ...prev };
      for (const est of establishments) {
        if (next[est.id] === undefined) {
          const v = Number((est as any)?.mercadopago_billing_amount ?? 0);
          next[est.id] = Number.isFinite(v) && v > 0 ? String(v).replace('.', ',') : '';
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

  useEffect(() => {
    const deletedIds = new Set(deletedEstablishments.map((est) => est.id));
    setDeletedContainmentIds((prev) => prev.filter((id) => deletedIds.has(id)));
  }, [deletedEstablishments]);

  useEffect(() => {
    if (!showLastPaymentsModal) return;

    let alive = true;
    const loadAutomaticPayments = async () => {
      setIsLoadingLastPaymentsSources(true);
      setLastPaymentsSourcesWarning('');
      try {
        const endpoint = import.meta.env.PROD
          ? '/.netlify/functions/mercadopago-recent-establishment-billing-payments?days=10'
          : '/api/mercadopago/recent-establishment-billing-payments?days=10';

        const response = await fetch(endpoint, { method: 'GET' });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (alive) setLastPaymentsSourcesWarning(String((payload as any)?.error || 'Não foi possível classificar pagamentos automáticos agora.'));
          if (alive) setAutomaticPaymentInfoByEstablishment({});
          return;
        }

        const next: Record<string, { timestamp: number; paymentProvider: string }> = {};
        const items = Array.isArray((payload as any)?.items) ? (payload as any).items : [];
        items.forEach((row: any) => {
          const id = String(row?.establishment_id || '').trim();
          if (!id) return;

          const ts = new Date(String(row?.paid_at || row?.updated_at || '')).getTime();
          if (!Number.isFinite(ts)) return;
          const provider = String(row?.payment_provider || 'mercadopago').trim();

          if (!next[id] || ts > next[id].timestamp) {
            next[id] = {
              timestamp: ts,
              paymentProvider: provider,
            };
          }
        });

        if (alive) setAutomaticPaymentInfoByEstablishment(next);
      } catch (error) {
        console.error('Erro ao classificar pagamentos automáticos:', error);
        if (alive) {
          setAutomaticPaymentInfoByEstablishment({});
          setLastPaymentsSourcesWarning('Não foi possível classificar pagamentos automáticos agora.');
        }
      } finally {
        if (alive) setIsLoadingLastPaymentsSources(false);
      }
    };

    void loadAutomaticPayments();
    return () => {
      alive = false;
    };
  }, [showLastPaymentsModal]);

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

  const buildMetaErrorReason = (row: any): string => {
    const pretty = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim();
    const rawLastError = pretty(row?.last_error);
    const rawProviderResponse = pretty(row?.provider_response);
    const rawCombined = pretty(rawLastError || rawProviderResponse || '');

    const codeMatch = rawCombined.match(/(?:^|[\s|,{])code\s*[:=]\s*(\d{3,6})/i);
    const titleMatch = rawCombined.match(/(?:^|[\s|,{])title\s*[:=]\s*([^|,}]{3,120})/i);
    const detailsMatch = rawCombined.match(/(?:^|[\s|,{])details?\s*[:=]\s*([^|}]{3,200})/i);

    let code = codeMatch?.[1] || '';
    let title = titleMatch?.[1] || '';
    let details = detailsMatch?.[1] || '';
    let message = '';

    const tryParseJson = (input: string): any | null => {
      if (!input) return null;
      const first = input[0];
      if (first !== '{' && first !== '[') return null;
      try {
        return JSON.parse(input);
      } catch {
        return null;
      }
    };

    const parsedLastError = tryParseJson(rawLastError);
    const parsedProviderResponse = tryParseJson(rawProviderResponse);
    const parsed = parsedLastError || parsedProviderResponse;

    if (parsed && typeof parsed === 'object') {
      const err = (parsed as any)?.error || parsed;
      code = code || pretty(err?.code || err?.error_code);
      title = title || pretty(err?.title || err?.error_user_title || err?.type);
      details = details || pretty(err?.details || err?.error_user_msg || err?.error_data?.details);
      message = pretty(
        err?.message ||
        (parsed as any)?.message ||
        (parsed as any)?.response?.message ||
        (parsed as any)?.response?.error ||
        (parsed as any)?.response?.details
      );
    }

    if (!code && !title && !details && !message) {
      return rawCombined ? rawCombined.slice(0, 220) : 'Sem detalhe do motivo.';
    }

    const knownCauseByCode: Record<string, string> = {
      '131042': 'Conta WhatsApp Business com pendencia de pagamento/eligibilidade.',
      '131020': 'Numero do destinatario indisponivel, invalido ou bloqueado.',
      '130472': 'Template nao permitido para este contexto/conteudo.',
      '401': 'Credenciais/token invalidos para envio.',
    };

    const known = code ? knownCauseByCode[code] : '';
    const parts = [
      code ? `code=${code}` : '',
      title ? `titulo=${title}` : '',
      details ? `detalhe=${details}` : '',
      message ? `mensagem=${message}` : '',
      known ? `motivo=${known}` : '',
    ].filter(Boolean);

    return pretty(parts.join(' | ')).slice(0, 260);
  };

  const loadMetaErrorsToday = async () => {
    setIsLoadingMetaErrors(true);
    try {
      const startTodayIso = startOfDay(new Date()).toISOString();
      const selectCandidates = [
        'establishment_id,created_at,status,meta_status,last_error,provider_response,meta_message_id',
        'establishment_id,created_at,status,meta_status,provider_response,meta_message_id',
        'establishment_id,created_at,status,meta_status,provider_response',
        'establishment_id,created_at,status,meta_status',
        'establishment_id,created_at,status',
      ];

      let rows: any[] = [];
      let loaded = false;
      let lastError: any = null;

      for (const selectCols of selectCandidates) {
        const { data, error } = await supabase
          .from('whatsapp_reminder_logs')
          .select(selectCols)
          .gte('created_at', startTodayIso)
          .or('meta_status.eq.failed,status.eq.failed')
          .order('created_at', { ascending: false })
          .limit(5000);

        if (!error) {
          rows = (data as any[]) || [];
          loaded = true;
          break;
        }
        lastError = error;
      }

      if (!loaded) throw lastError || new Error('Falha ao carregar erros Meta.');

      const establishmentById = new Map<string, Establishment>();
      [...establishments, ...deletedEstablishments].forEach((est) => {
        const id = String(est?.id || '').trim();
        if (!id || establishmentById.has(id)) return;
        establishmentById.set(id, est);
      });

      const aggregate = new Map<string, MetaErrorSummaryRow>();
      rows.forEach((row: any) => {
        const establishmentId = String(row?.establishment_id || '').trim();
        if (!establishmentId) return;

        const status = String(row?.status || '').toLowerCase();
        const metaStatus = String(row?.meta_status || '').toLowerCase();
        if (status !== 'failed' && metaStatus !== 'failed') return;

        const est = establishmentById.get(establishmentId);
        const createdAt = String(row?.created_at || '').trim() || null;
        const cause = buildMetaErrorReason(row);

        const current = aggregate.get(establishmentId);
        if (!current) {
          aggregate.set(establishmentId, {
            establishmentId,
            establishmentName: String(est?.name || 'Estabelecimento não encontrado'),
            establishmentCode: String(est?.code || '-'),
            totalErrors: 1,
            lastErrorAt: createdAt,
            lastCause: cause || 'Sem detalhe',
          });
          return;
        }

        current.totalErrors += 1;
        if (createdAt && (!current.lastErrorAt || new Date(createdAt).getTime() > new Date(current.lastErrorAt).getTime())) {
          current.lastErrorAt = createdAt;
          current.lastCause = cause || current.lastCause;
        }
      });

      const sorted = Array.from(aggregate.values()).sort((a, b) => {
        const ta = a.lastErrorAt ? new Date(a.lastErrorAt).getTime() : 0;
        const tb = b.lastErrorAt ? new Date(b.lastErrorAt).getTime() : 0;
        if (tb !== ta) return tb - ta; // Mais recente primeiro
        return b.totalErrors - a.totalErrors; // Desempate por quantidade
      });

      setMetaErrorRows(sorted);
    } catch (error) {
      console.error('Erro ao carregar Erros Meta de hoje:', error);
      toast.error('Erro ao carregar Erros Meta de hoje.');
      setMetaErrorRows([]);
    } finally {
      setIsLoadingMetaErrors(false);
    }
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

  const saveBillingAmountByEstablishment = async (establishment: Establishment) => {
    const valueRaw = String(billingAmountInputByEstablishment[establishment.id] ?? '').trim();
    const value = parseBRLNumberInput(valueRaw);

    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Informe um valor válido (> 0) para a cobrança PIX desta barbearia.');
      return;
    }

    setIsSavingBillingAmountByEstablishment(prev => ({ ...prev, [establishment.id]: true }));
    try {
      const { error } = await supabase
        .from('establishments')
        .update({ mercadopago_billing_amount: Math.round(value * 100) / 100 } as any)
        .eq('id', establishment.id);

      if (error) {
        const msg = String((error as any)?.message || '');
        if (/mercadopago_billing_amount/i.test(msg) || /column/i.test(msg)) {
          toast.error('Campo mercadopago_billing_amount não existe no banco. Aplique a migration no Supabase.');
        } else {
          toast.error('Erro ao salvar valor da cobrança PIX.');
        }
        console.error(error);
        return;
      }

      setEstablishments(prev =>
        prev.map(e =>
          e.id === establishment.id
            ? { ...e, mercadopago_billing_amount: Math.round(value * 100) / 100 }
            : e
        )
      );
      setBillingAmountInputByEstablishment(prev => ({
        ...prev,
        [establishment.id]: String(Math.round(value * 100) / 100).replace('.', ','),
      }));
      toast.success('Valor de cobrança PIX salvo para este estabelecimento.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar valor da cobrança PIX.');
    } finally {
      setIsSavingBillingAmountByEstablishment(prev => ({ ...prev, [establishment.id]: false }));
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
  const checkAndUpdateExpiredStatus = async (sourceEstablishments?: Establishment[]) => {
    try {
      const list = sourceEstablishments || establishments;

      // 1. Verificar estabelecimentos que venceu (não pagos)
      const expiredEstablishments = list.filter(est => {
        if (est.payment_status === 'paid') return false; // Pulos não podem estar vencidos
        return isExpired(est.payment_due_date);
      });

      // 2. Verificar estabelecimentos PAGOS que venceu (deve voltar para unpaid)
      const paidExpiredEstablishments = list.filter(est => {
        if (est.payment_status !== 'paid') return false; // Só verificar pagos
        return isExpired(est.payment_due_date);
      });

      // 3. Corrigir estabelecimentos marcados como "expired" indevidamente
      // (quando o vencimento ainda não passou).
      const wronglyExpiredEstablishments = list.filter(est => {
        if (est.payment_status !== 'expired') return false;
        return !isExpired(est.payment_due_date);
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

      // Corrigir expired indevido → unpaid
      for (const est of wronglyExpiredEstablishments) {
        await supabase
          .from('establishments')
          .update({ payment_status: 'unpaid' })
          .eq('id', est.id);
      }

      // Atualizar estado local
      setEstablishments(prev =>
        prev.map(est => {
          if (est.payment_status === 'paid' && isExpired(est.payment_due_date)) {
            // Pagos que venceu → voltar para unpaid
            return { ...est, payment_status: 'unpaid' };
          } else if (est.payment_status === 'expired' && !isExpired(est.payment_due_date)) {
            // Corrige "expired" indevido (vencimento ainda não passou)
            return { ...est, payment_status: 'unpaid' };
          } else if (est.payment_status !== 'paid' && isExpired(est.payment_due_date)) {
            // Não pagos que venceu → marcar como expired
            return { ...est, payment_status: 'expired' };
          }

          return est;
        })
      );

      const totalUpdated =
        expiredEstablishments.length +
        paidExpiredEstablishments.length +
        wronglyExpiredEstablishments.length;
      if (totalUpdated > 0) {
        console.log(
          `🔄 ${expiredEstablishments.length} vencidos, ` +
          `${paidExpiredEstablishments.length} pagos vencidos, ` +
          `${wronglyExpiredEstablishments.length} expired corrigidos = ${totalUpdated} total atualizados`
        );
      }
    } catch (error) {
      console.error('Erro ao verificar status vencidos:', error);
    }
  };

  const getStatusColor = (establishment: Establishment) => {
    const displayState = getDisplayPaymentState(establishment);
    if (establishment.is_blocked) return 'text-red-600';
    if (displayState === 'expired') {
      return 'text-red-600';
    }
    if (displayState === 'due_today') return 'text-orange-700';
    if (displayState === 'paid') return 'text-green-600';
    return 'text-yellow-600';
  };

  const getStatusIcon = (establishment: Establishment) => {
    const displayState = getDisplayPaymentState(establishment);
    if (establishment.is_blocked) return <Lock className="h-5 w-5 text-red-600" />;
    if (displayState === 'expired') {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    if (displayState === 'due_today') {
      return <AlertTriangle className="h-5 w-5 text-orange-700" />;
    }
    if (displayState === 'paid') return <CheckCircle className="h-5 w-5 text-green-600" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  };

  // Plano por valor (admin_profit_value) - usado para filtros e contagens
  const isCloseTo = (value: number, target: number, tolerance = 0.25) => Math.abs(value - target) <= tolerance;
  const PLANO_PRATA_VALORES_EXATOS = [27.5, 27.9];
  const PLANO_OURO_VALORES_EXATOS = [47.9, 37.4];
  const PLANO_DIAMANTE_VALORES_EXATOS = [54.9, 62.9, 69.9, 77.9];
  const PLANO_OURO_VALORES_LEGADOS = new Set([47, 37]);
  const PLANO_DIAMANTE_VALORES_LEGADOS = new Set([43, 51]);

  const getPlanKey = (est: Establishment): 'prata' | 'ouro' | 'diamante' | 'outros' => {
    const isPrataAtivo = Boolean(est.plan_prata_active);
    const v = Number((est as any)?.admin_profit_value ?? 0);
    const intValue = Number.isFinite(v) ? Math.round(v) : 0;
    if (isPrataAtivo) return 'prata';

    if (
      Number.isFinite(v) &&
      (PLANO_PRATA_VALORES_EXATOS.some(target => isCloseTo(v, target)) || intValue === 27)
    ) {
      return 'prata';
    }

    if (
      Number.isFinite(v) &&
      (PLANO_OURO_VALORES_EXATOS.some(target => isCloseTo(v, target)) || PLANO_OURO_VALORES_LEGADOS.has(intValue))
    ) {
      return 'ouro';
    }

    if (
      Number.isFinite(v) &&
      (PLANO_DIAMANTE_VALORES_EXATOS.some(target => isCloseTo(v, target)) || PLANO_DIAMANTE_VALORES_LEGADOS.has(intValue))
    ) {
      return 'diamante';
    }

    return 'outros';
  };

  const baseFilteredEstablishments = establishments.filter(establishment => {
    const rawTokens = String(searchTerm || '')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);

    const isPrataAtivo = Boolean(establishment.plan_prata_active);
    const profitValue = Number((establishment as any)?.admin_profit_value ?? 0);
    const profitValueInt = Number.isFinite(profitValue) ? Math.round(profitValue) : 0;
    const planKey = getPlanKey(establishment);
    const planLabel = planKey === 'outros' ? '' : planKey;

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
      // permitir buscar pelo valor manual (admin) digitando "27" / "37" / "47" / "51" etc.
      profitValueInt ? String(profitValueInt) : '',
    ].map(normalizarTexto);

    const matchesSearch =
      rawTokens.length === 0 ||
      rawTokens.every(tok => {
        const cents = parseValorCents(tok);
        if (cents != null) {
          // manter compatível com buscas antigas por centavos (27,90 etc)
          const profitCents = valorCents((establishment as any)?.admin_profit_value);
          if (profitCents != null && profitCents === cents) return true;
          return false;
        }
        // Busca numérica simples (ex: "27", "37", "47", "51") por valor arredondado
        const numeric = Number(String(tok).replace(',', '.'));
        if (Number.isFinite(numeric) && profitValueInt && Math.round(numeric) === profitValueInt) {
          return true;
        }
        const t = normalizarTexto(tok);
        if (!t) return true;
        return haystack.some(h => h.includes(t));
      });

    const matchesStatus = filterStatus === 'all' || establishment.payment_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const planCounts = baseFilteredEstablishments.reduce(
    (acc, est) => {
      const k = getPlanKey(est);
      acc[k] += 1;
      return acc;
    },
    { prata: 0, ouro: 0, diamante: 0, outros: 0 }
  );
  const PLANO_PRATA_COBRANCA = 27.9;
  const PLANO_OURO_COBRANCA_PADRAO = 47.9;
  const PLANO_OURO_COBRANCA_PROMO = 37.4;
  const PLANO_DIAMANTE_COBRANCA_54 = 54.9;
  const PLANO_DIAMANTE_COBRANCA_62 = 62.9;
  const PLANO_DIAMANTE_COBRANCA_69 = 69.9;
  const PLANO_DIAMANTE_COBRANCA_77 = 77.9;
  const getPlanBillingValue = (est: Establishment): number => {
    const k = getPlanKey(est);
    const v = Number((est as any)?.admin_profit_value ?? 0);
    const rounded = Number.isFinite(v) ? Math.round(v) : 0;

    if (k === 'prata') return PLANO_PRATA_COBRANCA;
    if (k === 'ouro') {
      const isOuroPromo = rounded === 37 || Math.abs(v - 37.4) < 0.2;
      return isOuroPromo ? PLANO_OURO_COBRANCA_PROMO : PLANO_OURO_COBRANCA_PADRAO;
    }
    if (k === 'diamante') {
      // Diamante pode variar entre 54, 62, 69 e 77 (mapeado por valor interno e por cobrança).
      if (isCloseTo(v, 54.9) || rounded === 54 || rounded === 55) return PLANO_DIAMANTE_COBRANCA_54;
      if (isCloseTo(v, 62.9) || rounded === 62 || rounded === 63) return PLANO_DIAMANTE_COBRANCA_62;
      if (rounded === 43) return PLANO_DIAMANTE_COBRANCA_69;
      if (rounded === 51) return PLANO_DIAMANTE_COBRANCA_77;
      if (v >= 62 && v < 69) return PLANO_DIAMANTE_COBRANCA_62;
      if (v >= 54 && v < 62) return PLANO_DIAMANTE_COBRANCA_54;
      if (v >= 75) return PLANO_DIAMANTE_COBRANCA_77;
      if (v >= 69) return PLANO_DIAMANTE_COBRANCA_69;
      return PLANO_DIAMANTE_COBRANCA_77;
    }

    return Number.isFinite(v) ? v : 0;
  };
  const planAccumulatedValues = baseFilteredEstablishments.reduce(
    (acc, est) => {
      const k = getPlanKey(est);
      const billingValue = getPlanBillingValue(est);
      acc[k] += Number.isFinite(billingValue) ? billingValue : 0;
      return acc;
    },
    { prata: 0, ouro: 0, diamante: 0, outros: 0 }
  );
  const planAccumulatedTotal =
    planAccumulatedValues.prata +
    planAccumulatedValues.ouro +
    planAccumulatedValues.diamante +
    planAccumulatedValues.outros;

  const activeCount = baseFilteredEstablishments.reduce((acc, est) => acc + (isActiveEstablishment(est) ? 1 : 0), 0);
  const inactiveCount = Math.max(0, baseFilteredEstablishments.length - activeCount);

  const sortEstablishmentsForAdminGrid = (a: Establishment, b: Establishment): number => {
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
  };

  const filteredAfterPlanFilters = baseFilteredEstablishments
    .filter(est => (filterPlan === 'all' ? true : getPlanKey(est) === filterPlan))
    .filter(est => {
      if (filterActivity === 'active') return isActiveEstablishment(est);
      if (filterActivity === 'inactive') return !isActiveEstablishment(est);
      return true;
    });

  /** Não bloqueados: lista principal. Bloqueados: área separada ao final (mesma página), sem “empurrar” só pro fim da ordenação global. */
  const filteredEstablishmentsMain = filteredAfterPlanFilters
    .filter((est) => !est.is_blocked)
    .sort(sortEstablishmentsForAdminGrid);

  const filteredEstablishmentsBlocked = filteredAfterPlanFilters
    .filter((est) => Boolean(est.is_blocked))
    .sort(sortEstablishmentsForAdminGrid);

  const filteredEstablishments = [...filteredEstablishmentsMain, ...filteredEstablishmentsBlocked];

  const blockedCountInFilter = baseFilteredEstablishments.filter((e) => Boolean(e.is_blocked)).length;

  type AdminEstablishmentTableItem =
    | { kind: 'section-bloqueados'; count: number }
    | { kind: 'row'; establishment: Establishment };

  const adminEstablishmentTableItems: AdminEstablishmentTableItem[] = [
    ...filteredEstablishmentsMain.map((establishment) => ({ kind: 'row' as const, establishment })),
    ...(filteredEstablishmentsBlocked.length > 0
      ? [{ kind: 'section-bloqueados' as const, count: filteredEstablishmentsBlocked.length }]
      : []),
    ...filteredEstablishmentsBlocked.map((establishment) => ({ kind: 'row' as const, establishment })),
  ];

  const lucroPixFiltrado = filteredEstablishments.reduce((sum, est) => {
    const lucroPix = Number(lucroPixPorEstabelecimento[String(est.id)] || 0);
    const lucroCredito = Number(lucroCreditoPorEstabelecimento[String(est.id)] || 0);
    const lucroTotal =
      (Number.isFinite(lucroPix) ? lucroPix : 0) +
      (Number.isFinite(lucroCredito) ? lucroCredito : 0);
    return sum + lucroTotal;
  }, 0);

  // Filtrar estabelecimentos da lixeira (respeitando período global dos cards, quando ativo)
  const deletedRangeStart = cardsRangeStart ? startOfDay(new Date(`${cardsRangeStart}T00:00:00`)) : null;
  const deletedRangeEnd = cardsRangeEnd ? endOfDay(new Date(`${cardsRangeEnd}T00:00:00`)) : null;
  const hasDeletedRange =
    Boolean(deletedRangeStart && deletedRangeEnd) &&
    Number.isFinite(deletedRangeStart!.getTime()) &&
    Number.isFinite(deletedRangeEnd!.getTime()) &&
    deletedRangeStart!.getTime() <= deletedRangeEnd!.getTime();
  const deletedContainmentIdSet = new Set(deletedContainmentIds);
  const deletedBaseForSearch = hasDeletedRange
    ? deletedEstablishments.filter((est) => {
      const createdAt = new Date(est.created_at).getTime();
      if (!Number.isFinite(createdAt)) return false;
      return createdAt >= deletedRangeStart!.getTime() && createdAt <= deletedRangeEnd!.getTime();
    })
    : deletedEstablishments;
  const deletedNormalBase = deletedBaseForSearch.filter((est) => !deletedContainmentIdSet.has(est.id));
  const deletedContainmentBase = deletedBaseForSearch.filter((est) => deletedContainmentIdSet.has(est.id));
  const getTrashOrderTimestamp = (est: Establishment) => {
    const deletedAt = String((est as any)?.deleted_at || '').trim();
    const updatedAt = String((est as any)?.updated_at || '').trim();
    const createdAt = String(est?.created_at || '').trim();

    const deletedAtTs = deletedAt ? new Date(deletedAt).getTime() : NaN;
    if (Number.isFinite(deletedAtTs)) return deletedAtTs;

    const updatedAtTs = updatedAt ? new Date(updatedAt).getTime() : NaN;
    if (Number.isFinite(updatedAtTs)) return updatedAtTs;

    const createdAtTs = createdAt ? new Date(createdAt).getTime() : NaN;
    return Number.isFinite(createdAtTs) ? createdAtTs : 0;
  };
  const deletedSearchMatches = (establishment: Establishment) => {
    const rawTokens = String(searchTermDeleted || '')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean);

    const profitCents = valorCents((establishment as any)?.admin_profit_value);
    const isPrataAtivo = Boolean(establishment.plan_prata_active);
    const centsPrata = new Set([2750, 2790]);
    const centsOuro = 4790;
    const centsOuroPromo = 3740;
    const centsDiamante = new Set([5490, 6290, 6990, 7790]);

    const planLabel =
      (profitCents != null && centsDiamante.has(profitCents))
        ? 'diamante'
        : profitCents === centsOuro || profitCents === centsOuroPromo
          ? 'ouro'
          : (profitCents != null && centsPrata.has(profitCents)) || isPrataAtivo
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
          if (isPrataAtivo && centsPrata.has(cents)) return true;
          return false;
        }
        const t = normalizarTexto(tok);
        if (!t) return true;
        return haystack.some(h => h.includes(t));
      })
    );
  };
  const filteredDeletedEstablishments = deletedNormalBase
    .filter(deletedSearchMatches)
    .sort((a, b) => getTrashOrderTimestamp(b) - getTrashOrderTimestamp(a));
  const filteredDeletedContainmentEstablishments = deletedContainmentBase
    .filter(deletedSearchMatches)
    .sort((a, b) => getTrashOrderTimestamp(b) - getTrashOrderTimestamp(a));

  // Fonte única para métricas históricas (inclui ativos + lixeira, sem duplicar por id).
  // Isso evita "sumir" cliente novo/pago do mês quando ele é movido para lixeira depois.
  const metricsEstablishments = (() => {
    const byId = new Map<string, Establishment>();
    [...establishments, ...deletedEstablishments].forEach((est) => {
      const id = String(est?.id || '').trim();
      if (!id) return;
      if (deletedContainmentIdSet.has(id)) return;
      if (!byId.has(id)) byId.set(id, est);
    });
    return Array.from(byId.values());
  })();

  // Saldo (lucro) manual total — não inclui lixeira pois establishments já vem filtrado
  const totalAdminProfit = establishments.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  // Saldo (lucro) por mês selecionável
  const now = new Date();
  const isPaidInDateRange = (est: Establishment, rangeStart: Date, rangeEnd: Date) => {
    const paidAtTime = est.payment_paid_at ? new Date(est.payment_paid_at).getTime() : NaN;
    if (Number.isFinite(paidAtTime)) {
      return paidAtTime >= rangeStart.getTime() && paidAtTime <= rangeEnd.getTime();
    }

    // Fallback legado: quando payment_paid_at não existia/foi usado,
    // considera novo no mês com vencimento avançado (indicativo de 1º pagamento).
    const createdAt = new Date(est.created_at).getTime();
    const dueAt = est.payment_due_date ? new Date(est.payment_due_date).getTime() : NaN;
    const isCreatedInMonth =
      Number.isFinite(createdAt) &&
      createdAt >= rangeStart.getTime() &&
      createdAt <= rangeEnd.getTime();
    const hasAdvancedDueDate = Number.isFinite(dueAt) && Number.isFinite(createdAt) && dueAt > createdAt;
    return isCreatedInMonth && hasAdvancedDueDate;
  };
  const { start: saldoLucroMonthStart, end: saldoLucroMonthEndRaw } = getMonthRange(saldoLucroMonth);
  const saldoLucroMonthEnd = isSameMonthYear(saldoLucroMonth, now) ? now : saldoLucroMonthEndRaw;
  const paidInSaldoLucroMonth = metricsEstablishments.filter(est => isPaidInDateRange(est, saldoLucroMonthStart, saldoLucroMonthEnd));
  const totalAdminProfitInMonth = paidInSaldoLucroMonth.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  // Saldo do mês: soma do lucro manual apenas de quem PAGOU neste mês (do dia 1 até AGORA)
  const { start: saldoMesMonthStart, end: saldoMesMonthEndRaw } = getMonthRange(saldoMesMonth);
  const saldoMesMonthEnd = isSameMonthYear(saldoMesMonth, now) ? now : saldoMesMonthEndRaw;
  const paidInSaldoMesMonth = metricsEstablishments.filter(est => {
    return isPaidInDateRange(est, saldoMesMonthStart, saldoMesMonthEnd);
  });
  const saldoMesProfit = paidInSaldoMesMonth.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const newClientsInSaldoMesMonth = metricsEstablishments.filter(est => {
    const createdAt = new Date(est.created_at).getTime();
    if (!Number.isFinite(createdAt)) return false;
    return createdAt >= saldoMesMonthStart.getTime() && createdAt <= saldoMesMonthEnd.getTime();
  });
  const hasAdvancedDueDateFromCreation = (est: Establishment): boolean => {
    const createdAt = new Date(est.created_at).getTime();
    const dueAt = est.payment_due_date ? new Date(est.payment_due_date).getTime() : NaN;
    return Number.isFinite(createdAt) && Number.isFinite(dueAt) && dueAt > createdAt;
  };
  const wasNewClientPaidInSelectedMonth = (est: Establishment): { included: boolean; reason: string } => {
    const paidAtTime = est.payment_paid_at ? new Date(est.payment_paid_at).getTime() : NaN;
    const paidInSelectedMonth =
      Number.isFinite(paidAtTime) &&
      paidAtTime >= saldoMesMonthStart.getTime() &&
      paidAtTime <= saldoMesMonthEnd.getTime();
    if (paidInSelectedMonth) {
      return { included: true, reason: 'payment_paid_at no período' };
    }

    const hasLegacyEvidence = hasAdvancedDueDateFromCreation(est);
    if (hasLegacyEvidence) {
      // Compatibilidade: payment_paid_at pode ter sido sobrescrito por renovação.
      // Se o cliente foi criado no mês e há evidência de 1º pagamento (vencimento avançado),
      // mantemos no cálculo de "clientes novos" do mês de entrada.
      return {
        included: true,
        reason: Number.isFinite(paidAtTime)
          ? 'payment_paid_at sobrescrito por renovação; mantido por evidência de 1º pagamento'
          : 'fallback legado (vencimento avançado)',
      };
    }

    if (Number.isFinite(paidAtTime)) {
      return { included: false, reason: 'payment_paid_at fora do período e sem evidência de 1º pagamento' };
    }

    return { included: false, reason: 'sem evidência de pagamento no período' };
  };
  const newClientsAuditRows = newClientsInSaldoMesMonth.map(est => {
    const audit = wasNewClientPaidInSelectedMonth(est);
    return {
      establishment: est,
      included: audit.included,
      reason: audit.reason
    };
  });
  const paidNewClientsInSaldoMesMonth = newClientsAuditRows
    .filter(row => row.included)
    .map(row => row.establishment);
  const excludedNewClientsInSaldoMesMonth = newClientsAuditRows
    .filter(row => !row.included)
    .map(row => ({ establishment: row.establishment, reason: row.reason }));
  const paidNewClientsInSaldoMesMonthSorted = [...paidNewClientsInSaldoMesMonth].sort((a, b) => {
    const ta = a.payment_paid_at ? new Date(a.payment_paid_at).getTime() : 0;
    const tb = b.payment_paid_at ? new Date(b.payment_paid_at).getTime() : 0;
    return tb - ta;
  });
  const saldoMesClientesNovosProfit = paidNewClientsInSaldoMesMonth.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  // Clientes meus pagos por mês selecionável (renovações apenas)
  const { start: clientesMeusPagosMonthStart, end: clientesMeusPagosMonthEndRaw } = getMonthRange(clientesMeusPagosMonth);
  const clientesMeusPagosMonthEnd = isSameMonthYear(clientesMeusPagosMonth, now) ? now : clientesMeusPagosMonthEndRaw;
  const parseDateOnlyLocal = (value?: string | null): number => {
    const raw = String(value || '').trim();
    if (!raw) return NaN;
    // Corrige timezone em datas que podem vir como:
    // - "yyyy-MM-dd"
    // - "yyyy-MM-ddTHH:mm:ssZ"
    // Sempre usa somente a parte da data (YYYY-MM-DD).
    const onlyDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (onlyDate) {
      const y = Number(onlyDate[1]);
      const m = Number(onlyDate[2]) - 1;
      const d = Number(onlyDate[3]);
      return new Date(y, m, d, 12, 0, 0, 0).getTime();
    }
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : NaN;
  };
  const formatDateOnlyBR = (value?: string | null): string => {
    const t = parseDateOnlyLocal(value);
    if (!Number.isFinite(t)) return '—';
    return format(new Date(t), 'dd/MM/yyyy');
  };
  const getPaymentTimestamp = (est: Establishment): number => {
    const paidAt = est.payment_paid_at ? new Date(est.payment_paid_at).getTime() : NaN;
    if (Number.isFinite(paidAt)) return paidAt;

    // Fallback legado para registros antigos sem payment_paid_at.
    if (est.payment_status === 'paid') {
      const dueAt = parseDateOnlyLocal(est.payment_due_date);
      if (Number.isFinite(dueAt)) return dueAt;
    }

    return NaN;
  };
  const nowTs = Date.now();
  const tenDaysAgo = nowTs - (10 * 24 * 60 * 60 * 1000);
  const lastTenDaysPayments = [...metricsEstablishments]
    .filter((est) => {
      const paidAt = getPaymentTimestamp(est);
      return Number.isFinite(paidAt) && paidAt >= tenDaysAgo && paidAt <= nowTs;
    })
    .sort((a, b) => getPaymentTimestamp(b) - getPaymentTimestamp(a));
  const isAutomaticPaymentInLastDays = (est: Establishment): boolean => {
    const paymentTs = getPaymentTimestamp(est);
    const automaticInfo = automaticPaymentInfoByEstablishment[est.id];
    const automaticTs = Number(automaticInfo?.timestamp);
    if (!Number.isFinite(paymentTs) || !Number.isFinite(automaticTs)) return false;

    // Aceita pequena variação de horário entre webhook e atualização do establishment.
    const toleranceMs = 24 * 60 * 60 * 1000;
    return Math.abs(paymentTs - automaticTs) <= toleranceMs;
  };
  const getLastPaymentMethodLabel = (est: Establishment): string => {
    const automaticInfo = automaticPaymentInfoByEstablishment[est.id];
    if (!isAutomaticPaymentInLastDays(est) || !automaticInfo) {
      return 'Manual (não informado)';
    }

    const provider = String(automaticInfo.paymentProvider || '').toLowerCase();
    if (
      provider.includes('subscription') ||
      provider.includes('card') ||
      provider.includes('credit') ||
      provider.includes('credito')
    ) {
      return 'Crédito';
    }

    if (
      provider.includes('pix') ||
      provider.includes('mercadopago') ||
      provider.includes('pagarme')
    ) {
      return 'PIX';
    }

    return 'Automático';
  };
  const automaticLastTenDaysPayments = lastTenDaysPayments.filter((est) => isAutomaticPaymentInLastDays(est));
  const manualLastTenDaysPayments = lastTenDaysPayments.filter((est) => !isAutomaticPaymentInLastDays(est));
  // Usa somente a lista visível na tela (mesmo critério da tabela),
  // para não incluir lixeira/itens fora do filtro atual.
  const visibleEstablishments = metricsEstablishments;
  const renewalExpectedInClientesMeusPagosMonth = visibleEstablishments.filter(est => {
    const createdAt = new Date(est.created_at).getTime();
    if (!Number.isFinite(createdAt) || createdAt >= clientesMeusPagosMonthStart.getTime()) return false;
    if (est.plan_type !== 'monthly') return false;
    const dueAt = parseDateOnlyLocal(est.payment_due_date);
    if (!Number.isFinite(dueAt)) return false;
    // Regra pedida: somente quem vence NO mês selecionado (nem antes, nem depois).
    return dueAt >= clientesMeusPagosMonthStart.getTime() && dueAt <= clientesMeusPagosMonthEndRaw.getTime();
  });
  const paidRenewalsInClientesMeusPagosMonth = visibleEstablishments.filter(est => {
    const createdAt = new Date(est.created_at).getTime();
    if (!Number.isFinite(createdAt) || createdAt >= clientesMeusPagosMonthStart.getTime()) return false;
    if (est.plan_type !== 'monthly') return false;
    if (!est.payment_paid_at) return false;
    const paidAt = new Date(est.payment_paid_at).getTime();
    if (!Number.isFinite(paidAt)) return false;
    return paidAt >= clientesMeusPagosMonthStart.getTime() && paidAt <= clientesMeusPagosMonthEnd.getTime();
  });
  const paidRenewalsInClientesMeusPagosMonthSorted = [...paidRenewalsInClientesMeusPagosMonth].sort((a, b) => {
    const ta = a.payment_paid_at ? new Date(a.payment_paid_at).getTime() : 0;
    const tb = b.payment_paid_at ? new Date(b.payment_paid_at).getTime() : 0;
    return tb - ta;
  });
  const clientesMeusPagosMesSelected = paidRenewalsInClientesMeusPagosMonth.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const paidRenewalIdsInClientesMeusPagosMonth = new Set(paidRenewalsInClientesMeusPagosMonth.map(est => est.id));
  const renewalMissingPaymentInClientesMeusPagosMonth = renewalExpectedInClientesMeusPagosMonth.filter(
    est => !paidRenewalIdsInClientesMeusPagosMonth.has(est.id)
  );
  const renewalMissingPaymentInClientesMeusPagosMonthSorted = [...renewalMissingPaymentInClientesMeusPagosMonth].sort((a, b) => {
    const ta = parseDateOnlyLocal(a.payment_due_date);
    const tb = parseDateOnlyLocal(b.payment_due_date);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
  });
  const renewalMissingPaymentValueInClientesMeusPagosMonth = renewalMissingPaymentInClientesMeusPagosMonth.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  // Saldo do dia: soma do lucro de quem pagou no dia + quem foi criado no dia.
  // Se for "novo" e "pago" no mesmo dia, conta apenas uma vez (sem duplicar).
  // Compatibilidade: registros legados podem estar "paid" sem payment_paid_at;
  // nesse caso, se o cliente foi criado no dia e já está pago, também entra no saldo.
  const dayStart = startOfDay(saldoDiaDate);
  const dayEnd = endOfDay(saldoDiaDate);
  const paidOnDay = metricsEstablishments.filter(est => {
    const paidAt = est.payment_paid_at ? new Date(est.payment_paid_at).getTime() : NaN;
    if (Number.isFinite(paidAt)) {
      return paidAt >= dayStart.getTime() && paidAt <= dayEnd.getTime();
    }

    // Fallback legado para não "sumir" no saldo diário quando o status foi marcado
    // como pago em versões antigas sem gravar payment_paid_at.
    if (est.payment_status !== 'paid') return false;
    const createdAt = new Date(est.created_at).getTime();
    if (!Number.isFinite(createdAt)) return false;
    return createdAt >= dayStart.getTime() && createdAt <= dayEnd.getTime();
  });
  const newOnDay = metricsEstablishments.filter(est => {
    const createdAt = new Date(est.created_at).getTime();
    if (!Number.isFinite(createdAt)) return false;
    return createdAt >= dayStart.getTime() && createdAt <= dayEnd.getTime();
  });
  const saldoDiaIds = new Set<string>([
    ...paidOnDay.map((est) => est.id),
    ...newOnDay.map((est) => est.id),
  ]);
  const saldoDiaEntities = metricsEstablishments.filter((est) => saldoDiaIds.has(est.id));
  const saldoDiaProfit = paidOnDay.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const saldoDiaCombinedProfit = saldoDiaEntities.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);

  // Clientes (estabelecimentos) criados hoje (para controle rápido, sem query extra)
  const clientesDiaCount = metricsEstablishments.filter(est => {
    const t = new Date(est.created_at).getTime();
    if (!Number.isFinite(t)) return false;
    return t >= dayStart.getTime() && t <= dayEnd.getTime();
  }).length;

  const cardsRangeStartDate = cardsRangeStart ? startOfDay(new Date(`${cardsRangeStart}T00:00:00`)) : null;
  const cardsRangeEndDate = cardsRangeEnd ? endOfDay(new Date(`${cardsRangeEnd}T00:00:00`)) : null;
  const hasCardsRange =
    Boolean(cardsRangeStartDate && cardsRangeEndDate) &&
    Number.isFinite(cardsRangeStartDate!.getTime()) &&
    Number.isFinite(cardsRangeEndDate!.getTime()) &&
    cardsRangeStartDate!.getTime() <= cardsRangeEndDate!.getTime();
  const cardsRangeLabel =
    hasCardsRange && cardsRangeStartDate && cardsRangeEndDate
      ? `${format(cardsRangeStartDate, 'dd/MM/yyyy')} até ${format(cardsRangeEndDate, 'dd/MM/yyyy')}`
      : '';
  const isInCardsRange = (time: number) => {
    if (!hasCardsRange || !cardsRangeStartDate || !cardsRangeEndDate) return true;
    if (!Number.isFinite(time)) return false;
    return time >= cardsRangeStartDate.getTime() && time <= cardsRangeEndDate.getTime();
  };
  const establishmentsInCardsRange = hasCardsRange
    ? metricsEstablishments.filter((est) => {
      const createdAt = new Date(est.created_at).getTime();
      const paidAt = est.payment_paid_at ? new Date(est.payment_paid_at).getTime() : NaN;
      const dueAt = parseDateOnlyLocal(est.payment_due_date);
      return isInCardsRange(createdAt) || isInCardsRange(paidAt) || isInCardsRange(dueAt);
    })
    : metricsEstablishments;
  const deletedEstablishmentsInCardsRange = hasCardsRange
    ? deletedNormalBase.filter((est) => isInCardsRange(new Date(est.created_at).getTime()))
    : deletedNormalBase;
  const paidInCardsRange = hasCardsRange
    ? metricsEstablishments.filter((est) => {
      if (!est.payment_paid_at) return false;
      return isInCardsRange(new Date(est.payment_paid_at).getTime());
    })
    : paidInSaldoLucroMonth;
  const newInCardsRange = hasCardsRange
    ? metricsEstablishments.filter((est) => isInCardsRange(new Date(est.created_at).getTime()))
    : [];
  const paidNewInCardsRange = hasCardsRange
    ? newInCardsRange.filter((est) => {
      const paidAt = est.payment_paid_at ? new Date(est.payment_paid_at).getTime() : NaN;
      if (Number.isFinite(paidAt) && isInCardsRange(paidAt)) return true;
      return hasAdvancedDueDateFromCreation(est);
    })
    : [];
  const paidRenewalsInCardsRange = hasCardsRange && cardsRangeStartDate
    ? metricsEstablishments.filter((est) => {
      if (est.plan_type !== 'monthly') return false;
      const createdAt = new Date(est.created_at).getTime();
      if (!Number.isFinite(createdAt) || createdAt >= cardsRangeStartDate.getTime()) return false;
      if (!est.payment_paid_at) return false;
      return isInCardsRange(new Date(est.payment_paid_at).getTime());
    })
    : paidRenewalsInClientesMeusPagosMonth;
  const renewalExpectedInCardsRange = hasCardsRange && cardsRangeStartDate
    ? metricsEstablishments.filter((est) => {
      if (est.plan_type !== 'monthly') return false;
      const createdAt = new Date(est.created_at).getTime();
      if (!Number.isFinite(createdAt) || createdAt >= cardsRangeStartDate.getTime()) return false;
      const dueAt = parseDateOnlyLocal(est.payment_due_date);
      return isInCardsRange(dueAt);
    })
    : renewalExpectedInClientesMeusPagosMonth;
  const paidRenewalsInCardsRangeIds = new Set(paidRenewalsInCardsRange.map((est) => est.id));
  const renewalMissingPaymentInCardsRange = renewalExpectedInCardsRange.filter(
    (est) => !paidRenewalsInCardsRangeIds.has(est.id)
  );
  const renewalMissingPaymentValueInCardsRange = renewalMissingPaymentInCardsRange.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const saldoLucroValueDisplay = hasCardsRange
    ? paidInCardsRange.reduce((sum, est) => {
      const v = Number(est.admin_profit_value ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0)
    : totalAdminProfitInMonth;
  const saldoMesValueDisplay = hasCardsRange ? saldoLucroValueDisplay : saldoMesProfit;
  const saldoMesClientesNovosDisplay = hasCardsRange
    ? paidNewInCardsRange.reduce((sum, est) => {
      const v = Number(est.admin_profit_value ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0)
    : saldoMesClientesNovosProfit;
  const renovacoesPagasValueDisplay = hasCardsRange ? paidRenewalsInCardsRange.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0) : clientesMeusPagosMesSelected;
  const saldoPeriodoIds = new Set<string>([
    ...paidInCardsRange.map((est) => est.id),
    ...newInCardsRange.map((est) => est.id),
  ]);
  const saldoPeriodoEntities = metricsEstablishments.filter((est) => saldoPeriodoIds.has(est.id));
  const saldoPeriodoCombinedProfit = saldoPeriodoEntities.reduce((sum, est) => {
    const v = Number(est.admin_profit_value ?? 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const saldoDiaValueDisplay = hasCardsRange ? saldoPeriodoCombinedProfit : saldoDiaCombinedProfit;
  const totalEstablishmentsDisplay = hasCardsRange ? establishmentsInCardsRange.length : establishments.length;
  const clientsMonthCountDisplay = hasCardsRange ? newInCardsRange.length : clientsMonthCount;
  const pagamentosEmDiaDisplay = establishmentsInCardsRange.filter((e) => e.payment_status === 'paid').length;
  const pendentesDisplay = establishmentsInCardsRange.filter((e) => e.payment_status === 'unpaid').length;
  const vencidosDisplay = establishmentsInCardsRange.filter((e) =>
    e.payment_status === 'expired' || isExpired(e.payment_due_date)
  ).length;
  const bloqueadosDisplay = establishmentsInCardsRange.filter((e) => e.is_blocked).length;
  const lixeiraDisplay = hasCardsRange ? deletedEstablishmentsInCardsRange.length : deletedNormalBase.length;
  const setRenewalInSelectedMonth = async (establishment: Establishment, shouldInclude: boolean) => {
    const key = `renewal:${establishment.id}`;
    setIsAdjustingRenewalByEstablishment(prev => ({ ...prev, [key]: true }));
    try {
      let targetDate: Date;
      if (shouldInclude) {
        targetDate = isSameMonthYear(clientesMeusPagosMonth, now)
          ? new Date()
          : new Date(clientesMeusPagosMonthStart.getFullYear(), clientesMeusPagosMonthStart.getMonth(), 1, 12, 0, 0, 0);
      } else {
        // Remove do mês selecionado jogando a marcação para 1 minuto antes do início do mês.
        targetDate = new Date(clientesMeusPagosMonthStart.getTime() - 60 * 1000);
      }

      const { error } = await supabase
        .from('establishments')
        .update({ payment_paid_at: targetDate.toISOString() })
        .eq('id', establishment.id);

      if (error) {
        const msg = String((error as any)?.message || '');
        if (/payment_paid_at/i.test(msg) || /column/i.test(msg)) {
          toast.error('Campo payment_paid_at não existe no banco. Aplique a migration no Supabase.');
        } else {
          toast.error('Erro ao ajustar renovação do mês.');
        }
        return;
      }

      setEstablishments(prev =>
        prev.map(e => (e.id === establishment.id ? { ...e, payment_paid_at: targetDate.toISOString() } : e))
      );
      toast.success(shouldInclude ? 'Adicionado nas renovações do mês.' : 'Removido das renovações do mês.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao ajustar renovação do mês.');
    } finally {
      setIsAdjustingRenewalByEstablishment(prev => ({ ...prev, [key]: false }));
    }
  };

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
      {/* Modal: Quem está logado? + senha de 4 dígitos */}
      {showSupportNamePicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {supportNameForPin ? `Senha para ${supportNameForPin}` : 'Quem está logado?'}
            </h3>
            {!supportNameForPin ? (
              <>
                <p className="text-sm text-gray-600 mb-4">Escolha seu nome. Depois digite a senha de 4 dígitos.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUPPORT_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSupportNameForPin(name)}
                      className="py-3 px-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 font-medium text-gray-800 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">Digite a senha de 4 dígitos para este usuário.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={supportPinInput}
                  onChange={(e) => setSupportPinInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!isSubmittingSupportPin) {
                        void submitSupportPin();
                      }
                    }
                  }}
                  placeholder="****"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 text-center text-lg tracking-widest mb-4"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setSupportNameForPin(null); setSupportPinInput(''); }}
                    className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitSupportPin()}
                    disabled={isSubmittingSupportPin}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmittingSupportPin ? 'Entrando...' : 'Entrar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
              {/* Botão Novas Inscrições (só Lucas e Erlon) */}
              <button
                onClick={() => canEditEverything() && setShowNewRegistrations(true)}
                disabled={!canEditEverything()}
                className="relative flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
                title={!canEditEverything() ? 'Apenas Lucas e Erlon podem acessar' : (isAutoRefreshing ? "Atualizando automaticamente..." : "Atualiza a cada 5 segundos")}
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
                type="button"
                onClick={openTop5DetailsModal}
                className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                title="Abre detalhamento do Top 5 com até 20 posições"
              >
                <Trophy className="h-4 w-4" />
                <span>Top5</span>
              </button>

              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Eye className="h-4 w-4" />
                <span>Ver Senha de Acesso</span>
              </button>

              {/* Contas suporte ativas (máx. 5) – listar e desconectar */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSupportSessionsDropdown(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm"
                  title="Ver quantas contas suporte estão abertas e desconectar"
                >
                  <Users className="h-4 w-4" />
                  <span>Suporte</span>
                  <span className="font-semibold text-blue-600">{supportSessions.length}</span>
                  <span className="text-gray-500">/5</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSupportSessionsDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showSupportSessionsDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" aria-hidden onClick={() => setShowSupportSessionsDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-72 rounded-lg border border-gray-200 bg-white shadow-lg py-2">
                      <div className="px-3 py-1.5 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-500">Quem está logado (por nome)</p>
                      </div>
                      <ul className="max-h-60 overflow-y-auto">
                        {supportSessions.length === 0 ? (
                          <li className="px-3 py-2 text-sm text-gray-500">Ninguém ativo</li>
                        ) : (
                          supportSessions.map((s) => {
                            const isCurrentSession = s.name === getSupportSessionName();
                            return (
                              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800">
                                    {s.name}
                                    {isCurrentSession && <span className="ml-1 text-xs text-blue-600">(você)</span>}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {format(new Date(s.last_heartbeat_at), "dd/MM HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                                {canEditEverything() ? (
                                  <button
                                    type="button"
                                    onClick={() => !isCurrentSession && disconnectSupportSession(s.name)}
                                    disabled={isCurrentSession}
                                    className="shrink-0 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Desconectar
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </li>
                            );
                          })
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>

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

      {isSupportAccount && !canEditEverything() && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-sm font-medium text-amber-900">
          Somente visualização — você pode ver financeiro e clientes. Apenas Lucas e Erlon podem editar dados, datas, pagamentos e ações.
        </div>
      )}

      <div
        className="max-w-full mx-auto px-2 sm:px-4 lg:px-6 py-6"
        style={isSupportAccount && !canEditEverything() ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
      >
        {/* Lucro PIX/Crédito por mês: vendas (serviços + assinaturas), PIX R$0,50 e Crédito R$1,00 */}
        <div className="mb-6">
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl shadow-md p-6 max-w-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center">
                <DollarSign className="h-10 w-10 text-emerald-700 flex-shrink-0" />
                <div className="ml-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-emerald-800">Lucro PIX + Crédito</p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLucroPixMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="p-1 rounded hover:bg-emerald-100 text-emerald-800"
                        title="Mês anterior"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-medium text-emerald-800 min-w-[120px] capitalize">
                        {lucroPixMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setLucroPixMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        disabled={isSameMonthYear(lucroPixMonth, new Date())}
                        className="p-1 rounded hover:bg-emerald-100 text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Próximo mês"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMetaErrorsModal(true);
                          void loadMetaErrorsToday();
                        }}
                        className="ml-2 px-2 py-1 rounded border border-red-400/60 bg-red-500/15 text-red-800 hover:bg-red-500/25 text-[11px] font-bold"
                        title="Ver estabelecimentos com falhas Meta de hoje"
                      >
                        Erros Meta
                      </button>
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-900 mt-1">
                    {isLoadingLucroPixMes ? '...' : fmtBRL(lucroPixMesTotal)}
                  </p>
                  <p className="text-xs text-emerald-700/90 mt-1">
                    {isLoadingLucroPixMes
                      ? 'Carregando...'
                      : `Foram feitas ${qtdVendasPixMes + qtdVendasCreditoMes} venda(s) neste mês para você ter lucro de ${fmtBRL(lucroPixMesTotal)}`}
                  </p>
                  <p className="text-xs text-emerald-700/90 mt-0.5">
                    {isLoadingLucroPixMes
                      ? '...'
                      : `PIX: ${qtdVendasPixMes} venda(s) • ${fmtBRL(lucroPixMesDetalhe)} | Crédito: ${qtdVendasCreditoMes} venda(s) • ${fmtBRL(lucroCreditoMesDetalhe)}`}
                  </p>
                  <p className="text-xs text-emerald-700/90 mt-0.5">
                    {isLoadingLucroPixMes
                      ? '...'
                      : `PIX agend.: ${qtdPixAgendamentosMes} | PIX assin.: ${qtdPixAssinaturasMes} | Crédito agend.: ${qtdCreditoAgendamentosMes} | Crédito assin.: ${qtdCreditoAssinaturasMes}`}
                  </p>
                  <p className="text-xs text-emerald-600/90 mt-0.5">
                    Total no mês atual: {isLoadingSaldos ? '...' : fmtBRL(lucroPixFiltrado)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Estabelecimentos</p>
                <p className="text-2xl font-bold text-gray-900">{totalEstablishmentsDisplay}</p>
                {hasCardsRange && (
                  <p className="text-[11px] text-gray-500 mt-1">Período: {cardsRangeLabel}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-emerald-600" />
              <div className="ml-4 w-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-600">Saldo (lucro)</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSaldoLucroMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 rounded hover:bg-gray-100 text-gray-600"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaldoLucroMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      disabled={isSameMonthYear(saldoLucroMonth, new Date())}
                      className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1 capitalize">
                  {hasCardsRange ? `Período: ${cardsRangeLabel}` : saldoLucroMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-2xl font-bold text-gray-900">{fmtBRL(saldoLucroValueDisplay)}</p>
                <div className="text-xs text-gray-500 mt-1">
                  <span>{hasCardsRange ? paidInCardsRange.length : paidInSaldoLucroMonth.length} pago(s) • total geral {fmtBRL(totalAdminProfit)}</span>
                  <button
                    type="button"
                    onClick={() => setShowSaldoLucroInfo(prev => !prev)}
                    className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-gray-400 px-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100"
                    title="Explicação do total geral"
                  >
                    !
                  </button>
                </div>
                {showSaldoLucroInfo && (
                  <p className="text-[11px] text-gray-600 mt-1 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                    saldo com base mês passado, se ninguem cancelar esse é o saldo a receber
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-700" />
              <div className="ml-4 w-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-green-900">Saldo mês</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSaldoMesMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 rounded hover:bg-green-100 text-green-800"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaldoMesMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      disabled={isSameMonthYear(saldoMesMonth, new Date())}
                      className="p-1 rounded hover:bg-green-100 text-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-green-800/80 mt-1 capitalize">
                  {hasCardsRange ? `Período: ${cardsRangeLabel}` : saldoMesMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-2xl font-bold text-green-900">{fmtBRL(saldoMesValueDisplay)}</p>
                <p className="text-xs text-green-800/80 mt-1">
                  {hasCardsRange
                    ? `${paidInCardsRange.length} pago(s) de ${cardsRangeLabel}`
                    : `${paidInSaldoMesMonth.length} pago(s) de ${saldoMesMonthStart.toLocaleDateString('pt-BR')} até ${saldoMesMonthEnd.toLocaleDateString('pt-BR')}`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-teal-700" />
              <div className="ml-4 w-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-teal-900">Saldo mês clientes novos</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSaldoMesMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      className="p-1 rounded hover:bg-teal-100 text-teal-800"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaldoMesMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      disabled={isSameMonthYear(saldoMesMonth, new Date())}
                      className="p-1 rounded hover:bg-teal-100 text-teal-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClientesNovosHistoryModal(true)}
                      className="text-[11px] px-2 py-1 rounded border border-teal-300 text-teal-800 hover:bg-teal-100"
                      title="Ver auditoria dos clientes novos no período"
                    >
                      Histórico
                    </button>
                  </div>
                </div>
                <p className="text-xs text-teal-800/80 mt-1 capitalize">
                  {hasCardsRange ? `Período: ${cardsRangeLabel}` : saldoMesMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-2xl font-bold text-teal-900">{fmtBRL(saldoMesClientesNovosDisplay)}</p>
                <p className="text-xs text-teal-800/80 mt-1">
                  {hasCardsRange
                    ? `${paidNewInCardsRange.length} pago(s) • ${Math.max(0, newInCardsRange.length - paidNewInCardsRange.length)} fora da regra`
                    : `${paidNewClientsInSaldoMesMonth.length} pago(s) • ${excludedNewClientsInSaldoMesMonth.length} fora da regra`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-emerald-700" />
              <div className="ml-4 w-full">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-emerald-900">Renovações pagas esse mês</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setClientesMeusPagosMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                      }
                      className="p-1 rounded hover:bg-emerald-100 text-emerald-800"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setClientesMeusPagosMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                      }
                      disabled={isSameMonthYear(clientesMeusPagosMonth, new Date())}
                      className="p-1 rounded hover:bg-emerald-100 text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClientesPagosHistoryModal(true)}
                      className="text-[11px] px-2 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      title="Ver estabelecimentos incluídos neste cálculo"
                    >
                      Histórico
                    </button>
                  </div>
                </div>
                <p className="text-xs text-emerald-800/80 mt-1 capitalize">
                  {hasCardsRange ? `Período: ${cardsRangeLabel}` : clientesMeusPagosMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-2xl font-bold text-emerald-900">{fmtBRL(renovacoesPagasValueDisplay)}</p>
                <p className="text-xs text-emerald-800/80 mt-1">
                  {hasCardsRange
                    ? `${paidRenewalsInCardsRange.length} renovação(ões) • não inclui novos do período`
                    : `${paidRenewalsInClientesMeusPagosMonth.length} renovação(ões) • não inclui novos do mês selecionado`}
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  {hasCardsRange
                    ? `Faltam (vencem no período): ${fmtBRL(renewalMissingPaymentValueInCardsRange)} (${renewalMissingPaymentInCardsRange.length})`
                    : `Faltam (vencem até fim do mês): ${fmtBRL(renewalMissingPaymentValueInClientesMeusPagosMonth)} (${renewalMissingPaymentInClientesMeusPagosMonth.length})`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-emerald-700" />
              <div className="ml-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-emerald-900">{hasCardsRange ? 'Saldo do período' : 'Saldo do dia'}</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSaldoDiaDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1))}
                      className="p-1 rounded hover:bg-emerald-100 text-emerald-800"
                      title="Dia anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaldoDiaDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1))}
                      disabled={isSameDay(saldoDiaDate, new Date())}
                      className="p-1 rounded hover:bg-emerald-100 text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Próximo dia"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-emerald-800/80 mt-1">
                  {hasCardsRange ? cardsRangeLabel : (isSameDay(saldoDiaDate, new Date()) ? 'Hoje' : format(saldoDiaDate, 'dd/MM/yyyy', { locale: ptBR }))}
                </p>
                <p className="text-2xl font-bold text-emerald-900">{fmtBRL(saldoDiaValueDisplay)}</p>
                <p className="text-xs text-emerald-800/80 mt-1">
                  {hasCardsRange
                    ? `${paidInCardsRange.length} pago(s) • ${newInCardsRange.length} novo(s) • ${saldoPeriodoEntities.length} no saldo`
                    : `${paidOnDay.length} pago(s) • ${clientesDiaCount} novo(s) • ${saldoDiaEntities.length} no saldo`}
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
                  {hasCardsRange ? `Período: ${cardsRangeLabel}` : clientsMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {hasCardsRange ? clientsMonthCountDisplay : (isLoadingClientsMonth ? '...' : clientsMonthCount)}
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
                  {pagamentosEmDiaDisplay}
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
                  {pendentesDisplay}
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
                  {vencidosDisplay}
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
                  {bloqueadosDisplay}
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
                  {lixeiraDisplay}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Filtro global dos cards por período</p>
              <p className="text-xs text-gray-500">Quando preencher De/Até, todos os cards acima passam a usar apenas esse intervalo.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
              <div>
                <label className="block text-[11px] text-gray-600 mb-1">De</label>
                <input
                  type="date"
                  value={cardsRangeStart}
                  onChange={(e) => setCardsRangeStart(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-600 mb-1">Até</label>
                <input
                  type="date"
                  value={cardsRangeEnd}
                  onChange={(e) => setCardsRangeEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setCardsRangeStart('');
                  setCardsRangeEnd('');
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                Limpar período
              </button>
            </div>
          </div>
          {cardsRangeStart && cardsRangeEnd && !hasCardsRange && (
            <p className="text-xs text-red-600 mt-2">Intervalo inválido: a data final deve ser maior ou igual à inicial.</p>
          )}
          {hasCardsRange && (
            <p className="text-xs text-emerald-700 mt-2">Período ativo nos cards: <strong>{cardsRangeLabel}</strong></p>
          )}
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
                  placeholder="Buscar por nome, código, e-mail, WhatsApp, status (pago/vencido), plano (prata/ouro/diamante) ou valor (ex: 27 / 37 / 47 / 54 / 62 / 51)"
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
              <option value="all">Todos ({baseFilteredEstablishments.length})</option>
              <option value="prata">Plano Prata ({planCounts.prata})</option>
              <option value="ouro">Plano Ouro ({planCounts.ouro})</option>
              <option value="diamante">Plano Diamante ({planCounts.diamante})</option>
              <option value="outros">Outros ({planCounts.outros})</option>
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

          <div className="mt-3 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <strong>Encontrados:</strong> {filteredEstablishments.length}
            </span>
            <span>
              <strong>Prata:</strong> {planCounts.prata}
            </span>
            <span>
              <strong>Ouro:</strong> {planCounts.ouro}
            </span>
            <span>
              <strong>Diamante:</strong> {planCounts.diamante}
            </span>
            <span>
              <strong>Outros:</strong> {planCounts.outros}
            </span>
            <span className="text-rose-800">
              <strong>Bloqueados:</strong> {blockedCountInFilter}
            </span>
            <span title="Lucro do app no mês atual (PIX R$0,50 por venda e Crédito R$1,00 por venda)">
              <strong>Lucro mês atual (PIX + Crédito):</strong> {isLoadingSaldos ? '...' : fmtBRL(lucroPixFiltrado)}
            </span>
            <button
              type="button"
              onClick={() => setFilterActivity((prev) => (prev === 'active' ? 'all' : 'active'))}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 border transition-colors ${filterActivity === 'active'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              title="Ativos = último acesso nos últimos 5 dias (Nunca acessou = inativo)"
            >
              <strong>Ativos:</strong> {activeCount}
              {filterActivity === 'active' ? <span className="text-[10px] font-semibold opacity-70">(filtrando)</span> : null}
            </button>
            <button
              type="button"
              onClick={() => setFilterActivity((prev) => (prev === 'inactive' ? 'all' : 'inactive'))}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 border transition-colors ${filterActivity === 'inactive'
                ? 'bg-gray-900 border-gray-900 text-white'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              title="Inativos = nunca acessou ou ficou mais de 5 dias sem acesso"
            >
              <strong>Inativos:</strong> {inactiveCount}
              {filterActivity === 'inactive' ? <span className="text-[10px] font-semibold opacity-70">(filtrando)</span> : null}
            </button>
            <button
              type="button"
              onClick={() => setShowLastPaymentsModal(true)}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 border transition-colors bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
              title="Lista de estabelecimentos com pagamento marcado nos últimos 10 dias"
            >
              <strong>Últimos pagamentos</strong>
              <span className="text-[10px] font-semibold opacity-80">({lastTenDaysPayments.length})</span>
            </button>
          </div>
          <div className="mt-1 text-xs text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
            <span>
              <strong>Acumulado Prata:</strong> {fmtBRL(planAccumulatedValues.prata)}
            </span>
            <span>
              <strong>Acumulado Ouro:</strong> {fmtBRL(planAccumulatedValues.ouro)}
            </span>
            <span>
              <strong>Acumulado Diamante:</strong> {fmtBRL(planAccumulatedValues.diamante)}
            </span>
            <span>
              <strong>Acumulado Outros:</strong> {fmtBRL(planAccumulatedValues.outros)}
            </span>
            <span className="font-semibold text-gray-900">
              <strong>Total acumulado:</strong> {fmtBRL(planAccumulatedTotal)}
            </span>
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
                      Saldo (PIX + Crédito)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-300">
                  {adminEstablishmentTableItems.map((item) => {
                    if (item.kind === 'section-bloqueados') {
                      return (
                        <tr key="admin-section-bloqueados" className="bg-rose-200/90 border-t-4 border-rose-500">
                          <td colSpan={8} className="px-3 py-2.5 text-sm font-extrabold text-rose-950 uppercase tracking-wide">
                            Bloqueados ({item.count})
                          </td>
                        </tr>
                      );
                    }
                    const establishment = item.establishment;
                    const displayState = getDisplayPaymentState(establishment);
                    const isRowExpired = displayState === 'expired';
                    const isRowDueToday = displayState === 'due_today';
                    const isRowPaid = displayState === 'paid';
                    const rowAccent = establishment.is_blocked
                      ? 'border-l-rose-700'
                      : isRowExpired
                        ? 'border-l-red-600'
                        : isRowDueToday
                          ? 'border-l-orange-600'
                          : isRowPaid
                            ? 'border-l-emerald-600'
                            : 'border-l-amber-500';

                    // Cor de fundo por status (bem mais visível)
                    const bg = establishment.is_blocked
                      ? 'bg-rose-300'
                      : isRowExpired
                        ? 'bg-red-300'
                        : isRowDueToday
                          ? 'bg-orange-200'
                          : isRowPaid
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
                            <span className="inline-flex items-center px-2 py-1 text-[11px] font-bold rounded bg-cyan-600 text-white">
                              COBRANÇA MP
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={billingAmountInputByEstablishment[establishment.id] ?? ''}
                              onChange={(e) =>
                                setBillingAmountInputByEstablishment(prev => ({ ...prev, [establishment.id]: e.target.value }))
                              }
                              className="w-24 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
                              placeholder="79,90"
                              title="Valor da cobrança PIX desta barbearia"
                            />
                            <button
                              type="button"
                              onClick={() => saveBillingAmountByEstablishment(establishment)}
                              disabled={Boolean(isSavingBillingAmountByEstablishment[establishment.id])}
                              className="px-2 py-1 text-xs rounded border border-cyan-300 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Salvar valor da cobrança PIX"
                            >
                              {isSavingBillingAmountByEstablishment[establishment.id] ? 'Salvando...' : 'Salvar'}
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
                                displayState === 'expired' ? 'Vencido' :
                                  displayState === 'due_today' ? 'Vence hoje' :
                                    displayState === 'paid' ? 'Pago' :
                                      'Pendente'}
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
                            {(Number(qtdPixPagoPorEstabelecimento[establishment.id] || 0) + Number(qtdCreditoPagoPorEstabelecimento[establishment.id] || 0)) > 0
                              ? `${Number(qtdPixPagoPorEstabelecimento[establishment.id] || 0) + Number(qtdCreditoPagoPorEstabelecimento[establishment.id] || 0)} venda(s) PIX/Crédito`
                              : '—'}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            PIX: {Number(qtdPixPagoPorEstabelecimento[establishment.id] || 0)} | Crédito: {Number(qtdCreditoPagoPorEstabelecimento[establishment.id] || 0)}
                          </div>
                          <div className="text-[10px] text-gray-700 font-semibold" title="Lucro do app (PIX R$0,50 por venda e Crédito R$1,00 por venda)">
                            {(Number(qtdPixPagoPorEstabelecimento[establishment.id] || 0) + Number(qtdCreditoPagoPorEstabelecimento[establishment.id] || 0)) > 0
                              ? `Lucro: ${fmtBRL(Number(lucroPixPorEstabelecimento[establishment.id] || 0) + Number(lucroCreditoPorEstabelecimento[establishment.id] || 0))}`
                              : 'Lucro: —'}
                          </div>
                          <div className="text-[10px] text-gray-700">
                            PIX: {fmtBRL(Number(lucroPixPorEstabelecimento[establishment.id] || 0))} | Crédito: {fmtBRL(Number(lucroCreditoPorEstabelecimento[establishment.id] || 0))}
                          </div>
                        </td>

                        <td className="px-3 py-4 text-sm font-medium">
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => togglePaymentAlert(establishment.id, establishment.payment_alert_enabled || false)}
                              disabled={isAdminGridPaymentEmDia(establishment)}
                              className={`text-xs px-2 py-0.5 border rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed ${isAdminGridPaymentEmDia(establishment)
                                ? 'text-gray-400 border-gray-200 bg-gray-50'
                                : establishment.payment_alert_enabled
                                  ? 'text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100'
                                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              title={
                                isAdminGridPaymentEmDia(establishment)
                                  ? 'Em dia na grade: alerta indisponível (vencimento futuro ou já pago)'
                                  : establishment.payment_alert_enabled
                                    ? 'Desativar Alerta'
                                    : 'Ativar Alerta'
                              }
                            >
                              ALERTA
                            </button>
                            <button
                              onClick={() => toggleBookingBlock(establishment.id, establishment.booking_blocked || false)}
                              disabled={isAdminGridPaymentEmDia(establishment)}
                              className={`text-xs px-2 py-0.5 border rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed ${isAdminGridPaymentEmDia(establishment)
                                ? 'text-gray-400 border-gray-200 bg-gray-50'
                                : establishment.booking_blocked
                                  ? 'text-red-600 border-red-300 bg-red-50 hover:bg-red-100'
                                  : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                              title={
                                isAdminGridPaymentEmDia(establishment)
                                  ? 'Em dia na grade: bloquear PG indisponível; booking é desbloqueado automaticamente se estava travado'
                                  : establishment.booking_blocked
                                    ? 'Desbloquear PG'
                                    : 'Bloquear PG'
                              }
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

              {showLastPaymentsModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Últimos pagamentos</div>
                        <div className="text-xs text-gray-600">
                          Últimos 10 dias • ordem do mais recente para o mais antigo
                        </div>
                      </div>
                      <button
                        onClick={() => setShowLastPaymentsModal(false)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-600"
                        title="Fechar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-4 overflow-y-auto max-h-[70vh]">
                      {lastTenDaysPayments.length === 0 ? (
                        <div className="text-sm text-gray-600">
                          Nenhum estabelecimento marcado como pago nos últimos 10 dias.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 font-semibold">
                              Automáticos: {automaticLastTenDaysPayments.length}
                            </span>
                            <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 font-semibold">
                              Manuais: {manualLastTenDaysPayments.length}
                            </span>
                            {isLoadingLastPaymentsSources ? (
                              <span className="text-gray-500">Classificando origem do pagamento...</span>
                            ) : null}
                          </div>

                          {lastPaymentsSourcesWarning ? (
                            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              {lastPaymentsSourcesWarning}
                            </div>
                          ) : null}

                          <div className="rounded border border-emerald-200">
                            <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-900">
                              Pagamentos automáticos
                            </div>
                            {automaticLastTenDaysPayments.length === 0 ? (
                              <div className="px-3 py-3 text-sm text-gray-500">
                                Nenhum pagamento automático encontrado nesse período.
                              </div>
                            ) : (
                              <div className="p-2 space-y-2">
                                {automaticLastTenDaysPayments.map((est, idx) => {
                                  const paidAt = getPaymentTimestamp(est);
                                  const paidAtLabel = Number.isFinite(paidAt)
                                    ? new Date(paidAt).toLocaleString('pt-BR')
                                    : 'Sem data de pagamento';

                                  return (
                                    <div
                                      key={`last-payment-auto-${est.id}`}
                                      className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-gray-900 truncate">
                                          {idx + 1}. {est.name}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-0.5">
                                          Código: {est.code || '—'} • Plano: {est.plan_type || '—'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          Status atual: {est.payment_status === 'paid' ? 'Pago' : est.payment_status === 'expired' ? 'Vencido' : 'Pendente'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          Forma de pagamento: {getLastPaymentMethodLabel(est)}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-xs text-gray-500">Pago em</div>
                                        <div className="text-sm font-semibold text-green-700">{paidAtLabel}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="rounded border border-amber-200">
                            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-900">
                              Pagamentos manuais
                            </div>
                            {manualLastTenDaysPayments.length === 0 ? (
                              <div className="px-3 py-3 text-sm text-gray-500">
                                Nenhum pagamento manual encontrado nesse período.
                              </div>
                            ) : (
                              <div className="p-2 space-y-2">
                                {manualLastTenDaysPayments.map((est, idx) => {
                                  const paidAt = getPaymentTimestamp(est);
                                  const paidAtLabel = Number.isFinite(paidAt)
                                    ? new Date(paidAt).toLocaleString('pt-BR')
                                    : 'Sem data de pagamento';

                                  return (
                                    <div
                                      key={`last-payment-manual-${est.id}`}
                                      className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-gray-900 truncate">
                                          {idx + 1}. {est.name}
                                        </div>
                                        <div className="text-xs text-gray-600 mt-0.5">
                                          Código: {est.code || '—'} • Plano: {est.plan_type || '—'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          Status atual: {est.payment_status === 'paid' ? 'Pago' : est.payment_status === 'expired' ? 'Vencido' : 'Pendente'}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          Forma de pagamento: {getLastPaymentMethodLabel(est)}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className="text-xs text-gray-500">Pago em</div>
                                        <div className="text-sm font-semibold text-green-700">{paidAtLabel}</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Modal - Histórico de Renovações pagas esse mês */}
              {showClientesPagosHistoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Histórico - Renovações pagas esse mês</div>
                        <div className="text-xs text-gray-600">
                          Renovados de {clientesMeusPagosMonthStart.toLocaleDateString('pt-BR')} até{' '}
                          {clientesMeusPagosMonthEnd.toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowClientesPagosHistoryModal(false)}
                        className="p-2 rounded hover:bg-gray-100"
                        title="Fechar"
                      >
                        <X className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded border bg-emerald-50">
                          <div className="text-[11px] text-emerald-800">Total recebido (renovações)</div>
                          <div className="text-sm font-extrabold text-emerald-900">{fmtBRL(clientesMeusPagosMesSelected)}</div>
                        </div>
                        <div className="p-3 rounded border bg-gray-50">
                          <div className="text-[11px] text-gray-600">Quantidade de estabelecimentos</div>
                          <div className="text-sm font-extrabold text-gray-900">{paidRenewalsInClientesMeusPagosMonthSorted.length}</div>
                        </div>
                        <div className="p-3 rounded border bg-amber-50">
                          <div className="text-[11px] text-amber-800">Faltam (vencem até fim do mês)</div>
                          <div className="text-sm font-extrabold text-amber-900">
                            {fmtBRL(renewalMissingPaymentValueInClientesMeusPagosMonth)} ({renewalMissingPaymentInClientesMeusPagosMonth.length})
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="border rounded">
                          <div className="px-3 py-2 bg-emerald-50 border-b text-xs font-semibold text-emerald-900">
                            Pagaram renovação no mês
                          </div>
                          {paidRenewalsInClientesMeusPagosMonthSorted.length === 0 ? (
                            <div className="p-4 text-sm text-gray-600">Nenhuma renovação paga encontrada neste mês.</div>
                          ) : (
                            <div className="overflow-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estabelecimento</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pago em</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {paidRenewalsInClientesMeusPagosMonthSorted.map((establishment) => (
                                    <tr key={establishment.id}>
                                      <td className="px-3 py-2 text-xs text-gray-800">
                                        {establishment.name} <span className="text-gray-500">({establishment.code})</span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-700">
                                        {establishment.payment_paid_at
                                          ? new Date(establishment.payment_paid_at).toLocaleString('pt-BR')
                                          : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-xs font-bold text-gray-900">
                                        {fmtBRL(Number(establishment.admin_profit_value ?? 0))}
                                      </td>
                                      <td className="px-3 py-2 text-xs">
                                        <button
                                          type="button"
                                          onClick={() => setRenewalInSelectedMonth(establishment, false)}
                                          disabled={isAdjustingRenewalByEstablishment[`renewal:${establishment.id}`]}
                                          className="px-2 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                                        >
                                          Remover do mês
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="border rounded">
                          <div className="px-3 py-2 bg-amber-50 border-b text-xs font-semibold text-amber-900">
                            Faltam (vencem no mês)
                          </div>
                          {renewalMissingPaymentInClientesMeusPagosMonthSorted.length === 0 ? (
                            <div className="p-4 text-sm text-gray-600">Nenhum faltante neste mês.</div>
                          ) : (
                            <div className="overflow-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estabelecimento</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {renewalMissingPaymentInClientesMeusPagosMonthSorted.map((establishment) => (
                                    <tr key={`missing:${establishment.id}`}>
                                      <td className="px-3 py-2 text-xs text-gray-800">
                                        {establishment.name} <span className="text-gray-500">({establishment.code})</span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-700">
                                        {formatDateOnlyBR(establishment.payment_due_date)}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-700">{establishment.payment_status || '—'}</td>
                                      <td className="px-3 py-2 text-xs font-bold text-gray-900">
                                        {fmtBRL(Number(establishment.admin_profit_value ?? 0))}
                                      </td>
                                      <td className="px-3 py-2 text-xs">
                                        <button
                                          type="button"
                                          onClick={() => setRenewalInSelectedMonth(establishment, true)}
                                          disabled={isAdjustingRenewalByEstablishment[`renewal:${establishment.id}`]}
                                          className="px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                        >
                                          Adicionar no mês
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal - Histórico de Saldo mês clientes novos */}
              {showClientesNovosHistoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-auto">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <div>
                        <div className="text-sm font-bold text-gray-900">Histórico - Saldo mês clientes novos</div>
                        <div className="text-xs text-gray-600">
                          Período: {saldoMesMonthStart.toLocaleDateString('pt-BR')} até {saldoMesMonthEnd.toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowClientesNovosHistoryModal(false)}
                        className="p-2 rounded hover:bg-gray-100"
                        title="Fechar"
                      >
                        <X className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="p-3 rounded border bg-teal-50">
                          <div className="text-[11px] text-teal-800">Entraram no cálculo</div>
                          <div className="text-sm font-extrabold text-teal-900">{paidNewClientsInSaldoMesMonthSorted.length}</div>
                        </div>
                        <div className="p-3 rounded border bg-rose-50">
                          <div className="text-[11px] text-rose-700">Ficaram de fora</div>
                          <div className="text-sm font-extrabold text-rose-900">{excludedNewClientsInSaldoMesMonth.length}</div>
                        </div>
                        <div className="p-3 rounded border bg-gray-50">
                          <div className="text-[11px] text-gray-600">Total recebido (novos)</div>
                          <div className="text-sm font-extrabold text-gray-900">{fmtBRL(saldoMesClientesNovosProfit)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="border rounded">
                          <div className="px-3 py-2 bg-teal-50 border-b text-xs font-semibold text-teal-900">
                            Entraram no cálculo
                          </div>
                          {paidNewClientsInSaldoMesMonthSorted.length === 0 ? (
                            <div className="p-4 text-sm text-gray-600">Nenhum cliente novo entrou no cálculo neste período.</div>
                          ) : (
                            <div className="overflow-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estabelecimento</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pago em</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {paidNewClientsInSaldoMesMonthSorted.map((establishment) => (
                                    <tr key={establishment.id}>
                                      <td className="px-3 py-2 text-xs text-gray-800">
                                        {establishment.name} <span className="text-gray-500">({establishment.code})</span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-700">
                                        {establishment.payment_paid_at
                                          ? new Date(establishment.payment_paid_at).toLocaleString('pt-BR')
                                          : 'Fallback legado'}
                                      </td>
                                      <td className="px-3 py-2 text-xs font-bold text-gray-900">
                                        {fmtBRL(Number(establishment.admin_profit_value ?? 0))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="border rounded">
                          <div className="px-3 py-2 bg-rose-50 border-b text-xs font-semibold text-rose-900">
                            Ficaram de fora (com motivo)
                          </div>
                          {excludedNewClientsInSaldoMesMonth.length === 0 ? (
                            <div className="p-4 text-sm text-gray-600">Nenhum cliente novo ficou de fora neste período.</div>
                          ) : (
                            <div className="overflow-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estabelecimento</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {excludedNewClientsInSaldoMesMonth.map((row) => (
                                    <tr key={`excluded:${row.establishment.id}`}>
                                      <td className="px-3 py-2 text-xs text-gray-800">
                                        {row.establishment.name} <span className="text-gray-500">({row.establishment.code})</span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-700">{row.reason}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
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
              {(deletedEstablishments.length > 0 || hasDeletedRange) && (
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Trash2 className="h-5 w-5 text-gray-500 mr-2" />
                      Lixeira ({filteredDeletedEstablishments.length}/{deletedNormalBase.length})
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
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => moveDeletedToContainment(establishment.id)}
                                className="text-rose-600 hover:text-rose-900 text-xs px-3 py-1 border border-rose-300 rounded hover:bg-rose-50 flex items-center"
                                title="Mover para lixeira de contenção"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Lixeira
                              </button>
                              <button
                                onClick={() => restoreEstablishment(establishment.id)}
                                className="text-blue-600 hover:text-blue-900 text-xs px-3 py-1 border border-blue-300 rounded hover:bg-blue-50 flex items-center"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Restaurar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 border-t border-gray-200 pt-4">
                        <h4 className="text-sm font-semibold text-rose-800 mb-3 flex items-center">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Lixeira de contenção ({filteredDeletedContainmentEstablishments.length}/{deletedContainmentBase.length})
                        </h4>
                        {filteredDeletedContainmentEstablishments.length === 0 ? (
                          <div className="text-xs text-gray-500 bg-white border border-dashed border-gray-300 rounded-lg p-3">
                            Nenhum estabelecimento na contenção para este filtro/período.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {filteredDeletedContainmentEstablishments.map(establishment => (
                              <div key={`containment:${establishment.id}`} className="flex items-center justify-between p-3 bg-white rounded-lg border border-rose-200">
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
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => moveDeletedBackToNormalTrash(establishment.id)}
                                    className="text-gray-700 hover:text-gray-900 text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
                                    title="Voltar para lixeira normal"
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Voltar
                                  </button>
                                  <button
                                    onClick={() => restoreEstablishment(establishment.id)}
                                    className="text-blue-600 hover:text-blue-900 text-xs px-3 py-1 border border-blue-300 rounded hover:bg-blue-50 flex items-center"
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Restaurar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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

      {showTop5DetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Top 5 (detalhado no Admin)</h3>
                <p className="text-xs text-gray-600">Mesmo critério do dashboard estabelecimento (somente concluídos), com visão até 20 posições.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTop5DetailsModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(top5DetailsMonth.getFullYear(), top5DetailsMonth.getMonth() - 1, 1);
                    setTop5DetailsMonth(next);
                    void loadTop5Details(next);
                  }}
                  className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100"
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-700" />
                </button>
                <span className="text-sm font-semibold text-gray-800 min-w-[150px] text-center capitalize">
                  {top5DetailsMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(top5DetailsMonth.getFullYear(), top5DetailsMonth.getMonth() + 1, 1);
                    setTop5DetailsMonth(next);
                    void loadTop5Details(next);
                  }}
                  className="p-1.5 rounded-md border border-gray-300 hover:bg-gray-100"
                  title="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4 text-gray-700" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => void loadTop5Details(top5DetailsMonth)}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Recarregar
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-auto max-h-[62vh]">
              {isLoadingTop5Details ? (
                <div className="py-10 text-center">
                  <RefreshCw className="h-7 w-7 text-blue-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Carregando ranking detalhado...</p>
                </div>
              ) : top5DetailsRows.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-600">Sem dados de concluídos para este mês.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {top5DetailsRows.map((row, index) => (
                    <div
                      key={`${row.establishmentId}-${index}`}
                      className="rounded-lg border border-gray-200 px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          #{index + 1} • {row.establishmentName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Código: {row.establishmentCode}
                          {row.hiddenFromPublicTop5 ? ' • Oculto no TOP 5 público' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-700">{row.completedAppointments}</p>
                        <p className="text-[11px] text-gray-500">concluídos no mês</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showMetaErrorsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl border border-gray-200 max-h-[90vh] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Erros Meta</h3>
                <p className="text-xs text-gray-600">Somente erros de hoje (00:00 até agora), agrupados por estabelecimento.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadMetaErrorsToday()}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={() => setShowMetaErrorsModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  title="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-auto max-h-[72vh]">
              {isLoadingMetaErrors ? (
                <div className="py-10 text-center">
                  <RefreshCw className="h-7 w-7 text-red-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Carregando erros Meta...</p>
                </div>
              ) : metaErrorRows.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-gray-600">Nenhum erro Meta encontrado hoje.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {metaErrorRows.map((row) => (
                    <div key={row.establishmentId} className="rounded-lg border border-red-200 bg-red-50/30 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {row.establishmentName} <span className="text-gray-500">({row.establishmentCode})</span>
                          </p>
                          <p className="text-xs text-gray-700 mt-1 break-words">{row.lastCause}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-red-700">{row.totalErrors}</p>
                          <p className="text-[11px] text-gray-500">erro(s) hoje</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {row.lastErrorAt ? new Date(row.lastErrorAt).toLocaleString('pt-BR') : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                  setResetOwnerPasswordValue('');
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

                {canEditEverything() && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
                    <label className="block text-sm font-semibold text-amber-900">
                      Resetar senha do dono (Auth)
                    </label>
                    <input
                      type="text"
                      value={resetOwnerPasswordValue}
                      onChange={(e) => setResetOwnerPasswordValue(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-gray-900 bg-white"
                    />
                    <button
                      onClick={handleResetOwnerPassword}
                      disabled={isResettingOwnerPassword}
                      className="w-full px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isResettingOwnerPassword ? 'Resetando senha...' : 'Resetar senha agora'}
                    </button>
                    <p className="text-xs text-amber-800">
                      Isso altera a senha de login profissional no Supabase Auth.
                    </p>
                  </div>
                )}
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
                  setResetOwnerPasswordValue('');
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