/**
 * Mercado Pago OAuth - Lógica de autenticação OAuth
 * 
 * Gerencia o fluxo OAuth do Mercado Pago para conectar contas de vendedores
 * 
 * ⚠️ IMPORTANTE: Este arquivo NUNCA deve ser importado no frontend!
 * Use apenas em: Edge Functions, Serverless Functions, API Routes
 */

import axios from 'axios';

// Funções auxiliares para ler variáveis de ambiente (lê dinamicamente, não no momento da importação)
function getMPClientId(): string {
  return process.env.MERCADOPAGO_CLIENT_ID || '';
}

function getMPClientSecret(): string {
  return process.env.MERCADOPAGO_CLIENT_SECRET || '';
}

function getMPRedirectUri(): string {
  return process.env.MERCADOPAGO_REDIRECT_URI || '';
}

// Funções auxiliares para URLs (lê dinamicamente)
function getMPApiBaseUrl(): string {
  return process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com';
}

function getMPAuthBaseUrl(): string {
  return process.env.MERCADOPAGO_AUTH_BASE_URL || 'https://auth.mercadopago.com.br';
}

/**
 * Gera a URL de autorização OAuth do Mercado Pago
 * 
 * @param establishmentId - ID do estabelecimento (para salvar após callback)
 * @returns URL de autorização
 */
export function getAuthorizationUrl(establishmentId: string): string {
  const MP_CLIENT_ID = getMPClientId();
  const MP_REDIRECT_URI = getMPRedirectUri();

  if (!MP_CLIENT_ID) {
    throw new Error('MERCADOPAGO_CLIENT_ID não configurado no .env');
  }

  if (!MP_REDIRECT_URI) {
    throw new Error('MERCADOPAGO_REDIRECT_URI não configurado no .env');
  }

  // Parâmetros OAuth
  const params = new URLSearchParams({
    client_id: MP_CLIENT_ID,
    response_type: 'code',
    platform_id: 'mp', // Marketplace
    redirect_uri: MP_REDIRECT_URI,
    state: establishmentId, // Passar establishment_id no state para recuperar no callback
  });

  const MP_AUTH_BASE_URL = getMPAuthBaseUrl();
  const authUrl = `${MP_AUTH_BASE_URL}/authorization?${params.toString()}`;
  
  console.log('🔗 [MP OAuth] URL de autorização gerada:', {
    establishmentId,
    redirectUri: MP_REDIRECT_URI,
    authUrl: authUrl.replace(MP_CLIENT_ID, '***'),
  });

  return authUrl;
}

/**
 * Troca o código de autorização por access_token
 * 
 * @param code - Código de autorização retornado pelo callback
 * @returns Access token e user_id do vendedor
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  user_id: number;
  expires_in: number;
}> {
  const MP_CLIENT_ID = getMPClientId();
  const MP_CLIENT_SECRET = getMPClientSecret();
  const MP_REDIRECT_URI = getMPRedirectUri();

  if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) {
    throw new Error('MERCADOPAGO_CLIENT_ID e MERCADOPAGO_CLIENT_SECRET devem estar configurados');
  }

  if (!MP_REDIRECT_URI) {
    throw new Error('MERCADOPAGO_REDIRECT_URI deve estar configurado');
  }

  try {
    console.log('🔄 [MP OAuth] Trocando código por token...');

    const MP_API_BASE_URL = getMPApiBaseUrl();
    const response = await axios.post(
      `${MP_API_BASE_URL}/oauth/token`,
      {
        client_secret: MP_CLIENT_SECRET,
        client_id: MP_CLIENT_ID,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: MP_REDIRECT_URI,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    const { access_token, refresh_token, user_id, expires_in } = response.data;

    if (!access_token || !user_id) {
      throw new Error('Resposta do Mercado Pago não contém access_token ou user_id');
    }

    console.log('✅ [MP OAuth] Token obtido com sucesso:', {
      user_id,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      expiresIn: expires_in,
    });

    return {
      access_token: String(access_token),
      refresh_token: String(refresh_token || ''),
      user_id: Number(user_id),
      expires_in: Number(expires_in || 21600), // Padrão: 6 horas
    };
  } catch (error: any) {
    console.error('❌ [MP OAuth] Erro ao trocar código por token:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
    });

    throw new Error(
      error?.response?.data?.message ||
      error?.message ||
      'Erro ao obter token do Mercado Pago'
    );
  }
}

/**
 * Atualiza o access_token usando refresh_token
 * 
 * @param refreshToken - Refresh token armazenado
 * @returns Novo access_token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const MP_CLIENT_ID = getMPClientId();
  const MP_CLIENT_SECRET = getMPClientSecret();

  if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) {
    throw new Error('MERCADOPAGO_CLIENT_ID e MERCADOPAGO_CLIENT_SECRET devem estar configurados');
  }

  try {
    console.log('🔄 [MP OAuth] Atualizando access_token...');

    const MP_API_BASE_URL = getMPApiBaseUrl();
    const response = await axios.post(
      `${MP_API_BASE_URL}/oauth/token`,
      {
        client_secret: MP_CLIENT_SECRET,
        client_id: MP_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error('Resposta do Mercado Pago não contém access_token');
    }

    console.log('✅ [MP OAuth] Token atualizado com sucesso');

    return {
      access_token: String(access_token),
      refresh_token: String(refresh_token || refreshToken), // Pode retornar novo refresh_token
      expires_in: Number(expires_in || 21600),
    };
  } catch (error: any) {
    console.error('❌ [MP OAuth] Erro ao atualizar token:', {
      message: error?.message,
      response: error?.response?.data,
    });

    // Erro OAuth do MP vem como {error, error_description} (sem .message) — sem isso a
    // mensagem virava o cru do axios ("Request failed with status code 400"), impossível
    // de diagnosticar (ex.: invalid_grant = refresh_token revogado, precisa reconectar).
    const oauthErr = [error?.response?.data?.error, error?.response?.data?.error_description]
      .map((x: unknown) => String(x || '').trim())
      .filter(Boolean)
      .join(' — ');
    throw new Error(
      error?.response?.data?.message ||
      (oauthErr
        ? `Mercado Pago recusou a renovação do token (${oauthErr}). Reconecte a conta do Mercado Pago.`
        : '') ||
      error?.message ||
      'Erro ao atualizar token do Mercado Pago'
    );
  }
}
