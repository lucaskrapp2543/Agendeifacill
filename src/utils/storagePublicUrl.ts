/**
 * URLs salvas com getPublicUrl() costumam usar api.* ou *.supabase.co.
 * Em Wi-Fi com DNS ruim isso atrasa ou falha. Reescreve para o host da página
 * (mesmo domínio do proxy Netlify em /storage/*).
 *
 * Com `size`, troca o arquivo original pela versão reduzida do Supabase
 * (/storage/v1/render/image/...): as fotos ficam em tamanho original no bucket
 * (1–2 MB cada) e eram baixadas inteiras em cada visita ao booking — isso estourou
 * a cota de saída (egress) do Supabase em 10/2026. A versão reduzida pesa ~2–80 KB.
 * Se a redução falhar para algum arquivo (ex.: HEIC), use `fallbackToOriginalStorageImage`
 * no onError do <img> para voltar ao original.
 */
export type StorageImageSize = 'avatar' | 'card' | 'hero';

// Caixa máxima (largura = altura, resize=contain mantém a proporção) e qualidade.
const RENDER_SIZES: Record<StorageImageSize, { box: number; quality: number }> = {
  avatar: { box: 256, quality: 75 }, // foto redonda de profissional, logo pequeno
  card: { box: 640, quality: 78 }, // logo grande, imagem de serviço/produto
  hero: { box: 1280, quality: 75 }, // carrossel / foto de capa
};

const OBJECT_PUBLIC_PREFIX = '/storage/v1/object/public/';
const RENDER_PUBLIC_PREFIX = '/storage/v1/render/image/public/';

export function storagePublicUrlForBrowser(url: string | null | undefined, size?: StorageImageSize): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (typeof window === 'undefined') return raw;

  try {
    const u = new URL(raw);
    const path = u.pathname || '';
    if (!path.startsWith('/storage/v1/')) return raw;

    const h = u.hostname.toLowerCase();
    const here = window.location.hostname.toLowerCase();

    // Em dev local não existe o proxy do Netlify em /storage/v1/* — reescrever pro
    // host atual (localhost) sempre daria 404. Mantém a URL original (domínio real),
    // que funciona normalmente via rede.
    const isLocalDev = here === 'localhost' || here === '127.0.0.1' || here === '0.0.0.0';
    const isSupabaseStorageHost = h === 'api.agendeifacil.com' || h.endsWith('.supabase.co');
    const isSameHost = h === here;

    if (!isSameHost && !isSupabaseStorageHost) return raw;

    const origin = isSameHost || isLocalDev ? u.origin : window.location.origin;

    // Sem tamanho: comportamento de sempre (só a troca de host).
    if (!size) return isSameHost || isLocalDev ? raw : `${origin}${path}${u.search}`;

    const preset = RENDER_SIZES[size];
    if (!preset || !path.startsWith(OBJECT_PUBLIC_PREFIX)) {
      return isSameHost || isLocalDev ? raw : `${origin}${path}${u.search}`;
    }

    const params = new URLSearchParams(u.search);
    params.set('width', String(preset.box));
    params.set('height', String(preset.box));
    params.set('resize', 'contain');
    params.set('quality', String(preset.quality));
    return `${origin}${RENDER_PUBLIC_PREFIX}${path.slice(OBJECT_PUBLIC_PREFIX.length)}?${params.toString()}`;
  } catch {
    return raw;
  }
}

/**
 * Para o onError de um <img>: se a imagem era a versão reduzida, troca pela original
 * e devolve true (o chamador deve parar aí). Devolve false quando já era a original —
 * aí o chamador aplica o próprio fallback (foto padrão etc.).
 */
export function fallbackToOriginalStorageImage(img: HTMLImageElement | null | undefined): boolean {
  if (!img) return false;
  const current = String(img.getAttribute('src') || img.src || '');
  if (!current.includes(RENDER_PUBLIC_PREFIX)) return false;
  try {
    const u = new URL(current, typeof window !== 'undefined' ? window.location.href : undefined);
    u.pathname = u.pathname.replace(RENDER_PUBLIC_PREFIX, OBJECT_PUBLIC_PREFIX);
    ['width', 'height', 'resize', 'quality', 'format'].forEach((k) => u.searchParams.delete(k));
    img.src = u.toString();
    return true;
  } catch {
    return false;
  }
}
