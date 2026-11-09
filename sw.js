// Satsooma Sign-off service worker: keeps a copy of the app on the phone so it opens with no signal.
//
// IMPORTANT: change VERSION every time any app file changes. Phones only pick up a
// new version when this line is different. Keep it in step with APP_VERSION in app.js.
const VERSION = 'signoff-0.5.1';

const CORE = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'checklists.js',
  'pdf-lib.min.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'logo-white.png',
  'Sora-Regular.ttf',
  'Sora-SemiBold.ttf',
  'Sora-Bold.ttf',
  'Sora-ExtraBold.ttf',
  'mcs.png',
  'recc.jpg',
  'tm.png',
  'hg.png',
  'rw.png'
];

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's own short-term copy, so an update always
  // stores the files fresh from the server rather than the ones already on the phone.
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html').then(r => r || fetch(req)));
    return;
  }

  // Cache first; anything extra that loads fine (e.g. font files added later) is kept for offline use.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
