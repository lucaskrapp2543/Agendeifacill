import React from 'react';
import { format, addMonths, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
        required
      />
      
      {/* Informação sobre o dia selecionado */}
      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="font-medium">
            📅 {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isDayEnabled(selectedDate) 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isDayEnabled(selectedDate) ? '✅ Aberto' : '❌ Fechado'}
          </span>
        </div>
      </div>

      {/* Dica para o usuário */}
      <div className="text-xs text-gray-500 text-center">
        💡 Você pode agendar até {format(maxDate, 'dd/MM/yyyy')}
      </div>
    </div>
  );
} 