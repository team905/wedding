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
    const weddingDate = new Date('2026-12-14T10:00:00+05:30').getTime();

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
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Wedding//EN',
            'BEGIN:VEVENT',
            'DTSTART:20261214T043000Z',
            'DTEND:20261214T133000Z',
            'SUMMARY:Aarav & Meera Wedding',
            'DESCRIPTION:Lagna Vidhi - Maharashtrian Wedding Ceremony',
            'LOCATION:Taj Lakefront\\, Baner-Pashan Link Road\\, Pune\\, Maharashtra 411045',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'aarav-meera-wedding.ics';
        link.click();
        URL.revokeObjectURL(url);

        showToast('Event saved to calendar!');
    });

    // ===== SHARE INVITATION =====
    document.getElementById('shareBtn').addEventListener('click', async () => {
        const shareData = {
            title: 'Aarav & Meera Wedding',
            text: 'You\'re invited to the wedding of Aarav & Meera on December 14, 2026 in Pune. We\'d love to celebrate with you!',
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
        const text = `You're invited! Aarav & Meera's Wedding — Dec 14, 2026, Pune. ${window.location.href}`;
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

    // ===== MUSIC PLAYER =====
    const musicPlayer = document.getElementById('musicPlayer');
    const musicToggle = document.getElementById('musicToggle');
    const musicProgress = document.getElementById('musicProgress');
    let isPlaying = false;
    let musicInterval;
    let progress = 0;

    // Show player after scroll
    setTimeout(() => musicPlayer.classList.add('visible'), 3000);

    musicToggle.addEventListener('click', () => {
        isPlaying = !isPlaying;
        musicPlayer.classList.toggle('playing', isPlaying);

        if (isPlaying) {
            musicInterval = setInterval(() => {
                progress = (progress + 0.3) % 100;
                musicProgress.style.width = progress + '%';
            }, 100);
            showToast('Now playing: Tujh Mein Rab Dikhta Hai');
        } else {
            clearInterval(musicInterval);
        }
    });

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
            showToast('RSVP confirmed! See you there 🎉');
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

})();
