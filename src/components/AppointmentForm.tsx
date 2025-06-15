import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { TimeSlotSelector } from './TimeSlotSelector';
import { DatePicker } from './DatePicker';
import { ServiceList } from './ServiceList';

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

interface Appointment {
  appointment_date: string;
  appointment_time: string;
  duration: number;
  status?: string;
  professional?: string;
}

interface AppointmentFormProps {
  establishment: {
    business_hours: Record<string, { 
      enabled: boolean;
      open1: string;
      close1: string;
      open2: string;
      close2: string;
    }>;
    services_with_prices: Service[];
    professionals: Professional[];
  };
  onSubmit: (data: any) => Promise<void>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  existingAppointments?: Appointment[];
}

export function AppointmentForm({ 
  establishment, 
  onSubmit, 
  selectedDate, 
  onSelectDate,
  existingAppointments = []
}: AppointmentFormProps) {
  const [clientName, setClientName] = useState('');
  const [selectedService, setSelectedService] = useState<Service | undefined>(undefined);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedProfessional || !selectedTime || !clientName || !selectedPaymentMethod) return;

    setIsLoading(true);
    try {
      await onSubmit({
        service: selectedService.name,
        professional: selectedProfessional.id,
        appointment_time: selectedTime,
        duration: selectedService.duration,
        price: selectedService.price,
        client_name: clientName,
        payment_method: selectedPaymentMethod
      });

      navigate('/success');
    } catch (error) {
      console.error('Erro ao agendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Pegar o dia da semana em português e converter para inglês
  const dayOfWeek = format(selectedDate, 'EEEE', { locale: ptBR }).toLowerCase();
  const businessHoursForDay = establishment.business_hours[dayOfWeek];

  // Garantir que os horários estão no formato correto (HH:mm)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const formattedBusinessHours = businessHoursForDay ? {
    open1: formatTime(businessHoursForDay.open1),
    close1: formatTime(businessHoursForDay.close1),
    open2: formatTime(businessHoursForDay.open2),
    close2: formatTime(businessHoursForDay.close2)
  } : null;

  console.log('AppointmentForm state:', {
    selectedDate,
    selectedService,
    selectedProfessional,
    selectedTime,
    businessHoursForDay,
    existingAppointments
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-white mb-2">Nome do Cliente</label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="bg-[#242628] text-white border border-gray-800 rounded-lg px-3 py-2 w-full"
          placeholder="Digite o nome do cliente"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Data</label>
        <DatePicker
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          businessHours={establishment.business_hours}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Serviço</label>
        <ServiceList
          services={establishment.services_with_prices}
          selectedService={selectedService}
          onSelect={(service) => {
            setSelectedService(service);
            setSelectedTime('');
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">Profissional</label>
        <select
          value={selectedProfessional?.id || ''}
          onChange={(e) => {
            const professional = establishment.professionals.find(p => p.id === e.target.value);
            setSelectedProfessional(professional);
            setSelectedTime('');
          }}
          className="bg-[#242628] text-white border border-gray-800 rounded-lg px-3 py-2 w-full"
          required
        >
          <option value="">Selecione um profissional</option>
          {establishment.professionals.map(professional => (
            <option key={professional.id} value={professional.id}>
              {professional.name}
            </option>
          ))}
        </select>
      </div>

      {selectedService && selectedProfessional && businessHoursForDay?.enabled && formattedBusinessHours && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">Horário</label>
          <div className="bg-[#1a1b1c] p-4 rounded-lg border border-gray-800">
            <TimeSlotSelector
              selectedDate={selectedDate}
              selectedDuration={selectedService.duration}
              existingAppointments={existingAppointments}
              selectedProfessional={selectedProfessional.id}
              onSelectTime={handleTimeSelect}
              selectedTime={selectedTime}
              businessHours={formattedBusinessHours}
            />
          </div>
        </div>
      )}

      {selectedTime && (
        <div>
          <label className="block text-sm font-medium text-white mb-2">Forma de Pagamento</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'pix', label: 'PIX', icon: '💳' },
              { value: 'credito', label: 'CRÉDITO', icon: '💳' },
              { value: 'debito', label: 'DÉBITO', icon: '💳' },
              { value: 'dinheiro', label: 'DINHEIRO', icon: '💵' },
              { value: 'pagar_local', label: 'PAGAR NO LOCAL', icon: '🏪' }
            ].map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setSelectedPaymentMethod(method.value)}
                className={`
                  p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium
                  ${selectedPaymentMethod === method.value
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-gray-600 bg-[#242628] text-gray-300 hover:border-gray-500'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">{method.icon}</span>
                  <span>{method.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!businessHoursForDay?.enabled && (
        <div className="text-red-500 text-sm">
          Estabelecimento fechado neste dia
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !selectedService || !selectedProfessional || !selectedTime || !clientName || !selectedPaymentMethod}
        className={`
          w-full px-4 py-2 text-white font-medium rounded-lg
          ${isLoading || !selectedService || !selectedProfessional || !selectedTime || !clientName || !selectedPaymentMethod
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-primary hover:bg-primary/90 transition-colors'
          }
        `}
      >
        {isLoading ? 'Agendando...' : 'Confirmar Agendamento'}
      </button>
    </form>
  );
} 