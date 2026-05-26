(() => {
    'use strict';

    // ===== LOADER =====
    const loader = document.getElementById('loader');
    const hideLoader = () => loader.classList.add('hidden');
    window.addEventListener('load', () => setTimeout(hideLoader, 1200));
    setTimeout(hideLoader, 2500);

    // ===== TOP BAR =====
    const topBar = document.getElementById('topBar');
    window.addEventListener('scroll', () => {
        topBar.classList.toggle('visible', window.scrollY > 100);
    }, { passive: true });

    // ===== MENU =====
    const menuBtn = document.getElementById('menuBtn');
    const fullMenu = document.getElementById('fullMenu');

    menuBtn.addEventListener('click', () => {
        menuBtn.classList.toggle('active');
        fullMenu.classList.toggle('open');
        document.body.style.overflow = fullMenu.classList.contains('open') ? 'hidden' : '';
    });

    document.querySelectorAll('.menu-link').forEach(link => {
        link.addEventListener('click', () => {
            menuBtn.classList.remove('active');
            fullMenu.classList.remove('open');
            document.body.style.overflow = '';
        });
    });

    // ===== SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = window.innerWidth < 768 ? 0 : 80;
                window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
            }
        });
    });

    // ===== COUNTDOWN =====
    const weddingDate = new Date('2026-07-22T12:30:00+05:30').getTime();

    function updateCountdown() {
        const diff = weddingDate - Date.now();
        if (diff <= 0) return;

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        setText('cd-days', d);
        setText('cd-hours', String(h).padStart(2, '0'));
        setText('cd-mins', String(m).padStart(2, '0'));
        setText('cd-secs', String(s).padStart(2, '0'));
    }

    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);

    // ===== SCROLL ANIMATIONS =====
    const animElements = document.querySelectorAll('.anim-up');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
        animElements.forEach(el => observer.observe(el));
    } else {
        animElements.forEach(el => el.classList.add('visible'));
    }

    // ===== BOTTOM NAV =====
    const bottomLinks = document.querySelectorAll('.bottom-nav-item');
    const sections = document.querySelectorAll('section[id]');
    const navMap = { 'home': 'home', 'couple': 'home', 'events': 'events', 'venue': 'events', 'gallery': 'gallery', 'party': 'gallery', 'details': 'details', 'blessings': 'details', 'rsvp': 'rsvp' };

    window.addEventListener('scroll', () => {
        const scrollPos = window.scrollY + window.innerHeight / 3;
        let current = 'home';
        sections.forEach(s => { if (scrollPos >= s.offsetTop) current = s.id; });
        const active = navMap[current] || 'home';
        bottomLinks.forEach(link => link.classList.toggle('active', link.dataset.section === active));
    }, { passive: true });

    // ===== TABS =====
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${btn.dataset.tab}`));
        });
    });

    // ===== STATS COUNTER ANIMATION =====
    const statNums = document.querySelectorAll('.stat-num');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    statNums.forEach(el => statsObserver.observe(el));

    function animateCounter(el) {
        const target = parseInt(el.dataset.target);
        const duration = 2000;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            el.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ===== CAROUSEL (Swipeable) =====
    const carousel = document.getElementById('galleryCarousel');
    if (carousel) {
        const track = carousel.querySelector('.carousel-track');
        const slides = track.querySelectorAll('.carousel-slide');
        const dotsContainer = document.getElementById('carouselDots');
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        let currentSlide = 0;
        let startX = 0;
        let isDragging = false;
        let dragOffset = 0;

        // Build dots
        slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.classList.add('carousel-dot');
            if (i === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(i));
            dotsContainer.appendChild(dot);
        });

        function goToSlide(index) {
            currentSlide = Math.max(0, Math.min(index, slides.length - 1));
            track.style.transform = `translateX(-${currentSlide * 100}%)`;
            dotsContainer.querySelectorAll('.carousel-dot').forEach((d, i) => {
                d.classList.toggle('active', i === currentSlide);
            });
        }

        // Touch events
        track.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            track.style.transition = 'none';
        }, { passive: true });

        track.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            dragOffset = e.touches[0].clientX - startX;
            const offset = -currentSlide * 100 + (dragOffset / carousel.offsetWidth) * 100;
            track.style.transform = `translateX(${offset}%)`;
        }, { passive: true });

        track.addEventListener('touchend', () => {
            isDragging = false;
            track.style.transition = '';
            if (Math.abs(dragOffset) > 50) {
                if (dragOffset < 0) goToSlide(currentSlide + 1);
                else goToSlide(currentSlide - 1);
            } else {
                goToSlide(currentSlide);
            }
            dragOffset = 0;
        });

        // Arrow buttons
        prevBtn.addEventListener('click', () => goToSlide(currentSlide - 1));
        nextBtn.addEventListener('click', () => goToSlide(currentSlide + 1));

        // Auto-advance
        let autoplay = setInterval(() => goToSlide((currentSlide + 1) % slides.length), 5000);
        carousel.addEventListener('touchstart', () => clearInterval(autoplay));
        carousel.addEventListener('mouseenter', () => clearInterval(autoplay));
        carousel.addEventListener('mouseleave', () => {
            autoplay = setInterval(() => goToSlide((currentSlide + 1) % slides.length), 5000);
        });
    }

    // ===== SAVE TO CALENDAR =====
    document.getElementById('saveCalBtn').addEventListener('click', () => {
        // 22 July 2026, 12:30 PM IST → 07:00 UTC; end 17:00 IST → 11:30 UTC
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Wedding//EN',
            'BEGIN:VEVENT',
            'DTSTART:20260722T070000Z',
            'DTEND:20260722T113000Z',
            'SUMMARY:Shubham & Vaibhavi Wedding',
            'DESCRIPTION:Lagna Vidhi - Maharashtrian Wedding Ceremony',
            'LOCATION:Samarth Lawns\\, Mahabal Road\\, Jalgaon\\, Maharashtra 425001',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'shubham-vaibhavi-wedding.ics';
        link.click();
        URL.revokeObjectURL(url);

        showToast('Event saved to calendar!');
    });

    // ===== SHARE INVITATION =====
    document.getElementById('shareBtn').addEventListener('click', async () => {
        const shareData = {
            title: 'Shubham & Vaibhavi Wedding',
            text: 'You\'re invited to the wedding of Shubham & Vaibhavi on 22 July 2026 at Samarth Lawns, Jalgaon. We\'d love to celebrate with you!',
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                showToast('Invitation shared!');
            } catch (err) {
                if (err.name !== 'AbortError') copyToClipboard();
            }
        } else {
            copyToClipboard();
        }
    });

    function copyToClipboard() {
        const text = `You're invited! Shubham & Vaibhavi's Wedding — 22 July 2026, Samarth Lawns, Jalgaon. ${window.location.href}`;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Link copied to clipboard!');
        }).catch(() => {
            showToast('Share link: ' + window.location.href);
        });
    }

    // ===== TOAST NOTIFICATION =====
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    let toastTimer;

    function showToast(msg) {
        toastMsg.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
        if (navigator.vibrate) navigator.vibrate(30);
    }

    // ===== BLESSINGS WALL =====
    const blessingForm = document.getElementById('blessingForm');
    const blessingsFeed = document.getElementById('blessingsFeed');

    blessingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('bless-name').value.trim();
        const msg = document.getElementById('bless-msg').value.trim();

        if (!name || !msg) return;

        const card = document.createElement('div');
        card.classList.add('blessing-card');
        card.innerHTML = `
            <div class="blessing-avatar">${name.charAt(0).toUpperCase()}</div>
            <div class="blessing-body">
                <strong>${escapeHtml(name)}</strong>
                <p>${escapeHtml(msg)}</p>
                <span class="blessing-time">Just now</span>
            </div>
        `;

        blessingsFeed.insertBefore(card, blessingsFeed.firstChild);
        blessingForm.reset();
        showToast('Blessing sent! 🙏');
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    });

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== RSVP FORM =====
    const rsvpForm = document.getElementById('rsvpForm');
    const rsvpSuccess = document.getElementById('rsvpSuccess');
    const submitBtn = document.getElementById('submitBtn');

    rsvpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = rsvpForm.querySelector('[name="name"]').value.trim();
        const email = rsvpForm.querySelector('[name="email"]').value.trim();
        const attending = rsvpForm.querySelector('[name="attending"]:checked');

        if (!name || !email || !attending) {
            submitBtn.style.animation = 'shake 0.4s ease';
            setTimeout(() => submitBtn.style.animation = '', 400);
            return;
        }

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        setTimeout(() => {
            rsvpForm.style.display = 'none';
            rsvpSuccess.classList.add('show');
            showToast('Attendance confirmed! See you there 🎉');
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        }, 1500);
    });

    // ===== HERO PARALLAX (Desktop) =====
    if (window.innerWidth >= 768) {
        const heroBg = document.querySelector('.hero-bg-img');
        window.addEventListener('scroll', () => {
            const y = window.scrollY;
            if (y < window.innerHeight && heroBg) {
                heroBg.style.transform = `scale(1.05) translateY(${y * 0.15}px)`;
            }
        }, { passive: true });
    }

    // ===== IMAGE LAZY LOAD FADE-IN =====
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.6s ease';
        if (img.complete) { img.style.opacity = '1'; }
        else { img.addEventListener('load', () => img.style.opacity = '1'); }
    });

    // ===== PREVENT OVERSCROLL WHEN MENU OPEN =====
    document.body.addEventListener('touchmove', (e) => {
        if (fullMenu.classList.contains('open')) e.preventDefault();
    }, { passive: false });

    // ===== SHAKE ANIMATION =====
    const shakeStyle = document.createElement('style');
    shakeStyle.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
        }
    `;
    document.head.appendChild(shakeStyle);

    /* =========================================================
       3D CARD TILT
       ========================================================= */
    const tiltSelectors = [
        '.tilt-card',
        '.event-card',
        '.story-card',
        '.info-card',
        '.party-member',
        '.timeline-content',
        '.venue-info-card'
    ].join(',');

    const isCoarse = window.matchMedia('(pointer: coarse)').matches;

    document.querySelectorAll(tiltSelectors).forEach(card => {
        let raf = null;

        const handleMove = (e) => {
            const rect = card.getBoundingClientRect();
            const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            const px = (cx / rect.width) - 0.5;
            const py = (cy / rect.height) - 0.5;
            const maxRot = isCoarse ? 4 : 8;
            const rx = -py * maxRot;
            const ry = px * maxRot;

            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
                card.style.setProperty('--tilt-x', (cx / rect.width * 100) + '%');
                card.style.setProperty('--tilt-y', (cy / rect.height * 100) + '%');
            });
        };

        const reset = () => {
            card.classList.remove('tilting');
            card.style.transform = '';
        };

        card.addEventListener('mouseenter', () => card.classList.add('tilting'));
        card.addEventListener('mousemove', handleMove);
        card.addEventListener('mouseleave', reset);
        if (isCoarse) {
            card.addEventListener('touchstart', () => card.classList.add('tilting'), { passive: true });
            card.addEventListener('touchmove', handleMove, { passive: true });
            card.addEventListener('touchend', reset);
        }
    });

    /* =========================================================
       EVENT DATA + ICS HELPERS
       ========================================================= */
    const VENUE = {
        name: 'Samarth Lawns',
        address: 'Samarth Lawns, Mahabal Road, Near Mehrun Lake, Jalgaon, Maharashtra 425001',
        lat: 21.0077,
        lng: 75.5626,
        googleQ: 'Samarth+Lawns+Mahabal+Road+Jalgaon'
    };

    const EVENTS = {
        engagement: {
            title: 'Engagement (Sakharpuda) — Shubham & Vaibhavi',
            start: '20260721T103000Z', // 4:00 PM IST = 10:30 UTC
            end:   '20260721T133000Z',
            desc:  'Engagement (Sakharpuda) at Samarth Lawns, Jalgaon. Festive Indian attire.'
        },
        haldi: {
            title: 'Haldi — Shubham & Vaibhavi',
            start: '20260721T130000Z', // 6:30 PM IST
            end:   '20260721T160000Z',
            desc:  'Haldi ceremony at Samarth Lawns, Jalgaon. Wear yellow.'
        },
        sangeet: {
            title: 'Sangeet — Shubham & Vaibhavi',
            start: '20260721T153000Z', // 9:00 PM IST
            end:   '20260721T193000Z',
            desc:  'Sangeet night at Samarth Lawns, Jalgaon. Cocktail / Indo-Western.'
        },
        wedding: {
            title: 'Wedding (Lagna Vidhi) — Shubham & Vaibhavi',
            start: '20260722T070000Z', // 12:30 PM IST
            end:   '20260722T103000Z',
            desc:  'Wedding ceremony at Samarth Lawns Main Mandap, Jalgaon. Traditional Maharashtrian.'
        },
        all: {
            title: 'Shubham & Vaibhavi Wedding',
            start: '20260721T103000Z',
            end:   '20260722T103000Z',
            desc:  'Two days of celebrations at Samarth Lawns, Jalgaon.'
        }
    };

    const buildICS = (key) => {
        const ev = EVENTS[key] || EVENTS.all;
        const uid = `${key}-shubham-vaibhavi-2026@sv.wedding`;
        return [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Shubham-Vaibhavi//Wedding//EN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
            `DTSTART:${ev.start}`,
            `DTEND:${ev.end}`,
            `SUMMARY:${ev.title}`,
            `DESCRIPTION:${ev.desc}`,
            `LOCATION:${VENUE.address}`,
            `GEO:${VENUE.lat};${VENUE.lng}`,
            'STATUS:CONFIRMED',
            'BEGIN:VALARM',
            'TRIGGER:-PT24H',
            'ACTION:DISPLAY',
            `DESCRIPTION:Reminder — ${ev.title}`,
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');
    };

    const downloadICS = (key) => {
        const blob = new Blob([buildICS(key)], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${key}-shubham-vaibhavi.ics`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        if (typeof showToast === 'function') showToast('Calendar event downloaded');
    };

    // Per-event Add to Calendar
    document.querySelectorAll('[data-event-cal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const k = btn.getAttribute('data-event-cal');
            downloadICS(k);
            if (navigator.vibrate) navigator.vibrate(15);
        });
    });

    // Per-event Get Directions
    const openDirections = () => {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const url = isIOS
            ? `maps://?q=${encodeURIComponent(VENUE.name)}&ll=${VENUE.lat},${VENUE.lng}`
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(VENUE.address)}`;
        window.open(url, '_blank');
    };
    document.querySelectorAll('[data-event-dir]').forEach(btn => {
        btn.addEventListener('click', () => {
            openDirections();
            if (navigator.vibrate) navigator.vibrate(15);
        });
    });

    /* =========================================================
       SAVE LOCATION (vCard)
       ========================================================= */
    const saveLocBtn = document.getElementById('saveLocationBtn');
    if (saveLocBtn) {
        saveLocBtn.addEventListener('click', () => {
            const vcard = [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `FN:${VENUE.name} (S&V Wedding Venue)`,
                `ADR;TYPE=WORK:;;${VENUE.address}`,
                `GEO:${VENUE.lat};${VENUE.lng}`,
                'TEL;TYPE=WORK,VOICE:+919922012345',
                `URL:https://www.google.com/maps/?q=${VENUE.googleQ}`,
                'NOTE:Wedding venue for Shubham & Vaibhavi — 22 July 2026',
                'END:VCARD'
            ].join('\r\n');
            const blob = new Blob([vcard], { type: 'text/vcard' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'samarth-lawns-jalgaon.vcf';
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            if (typeof showToast === 'function') showToast('Location saved to contacts');
            if (navigator.vibrate) navigator.vibrate(20);
        });
    }

    /* =========================================================
       CONCIERGE TABS
       ========================================================= */
    document.querySelectorAll('.ctab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const k = btn.getAttribute('data-ctab');
            document.querySelectorAll('.ctab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.ctab-panel').forEach(p => {
                p.classList.toggle('active', p.id === `ctab-${k}`);
            });
            if (navigator.vibrate) navigator.vibrate(8);
        });
    });

    /* =========================================================
       STAY ALLOCATION LOOKUP
       ========================================================= */
    const STAYS = {
        'rajesh patil':    { hotel: 'Hotel Royal Palace',  room: '204', checkin: '20 Jul 2026', checkout: '23 Jul 2026', notes: 'Premium Deluxe · Lake-view' },
        'sunita patil':    { hotel: 'Hotel Royal Palace',  room: '204', checkin: '20 Jul 2026', checkout: '23 Jul 2026', notes: 'Premium Deluxe · Lake-view' },
        'ananya deshpande':{ hotel: 'Hotel Sai Plaza',     room: '312', checkin: '21 Jul 2026', checkout: '23 Jul 2026', notes: 'Twin sharing' },
        'kiran kulkarni':  { hotel: 'The President Park',  room: '105', checkin: '20 Jul 2026', checkout: '23 Jul 2026', notes: 'Family suite' },
        'rohan sharma':    { hotel: 'Hotel Royal Palace',  room: '210', checkin: '20 Jul 2026', checkout: '23 Jul 2026', notes: 'Groom\'s Best Man · King room' },
        'vikram mehta':    { hotel: 'Hotel Royal Palace',  room: '211', checkin: '21 Jul 2026', checkout: '23 Jul 2026', notes: 'Groomsman · Deluxe' },
        'arjun patel':     { hotel: 'Hotel Royal Palace',  room: '212', checkin: '21 Jul 2026', checkout: '23 Jul 2026', notes: 'Groomsman · Deluxe' },
        'priya kapoor':    { hotel: 'Hotel Sai Plaza',     room: '301', checkin: '20 Jul 2026', checkout: '23 Jul 2026', notes: 'Maid of Honor · Suite' },
        'nisha reddy':     { hotel: 'Hotel Sai Plaza',     room: '302', checkin: '21 Jul 2026', checkout: '23 Jul 2026', notes: 'Bridesmaid · Deluxe' },
        'sneha gupta':     { hotel: 'Hotel Sai Plaza',     room: '303', checkin: '21 Jul 2026', checkout: '23 Jul 2026', notes: 'Bridesmaid · Deluxe' },
        'demo guest':      { hotel: 'Hotel Royal Palace',  room: '108', checkin: '20 Jul 2026', checkout: '23 Jul 2026', notes: 'Standard · Twin sharing (demo entry)' }
    };

    const HOTELS = {
        'Hotel Royal Palace': { addr: 'Hotel Royal Palace, Station Road, Jalgaon 425001', phone: '+912572220500' },
        'Hotel Sai Plaza':    { addr: 'Hotel Sai Plaza, Mahabal Road, Jalgaon 425001',    phone: '+912572221122' },
        'The President Park': { addr: 'The President Park, Ring Road, Jalgaon 425001',    phone: '+912572233344' }
    };

    const stayInput = document.getElementById('stayLookupInput');
    const stayBtn = document.getElementById('stayLookupBtn');
    const stayResult = document.getElementById('stayResult');

    const renderStay = (q) => {
        if (!stayResult) return;
        stayResult.hidden = false;
        stayResult.className = 'stay-result';
        const key = q.trim().toLowerCase();
        const data = STAYS[key];
        if (data) {
            const hotelInfo = HOTELS[data.hotel] || {};
            stayResult.classList.add('success');
            stayResult.innerHTML = `
                <h4>Welcome, ${q.split(' ').map(w => w[0].toUpperCase()+w.slice(1)).join(' ')} 🌸</h4>
                <div class="stay-row"><span>Hotel</span><span>${data.hotel}</span></div>
                <div class="stay-row"><span>Room</span><span>${data.room}</span></div>
                <div class="stay-row"><span>Check-in</span><span>${data.checkin}</span></div>
                <div class="stay-row"><span>Check-out</span><span>${data.checkout}</span></div>
                <div class="stay-row"><span>Notes</span><span>${data.notes}</span></div>
                <div class="stay-result-actions">
                    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelInfo.addr || data.hotel)}" target="_blank" rel="noopener" class="primary">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        Hotel Directions
                    </a>
                    <a href="tel:${hotelInfo.phone || ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5a2 2 0 012-2h2.7a1 1 0 011 .76l1 4a1 1 0 01-.27 1L8 10.3a14 14 0 005.7 5.7l1.6-1.4a1 1 0 011-.27l4 1a1 1 0 01.76 1V19a2 2 0 01-2 2C9 21 3 15 3 5z"/></svg>
                        Call Hotel
                    </a>
                </div>`;
        } else {
            stayResult.classList.add('fail');
            stayResult.innerHTML = `
                <h4>Hmm, we couldn't find that name</h4>
                <p style="font-size:0.85rem;color:var(--c-text-secondary);line-height:1.6;">Double-check the spelling, or chat with our hospitality team on WhatsApp — they'll sort it out in a minute.</p>`;
        }
    };

    if (stayBtn && stayInput) {
        stayBtn.addEventListener('click', () => {
            if (!stayInput.value.trim()) {
                stayInput.focus();
                stayInput.parentElement.style.animation = 'shake 0.4s ease';
                setTimeout(() => stayInput.parentElement.style.animation = '', 500);
                return;
            }
            renderStay(stayInput.value);
            if (navigator.vibrate) navigator.vibrate(15);
        });
        stayInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); stayBtn.click(); }
        });
    }

    /* =========================================================
       PICKUP FORM → WHATSAPP
       ========================================================= */
    const pickupForm = document.getElementById('pickupForm');
    if (pickupForm) {
        pickupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const fd = new FormData(pickupForm);
            const name = fd.get('name');
            const phone = fd.get('phone');
            const mode = fd.get('mode');
            const flight = fd.get('flight') || '—';
            const date = fd.get('date');
            const time = fd.get('time');
            const pax = fd.get('pax');
            const luggage = fd.get('luggage');
            const notes = fd.get('notes') || '—';

            const msg = `🚖 *Pickup Request — Shubham & Vaibhavi Wedding*

*Guest:* ${name}
*Phone:* ${phone}
*Arrival:* ${date} at ${time}
*Mode:* ${mode}
*Flight/Train:* ${flight}
*Passengers:* ${pax}
*Luggage:* ${luggage}
*Notes:* ${notes}

Sent via the wedding website. Please confirm the pickup. Thank you 🙏`;

            const wa = `https://wa.me/919922012346?text=${encodeURIComponent(msg)}`;
            window.open(wa, '_blank');
            if (navigator.vibrate) navigator.vibrate(25);
            if (typeof showToast === 'function') showToast('Opening WhatsApp…');
        });
    }

    /* =========================================================
       DOWNLOAD PDF INVITE (jsPDF)
       ========================================================= */
    const dlBtn = document.getElementById('downloadInviteBtn');
    if (dlBtn) {
        dlBtn.addEventListener('click', () => {
            if (!window.jspdf) {
                if (typeof showToast === 'function') showToast('PDF library still loading, try again');
                return;
            }
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: [148, 210] }); // A5 portrait

            const W = 148, H = 210;
            const accent = [193, 68, 14];
            const gold = [212, 175, 55];
            const dark = [45, 24, 16];

            // Background
            doc.setFillColor(245, 233, 200);
            doc.rect(0, 0, W, H, 'F');

            // Outer gold border
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.6);
            doc.rect(8, 8, W - 16, H - 16);
            doc.setLineWidth(0.2);
            doc.rect(10, 10, W - 20, H - 20);

            // Ornament top
            doc.setTextColor(...accent);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(18);
            doc.text('۞', W/2, 22, { align: 'center' });

            // Blessing
            doc.setFontSize(9);
            doc.setTextColor(...accent);
            doc.text('|| Shree Ganeshay Namah ||', W/2, 30, { align: 'center' });

            // Intro
            doc.setFont('times', 'italic');
            doc.setFontSize(11);
            doc.setTextColor(90, 58, 32);
            doc.text('With the blessings of our families,', W/2, 50, { align: 'center' });
            doc.text('we joyfully invite you to celebrate the union of', W/2, 57, { align: 'center' });

            // Names
            doc.setFont('times', 'normal');
            doc.setFontSize(32);
            doc.setTextColor(...accent);
            doc.text('Shubham', W/2, 80, { align: 'center' });
            doc.setFontSize(18);
            doc.setTextColor(...gold);
            doc.setFont('times', 'italic');
            doc.text('&', W/2, 92, { align: 'center' });
            doc.setFont('times', 'normal');
            doc.setFontSize(32);
            doc.setTextColor(...accent);
            doc.text('Vaibhavi', W/2, 106, { align: 'center' });

            // Divider
            doc.setDrawColor(...gold);
            doc.setLineWidth(0.4);
            doc.line(W/2 - 30, 116, W/2 - 6, 116);
            doc.line(W/2 + 6, 116, W/2 + 30, 116);
            doc.setFontSize(10);
            doc.setTextColor(...gold);
            doc.text('۞', W/2, 118, { align: 'center' });

            // Date
            doc.setFont('times', 'normal');
            doc.setFontSize(18);
            doc.setTextColor(...dark);
            doc.text('Wednesday, 22 July 2026', W/2, 132, { align: 'center' });
            doc.setFontSize(11);
            doc.setTextColor(90, 58, 32);
            doc.text('Muhurat at 12:30 PM', W/2, 140, { align: 'center' });

            // Venue
            doc.setFontSize(13);
            doc.setTextColor(...dark);
            doc.setFont('times', 'italic');
            doc.text('Samarth Lawns', W/2, 155, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(90, 58, 32);
            doc.text('Mahabal Road, Near Mehrun Lake', W/2, 161, { align: 'center' });
            doc.text('Jalgaon, Maharashtra 425001', W/2, 166, { align: 'center' });

            // Events list
            doc.setFontSize(8);
            doc.setTextColor(120, 80, 40);
            doc.text('21 Jul · Engagement 4:00 PM  ·  Haldi 6:30 PM  ·  Sangeet 9:00 PM', W/2, 178, { align: 'center' });
            doc.text('22 Jul · Wedding Ceremony (Lagna Vidhi) 12:30 PM', W/2, 183, { align: 'center' });

            // Hashtag
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(...accent);
            doc.text('#ShubhamWedsVaibhavi', W/2, 196, { align: 'center' });

            doc.save('Shubham-Vaibhavi-Invitation.pdf');
            if (typeof showToast === 'function') showToast('Invitation downloaded');
            if (navigator.vibrate) navigator.vibrate(25);
        });
    }

    /* =========================================================
       LIVE STREAM ACTIONS
       ========================================================= */
    const lsPlay = document.getElementById('livestreamPlay');
    if (lsPlay) {
        lsPlay.addEventListener('click', () => {
            const now = new Date();
            const eventStart = new Date('2026-07-22T06:30:00Z'); // noon-ish IST
            const eventEnd   = new Date('2026-07-22T17:00:00Z');
            if (now >= eventStart && now <= eventEnd) {
                window.open('https://youtube.com/live/shubhamWedsVaibhavi', '_blank');
            } else {
                if (typeof showToast === 'function') showToast('Stream goes live on 22 July, 12:00 PM IST');
            }
            if (navigator.vibrate) navigator.vibrate(20);
        });
    }
    const lsBadge = document.getElementById('livestreamBadge');
    (function updateLsBadge(){
        if (!lsBadge) return;
        const now = new Date();
        const eventStart = new Date('2026-07-22T06:30:00Z');
        const eventEnd   = new Date('2026-07-22T17:00:00Z');
        if (now >= eventStart && now <= eventEnd) {
            lsBadge.classList.add('live');
            lsBadge.innerHTML = '<span class="pulse-dot"></span> LIVE NOW · Tap to Watch';
        }
    })();
    const lsRemind = document.getElementById('livestreamRemindBtn');
    if (lsRemind) {
        lsRemind.addEventListener('click', () => {
            downloadICS('wedding');
            if (typeof showToast === 'function') showToast('Reminder added to calendar');
        });
    }

    /* =========================================================
       LIVE UPDATES (admin → guests, real-time)
       ========================================================= */
    const RT = window.WeddingRealtime;
    if (RT) {
        const liveBanner    = document.getElementById('liveBanner');
        const lbIcon        = document.getElementById('liveBannerIcon');
        const lbMsg         = document.getElementById('liveBannerMsg');
        const lbMeta        = document.getElementById('liveBannerMeta');
        const lbClose       = document.getElementById('liveBannerClose');
        const updatesList   = document.getElementById('updatesList');
        const navLiveBadge  = document.getElementById('navLiveBadge');

        const LAST_SEEN_KEY = 'sv_last_seen_update';
        let lastSeenAt = parseInt(localStorage.getItem(LAST_SEEN_KEY) || '0', 10);
        let bannerTimer = null;
        let bannerDismissed = new Set();
        let renderedKnown = false;
        let firstRenderTs = Date.now();

        const fmtRelative = (t) => {
            const diff = Math.floor((Date.now() - t) / 1000);
            if (diff < 30) return 'just now';
            if (diff < 60) return diff + ' sec ago';
            if (diff < 3600) return Math.floor(diff/60) + ' min ago';
            if (diff < 86400) return Math.floor(diff/3600) + ' hr ago';
            return new Date(t).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' });
        };

        const showBannerFor = (u) => {
            if (!liveBanner) return;
            if (bannerDismissed.has(u.id)) return;
            lbIcon.textContent = u.icon || '📣';
            lbMsg.textContent  = u.message;
            lbMeta.textContent = (u.author ? u.author + ' · ' : '') + fmtRelative(u.timestamp);
            liveBanner.dataset.sev = u.severity || 'info';
            liveBanner.hidden = false;
            requestAnimationFrame(() => liveBanner.classList.add('show'));
            if (navigator.vibrate) navigator.vibrate(u.severity === 'urgent' ? [40, 60, 40] : 25);

            clearTimeout(bannerTimer);
            const duration = u.severity === 'urgent' ? 10000 : 6500;
            bannerTimer = setTimeout(hideBanner, duration);
        };
        const hideBanner = () => {
            if (!liveBanner) return;
            liveBanner.classList.remove('show');
            setTimeout(() => { liveBanner.hidden = true; }, 500);
        };
        lbClose?.addEventListener('click', () => {
            const u = RT.getUpdates()[0];
            if (u) bannerDismissed.add(u.id);
            hideBanner();
        });

        const updateBadge = (list) => {
            if (!navLiveBadge) return;
            const unseen = list.filter(u => u.timestamp > lastSeenAt).length;
            if (unseen > 0) {
                navLiveBadge.hidden = false;
                navLiveBadge.textContent = unseen > 9 ? '9+' : unseen;
            } else {
                navLiveBadge.hidden = true;
            }
        };

        const renderUpdates = (list) => {
            if (!updatesList) return;

            if (!list.length) {
                updatesList.innerHTML = `
                    <div class="updates-empty">
                        <div class="updates-empty-icon">⏳</div>
                        <strong>No updates yet</strong>
                        <p>This feed will light up once the day begins. Pull-to-refresh anytime.</p>
                    </div>`;
                updateBadge([]);
                return;
            }

            const escape = (s) => String(s).replace(/[&<>"']/g, c => ({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
            }[c]));

            updatesList.innerHTML = list.map(u => {
                const isNew = u.timestamp > lastSeenAt && renderedKnown;
                return `
                    <article class="update-item ${isNew ? 'is-new' : ''}" data-sev="${u.severity || 'info'}" data-id="${u.id}">
                        <div class="update-icon">${u.icon || '📣'}</div>
                        <div class="update-body">
                            <p>${escape(u.message)}</p>
                            <span class="update-time">${fmtRelative(u.timestamp)}</span>
                            ${u.author ? `<span class="update-author">· ${escape(u.author)}</span>` : ''}
                        </div>
                    </article>`;
            }).join('');

            // Latest one — if new since last visit, show banner
            const top = list[0];
            if (top && top.timestamp > lastSeenAt && renderedKnown && top.timestamp > firstRenderTs - 1000) {
                showBannerFor(top);
            }

            updateBadge(list);
            renderedKnown = true;
        };

        RT.onUpdates(renderUpdates);

        // Auto-tick relative timestamps every minute
        setInterval(() => {
            document.querySelectorAll('.update-item').forEach(el => {
                const id = el.dataset.id;
                const u = RT.getUpdates().find(x => x.id === id);
                if (!u) return;
                const t = el.querySelector('.update-time');
                if (t) t.textContent = fmtRelative(u.timestamp);
            });
        }, 60_000);

        // When user actually views the updates section, mark as seen
        // and count them as an "updates viewer" in our aggregate stats.
        const updatesSec = document.getElementById('live-updates');
        if (updatesSec && 'IntersectionObserver' in window) {
            new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        const list = RT.getUpdates();
                        if (list.length) {
                            lastSeenAt = list[0].timestamp;
                            localStorage.setItem(LAST_SEEN_KEY, String(lastSeenAt));
                            updateBadge(list);
                            document.querySelectorAll('.update-item.is-new').forEach(el => el.classList.remove('is-new'));
                        }
                        // Count this device as a feed-viewer (once, ever).
                        if (typeof RT.trackUpdatesViewed === 'function') {
                            try { RT.trackUpdatesViewed(); } catch (_) {}
                        }
                    }
                });
            }, { threshold: 0.2 }).observe(updatesSec);
        }

        // ---------- Notification opt-in CTA ----------
        const notifCta       = document.getElementById('notifCta');
        const notifEnableBtn = document.getElementById('notifEnableBtn');
        const notifSkipBtn   = document.getElementById('notifSkipBtn');
        const notifState     = document.getElementById('notifState');
        const notifStateMsg  = document.getElementById('notifStateMsg');
        const NOTIF_DISMISSED = 'sv_notif_cta_dismissed';

        function paintNotifState() {
            const state = RT.notificationsState ? RT.notificationsState() : 'unsupported';
            if (state === 'unsupported') {
                if (notifCta)   notifCta.hidden = true;
                if (notifState) notifState.hidden = true;
                return;
            }
            if (state === 'granted') {
                if (notifCta)       notifCta.hidden = true;
                if (notifState)     notifState.hidden = false;
                if (notifStateMsg)  notifStateMsg.textContent = 'Alerts are on — you\'ll get a ping for every update';
                return;
            }
            if (state === 'denied') {
                if (notifCta)       notifCta.hidden = true;
                if (notifState)     notifState.hidden = false;
                if (notifStateMsg)  notifStateMsg.textContent = 'Notifications are blocked in your browser settings.';
                if (notifState)     notifState.classList.add('notif-state-denied');
                return;
            }
            // default — show the prompt unless the user already dismissed it
            if (notifState) notifState.hidden = true;
            if (localStorage.getItem(NOTIF_DISMISSED)) {
                if (notifCta) notifCta.hidden = true;
                return;
            }
            if (notifCta) notifCta.hidden = false;
        }

        notifEnableBtn?.addEventListener('click', async () => {
            notifEnableBtn.disabled = true;
            notifEnableBtn.textContent = 'Asking…';
            try {
                const r = await RT.requestNotifications();
                if (r === 'granted' && typeof showToast === 'function') showToast('You\'re subscribed to live alerts');
            } catch (_) {}
            notifEnableBtn.disabled = false;
            notifEnableBtn.textContent = 'Turn on alerts';
            paintNotifState();
        });

        notifSkipBtn?.addEventListener('click', () => {
            localStorage.setItem(NOTIF_DISMISSED, String(Date.now()));
            if (notifCta) notifCta.hidden = true;
        });

        paintNotifState();

        // Permission state can change when the user toggles it elsewhere
        // — re-paint on focus.
        window.addEventListener('focus', paintNotifState);
    }

    /* =========================================================
       LIVE WEDDING GALLERY (photographer → guests, real-time)
       ========================================================= */
    if (RT) {
        const liveGallery   = document.getElementById('liveGallery');
        const lgCount       = document.getElementById('lgCount');
        const lgPhotogs     = document.getElementById('lgPhotographers');
        const lgLatestEl    = document.getElementById('lgLatest');
        const lightbox      = document.getElementById('lightbox');
        const lbImg         = document.getElementById('lightboxImg');
        const lbCaption     = document.getElementById('lightboxCaption');
        const lbCredit      = document.getElementById('lightboxCredit');
        const lbDl          = document.getElementById('lightboxDl');
        const lbClosePh     = document.getElementById('lightboxClose');
        const lbPrev        = document.getElementById('lightboxPrev');
        const lbNext        = document.getElementById('lightboxNext');

        const LG_SEEN_KEY = 'sv_lg_seen_count';
        let lgLastSeenCount = parseInt(localStorage.getItem(LG_SEEN_KEY) || '0', 10);
        let photoCache = [];
        let lbIndex = 0;
        let lbRendered = false;
        let firstLgRender = Date.now();

        const fmtRel = (t) => {
            const d = Math.floor((Date.now() - t) / 1000);
            if (d < 30) return 'just now';
            if (d < 60) return d + 's';
            if (d < 3600) return Math.floor(d/60) + 'm';
            if (d < 86400) return Math.floor(d/3600) + 'h';
            return new Date(t).toLocaleDateString();
        };
        const escape = (s) => String(s).replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
        }[c]));

        const renderLG = (list) => {
            photoCache = list;
            if (!liveGallery) return;
            if (lgCount) lgCount.textContent = list.length;
            if (lgPhotogs) lgPhotogs.textContent = new Set(list.map(p => p.photographer || 'Crew')).size || 0;
            if (lgLatestEl) lgLatestEl.textContent = list[0] ? fmtRel(list[0].timestamp) : '—';

            if (!list.length) {
                liveGallery.innerHTML = `
                    <div class="lg-empty">
                        <div class="lg-empty-icon">📷</div>
                        <strong>Photos appear here as they're captured</strong>
                        <p>Our photography team will be uploading throughout the celebrations.</p>
                    </div>`;
                return;
            }

            liveGallery.innerHTML = list.map((p, i) => {
                const isNew = lbRendered && i >= 0 && (lgLastSeenCount < list.length - i);
                return `
                    <button class="lg-tile ${isNew ? 'is-new' : ''}" data-idx="${i}" type="button" aria-label="View photo by ${escape(p.photographer || 'photographer')}">
                        <img src="${p.thumb}" alt="${escape(p.caption || 'wedding photo')}" loading="lazy">
                        <div class="lg-tile-overlay">
                            <strong>${escape(p.photographer || 'Wedding Crew')}</strong>
                            <span>${fmtRel(p.timestamp)}${p.caption ? ' · ' + escape(p.caption) : ''}</span>
                        </div>
                        <span class="lg-tile-badge">NEW</span>
                    </button>`;
            }).join('');

            lbRendered = true;
        };

        const openLightbox = async (i) => {
            if (!photoCache[i]) return;
            lbIndex = i;
            const p = photoCache[i];
            const full = await RT.getPhotoFull(p.id);
            const src = (full && full.full) || p.thumb;
            lbImg.src = src;
            lbCaption.textContent = p.caption || '';
            lbCredit.textContent = `${p.photographer || 'Wedding Crew'} · ${new Date(p.timestamp).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short' })}`;
            lbDl.dataset.id = p.id;
            lbDl.dataset.fileName = (full && full.fileName) || `sv-photo-${p.id}.jpg`;
            lightbox.hidden = false;
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        };
        const closeLightbox = () => {
            lightbox.setAttribute('aria-hidden', 'true');
            setTimeout(() => { lightbox.hidden = true; }, 300);
            document.body.style.overflow = '';
            lbImg.src = '';
        };
        const navLightbox = (dir) => {
            const next = (lbIndex + dir + photoCache.length) % photoCache.length;
            openLightbox(next);
        };

        liveGallery?.addEventListener('click', (e) => {
            const tile = e.target.closest('.lg-tile');
            if (!tile) return;
            openLightbox(parseInt(tile.dataset.idx, 10));
            if (navigator.vibrate) navigator.vibrate(10);
        });
        lbClosePh?.addEventListener('click', closeLightbox);
        lbPrev?.addEventListener('click', () => navLightbox(-1));
        lbNext?.addEventListener('click', () => navLightbox(1));
        lightbox?.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (lightbox?.hidden) return;
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowRight') navLightbox(1);
            else if (e.key === 'ArrowLeft') navLightbox(-1);
        });
        lbDl?.addEventListener('click', async () => {
            const id = lbDl.dataset.id;
            const full = await RT.getPhotoFull(id);
            if (!full) {
                if (typeof showToast === 'function') showToast('Photo not available');
                return;
            }
            const name = lbDl.dataset.fileName || `sv-photo-${id}.jpg`;

            // Local data URL → direct download
            if (full.full && full.full.startsWith('data:')) {
                const a = document.createElement('a');
                a.href = full.full;
                a.download = name;
                document.body.appendChild(a); a.click(); a.remove();
            } else if (full.full) {
                // Remote URL → fetch as blob, then download (forces save vs open)
                try {
                    const r = await fetch(full.full);
                    const blob = await r.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = name;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                } catch (e) {
                    // Last-resort: open in new tab
                    window.open(full.full, '_blank');
                }
            }
            if (typeof showToast === 'function') showToast('Photo saved');
            if (navigator.vibrate) navigator.vibrate(20);
        });

        // Touch swipe in lightbox
        let touchStartX = null;
        lightbox?.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
        lightbox?.addEventListener('touchend', (e) => {
            if (touchStartX == null) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 60) navLightbox(dx > 0 ? -1 : 1);
            touchStartX = null;
        }, { passive: true });

        RT.onPhotos(renderLG);

        // Mark gallery as seen when scrolled into view
        const lgSec = document.getElementById('live-gallery');
        if (lgSec && 'IntersectionObserver' in window) {
            new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        lgLastSeenCount = photoCache.length;
                        localStorage.setItem(LG_SEEN_KEY, String(lgLastSeenCount));
                        document.querySelectorAll('.lg-tile.is-new').forEach(el => el.classList.remove('is-new'));
                    }
                });
            }, { threshold: 0.15 }).observe(lgSec);
        }

        // Auto-refresh relative times
        setInterval(() => {
            if (lgLatestEl && photoCache[0]) lgLatestEl.textContent = fmtRel(photoCache[0].timestamp);
        }, 30_000);
    }

    /* =========================================================
       WHATSAPP FAB
       ========================================================= */
    const waFab = document.getElementById('waFab');
    const waTrigger = document.getElementById('waFabTrigger');
    if (waFab && waTrigger) {
        const backdrop = document.createElement('div');
        backdrop.className = 'wa-fab-backdrop';
        document.body.appendChild(backdrop);

        const toggleFab = (open) => {
            const state = open ?? !waFab.classList.contains('open');
            waFab.classList.toggle('open', state);
            backdrop.classList.toggle('show', state);
            if (navigator.vibrate) navigator.vibrate(state ? 12 : 8);
        };

        waTrigger.addEventListener('click', (e) => { e.stopPropagation(); toggleFab(); });
        backdrop.addEventListener('click', () => toggleFab(false));

        document.querySelectorAll('.wa-action').forEach(a => {
            a.addEventListener('click', () => {
                const k = a.getAttribute('data-wa');
                const inviteUrl = window.location.href.split('#')[0];
                let url = '';
                if (k === 'rsvp') {
                    const msg = `Hi! I'd like to RSVP for Shubham & Vaibhavi's wedding on 22 July 2026.%0A%0AName:%20%0AGuests:%20%0AAttending:%20`;
                    url = `https://wa.me/919922012345?text=${msg}`;
                } else if (k === 'directions') {
                    openDirections();
                    toggleFab(false);
                    return;
                } else if (k === 'family') {
                    // Open contact options — scroll to contacts and open contacts tab
                    document.querySelectorAll('.ctab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-ctab') === 'contacts'));
                    document.querySelectorAll('.ctab-panel').forEach(p => p.classList.toggle('active', p.id === 'ctab-contacts'));
                    document.getElementById('concierge')?.scrollIntoView({ behavior: 'smooth' });
                    toggleFab(false);
                    return;
                } else if (k === 'share') {
                    const msg = `Shubham & Vaibhavi are getting married! 💍%0A22 July 2026 · Samarth Lawns, Jalgaon%0A%0AView the invitation: ${encodeURIComponent(inviteUrl)}`;
                    url = `https://wa.me/?text=${msg}`;
                }
                if (url) window.open(url, '_blank');
                toggleFab(false);
            });
        });
    }

    // ===== HERO DIPTYCH · seconds-digit flip animation =====
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const secs = document.getElementById('cd-secs');
        if (secs) {
            let last = secs.textContent;
            new MutationObserver(() => {
                if (secs.textContent !== last) {
                    last = secs.textContent;
                    secs.classList.remove('flip');
                    void secs.offsetWidth;
                    secs.classList.add('flip');
                }
            }).observe(secs, { characterData: true, childList: true, subtree: true });
        }
    }

})();
