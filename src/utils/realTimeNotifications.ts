// Sistema de notificações em tempo real
// Funciona mesmo sem push server

import { supabase } from '../lib/supabase';

interface NotificationData {
  id: string;
  establishment_id: string;
  type: 'new_appointment' | 'cancelled_appointment';
  title: string;
  body: string;
  appointment_id?: string;
  created_at: string;
  read: boolean;
}

class RealTimeNotificationManager {
  private establishmentId: string | null = null;
  private isListening = false;
  private lastCheckTime: Date = new Date();
  private professionalsMap: Record<string, string> = {};

  // Inicializar para um estabelecimento
  async init(establishmentId: string) {
    this.establishmentId = establishmentId;
    
    // Buscar dados do establishment para ter acesso aos profissionais
    await this.loadEstablishmentProfessionals(establishmentId);
    
    this.startListening();
  }

  // Carregar profissionais do establishment
  private async loadEstablishmentProfessionals(establishmentId: string) {
    try {
      const { data: establishment, error } = await supabase
        .from('establishments')
        .select('professionals')
        .eq('id', establishmentId)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar profissionais:', error);
        return;
      }

      // Criar mapeamento ID -> Nome
      if (establishment?.professionals && Array.isArray(establishment.professionals)) {
        establishment.professionals.forEach((prof: any) => {
          if (prof.id && prof.name) {
            this.professionalsMap[prof.id] = prof.name;
          }
        });
      }

      console.log('👥 Profissionais carregados:', this.professionalsMap);
    } catch (error) {
      console.error('❌ Erro ao carregar profissionais:', error);
    }
  }

  // Obter nome do profissional
  private getProfessionalName(professionalId: string): string {
    // Primeiro tenta buscar pelo ID no mapa
    if (this.professionalsMap[professionalId]) {
      return this.professionalsMap[professionalId];
    }
    
    // Se não encontrou, pode ser que já seja um nome
    // Retorna o valor original ou texto padrão
    return professionalId || 'Profissional não informado';
  }

  // Parar de escutar
  stop() {
    this.isListening = false;
  }

  // Iniciar escuta de novos agendamentos
  private startListening() {
    if (!this.establishmentId || this.isListening) return;

    this.isListening = true;
    console.log('🔔 Iniciando escuta de notificações em tempo real...');

    // Verificar a cada 5 segundos
    setInterval(() => {
      this.checkForNewAppointments();
    }, 5000);

    // Verificar imediatamente
    this.checkForNewAppointments();
  }

  // Verificar novos agendamentos
  private async checkForNewAppointments() {
    if (!this.establishmentId) return;

    try {
      const { data: newAppointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('establishment_id', this.establishmentId)
        .gte('created_at', this.lastCheckTime.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao verificar novos agendamentos:', error);
        return;
      }

      if (newAppointments && newAppointments.length > 0) {
        console.log('🔔 Novos agendamentos detectados:', newAppointments.length);
        
        // Enviar notificação para cada novo agendamento
        newAppointments.forEach(appointment => {
          const professionalName = this.getProfessionalName(appointment.professional || '');
          const professionalText = professionalName && professionalName !== 'Profissional não informado' 
            ? ` com ${professionalName}` 
            : '';
          
          this.sendNotification({
            title: 'Novo Agendamento! 📅',
            body: `${appointment.client_name} agendou ${appointment.service} para ${appointment.appointment_date} às ${appointment.appointment_time}${professionalText}`,
            type: 'new_appointment',
            appointmentId: appointment.id
          });
        });
      }

      // Atualizar tempo da última verificação
      this.lastCheckTime = new Date();

    } catch (error) {
      console.error('❌ Erro na verificação de agendamentos:', error);
    }
  }

  // Enviar notificação
  private sendNotification(options: {
    title: string;
    body: string;
    type: 'new_appointment' | 'cancelled_appointment';
    appointmentId?: string;
  }) {
    // Verificar se notificações são suportadas
    if (!('Notification' in window)) {
      console.log('❌ Notificações não suportadas');
      return;
    }

    // Verificar permissão
    if (Notification.permission !== 'granted') {
      console.log('❌ Permissão de notificação não concedida');
      return;
    }

    // Enviar notificação
    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: '/novo-icone.png',
        badge: '/novo-icone.png',
        vibrate: [100, 50, 100],
        silent: false,
        tag: `agendamento-${options.appointmentId}`,
        data: {
          type: options.type,
          appointmentId: options.appointmentId,
          timestamp: Date.now()
        }
      });

      // Auto-close após 10 segundos
      setTimeout(() => {
        notification.close();
      }, 10000);

      // Listener para clique na notificação
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Abrir dashboard se clicado
        if (window.location.pathname !== '/dashboard/establishment') {
          window.location.href = '/dashboard/establishment';
        }
      };

      console.log('✅ Notificação enviada:', options.title);

    } catch (error) {
      console.error('❌ Erro ao enviar notificação:', error);
    }
  }

  // Verificar se está em segundo plano
  private isInBackground(): boolean {
    return document.hidden || document.visibilityState === 'hidden';
  }

  // Verificar se é PWA
  private isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }
}

// Instância global
export const realTimeNotifications = new RealTimeNotificationManager();

// Função para inicializar
export const initRealTimeNotifications = async (establishmentId: string) => {
  await realTimeNotifications.init(establishmentId);
};

// Função para parar
export const stopRealTimeNotifications = () => {
  realTimeNotifications.stop();
};
