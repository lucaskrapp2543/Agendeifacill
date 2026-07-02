/**
 * URLs salvas com getPublicUrl() costumam usar api.* ou *.supabase.co.
 * Em Wi-Fi com DNS ruim isso atrasa ou falha. Reescreve para o host da página
 * (mesmo domínio do proxy Netlify em /storage/*).
 */
export function storagePublicUrlForBrowser(url: string | null | undefined): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (typeof window === 'undefined') return raw;

  try {
    const u = new URL(raw);
    const path = u.pathname || '';
    if (!path.startsWith('/storage/v1/')) return raw;

    const h = u.hostname.toLowerCase();
    const here = window.location.hostname.toLowerCase();
    if (h === here) return raw;

    // Em dev local não existe o proxy do Netlify em /storage/v1/* — reescrever pro
    // host atual (localhost) sempre daria 404. Mantém a URL original (domínio real),
    // que funciona normalmente via rede.
    const isLocalDev = here === 'localhost' || here === '127.0.0.1' || here === '0.0.0.0';
    if (isLocalDev) return raw;

    const isSupabaseStorageHost = h === 'api.agendeifacil.com' || h.endsWith('.supabase.co');
    if (!isSupabaseStorageHost) return raw;

    return `${window.location.origin}${path}${u.search}`;
  } catch {
    return raw;
  }
}
