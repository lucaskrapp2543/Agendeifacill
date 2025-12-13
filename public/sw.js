// Service Worker para cache inteligente e atualizações forçadas
// ⚠️ VERSÃO 2.3.0: NUNCA faz cache de HTML (sempre versão nova, sem precisar atualizar)
const CACHE_NAME = 'agendafacil-v2.3.0';
const STATIC_CACHE = 'agendafacil-static-v2.3.0';
const DYNAMIC_CACHE = 'agendafacil-dynamic-v2.3.0';

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
    (async () => {
      // ⚠️ CRÍTICO: Limpar TODOS os caches de HTML ao ativar (especialmente para mobile)
      // Isso garante que HTML antigo não seja servido mesmo se Service Worker estiver antigo
      try {
        const cacheNames = await caches.keys();
        console.log('🗑️ Limpando TODOS os caches de HTML ao ativar...');
        
        // Remover TODOS os caches que podem conter HTML antigo
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            // Se for cache dinâmico (pode ter HTML), limpar
            if (cacheName.includes('dynamic') || cacheName.includes('agendafacil')) {
              console.log('🗑️ Removendo cache que pode conter HTML:', cacheName);
              return caches.delete(cacheName);
            }
            // Remover caches antigos também (versões anteriores a 2.3.0)
            if (!cacheName.includes('v2.3.0') && cacheName !== STATIC_CACHE) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
        
        console.log('✅ Todos os caches de HTML limpos');
      } catch (error) {
        console.error('❌ Erro ao limpar caches:', error);
      }
      
      // Continuar com ativação normal
      return self.clients.claim();
    })()
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ⚠️ DETECTAR MOBILE PELO USER-AGENT (ANTES DE QUALQUER COISA)
  const userAgent = request.headers.get('user-agent') || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  // ⚠️ REQUISIÇÕES DE NAVEGAÇÃO (HTML) - NUNCA USAR CACHE
  // Para mobile, cache é muito agressivo e causa página branca
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // ⚠️ DETECTAR MOBILE PELO USER-AGENT
        const userAgent = request.headers.get('user-agent') || '';
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        
        // ⚠️ SEMPRE limpar cache de HTML antes de servir (garantia extra)
        try {
          // Limpar cache desta URL específica
          await caches.delete(request);
          
          // Limpar cache de index.html também (pode estar em cache)
          await caches.delete(new Request(url.origin + '/index.html'));
          await caches.delete(new Request(url.origin + '/'));
          
          // ⚠️ SE FOR MOBILE: Limpar TODOS os caches (mais agressivo)
          if (isMobile) {
            const allCaches = await caches.keys();
            await Promise.all(allCaches.map(cacheName => {
              // Limpar TODOS os caches que podem ter HTML (incluindo static)
              if (cacheName.includes('agendafacil') || cacheName.includes('dynamic') || cacheName.includes('static')) {
                console.log('📱 Removendo cache em mobile:', cacheName);
                return caches.delete(cacheName);
              }
            }));
            console.log('📱 Mobile detectado - TODOS os caches de HTML limpos');
          }
        } catch (e) {
          // Ignorar erros de limpeza
        }
        
        // ⚠️ SEMPRE buscar HTML da rede (não importa se mobile ou desktop)
        // Service Worker NUNCA faz cache de HTML, então sempre busca da rede
        console.log('🔄 Buscando HTML da rede (nunca usa cache)');
        
        try {
          const controller = new AbortController();
          // ⚠️ Timeout menor para mobile (5s em vez de 8s)
          const timeout = isMobile ? 5000 : 8000;
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          const networkResponse = await fetch(request, { 
            signal: controller.signal,
            cache: 'no-store', // ⚠️ SEMPRE buscar da rede (nunca usar cache do navegador)
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          clearTimeout(timeoutId);
          
          if (networkResponse.ok && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              const text = await networkResponse.clone().text();
              
              // Validar HTML
              if (!text.includes('</html>') && !text.includes('</body>')) {
                throw new Error('HTML corrompido');
              }
              
              // ⚠️ CRÍTICO: NUNCA fazer cache de HTML (nem mobile, nem desktop)
              // Isso garante que sempre terá versão mais nova
              // Lado positivo: Cliente sempre vê atualizações sem precisar atualizar!
              console.log('✅ HTML válido recebido da rede - NÃO fazendo cache (sempre versão nova)');
              
              return networkResponse;
            }
            return networkResponse;
          }
          
          throw new Error('Resposta inválida');
        } catch (error) {
          console.log('⚠️ Erro ao buscar da rede:', error.message);
          
          // ⚠️ NUNCA usar cache para HTML - sempre tentar rede novamente
          try {
            return await fetch(request, { 
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
          } catch {
            // Último recurso: HTML de erro que força reload
            return new Response(`
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <title>Erro ao carregar</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
                <meta http-equiv="Pragma" content="no-cache">
                <meta http-equiv="Expires" content="0">
              </head>
              <body style="display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui; text-align: center; padding: 20px; background: #f5f5f5;">
                <div style="max-width: 400px;">
                  <h1 style="font-size: 24px; margin-bottom: 16px; color: #333;">Erro ao carregar</h1>
                  <p style="margin-bottom: 24px; color: #666; line-height: 1.6;">A página não está carregando. Recarregando automaticamente...</p>
                  <div style="margin-top: 20px; padding: 12px; background: #fff; border-radius: 8px; border: 1px solid #ddd;">
                    <p style="font-size: 14px; color: #888; margin: 0;">Se não recarregar automaticamente, use os 3 pontinhos do navegador e clique em "Atualizar"</p>
                  </div>
                </div>
                <script>
                  // Limpar cache e recarregar
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      names.forEach(function(name) { caches.delete(name); });
                    });
                  }
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(regs) {
                      regs.forEach(function(reg) { reg.unregister(); });
                    });
                  }
                  setTimeout(function() {
                    // Recarregar sem parâmetros (Service Worker já busca da rede sempre)
                    window.location.reload(true);
                  }, 2000);
                </script>
              </body>
              </html>
            `, { 
              status: 503,
              headers: { 
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
          }
        }
      })()
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
