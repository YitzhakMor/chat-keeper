// Offline cache + receiving shared WhatsApp exports (Web Share Target, Android).
const VERSION = 'ck-v2';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'share-inbox').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const inbox = await caches.open('share-inbox');
      for (const k of await inbox.keys()) await inbox.delete(k);
      let i = 0;
      for (const f of form.getAll('files')) {
        if (!(f instanceof File)) continue;
        await inbox.put('./shared/' + (i++), new Response(f, {
          headers: {'x-name': encodeURIComponent(f.name), 'content-type': f.type || 'application/octet-stream'}
        }));
      }
      return Response.redirect('./?shared=' + Date.now(), 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Serve from cache right away, refresh the cache in the background.
  e.respondWith(caches.open(VERSION).then(c => c.match(e.request, {ignoreSearch: true}).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});
