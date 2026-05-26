/* =========================================================
   SHUBHAM & VAIBHAVI · REAL-TIME DATA LAYER
   ---------------------------------------------------------
   Powers live status updates (admin -> guests) and the live
   wedding gallery (photographers -> guests).

   • Cross-tab on the same device: BroadcastChannel + storage
   • Status updates: localStorage (small text)
   • Photos: IndexedDB (handles MB-sized blobs, persistent)
   • Optional cross-device transport: ntfy.sh (public free
     pub/sub, no auth required). Configure WEDDING_NTFY_TOPIC
     to enable it. Without a topic, falls back to local-only.

   Exposes: window.WeddingRealtime
   ========================================================= */
(function (global) {
    'use strict';

    // ----- Config (override in HTML before this script if needed) -----
    const CONFIG = global.WEDDING_RT_CONFIG || {};
    const NTFY_TOPIC   = CONFIG.ntfyTopic   || 'sv-wedding-jalgaon-2026-prod-x73k9q';
    const NTFY_PHOTOS  = CONFIG.ntfyPhotos  || (NTFY_TOPIC + '-photos');
    const NTFY_BASE    = CONFIG.ntfyBase    || 'https://ntfy.sh';

    // Anonymous, free counter API for analytics (no signup, public).
    const STATS_BASE   = CONFIG.statsBase   || 'https://abacus.jasoncameron.dev';
    const STATS_NS     = CONFIG.statsNs     || 'sv-wedding-jalgaon-2026';

    const LS_UPDATES   = 'sv_rt_updates_v1';
    const LS_PHOTOMETA = 'sv_rt_photos_meta_v1';
    const LS_VISITED   = 'sv_visited_v1';
    const LS_VIEWED    = 'sv_updates_viewer_v1';
    const LS_NOTIF_OPT = 'sv_notif_opt_v1';
    const LS_LAST_NOTIFY = 'sv_rt_last_notify_at';
    const DB_NAME      = 'sv_wedding_realtime';
    const DB_VERSION   = 1;
    const PHOTO_STORE  = 'photos';
    const CHANNEL      = 'sv-wedding-realtime';

    const MAX_UPDATES  = 60;
    const MAX_PHOTOS   = 200;
    // Updates older than this when received are treated as "history" and
    // populate the feed silently (no notification fired).
    const NOTIFY_FRESH_MS = 5 * 60 * 1000;

    // ----- Tiny event emitter -----
    function emitter() {
        const subs = new Set();
        return {
            on(fn)  { subs.add(fn); return () => subs.delete(fn); },
            off(fn) { subs.delete(fn); },
            emit(...args) { subs.forEach(fn => { try { fn(...args); } catch (e) { console.error(e); } }); }
        };
    }

    const updatesEv = emitter();
    const photosEv  = emitter();

    // ----- BroadcastChannel for instant cross-tab sync -----
    let channel = null;
    try { channel = new BroadcastChannel(CHANNEL); } catch (_) { channel = null; }

    const post = (msg) => { if (channel) try { channel.postMessage(msg); } catch (_) {} };

    if (channel) {
        channel.addEventListener('message', (e) => {
            if (!e.data) return;
            if (e.data.type === 'updates-changed') updatesEv.emit(getUpdates());
            else if (e.data.type === 'photos-changed') refreshPhotos();
        });
    }

    /* ===============================================
       SERVICE WORKER + WEB NOTIFICATIONS
       ===============================================
       Registers /sw.js so the OS can render notifications. Works
       while any tab is open OR while the PWA is installed. Real
       background push (closed app) needs a paid push backend.
       =============================================== */
    let _swReg = null;
    let _swPromise = null;
    function registerSW() {
        if (_swPromise) return _swPromise;
        if (!('serviceWorker' in navigator)) return Promise.resolve(null);
        _swPromise = navigator.serviceWorker.register('sw.js', { scope: '/' })
            .then(reg => { _swReg = reg; return reg; })
            .catch(err => { console.warn('SW register failed', err); return null; });
        return _swPromise;
    }

    function notificationsSupported() {
        return ('Notification' in window) && ('serviceWorker' in navigator);
    }

    function notificationsState() {
        if (!notificationsSupported()) return 'unsupported';
        return Notification.permission; // 'granted' | 'denied' | 'default'
    }

    async function requestNotifications() {
        if (!notificationsSupported()) return 'unsupported';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied')  return 'denied';
        let perm = 'default';
        try { perm = await Notification.requestPermission(); } catch (_) {}
        if (perm === 'granted') {
            // Track opt-ins (deduped by device).
            if (!localStorage.getItem(LS_NOTIF_OPT)) {
                localStorage.setItem(LS_NOTIF_OPT, '1');
                bumpStat('notifications_enabled');
            }
            // Welcome notification so the user knows it works.
            try {
                const reg = await registerSW();
                if (reg && reg.showNotification) {
                    reg.showNotification("You're on the guest list! 💌", {
                        body: 'Live updates from the wedding will land right here.',
                        icon: '/icons/icon-192.png',
                        badge: '/icons/icon-192.png',
                        tag:   'sv-welcome',
                        vibrate: [80, 40, 80],
                        data: { url: '/#live-updates' }
                    });
                }
            } catch (_) {}
        }
        return perm;
    }

    async function showNotification(title, body, opts = {}) {
        if (!notificationsSupported() || Notification.permission !== 'granted') return false;
        try {
            const reg = await navigator.serviceWorker.ready;
            if (!reg || !reg.showNotification) return false;
            reg.showNotification(title, {
                body: body || '',
                icon: opts.icon || '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag:   opts.tag || 'wedding-update',
                renotify: true,
                vibrate: [120, 60, 120],
                requireInteraction: !!opts.important,
                data: { url: opts.url || '/#live-updates', payload: opts.payload || null }
            });
            return true;
        } catch (e) { console.warn('notify failed', e); return false; }
    }

    /* ===============================================
       STATS (visitors / engagement)
       ===============================================
       Backed by the public abacus counter API. Read endpoints don't
       mutate; hit endpoints atomically increment + return new value.
       =============================================== */
    async function bumpStat(key) {
        try {
            const r = await fetch(`${STATS_BASE}/hit/${STATS_NS}/${encodeURIComponent(key)}`, { cache: 'no-store' });
            if (!r.ok) return null;
            const j = await r.json();
            return j && j.value;
        } catch (_) { return null; }
    }

    async function getStat(key) {
        try {
            const r = await fetch(`${STATS_BASE}/get/${STATS_NS}/${encodeURIComponent(key)}`, { cache: 'no-store' });
            if (!r.ok) return 0;
            const j = await r.json();
            return (j && j.value) || 0;
        } catch (_) { return 0; }
    }

    async function getStats() {
        const keys = ['visits', 'unique_visitors', 'updates_viewers', 'notifications_enabled'];
        const out = {};
        await Promise.all(keys.map(async k => { out[k] = await getStat(k); }));
        return out;
    }

    // Count one page-view every load; count one unique-visitor only the
    // first time this device ever opens the site.
    function trackVisit() {
        bumpStat('visits');
        if (!localStorage.getItem(LS_VISITED)) {
            localStorage.setItem(LS_VISITED, String(Date.now()));
            bumpStat('unique_visitors');
        }
    }

    // Call when the user has actually looked at the live-updates section.
    // Deduped per device so each guest counts as 1 viewer regardless of
    // how many times they scroll past.
    function trackUpdatesViewed() {
        if (localStorage.getItem(LS_VIEWED)) return false;
        localStorage.setItem(LS_VIEWED, String(Date.now()));
        bumpStat('updates_viewers');
        return true;
    }

    function trackEvent(key) { return bumpStat(key); }

    // Multi-window via storage event (older fallback)
    window.addEventListener('storage', (e) => {
        if (e.key === LS_UPDATES) updatesEv.emit(getUpdates());
        else if (e.key === LS_PHOTOMETA) refreshPhotos();
    });

    /* ===============================================
       STATUS UPDATES (localStorage)
       =============================================== */
    function getUpdates() {
        try { return JSON.parse(localStorage.getItem(LS_UPDATES) || '[]'); }
        catch (_) { return []; }
    }
    function setUpdates(arr) {
        localStorage.setItem(LS_UPDATES, JSON.stringify(arr.slice(0, MAX_UPDATES)));
    }

    function publishUpdate({ message, type = 'info', severity = 'info', icon = '', author = '' }) {
        const u = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            message, type, severity, icon, author,
            timestamp: Date.now()
        };
        const list = getUpdates();
        list.unshift(u);
        setUpdates(list);
        post({ type: 'updates-changed' });
        updatesEv.emit(getUpdates());
        // Best-effort cross-device fan-out
        sendToNtfy(NTFY_TOPIC, { kind: 'update', payload: u });
        return u;
    }

    function deleteUpdate(id) {
        const list = getUpdates().filter(u => u.id !== id);
        setUpdates(list);
        post({ type: 'updates-changed' });
        updatesEv.emit(list);
        // Propagate to all other devices/tabs via ntfy
        sendToNtfy(NTFY_TOPIC, { kind: 'delete-update', id });
    }

    function clearUpdates() {
        setUpdates([]);
        post({ type: 'updates-changed' });
        updatesEv.emit([]);
        // Tell other devices to wipe their local feed too
        sendToNtfy(NTFY_TOPIC, { kind: 'clear-updates', at: Date.now() });
    }

    /* ===============================================
       PHOTOS (IndexedDB + thumbnail in localStorage)
       =============================================== */
    let dbPromise = null;
    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const r = indexedDB.open(DB_NAME, DB_VERSION);
            r.onupgradeneeded = () => {
                const db = r.result;
                if (!db.objectStoreNames.contains(PHOTO_STORE)) {
                    const s = db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
                    s.createIndex('timestamp', 'timestamp');
                }
            };
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        return dbPromise;
    }

    async function txStore(mode) {
        const db = await openDB();
        return db.transaction(PHOTO_STORE, mode).objectStore(PHOTO_STORE);
    }

    function getPhotoMeta() {
        try { return JSON.parse(localStorage.getItem(LS_PHOTOMETA) || '[]'); }
        catch (_) { return []; }
    }
    function setPhotoMeta(arr) {
        localStorage.setItem(LS_PHOTOMETA, JSON.stringify(arr.slice(0, MAX_PHOTOS)));
    }

    function refreshPhotos() {
        photosEv.emit(getPhotoMeta());
    }

    // Compress to a JPEG data URL (max dimension capped)
    function compress(file, maxDim, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                let { width, height } = img;
                if (width > height) {
                    if (width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
                } else {
                    if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // Convert a data URL to a Blob (for ntfy upload)
    function dataUrlToBlob(dataUrl) {
        const [header, b64] = dataUrl.split(',');
        const mime = (header.match(/data:([^;]+);/) || [null, 'image/jpeg'])[1];
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return new Blob([buf], { type: mime });
    }

    // Upload a blob to ntfy.sh as an attachment; returns the hosted URL.
    async function uploadToNtfy(topic, blob, fileName) {
        try {
            const r = await fetch(`${NTFY_BASE}/${topic}`, {
                method: 'POST',
                headers: {
                    'Filename': fileName,
                    'Title': 'wedding-photo'
                },
                body: blob
            });
            if (!r.ok) return null;
            const json = await r.json();
            return (json && json.attachment && json.attachment.url) || null;
        } catch (e) {
            console.warn('ntfy upload failed', e);
            return null;
        }
    }

    async function addPhoto(file, meta = {}) {
        const fullUrl  = await compress(file, 1600, 0.82);
        const thumbUrl = await compress(file, 480,  0.72);

        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const fileName = file.name || `photo-${id}.jpg`;

        // Upload both sizes to ntfy.sh for cross-device sharing.
        // Falls back to local-only if upload fails.
        const fullBlob  = dataUrlToBlob(fullUrl);
        const thumbBlob = dataUrlToBlob(thumbUrl);
        const [remoteFull, remoteThumb] = await Promise.all([
            uploadToNtfy(NTFY_PHOTOS, fullBlob,  fileName),
            uploadToNtfy(NTFY_PHOTOS, thumbBlob, 'thumb-' + fileName)
        ]);

        const record = {
            id,
            full:  fullUrl,           // local copy (data URL) — instant in-browser
            thumb: thumbUrl,          // local thumb
            remoteFull,               // public ntfy URL — for other devices/download
            remoteThumb,              // public ntfy URL — for other devices
            caption:      meta.caption      || '',
            photographer: meta.photographer || '',
            timestamp: Date.now(),
            fileName,
            mime: 'image/jpeg'
        };

        const store = await txStore('readwrite');
        await new Promise((res, rej) => {
            const req = store.put(record);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
        });

        const list = getPhotoMeta();
        list.unshift({
            id,
            thumb: thumbUrl,
            remoteFull,
            remoteThumb,
            caption: record.caption,
            photographer: record.photographer,
            timestamp: record.timestamp,
            fileName: record.fileName
        });
        setPhotoMeta(list);
        post({ type: 'photos-changed' });
        photosEv.emit(getPhotoMeta());

        // Cross-device announce — URLs only (small payload, fits in ntfy message)
        sendToNtfy(NTFY_TOPIC, {
            kind: 'photo',
            payload: {
                id,
                caption: record.caption,
                photographer: record.photographer,
                timestamp: record.timestamp,
                fileName: record.fileName,
                remoteFull,
                remoteThumb
            }
        });
        return record;
    }

    async function getPhotoFull(id) {
        // Try local IndexedDB first (instant + works offline)
        try {
            const store = await txStore('readonly');
            const local = await new Promise((res, rej) => {
                const req = store.get(id);
                req.onsuccess = () => res(req.result || null);
                req.onerror = () => rej(req.error);
            });
            if (local && local.full) return local;
        } catch (_) {}

        // Fall back to the remote-only metadata
        const meta = getPhotoMeta().find(p => p.id === id);
        if (meta && meta.remoteFull) {
            return {
                id,
                full: meta.remoteFull,
                fileName: meta.fileName || `photo-${id}.jpg`,
                caption: meta.caption,
                photographer: meta.photographer,
                timestamp: meta.timestamp,
                remoteOnly: true
            };
        }
        return null;
    }

    async function deletePhoto(id) {
        try {
            const store = await txStore('readwrite');
            await new Promise((res, rej) => {
                const req = store.delete(id);
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
            });
        } catch (_) {}
        const list = getPhotoMeta().filter(p => p.id !== id);
        setPhotoMeta(list);
        post({ type: 'photos-changed' });
        photosEv.emit(list);
        sendToNtfy(NTFY_TOPIC, { kind: 'delete-photo', id });
    }

    async function clearPhotos() {
        try {
            const store = await txStore('readwrite');
            await new Promise((res, rej) => {
                const req = store.clear();
                req.onsuccess = () => res();
                req.onerror = () => rej(req.error);
            });
        } catch (_) {}
        setPhotoMeta([]);
        post({ type: 'photos-changed' });
        photosEv.emit([]);
        sendToNtfy(NTFY_TOPIC, { kind: 'clear-photos', at: Date.now() });
    }

    /* ===============================================
       NTFY.SH — optional cross-device fan-out
       =============================================== */
    function sendToNtfy(topic, payload) {
        if (!NTFY_TOPIC || NTFY_TOPIC === 'disabled') return;
        try {
            fetch(`${NTFY_BASE}/${topic}`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Title': 'wedding', 'Tags': 'sv-wedding' },
                keepalive: true
            }).catch(() => {});
        } catch (_) {}
    }

    function subscribeToNtfy(topic, onMessage) {
        if (!topic || topic === 'disabled') return null;

        // 1) Pull recent history (last 12h) so late joiners see past updates
        try {
            fetch(`${NTFY_BASE}/${topic}/json?poll=1&since=12h`)
                .then(r => r.ok ? r.text() : '')
                .then(text => {
                    if (!text) return;
                    text.split('\n').forEach(line => {
                        if (!line.trim()) return;
                        try {
                            const data = JSON.parse(line);
                            if (data.event === 'message' && data.message) {
                                try { onMessage(JSON.parse(data.message)); } catch (_) {}
                            }
                        } catch (_) {}
                    });
                })
                .catch(() => {});
        } catch (_) {}

        // 2) Live stream new messages
        try {
            const es = new EventSource(`${NTFY_BASE}/${topic}/sse`);
            es.addEventListener('message', (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.message) {
                        try { onMessage(JSON.parse(data.message)); } catch (_) {}
                    }
                } catch (_) {}
            });
            es.onerror = () => { /* network glitches are fine; will reconnect */ };
            return es;
        } catch (_) { return null; }
    }

    // Hook ntfy listener to merge remote -> local store (best-effort)
    let _updatesSrc = null;
    function startRemoteSync() {
        if (_updatesSrc) return;
        _updatesSrc = subscribeToNtfy(NTFY_TOPIC, (msg) => {
            if (!msg) return;

            // Add new update
            if (msg.kind === 'update' && msg.payload) {
                const existing = getUpdates();
                if (existing.some(u => u.id === msg.payload.id)) return;
                const list = [msg.payload, ...existing];
                // Sort by timestamp desc so history replays in order
                list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setUpdates(list);
                updatesEv.emit(list);

                // Fire an OS notification ONLY for fresh updates (last
                // NOTIFY_FRESH_MS). Older items came from history replay.
                const ts = +msg.payload.timestamp || 0;
                const lastNotify = +(localStorage.getItem(LS_LAST_NOTIFY) || 0);
                if (ts && ts > lastNotify && (Date.now() - ts) < NOTIFY_FRESH_MS) {
                    localStorage.setItem(LS_LAST_NOTIFY, String(ts));
                    const icon = msg.payload.icon || '🔔';
                    const title = `${icon} Wedding update`;
                    const body  = msg.payload.message || '';
                    showNotification(title, body, {
                        tag: 'sv-update-' + msg.payload.id,
                        important: (msg.payload.severity === 'warning' || msg.payload.severity === 'danger'),
                        payload: msg.payload
                    });
                } else if (ts && ts > lastNotify) {
                    // Move the watermark forward so we don't keep replaying
                    // potential notifications for messages we've already seen.
                    localStorage.setItem(LS_LAST_NOTIFY, String(ts));
                }
                return;
            }

            // Remove a specific update (cross-device delete)
            if (msg.kind === 'delete-update' && msg.id) {
                const list = getUpdates().filter(u => u.id !== msg.id);
                setUpdates(list);
                updatesEv.emit(list);
                return;
            }

            // Wipe everything older than the clear timestamp
            if (msg.kind === 'clear-updates') {
                const cutoff = msg.at || Date.now();
                const list = getUpdates().filter(u => (u.timestamp || 0) > cutoff);
                setUpdates(list);
                updatesEv.emit(list);
                return;
            }

            // Photo announcements come on the same topic now
            if (msg.kind === 'photo' && msg.payload) {
                const meta = getPhotoMeta();
                if (meta.some(p => p.id === msg.payload.id)) return;
                const p = msg.payload;
                meta.unshift({
                    id: p.id,
                    thumb: p.remoteThumb || p.thumb || '',
                    remoteFull: p.remoteFull || null,
                    remoteThumb: p.remoteThumb || null,
                    caption: p.caption || '',
                    photographer: p.photographer || '',
                    timestamp: p.timestamp || Date.now(),
                    fileName: p.fileName || `photo-${p.id}.jpg`,
                    remote: true
                });
                meta.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setPhotoMeta(meta);
                photosEv.emit(meta);
                return;
            }

            if (msg.kind === 'delete-photo' && msg.id) {
                const meta = getPhotoMeta().filter(p => p.id !== msg.id);
                setPhotoMeta(meta);
                photosEv.emit(meta);
                return;
            }

            if (msg.kind === 'clear-photos') {
                const cutoff = msg.at || Date.now();
                const meta = getPhotoMeta().filter(p => (p.timestamp || 0) > cutoff);
                setPhotoMeta(meta);
                photosEv.emit(meta);
                return;
            }
        });
    }

    /* ===============================================
       PUBLIC API
       =============================================== */
    global.WeddingRealtime = {
        // Updates
        getUpdates,
        publishUpdate,
        deleteUpdate,
        clearUpdates,
        onUpdates: (cb) => { const off = updatesEv.on(cb); cb(getUpdates()); return off; },

        // Photos
        getPhotos: () => getPhotoMeta(),
        getPhotoFull,
        addPhoto,
        deletePhoto,
        clearPhotos,
        onPhotos: (cb) => { const off = photosEv.on(cb); cb(getPhotoMeta()); return off; },

        // Notifications + SW
        registerSW,
        notificationsSupported,
        notificationsState,
        requestNotifications,
        showNotification,

        // Analytics
        trackVisit,
        trackUpdatesViewed,
        trackEvent,
        bumpStat,
        getStat,
        getStats,

        // Optional remote
        startRemoteSync,
        config: { NTFY_TOPIC, NTFY_PHOTOS, NTFY_BASE, STATS_NS }
    };

    // Auto-start remote sync (no harm if offline)
    if (!CONFIG.disableRemote) {
        try { startRemoteSync(); } catch (_) {}
    }

    // Auto-register service worker and track visit. Skipped on admin
    // and photographer pages (they pass disableTracking via CONFIG).
    if (!CONFIG.disableTracking) {
        try { registerSW(); } catch (_) {}
        try { trackVisit(); } catch (_) {}
    } else {
        // Admin / photographer still want the SW available (e.g. for
        // their own "test notification" flows) but not the visit count.
        try { registerSW(); } catch (_) {}
    }
})(window);
