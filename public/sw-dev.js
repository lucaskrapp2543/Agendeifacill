// Service Worker simplificado para desenvolvimento
console.log('Service Worker de desenvolvimento carregado');

// ✅ DEV/LOCALHOST: Service Worker NÃO deve controlar o app.
// Se já estiver instalado, ele se auto-remove e força recarregar as abas.
const IS_DEV_HOST = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

async function devSelfDestruct() {
  try {
    if ('caches' in self) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch (e) {
    // ignore
  }

  try {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Tenta recarregar as páginas controladas/descontroladas
    for (const client of windows) {
      try {
        client.navigate(client.url);
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    await self.registration.unregister();
  } catch (e) {
    // ignore
  }
}

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker de desenvolvimento instalando...');
  if (IS_DEV_HOST) {
    event.waitUntil(devSelfDestruct());
    return;
  }
  event.waitUntil(
    Promise.resolve().then(() => {
      console.log('Service Worker de desenvolvimento instalado');
      return self.skipWaiting();
    })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker de desenvolvimento ativando...');
  if (IS_DEV_HOST) {
    event.waitUntil(devSelfDestruct());
    return;
  }
  event.waitUntil(
    Promise.resolve().then(() => {
      console.log('Service Worker de desenvolvimento ativado');
      return self.clients.claim();
    })
  );
});

// Interceptação de requisições - APENAS para desenvolvimento
self.addEventListener('fetch', (event) => {
  // NÃO interceptar requisições externas em desenvolvimento
  if (event.request.url.startsWith('http://localhost') ||
    event.request.url.startsWith('https://localhost')) {
    // Apenas log para debug
    console.log('Fetch interceptado (dev):', event.request.url);
  }

  // Deixar todas as requisições passarem normalmente
  return;
});
