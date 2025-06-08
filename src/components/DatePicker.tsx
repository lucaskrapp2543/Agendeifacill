import React from 'react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  businessHours: Record<string, { enabled: boolean }>;
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

export function DatePicker({ selectedDate, onSelectDate, businessHours }: DatePickerProps) {
  const today = startOfDay(new Date());
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const isDayEnabled = (date: Date) => {
    const dayInPortuguese = format(date, 'EEEE', { locale: ptBR }).toLowerCase();
    const dayInEnglish = weekDayMap[dayInPortuguese];
    return businessHours[dayInEnglish]?.enabled ?? true;
  };

  const scrollContainer = (direction: 'left' | 'right') => {
    const container = document.getElementById('dates-container');
    if (container) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => scrollContainer('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-[#1a1b1c] rounded-full p-1 hover:bg-[#242628] transition-colors"
      >
        <ChevronLeft className="h-5 w-5 text-gray-400" />
      </button>

      <div
        id="dates-container"
        className="flex overflow-x-auto hide-scrollbar gap-2 px-4 py-2 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {dates.map((date) => {
          const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isDisabled = !isDayEnabled(date) || isBefore(date, today);

          return (
            <button
              key={date.toISOString()}
              onClick={() => !isDisabled && onSelectDate(date)}
              disabled={isDisabled}
              className={`
                flex flex-col items-center min-w-[100px] p-3 rounded-lg border
                ${isSelected
                  ? 'bg-primary border-primary text-white'
                  : isDisabled
                    ? 'bg-[#1a1b1c] border-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-[#1a1b1c] border-gray-800 text-white hover:border-gray-700'
                }
              `}
            >
              <span className="text-sm font-medium">
                {format(date, 'EEE', { locale: ptBR })}
              </span>
              <span className="text-lg font-bold">
                {format(date, 'dd')}
              </span>
              <span className="text-xs">
                {format(date, 'MMM', { locale: ptBR })}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => scrollContainer('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-[#1a1b1c] rounded-full p-1 hover:bg-[#242628] transition-colors"
      >
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </button>
    </div>
  );
} 