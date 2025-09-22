import React, { useState, useEffect } from 'react';
import { format, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from './ui/Toaster';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
  clientName?: string;
  isInterval?: boolean;
}

interface QuickAvailabilityCheckerProps {
  professionalId: string;
  professionalName: string;
  establishmentId: string;
  services: Service[];
  businessHours: Record<string, any>;
}

export const QuickAvailabilityChecker: React.FC<QuickAvailabilityCheckerProps> = ({
  professionalId,
  professionalName,
  establishmentId,
  services,
  businessHours
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Estados para outros serviços
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [serviceSubcategories, setServiceSubcategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<any | null>(null);
  const [showOtherServices, setShowOtherServices] = useState(false);

  // Função para buscar categorias de serviços
  const fetchServiceCategories = async () => {
    try {
      const { data: categories, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('name');

      if (error) throw error;
      setServiceCategories(categories || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  // Função para buscar subcategorias
  const fetchServiceSubcategories = async (categoryId: string) => {
    try {
      const { data: subcategories, error } = await supabase
        .from('service_subcategories')
        .select('*')
        .eq('category_id', categoryId)
        .order('name');

      if (error) throw error;
      setServiceSubcategories(subcategories || []);
    } catch (error) {
      console.error('Erro ao buscar subcategorias:', error);
    }
  };

  useEffect(() => {
    if (establishmentId) {
      fetchServiceCategories();
    }
  }, [establishmentId]);

  const generateTimeSlots = (dayBusinessHours: any): string[] => {
    const slots: string[] = [];
    
    if (!dayBusinessHours || !dayBusinessHours.enabled) {
      return slots;
    }

    const interval = 15; // 15 minutos

    // Primeiro período
    if (dayBusinessHours.open1 && dayBusinessHours.close1) {
      const startTime = parseISO(`2000-01-01T${dayBusinessHours.open1}`);
      const endTime = parseISO(`2000-01-01T${dayBusinessHours.close1}`);
      
      let currentTime = startTime;
      while (currentTime < endTime) {
        slots.push(format(currentTime, 'HH:mm'));
        currentTime = addMinutes(currentTime, interval);
      }
    }

    // Segundo período
    if (dayBusinessHours.open2 && dayBusinessHours.close2) {
      const startTime2 = parseISO(`2000-01-01T${dayBusinessHours.open2}`);
      const endTime2 = parseISO(`2000-01-01T${dayBusinessHours.close2}`);
      
      let currentTime2 = startTime2;
      while (currentTime2 < endTime2) {
        slots.push(format(currentTime2, 'HH:mm'));
        currentTime2 = addMinutes(currentTime2, interval);
      }
    }

    return slots;
  };

  const checkAvailability = async () => {
    if (!selectedDate || !professionalId) {
      toast.error('Selecione uma data');
      return;
    }

    // Verificar se tem serviço selecionado (normal ou outros serviços)
    if (!selectedService && !selectedSubcategory) {
      toast.error('Selecione um serviço');
      return;
    }

    setIsLoading(true);
    try {
      const date = parseISO(selectedDate);
      const dayOfWeek = format(date, 'EEEE', { locale: ptBR }).toLowerCase();
      
      // Tentar diferentes formatos de dia da semana
      let dayBusinessHours = businessHours[dayOfWeek];
      
      // Se não encontrar, tentar formatos alternativos
      if (!dayBusinessHours) {
        const dayOfWeekShort = format(date, 'EEE', { locale: ptBR }).toLowerCase();
        dayBusinessHours = businessHours[dayOfWeekShort];
      }
      
      // Se ainda não encontrar, tentar em inglês
      if (!dayBusinessHours) {
        const dayOfWeekEnglish = format(date, 'EEEE').toLowerCase();
        dayBusinessHours = businessHours[dayOfWeekEnglish];
      }

      if (!dayBusinessHours || !dayBusinessHours.enabled) {
        toast.error('Estabelecimento fechado neste dia');
        setTimeSlots([]);
        return;
      }

      // Debug: mostrar horários do dia
      console.log(`📅 HORÁRIOS DO DIA ${format(date, 'dd/MM/yyyy')}:`, {
        open1: dayBusinessHours.open1,
        close1: dayBusinessHours.close1,
        open2: dayBusinessHours.open2,
        close2: dayBusinessHours.close2
      });

      // Gerar todos os horários disponíveis
      const allTimeSlots = generateTimeSlots(dayBusinessHours);
      
      // Buscar agendamentos existentes para este profissional nesta data
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          client_id,
          duration
        `)
        .eq('establishment_id', establishmentId)
        .eq('professional', professionalId)
        .eq('appointment_date', format(date, 'yyyy-MM-dd'))
        .order('appointment_time');

      if (error) throw error;

      // Determinar qual serviço usar (normal ou outros serviços)
      const currentService = selectedService || selectedSubcategory;
      const serviceDuration = currentService?.duration || 30;

      // Verificar disponibilidade para cada horário
      const availabilitySlots: TimeSlot[] = allTimeSlots.map(time => {
        const slotStart = new Date(`${format(date, 'yyyy-MM-dd')}T${time}`);
        const slotEnd = addMinutes(slotStart, serviceDuration);

        // Verificar se é um horário de intervalo (entre close1 e open2)
        // Verifica se o INÍCIO ou o FIM do serviço invade o intervalo
        const intervalStart = new Date(`${format(date, 'yyyy-MM-dd')}T${dayBusinessHours.close1}`);
        const intervalEnd = new Date(`${format(date, 'yyyy-MM-dd')}T${dayBusinessHours.open2}`);
        
        const isInterval = !!(dayBusinessHours.open2 && dayBusinessHours.close2 && (
          // Início do serviço está no intervalo
          (slotStart >= intervalStart && slotStart < intervalEnd) ||
          // Fim do serviço está no intervalo
          (slotEnd > intervalStart && slotEnd <= intervalEnd) ||
          // Serviço engloba completamente o intervalo
          (slotStart <= intervalStart && slotEnd >= intervalEnd)
        ));
        
        // Debug: log para horários de intervalo
        if (isInterval) {
          console.log(`🔍 INTERVALO DETECTADO: ${time} - close1: ${dayBusinessHours.close1}, open2: ${dayBusinessHours.open2}`);
        }

        // Verificar se há conflito com agendamentos existentes
        const conflictingAppointment = appointments?.find(appointment => {
          const appointmentDate = appointment.appointment_date;
          const appointmentTime = appointment.appointment_time;
          
          // Criar data/hora do agendamento
          const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
          
          // Usar duração real do agendamento ou assumir 30 minutos como padrão
          const appointmentDuration = appointment.duration || 30;
          const appointmentEndTime = new Date(appointmentDateTime.getTime() + (appointmentDuration * 60 * 1000));
          
          // Verificar se há sobreposição entre os horários
          // slotStart = início do novo agendamento
          // slotEnd = fim do novo agendamento (slotStart + duração do serviço)
          // appointmentDateTime = início do agendamento existente
          // appointmentEndTime = fim do agendamento existente
          
          return (
            // Novo agendamento começa durante um agendamento existente
            (slotStart >= appointmentDateTime && slotStart < appointmentEndTime) ||
            // Novo agendamento termina durante um agendamento existente
            (slotEnd > appointmentDateTime && slotEnd <= appointmentEndTime) ||
            // Novo agendamento engloba completamente um agendamento existente
            (slotStart <= appointmentDateTime && slotEnd >= appointmentEndTime)
          );
        });

        return {
          time,
          available: !conflictingAppointment && !isInterval,
          appointmentId: conflictingAppointment?.id,
          clientName: conflictingAppointment ? 'Cliente' : undefined,
          isInterval
        };
      });

      setTimeSlots(availabilitySlots);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      toast.error('Erro ao verificar disponibilidade');
    } finally {
      setIsLoading(false);
    }
  };


  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), 'dd/MM/yyyy (EEEE)', { locale: ptBR });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-gray-900">Horários Disponíveis</h3>
            <p className="text-sm text-gray-600">
              Verificar disponibilidade para {professionalName}
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-gray-200 space-y-4">
          {/* Seleção de Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="h-4 w-4 inline mr-1" />
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
            />
            {selectedDate && (
              <p className="text-xs text-gray-600 mt-1">
                {formatDate(selectedDate)}
              </p>
            )}
          </div>

          {/* Botões de seleção de tipo de serviço */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setShowOtherServices(false);
                setSelectedService(null);
                setSelectedSubcategory(null);
                setSelectedCategory(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !showOtherServices
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Serviços Normais
            </button>
            
            <button
              type="button"
              onClick={() => {
                setShowOtherServices(true);
                setSelectedService(null);
                setSelectedSubcategory(null);
                setSelectedCategory(null);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showOtherServices
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🔥 Outros Serviços 🔥
            </button>
          </div>

          {/* Seleção de Serviço Normal */}
          {!showOtherServices && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serviço
              </label>
              <select
                value={selectedService?.id || ''}
                onChange={(e) => {
                  const service = services.find(s => s.id === e.target.value);
                  setSelectedService(service || null);
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              >
                <option value="" className="text-gray-900">Selecione um serviço</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id} className="text-gray-900">
                    {service.name} ({service.duration}min - {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Interface para Outros Serviços */}
          {showOtherServices && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900">🔥 Outros Serviços 🔥</h4>
              
              {/* Seleção de Categoria */}
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Categoria
                </label>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory(null);
                    if (e.target.value) {
                      fetchServiceSubcategories(e.target.value);
                    } else {
                      setServiceSubcategories([]);
                    }
                  }}
                  className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                >
                  <option value="" className="text-gray-900">Selecione uma categoria</option>
                  {serviceCategories.map((category) => (
                    <option key={category.id} value={category.id} className="text-gray-900">
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seleção de Subcategoria */}
              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-2">
                    Serviço Específico
                  </label>
                  <select
                    value={selectedSubcategory?.id || ''}
                    onChange={(e) => {
                      const subcategory = serviceSubcategories.find(s => s.id === e.target.value);
                      setSelectedSubcategory(subcategory || null);
                    }}
                    className="w-full p-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  >
                    <option value="" className="text-gray-900">Selecione um serviço</option>
                    {serviceSubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id} className="text-gray-900">
                        {subcategory.name} ({subcategory.duration}min - R$ {subcategory.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Botão Verificar */}
          <button
            onClick={checkAvailability}
            disabled={!selectedDate || (!selectedService && !selectedSubcategory) || isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Verificando...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Verificar Horários
              </>
            )}
          </button>

          {/* Resultados */}
          {timeSlots.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-3">
                Horários para {(selectedService || selectedSubcategory)?.name} em {selectedDate && formatDate(selectedDate)}
              </h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {timeSlots.map((slot) => (
                  <div
                    key={slot.time}
                    className={`p-3 rounded-lg border text-center text-sm ${
                      slot.isInterval
                        ? 'bg-gray-100 border-gray-300 text-gray-600'
                        : slot.available
                        ? 'bg-green-100 border-green-400 text-green-900 font-semibold'
                        : 'bg-red-100 border-red-400 text-red-900 font-semibold'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      {slot.isInterval ? (
                        <Clock className="h-4 w-4" />
                      ) : slot.available ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span className="font-medium">{slot.time}</span>
                    </div>
                    {slot.isInterval ? (
                      <div className="text-xs opacity-75">
                        Intervalo
                      </div>
                    ) : !slot.available && slot.clientName && (
                      <div className="text-xs opacity-75">
                        Ocupado: {slot.clientName}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Resumo */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    {timeSlots.filter(slot => slot.available).length} disponíveis
                  </span>
                  <span className="text-gray-600">
                    <Clock className="h-4 w-4 inline mr-1" />
                    {timeSlots.filter(slot => slot.isInterval).length} intervalos
                  </span>
                  <span className="text-red-600">
                    <XCircle className="h-4 w-4 inline mr-1" />
                    {timeSlots.filter(slot => !slot.available && !slot.isInterval).length} ocupados
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};