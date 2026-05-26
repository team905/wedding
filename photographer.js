(() => {
    'use strict';

    const PASSPHRASE = 'shutterbug';
    const AUTH_KEY   = 'sv_photog_authed_v1';
    const NAME_KEY   = 'sv_photog_name_v1';

    const lockScreen = document.getElementById('lockScreen');
    const lockForm   = document.getElementById('lockForm');
    const lockInput  = document.getElementById('lockInput');
    const nameInput  = document.getElementById('photographerName');
    const adminShell = document.getElementById('adminShell');

    let photographerName = sessionStorage.getItem(NAME_KEY) || '';

    const unlock = (name) => {
        photographerName = name;
        sessionStorage.setItem(NAME_KEY, name);
        sessionStorage.setItem(AUTH_KEY, '1');
        lockScreen.style.display = 'none';
        adminShell.hidden = false;
        document.getElementById('currentName').textContent = name;
        setTimeout(initDashboard, 50);
    };

    if (sessionStorage.getItem(AUTH_KEY) === '1' && photographerName) {
        unlock(photographerName);
    }

    lockForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (lockInput.value.trim() === PASSPHRASE && name.length >= 2) {
            unlock(name);
        } else {
            [lockInput, nameInput].forEach(el => {
                el.style.animation = 'shake 0.4s ease';
                setTimeout(() => el.style.animation = '', 500);
            });
            lockInput.value = '';
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(NAME_KEY);
        location.reload();
    });

    // Toast
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    let toastTimer = null;
    function showToast(msg) {
        if (!toast) return;
        toastMsg.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
    }

    function initDashboard() {
        const dropZone     = document.getElementById('dropZone');
        const fileInput    = document.getElementById('fileInput');
        const cameraInput  = document.getElementById('cameraInput');
        const captionInput = document.getElementById('captionInput');
        const uploadQueue  = document.getElementById('uploadQueue');
        const mediaGrid    = document.getElementById('mediaGrid');
        const photoCount   = document.getElementById('photoCount');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
        cameraInput.addEventListener('change', (e) => handleFiles(e.target.files));

        async function handleFiles(fileList) {
            if (!fileList || !fileList.length) return;
            const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
            if (!files.length) { showToast('No image files selected'); return; }

            const caption = captionInput.value.trim();
            const total = files.length;

            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const queueItem = renderQueueItem(f.name, i, total);
                uploadQueue.prepend(queueItem);
                try {
                    queueItem.classList.add('processing');
                    await window.WeddingRealtime.addPhoto(f, {
                        caption,
                        photographer: photographerName
                    });
                    queueItem.classList.remove('processing');
                    queueItem.classList.add('done');
                    setTimeout(() => queueItem.remove(), 1800);
                } catch (err) {
                    console.error(err);
                    queueItem.classList.add('failed');
                    queueItem.querySelector('.qi-status').textContent = 'Failed';
                }
            }
            if (navigator.vibrate) navigator.vibrate(25);
            showToast(`${total} photo${total > 1 ? 's' : ''} published`);
            fileInput.value = ''; cameraInput.value = '';
        }

        function renderQueueItem(name, i, total) {
            const el = document.createElement('div');
            el.className = 'queue-item';
            el.innerHTML = `
                <span class="qi-spin"></span>
                <span class="qi-name">${escapeHtml(name)}</span>
                <span class="qi-status">${i + 1}/${total} · Compressing…</span>`;
            return el;
        }

        // Photo grid render
        const fmtTime = (t) => {
            const d = new Date(t);
            const diff = (Date.now() - t) / 1000;
            if (diff < 60) return 'just now';
            if (diff < 3600) return Math.floor(diff/60) + ' min ago';
            return d.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
        };

        const renderGrid = (list) => {
            photoCount.textContent = list.length;
            if (!list.length) {
                mediaGrid.innerHTML = '<p class="feed-empty">No photos yet — drop your first shot above.</p>';
                return;
            }
            mediaGrid.innerHTML = list.map(p => `
                <figure class="media-tile">
                    <div class="media-thumb">
                        <img src="${p.thumb}" alt="${escapeHtml(p.caption || 'wedding photo')}" loading="lazy">
                    </div>
                    <figcaption>
                        <strong>${escapeHtml(p.photographer || 'Crew')}</strong>
                        <span>${fmtTime(p.timestamp)}</span>
                        ${p.caption ? `<p>${escapeHtml(p.caption)}</p>` : ''}
                    </figcaption>
                    <div class="media-tile-actions">
                        <button class="tile-act" data-id="${p.id}" data-act="dl" title="Download original">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
                        </button>
                        <button class="tile-act danger" data-id="${p.id}" data-act="rm" title="Remove">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                </figure>
            `).join('');
        };

        mediaGrid.addEventListener('click', async (e) => {
            const btn = e.target.closest('.tile-act');
            if (!btn) return;
            const id = btn.dataset.id;
            const act = btn.dataset.act;
            if (act === 'rm') {
                if (confirm('Remove this photo for everyone?')) {
                    await window.WeddingRealtime.deletePhoto(id);
                    showToast('Photo removed');
                }
            } else if (act === 'dl') {
                const full = await window.WeddingRealtime.getPhotoFull(id);
                if (!full) { showToast('Photo not available'); return; }
                const name = full.fileName || `sv-photo-${id}.jpg`;
                if (full.full && full.full.startsWith('data:')) {
                    const a = document.createElement('a');
                    a.href = full.full;
                    a.download = name;
                    document.body.appendChild(a); a.click(); a.remove();
                } else if (full.full) {
                    try {
                        const r = await fetch(full.full);
                        const blob = await r.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = name;
                        document.body.appendChild(a); a.click(); a.remove();
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                    } catch (_) {
                        window.open(full.full, '_blank');
                    }
                }
                showToast('Downloaded');
            }
        });

        document.getElementById('clearAllPhotosBtn').addEventListener('click', async () => {
            if (confirm('Clear ALL photos? This removes them for every guest too.')) {
                await window.WeddingRealtime.clearPhotos();
                showToast('All photos cleared');
            }
        });

        window.WeddingRealtime.onPhotos(renderGrid);
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
        }[c]));
    }
})();
