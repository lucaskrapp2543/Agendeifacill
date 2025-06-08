import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeSlotSelector } from './TimeSlotSelector';

interface BusinessHours {
  open: string;
  close: string;
  enabled: boolean;
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
  console.log('BusinessHoursSelector props:', {
    value,
    selectedDate,
    businessHours,
    existingAppointments,
    selectedProfessional,
    selectedServiceDuration
  });

  // Interceptar onChange para debug
  const handleTimeChange = (time: string) => {
    console.log('🕐 BusinessHoursSelector - Horário recebido do TimeSlotSelector:', time);
    console.log('🕐 BusinessHoursSelector - Passando para onChange:', time);
    onChange(time);
  };

  // Pegar o dia da semana em português e converter para inglês
  const dayInPortuguese = format(selectedDate, 'EEEE', { locale: ptBR }).toLowerCase();
  const dayInEnglish = weekDayMap[dayInPortuguese];
  
  // Pegar os horários do dia
  const daySchedule = businessHours[dayInEnglish];

  console.log('Day schedule:', {
    dayInPortuguese,
    dayInEnglish,
    daySchedule
  });

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
    open: formatTime(daySchedule.open),
    close: formatTime(daySchedule.close)
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