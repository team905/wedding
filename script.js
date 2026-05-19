(() => {
    'use strict';

    // ===== LOADER =====
    const loader = document.getElementById('loader');
    const hideLoader = () => loader.classList.add('hidden');
    window.addEventListener('load', () => setTimeout(hideLoader, 1200));
    setTimeout(hideLoader, 2500); // fallback

    // ===== TOP BAR SCROLL =====
    const topBar = document.getElementById('topBar');
    let lastScroll = 0;

    const handleScroll = () => {
        const y = window.scrollY;
        if (y > 100) {
            topBar.classList.add('visible');
        } else {
            topBar.classList.remove('visible');
        }
        lastScroll = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

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
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // ===== COUNTDOWN =====
    const weddingDate = new Date('2026-12-14T10:00:00+05:30').getTime();

    function updateCountdown() {
        const now = Date.now();
        const diff = weddingDate - now;

        if (diff <= 0) return;

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const daysEl = document.getElementById('cd-days');
        const hoursEl = document.getElementById('cd-hours');
        const minsEl = document.getElementById('cd-mins');
        const secsEl = document.getElementById('cd-secs');

        if (daysEl) daysEl.textContent = d;
        if (hoursEl) hoursEl.textContent = String(h).padStart(2, '0');
        if (minsEl) minsEl.textContent = String(m).padStart(2, '0');
        if (secsEl) secsEl.textContent = String(s).padStart(2, '0');
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
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -60px 0px'
        });

        animElements.forEach(el => observer.observe(el));
    } else {
        animElements.forEach(el => el.classList.add('visible'));
    }

    // ===== BOTTOM NAV ACTIVE STATE =====
    const bottomLinks = document.querySelectorAll('.bottom-nav-item');
    const sections = document.querySelectorAll('section[id]');

    const updateActiveNav = () => {
        const scrollPos = window.scrollY + window.innerHeight / 3;

        let currentSection = 'home';
        sections.forEach(section => {
            if (scrollPos >= section.offsetTop) {
                currentSection = section.id;
            }
        });

        // Map sections to nav items
        const navMap = {
            'home': 'home',
            'couple': 'home',
            'events': 'events',
            'venue': 'events',
            'gallery': 'gallery',
            'party': 'gallery',
            'details': 'details',
            'rsvp': 'rsvp'
        };

        const activeNav = navMap[currentSection] || 'home';

        bottomLinks.forEach(link => {
            const section = link.dataset.section;
            link.classList.toggle('active', section === activeNav);
        });
    };

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();

    // ===== TABS =====
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanels.forEach(panel => {
                panel.classList.toggle('active', panel.id === `tab-${tab}`);
            });
        });
    });

    // ===== RSVP FORM =====
    const rsvpForm = document.getElementById('rsvpForm');
    const rsvpSuccess = document.getElementById('rsvpSuccess');
    const submitBtn = document.getElementById('submitBtn');

    rsvpForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Basic validation
        const name = rsvpForm.querySelector('[name="name"]').value.trim();
        const email = rsvpForm.querySelector('[name="email"]').value.trim();
        const attending = rsvpForm.querySelector('[name="attending"]:checked');

        if (!name || !email || !attending) {
            shakeBtn();
            return;
        }

        // Show loading
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        // Simulate submission
        setTimeout(() => {
            rsvpForm.style.display = 'none';
            rsvpSuccess.classList.add('show');

            // Haptic feedback on supported devices
            if (navigator.vibrate) {
                navigator.vibrate([50, 30, 50]);
            }
        }, 1500);
    });

    function shakeBtn() {
        submitBtn.style.animation = 'shake 0.4s ease';
        setTimeout(() => { submitBtn.style.animation = ''; }, 400);
    }

    // Add shake keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
        }
    `;
    document.head.appendChild(style);

    // ===== HERO PARALLAX (Desktop only) =====
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
        img.style.transition = 'opacity 0.5s ease';

        if (img.complete) {
            img.style.opacity = '1';
        } else {
            img.addEventListener('load', () => {
                img.style.opacity = '1';
            });
        }
    });

    // ===== PREVENT OVERSCROLL ON iOS =====
    document.body.addEventListener('touchmove', (e) => {
        if (fullMenu.classList.contains('open')) {
            e.preventDefault();
        }
    }, { passive: false });

})();
