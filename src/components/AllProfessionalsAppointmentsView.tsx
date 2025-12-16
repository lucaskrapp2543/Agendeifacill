import { format, parse, parseISO } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Clock, Crown, Package, Phone, Plus, Trash2, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
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
  is_squeeze?: boolean; // Indica se é um encaixe
}

interface TimeSlot {
  time: string;
  appointment?: Appointment;
  isEmpty: boolean;
  isOccupied: boolean;
  isBlocked: boolean;
  parentAppointment?: Appointment;
  squeezes?: Appointment[]; // Encaixes para este slot
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
  onCancelAppointment?: (appointmentId: string) => void;
  useLightLayout?: boolean;
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
  onCancelAppointment,
  useLightLayout = false,
}) => {
    console.log('📋 AllProfessionalsAppointmentsView - Total de appointments recebidos:', appointments.length);
    console.log('📅 Data selecionada:', selectedDate.toISOString());
    console.log('🔍 Appointments:', appointments);

    const { toast } = useToast();
    const [expandedAppointments, setExpandedAppointments] = useState<{ [key: string]: boolean }>({});
    const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>(
      professionals.length > 0 ? professionals[0].id : ''
    );
    const [selectedProfessionalForInfo, setSelectedProfessionalForInfo] = useState<string | null>(null);
    const [showColorLegend, setShowColorLegend] = useState<'red' | 'yellow' | 'green' | null>(null);
    const [showReminderInfo, setShowReminderInfo] = useState(false);
    const [showPendingWarning, setShowPendingWarning] = useState(false);
    const [editingAppointmentValue, setEditingAppointmentValue] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState<string>('');

    // Estados para criar encaixe
    const [showSqueezeModal, setShowSqueezeModal] = useState(false);
    const [selectedProfessionalForSqueeze, setSelectedProfessionalForSqueeze] = useState<string | null>(null);
    const [showSqueezeServiceModal, setShowSqueezeServiceModal] = useState(false);
    const [showSqueezeTimeModal, setShowSqueezeTimeModal] = useState(false);
    const [selectedSqueezeService, setSelectedSqueezeService] = useState<any>(null);
    const [squeezeStartTime, setSqueezeStartTime] = useState('');
    const [squeezeEndTime, setSqueezeEndTime] = useState('');

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
      let interval: number;
      if (establishment?.use_15_minute_interval) {
        // Quando ativo, mostra de 30 em 30 min
        interval = 30;
      } else if (establishment?.use_20_minute_schedule) {
        // Quando ativo, mostra de 20 em 20 min
        interval = 20;
      } else {
        // Padrão: 15 em 15 min
        interval = 15;
      }

      console.log('🔥 AllProfessionalsAppointmentsView - Intervalo calculado:', interval, 'min', {
        use_15_minute_interval: establishment?.use_15_minute_interval,
        use_20_minute_schedule: establishment?.use_20_minute_schedule
      });

      let current = start;
      while (current < end) {
        allSlots.push(format(current, 'HH:mm'));
        current = new Date(current.getTime() + interval * 60000);
      }

      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

      // Separar encaixes dos agendamentos normais
      const normalAppointments = appointments.filter((apt) =>
        apt.professional === professional.id &&
        apt.appointment_date === selectedDateStr &&
        !apt.is_squeeze
      );

      const squeezeAppointments = appointments.filter((apt) =>
        apt.professional === professional.id &&
        apt.appointment_date === selectedDateStr &&
        apt.is_squeeze
      );

      const professionalAppointments = [...normalAppointments, ...squeezeAppointments].sort(
        (a, b) =>
          parse(a.appointment_time, 'HH:mm', selectedDate).getTime() -
          parse(b.appointment_time, 'HH:mm', selectedDate).getTime()
      );

      const occupiedSlots = new Map<string, { appointment?: Appointment; isOccupied: boolean; parentAppointment?: Appointment; isSqueeze?: boolean }>();
      const squeezeSlotsMap = new Map<string, Appointment[]>(); // Mapa de slot -> encaixes

      // Processar agendamentos normais
      normalAppointments.forEach((apt) => {
        const startTime = apt.appointment_time;
        const duration = apt.duration || interval;

        occupiedSlots.set(startTime, { appointment: apt, isOccupied: false });

        const startDate = parse(startTime, 'HH:mm', selectedDate);
        for (let i = interval; i < duration; i += interval) {
          const occupiedTime = format(new Date(startDate.getTime() + i * 60000), 'HH:mm');
          occupiedSlots.set(occupiedTime, { isOccupied: true, parentAppointment: apt });
        }
      });

      // Processar encaixes - adicionar como appointment no slot mais próximo e bloquear horários
      squeezeAppointments.forEach((squeeze) => {
        const squeezeStartTime = squeeze.appointment_time;
        const [startHours, startMins] = squeezeStartTime.split(':').map(Number);
        const squeezeStartTotal = startHours * 60 + startMins;

        // Encontrar o slot mais próximo
        let nearestSlot = allSlots[0];
        let minDiff = Math.abs(squeezeStartTotal - allSlots[0].split(':').map(Number).reduce((h, m) => h * 60 + m));

        allSlots.forEach(slot => {
          const [slotHours, slotMins] = slot.split(':').map(Number);
          const slotTotal = slotHours * 60 + slotMins;
          const diff = Math.abs(squeezeStartTotal - slotTotal);
          if (diff < minDiff) {
            minDiff = diff;
            nearestSlot = slot;
          }
        });

        // Adicionar encaixe como appointment no slot mais próximo (para aparecer como agendamento normal)
        if (!occupiedSlots.has(nearestSlot)) {
          occupiedSlots.set(nearestSlot, { appointment: squeeze, isOccupied: false });
        } else {
          // Se o slot já tem algo, adicionar encaixe abaixo (em squeezes)
          if (!squeezeSlotsMap.has(nearestSlot)) {
            squeezeSlotsMap.set(nearestSlot, []);
          }
          squeezeSlotsMap.get(nearestSlot)!.push(squeeze);
        }

        // Bloquear todos os horários dentro do intervalo do encaixe
        const squeezeDuration = squeeze.duration || interval;
        const squeezeStartDate = parse(squeezeStartTime, 'HH:mm', selectedDate);

        allSlots.forEach(slot => {
          if (slot === nearestSlot) return; // Não bloquear o slot principal onde o encaixe aparece

          const [slotHours, slotMins] = slot.split(':').map(Number);
          const slotTotal = slotHours * 60 + slotMins;
          const squeezeEndTotal = squeezeStartTotal + squeezeDuration;

          // Se o slot está dentro do intervalo do encaixe, marcar como ocupado pelo encaixe
          if (slotTotal >= squeezeStartTotal && slotTotal < squeezeEndTotal) {
            if (!occupiedSlots.has(slot)) {
              occupiedSlots.set(slot, { isOccupied: true, parentAppointment: squeeze, isSqueeze: true });
            } else {
              // Se já tem algo, adicionar como ocupado pelo encaixe
              const existing = occupiedSlots.get(slot)!;
              if (!existing.appointment) {
                occupiedSlots.set(slot, { ...existing, isOccupied: true, parentAppointment: squeeze, isSqueeze: true });
              }
            }
          }
        });
      });

      // Verificar horários bloqueados para este profissional na data selecionada
      const dateKey = format(selectedDate, 'yyyy-MM-dd');
      const blockedHours = (professional as any).blocked_hours?.[dateKey] || [];

      const result: TimeSlot[] = allSlots.map((slot) => {
        const occupied = occupiedSlots.get(slot);
        const isBlocked = blockedHours.includes(slot);
        const squeezesForSlot = squeezeSlotsMap.get(slot) || [];

        if (occupied?.appointment) {
          return {
            time: slot,
            appointment: occupied.appointment,
            isEmpty: false,
            isOccupied: false,
            isBlocked: false,
          };
        } else if (occupied?.isOccupied && occupied.isSqueeze) {
          // Slot ocupado por encaixe
          return {
            time: slot,
            isEmpty: false,
            isOccupied: true,
            isBlocked: false,
            parentAppointment: occupied.parentAppointment,
          };
        } else if (occupied?.isOccupied) {
          return {
            time: slot,
            isEmpty: false,
            isOccupied: true,
            isBlocked: false,
            parentAppointment: occupied.parentAppointment,
          };
        } else if (isBlocked) {
          return {
            time: slot,
            isEmpty: false,
            isOccupied: false,
            isBlocked: true,
          };
        } else {
          return {
            time: slot,
            isEmpty: true,
            isOccupied: false,
            isBlocked: false,
          };
        }
      });

      // Adicionar encaixes aos slots (para exibição abaixo do horário)
      result.forEach(slot => {
        const squeezes = squeezeSlotsMap.get(slot.time);
        if (squeezes && squeezes.length > 0) {
          // Adicionar encaixes ao slot
          (slot as any).squeezes = squeezes;
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

    const handleEditAppointmentValue = (appointmentId: string, currentValue: number) => {
      setEditingAppointmentValue(appointmentId);
      setEditingValue(currentValue.toFixed(2).replace('.', ','));
    };

    const handleCancelEditValue = () => {
      setEditingAppointmentValue(null);
      setEditingValue('');
    };

    const handleSaveAppointmentValue = async (appointmentId: string) => {
      try {
        const numericValue = parseFloat(editingValue.replace(',', '.'));
        if (isNaN(numericValue) || numericValue < 0) {
          toast('Valor inválido');
          return;
        }

        const { error } = await supabase
          .from('appointments')
          .update({ price: numericValue })
          .eq('id', appointmentId);

        if (error) throw error;

        toast('Valor atualizado com sucesso!');
        setEditingAppointmentValue(null);
        setEditingValue('');

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao atualizar valor:', error);
        toast(error.message || 'Erro ao atualizar valor');
      }
    };

    const handleRemoveAdditionalProduct = async (appointmentId: string, productIndex: number) => {
      try {
        const appointment = appointments.find(apt => apt.id === appointmentId);
        if (!appointment || !appointment.additional_products) return;

        const updatedProducts = appointment.additional_products.filter((_, index) => index !== productIndex);

        const { error } = await supabase
          .from('appointments')
          .update({ additional_products: updatedProducts })
          .eq('id', appointmentId);

        if (error) throw error;

        toast('Produto removido com sucesso!');

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao remover produto:', error);
        toast(error.message || 'Erro ao remover produto');
      }
    };

    const handleRemoveProductFromAppointment = async (appointmentId: string, productId: string, productName: string) => {
      try {
        const appointment = appointments.find(apt => apt.id === appointmentId);
        if (!appointment || !appointment.sold_products) return;

        const productToRemove = appointment.sold_products.find((p: SoldProduct) => p.product_id === productId);
        if (!productToRemove) return;

        const updatedProducts = appointment.sold_products.filter((p: SoldProduct) => p.product_id !== productId);

        const { error } = await supabase
          .from('appointments')
          .update({ sold_products: updatedProducts })
          .eq('id', appointmentId);

        if (error) throw error;

        // Devolver o produto ao estoque
        if (establishment?.id) {
          const { data: currentEstablishment } = await supabase
            .from('establishments')
            .select('products')
            .eq('id', establishment.id)
            .single();

          if (currentEstablishment?.products) {
            const updatedEstablishmentProducts = currentEstablishment.products.map((p: any) => {
              if (p.id === productId) {
                return {
                  ...p,
                  quantity: (p.quantity || 0) + productToRemove.quantity
                };
              }
              return p;
            });

            await supabase
              .from('establishments')
              .update({ products: updatedEstablishmentProducts })
              .eq('id', establishment.id);
          }
        }

        toast(`${productName} removido e devolvido ao estoque!`);

        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao remover produto:', error);
        toast(error.message || 'Erro ao remover produto');
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
        return 'bg-white border-gray-300';
      }

      const appointment = slot.appointment || slot.parentAppointment;
      if (!appointment) return 'bg-gray-100 border-gray-300';

      // Se for encaixe, usar cinza escuro
      if (appointment.is_squeeze) {
        if (slot.isOccupied) {
          return 'bg-gray-700/60 border-gray-600';
        }
        return 'bg-gray-700 border-gray-600';
      }

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
            return 'bg-gray-600/60 border-gray-500';
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
          return 'bg-gray-600 border-gray-500';
      }
    };

    const getProfessionalName = (professionalId: string) => {
      return professionals.find(p => p.id === professionalId)?.name || 'Desconhecido';
    };

    // Calcular valores do profissional para o modal
    const calculateProfessionalValues = (professionalId: string) => {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

      // Debug: verificar todos os appointments
      console.log('🔍 DEBUG calculateProfessionalValues:');
      console.log('  - Professional ID:', professionalId);
      console.log('  - Selected Date:', selectedDateStr);
      console.log('  - Total appointments:', appointments.length);
      console.log('  - Appointments do profissional:', appointments.filter(apt => apt.professional === professionalId).length);
      console.log('  - Appointments do profissional na data:', appointments.filter(apt => apt.professional === professionalId && apt.appointment_date === selectedDateStr).length);

      // Contar TODOS os agendamentos não cancelados para a contagem
      const dailyAppointmentsForCount = appointments.filter(
        (apt) =>
          apt.professional === professionalId &&
          apt.appointment_date === selectedDateStr &&
          apt.status !== 'cancelled'
      );

      // Para valores financeiros, usar apenas confirmados/completos (pendentes não geram receita)
      const dailyAppointments = appointments.filter(
        (apt) =>
          apt.professional === professionalId &&
          apt.appointment_date === selectedDateStr &&
          (apt.status === 'confirmed' || apt.status === 'completed')
      );

      console.log('  - Appointments não cancelados (contagem):', dailyAppointmentsForCount.length);
      console.log('  - Appointments confirmados/completos (valores):', dailyAppointments.length);
      console.log('  - Detalhes:', dailyAppointmentsForCount.map(apt => ({ id: apt.id, status: apt.status, date: apt.appointment_date })));

      // Para valores financeiros mensais, usar apenas confirmados/completos
      const monthlyAppointmentsForPro = monthlyAppointments.filter(
        (apt) =>
          apt.professional === professionalId &&
          (apt.status === 'confirmed' || apt.status === 'completed')
      );

      // Para contagem mensal, usar todos não cancelados
      const monthlyAppointmentsForCount = monthlyAppointments.filter(
        (apt) =>
          apt.professional === professionalId &&
          apt.status !== 'cancelled'
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
        appointmentsToday: dailyAppointmentsForCount.length, // Contagem: todos não cancelados
        appointmentsMonth: monthlyAppointmentsForCount.length, // Contagem: todos não cancelados
      };
    };

    // Função para buscar serviços do estabelecimento
    const fetchEstablishmentServices = async () => {
      if (!establishment?.id) return [];

      try {
        const allServices: any[] = [];

        // Buscar serviços de service_subcategories (sistema de categorias)
        const { data: subcategoriesData } = await supabase
          .from('service_subcategories')
          .select(`
          *,
          service_categories!inner (
            establishment_id
          )
        `)
          .eq('service_categories.establishment_id', establishment.id)
          .eq('is_active', true);

        if (subcategoriesData) {
          subcategoriesData.forEach((sub: any) => {
            allServices.push({
              id: sub.id,
              name: sub.name,
              price: Number(sub.price),
              duration: Number(sub.duration || 30)
            });
          });
        }

        // Buscar serviços salvos em services_with_prices (sistema antigo)
        const { data: establishmentData } = await supabase
          .from('establishments')
          .select('services_with_prices')
          .eq('id', establishment.id)
          .single();

        if (establishmentData?.services_with_prices) {
          establishmentData.services_with_prices.forEach((service: any) => {
            allServices.push({
              id: service.id,
              name: service.name,
              price: Number(service.price),
              duration: Number(service.duration || 30)
            });
          });
        }

        // Remover duplicatas por ID
        const uniqueServices = allServices.reduce((acc: any[], service: any) => {
          if (!acc.find(s => s.id === service.id)) {
            acc.push(service);
          }
          return acc;
        }, []);

        return uniqueServices;
      } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        return [];
      }
    };

    // Função para calcular duração em minutos entre dois horários
    const calculateDuration = (startTime: string, endTime: string): number => {
      const [startHours, startMins] = startTime.split(':').map(Number);
      const [endHours, endMins] = endTime.split(':').map(Number);

      const startTotal = startHours * 60 + startMins;
      const endTotal = endHours * 60 + endMins;

      return endTotal - startTotal;
    };

    // Função para encontrar o horário mais próximo no grid
    const findNearestSlot = (time: string, slots: string[]): string => {
      const [hours, mins] = time.split(':').map(Number);
      const timeTotal = hours * 60 + mins;

      let nearest = slots[0];
      let minDiff = Math.abs(
        timeTotal - slots[0].split(':').map(Number).reduce((h, m) => h * 60 + m)
      );

      slots.forEach(slot => {
        const [slotHours, slotMins] = slot.split(':').map(Number);
        const slotTotal = slotHours * 60 + slotMins;
        const diff = Math.abs(timeTotal - slotTotal);

        if (diff < minDiff) {
          minDiff = diff;
          nearest = slot;
        }
      });

      return nearest;
    };

    // Função para criar encaixe
    const handleCreateSqueeze = async () => {
      if (!selectedSqueezeService || !squeezeStartTime || !squeezeEndTime || !selectedProfessionalForSqueeze || !establishment) {
        toast.error('Preencha todos os campos');
        return;
      }

      // Validar que o horário de término é depois do início
      const duration = calculateDuration(squeezeStartTime, squeezeEndTime);
      if (duration <= 0) {
        toast.error('O horário de término deve ser depois do horário de início');
        return;
      }

      try {
        const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

        // Buscar user_id do estabelecimento para usar como client_id
        const { data: establishmentData } = await supabase
          .from('establishments')
          .select('owner_id')
          .eq('id', establishment.id)
          .single();

        const { error } = await supabase
          .from('appointments')
          .insert({
            client_id: establishmentData?.owner_id || '',
            establishment_id: establishment.id,
            professional: selectedProfessionalForSqueeze,
            service: selectedSqueezeService.name,
            client_name: 'ENCAIXE',
            appointment_date: selectedDateStr,
            appointment_time: squeezeStartTime,
            status: 'confirmed',
            price: selectedSqueezeService.price,
            total_price: selectedSqueezeService.price,
            duration: duration,
            is_squeeze: true // Marcar como encaixe
          });

        if (error) throw error;

        toast.success('Encaixe criado com sucesso!');

        // Fechar modais e limpar estados
        setShowSqueezeServiceModal(false);
        setShowSqueezeTimeModal(false);
        setSelectedSqueezeService(null);
        setSqueezeStartTime('');
        setSqueezeEndTime('');
        setSelectedProfessionalForSqueeze(null);

        // Atualizar agendamentos
        if (onAppointmentUpdate) {
          onAppointmentUpdate();
        }
      } catch (error: any) {
        console.error('Erro ao criar encaixe:', error);
        toast.error(error.message || 'Erro ao criar encaixe');
      }
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
        {/* Cabeçalho com navegação de data - MOVIDO PARA O TOPO */}
        <div className="bg-white rounded-lg p-2 sm:p-4 border border-gray-300 shadow-sm">
          <h2 className="text-lg sm:text-2xl font-bold text-black mb-2 sm:mb-4">
            Agendamentos do Dia
          </h2>
          <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
            <button
              onClick={handlePreviousDay}
              className="p-1.5 sm:p-2 md:p-3 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors shadow-md flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </button>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={handleDateInputChange}
              className="flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-3 text-xs sm:text-sm md:text-base font-semibold text-black bg-white border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 transition-colors"
            />
            <button
              onClick={handleNextDay}
              className="p-1.5 sm:p-2 md:p-3 rounded-lg bg-black hover:bg-gray-800 text-white transition-colors shadow-md flex-shrink-0"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </button>
          </div>
          {/* Seletor de Profissional - MOBILE (opcional) */}
          <div className="md:hidden mt-2 sm:mt-4">
            <label className="block text-xs sm:text-sm font-medium text-gray-800 mb-1 sm:mb-2">
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
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 bg-white text-black font-semibold text-sm sm:text-base transition-colors"
            >
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id} className="text-black font-normal">
                  {prof.name}
                </option>
              ))}
            </select>
          </div>

          {/* Texto de ajuda */}
          <p className="text-xs sm:text-sm text-gray-600 mt-1 sm:mt-2 text-center">
            👈 Arraste para o lado para ver mais profissionais 👉
          </p>
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
                  Caso ele não tenha ativado as notificações automáticas, basta clicar em <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded font-semibold">"Enviar lembrete"</span> dentro do agendamento. 📅
                </p>

                <p className="text-gray-700 text-base leading-relaxed">
                  Assim, o sistema envia uma mensagem completa no WhatsApp do cliente, com todas as informações do agendamento — horário, serviço e profissional — pra ele não esquecer de comparecer. 🕒
                </p>

                <div className="bg-gray-100 border-l-4 border-gray-600 p-4 rounded-r-lg">
                  <p className="text-gray-800 text-sm leading-relaxed">
                    <strong>💬💈 Dica profissional:</strong> Muitos barbeiros usam esse recurso no dia dos atendimentos para lembrar todos os clientes de forma rápida e prática!
                  </p>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t">
                <button
                  onClick={() => setShowReminderInfo(false)}
                  className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
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
                <div className={`w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center ${showColorLegend === 'red' ? 'bg-red-600' :
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
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors font-medium"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}


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
                  Coloque seu agendamento como <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded font-semibold">concluído</span>, para o dashboard reconhecer que você recebeu o valor de fato.
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-b-2xl border-t">
                <button
                  onClick={() => setShowPendingWarning(false)}
                  className="w-full py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        )}


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
                const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                // Contar TODOS os agendamentos não cancelados (pending, confirmed, completed)
                const professionalAppointmentsCount = timeSlots.filter(
                  (slot) => slot.appointment &&
                    slot.appointment.appointment_date === selectedDateStr &&
                    slot.appointment.status !== 'cancelled'
                ).length;

                // Debug para comparar
                if (professional.id === professionals[0]?.id) {
                  console.log('🔍 DEBUG Card Count:');
                  console.log('  - Professional:', professional.name);
                  console.log('  - Selected Date:', selectedDateStr);
                  console.log('  - Total slots com appointment:', timeSlots.filter(s => s.appointment).length);
                  console.log('  - Slots confirmados/completos na data:', professionalAppointmentsCount);
                }

                return (
                  <div
                    key={professional.id}
                    className={`flex-shrink-0 ${index !== 0
                      ? useLightLayout
                        ? 'border-l border-black/20'
                        : 'border-l-4 border-gray-400'
                      : ''
                      }`}
                    style={{ width: '280px' }}
                  >
                    {/* Cabeçalho do Profissional */}
                    <div className={`p-2 sticky top-0 z-10 ${useLightLayout
                      ? 'bg-gray-100 border-b-2 border-gray-300'
                      : 'bg-gradient-to-r from-gray-900 to-black border-b-2 border-gray-700'
                      }`}>
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => setSelectedProfessionalForInfo(professional.id)}
                          className="group relative"
                        >
                          {professional.photo_url ? (
                            <img
                              src={professional.photo_url}
                              alt={professional.name}
                              className={`w-14 h-14 rounded-full object-cover border-2 shadow-md group-hover:scale-110 transition-transform cursor-pointer ${useLightLayout ? 'border-gray-300' : 'border-white'
                                }`}
                            />
                          ) : (
                            <div className={`w-14 h-14 rounded-full bg-white flex items-center justify-center text-2xl border-2 shadow-md group-hover:scale-110 transition-transform cursor-pointer ${useLightLayout ? 'border-gray-300' : 'border-white'
                              }`}>
                              👤
                            </div>
                          )}
                          <div className={`absolute inset-0 rounded-full transition-colors flex items-center justify-center ${useLightLayout
                            ? 'bg-black/0 group-hover:bg-gray-300/20'
                            : 'bg-black/0 group-hover:bg-white/20'
                            }`}>
                            <span className={`opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold ${useLightLayout ? 'text-gray-900' : 'text-white'
                              }`}>
                              💰
                            </span>
                          </div>
                        </button>
                        <h3 className={`font-bold text-sm mt-1 text-center ${useLightLayout ? 'text-gray-900' : 'text-white'
                          }`}>
                          {professional.name}
                        </h3>
                        <p className={`text-xs ${useLightLayout ? 'text-gray-600' : 'text-gray-300'
                          }`}>
                          {professionalAppointmentsCount} agend.
                        </p>
                        <div className="space-y-1 mt-1">
                          <div className="flex gap-1">
                            <button
                              onClick={() => setSelectedProfessionalForInfo(professional.id)}
                              className={`flex-1 px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                  ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                  : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                }`}
                            >
                              💰 Financeiro
                            </button>
                            {onGoToProfessionalConfig && (
                              <button
                                onClick={() => onGoToProfessionalConfig(professional.id)}
                                className={`flex-1 px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                    ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                    : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                  }`}
                                title="Ir para configurações do profissional"
                              >
                                ⚙️ Config
                              </button>
                            )}
                          </div>
                          {onGoToClients && (
                            <button
                              onClick={onGoToClients}
                              className={`w-full px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                  ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                  : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                                }`}
                              title="Ir para Meus Clientes"
                            >
                              📅 Criar reserva
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedProfessionalForSqueeze(professional.id);
                              setShowSqueezeServiceModal(true);
                            }}
                            className={`w-full px-2 py-1 text-xs rounded transition-colors text-white ${useLightLayout
                                ? 'bg-gradient-to-r from-gray-800 via-gray-900 to-black hover:from-gray-700 hover:via-gray-800 hover:to-gray-900 border border-gray-700'
                                : 'bg-gradient-to-r from-gray-900 via-black to-black hover:from-gray-800 hover:via-gray-900 hover:to-black border border-gray-700'
                              }`}
                            title="Criar Encaixe"
                          >
                            🟣 Criar Encaixe
                          </button>
                        </div>

                        {/* Contadores de Status por Profissional */}
                        <div className="mt-2 flex gap-1 text-xs">
                          <span className="px-2 py-1 bg-red-600/80 text-white rounded border border-red-700">
                            ❌ {timeSlots.filter(s => s.appointment && s.appointment.status === 'cancelled').length}
                          </span>
                          <span className="px-2 py-1 bg-yellow-600/80 text-white rounded border border-yellow-700">
                            ⏳ {timeSlots.filter(s => s.appointment && (s.appointment.status === 'pending' || s.appointment.status === 'confirmed')).length}
                          </span>
                          <span className="px-2 py-1 bg-green-600/80 text-white rounded border border-green-700">
                            ✅ {timeSlots.filter(s => s.appointment && s.appointment.status === 'completed').length}
                          </span>
                        </div>

                        {/* Meta do Profissional */}
                        {professional.goal && professional.goal > 0 && (
                          <div className={`mt-2 px-2 py-1 rounded text-xs text-center ${useLightLayout
                            ? 'bg-gray-200 text-gray-900 border border-gray-300'
                            : 'bg-gray-800 text-white border border-gray-600'
                            }`}>
                            🎯 Meta: {formatCurrency(professional.goal)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Todos os Horários (Livres e Ocupados) */}
                    <div className={`p-2 min-h-[500px] ${useLightLayout ? 'bg-gray-100' : 'bg-gray-100'
                      }`}>
                      <div className="space-y-1">
                        {timeSlots.length > 0 ? (
                          timeSlots.map((slot, slotIndex) => {
                            const slotColor = getSlotColor(slot);

                            if (slot.isBlocked) {
                              // Horário bloqueado
                              return (
                                <div
                                  key={`${slot.time}-${slotIndex}`}
                                  className="bg-gray-400 border-2 border-gray-500 rounded-lg px-3 py-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-white font-bold text-sm">
                                      {slot.time}
                                    </span>
                                    <span className="text-white text-xs font-semibold">
                                      🔒 BLOQUEADO
                                    </span>
                                  </div>
                                </div>
                              );
                            } else if (slot.isEmpty) {
                              // Horário disponível - pode ter encaixes abaixo
                              const squeezes = (slot as any).squeezes || [];
                              return (
                                <div key={`${slot.time}-${slotIndex}`}>
                                  <div
                                    className={`${slotColor} border-2 rounded-lg px-3 py-2`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-black font-bold text-sm">
                                        {slot.time}
                                      </span>
                                      <span className="text-green-600 text-xs font-semibold">
                                        ✓ DISPONÍVEL
                                      </span>
                                    </div>
                                  </div>
                                  {/* Exibir encaixes abaixo do horário */}
                                  {squeezes.map((squeeze: Appointment) => {
                                    const isExpanded = expandedAppointments[squeeze.id];
                                    return (
                                      <div
                                        key={squeeze.id}
                                        className="bg-gray-700 border-2 border-gray-600 rounded-lg mt-1 overflow-hidden"
                                      >
                                        <div className="px-3 py-2">
                                          <div
                                            onClick={() => toggleAppointmentExpansion(squeeze.id)}
                                            className="cursor-pointer"
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-white font-bold text-sm">
                                                {squeeze.appointment_time} 🟣 ENCAIXE
                                              </span>
                                              <span className="text-white text-xs font-bold">
                                                R$ {(squeeze.total_price || squeeze.price).toFixed(2)}
                                              </span>
                                            </div>
                                            <div className="text-white font-semibold text-sm mb-1 truncate">
                                              {squeeze.service}
                                            </div>
                                            <div className="text-white/70 text-xs mt-1">
                                              {squeeze.duration} min • {isExpanded ? 'Ocultar' : 'Ver detalhes'}
                                            </div>
                                          </div>
                                        </div>
                                        {/* Versão expandida do encaixe */}
                                        {isExpanded && (
                                          <div className="border-t-2 border-white/20 p-3 bg-black/10">
                                            <div className="mb-3">
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="text-white font-semibold">ENCAIXE</span>
                                              </div>
                                            </div>
                                            <div className="mb-3 text-xs text-white/90 space-y-1">
                                              <div className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(parseISO(squeeze.appointment_date), 'dd/MM/yyyy')}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {squeeze.appointment_time} • {formatDuration(squeeze.duration)}
                                              </div>
                                            </div>
                                            <div className="bg-white/10 rounded p-2 mb-3">
                                              <div className="text-xs text-white/80 mb-1">Valor:</div>
                                              <div className="text-sm font-bold text-white">
                                                {formatCurrency(squeeze.price)}
                                              </div>
                                            </div>
                                            {/* Botões de ação para encaixe */}
                                            <div className="flex gap-2 mt-3">
                                              <button
                                                onClick={() => {
                                                  if (onCancelAppointment) {
                                                    onCancelAppointment(squeeze.id);
                                                  }
                                                }}
                                                className="flex-1 px-3 py-2 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors"
                                              >
                                                Cancelar
                                              </button>
                                              {onOpenTransferModal && (
                                                <button
                                                  onClick={() => onOpenTransferModal(squeeze)}
                                                  className="flex-1 px-3 py-2 bg-black text-white text-xs rounded hover:bg-gray-800 transition-colors"
                                                >
                                                  Transferir
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
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
                                          {apt.is_squeeze ? apt.appointment_time : slot.time} {apt.is_squeeze && '🟣'}
                                        </span>
                                        <span className="text-white text-xs font-bold">
                                          R$ {(apt.total_price || apt.price).toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="text-white font-semibold text-sm mb-1 truncate">
                                        {apt.is_squeeze ? 'ENCAIXE' : apt.client_name}
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
                                          className="w-full px-2 py-1.5 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
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
                                          <span className="text-white font-semibold">
                                            {apt.is_squeeze ? 'ENCAIXE' : apt.client_name}
                                          </span>
                                          {apt.is_premium && <Crown className="w-4 h-4 text-gray-300" />}
                                          {apt.is_squeeze && <span className="text-gray-300 text-xs">🟣</span>}
                                        </div>
                                        {apt.is_squeeze && (
                                          <div className="mb-2">
                                            <input
                                              type="text"
                                              value={apt.client_name === 'ENCAIXE' ? '' : apt.client_name}
                                              onChange={async (e) => {
                                                const newName = e.target.value || 'ENCAIXE';
                                                try {
                                                  const { error } = await supabase
                                                    .from('appointments')
                                                    .update({ client_name: newName })
                                                    .eq('id', apt.id);
                                                  if (error) throw error;
                                                  if (onAppointmentUpdate) onAppointmentUpdate();
                                                } catch (error) {
                                                  console.error('Erro ao atualizar nome:', error);
                                                  toast.error('Erro ao atualizar nome');
                                                }
                                              }}
                                              placeholder="Nome do cliente (opcional)"
                                              className="w-full px-2 py-1 text-sm bg-white/20 border border-white/30 rounded text-white placeholder-gray-400"
                                            />
                                          </div>
                                        )}
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
                                        <div className="flex items-center gap-2">
                                          {editingAppointmentValue === apt.id ? (
                                            <>
                                              <input
                                                type="text"
                                                value={editingValue}
                                                onChange={(e) => setEditingValue(e.target.value)}
                                                className="px-2 py-1 text-xs bg-white/20 border border-white/30 rounded text-white w-20"
                                                placeholder="0,00"
                                              />
                                              <button
                                                onClick={() => handleSaveAppointmentValue(apt.id)}
                                                className="text-white hover:text-gray-200 text-xs px-2 py-1 bg-gray-700 rounded"
                                                title="Salvar"
                                              >
                                                ✓
                                              </button>
                                              <button
                                                onClick={handleCancelEditValue}
                                                className="text-white hover:text-gray-200 text-xs px-2 py-1 bg-gray-800 rounded"
                                                title="Cancelar"
                                              >
                                                ✕
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <div className="text-white font-bold">{formatCurrency(apt.price)}</div>
                                              {!apt.is_subscriber && (
                                                <button
                                                  onClick={() => handleEditAppointmentValue(apt.id, apt.price || 0)}
                                                  className="text-gray-300 hover:text-white text-xs"
                                                  title="Editar valor"
                                                >
                                                  ✏️
                                                </button>
                                              )}
                                            </>
                                          )}
                                        </div>

                                        {apt.additional_products && apt.additional_products.length > 0 && (
                                          <div className="mt-2">
                                            <div className="text-xs text-white/80 mb-1">Serviços Extras:</div>
                                            <div className="flex flex-wrap gap-1">
                                              {apt.additional_products.map((prod, idx) => (
                                                <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white/10 text-white rounded group">
                                                  <span>{prod.name}: {formatCurrency(prod.price)}</span>
                                                  <button
                                                    onClick={() => handleRemoveAdditionalProduct(apt.id, idx)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                                    title="Remover"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {apt.sold_products && apt.sold_products.length > 0 && (
                                          <div className="mt-2">
                                            <div className="text-xs text-white/80 mb-1">Produtos:</div>
                                            <div className="flex flex-wrap gap-1">
                                              {apt.sold_products.map((prod) => (
                                                <div key={prod.id} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-800/50 text-white rounded border border-gray-600 group">
                                                  <Package className="h-3 w-3" />
                                                  <span>{prod.name} ({prod.quantity}x): {formatCurrency(prod.total)}</span>
                                                  <button
                                                    onClick={() => handleRemoveProductFromAppointment(apt.id, prod.product_id, prod.name)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-white"
                                                    title="Remover produto"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
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
                                        <div className="bg-gray-800/50 rounded p-2 mb-2 border border-gray-600">
                                          <div className="text-xs text-white/80 mb-1">Obs. Cliente:</div>
                                          <div className="text-xs text-white">{apt.observation}</div>
                                        </div>
                                      )}

                                      {apt.establishment_observation && (
                                        <div className="bg-gray-700/50 rounded p-2 mb-2 border border-gray-500">
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
                                              className="px-2 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800 flex items-center justify-center gap-1"
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
                                              className="px-2 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800"
                                            >
                                              🔄 TRANSFERIR
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                // Se tiver função de cancelamento customizada, usar ela (para pedir senha)
                                                if (onCancelAppointment) {
                                                  onCancelAppointment(apt.id);
                                                } else {
                                                  // Fallback: cancelar direto
                                                  handleUpdateAppointmentStatus(apt.id, 'cancelled');
                                                }
                                              }}
                                              className="px-2 py-1.5 text-xs bg-red-700 text-white rounded hover:bg-red-800"
                                            >
                                              ❌ CANCELAR
                                            </button>

                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const establishmentCode = establishment?.code || 'codigo';
                                                const message = `Desculpa, houve um imprevisto, não irei conseguir atender você. Acesse agendeifacil.com/booking/${establishmentCode} para agendar novamente.`;
                                                let phoneNumber = (apt.client_whatsapp || '').replace(/\D/g, '');
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
                                                  phoneNumber.startsWith(code) && phoneNumber.length >= minLength
                                                );
                                                if (!hasCountryCode && phoneNumber.length >= 10 && phoneNumber.length <= 11) {
                                                  phoneNumber = '55' + phoneNumber;
                                                }
                                                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                                                window.open(whatsappUrl, '_blank');
                                              }}
                                              className="px-2 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-700"
                                              title="Enviar mensagem de imprevisto"
                                            >
                                              IMPREVISTO
                                            </button>
                                          </div>

                                          {/* Botões secundários */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (onOpenObservationModal) onOpenObservationModal(apt.id, apt.establishment_observation);
                                            }}
                                            className="w-full px-2 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                                          >
                                            📝 Minhas Observações
                                          </button>

                                          {apt.is_child_service !== undefined && (
                                            <div className="text-center">
                                              <span className={`inline-block px-2 py-1 text-xs rounded ${apt.is_child_service ? 'bg-gray-700' : 'bg-gray-600'} text-white border border-gray-500`}>
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
                                            className="w-full px-2 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 flex items-center justify-center gap-1"
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

        {/* Modal de Seleção de Serviço para Encaixe */}
        {showSqueezeServiceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Qual serviço deseja adicionar como encaixe?
                </h3>
                <button
                  onClick={() => {
                    setShowSqueezeServiceModal(false);
                    setSelectedProfessionalForSqueeze(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <SqueezeServiceList
                  establishment={establishment}
                  onSelectService={async (service) => {
                    setSelectedSqueezeService(service);
                    setShowSqueezeServiceModal(false);
                    setShowSqueezeTimeModal(true);
                  }}
                  onClose={() => {
                    setShowSqueezeServiceModal(false);
                    setSelectedProfessionalForSqueeze(null);
                  }}
                  fetchServices={fetchEstablishmentServices}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal de Horário para Encaixe */}
        {showSqueezeTimeModal && selectedSqueezeService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1a1b1c] rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Definir Horário do Encaixe
                </h3>
                <button
                  onClick={() => {
                    setShowSqueezeTimeModal(false);
                    setSelectedSqueezeService(null);
                    setSqueezeStartTime('');
                    setSqueezeEndTime('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Serviço: <span className="text-white">{selectedSqueezeService.name}</span>
                  </label>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Valor: <span className="text-white">{formatCurrency(selectedSqueezeService.price)}</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Horário de Início
                  </label>
                  <input
                    type="time"
                    value={squeezeStartTime}
                    onChange={(e) => setSqueezeStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2a2b2c] border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Horário de Término
                  </label>
                  <input
                    type="time"
                    value={squeezeEndTime}
                    onChange={(e) => setSqueezeEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#2a2b2c] border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowSqueezeTimeModal(false);
                      setSelectedSqueezeService(null);
                      setSqueezeStartTime('');
                      setSqueezeEndTime('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateSqueeze}
                    className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Criar Encaixe
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card de Legenda de Cores - MOVIDO PARA BAIXO */}
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
              className="px-3 py-2 text-xs font-medium rounded transition-colors bg-black text-white hover:bg-gray-800"
              title="Dicas sobre envio de lembretes"
            >
              📬 Enviar lembrete para clientes
            </button>
          </div>
        </div>

        {/* Alerta sobre valores pendentes - MOVIDO PARA BAIXO */}
        <div className="bg-gray-100 border-l-4 border-gray-600 rounded-r-lg p-3">
          <div className="flex items-start gap-2">
            <span className="text-gray-700 text-lg flex-shrink-0 mt-0.5">⚠️</span>
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
      </div>
    );
  };

// Componente para lista de serviços no modal de encaixe
const SqueezeServiceList: React.FC<{
  establishment: any;
  onSelectService: (service: any) => void;
  onClose: () => void;
  fetchServices: () => Promise<any[]>;
}> = ({ onSelectService, onClose, fetchServices }) => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);
      const fetchedServices = await fetchServices();
      setServices(fetchedServices);
      setLoading(false);
    };
    loadServices();
  }, [fetchServices]);

  if (loading) {
    return <div className="text-center py-4 text-gray-400">Carregando serviços...</div>;
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400">
        Nenhum serviço cadastrado. Adicione serviços em "Meus Serviços".
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onSelectService(service)}
          className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
        >
          <div className="font-semibold text-white">{service.name}</div>
          <div className="text-sm text-gray-300">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(service.price)}
          </div>
        </button>
      ))}
    </div>
  );
};
