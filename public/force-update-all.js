// Script para forçar atualização de todos os usuários PWA
(function() {
  'use strict';
  
  console.log('🔄 Script de atualização forçada carregado');
  
  // Função para forçar atualização
  function forceUpdate() {
    try {
      // 1. Limpar localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('app-version') || key.includes('cache')) {
          localStorage.removeItem(key);
        }
      });
      
      // 2. Limpar sessionStorage
      sessionStorage.clear();
      
      // 3. Limpar caches
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
            console.log('🗑️ Cache deletado:', cacheName);
          });
        });
      }
      
      // 4. Atualizar service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
            console.log('🔄 Service Worker desregistrado');
          });
          
          // Registrar novo service worker
          setTimeout(() => {
            navigator.serviceWorker.register('/sw.js').then(() => {
              console.log('✅ Novo Service Worker registrado');
              window.location.reload();
            });
          }, 1000);
        });
      } else {
        // Fallback: recarregar diretamente
        window.location.reload();
      }
      
    } catch (error) {
      console.error('Erro ao forçar atualização:', error);
      // Fallback final
      window.location.reload();
    }
  }
  
  // Função para mostrar notificação de atualização
  function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 20px;">🔄</div>
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">Atualização Disponível!</div>
          <div style="font-size: 14px; opacity: 0.9;">Nova versão do Agendei Fácil está disponível.</div>
        </div>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button id="update-now" style="
          background: white;
          color: #10b981;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          flex: 1;
        ">Atualizar Agora</button>
        <button id="update-later" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        ">Depois</button>
      </div>
    `;
    
    // Adicionar CSS para animação
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Event listeners
    document.getElementById('update-now').addEventListener('click', () => {
      notification.remove();
      forceUpdate();
    });
    
    document.getElementById('update-later').addEventListener('click', () => {
      notification.remove();
    });
    
    // Auto-remover após 10 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);
  }
  
  // Verificar se há atualizações disponíveis
  function checkForUpdates() {
    // Verificar se o service worker está atualizado
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        if (registration.waiting) {
          console.log('🔄 Atualização disponível, mostrando notificação...');
          showUpdateNotification();
        }
      });
    }
  }
  
  // Executar verificação após carregamento
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkForUpdates);
  } else {
    checkForUpdates();
  }
  
  // Verificar periodicamente
  setInterval(checkForUpdates, 30000);
  
  // Expor função globalmente para uso manual
  window.forceAgendeiFacilUpdate = forceUpdate;
  
  console.log('✅ Script de atualização configurado. Use window.forceAgendeiFacilUpdate() para forçar atualização manual.');
  
})();
