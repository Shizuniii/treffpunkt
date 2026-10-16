// Treffpunkt Service Worker
//  • App-Dateien: immer zuerst die neueste Version aus dem Netz, ohne Netz aus dem Zwischenspeicher (offline nutzbar).
//  • Firebase-Bibliothek (gstatic.com, feste Versionsnummer in der Adresse): einmal laden, dann aus dem Zwischenspeicher.
//  • Push-Nachrichten anzeigen und beim Antippen die richtige Seite öffnen.
const CACHE = 'treffpunkt-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e =>
  e.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k.startsWith('treffpunkt-') && k !== CACHE).map(k => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
);

const isFirebaseSdk = url => url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (isFirebaseSdk(url)) {
    e.respondWith(
      caches.match(req).then(
        hit =>
          hit ||
          fetch(req).then(res => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }
  if (url.origin !== self.location.origin) return; // Firebase-Daten, Schriften usw. nicht anfassen
  if (url.pathname.endsWith('version.json') || url.pathname.includes('/cal/')) return; // immer live
  e.respondWith(
    fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req, { ignoreSearch: true })
          .then(r => r || caches.match('./'))
          .then(r => r || caches.match('index.html'))
          .then(r => r || Response.error())
      )
  );
});

// Push-Nachricht anzeigen (verschickt von tools/notify.js über GitHub Actions)
self.addEventListener('push', e => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Treffpunkt', {
      body: d.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: d.tag || undefined,
      data: { url: d.url || './' },
    })
  );
});

// Antippen öffnet die passende Seite (oder holt ein offenes Treffpunkt-Fenster nach vorn)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list)
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      return self.clients.openWindow(url);
    })
  );
});
