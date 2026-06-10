// Função utilitária para abrir WhatsApp de forma compatível com iOS
export const openWhatsApp = (url: string) => {
  // Detectar se é iPhone/iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    // No iOS, usar location.href é mais confiável
    window.location.href = url;
  } else {
    // Em outros dispositivos, usar window.open
    window.open(url, '_blank');
  }
};

export type WhatsAppAppPreference = 'business' | 'regular' | 'ask';

const WHATSAPP_APP_PREFERENCE_KEY = 'agendafacil_whatsapp_app_preference';

export const getWhatsAppAppPreference = (): WhatsAppAppPreference => {
  if (typeof window === 'undefined') return 'business';
  try {
    const raw = String(window.localStorage.getItem(WHATSAPP_APP_PREFERENCE_KEY) || '').trim().toLowerCase();
    if (raw === 'business' || raw === 'regular' || raw === 'ask') return raw;
  } catch {
    // noop
  }
  return 'business';
};

export const setWhatsAppAppPreference = (preference: WhatsAppAppPreference): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WHATSAPP_APP_PREFERENCE_KEY, preference);
  } catch {
    // noop
  }
};

export const resetWhatsAppAppPreference = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WHATSAPP_APP_PREFERENCE_KEY);
  } catch {
    // noop
  }
};

const resolveWhatsAppPreferenceForCurrentSend = (): Exclude<WhatsAppAppPreference, 'ask'> => {
  const saved = getWhatsAppAppPreference();
  if (saved === 'business' || saved === 'regular') return saved;

  const wantsBusiness = window.confirm(
    'Escolha o app para enviar:\n\nOK = WhatsApp Business\nCancelar = WhatsApp normal'
  );
  return wantsBusiness ? 'business' : 'regular';
};

const sanitizeWhatsAppMessage = (message: string): string => {
  const raw = String(message || '');
  // Evita caracteres de substituição e emojis/símbolos que quebram em alguns WebViews/PWA.
  return raw
    .replace(/\uFFFD/g, '')
    .replace(/[\u200D\uFE0E\uFE0F]/g, '')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
    .normalize('NFC')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
};

const tryOpenSchemeWithWebFallback = (schemeUrl: string, webUrl: string, fallbackDelayMs: number) => {
  let appOpenedOrPageHidden = false;

  const markHidden = () => {
    appOpenedOrPageHidden = true;
  };

  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', markHidden);
    window.removeEventListener('blur', markHidden);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      markHidden();
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', markHidden);
  window.addEventListener('blur', markHidden);

  window.location.href = schemeUrl;

  window.setTimeout(() => {
    cleanup();
    if (appOpenedOrPageHidden || document.visibilityState === 'hidden') return;
    window.location.href = webUrl;
  }, Math.max(400, fallbackDelayMs));
};

const tryOpenIOSUniversalLink = (apiUrl: string, webUrl: string) => {
  // iOS/Safari/PWA pode rejeitar schemes customizados com "endereço inválido".
  // Link universal evita esse erro e abre o app quando disponível.
  let pageHidden = false;

  const markHidden = () => {
    pageHidden = true;
  };

  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', markHidden);
    window.removeEventListener('blur', markHidden);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') markHidden();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', markHidden);
  window.addEventListener('blur', markHidden);

  window.location.href = apiUrl;

  window.setTimeout(() => {
    cleanup();
    if (pageHidden || document.visibilityState === 'hidden') return;
    window.location.href = webUrl;
  }, 1300);
};

const tryOpenAndroidBusinessAppWithFallback = (
  waBusinessScheme: string,
  waRegularScheme: string,
  waWeb: string
) => {
  // Importante: no Android, o package do Business responde melhor com scheme=whatsapp.
  // Usar scheme=whatsapp-business pode redirecionar incorretamente para Play Store.
  const businessIntentUrl = waRegularScheme
    .replace('whatsapp://', 'intent://')
    + '#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end';

  let appOpenedOrPageHidden = false;

  const markHidden = () => {
    appOpenedOrPageHidden = true;
  };

  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', markHidden);
    window.removeEventListener('blur', markHidden);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') markHidden();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', markHidden);
  window.addEventListener('blur', markHidden);

  // 1) Tenta abrir explicitamente o pacote do WhatsApp Business.
  window.location.href = businessIntentUrl;

  // 2) Se não abriu, tenta o esquema padrão do WhatsApp Business.
  window.setTimeout(() => {
    if (appOpenedOrPageHidden || document.visibilityState === 'hidden') {
      cleanup();
      return;
    }

    window.location.href = waBusinessScheme;

    // 3) Se ainda não abriu, tenta o WhatsApp normal antes de ir para web.
    window.setTimeout(() => {
      if (appOpenedOrPageHidden || document.visibilityState === 'hidden') {
        cleanup();
        return;
      }
      cleanup();
      tryOpenAndroidRegularAppWithFallback(waRegularScheme, waWeb);
    }, 1200);
  }, 700);
};

