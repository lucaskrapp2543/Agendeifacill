import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from './DatePicker';
import { TimeSlotSelector } from './TimeSlotSelector';

interface Appointment {
  appointment_date: string;
  appointment_time: string;
  duration: number;
  status?: string;
  professional?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Professional {
  id: string;
  name: string;
}

interface AvailableTimesViewerProps {
  establishment: {
    business_hours: Record<string, { 
      enabled: boolean;
      open1: string;
      close1: string;
      open2: string | null;
      close2: string | null;
    }>;
    services_with_prices: Service[];
    professionals: Professional[];
  };
  existingAppointments: Appointment[];
}

// Mapeamento dos nomes dos dias em português para inglês
const weekDayMap: Record<string, string> = {
  'domingo': 'sunday',
  'segunda-feira': 'monday',
  'terça-feira': 'tuesday',
  'quarta-feira': 'wednesday',
  'quinta-feira': 'thursday',
  'sexta-feira': 'friday',
  'sábado': 'saturday'
};

export function AvailableTimesViewer({ establishment, existingAppointments }: AvailableTimesViewerProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);

  // Função para obter o nome do dia em inglês
  const getEnglishDayName = (date: Date): string => {
    const portugueseDayName = format(date, 'EEEE', { locale: ptBR }).toLowerCase();
    return weekDayMap[portugueseDayName] || '';
  };

  // Função para obter os horários do dia selecionado
  const getBusinessHoursForDay = (date: Date) => {
    const dayName = getEnglishDayName(date);
    const dayHours = establishment.business_hours[dayName];
    return {
      open1: dayHours?.open1 || '',
      close1: dayHours?.close1 || '',
      open2: dayHours?.open2 || null,
      close2: dayHours?.close2 || null
    };
  };

  return (
    <div className="p-6 bg-[#1a1b1c] rounded-lg border border-gray-800">
      <h2 className="text-xl font-semibold text-gray-100 mb-6">Horários Disponíveis</h2>
      
      {/* Seleção de Serviço */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Escolha o Serviço
        </label>
        <select
          value={selectedService?.id || ''}
          onChange={(e) => {
            const service = establishment.services_with_prices.find(s => s.id === e.target.value);
            setSelectedService(service || null);
          }}
          className="input-field"
          required
        >
          <option value="">Selecione um serviço</option>
          {establishment.services_with_prices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - {formatDuration(service.duration)} - R$ {service.price.toFixed(2)}
            </option>
          ))}
        </select>
      </div>

      {/* Seleção de Profissional */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Escolha o Profissional
        </label>
        <select
          value={selectedProfessional?.id || ''}
          onChange={(e) => {
            const professional = establishment.professionals.find(p => p.id === e.target.value);
            setSelectedProfessional(professional || null);
          }}
          className="input-field"
          required
        >
          <option value="">Selecione um profissional</option>
          {establishment.professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
        </select>
      </div>

      {/* Seleção de Data */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Escolha a Data
        </label>
        <DatePicker 
          selectedDate={selectedDate} 
          onSelectDate={setSelectedDate}
          businessHours={establishment.business_hours}
        />
      </div>

      {/* Visualização dos Horários */}
      {selectedService && selectedProfessional && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Horários Disponíveis
          </label>
          <TimeSlotSelector
            selectedDate={selectedDate}
            selectedDuration={selectedService.duration}
            existingAppointments={existingAppointments}
            selectedProfessional={selectedProfessional.id}
            onSelectTime={() => {}} // Não faz nada ao clicar, apenas visualização
            businessHours={getBusinessHoursForDay(selectedDate)}
          />
        </div>
      )}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 
      ? `${hours}h${remainingMinutes}min` 
      : `${hours}h`;
  }
  return `${minutes}min`;
}
