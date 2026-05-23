self.addEventListener('push', (event) => {
  let data = { title: 'FloodWatch Alert', body: 'New flood alert received.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'FloodWatch Alert', body: event.data.text() };
    }
  }

  // Pull url from nested data object if present, else fallback
  const targetUrl = data.data?.url || data.url || '/';

  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: {
      url: targetUrl
    },
    tag: 'flood-alert',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If there is an open window of our origin, focus it
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            return client.focus();
          }
        } catch (e) {
          console.error('Error parsing client URL:', e);
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
