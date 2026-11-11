/* 授業プリント：オフラインで使えるようにするための仕組み（サービスワーカー）
   ・アプリ本体（index.html など）は、ネットにつながっていれば最新版を取りに行き、つながっていなければ保存しておいた版を使う
   ・PDFを表示する部品（pdf.js）は一度取ったら保存しておいた版を使う
   ・教材はここでは扱わない（教材は iPad の中の別の保存場所に入る） */
const CACHE = 'jugyo-print-v4';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(LIBS.map(async u => { try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await c.put(u, r); } catch (_) {} }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (LIBS.includes(url.href)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(url.href);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(url.href, r.clone());
      return r;
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (_) {
      const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
      if (hit) return hit;
      throw _;
    }
  })());
});
