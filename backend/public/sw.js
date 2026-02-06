// Service Worker para notificações push

self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event sem dados');
    return;
  }

  const payload = event.data.json();
  const title = payload.title || 'Nova Atualização';
  const options = {
    body: payload.body || 'Você tem uma nova atualização',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Abrir ou focar a janela principal
  event.waitUntil(
    clients.openWindow('/cardapio')
  );
});