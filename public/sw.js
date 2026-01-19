
const CACHE_NAME = '4gracie-v1';

// Install Event - Skip waiting to activate immediately if needed
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate Event - Claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Notification Event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '4Gracie Catering';
  const options = {
    body: data.body || 'Máte novou zprávu.',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    // Renotify ensures device vibrates/sounds even if another notification is already visible
    tag: '4gracie-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Use a relative URL or absolute URL depending on how it was sent
  const targetUrl = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // Check if URL matches base (ignoring query params if needed, or exact match)
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
        // Also check if just the app is open (root) and focus it, then navigate? 
        // Simple strategy: if app is open, focus it.
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
             client.focus();
             // Optional: Post message to navigate client side
             // client.postMessage({action: 'navigate', url: targetUrl});
             // For now, let's just focus. Or open new if specific URL needed and not open.
             if (client.url !== targetUrl) {
                 return client.navigate(targetUrl);
             }
             return;
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle 'SKIP_WAITING' message from client to update SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
