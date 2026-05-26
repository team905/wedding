/* =========================================================
   GUEST MANAGEMENT SYSTEM
   ---------------------------------------------------------
   - localStorage as the source of truth on each device
   - ntfy.sh fan-out so multiple admin devices stay in sync
     (changes within ~12 h of history; CSV export is the
     permanent backup)
   - Full CRUD, search, multi-criteria filter, sort, CSV
     import/export, WhatsApp invites, per-guest QR check-in.
   ========================================================= */
(() => {
    'use strict';

    /* =========================================================
       AUTH (shared passphrase with admin)
       ========================================================= */
    const PASSPHRASE_KEY = 'sv_admin_authed_v1';
    const PASSPHRASE     = 'baraat2026';
    const lockScreen = document.getElementById('lockScreen');
    const lockForm   = document.getElementById('lockForm');
    const lockInput  = document.getElementById('lockInput');
    const adminShell = document.getElementById('adminShell');

    const unlock = () => {
        lockScreen.style.display = 'none';
        adminShell.hidden = false;
        setTimeout(init, 30);
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

    /* =========================================================
       CONSTANTS
       ========================================================= */
    const LS_KEY   = 'sv_guests_v1';
    const LS_VIEW  = 'sv_guests_view';
    const NTFY_BASE  = 'https://ntfy.sh';
    const NTFY_TOPIC = 'sv-wedding-jalgaon-2026-guests-x73k9q';
    const CHANNEL    = 'sv-guests-realtime';

    const EVENTS = [
        { id: 'sakharpuda', label: 'Sakharpuda',  date: '21 Jul', icon: '💍' },
        { id: 'haldi',      label: 'Haldi',       date: '21 Jul', icon: '🌼' },
        { id: 'mehndi',     label: 'Mehndi',      date: '21 Jul', icon: '🌿' },
        { id: 'sangeet',    label: 'Sangeet',     date: '21 Jul', icon: '🎵' },
        { id: 'wedding',    label: 'Lagna Vidhi', date: '22 Jul', icon: '🕉️' },
        { id: 'reception',  label: 'Reception',   date: '22 Jul', icon: '🎉' }
    ];
    const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]));

    const SIDE_LABEL    = { bride: 'Bride side', groom: 'Groom side', both: 'Both sides' };
    const RSVP_LABEL    = { confirmed: 'Confirmed', declined: 'Declined', pending: 'Pending', maybe: 'Maybe' };
    const RSVP_COLOR    = { confirmed: 'good', declined: 'bad', pending: 'warn', maybe: 'info' };
    const DIETARY_LABEL = { veg: 'Veg', 'non-veg': 'Non-veg', jain: 'Jain', vegan: 'Vegan', eggetarian: 'Eggetarian' };

    /* =========================================================
       DATA LAYER
       ========================================================= */
    function getAll() {
        try {
            const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (_) { return []; }
    }
    function setAll(arr) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(arr)); } catch (e) { console.warn(e); }
    }
    function newId() {
        return 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }
    function nowTs() { return Date.now(); }

    function blankGuest() {
        return {
            id: newId(),
            name: '',
            phone: '',
            email: '',
            side: 'bride',
            relation: '',
            category: 'family',
            rsvp: 'pending',
            plusOnes: 0,
            plusOneNames: '',
            rsvpNotes: '',
            events: [],
            dietary: 'veg',
            allergies: '',
            stayNeeded: false,
            stayHotel: '',
            stayRoom: '',
            stayCheckIn: '',
            stayCheckOut: '',
            travelMode: '',
            travelArrival: '',
            travelDeparture: '',
            pickupNeeded: false,
            pickupNotes: '',
            tags: [],
            notes: '',
            invitationSent: false,
            invitationSentAt: 0,
            checkedIn: false,
            checkedInAt: 0,
            giftReceived: false,
            createdAt: nowTs(),
            updatedAt: nowTs()
        };
    }

    function normalize(g) {
        // Make a guest robust to partial / external data
        const b = blankGuest();
        if (!g || typeof g !== 'object') return b;
        const out = { ...b, ...g };
        out.id        = out.id || newId();
        out.name      = (out.name || '').toString().trim();
        out.phone     = (out.phone || '').toString().trim();
        out.email     = (out.email || '').toString().trim();
        out.side      = ['bride', 'groom', 'both'].includes(out.side) ? out.side : 'bride';
        out.category  = ['family', 'friend', 'colleague', 'neighbor', 'other'].includes(out.category) ? out.category : 'family';
        out.rsvp      = ['confirmed', 'declined', 'pending', 'maybe'].includes(out.rsvp) ? out.rsvp : 'pending';
        out.dietary   = ['veg', 'non-veg', 'jain', 'vegan', 'eggetarian'].includes(out.dietary) ? out.dietary : 'veg';
        out.events    = Array.isArray(out.events) ? out.events.filter(e => EVENT_BY_ID[e]) : [];
        out.plusOnes  = Math.max(0, parseInt(out.plusOnes, 10) || 0);
        out.tags      = Array.isArray(out.tags) ? out.tags : (out.tags || '').toString().split(',').map(t => t.trim()).filter(Boolean);
        out.stayNeeded     = !!out.stayNeeded;
        out.pickupNeeded   = !!out.pickupNeeded;
        out.invitationSent = !!out.invitationSent;
        out.checkedIn      = !!out.checkedIn;
        out.giftReceived   = !!out.giftReceived;
        out.createdAt = out.createdAt || nowTs();
        out.updatedAt = out.updatedAt || nowTs();
        return out;
    }

    function upsert(g, broadcast = true) {
        const guest = normalize(g);
        guest.updatedAt = nowTs();
        const list = getAll();
        const i = list.findIndex(x => x.id === guest.id);
        if (i >= 0) list[i] = guest;
        else list.push(guest);
        setAll(list);
        if (broadcast) {
            broadcastLocal({ type: 'guests-changed' });
            sendNtfy({ kind: 'guest-upsert', payload: guest });
        }
        renderAll();
        return guest;
    }

    function remove(id, broadcast = true) {
        const list = getAll().filter(g => g.id !== id);
        setAll(list);
        if (broadcast) {
            broadcastLocal({ type: 'guests-changed' });
            sendNtfy({ kind: 'guest-delete', id });
        }
        renderAll();
    }

    function clearAll() {
        setAll([]);
        broadcastLocal({ type: 'guests-changed' });
        sendNtfy({ kind: 'guest-clear', at: nowTs() });
        renderAll();
    }

    /* =========================================================
       CROSS-TAB + CROSS-DEVICE SYNC
       ========================================================= */
    let channel = null;
    try { channel = new BroadcastChannel(CHANNEL); } catch (_) {}
    function broadcastLocal(msg) { if (channel) try { channel.postMessage(msg); } catch (_) {} }
    if (channel) {
        channel.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'guests-changed') renderAll();
        });
    }

    function sendNtfy(payload) {
        try {
            fetch(`${NTFY_BASE}/${NTFY_TOPIC}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => {});
        } catch (_) {}
    }

    function subscribeNtfy() {
        const handle = (msg) => {
            if (!msg) return;
            if (msg.kind === 'guest-upsert' && msg.payload) {
                const incoming = normalize(msg.payload);
                const list = getAll();
                const i = list.findIndex(x => x.id === incoming.id);
                // Use the newer updatedAt to resolve conflicts
                if (i >= 0) {
                    if (incoming.updatedAt >= list[i].updatedAt) list[i] = incoming;
                } else {
                    list.push(incoming);
                }
                setAll(list);
                renderAll();
                setSyncStatus('Synced', 'good');
            } else if (msg.kind === 'guest-delete' && msg.id) {
                setAll(getAll().filter(g => g.id !== msg.id));
                renderAll();
            } else if (msg.kind === 'guest-clear') {
                setAll([]);
                renderAll();
            }
        };

        // History replay first (last 12 h)
        fetch(`${NTFY_BASE}/${NTFY_TOPIC}/json?poll=1&since=12h`)
            .then(r => r.ok ? r.text() : '')
            .then(text => {
                if (!text) return;
                text.split('\n').forEach(line => {
                    if (!line.trim()) return;
                    try {
                        const ev = JSON.parse(line);
                        if (ev.event === 'message' && ev.message) {
                            try { handle(JSON.parse(ev.message)); } catch (_) {}
                        }
                    } catch (_) {}
                });
            })
            .catch(() => {});

        // Live stream
        try {
            const es = new EventSource(`${NTFY_BASE}/${NTFY_TOPIC}/sse`);
            es.onmessage = (e) => {
                try {
                    const ev = JSON.parse(e.data);
                    if (ev.event === 'message' && ev.message) handle(JSON.parse(ev.message));
                } catch (_) {}
            };
            es.onerror = () => setSyncStatus('Offline · local only', 'warn');
            es.onopen  = () => setSyncStatus('Synced', 'good');
            return es;
        } catch (_) { return null; }
    }

    function setSyncStatus(text, tone = 'good') {
        const el = document.getElementById('syncStatus');
        if (!el) return;
        el.lastChild.nodeValue = ' ' + text;
        el.classList.remove('g-live-good', 'g-live-warn', 'g-live-bad');
        el.classList.add('g-live-' + tone);
    }

    /* =========================================================
       STATE
       ========================================================= */
    const state = {
        filters: { search: '', side: '', rsvp: '', event: '', flag: '', sort: 'name-asc' },
        view: localStorage.getItem(LS_VIEW) || 'cards',
        selected: new Set(),
        editingId: null
    };

    /* =========================================================
       FILTERING + SORTING
       ========================================================= */
    function compute(list) {
        const f = state.filters;
        const q = f.search.trim().toLowerCase();
        let out = list.filter(g => {
            if (f.side && g.side !== f.side) return false;
            if (f.rsvp && g.rsvp !== f.rsvp) return false;
            if (f.event && !g.events.includes(f.event)) return false;
            if (f.flag === 'stay'        && !g.stayNeeded)        return false;
            if (f.flag === 'pickup'      && !g.pickupNeeded)      return false;
            if (f.flag === 'not-invited' &&  g.invitationSent)    return false;
            if (f.flag === 'has-plus'    && (g.plusOnes || 0) < 1) return false;
            if (f.flag === 'checked-in'  && !g.checkedIn)         return false;
            if (q) {
                const hay = [
                    g.name, g.phone, g.email, g.relation, g.notes, g.rsvpNotes,
                    g.stayHotel, g.travelArrival, g.travelDeparture,
                    (g.tags || []).join(' '), SIDE_LABEL[g.side] || ''
                ].join(' ').toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });

        const rsvpOrder = { confirmed: 0, maybe: 1, pending: 2, declined: 3 };
        out.sort((a, b) => {
            switch (f.sort) {
                case 'name-desc':    return b.name.localeCompare(a.name);
                case 'updated-desc': return (b.updatedAt || 0) - (a.updatedAt || 0);
                case 'created-desc': return (b.createdAt || 0) - (a.createdAt || 0);
                case 'rsvp':         return (rsvpOrder[a.rsvp] || 9) - (rsvpOrder[b.rsvp] || 9) || a.name.localeCompare(b.name);
                default:             return a.name.localeCompare(b.name);
            }
        });
        return out;
    }

    /* =========================================================
       RENDER · STATS
       ========================================================= */
    function renderStats(list) {
        const total = list.length;
        const confirmed = list.filter(g => g.rsvp === 'confirmed');
        const declined  = list.filter(g => g.rsvp === 'declined').length;
        const pending   = list.filter(g => g.rsvp === 'pending' || g.rsvp === 'maybe').length;
        const heads     = confirmed.reduce((s, g) => s + 1 + (g.plusOnes || 0), 0);
        const stay      = list.filter(g => g.stayNeeded && g.stayHotel).length;
        const stayWanted = list.filter(g => g.stayNeeded && !g.stayHotel).length;
        const pickup    = list.filter(g => g.pickupNeeded).length;
        const pickupReq = list.filter(g => g.pickupNeeded && !g.pickupNotes).length;
        const invSent   = list.filter(g => g.invitationSent).length;

        $('#sInvited').textContent   = total.toLocaleString('en-IN');
        $('#sConfirmed').textContent = confirmed.length.toLocaleString('en-IN');
        $('#sDeclined').textContent  = declined.toLocaleString('en-IN');
        $('#sPending').textContent   = pending.toLocaleString('en-IN');
        $('#sHeads').textContent     = heads.toLocaleString('en-IN');
        $('#sStay').textContent      = stay.toLocaleString('en-IN');
        $('#sPickup').textContent    = pickup.toLocaleString('en-IN');
        $('#sInvSent').textContent   = invSent.toLocaleString('en-IN');

        $('#sConfirmedPct').textContent = total ? Math.round(confirmed.length / total * 100) : 0;
        $('#sStaySub').textContent      = stayWanted ? `${stayWanted} still need a room` : 'everyone is placed';
        $('#sPickupSub').textContent    = pickupReq ? `${pickupReq} need details` : 'all coordinated';
        $('#sInvSentSub').textContent   = total ? `${total - invSent} still to send` : '—';

        // Event-wise attendance bars
        const bars = $('#eventBars');
        bars.innerHTML = EVENTS.map(ev => {
            const count = list.filter(g => g.events.includes(ev.id) && g.rsvp !== 'declined')
                              .reduce((s, g) => s + 1 + (g.plusOnes || 0), 0);
            const pct = total ? Math.round(count / Math.max(1, heads || total) * 100) : 0;
            return `
                <div class="g-event-bar" title="${count} attending ${ev.label}">
                    <div class="g-event-bar-head">
                        <span class="g-event-ic">${ev.icon}</span>
                        <strong>${ev.label}</strong>
                        <span class="g-event-bar-count">${count}</span>
                    </div>
                    <div class="g-event-bar-track">
                        <div class="g-event-bar-fill" style="width:${Math.min(100, pct)}%"></div>
                    </div>
                </div>`;
        }).join('');
    }

    /* =========================================================
       RENDER · LIST
       ========================================================= */
    function renderList(filtered) {
        const wrap = $('#guestList');
        const empty = $('#emptyState');
        $('#resultCount').textContent = filtered.length;
        $('#resultSummary').textContent = filtered.length === 1 ? '1 guest matches your filters.' : `${filtered.length} guests match your filters.`;

        if (!filtered.length) {
            wrap.innerHTML = '';
            const total = getAll().length;
            if (total === 0) {
                empty.hidden = false;
            } else {
                empty.hidden = true;
                wrap.innerHTML = `
                    <div class="g-no-results">
                        <strong>No guests match these filters.</strong>
                        <p>Try clearing the search or filters above.</p>
                        <button class="ghost-btn" id="resetFiltersBtn">Reset filters</button>
                    </div>`;
                $('#resetFiltersBtn')?.addEventListener('click', resetFilters);
            }
            return;
        }
        empty.hidden = true;

        if (state.view === 'cards') {
            wrap.className = 'g-list g-list-cards';
            wrap.innerHTML = filtered.map(renderCard).join('');
        } else {
            wrap.className = 'g-list g-list-table';
            wrap.innerHTML = renderTable(filtered);
        }
    }

    function renderCard(g) {
        const sel = state.selected.has(g.id) ? ' is-selected' : '';
        const eventsHtml = (g.events || []).map(e => {
            const ev = EVENT_BY_ID[e]; if (!ev) return '';
            return `<span class="g-chip g-chip-event">${ev.icon} ${ev.label}</span>`;
        }).join('');
        const plus = (g.plusOnes || 0) > 0 ? `<span class="g-chip">+${g.plusOnes}</span>` : '';
        const tags = (g.tags || []).slice(0, 4).map(t => `<span class="g-chip g-chip-tag">#${esc(t)}</span>`).join('');
        const flagBits = [
            g.stayNeeded   ? '<span class="g-flag" title="Needs accommodation">🛏️</span>' : '',
            g.pickupNeeded ? '<span class="g-flag" title="Needs pickup">🚗</span>'         : '',
            g.checkedIn    ? '<span class="g-flag g-flag-good" title="Checked in">✓</span>' : '',
            g.giftReceived ? '<span class="g-flag" title="Gift received">🎁</span>' : ''
        ].join('');
        const phoneClean = (g.phone || '').replace(/[^\d+]/g, '');

        return `
            <article class="g-card g-card-rsvp-${g.rsvp}${sel}" data-id="${g.id}">
                <label class="g-card-select">
                    <input type="checkbox" class="g-row-check" data-id="${g.id}" ${state.selected.has(g.id) ? 'checked' : ''} aria-label="Select ${esc(g.name)}">
                </label>
                <div class="g-card-body">
                    <header class="g-card-head">
                        <div>
                            <h3>${esc(g.name) || '<em>Unnamed</em>'}</h3>
                            <p class="g-card-sub">
                                <span class="g-side g-side-${g.side}">${SIDE_LABEL[g.side]}</span>
                                ${g.relation ? `· ${esc(g.relation)}` : ''}
                                ${g.category ? `· ${cap(g.category)}` : ''}
                            </p>
                        </div>
                        <span class="g-rsvp g-rsvp-${g.rsvp}">${RSVP_LABEL[g.rsvp]}${plus ? ' ' + plus : ''}</span>
                    </header>

                    ${eventsHtml ? `<div class="g-card-events">${eventsHtml}</div>` : ''}

                    <div class="g-card-meta">
                        ${g.phone ? `<span>📞 ${esc(g.phone)}</span>` : ''}
                        ${g.email ? `<span>✉️ ${esc(g.email)}</span>` : ''}
                        ${g.dietary ? `<span>🍽 ${DIETARY_LABEL[g.dietary] || g.dietary}</span>` : ''}
                        ${g.stayHotel ? `<span>🛏 ${esc(g.stayHotel)}${g.stayRoom ? ' · ' + esc(g.stayRoom) : ''}</span>` : ''}
                        ${g.travelArrival ? `<span>✈ ${esc(g.travelArrival)}</span>` : ''}
                        ${g.pickupNotes ? `<span>🚗 ${esc(g.pickupNotes)}</span>` : ''}
                    </div>

                    ${tags ? `<div class="g-card-tags">${tags}</div>` : ''}
                    ${g.notes ? `<p class="g-card-note">📝 ${esc(g.notes)}</p>` : ''}

                    <footer class="g-card-foot">
                        <div class="g-card-flags">${flagBits}${g.invitationSent ? '<span class="g-flag g-flag-good" title="Invite sent">✉️</span>' : ''}</div>
                        <div class="g-card-actions">
                            <button class="g-act" data-act="wa" data-id="${g.id}" ${phoneClean ? '' : 'disabled title="Add phone first"'}>
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.2-.1-.4-.1-.6.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.8-2.8-1.5-3.9-3.4-.3-.5.3-.5.8-1.6.1-.2.1-.4 0-.5-.1-.1-.6-1.5-.9-2-.2-.5-.5-.5-.6-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .2.2 2.1 3.2 5.1 4.5.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.6-.6 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3z"/></svg>
                                WhatsApp
                            </button>
                            <button class="g-act" data-act="rsvp" data-id="${g.id}" title="Quick RSVP toggle">↺ RSVP</button>
                            <button class="g-act" data-act="qr" data-id="${g.id}" title="Check-in QR">⌗ QR</button>
                            <button class="g-act g-act-primary" data-act="edit" data-id="${g.id}">Edit</button>
                        </div>
                    </footer>
                </div>
            </article>`;
    }

    function renderTable(rows) {
        return `
            <div class="g-table-wrap">
                <table class="g-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="rowAll" aria-label="Select all visible"></th>
                            <th>Name</th>
                            <th>Side</th>
                            <th>RSVP</th>
                            <th>+1</th>
                            <th>Phone</th>
                            <th>Events</th>
                            <th>Stay</th>
                            <th>Pickup</th>
                            <th>Diet</th>
                            <th>Inv.</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows.map(rowHtml).join('')}</tbody>
                </table>
            </div>`;
    }
    function rowHtml(g) {
        const evs = (g.events || []).map(e => EVENT_BY_ID[e]?.icon || '').join(' ');
        const phoneClean = (g.phone || '').replace(/[^\d+]/g, '');
        return `
            <tr data-id="${g.id}" class="${state.selected.has(g.id) ? 'is-selected' : ''}">
                <td><input type="checkbox" class="g-row-check" data-id="${g.id}" ${state.selected.has(g.id) ? 'checked' : ''}></td>
                <td>
                    <strong>${esc(g.name)}</strong>
                    ${g.relation ? `<br><span class="g-row-sub">${esc(g.relation)}</span>` : ''}
                </td>
                <td><span class="g-side g-side-${g.side}">${SIDE_LABEL[g.side]}</span></td>
                <td><span class="g-rsvp g-rsvp-${g.rsvp}">${RSVP_LABEL[g.rsvp]}</span></td>
                <td>${g.plusOnes || ''}</td>
                <td>${g.phone ? `<a href="tel:${esc(phoneClean)}">${esc(g.phone)}</a>` : ''}</td>
                <td>${evs}</td>
                <td>${g.stayHotel ? esc(g.stayHotel) : (g.stayNeeded ? '<em>needed</em>' : '')}</td>
                <td>${g.pickupNeeded ? (esc(g.pickupNotes) || '<em>yes</em>') : ''}</td>
                <td>${DIETARY_LABEL[g.dietary] || ''}</td>
                <td>${g.invitationSent ? '✓' : '·'}</td>
                <td class="g-row-actions">
                    <button class="g-act" data-act="wa" data-id="${g.id}" ${phoneClean ? '' : 'disabled'}>WA</button>
                    <button class="g-act g-act-primary" data-act="edit" data-id="${g.id}">Edit</button>
                </td>
            </tr>`;
    }

    /* =========================================================
       RENDER · ORCHESTRATOR
       ========================================================= */
    function renderAll() {
        const all = getAll();
        const filtered = compute(all);
        renderStats(all);
        renderList(filtered);
        renderBulkBar();
    }

    function renderBulkBar() {
        const bar = $('#bulkBar');
        const n = state.selected.size;
        if (n === 0) { bar.hidden = true; return; }
        bar.hidden = false;
        $('#bulkCount').textContent = n;
    }

    function resetFilters() {
        state.filters = { search: '', side: '', rsvp: '', event: '', flag: '', sort: 'name-asc' };
        $('#searchInput').value = '';
        $('#filterSide').value = '';
        $('#filterRsvp').value = '';
        $('#filterEvent').value = '';
        $('#filterFlag').value = '';
        $('#sortBy').value = 'name-asc';
        renderAll();
    }

    /* =========================================================
       MODAL · ADD / EDIT
       ========================================================= */
    const modal = $('#guestModal');
    const form  = $('#guestForm');

    function fillEventsGrid() {
        $('#gfEvents').innerHTML = EVENTS.map(ev => `
            <label class="g-event-pick">
                <input type="checkbox" value="${ev.id}">
                <span>
                    <span class="g-event-pick-ic">${ev.icon}</span>
                    <strong>${ev.label}</strong>
                    <em>${ev.date}</em>
                </span>
            </label>
        `).join('');
    }
    fillEventsGrid();

    function setSeg(name, value) {
        const seg = document.querySelector(`.g-seg[data-bind="${name}"]`);
        if (!seg) return;
        seg.querySelectorAll('button').forEach(b => b.classList.toggle('active', (b.dataset.val || '') === (value || '')));
        const inp = document.getElementById(name);
        if (inp) inp.value = value || '';
    }
    document.querySelectorAll('.g-seg').forEach(seg => {
        seg.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            setSeg(seg.dataset.bind, b.dataset.val);
        });
    });

    function openModal(guest = null) {
        state.editingId = guest ? guest.id : null;
        $('#guestModalTitle').textContent = guest ? 'Edit guest' : 'Add guest';
        $('#deleteGuestBtn').hidden = !guest;
        const g = guest ? { ...blankGuest(), ...guest } : blankGuest();
        $('#gfId').value          = g.id;
        $('#gfName').value        = g.name;
        $('#gfPhone').value       = g.phone;
        $('#gfEmail').value       = g.email;
        $('#gfRelation').value    = g.relation;
        setSeg('gfSide', g.side);
        setSeg('gfCategory', g.category);
        setSeg('gfRsvp', g.rsvp);
        setSeg('gfDietary', g.dietary);
        setSeg('gfTravelMode', g.travelMode);
        $('#gfPlusOnes').value     = g.plusOnes;
        $('#gfPlusOneNames').value = g.plusOneNames;
        $('#gfRsvpNotes').value    = g.rsvpNotes;
        $('#gfInvitationSent').checked = g.invitationSent;
        $('#gfCheckedIn').checked      = g.checkedIn;
        $('#gfGiftReceived').checked   = g.giftReceived;
        document.querySelectorAll('#gfEvents input[type="checkbox"]').forEach(cb => {
            cb.checked = g.events.includes(cb.value);
        });
        $('#gfStayNeeded').checked  = g.stayNeeded;
        $('#gfStayHotel').value     = g.stayHotel;
        $('#gfStayRoom').value      = g.stayRoom;
        $('#gfStayCheckIn').value   = g.stayCheckIn;
        $('#gfStayCheckOut').value  = g.stayCheckOut;
        $('#gfTravelArrival').value  = g.travelArrival;
        $('#gfTravelDeparture').value = g.travelDeparture;
        $('#gfPickupNeeded').checked = g.pickupNeeded;
        $('#gfPickupNotes').value    = g.pickupNotes;
        $('#gfAllergies').value      = g.allergies;
        $('#gfNotes').value          = g.notes;
        $('#gfTags').value           = (g.tags || []).join(', ');
        switchTab('personal');
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        setTimeout(() => $('#gfName').focus(), 80);
    }
    function closeModal() {
        modal.hidden = true;
        document.body.style.overflow = '';
        state.editingId = null;
    }
    modal.addEventListener('click', (e) => {
        if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeModal(); $('#importModal').hidden = true; $('#qrModal').hidden = true; document.body.style.overflow = ''; }
    });

    function switchTab(name) {
        document.querySelectorAll('.g-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        document.querySelectorAll('.g-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
    }
    document.querySelector('.g-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        switchTab(b.dataset.tab);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = $('#gfId').value || newId();
        const existing = state.editingId ? getAll().find(g => g.id === state.editingId) : null;
        const events = Array.from(document.querySelectorAll('#gfEvents input:checked')).map(c => c.value);
        const tags = $('#gfTags').value.split(',').map(t => t.trim()).filter(Boolean);
        const guest = {
            ...(existing || blankGuest()),
            id,
            name:            $('#gfName').value.trim(),
            phone:           $('#gfPhone').value.trim(),
            email:           $('#gfEmail').value.trim(),
            side:            $('#gfSide').value || 'bride',
            category:        $('#gfCategory').value || 'family',
            relation:        $('#gfRelation').value.trim(),
            rsvp:            $('#gfRsvp').value || 'pending',
            plusOnes:        parseInt($('#gfPlusOnes').value, 10) || 0,
            plusOneNames:    $('#gfPlusOneNames').value.trim(),
            rsvpNotes:       $('#gfRsvpNotes').value.trim(),
            events,
            dietary:         $('#gfDietary').value || 'veg',
            allergies:       $('#gfAllergies').value.trim(),
            stayNeeded:      $('#gfStayNeeded').checked,
            stayHotel:       $('#gfStayHotel').value.trim(),
            stayRoom:        $('#gfStayRoom').value.trim(),
            stayCheckIn:     $('#gfStayCheckIn').value,
            stayCheckOut:    $('#gfStayCheckOut').value,
            travelMode:      $('#gfTravelMode').value || '',
            travelArrival:   $('#gfTravelArrival').value.trim(),
            travelDeparture: $('#gfTravelDeparture').value.trim(),
            pickupNeeded:    $('#gfPickupNeeded').checked,
            pickupNotes:     $('#gfPickupNotes').value.trim(),
            tags,
            notes:           $('#gfNotes').value.trim(),
            invitationSent:  $('#gfInvitationSent').checked,
            invitationSentAt: $('#gfInvitationSent').checked ? (existing?.invitationSentAt || nowTs()) : 0,
            checkedIn:       $('#gfCheckedIn').checked,
            checkedInAt:     $('#gfCheckedIn').checked ? (existing?.checkedInAt || nowTs()) : 0,
            giftReceived:    $('#gfGiftReceived').checked,
            updatedAt:       nowTs()
        };
        if (!guest.name) {
            switchTab('personal');
            $('#gfName').focus();
            return showToast('Name is required');
        }
        upsert(guest);
        showToast(existing ? `Updated ${guest.name}` : `Added ${guest.name}`);
        closeModal();
    });

    $('#deleteGuestBtn').addEventListener('click', () => {
        const id = $('#gfId').value;
        const g = getAll().find(x => x.id === id);
        if (!g) return closeModal();
        const name = g.name;
        remove(id);
        closeModal();
        showToast(`Removed ${name}`, { duration: 6000, undo: () => upsert(g) });
    });

    /* =========================================================
       LIST EVENTS · click delegation
       ========================================================= */
    $('#guestList').addEventListener('click', (e) => {
        // Row checkbox
        const cb = e.target.closest('.g-row-check');
        if (cb) {
            const id = cb.dataset.id;
            if (cb.checked) state.selected.add(id); else state.selected.delete(id);
            renderBulkBar();
            cb.closest('[data-id]')?.classList.toggle('is-selected', cb.checked);
            return;
        }
        // Select all (table view)
        if (e.target.matches('#rowAll')) {
            const checked = e.target.checked;
            document.querySelectorAll('.g-row-check').forEach(c => {
                c.checked = checked;
                if (checked) state.selected.add(c.dataset.id); else state.selected.delete(c.dataset.id);
                c.closest('[data-id]')?.classList.toggle('is-selected', checked);
            });
            renderBulkBar();
            return;
        }
        // Action buttons
        const btn = e.target.closest('.g-act');
        if (!btn) return;
        const id = btn.dataset.id;
        const g  = getAll().find(x => x.id === id);
        if (!g) return;

        switch (btn.dataset.act) {
            case 'edit': openModal(g); break;
            case 'wa':   openWhatsApp(g); break;
            case 'rsvp': cycleRsvp(g); break;
            case 'qr':   openQR(g); break;
        }
    });

    function cycleRsvp(g) {
        const cycle = ['pending', 'confirmed', 'declined', 'maybe'];
        const next = cycle[(cycle.indexOf(g.rsvp) + 1) % cycle.length];
        upsert({ ...g, rsvp: next });
        showToast(`${g.name} → ${RSVP_LABEL[next]}`);
    }

    /* =========================================================
       BULK ACTIONS
       ========================================================= */
    $('#bulkBar').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-bulk]'); if (!b) return;
        const ids = Array.from(state.selected);
        const guests = getAll().filter(g => ids.includes(g.id));
        if (!guests.length && b.dataset.bulk !== 'clear') return showToast('Nothing selected');

        switch (b.dataset.bulk) {
            case 'invite-wa':
                bulkWhatsApp(guests);
                break;
            case 'mark-confirmed':
                guests.forEach(g => upsert({ ...g, rsvp: 'confirmed' }, false));
                sendNtfy({ kind: 'guest-clear', at: 0 }); // poke listeners (no-op safe)
                renderAll();
                showToast(`Marked ${guests.length} confirmed`);
                break;
            case 'mark-sent':
                guests.forEach(g => upsert({ ...g, invitationSent: true, invitationSentAt: g.invitationSentAt || nowTs() }, false));
                renderAll();
                showToast(`Marked ${guests.length} as invited`);
                break;
            case 'export':
                downloadCSV(toCSV(guests), 'sv-wedding-guests-selected');
                showToast(`Exported ${guests.length} rows`);
                break;
            case 'delete': {
                const snapshot = guests.slice();
                snapshot.forEach(g => remove(g.id, false));
                renderAll();
                state.selected.clear();
                renderBulkBar();
                showToast(`Deleted ${snapshot.length} guests`, {
                    duration: 8000,
                    undo: () => snapshot.forEach(g => upsert(g))
                });
                break;
            }
            case 'clear':
                state.selected.clear();
                renderBulkBar();
                renderAll();
                break;
        }
    });

    /* =========================================================
       WHATSAPP
       ========================================================= */
    function buildInviteMessage(g) {
        const eventsList = (g.events || []).map(e => EVENT_BY_ID[e]?.label).filter(Boolean).join(', ');
        const lines = [
            `नमस्कार ${g.name || ''} 🙏`,
            ``,
            `With the blessings of our families, you are warmly invited to the wedding of`,
            `*Shubham & Vaibhavi*`,
            ``,
            `📅 22 July 2026`,
            `📍 Samarth Lawns, Jalgaon, Maharashtra`,
            eventsList ? `🎉 Events: ${eventsList}` : '',
            ``,
            `View the full invitation, RSVP, stay & pickup details:`,
            `https://shubham-weds-vaibhavi-499797f2.surge.sh/`,
            ``,
            `Looking forward to celebrating with you! 💛`
        ].filter(Boolean);
        return lines.join('\n');
    }

    function openWhatsApp(g) {
        const phone = (g.phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');
        if (!phone) return showToast('No phone number on file');
        const msg = encodeURIComponent(buildInviteMessage(g));
        const url = `https://wa.me/${phone}?text=${msg}`;
        window.open(url, '_blank', 'noopener');
        // Mark as invited on send
        if (!g.invitationSent) upsert({ ...g, invitationSent: true, invitationSentAt: nowTs() }, false);
        renderAll();
    }

    function bulkWhatsApp(guests) {
        const ready = guests.filter(g => g.phone && g.phone.replace(/[^\d+]/g, '').length >= 8);
        if (!ready.length) return showToast('None of the selected guests have a phone number');
        // Browsers block opening many windows back-to-back. Stagger them.
        showToast(`Opening WhatsApp for ${ready.length} guests…`);
        ready.forEach((g, i) => {
            setTimeout(() => openWhatsApp(g), i * 700);
        });
    }

    /* =========================================================
       QR (per-guest check-in URL)
       ========================================================= */
    function openQR(g) {
        const url = `${location.origin}/guests.html#checkin=${encodeURIComponent(g.id)}`;
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&qzone=2&color=2e1418&bgcolor=fdf6e4&data=${encodeURIComponent(url)}`;
        $('#qrImage').src = qr;
        $('#qrImage').alt = `Check-in QR for ${g.name}`;
        $('#qrName').textContent = g.name || '—';
        $('#qrMeta').textContent = [SIDE_LABEL[g.side], g.relation, RSVP_LABEL[g.rsvp]].filter(Boolean).join(' · ');
        $('#qrDownloadBtn').onclick = () => {
            const a = document.createElement('a');
            a.href = qr; a.download = `qr-${g.name.replace(/\s+/g, '-')}.png`;
            document.body.appendChild(a); a.click(); a.remove();
        };
        $('#qrCopyBtn').onclick = () => {
            navigator.clipboard?.writeText(url).then(() => showToast('Check-in link copied'));
        };
        $('#qrModal').hidden = false;
        document.body.style.overflow = 'hidden';
    }
    $('#qrModal').addEventListener('click', (e) => {
        if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) {
            $('#qrModal').hidden = true; document.body.style.overflow = '';
        }
    });

    // Handle QR scan landing: ?#checkin=guestId → flip checkedIn to true
    function handleCheckinHash() {
        const m = location.hash.match(/checkin=([^&]+)/);
        if (!m) return;
        const id = decodeURIComponent(m[1]);
        const g = getAll().find(x => x.id === id);
        if (!g) return;
        if (!g.checkedIn) {
            upsert({ ...g, checkedIn: true, checkedInAt: nowTs() });
            showToast(`Checked in: ${g.name} ✓`, { duration: 6000 });
        } else {
            showToast(`${g.name} is already checked in`);
        }
        history.replaceState(null, '', location.pathname);
    }

    /* =========================================================
       CSV IMPORT / EXPORT
       ========================================================= */
    const CSV_COLS = [
        'id','name','phone','email','side','relation','category','rsvp','plusOnes','plusOneNames',
        'events','dietary','allergies','stayNeeded','stayHotel','stayRoom','stayCheckIn','stayCheckOut',
        'travelMode','travelArrival','travelDeparture','pickupNeeded','pickupNotes','tags','notes',
        'invitationSent','checkedIn','giftReceived'
    ];

    function toCSV(rows) {
        const header = CSV_COLS.join(',');
        const body = rows.map(g => CSV_COLS.map(c => csvEscape(formatField(g, c))).join(',')).join('\n');
        return header + '\n' + body;
    }
    function formatField(g, c) {
        const v = g[c];
        if (Array.isArray(v)) return v.join('|');
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (v === null || v === undefined) return '';
        return String(v);
    }
    function csvEscape(v) {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function downloadCSV(text, filename) {
        const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function parseCSV(text) {
        const rows = [];
        let i = 0, field = '', row = [], inQ = false;
        while (i < text.length) {
            const c = text[i];
            if (inQ) {
                if (c === '"' && text[i+1] === '"') { field += '"'; i += 2; continue; }
                if (c === '"') { inQ = false; i++; continue; }
                field += c; i++; continue;
            }
            if (c === '"') { inQ = true; i++; continue; }
            if (c === ',') { row.push(field); field = ''; i++; continue; }
            if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i+1] === '\n') i++;
                row.push(field); rows.push(row); row = []; field = ''; i++; continue;
            }
            field += c; i++;
        }
        if (field.length || row.length) { row.push(field); rows.push(row); }
        if (!rows.length) return [];
        const header = rows.shift().map(h => h.trim().replace(/^\ufeff/, ''));
        return rows
            .filter(r => r.some(c => (c || '').trim().length))
            .map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
    }

    function importRows(rows) {
        const status = $('#importStatus');
        status.hidden = false;
        if (!rows.length) { status.textContent = 'Nothing to import.'; return; }

        let added = 0, updated = 0, skipped = 0;
        const existing = getAll();
        const byId = new Map(existing.map(g => [g.id, g]));
        const byName = new Map(existing.map(g => [g.name.toLowerCase(), g]));

        rows.forEach(row => {
            if (!row.name || !row.name.trim()) { skipped++; return; }
            const partial = {
                ...row,
                events:        (row.events || '').split(/[|;,]/).map(s => s.trim()).filter(Boolean),
                tags:          (row.tags   || '').split(/[|;,]/).map(s => s.trim()).filter(Boolean),
                plusOnes:      parseInt(row.plusOnes, 10) || 0,
                stayNeeded:    /^(1|true|yes)$/i.test(row.stayNeeded || ''),
                pickupNeeded:  /^(1|true|yes)$/i.test(row.pickupNeeded || ''),
                invitationSent:/^(1|true|yes)$/i.test(row.invitationSent || ''),
                checkedIn:     /^(1|true|yes)$/i.test(row.checkedIn || ''),
                giftReceived:  /^(1|true|yes)$/i.test(row.giftReceived || '')
            };
            let target = (row.id && byId.get(row.id)) || byName.get((row.name || '').toLowerCase());
            if (target) { updated++; upsert({ ...target, ...partial, id: target.id }, false); }
            else        { added++;   upsert({ ...blankGuest(), ...partial }, false); }
        });

        renderAll();
        status.innerHTML = `<strong>${added}</strong> added · <strong>${updated}</strong> updated${skipped ? ` · ${skipped} skipped (missing name)` : ''}.`;
        status.classList.add('g-import-ok');
        showToast(`Imported ${added + updated} guests`);
    }

    /* Wire CSV UI */
    const csvDrop = $('#csvDrop');
    const csvFile = $('#csvFile');
    csvDrop.addEventListener('click', () => csvFile.click());
    csvDrop.addEventListener('dragover', (e) => { e.preventDefault(); csvDrop.classList.add('drag'); });
    csvDrop.addEventListener('dragleave', () => csvDrop.classList.remove('drag'));
    csvDrop.addEventListener('drop', (e) => {
        e.preventDefault(); csvDrop.classList.remove('drag');
        if (e.dataTransfer.files[0]) readCSVFile(e.dataTransfer.files[0]);
    });
    csvFile.addEventListener('change', (e) => {
        if (e.target.files[0]) readCSVFile(e.target.files[0]);
    });
    function readCSVFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => importRows(parseCSV(String(e.target.result || '')));
        reader.readAsText(file, 'utf-8');
    }
    $('#csvPasteBtn').addEventListener('click', () => {
        importRows(parseCSV($('#csvPaste').value));
    });

    /* =========================================================
       SEED DATA (demo)
       ========================================================= */
    const DEMO = [
        { name: 'Rajesh Patil',     side: 'bride', relation: 'Mama (maternal uncle)', category: 'family', phone: '+91 98765 43210', rsvp: 'confirmed', plusOnes: 3, plusOneNames: 'Wife + 2 kids', events: ['haldi','sangeet','wedding','reception'], dietary: 'veg', stayNeeded: true, stayHotel: 'Hotel Tapi Inn', stayRoom: '204', stayCheckIn: '2026-07-21', stayCheckOut: '2026-07-23', travelMode: 'train', travelArrival: '21 Jul · 14:20 · Jalgaon Jn', pickupNeeded: true, pickupNotes: 'Sedan, 4 bags, 14:30 platform 2', invitationSent: true, tags: ['VIP','close-family'] },
        { name: 'Aaji (Grandma)',   side: 'bride', relation: 'Grandmother', category: 'family', phone: '+91 99887 76655', rsvp: 'confirmed', plusOnes: 0, events: ['haldi','sangeet','wedding','reception'], dietary: 'jain', stayNeeded: true, stayHotel: 'Hotel Tapi Inn', stayRoom: '102', pickupNeeded: true, pickupNotes: 'Wheelchair access, gentle driving', invitationSent: true, tags: ['priority'] },
        { name: 'Ananya Joshi',     side: 'bride', relation: 'Best friend', category: 'friend', phone: '+91 90000 11122', rsvp: 'confirmed', plusOnes: 1, plusOneNames: 'Spouse', events: ['mehndi','sangeet','wedding'], dietary: 'eggetarian', invitationSent: true, notes: 'Bringing the surprise dance crew 💃', tags: ['bridesmaid'] },
        { name: 'Vikram Bhosale',   side: 'groom', relation: 'Father',     category: 'family', phone: '+91 98765 11111', rsvp: 'confirmed', plusOnes: 1, plusOneNames: 'Mother',       events: ['sakharpuda','haldi','sangeet','wedding','reception'], dietary: 'non-veg', invitationSent: true, tags: ['parents'] },
        { name: 'Rohan Deshmukh',   side: 'groom', relation: 'Cousin',     category: 'family', phone: '+91 91234 56789', rsvp: 'pending',   events: ['sangeet','wedding','reception'], dietary: 'non-veg', invitationSent: true },
        { name: 'Priya Kulkarni',   side: 'groom', relation: 'Cousin',     category: 'family', phone: '+91 88990 33445', rsvp: 'confirmed', plusOnes: 2, plusOneNames: 'Husband + son', events: ['haldi','mehndi','sangeet','wedding','reception'], dietary: 'veg', stayNeeded: true, travelMode: 'flight', travelArrival: '21 Jul · 18:40 · Indore Airport', pickupNeeded: true, pickupNotes: 'Need airport pickup, Innova', invitationSent: true, tags: ['needs-pickup'] },
        { name: 'Office Team (HCL)',side: 'groom', relation: 'Workmates',  category: 'colleague', phone: '+91 70000 12345', rsvp: 'maybe',    plusOnes: 5, plusOneNames: 'Team of 6 from Pune', events: ['reception'], dietary: 'non-veg', invitationSent: false, notes: 'Will confirm by 10 July' },
        { name: 'Suresh Kaka',      side: 'bride', relation: 'Uncle (Kaka)',category: 'family', phone: '+91 98989 67676', rsvp: 'declined', events: [], invitationSent: true, rsvpNotes: 'Surgery scheduled that week — sending blessings' },
        { name: 'Megha & Anil',     side: 'groom', relation: 'Family friends', category: 'friend', phone: '+91 95555 22211', rsvp: 'confirmed', plusOnes: 1, events: ['wedding','reception'], dietary: 'veg', invitationSent: true, giftReceived: true },
        { name: 'Pandit Joshi guruji', side: 'both', relation: 'Officiant', category: 'other', phone: '+91 98765 99887', rsvp: 'confirmed', events: ['sakharpuda','haldi','wedding'], dietary: 'jain', stayNeeded: true, stayHotel: 'Samarth Lawns Cottage', stayRoom: 'Cottage A', invitationSent: true, tags: ['vendor','officiant'] },
        { name: 'Neighbors (Apte family)', side: 'bride', relation: 'Neighbors', category: 'neighbor', phone: '+91 90909 80808', rsvp: 'confirmed', plusOnes: 3, plusOneNames: '4 in total', events: ['sangeet','wedding','reception'], dietary: 'veg', invitationSent: true },
        { name: 'College Gang',     side: 'groom', relation: 'IIT batchmates', category: 'friend', phone: '+91 99999 88888', rsvp: 'pending',   plusOnes: 8, plusOneNames: 'Approx 8 folks', events: ['sangeet','wedding','reception'], dietary: 'non-veg', invitationSent: true, notes: 'Group booking at Hotel Tapi Inn pending', tags: ['follow-up'] }
    ];

    function seedDemo() {
        if (getAll().length) {
            if (!confirm('You already have guests. Add demo data on top?')) return;
        }
        DEMO.forEach(d => upsert({ ...blankGuest(), ...d, id: newId() }, false));
        renderAll();
        showToast(`Added ${DEMO.length} demo guests`);
    }

    /* =========================================================
       TOAST (lightweight, with optional undo)
       ========================================================= */
    const toast    = $('#toast');
    const toastMsg = $('#toastMsg');
    let toastT, toastUndoBtn;
    function showToast(msg, opts = {}) {
        toastMsg.textContent = msg;
        toast.classList.add('show');
        if (toastUndoBtn) { toastUndoBtn.remove(); toastUndoBtn = null; }
        if (opts.undo) {
            toastUndoBtn = document.createElement('button');
            toastUndoBtn.className = 'toast-undo';
            toastUndoBtn.textContent = 'Undo';
            toastUndoBtn.addEventListener('click', () => {
                opts.undo();
                toast.classList.remove('show');
                toastUndoBtn.remove(); toastUndoBtn = null;
                clearTimeout(toastT);
            });
            toast.appendChild(toastUndoBtn);
        }
        clearTimeout(toastT);
        toastT = setTimeout(() => {
            toast.classList.remove('show');
            if (toastUndoBtn) { toastUndoBtn.remove(); toastUndoBtn = null; }
        }, opts.duration || 3000);
    }

    /* =========================================================
       UTIL
       ========================================================= */
    function $(s) { return document.querySelector(s); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
    function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

    /* =========================================================
       INIT
       ========================================================= */
    function init() {
        // Filters → state
        $('#searchInput').addEventListener('input', (e) => {
            state.filters.search = e.target.value;
            $('#searchClear').hidden = !e.target.value;
            renderAll();
        });
        $('#searchClear').addEventListener('click', () => {
            $('#searchInput').value = '';
            state.filters.search = '';
            $('#searchClear').hidden = true;
            renderAll();
        });
        $('#filterSide').addEventListener('change', (e) => { state.filters.side = e.target.value; renderAll(); });
        $('#filterRsvp').addEventListener('change', (e) => { state.filters.rsvp = e.target.value; renderAll(); });
        $('#filterEvent').addEventListener('change', (e) => { state.filters.event = e.target.value; renderAll(); });
        $('#filterFlag').addEventListener('change', (e) => { state.filters.flag = e.target.value; renderAll(); });
        $('#sortBy').addEventListener('change',     (e) => { state.filters.sort = e.target.value; renderAll(); });

        // Populate event filter
        const fEv = $('#filterEvent');
        EVENTS.forEach(ev => {
            const o = document.createElement('option');
            o.value = ev.id; o.textContent = `${ev.icon} ${ev.label}`;
            fEv.appendChild(o);
        });

        // Top-level buttons
        $('#addGuestBtn').addEventListener('click', () => openModal());
        $('#emptyAddBtn').addEventListener('click', () => openModal());
        $('#seedBtn').addEventListener('click', seedDemo);
        $('#emptySeedBtn').addEventListener('click', seedDemo);
        $('#exportBtn').addEventListener('click', () => {
            const all = getAll();
            if (!all.length) return showToast('No guests to export yet');
            downloadCSV(toCSV(all), 'sv-wedding-guests-all');
            showToast(`Exported ${all.length} guests`);
        });
        $('#importBtn').addEventListener('click', () => {
            $('#importModal').hidden = false;
            document.body.style.overflow = 'hidden';
        });
        $('#importModal').addEventListener('click', (e) => {
            if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) {
                $('#importModal').hidden = true; document.body.style.overflow = '';
            }
        });

        // View toggle
        document.querySelectorAll('.g-view-toggle button').forEach(b => {
            b.addEventListener('click', () => {
                state.view = b.dataset.view;
                localStorage.setItem(LS_VIEW, state.view);
                document.querySelectorAll('.g-view-toggle button').forEach(x => x.classList.toggle('active', x === b));
                renderAll();
            });
        });
        // Restore view
        document.querySelectorAll('.g-view-toggle button').forEach(x => x.classList.toggle('active', x.dataset.view === state.view));

        // Cross-device sync
        subscribeNtfy();

        // Render
        renderAll();
        handleCheckinHash();

        // Friendly hint when list is empty
        if (!getAll().length) showToast('Tip · Tap "Load demo data" to see this in action');
    }
})();
