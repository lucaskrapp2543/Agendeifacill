export const isDebugConsoleEnabled = (): boolean => {
  try {
    // Só habilitar via flag manual, pra não poluir o console por padrão.
    // Ativar: localStorage.setItem('debug_console', '1')
    // Desativar: localStorage.removeItem('debug_console')
    return typeof window !== 'undefined' && localStorage.getItem('debug_console') === '1';
  } catch {
    return false;
  }
};

export const dlog = (...args: any[]) => {
  if (!isDebugConsoleEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(...args);
};

export const dwarn = (...args: any[]) => {
  if (!isDebugConsoleEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
};

