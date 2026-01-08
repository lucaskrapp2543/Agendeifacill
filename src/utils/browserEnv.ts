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
  // No Brave, o UA pode não expor "Brave". A detecção mais confiável é navigator.brave.
  // (Em emulação de device, o UA pode parecer iPhone/Safari, mas navigator.brave continua existindo.)
  const isBraveRuntime = !!(navigator && (navigator as any).brave);
  return (
    isBraveRuntime ||
    ua.includes('Brave') ||
    (navigator.userAgentData &&
      navigator.userAgentData.brands &&
      navigator.userAgentData.brands.some(b => b.brand && b.brand.includes('Brave')))
  );
};

/**
 * Detectar navegadores com proteções agressivas que causam loops de reload
 * Inclui: Brave, Edge com proteções, Firefox com extensões de privacidade, etc.
 */
export const hasAggressiveProtections = (): boolean => {
  const ua = getUserAgent();
  
  // Detectar Brave
  if (
    isBraveBrowser() ||
    ua.includes('Brave') ||
    (navigator.userAgentData &&
      navigator.userAgentData.brands &&
      navigator.userAgentData.brands.some(b => b.brand && b.brand.includes('Brave')))
  ) {
    return true;
  }
  
  // Detectar Edge com proteções (Edge geralmente tem proteções similares)
  if (ua.includes('Edg/') && (ua.includes('Shields') || ua.includes('Privacy'))) {
    return true;
  }
  
  // Detectar Firefox com extensões de privacidade comuns
  if (ua.includes('Firefox') && (
      localStorage.getItem('privacy_protection') === 'true' ||
      sessionStorage.getItem('aggressive_protection') === 'true'
    )) {
    return true;
  }
  
  // Verificar se há bloqueadores de conteúdo ativos (detecta extensões)
  // Isso é uma heurística - se muitos recursos estão sendo bloqueados, pode ser navegador com proteções
  try {
    const blockedCount = parseInt(sessionStorage.getItem('blocked_resources_count') || '0');
    if (blockedCount > 5) { // Se mais de 5 recursos foram bloqueados, pode ser navegador com proteções
      return true;
    }
  } catch {
    // Ignorar erros
  }
  
  return false;
};

/**
 * Proteção global: Bloquear reloads automáticos em navegadores com proteções
 * Substitui window.location.reload() para evitar loops infinitos
 */
export const safeReload = (): void => {
  if (hasAggressiveProtections()) {
    console.warn('🛡️ Navegador com proteções detectado - Reload bloqueado (evita loops infinitos)');
    return; // NÃO recarregar em navegadores com proteções
  }
  window.location.reload();
};

/**
 * Em WebView/mobile/navegadores com proteções, evitar lógicas agressivas de cache/SW/reload automático que geram "piscaceira"
 */
export const shouldDisableAggressiveReloads = (): boolean => {
  return isMobileBrowser() || isInAppBrowser() || isBraveBrowser() || hasAggressiveProtections();
};


