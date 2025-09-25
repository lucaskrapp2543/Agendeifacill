import React from 'react';
import { format } from 'date-fns';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Appointment {
  appointment_date: string;
  appointment_time: string;
  duration: number;
  status?: string;
  professional?: string;
}

interface TimeSlot {
  time: string;
  isAvailable: boolean;
  reason?: string;
}

interface TimeSlotSelectorProps {
  selectedDate: Date;
  selectedService?: Service;
  selectedDuration?: number; // Duração do serviço em minutos
  existingAppointments: Appointment[];
  selectedTime?: string;
  onTimeSelect: (time: string) => void;
  businessHours: {
    enabled: boolean;
    open1: string;
    close1: string;
    open2: string | null;
    close2: string | null;
  };
  use15MinuteInterval?: boolean; // Nova prop para configuração de intervalo
  filterPastTimes?: boolean; // Nova prop para filtrar horários passados
  selectedProfessional?: string; // Profissional selecionado
  professionalAbsences?: string[]; // Dias de ausência do profissional
  professionalBlockedHours?: string[]; // Horários bloqueados do profissional para a data selecionada
  professionalWorkHours?: {
    [key: string]: {
      enabled: boolean;
      entry_time?: string;
      break_start?: string;
      break_end?: string;
      exit_time?: string;
    };
  } | null; // Horários personalizados de trabalho do profissional
}

