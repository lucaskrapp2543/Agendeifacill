import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Calendar, Clock, CreditCard, Download, MapPin, Phone, User, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PhoneLoginModal } from '../components/PhoneLoginModal';
import { SuccessBookingModal } from '../components/SuccessBookingModal';
import { AfcoinHowItWorksModal, AfcoinUseModal } from '../components/AfcoinClientModals';
import { getAppointmentsByPhone, supabase } from '../lib/supabase';
import { CANCELLATION_SOURCE } from '../utils/appointmentCancellationMeta';
import { estadoCancelamentoParaAgendamentoCliente } from '../utils/regrasCancelamento';
import {
  AFCOIN_EARN_HINT,
  AFCOIN_REDEEM_THRESHOLD,
  buildAfcoinPhoneVariants,
  fetchAfcoinClientWallets,
  normalizeAfcoinPhone,
  syncAfcoinsFromAppointments,
} from '../utils/afcoin';
import {
  computeAfcoinBalanceByEstablishment,
  computeAfcoinBalanceFromAppointments,
  computeAfcoinPointsForAppointment,
  getAppointmentPaymentDisplay,
} from '../utils/appointmentPayment';

export default function ViewAppointmentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmedAppointments, setConfirmedAppointments] = useState<Set<string>>(new Set());

  // Estados para modal de sucesso/WhatsApp
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingReminderData, setPendingReminderData] = useState<any>(null);
  const [establishmentWhatsAppConfig, setEstablishmentWhatsAppConfig] = useState<any>(null);
  const [reminderStep, setReminderStep] = useState<'initial' | 'confirmation'>('initial');
  const [showWhatsAppConfirmationModal, setShowWhatsAppConfirmationModal] = useState(false);
  const [selectedAppointmentForWhatsApp, setSelectedAppointmentForWhatsApp] = useState<any>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  // Mantido apenas por compatibilidade (evitar 2 cliques). Agora o WhatsApp abre automaticamente após cancelar.
  const [cancelledAppointment, setCancelledAppointment] = useState<any>(null);
  const [expandedInfoByAppointment, setExpandedInfoByAppointment] = useState<Record<string, boolean>>({});
  const [appointmentHistoryById, setAppointmentHistoryById] = useState<Record<string, any[]>>({});
  const [isLoadingInfoByAppointment, setIsLoadingInfoByAppointment] = useState<Record<string, boolean>>({});
  const [afcoinRowsByEstablishment, setAfcoinRowsByEstablishment] = useState<Array<{
    establishmentId: string;
    establishmentName: string;
    balance: number;
    onlinePaymentsCount: number;
    missingToBenefit: number;
    canRedeem: boolean;
  }>>([]);
  const [isLoadingAfcoins, setIsLoadingAfcoins] = useState(false);
  const [showAfcoinHowModal, setShowAfcoinHowModal] = useState(false);
  const [showAfcoinUseModal, setShowAfcoinUseModal] = useState(false);

  /** Saldo exibido = soma lida dos agendamentos (18 local / 60 online por agendamento). */
  const displayAfcoinBalance = useMemo(
    () => computeAfcoinBalanceFromAppointments(appointments),
    [appointments]
  );

  const maxAfcoinBalancePerShop = useMemo(() => {
    const byEstablishment = computeAfcoinBalanceByEstablishment(appointments);
    let max = 0;
    byEstablishment.forEach((value) => {
      if (value > max) max = value;
    });
    return max;
  }, [appointments]);

  const bestAfcoinRedeemRow = useMemo(() => {
    const byEstablishment = computeAfcoinBalanceByEstablishment(appointments);
    let best: { establishmentId: string; establishmentName: string; balance: number } | null = null;

    appointments.forEach((appointment: any) => {
      const establishmentId = String(appointment?.establishment_id || appointment?.establishments?.id || '').trim();
      if (!establishmentId) return;
      const balance = Number(byEstablishment.get(establishmentId) || 0);
      if (balance < AFCOIN_REDEEM_THRESHOLD) return;
      const establishmentName = String(
        appointment?.establishments?.name || appointment?.establishment_name || 'Barbearia'
      ).trim();
      if (!best || balance > best.balance) {
        best = { establishmentId, establishmentName, balance };
      }
    });

    return best;
  }, [appointments]);

  const canUseAfcoinBenefit = Boolean(bestAfcoinRedeemRow);
  const missingAfcoinsToUse = Math.max(0, AFCOIN_REDEEM_THRESHOLD - maxAfcoinBalancePerShop);

  const handleUseAfcoinBenefit = () => {
    setShowAfcoinUseModal(true);
  };

  const normalizarWhatsappE164 = (raw: string): string => {
    let cleanWhatsapp = String(raw || '').replace(/\D/g, '');
    if (!cleanWhatsapp) return '';

    // Lista de códigos de países comuns (ordenado por tamanho, maior primeiro)
    const countryCodes = ['351', '244', '54', '56', '55', '34', '1'];
    const hasCountryCode = countryCodes.some((code) => cleanWhatsapp.startsWith(code));

    // Se não tiver código de país e for número brasileiro (10 ou 11 dígitos), adicionar 55
    if (!hasCountryCode) {
      if (cleanWhatsapp.length >= 10 && cleanWhatsapp.length <= 11) {
        cleanWhatsapp = '55' + cleanWhatsapp;
      } else {
        return '';
      }
    }

    return cleanWhatsapp;
  };

  const buildPhoneVariants = (raw: string): string[] => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return [];
    const withoutCountry = digits.startsWith('55') && digits.length > 2 ? digits.slice(2) : digits;
    const candidates = new Set<string>();
    const baseSet = new Set<string>([withoutCountry, digits]);
    if (withoutCountry.length === 10) baseSet.add(`${withoutCountry.slice(0, 2)}9${withoutCountry.slice(2)}`);
    if (withoutCountry.length === 11 && withoutCountry.slice(2, 3) === '9') baseSet.add(`${withoutCountry.slice(0, 2)}${withoutCountry.slice(3)}`);
    baseSet.forEach((base) => {
      const clean = String(base || '').replace(/\D/g, '');
      if (!clean) return;
      candidates.add(clean);
      if (!clean.startsWith('55')) candidates.add(`55${clean}`);
      if (clean.startsWith('55') && clean.length > 2) candidates.add(clean.slice(2));
    });
    return Array.from(candidates);
  };

  const loadAfcoinWalletsForPhone = async (rawPhone: string, rows: any[]) => {
    const phoneVariants = buildAfcoinPhoneVariants(rawPhone);
    const normalizedPhone = normalizeAfcoinPhone(rawPhone);
    if (phoneVariants.length === 0 || !normalizedPhone || !Array.isArray(rows) || rows.length === 0) {
      setAfcoinRowsByEstablishment([]);
      return;
    }

    const uniqueEstablishments = new Map<string, string>();
    rows.forEach((appointment: any) => {
      const establishmentId = String(appointment?.establishment_id || appointment?.establishments?.id || '').trim();
      if (!establishmentId) return;
      const establishmentName = String(appointment?.establishments?.name || appointment?.establishment_name || 'Barbearia').trim();
      uniqueEstablishments.set(establishmentId, establishmentName || 'Barbearia');
    });
    if (uniqueEstablishments.size === 0) {
      setAfcoinRowsByEstablishment([]);
      return;
    }

    setIsLoadingAfcoins(true);
    try {
      const establishmentIds = Array.from(uniqueEstablishments.keys());
      let walletRows = await fetchAfcoinClientWallets({ establishmentIds, phoneVariants });

      if (walletRows.length === 0) {
        const { data, error } = await supabase
          .from('afcoin_wallets')
          .select('establishment_id, balance, online_payments_count, customer_phone, updated_at')
          .in('establishment_id', establishmentIds)
          .in('customer_phone', phoneVariants)
          .order('updated_at', { ascending: false });

        if (error) {
          const msg = String((error as any)?.message || '').toLowerCase();
          const missingTable =
            msg.includes('afcoin_wallets') &&
            (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache') || msg.includes('column'));
          if (!missingTable) {
            console.warn('AFCoins: erro ao carregar carteira do cliente:', error.message, error.details);
          }
        } else if (Array.isArray(data)) {
          walletRows = data.map((w: any) => ({
            establishment_id: String(w?.establishment_id || ''),
            customer_phone: String(w?.customer_phone || ''),
            balance: Number(w?.balance || 0),
            online_payments_count: Number(w?.online_payments_count || 0),
            local_payments_count: 0,
            updated_at: w?.updated_at ? String(w.updated_at) : undefined,
          }));
        }
      }

      const perEstablishment = await Promise.all(
        Array.from(uniqueEstablishments.entries()).map(async ([establishmentId, establishmentName]) => {
          const rowsForShop = walletRows.filter((w) => String(w.establishment_id) === establishmentId);
          const row =
            rowsForShop.find((w) => normalizeAfcoinPhone(String(w?.customer_phone || '')) === normalizedPhone) ||
            rowsForShop[0] ||
            null;
          const balance = Number((row as any)?.balance || 0);
          const onlinePaymentsCount = Number((row as any)?.online_payments_count || 0);
          const safeBalance = Number.isFinite(balance) ? balance : 0;
          const missingToBenefit = Math.max(0, 1000 - safeBalance);
          const canRedeem = safeBalance >= 1000;
          return {
            establishmentId,
            establishmentName,
            balance: safeBalance,
            onlinePaymentsCount: Number.isFinite(onlinePaymentsCount) ? onlinePaymentsCount : 0,
            missingToBenefit,
            canRedeem,
          };
        })
      );

      perEstablishment.sort((a, b) => b.balance - a.balance);
      setAfcoinRowsByEstablishment(perEstablishment);
    } catch (error) {
      console.warn('AFCoins: falha inesperada ao carregar carteira do cliente:', error);
      setAfcoinRowsByEstablishment([]);
    } finally {
      setIsLoadingAfcoins(false);
    }
  };

  const obterWhatsappProfissional = (establishmentRow: any, professionalNameRaw: string | undefined | null): string => {
    const professionalName = String(professionalNameRaw || '').trim().toLowerCase();
    if (!professionalName) return '';

    const professionals = Array.isArray(establishmentRow?.professionals) ? establishmentRow.professionals : [];
    const prof = professionals.find((p: any) => {
      const n1 = String(p?.name || '').trim().toLowerCase();
      const n2 = String(p?.full_name || '').trim().toLowerCase();
      return (n1 && n1 === professionalName) || (n2 && n2 === professionalName);
    });

    return String(prof?.whatsapp || '').trim();
  };

  // Buscar telefone da URL, localStorage ou carregar agendamentos automaticamente
  useEffect(() => {
    // Prioridade 1: Telefone da URL (vindo do pagamento)
    const phoneFromUrl = searchParams.get('phone');
    const cleanPhoneFromUrl = String(phoneFromUrl || '').replace(/\D/g, '');

    // Aceitar também telefones sem DDD (alguns fluxos antigos salvam só o número)
    if (cleanPhoneFromUrl && cleanPhoneFromUrl.length >= 8) {
      console.log('✅ Telefone encontrado na URL, carregando agendamentos...');
      handlePhoneLogin(cleanPhoneFromUrl);
      // Limpar parâmetro da URL após usar
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('phone');
      navigate(`/view-appointments?${newSearchParams.toString()}`, { replace: true });
      return;
    }

    // Prioridade 2: Telefone salvo no localStorage
    const savedPhone = localStorage.getItem('last_booking_phone');
    console.log('🔍 Telefone salvo encontrado:', savedPhone);

    const cleanSavedPhone = String(savedPhone || '').replace(/\D/g, '');
    if (cleanSavedPhone && cleanSavedPhone.length >= 8) {
      console.log('✅ Telefone válido encontrado, carregando agendamentos...');
      handlePhoneLogin(cleanSavedPhone);
      // Limpar o telefone após usar (opcional)
      // localStorage.removeItem('last_booking_phone');
    }
  }, [searchParams, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listener para capturar o prompt de instalação do PWA
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handlePhoneLogin = async (phone: string) => {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    console.log('📞 handlePhoneLogin chamada com telefone:', cleanPhone);
    setIsLoading(true);
    try {
      const { data, error } = await getAppointmentsByPhone(cleanPhone);

      console.log('📊 Resultado da busca:');
      console.log('  - Data:', data);
      console.log('  - Data length:', data?.length);
      console.log('  - Error:', error);

      if (error) {
        console.error('❌ Erro ao buscar:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('⚠️ Nenhum agendamento encontrado');
        toast.error('Nenhum agendamento encontrado para este telefone');
        setShowLoginModal(false);
        return;
      }

      console.log('✅ Agendamentos encontrados:', data.length);
      console.log('  - Primeiro agendamento:', data[0]);

      const getAppointmentDateTime = (appointment: any): Date | null => {
        try {
          const [year, month, day] = String(appointment?.appointment_date || '').split('-').map(Number);
          if (!year || !month || !day) return null;

          const [hours, minutes] = String(appointment?.appointment_time || '00:00').split(':').map(Number);
          const safeHours = Number.isFinite(hours) ? hours : 0;
          const safeMinutes = Number.isFinite(minutes) ? minutes : 0;

          // Usa timezone local (evita parsing ambíguo de string)
          return new Date(year, month - 1, day, safeHours, safeMinutes, 0, 0);
        } catch {
          return null;
        }
      };

      // Ordenar agendamentos por proximidade:
      // - próximos (>= agora): do mais próximo para o mais distante
      // - passados (< agora): do mais recente para o mais antigo
      const now = new Date();
      const sortedAppointments = [...data].sort((a: any, b: any) => {
        const dateA = getAppointmentDateTime(a);
        const dateB = getAppointmentDateTime(b);

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        const isPastA = dateA.getTime() < now.getTime();
        const isPastB = dateB.getTime() < now.getTime();

        if (isPastA !== isPastB) return isPastA ? 1 : -1;

        if (!isPastA && !isPastB) {
          const diff = dateA.getTime() - dateB.getTime();
          if (diff !== 0) return diff;
        } else {
          const diff = dateB.getTime() - dateA.getTime();
          if (diff !== 0) return diff;
        }

        // Desempate: criado mais recente primeiro
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      console.log('📊 Agendamentos ordenados:', sortedAppointments);

      setAppointments(sortedAppointments);
      setShowLoginModal(false);

      // Salvar telefone no localStorage para futuras visitas
      localStorage.setItem('last_booking_phone', cleanPhone);
      await syncAfcoinsFromAppointments(sortedAppointments, cleanPhone);
      await loadAfcoinWalletsForPhone(cleanPhone, sortedAppointments);

      // Toast removido - não é necessário mostrar quantos agendamentos foram encontrados

      // Carregar configuração de WhatsApp do primeiro estabelecimento
      const firstAppointment = data[0];
      const establishmentName = firstAppointment.establishments?.name || firstAppointment.establishment_name;
      const establishmentCode = firstAppointment.establishment_code || firstAppointment.establishments?.code;
      if (establishmentName) {
        console.log('🔍 Carregando configuração WhatsApp para estabelecimento:', establishmentName);
        await loadEstablishmentWhatsAppConfig(establishmentName, establishmentCode);
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar agendamentos:', error);
      toast.error('Erro ao buscar agendamentos. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      // Converter a data string (YYYY-MM-DD) para Date usando o timezone local
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month é 0-indexed no JS
      return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: any = {
      'completed': { text: 'Concluído', color: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/25' },
      'cancelled': { text: 'Cancelado', color: 'bg-red-500/15 text-red-200 border border-red-400/25' },
      'confirmed': { text: 'Confirmado', color: 'bg-[#E6C78B]/15 text-[#E6C78B] border border-[#E6C78B]/25' },
      'pending': { text: 'Pendente', color: 'bg-amber-500/15 text-amber-200 border border-amber-400/25' },
    };

    const statusInfo = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-extrabold ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  const formatDateTimeSafe = (raw: unknown): string => {
    const value = String(raw || '').trim();
    if (!value) return 'Não informado';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    try {
      return format(parsed, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return value;
    }
  };

  const getAppointmentOriginLabel = (appointment: any): string => {
    const isInternalByFlag = Boolean(appointment?.is_establishment_booking === true);
    const isAvulsoLike = Boolean(appointment?.is_avulso) || Boolean(appointment?.is_squeeze);
    const hasClientId = String(appointment?.client_id || '').trim().length > 0;
    if (isInternalByFlag || isAvulsoLike) return 'Interno (criado pela barbearia)';
    if (hasClientId) return 'Cliente (agendamento externo)';
    return 'Origem não identificada';
  };

  const getHistoryEventLabel = (eventTypeRaw: unknown): string => {
    const key = String(eventTypeRaw || '').trim().toLowerCase();
    if (key === 'service_changed') return 'Serviço alterado';
    if (key === 'finished_early') return 'Finalizado antes do previsto';
    if (key === 'additional_service_added') return 'Serviço extra adicionado';
    if (key === 'additional_service_removed') return 'Serviço extra removido';
    if (key === 'status_changed') return 'Status alterado';
    if (key === 'subscriber_attendance_marked') return 'Atendimento de assinatura registrado';
    if (key === 'professional_transferred') return 'Profissional alterado';
    if (key === 'rescheduled') return 'Agendamento remarcado';
    return 'Atualização registrada';
  };

  const valueToFiniteNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatCurrencyMaybe = (value: unknown): string | null => {
    const n = valueToFiniteNumber(value);
    if (n === null) return null;
    return `R$ ${n.toFixed(2).replace('.', ',')}`;
  };

  const formatDurationMaybe = (value: unknown): string | null => {
    const n = valueToFiniteNumber(value);
    if (n === null) return null;
    return `${Math.round(n)} min`;
  };

  const buildReadableHistoryLines = (row: any): string[] => {
    const oldV = (row?.old_values || {}) as Record<string, any>;
    const newV = (row?.new_values || {}) as Record<string, any>;
    const meta = (row?.metadata || {}) as Record<string, any>;
    const key = String(row?.event_type || '').trim().toLowerCase();
    const lines: string[] = [];

    const oldProf = String(oldV.professional_name || oldV.professional || meta.old_professional_name || '').trim();
    const newProf = String(newV.professional_name || newV.professional || meta.new_professional_name || '').trim();
    if (oldProf || newProf) {
      if (oldProf !== newProf) lines.push(`Profissional: ${oldProf || '-'} -> ${newProf || '-'}`);
      else lines.push(`Profissional: ${newProf || oldProf}`);
    }

    const oldDate = String(oldV.appointment_date || meta.old_appointment_date || '').trim();
    const newDate = String(newV.appointment_date || meta.new_appointment_date || '').trim();
    if (oldDate || newDate) {
      if (oldDate !== newDate) lines.push(`Data: ${oldDate || '-'} -> ${newDate || '-'}`);
      else lines.push(`Data: ${newDate || oldDate}`);
    }

    const oldTime = String(oldV.appointment_time || meta.old_appointment_time || '').trim();
    const newTime = String(newV.appointment_time || meta.new_appointment_time || '').trim();
    if (oldTime || newTime) {
      if (oldTime !== newTime) lines.push(`Horário: ${oldTime || '-'} -> ${newTime || '-'}`);
      else lines.push(`Horário: ${newTime || oldTime}`);
    }

    const oldDuration = formatDurationMaybe(oldV.duration);
    const newDuration = formatDurationMaybe(newV.duration);
    if (oldDuration || newDuration) {
      if (oldDuration !== newDuration) lines.push(`Duração: ${oldDuration || '-'} -> ${newDuration || '-'}`);
      else lines.push(`Duração: ${newDuration || oldDuration}`);
    }

    const oldPrice = formatCurrencyMaybe(oldV.total_price ?? oldV.price);
    const newPrice = formatCurrencyMaybe(newV.total_price ?? newV.price);
    if (oldPrice || newPrice) {
      if (oldPrice !== newPrice) lines.push(`Valor: ${oldPrice || '-'} -> ${newPrice || '-'}`);
      else lines.push(`Valor: ${newPrice || oldPrice}`);
    }

    const oldStatus = String(oldV.status || '').trim();
    const newStatus = String(newV.status || '').trim();
    if (oldStatus || newStatus) {
      if (oldStatus !== newStatus) lines.push(`Status: ${(oldStatus || '-').toUpperCase()} -> ${(newStatus || '-').toUpperCase()}`);
      else lines.push(`Status: ${(newStatus || oldStatus).toUpperCase()}`);
    }

    if (key === 'finished_early') {
      const released = valueToFiniteNumber(meta.time_released_minutes);
      if (released !== null) lines.push(`Tempo liberado no final: ${Math.round(released)} min`);
    }

    if (lines.length === 0 && row?.description) {
      lines.push(String(row.description));
    }
    return lines;
  };

  const handleToggleAppointmentInfo = async (appointment: any) => {
    const appointmentId = String(appointment?.id || '').trim();
    if (!appointmentId) return;

    const isExpanded = Boolean(expandedInfoByAppointment[appointmentId]);
    if (isExpanded) {
      setExpandedInfoByAppointment((prev) => ({ ...prev, [appointmentId]: false }));
      return;
    }

    setExpandedInfoByAppointment((prev) => ({ ...prev, [appointmentId]: true }));
    if (appointmentHistoryById[appointmentId]) return;

    const establishmentId = String(appointment?.establishment_id || appointment?.establishments?.id || '').trim();
    if (!establishmentId) {
      setAppointmentHistoryById((prev) => ({ ...prev, [appointmentId]: [] }));
      return;
    }

    setIsLoadingInfoByAppointment((prev) => ({ ...prev, [appointmentId]: true }));
    try {
      const { data, error } = await (supabase as any)
        .from('appointment_change_logs')
        .select('id, event_type, description, changed_by_name, old_values, new_values, metadata, created_at')
        .eq('establishment_id', establishmentId)
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        const msg = String((error as any)?.message || '').toLowerCase();
        const historyTableMissing =
          msg.includes('appointment_change_logs') &&
          (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache') || msg.includes('column'));
        if (!historyTableMissing) {
          console.error('❌ Erro ao carregar histórico do agendamento:', error);
        }
        setAppointmentHistoryById((prev) => ({ ...prev, [appointmentId]: [] }));
        return;
      }

      setAppointmentHistoryById((prev) => ({
        ...prev,
        [appointmentId]: Array.isArray(data) ? data : [],
      }));
    } catch (error) {
      console.error('❌ Erro inesperado ao carregar histórico do agendamento:', error);
      setAppointmentHistoryById((prev) => ({ ...prev, [appointmentId]: [] }));
    } finally {
      setIsLoadingInfoByAppointment((prev) => ({ ...prev, [appointmentId]: false }));
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
      toast.error('Agendamento não encontrado');
      return;
    }

    const { permitido, motivo } = estadoCancelamentoParaAgendamentoCliente(
      {
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
      },
      appointment.establishments
    );

    if (!permitido) {
      toast.error(motivo || 'Cancelamento indisponível para este agendamento.');
      return;
    }

    try {
      // Buscar configuração do estabelecimento
      const establishmentId = appointment.establishment_id || appointment.establishments?.id;
      const establishmentName = appointment.establishments?.name || appointment.establishment_name;

      let establishment;
      let error;

      if (establishmentId) {
        const result = await supabase
          .from('establishments')
          .select('enable_whatsapp_notifications, whatsapp')
          .eq('id', establishmentId)
          .single();
        establishment = result.data;
        error = result.error;
      } else if (establishmentName) {
        const result = await supabase
          .from('establishments')
          .select('enable_whatsapp_notifications, whatsapp')
          .eq('name', establishmentName)
          .single();
        establishment = result.data;
        error = result.error;
      } else {
        toast.error('ID ou nome do estabelecimento não encontrado');
        return;
      }

      if (error) {
        console.error('❌ Erro ao buscar estabelecimento:', error);
        toast.error('Erro ao buscar configuração do estabelecimento');
        return;
      }

      // ✅ CORREÇÃO DO BUG: Sempre cancelar no banco ANTES de abrir WhatsApp
      // Independente da configuração enable_whatsapp_notifications
      console.log('🔄 DEBUG - Cancelando agendamento:', {
        appointmentId,
        appointmentDate: appointment.appointment_date,
        appointmentTime: appointment.appointment_time,
        currentStatus: appointment.status,
        establishmentId: appointment.establishment_id || appointment.establishments?.id
      });

      // ✅ Verificar se o agendamento existe antes de tentar atualizar
      const { data: existingAppointment, error: checkError } = await supabase
        .from('appointments')
        .select('id, status, appointment_date, appointment_time')
        .eq('id', appointmentId)
        .single();

      if (checkError) {
        console.error('❌ Erro ao verificar agendamento:', checkError);
        toast.error('Erro ao verificar agendamento');
        return;
      }

      if (!existingAppointment) {
        console.error('❌ Agendamento não encontrado no banco:', appointmentId);
        toast.error('Agendamento não encontrado');
        return;
      }

      console.log('🔍 DEBUG - Agendamento encontrado no banco:', {
        id: existingAppointment.id,
        currentStatus: existingAppointment.status,
        date: existingAppointment.appointment_date,
        time: existingAppointment.appointment_time
      });

      // ✅ Tentar cancelar direto primeiro (mais rápido)
      // Se falhar por RLS, tentar via API server-side
      console.log('🔄 Cancelando agendamento...');
      
      const cancelPayload: Record<string, unknown> = {
        status: 'cancelled',
        cancellation_source: CANCELLATION_SOURCE.CLIENT,
        cancellation_detail: 'Cancelado pelo cliente (página meus agendamentos / telefone).',
      };
      let { data: updateData, error: cancelError } = await supabase
        .from('appointments')
        .update(cancelPayload as any)
        .eq('id', appointmentId)
        .select('id, status');
      if (cancelError && String((cancelError as any).code || '') === '42703') {
        const fb = await supabase
          .from('appointments')
          .update({ status: 'cancelled' })
          .eq('id', appointmentId)
          .select('id, status');
        cancelError = fb.error;
        updateData = fb.data;
      }

      console.log('🔍 DEBUG - Resultado do cancelamento direto:', {
        hasError: !!cancelError,
        error: cancelError,
        hasData: !!updateData,
        dataLength: updateData?.length || 0,
        data: updateData
      });

      // Se falhar (provavelmente RLS), tentar via API server-side
      if (cancelError || !updateData || updateData.length === 0) {
        console.log('⚠️ Método direto falhou, tentando via API server-side...');
        console.log('   Erro:', cancelError);
        console.log('   UpdateData:', updateData);
        
        try {
          // Em produção, chamar diretamente a função Netlify
          // Em desenvolvimento, usar o redirect /api/...
          const cancelUrl = import.meta.env.PROD
            ? '/.netlify/functions/cancel-appointment'
            : '/api/cancel-appointment';
          
          const response = await fetch(cancelUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ appointmentId }),
          });

          if (response.status === 404) {
            console.error('❌ API não encontrada (404). A função ainda não foi deployada.');
            toast.error('Função de cancelamento ainda não está disponível. Aguarde alguns minutos após o deploy e tente novamente.');
            return;
          }

          const result = await response.json();

          if (!response.ok) {
            console.error('❌ Erro ao cancelar via API:', result);
            toast.error(result.error || 'Erro ao cancelar agendamento');
            return;
          }

          console.log('✅ Agendamento cancelado via API:', result);
        } catch (apiError: any) {
          console.error('❌ Erro ao chamar API:', apiError);
          toast.error('Erro ao cancelar agendamento. Tente novamente.');
          return;
        }
      } else {
        console.log('✅ Agendamento cancelado diretamente:', updateData);
      }

      // Atualizar a lista de agendamentos
      const updatedAppointments = appointments.map(apt =>
        apt.id === appointmentId ? { ...apt, status: 'cancelled' } : apt
      );
      setAppointments(updatedAppointments);

      toast.success('Agendamento cancelado com sucesso!');

      // Abrir WhatsApp com mensagem apropriada baseada na configuração
      if (establishment?.whatsapp) {
        // Limpar e formatar o número do WhatsApp
        let cleanWhatsapp = establishment.whatsapp.replace(/\D/g, '');

        // Lista de códigos de países com validação de tamanho
        const countryCodes = [
          { code: '351', minLength: 12 },
          { code: '244', minLength: 12 },
          { code: '54', minLength: 12 },
          { code: '56', minLength: 11 },
          { code: '55', minLength: 12 },
          { code: '34', minLength: 11 },
          { code: '1', minLength: 11 }
        ];
        const hasCountryCode = countryCodes.some(({ code, minLength }) =>
          cleanWhatsapp.startsWith(code) && cleanWhatsapp.length >= minLength
        );

        if (!hasCountryCode) {
          if (cleanWhatsapp.length >= 10 && cleanWhatsapp.length <= 11) {
            cleanWhatsapp = '55' + cleanWhatsapp;
          } else if (cleanWhatsapp.length < 10) {
            toast.error('Número de WhatsApp inválido');
            return;
          }
        }

        // Formatar data
        const appointmentDate = formatDate(appointment.appointment_date);

        // Mensagem diferente baseada na configuração
        let message;
        if (establishment?.enable_whatsapp_notifications) {
          // Se opção está MARCADA: mensagem pedindo confirmação
          message = `Quero cancelar meu agendamento pelo Agendei Fácil:

*Data:* ${appointmentDate}
*Horário:* ${appointment.appointment_time}
*Serviço:* ${appointment.service_name || appointment.service || 'Não especificado'}
*Profissional:* ${appointment.professional_name || 'Não especificado'}
*Forma de Pagamento:* ${appointment.payment_method || 'Não especificada'}

Por favor, confirme o cancelamento. Obrigado!`;
        } else {
          // Se opção está DESMARCADA: mensagem informando que já cancelou
          message = `Cancelei

*Data:* ${appointmentDate}
*Horário:* ${appointment.appointment_time}
*Serviço:* ${appointment.service_name || appointment.service || 'Não especificado'}
*Profissional:* ${appointment.professional_name || 'Não especificado'}
*Forma de Pagamento:* ${appointment.payment_method || 'Não especificada'}`;
        }

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedMessage}`;

        // Em mobile, usar location.href é mais confiável (evita bloqueio de popup)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          window.location.href = whatsappUrl;
        } else {
          window.open(whatsappUrl, '_blank');
        }
        toast.success('Abrindo WhatsApp...');
      } else {
        // fallback: se não tiver whatsapp, não travar o usuário
        toast('Cancelado. WhatsApp do estabelecimento não configurado.', { duration: 4000 });
      }

      // Limpar estado antigo (não usamos mais botão de confirmar)
      setCancelledAppointment(null);
    } catch (error: any) {
      console.error('❌ Erro ao processar cancelamento:', error);
      toast.error('Erro ao processar cancelamento. Tente novamente.');
    }
  };

  const handleSendCancellationMessage = async () => {
    if (!cancelledAppointment || !cancelledAppointment.establishment?.whatsapp) {
      toast.error('Configuração de WhatsApp não encontrada');
      return;
    }

    try {
      // Limpar e formatar o número do WhatsApp
      let cleanWhatsapp = cancelledAppointment.establishment.whatsapp.replace(/\D/g, '');

      // Lista de códigos de países com validação de tamanho
      const countryCodes = [
        { code: '351', minLength: 12 },
        { code: '244', minLength: 12 },
        { code: '54', minLength: 12 },
        { code: '56', minLength: 11 },
        { code: '55', minLength: 12 },
        { code: '34', minLength: 11 },
        { code: '1', minLength: 11 }
      ];
      const hasCountryCode = countryCodes.some(({ code, minLength }) =>
        cleanWhatsapp.startsWith(code) && cleanWhatsapp.length >= minLength
      );

      if (!hasCountryCode) {
        if (cleanWhatsapp.length >= 10 && cleanWhatsapp.length <= 11) {
          cleanWhatsapp = '55' + cleanWhatsapp;
        } else if (cleanWhatsapp.length < 10) {
          toast.error('Número de WhatsApp inválido');
          return;
        }
      }

      // Formatar data
      const appointmentDate = formatDate(cancelledAppointment.appointment_date);

      const message = `Quero cancelar meu agendamento pelo Agendei Fácil:

*Data:* ${appointmentDate}
*Horário:* ${cancelledAppointment.appointment_time}
*Serviço:* ${cancelledAppointment.service_name || cancelledAppointment.service || 'Não especificado'}
*Profissional:* ${cancelledAppointment.professional_name || 'Não especificado'}
*Forma de Pagamento:* ${cancelledAppointment.payment_method || 'Não especificada'}

Por favor, confirme o cancelamento. Obrigado!`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedMessage}`;

      window.open(whatsappUrl, '_blank');
      toast.success('Abrindo WhatsApp...');

      // Limpar o estado após enviar
      setCancelledAppointment(null);
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      toast.error('Erro ao abrir WhatsApp. Tente novamente.');
    }
  };

  const handleLogout = () => {
    // Limpar dados do localStorage
    localStorage.removeItem('last_booking_phone');

    // Limpar agendamentos
    setAppointments([]);

    // Mostrar modal de login novamente
    setShowLoginModal(true);

    toast.success('Desconectado com sucesso!');
  };

  // Função para detectar se já está no PWA
  const isPWA = () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSPWA = (window.navigator as any).standalone === true;
    return isStandalone || isIOSPWA;
  };

  // Função para baixar/instalar o app PWA
  const handleDownloadApp = async () => {
    // Verificar se há prompt de instalação disponível
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('App instalado com sucesso!');
          setDeferredPrompt(null);
          toast.success('App instalado com sucesso!');
          return;
        }
      } catch (error) {
        console.log('Erro no prompt nativo:', error);
      }
    }

    // Fallback: mostrar instruções manuais
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let message = '';

    if (isIOS) {
      message = 'Para instalar o app:\n\n1. Toque no botão Compartilhar (□↑)\n2. Toque em "Adicionar à Tela Inicial"\n3. Toque em "Adicionar"';
    } else if (isAndroid) {
      message = 'Para instalar o app:\n\n1. Toque nos 3 pontos (⋮)\n2. Toque em "Adicionar à tela inicial"\n3. Toque em "Adicionar"';
    } else {
      message = 'Para instalar o app:\n\n1. Clique nos 3 pontos (⋮)\n2. Clique em "Instalar Agendei Fácil"\n3. Clique em "Instalar"';
    }

    alert(message);
  };

  // Função para agendar novamente no último estabelecimento (usa código booking/XXXX)
  const handleBookAgain = () => {
    if (appointments.length === 0) {
      toast.error('Nenhum agendamento encontrado');
      return;
    }

    const lastAppointment = appointments[0];
    // Preferir código do estabelecimento; fallback para ID se necessário
    const establishmentCode = lastAppointment.establishment_code || lastAppointment.establishments?.code;
    const establishmentId = lastAppointment.establishment_id || lastAppointment.establishments?.id;

    if (establishmentCode) {
      navigate(`/booking/${establishmentCode}`);
      return;
    }

    if (establishmentId) {
      navigate(`/booking/${establishmentId}`);
      return;
    }

    toast.error('Não foi possível identificar o estabelecimento deste agendamento');
  };

  // Função para marcar um agendamento como confirmado
  const handleMarkAsConfirmed = (appointmentId: string) => {
    const newConfirmed = new Set(confirmedAppointments).add(appointmentId);
    setConfirmedAppointments(newConfirmed);

    // Salvar no localStorage
    const confirmedArray = Array.from(newConfirmed);
    localStorage.setItem('confirmed_appointments', JSON.stringify(confirmedArray));
  };

  // Carregar confirmações do localStorage ao montar o componente
  useEffect(() => {
    const savedConfirmed = localStorage.getItem('confirmed_appointments');
    if (savedConfirmed) {
      try {
        const confirmedArray = JSON.parse(savedConfirmed);
        setConfirmedAppointments(new Set(confirmedArray));
      } catch (error) {
        console.error('Erro ao carregar confirmações:', error);
      }
    }
  }, []);

  // Função para carregar configuração de WhatsApp do estabelecimento
  const loadEstablishmentWhatsAppConfig = async (establishmentName: string, establishmentCode?: string) => {
    console.log('🔍 DEBUG - loadEstablishmentWhatsAppConfig chamada com:', { establishmentName, establishmentCode });

    try {
      let establishment = null;
      let error = null;

      // PRIORITARIAMENTE: buscar por código do estabelecimento (mais confiável)
      if (establishmentCode) {
        console.log('🔍 DEBUG - Buscando por código:', establishmentCode);
        const { data: establishmentsByCode, error: errorByCode } = await supabase
          .from('establishments')
          .select('enable_whatsapp_notifications, whatsapp, skip_client_whatsapp_booking_nudge')
          .eq('code', establishmentCode)
          .limit(1);

        establishment = establishmentsByCode?.[0];
        error = errorByCode;

        console.log('🔍 DEBUG - Busca por código:');
        console.log('  - data:', establishment);
        console.log('  - error:', error);

        // Se encontrou pelo código, usar esse resultado
        if (establishment && !error) {
          const config = {
            enableWhatsAppNotifications: establishment.enable_whatsapp_notifications || false,
            whatsapp: establishment.whatsapp || '',
            skipClientWhatsappBookingNudge: Boolean((establishment as any).skip_client_whatsapp_booking_nudge),
          };
          console.log('✅ Configuração carregada pelo código:', config);
          setEstablishmentWhatsAppConfig(config);
          return;
        }
      }

      // FALLBACK: buscar por nome (caso não tenha código ou código não encontrado)
      console.log('🔍 DEBUG - Tentando buscar por nome (fallback)...');
      const { data: establishments, error: errorByName } = await supabase
        .from('establishments')
        .select('enable_whatsapp_notifications, whatsapp, skip_client_whatsapp_booking_nudge')
        .eq('name', establishmentName)
        .limit(1);

      establishment = establishments?.[0];
      error = errorByName;

      console.log('🔍 DEBUG - Primeira tentativa (por nome):');
      console.log('  - data:', establishment);
      console.log('  - error:', error);

      // Se der erro, tentar buscar por ilike (case insensitive)
      if (error) {
        console.log('🔍 DEBUG - Tentando busca com ilike...');
        const { data: establishments2, error: error2 } = await supabase
          .from('establishments')
          .select('enable_whatsapp_notifications, whatsapp, skip_client_whatsapp_booking_nudge')
          .ilike('name', establishmentName)
          .limit(1);

        establishment = establishments2?.[0];
        error = error2;

        console.log('🔍 DEBUG - Segunda tentativa (por ilike):');
        console.log('  - data:', establishment);
        console.log('  - error:', error);
      }

      if (error) {
        console.error('❌ Erro ao carregar configuração do estabelecimento:', error);
        // Configuração padrão se não conseguir carregar
        const defaultConfig = {
          enableWhatsAppNotifications: true, // Assumir que está habilitado
          whatsapp: '',
          skipClientWhatsappBookingNudge: false,
        };
        console.log('⚠️ Usando configuração padrão:', defaultConfig);
        setEstablishmentWhatsAppConfig(defaultConfig);
        return;
      }

      const config = {
        enableWhatsAppNotifications: establishment?.enable_whatsapp_notifications || false,
        whatsapp: establishment?.whatsapp || '',
        skipClientWhatsappBookingNudge: Boolean((establishment as any)?.skip_client_whatsapp_booking_nudge),
      };

      console.log('✅ Configuração carregada:', config);
      setEstablishmentWhatsAppConfig(config);
    } catch (error) {
      console.error('❌ Erro ao carregar configuração do estabelecimento:', error);
      // Configuração padrão em caso de erro
      const defaultConfig = {
        enableWhatsAppNotifications: true,
        whatsapp: '',
        skipClientWhatsappBookingNudge: false,
      };
      console.log('⚠️ Usando configuração padrão por erro:', defaultConfig);
      setEstablishmentWhatsAppConfig(defaultConfig);
    }
  };

  // Função para enviar mensagem via WhatsApp
  const handleConfirmWhatsApp = async () => {
    if (!pendingReminderData) {
      toast.error('Dados do agendamento não encontrados');
      return;
    }

    try {
      let establishment = null;

      // PRIORITARIAMENTE: buscar por código do estabelecimento (mais confiável)
      if (pendingReminderData.establishmentCode) {
        console.log('🔍 DEBUG - Buscando WhatsApp por código:', pendingReminderData.establishmentCode);
        const { data: establishmentsByCode, error: errorByCode } = await supabase
          .from('establishments')
          .select('whatsapp, professionals')
          .eq('code', pendingReminderData.establishmentCode)
          .limit(1);

        if (errorByCode) {
          console.error('❌ Erro ao buscar WhatsApp por código:', errorByCode);
        } else {
          establishment = establishmentsByCode?.[0];
        }
      }

      // FALLBACK: buscar por nome (caso não tenha código ou código não encontrado)
      if (!establishment) {
        console.log('🔍 DEBUG - Buscando WhatsApp por nome (fallback):', pendingReminderData.establishmentName);
        const { data: establishments, error } = await supabase
          .from('establishments')
          .select('whatsapp, professionals')
          .eq('name', pendingReminderData.establishmentName)
          .limit(1);

        if (error) {
          console.error('❌ Erro ao buscar WhatsApp:', error);
          toast.error('Configuração de WhatsApp não encontrada');
          return;
        }

        establishment = establishments?.[0];
      }

      // ✅ NOVA REGRA:
      // Se o profissional tiver WhatsApp cadastrado, enviar para ele.
      // Se não tiver, usar WhatsApp padrão do estabelecimento.
      const whatsappProfissional = obterWhatsappProfissional(establishment, pendingReminderData.professionalName);
      const destinoRaw = whatsappProfissional || establishment?.whatsapp || '';
      const cleanWhatsapp = normalizarWhatsappE164(destinoRaw);
      if (!cleanWhatsapp) {
        toast.error('WhatsApp do profissional/estabelecimento não está cadastrado corretamente.');
        return;
      }

      const message = `Fiz um agendamento pelo Agendei Fácil:

*Data:* ${pendingReminderData.appointmentDate}
*Horário:* ${pendingReminderData.appointmentTime}
*Serviço:* ${pendingReminderData.serviceName}
*Profissional:* ${pendingReminderData.professionalName || 'Não especificado'}
*Forma de Pagamento:* ${pendingReminderData.paymentMethod || 'Não especificada'}`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedMessage}`;

      console.log('📱 Abrindo WhatsApp do modal:', whatsappUrl);

      // Detectar se é iPhone/iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        // No iOS, usar location.href é mais confiável
        window.location.href = whatsappUrl;
      } else {
        // Em outros dispositivos, usar window.open
        window.open(whatsappUrl, '_blank');
      }

      // Fechar o modal após enviar
      setShowSuccessModal(false);
      setEstablishmentWhatsAppConfig(null);
      setPendingReminderData(null);

      // Limpar dados do localStorage para evitar que apareça novamente
      localStorage.removeItem('reminder_creation_data');
    } catch (error: any) {
      console.error('❌ Erro ao enviar WhatsApp:', error);
      toast.error('Erro ao abrir WhatsApp. Tente novamente.');
    }
  };

  // Função para enviar mensagem via WhatsApp a partir de um agendamento existente
  const handleConfirmWhatsAppForAppointment = async (appointment: any) => {
    try {
      console.log('🔍 Dados do agendamento:', appointment);

      // Buscar WhatsApp do estabelecimento pelo código, ID ou nome (prioridade: código > ID > nome)
      const establishmentCode = appointment.establishment_code || appointment.establishments?.code;
      const establishmentId = appointment.establishment_id || appointment.establishments?.id;
      const establishmentName = appointment.establishments?.name || appointment.establishment_name;

      console.log('🔍 Establishment Code:', establishmentCode);
      console.log('🔍 Establishment ID:', establishmentId);
      console.log('🔍 Establishment Name:', establishmentName);

      // Buscar configuração de WhatsApp do estabelecimento
      let establishment;
      let error;

      // PRIORITY: buscar por código (mais confiável)
      if (establishmentCode) {
        console.log('🔍 Buscando por código:', establishmentCode);
        const result = await supabase
          .from('establishments')
          .select('whatsapp, professionals')
          .eq('code', establishmentCode)
          .single();
        establishment = result.data;
        error = result.error;
      }
      // FALLBACK 1: buscar por ID
      else if (establishmentId) {
        console.log('🔍 Buscando por ID:', establishmentId);
        const result = await supabase
          .from('establishments')
          .select('whatsapp, professionals')
          .eq('id', establishmentId)
          .single();
        establishment = result.data;
        error = result.error;
      }
      // FALLBACK 2: buscar por nome
      else if (establishmentName) {
        console.log('🔍 Buscando por nome:', establishmentName);
        const result = await supabase
          .from('establishments')
          .select('whatsapp, professionals')
          .eq('name', establishmentName)
          .single();
        establishment = result.data;
        error = result.error;
      } else {
        toast.error('Código, ID ou nome do estabelecimento não encontrado');
        return;
      }

      if (error) {
        console.error('❌ Erro ao buscar WhatsApp:', error);
        toast.error('Configuração de WhatsApp não encontrada');
        return;
      }

      const whatsappProfissional = obterWhatsappProfissional(establishment, appointment.professional_name);
      const destinoRaw = whatsappProfissional || establishment?.whatsapp || '';
      const cleanWhatsapp = normalizarWhatsappE164(destinoRaw);
      if (!cleanWhatsapp) {
        toast.error('WhatsApp do profissional/estabelecimento não está cadastrado corretamente.');
        return;
      }

      // Formatar data
      const appointmentDate = formatDate(appointment.appointment_date);

      const message = `Fiz um agendamento pelo Agendei Fácil:

*Data:* ${appointmentDate}
*Horário:* ${appointment.appointment_time}
*Serviço:* ${appointment.service_name || appointment.service || 'Não especificado'}
*Profissional:* ${appointment.professional_name || 'Não especificado'}
*Forma de Pagamento:* ${appointment.payment_method || 'Não especificada'}`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedMessage}`;

      console.log('📱 Abrindo WhatsApp:', whatsappUrl);

      // Detectar se é iPhone/iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        // No iOS, usar location.href é mais confiável
        window.location.href = whatsappUrl;
      } else {
        // Em outros dispositivos, usar window.open
        window.open(whatsappUrl, '_blank');
      }

      toast.success('Abrindo WhatsApp...');
    } catch (error: any) {
      console.error('❌ Erro ao enviar WhatsApp:', error);
      toast.error('Erro ao abrir WhatsApp. Tente novamente.');
    }
  };

  // Função para mostrar popup de confirmação WhatsApp
  const handleShowWhatsAppConfirmation = (appointment: any) => {
    console.log('🔔 Abrindo popup de confirmação WhatsApp para:', appointment);
    setSelectedAppointmentForWhatsApp(appointment);
    setShowWhatsAppConfirmationModal(true);
  };

  // Função para confirmar via WhatsApp do popup
  const handleConfirmWhatsAppFromModal = () => {
    if (selectedAppointmentForWhatsApp) {
      handleConfirmWhatsAppForAppointment(selectedAppointmentForWhatsApp);
      setShowWhatsAppConfirmationModal(false);
      setSelectedAppointmentForWhatsApp(null);
    }
  };

  // Verificar se há dados pendentes de lembrete vindos do agendamento
  useEffect(() => {
    const reminderData = localStorage.getItem('reminder_creation_data');
    console.log('🔍 DEBUG - reminder_creation_data encontrado:', reminderData);

    if (reminderData) {
      try {
        const parsedData = JSON.parse(reminderData);
        console.log('🔍 DEBUG - parsedData:', parsedData);

        // SEMPRE mostrar o modal se houver dados (removendo verificação de tempo)
        console.log('✅ Dados encontrados, configurando modal...');
        setPendingReminderData(parsedData);

        // Mostrar modal de agendamento concluído
        setTimeout(async () => {
          console.log('🔍 DEBUG - Carregando configuração WhatsApp para:', parsedData.establishmentName);
          // Carregar configuração de WhatsApp do estabelecimento (usar código se disponível)
          await loadEstablishmentWhatsAppConfig(parsedData.establishmentName, parsedData.establishmentCode);
        }, 500);
      } catch (error) {
        console.error('Erro ao processar dados de lembrete:', error);
      }
    } else {
      console.log('⚠️ DEBUG - Nenhum reminder_creation_data encontrado no localStorage');
    }
  }, []);

  // DEBUG: Log dos estados para verificar o que está acontecendo
  useEffect(() => {
    console.log('🔍 DEBUG - Estados atuais:');
    console.log('  - showSuccessModal:', showSuccessModal);
    console.log('  - pendingReminderData:', pendingReminderData);
    console.log('  - establishmentWhatsAppConfig:', establishmentWhatsAppConfig);
  }, [showSuccessModal, pendingReminderData, establishmentWhatsAppConfig]);

  // Abrir modal quando a configuração de WhatsApp for carregada
  useEffect(() => {
    console.log('🔍 DEBUG - Verificando condições para abrir modal:');
    console.log('  - pendingReminderData:', pendingReminderData);
    console.log('  - establishmentWhatsAppConfig:', establishmentWhatsAppConfig);

    if (pendingReminderData && establishmentWhatsAppConfig) {
      console.log('🔍 DEBUG - Configuração WhatsApp:');
      console.log('  - enableWhatsAppNotifications:', establishmentWhatsAppConfig.enableWhatsAppNotifications);

      // SEMPRE mostrar o modal se houver dados de agendamento (independente da configuração)
      console.log('✅ Abrindo modal de WhatsApp (sempre que houver dados)');
      setShowSuccessModal(true);
    } else {
      console.log('❌ Condições não atendidas:');
      console.log('  - pendingReminderData existe:', !!pendingReminderData);
      console.log('  - establishmentWhatsAppConfig existe:', !!establishmentWhatsAppConfig);
    }
  }, [establishmentWhatsAppConfig, pendingReminderData]);

  // Funções para o modal de sucesso
  const handleActivateReminder = () => {
    setReminderStep('initial');
    setShowSuccessModal(false);
  };

  const handleDontActivate = () => {
    if (reminderStep === 'initial') {
      setReminderStep('confirmation');
    } else {
      setShowSuccessModal(false);
      // Limpar dados do localStorage para evitar que apareça novamente
      localStorage.removeItem('reminder_creation_data');
    }
  };

  return (
    <div className="app-background">
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="container-custom py-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 transition-colors shrink-0"
              style={{ color: '#A1A1A1' }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Voltar</span>
            </button>

            <div className="flex items-start gap-2 min-w-0 flex-wrap justify-end">
              {appointments.length > 0 && (
                <div
                  className="flex flex-col gap-2 px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-2xl shrink min-w-0 w-full sm:w-auto max-w-full sm:max-w-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(230,199,139,0.18) 0%, rgba(8,8,9,0.95) 55%)',
                    border: '1px solid rgba(230,199,139,0.35)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  }}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <img
                      src="/afcoin.png"
                      alt=""
                      className="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(230,199,139,0.45))' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#E6C78B]/90 truncate">
                        Seu saldo AFCoins
                      </p>
                      <p className="text-xl sm:text-2xl font-black text-white leading-none mt-0.5">
                        {isLoadingAfcoins ? '…' : displayAfcoinBalance}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAfcoinHowModal(true)}
                      className="flex-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-[0.98] hover:bg-white/10"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(230,199,139,0.28)',
                        color: '#E6C78B',
                      }}
                    >
                      Como funciona
                    </button>
                    <button
                      type="button"
                      onClick={handleUseAfcoinBenefit}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all active:scale-[0.98] ${
                        canUseAfcoinBenefit
                          ? 'hover:brightness-110'
                          : 'hover:bg-white/12'
                      }`}
                      style={
                        canUseAfcoinBenefit
                          ? {
                              background: 'linear-gradient(180deg, #E6C78B 0%, #B8944A 100%)',
                              color: '#0B0B0B',
                              boxShadow: '0 4px 16px rgba(230,199,139,0.3)',
                            }
                          : {
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              color: 'rgba(255,255,255,0.88)',
                            }
                      }
                    >
                      Usar
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-xl transition-colors font-semibold hover:bg-white/5 shrink-0"
                style={{
                  background: '#151515',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#A1A1A1'
                }}
              >
                Desconectar
              </button>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: '#E6C78B' }}>
            Meus Agendamentos
          </h1>

          {/* Botões de Ação */}
          {appointments.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* Botão Agendar Novamente */}
              <button
                onClick={handleBookAgain}
                className="px-4 py-3 rounded-xl transition-colors font-extrabold flex items-center justify-center gap-2 active:scale-[0.99]"
                style={{ background: '#E6C78B', color: '#0B0B0B' }}
              >
                <Calendar className="w-4 h-4" />
                Agendar novamente
              </button>

              {/* Botão Baixar App - Só aparece se NÃO estiver no PWA */}
              {!isPWA() && (
                <button
                  onClick={handleDownloadApp}
                  className="px-4 py-3 rounded-xl transition-colors font-semibold flex items-center justify-center gap-2 hover:bg-white/5"
                  style={{
                    background: '#151515',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#A1A1A1'
                  }}
                >
                  <Download className="w-4 h-4" />
                  Baixar app
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="container-custom py-6">
        {appointments.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              background: '#1A1A1A',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Phone className="w-8 h-8" style={{ color: '#E6C78B' }} />
            </div>
            <p style={{ color: '#A1A1A1' }}>Informe seu telefone para ver seus agendamentos</p>
          </div>
        ) : (
          <div className="space-y-4">
            {!isLoadingAfcoins && appointments.length > 0 && !canUseAfcoinBenefit && (
              <p className="text-xs text-center text-white/55 px-2">
                {maxAfcoinBalancePerShop > 0
                  ? `Faltam ${missingAfcoinsToUse} AFCoins na sua barbearia com maior saldo para liberar o botão Usar (${AFCOIN_REDEEM_THRESHOLD} por barbearia). ${AFCOIN_EARN_HINT}`
                  : AFCOIN_EARN_HINT}
              </p>
            )}

            <div
              className="rounded-2xl p-4 mb-6"
              style={{
                background: 'rgba(230,199,139,0.08)',
                border: '1px solid rgba(230,199,139,0.18)'
              }}
            >
              <p className="text-sm text-white/85">
                <strong>Encontrado(s):</strong> {appointments.length} agendamento(s)
              </p>
            </div>

            {appointments.map((appointment) => {
              const cancelEstado = estadoCancelamentoParaAgendamentoCliente(
                {
                  appointment_date: appointment.appointment_date,
                  appointment_time: appointment.appointment_time,
                },
                appointment.establishments
              );
              return (
              <div
                key={appointment.id}
                className="p-6 transition-shadow"
                style={{
                  background: '#1A1A1A',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-white mb-1">
                      {appointment.service_name || appointment.service || 'Serviço não especificado'}
                    </h3>
                    <p className="text-sm" style={{ color: '#A1A1A1' }}>
                      <MapPin className="w-4 h-4 inline mr-1" style={{ color: '#A1A1A1' }} />
                      {appointment.establishments?.name || appointment.establishment_name || 'Estabelecimento não especificado'}
                    </p>
                  </div>
                  {getStatusBadge(appointment.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" style={{ color: '#A1A1A1' }} />
                    <span className="text-sm" style={{ color: '#A1A1A1' }}>{formatDate(appointment.appointment_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" style={{ color: '#A1A1A1' }} />
                    <span className="text-sm" style={{ color: '#A1A1A1' }}>{appointment.appointment_time}</span>
                  </div>
                  {appointment.professional_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5" style={{ color: '#A1A1A1' }} />
                      <span className="text-sm" style={{ color: '#A1A1A1' }}>{appointment.professional_name}</span>
                    </div>
                  )}
                  {appointment.duration && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" style={{ color: '#A1A1A1' }} />
                      <span className="text-sm" style={{ color: '#A1A1A1' }}>Duração: {appointment.duration} min</span>
                    </div>
                  )}
                  {(() => {
                    const payment = getAppointmentPaymentDisplay(appointment);
                    const isSystemPay =
                      payment.channel === 'system_online_pix' || payment.channel === 'system_online_card';
                    return (
                      <div className="flex items-start gap-2 md:col-span-2">
                        <CreditCard
                          className="w-5 h-5 shrink-0 mt-0.5"
                          style={{ color: isSystemPay ? '#E6C78B' : '#A1A1A1' }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm" style={{ color: '#D4D4D4' }}>
                            <span style={{ color: '#A1A1A1' }}>Pagamento: </span>
                            <span
                              className="font-semibold"
                              style={{ color: isSystemPay ? '#E6C78B' : '#FFFFFF' }}
                            >
                              {payment.actualLabel}
                            </span>
                          </p>
                          {payment.showInformedPreference && payment.informedLabel !== payment.actualLabel && (
                            <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                              Preferência informada: {payment.informedLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {(() => {
                    const afcoinPoints = computeAfcoinPointsForAppointment(appointment);
                    if (afcoinPoints <= 0) return null;
                    return (
                      <div className="flex items-center gap-2 md:col-span-2">
                        <img src="/afcoin.png" alt="" className="w-5 h-5 object-contain shrink-0" />
                        <span className="text-sm font-bold" style={{ color: '#E6C78B' }}>
                          +{afcoinPoints} AFCoins neste agendamento
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => handleToggleAppointmentInfo(appointment)}
                    className="w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    style={{
                      background: 'rgba(230,199,139,0.10)',
                      border: '1px solid rgba(230,199,139,0.30)',
                      color: '#E6C78B',
                    }}
                  >
                    {expandedInfoByAppointment[appointment.id] ? '- Informações' : '+ Informações'}
                  </button>
                </div>

                {expandedInfoByAppointment[appointment.id] && (
                  <div
                    className="rounded-2xl p-4 mb-4 space-y-3"
                    style={{
                      background: '#151515',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <p className="text-sm font-extrabold" style={{ color: '#E6C78B' }}>
                      Informações detalhadas
                    </p>
                    <div className="space-y-1 text-sm" style={{ color: '#D4D4D4' }}>
                      <p><strong>Criado em:</strong> {formatDateTimeSafe(appointment.created_at)}</p>
                      <p><strong>Última atualização:</strong> {formatDateTimeSafe(appointment.updated_at)}</p>
                      <p><strong>Data agendada:</strong> {formatDate(appointment.appointment_date)}</p>
                      <p><strong>Horário agendado:</strong> {String(appointment.appointment_time || 'Não informado')}</p>
                      <p><strong>Duração:</strong> {appointment.duration ? `${appointment.duration} min` : 'Não informada'}</p>
                      <p><strong>Profissional atual:</strong> {appointment.professional_name || appointment.professional || 'Não informado'}</p>
                      <p>
                        <strong>Pagamento (sistema):</strong>{' '}
                        {getAppointmentPaymentDisplay(appointment).actualLabel}
                      </p>
                      {(() => {
                        const payment = getAppointmentPaymentDisplay(appointment);
                        if (!payment.showInformedPreference || payment.informedLabel === payment.actualLabel) {
                          return null;
                        }
                        return (
                          <p>
                            <strong>Preferência informada no agendamento:</strong> {payment.informedLabel}
                          </p>
                        );
                      })()}
                      <p><strong>Origem do agendamento:</strong> {getAppointmentOriginLabel(appointment)}</p>
                    </div>

                    <div className="pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-sm font-bold mb-2" style={{ color: '#E6C78B' }}>
                        Histórico de alterações
                      </p>

                      {isLoadingInfoByAppointment[appointment.id] ? (
                        <p className="text-sm" style={{ color: '#A1A1A1' }}>Carregando histórico...</p>
                      ) : (appointmentHistoryById[appointment.id] || []).length === 0 ? (
                        <p className="text-sm" style={{ color: '#A1A1A1' }}>
                          Não encontrei alterações registradas para este agendamento.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(appointmentHistoryById[appointment.id] || []).map((row: any) => (
                            <div
                              key={row.id}
                              className="rounded-xl p-3"
                              style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-bold text-white">
                                  {getHistoryEventLabel(row.event_type)}
                                </span>
                                <span className="text-xs" style={{ color: '#A1A1A1' }}>
                                  {formatDateTimeSafe(row.created_at)}
                                </span>
                              </div>
                              {row.changed_by_name && (
                                <p className="text-xs mb-1" style={{ color: '#A1A1A1' }}>
                                  Alterado por: {row.changed_by_name}
                                </p>
                              )}
                              {buildReadableHistoryLines(row).map((line, idx) => (
                                <p key={`${row.id}-${idx}`} className="text-xs" style={{ color: '#D4D4D4' }}>
                                  • {line}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {appointment.client_name && (
                  <div className="pt-4 mb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-sm" style={{ color: '#A1A1A1' }}>
                      <User className="w-4 h-4 inline mr-1" style={{ color: '#A1A1A1' }} />
                      Cliente: {appointment.client_name}
                    </p>
                  </div>
                )}

                {/* Código do Estabelecimento */}
                {(appointment.establishment_code || appointment.establishments?.code) && (
                  <div className="rounded-2xl p-3 mb-4" style={{ background: '#151515', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-2" style={{ color: '#A1A1A1' }}>
                      <span className="text-sm font-semibold">Código:</span>
                      <code className="text-sm px-2 py-1 rounded font-mono" style={{ background: 'rgba(230,199,139,0.10)', color: '#E6C78B' }}>
                        booking/{appointment.establishment_code || appointment.establishments?.code}
                      </code>
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    {/* Seção de Confirmação WhatsApp - Só mostra se NÃO estiver confirmado e o estabelecimento não pediu para ocultar o fluxo WhatsApp */}
                    {!confirmedAppointments.has(appointment.id) &&
                      !(appointment.establishments as any)?.skip_client_whatsapp_booking_nudge && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="text-center mb-2 sm:mb-3">
                          <p className="text-lg sm:text-xl font-bold text-green-700">
                            ⚡ Falta pouco! ⚡
                          </p>
                          <div className="flex justify-center items-center gap-1 sm:gap-2 mt-1 sm:mt-2">
                            <span className="text-green-600 text-sm sm:text-base">👇</span>
                            <span className="text-xs sm:text-sm font-semibold text-green-600">Clique abaixo</span>
                            <span className="text-green-600 text-sm sm:text-base">👇</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfirmWhatsAppForAppointment(appointment)}
                          className="w-full px-3 sm:px-4 py-3 sm:py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 font-bold text-sm sm:text-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] sm:hover:scale-[1.05] flex items-center justify-center gap-2 sm:gap-3 border-2 border-green-400 hover:border-green-500 animate-pulse"
                        >
                          <span className="text-xs sm:text-base">Confirmar agendamento</span>
                        </button>
                        <div className="text-center mt-2 sm:mt-3">
                          <p className="text-xs sm:text-sm font-semibold text-green-700 leading-tight">
                            ✅ Confirmação via WhatsApp ✅
                          </p>
                          <div className="flex justify-center items-center gap-1 mt-1">
                            <span className="text-red-500 text-xs sm:text-sm">⚠️</span>
                            <span className="text-xs text-red-600 font-bold">ATENÇÃO: Necessário!</span>
                            <span className="text-red-500 text-xs sm:text-sm">⚠️</span>
                          </div>
                        </div>

                        {/* Botão "Já confirmei" - Dentro do card verde */}
                        <button
                          onClick={() => handleMarkAsConfirmed(appointment.id)}
                          className="w-full mt-3 px-4 py-2 bg-white text-green-700 border-2 border-green-500 rounded-lg hover:bg-green-50 transition-colors font-medium"
                        >
                          ✓ Já confirmei
                        </button>
                      </div>
                    )}

                    {/* Botão de Cancelamento */}
                    {appointment.status !== 'cancelled' && (
                      <>
                        {!cancelEstado.permitido && cancelEstado.motivo ? (
                          <p
                            className="text-sm rounded-lg p-3 border"
                            style={{
                              color: '#FCD34D',
                              background: 'rgba(180,83,9,0.15)',
                              borderColor: 'rgba(245,158,11,0.35)',
                            }}
                          >
                            {cancelEstado.motivo}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleCancelAppointment(appointment.id)}
                          disabled={!cancelEstado.permitido}
                          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none transition-colors font-medium flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Cancelar Agendamento
                        </button>
                      </>
                    )}

                  </div>
                )}

                {/* Removido: 2º clique "Confirmar cancelamento". Agora abre WhatsApp automaticamente ao cancelar. */}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de sucesso/WhatsApp */}
      {console.log('🔍 DEBUG - Renderizando SuccessBookingModal:', {
        pendingReminderData: !!pendingReminderData,
        showSuccessModal,
        establishmentWhatsAppConfig: !!establishmentWhatsAppConfig
      })}
      {pendingReminderData && (
        <SuccessBookingModal
          isOpen={showSuccessModal}
          onClose={() => setShowSuccessModal(false)}
          onActivateReminder={handleActivateReminder}
          onDontActivate={handleDontActivate}
          onConfirmWhatsApp={handleConfirmWhatsApp}
          onSimpleDismiss={() => {
            setShowSuccessModal(false);
            setEstablishmentWhatsAppConfig(null);
            setPendingReminderData(null);
            localStorage.removeItem('reminder_creation_data');
            setReminderStep('initial');
          }}
          step={reminderStep}
          appointmentData={{
            serviceName: pendingReminderData.serviceName || '',
            establishmentName: pendingReminderData.establishmentName || '',
            appointmentDate: pendingReminderData.appointmentDate || '',
            appointmentTime: pendingReminderData.appointmentTime || '',
            professionalName: pendingReminderData.professionalName || ''
          }}
          enableWhatsAppNotifications={!!establishmentWhatsAppConfig?.enableWhatsAppNotifications}
          completionVariant={
            establishmentWhatsAppConfig?.skipClientWhatsappBookingNudge
              ? 'simple'
              : establishmentWhatsAppConfig?.enableWhatsAppNotifications
                ? 'whatsapp'
                : 'reminder'
          }
        />
      )}

      {/* Modal de Confirmação WhatsApp */}
      {console.log('🔍 showWhatsAppConfirmationModal:', showWhatsAppConfirmationModal)}
      {showWhatsAppConfirmationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <Phone className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Falta pouco!
                </h3>
                <p className="text-gray-600 text-lg">
                  ⚠️ <strong>IMPORTANTE:</strong> você já está confirmado. Agora clique em <strong>Avisar profissional</strong> para avisar seu profissional no WhatsApp.
                </p>
                <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm font-semibold">
                  Você já está confirmado, seu agendamento já aparece no sistema do profissional, agora clique em <strong>Avisar profissional</strong> logo abaixo e confirme para ele no WhatsApp dele!
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-center text-xs font-extrabold text-amber-700">
                  Extremamente importante
                </p>
                <button
                  onClick={handleConfirmWhatsAppFromModal}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  Avisar profissional
                </button>

                <button
                  onClick={() => {
                    setShowWhatsAppConfirmationModal(false);
                    setSelectedAppointmentForWhatsApp(null);
                  }}
                  className="w-full px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AfcoinHowItWorksModal
        isOpen={showAfcoinHowModal}
        onClose={() => setShowAfcoinHowModal(false)}
        balance={displayAfcoinBalance}
        maxPerShop={maxAfcoinBalancePerShop}
      />

      <AfcoinUseModal
        isOpen={showAfcoinUseModal}
        onClose={() => setShowAfcoinUseModal(false)}
        balance={displayAfcoinBalance}
        maxPerShop={maxAfcoinBalancePerShop}
        missing={missingAfcoinsToUse}
        canUse={canUseAfcoinBenefit}
        establishmentName={bestAfcoinRedeemRow?.establishmentName}
      />

      {/* Modal de login por telefone */}
      <PhoneLoginModal
        isOpen={showLoginModal && appointments.length === 0}
        onClose={() => {
          setShowLoginModal(false);
          if (appointments.length === 0) {
            navigate(-1);
          }
        }}
        onLogin={handlePhoneLogin}
        establishmentCode={localStorage.getItem('current_establishment_code') || undefined}
        establishmentId={localStorage.getItem('current_establishment_id') || undefined}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="text-gray-900">Buscando agendamentos...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
