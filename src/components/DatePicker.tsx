import React from 'react';
import { format, addMonths, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DatePickerProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  businessHours: Record<string, { 
    enabled: boolean;
    open1: string;
    close1: string;
    open2: string | null;
    close2: string | null;
  }>;
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
  const maxDate = addMonths(today, 6); // Permitir agendamento até 6 meses no futuro

  const isDayEnabled = (date: Date) => {
    const dayInPortuguese = format(date, 'EEEE', { locale: ptBR }).toLowerCase();
    const dayInEnglish = weekDayMap[dayInPortuguese];
    return businessHours[dayInEnglish]?.enabled ?? true;
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const newDate = new Date(dateValue + 'T12:00:00'); // Adicionar horário para evitar problemas de timezone
      
      // Verificar se o dia está habilitado
      if (isDayEnabled(newDate)) {
        onSelectDate(newDate);
      } else {
        // Mostrar aviso se o dia está fechado
        alert('O estabelecimento está fechado neste dia. Por favor, escolha outro dia.');
        // Resetar para a data atual se inválida
        e.target.value = format(selectedDate, 'yyyy-MM-dd');
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Input de data principal */}
      <input
        type="date"
        value={format(selectedDate, 'yyyy-MM-dd')}
        onChange={handleDateChange}
        min={format(today, 'yyyy-MM-dd')}
        max={format(maxDate, 'yyyy-MM-dd')}
        className="input-field text-lg"
        required
      />
      
      {/* Informação sobre o dia selecionado */}
      <div className="text-sm text-gray-300 bg-gray-800/50 p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium">
            📅 {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isDayEnabled(selectedDate) 
              ? 'bg-green-500/20 text-green-500' 
              : 'bg-red-600/20 text-red-400'
          }`}>
            {isDayEnabled(selectedDate) ? '✅ Aberto' : '❌ Fechado'}
          </span>
        </div>
      </div>

      {/* Dica para o usuário */}
      <div className="text-xs text-gray-400 text-center">
        💡 Você pode agendar até {format(maxDate, 'dd/MM/yyyy')}
      </div>
    </div>
  );
} 