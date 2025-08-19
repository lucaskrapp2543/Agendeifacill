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
}

export function TimeSlotSelector({
  selectedDate,
  selectedService,
  existingAppointments,
  selectedTime,
  onTimeSelect,
  businessHours,
  use15MinuteInterval = false // Valor padrão false (15 em 15 min)
}: TimeSlotSelectorProps) {
  // Função para converter horário HH:mm para minutos totais
  const timeToMinutes = (time: string | null): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Função para gerar os horários disponíveis
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    
    // Se não houver horários de funcionamento ou não estiver habilitado, retornar array vazio
    if (!businessHours || !businessHours.enabled || !selectedService) {
      return slots;
    }

    // Filtrar agendamentos para o dia específico
    const relevantAppointments = existingAppointments.filter(apt => 
      apt.appointment_date === selectedDateString &&
      apt.status !== 'cancelled'
    );

    console.log('🕒 TimeSlotSelector - Gerando horários:');
    console.log('  - businessHours:', businessHours);
    console.log('  - relevantAppointments:', relevantAppointments);

    // Determinar o intervalo baseado na configuração
    const interval = use15MinuteInterval ? 30 : 15;
    
    // Gerar horários para o primeiro período
    if (businessHours.open1 && businessHours.close1) {
      const startMinutes = timeToMinutes(businessHours.open1);
      const endMinutes = timeToMinutes(businessHours.close1);
      
      // Gerar slots com o intervalo configurado
      for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        // Verificar se há conflito
        const slotEndMinutes = minutes + (selectedService?.duration || 30);
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

        // Verificar conflitos com agendamentos existentes
        for (const appointment of relevantAppointments) {
          const aptStartMinutes = timeToMinutes(appointment.appointment_time);
          const aptEndMinutes = aptStartMinutes + appointment.duration;
          
          // Se usar intervalo de 15 min, adicionar 15 min de bloqueio após o serviço
          const blockEndMinutes = use15MinuteInterval ? aptEndMinutes + 15 : aptEndMinutes;
          
          // Verificar sobreposição
          if (!(slotEndMinutes <= aptStartMinutes || minutes >= blockEndMinutes)) {
            isAvailable = false;
            conflictReason = 'Horário Reservado';
            break;
          }
        }

        // Verificar se o serviço não ultrapassa o horário de funcionamento
        if (slotEndMinutes > endMinutes) {
          isAvailable = false;
          conflictReason = 'Serviço ultrapassaria horário';
        }

        slots.push({
          time: timeString,
          isAvailable,
          reason: conflictReason
        });
      }
    }

    // Se houver segundo período, gerar horários para ele também
    if (businessHours.open2 && businessHours.close2) {
      const startMinutes = timeToMinutes(businessHours.open2);
      const endMinutes = timeToMinutes(businessHours.close2);
      
      for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        const slotEndMinutes = minutes + (selectedService?.duration || 30);
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

        // Verificar conflitos com agendamentos existentes
        for (const appointment of relevantAppointments) {
          const aptStartMinutes = timeToMinutes(appointment.appointment_time);
          const aptEndMinutes = aptStartMinutes + appointment.duration;
          
          // Se usar intervalo de 15 min, adicionar 15 min de bloqueio após o serviço
          const blockEndMinutes = use15MinuteInterval ? aptEndMinutes + 15 : aptEndMinutes;
          
          if (!(slotEndMinutes <= aptStartMinutes || minutes >= blockEndMinutes)) {
            isAvailable = false;
            conflictReason = 'Horário Reservado';
            break;
          }
        }

        if (slotEndMinutes > endMinutes) {
          isAvailable = false;
          conflictReason = 'Serviço ultrapassaria horário';
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
        const isUltrapassedTime = reason === 'Serviço ultrapassaria horário';
        const isDisabled = !isAvailable || isReserved || isUltrapassedTime;

        return (
          <button
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
              {isUltrapassedTime && (
                <span className="text-xs mt-1 text-white">Serviço ultrapassaria horário</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
} 