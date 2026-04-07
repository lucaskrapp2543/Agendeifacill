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

// Prioriza WhatsApp Business em todos os envios manuais.
export const openWhatsAppWithBusinessPriority = (phoneDigits: string, message: string) => {
  const cleanPhone = String(phoneDigits || '').replace(/\D/g, '');
  if (!cleanPhone) return;

  const encodedMessage = encodeURIComponent(message || '');
  const waBusinessScheme = `whatsapp-business://send?phone=${cleanPhone}&text=${encodedMessage}`;
  const waRegularScheme = `whatsapp://send?phone=${cleanPhone}&text=${encodedMessage}`;
  const waWeb = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  const userAgent = String(navigator?.userAgent || '');
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  // Android: força app Business pelo package, com fallback seguro na mesma aba
  // (evita popup bloqueado por não estar em gesto direto do usuário).
  if (isAndroid) {
    const androidBusinessIntent = `intent://send?phone=${cleanPhone}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
    window.location.href = androidBusinessIntent;
    setTimeout(() => {
      window.location.href = waBusinessScheme;
      setTimeout(() => {
        window.location.href = waRegularScheme;
        setTimeout(() => {
          window.location.href = waWeb;
        }, 500);
      }, 350);
    }, 300);
    return;
  }

  // iOS: usar navegação direta na mesma aba (mais confiável que popup).
  if (isIOS) {
    window.location.href = waBusinessScheme;
    setTimeout(() => {
      window.location.href = waRegularScheme;
      setTimeout(() => {
        window.location.href = waWeb;
      }, 500);
    }, 450);
    return;
  }

  // Desktop: abrir aba imediatamente durante o clique para evitar bloqueio de popup.
  const popup = window.open('about:blank', '_blank');
  if (popup) {
    // Tenta abrir o app primeiro e, se não abrir, cai no WhatsApp Web na mesma aba.
    popup.location.href = waBusinessScheme;
    setTimeout(() => {
      if (popup.closed) return;
      popup.location.href = waRegularScheme;
      setTimeout(() => {
        if (popup.closed) return;
        popup.location.href = waWeb;
      }, 500);
    }, 350);
    return;
  }

  // Fallback extremo: se o popup for bloqueado mesmo abrindo em gesto do usuário.
  window.location.href = waRegularScheme;
  setTimeout(() => {
    window.location.href = waWeb;
  }, 500);
};
