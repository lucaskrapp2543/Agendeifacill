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
  use20MinuteSchedule?: boolean; // Nova prop para horários de 20 em 20 minutos
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
  use20MinuteSchedule = false, // Valor padrão false (horários de 20 em 20 min)
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

  // Função para converter minutos para horário HH:mm
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
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

      // IMPORTANTE: Só usar horários personalizados se eles REALMENTE existirem!
      const hasCustomHours = workDay.entry_time && workDay.exit_time;

      if (hasCustomHours) {
        console.log(`🕒 TimeSlotSelector - Usando horários personalizados do profissional para ${dayOfWeek}:`, workDay);

        // Converter horários personalizados para o formato do businessHours
        // IMPORTANTE: Não tratar intervalo como segundo período, mas sim excluir esse período
        effectiveBusinessHours = {
          enabled: true,
          open1: workDay.entry_time || businessHours.open1,
          close1: workDay.exit_time || businessHours.close1,
          open2: null, // Não usar segundo período para intervalo
          close2: null // Não usar segundo período para intervalo
        };

        console.log(`🕒 TimeSlotSelector - Horários efetivos convertidos:`, effectiveBusinessHours);
      } else {
        console.log(`🕒 TimeSlotSelector - Profissional sem horários personalizados configurados, usando horários do estabelecimento`);
        effectiveBusinessHours = businessHours;
      }
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
    let interval = 15; // Padrão: 15 em 15 minutos
    if (use20MinuteSchedule) {
      interval = 20; // Horários de 20 em 20 minutos
    } else if (use15MinuteInterval) {
      interval = 30; // Horários de 30 em 30 minutos (quando MARCADO)
    }

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

        // ============================================================
        // ⚠️ ATENÇÃO: LÓGICA CRÍTICA DE HORÁRIOS BLOQUEADOS ⚠️
        // ============================================================
        // Esta lógica é EXTREMAMENTE IMPORTANTE e não deve ser alterada
        // sem entender completamente seu funcionamento!
        //
        // PROBLEMA RESOLVIDO:
        // Antes: apenas verificava se o horário de INÍCIO estava bloqueado
        // Agora: verifica se o serviço INTEIRO (início + duração) conflita
        //        com horários bloqueados, assim como intervalos e fechamento
        //
        // EXEMPLO:
        // Se profissional bloqueou: 17:00, 17:15, 17:30, 17:45
        // Serviço de 60min às 16:45 terminaria às 17:45 → DEVE SER BLOQUEADO!
        // 
        // LÓGICA IMPLEMENTADA (igual à de intervalos de almoço):
        // 1. Verifica se INÍCIO do serviço está em horário bloqueado
        // 2. Verifica se FIM do serviço está em horário bloqueado
        // 3. Verifica se serviço engloba completamente horário bloqueado
        //
        // ⚠️ SE FOR ALTERAR ESTA LÓGICA, TESTAR:
        //    - Serviço que começa antes mas termina durante horário bloqueado
        //    - Serviço que começa durante horário bloqueado
        //    - Serviço que engloba completamente horário bloqueado
        // ============================================================
        if (professionalBlockedHours.length > 0) {
          // Verificar se o INÍCIO do serviço está em um horário bloqueado
          if (professionalBlockedHours.includes(timeString)) {
            isAvailable = false;
            conflictReason = 'Horário Fechado';
          } else {
            // Verificar se o serviço (considerando sua duração) ultrapassa ou conflita com algum horário bloqueado
            for (const blockedTime of professionalBlockedHours) {
              const blockedStartMinutes = timeToMinutes(blockedTime);
              // Assumir que cada horário bloqueado tem duração mínima de 15 minutos (intervalo padrão)
              const blockedEndMinutes = blockedStartMinutes + 15;
              
              // Verificar se o INÍCIO do serviço está dentro do horário bloqueado
              const serviceStartsInBlocked = minutes >= blockedStartMinutes && minutes < blockedEndMinutes;
              // Verificar se o FIM do serviço está dentro do horário bloqueado
              const serviceEndsInBlocked = slotEndMinutes > blockedStartMinutes && slotEndMinutes <= blockedEndMinutes;
              // Verificar se o serviço engloba completamente o horário bloqueado
              const serviceEncompassesBlocked = minutes <= blockedStartMinutes && slotEndMinutes >= blockedEndMinutes;
              
              if (serviceStartsInBlocked || serviceEndsInBlocked || serviceEncompassesBlocked) {
                isAvailable = false;
                conflictReason = 'Horário Fechado';
                console.log('🚨 CONFLITO COM HORÁRIO BLOQUEADO DETECTADO:', {
                  serviceStart: minutesToTime(minutes),
                  serviceEnd: minutesToTime(slotEndMinutes),
                  blockedTime,
                  blockedStart: minutesToTime(blockedStartMinutes),
                  blockedEnd: minutesToTime(blockedEndMinutes),
                  serviceStartsInBlocked,
                  serviceEndsInBlocked,
                  serviceEncompassesBlocked
                });
                break;
              }
            }
          }
        }

        // Verificar se o horário está dentro do intervalo de almoço do profissional
        if (isAvailable && professionalWorkHours && professionalWorkHours[dayOfWeek] && professionalWorkHours[dayOfWeek].enabled) {
          const workDay = professionalWorkHours[dayOfWeek];
          if (workDay.break_start && workDay.break_end) {
            const breakStartMinutes = timeToMinutes(workDay.break_start);
            const breakEndMinutes = timeToMinutes(workDay.break_end);

            // CORRIGIDO: Verificar se o serviço INTEIRO conflita com o intervalo
            // Verificar se o INÍCIO do serviço está no intervalo
            const serviceStartsInBreak = minutes >= breakStartMinutes && minutes < breakEndMinutes;
            // Verificar se o FIM do serviço está no intervalo  
            const serviceEndsInBreak = slotEndMinutes > breakStartMinutes && slotEndMinutes <= breakEndMinutes;
            // Verificar se o serviço engloba completamente o intervalo
            const serviceEncompassesBreak = minutes <= breakStartMinutes && slotEndMinutes >= breakEndMinutes;

            if (serviceStartsInBreak || serviceEndsInBreak || serviceEncompassesBreak) {
              isAvailable = false;
              conflictReason = 'Horário de Intervalo';
              console.log('🚨 CONFLITO COM INTERVALO DETECTADO:', {
                serviceStart: minutesToTime(minutes),
                serviceEnd: minutesToTime(slotEndMinutes),
                breakStart: workDay.break_start,
                breakEnd: workDay.break_end,
                serviceStartsInBreak,
                serviceEndsInBreak,
                serviceEncompassesBreak
              });
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
              // Verificar se é reserva avulsa
              if (appointment.is_avulso) {
                conflictReason = 'RESERVA AVULSA';
              } else {
                conflictReason = 'Horário Reservado';
              }
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

        // ============================================================
        // ⚠️ ATENÇÃO: LÓGICA CRÍTICA DE HORÁRIOS BLOQUEADOS ⚠️
        // ============================================================
        // Esta lógica é EXTREMAMENTE IMPORTANTE e não deve ser alterada
        // sem entender completamente seu funcionamento!
        //
        // PROBLEMA RESOLVIDO:
        // Antes: apenas verificava se o horário de INÍCIO estava bloqueado
        // Agora: verifica se o serviço INTEIRO (início + duração) conflita
        //        com horários bloqueados, assim como intervalos e fechamento
        //
        // EXEMPLO:
        // Se profissional bloqueou: 17:00, 17:15, 17:30, 17:45
        // Serviço de 60min às 16:45 terminaria às 17:45 → DEVE SER BLOQUEADO!
        // 
        // LÓGICA IMPLEMENTADA (igual à de intervalos de almoço):
        // 1. Verifica se INÍCIO do serviço está em horário bloqueado
        // 2. Verifica se FIM do serviço está em horário bloqueado
        // 3. Verifica se serviço engloba completamente horário bloqueado
        //
        // ⚠️ SE FOR ALTERAR ESTA LÓGICA, TESTAR:
        //    - Serviço que começa antes mas termina durante horário bloqueado
        //    - Serviço que começa durante horário bloqueado
        //    - Serviço que engloba completamente horário bloqueado
        // ============================================================
        if (professionalBlockedHours.length > 0) {
          // Verificar se o INÍCIO do serviço está em um horário bloqueado
          if (professionalBlockedHours.includes(timeString)) {
            isAvailable = false;
            conflictReason = 'Horário Fechado';
          } else {
            // Verificar se o serviço (considerando sua duração) ultrapassa ou conflita com algum horário bloqueado
            for (const blockedTime of professionalBlockedHours) {
              const blockedStartMinutes = timeToMinutes(blockedTime);
              // Assumir que cada horário bloqueado tem duração mínima de 15 minutos (intervalo padrão)
              const blockedEndMinutes = blockedStartMinutes + 15;
              
              // Verificar se o INÍCIO do serviço está dentro do horário bloqueado
              const serviceStartsInBlocked = minutes >= blockedStartMinutes && minutes < blockedEndMinutes;
              // Verificar se o FIM do serviço está dentro do horário bloqueado
              const serviceEndsInBlocked = slotEndMinutes > blockedStartMinutes && slotEndMinutes <= blockedEndMinutes;
              // Verificar se o serviço engloba completamente o horário bloqueado
              const serviceEncompassesBlocked = minutes <= blockedStartMinutes && slotEndMinutes >= blockedEndMinutes;
              
              if (serviceStartsInBlocked || serviceEndsInBlocked || serviceEncompassesBlocked) {
                isAvailable = false;
                conflictReason = 'Horário Fechado';
                console.log('🚨 CONFLITO COM HORÁRIO BLOQUEADO DETECTADO:', {
                  serviceStart: minutesToTime(minutes),
                  serviceEnd: minutesToTime(slotEndMinutes),
                  blockedTime,
                  blockedStart: minutesToTime(blockedStartMinutes),
                  blockedEnd: minutesToTime(blockedEndMinutes),
                  serviceStartsInBlocked,
                  serviceEndsInBlocked,
                  serviceEncompassesBlocked
                });
                break;
              }
            }
          }
        }

        // Verificar se o horário está dentro do intervalo de almoço do profissional
        if (isAvailable && professionalWorkHours && professionalWorkHours[dayOfWeek] && professionalWorkHours[dayOfWeek].enabled) {
          const workDay = professionalWorkHours[dayOfWeek];
          if (workDay.break_start && workDay.break_end) {
            const breakStartMinutes = timeToMinutes(workDay.break_start);
            const breakEndMinutes = timeToMinutes(workDay.break_end);

            // CORRIGIDO: Verificar se o serviço INTEIRO conflita com o intervalo
            // Verificar se o INÍCIO do serviço está no intervalo
            const serviceStartsInBreak = minutes >= breakStartMinutes && minutes < breakEndMinutes;
            // Verificar se o FIM do serviço está no intervalo  
            const serviceEndsInBreak = slotEndMinutes > breakStartMinutes && slotEndMinutes <= breakEndMinutes;
            // Verificar se o serviço engloba completamente o intervalo
            const serviceEncompassesBreak = minutes <= breakStartMinutes && slotEndMinutes >= breakEndMinutes;

            if (serviceStartsInBreak || serviceEndsInBreak || serviceEncompassesBreak) {
              isAvailable = false;
              conflictReason = 'Horário de Intervalo';
              console.log('🚨 CONFLITO COM INTERVALO DETECTADO:', {
                serviceStart: minutesToTime(minutes),
                serviceEnd: minutesToTime(slotEndMinutes),
                breakStart: workDay.break_start,
                breakEnd: workDay.break_end,
                serviceStartsInBreak,
                serviceEndsInBreak,
                serviceEncompassesBreak
              });
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
              // Verificar se é reserva avulsa
              if (appointment.is_avulso) {
                conflictReason = 'RESERVA AVULSA';
              } else {
                conflictReason = 'Horário Reservado';
              }
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
        const isAvulso = reason === 'RESERVA AVULSA';
        const isBlocked = reason === 'Horário Fechado';
        const isIntervalTime = reason === 'Horário de Intervalo';
        const isUltrapassedTime = reason === 'Serviço ultrapassaria horário';
        const isPastTime = reason === 'Horário já passou';
        const isDisabled = !isAvailable || isReserved || isAvulso || isBlocked || isIntervalTime || isUltrapassedTime || isPastTime;

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
                : isAvulso
                  ? 'bg-orange-100 text-orange-800 cursor-not-allowed'
                  : isDisabled
                    ? 'bg-red-600 text-white cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 hover:scale-105'
              }
            `}
          >
            <div className="flex flex-col items-center">
              <span>{time}</span>
              {isAvulso && (
                <span className="text-xs mt-1 text-orange-600">
                  RESERVA
                </span>
              )}
              {isReserved && !isAvulso && (
                <span className="text-xs mt-1 text-white">
                  Horário Reservado
                </span>
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