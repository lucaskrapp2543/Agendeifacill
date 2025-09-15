import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TimeSlotSelector } from './TimeSlotSelector';
import { DatePicker } from './DatePicker';
import { ServiceList } from './ServiceList';
import { MultiServiceSelector } from './MultiServiceSelector';
import { useAuth } from '../context/AuthContext';
import { PixPaymentForm } from './PixPaymentForm';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { Phone } from 'lucide-react';
import { ProfessionalSelector } from './ProfessionalSelector';
import { checkWhatsAppSubscriber } from '../lib/supabase';
import { checkWhatsAppSubscriber as checkNewSubscriber } from '../lib/subscriberSystem';
import { validateSubscriberBooking, getAvailableDatesForSubscriber } from '../utils/subscriberBookingValidation';
import { validateSameDayReschedule } from '../utils/sameDayRescheduleValidation';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Professional {
  id: string;
  name: string;
  photo_url?: string;
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
  id?: string;
  establishment_id?: string;
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
    use_15_minute_interval?: boolean;
  };
  onSubmit: (data: any) => Promise<void>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  existingAppointments?: Appointment[];
  pix_payment_status?: string;
  pix_proof_url?: string;
  subscriberService?: any; // Serviço de assinante para restringir dias
  isSubscriberBooking?: boolean; // Indica se é agendamento de assinante
  onConvertToSubscriber?: (subscriberData: any) => void; // Callback para converter para assinante
}

