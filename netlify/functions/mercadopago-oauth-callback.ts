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

    // Verificar se já temos tokens válidos (evita processar código já usado)
    if (!supabaseAdmin) {
      return json(500, {
        error: 'Supabase admin não configurado',
      });
    }

    const { data: existingEstablishment, error: fetchError } = await supabaseAdmin
      .from('establishments')
      .select('mercadopago_access_token, mercadopago_token_expires_at')
      .eq('id', establishmentId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = não encontrado, mas outros erros são problemas
      console.error('❌ [MP OAuth Callback] Erro ao buscar estabelecimento:', fetchError);
      return json(500, {
        error: 'Erro ao buscar estabelecimento',
        details: fetchError,
      });
    }

    // ✅ SEMPRE trocar o código por tokens NOVOS — "Reconectar" precisa reconectar de
    // verdade (access + refresh novos), mesmo com o token atual ainda válido (casos:
    // refresh_token podre com access vivo, troca de conta). O atalho antigo pulava a
    // troca quando o token estava válido e enganava o dono ("reconectei e nada mudou").
    // A proteção contra callback duplicado (mesmo code processado 2x pelo navegador)
    // fica no catch: se a troca falhar E já existirem tokens válidos (salvos pela 1ª
    // chamada segundos antes), é o double-callback — redireciona para sucesso.
    let tokenData: Awaited<ReturnType<typeof exchangeCodeForToken>>;
    try {
      tokenData = await exchangeCodeForToken(code);
    } catch (exchangeError: any) {
      const expiresAt = existingEstablishment?.mercadopago_token_expires_at;
      const hasValidToken =
        Boolean(existingEstablishment?.mercadopago_access_token) &&
        (!expiresAt || new Date(expiresAt) > new Date());

      if (hasValidToken) {
        console.log(
          'ℹ️ [MP OAuth Callback] Code recusado, mas tokens atuais válidos (callback duplicado) — redirecionando para sucesso'
        );

        const host = event.headers.host || event.headers['x-forwarded-host'] || 'agendeifacil.com';
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        const successUrl =
          process.env.MERCADOPAGO_SUCCESS_REDIRECT_URL ||
          `${protocol}://${host}/dashboard/establishment?mp_connected=true`;

        return {
          statusCode: 302,
          headers: {
            Location: successUrl,
          },
          body: '',
        };
      }

      throw exchangeError;
    }

    // Salvar tokens no banco de dados (supabaseAdmin já verificado acima)
    // Desativar Pagar.me ao conectar Mercado Pago (exclusão mútua)
    const { error: updateError } = await supabaseAdmin
      .from('establishments')
      .update({
        mercadopago_user_id: String(tokenData.user_id),
        mercadopago_access_token: tokenData.access_token,
        mercadopago_refresh_token: tokenData.refresh_token,
        mercadopago_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString(),
        // Desativar Pagar.me
        pagarme_recipient_id: null,
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
    const successUrl =
      process.env.MERCADOPAGO_SUCCESS_REDIRECT_URL ||
      `${protocol}://${host}/dashboard/establishment?mp_connected=true`;

    return {
      statusCode: 302,
      headers: {
        Location: successUrl,
      },
      body: '',
    };
  } catch (error: any) {
    const establishmentId = getQueryParam(event, 'state');
    const errorCode = error?.response?.data?.error;
    const errorMessage = error?.message || '';

    console.error('❌ [MP OAuth Callback] Erro completo:', {
      message: error?.message,
      stack: error?.stack,
      code: getQueryParam(event, 'code'),
      state: establishmentId,
      errorCode,
      hasSupabaseAdmin: !!supabaseAdmin,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasSupabaseKey: !!SUPABASE_SERVICE_ROLE_KEY,
    });

    // Se o erro for "invalid_grant" (código já usado), verificar se já temos tokens válidos
    if (errorCode === 'invalid_grant' && establishmentId && supabaseAdmin) {
      try {
        const { data: existingEstablishment } = await supabaseAdmin
          .from('establishments')
          .select('mercadopago_access_token, mercadopago_token_expires_at')
          .eq('id', establishmentId)
          .single();

        // Se já temos tokens válidos, considerar sucesso (código foi usado na primeira chamada)
        if (existingEstablishment?.mercadopago_access_token) {
          const expiresAt = existingEstablishment.mercadopago_token_expires_at;
          const isTokenValid = !expiresAt || new Date(expiresAt) > new Date();

          if (isTokenValid) {
            console.log('✅ [MP OAuth Callback] Código já foi usado, mas tokens válidos existem. Redirecionando para sucesso.');
            
            const host = event.headers.host || event.headers['x-forwarded-host'] || 'agendeifacil.com';
            const protocol = event.headers['x-forwarded-proto'] || 'https';
            const successUrl =
              process.env.MERCADOPAGO_SUCCESS_REDIRECT_URL ||
              `${protocol}://${host}/dashboard/establishment?mp_connected=true`;

            return {
              statusCode: 302,
              headers: {
                Location: successUrl,
              },
              body: '',
            };
          }
        }
      } catch (checkError) {
        console.error('⚠️ [MP OAuth Callback] Erro ao verificar tokens existentes:', checkError);
      }
    }
    
    // Limpar tokens parciais/inválidos apenas se não temos tokens válidos
    if (establishmentId && supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('establishments')
          .update({
            mercadopago_user_id: null,
            mercadopago_access_token: null,
            mercadopago_refresh_token: null,
            mercadopago_token_expires_at: null,
          })
          .eq('id', establishmentId);
        console.log('🧹 [MP OAuth Callback] Tokens inválidos removidos do estabelecimento');
      } catch (cleanupError) {
        console.error('⚠️ [MP OAuth Callback] Erro ao limpar tokens:', cleanupError);
      }
    }
    
    // Redirecionar para página de erro
    const host = event.headers.host || event.headers['x-forwarded-host'] || 'agendeifacil.com';
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const errorUrl =
      process.env.MERCADOPAGO_ERROR_REDIRECT_URL ||
      `${protocol}://${host}/dashboard/establishment?mp_error=true`;

    return {
      statusCode: 302,
      headers: {
        Location: errorUrl,
      },
      body: '',
    };
  }
};
