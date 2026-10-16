import { useEffect, useState } from 'react';
import { getFeatureRequestPhotoLinks } from '../lib/featureRequests';

/**
 * Miniaturas das fotos de um pedido ("Fazer pedidos"). A pasta é privada: os links
 * valem 1 hora. A miniatura é pequena; a foto inteira só carrega quando abre.
 */
export function FeatureRequestPhotos({
  paths,
  tone = 'dark',
}: {
  paths?: string[] | null;
  tone?: 'dark' | 'light';
}) {
  const key = (Array.isArray(paths) ? paths : []).filter(Boolean).join('|');
  const [links, setLinks] = useState<Array<{ path: string; thumb: string; full: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!key) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getFeatureRequestPhotoLinks(key.split('|'))
      .then((result) => {
        if (!cancelled) setLinks(result);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) return null;
  const count = key.split('|').length;
  const muted = tone === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const border = tone === 'dark' ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-100';

  return (
    <div className="mt-2">
      <p className={`text-[11px] font-semibold ${muted}`}>
        📷 {count} {count === 1 ? 'foto' : 'fotos'} · toque para abrir
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {loading && links.length === 0
          ? Array.from({ length: count }).map((_, index) => (
              <div key={index} className={`h-20 w-20 animate-pulse rounded-lg border ${border}`} />
            ))
          : links.map((link, index) => (
              <a
                key={link.path}
                href={link.full}
                target="_blank"
                rel="noopener noreferrer"
                className={`block h-20 w-20 overflow-hidden rounded-lg border ${border}`}
                title={`Abrir foto ${index + 1}`}
              >
                <img
                  src={link.thumb}
                  alt={`Foto ${index + 1}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    if (e.currentTarget.src !== link.full) e.currentTarget.src = link.full;
                  }}
                />
              </a>
            ))}
        {!loading && links.length === 0 && (
          <p className={`text-[11px] ${muted}`}>Não foi possível carregar as fotos agora.</p>
        )}
      </div>
    </div>
  );
}

export default FeatureRequestPhotos;
