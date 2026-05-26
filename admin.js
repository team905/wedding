(() => {
    'use strict';

    const PASSPHRASE_KEY = 'sv_admin_authed_v1';
    const PASSPHRASE     = 'baraat2026';

    const lockScreen = document.getElementById('lockScreen');
    const lockForm   = document.getElementById('lockForm');
    const lockInput  = document.getElementById('lockInput');
    const adminShell = document.getElementById('adminShell');

    const unlock = () => {
        lockScreen.style.display = 'none';
        adminShell.hidden = false;
        setTimeout(initDashboard, 50);
    };

    if (sessionStorage.getItem(PASSPHRASE_KEY) === '1') unlock();

    lockForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (lockInput.value.trim() === PASSPHRASE) {
            sessionStorage.setItem(PASSPHRASE_KEY, '1');
            unlock();
        } else {
            lockInput.style.animation = 'shake 0.4s ease';
            setTimeout(() => lockInput.style.animation = '', 500);
            lockInput.value = '';
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem(PASSPHRASE_KEY);
        location.reload();
    });

    // ----- Toast (with optional Undo action) -----
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    let toastTimer = null;
    let toastUndoBtn = null;
    function showToast(msg, opts = {}) {
        if (!toast) return;
        toastMsg.textContent = msg;
        toast.classList.add('show');
        // Remove any prior undo button
        if (toastUndoBtn) { toastUndoBtn.remove(); toastUndoBtn = null; }
        if (opts.undo) {
            toastUndoBtn = document.createElement('button');
            toastUndoBtn.className = 'toast-undo';
            toastUndoBtn.textContent = 'Undo';
            toastUndoBtn.addEventListener('click', () => {
                opts.undo();
                toast.classList.remove('show');
                if (toastUndoBtn) toastUndoBtn.remove();
                toastUndoBtn = null;
                clearTimeout(toastTimer);
            });
            toast.appendChild(toastUndoBtn);
        }
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.remove('show');
            if (toastUndoBtn) { toastUndoBtn.remove(); toastUndoBtn = null; }
        }, opts.duration || 3500);
    }

    // ----- Quick action presets -----
    const PRESETS = [
        { icon: '🎺', message: 'Baraat has started! Groom is on the way 🐎',                  severity: 'success', label: 'Baraat Started' },
        { icon: '🌼', message: 'Haldi ceremony is starting now',                              severity: 'info',    label: 'Haldi Started' },
        { icon: '🎵', message: 'Sangeet has begun — come dance with us!',                    severity: 'success', label: 'Sangeet Begins' },
        { icon: '🕉️', message: 'Lagna Vidhi is starting now — please take your seats',       severity: 'success', label: 'Ceremony Starting' },
        { icon: '⏰', message: 'Ceremony delayed by 30 minutes — settle in, more chai!',     severity: 'warning', label: 'Ceremony Delayed' },
        { icon: '🍽️', message: 'Dinner is open — head to the dining lawn',                  severity: 'success', label: 'Dinner Open' },
        { icon: '🚗', message: 'Parking is full — please use the overflow lot near gate 2', severity: 'warning', label: 'Parking Full' },
        { icon: '🚖', message: 'Shuttle from Hotel Royal Palace leaves in 15 minutes',       severity: 'info',    label: 'Shuttle Leaving' },
        { icon: '🌧️', message: 'Light rain — events shifted under the main pandal',         severity: 'warning', label: 'Weather Update' },
        { icon: '💍', message: 'They said yes! Rings exchanged ❤️',                          severity: 'success', label: 'Rings Exchanged' },
        { icon: '📸', message: 'Group photo in 10 minutes — please assemble at the mandap',  severity: 'info',    label: 'Group Photo' },
        { icon: '🎂', message: 'Cake-cutting in 5 minutes — gather around!',                 severity: 'success', label: 'Cake Cutting' }
    ];

    const sevColor = (s) => ({
        info:    'var(--c-text-secondary)',
        success: '#1e7a4d',
        warning: '#c47000',
        urgent:  '#c1440e'
    }[s] || '#666');

    function initDashboard() {
        const quickGrid = document.getElementById('quickGrid');
        quickGrid.innerHTML = PRESETS.map((p, i) => `
            <button class="quick-card" data-i="${i}" data-sev="${p.severity}">
                <span class="quick-icon">${p.icon}</span>
                <strong>${p.label}</strong>
                <span class="quick-msg">${p.message}</span>
                <span class="quick-sev">${p.severity}</span>
            </button>
        `).join('');

        quickGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.quick-card');
            if (!btn) return;
            const p = PRESETS[parseInt(btn.dataset.i, 10)];
            window.WeddingRealtime.publishUpdate({
                icon: p.icon, message: p.message, severity: p.severity, author: 'Wedding Coordinator'
            });
            btn.classList.add('flash');
            setTimeout(() => btn.classList.remove('flash'), 800);
            if (navigator.vibrate) navigator.vibrate(20);
            showToast(`Sent: ${p.label}`);
        });

        // Custom form
        const cfIcon   = document.getElementById('cfIcon');
        const cfMsg    = document.getElementById('cfMsg');
        const cfAuthor = document.getElementById('cfAuthor');
        const cfSeg    = document.getElementById('cfSeg');
        let activeSev = 'info';

        cfSeg.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            cfSeg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
            activeSev = b.dataset.sev;
        });

        document.getElementById('customForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const msg = cfMsg.value.trim();
            if (!msg) return;
            window.WeddingRealtime.publishUpdate({
                icon: cfIcon.value.trim() || '📣',
                message: msg,
                severity: activeSev,
                author: cfAuthor.value.trim() || ''
            });
            cfMsg.value = '';
            showToast('Custom update broadcast');
            if (navigator.vibrate) navigator.vibrate(20);
        });

        // Live feed render
        const feedList = document.getElementById('feedList');
        const updateCount = document.getElementById('updateCount');
        const fmtTime = (t) => {
            const d = new Date(t);
            return d.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' });
        };

        const renderFeed = (list) => {
            updateCount.textContent = list.length;
            if (!list.length) {
                feedList.innerHTML = '<p class="feed-empty">No updates yet — send your first one above.</p>';
                return;
            }
            feedList.innerHTML = list.map(u => `
                <div class="feed-item" data-sev="${u.severity}" data-id="${u.id}">
                    <span class="feed-icon" style="background:${sevColor(u.severity)}20;color:${sevColor(u.severity)};">${u.icon || '•'}</span>
                    <div class="feed-body">
                        <p>${escapeHtml(u.message)}</p>
                        <span class="feed-meta">${fmtTime(u.timestamp)}${u.author ? ' · ' + escapeHtml(u.author) : ''} · <em>${u.severity}</em></span>
                    </div>
                    <div class="feed-actions">
                        <button class="feed-copy" data-id="${u.id}" title="Copy message">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M10 8h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z"/></svg>
                        </button>
                        <button class="feed-del" data-id="${u.id}" aria-label="Delete this update">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"/></svg>
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            `).join('');
        };

        // Soft-delete with Undo (no native confirm popup — friendlier)
        feedList.addEventListener('click', (e) => {
            const del = e.target.closest('.feed-del');
            const copy = e.target.closest('.feed-copy');

            if (copy) {
                const id = copy.dataset.id;
                const u = window.WeddingRealtime.getUpdates().find(x => x.id === id);
                if (u && navigator.clipboard) {
                    navigator.clipboard.writeText(`${u.icon || ''} ${u.message}`.trim())
                        .then(() => showToast('Copied to clipboard'))
                        .catch(() => showToast('Could not copy'));
                }
                return;
            }

            if (del) {
                const id = del.dataset.id;
                const all = window.WeddingRealtime.getUpdates();
                const u = all.find(x => x.id === id);
                if (!u) return;

                // Visually mark as removing
                const row = del.closest('.feed-item');
                if (row) row.classList.add('removing');

                window.WeddingRealtime.deleteUpdate(id);
                if (navigator.vibrate) navigator.vibrate(15);

                showToast(`Removed: "${u.message.slice(0, 40)}${u.message.length > 40 ? '…' : ''}"`, {
                    duration: 6000,
                    undo: () => {
                        // Republish original (assigns new id; older one was deleted)
                        window.WeddingRealtime.publishUpdate({
                            icon: u.icon,
                            message: u.message,
                            severity: u.severity,
                            author: u.author
                        });
                        showToast('Update restored');
                    }
                });
            }
        });

        // Clear All — with snapshot for undo
        document.getElementById('clearAllBtn').addEventListener('click', () => {
            const snapshot = window.WeddingRealtime.getUpdates();
            if (!snapshot.length) {
                showToast('Nothing to clear');
                return;
            }
            window.WeddingRealtime.clearUpdates();
            if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
            showToast(`Cleared ${snapshot.length} update${snapshot.length > 1 ? 's' : ''}`, {
                duration: 8000,
                undo: () => {
                    // Restore oldest first so order is preserved
                    snapshot.slice().reverse().forEach(u => {
                        window.WeddingRealtime.publishUpdate({
                            icon: u.icon, message: u.message, severity: u.severity, author: u.author
                        });
                    });
                    showToast('All updates restored');
                }
            });
        });

        window.WeddingRealtime.onUpdates(renderFeed);

        initStats();
    }

    // ----- Audience stats -----
    function initStats() {
        const RT = window.WeddingRealtime;
        if (!RT || typeof RT.getStats !== 'function') return;

        const $v = document.getElementById('statVisits');
        const $u = document.getElementById('statUnique');
        const $w = document.getElementById('statViewers');
        const $n = document.getElementById('statNotif');
        const $at = document.getElementById('statsAt');
        const $btn = document.getElementById('refreshStatsBtn');

        const fmt = (n) => {
            const x = Number(n) || 0;
            if (x >= 10000) return (x / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
            return x.toLocaleString('en-IN');
        };

        let lastUnique = 0;
        let lastViewers = 0;
        let lastNotif = 0;
        let _refreshing = false;

        async function refresh() {
            if (_refreshing) return;
            _refreshing = true;
            if ($btn) { $btn.disabled = true; $btn.classList.add('spinning'); }
            try {
                const s = await RT.getStats();
                if ($v) $v.textContent = fmt(s.visits);
                if ($u) animateBump($u, lastUnique, s.unique_visitors); lastUnique = s.unique_visitors;
                if ($w) animateBump($w, lastViewers, s.updates_viewers); lastViewers = s.updates_viewers;
                if ($n) animateBump($n, lastNotif, s.notifications_enabled); lastNotif = s.notifications_enabled;
                if ($at) {
                    const now = new Date();
                    $at.textContent = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
                }
            } finally {
                _refreshing = false;
                if ($btn) { $btn.disabled = false; $btn.classList.remove('spinning'); }
            }
        }

        function animateBump(el, oldV, newV) {
            const o = Number(oldV) || 0;
            const n = Number(newV) || 0;
            el.textContent = fmt(n);
            if (n > o && o !== 0) {
                el.classList.remove('bump');
                void el.offsetWidth; // restart animation
                el.classList.add('bump');
            }
        }

        $btn?.addEventListener('click', refresh);
        refresh();
        // Refresh every 30 s
        setInterval(refresh, 30000);
        // Also refresh when admin posts an update — that often grows
        // notification opt-ins shortly after as guests see the prompt.
        window.WeddingRealtime.onUpdates(() => {
            setTimeout(refresh, 5000);
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
        }[c]));
    }
})();
