import React, { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubeResumePlayerProps = {
  videoId: string;
  storageKey: string;
  className?: string;
};

const ensureYouTubeIframeApi = (): Promise<void> => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-youtube-iframe-api="true"]') as HTMLScriptElement | null;
    if (existing) {
      const check = () => {
        if (window.YT && window.YT.Player) resolve();
        else setTimeout(check, 50);
      };
      check();
      return;
    }

    // encadear caso alguém já tenha definido o callback
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } finally {
        resolve();
      }
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.defer = true;
    tag.setAttribute('data-youtube-iframe-api', 'true');
    document.head.appendChild(tag);
  });
};

export const YouTubeResumePlayer: React.FC<YouTubeResumePlayerProps> = ({ videoId, storageKey, className }) => {
  const containerId = useMemo(() => `yt-${videoId}-${Math.random().toString(36).slice(2)}`, [videoId]);
  const playerRef = useRef<any>(null);
  const saveIntervalRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [useFallbackIframe, setUseFallbackIframe] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let disposed = false;

    const getSavedSeconds = () => {
      const raw = localStorage.getItem(storageKey);
      const sec = Number(raw);
      return Number.isFinite(sec) && sec > 0 ? sec : 0;
    };

    const saveSeconds = () => {
      try {
        const player = playerRef.current;
        if (!player || typeof player.getCurrentTime !== 'function') return;
        const sec = Number(player.getCurrentTime());
        if (!Number.isFinite(sec)) return;
        localStorage.setItem(storageKey, String(Math.max(0, Math.floor(sec))));
      } catch {
        // ignore
      }
    };

    const stopInterval = () => {
      if (saveIntervalRef.current) {
        window.clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    };

    const startInterval = () => {
      stopInterval();
      saveIntervalRef.current = window.setInterval(saveSeconds, 4000);
    };

    const init = async () => {
      // Se a API não carregar (adblock, rede, etc), usa fallback de iframe normal
      const timeoutMs = 4500;
      const apiReady = await Promise.race([
        ensureYouTubeIframeApi().then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
      ]);

      if (!apiReady || !(window.YT && window.YT.Player)) {
        if (!disposed) setUseFallbackIframe(true);
        return;
      }
      if (disposed) return;

      const startSeconds = getSavedSeconds();

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: startSeconds > 5 ? startSeconds : 0,
        },
        events: {
          onReady: () => {
            if (disposed) return;
            setReady(true);
          },
          onStateChange: (event: any) => {
            // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
            if (event?.data === 1) startInterval();
            if (event?.data === 2) {
              saveSeconds();
              stopInterval();
            }
            if (event?.data === 0) {
              localStorage.removeItem(storageKey);
              stopInterval();
            }
          },
        },
      });
    };

    init();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveSeconds();
    };

    window.addEventListener('beforeunload', saveSeconds);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener('beforeunload', saveSeconds);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopInterval();
      try {
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [containerId, storageKey, videoId]);

  const fallbackStart = useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const sec = Number(raw);
      return Number.isFinite(sec) && sec > 5 ? Math.floor(sec) : 0;
    } catch {
      return 0;
    }
  }, [storageKey]);

  return (
    <div className={`relative ${className || ''}`}>
      {useFallbackIframe ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?start=${fallbackStart}&rel=0&modestbranding=1&playsinline=1`}
          title="Vídeo"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <>
          {/* container do player SEMPRE visível (evita inicialização em elemento oculto) */}
          <div id={containerId} className="w-full h-full" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5">
              <div className="text-sm text-gray-700 font-semibold">Carregando vídeo…</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

