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

  // Android: força app Business pelo package, com fallback seguro.
  if (isAndroid) {
    const androidBusinessIntent = `intent://send?phone=${cleanPhone}&text=${encodedMessage}#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end`;
    window.location.href = androidBusinessIntent;
    setTimeout(() => {
      window.location.href = waBusinessScheme;
      setTimeout(() => {
        window.location.href = waRegularScheme;
        setTimeout(() => {
          window.open(waWeb, '_blank', 'noopener,noreferrer');
        }, 500);
      }, 350);
    }, 300);
    return;
  }

  // iOS + Desktop: tenta Business scheme primeiro; depois normal; depois web.
  window.location.href = waBusinessScheme;
  setTimeout(() => {
    if (isIOS) {
      window.location.href = waRegularScheme;
      setTimeout(() => {
        window.open(waWeb, '_blank', 'noopener,noreferrer');
      }, 500);
      return;
    }

    // Desktop: tentar abrir app instalado (Business ou comum), com fallback web.
    window.location.href = waRegularScheme;
    setTimeout(() => {
      window.open(waWeb, '_blank', 'noopener,noreferrer');
    }, 500);
  }, 450);
};
