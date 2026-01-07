// Detecção simples de ambiente de navegação (mobile/in-app browser)
// Objetivo: evitar loops de reload em WebViews (Instagram/WhatsApp etc.)

export const getUserAgent = (): string => {
  try {
    return navigator.userAgent || '';
  } catch {
    return '';
  }
};

export const isMobileBrowser = (): boolean => {
  const ua = getUserAgent();
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};

export const isInAppBrowser = (): boolean => {
  const ua = getUserAgent();
  // Android WebView comum
  const isAndroidWebView = /\bwv\b/.test(ua) || /Version\/\d+\.\d+.*Chrome\/\d+.*Mobile/i.test(ua);
  // In-app browsers populares
  const isInstagram = /Instagram/i.test(ua);
  const isFacebookIAB = /FBAN|FBAV|FB_IAB/i.test(ua);
  const isWhatsApp = /WhatsApp/i.test(ua);
  const isTikTok = /TikTok/i.test(ua);
  const isLine = /\bLine\//i.test(ua);
  const isSnapchat = /Snapchat/i.test(ua);

  return isAndroidWebView || isInstagram || isFacebookIAB || isWhatsApp || isTikTok || isLine || isSnapchat;
};

/**
 * Detectar Brave (navegador com proteções que causam loops)
 */
export const isBraveBrowser = (): boolean => {
  const ua = getUserAgent();
  return ua.includes('Brave') || 
         (navigator.userAgentData && navigator.userAgentData.brands && 
          navigator.userAgentData.brands.some(b => b.brand && b.brand.includes('Brave')));
};

/**
 * Proteção global: Bloquear reloads automáticos no Brave
 * Substitui window.location.reload() para evitar loops infinitos
 */
export const safeReload = (): void => {
  if (isBraveBrowser()) {
    console.warn('🛡️ Brave detectado - Reload bloqueado (evita loops infinitos)');
    return; // NÃO recarregar no Brave
  }
  window.location.reload();
};

/**
 * Em WebView/mobile/Brave, evitar lógicas agressivas de cache/SW/reload automático que geram "piscaceira"
 */
export const shouldDisableAggressiveReloads = (): boolean => {
  return isMobileBrowser() || isInAppBrowser() || isBraveBrowser();
};


