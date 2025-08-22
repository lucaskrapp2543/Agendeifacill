// Service Worker simplificado para desenvolvimento
console.log('Service Worker de desenvolvimento carregado');

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker de desenvolvimento instalando...');
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
  event.waitUntil(
    Promise.resolve().then(() => {
      console.log('Service Worker de desenvolvimento ativado');
      return self.clients.claim();
    })
  );
});

// Interceptação de requisições - apenas para desenvolvimento
self.addEventListener('fetch', (event) => {
  // Em desenvolvimento, não interceptar requisições
  if (event.request.url.includes('localhost') || event.request.url.includes('127.0.0.1')) {
    return;
  }
  
  // Para outras requisições, apenas log
  console.log('Fetch interceptado:', event.request.url);
});
