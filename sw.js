/* Planos service worker: la app y las lecciones sin conexión, y el aviso de cada mañana. */
importScripts('./core.js');

const VERSION = '2026-11-02-f23248f8';
const CACHE = 'planos-' + VERSION;
const SHELL = ['./', './index.html', './app.js', './core.js', './fonts.css', './manifest.webmanifest',
  './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './data/path.json', './data/index.json'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const index = await (await fetch('./data/index.json', { cache: 'no-store' })).json();
    const fonts = Array.isArray(index.fonts) ? index.fonts.map((f) => './fonts/' + f) : [];
    const units = index.units.map((id) => `./data/units/${id}.json`);
    await cache.addAll([...SHELL, ...fonts, ...units].map((u) => new Request(u, { cache: 'no-store' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Todo lo de la app sale de la cache de esta versión; lo que falte se pide a la red y se guarda.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

async function cachedJSON(url) {
  const hit = await caches.match(url, { ignoreSearch: true });
  if (hit) return hit.json();
  return (await fetch(url)).json();
}

// El aviso de la mañana llega vacío ({"type":"daily"}): el texto se calcula aquí con el progreso del iPhone.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  event.waitUntil((async () => {
    let msg;
    if (data.title) msg = { title: String(data.title), body: String(data.body || '') };
    else {
      try {
        const [path, stored, cards, reviewLog] = await Promise.all([cachedJSON('./data/path.json'), PlanosCore.idbGet('progress'), PlanosCore.idbGet('cards'), PlanosCore.idbGet('reviewLog')]);
        const progress = stored || {};
        let reviewDue = 0;
        try {
          const done = Object.keys(progress).filter((id) => progress[id]?.status === 'done');
          const units = await Promise.all(done.map((id) => cachedJSON(`./data/units/${id}.json`).catch(() => null)));
          reviewDue = PlanosCore.reviewQueue(units.filter(Boolean), progress, cards || {}, PlanosCore.todayKey(), Infinity).total;
        } catch (e) { reviewDue = 0; }
        msg = PlanosCore.dailyMessage(path, progress, PlanosCore.todayKey(), reviewDue, Object.keys(reviewLog || {}));
      } catch (e) {
        msg = { title: 'Planos', body: 'Tu sesión de hoy te espera.' };
      }
    }
    await self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: './icons/icon-192.png',
      tag: 'planos-daily',
      renotify: true,
      data: { url: './' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); return; }
    }
    await self.clients.openWindow('./');
  })());
});