const tryOpenAndroidRegularAppWithFallback = (
  waRegularScheme: string,
  waWeb: string
) => {
  const regularIntentUrl = waRegularScheme
    .replace('whatsapp://', 'intent://')
    + '#Intent;scheme=whatsapp;package=com.whatsapp;end';

  let appOpenedOrPageHidden = false;

  const markHidden = () => {
    appOpenedOrPageHidden = true;
  };

  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', markHidden);
    window.removeEventListener('blur', markHidden);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') markHidden();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', markHidden);
  window.addEventListener('blur', markHidden);

  // 1) Tenta abrir explicitamente o pacote do WhatsApp normal.
  window.location.href = regularIntentUrl;

  // 2) Se não abriu, tenta o esquema padrão do WhatsApp normal.
  window.setTimeout(() => {
    if (appOpenedOrPageHidden || document.visibilityState === 'hidden') {
      cleanup();
      return;
    }
    window.location.href = waRegularScheme;

    // 3) Último fallback: WhatsApp Web.
    window.setTimeout(() => {
      cleanup();
      if (appOpenedOrPageHidden || document.visibilityState === 'hidden') return;
      window.location.href = waWeb;
    }, 950);
  }, 550);
};

const openWhatsAppByPreference = (
  preference: Exclude<WhatsAppAppPreference, 'ask'>,
  waBusinessScheme: string,
  waRegularScheme: string,
  waApi: string,
  waWeb: string,
  isAndroid: boolean,
  isIOS: boolean
) => {
  const preferredScheme = preference === 'business' ? waBusinessScheme : waRegularScheme;

  // Android: quando o usuário escolhe "normal", força pacote com intent para evitar
  // que o sistema continue abrindo o app errado por padrão antigo.
  if (isAndroid && preference === 'regular') {
    tryOpenAndroidRegularAppWithFallback(waRegularScheme, waWeb);
    return;
  }

  // Android: quando escolhe business, tenta pacote business -> scheme business ->
  // app normal -> web. Evita cair cedo no "baixar app" do navegador.
  if (isAndroid && preference === 'business') {
    tryOpenAndroidBusinessAppWithFallback(waBusinessScheme, waRegularScheme, waWeb);
    return;
  }

  // iOS: usa link universal para evitar erro "endereço inválido" no Safari/PWA.
  if (isIOS) {
    tryOpenIOSUniversalLink(waApi, waWeb);
    return;
  }

  // Mobile: abre o app escolhido e só cai para web se o app realmente não abrir.
  if (isAndroid) {
    tryOpenSchemeWithWebFallback(
      preferredScheme,
      waWeb,
      1300
    );
    return;
  }

  // Desktop: abrir aba durante gesto do usuário para reduzir bloqueio de popup.
  const popup = window.open('about:blank', '_blank');
  if (popup) {
    popup.location.href = preferredScheme;
    setTimeout(() => {
      if (popup.closed) return;
      popup.location.href = waWeb;
    }, 550);
    return;
  }

  // Fallback extremo (popup bloqueado).
  window.location.href = waWeb;
};

type OpenWhatsAppOptions = {
  /** Mantém emojis na mensagem (ex.: agradecimento com avaliação). Padrão: false. */
  preserveEmojis?: boolean;
};

// Preferência de app de WhatsApp por dispositivo (business/normal/perguntar).
export const openWhatsAppWithBusinessPriority = (
  phoneDigits: string,
  message: string,
  options?: OpenWhatsAppOptions
) => {
  const cleanPhone = String(phoneDigits || '').replace(/\D/g, '');
  if (!cleanPhone) return;

  const rawMessage = String(message || '').trim();
  const finalMessage = options?.preserveEmojis ? rawMessage : sanitizeWhatsAppMessage(rawMessage);
  const encodedMessage = encodeURIComponent(finalMessage);
  const waBusinessScheme = `whatsapp-business://send?phone=${cleanPhone}&text=${encodedMessage}`;
  const waRegularScheme = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
  const waApi = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  const waWeb = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  const userAgent = String(navigator?.userAgent || '');
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const effectivePreference = resolveWhatsAppPreferenceForCurrentSend();

  openWhatsAppByPreference(
    effectivePreference,
    waBusinessScheme,
    waRegularScheme,
    waApi,
    waWeb,
    isAndroid,
    isIOS
  );
};
