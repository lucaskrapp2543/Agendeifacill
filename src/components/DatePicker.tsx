import { addMonths, format, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import React, { useState, useEffect } from 'react';

interface DatePickerProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  businessHours: Record<string, {
    enabled: boolean;
    open1: string;
    close1: string;
    open2: string | null;
    close2: string | null;
  }>;
  allowedWeekdays?: string[]; // Dias da semana permitidos para assinantes
  isSubscriberBooking?: boolean; // Indica se é agendamento de assinante
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

export function DatePicker({ selectedDate, onChange, businessHours, allowedWeekdays, isSubscriberBooking = false }: DatePickerProps) {
  const today = startOfDay(new Date());
  const maxDate = addMonths(today, 6); // Permitir agendamento até 6 meses no futuro

  // Estado para controlar o mês atual sendo visualizado
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  
  // Estado para controlar se o campo de data está vazio ou preenchido
  const [localDate, setLocalDate] = useState('');

  // Não pré-selecionar data - deixar o usuário escolher manualmente
  // Removido o useEffect que pré-selecionava a data

  const isDayEnabled = (date: Date) => {
    // Para agendamento de assinante, sempre permitir seleção de datas
    if (isSubscriberBooking) {
      return true;
    }

    const dayInPortuguese = format(date, 'EEEE', { locale: ptBR }).toLowerCase();
    const dayInEnglish = weekDayMap[dayInPortuguese];

    // Se há restrição de dias para assinantes, verificar se o dia está permitido
    if (allowedWeekdays && allowedWeekdays.length > 0) {
      return allowedWeekdays.includes(dayInEnglish);
    }

    // Caso contrário, usar a lógica normal de horários de funcionamento
    return businessHours[dayInEnglish]?.enabled ?? true;
  };

  const handleDateClick = (date: Date) => {
    // Verificar se o dia está habilitado
    if (isDayEnabled(date)) {
      onChange(date);
      setLocalDate(format(date, 'yyyy-MM-dd'));
    }
  };

  // Gerar dias do mês atual
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Adicionar dias do mês anterior para completar a primeira semana
  const firstDayOfWeek = getDay(monthStart);
  const daysBeforeMonth: Date[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    daysBeforeMonth.push(subDays(monthStart, i + 1));
  }
  
  // Adicionar dias do próximo mês para completar a última semana (máximo 42 dias no total)
  const totalDays = daysBeforeMonth.length + daysInMonth.length;
  const daysAfterMonth: Date[] = [];
  const daysNeeded = 42 - totalDays; // 6 semanas x 7 dias = 42
  for (let i = 1; i <= daysNeeded; i++) {
    daysAfterMonth.push(addDays(monthEnd, i));
  }

  const allDays = [...daysBeforeMonth, ...daysInMonth, ...daysAfterMonth];

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const goToPreviousMonth = () => {
    const prevMonth = startOfMonth(subDays(currentMonth, 1));
    if (prevMonth >= startOfMonth(today)) {
      setCurrentMonth(prevMonth);
    }
  };

  const goToNextMonth = () => {
    const nextMonth = startOfMonth(addDays(monthEnd, 1));
    if (nextMonth <= maxDate) {
      setCurrentMonth(nextMonth);
    }
  };

  return (
    <div className="space-y-3">
      {/* Cabeçalho do calendário com navegação */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goToPreviousMonth}
          disabled={currentMonth <= startOfMonth(today)}
          className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          type="button"
          onClick={goToNextMonth}
          disabled={addDays(monthEnd, 1) > maxDate}
          className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
        >
          →
        </button>
      </div>

      {/* Calendário visual */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Dias do calendário */}
        <div className="grid grid-cols-7 gap-1">
          {allDays.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, today);
            const isSelected = localDate && isSameDay(date, new Date(localDate + 'T12:00:00'));
            const isPast = date < today;
            const isEnabled = isDayEnabled(date) && !isPast && date <= maxDate;
            const isFutureLimit = date > maxDate;

            return (
              <button
                key={index}
                type="button"
                onClick={() => isEnabled && handleDateClick(date)}
                disabled={!isEnabled}
                className={`
                  aspect-square p-2 rounded-lg text-sm font-medium transition-all
                  ${!isCurrentMonth ? 'text-gray-300' : ''}
                  ${isPast || isFutureLimit ? 'text-gray-300 cursor-not-allowed' : ''}
                  ${isToday && !isSelected ? 'bg-blue-50 text-blue-600 border-2 border-blue-300' : ''}
                  ${isSelected ? 'bg-blue-600 text-white font-bold' : ''}
                  ${isEnabled && !isSelected && !isToday ? 'hover:bg-gray-100 text-gray-700' : ''}
                  ${!isEnabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  ${!isDayEnabled(date) && isCurrentMonth && !isPast ? 'bg-red-50 text-red-400' : ''}
                `}
              >
                {format(date, 'd')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Informação sobre o dia selecionado */}
      {localDate && (() => {
        const dateObj = new Date(localDate + 'T12:00:00');
        return (
          <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                📅 {format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${isDayEnabled(dateObj)
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
                }`}>
                {isDayEnabled(dateObj) ? '✅ Aberto' : '❌ Fechado'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Dica para o usuário */}
      <div className="text-xs text-gray-500 text-center">
        💡 Você pode agendar até {format(maxDate, 'dd/MM/yyyy')}
      </div>
    </div>
  );
} 