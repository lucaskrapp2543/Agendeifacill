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

// Sons de notificação
const NOTIFICATION_SOUNDS = {
  newAppointment: '/notification-sound.mp3',
  cancelledAppointment: '/cancelled-sound.mp3'
};

// Função para tocar som de notificação
function playNotificationSound(type) {
  try {
    // Tentar tocar som personalizado
    const audio = new Audio(NOTIFICATION_SOUNDS[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Se falhar, usar som nativo do navegador
      console.log('🎵 Tocando som nativo do navegador');
      // O navegador tocará o som padrão da notificação
    });
  } catch (error) {
    console.log('🎵 Erro ao tocar som, usando som nativo');
  }
}

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

// Notificações push
self.addEventListener('push', (event) => {
  console.log('Push notification recebida:', event.data);
  
  let notificationData = {
    title: 'Agendei Fácil',
    body: 'Novo agendamento disponível!',
    icon: '/novo-icone.png',
    badge: '/novo-icone.png',
    vibrate: [100, 50, 100],
    sound: NOTIFICATION_SOUNDS.newAppointment,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      type: 'new_appointment'
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
      if (data.type === 'cancelled_appointment') {
        notificationData = {
          ...notificationData,
          title: 'Agendei Fácil',
          body: 'Agendamento cancelado',
          sound: NOTIFICATION_SOUNDS.cancelledAppointment,
          data: {
            ...notificationData.data,
            type: 'cancelled_appointment'
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

  // Tocar som de notificação
  playNotificationSound(notificationData.data.type === 'cancelled_appointment' ? 'cancelledAppointment' : 'newAppointment');
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
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
});
