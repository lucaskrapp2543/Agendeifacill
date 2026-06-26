import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shouldShowV30UpdatePrompt } from '../utils/versionManager';
import { clearAllCaches, unregisterServiceWorker } from '../utils/serviceWorker';

const CURRENT_SCRIPT_HASH = (() => {
  const scripts = document.querySelectorAll('script[src*="/assets/index-"]');
  if (scripts.length > 0) {
    const src = (scripts[0] as HTMLScriptElement).src;
    const match = src.match(/index-([a-zA-Z0-9]+)\.js/);
    return match ? match[1] : null;
  }
  return null;
})();

async function checkForNewDeploy(): Promise<boolean> {
  if (!CURRENT_SCRIPT_HASH) return false;
  try {
    const res = await fetch('/?_check=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Accept': 'text/html' },
    });
    if (!res.ok) return false;
    const html = await res.text();
    const match = html.match(/index-([a-zA-Z0-9]+)\.js/);
    if (!match) return false;
    return match[1] !== CURRENT_SCRIPT_HASH;
  } catch {
    return false;
  }
}

export const RefreshButton = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const updatePath = () => setCurrentPath(window.location.pathname);

    window.addEventListener('popstate', updatePath);
    window.addEventListener('hashchange', updatePath);
    window.addEventListener('locationchange', updatePath as EventListener);

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args as any);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };

    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args as any);
      window.dispatchEvent(new Event('locationchange'));
      return result;
    };

    return () => {
      window.removeEventListener('popstate', updatePath);
      window.removeEventListener('hashchange', updatePath);
      window.removeEventListener('locationchange', updatePath as EventListener);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return;

    const check = async () => {
      const newDeploy = await checkForNewDeploy();
      if (newDeploy) setHasUpdate(true);
    };

    check();
    intervalRef.current = setInterval(check, 3 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const isEstablishmentDashboard = currentPath.startsWith('/dashboard/establishment');
  const isAdminDashboard = currentPath.startsWith('/dashboard/admin');
  if (!isEstablishmentDashboard && !isAdminDashboard) return null;
  if (shouldShowV30UpdatePrompt()) return null;

  const hardRefresh = async () => {
    try {
      await clearAllCaches();
      await unregisterServiceWorker();

      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', String(Date.now()));
      window.location.replace(url.toString());
    } catch (e) {
      console.warn('⚠️ Falha ao forçar hard refresh, usando reload simples:', e);
      window.location.reload();
    }
  };

  const handleRefresh = () => {
    if (isRefreshing) return;

    setIsRefreshing(true);

    setTimeout(() => {
      void hardRefresh();
    }, 300);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`fixed bottom-32 right-4 sm:bottom-20 sm:right-6 z-30 px-3 py-2.5 rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 min-w-[112px] justify-center ${
        hasUpdate
          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white ring-2 ring-orange-400/50 animate-pulse'
          : 'bg-black hover:bg-gray-800 text-white'
      }`}
      title={hasUpdate ? 'Nova atualização disponível! Clique para atualizar.' : 'Atualizar página'}
      aria-label="Atualizar página"
    >
      <RefreshCw
        className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
      />
      <span className="text-xs font-semibold leading-none">
        {hasUpdate ? 'Atualizar!' : 'Atualizar'}
      </span>
      {hasUpdate && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white ring-2 ring-black">
          1
        </span>
      )}
    </button>
  );
};

export default RefreshButton;
