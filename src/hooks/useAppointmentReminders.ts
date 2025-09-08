import { useEffect, useRef } from 'react';
import { format, parseISO, addMinutes, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  establishment_name: string;
  service_name: string;
  professional_name?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface ReminderData {
  appointmentId: string;
  scheduledTime: Date;
  appointment: Appointment;
}

export function useAppointmentReminders(appointments: Appointment[]) {
  const scheduledReminders = useRef<Map<string, number>>(new Map());
  const notificationPermission = useRef<NotificationPermission>('default');

  // Solicitar permissão para notificações
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          notificationPermission.current = permission;
          console.log('🔔 Permissão de notificação:', permission);
        });
      } else {
        notificationPermission.current = Notification.permission;
      }
    }
  }, []);

  // Função para criar notificação
  const createNotification = (appointment: Appointment) => {
    if (notificationPermission.current !== 'granted') {
      console.log('❌ Permissão de notificação negada');
      return;
    }

    const notification = new Notification('🔔 Lembrete de Agendamento', {
      body: `Você tem um agendamento em 45 minutos!\n\n🏪 ${appointment.establishment_name}\n✂️ ${appointment.service_name}\n👨‍💼 ${appointment.professional_name || 'Profissional não especificado'}\n📅 ${format(parseISO(appointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })}\n⏰ ${appointment.appointment_time}`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `appointment-${appointment.id}`,
      requireInteraction: true,
      silent: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close após 10 segundos
    setTimeout(() => {
      notification.close();
    }, 10000);

    console.log('🔔 Notificação enviada para:', appointment.establishment_name);
  };

  // Função para agendar lembrete
  const scheduleReminder = (appointment: Appointment) => {
    if (appointment.status === 'cancelled') {
      return;
    }

    const appointmentDateTime = parseISO(`${appointment.appointment_date}T${appointment.appointment_time}`);
    const reminderTime = addMinutes(appointmentDateTime, -45); // 45 minutos antes
    const now = new Date();

    // Só agenda se o lembrete for no futuro
    if (isAfter(reminderTime, now)) {
      const timeUntilReminder = reminderTime.getTime() - now.getTime();
      
      // Cancelar lembrete anterior se existir
      const existingTimeout = scheduledReminders.current.get(appointment.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Agendar novo lembrete
      const timeoutId = setTimeout(() => {
        createNotification(appointment);
        scheduledReminders.current.delete(appointment.id);
      }, timeUntilReminder);

      scheduledReminders.current.set(appointment.id, timeoutId);
      
      console.log('⏰ Lembrete agendado para:', {
        appointment: appointment.establishment_name,
        reminderTime: format(reminderTime, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        timeUntilReminder: Math.round(timeUntilReminder / 1000 / 60) + ' minutos'
      });
    } else {
      console.log('⏰ Lembrete não agendado (já passou):', appointment.establishment_name);
    }
  };

  // Função para cancelar lembrete
  const cancelReminder = (appointmentId: string) => {
    const timeoutId = scheduledReminders.current.get(appointmentId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      scheduledReminders.current.delete(appointmentId);
      console.log('❌ Lembrete cancelado para:', appointmentId);
    }
  };

  // Agendar lembretes quando os agendamentos mudam
  useEffect(() => {
    // Limpar todos os lembretes anteriores
    scheduledReminders.current.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    scheduledReminders.current.clear();

    // Agendar novos lembretes
    appointments.forEach((appointment) => {
      scheduleReminder(appointment);
    });

    // Cleanup function
    return () => {
      scheduledReminders.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      scheduledReminders.current.clear();
    };
  }, [appointments]);

  return {
    scheduleReminder,
    cancelReminder,
    notificationPermission: notificationPermission.current
  };
}
