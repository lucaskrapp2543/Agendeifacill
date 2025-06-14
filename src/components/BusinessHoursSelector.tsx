import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeSlotSelector } from './TimeSlotSelector';

interface BusinessHours {
  enabled: boolean;
  open1: string;
  close1: string;
  open2: string;
  close2: string;
}

interface BusinessHoursSelectorProps {
  value: string;
  onChange: (time: string) => void;
  selectedDate: Date;
  businessHours: Record<string, BusinessHours>;
  className?: string;
  existingAppointments?: Array<{
    appointment_date: string;
    appointment_time: string;
    duration: number;
    status?: string;
    professional?: string;
  }>;
  selectedProfessional?: string;
  selectedServiceDuration?: number;
}

const weekDayMap: Record<string, string> = {
  'domingo': 'sunday',
  'segunda-feira': 'monday',
  'terça-feira': 'tuesday',
  'quarta-feira': 'wednesday',
  'quinta-feira': 'thursday',
  'sexta-feira': 'friday',
  'sábado': 'saturday'
};

export function BusinessHoursSelector({
  value,
  onChange,
  selectedDate,
  businessHours,
  className = '',
  existingAppointments = [],
  selectedProfessional = '',
  selectedServiceDuration = 30
}: BusinessHoursSelectorProps) {
  // Log simplificado apenas quando necessário
  const handleTimeChange = (time: string) => {
    onChange(time);
  };

  // Pegar o dia da semana em português e converter para inglês
  const dayInPortuguese = format(selectedDate, 'EEEE', { locale: ptBR }).toLowerCase();
  const dayInEnglish = weekDayMap[dayInPortuguese];
  
  // Pegar os horários do dia
  const daySchedule = businessHours[dayInEnglish];

  // Log apenas se houver problema
  if (!daySchedule) {
    console.log('⚠️ Horário não encontrado para:', dayInEnglish);
  }

  if (!daySchedule || !daySchedule.enabled) {
    return (
      <div className="text-sm text-gray-400">
        Estabelecimento fechado neste dia
      </div>
    );
  }

  // Garantir que os horários estão no formato correto (HH:mm)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formattedBusinessHours = {
    open1: formatTime(daySchedule.open1),
    close1: formatTime(daySchedule.close1),
    open2: formatTime(daySchedule.open2),
    close2: formatTime(daySchedule.close2)
  };

  return (
    <div className={className}>
      <TimeSlotSelector
        selectedDate={selectedDate}
        selectedDuration={selectedServiceDuration}
        existingAppointments={existingAppointments}
        selectedProfessional={selectedProfessional}
        onSelectTime={handleTimeChange}
        selectedTime={value}
        businessHours={formattedBusinessHours}
      />
    </div>
  );
} 