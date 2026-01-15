import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForToken } from '../../src/lib/mercadopago/mp-oauth';
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
    const code = getQueryParam(event, 'code');
    const state = getQueryParam(event, 'state'); // establishmentId

    if (!code) {
      return json(400, {
        error: 'Código de autorização não fornecido',
      });
    }

    if (!state) {
      return json(400, {
        error: 'State (establishmentId) não fornecido',
      });
    }

    const establishmentId = state;

    console.log('🔄 [MP OAuth Callback] Processando:', {
      establishmentId,
      hasCode: !!code,
    });

    // Trocar código por token
    const tokenData = await exchangeCodeForToken(code);

    // Salvar tokens no banco de dados
    if (!supabaseAdmin) {
      return json(500, {
        error: 'Supabase admin não configurado',
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from('establishments')
      .update({
        mercadopago_user_id: String(tokenData.user_id),
        mercadopago_access_token: tokenData.access_token,
        mercadopago_refresh_token: tokenData.refresh_token,
        mercadopago_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString(),
      })
      .eq('id', establishmentId);

    if (updateError) {
      console.error('❌ [MP OAuth Callback] Erro ao salvar tokens:', updateError);
      return json(500, {
        error: 'Erro ao salvar tokens no banco de dados',
        details: updateError,
      });
    }

    console.log('✅ [MP OAuth Callback] Tokens salvos:', {
      establishmentId,
      user_id: tokenData.user_id,
    });

    // Redirecionar para página de sucesso
    const host = event.headers.host || event.headers['x-forwarded-host'] || 'agendeifacil.com';
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const successUrl = process.env.MERCADOPAGO_SUCCESS_REDIRECT_URL || 
      `${protocol}://${host}/dashboard?mp_connected=true`;

    return {
      statusCode: 302,
      headers: {
        Location: successUrl,
      },
      body: '',
    };
  } catch (error: any) {
    console.error('❌ [MP OAuth Callback] Erro:', error);
    
    // Redirecionar para página de erro
    const host = event.headers.host || event.headers['x-forwarded-host'] || 'agendeifacil.com';
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const errorUrl = process.env.MERCADOPAGO_ERROR_REDIRECT_URL || 
      `${protocol}://${host}/dashboard?mp_error=true`;

    return {
      statusCode: 302,
      headers: {
        Location: errorUrl,
      },
      body: '',
    };
  }
};
