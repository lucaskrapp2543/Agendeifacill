/**
 * Proxy transparente para o Supabase no MESMO domínio do site.
 *
 * Motivo:
 * - Algumas redes Wi-Fi/DNS bloqueiam ou quebram HTTPS para `*.supabase.co`,
 *   enquanto 4G funciona. Proxyando por `/sb/*` evita o hostname bloqueado.
 *
 * Segurança:
 * - Não loga Authorization/apikey.
 * - Remove hop-by-hop headers.
 */

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

const getSupabaseOrigin = (): string => {
  const raw = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  if (!raw) {
    throw new Error('SUPABASE_URL (ou VITE_SUPABASE_URL) não configurado no Netlify');
  }
  return raw.replace(/\/+$/, '');
};

const buildTargetUrl = (rawPath: string, queryString: string): string => {
  const origin = getSupabaseOrigin();
  const path = String(rawPath || '').startsWith('/') ? String(rawPath) : `/${String(rawPath || '')}`;
  const qs = queryString && queryString.startsWith('?') ? queryString : queryString ? `?${queryString}` : '';
  return `${origin}${path}${qs}`;
};

const filterRequestHeaders = (headers: Headers): Headers => {
  const out = new Headers();
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHopHeaders.has(lower)) return;
    out.set(key, value);
  });
  return out;
};

const filterResponseHeaders = (headers: Headers): Headers => {
  const out = new Headers();
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (hopByHopHeaders.has(lower)) return;
    out.set(key, value);
  });
  // Garantir CORS permissivo para o próprio site consumir o proxy (same-origin normalmente não precisa,
  // mas isso evita surpresas se algum fluxo mudar origem).
  out.set('access-control-allow-origin', '*');
  out.set('access-control-expose-headers', '*');
  return out;
};

export const handler = async (event: any) => {
  const method = String(event.httpMethod || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': '*',
        'access-control-max-age': '86400',
      },
      body: '',
    };
  }

  try {
    const rawPath = String(event.path || '');
    // path esperado: /.netlify/functions/supabase-proxy/rest/v1/...
    const prefix = '/.netlify/functions/supabase-proxy';
    const suffix = rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : '';

    const qsFromRaw = typeof event.rawQuery === 'string' && event.rawQuery.length > 0 ? `?${event.rawQuery}` : '';
    const qsFromObject = (() => {
      const params = event.queryStringParameters;
      if (!params || typeof params !== 'object') return '';
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v == null) continue;
        usp.append(k, String(v));
      }
      const s = usp.toString();
      return s ? `?${s}` : '';
    })();

    const queryString = qsFromRaw || qsFromObject;
    const targetUrl = buildTargetUrl(suffix || '/', queryString);

    const incomingHeaders = new Headers();
    if (event.headers) {
      for (const [k, v] of Object.entries(event.headers)) {
        if (typeof v === 'string' && v.length > 0) incomingHeaders.set(k, v);
      }
    }

    const headers = filterRequestHeaders(incomingHeaders);

    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : typeof event.body === 'string'
          ? event.isBase64Encoded
            ? Buffer.from(event.body, 'base64')
            : event.body
          : event.body;

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const respHeaders = filterResponseHeaders(upstream.headers);
    const buf = Buffer.from(await upstream.arrayBuffer());

    return {
      statusCode: upstream.status,
      headers: Object.fromEntries(respHeaders.entries()),
      isBase64Encoded: true,
      body: buf.toString('base64'),
    };
  } catch (error: any) {
    return {
      statusCode: 502,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      },
      body: JSON.stringify({
        error: 'supabase_proxy_failed',
        message: String(error?.message || error || 'proxy_failed'),
      }),
    };
  }
};
