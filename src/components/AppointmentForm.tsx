import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { TimeSlotSelector } from './TimeSlotSelector';
import { DatePicker } from './DatePicker';
import { ServiceList } from './ServiceList';
import { useAuth } from '../context/AuthContext';
import { PixPaymentForm } from './PixPaymentForm';
import { PixProofViewer } from './PixProofViewer';

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
  id: string;
  client_id: string;
  establishment_id: string;
  service: string;
  professional: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  client_name: string;
  price: number;
  duration: number;
  payment_method?: string;
  pix_proof_url?: string;
  pix_payment_status?: string;
}

interface Establishment {
  owner_id: string;
  business_hours: Record<string, { 
    enabled: boolean;
    open1: string;
    close1: string;
    open2: string;
    close2: string;
  }>;
  services_with_prices: Service[];
  professionals: Professional[];
}

interface AppointmentFormProps {
  establishment: Establishment & {
    pix_key?: string;
    pix_key_type?: string;
  };
  onSubmit: (data: any) => Promise<void>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  existingAppointments?: Appointment[];
  pix_payment_status?: string;
  pix_proof_url?: string;
}

export function AppointmentForm({ 
  establishment, 
  onSubmit, 
  selectedDate, 
  onSelectDate,
  existingAppointments = [],
  pix_payment_status,
  pix_proof_url
}: AppointmentFormProps) {
  const { user } = useAuth();
  const isEstablishmentOwner = user?.id === establishment?.owner_id;

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

  const [pixProofUrl, setPixProofUrl] = useState<string | null>(null);
  const [pixPaymentMethod, setPixPaymentMethod] = useState<'pix_now' | 'pix_local' | null>(null);

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

  const handlePixComprovantUpload = (url: string) => {
    setPixProofUrl(url);
  };

  const handlePixMethodSelect = (method: 'pix_now' | 'pix_local') => {
    setPixPaymentMethod(method);
    setSelectedPaymentMethod(method === 'pix_now' ? 'pix' : 'pagar_local');
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
      pixPaymentMethod,
      pixProofUrl,
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

    // Validação específica para PIX
    if (selectedPaymentMethod === 'pix' && pixPaymentMethod === 'pix_now' && !pixProofUrl) {
      alert('Por favor, envie o comprovante do PIX');
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
        payment_method: selectedPaymentMethod,
        pix_payment_status: pixPaymentMethod === 'pix_now' ? 'enviado' : 'pendente',
        pix_proof_url: pixProofUrl
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
  
  // Debug para verificar o mapeamento
  console.log('🗓️ Data selecionada:', format(selectedDate, 'dd/MM/yyyy'));
  console.log('📅 Dia da semana (inglês):', dayOfWeek);
  console.log('🏢 Horários do estabelecimento:', establishment.business_hours);

  // Garantir que os horários estão no formato correto
  const defaultBusinessHours = {
    enabled: false,
    open1: '',
    close1: '',
    open2: null,
    close2: null
  };

  // Converter os horários do estabelecimento para o formato correto
  const businessHours = establishment.business_hours?.[dayOfWeek] || defaultBusinessHours;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. NOME DO CLIENTE */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {isEstablishmentOwner ? '1. Nome do Cliente (Reserva pelo Estabelecimento)' : '1. Nome do Cliente'}
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="input-field"
            placeholder={isEstablishmentOwner ? "Digite o nome do cliente que você está reservando" : "Digite seu nome"}
            required
          />
          {isEstablishmentOwner && (
            <p className="mt-1 text-sm text-gray-400">
              Você está fazendo uma reserva como estabelecimento para um cliente.
            </p>
          )}
        </div>

        {/* 2. SERVIÇO */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            2. Escolha o Serviço
          </label>
          <ServiceList
            services={establishment.services_with_prices}
            selectedService={selectedService}
            onSelect={setSelectedService}
          />
        </div>

        {/* 3. PROFISSIONAL */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            3. Escolha o Profissional
          </label>
          <select
            value={selectedProfessional?.id || ''}
            onChange={(e) => {
              const professional = establishment.professionals.find(p => p.id === e.target.value);
              setSelectedProfessional(professional);
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

        {/* 4. DATA */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            4. Escolha a Data
          </label>
          <DatePicker 
            selectedDate={selectedDate} 
            onSelectDate={onSelectDate}
            businessHours={establishment.business_hours}
          />
        </div>

        {/* 5. HORÁRIO */}
        {selectedService && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              5. Escolha o Horário
            </label>
            <TimeSlotSelector
              selectedDate={selectedDate}
              selectedDuration={selectedService?.duration || 30}
              existingAppointments={existingAppointments}
              selectedProfessional={selectedProfessional?.id || ''}
              onSelectTime={handleTimeSelect}
              selectedTime={selectedTime}
              businessHours={businessHours}
            />
          </div>
        )}

        {/* 6. FORMA DE PAGAMENTO */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            6. Escolha a Forma de Pagamento
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { value: 'pix', label: 'PIX', icon: '💸' },
              { value: 'credito', label: 'CRÉDITO', icon: '💳' },
              { value: 'debito', label: 'DÉBITO', icon: '💳' },
              { value: 'dinheiro', label: 'DINHEIRO', icon: '💵' }
            ].map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setSelectedPaymentMethod(method.value)}
                className={`flex items-center justify-center p-4 rounded-lg border ${
                  selectedPaymentMethod === method.value
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xl">{method.icon}</span>
                  <span className="text-sm">{method.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PIX Payment Form */}
        {selectedPaymentMethod === 'pix' && (
          <PixPaymentForm
            establishmentPixKey={establishment.pix_key}
            establishmentPixType={establishment.pix_key_type}
            onComprovantUpload={handlePixComprovantUpload}
            onPaymentMethodSelect={handlePixMethodSelect}
          />
        )}

        {/* RESUMO DO AGENDAMENTO */}
        {selectedService && selectedProfessional && selectedPaymentMethod && selectedTime && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-primary mb-2">📋 Resumo do Agendamento:</h3>
            <div className="text-sm text-gray-300 space-y-1">
              <div><strong>Cliente:</strong> {clientName || 'Não informado'}</div>
              <div><strong>Serviço:</strong> {selectedService?.name || ''} - R$ {selectedService?.price.toFixed(2).replace('.', ',') || '0,00'}</div>
              <div><strong>Profissional:</strong> {selectedProfessional?.name || ''}</div>
              <div><strong>Pagamento:</strong> {
                selectedPaymentMethod === 'pix' ? (pixPaymentMethod === 'pix_now' ? 'PIX (Pagar agora)' : 'PIX (Pagar no local)') :
                selectedPaymentMethod === 'credito' ? 'Cartão de Crédito' :
                selectedPaymentMethod === 'debito' ? 'Cartão de Débito' :
                selectedPaymentMethod === 'dinheiro' ? 'Dinheiro' : selectedPaymentMethod
              }</div>
              <div><strong>Data:</strong> {format(selectedDate, 'dd/MM/yyyy')}</div>
              <div><strong>Horário:</strong> {selectedTime}</div>
              <div><strong>Duração:</strong> {selectedService?.duration || 30} minutos</div>
            </div>
          </div>
        )}

        {/* Detalhes do Pagamento */}
        {selectedPaymentMethod === 'pix' && pixPaymentMethod === 'pix_now' && pixProofUrl && (
          <div className="mt-4">
            <h4 className="text-md font-medium text-gray-300 mb-2">
              Detalhes do Pagamento PIX
            </h4>
            <div className="p-4 bg-[#242628] rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Status do Pagamento:</span>
                <span className="text-sm font-medium text-yellow-500">
                  ⏳ Aguardando confirmação
                </span>
              </div>

              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Comprovante
                </label>
                <div className="relative">
                  <img
                    src={pixProofUrl}
                    alt="Comprovante PIX"
                    className="w-full max-w-xs rounded-lg border border-gray-700"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={
            isLoading || 
            !selectedService || 
            !selectedProfessional || 
            !selectedTime || 
            !clientName || 
            !selectedPaymentMethod ||
            (selectedPaymentMethod === 'pix' && pixPaymentMethod === 'pix_now' && !pixProofUrl)
          }
          className={`w-full flex justify-center items-center px-6 py-3 rounded-lg text-lg font-medium transition-colors ${
            isLoading || !selectedService || !selectedProfessional || !selectedTime || !clientName || !selectedPaymentMethod
              ? 'bg-gray-600 cursor-not-allowed text-gray-300'
              : 'btn-primary'
          }`}
        >
          {isLoading ? 'Agendando...' : 'Confirmar Agendamento'}
        </button>
      </form>
    </div>
  );
} 