export function TimeSlotSelector({
  selectedDate,
  selectedService,
  selectedDuration,
  existingAppointments,
  selectedTime,
  onTimeSelect,
  businessHours,
  use15MinuteInterval = false, // Valor padrão false (15 em 15 min)
  filterPastTimes = false, // Valor padrão false (não filtrar horários passados)
  selectedProfessional,
  professionalAbsences = [],
  professionalBlockedHours = [],
  professionalWorkHours = null
}: TimeSlotSelectorProps) {
  // Função para converter horário HH:mm para minutos totais
  const timeToMinutes = (time: string | null): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Função para verificar se um horário já passou
  const isTimeInPast = (timeString: string): boolean => {
    if (!filterPastTimes) return false;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    
    // Se não é hoje, não filtrar
    if (selectedDay.getTime() !== today.getTime()) {
      return false;
    }
    
    // Se é hoje, verificar se o horário já passou
    const [hours, minutes] = timeString.split(':').map(Number);
    const slotTime = new Date(today.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000);
    
    const isPast = slotTime <= now;
    
    // Log de debug
    if (isPast) {
      console.log(`🕒 TimeSlotSelector - Horário ${timeString} já passou (agora: ${now.toLocaleTimeString()})`);
    }
    
    return isPast;
  };

  // Função para obter o dia da semana em inglês
  const getDayOfWeek = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Função para gerar os horários disponíveis
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    const dayOfWeek = getDayOfWeek(selectedDate);
    
    // Log de debug
    console.log(`🕒 TimeSlotSelector - Gerando horários com filtro de horários passados: ${filterPastTimes}`);
    console.log(`🕒 TimeSlotSelector - Dia da semana: ${dayOfWeek}`);
    console.log(`🕒 TimeSlotSelector - Horários personalizados do profissional:`, professionalWorkHours);
    
    // Determinar quais horários usar: personalizados do profissional ou padrão do estabelecimento
    let effectiveBusinessHours = businessHours;
    
    if (professionalWorkHours && professionalWorkHours[dayOfWeek] && professionalWorkHours[dayOfWeek].enabled) {
      const workDay = professionalWorkHours[dayOfWeek];
      console.log(`🕒 TimeSlotSelector - Usando horários personalizados do profissional para ${dayOfWeek}:`, workDay);
      
      // Converter horários personalizados para o formato do businessHours
      // IMPORTANTE: Não tratar intervalo como segundo período, mas sim excluir esse período
      effectiveBusinessHours = {
        enabled: true,
        open1: workDay.entry_time || '08:00',
        close1: workDay.exit_time || '17:00',
        open2: null, // Não usar segundo período para intervalo
        close2: null // Não usar segundo período para intervalo
      };
      
      console.log(`🕒 TimeSlotSelector - Horários efetivos convertidos:`, effectiveBusinessHours);
    } else {
      console.log(`🕒 TimeSlotSelector - Usando horários padrão do estabelecimento`);
    }
    
    // Se não houver horários de funcionamento ou não estiver habilitado, retornar array vazio
    if (!effectiveBusinessHours || !effectiveBusinessHours.enabled || (!selectedService && !selectedDuration)) {
      return slots;
    }

    // Verificar se o profissional está ausente neste dia
    const isProfessionalAbsent = selectedProfessional && professionalAbsences.includes(selectedDateString);
    if (isProfessionalAbsent) {
      console.log(`🚫 TimeSlotSelector - Profissional ${selectedProfessional} está ausente no dia ${selectedDateString}`);
      return [{
        time: '09:00',
        isAvailable: false,
        reason: 'Profissional ausente neste dia'
      }];
    }

    // Filtrar agendamentos para o dia específico
    const relevantAppointments = existingAppointments.filter(apt => 
      apt.appointment_date === selectedDateString &&
      apt.status !== 'cancelled'
    );

    console.log('🕒 TimeSlotSelector - Gerando horários:');
    console.log('  - effectiveBusinessHours:', effectiveBusinessHours);
    console.log('  - relevantAppointments:', relevantAppointments);

    // Determinar o intervalo baseado na configuração
    const interval = use15MinuteInterval ? 30 : 15;
    
    // Gerar horários para o primeiro período
    if (effectiveBusinessHours.open1 && effectiveBusinessHours.close1) {
      const startMinutes = timeToMinutes(effectiveBusinessHours.open1);
      const endMinutes = timeToMinutes(effectiveBusinessHours.close1);
      
      // Gerar slots com o intervalo configurado
      for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        // Verificar se há conflito
        const serviceDuration = selectedService?.duration || selectedDuration || 30;
        const slotEndMinutes = minutes + serviceDuration;
        let isAvailable = true;
        let conflictReason = '';

        // Verificar se o serviço ultrapassa a meia-noite
        if (slotEndMinutes >= 24 * 60) {
          isAvailable = false;
          conflictReason = 'Serviço ultrapassaria meia-noite';
          slots.push({
            time: timeString,
            isAvailable,
            reason: conflictReason
          });
          continue;
        }

        // Verificar se o horário está bloqueado pelo profissional
        if (professionalBlockedHours.includes(timeString)) {
          isAvailable = false;
          conflictReason = 'Horário Fechado';
        }

        // Verificar se o horário está dentro do intervalo de almoço do profissional
        if (isAvailable && professionalWorkHours && professionalWorkHours[dayOfWeek] && professionalWorkHours[dayOfWeek].enabled) {
          const workDay = professionalWorkHours[dayOfWeek];
          if (workDay.break_start && workDay.break_end) {
            const breakStartMinutes = timeToMinutes(workDay.break_start);
            const breakEndMinutes = timeToMinutes(workDay.break_end);
            
            // Verificar se o horário está dentro do intervalo de almoço
            if (minutes >= breakStartMinutes && minutes < breakEndMinutes) {
              isAvailable = false;
              conflictReason = 'Horário de Intervalo';
            }
          }
        }

        // Verificar conflitos com agendamentos existentes (apenas se não estiver bloqueado)
        if (isAvailable) {
          for (const appointment of relevantAppointments) {
            const aptStartMinutes = timeToMinutes(appointment.appointment_time);
            const aptEndMinutes = aptStartMinutes + appointment.duration;
            
            // Verificar sobreposição - CORRIGIDO: não adicionar bloqueio extra
            if (!(slotEndMinutes <= aptStartMinutes || minutes >= aptEndMinutes)) {
              isAvailable = false;
              conflictReason = 'Horário Reservado';
              break;
            }
          }
        }

        // Verificar se o serviço não ultrapassa o horário de funcionamento
        if (isAvailable && slotEndMinutes > endMinutes) {
          isAvailable = false;
          conflictReason = 'Serviço ultrapassaria horário';
        }

        // Verificar se o horário já passou (apenas para clientes logados)
        if (isTimeInPast(timeString)) {
          isAvailable = false;
          conflictReason = 'Horário já passou';
        }

        slots.push({
          time: timeString,
          isAvailable,
          reason: conflictReason
        });
      }
    }

    // Se houver segundo período, gerar horários para ele também
    if (effectiveBusinessHours.open2 && effectiveBusinessHours.close2) {
      const startMinutes = timeToMinutes(effectiveBusinessHours.open2);
      const endMinutes = timeToMinutes(effectiveBusinessHours.close2);
      
      for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        const serviceDuration = selectedService?.duration || selectedDuration || 30;
        const slotEndMinutes = minutes + serviceDuration;
        let isAvailable = true;
        let conflictReason = '';

        // Verificar se o serviço ultrapassa a meia-noite
        if (slotEndMinutes >= 24 * 60) {
          isAvailable = false;
          conflictReason = 'Serviço ultrapassaria meia-noite';
          slots.push({
            time: timeString,
            isAvailable,
            reason: conflictReason
          });
          continue;
        }

        // Verificar se o horário está bloqueado pelo profissional
        if (professionalBlockedHours.includes(timeString)) {
          isAvailable = false;
          conflictReason = 'Horário Fechado';
        }

        // Verificar se o horário está dentro do intervalo de almoço do profissional
        if (isAvailable && professionalWorkHours && professionalWorkHours[dayOfWeek] && professionalWorkHours[dayOfWeek].enabled) {
          const workDay = professionalWorkHours[dayOfWeek];
          if (workDay.break_start && workDay.break_end) {
            const breakStartMinutes = timeToMinutes(workDay.break_start);
            const breakEndMinutes = timeToMinutes(workDay.break_end);
            
            // Verificar se o horário está dentro do intervalo de almoço
            if (minutes >= breakStartMinutes && minutes < breakEndMinutes) {
              isAvailable = false;
              conflictReason = 'Horário de Intervalo';
            }
          }
        }

        // Verificar conflitos com agendamentos existentes (apenas se não estiver bloqueado)
        if (isAvailable) {
          for (const appointment of relevantAppointments) {
            const aptStartMinutes = timeToMinutes(appointment.appointment_time);
            const aptEndMinutes = aptStartMinutes + appointment.duration;
            
            // Verificar sobreposição - CORRIGIDO: não adicionar bloqueio extra
            if (!(slotEndMinutes <= aptStartMinutes || minutes >= aptEndMinutes)) {
              isAvailable = false;
              conflictReason = 'Horário Reservado';
              break;
            }
          }
        }

        if (isAvailable && slotEndMinutes > endMinutes) {
          isAvailable = false;
          conflictReason = 'Serviço ultrapassaria horário';
        }

        // Verificar se o horário já passou (apenas para clientes logados)
        if (isTimeInPast(timeString)) {
          isAvailable = false;
          conflictReason = 'Horário já passou';
        }

        slots.push({
          time: timeString,
          isAvailable,
          reason: conflictReason
        });
      }
    }

    return slots;
  };

  const timeSlots = generateTimeSlots();

  if (timeSlots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Nenhum horário disponível para este dia</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {timeSlots.map(({ time, isAvailable, reason }) => {
        const isSelected = selectedTime === time;
        const isReserved = reason === 'Horário Reservado';
        const isBlocked = reason === 'Horário Fechado';
        const isIntervalTime = reason === 'Horário de Intervalo';
        const isUltrapassedTime = reason === 'Serviço ultrapassaria horário';
        const isPastTime = reason === 'Horário já passou';
        const isDisabled = !isAvailable || isReserved || isBlocked || isIntervalTime || isUltrapassedTime || isPastTime;

        return (
          <button
            type="button"
            key={time}
            onClick={() => !isDisabled && onTimeSelect(time)}
            disabled={isDisabled}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${isSelected 
                ? 'bg-primary text-white shadow-lg scale-105' 
                : isDisabled
                  ? 'bg-red-600 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105'
              }
              ${isReserved ? 'bg-red-600 text-white cursor-not-allowed' : ''}
            `}
          >
            <div className="flex flex-col items-center">
              <span>{time}</span>
              {isReserved && (
                <span className="text-xs mt-1 text-white">Horário Reservado</span>
              )}
              {isBlocked && (
                <span className="text-xs mt-1 text-white">Horário Fechado</span>
              )}
              {isIntervalTime && (
                <span className="text-xs mt-1 text-white">Horário de Intervalo</span>
              )}
              {isUltrapassedTime && (
                <span className="text-xs mt-1 text-white">Serviço ultrapassaria horário</span>
              )}
              {isPastTime && (
                <span className="text-xs mt-1 text-white">Horário já passou</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
} 