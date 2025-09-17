import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeSlotSelector } from './TimeSlotSelector';

interface BusinessHours {
  enabled: boolean;
  open1: string;
  close1: string;
  open2: string | null;
  close2: string | null;
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
  professionalAbsences?: string[]; // Dias de ausência do profissional
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
  selectedServiceDuration = 30,
  professionalAbsences = []
}: BusinessHoursSelectorProps) {
  const dayOfWeek = format(selectedDate, 'EEEE', { locale: ptBR });
  const dayKey = dayOfWeek.toLowerCase() as keyof typeof businessHours;
  const businessHoursForDay = businessHours[dayKey];

  console.log('🕒 BusinessHoursSelector - Dados recebidos:');
  console.log('  - businessHours:', businessHours);
  console.log('  - dayKey:', dayKey);
  console.log('  - businessHoursForDay:', businessHoursForDay);

  const handleTimeChange = (time: string) => {
    console.log('⏰ Horário selecionado:', time);
    onChange(time);
  };

  if (!businessHoursForDay?.enabled) {
    return (
      <div className="text-red-500 text-sm">
        Estabelecimento fechado neste dia
      </div>
    );
  }

  return (
    <div className={className}>
      <TimeSlotSelector
        selectedDate={selectedDate}
        selectedDuration={selectedServiceDuration}
        existingAppointments={existingAppointments}
        selectedProfessional={selectedProfessional}
        onSelectTime={handleTimeChange}
        selectedTime={value}
        businessHours={businessHoursForDay}
        professionalAbsences={professionalAbsences}
      />
    </div>
  );
} 