// Service Worker mínimo para mobile — habilita instalação PWA sem cache problemático.
// Todas as requisições passam direto para a rede (zero cache).

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Passthrough — sem cache, sem interceptação
  return;
});
