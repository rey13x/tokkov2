self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    payload = {
      title: 'Tokko Notification',
      body: event.data.text(),
    };
  }

  const title = payload.notification?.title || payload.title || 'Tokko Notification';
  const body = payload.notification?.body || payload.body || payload.data?.body || '';
  const data = payload.notification?.data || payload.data || {};

  const options = {
    body,
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    data: {
      ...data,
      url: data.url || payload.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existingClient = clientList.find((client) => client.url === clickUrl);
      if (existingClient) {
        return existingClient.focus();
      }
      return self.clients.openWindow(clickUrl);
    }),
  );
});
