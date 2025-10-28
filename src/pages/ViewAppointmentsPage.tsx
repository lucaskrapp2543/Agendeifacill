import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Calendar, Clock, Download, MapPin, Phone, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { PhoneLoginModal } from '../components/PhoneLoginModal';
import { SuccessBookingModal } from '../components/SuccessBookingModal';
import { getAppointmentsByPhone, supabase } from '../lib/supabase';

export default function ViewAppointmentsPage() {
  const navigate = useNavigate();
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

  // Buscar telefone salvo e carregar agendamentos automaticamente
  useEffect(() => {
    const savedPhone = localStorage.getItem('last_booking_phone');
    console.log('🔍 Telefone salvo encontrado:', savedPhone);

    if (savedPhone && savedPhone.length >= 10) {
      console.log('✅ Telefone válido encontrado, carregando agendamentos...');
      handlePhoneLogin(savedPhone);
      // Limpar o telefone após usar (opcional)
      // localStorage.removeItem('last_booking_phone');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    console.log('📞 handlePhoneLogin chamada com telefone:', phone);
    setIsLoading(true);
    try {
      const { data, error } = await getAppointmentsByPhone(phone);

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

      // Ordenar agendamentos: mais recentes primeiro (por data e horário)
      const sortedAppointments = data.sort((a: any, b: any) => {
        const dateA = new Date(`${a.appointment_date}T${a.appointment_time}`);
        const dateB = new Date(`${b.appointment_date}T${b.appointment_time}`);
        return dateB.getTime() - dateA.getTime(); // Mais recente primeiro
      });

      console.log('📊 Agendamentos ordenados:', sortedAppointments);

      setAppointments(sortedAppointments);
      setShowLoginModal(false);
      // Toast removido - não é necessário mostrar quantos agendamentos foram encontrados

      // Carregar configuração de WhatsApp do primeiro estabelecimento
      const firstAppointment = data[0];
      const establishmentName = firstAppointment.establishments?.name || firstAppointment.establishment_name;
      if (establishmentName) {
        console.log('🔍 Carregando configuração WhatsApp para estabelecimento:', establishmentName);
        await loadEstablishmentWhatsAppConfig(establishmentName);
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
      'completed': { text: 'Concluído', color: 'bg-green-100 text-green-800' },
      'cancelled': { text: 'Cancelado', color: 'bg-red-100 text-red-800' },
      'confirmed': { text: 'Confirmado', color: 'bg-blue-100 text-blue-800' },
      'pending': { text: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
    };

    const statusInfo = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    // Ir direto para o WhatsApp sem confirmação
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
      toast.error('Agendamento não encontrado');
      return;
    }

    try {
      // Buscar WhatsApp do estabelecimento
      const establishmentId = appointment.establishment_id || appointment.establishments?.id;
      const establishmentName = appointment.establishments?.name || appointment.establishment_name;

      let establishment;
      let error;

      if (establishmentId) {
        const result = await supabase
          .from('establishments')
          .select('whatsapp')
          .eq('id', establishmentId)
          .single();
        establishment = result.data;
        error = result.error;
      } else if (establishmentName) {
        const result = await supabase
          .from('establishments')
          .select('whatsapp')
          .eq('name', establishmentName)
          .single();
        establishment = result.data;
        error = result.error;
      } else {
        toast.error('ID ou nome do estabelecimento não encontrado');
        return;
      }

      if (error || !establishment?.whatsapp) {
        console.error('❌ Erro ao buscar WhatsApp:', error);
        toast.error('Configuração de WhatsApp não encontrada');
        return;
      }

      // Limpar e formatar o número do WhatsApp
      let cleanWhatsapp = establishment.whatsapp.replace(/\D/g, '');

      // Garantir que tenha código do país (55 para Brasil)
      if (cleanWhatsapp.length === 11 && !cleanWhatsapp.startsWith('55')) {
        cleanWhatsapp = '55' + cleanWhatsapp;
      } else if (cleanWhatsapp.length === 10) {
        cleanWhatsapp = '55' + cleanWhatsapp;
      } else if (cleanWhatsapp.length === 13 && cleanWhatsapp.startsWith('55')) {
        // Já tem código do país, manter
        cleanWhatsapp = cleanWhatsapp;
      } else if (cleanWhatsapp.length < 10) {
        toast.error('Número de WhatsApp inválido');
        return;
      }

      // Formatar data
      const appointmentDate = formatDate(appointment.appointment_date);

      const message = `Quero cancelar meu agendamento pelo Agendei Fácil:

*Data:* ${appointmentDate}
*Horário:* ${appointment.appointment_time}
*Serviço:* ${appointment.service_name || appointment.service || 'Não especificado'}
*Profissional:* ${appointment.professional_name || 'Não especificado'}
*Forma de Pagamento:* ${appointment.payment_method || 'Não especificada'}

Por favor, confirme o cancelamento. Obrigado!`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedMessage}`;

      console.log('📱 Abrindo WhatsApp para cancelamento:', whatsappUrl);

      window.open(whatsappUrl, '_blank');
      toast.success('Abrindo WhatsApp para cancelar agendamento...');
    } catch (error: any) {
      console.error('❌ Erro ao enviar WhatsApp:', error);
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
  const loadEstablishmentWhatsAppConfig = async (establishmentName: string) => {
    console.log('🔍 DEBUG - loadEstablishmentWhatsAppConfig chamada com:', establishmentName);

    try {
      // Primeiro tentar buscar por nome (com escape de caracteres especiais)
      let { data: establishments, error } = await supabase
        .from('establishments')
        .select('enable_whatsapp_notifications, whatsapp')
        .eq('name', establishmentName)
        .limit(1);

      let establishment = establishments?.[0];

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
      // Buscar WhatsApp do estabelecimento diretamente do banco
      const { data: establishments, error } = await supabase
        .from('establishments')
        .select('whatsapp')
        .eq('name', pendingReminderData.establishmentName)
        .limit(1);

      const establishment = establishments?.[0];

      if (error) {
        console.error('❌ Erro ao buscar WhatsApp:', error);
        toast.error('Configuração de WhatsApp não encontrada');
        return;
      }

      if (!establishment?.whatsapp) {
        toast.error('Número de WhatsApp não configurado');
        return;
      }

      // Limpar e formatar o número do WhatsApp
      let cleanWhatsapp = establishment.whatsapp.replace(/\D/g, '');

      // Garantir que tenha código do país (55 para Brasil)
      if (cleanWhatsapp.length === 11 && !cleanWhatsapp.startsWith('55')) {
        cleanWhatsapp = '55' + cleanWhatsapp;
      } else if (cleanWhatsapp.length === 10) {
        cleanWhatsapp = '55' + cleanWhatsapp;
      } else if (cleanWhatsapp.length === 13 && cleanWhatsapp.startsWith('55')) {
        // Já tem código do país, manter
        cleanWhatsapp = cleanWhatsapp;
      } else if (cleanWhatsapp.length < 10) {
        toast.error('Número de WhatsApp inválido');
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

      window.open(whatsappUrl, '_blank');

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

      // Buscar WhatsApp do estabelecimento pelo ID ou nome
      const establishmentId = appointment.establishment_id || appointment.establishments?.id;
      const establishmentName = appointment.establishments?.name || appointment.establishment_name;

      console.log('🔍 Establishment ID:', establishmentId);
      console.log('🔍 Establishment Name:', establishmentName);

      // Buscar configuração de WhatsApp do estabelecimento
      let establishment;
      let error;

      if (establishmentId) {
        console.log('🔍 Buscando por ID:', establishmentId);
        const result = await supabase
          .from('establishments')
          .select('whatsapp')
          .eq('id', establishmentId)
          .single();
        establishment = result.data;
        error = result.error;
      } else if (establishmentName) {
        console.log('🔍 Buscando por nome:', establishmentName);
        const result = await supabase
          .from('establishments')
          .select('whatsapp')
          .eq('name', establishmentName)
          .single();
        establishment = result.data;
        error = result.error;
      } else {
        toast.error('ID ou nome do estabelecimento não encontrado');
        return;
      }

      if (error || !establishment?.whatsapp) {
        console.error('❌ Erro ao buscar WhatsApp:', error);
        toast.error('Configuração de WhatsApp não encontrada');
        return;
      }

      console.log('✅ WhatsApp encontrado:', establishment.whatsapp);

      // Limpar e formatar o número do WhatsApp
      let cleanWhatsapp = establishment.whatsapp.replace(/\D/g, '');

      // Garantir que tenha código do país (55 para Brasil)
      if (cleanWhatsapp.length === 11 && !cleanWhatsapp.startsWith('55')) {
        cleanWhatsapp = '55' + cleanWhatsapp;
      } else if (cleanWhatsapp.length === 10) {
        cleanWhatsapp = '55' + cleanWhatsapp;
      } else if (cleanWhatsapp.length === 13 && cleanWhatsapp.startsWith('55')) {
        // Já tem código do país, manter
        cleanWhatsapp = cleanWhatsapp;
      } else if (cleanWhatsapp.length < 10) {
        toast.error('Número de WhatsApp inválido');
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

      window.open(whatsappUrl, '_blank');
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
          // Carregar configuração de WhatsApp do estabelecimento
          await loadEstablishmentWhatsAppConfig(parsedData.establishmentName);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Voltar</span>
            </button>
            {appointments.length > 0 && (
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors font-medium"
              >
                Desconectar
              </button>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Meus Agendamentos</h1>

          {/* Botões de Ação */}
          {appointments.length > 0 && (
            <div className="flex flex-col gap-2">
              {/* Botão Agendar Novamente */}
              <button
                onClick={handleBookAgain}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Agendar novamente
              </button>

              {/* Botão Baixar App - Só aparece se NÃO estiver no PWA */}
              {!isPWA() && (
                <button
                  onClick={handleDownloadApp}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
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
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-gray-600">Informe seu telefone para ver seus agendamentos</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Encontrado(s):</strong> {appointments.length} agendamento(s)
              </p>
            </div>

            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {appointment.service_name || appointment.service || 'Serviço não especificado'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      {appointment.establishments?.name || appointment.establishment_name || 'Estabelecimento não especificado'}
                    </p>
                  </div>
                  {getStatusBadge(appointment.status)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{formatDate(appointment.appointment_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{appointment.appointment_time}</span>
                  </div>
                  {appointment.professional_name && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="w-5 h-5 text-gray-400" />
                      <span className="text-sm">{appointment.professional_name}</span>
                    </div>
                  )}
                  {appointment.duration && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <span className="text-sm">Duração: {appointment.duration} min</span>
                    </div>
                  )}
                </div>

                {appointment.client_name && (
                  <div className="pt-4 border-t border-gray-200 mb-4">
                    <p className="text-sm text-gray-600">
                      <User className="w-4 h-4 inline mr-1" />
                      Cliente: {appointment.client_name}
                    </p>
                  </div>
                )}

                {/* Código do Estabelecimento */}
                {(appointment.establishment_code || appointment.establishments?.code) && (
                  <div className="bg-blue-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-blue-700">
                      <span className="text-sm font-medium">Código:</span>
                      <code className="text-sm bg-blue-100 px-2 py-1 rounded font-mono">
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
                    <button
                      onClick={() => handleCancelAppointment(appointment.id)}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancelar Agendamento
                    </button>
                  </div>
                )}
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
                  Para finalizar o agendamento, clique no botão Confirmar. Assim, enviaremos uma notificação para o seu barbeiro informando o serviço.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleConfirmWhatsAppFromModal}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  Confirmar
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
