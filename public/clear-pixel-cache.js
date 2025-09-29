// Script para limpar cache e forçar recarregamento do Facebook Pixel
console.log('🧹 Iniciando limpeza de cache do Facebook Pixel...');

// 1. Limpar cache do Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      console.log('🗑️ Service Worker removido');
    });
  });
}

// 2. Limpar cache do navegador
if ('caches' in window) {
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      caches.delete(cacheName);
      console.log('🗑️ Cache removido:', cacheName);
    });
  });
}

// 3. Remover scripts do Facebook Pixel existentes
const existingScripts = document.querySelectorAll('script[src*="fbevents.js"]');
existingScripts.forEach(script => {
  script.remove();
  console.log('🗑️ Script Facebook Pixel removido');
});

// 4. Limpar localStorage relacionado ao pixel
Object.keys(localStorage).forEach(key => {
  if (key.includes('fb') || key.includes('facebook') || key.includes('pixel')) {
    localStorage.removeItem(key);
    console.log('🗑️ localStorage limpo:', key);
  }
});

// 5. Forçar recarregamento da página após 2 segundos
setTimeout(() => {
  console.log('🔄 Recarregando página para aplicar limpeza...');
  window.location.reload(true);
}, 2000);

console.log('✅ Limpeza de cache concluída');
