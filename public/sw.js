// Service Worker para cache inteligente e atualizações forçadas
const CACHE_NAME = 'agendafacil-v2.2.0';
const STATIC_CACHE = 'agendafacil-static-v2.2.0';
const DYNAMIC_CACHE = 'agendafacil-dynamic-v2.2.0';

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
        // Tentar adicionar arquivos ao cache, mas não falhar se algum não existir
        return Promise.allSettled(
          ALWAYS_UPDATE.map(url => 
            cache.add(url).catch(err => {
              console.warn(`⚠️ Não foi possível fazer cache de ${url}:`, err.message);
              return null; // Não falhar se um arquivo não existir
            })
          )
        );
      })
      .then(() => {
        console.log('✅ Service Worker instalado');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Erro ao instalar Service Worker:', error);
        // Mesmo com erro, ativar o Service Worker
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
          // Remover TODOS os caches antigos (versões anteriores a 2.2.0)
          if (cacheName.includes('agendafacil') && 
              !cacheName.includes('v2.2.0') && 
              cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
          // Remover outros caches antigos também
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && !cacheName.includes('v2.2.0')) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker ativado - caches antigos removidos');
      return self.clients.claim();
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições de navegação que podem causar problemas
  if (request.mode === 'navigate') {
    // Para requisições de navegação, sempre tentar rede primeiro
    event.respondWith(
      fetch(request)
        .then(response => {
          // Verificar se a resposta é válida
          if (response.ok && response.status === 200) {
            return response;
          }
          throw new Error('Resposta inválida');
        })
        .catch(async () => {
          // Se falhar, tentar cache
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          // Fallback para index.html
          const indexFallback = await caches.match('/index.html');
          if (indexFallback) {
            return indexFallback;
          }
          // Último recurso: retornar resposta válida
          return new Response('Erro ao carregar página', { 
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // NÃO interceptar requisições do Facebook Pixel, Analytics e outros serviços externos
  const analyticsDomains = [
    'facebook.net',
    'connect.facebook.net',
    'facebook.com',
    'google-analytics.com',
    'googletagmanager.com',
    'googleadservices.com',
    'doubleclick.net',
    'google.com',
    'cloudflareinsights.com',
    'static.cloudflareinsights.com',
    'googlesyndication.com',
    'googleads.g.doubleclick.net'
  ];
  
  if (analyticsDomains.some(domain => url.hostname.includes(domain))) {
    // ⚠️ Reduzir logs excessivos - não logar cada requisição (causa spam no console)
    // Deixar passar direto sem interceptar
    return; // Não usar event.respondWith - deixa passar direto
  }

  // Ignorar requisições não-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }

  // Estratégia para diferentes tipos de arquivos
  if (request.method === 'GET') {
    // Vídeos - Network Only (não fazer cache, vídeos usam respostas parciais 206)
    const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)(\?|$)/i.test(url.pathname);
    if (isVideo) {
      console.log('🎥 Vídeo detectado, ignorando cache:', url.pathname);
      event.respondWith(
        fetch(request).catch(() => {
          // Se falhar, retornar resposta vazia válida
          return new Response('', { status: 503 });
        })
      );
      return;
    }
    
    // Arquivos estáticos - Cache First
    if (STATIC_FILES.some(file => url.pathname.includes(file))) {
      event.respondWith(cacheFirst(request));
    }
    // API calls - Network First
    else if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
      event.respondWith(networkFirst(request));
    }
    // HTML pages - Network First com fallback
    else if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
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
    // Timeout de 8 segundos para requisições de rede
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    // Verificar se a resposta é válida (não corrompida)
    if (networkResponse.ok) {
      // Para HTML, verificar se não está corrompido
      const contentType = networkResponse.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const text = await networkResponse.clone().text();
        // Verificar se o HTML está completo (tem fechamento de tags básicas)
        if (!text.includes('</html>') && !text.includes('</body>')) {
          console.warn('⚠️ HTML parece corrompido, ignorando cache');
          throw new Error('HTML corrompido');
        }
      }
      
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Erro de rede, usando cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Verificar se o cache não está corrompido
      const contentType = cachedResponse.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const text = await cachedResponse.clone().text();
        if (!text.includes('</html>') && !text.includes('</body>')) {
          console.warn('⚠️ Cache HTML corrompido, limpando...');
          await caches.delete(request);
          // Retornar fetch direto sem cache
          return fetch(request).catch(async () => {
            // Se tudo falhar, tentar index.html do cache
            const indexFallback = await caches.match('/index.html');
            if (indexFallback) {
              return indexFallback;
            }
            // Último recurso: retornar resposta válida
            return new Response('Erro ao carregar página', { 
              status: 503,
              headers: { 'Content-Type': 'text/html' }
            });
          });
        }
      }
      return cachedResponse;
    }
    // Fallback para index.html para SPAs
    const fallback = await caches.match('/index.html');
    if (fallback) {
      return fallback;
    }
    // Último recurso: retornar erro
    return new Response('Erro ao carregar página. Tente recarregar.', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Estratégia: Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    // Não fazer cache de respostas parciais (206) - comum em vídeos
    if (networkResponse.ok && networkResponse.status !== 206) {
      cache.put(request, networkResponse.clone()).catch((error) => {
        console.log('⚠️ Erro ao fazer cache (pode ser resposta parcial):', error);
      });
    }
    return networkResponse;
  }).catch(() => {
    // Se a rede falhar, retornar cache se disponível
    return cachedResponse;
  });

  // Sempre retornar uma Response válida
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Se não houver cache, aguardar a promise da rede
  return fetchPromise.then(response => {
    // Se a rede também falhar, retornar resposta vazia válida
    return response || new Response('', { status: 503 });
  }).catch(() => {
    // Se tudo falhar, retornar resposta vazia válida
    return new Response('', { status: 503 });
  });
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

// Verificar atualizações periodicamente (muito mais frequente)
setInterval(() => {
  self.registration.update();
}, 30 * 1000); // 30 SEGUNDOS (muito mais frequente para detectar rápido)
