// Önbellek-öncelikli service worker: uygulama internetsiz çalışır.
// Bir dosya değiştiğinde VERSION'ı arttır.
const VERSION = 'kura-cek-v8';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/rng.js',
  'js/store.js',
  'js/ui.js',
  'js/icons.js',
  'js/modules.js',
  'js/ticket.js',
  'js/pages/bottle.js',
  'js/pages/bingo.js',
  'js/pages/finger.js',
  'js/pages/teams.js',
  'js/pages/letter.js',
  'js/pages/gift.js',
  'js/pages/rps.js',
  'js/pages/orb.js',
  'js/pages/numbers.js',
  'js/pages/scratch.js',
  'js/pages/cards.js',
  'js/pages/duty.js',
  'js/pages/seating.js',
  'js/pages/counting.js',
  'js/pages/rpgdice.js',
  'js/data/tekerlemeler.js',
  'js/three/stage.js',
  'js/pages/home.js',
  'js/pages/coin.js',
  'js/pages/dice.js',
  'js/pages/sticks.js',
  'js/pages/list.js',
  'js/pages/history.js',
  'js/pages/about.js',
  'js/pages/settings.js',
  'vendor/three.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Google Fonts da önbelleğe alınır; çevrimdışıyken sistem fontuna düşülür.
  if (url.origin !== location.origin && !FONT_HOSTS.includes(url.hostname)) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(e.request).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copy));
          }
          return res;
        }),
    ),
  );
});
