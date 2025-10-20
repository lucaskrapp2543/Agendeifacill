import { CheckCircle, Clock, Scissors, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Professional {
  id: string;
  name: string;
  photo?: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  establishment_id: string;
  is_active: boolean;
  display_order: number;
}

interface ServiceSubcategory {
  id: string;
  name: string;
  price: number;
  duration: number;
  category_id: string;
  is_active: boolean;
  display_order: number;
}

interface Subscription {
  id: string;
  name: string;
  service_name: string;
  service_duration: number;
  price: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  isAvulso?: boolean;
  reason?: string;
}

interface ReservarClienteProps {
  establishmentId: string;
  use15MinuteInterval?: boolean;
  use20MinuteScheduleProp?: boolean;
  onClose: () => void;
}

export default function ReservarCliente({ establishmentId, use15MinuteInterval = false, use20MinuteScheduleProp = false, onClose }: ReservarClienteProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'professional' | 'service' | 'time' | 'confirm'>('professional');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Estado para configuração de horários
  const [use20MinuteSchedule, setUse20MinuteSchedule] = useState(false);

  // Estados para categorias de serviços
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [serviceSubcategories, setServiceSubcategories] = useState<ServiceSubcategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<ServiceSubcategory | null>(null);
  const [showCategoryServices, setShowCategoryServices] = useState(false);

  // Estados para assinantes
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  // Carregar profissionais e configuração de horários
  useEffect(() => {
    const loadProfessionals = async () => {
      try {
        console.log('🔍 Carregando profissionais para establishment:', establishmentId);
        const { data, error } = await supabase
          .from('establishments')
          .select('professionals, use_20_minute_schedule')
          .eq('id', establishmentId)
          .single();

        if (error) {
          console.error('❌ Erro ao buscar establishment:', error);
          throw error;
        }

        console.log('✅ Establishment carregado:', data);

        // Carregar configuração de horários de 20 em 20 minutos
        setUse20MinuteSchedule(data?.use_20_minute_schedule ?? false);
        console.log('✅ Configuração de horários 20min:', data?.use_20_minute_schedule);

        // Converter profissionais do formato JSON para o formato esperado
        const establishmentProfessionals = data?.professionals || [];
        const formattedProfessionals = establishmentProfessionals.map((prof: any) => ({
          id: prof.id,
          name: prof.name,
          photo: prof.photo_url || prof.photo
        }));

        console.log('✅ Profissionais formatados:', formattedProfessionals);
        setProfessionals(formattedProfessionals);
      } catch (error) {
        console.error('❌ Erro ao carregar profissionais:', error);
        alert('Erro ao carregar profissionais. Verifique o console para mais detalhes.');
      }
    };

    if (establishmentId) {
      loadProfessionals();
    } else {
      console.error('❌ establishmentId não fornecido');
    }
  }, [establishmentId]);

  // Carregar clubes de assinatura
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!establishmentId) {
        console.log('⚠️ establishmentId não fornecido para carregar assinaturas');
        return;
      }

      try {
        console.log('🔍 Carregando assinaturas para establishment:', establishmentId);

        // Buscar TODAS as assinaturas (SEM filtro is_active pois a coluna não existe!)
        const { data: subs, error: subsError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('establishment_id', establishmentId);

        if (subsError) {
          console.error('❌ Erro ao carregar assinaturas:', subsError);
          throw subsError;
        }

        console.log('✅ Assinaturas encontradas:', subs);
        console.log('✅ Total de assinaturas:', subs?.length || 0);
        console.log('✅ Detalhes:', subs);

        setSubscriptions(subs || []);
      } catch (error) {
        console.error('❌ Erro ao carregar assinaturas:', error);
      }
    };

    loadSubscriptions();
  }, [establishmentId]);

  // Carregar categorias de serviços
  useEffect(() => {
    const loadServiceCategories = async () => {
      if (!establishmentId) return;

      try {
        console.log('🔍 Carregando categorias de serviços para establishment:', establishmentId);
        const { data: categories, error: categoriesError } = await supabase
          .from('service_categories')
          .select('*')
          .eq('establishment_id', establishmentId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (categoriesError) throw categoriesError;

        console.log('🔍 Categorias encontradas:', categories);
        setServiceCategories(categories || []);
      } catch (error) {
        console.error('Erro ao carregar categorias:', error);
      }
    };

    loadServiceCategories();
  }, [establishmentId]);

  // Carregar subcategorias quando categoria for selecionada
  useEffect(() => {
    const loadServiceSubcategories = async () => {
      if (!selectedCategory?.id) {
        setServiceSubcategories([]);
        return;
      }

      try {
        console.log('🔍 Carregando subcategorias para categoria:', selectedCategory.name);
        const { data: subcategories, error: subcategoriesError } = await supabase
          .from('service_subcategories')
          .select('*')
          .eq('category_id', selectedCategory.id)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (subcategoriesError) throw subcategoriesError;

        console.log('🔍 Subcategorias encontradas:', subcategories);
        setServiceSubcategories(subcategories || []);
      } catch (error) {
        console.error('Erro ao carregar subcategorias:', error);
      }
    };

    loadServiceSubcategories();
  }, [selectedCategory]);

  // Carregar serviços do profissional selecionado
  useEffect(() => {
    const loadServices = async () => {
      if (!selectedProfessional) return;

      try {
        console.log('🔍 Carregando serviços para establishment:', establishmentId);
        const { data, error } = await supabase
          .from('establishments')
          .select('services_with_prices')
          .eq('id', establishmentId)
          .single();

        if (error) {
          console.error('❌ Erro ao buscar serviços:', error);
          throw error;
        }

        console.log('✅ Serviços carregados:', data);

        // Converter serviços do formato JSON para o formato esperado
        const establishmentServices = data?.services_with_prices || [];
        const formattedServices = establishmentServices.map((service: any) => ({
          id: service.id || Math.random().toString(36).substring(2),
          name: service.name,
          price: service.price,
          duration: service.duration
        }));

        console.log('✅ Serviços formatados:', formattedServices);
        setServices(formattedServices);
      } catch (error) {
        console.error('❌ Erro ao carregar serviços:', error);
        alert('Erro ao carregar serviços');
      }
    };

    loadServices();
  }, [selectedProfessional, establishmentId]);

  // Carregar horários disponíveis
  useEffect(() => {
    const loadTimeSlots = async () => {
      if ((!selectedService && selectedServices.length === 0) || !selectedDate) return;

      setLoading(true);
      try {
        // Buscar agendamentos existentes para a data - CORRIGIDO
        const { data: appointments, error } = await supabase
          .from('appointments')
          .select('appointment_time, duration, is_avulso, professional, status')
          .eq('establishment_id', establishmentId)
          .eq('appointment_date', selectedDate)
          .neq('status', 'cancelled'); // Incluir todos exceto cancelados

        if (error) throw error;

        console.log('🔍 Agendamentos encontrados:', appointments);
        console.log('🔍 Profissional selecionado:', selectedProfessional?.name);
        console.log('🔍 ID do profissional selecionado:', selectedProfessional?.id);
        console.log('🔍 Data selecionada:', selectedDate);
        console.log('🔍 Establishment ID:', establishmentId);

        // Log detalhado de cada agendamento
        if (appointments && appointments.length > 0) {
          console.log('🔍 Detalhes dos agendamentos:');
          appointments.forEach((apt, index) => {
            console.log(`  Agendamento ${index + 1}:`, {
              professional: apt.professional,
              appointment_time: apt.appointment_time,
              duration: apt.duration,
              is_avulso: apt.is_avulso,
              status: apt.status
            });
          });
        } else {
          console.log('⚠️ NENHUM AGENDAMENTO ENCONTRADO para a data:', selectedDate);
        }

        // Calcular duração total dos serviços selecionados
        const totalDuration = selectedServices.length > 0
          ? calculateTotalDuration(selectedServices)
          : selectedService?.duration || 30;

        // Buscar horários do estabelecimento e do profissional
        const establishmentHours = await supabase
          .from('establishments')
          .select('business_hours')
          .eq('id', establishmentId)
          .single();

        const professionalHours = await supabase
          .from('establishments')
          .select('professionals')
          .eq('id', establishmentId)
          .single();

        // Determinar horários de trabalho para o dia da semana
        const selectedDateObj = new Date(selectedDate + 'T00:00:00'); // Forçar timezone local
        const dayOfWeek = selectedDateObj.getDay(); // 0 = domingo, 1 = segunda, etc.
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];

        console.log('🔍 DEBUG - Data selecionada:', selectedDate);
        console.log('🔍 DEBUG - Data objeto:', selectedDateObj);
        console.log('🔍 DEBUG - Dia da semana:', dayOfWeek, dayName);
        console.log('🔍 DEBUG - Data formatada:', selectedDateObj.toLocaleDateString('pt-BR'));
        console.log('🔍 DEBUG - Establishment hours:', establishmentHours.data);
        console.log('🔍 DEBUG - Professional hours:', professionalHours.data);

        let workHours = null;

        // Primeiro, verificar se o profissional tem horários específicos para este dia
        let hasProfessionalHours = false;

        if (professionalHours.data?.professionals) {
          const professional = professionalHours.data.professionals.find(p => p.id === selectedProfessional?.id);
          if (professional?.work_hours?.[dayName]) {
            const profHours = professional.work_hours[dayName];
            console.log('🔍 Horários brutos do profissional para', dayName, ':', profHours);

            // Só usar horários do profissional se estiver habilitado
            if (profHours.enabled) {
              // Converter formato do profissional para formato padrão
              if (profHours.entry_time && profHours.exit_time) {
                workHours = {
                  enabled: profHours.enabled,
                  open1: profHours.entry_time,
                  close1: profHours.exit_time,
                  open2: null,
                  close2: null
                };

                // Se tem intervalo, ajustar
                if (profHours.break_start && profHours.break_end) {
                  workHours.close1 = profHours.break_start;
                  workHours.open2 = profHours.break_end;
                  workHours.close2 = profHours.exit_time;
                }

                hasProfessionalHours = true;
                console.log('🔍 Usando horários específicos do profissional para', dayName, ':', workHours);
              } else {
                workHours = profHours;
                hasProfessionalHours = true;
              }
            } else {
              console.log('🔍 Profissional tem horário para', dayName, 'mas está DESABILITADO - usando horário do estabelecimento');
            }
          } else {
            console.log('🔍 Profissional não tem horário específico para', dayName, '- usando horário do estabelecimento');
          }
        }

        // Se não tem horário específico do profissional, usar horário do estabelecimento
        if (!hasProfessionalHours && establishmentHours.data?.business_hours?.[dayName]) {
          workHours = establishmentHours.data.business_hours[dayName];
          console.log('🔍 Usando horários do estabelecimento para', dayName, ':', workHours);
        }

        // Se não tem nenhum horário definido, usar padrão 8h-18h
        if (!workHours) {
          workHours = { enabled: true, open1: '08:00', close1: '18:00', open2: null, close2: null };
          console.log('🔍 Usando horário padrão:', workHours);
        }

        console.log('🔍 DEBUG - Work hours final:', workHours);

        // Verificar se o dia está habilitado
        if (!workHours.enabled) {
          console.log('⚠️ Dia não habilitado para trabalho');
          setTimeSlots([]);
          return;
        }

        // Gerar slots baseados nos horários de trabalho
        const slots: TimeSlot[] = [];

        // Função para converter horário para minutos
        const timeToMinutes = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours * 60 + minutes;
        };

        // Função para converter minutos para horário
        const minutesToTime = (minutes: number) => {
          const hours = Math.floor(minutes / 60);
          const mins = minutes % 60;
          return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        };

        // Determinar o intervalo baseado na configuração
        let interval = 30; // Padrão: 30 em 30 minutos
        if (use20MinuteScheduleProp) {
          interval = 20; // Horários de 20 em 20 minutos
        } else if (!use15MinuteInterval) {
          interval = 15; // Horários de 15 em 15 minutos (quando DESMARCADO)
        }
        console.log('🔍 DEBUG - Intervalo de horários:', interval, 'minutos');

        // Gerar slots para o primeiro período
        if (workHours.open1 && workHours.close1) {
          const startMinutes = timeToMinutes(workHours.open1);
          const endMinutes = timeToMinutes(workHours.close1);

          console.log('🔍 DEBUG - Gerando slots período 1:', {
            open1: workHours.open1,
            close1: workHours.close1,
            startMinutes,
            endMinutes,
            interval
          });

          for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
            const time = minutesToTime(minutes);
            const slotStart = new Date(`${selectedDate}T${time}:00`);
            const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

            // Verificar conflitos
            let available = true;
            let isAvulso = false;
            let reason = '';

            if (appointments) {
              // Filtrar apenas agendamentos do profissional selecionado (por ID)
              const professionalAppointments = appointments.filter(
                appointment => {
                  const matchesId = appointment.professional === selectedProfessional?.id;
                  return matchesId;
                }
              );

              for (const appointment of professionalAppointments) {
                const apptStart = new Date(`${selectedDate}T${appointment.appointment_time}:00`);
                const apptEnd = new Date(apptStart.getTime() + (appointment.duration || 30) * 60000);

                // Verificar sobreposição
                const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);

                if (hasOverlap) {
                  available = false;
                  isAvulso = appointment.is_avulso || false;
                  reason = isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado';
                  break;
                }
              }
            }

            slots.push({
              time,
              available,
              isAvulso,
              reason
            });
          }
        }

        // Gerar slots para o segundo período (se existir)
        if (workHours.open2 && workHours.close2) {
          const startMinutes = timeToMinutes(workHours.open2);
          const endMinutes = timeToMinutes(workHours.close2);

          for (let minutes = startMinutes; minutes < endMinutes; minutes += interval) {
            const time = minutesToTime(minutes);
            const slotStart = new Date(`${selectedDate}T${time}:00`);
            const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000);

            // Verificar conflitos
            let available = true;
            let isAvulso = false;
            let reason = '';

            if (appointments) {
              const professionalAppointments = appointments.filter(
                appointment => appointment.professional === selectedProfessional?.id
              );

              for (const appointment of professionalAppointments) {
                const apptStart = new Date(`${selectedDate}T${appointment.appointment_time}:00`);
                const apptEnd = new Date(apptStart.getTime() + (appointment.duration || 30) * 60000);

                const hasOverlap = (slotStart < apptEnd && slotEnd > apptStart);

                if (hasOverlap) {
                  available = false;
                  isAvulso = appointment.is_avulso || false;
                  reason = isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado';
                  break;
                }
              }
            }

            slots.push({
              time,
              available,
              isAvulso,
              reason
            });
          }
        }

        console.log('✅ Slots gerados:', slots.length);
        console.log('✅ Slots disponíveis:', slots.filter(s => s.available).length);
        console.log('✅ Slots bloqueados:', slots.filter(s => !s.available).length);
        console.log('🔍 DEBUG - Todos os slots:', slots);

        setTimeSlots(slots);
      } catch (error) {
        console.error('Erro ao carregar horários:', error);
        alert('Erro ao carregar horários');
      } finally {
        setLoading(false);
      }
    };

    loadTimeSlots();
  }, [selectedService, selectedServices, selectedDate, selectedProfessional]);

  const handleProfessionalSelect = (professional: Professional) => {
    setSelectedProfessional(professional);
    setStep('service');
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep('time');
  };

  const handleMultipleServiceToggle = (service: Service) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const handleMultipleServicesConfirm = () => {
    if (selectedServices.length > 0) {
      setStep('time');
    }
  };

  // Calcular total de tempo e valor dos serviços selecionados
  const calculateTotalDuration = (services: Service[]) => {
    return services.reduce((total, service) => total + service.duration, 0);
  };

  const calculateTotalPrice = (services: Service[]) => {
    return services.reduce((total, service) => total + service.price, 0);
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    }
    return `${minutes}min`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleCategorySelect = (category: ServiceCategory) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setShowCategoryServices(true);
  };

  const handleSubcategorySelect = (subcategory: ServiceSubcategory) => {
    setSelectedSubcategory(subcategory);
    // Converter subcategoria para formato de serviço
    const serviceFromSubcategory: Service = {
      id: subcategory.id,
      name: subcategory.name,
      price: subcategory.price,
      duration: subcategory.duration
    };
    setSelectedService(serviceFromSubcategory);
    setStep('time');
  };

  const handleSubscriptionSelect = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    // Converter assinatura para formato de serviço (com preço R$ 0,00)
    // Usar o NOME DO CLUBE + serviço para identificação
    const serviceFromSubscription: Service = {
      id: subscription.id,
      name: `${subscription.name} (${subscription.service_name})`, // Ex: "Club Mensal (Cabelo e Barba)"
      price: 0, // Assinantes não pagam
      duration: subscription.service_duration
    };
    setSelectedService(serviceFromSubscription);
    setStep('time');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  const handleConfirmReservation = async () => {
    if (!selectedProfessional || (!selectedService && selectedServices.length === 0) || !selectedTime) return;

    setLoading(true);
    try {
      // Determinar serviços a serem inseridos
      const servicesToInsert = selectedServices.length > 0 ? selectedServices : [selectedService!];
      const totalPrice = selectedServices.length > 0
        ? calculateTotalPrice(selectedServices)
        : selectedService!.price;
      const totalDuration = selectedServices.length > 0
        ? calculateTotalDuration(selectedServices)
        : selectedService!.duration;

      // Criar nome dos serviços
      const serviceNames = servicesToInsert.map(s => s.name).join(', ');

      // Verificar se é um agendamento de assinante
      const isSubscriber = selectedSubscription !== null;

      const { error } = await supabase
        .from('appointments')
        .insert({
          client_id: user?.id, // Usar ID do usuário atual (estabelecimento)
          establishment_id: establishmentId,
          professional: selectedProfessional.id, // Usar ID do profissional
          service: serviceNames,
          client_name: isSubscriber ? 'ASSINANTE' : 'CLIENTE AVULSO',
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          status: 'confirmed',
          price: totalPrice,
          total_price: totalPrice,
          duration: totalDuration,
          is_avulso: true,
          is_subscriber: isSubscriber // Salvar se é assinante
        });

      if (error) throw error;

      alert('Reserva criada com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao criar reserva:', error);
      alert('Erro ao criar reserva');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6" />
              <h2 className="text-xl font-bold">Reservar Cliente</h2>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-200 transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Selecionar Profissional */}
          {step === 'professional' && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <User className="h-5 w-5 mr-2 text-gray-600" />
                Selecione o Profissional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {professionals.length === 0 ? (
                  <div className="col-span-2 text-center py-8">
                    <p className="text-gray-600 mb-4">Nenhum profissional encontrado</p>
                    <p className="text-sm text-gray-500">
                      Verifique se existem profissionais cadastrados e ativos no sistema.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Recarregar
                    </button>
                  </div>
                ) : (
                  professionals.map((professional) => (
                    <button
                      key={professional.id}
                      onClick={() => handleProfessionalSelect(professional)}
                      className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex items-center space-x-3">
                        {professional.photo ? (
                          <img
                            src={professional.photo}
                            alt={professional.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold text-gray-800">{professional.name}</h4>
                          <p className="text-sm text-gray-600">Profissional</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 2: Selecionar Serviço */}
          {step === 'service' && selectedProfessional && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center text-gray-800">
                  <Scissors className="h-5 w-5 mr-2 text-gray-600" />
                  Serviços de {selectedProfessional.name}
                </h3>
                <button
                  onClick={() => setStep('professional')}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Voltar
                </button>
              </div>

              {/* Serviços Normais */}
              {services.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-700 mb-3">Serviços Diretos</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {services.map((service) => {
                      const isSelected = selectedServices.some(s => s.id === service.id);
                      return (
                        <button
                          key={service.id}
                          onClick={() => handleMultipleServiceToggle(service)}
                          className={`p-4 border-2 rounded-lg transition-all text-left ${isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                            }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${isSelected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                                }`}>
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-800">{service.name}</h4>
                                <p className="text-sm text-gray-600">
                                  {formatDuration(service.duration)} • {formatPrice(service.price)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Resumo dos serviços selecionados */}
                  {selectedServices.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h5 className="font-medium text-blue-900 mb-2">Serviços Selecionados:</h5>
                      <div className="space-y-1">
                        {selectedServices.map((service) => (
                          <div key={service.id} className="flex justify-between text-sm text-blue-800">
                            <span>{service.name}</span>
                            <span>{formatDuration(service.duration)} • {formatPrice(service.price)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-2 border-t border-blue-200">
                        <div className="flex justify-between font-semibold text-blue-900">
                          <span>Total:</span>
                          <span>
                            {formatDuration(calculateTotalDuration(selectedServices))} • {formatPrice(calculateTotalPrice(selectedServices))}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleMultipleServicesConfirm}
                        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Continuar com {selectedServices.length} serviço{selectedServices.length > 1 ? 's' : ''}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Serviços por Categoria */}
              {serviceCategories.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-700">Serviços por Categoria</h4>

                  {!showCategoryServices ? (
                    // Mostrar lista de categorias
                    <div className="grid grid-cols-1 gap-4">
                      {serviceCategories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => handleCategorySelect(category)}
                          className="p-4 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left"
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold text-gray-800">{category.name}</h4>
                              <p className="text-sm text-gray-600">Clique para ver opções</p>
                            </div>
                            <div className="text-green-600">→</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    // Mostrar subcategorias da categoria selecionada
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-lg font-medium text-gray-800">
                          {selectedCategory?.name}
                        </h5>
                        <button
                          onClick={() => {
                            setShowCategoryServices(false);
                            setSelectedCategory(null);
                            setSelectedSubcategory(null);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          ← Voltar às Categorias
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {serviceSubcategories.map((subcategory) => (
                          <button
                            key={subcategory.id}
                            onClick={() => handleSubcategorySelect(subcategory)}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <h4 className="font-semibold text-gray-800">{subcategory.name}</h4>
                                <p className="text-sm text-gray-600">
                                  {formatDuration(subcategory.duration)} • {formatPrice(subcategory.price)}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DEBUG: Mostrar quantidade de assinaturas carregadas */}
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                <p className="text-sm text-yellow-800">
                  🔍 <strong>DEBUG:</strong> {subscriptions.length} assinaturas carregadas
                </p>
                {subscriptions.length === 0 && (
                  <p className="text-xs text-yellow-700 mt-1">
                    Se você tem clubes de assinatura cadastrados, verifique o console do navegador (F12)
                  </p>
                )}
              </div>

              {/* Clubes de Assinatura */}
              {subscriptions.length > 0 ? (
                <div className="space-y-4 mt-6">
                  <h4 className="text-md font-medium text-gray-700">Assinantes</h4>
                  <div className="grid grid-cols-1 gap-4">
                    {subscriptions.map((subscription) => (
                      <button
                        key={subscription.id}
                        onClick={() => handleSubscriptionSelect(subscription)}
                        className="p-4 border-2 border-purple-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-gray-800">{subscription.name}</h4>
                            <p className="text-sm text-gray-600">
                              {subscription.service_name} • {formatDuration(subscription.service_duration)} • <span className="text-green-600 font-semibold">GRATUITO</span>
                            </p>
                          </div>
                          <div className="text-purple-600">👑</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                  <p className="text-sm text-gray-700">
                    ℹ️ <strong>Nenhum clube de assinatura encontrado.</strong>
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Cadastre clubes de assinatura na aba "Assinantes" do dashboard para que eles apareçam aqui.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Selecionar Horário */}
          {step === 'time' && (selectedService || selectedServices.length > 0) && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center text-gray-800">
                  <Clock className="h-5 w-5 mr-2 text-gray-600" />
                  Horários Disponíveis
                </h3>
                <button
                  onClick={() => setStep('service')}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Voltar
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                />
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-700">Carregando horários...</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && handleTimeSelect(slot.time)}
                      disabled={!slot.available}
                      className={`p-3 text-sm rounded-lg transition-all ${slot.available
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 border border-green-300'
                        : slot.isAvulso
                          ? 'bg-orange-100 text-orange-800 border border-orange-300 cursor-not-allowed'
                          : 'bg-red-100 text-red-800 border border-red-300 cursor-not-allowed'
                        }`}
                    >
                      <div className="text-center">
                        <div className="font-semibold">{slot.time}</div>
                        {slot.isAvulso && (
                          <div className="text-xs text-orange-600 mt-1">
                            RESERVA AVULSA
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirmar Reserva */}
          {step === 'confirm' && selectedProfessional && (selectedService || selectedServices.length > 0) && selectedTime && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <CheckCircle className="h-5 w-5 mr-2 text-gray-600" />
                Confirmar Reserva
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold mb-2 text-gray-800">Detalhes da Reserva:</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Profissional:</strong> {selectedProfessional.name}</p>

                  {selectedServices.length > 0 ? (
                    <>
                      <p><strong>Serviços:</strong></p>
                      <ul className="ml-4 space-y-1">
                        {selectedServices.map((service) => (
                          <li key={service.id} className="flex justify-between">
                            <span>{service.name}</span>
                            <span>{formatDuration(service.duration)} • {formatPrice(service.price)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t pt-2 mt-2">
                        <p><strong>Total:</strong> {formatDuration(calculateTotalDuration(selectedServices))} • {formatPrice(calculateTotalPrice(selectedServices))}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p><strong>Serviço:</strong> {selectedService?.name}</p>
                      <p><strong>Duração:</strong> {formatDuration(selectedService?.duration || 0)}</p>
                      <p><strong>Preço:</strong> {selectedSubscription ? <span className="text-green-600 font-semibold">GRATUITO</span> : formatPrice(selectedService?.price || 0)}</p>
                    </>
                  )}

                  <p><strong>Data:</strong> {new Date(selectedDate).toLocaleDateString('pt-BR')}</p>
                  <p><strong>Horário:</strong> {selectedTime}</p>
                  <p><strong>Cliente:</strong> {selectedSubscription ? <span className="text-purple-600 font-semibold">ASSINANTE 👑</span> : 'CLIENTE AVULSO'}</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('time')}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleConfirmReservation}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Criando...' : 'Confirmar Reserva'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}