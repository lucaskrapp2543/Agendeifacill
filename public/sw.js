// Service Worker para controle de cache e notificações
const CACHE_NAME = 'agendei-facil-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/novo-icone.png',
  '/novo-icone-maskable.png',
  '/static/js/bundle.js',
  '/static/css/main.css'
];



// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker instalado');
        return self.skipWaiting();
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker ativando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker ativado');
      return self.clients.claim();
      })
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  // Ignorar requisições de chrome-extension
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Forçar atualização de ícones e manifest
  if (event.request.url.includes('manifest.json') || 
      event.request.url.includes('novo-icone') ||
      event.request.url.includes('logoagendei')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Sempre atualizar ícones e manifest
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retorna do cache se disponível
        if (response) {
          return response;
        }
        
        // Se não estiver no cache, busca da rede
        return fetch(event.request)
          .then((response) => {
            // Verifica se a resposta é válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clona a resposta para armazenar no cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Fallback para páginas offline
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Sincronização em background
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Implementar sincronização de dados offline
  console.log('Sincronizando dados em background...');
}

// Manter Service Worker ativo em segundo plano
let keepAliveInterval;

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativando...');
  
  // Manter ativo em segundo plano
  if (!keepAliveInterval) {
    keepAliveInterval = setInterval(() => {
      console.log('🔄 Service Worker mantendo ativo...');
      
      // Enviar heartbeat para todos os clientes
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'KEEP_ALIVE',
            timestamp: Date.now()
          });
        });
      });
    }, 5000); // A cada 5 segundos
  }
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker ativado');
      return self.clients.claim();
    })
  );
});

// Notificações push reais (funcionam em segundo plano)
self.addEventListener('push', (event) => {
  console.log('📱 Push notification recebida:', event.data);
  
  // Gerar tag única para cada notificação
  const uniqueTag = `agendei-facil-push-${Date.now()}-${Math.random()}`;
  
  let notificationData = {
    title: 'Agendei Fácil',
    body: 'Novo agendamento disponível!',
    icon: '/novo-icone.png',
    badge: '/novo-icone.png',
    vibrate: [100, 50, 100],
    silent: false, // Usar som nativo do sistema
    requireInteraction: false,
    tag: uniqueTag, // Tag única para não substituir
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      type: 'new_appointment',
      uniqueId: uniqueTag
    },
    actions: [
      {
        action: 'view',
        title: 'Ver agendamento',
        icon: '/novo-icone.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/novo-icone.png'
      }
    ]
  };

  // Se há dados específicos na notificação
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📱 Dados da push notification:', data);
      
      if (data.type === 'cancelled_appointment') {
        notificationData = {
          ...notificationData,
          title: 'Agendei Fácil',
          body: data.message || 'Agendamento cancelado',
          data: {
            ...notificationData.data,
            type: 'cancelled_appointment',
            appointmentId: data.appointmentId
          }
        };
      } else if (data.type === 'new_appointment') {
        notificationData = {
          ...notificationData,
          title: 'Agendei Fácil',
          body: data.message || 'Novo agendamento realizado!',
          data: {
            ...notificationData.data,
            type: 'new_appointment',
            appointmentId: data.appointmentId
          }
        };
      }
    } catch (error) {
      console.log('Erro ao processar dados da notificação:', error);
    }
  }
  
  console.log('📱 Mostrando notificação:', notificationData);
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Listener para mensagens do app
self.addEventListener('message', (event) => {
  console.log('📱 Mensagem recebida no service worker:', event.data);
  
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, type, appointmentId } = event.data.data;
    
    console.log('📱 Criando notificação:', { title, body, type, appointmentId });
    
    // Gerar tag única para cada notificação
    const uniqueTag = `agendei-facil-${Date.now()}-${Math.random()}`;
    
    const notificationData = {
      title: title,
      body: body,
      icon: '/novo-icone.png',
      badge: '/novo-icone.png',
      vibrate: [100, 50, 100],
      silent: false, // Usar som nativo do sistema
      requireInteraction: false,
      tag: uniqueTag, // Tag única para não substituir
      data: {
        type: type,
        appointmentId: appointmentId,
        timestamp: Date.now(),
        uniqueId: uniqueTag
      },
      actions: [
        {
          action: 'view',
          title: 'Ver detalhes',
          icon: '/novo-icone.png'
        },
        {
          action: 'close',
          title: 'Fechar',
          icon: '/novo-icone.png'
        }
      ]
    };
    
    console.log('📱 Mostrando notificação via Service Worker:', notificationData);
    
    event.waitUntil(
      self.registration.showNotification(notificationData.title, notificationData)
        .then(() => {
          console.log('📱 Notificação mostrada com sucesso! Tag:', uniqueTag);
          
          // Tocar som adicional para garantir
          setTimeout(() => {
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUYbXq66hVFApGn+DyvmwfCEqhz+2VQgELTZ/Y7aZeFAsXZLPp56UtBjGM1e/GeScGKnDC7+OPOgUTYrLo66hTEgpJm9+zt3MjCSN6yu3CfC0HKHbH8N2QQwQTYrHo7K1cFApModr+wWUfBS2Cyuy0bSYI');
              audio.volume = 1.0;
              audio.play().catch(() => console.log('Som adicional não pôde ser reproduzido'));
            } catch (error) {
              console.log('Erro ao tocar som adicional:', error);
            }
          }, 100);
        })
        .catch((error) => {
          console.error('📱 Erro ao mostrar notificação:', error);
        })
    );
  }
});

