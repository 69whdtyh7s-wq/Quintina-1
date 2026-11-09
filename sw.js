// Service worker de Quintina: permite usar la app sin conexión.
// Subí el número de versión cada vez que quieras forzar una recarga completa de la caché.
const VERSION = 'quintina-v1';
const CORE = [
  './',
  'index.html',
  'manifest.json',
  'apple-touch-icon.png?v=2',
  'favicon-32.png?v=2',
  'favicon-16.png?v=2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // Cada archivo por separado: si alguno no existe, no se cae toda la instalación.
      return Promise.all(CORE.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Páginas: primero la red (así llegan las actualizaciones); sin conexión, la copia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req, { ignoreSearch: true })
          .then(function (r) { return r || caches.match('./') || caches.match('index.html'); })
          .then(function (r) { return r || caches.match('index.html'); });
      })
    );
    return;
  }

  // Resto (íconos, fuentes, manifest): copia guardada al instante y se actualiza en segundo plano.
  event.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
