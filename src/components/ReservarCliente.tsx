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

interface TimeSlot {
  time: string;
  available: boolean;
  isAvulso?: boolean;
  reason?: string;
}

interface ReservarClienteProps {
  establishmentId: string;
  onClose: () => void;
}

export default function ReservarCliente({ establishmentId, onClose }: ReservarClienteProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'professional' | 'service' | 'time' | 'confirm'>('professional');
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Estados para categorias de serviços
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [serviceSubcategories, setServiceSubcategories] = useState<ServiceSubcategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<ServiceSubcategory | null>(null);
  const [showCategoryServices, setShowCategoryServices] = useState(false);

  // Carregar profissionais
  useEffect(() => {
    const loadProfessionals = async () => {
      try {
        console.log('🔍 Carregando profissionais para establishment:', establishmentId);
        const { data, error } = await supabase
          .from('establishments')
          .select('professionals')
          .eq('id', establishmentId)
          .single();

        if (error) {
          console.error('❌ Erro ao buscar establishment:', error);
          throw error;
        }

        console.log('✅ Establishment carregado:', data);

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
      if (!selectedService || !selectedDate) return;

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

        // Gerar slots de 30 em 30 minutos das 8h às 18h
        const slots: TimeSlot[] = [];
        const startHour = 8;
        const endHour = 18;

        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const slotStart = new Date(`${selectedDate}T${time}:00`);
            const slotEnd = new Date(slotStart.getTime() + selectedService.duration * 60000);

            // Verificar conflitos
            let available = true;
            let isAvulso = false;
            let reason = '';

            if (appointments) {
              // Filtrar apenas agendamentos do profissional selecionado (por ID)
              const professionalAppointments = appointments.filter(
                appointment => {
                  const matchesId = appointment.professional === selectedProfessional?.id;

                  console.log(`🔍 Comparando agendamento:`, {
                    appointmentProfessional: appointment.professional,
                    selectedId: selectedProfessional?.id,
                    matchesId
                  });

                  return matchesId;
                }
              );

              console.log(`🔍 Verificando slot ${time}:`, {
                slotStart: slotStart.toISOString(),
                slotEnd: slotEnd.toISOString(),
                professionalAppointments: professionalAppointments.length
              });

              for (const appointment of professionalAppointments) {
                // Usar horário local sem conversão de fuso - CORRIGIDO
                const apptStart = new Date(`${selectedDate}T${appointment.appointment_time}:00`);
                const apptEnd = new Date(apptStart.getTime() + (appointment.duration || 30) * 60000);

                console.log(`🔍 DEBUG - Comparando horários:`, {
                  slotTime: time,
                  slotStart: slotStart.toISOString(),
                  slotEnd: slotEnd.toISOString(),
                  appointmentTime: appointment.appointment_time,
                  apptStart: apptStart.toISOString(),
                  apptEnd: apptEnd.toISOString(),
                  appointmentDuration: appointment.duration,
                  isAvulso: appointment.is_avulso
                });

                console.log(`🔍 Comparando slot ${time} com agendamento:`, {
                  slotTime: time,
                  slotStart: slotStart.toISOString(),
                  slotEnd: slotEnd.toISOString(),
                  appointmentTime: appointment.appointment_time,
                  apptStart: apptStart.toISOString(),
                  apptEnd: apptEnd.toISOString(),
                  isAvulso: appointment.is_avulso,
                  duration: appointment.duration
                });

                // Verificar se há sobreposição de horários
                const hasOverlap = slotStart < apptEnd && slotEnd > apptStart;
                const isExactMatch = slotStart.getTime() === apptStart.getTime();

                console.log(`🔍 Verificação de conflito:`, {
                  hasOverlap,
                  isExactMatch,
                  willBlock: hasOverlap || isExactMatch
                });

                if (hasOverlap || isExactMatch) {
                  available = false;
                  isAvulso = appointment.is_avulso || false;
                  reason = isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado';
                  console.log(`❌ CONFLITO ENCONTRADO para ${time}:`, {
                    available,
                    isAvulso,
                    reason,
                    appointmentTime: appointment.appointment_time,
                    appointmentDuration: appointment.duration
                  });
                  break;
                }
              }
            }

            slots.push({
              time,
              available,
              isAvulso,
              reason: available ? '' : (isAvulso ? 'RESERVA AVULSA' : 'Horário Reservado')
            });
          }
        }

        setTimeSlots(slots);
      } catch (error) {
        console.error('Erro ao carregar horários:', error);
        alert('Erro ao carregar horários');
      } finally {
        setLoading(false);
      }
    };

    loadTimeSlots();
  }, [selectedService, selectedDate, selectedProfessional]);

  const handleProfessionalSelect = (professional: Professional) => {
    setSelectedProfessional(professional);
    setStep('service');
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setStep('time');
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

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  const handleConfirmReservation = async () => {
    if (!selectedProfessional || !selectedService || !selectedTime) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          client_id: user?.id, // Usar ID do usuário atual (estabelecimento)
          establishment_id: establishmentId,
          professional: selectedProfessional.id, // Usar ID do profissional
          service: selectedService.name,
          client_name: 'CLIENTE AVULSO',
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          status: 'confirmed',
          price: selectedService.price,
          total_price: selectedService.price,
          duration: selectedService.duration,
          is_avulso: true
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
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
                    {services.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => handleServiceSelect(service)}
                        className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-gray-800">{service.name}</h4>
                            <p className="text-sm text-gray-600">
                              {formatDuration(service.duration)} • {formatPrice(service.price)}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
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
            </div>
          )}

          {/* Step 3: Selecionar Horário */}
          {step === 'time' && selectedService && (
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
          {step === 'confirm' && selectedProfessional && selectedService && selectedTime && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <CheckCircle className="h-5 w-5 mr-2 text-gray-600" />
                Confirmar Reserva
              </h3>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold mb-2 text-gray-800">Detalhes da Reserva:</h4>
                <div className="space-y-2 text-sm text-gray-700">
                  <p><strong>Profissional:</strong> {selectedProfessional.name}</p>
                  <p><strong>Serviço:</strong> {selectedService.name}</p>
                  <p><strong>Duração:</strong> {formatDuration(selectedService.duration)}</p>
                  <p><strong>Preço:</strong> {formatPrice(selectedService.price)}</p>
                  <p><strong>Data:</strong> {new Date(selectedDate).toLocaleDateString('pt-BR')}</p>
                  <p><strong>Horário:</strong> {selectedTime}</p>
                  <p><strong>Cliente:</strong> CLIENTE AVULSO</p>
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