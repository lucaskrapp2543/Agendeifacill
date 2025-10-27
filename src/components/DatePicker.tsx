import { addMonths, format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import React, { useState } from 'react';

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

  // Estado para controlar se o campo de data está vazio ou preenchido
  // Inicializa vazio - não deve ser atualizado por useEffect
  const [localDate, setLocalDate] = useState('');

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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    setLocalDate(dateValue); // Atualizar estado local

    if (dateValue) {
      const newDate = new Date(dateValue + 'T12:00:00'); // Adicionar horário para evitar problemas de timezone

      // Verificar se o dia está habilitado
      if (isDayEnabled(newDate)) {
        onChange(newDate);
      } else {
        // Não mostrar alert, apenas não permitir a seleção
        // O usuário verá visualmente que o dia está fechado
        setLocalDate(format(selectedDate, 'yyyy-MM-dd'));
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Input de data principal com label visual */}
      <div className="relative">
        <input
          type="date"
          value={localDate}
          onChange={handleDateChange}
          min={format(today, 'yyyy-MM-dd')}
          max={format(maxDate, 'yyyy-MM-dd')}
          className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary bg-white text-gray-900 text-lg"
          required
        />
        {/* Label visual quando vazio */}
        {!localDate && (
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400 text-sm sm:text-lg select-none">
            📅 <span className="hidden sm:inline">Clique aqui para selecionar a data</span>
            <span className="sm:hidden">Selecionar data</span>
          </div>
        )}
      </div>

      {/* Informação sobre o dia selecionado - só mostra se houver data selecionada */}
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