import React, { useState, useEffect } from 'react';
import { Calendar, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, addMinutes, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface Professional {
  id: string;
  name: string;
  specialties: string[];
}

interface BusinessHours {
  enabled: boolean;
  open1: string;
  close1: string;
  open2: string;
  close2: string;
}

interface QuickAvailabilityCheckerProps {
  professionalId: string | null;
  professionalName: string;
  services: Service[];
  businessHours: Record<string, BusinessHours>;
  establishmentId: string;
  use15MinuteInterval?: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
  appointmentId?: string;
  clientName?: string;
  isInterval?: boolean;
}

export const QuickAvailabilityChecker: React.FC<QuickAvailabilityCheckerProps> = ({
  professionalId,
  professionalName,
  services,
  businessHours,
  establishmentId,
  use15MinuteInterval = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

           // Definir intervalo de horários baseado na configuração do estabelecimento
    const generateTimeSlots = (businessHours: BusinessHours): string[] => {
      if (!businessHours.enabled) return [];

      const slots: string[] = [];
      
      // Definir intervalo baseado na configuração
      // use15MinuteInterval = true significa 30 em 30 min
      // use15MinuteInterval = false significa 15 em 15 min
      const interval = use15MinuteInterval ? 30 : 15;
      
      // Primeiro período (manhã)
      const startTime1 = businessHours.open1;
      const endTime1 = businessHours.close1;

      let currentTime = new Date(`2000-01-01T${startTime1}`);
      const endDateTime1 = new Date(`2000-01-01T${endTime1}`);

      while (currentTime < endDateTime1) {
        slots.push(format(currentTime, 'HH:mm'));
        currentTime = addMinutes(currentTime, interval);
      }

      // Adicionar horários de intervalo (entre close1 e open2)
      if (businessHours.open2 && businessHours.close2) {
        let intervalTime = new Date(`2000-01-01T${businessHours.close1}`);
        const intervalEndTime = new Date(`2000-01-01T${businessHours.open2}`);

        while (intervalTime < intervalEndTime) {
          slots.push(format(intervalTime, 'HH:mm'));
          intervalTime = addMinutes(intervalTime, interval);
        }
      }

      // Adicionar segundo período se existir (tarde)
      if (businessHours.open2 && businessHours.close2) {
        let currentTime2 = new Date(`2000-01-01T${businessHours.open2}`);
        const endDateTime2 = new Date(`2000-01-01T${businessHours.close2}`);

        while (currentTime2 < endDateTime2) {
          slots.push(format(currentTime2, 'HH:mm'));
          currentTime2 = addMinutes(currentTime2, interval);
        }
      }

      return slots;
    };

     const checkAvailability = async () => {
     if (!selectedDate || !selectedService || !professionalId) {
       toast.error('Selecione uma data e um serviço');
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

             // Verificar disponibilidade para cada horário
       const availabilitySlots: TimeSlot[] = allTimeSlots.map(time => {
         const slotStart = new Date(`${format(date, 'yyyy-MM-dd')}T${time}`);
         const slotEnd = addMinutes(slotStart, selectedService.duration);

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

  const formatTime = (time: string) => {
    return format(parseISO(`2000-01-01T${time}`), 'HH:mm');
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

          {/* Seleção de Serviço */}
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

          {/* Botão Verificar */}
          <button
            onClick={checkAvailability}
            disabled={!selectedDate || !selectedService || isLoading}
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
                Horários para {selectedService?.name} em {selectedDate && formatDate(selectedDate)}
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