// Clique em notificação
self.addEventListener('notificationclick', (event) => {
  console.log('Notificação clicada:', event.action);
  
  event.notification.close();

  if (event.action === 'view') {
    // Abrir o app na página de agendamentos
    event.waitUntil(
      clients.openWindow('/dashboard/establishment')
    );
  } else if (event.action === 'close') {
    // Apenas fechar a notificação
    return;
  } else {
    // Clique padrão - abrir o app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Fechar notificação
self.addEventListener('notificationclose', (event) => {
  console.log('Notificação fechada:', event.notification.data);
});

// Função para enviar notificação manual
function sendNotification(title, body, type = 'new_appointment') {
  const notificationData = {
    title: title || 'Agendei Fácil',
    body: body || 'Novo agendamento!',
    icon: '/novo-icone.png',
    badge: '/novo-icone.png',
    vibrate: [100, 50, 100],
    sound: type === 'cancelled_appointment' ? NOTIFICATION_SOUNDS.cancelledAppointment : NOTIFICATION_SOUNDS.newAppointment,
    data: {
      dateOfArrival: Date.now(),
      type: type
    },
    actions: [
      {
        action: 'view',
        title: 'Ver detalhes',
        icon: '/novo-icone.png'
      },
      {
        action: 'close',
        title: 'Fechar',
        icon: '/novo-icone.png'
      }
    ]
  };

  // Tocar som de notificação
  playNotificationSound(type === 'cancelled_appointment' ? 'cancelledAppointment' : 'newAppointment');
  
  return self.registration.showNotification(notificationData.title, notificationData);
}

// Expor função para uso no app
self.sendNotification = sendNotification;

// Listener para mensagens do app
self.addEventListener('message', (event) => {
  console.log('Mensagem recebida no service worker:', event.data);
  
  if (event.data.type === 'SEND_NOTIFICATION') {
    const { title, body, type, appointmentId } = event.data.data;
    
    sendNotification(title, body, type);
  }
  
  // Limpar cache quando solicitado
  if (event.data.type === 'CLEAR_CACHE') {
    console.log('🗑️ Limpando cache do Service Worker...');
    
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('🗑️ Deletando cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('✅ Cache limpo com sucesso!');
      }).catch((error) => {
        console.error('❌ Erro ao limpar cache:', error);
      })
    );
  }
});
