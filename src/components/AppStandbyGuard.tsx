import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isAppStandbyActive, setAppStandbyActive } from '../utils/appStandby';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const STANDBY_RESUME_BYPASS_KEY = 'agendafacil_standby_resume_bypass_until';
const STANDBY_RESUME_BYPASS_MS = 15000;

const INTERACTION_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

export const AppStandbyGuard: React.FC = () => {
  const location = useLocation();
  const [isStandby, setIsStandby] = useState<boolean>(() => isAppStandbyActive());
  const idleTimeoutRef = useRef<number | null>(null);
  const isEstablishmentDashboardRoute = location.pathname.startsWith('/dashboard/establishment');

  const activateStandby = useCallback((reason: 'hidden' | 'idle' | 'manual') => {
    setIsStandby(true);
    setAppStandbyActive(true, reason);
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const hasRecentManualResumeBypass = useCallback(() => {
    try {
      const raw = window.sessionStorage.getItem(STANDBY_RESUME_BYPASS_KEY);
      const until = Number(raw || 0);
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }, []);

  const scheduleIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (isStandby) return;
    if (document.hidden) return;

    idleTimeoutRef.current = window.setTimeout(() => {
      activateStandby('idle');
    }, IDLE_TIMEOUT_MS);
  }, [activateStandby, clearIdleTimer, isStandby]);

  const resumeAndReload = useCallback(() => {
    try {
      window.sessionStorage.setItem(
        STANDBY_RESUME_BYPASS_KEY,
        String(Date.now() + STANDBY_RESUME_BYPASS_MS)
      );
    } catch {
      // noop
    }
    setIsStandby(false);
    setAppStandbyActive(false, 'manual');
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!isEstablishmentDashboardRoute) {
      clearIdleTimer();
      if (isStandby || isAppStandbyActive()) {
        setIsStandby(false);
        setAppStandbyActive(false, 'manual');
      }
      return;
    }

    if (isStandby) {
      clearIdleTimer();
      return;
    }

    const handleVisibilityChange = () => {
      if (hasRecentManualResumeBypass()) return;
      if (document.hidden) {
        activateStandby('hidden');
        return;
      }
      scheduleIdleTimer();
    };

    const handleInteraction = () => {
      if (hasRecentManualResumeBypass()) return;
      scheduleIdleTimer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    INTERACTION_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleInteraction, { passive: true });
    });

    scheduleIdleTimer();

    return () => {
      clearIdleTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      INTERACTION_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleInteraction);
      });
    };
  }, [activateStandby, clearIdleTimer, hasRecentManualResumeBypass, isEstablishmentDashboardRoute, isStandby, scheduleIdleTimer]);

  const standbyMessage = useMemo(() => {
    return 'Sistema em standby para economizar dados e créditos. Toque em acessar para atualizar e continuar.';
  }, []);

  if (!isEstablishmentDashboardRoute || !isStandby) return null;

  return (
    <div className="fixed inset-0 z-[11000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-green-300 bg-white shadow-2xl p-6 text-center">
        <h2 className="text-xl font-bold text-gray-900">Modo Standby</h2>
        <p className="mt-3 text-sm text-gray-600">
          {standbyMessage}
        </p>
        <button
          type="button"
          onClick={resumeAndReload}
          className="mt-5 w-full rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Acessar
        </button>
      </div>
    </div>
  );
};

