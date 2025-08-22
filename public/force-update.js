// Script para forçar atualização de cache
(function() {
  'use strict';
  
  // Função para limpar todos os caches
  function clearAllCaches() {
    // Limpa cache do navegador
    if ('caches' in window) {
      caches.keys().then(function(names) {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }
    
    // Limpa localStorage
    localStorage.clear();
    
    // Limpa sessionStorage
    sessionStorage.clear();
    
    // Limpa cache de imagens
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
  }
  
  // Função para forçar reload
  function forceReload() {
    // Adiciona timestamp na URL
    const url = new URL(window.location.href);
    url.searchParams.set('_t', Date.now());
    url.searchParams.set('_r', Math.random().toString(36).substring(7));
    
    // Força reload
    window.location.href = url.toString();
  }
  
  // Executa imediatamente
  clearAllCaches();
  
  // Força reload após 100ms
  setTimeout(forceReload, 100);
  
  // Backup: força reload após 2 segundos se ainda não foi executado
  setTimeout(function() {
    if (window.location.href.indexOf('_t=') === -1) {
      forceReload();
    }
  }, 2000);
})();
