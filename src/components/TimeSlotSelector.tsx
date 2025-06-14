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

  // Função para gerar os horários disponíveis considerando dois períodos
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const periods = [
      { start: businessHours.open1, end: businessHours.close1 },
      { start: businessHours.open2, end: businessHours.close2 },
    ];
    const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
    
    console.log('🚀 INICIANDO VERIFICAÇÃO DE CONFLITOS - TimeSlotSelector');
    console.log('📅 Data:', selectedDateString);
    console.log('👤 Profissional:', selectedProfessional);
    console.log('⏱️ Duração do novo serviço:', selectedDuration, 'minutos');
    console.log('📋 Agendamentos recebidos (TOTAL):', existingAppointments.length);
    console.log('🏢 Horários de funcionamento:', businessHours);
    
    // Log de todos os agendamentos recebidos
    if (existingAppointments.length > 0) {
      console.log('📋 TODOS OS AGENDAMENTOS RECEBIDOS:');
      existingAppointments.forEach((apt, index) => {
        console.log(`   ${index + 1}: Data=${apt.appointment_date}, Hora=${apt.appointment_time}, Profissional=${apt.professional}, Status=${apt.status}, Duração=${apt.duration}min`);
      });
    } else {
      console.log('✅ NENHUM AGENDAMENTO RECEBIDO - Todos os horários deveriam estar disponíveis!');
    }
    
    // Filtrar agendamentos válidos para o dia e profissional
    const relevantAppointments = existingAppointments.filter(apt => {
      const isValidDate = apt.appointment_date === selectedDateString;
      const isValidProfessional = apt.professional === selectedProfessional;
      const isNotCancelled = apt.status !== 'cancelled';
      
      console.log(`🔍 Filtrando agendamento ${apt.appointment_time}:`, {
        isValidDate: `${apt.appointment_date} === ${selectedDateString} = ${isValidDate}`,
        isValidProfessional: `${apt.professional} === ${selectedProfessional} = ${isValidProfessional}`,
        isNotCancelled: `${apt.status} !== 'cancelled' = ${isNotCancelled}`,
        includeInFilter: isValidDate && isValidProfessional && isNotCancelled
      });
      
      return isValidDate && isValidProfessional && isNotCancelled;
    });
    
    console.log('🎯 Agendamentos relevantes APÓS FILTRO:', relevantAppointments.length);
    if (relevantAppointments.length > 0) {
      relevantAppointments.forEach((apt, index) => {
        const startMin = timeToMinutes(apt.appointment_time);
        const endMin = startMin + apt.duration;
        console.log(`🎯 Relevante ${index + 1}: ${apt.appointment_time} (${startMin}-${endMin} min) - Duração: ${apt.duration}min`);
      });
    } else {
      console.log('✅ NENHUM AGENDAMENTO RELEVANTE - Todos os horários no período de funcionamento deveriam estar disponíveis!');
    }
    
    for (const period of periods) {
      if (!period.start || !period.end) {
        console.log(`⚠️ Período inválido ignorado:`, period);
        continue;
      }
      
      console.log(`🕐 Processando período: ${period.start} - ${period.end}`);
      
      const [startHour, startMinute] = period.start.split(':').map(Number);
      const [endHour, endMinute] = period.end.split(':').map(Number);
      let currentHour = startHour;
      let currentMinute = startMinute;
      
      while (
        currentHour < endHour ||
        (currentHour === endHour && currentMinute <= endMinute)
      ) {
        const timeString = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        
        // Calcular início e fim do slot atual (em minutos)
        const slotStartMinutes = timeToMinutes(timeString);
        const slotEndMinutes = slotStartMinutes + selectedDuration;
        
        // LÓGICA SIMPLIFICADA: Assumir que todos os horários estão disponíveis por padrão
        let isAvailable = true;
        let conflictReason = '';
        let conflictDetails = '';
        
        // VERIFICAÇÃO 1: Conflitos com agendamentos existentes
        if (relevantAppointments.length > 0) {
          for (const appointment of relevantAppointments) {
            const aptStartMinutes = timeToMinutes(appointment.appointment_time);
            const aptEndMinutes = aptStartMinutes + appointment.duration;
            
            // Lógica de sobreposição: dois intervalos se sobrepõem se um não termina antes do outro começar
            const hasConflict = !(slotEndMinutes <= aptStartMinutes || slotStartMinutes >= aptEndMinutes);
            
            if (hasConflict) {
              isAvailable = false;
              conflictReason = `Conflito com agendamento às ${appointment.appointment_time}`;
              conflictDetails = `Slot ${timeString} (${slotStartMinutes}-${slotEndMinutes}) vs Agendamento ${appointment.appointment_time} (${aptStartMinutes}-${aptEndMinutes})`;
              console.log(`🔴 CONFLITO DETECTADO: ${conflictDetails}`);
              break;
            }
          }
        }
        
        // VERIFICAÇÃO 2: Respeitar intervalo de almoço (se houver dois períodos)
        if (isAvailable && periods.length === 2 && periods[0].end && periods[1].start) {
          const firstPeriodEndMinutes = timeToMinutes(periods[0].end);    // 11:30 = 690min
          const secondPeriodStartMinutes = timeToMinutes(periods[1].start); // 14:00 = 840min
          
          // Se há intervalo entre os períodos (ex: 11:30-14:00)
          if (firstPeriodEndMinutes < secondPeriodStartMinutes) {
            // REGRA 1: O serviço NÃO pode terminar durante o intervalo
            // Se o slot está no primeiro período
            if (slotStartMinutes < firstPeriodEndMinutes) {
              // O serviço deve terminar ANTES ou EXATAMENTE no início do intervalo
              if (slotEndMinutes > firstPeriodEndMinutes) {
                isAvailable = false;
                conflictReason = 'Serviço terminaria durante o intervalo';
                conflictDetails = `Serviço de ${timeString} (${selectedDuration}min) terminaria às ${Math.floor(slotEndMinutes/60)}:${String(slotEndMinutes%60).padStart(2,'0')}, mas intervalo começa às ${periods[0].end}`;
              }
            }
            
            // REGRA 2: NÃO pode agendar DURANTE o intervalo
            // Se o slot começa durante o intervalo (entre fim do 1º período e início do 2º período)
            if (slotStartMinutes >= firstPeriodEndMinutes && slotStartMinutes < secondPeriodStartMinutes) {
              isAvailable = false;
              conflictReason = 'Horário está durante o intervalo';
              conflictDetails = `Horário ${timeString} está no intervalo de ${periods[0].end} às ${periods[1].start}`;
            }
            
            // Se o slot está no segundo período, está OK (já começa após o intervalo)
          }
        }
        
        // Log detalhado para horários específicos que estão sendo bloqueados incorretamente
        const isProblematicTime = timeString === '11:45' || timeString === '12:00' || timeString === '11:30' || timeString === '12:15' || timeString === '18:45' || timeString === '19:00';
        if (isProblematicTime || !isAvailable) {
          console.log(`🔍 ANÁLISE DETALHADA - ${timeString}:`);
          console.log(`   ⏰ Slot: ${slotStartMinutes}-${slotEndMinutes} min (${timeString} + ${selectedDuration}min)`);
          console.log(`   📋 Agendamentos relevantes: ${relevantAppointments.length}`);
          console.log(`   🍽️ Intervalo: ${periods[0]?.end || 'N/A'} - ${periods[1]?.start || 'N/A'}`);
          console.log(`   ✅ Status: ${isAvailable ? 'DISPONÍVEL' : 'BLOQUEADO'}`);
          if (!isAvailable) {
            console.log(`   ❌ Motivo: ${conflictReason}`);
            console.log(`   📝 Detalhes: ${conflictDetails}`);
          }
          console.log(`   🏢 Período atual: ${period.start}-${period.end}`);
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
    }

    console.log('📊 RESUMO FINAL:');
    console.log(`   Total de slots: ${slots.length}`);
    console.log(`   Disponíveis: ${slots.filter(s => s.isAvailable).length}`);
    console.log(`   Bloqueados: ${slots.filter(s => !s.isAvailable).length}`);
    
    // Log dos slots bloqueados para debug
    const blockedSlots = slots.filter(s => !s.isAvailable);
    if (blockedSlots.length > 0) {
      console.log('❌ SLOTS BLOQUEADOS:');
      blockedSlots.forEach(slot => {
        console.log(`   ${slot.time}: ${slot.reason}`);
      });
    } else {
      console.log('✅ NENHUM SLOT BLOQUEADO - Perfeito!');
    }

    return slots;
  };

  const timeSlots = generateTimeSlots();

  if (timeSlots.length === 0) {
    return <div className="text-sm text-gray-400">Nenhum horário disponível para este dia</div>;
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
              } else {
                console.log(`❌ Tentativa de selecionar horário bloqueado: ${time} - Motivo: ${reason}`);
                alert(`Horário indisponível: ${reason}`);
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
              <span className={!isAvailable ? 'line-through' : ''}>{time}</span>
              {!isAvailable && (
                <span className="text-[10px] font-medium">Horário Reservado</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
} 