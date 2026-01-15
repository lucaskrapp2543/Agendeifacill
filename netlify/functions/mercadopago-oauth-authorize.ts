import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getAuthorizationUrl } from '../../src/lib/mercadopago/mp-oauth';
import { json, getQueryParam } from './_utils';

// Supabase Admin (bypass RLS)
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method Not Allowed' }, { Allow: 'GET' });
  }

  try {
    const establishmentId = getQueryParam(event, 'establishmentId');

    if (!establishmentId) {
      return json(400, {
        error: 'establishmentId é obrigatório',
      });
    }

    // Verificar se o estabelecimento existe
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('establishments')
        .select('id')
        .eq('id', establishmentId)
        .single();

      if (error || !data) {
        return json(404, {
          error: 'Estabelecimento não encontrado',
        });
      }
    }

    // Gerar URL de autorização
    const authUrl = getAuthorizationUrl(establishmentId);

    return json(200, {
      authorization_url: authUrl,
      establishment_id: establishmentId,
    });
  } catch (error: any) {
    console.error('❌ [MP OAuth Authorize] Erro:', error);
    return json(500, {
      error: error.message || 'Erro ao gerar URL de autorização',
    });
  }
};
