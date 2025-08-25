// Script para forçar atualização da aplicação
// O botão "Forçar Atualização" aparece apenas em:
// 1. Desenvolvimento (localhost, 127.0.0.1, domínios com 'dev' ou 'staging')
// 2. Para administradores (localStorage 'is-admin' = 'true' ou URL com ?admin=1)
// 3. Para a conta de suporte: suporteagendeifacil@gmail.com (detecta automaticamente)
// 4. Para forçar atualização: acesse /clear-cache.html ou use ?force=1 na URL
(function() {
    'use strict';
    
    // Aguardar DOM estar pronto
    function waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    // Adicionar timestamp à URL para evitar cache
    function addTimestamp() {
        const url = new URL(window.location.href);
        url.searchParams.set('_t', Date.now());
        url.searchParams.set('_v', Math.random().toString(36).substring(7));
        return url.toString();
    }
    
    // Forçar reload sem cache
    function forceReload() {
        try {
            // Limpar cache do service worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                        registration.unregister();
                    }
                });
            }
            
            // Limpar localStorage
            localStorage.clear();
            sessionStorage.clear();
            
            // Limpar cache do navegador
            if ('caches' in window) {
                caches.keys().then(function(names) {
                    for (let name of names) {
                        caches.delete(name);
                    }
                });
            }
            
            // Redirecionar com timestamp
            window.location.href = addTimestamp();
        } catch (error) {
            console.log('Erro ao forçar reload:', error);
            // Fallback: reload simples
            window.location.reload(true);
        }
    }
    
    // Auto-executar se detectar parâmetro de força
    if (window.location.search.includes('force=1')) {
        forceReload();
    }
    
    // Expor função globalmente
    window.forceUpdate = forceReload;
    
    // Adicionar botão de força apenas em desenvolvimento ou para admins
    waitForDOM().then(() => {
        // Só mostrar em desenvolvimento ou se for admin
        const isDevelopment = window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1' ||
                             window.location.hostname.includes('dev') ||
                             window.location.hostname.includes('staging');
        
        // Verificar se é a conta de administrador
        const isAdmin = localStorage.getItem('is-admin') === 'true' || 
                       window.location.search.includes('admin=1') ||
                       localStorage.getItem('admin-email') === 'suporteagendeifacil@gmail.com';
        
        // Verificar se o usuário está logado como admin
        const checkAdminUser = () => {
            try {
                // Verificar se há dados do usuário no localStorage
                const userData = localStorage.getItem('supabase.auth.token');
                if (userData) {
                    const parsed = JSON.parse(userData);
                    if (parsed.currentSession?.user?.email === 'suporteagendeifacil@gmail.com') {
                        localStorage.setItem('admin-email', 'suporteagendeifacil@gmail.com');
                        return true;
                    }
                }
                return false;
            } catch (error) {
                return false;
            }
        };
        
        const isAdminUser = checkAdminUser();
        
        if ((isDevelopment || isAdmin || isAdminUser) && !document.getElementById('force-update-btn') && document.body) {
            try {
                const btn = document.createElement('button');
                btn.id = 'force-update-btn';
                btn.innerHTML = '🔄 Forçar Atualização';
                btn.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 10000;
                    background: #ff4757;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 12px;
                    opacity: 0.8;
                    transition: opacity 0.3s ease;
                `;
                btn.onmouseenter = () => btn.style.opacity = '1';
                btn.onmouseleave = () => btn.style.opacity = '0.8';
                btn.onclick = forceReload;
                document.body.appendChild(btn);
            } catch (error) {
                console.log('Erro ao criar botão de força:', error);
            }
        }
    });
})();