export function AppointmentForm({ 
  establishment, 
  onSubmit, 
  selectedDate, 
  onSelectDate,
  existingAppointments = [],
  subscriberService,
  isSubscriberBooking = false,
  onConvertToSubscriber
}: AppointmentFormProps) {
  const { user } = useAuth();
  const isEstablishmentOwner = user?.id === establishment?.owner_id;

  // Função para verificar se o dia é válido para assinantes
  const isValidDayForSubscriber = (date: Date, allowedWeekdays: string[]) => {
    if (!allowedWeekdays || allowedWeekdays.length === 0) return true;
    
    const dayInPortuguese = format(date, 'EEEE', { locale: ptBR }).toLowerCase();
    const weekDayMap: Record<string, string> = {
      'domingo': 'sunday',
      'segunda-feira': 'monday',
      'terça-feira': 'tuesday',
      'quarta-feira': 'wednesday',
      'quinta-feira': 'thursday',
      'sexta-feira': 'friday',
      'sábado': 'saturday'
    };
    
    const dayInEnglish = weekDayMap[dayInPortuguese];
    return allowedWeekdays.includes(dayInEnglish);
  };

  console.log('🏗️ AppointmentForm - Dados recebidos:');
  console.log('  - establishment:', establishment);
  console.log('  - services_with_prices:', establishment?.services_with_prices);
  console.log('  - professionals:', establishment?.professionals);
  console.log('  - business_hours:', establishment?.business_hours);

  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  
  // Auto-preenchimento com últimos dados do usuário
  useEffect(() => {
    if (user) {
      // Buscar últimos dados salvos no localStorage
      const lastUserData = localStorage.getItem('lastUserBookingData');
      if (lastUserData) {
        try {
          const { name, whatsapp } = JSON.parse(lastUserData);
          setClientName(name || '');
          setClientWhatsapp(whatsapp || '');
        } catch (error) {
          console.error('Erro ao carregar dados salvos:', error);
        }
      }
    }
  }, [user]);
  const [selectedService, setSelectedService] = useState<Service | undefined>(undefined);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [useMultiService, setUseMultiService] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const [pixProofUrl, setPixProofUrl] = useState<string | null>(null);
  const [pixPaymentMethod, setPixPaymentMethod] = useState<'pix_now' | 'pix_local' | null>(null);

  // Estados para detecção automática de assinantes
  const [detectedSubscriber, setDetectedSubscriber] = useState<any>(null);
  const [isCheckingSubscriber, setIsCheckingSubscriber] = useState(false);
  
  // Estados para validação de agendamento de assinantes
  const [subscriberBookingError, setSubscriberBookingError] = useState<string | null>(null);
  const [isValidatingBooking, setIsValidatingBooking] = useState(false);
  const [showSubscriberNotification, setShowSubscriberNotification] = useState(false);

  // Estados para validação de remarcação no mesmo dia
  const [sameDayRescheduleError, setSameDayRescheduleError] = useState<string | null>(null);
  const [isValidatingSameDay, setIsValidatingSameDay] = useState(false);

  // Função para validar agendamento de assinantes
  const validateSubscriberBookingDate = async (date: Date) => {
    console.log('🔍 Iniciando validação de agendamento:', {
      clientWhatsapp,
      establishmentId: establishment?.id,
      selectedDate: date.toISOString()
    });

    if (!clientWhatsapp || !establishment?.id) {
      console.log('❌ Dados insuficientes para validação');
      setSubscriberBookingError(null);
      return;
    }

    setIsValidatingBooking(true);
    setSubscriberBookingError(null);

    try {
      const validation = await validateSubscriberBooking(
        clientWhatsapp,
        establishment.id,
        date
      );

      console.log('📋 Resultado da validação:', validation);

      if (!validation.canBook) {
        console.log('❌ Agendamento bloqueado:', validation.message);
        setSubscriberBookingError(validation.message || 'Agendamento não permitido para esta data.');
      } else {
        console.log('✅ Agendamento permitido');
        setSubscriberBookingError(null);
      }
    } catch (error) {
      console.error('❌ Erro ao validar agendamento de assinante:', error);
      setSubscriberBookingError(null); // Em caso de erro, permitir agendamento
    } finally {
      setIsValidatingBooking(false);
    }
  };

  // Função para validar remarcação no mesmo dia
  const validateSameDayRescheduleDate = async (date: Date) => {
    console.log('🔍 Iniciando validação de remarcação no mesmo dia:', {
      clientWhatsapp,
      establishmentId: establishment?.id,
      selectedDate: date.toISOString()
    });

    if (!clientWhatsapp || !establishment?.id) {
      console.log('❌ Dados insuficientes para validação de remarcação');
      setSameDayRescheduleError(null);
      return;
    }

    setIsValidatingSameDay(true);
    setSameDayRescheduleError(null);

    try {
      const validation = await validateSameDayReschedule(
        clientWhatsapp,
        establishment.id,
        date
      );

      console.log('📋 Resultado da validação de remarcação:', validation);

      if (!validation.canBook) {
        console.log('❌ Remarcação bloqueada:', validation.message);
        setSameDayRescheduleError(validation.message || 'Remarcação não permitida para esta data.');
      } else {
        console.log('✅ Remarcação permitida');
        setSameDayRescheduleError(null);
      }
    } catch (error) {
      console.error('❌ Erro ao validar remarcação no mesmo dia:', error);
      setSameDayRescheduleError(null); // Em caso de erro, permitir agendamento
    } finally {
      setIsValidatingSameDay(false);
    }
  };

  // Removido useEffect que definia automaticamente o método de pagamento

  // Validar agendamento de assinantes quando data ou WhatsApp mudarem
  useEffect(() => {
    if (clientWhatsapp && establishment?.id) {
      validateSubscriberBookingDate(selectedDate);
      validateSameDayRescheduleDate(selectedDate);
    }
  }, [selectedDate, clientWhatsapp, establishment?.id]);

  // Detectar automaticamente se o WhatsApp é de um assinante usando o novo sistema
  useEffect(() => {
    const checkSubscriber = async () => {
      if (clientWhatsapp && clientWhatsapp.length >= 10 && !isSubscriberBooking) {
        setIsCheckingSubscriber(true);
        try {
          // Primeiro tentar o novo sistema de assinantes
          const { data: newSubscriberData, error: newError } = await checkNewSubscriber(
            clientWhatsapp, 
            establishment.id || establishment.establishment_id || ''
          );
          
          if (newSubscriberData && !newError) {
            // Verificar se o assinante está vencido
            const isExpired = newSubscriberData.is_expired || 
              (new Date(newSubscriberData.end_date) < new Date()) || 
              newSubscriberData.payment_status === 'unpaid';
            
            if (isExpired) {
              console.log('⚠️ Assinante vencido detectado:', newSubscriberData);
              setDetectedSubscriber({
                ...newSubscriberData,
                is_expired: true,
                expiration_message: newSubscriberData.expiration_message || 
                  `Seu plano venceu em ${new Date(newSubscriberData.end_date).toLocaleDateString('pt-BR')}. Renove para continuar agendando.`
              });
              setShowSubscriberNotification(true);
            } else {
              setDetectedSubscriber(newSubscriberData);
              setShowSubscriberNotification(true);
              console.log('🎯 Assinante ativo detectado (novo sistema):', newSubscriberData);
            }
          } else {
            // Fallback para o sistema antigo
            const { data: oldSubscriberData, error: oldError } = await checkWhatsAppSubscriber(
              clientWhatsapp, 
              establishment.id || establishment.establishment_id || ''
            );
            
            if (oldSubscriberData && !oldError) {
              // Verificar se o assinante está vencido no sistema antigo
              const isExpired = (new Date(oldSubscriberData.end_date) < new Date()) || 
                oldSubscriberData.payment_status === 'unpaid';
              
              if (isExpired) {
                console.log('⚠️ Assinante vencido detectado (sistema antigo):', oldSubscriberData);
                setDetectedSubscriber({
                  ...oldSubscriberData,
                  is_expired: true,
                  expiration_message: `Seu plano venceu em ${new Date(oldSubscriberData.end_date).toLocaleDateString('pt-BR')}. Renove para continuar agendando.`
                });
              } else {
                setDetectedSubscriber(oldSubscriberData);
                console.log('🎯 Assinante ativo detectado (sistema antigo):', oldSubscriberData);
              }
              setShowSubscriberNotification(true);
            } else {
              setDetectedSubscriber(null);
              setShowSubscriberNotification(false);
            }
          }
        } catch (error) {
          console.error('Erro ao verificar assinante:', error);
        } finally {
          setIsCheckingSubscriber(false);
        }
      } else {
        setDetectedSubscriber(null);
        setShowSubscriberNotification(false);
      }
    };

    // Debounce para evitar muitas verificações
    const timeoutId = setTimeout(checkSubscriber, 1000);
    return () => clearTimeout(timeoutId);
  }, [clientWhatsapp, establishment.id || establishment.establishment_id, isSubscriberBooking]);

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


  const handlePixComprovantUpload = (url: string) => {
    setPixProofUrl(url);
  };

  const handlePixMethodSelect = (method: 'pix_now' | 'pix_local') => {
    setPixPaymentMethod(method);
    // Não alterar automaticamente o selectedPaymentMethod aqui
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

    // Salvar dados do usuário no localStorage para auto-preenchimento futuro
    if (user && clientName.trim() && clientWhatsapp.trim()) {
      const userData = {
        name: clientName.trim(),
        whatsapp: clientWhatsapp.trim()
      };
      localStorage.setItem('lastUserBookingData', JSON.stringify(userData));
      console.log('💾 Dados do usuário salvos no localStorage:', userData);
    }

    // Validação completa - criar lista do que está faltando
    const missingFields = [];
    
    if (!clientName.trim()) {
      missingFields.push('nome do cliente');
    }
    
    // Para assinantes, não validar serviço nem forma de pagamento
    if (!isSubscriberBooking) {
      if (useMultiService) {
        if (selectedServices.length === 0) {
          missingFields.push('pelo menos um serviço');
        }
      } else {
        if (!selectedService) {
          missingFields.push('serviço');
        }
      }
      
      if (!selectedPaymentMethod) {
        missingFields.push('forma de pagamento');
      }
    }
    
    if (!selectedProfessional) {
      missingFields.push('profissional');
    }
    
    if (!selectedTime) {
      missingFields.push('horário');
    }

    // Validação específica para PIX
    if (selectedPaymentMethod === 'pix' && pixPaymentMethod === 'pix_now' && !pixProofUrl) {
      missingFields.push('comprovante do PIX');
    }

    // VALIDAÇÃO DE ASSINANTE - BLOQUEAR AGENDAMENTO SE FORA DA SEMANA
    if (subscriberBookingError) {
      console.log('❌ Agendamento bloqueado para assinante:', subscriberBookingError);
      
      // Scroll para a mensagem de erro (que já está visível)
      setTimeout(() => {
        const errorElement = document.querySelector('[data-subscriber-error]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Destacar a mensagem com uma animação
          errorElement.classList.add('animate-bounce');
          setTimeout(() => {
            errorElement.classList.remove('animate-bounce');
          }, 1000);
        }
      }, 100);
      
      return;
    }

    // VALIDAÇÃO DE REMARCAÇÃO NO MESMO DIA - BLOQUEAR SE ASSINANTE CANCELOU HOJE
    if (sameDayRescheduleError) {
      console.log('❌ Remarcação bloqueada para assinante:', sameDayRescheduleError);
      
      // Scroll para a mensagem de erro (que já está visível)
      setTimeout(() => {
        const errorElement = document.querySelector('[data-same-day-error]');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Destacar a mensagem com uma animação
          errorElement.classList.add('animate-bounce');
          setTimeout(() => {
            errorElement.classList.remove('animate-bounce');
          }, 1000);
        }
      }, 100);
      
      return;
    }

    // Se há campos faltando, mostrar mensagem amigável
    if (missingFields.length > 0) {
      const message = missingFields.length === 1 
        ? `Por favor, selecione o ${missingFields[0]}.`
        : `Por favor, complete os seguintes campos: ${missingFields.join(', ')}.`;
      
      alert(message);
      return;
    }

    const whatsappNumbers = clientWhatsapp.replace(/\D/g, '');

    setIsLoading(true);
    try {
      // Calcular totais para múltiplos serviços
      const servicesToUse = useMultiService && selectedServices.length > 0 ? selectedServices : [selectedService];
      const totalPrice = servicesToUse.reduce((sum, service) => sum + (service?.price || 0), 0);
      const totalDuration = servicesToUse.reduce((sum, service) => sum + (service?.duration || 0), 0);
      const serviceNames = servicesToUse.map(service => service?.name).filter(Boolean).join(' + ');

      await onSubmit({
        client_name: isSubscriberBooking ? `${clientName} (ASSINANTE)` : clientName, // Adicionar (ASSINANTE) apenas no envio
        client_whatsapp: whatsappNumbers,
        service: isSubscriberBooking && subscriberService ? subscriberService.name : serviceNames,
        professional: selectedProfessional?.id || '',
        appointment_date: format(selectedDate, 'yyyy-MM-dd'),
        appointment_time: selectedTime,
        duration: isSubscriberBooking && subscriberService ? (subscriberService.service_duration || 30) : totalDuration, // Usar duração total
        price: isSubscriberBooking && subscriberService ? 0 : totalPrice, // Preço total
        payment_method: isSubscriberBooking ? 'assinante' : selectedPaymentMethod
      });

      // Só navega após sucesso (REMOVIDO: navigate('/success');)
    } catch (error: any) {
      console.error('❌ Erro ao agendar:', error);
      
      // Tratamento específico para diferentes tipos de erro
      let errorMessage = 'Erro ao realizar agendamento. Tente novamente.';
      
      if (error.message?.includes('Load failed') || error.message?.includes('TypeError')) {
        errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } else if (error.message?.includes('fetch')) {
        errorMessage = 'Problema de conectividade. Tente novamente em alguns segundos.';
      } else if (error.message?.includes('RLS') || error.message?.includes('permission')) {
        errorMessage = 'Erro de permissão. Recarregue a página e tente novamente.';
      } else if (error.message?.includes('Conflito de horário')) {
        errorMessage = error.message; // Usar a mensagem específica de conflito
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
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

  // Seção 6. HORÁRIO
  // Filtrar agendamentos existentes com base no profissional selecionado
  const filteredExistingAppointments = selectedProfessional
    ? existingAppointments.filter(app => app.professional === selectedProfessional.id)
    : []; // Se nenhum profissional for selecionado, não há agendamentos a bloquear



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
          {user && clientName && (
            <p className="mt-1 text-sm text-blue-600 italic">
              Esse é seu nome?
            </p>
          )}
          {isSubscriberBooking && (
            <p className="mt-1 text-sm text-green-600 font-medium">
              📌 O sufixo "(ASSINANTE)" é fixo para identificação do estabelecimento
            </p>
          )}
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
          {user && clientWhatsapp && (
            <p className="mt-1 text-sm text-blue-600 italic">
              Esse é seu WhatsApp?
            </p>
          )}
          
          {/* Notificação de assinante detectado */}
          {showSubscriberNotification && detectedSubscriber && (
            <div className={`mt-3 p-3 border rounded-lg ${
              detectedSubscriber.is_expired 
                ? 'bg-red-50 border-red-200' 
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  detectedSubscriber.is_expired 
                    ? 'bg-red-500' 
                    : 'bg-green-500 animate-pulse'
                }`}></div>
                <span className={`text-sm font-medium ${
                  detectedSubscriber.is_expired 
                    ? 'text-red-800' 
                    : 'text-green-800'
                }`}>
                  {detectedSubscriber.is_expired ? '⚠️ Plano Vencido Detectado!' : '🎯 Assinante detectado automaticamente!'}
                </span>
              </div>
              
              <p className={`text-sm mt-1 ${
                detectedSubscriber.is_expired 
                  ? 'text-red-700' 
                  : 'text-green-700'
              }`}>
                <strong>Plano:</strong> {detectedSubscriber.subscription_name || detectedSubscriber.subscriptions?.name || 'Plano não identificado'}
              </p>
              
              <p className={`text-sm ${
                detectedSubscriber.is_expired 
                  ? 'text-red-700' 
                  : 'text-green-700'
              }`}>
                <strong>Válido até:</strong> {format(new Date(detectedSubscriber.end_date), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
              
              {detectedSubscriber.is_expired && (
                <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded">
                  <p className="text-sm text-red-800 font-medium">
                    {detectedSubscriber.expiration_message || 'Seu plano venceu. Renove para continuar agendando.'}
                  </p>
                </div>
              )}
              
              {!detectedSubscriber.is_expired ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      // Converter para agendamento de assinante
                      setShowSubscriberNotification(false);
                      console.log('🔄 Convertendo para agendamento de assinante:', detectedSubscriber);
                      
                      // Chamar callback para o componente pai
                      if (onConvertToSubscriber) {
                        onConvertToSubscriber(detectedSubscriber);
                      }
                    }}
                    className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                  >
                    Usar como Assinante
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSubscriberNotification(false)}
                    className="mt-2 ml-2 px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                  >
                    Continuar Normal
                  </button>
                </>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <p className="text-sm text-red-700 font-medium">
                    Para agendar, você precisa renovar seu plano.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSubscriberNotification(false)}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    Fechar e Renovar
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Indicador de verificação */}
          {isCheckingSubscriber && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Verificando se é assinante...
            </div>
          )}
          
          {/* Mensagem de erro para limitação de agendamento de assinantes */}
          {subscriberBookingError && (
            <div 
              data-subscriber-error
              className="mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 rounded-lg shadow-lg animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-xl">🚫</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-red-800 mb-1">
                      Agendamento Restrito
                    </h3>
                    <div className="text-red-500 text-sm font-medium">
                      ⚠️ Atenção
                    </div>
                  </div>
                  <p className="text-sm text-red-700 leading-relaxed mb-2">
                    {subscriberBookingError}
                  </p>
                  <div className="bg-red-100 rounded-md p-2">
                    <p className="text-xs text-red-600 font-medium">
                      💡 Dica: Escolha uma data dentro da semana atual para prosseguir com o agendamento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading de validação */}
          {isValidatingBooking && (
            <div className="mt-3 flex items-center gap-2 text-blue-600">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-sm">Verificando disponibilidade...</span>
            </div>
          )}

          {/* Mensagem de erro para remarcação no mesmo dia */}
          {sameDayRescheduleError && (
            <div 
              data-same-day-error
              className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 rounded-lg shadow-lg animate-pulse"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-xl">🚫</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-orange-800 mb-1">
                      Remarcação Bloqueada
                    </h3>
                    <div className="text-orange-500 text-sm font-medium">
                      ⚠️ Atenção
                    </div>
                  </div>
                  <p className="text-sm text-orange-700 leading-relaxed mb-2">
                    {sameDayRescheduleError}
                  </p>
                  <div className="bg-orange-100 rounded-md p-2">
                    <p className="text-xs text-orange-600 font-medium">
                      💡 Dica: Escolha uma data diferente para prosseguir com o agendamento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading de validação de remarcação */}
          {isValidatingSameDay && (
            <div className="mt-3 flex items-center gap-2 text-orange-600">
              <div className="animate-spin h-4 w-4 border-2 border-orange-600 border-t-transparent rounded-full"></div>
              <span className="text-sm">Verificando histórico de cancelamentos...</span>
            </div>
          )}
        </div>



        {/* 3. SERVIÇO - Oculto para assinantes */}
        {!isSubscriberBooking && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              3. Escolha o Serviço
            </label>
            
            {/* Toggle para escolher entre seleção única ou múltipla */}
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setUseMultiService(false);
                  setSelectedServices([]);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !useMultiService 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Um Serviço
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseMultiService(true);
                  setSelectedService(undefined);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  useMultiService 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Múltiplos Serviços (até 4)
              </button>
            </div>

            {/* Renderizar componente apropriado */}
            {useMultiService ? (
              <MultiServiceSelector
                services={establishment.services_with_prices}
                selectedServices={selectedServices}
                onSelectServices={setSelectedServices}
                maxServices={4}
              />
            ) : (
              <ServiceList
                services={establishment.services_with_prices}
                selectedService={selectedService}
                onSelectService={setSelectedService}
              />
            )}
          </div>
        )}

        {/* Serviço do Assinante - Mostrado apenas para assinantes */}
        {isSubscriberBooking && subscriberService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              3. Serviço Incluído
            </label>
            <div className="w-full p-4 rounded-lg border border-green-200 bg-green-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-800">{subscriberService.name}</h3>
                  <p className="text-sm text-green-600">Incluído na sua assinatura</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-800">GRÁTIS</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. PROFISSIONAL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            4. Escolha o Profissional
          </label>
          <ProfessionalSelector
            professionals={establishment.professionals}
            selectedProfessional={selectedProfessional?.id || null}
            onSelectProfessional={(professionalId) => {
              const professional = establishment.professionals.find(p => p.id === professionalId);
              setSelectedProfessional(professional);
            }}
            establishmentId={establishment.id || establishment.establishment_id || ''}
          />
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
            allowedWeekdays={subscriberService?.weekdays}
            isSubscriberBooking={isSubscriberBooking}
          />
        </div>

        {/* 6. HORÁRIO */}
        {(selectedService || (useMultiService && selectedServices.length > 0) || (isSubscriberBooking && subscriberService)) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              6. Escolha o Horário
            </label>
            
            {/* Verificar se o dia selecionado é válido para assinantes */}
            {isSubscriberBooking && subscriberService && !isValidDayForSubscriber(selectedDate, subscriberService.weekdays) ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Dia não disponível para este serviço
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Seus dias de agendamento para <strong>{subscriberService.name}</strong> são:</p>
                      <p className="mt-1 font-semibold">
                        {subscriberService.weekdays?.map((day: string) => {
                          const dayNames = {
                            'monday': 'Segunda-feira',
                            'tuesday': 'Terça-feira', 
                            'wednesday': 'Quarta-feira',
                            'thursday': 'Quinta-feira',
                            'friday': 'Sexta-feira',
                            'saturday': 'Sábado',
                            'sunday': 'Domingo'
                          };
                          return dayNames[day as keyof typeof dayNames] || day;
                        }).join(', ') || 'Não configurado'}
                      </p>
                      <p className="mt-2">Por favor, escolha uma data que corresponda a um desses dias da semana.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <TimeSlotSelector
                selectedDate={selectedDate}
                selectedService={isSubscriberBooking && subscriberService ? {
                  id: subscriberService.id,
                  name: subscriberService.name,
                  price: 0, // Preço 0 para assinantes
                  duration: subscriberService.service_duration || 30 // Usar duração da assinatura
                } : useMultiService && selectedServices.length > 0 ? {
                  id: 'multiple',
                  name: selectedServices.map(s => s.name).join(' + '),
                  price: selectedServices.reduce((sum, s) => sum + s.price, 0),
                  duration: selectedServices.reduce((sum, s) => sum + s.duration, 0)
                } : selectedService}
                existingAppointments={filteredExistingAppointments} // Passar agendamentos filtrados
                selectedTime={selectedTime}
                onTimeSelect={setSelectedTime}
                businessHours={businessHours}
                use15MinuteInterval={establishment.use_15_minute_interval || false}
              />
            )}
          </div>
        )}

        {/* 7. FORMA DE PAGAMENTO - Oculto para assinantes */}
        {(selectedService || (useMultiService && selectedServices.length > 0)) && !isSubscriberBooking && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              7. Forma de Pagamento
            </label>
            <PaymentMethodSelector
              selectedMethod={selectedPaymentMethod}
              onMethodSelect={setSelectedPaymentMethod}
              showPixOptions={!!establishment.pix_key}
              pixPaymentMethod={pixPaymentMethod}
              onPixMethodSelect={handlePixMethodSelect}
            />
            
            {/* Formulário PIX quando selecionado */}
            {selectedPaymentMethod === 'pix' && establishment.pix_key && (
              <div className="mt-4">
                <PixPaymentForm
                  establishment={establishment}
                  selectedService={useMultiService && selectedServices.length > 0 ? {
                    id: 'multiple',
                    name: selectedServices.map(s => s.name).join(' + '),
                    price: selectedServices.reduce((sum, s) => sum + s.price, 0),
                    duration: selectedServices.reduce((sum, s) => sum + s.duration, 0)
                  } : selectedService || { id: '', name: '', price: 0, duration: 0 }}
                  onPixMethodSelect={handlePixMethodSelect}
                  onPixProofUpload={handlePixComprovantUpload}
                  pixPaymentMethod={pixPaymentMethod}
                  pixProofUrl={pixProofUrl}
                />
              </div>
            )}
          </div>
        )}

        {/* Pagamento já incluído - Mostrado apenas para assinantes */}
        {isSubscriberBooking && subscriberService && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              7. Pagamento
            </label>
            <div className="w-full p-4 rounded-lg border border-blue-200 bg-blue-50">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
                <p className="text-blue-800 font-medium">Pagamento já incluído na sua assinatura</p>
              </div>
            </div>
          </div>
        )}

        {/* RESUMO DO AGENDAMENTO */}
        {((selectedService && selectedProfessional && selectedPaymentMethod && selectedTime) || 
          (isSubscriberBooking && subscriberService && selectedProfessional && selectedTime)) && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-primary mb-2">📋 Resumo do Agendamento:</h3>
            <div className="text-sm text-gray-700 space-y-1">
              <div><strong>Cliente:</strong> {isSubscriberBooking ? `${clientName} (ASSINANTE)` : (clientName || 'Não informado')}</div>
              <div><strong>WhatsApp:</strong> {clientWhatsapp || 'Não informado'}</div>
              <div><strong>Serviço:</strong> {
                isSubscriberBooking && subscriberService 
                  ? `${subscriberService.name} - GRÁTIS (Incluído na assinatura)`
                  : `${selectedService?.name || ''} - R$ ${selectedService?.price.toFixed(2).replace('.', ',') || '0,00'}`
              }</div>
              <div><strong>Profissional:</strong> {selectedProfessional?.name || ''}</div>
              <div><strong>Pagamento:</strong> {
                isSubscriberBooking 
                  ? 'Já incluído na assinatura'
                  : selectedPaymentMethod === 'pix' ? (pixPaymentMethod === 'pix_now' ? 'PIX (Pagar agora)' : 'PIX (Pagar no local)') :
                    selectedPaymentMethod === 'credito' ? 'Cartão de Crédito' :
                    selectedPaymentMethod === 'debito' ? 'Cartão de Débito' :
                    selectedPaymentMethod === 'dinheiro' ? 'Dinheiro' : selectedPaymentMethod
              }</div>
              <div><strong>Data:</strong> {format(selectedDate, 'dd/MM/yyyy')}</div>
              <div><strong>Horário:</strong> {selectedTime}</div>
              <div><strong>Duração:</strong> {
                isSubscriberBooking && subscriberService 
                  ? `${subscriberService.service_duration || 30} minutos` // Usar duração da assinatura
                  : `${selectedService?.duration || 30} minutos`
              }</div>
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