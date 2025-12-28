import React from 'react';
import { Clock, Bell } from 'lucide-react';
import { format, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  establishment_name: string;
  service_name: string;
  professional_name?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
}

interface ReminderInfoProps {
  appointments: Appointment[];
}

export function ReminderInfo({ appointments }: ReminderInfoProps) {
  // Filtrar apenas agendamentos futuros e não cancelados
  const futureAppointments = appointments.filter(appointment => {
    if (appointment.status === 'cancelled' || appointment.status === 'completed') return false;
    
    const appointmentDateTime = parseISO(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const now = new Date();
    
    return appointmentDateTime > now;
  });

  if (futureAppointments.length === 0) {
    return null;
  }

  return (
    <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-3 mb-3">
        <Bell className="h-5 w-5 text-green-500" />
        <h3 className="text-white font-medium">🔔 Lembretes Ativos</h3>
      </div>
      
      <div className="space-y-2">
        {futureAppointments.map((appointment) => {
          const appointmentDateTime = parseISO(`${appointment.appointment_date}T${appointment.appointment_time}`);
                  const reminderTime = addMinutes(appointmentDateTime, -30);
          
          return (
            <div key={appointment.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-gray-300">
                  {appointment.establishment_name} - {appointment.service_name}
                </span>
              </div>
              <span className="text-green-400 font-medium">
                Lembrete: {format(reminderTime, "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          );
        })}
      </div>
      
      <p className="text-gray-400 text-xs mt-3">
        💡 Você receberá uma notificação 30 minutos antes de cada agendamento
      </p>
    </div>
  );
}
