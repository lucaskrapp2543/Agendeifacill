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
