type StandbyChangeDetail = {
  active: boolean;
  reason?: 'hidden' | 'idle' | 'manual';
};

const STANDBY_EVENT_NAME = 'app-standby-change';
const STANDBY_STORAGE_KEY = 'agendafacil_app_standby_active';

let standbyActive = false;

const emitStandbyChange = (detail: StandbyChangeDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<StandbyChangeDetail>(STANDBY_EVENT_NAME, { detail }));
};

export const isAppStandbyActive = (): boolean => {
  if (typeof window === 'undefined') return standbyActive;

  if (!standbyActive) {
    const saved = window.sessionStorage.getItem(STANDBY_STORAGE_KEY);
    if (saved === '1') standbyActive = true;
  }

  return standbyActive;
};

export const setAppStandbyActive = (active: boolean, reason: StandbyChangeDetail['reason'] = 'manual'): void => {
  const next = Boolean(active);
  if (standbyActive === next) return;

  standbyActive = next;

  if (typeof window !== 'undefined') {
    if (next) window.sessionStorage.setItem(STANDBY_STORAGE_KEY, '1');
    else window.sessionStorage.removeItem(STANDBY_STORAGE_KEY);
  }

  emitStandbyChange({ active: next, reason });
};

export const subscribeToAppStandby = (
  callback: (detail: StandbyChangeDetail) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: Event) => {
    const custom = event as CustomEvent<StandbyChangeDetail>;
    callback(custom.detail || { active: false });
  };

  window.addEventListener(STANDBY_EVENT_NAME, handler as EventListener);
  return () => {
    window.removeEventListener(STANDBY_EVENT_NAME, handler as EventListener);
  };
};

