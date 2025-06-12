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

  // Função para gerar os horários disponíveis
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const [startHour, startMinute] = businessHours.open.split(':').map(Number);
    const [endHour, endMinute] = businessHours.close.split(':').map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    // Formato da data para comparação com o banco
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    
    console.log('🚀 INICIANDO VERIFICAÇÃO DE CONFLITOS');
    console.log('📅 Data:', selectedDateString);
    console.log('👤 Profissional:', selectedProfessional);
    console.log('⏱️ Duração do novo serviço:', selectedDuration, 'minutos');
    console.log('📋 Agendamentos recebidos:', existingAppointments.length);
    
    // Filtrar agendamentos válidos para o dia e profissional
    const relevantAppointments = existingAppointments.filter(apt => {
      const isValidDate = apt.appointment_date === selectedDateString;
      const isValidProfessional = apt.professional === selectedProfessional;
      const isNotCancelled = apt.status !== 'cancelled';
      
      return isValidDate && isValidProfessional && isNotCancelled;
    });
    
    console.log('🎯 Agendamentos relevantes filtrados:', relevantAppointments.length);
    relevantAppointments.forEach((apt, index) => {
      console.log(`📋 Agendamento ${index + 1}: ${apt.appointment_time} (${apt.duration}min) - ${apt.appointment_time} até ${timeToMinutes(apt.appointment_time) + apt.duration} min totais`);
    });
    
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
      
      // NOVA LÓGICA MAIS RIGOROSA DE VERIFICAÇÃO DE CONFLITOS
      for (const appointment of relevantAppointments) {
        const aptStartMinutes = timeToMinutes(appointment.appointment_time);
        const aptEndMinutes = aptStartMinutes + appointment.duration;
        
        // Verificar TODAS as possibilidades de conflito:
        // 1. Novo slot começa antes do agendamento existente terminar E termina depois do agendamento existente começar
        const hasConflict = !(slotEndMinutes <= aptStartMinutes || slotStartMinutes >= aptEndMinutes);
        
        if (hasConflict) {
          isAvailable = false;
          conflictReason = `Conflito com agendamento às ${appointment.appointment_time}`;
          
          console.log(`🔴 CONFLITO DETECTADO em ${timeString}:`);
          console.log(`   ➤ Novo slot: ${timeString} (${slotStartMinutes} a ${slotEndMinutes} minutos)`);
          console.log(`   ➤ Agendamento existente: ${appointment.appointment_time} (${aptStartMinutes} a ${aptEndMinutes} minutos)`);
          console.log(`   ➤ Motivo: Sobreposição de horários`);
          break;
        }
      }
      
      // Verificar se o slot cabe no horário de funcionamento
      const businessEndMinutes = timeToMinutes(businessHours.close);
      if (slotEndMinutes > businessEndMinutes) {
        isAvailable = false;
        conflictReason = 'Excede horário de funcionamento';
        console.log(`⚠️ ${timeString}: Excede horário (fim em ${slotEndMinutes}, limite ${businessEndMinutes})`);
      }
      
      // Log detalhado para debug dos horários críticos (08:00 a 10:00)
      if (slotStartMinutes >= 480 && slotStartMinutes <= 600) { // 08:00 a 10:00
        console.log(`🔍 SLOT CRÍTICO ${timeString}:`);
        console.log(`   ⏰ Período: ${slotStartMinutes} a ${slotEndMinutes} minutos`);
        console.log(`   ✅ Status: ${isAvailable ? 'DISPONÍVEL' : 'BLOQUEADO'}`);
        if (!isAvailable) {
          console.log(`   ❌ Motivo: ${conflictReason}`);
        }
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

    console.log('📊 RESUMO FINAL:');
    console.log(`   Total de slots: ${slots.length}`);
    console.log(`   Disponíveis: ${slots.filter(s => s.isAvailable).length}`);
    console.log(`   Bloqueados: ${slots.filter(s => !s.isAvailable).length}`);

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
                console.log('✅ HORÁRIO SELECIONADO VÁLIDO:', time);
                console.log(`   ⏱️ Duração: ${selectedDuration} minutos`);
                console.log(`   🔚 Terminará às: ${Math.floor((timeToMinutes(time) + selectedDuration) / 60)}:${String((timeToMinutes(time) + selectedDuration) % 60).padStart(2, '0')}`);
                onSelectTime(time);
              } else {
                console.log('🚫 TENTATIVA DE SELEÇÃO DE HORÁRIO BLOQUEADO:', time);
                console.log(`   ❌ Motivo: ${reason}`);
                console.log('   ⚠️ Este horário não deveria estar clicável!');
                alert(`Horário indisponível: ${reason}`);
              }
            }}
            disabled={!isAvailable}
            title={!isAvailable ? reason : `Horário disponível: ${time} (termina às ${Math.floor((timeToMinutes(time) + selectedDuration) / 60)}:${String((timeToMinutes(time) + selectedDuration) % 60).padStart(2, '0')})`}
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