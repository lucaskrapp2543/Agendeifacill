import React from 'react';
import { format } from 'date-fns';

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
  selectedDuration: number;
  existingAppointments: Appointment[];
  selectedProfessional: string;
  onSelectTime: (time: string) => void;
  selectedTime?: string;
  businessHours: {
    open1: string;
    close1: string;
    open2: string;
    close2: string;
  };
}

export function TimeSlotSelector({
  selectedDate,
  selectedDuration,
  existingAppointments,
  selectedProfessional,
  onSelectTime,
  selectedTime,
  businessHours
}: TimeSlotSelectorProps) {
  // Função para converter horário HH:mm para minutos totais
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Função para gerar os horários disponíveis
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    
    // Filtrar agendamentos para o dia e profissional específicos
    const relevantAppointments = existingAppointments.filter(apt => 
      apt.appointment_date === selectedDateString &&
      apt.professional === selectedProfessional &&
      apt.status !== 'cancelled'
    );

    // Gerar horários para os dois períodos
    const periods = [
      { start: businessHours.open1, end: businessHours.close1 },
      { start: businessHours.open2, end: businessHours.close2 }
    ];

    for (const period of periods) {
      if (!period.start || !period.end) continue;
      
      const startMinutes = timeToMinutes(period.start);
      const endMinutes = timeToMinutes(period.end);
      
      // Gerar slots de 15 em 15 minutos
      for (let minutes = startMinutes; minutes < endMinutes; minutes += 15) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeString = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        
        // Verificar se há conflito
        const slotEndMinutes = minutes + selectedDuration;
        let isAvailable = true;
        let conflictReason = '';

        // Verificar conflitos com agendamentos existentes
        for (const appointment of relevantAppointments) {
          const aptStartMinutes = timeToMinutes(appointment.appointment_time);
          const aptEndMinutes = aptStartMinutes + appointment.duration;
          
          // Verificar sobreposição
          if (!(slotEndMinutes <= aptStartMinutes || minutes >= aptEndMinutes)) {
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
        return (
          <button
            key={time}
            onClick={() => {
              if (isAvailable) {
                onSelectTime(time);
              }
            }}
            disabled={!isAvailable}
            className={`
              p-3 rounded-lg border text-sm font-medium transition-all duration-200
              ${!isAvailable 
                ? 'bg-red-500 border-red-600 text-white cursor-not-allowed' 
                : isSelected
                  ? 'bg-green-500 border-green-600 text-white'
                  : 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200'
              }
            `}
          >
            <div className="text-center">
              <div className={!isAvailable ? 'line-through' : ''}>{time}</div>
              {!isAvailable && (
                <div className="text-xs mt-1">{reason}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
} 