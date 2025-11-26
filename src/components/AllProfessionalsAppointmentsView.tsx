import { format, parse, parseISO } from 'date-fns';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, CreditCard, Crown, DollarSign, Edit, Image as ImageIcon, Package, Phone, Plus, Trash2, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ProfessionalInfoModal } from './ProfessionalInfoModal';
import { useToast } from './ui/Toaster';

interface Professional {
  id: string;
  name: string;
  photo_url?: string;
  percentage?: number;
  goal?: number;
}

interface ProfessionalPin {
  professional_id: string;
  pin: string;
}

interface AdditionalProduct {
  name: string;
  price: number;
}

interface SoldProduct {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Appointment {
  id: string;
  client_id: string;
  client_name: string;
  client_whatsapp?: string;
  client_cpf?: string;
  service: string;
  professional: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  duration: number;
  price: number;
  total_price?: number;
  payment_method?: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'transferencia' | 'pagar_local';
  card_brand?: string;
  pix_payment_status?: string;
  pix_proof_url?: string;
  additional_products?: AdditionalProduct[];
  sold_products?: SoldProduct[];
  observation?: string;
  establishment_observation?: string;
  is_premium?: boolean;
  is_subscriber?: boolean;
  is_child_service?: boolean;
  is_avulso?: boolean;
}

interface TimeSlot {
  time: string;
  appointment?: Appointment;
  isEmpty: boolean;
  isOccupied: boolean;
  parentAppointment?: Appointment;
}

interface AllProfessionalsAppointmentsViewProps {
  professionals: Professional[];
  appointments: Appointment[];
  monthlyAppointments: Appointment[];
  selectedDate: Date;
  professionalPins?: ProfessionalPin[];
  businessHours: {
    [key: string]: {
      enabled: boolean;
      open1: string;
      close1: string;
      open2: string | null;
      close2: string | null;
    };
  };
  establishment?: any;
  onDateChange: (date: Date) => void;
  onAppointmentUpdate?: () => void;
  onOpenTransferModal?: (appointment: Appointment) => void;
  onOpenObservationModal?: (appointmentId: string, currentObservation?: string) => void;
  onOpenAdditionalProductModal?: (appointmentId: string) => void;
  onOpenProductV2Modal?: (appointmentId: string) => void;
  onGenerateNF?: (appointment: Appointment) => void;
  onOpenReminderModal?: (appointment: Appointment) => void;
  onGoToProfessionalConfig?: (professionalId: string) => void;
  onGoToClients?: () => void;
}

export const AllProfessionalsAppointmentsView: React.FC<
  AllProfessionalsAppointmentsViewProps
> = ({
  professionals,
  appointments,
  monthlyAppointments,
  selectedDate,
  professionalPins = [],
  businessHours,
  establishment,
  onDateChange,
  onAppointmentUpdate,
  onOpenTransferModal,
  onOpenObservationModal,
  onOpenAdditionalProductModal,
  onOpenProductV2Modal,
  onGenerateNF,
  onOpenReminderModal,
  onGoToProfessionalConfig,
  onGoToClients,
}) => {
  const { toast } = useToast();
  const [expandedAppointments, setExpandedAppointments] = useState<{ [key: string]: boolean }>({});
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(
    professionals.length > 0 ? professionals[0].id : ''
  );
  const [selectedProfessionalForInfo, setSelectedProfessionalForInfo] = useState<string | null>(null);
  const [showColorLegend, setShowColorLegend] = useState<'red' | 'yellow' | 'green' | null>(null);
  const [showReminderInfo, setShowReminderInfo] = useState(false);
  const [showPendingWarning, setShowPendingWarning] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
    }
    return `${mins}min`;
  };

  const calculateTotalPrice = (apt: Appointment) => {
    let total = apt.price || 0;
    if (apt.additional_products) {
      total += apt.additional_products.reduce((sum, p) => sum + p.price, 0);
    }
    if (apt.sold_products) {
      total += apt.sold_products.reduce((sum, p) => sum + p.total, 0);
    }
    return total;
  };

  // Gerar todos os horários possíveis do dia com agendamentos mesclados
  const generateTimeSlotsWithAppointments = (professional: Professional): TimeSlot[] => {
    const dayOfWeek = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ][selectedDate.getDay()];

    const dayHours = businessHours[dayOfWeek];
    if (!dayHours || !dayHours.enabled) {
      return [];
    }

    const professionalWorkHours = (professional as any).work_hours?.[dayOfWeek];
    
    let startTime: string;
    let endTime: string;

    if (professionalWorkHours && professionalWorkHours.enabled) {
      startTime = professionalWorkHours.entry_time || dayHours.open1;
      endTime = professionalWorkHours.exit_time || dayHours.close1;
    } else {
      startTime = dayHours.open1;
      endTime = dayHours.close1;
    }

    const allSlots: string[] = [];
    const start = parse(startTime, 'HH:mm', selectedDate);
    const end = parse(endTime, 'HH:mm', selectedDate);

    // Determinar o intervalo baseado nas configurações do estabelecimento
    const interval = establishment?.use_20_minute_schedule ? 20 : 30;

    let current = start;
    while (current < end) {
      allSlots.push(format(current, 'HH:mm'));
      current = new Date(current.getTime() + interval * 60000);
    }

    const professionalAppointments = appointments
      .filter((apt) => apt.professional === professional.id)
      .sort(
        (a, b) =>
          parse(a.appointment_time, 'HH:mm', selectedDate).getTime() -
          parse(b.appointment_time, 'HH:mm', selectedDate).getTime()
      );

    const occupiedSlots = new Map<string, { appointment?: Appointment; isOccupied: boolean; parentAppointment?: Appointment }>();

    professionalAppointments.forEach((apt) => {
      const startTime = apt.appointment_time;
      const duration = apt.duration || interval;
      
      occupiedSlots.set(startTime, { appointment: apt, isOccupied: false });
      
      const startDate = parse(startTime, 'HH:mm', selectedDate);
      for (let i = interval; i < duration; i += interval) {
        const occupiedTime = format(new Date(startDate.getTime() + i * 60000), 'HH:mm');
        occupiedSlots.set(occupiedTime, { isOccupied: true, parentAppointment: apt });
      }
    });

    const result: TimeSlot[] = allSlots.map((slot) => {
      const occupied = occupiedSlots.get(slot);
      
      if (occupied?.appointment) {
        return {
          time: slot,
          appointment: occupied.appointment,
          isEmpty: false,
          isOccupied: false,
        };
      } else if (occupied?.isOccupied) {
        return {
          time: slot,
          isEmpty: false,
          isOccupied: true,
          parentAppointment: occupied.parentAppointment,
        };
      } else {
        return {
          time: slot,
          isEmpty: true,
          isOccupied: false,
        };
      }
    });

    return result;
  };

  const toggleAppointmentExpansion = (appointmentId: string) => {
    setExpandedAppointments(prev => ({
      ...prev,
      [appointmentId]: !prev[appointmentId]
    }));
  };

  const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed') => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      const statusMessages = {
        'pending': 'Agendamento marcado como PENDENTE',
        'confirmed': 'Agendamento confirmado',
        'cancelled': 'Agendamento cancelado',
        'completed': 'Agendamento marcado como CONCLUÍDO'
      };

      toast(statusMessages[newStatus]);
      
      if (onAppointmentUpdate) {
        onAppointmentUpdate();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast(error.message || 'Erro ao atualizar status do agendamento');
    }
  };

  const handlePaymentMethodChange = async (appointmentId: string, paymentMethod: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          payment_method: paymentMethod === 'pendente' ? null : paymentMethod,
          status: paymentMethod === 'pendente' ? 'pending' : 'completed'
        })
        .eq('id', appointmentId);

      if (error) throw error;

      toast('Forma de pagamento atualizada');
      
      if (onAppointmentUpdate) {
        onAppointmentUpdate();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar forma de pagamento:', error);
      toast(error.message || 'Erro ao atualizar forma de pagamento');
    }
  };

  const handleCardBrandChange = async (appointmentId: string, cardBrand: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ card_brand: cardBrand === 'bandeira' ? null : cardBrand })
        .eq('id', appointmentId);

      if (error) throw error;

      if (onAppointmentUpdate) {
        onAppointmentUpdate();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar bandeira:', error);
      toast(error.message || 'Erro ao atualizar bandeira do cartão');
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Tem certeza que deseja EXCLUIR este agendamento permanentemente?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      toast('Agendamento excluído com sucesso');
      
      if (onAppointmentUpdate) {
        onAppointmentUpdate();
      }
    } catch (error: any) {
      console.error('Erro ao excluir agendamento:', error);
      toast(error.message || 'Erro ao excluir agendamento');
    }
  };

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value + 'T00:00:00');
    onDateChange(newDate);
  };

  const getSlotColor = (slot: TimeSlot): string => {
    if (slot.isEmpty) {
      return 'bg-blue-50 border-blue-200';
    }
    
    const appointment = slot.appointment || slot.parentAppointment;
    if (!appointment) return 'bg-gray-100 border-gray-200';

    if (slot.isOccupied) {
      switch (appointment.status) {
        case 'cancelled':
          return 'bg-red-800/60 border-red-700';
        case 'completed':
          return 'bg-green-600/60 border-green-700';
        case 'pending':
        case 'confirmed':
          return 'bg-yellow-600/60 border-yellow-700';
        default:
          return 'bg-gray-600/60 border-gray-700';
      }
    }

    switch (appointment.status) {
      case 'cancelled':
        return 'bg-red-800/90 border-red-700';
      case 'completed':
        return 'bg-green-600 border-green-700';
      case 'pending':
      case 'confirmed':
        return 'bg-yellow-600 border-yellow-700';
      default:
        return 'bg-gray-600 border-gray-700';
    }
  };

  const getProfessionalName = (professionalId: string) => {
    return professionals.find(p => p.id === professionalId)?.name || 'Desconhecido';
  };

  // Calcular valores do profissional para o modal
  const calculateProfessionalValues = (professionalId: string) => {
    const dailyAppointments = appointments.filter(
      (apt) =>
        apt.professional === professionalId &&
        (apt.status === 'confirmed' || apt.status === 'completed')
    );

    const monthlyAppointmentsForPro = monthlyAppointments.filter(
      (apt) =>
        apt.professional === professionalId &&
        (apt.status === 'confirmed' || apt.status === 'completed')
    );

    const dailyGross = dailyAppointments.reduce(
      (sum, apt) => sum + (apt.total_price || apt.price),
      0
    );
    const monthlyGross = monthlyAppointmentsForPro.reduce(
      (sum, apt) => sum + (apt.total_price || apt.price),
      0
    );

    const professional = professionals.find((p) => p.id === professionalId);
    const percentage = professional?.percentage || 100;

    const dailyNet = dailyGross * (percentage / 100);
    const monthlyNet = monthlyGross * (percentage / 100);

    return {
      dailyGross,
      dailyNet,
      monthlyGross,
      monthlyNet,
      appointmentsToday: dailyAppointments.length,
      appointmentsMonth: monthlyAppointmentsForPro.length,
    };
  };

  if (professionals.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600 text-lg">Nenhum profissional cadastrado</p>
        <p className="text-gray-500 text-sm mt-2">
          Adicione profissionais na aba "Profissionais" para visualizar os agendamentos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card de Legenda de Cores */}
      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <p className="text-xs text-white mb-3 text-center">Clique na cor para ver o significado</p>
        
        {/* Layout para mobile - 3 colunas */}
        <div className="grid grid-cols-3 gap-2 sm:hidden">
          <button 
            onClick={() => setShowColorLegend('red')}
            className="px-2 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
          >
            Cancelado
          </button>
          <button 
            onClick={() => setShowColorLegend('yellow')}
            className="px-2 py-2 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
          >
            Pendente
          </button>
          <button 
            onClick={() => setShowColorLegend('green')}
            className="px-2 py-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
          >
            Concluído
          </button>
        </div>

        {/* Layout para desktop - horizontal */}
        <div className="hidden sm:flex justify-center gap-4">
          <button 
            onClick={() => setShowColorLegend('red')}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            ❌ Cancelado
          </button>
          <button 
            onClick={() => setShowColorLegend('yellow')}
            className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition-colors"
          >
            ⏳ Pendente
          </button>
          <button 
            onClick={() => setShowColorLegend('green')}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          >
            ✅ Concluído
          </button>
        </div>

        {/* Botão de lembrete para clientes */}
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowReminderInfo(true)}
            className="px-3 py-2 text-xs font-medium rounded transition-colors bg-purple-600 text-white hover:bg-purple-700"
            title="Dicas sobre envio de lembretes"
          >
            📬 Enviar lembrete para clientes
          </button>
        </div>
      </div>

      {/* Modal de Informações sobre Lembretes */}
      {showReminderInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowReminderInfo(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-2xl font-bold">💡 Dica Importante</h2>
              <button
                onClick={() => setShowReminderInfo(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-gray-700 text-base leading-relaxed">
                Você pode reforçar a presença do seu cliente e evitar esquecimentos! ✂️
              </p>
              
              <p className="text-gray-700 text-base leading-relaxed">
                Caso ele não tenha ativado as notificações automáticas, basta clicar em <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold">"Enviar lembrete"</span> dentro do agendamento. 📅
              </p>
              
              <p className="text-gray-700 text-base leading-relaxed">
                Assim, o sistema envia uma mensagem completa no WhatsApp do cliente, com todas as informações do agendamento — horário, serviço e profissional — pra ele não esquecer de comparecer. 🕒
              </p>
              
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <p className="text-green-800 text-sm leading-relaxed">
                  <strong>💬💈 Dica profissional:</strong> Muitos barbeiros usam esse recurso no dia dos atendimentos para lembrar todos os clientes de forma rápida e prática!
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t">
              <button
                onClick={() => setShowReminderInfo(false)}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal da Legenda */}
      {showColorLegend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowColorLegend(null)}>
          <div className="bg-gray-800 p-6 rounded-lg max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center ${
                showColorLegend === 'red' ? 'bg-red-600' :
                showColorLegend === 'yellow' ? 'bg-yellow-600' :
                'bg-green-600'
              }`}>
                {showColorLegend === 'red' && <span className="text-white text-2xl">❌</span>}
                {showColorLegend === 'yellow' && <span className="text-white text-2xl">⏳</span>}
                {showColorLegend === 'green' && <span className="text-white text-2xl">✅</span>}
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                {showColorLegend === 'red' ? 'Agendamentos Cancelados' :
                  showColorLegend === 'yellow' ? 'Clientes que ainda não pagaram' :
                  'Agendamentos Concluídos ou Pagos'}
              </h3>

              <p className="text-gray-300 mb-4">
                {showColorLegend === 'red' ? 'Agendamentos que foram cancelados pelo cliente ou estabelecimento.' :
                  showColorLegend === 'yellow' ? 'Agendamentos agendados mas ainda não realizados ou pagos.' :
                  'Agendamentos que foram concluídos com sucesso e pagos.'}
              </p>

              <button
                onClick={() => setShowColorLegend(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta sobre valores pendentes */}
      <div className="bg-orange-100 border-l-4 border-orange-500 rounded-r-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-orange-600 text-lg flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1">
            <button
              onClick={() => setShowPendingWarning(true)}
              className="text-orange-800 text-sm font-bold text-left hover:underline"
            >
              Agendamento pendente não conta valor no dashboard - <span className="text-orange-600">clique para entender</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Aviso sobre Pendentes */}
      {showPendingWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowPendingWarning(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-1">⚠️ Como contabilizar valores</h2>
              </div>
              <button
                onClick={() => setShowPendingWarning(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 text-base leading-relaxed">
                Coloque seu agendamento como <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold">concluído</span>, para o dashboard reconhecer que você recebeu o valor de fato.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-b-2xl border-t">
              <button
                onClick={() => setShowPendingWarning(false)}
                className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cabeçalho com navegação de data */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Agendamentos do Dia - Todos os Profissionais
        </h2>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={handlePreviousDay}
            className="p-2 md:p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-md flex-shrink-0"
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
          </button>
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={handleDateInputChange}
            className="flex-1 px-3 md:px-4 py-2 md:py-3 text-sm md:text-base font-semibold text-gray-900 bg-gray-50 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white"
          />
          <button
            onClick={handleNextDay}
            className="p-2 md:p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-md flex-shrink-0"
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        </div>
        {/* Seletor de Profissional - MOBILE (opcional) */}
        <div className="md:hidden mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pular para Profissional (ou arraste abaixo):
          </label>
          <select
            value={selectedProfessionalId}
            onChange={(e) => {
              setSelectedProfessionalId(e.target.value);
              // Scroll horizontal para o profissional selecionado
              setTimeout(() => {
                const professionalIndex = professionals.findIndex(p => p.id === e.target.value);
                const scrollContainer = document.querySelector('.mobile-scroll-container');
                if (scrollContainer && professionalIndex >= 0) {
                  scrollContainer.scrollTo({
                    left: professionalIndex * 280,
                    behavior: 'smooth'
                  });
                }
              }, 100);
            }}
            className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-semibold text-base"
          >
            {professionals.map((prof) => (
              <option key={prof.id} value={prof.id} className="text-gray-900 font-normal">
                {prof.name}
              </option>
            ))}
          </select>
        </div>

        {/* Texto de ajuda */}
        <p className="text-sm text-gray-600 mt-2 text-center">
          👈 Arraste para o lado para ver mais profissionais 👉
        </p>
      </div>

      {/* Layout Horizontal Scrollável - MOBILE E DESKTOP */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <style>{`
          .scroll-container-top {
            overflow-x: auto;
            transform: rotateX(180deg);
          }
          .scroll-content-flip {
            transform: rotateX(180deg);
          }
          .mobile-scroll-container {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        `}</style>
        <div className="scroll-container-top mobile-scroll-container">
          <div className="flex gap-0 min-w-max scroll-content-flip">
            {professionals.map((professional, index) => {
              const timeSlots = generateTimeSlotsWithAppointments(professional);
              const professionalAppointmentsCount = timeSlots.filter(
                (slot) => slot.appointment && slot.appointment.status !== 'cancelled'
              ).length;

              return (
                <div
                  key={professional.id}
                  className={`flex-shrink-0 ${
                    index !== 0 ? 'border-l-4 border-purple-400' : ''
                  }`}
                  style={{ width: '280px' }}
                >
                  {/* Cabeçalho do Profissional */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 sticky top-0 z-10">
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => setSelectedProfessionalForInfo(professional.id)}
                        className="group relative"
                      >
                        {professional.photo_url ? (
                          <img
                            src={professional.photo_url}
                            alt={professional.name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md group-hover:scale-110 transition-transform cursor-pointer"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-2xl border-2 border-white shadow-md group-hover:scale-110 transition-transform cursor-pointer">
                            👤
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold">
                            💰
                          </span>
                        </div>
                      </button>
                      <h3 className="text-white font-bold text-sm mt-1 text-center">
                        {professional.name}
                      </h3>
                      <p className="text-blue-100 text-xs">
                        {professionalAppointmentsCount} agend.
                      </p>
                      <div className="space-y-1 mt-1">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedProfessionalForInfo(professional.id)}
                            className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors border border-white/30"
                          >
                            💰 Financeiro
                          </button>
                          {onGoToProfessionalConfig && (
                            <button
                              onClick={() => onGoToProfessionalConfig(professional.id)}
                              className="flex-1 px-2 py-1 bg-green-600/80 hover:bg-green-700 text-white text-xs rounded transition-colors border border-white/30"
                              title="Ir para configurações do profissional"
                            >
                              ⚙️ Config
                            </button>
                          )}
                        </div>
                        {onGoToClients && (
                          <button
                            onClick={onGoToClients}
                            className="w-full px-2 py-1 bg-purple-600/80 hover:bg-purple-700 text-white text-xs rounded transition-colors border border-white/30"
                            title="Ir para Meus Clientes"
                          >
                            📅 Criar reserva
                          </button>
                        )}
                      </div>
                      
                      {/* Contadores de Status por Profissional */}
                      <div className="mt-2 flex gap-1 text-xs">
                        <span className="px-2 py-1 bg-red-600/80 text-white rounded">
                          ❌ {timeSlots.filter(s => s.appointment && s.appointment.status === 'cancelled').length}
                        </span>
                        <span className="px-2 py-1 bg-yellow-600/80 text-white rounded">
                          ⏳ {timeSlots.filter(s => s.appointment && (s.appointment.status === 'pending' || s.appointment.status === 'confirmed')).length}
                        </span>
                        <span className="px-2 py-1 bg-green-600/80 text-white rounded">
                          ✅ {timeSlots.filter(s => s.appointment && s.appointment.status === 'completed').length}
                        </span>
                      </div>
                      
                      {/* Meta do Profissional */}
                      {professional.goal && professional.goal > 0 && (
                        <div className="mt-2 px-2 py-1 bg-purple-600/90 text-white rounded text-xs text-center">
                          🎯 Meta: {formatCurrency(professional.goal)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Todos os Horários (Livres e Ocupados) */}
                  <div className="p-2 bg-gray-50 min-h-[500px]">
                    <div className="space-y-1">
                      {timeSlots.length > 0 ? (
                        timeSlots.map((slot, slotIndex) => {
                          const slotColor = getSlotColor(slot);

                          if (slot.isEmpty) {
                            // Horário disponível
                            return (
                              <div
                                key={`${slot.time}-${slotIndex}`}
                                className={`${slotColor} border-2 rounded-lg px-3 py-2`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-blue-900 font-bold text-sm">
                                    {slot.time}
                                  </span>
                                  <span className="text-green-600 text-xs font-semibold">
                                    ✓ DISPONÍVEL
                                  </span>
                                </div>
                              </div>
                            );
                          } else if (slot.isOccupied && slot.parentAppointment) {
                            // Slot ocupado pela duração de um agendamento
                            return (
                              <div
                                key={`${slot.time}-${slotIndex}`}
                                className={`${slotColor} border-2 rounded-lg p-3 opacity-75`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-white font-bold text-sm">
                                    {slot.time}
                                  </span>
                                  <span className="text-white text-xs font-semibold">
                                    🔒 OCUPADO
                                  </span>
                                </div>
                              </div>
                            );
                          } else if (slot.appointment) {
                            // Agendamento real
                            const apt = slot.appointment;
                            const isExpanded = expandedAppointments[apt.id];

                            return (
                              <div
                                key={apt.id}
                                className={`${slotColor} border rounded-lg overflow-hidden`}
                              >
                                {/* Versão Compacta - Sempre visível */}
                                <div className="px-3 py-2">
                                  <div
                                    onClick={() => toggleAppointmentExpansion(apt.id)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-white font-bold text-sm">
                                        {slot.time}
                                      </span>
                                      <span className="text-white text-xs font-bold">
                                        R$ {(apt.total_price || apt.price).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-white font-semibold text-sm mb-1 truncate">
                                      {apt.client_name}
                                      {apt.is_subscriber && ' 👑'}
                                    </div>
                                    <div className="text-white/90 text-xs truncate">
                                      {apt.service}
                                    </div>
                                    <div className="text-white/70 text-xs mt-1">
                                      {apt.duration} min • {isExpanded ? 'Ocultar' : 'Ver detalhes'}
                                    </div>
                                  </div>

                                  {/* Botão Enviar Lembrete - Aparece quando NÃO expandido */}
                                  {!isExpanded && apt.status !== 'cancelled' && (
                                    <div className="mt-2 pt-2 border-t border-white/20">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onOpenReminderModal) onOpenReminderModal(apt);
                                        }}
                                        className="w-full px-2 py-1.5 text-xs font-medium rounded transition-colors bg-blue-500 text-white hover:bg-blue-600"
                                        title="Enviar lembrete via WhatsApp"
                                      >
                                        📱 Enviar lembrete
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Versão Expandida - Só aparece quando clicado */}
                                {isExpanded && (
                                  <div className="border-t-2 border-white/20 p-3 bg-black/10">
                                    {/* Cliente Info */}
                                    <div className="mb-3">
                                      <div className="flex items-center gap-2 mb-2">
                                        <User className="w-4 h-4 text-white" />
                                        <span className="text-white font-semibold">{apt.client_name}</span>
                                        {apt.is_premium && <Crown className="w-4 h-4 text-yellow-300" />}
                                      </div>
                                      {apt.client_whatsapp && (
                                        <a
                                          href={`https://wa.me/55${apt.client_whatsapp.replace(/\D/g, '')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-white/90 text-xs flex items-center gap-1 hover:text-white"
                                        >
                                          <Phone className="w-3 h-3" />
                                          {apt.client_whatsapp}
                                        </a>
                                      )}
                                      {apt.client_cpf && (
                                        <div className="text-white/80 text-xs mt-1">
                                          CPF: {apt.client_cpf}
                                        </div>
                                      )}
                                    </div>

                                    {/* Serviço e Data */}
                                    <div className="mb-3 text-xs text-white/90 space-y-1">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {format(parseISO(apt.appointment_date), 'dd/MM/yyyy')}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {apt.appointment_time} • {formatDuration(apt.duration)}
                                      </div>
                                    </div>

                                    {/* Valores */}
                                    <div className="bg-white/10 rounded p-2 mb-3">
                                      <div className="text-xs text-white/80 mb-1">Valor base:</div>
                                      <div className="text-white font-bold">{formatCurrency(apt.price)}</div>
                                      
                                      {apt.additional_products && apt.additional_products.length > 0 && (
                                        <div className="mt-2">
                                          <div className="text-xs text-white/80 mb-1">Serviços Extras:</div>
                                          {apt.additional_products.map((prod, idx) => (
                                            <div key={idx} className="text-xs text-white/90">
                                              • {prod.name}: {formatCurrency(prod.price)}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {apt.sold_products && apt.sold_products.length > 0 && (
                                        <div className="mt-2">
                                          <div className="text-xs text-white/80 mb-1">Produtos:</div>
                                          {apt.sold_products.map((prod) => (
                                            <div key={prod.id} className="text-xs text-white/90">
                                              • {prod.name} ({prod.quantity}x): {formatCurrency(prod.total)}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      <div className="mt-2 pt-2 border-t border-white/20">
                                        <div className="text-sm font-bold text-white">
                                          Total: {formatCurrency(calculateTotalPrice(apt))}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Forma de Pagamento */}
                                    {apt.status !== 'cancelled' && (
                                      <div className="mb-3">
                                        <select
                                          value={apt.payment_method || 'pendente'}
                                          onChange={(e) => handlePaymentMethodChange(apt.id, e.target.value)}
                                          className="w-full bg-white/20 text-white text-xs rounded px-2 py-1 border border-white/30"
                                        >
                                          <option value="pendente" className="bg-gray-800">Forma de Pagamento</option>
                                          <option value="pix" className="bg-gray-800">PIX</option>
                                          <option value="credito" className="bg-gray-800">Cartão de Crédito</option>
                                          <option value="debito" className="bg-gray-800">Cartão de Débito</option>
                                          <option value="dinheiro" className="bg-gray-800">Dinheiro</option>
                                          <option value="pagar_local" className="bg-gray-800">Pagar no Local</option>
                                        </select>

                                        {(apt.payment_method === 'credito' || apt.payment_method === 'debito') && (
                                          <select
                                            value={apt.card_brand || 'bandeira'}
                                            onChange={(e) => handleCardBrandChange(apt.id, e.target.value)}
                                            className="w-full mt-1 bg-white/20 text-white text-xs rounded px-2 py-1 border border-white/30"
                                          >
                                            <option value="bandeira" className="bg-gray-800">Bandeira</option>
                                            <option value="visa" className="bg-gray-800">Visa</option>
                                            <option value="mastercard" className="bg-gray-800">Mastercard</option>
                                            <option value="elo" className="bg-gray-800">Elo</option>
                                          </select>
                                        )}
                                      </div>
                                    )}

                                    {/* Observações */}
                                    {apt.observation && (
                                      <div className="bg-blue-500/20 rounded p-2 mb-2 border border-blue-400/30">
                                        <div className="text-xs text-white/80 mb-1">Obs. Cliente:</div>
                                        <div className="text-xs text-white">{apt.observation}</div>
                                      </div>
                                    )}

                                    {apt.establishment_observation && (
                                      <div className="bg-purple-500/20 rounded p-2 mb-2 border border-purple-400/30">
                                        <div className="text-xs text-white/80 mb-1">Minhas Obs.:</div>
                                        <div className="text-xs text-white">{apt.establishment_observation}</div>
                                      </div>
                                    )}

                                    {/* Botões de Ação */}
                                    {apt.status !== 'cancelled' ? (
                                      <div className="space-y-2">
                                        {/* Botões principais */}
                                        <div className="grid grid-cols-2 gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (onOpenProductV2Modal) onOpenProductV2Modal(apt.id);
                                            }}
                                            className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                                          >
                                            <Package className="w-3 h-3" />
                                            Produto V2
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (onOpenAdditionalProductModal) onOpenAdditionalProductModal(apt.id);
                                            }}
                                            className="px-2 py-1.5 text-xs bg-white/20 text-white rounded hover:bg-white/30 flex items-center justify-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" />
                                            Serviço Extra
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateAppointmentStatus(apt.id, 'completed');
                                            }}
                                            className="px-2 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                          >
                                            ✅ CONCLUÍDO
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateAppointmentStatus(apt.id, 'pending');
                                            }}
                                            className="px-2 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                          >
                                            ⏳ PENDENTE
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (onOpenTransferModal) onOpenTransferModal(apt);
                                            }}
                                            className="px-2 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                          >
                                            🔄 TRANSFERIR
                                          </button>

                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateAppointmentStatus(apt.id, 'cancelled');
                                            }}
                                            className="px-2 py-1.5 text-xs bg-red-700 text-white rounded hover:bg-red-800"
                                          >
                                            ❌ CANCELAR
                                          </button>
                                        </div>

                                        {/* Botões secundários */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (onOpenObservationModal) onOpenObservationModal(apt.id, apt.establishment_observation);
                                          }}
                                          className="w-full px-2 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                        >
                                          📝 Minhas Observações
                                        </button>

                                        {apt.is_child_service !== undefined && (
                                          <div className="text-center">
                                            <span className={`inline-block px-2 py-1 text-xs rounded ${apt.is_child_service ? 'bg-purple-600' : 'bg-gray-600'} text-white`}>
                                              {apt.is_child_service ? '👶 Infantil' : '👤 Adulto'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <div className="text-center text-white/70 text-xs py-2">
                                          ❌ CANCELADO
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAppointment(apt.id);
                                          }}
                                          className="w-full px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center justify-center gap-1"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          🗑️ EXCLUIR
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return null;
                        })
                      ) : (
                        <div className="text-center py-8">
                          <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                          <p className="text-gray-500 text-sm">Sem horário de trabalho hoje</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de Informações do Profissional */}
      {selectedProfessionalForInfo && (
        <ProfessionalInfoModal
          professional={
            professionals.find((p) => p.id === selectedProfessionalForInfo) || {
              id: '',
              name: '',
            }
          }
          professionalPin={
            professionalPins.find((pin) => pin.professional_id === selectedProfessionalForInfo)
              ?.pin
          }
          {...calculateProfessionalValues(selectedProfessionalForInfo)}
          onClose={() => setSelectedProfessionalForInfo(null)}
        />
      )}
    </div>
  );
};
