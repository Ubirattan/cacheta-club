// Service worker da Casa de Jogos: só recebe notificações (não guarda páginas em cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Casa de Jogos', {
    body: d.body || 'Nova venda', icon: '/icon-192.png', badge: '/icon-192.png', tag: 'venda-' + Date.now(),
    vibrate: [200, 100, 200], data: { url: d.url || '/admin' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.includes(url) && 'focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
