// FA24-BAI Study Hub — service worker (Round 2)
// Strategy:
//   - App shell HTML: network-first (fresh content wins, cache is the
//     offline fallback)
//   - CSS/JS/images: stale-while-revalidate (instant repeat loads,
//     self-healing on the next visit after a deploy)
//   - Semester documents (PDF/PPTX/DOCX): network-first with cache
//     fallback, so previously opened files stay readable offline
//   - /api/* : network only, never cached (live data + admin actions)

const CACHE_NAME = 'fa24bai-shell-v24';
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css?v=17',
    '/js/script.js?v=15',
    '/logo.jpeg',
    '/favicon.svg',
    '/manifest.json',
    '/404.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
            .catch(() => { /* precache is best-effort */ })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Live API: network only
    if (url.pathname.startsWith('/api/')) return;

    // Page navigations: network-first, fall back to the cached shell
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Course documents: network-first, cache fallback (offline reading)
    if (/\.(pdf|pptx|ppt|doc|docx)$/i.test(url.pathname)) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Static assets: stale-while-revalidate
    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
