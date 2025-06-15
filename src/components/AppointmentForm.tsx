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
  console.log('🏗️ AppointmentForm - Dados recebidos:');
  console.log('  - establishment:', establishment);
  console.log('  - services_with_prices:', establishment?.services_with_prices);
  console.log('  - professionals:', establishment?.professionals);
  console.log('  - business_hours:', establishment?.business_hours);

  const [clientName, setClientName] = useState('');
  const [selectedService, setSelectedService] = useState<Service | undefined>(undefined);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Verificar se os dados essenciais existem
  if (!establishment) {
    console.log('❌ AppointmentForm: establishment é null/undefined');
    return <div>Erro: Dados do estabelecimento não disponíveis</div>;
  }

  if (!establishment.services_with_prices || establishment.services_with_prices.length === 0) {
    console.log('❌ AppointmentForm: Sem serviços disponíveis');
    return <div>Erro: Nenhum serviço disponível neste estabelecimento</div>;
  }

  if (!establishment.professionals || establishment.professionals.length === 0) {
    console.log('❌ AppointmentForm: Sem profissionais disponíveis');
    return <div>Erro: Nenhum profissional disponível neste estabelecimento</div>;
  }

  if (!establishment.business_hours) {
    console.log('❌ AppointmentForm: Sem horários de funcionamento');
    return <div>Erro: Horários de funcionamento não configurados</div>;
  }

  const handleTimeSelect = (time: string) => {
    console.log('⏰ Horário selecionado:', time);
    setSelectedTime(time);
    // NÃO fazer submit automático aqui!
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🚀 Tentativa de submit do formulário');
    console.log('📋 Dados atuais:', {
      clientName,
      selectedService: selectedService?.name,
      selectedProfessional: selectedProfessional?.name,
      selectedTime,
      selectedPaymentMethod,
      selectedDate: format(selectedDate, 'yyyy-MM-dd')
    });

    // Validação completa
    if (!clientName.trim()) {
      alert('Por favor, informe o nome do cliente');
      return;
    }
    
    if (!selectedService) {
      alert('Por favor, selecione um serviço');
      return;
    }
    
    if (!selectedProfessional) {
      alert('Por favor, selecione um profissional');
      return;
    }
    
    if (!selectedPaymentMethod) {
      alert('Por favor, selecione uma forma de pagamento');
      return;
    }
    
    if (!selectedTime) {
      alert('Por favor, selecione um horário');
      return;
    }

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

      // Só navega após sucesso
      navigate('/success');
    } catch (error) {
      console.error('❌ Erro ao agendar:', error);
      alert('Erro ao realizar agendamento. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Pegar o dia da semana em inglês (como está no banco de dados)
  const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase(); // segunda-feira -> monday
  const businessHoursForDay = establishment.business_hours[dayOfWeek];
  
  // Debug para verificar o mapeamento
  console.log('🗓️ Data selecionada:', format(selectedDate, 'dd/MM/yyyy'));
  console.log('📅 Dia da semana (inglês):', dayOfWeek);
  console.log('🏢 Horários do estabelecimento:', establishment.business_hours);
  console.log('⏰ Horários para este dia:', businessHoursForDay);

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

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. NOME DO CLIENTE */}
      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            1. Nome do Cliente
          </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="Digite o nome do cliente"
          required
        />
      </div>

        {/* 2. SERVIÇO */}
      <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            2. Escolha o Serviço
          </label>
        <ServiceList
          services={establishment.services_with_prices}
          selectedService={selectedService}
          onSelect={(service) => {
            setSelectedService(service);
              setSelectedTime(''); // Reset horário quando muda serviço
          }}
        />
      </div>

        {/* 3. PROFISSIONAL */}
        {selectedService && (
      <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              3. Escolha o Profissional
            </label>
        <select
          value={selectedProfessional?.id || ''}
          onChange={(e) => {
            const professional = establishment.professionals.find(p => p.id === e.target.value);
            setSelectedProfessional(professional);
                setSelectedTime(''); // Reset horário quando muda profissional
          }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
        )}

        {/* 4. FORMA DE PAGAMENTO - LAYOUT MOBILE MELHORADO */}
        {selectedService && selectedProfessional && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              4. Escolha a Forma de Pagamento
            </label>
            {/* Layout responsivo: 1 coluna no mobile, 2 no tablet, 3 no desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    p-4 rounded-lg border-2 transition-all duration-200 text-sm font-medium min-h-[80px] w-full
                    ${selectedPaymentMethod === method.value
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }
                  `}
                >
                  <div className="flex flex-col items-center justify-center gap-2 h-full">
                    <span className="text-xl">{method.icon}</span>
                    <span className="text-center leading-tight text-xs sm:text-sm">{method.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. DATA */}
        {selectedPaymentMethod && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              5. Escolha a Data
            </label>
            <DatePicker
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              businessHours={establishment.business_hours}
            />
          </div>
        )}

        {/* 6. HORÁRIO */}
        {selectedPaymentMethod && selectedService && selectedProfessional && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              6. Escolha o Horário
            </label>
            {businessHoursForDay?.enabled && formattedBusinessHours ? (
              <TimeSlotSelector
              selectedDate={selectedDate}
              selectedDuration={selectedService.duration}
              existingAppointments={existingAppointments}
              selectedProfessional={selectedProfessional.id}
              onSelectTime={handleTimeSelect}
              selectedTime={selectedTime}
              businessHours={formattedBusinessHours}
            />
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="text-red-600 text-sm font-medium">
                  ⚠️ Estabelecimento fechado neste dia
          </div>
        </div>
      )}
        </div>
      )}

        {/* 7. BOTÃO CONFIRMAR */}
      <button
        type="submit"
          disabled={isLoading || !selectedService || !selectedProfessional || !selectedTime || !clientName || !selectedPaymentMethod}
        className={`
            w-full px-6 py-3 text-white font-medium rounded-lg text-lg
            ${isLoading || !selectedService || !selectedProfessional || !selectedTime || !clientName || !selectedPaymentMethod
              ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-primary hover:bg-primary/90 transition-colors'
          }
        `}
      >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
              Agendando...
            </div>
          ) : (
            '7. Confirmar Agendamento'
          )}
      </button>

        {/* RESUMO DO AGENDAMENTO */}
        {selectedService && selectedProfessional && selectedPaymentMethod && selectedTime && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">📋 Resumo do Agendamento:</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <div><strong>Cliente:</strong> {clientName || 'Não informado'}</div>
              <div><strong>Serviço:</strong> {selectedService.name} - R$ {selectedService.price.toFixed(2)}</div>
              <div><strong>Profissional:</strong> {selectedProfessional.name}</div>
              <div><strong>Pagamento:</strong> {
                selectedPaymentMethod === 'pix' ? 'PIX' :
                selectedPaymentMethod === 'credito' ? 'Cartão de Crédito' :
                selectedPaymentMethod === 'debito' ? 'Cartão de Débito' :
                selectedPaymentMethod === 'dinheiro' ? 'Dinheiro' :
                selectedPaymentMethod === 'pagar_local' ? 'Pagar no Local' : selectedPaymentMethod
              }</div>
              <div><strong>Data:</strong> {format(selectedDate, 'dd/MM/yyyy')}</div>
              <div><strong>Horário:</strong> {selectedTime}</div>
              <div><strong>Duração:</strong> {selectedService.duration} minutos</div>
            </div>
          </div>
        )}
    </form>
    </div>
  );
} 