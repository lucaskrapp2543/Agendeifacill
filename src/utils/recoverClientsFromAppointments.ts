/**
 * Utilitário para recuperar clientes únicos dos agendamentos e migrá-los para o sistema de clientes manuais
 * Isso resolve o problema de estabelecimentos que já têm muitos clientes cadastrados
 */

import { supabase } from '../lib/supabase';

export interface RecoveredClient {
  name: string;
  whatsapp: string;
  email?: string;
  appointmentCount: number;
  firstAppointment: string;
  lastAppointment: string;
}

export const recoverClientsFromAppointments = async (establishmentId: string): Promise<RecoveredClient[]> => {
  try {
    console.log('🔍 Buscando clientes únicos dos agendamentos...');
    
    // Buscar todos os agendamentos do estabelecimento
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('client_name, client_whatsapp, appointment_date, created_at')
      .eq('establishment_id', establishmentId)
      .not('client_name', 'is', null)
      .not('client_whatsapp', 'is', null)
      .order('appointment_date', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar agendamentos:', error);
      throw error;
    }

    if (!appointments || appointments.length === 0) {
      console.log('📋 Nenhum agendamento encontrado');
      return [];
    }

    // Agrupar por WhatsApp (chave única)
    const clientsMap = new Map<string, RecoveredClient>();

    appointments.forEach(appointment => {
      const whatsapp = appointment.client_whatsapp?.replace(/\D/g, '') || '';
      const name = appointment.client_name?.trim() || '';
      
      if (!whatsapp || !name) return;

      if (clientsMap.has(whatsapp)) {
        // Cliente já existe, atualizar contadores
        const existingClient = clientsMap.get(whatsapp)!;
        existingClient.appointmentCount++;
        
        // Atualizar datas (primeiro e último agendamento)
        const appointmentDate = new Date(appointment.appointment_date);
        const firstDate = new Date(existingClient.firstAppointment);
        const lastDate = new Date(existingClient.lastAppointment);
        
        if (appointmentDate < firstDate) {
          existingClient.firstAppointment = appointment.appointment_date;
        }
        if (appointmentDate > lastDate) {
          existingClient.lastAppointment = appointment.appointment_date;
        }
      } else {
        // Novo cliente
        clientsMap.set(whatsapp, {
          name,
          whatsapp,
          appointmentCount: 1,
          firstAppointment: appointment.appointment_date,
          lastAppointment: appointment.appointment_date
        });
      }
    });

    const recoveredClients = Array.from(clientsMap.values());
    console.log(`✅ Encontrados ${recoveredClients.length} clientes únicos nos agendamentos`);
    
    return recoveredClients;
  } catch (error) {
    console.error('❌ Erro ao recuperar clientes dos agendamentos:', error);
    throw error;
  }
};

export const migrateRecoveredClients = async (establishmentId: string, recoveredClients: RecoveredClient[]): Promise<number> => {
  try {
    const storageKey = `manual_clients_${establishmentId}`;
    const existingClients = JSON.parse(localStorage.getItem(storageKey) || '{}');
    
    let migratedCount = 0;
    
    recoveredClients.forEach(client => {
      const whatsapp = client.whatsapp;
      
      // Só migrar se o cliente não existir ou se o nome for melhor (mais completo)
      if (!existingClients[whatsapp] || 
          (existingClients[whatsapp].name.length < client.name.length && client.name !== 'Cliente Desconhecido')) {
        
        existingClients[whatsapp] = {
          name: client.name,
          whatsapp: whatsapp,
          email: null,
          id: `manual_${whatsapp}`,
          addedAt: new Date().toISOString(),
          appointmentCount: client.appointmentCount,
          firstAppointment: client.firstAppointment,
          lastAppointment: client.lastAppointment,
          recovered: true // Marcar como recuperado
        };
        
        migratedCount++;
        console.log(`✅ Cliente migrado: ${client.name} (${whatsapp}) - ${client.appointmentCount} agendamentos`);
      }
    });

    if (migratedCount > 0) {
      localStorage.setItem(storageKey, JSON.stringify(existingClients));
      console.log(`🎉 Migração concluída: ${migratedCount} clientes recuperados`);
    }

    return migratedCount;
  } catch (error) {
    console.error('❌ Erro ao migrar clientes recuperados:', error);
    throw error;
  }
};

export const autoRecoverClients = async (establishmentId: string): Promise<{ recovered: number; total: number }> => {
  try {
    console.log('🚀 Iniciando recuperação automática de clientes...');
    
    const recoveredClients = await recoverClientsFromAppointments(establishmentId);
    const migratedCount = await migrateRecoveredClients(establishmentId, recoveredClients);
    
    return {
      recovered: migratedCount,
      total: recoveredClients.length
    };
  } catch (error) {
    console.error('❌ Erro na recuperação automática:', error);
    throw error;
  }
};
