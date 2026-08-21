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

// Fires when the push service invalidates the old subscription (e.g. expired/rotated)
// Automatically re-subscribes with fresh keys and notifies the backend
self.addEventListener('pushsubscriptionchange', (event) => {
  const API_BASE = 'http://localhost:5000/api';

  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(async (newSubscription) => {
        const payload = newSubscription.toJSON();
        const token = await self.clients.matchAll().then(clientList => {
          // Try to get auth token from a client (best effort)
          return null; // SW can't access localStorage directly
        });

        await fetch(`${API_BASE}/alerts/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: payload.endpoint,
            p256dh: payload.keys?.p256dh,
            auth: payload.keys?.auth
          })
        });
        console.log('[SW] Push subscription refreshed via pushsubscriptionchange.');
      })
      .catch(err => {
        console.error('[SW] Failed to refresh push subscription:', err);
      })
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
