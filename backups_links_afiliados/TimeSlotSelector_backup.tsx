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
  // Função para gerar os horários disponíveis
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const [startHour, startMinute] = businessHours.open.split(':').map(Number);
    const [endHour, endMinute] = businessHours.close.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    // CORREÇÃO DEFINITIVA DO PROBLEMA DE TIMEZONE
    // O input type="date" retorna formato yyyy-mm-dd
    // Vamos pegar diretamente esse formato para comparar com o banco
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    
    console.log('=== TimeSlotSelector Debug ===');
    console.log('selectedDate object:', selectedDate);
    console.log('selectedDateString (format):', selectedDateString);
    console.log('selectedProfessional:', selectedProfessional);
    console.log('existingAppointments:', existingAppointments.map(apt => ({
      date: apt.appointment_date,
      time: apt.appointment_time,
      professional: apt.professional
    })));
    
    // Gera slots de 15 em 15 minutos
    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMinute <= endMinute)
    ) {
      const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      
      // Para horários específicos que sabemos que têm agendamento
      const shouldLogDetails = timeString === '09:45' || timeString === '05:00' || timeString === '08:00';
      
      if (shouldLogDetails) {
        console.log(`\n🕐 Checking time slot: ${timeString}`);
      }
      
      // Verifica se o horário está disponível
      const isAvailable = !existingAppointments.some(appointment => {
        if (shouldLogDetails) {
          console.log(`  📋 Checking appointment:`, appointment);
        }
        
        // Ignora agendamentos cancelados
        if (appointment.status === 'cancelled') {
          if (shouldLogDetails) console.log(`  ❌ Skipped: cancelled`);
          return false;
        }

        // Verifica se é o mesmo profissional e o mesmo dia
        const sameDate = appointment.appointment_date === selectedDateString;
        const sameProfessional = appointment.professional === selectedProfessional;
        
        if (shouldLogDetails) {
          console.log(`  📅 Date match: ${sameDate} (${appointment.appointment_date} vs ${selectedDateString})`);
          console.log(`  👤 Professional match: ${sameProfessional}`);
        }
        
        if (!sameProfessional || !sameDate) {
          if (shouldLogDetails) console.log(`  ⏭️ Skipped: different professional or date`);
          return false;
        }

        if (shouldLogDetails) console.log(`  ✅ MATCH! Checking time overlap...`);

        // Converte horários para minutos para facilitar comparação
        const [aptHour, aptMinute] = appointment.appointment_time.split(':').map(Number);
        const aptStartMinutes = aptHour * 60 + aptMinute;
        const aptEndMinutes = aptStartMinutes + appointment.duration;

        const currentTimeMinutes = currentHour * 60 + currentMinute;
        const currentEndMinutes = currentTimeMinutes + selectedDuration;

        if (shouldLogDetails) {
          console.log(`  ⏰ Appointment: ${aptStartMinutes}-${aptEndMinutes} min (${appointment.appointment_time} + ${appointment.duration}min)`);
          console.log(`  ⏰ Current slot: ${currentTimeMinutes}-${currentEndMinutes} min (${timeString} + ${selectedDuration}min)`);
        }

        // Verifica sobreposição de horários - LÓGICA SIMPLIFICADA E ROBUSTA
        // Um slot está ocupado se há QUALQUER sobreposição com um agendamento existente
        const hasOverlap = !(currentEndMinutes <= aptStartMinutes || currentTimeMinutes >= aptEndMinutes);
        
        if (shouldLogDetails) {
          console.log(`  🔍 Overlap logic:`);
          console.log(`    Agendamento: ${aptStartMinutes}-${aptEndMinutes} min`);
          console.log(`    Slot atual: ${currentTimeMinutes}-${currentEndMinutes} min`);
          console.log(`    Slot termina antes do agendamento: ${currentEndMinutes <= aptStartMinutes}`);
          console.log(`    Slot começa depois do agendamento: ${currentTimeMinutes >= aptEndMinutes}`);
          console.log(`    SEM sobreposição: ${currentEndMinutes <= aptStartMinutes || currentTimeMinutes >= aptEndMinutes}`);
          console.log(`    TEM sobreposição: ${hasOverlap}`);
        }

        if (hasOverlap) {
          console.log(`🔴 HORÁRIO BLOQUEADO: ${timeString} - conflito com ${appointment.appointment_time}`);
        }

        return hasOverlap;
      });

      if (shouldLogDetails) {
        console.log(`✨ Time slot ${timeString} final result: ${isAvailable ? 'AVAILABLE' : 'BLOCKED'}`);
      }

      slots.push({
        time: timeString,
        isAvailable
      });

      // Avança 15 minutos
      currentMinute += 15;
      if (currentMinute >= 60) {
        currentHour += 1;
        currentMinute = 0;
      }
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
      {timeSlots.map(({ time, isAvailable }) => {
        const isSelected = selectedTime === time;
        
        return (
          <button
            key={time}
            onClick={() => {
              if (isAvailable) {
                console.log('🕐 HORÁRIO SELECIONADO:', time);
                onSelectTime(time);
              }
            }}
            disabled={!isAvailable}
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