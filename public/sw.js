// Service Worker for push notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || '',
      icon: '/icon-192x192.png',
      badge: '/icon-72x72.png',
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Notificação', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  // Open the app or a specific page when notification is clicked
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Keep the service worker alive
self.addEventListener('fetch', function(event) {
  // Handle fetch events if needed
});