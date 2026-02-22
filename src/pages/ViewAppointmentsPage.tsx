import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Calendar, Clock, Download, MapPin, Phone, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PhoneLoginModal } from '../components/PhoneLoginModal';
import { SuccessBookingModal } from '../components/SuccessBookingModal';
import { getAppointmentsByPhone, supabase } from '../lib/supabase';
import { podeCancelarAgendamento } from '../utils/regrasCancelamento';

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

  const handleCancelAppointment = async (appointmentId: string) => {
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
      toast.error('Agendamento não encontrado');
      return;
    }

    const { permitido, motivo } = podeCancelarAgendamento({
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time
    });

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
      
      const { data: updateData, error: cancelError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId)
        .select();

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
          .select('enable_whatsapp_notifications, whatsapp')
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
            whatsapp: establishment.whatsapp || ''
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
        .select('enable_whatsapp_notifications, whatsapp')
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
          .select('enable_whatsapp_notifications, whatsapp')
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
          whatsapp: ''
        };
        console.log('⚠️ Usando configuração padrão:', defaultConfig);
        setEstablishmentWhatsAppConfig(defaultConfig);
        return;
      }

      const config = {
        enableWhatsAppNotifications: establishment?.enable_whatsapp_notifications || false,
        whatsapp: establishment?.whatsapp || ''
      };

      console.log('✅ Configuração carregada:', config);
      setEstablishmentWhatsAppConfig(config);
    } catch (error) {
      console.error('❌ Erro ao carregar configuração do estabelecimento:', error);
      // Configuração padrão em caso de erro
      const defaultConfig = {
        enableWhatsAppNotifications: true,
        whatsapp: ''
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
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 transition-colors"
              style={{ color: '#A1A1A1' }}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Voltar</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm rounded-xl transition-colors font-semibold hover:bg-white/5"
              style={{
                background: '#151515',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#A1A1A1'
              }}
            >
              Desconectar
            </button>
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

            {appointments.map((appointment) => (
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
                </div>

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
                    {/* Seção de Confirmação WhatsApp - Só mostra se NÃO estiver confirmado */}
                    {!confirmedAppointments.has(appointment.id) && (
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
                      <button
                        onClick={() => handleCancelAppointment(appointment.id)}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancelar Agendamento
                      </button>
                    )}

                  </div>
                )}

                {/* Removido: 2º clique "Confirmar cancelamento". Agora abre WhatsApp automaticamente ao cancelar. */}
              </div>
            ))}
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
          step={reminderStep}
          appointmentData={{
            serviceName: pendingReminderData.serviceName || '',
            establishmentName: pendingReminderData.establishmentName || '',
            appointmentDate: pendingReminderData.appointmentDate || '',
            appointmentTime: pendingReminderData.appointmentTime || '',
            professionalName: pendingReminderData.professionalName || ''
          }}
          enableWhatsAppNotifications={true}
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
