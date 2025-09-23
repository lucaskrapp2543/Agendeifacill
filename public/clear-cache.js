// Script para limpar cache e service workers em desenvolvimento
// Execute este script no console do navegador para limpar tudo

console.log('🧹 Iniciando limpeza de cache e service workers...');

// 1. Limpar todos os service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    console.log('📋 Service Workers encontrados:', registrations.length);
    
    registrations.forEach(function(registration) {
      console.log('🗑️ Removendo service worker:', registration);
      registration.unregister();
    });
    
    console.log('✅ Todos os service workers foram removidos');
  });
}

// 2. Limpar todos os caches
if ('caches' in window) {
  caches.keys().then(function(cacheNames) {
    console.log('📋 Caches encontrados:', cacheNames.length);
    
    cacheNames.forEach(function(cacheName) {
      console.log('🗑️ Removendo cache:', cacheName);
      caches.delete(cacheName);
    });
    
    console.log('✅ Todos os caches foram removidos');
  });
}

// 3. Limpar localStorage relacionado ao app
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('agendafacil') || key.includes('appointments_') || key.includes('supabase'))) {
    keysToRemove.push(key);
  }
}

keysToRemove.forEach(key => {
  console.log('🗑️ Removendo do localStorage:', key);
  localStorage.removeItem(key);
});

console.log('✅ Limpeza concluída! Recarregue a página para aplicar as mudanças.');
console.log('🔄 Execute: window.location.reload() para recarregar');
