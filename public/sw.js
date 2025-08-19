// Service Worker para controle de cache
const CACHE_NAME = 'agendafacil-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta requisições
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Sempre busca na rede primeiro
        return fetch(event.request)
          .then((networkResponse) => {
            // Atualiza o cache com a nova resposta
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseClone);
              });
            return networkResponse;
          })
          .catch(() => {
            // Se falhar na rede, usa o cache
            return response;
          });
      })
  );
});

// Atualização do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Força atualização a cada 5 minutos
setInterval(() => {
  self.registration.update();
}, 5 * 60 * 1000);
