/**
 * Utilitário para recuperar clientes diretamente do banco de dados
 * Funciona independente do localStorage - ideal para ambientes de produção
 */

import { supabase } from '../lib/supabase';

export interface DatabaseClient {
  name: string;
  whatsapp: string;
  email?: string;
  appointmentCount: number;
  firstAppointment: string;
  lastAppointment: string;
  clientId: string;
}

export const recoverClientsFromDatabase = async (establishmentId: string): Promise<DatabaseClient[]> => {
  try {
    console.log('🔍 Buscando clientes diretamente do banco de dados...');
    
    // Buscar todos os agendamentos do estabelecimento
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('client_id, client_name, client_whatsapp, appointment_date, created_at')
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

    // Agrupar por client_id (UUID) e WhatsApp
    const clientsMap = new Map<string, DatabaseClient>();

    appointments.forEach(appointment => {
      const clientId = appointment.client_id;
      const whatsapp = appointment.client_whatsapp?.replace(/\D/g, '') || '';
      const name = appointment.client_name?.trim() || '';
      
      if (!clientId || !whatsapp || !name) return;

      // Usar client_id como chave principal, mas também agrupar por WhatsApp
      const key = clientId;
      
      if (clientsMap.has(key)) {
        // Cliente já existe, atualizar contadores
        const existingClient = clientsMap.get(key)!;
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
        clientsMap.set(key, {
          name,
          whatsapp,
          appointmentCount: 1,
          firstAppointment: appointment.appointment_date,
          lastAppointment: appointment.appointment_date,
          clientId: clientId
        });
      }
    });

    const recoveredClients = Array.from(clientsMap.values());
    console.log(`✅ Encontrados ${recoveredClients.length} clientes únicos no banco de dados`);
    
    return recoveredClients;
  } catch (error) {
    console.error('❌ Erro ao recuperar clientes do banco:', error);
    throw error;
  }
};

export const getClientNameFromDatabase = async (establishmentId: string, clientId: string): Promise<string | null> => {
  try {
    // Se é um cliente manual (começa com 'manual_'), extrair o WhatsApp
    if (clientId.startsWith('manual_')) {
      const whatsapp = clientId.replace('manual_', '');
      
      // Buscar nos agendamentos por WhatsApp
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('client_name')
        .eq('establishment_id', establishmentId)
        .eq('client_whatsapp', whatsapp)
        .not('client_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('❌ Erro ao buscar nome do cliente manual:', error);
        return null;
      }

      return appointments?.[0]?.client_name || null;
    }

    // Se é um UUID, buscar diretamente
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('client_name')
      .eq('establishment_id', establishmentId)
      .eq('client_id', clientId)
      .not('client_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar nome do cliente:', error);
      return null;
    }

    return appointments?.[0]?.client_name || null;
  } catch (error) {
    console.error('❌ Erro ao buscar nome do cliente:', error);
    return null;
  }
};

export const getClientWhatsappFromDatabase = async (establishmentId: string, clientId: string): Promise<string | null> => {
  try {
    // Se é um cliente manual (começa com 'manual_'), extrair o WhatsApp
    if (clientId.startsWith('manual_')) {
      return clientId.replace('manual_', '');
    }

    // Se é um UUID, buscar nos agendamentos
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('client_whatsapp')
      .eq('establishment_id', establishmentId)
      .eq('client_id', clientId)
      .not('client_whatsapp', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar WhatsApp do cliente:', error);
      return null;
    }

    return appointments?.[0]?.client_whatsapp || null;
  } catch (error) {
    console.error('❌ Erro ao buscar WhatsApp do cliente:', error);
    return null;
  }
};
