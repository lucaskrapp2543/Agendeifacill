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
    open: string;
    close: string;
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

  // Função para verificar se dois intervalos de tempo se sobrepõem - VERSÃO MAIS ASSERTIVA
  const timeIntervalsOverlap = (
    start1: number, 
    end1: number, 
    start2: number, 
    end2: number
  ): boolean => {
    // Dois intervalos se sobrepõem se um não termina antes do outro começar
    // OU se um está totalmente contido no outro
    // OU se há qualquer sobreposição, mesmo de 1 minuto
    return (start1 < end2 && end1 > start2);
  };

  // Função para gerar os horários disponíveis
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const [startHour, startMinute] = businessHours.open.split(':').map(Number);
    const [endHour, endMinute] = businessHours.close.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    // Formato da data para comparação com o banco
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    
    // Logs simplificados
    if (existingAppointments.length > 0) {
      console.log('📅 Verificando horários para:', selectedDateString, 'Profissional:', selectedProfessional, 'Agendamentos:', existingAppointments.length);
    }
    
    // Filtrar agendamentos válidos para o dia e profissional
    const relevantAppointments = existingAppointments.filter(apt => {
      const isValidDate = apt.appointment_date === selectedDateString;
      const isValidProfessional = apt.professional === selectedProfessional;
      const isNotCancelled = apt.status !== 'cancelled';
      
      // Log simplificado
      
      return isValidDate && isValidProfessional && isNotCancelled;
    });
    
    // Log apenas se houver agendamentos relevantes
    if (relevantAppointments.length > 0) {
      console.log('🎯 Agendamentos relevantes:', relevantAppointments.length);
    }
    
    // Gera slots de 15 em 15 minutos
    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMinute <= endMinute)
    ) {
      const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      
      // Calcular início e fim do slot atual (em minutos)
      const slotStartMinutes = timeToMinutes(timeString);
      const slotEndMinutes = slotStartMinutes + selectedDuration;
      
      // Verificar se há conflito com algum agendamento existente
      let isAvailable = true;
      let conflictReason = '';
      let conflictDetails = '';
      
      for (const appointment of relevantAppointments) {
        const aptStartMinutes = timeToMinutes(appointment.appointment_time);
        const aptEndMinutes = aptStartMinutes + appointment.duration;
        
        // Verificar se há sobreposição - LÓGICA MAIS ASSERTIVA
        const hasConflict = timeIntervalsOverlap(
          slotStartMinutes,
          slotEndMinutes,
          aptStartMinutes,
          aptEndMinutes
        );
        
        if (hasConflict) {
          isAvailable = false;
          conflictReason = `Conflito com agendamento às ${appointment.appointment_time}`;
          conflictDetails = `Slot ${timeString} (${slotStartMinutes}-${slotEndMinutes}) vs Agendamento ${appointment.appointment_time} (${aptStartMinutes}-${aptEndMinutes})`;
          
          // Log simplificado de conflito
          console.log(`🔴 Conflito: ${timeString} vs agendamento ${appointment.appointment_time}`);
          break;
        }
      }
      
      // Verificar se o slot cabe no horário de funcionamento
      const businessEndMinutes = timeToMinutes(businessHours.close);
      if (slotEndMinutes > businessEndMinutes) {
        isAvailable = false;
        conflictReason = 'Excede horário de funcionamento';
      }
      
      // Log simplificado apenas para horários conflitantes
      if (!isAvailable && conflictReason) {
        console.log(`⚠️ ${timeString}: ${conflictReason}`);
      }

      slots.push({
        time: timeString,
        isAvailable,
        reason: conflictReason
      });

      // Avança 15 minutos
      currentMinute += 15;
      if (currentMinute >= 60) {
        currentHour += 1;
        currentMinute = 0;
      }
    }

    // Log final simplificado
    const unavailableSlots = slots.filter(s => !s.isAvailable);
    if (unavailableSlots.length > 0) {
      console.log(`⚠️ ${unavailableSlots.length} horários indisponíveis de ${slots.length} slots`);
    }

    return slots;
  };

  const timeSlots = generateTimeSlots();

  if (timeSlots.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        Nenhum horário disponível para este dia
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
                console.log('🕐 HORÁRIO SELECIONADO:', time);
                onSelectTime(time);
              } else {
                console.log('🚫 TENTATIVA DE SELEÇÃO DE HORÁRIO BLOQUEADO:', time, reason);
              }
            }}
            disabled={!isAvailable}
            title={!isAvailable ? reason : `Horário disponível: ${time}`}
            className={`
              flex flex-col items-center justify-center p-3 rounded-lg border
              transition-colors duration-200
              ${!isAvailable 
                ? 'bg-red-600 border-red-700 text-white cursor-not-allowed' 
                : isSelected
                  ? 'bg-green-500/20 border-green-500 text-green-500'
                  : 'bg-green-500/10 border-green-500/20 text-green-500 hover:border-green-500 hover:bg-green-500/20'
              }
            `}
          >
            <div className="flex flex-col items-center gap-1">
              <span className={!isAvailable ? 'line-through' : ''}>
                {time}
              </span>
              {!isAvailable && (
                <span className="text-[10px] font-medium">
                  Horário Reservado
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
} 