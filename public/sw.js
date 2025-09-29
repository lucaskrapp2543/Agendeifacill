// Service Worker para cache inteligente e atualizações forçadas
const CACHE_NAME = 'agendafacil-v2.1.0';
const STATIC_CACHE = 'agendafacil-static-v2.1.0';
const DYNAMIC_CACHE = 'agendafacil-dynamic-v2.1.0';

// Arquivos que devem ser sempre atualizados
const ALWAYS_UPDATE = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css'
];

// Arquivos que podem ser cacheados por mais tempo
const STATIC_FILES = [
  '/static/media/',
  '/favicon.ico',
  '/manifest.json'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalando...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('📦 Cache estático aberto');
        return cache.addAll(ALWAYS_UPDATE);
      })
      .then(() => {
        console.log('✅ Service Worker instalado');
        return self.skipWaiting();
      })
  );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker ativando...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Remover caches antigos
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker ativado');
      return self.clients.claim();
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // NÃO interceptar requisições do Facebook Pixel e Analytics
  if (url.hostname.includes('facebook.net') ||
    url.hostname.includes('connect.facebook.net') ||
    url.hostname.includes('facebook.com') ||
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('googletagmanager.com') ||
    url.hostname.includes('doubleclick.net')) {
    console.log('🔓 Permitindo requisição de analytics/pixel:', url.hostname);
    return; // Deixar passar sem interceptar
  }

  // Ignorar requisições não-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }

  // Estratégia para diferentes tipos de arquivos
  if (request.method === 'GET') {
    // Arquivos estáticos - Cache First
    if (STATIC_FILES.some(file => url.pathname.includes(file))) {
      event.respondWith(cacheFirst(request));
    }
    // API calls - Network First
    else if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
      event.respondWith(networkFirst(request));
    }
    // HTML pages - Network First com fallback
    else if (request.headers.get('accept').includes('text/html')) {
      event.respondWith(networkFirstWithFallback(request));
    }
    // Outros recursos - Stale While Revalidate
    else {
      event.respondWith(staleWhileRevalidate(request));
    }
  }
});

// Estratégia: Cache First
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Erro em cacheFirst:', error);
    return new Response('Recurso não disponível offline', { status: 503 });
  }
}

// Estratégia: Network First
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Erro de rede, tentando cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Recurso não disponível offline', { status: 503 });
  }
}

// Estratégia: Network First com Fallback
async function networkFirstWithFallback(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Erro de rede, usando cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Fallback para index.html para SPAs
    return caches.match('/index.html');
  }
}

// Estratégia: Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Se a rede falhar, retornar cache se disponível
    return cachedResponse;
  });

  return cachedResponse || fetchPromise;
}

// Escutar mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});

// Verificar atualizações periodicamente
setInterval(() => {
  self.registration.update();
}, 15 * 60 * 1000); // 15 minutos