/* Service worker for Shubham × Vaibhavi wedding site
 * Responsibilities:
 *   1. Display OS-level notifications on demand (from the page or from
 *      push-style messages forwarded by the foreground tab).
 *   2. Light app-shell caching so the splash + key assets feel instant
 *      on repeat visits.
 *   3. Route notification clicks back into the live-updates section.
 *
 * Note: true background push (when no tab is open) requires a push
 * server with VAPID keys. Without that, this SW handles foreground +
 * background-tab notifications, which is the realistic free option.
 */

const CACHE = 'sv-wedding-v3';
const SHELL = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/realtime.js',
    '/manifest.json',
    '/assets/hero-mandap.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => null))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

// Network-first for HTML / JS so updates roll out fast; cache-first for icons/css.
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // Never intercept the realtime ntfy stream or external counter API
    if (url.host !== self.location.host) return;
    if (url.pathname.startsWith('/json')) return;

    const isAsset = /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname);
    if (isAsset) {
        event.respondWith((async () => {
            const cached = await caches.match(req);
            if (cached) return cached;
            try {
                const fresh = await fetch(req);
                const c = await caches.open(CACHE);
                c.put(req, fresh.clone()).catch(() => {});
                return fresh;
            } catch (_) {
                return cached || Response.error();
            }
        })());
        return;
    }

    // Network-first with cache fallback for HTML / JS / CSS
    event.respondWith((async () => {
        try {
            const fresh = await fetch(req);
            const c = await caches.open(CACHE);
            c.put(req, fresh.clone()).catch(() => {});
            return fresh;
        } catch (_) {
            const cached = await caches.match(req);
            return cached || new Response('Offline', { status: 503 });
        }
    })());
});

// Display a notification on behalf of the page. The page hooks the
// ntfy EventSource and forwards new updates here so the OS renders a
// proper notification (works while ANY tab is open, even backgrounded).
self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'show-notification') {
        const title = data.title || 'Wedding update';
        const opts = {
            body: data.body || '',
            icon: data.icon || '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: data.tag || 'wedding-update',
            renotify: true,
            data: { url: data.url || '/#live-updates', payload: data.payload || null },
            vibrate: [120, 60, 120],
            requireInteraction: !!data.important
        };
        event.waitUntil(self.registration.showNotification(title, opts));
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || '/#live-updates';
    event.waitUntil((async () => {
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of allClients) {
            try {
                const cu = new URL(c.url);
                if (cu.host === self.location.host && 'focus' in c) {
                    if ('navigate' in c) {
                        try { await c.navigate(target); } catch (_) {}
                    }
                    return c.focus();
                }
            } catch (_) {}
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
    })());
});
