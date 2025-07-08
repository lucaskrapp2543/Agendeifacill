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
import { Phone } from 'lucide-react';

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
  const [clientWhatsapp, setClientWhatsapp] = useState('');
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
      clientWhatsapp,
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

    const whatsappNumbers = clientWhatsapp.replace(/\D/g, '');

    setIsLoading(true);
    try {
      await onSubmit({
        client_name: clientName,
        client_whatsapp: whatsappNumbers,
        service: selectedService.name,
        professional: selectedProfessional.id,
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: selectedTime,
        duration: selectedService.duration,
        price: selectedService.price,
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

  const formatWhatsapp = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleWhatsappChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsapp(e.target.value);
    setClientWhatsapp(formatted);
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
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
        {/* 1. NOME DO CLIENTE */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isEstablishmentOwner ? '1. Nome do Cliente (Reserva pelo Estabelecimento)' : '1. Nome do Cliente'}
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary bg-white text-gray-900 placeholder-gray-400"
            placeholder="Digite seu nome"
            required
          />
          {isEstablishmentOwner && (
            <p className="mt-1 text-sm text-gray-500">
              Você está fazendo uma reserva como estabelecimento para um cliente.
            </p>
          )}
        </div>

        {/* 2. WHATSAPP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
              <span>2. WhatsApp</span>
            </div>
          </label>
          <input
            type="tel"
            value={clientWhatsapp}
            onChange={handleWhatsappChange}
            className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary bg-white text-gray-900 placeholder-gray-400"
            placeholder="(00) 00000-0000"
            required
            maxLength={15}
          />
        </div>

        {/* 3. SERVIÇO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            3. Escolha o Serviço
          </label>
          <ServiceList
            services={establishment.services_with_prices}
            selectedService={selectedService}
            onSelectService={setSelectedService}
          />
        </div>

        {/* 4. PROFISSIONAL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            4. Escolha o Profissional
          </label>
          <select
            value={selectedProfessional?.id || ''}
            onChange={(e) => {
              const professional = establishment.professionals.find(p => p.id === e.target.value);
              setSelectedProfessional(professional);
            }}
            className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary bg-white text-gray-900"
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

        {/* 5. DATA */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            5. Escolha a Data
          </label>
          <DatePicker 
            selectedDate={selectedDate} 
            onChange={onSelectDate}
            businessHours={establishment.business_hours}
          />
        </div>

        {/* 6. HORÁRIO */}
        {selectedService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              6. Escolha o Horário
            </label>
            <TimeSlotSelector
              selectedDate={selectedDate}
              selectedService={selectedService}
              existingAppointments={existingAppointments}
              selectedTime={selectedTime}
              onTimeSelect={setSelectedTime}
              businessHours={businessHours}
            />
          </div>
        )}

        {/* 7. FORMA DE PAGAMENTO */}
        {selectedService && (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              7. Forma de Pagamento
          </label>
            {establishment.pix_key ? (
              <PixPaymentForm
                establishment={establishment}
                selectedService={selectedService}
                onPixMethodSelect={handlePixMethodSelect}
                onPixProofUpload={handlePixComprovantUpload}
                pixPaymentMethod={pixPaymentMethod}
                pixProofUrl={pixProofUrl}
              />
            ) : (
              <div className="text-gray-700">
                Pagamento somente no local
                </div>
            )}
          </div>
        )}

        {/* RESUMO DO AGENDAMENTO */}
        {selectedService && selectedProfessional && selectedPaymentMethod && selectedTime && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-primary mb-2">📋 Resumo do Agendamento:</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <div><strong>Cliente:</strong> {clientName || 'Não informado'}</div>
              <div><strong>WhatsApp:</strong> {clientWhatsapp || 'Não informado'}</div>
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

        {/* BOTÃO DE SUBMIT */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-md text-white font-medium ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {isLoading ? 'Agendando...' : 'Confirmar Agendamento'}
        </button>
      </form>
    </div>
  );
} 