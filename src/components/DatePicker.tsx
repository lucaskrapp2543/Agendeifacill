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

  // Se o booking já vier com uma data pré-selecionada (ex.: hoje),
  // refletir isso visualmente e no painel de informação.
  useEffect(() => {
    if (selectedDate && !Number.isNaN(selectedDate.getTime())) {
      setLocalDate(format(selectedDate, 'yyyy-MM-dd'));
      setCurrentMonth(startOfMonth(selectedDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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
          className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white/80 transition-colors"
        >
          ←
        </button>
        <h3 className="text-lg font-extrabold tracking-wide text-[#E6C78B]">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          type="button"
          onClick={goToNextMonth}
          disabled={addDays(monthEnd, 1) > maxDate}
          className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-white/80 transition-colors"
        >
          →
        </button>
      </div>

      {/* Calendário visual */}
      <div className="bg-[#0b0c0f] border border-white/12 rounded-xl sm:rounded-2xl p-2 sm:p-4 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
        {/* Cabeçalho dos dias da semana (desktop) */}
        <div className="hidden sm:grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-extrabold text-white/75 py-2 tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Grade do calendário:
            - mobile: 5 colunas (botões maiores, sem arrastar pro lado)
            - desktop: 7 colunas (padrão) */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-1.5">
          {allDays.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, currentMonth);
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);
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
                  relative rounded-xl border transition-all duration-150
                  flex items-center justify-center
                  h-12 px-3 py-2 sm:h-auto sm:aspect-square sm:p-2
                  text-[13px] sm:text-sm font-extrabold
                  ${!isCurrentMonth ? 'bg-black/30 border-white/5 text-white/20' : 'bg-white/5 border-white/10 text-white'}

                  ${isEnabled && !isSelected ? 'hover:bg-white/10 hover:border-white/20 active:scale-[0.99] cursor-pointer' : 'cursor-not-allowed'}

                  ${isPast || isFutureLimit ? 'bg-black/40 border-white/5 text-white/20 opacity-70 line-through' : ''}

                  ${isToday && !isSelected ? 'ring-2 ring-emerald-400 bg-emerald-500/15 border-emerald-400/40' : ''}
                  ${isSelected ? 'z-10 bg-[#E6C78B] text-black border-[#f3e7c7] ring-4 ring-[#E6C78B] shadow-[0_18px_45px_rgba(230,199,139,0.55)]' : ''}

                  ${!isDayEnabled(date) && isCurrentMonth && !isPast ? 'bg-red-500/10 text-red-200 border-red-400/25' : ''}
                `}
              >
                <span className="relative z-10 leading-none">{format(date, 'd')}</span>

                {/* pontinho de hoje (pra ficar simples e óbvio sem quebrar layout) */}
                {isToday && (
                  <span
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-black/60' : 'bg-emerald-300'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Informação sobre o dia selecionado */}
      {selectedDate && (() => {
        const dateObj = selectedDate;
        return (
          <div className="text-sm text-white/80 bg-white/5 p-3 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                📅 {format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${isDayEnabled(dateObj)
                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/25'
                : 'bg-red-500/15 text-red-200 border border-red-400/25'
                }`}>
                {isDayEnabled(dateObj) ? '✅ Aberto' : '❌ Fechado'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Dica para o usuário */}
      <div className="text-xs text-white/50 text-center">
        💡 Você pode agendar até {format(maxDate, 'dd/MM/yyyy')}
      </div>
    </div>
  );
} 