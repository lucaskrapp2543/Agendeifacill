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
    
    console.log('=== 🚨 VERIFICAÇÃO CRÍTICA DE CONFLITOS ===');
    console.log('📅 Data selecionada:', selectedDateString);
    console.log('👤 Profissional selecionado:', selectedProfessional);
    console.log('⏱️ Duração do serviço:', selectedDuration, 'minutos');
    console.log('📋 Total de agendamentos recebidos:', existingAppointments.length);
    
    // Debug detalhado dos agendamentos recebidos
    existingAppointments.forEach((apt, index) => {
      console.log(`📋 Agendamento ${index + 1}:`, {
        date: apt.appointment_date,
        time: apt.appointment_time,
        duration: apt.duration,
        professional: apt.professional,
        status: apt.status
      });
    });
    
    // Filtrar agendamentos válidos para o dia e profissional
    const relevantAppointments = existingAppointments.filter(apt => {
      const isValidDate = apt.appointment_date === selectedDateString;
      const isValidProfessional = apt.professional === selectedProfessional;
      const isNotCancelled = apt.status !== 'cancelled';
      
      console.log(`🔍 Filtrando agendamento ${apt.appointment_time}:`, {
        isValidDate,
        isValidProfessional,
        isNotCancelled,
        included: isValidDate && isValidProfessional && isNotCancelled
      });
      
      return isValidDate && isValidProfessional && isNotCancelled;
    });
    
    console.log('🎯 Agendamentos relevantes filtrados:', relevantAppointments.length);
    relevantAppointments.forEach((apt, index) => {
      const startMin = timeToMinutes(apt.appointment_time);
      const endMin = startMin + apt.duration;
      console.log(`🎯 Relevante ${index + 1}: ${apt.appointment_time} (${startMin}-${endMin} min)`);
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
          
          console.log(`🔴 CONFLITO CRÍTICO DETECTADO:`);
          console.log(`   Slot: ${timeString} (${slotStartMinutes}-${slotEndMinutes} min)`);
          console.log(`   Agendamento: ${appointment.appointment_time} (${aptStartMinutes}-${aptEndMinutes} min)`);
          console.log(`   Lógica: start1=${slotStartMinutes} < end2=${aptEndMinutes} = ${slotStartMinutes < aptEndMinutes}`);
          console.log(`   Lógica: end1=${slotEndMinutes} > start2=${aptStartMinutes} = ${slotEndMinutes > aptStartMinutes}`);
          console.log(`   Resultado: HAS CONFLICT = ${hasConflict}`);
          break;
        }
      }
      
      // Verificar se o slot cabe no horário de funcionamento
      const businessEndMinutes = timeToMinutes(businessHours.close);
      if (slotEndMinutes > businessEndMinutes) {
        isAvailable = false;
        conflictReason = 'Excede horário de funcionamento';
      }
      
      // Log OBRIGATÓRIO para horários das 9h (onde o problema está ocorrendo)
      if (timeString.includes('09:')) {
        console.log(`🚨 SLOT CRÍTICO ${timeString}:`);
        console.log(`   Período: ${slotStartMinutes}-${slotEndMinutes} min`);
        console.log(`   Disponível: ${isAvailable ? '✅ DISPONÍVEL' : '❌ BLOQUEADO'}`);
        console.log(`   Agendamentos relevantes: ${relevantAppointments.length}`);
        if (!isAvailable) {
          console.log(`   Motivo: ${conflictReason}`);
          console.log(`   Detalhes: ${conflictDetails}`);
        }
        console.log('   ==========================================');
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

    // Log final dos slots das 9h
    const morning9Slots = slots.filter(s => s.time.includes('09:'));
    console.log('🌅 RESUMO DOS SLOTS DAS 9H:');
    morning9Slots.forEach(slot => {
      console.log(`   ${slot.time}: ${slot.isAvailable ? '✅' : '❌'} ${slot.reason || ''}`);
    });

    return slots;
  };

  const timeSlots = generateTimeSlots();

  if (timeSlots.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-500">
          Nenhum horário disponível para o dia selecionado.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Selecione um Horário
      </h3>
      
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {timeSlots.map((slot) => {
          const isSelected = selectedTime === slot.time;
          
          return (
            <button
              key={slot.time}
              onClick={() => slot.isAvailable && onSelectTime(slot.time)}
              disabled={!slot.isAvailable}
              title={slot.reason || (slot.isAvailable ? 'Horário disponível' : 'Horário indisponível')}
              className={`
                px-3 py-2 rounded-lg font-medium text-xs transition-all duration-200
                ${isSelected
                  ? 'bg-blue-600 text-white scale-105 shadow-md'
                  : slot.isAvailable
                    ? 'bg-green-100 text-green-800 hover:bg-green-200 hover:scale-105 hover:shadow-sm'
                    : 'bg-red-100 text-red-800 cursor-not-allowed opacity-75'
                }
              `}
            >
              <div className="text-center">
                <div className="font-semibold">{slot.time}</div>
                {!slot.isAvailable && (
                  <div className="text-xs mt-1 opacity-80">
                    Reservado
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="mt-4 text-xs text-gray-600">
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-100 rounded mr-2"></div>
            <span>Disponível</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 rounded mr-2"></div>
            <span>Ocupado</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
            <span>Selecionado</span>
          </div>
        </div>
      </div>
    </div>
  );
} 