import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, LogOut, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AppDownloadBanner } from '../components/AppDownloadBanner';
import { CancelAppointmentButton } from '../components/CancelAppointmentButton';
import { NotificationPermission } from '../components/NotificationPermission';
import { NotificationStatus } from '../components/NotificationStatus';
import { ReminderInfo } from '../components/ReminderInfo';
import { SuccessBookingModal } from '../components/SuccessBookingModal';
import { useAuth } from '../context/AuthContext';
import { useAppointmentReminders } from '../hooks/useAppointmentReminders';
import { useNotifications } from '../hooks/useNotifications';
import { cancelAppointment, getClientAppointments, supabase } from '../lib/supabase';

type Appointment = {
  id: string;
  created_at: string;
  establishment_name: string;
  service_name: string;
  service_price: number;
  appointment_date: string;
  appointment_time: string;
  professional_name?: string;
  duration?: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_method?: string;
  pix_payment_status?: string;
  pix_proof_url?: string;
};

const ClientDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { notifyNewAppointment, notifyCancelledAppointment } = useNotifications();

  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Sistema de lembretes automáticos
  const { notificationPermission } = useAppointmentReminders(appointments);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // Estados para indicador de ativação de lembrete
  const [shouldShowReminderIndicator, setShouldShowReminderIndicator] = useState(false);
  const [pendingReminderData, setPendingReminderData] = useState<any>(null);

  // Estados para modal de sucesso do agendamento (vindo do booking)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalStep, setSuccessModalStep] = useState<'initial' | 'confirmation'>('initial');
  const [establishmentWhatsAppConfig, setEstablishmentWhatsAppConfig] = useState<{
    enableWhatsAppNotifications: boolean;
    whatsapp: string;
  } | null>(null);

  // Função para carregar configuração de WhatsApp do estabelecimento
  const loadEstablishmentWhatsAppConfig = async (establishmentName: string) => {
    try {
      const { data: establishment, error } = await supabase
        .from('establishments')
        .select('enable_whatsapp_notifications, whatsapp')
        .eq('name', establishmentName)
        .single();

      if (error) {
        console.error('Erro ao carregar configuração do estabelecimento:', error);
        return;
      }

      setEstablishmentWhatsAppConfig({
        enableWhatsAppNotifications: establishment?.enable_whatsapp_notifications || false,
        whatsapp: establishment?.whatsapp || ''
      });
    } catch (error) {
      console.error('Erro ao carregar configuração do estabelecimento:', error);
    }
  };


  // Função para enviar mensagem via WhatsApp
  const handleConfirmWhatsApp = () => {
    if (!establishmentWhatsAppConfig?.whatsapp || !pendingReminderData) {
      toast.error('Configuração de WhatsApp não encontrada');
      return;
    }

    const message = `Fiz um agendamento pelo Agendei Fácil:
📅 Data: ${pendingReminderData.appointmentDate}
⏰ Horário: ${pendingReminderData.appointmentTime}
💈 Serviço: ${pendingReminderData.serviceName}
💇 Profissional: ${pendingReminderData.professionalName || 'Não especificado'}`;

    const whatsappUrl = `https://wa.me/${establishmentWhatsAppConfig.whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    // Marcar como confirmado no localStorage
    if (pendingReminderData) {
      const confirmationKey = `appointment_confirmed_${pendingReminderData.uniqueKey}`;
      localStorage.setItem(confirmationKey, 'true');
    }

    // Fechar o modal após enviar
    setShowSuccessModal(false);
    setEstablishmentWhatsAppConfig(null);
    setPendingReminderData(null);
  };

  // Função para solicitar permissão de notificação
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('🔔 Notificações ativadas! Você receberá lembretes dos seus agendamentos.');
      } else {
        toast.error('❌ Permissão de notificação negada. Você não receberá lembretes.');
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchAppointments();
    }
  }, [user]);

  useEffect(() => {
    setShowWelcomePopup(true);
  }, []);

  // Verificar se há dados pendentes de lembrete vindos do agendamento
  useEffect(() => {
    const reminderData = localStorage.getItem('reminder_creation_data');
    if (reminderData) {
      try {
        const parsedData = JSON.parse(reminderData);

        setPendingReminderData(parsedData);
        setShouldShowReminderIndicator(true);

        // Mostrar modal de agendamento concluído no dashboard
        setTimeout(async () => {
          // Carregar configuração de WhatsApp do estabelecimento
          await loadEstablishmentWhatsAppConfig(parsedData.establishmentName);

          // Verificar se já foi confirmado
          const confirmationKey = `appointment_confirmed_${parsedData.uniqueKey}`;
          const alreadyConfirmed = localStorage.getItem(confirmationKey) === 'true';

          if (!alreadyConfirmed) {
            setShowSuccessModal(true);
            setSuccessModalStep('initial');
          }
        }, 1500);

        // Remover dados após 5 minutos se não foram usados
        setTimeout(() => {
          const currentData = localStorage.getItem('reminder_creation_data');
          if (currentData === reminderData) {
            localStorage.removeItem('reminder_creation_data');
            setShouldShowReminderIndicator(false);
          }
        }, 300000); // 5 minutos
      } catch (error) {
        console.error('Erro ao processar dados de lembrete:', error);
      }
    }
  }, []);

  // Verificar sempre se há lembretes pendentes no localStorage
  useEffect(() => {
    const checkReminderData = () => {
      const reminderData = localStorage.getItem('reminder_creation_data');
      if (reminderData) {
        setShouldShowReminderIndicator(true);
      } else {
        setShouldShowReminderIndicator(false);
      }
    };

    checkReminderData();
    const interval = setInterval(checkReminderData, 1000); // Verificar a cada segundo

    return () => clearInterval(interval);
  }, []);

  // Funções para controlar o modal de sucesso do agendamento
  const handleActivateReminder = () => {
    // Primeiro, fechar o modal
    setShowSuccessModal(false);
    setSuccessModalStep('initial');

    // Se há dados pendentes, abrir o lembrete automaticamente como no botão
    if (pendingReminderData) {
      // Buscar qual appointment corresponde aos dados salvos (comparando com formato salvo)
      const matchedAppointment = appointments.find(appointment =>
        appointment.establishment_name === pendingReminderData.establishmentName &&
        appointment.appointment_time === pendingReminderData.appointmentTime
      );

      // Se encontrar o appointment, usar seus dados. Caso contrário, usar dados salvos do modal
      const appointmentData = matchedAppointment || {
        establishment_name: pendingReminderData.establishmentName,
        appointment_date: new Date().toISOString().split('T')[0], // Data de hoje como fallback
        appointment_time: pendingReminderData.appointmentTime,
        service_name: pendingReminderData.serviceName
      };

      // Executar o mesmo código que o botão azul de lembrete
      const appointmentDateTime = new Date(`${appointmentData.appointment_date}T${appointmentData.appointment_time}`);
      const reminderTime = new Date(appointmentDateTime.getTime() - (30 * 60 * 1000)); // 30 minutos antes

      const reminderTitle = `Lembrete: ${appointmentData.establishment_name}`;
      const reminderDescription = `Você tem um agendamento em ${appointmentData.establishment_name}\n\nServiço: ${appointmentData.service_name}\nProfissional: Não especificado\nHorário: ${appointmentData.appointment_time}`;

      // Criar evento no calendário
      const startDate = reminderTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const endDate = new Date(reminderTime.getTime() + (15 * 60 * 1000)).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // 15 min de duração

      const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(reminderTitle)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(reminderDescription)}&location=${encodeURIComponent(appointmentData.establishment_name)}`;

      // Abrir o calendário como no botão normal
      window.open(calendarUrl, '_blank');

      toast('Lembrete criado! Abrindo calendário...', 'success');

      // Limpar dados pendentes
      setShouldShowReminderIndicator(false);
      localStorage.removeItem('reminder_creation_data');
      setPendingReminderData(null);
    }
  };

  const handleDontActivateFirst = () => {
    // Move para passo de confirmação
    setSuccessModalStep('confirmation');
  };

  const handleDontActivateFinal = () => {
    // Final choice - não ativar lembrete
    setShowSuccessModal(false);
    setSuccessModalStep('initial');
    // Limpar dados pendentes
    localStorage.removeItem('reminder_creation_data');
    setShouldShowReminderIndicator(false);
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    setSuccessModalStep('initial');
  };

  const fetchAppointments = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      console.log('🔍 Buscando agendamentos para usuário:', user.id);
      const { data, error } = await getClientAppointments(user.id);

      if (error) {
        console.error('❌ Erro ao buscar agendamentos:', error);
        throw error;
      }

      console.log('📊 Dados recebidos:', data?.length || 0, 'agendamentos');

      if (!data || data.length === 0) {
        console.log('⚠️ Nenhum agendamento no banco, verificando localStorage...');
        const localAppointments = JSON.parse(localStorage.getItem(`appointments_${user.id}`) || '[]');

        if (localAppointments.length > 0) {
          const sortedAppointments = localAppointments.sort((a: Appointment, b: Appointment) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setAppointments(sortedAppointments);
          toast('⚠️ Usando dados locais');
          console.log('💾 Usando dados locais:', localAppointments.length, 'agendamentos');
        } else {
          setAppointments([]);
          console.log('📭 Nenhum agendamento encontrado');
        }
      } else {
        const sortedAppointments = data.sort((a: Appointment, b: Appointment) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setAppointments(sortedAppointments);
        console.log('✅ Agendamentos carregados do banco:', sortedAppointments.length);
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar agendamentos:', error);

      // Fallback para dados locais
      const localAppointments = JSON.parse(localStorage.getItem(`appointments_${user.id}`) || '[]');

      if (localAppointments.length > 0) {
        const sortedAppointments = localAppointments.sort((a: Appointment, b: Appointment) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setAppointments(sortedAppointments);
        toast('⚠️ Usando dados locais (problema de conexão)');
        console.log('💾 Fallback para dados locais:', localAppointments.length, 'agendamentos');
      } else {
        setAppointments([]);
        toast.error(error.message || 'Erro ao buscar agendamentos');
        console.log('📭 Nenhum agendamento disponível');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!user) return;

    try {
      // Encontrar o agendamento antes de cancelar
      const appointmentToCancel = appointments.find(apt => apt.id === appointmentId);

      if (!appointmentToCancel) {
        toast.error('Agendamento não encontrado');
        return;
      }

      // 🔥 VALIDAÇÃO DE REMARCAÇÃO NO MESMO DIA PARA ASSINANTES
      console.log('🔍 DEBUG - appointmentToCancel:', appointmentToCancel);
      console.log('🔍 DEBUG - is_subscriber:', appointmentToCancel.is_subscriber);

      if (appointmentToCancel.is_subscriber) {
        console.log('🔍 Verificando se é assinante e se pode cancelar...');

        // Verificar se o estabelecimento tem a configuração ativada
        console.log('🔍 DEBUG - establishment_id:', appointmentToCancel.establishment_id);

        const { data: establishment, error: establishmentError } = await supabase
          .from('establishments')
          .select('prevent_same_day_reschedule')
          .eq('id', appointmentToCancel.establishment_id)
          .single();

        console.log('🔍 DEBUG - establishment:', establishment);
        console.log('🔍 DEBUG - establishmentError:', establishmentError);

        if (establishmentError) {
          console.error('Erro ao buscar configuração do estabelecimento:', establishmentError);
        } else if (establishment?.prevent_same_day_reschedule) {
          console.log('🔍 DEBUG - Configuração ativada, mostrando aviso...');
          // Mostrar aviso de confirmação
          const confirmCancel = window.confirm(
            '⚠️ Atenção: você é um assinante, o sistema não deixa desmarcar e agendar para o mesmo dia.\n\n' +
            'Tem certeza que deseja cancelar?'
          );

          if (!confirmCancel) {
            return; // Usuário cancelou a ação
          }
        }
      }

      const { error } = await cancelAppointment(appointmentId);

      if (error) throw error;

      // Encontrar o agendamento cancelado para notificação
      const cancelledAppointment = appointments.find(apt => apt.id === appointmentId);
      if (cancelledAppointment) {
        notifyCancelledAppointment(
          cancelledAppointment.service_name,
          cancelledAppointment.establishment_name,
          cancelledAppointment.appointment_time
        );
      }

      await fetchAppointments();

      toast.success('Agendamento cancelado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar agendamento');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sair');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101112] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101112]">
      <header className="bg-[#18191B] border-b border-gray-800">
        <div className="container-custom py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold text-white">AgendaFácil</span>
            </div>
            <div className="flex items-center gap-4">
              <NotificationPermission className="hidden sm:flex" />
              <span className="text-gray-400">{user?.email}</span>
              <button onClick={handleLogout} className="text-gray-400 hover:text-white">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container-custom py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Meus Agendamentos</h1>

            {/* Botão Agendar Novamente */}
            {appointments.length > 0 && (
              <button
                onClick={() => {
                  // Pegar o estabelecimento do último agendamento
                  const lastAppointment = appointments[0]; // Já está ordenado por data de criação (mais recente primeiro)

                  // Extrair o establishment_id do appointment
                  // Buscar no Supabase para pegar o código do estabelecimento
                  const fetchEstablishmentCode = async () => {
                    try {
                      const { data: appointmentData, error: appointmentError } = await supabase
                        .from('appointments')
                        .select('establishment_id')
                        .eq('id', lastAppointment.id)
                        .single();

                      if (appointmentError) throw appointmentError;

                      const { data: establishmentData, error: establishmentError } = await supabase
                        .from('establishments')
                        .select('code')
                        .eq('id', appointmentData.establishment_id)
                        .single();

                      if (establishmentError) throw establishmentError;

                      // Redirecionar para a página de booking
                      navigate(`/booking/${establishmentData.code}`);
                    } catch (error) {
                      console.error('Erro ao buscar código do estabelecimento:', error);
                      toast.error('Erro ao redirecionar para agendamento');
                    }
                  };

                  fetchEstablishmentCode();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
              >
                <Calendar className="h-5 w-5" />
                <span className="font-medium">Agendar novamente</span>
              </button>
            )}
          </div>

          {/* Status das Notificações */}
          <NotificationStatus
            permission={notificationPermission}
            onRequestPermission={requestNotificationPermission}
          />

          {/* Informações dos Lembretes */}
          <ReminderInfo appointments={appointments} />

          {appointments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Você ainda não tem nenhum agendamento</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-[#18191B] border border-gray-800 rounded-lg p-6"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-4 w-full">
                      {/* Header com informações principais */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-medium text-white mb-2">
                            🏪 {appointment.establishment_name}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            Pedido feito em: {format(new Date(appointment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          {/* Botão CRIAR LEMBRETE - No canto superior direito */}
                          {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                            <>
                              <button
                                onClick={() => {
                                  // Verificar se já foi confirmado via WhatsApp
                                  const confirmationKey = `appointment_confirmed_${pendingReminderData?.uniqueKey}`;
                                  const alreadyConfirmed = localStorage.getItem(confirmationKey) === 'true';

                                  if (alreadyConfirmed) {
                                    // Se já confirmou, mostrar modal de lembrete normal
                                    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
                                    const reminderTime = new Date(appointmentDateTime.getTime() - (30 * 60 * 1000)); // 30 minutos antes

                                    const reminderTitle = `Lembrete: ${appointment.establishment_name}`;
                                    const reminderDescription = `Você tem um agendamento em ${appointment.establishment_name}\n\nServiço: ${appointment.service_name}\nProfissional: ${appointment.professional_name || 'Não especificado'}\nHorário: ${appointment.appointment_time}`;

                                    // Criar evento no calendário
                                    const startDate = reminderTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                                    const endDate = new Date(reminderTime.getTime() + (15 * 60 * 1000)).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'; // 15 min de duração

                                    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(reminderTitle)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(reminderDescription)}&location=${encodeURIComponent(appointment.establishment_name)}`;

                                    window.open(calendarUrl, '_blank');
                                    toast('Lembrete criado! Abrindo calendário...', 'success');
                                  } else {
                                    // Se não confirmou ainda, mostrar modal de confirmação
                                    setPendingReminderData({
                                      serviceName: appointment.service_name,
                                      establishmentName: appointment.establishment_name,
                                      appointmentDate: appointment.appointment_date,
                                      appointmentTime: appointment.appointment_time,
                                      professionalName: appointment.professional_name
                                    });
                                    loadEstablishmentWhatsAppConfig(appointment.establishment_name).then(() => {
                                      setShowSuccessModal(true);
                                      setSuccessModalStep('initial');
                                    });
                                  }

                                  // Se havia um lembrete pendente, marcar como ativado
                                  if (pendingReminderData) {
                                    setShouldShowReminderIndicator(false);
                                    localStorage.removeItem('reminder_creation_data');
                                  }
                                }}
                                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1 ${shouldShowReminderIndicator
                                  ? 'bg-yellow-500 text-black animate-pulse hover:bg-yellow-400 shadow-lg'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                title={shouldShowReminderIndicator ? "🏆 Clique para ativar seu lembrete!" : "Criar lembrete no seu calendário"}
                              >
                                📅 {pendingReminderData && localStorage.getItem(`appointment_confirmed_${pendingReminderData.uniqueKey}`) === 'true' ? 'Já confirmei' : 'Lembrete'}
                                {shouldShowReminderIndicator && (
                                  <span className="ml-1 animate-bounce text-lg">✨</span>
                                )}
                              </button>
                            </>
                          )}

                          <div>
                            <p className="text-2xl text-green-500 font-bold">
                              R$ {appointment.service_price?.toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Grid com informações organizadas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Serviço */}
                        <div className="bg-[#1F2022] p-4 rounded-lg">
                          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                            ✂️ Serviço
                          </h4>
                          <p className="text-gray-300 text-lg">
                            {appointment.service_name}
                          </p>
                          {appointment.duration && (
                            <p className="text-gray-400 text-sm mt-1">
                              Duração: {appointment.duration} minutos
                            </p>
                          )}
                        </div>

                        {/* Profissional */}
                        <div className="bg-[#1F2022] p-4 rounded-lg">
                          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                            👨‍💼 Profissional
                          </h4>
                          <p className="text-gray-300 text-lg">
                            {appointment.professional_name || 'Não especificado'}
                          </p>
                        </div>

                        {/* Data e Horário */}
                        <div className="bg-[#1F2022] p-4 rounded-lg">
                          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                            📅 Data e Horário
                          </h4>
                          <div className="space-y-1">
                            <p className="text-gray-300">
                              {format(parseISO(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-gray-300 text-lg font-medium">
                              {appointment.appointment_time}
                            </p>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="bg-[#1F2022] p-4 rounded-lg">
                          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                            📊 Status
                          </h4>
                          <span className={`font-medium text-lg ${appointment.status === 'cancelled'
                            ? 'text-red-500'
                            : appointment.status === 'completed'
                              ? 'text-green-600'
                              : appointment.status === 'confirmed'
                                ? 'text-green-500'
                                : 'text-yellow-500'
                            }`}>
                            {appointment.status === 'cancelled'
                              ? '❌ Cancelado'
                              : appointment.status === 'completed'
                                ? '✅ CONCLUÍDO'
                                : appointment.status === 'confirmed'
                                  ? '✅ Confirmado'
                                  : '⏳ Pendente'}
                          </span>
                        </div>

                        {/* Método de Pagamento */}
                        <div className="bg-[#1F2022] p-4 rounded-lg">
                          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                            💳 Pagamento
                          </h4>
                          <p className="text-gray-300 text-lg">
                            {appointment.payment_method === 'pix' ? '💳 PIX' :
                              appointment.payment_method === 'credito' ? '💳 Crédito' :
                                appointment.payment_method === 'debito' ? '💳 Débito' :
                                  appointment.payment_method === 'dinheiro' ? '💵 Dinheiro' :
                                    appointment.payment_method === 'pagar_local' ? '🏪 Pagar no Local' :
                                      appointment.payment_method === 'assinante' ? '👑 Assinante' :
                                        '💳 Não especificado'}
                          </p>
                        </div>
                      </div>


                      {/* Botões de Ação */}
                      {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                        <div className="mt-4 flex justify-end gap-2">
                          <CancelAppointmentButton
                            appointmentId={appointment.id}
                            appointment={appointment}
                            onCancelled={() => {
                              fetchAppointments();
                            }}
                          />
                        </div>
                      )}

                      {/* Detalhes do Pagamento PIX */}
                      {appointment.payment_method === 'pix' && (
                        <div className="mt-4 p-4 bg-[#242628] rounded-lg border border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Status do Pagamento:</span>
                            <span className={`text-sm font-medium px-3 py-1 rounded-full ${appointment.pix_payment_status === 'confirmado' ? 'bg-green-900/20 text-green-500' :
                              appointment.pix_payment_status === 'rejeitado' ? 'bg-red-900/20 text-red-500' :
                                'bg-gray-900/20 text-gray-400'
                              }`}>
                              {appointment.pix_payment_status === 'confirmado' ? '✅ Confirmado' :
                                appointment.pix_payment_status === 'rejeitado' ? '❌ Rejeitado' :
                                  '✅ Confirmado'}
                            </span>
                          </div>

                          {appointment.pix_proof_url && (
                            <div className="mt-2">
                              <label className="block text-sm font-medium text-gray-400 mb-2">
                                Seu Comprovante
                              </label>
                              <div className="relative">
                                <img
                                  src={appointment.pix_proof_url}
                                  alt="Comprovante PIX"
                                  className="w-full max-w-xs rounded-lg border border-gray-700"
                                />
                                <a
                                  href={appointment.pix_proof_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5 text-white"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                  >
                                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                          )}

                          {appointment.pix_payment_status === 'rejeitado' && (
                            <div className="mt-4 p-3 bg-red-900/20 rounded-lg border border-red-900/30">
                              <p className="text-sm text-red-400">
                                Seu pagamento foi rejeitado. Por favor, entre em contato com o estabelecimento para mais informações.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleCancelAppointment(appointment.id)}
                      className="text-red-500 hover:text-red-400 ml-4"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showWelcomePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#18191B] rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-4">
              Bem-vindo ao AgendaFácil!
            </h2>
            <p className="text-gray-400 mb-6">
              Aqui você pode ver e gerenciar todos os seus agendamentos.
            </p>
            <button
              onClick={() => setShowWelcomePopup(false)}
              className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary/90"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Modal de Sucesso do Agendamento */}
      {showSuccessModal && pendingReminderData && (
        <SuccessBookingModal
          isOpen={showSuccessModal}
          onClose={handleCloseSuccessModal}
          onActivateReminder={handleActivateReminder}
          onDontActivate={successModalStep === 'initial' ? handleDontActivateFirst : handleDontActivateFinal}
          onConfirmWhatsApp={handleConfirmWhatsApp}
          step={successModalStep}
          appointmentData={pendingReminderData}
          enableWhatsAppNotifications={establishmentWhatsAppConfig?.enableWhatsAppNotifications || false}
        />
      )}

      {/* Banner para baixar o app */}
      <AppDownloadBanner />
    </div>
  );
};

export default ClientDashboard;