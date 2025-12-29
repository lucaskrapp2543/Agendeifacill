import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { json, parseJsonBody } from './_utils';

export const handler: Handler = async (event) => {
  console.log('🔍 cancel-appointment function called:', {
    method: event.httpMethod,
    path: event.path,
    hasBody: !!event.body
  });
  
  // Permitir CORS
  if (event.httpMethod === 'OPTIONS') {
    return json(200, {}, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
  }

  const body = parseJsonBody<{ appointmentId: string }>(event);
  
  if (!body?.appointmentId) {
    return json(400, {
      error: 'appointmentId é obrigatório',
    });
  }

  // Tentar ambas as variáveis (VITE_ para compatibilidade, SUPABASE_ para consistência)
  // O Netlify CLI lê variáveis de .env automaticamente
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('❌ Variáveis de ambiente do Supabase não configuradas');
    return json(500, {
      error: 'Configuração do servidor incompleta',
    });
  }

  // ✅ Usar service role key apenas no servidor (seguro)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Verificar se o agendamento existe
    const { data: existingAppointment, error: checkError } = await supabaseAdmin
      .from('appointments')
      .select('id, status, appointment_date, appointment_time')
      .eq('id', body.appointmentId)
      .single();

    if (checkError || !existingAppointment) {
      console.error('❌ Erro ao verificar agendamento:', checkError);
      return json(404, {
        error: 'Agendamento não encontrado',
      });
    }

    // Cancelar o agendamento
    const { data: updateData, error: cancelError } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', body.appointmentId)
      .select();

    if (cancelError) {
      console.error('❌ Erro ao cancelar agendamento:', cancelError);
      return json(500, {
        error: 'Erro ao cancelar agendamento',
        details: cancelError.message,
      });
    }

    if (!updateData || updateData.length === 0) {
      return json(500, {
        error: 'Nenhuma linha foi atualizada',
      });
    }

    return json(200, {
      success: true,
      appointmentId: body.appointmentId,
      status: 'cancelled',
    }, {
      'Access-Control-Allow-Origin': '*',
    });

  } catch (error: any) {
    console.error('❌ Erro inesperado:', error);
    return json(500, {
      error: 'Erro interno do servidor',
      details: error.message,
    });
  }
};

