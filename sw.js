/* Learning Hub service worker — makes the app installable and lets it open
   with no connection.

   - App files (this folder): network first, so a deploy shows up on the next
     open; the cached copy is used only when the network fails.
   - Pinned CDN libraries and the PDF font: cache first — their URLs carry an
     exact version, so a cached copy is never stale.
   - Supabase and everything else: never touched. Data always comes live;
     offline, the app shows its own "Couldn't load your data" card. */
const VERSION = 'lh-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/learning_hub.css',
  'js/learning_hub.js', 'js/ghost_test.js', 'js/japanese_source.js',
  'icons/icon-192.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png'
];
const PINNED = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'
];

self.addEventListener('install', e => {
  // the app files must all cache; the CDN copies are best effort, so a CDN hiccup never blocks install
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL).then(() => Promise.allSettled(PINNED.map(u => c.add(u)))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const pinned = PINNED.includes(req.url) || url.pathname.endsWith('/fonts/NotoSansJP-Regular.ttf');
  if (pinned) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (url.origin !== self.location.origin) return;            // Supabase, fonts.googleapis, …
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
