document.addEventListener('DOMContentLoaded', function() {
    // Loading screen
    var loading = document.createElement('div');
    loading.className = 'page-loading';
    loading.innerHTML = '<div class="loader"></div>';
    document.body.appendChild(loading);
    setTimeout(function() {
        loading.classList.add('hidden');
        setTimeout(function() { loading.remove(); }, 300);
    }, 100);

    // Mobile menu
    var mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    var nav = document.querySelector('.nav');
    if (mobileMenuBtn && nav) {
        mobileMenuBtn.addEventListener('click', function() {
            nav.classList.toggle('active');
            document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
        });
        document.querySelectorAll('.nav a').forEach(function(link) {
            link.addEventListener('click', function() {
                nav.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#') return;
            e.preventDefault();
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({ top: target.offsetTop - 80, behavior: 'smooth' });
            }
        });
    });

    // Scroll-to-top button
    var scrollTopBtn = document.createElement('button');
    scrollTopBtn.className = 'scroll-top-btn';
    scrollTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(scrollTopBtn);
    scrollTopBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Scroll events: show/hide scroll-top button + header effect
    window.addEventListener('scroll', function() {
        var y = window.pageYOffset;
        scrollTopBtn.classList.toggle('show', y > 500);
        var header = document.querySelector('.header');
        if (header) header.classList.toggle('scrolled', y > 50);
    });

    // Theme toggle
    var themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');
        themeToggle.addEventListener('click', function() {
            var current = document.documentElement.getAttribute('data-theme');
            var next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    // Counter animation
    function animateValue(el, end, duration) {
        var start = null;
        var suffix = el.dataset.count && el.dataset.count.includes('+') ? '+' : '';
        function step(ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / duration, 1);
            el.textContent = Math.floor(p * end) + (p >= 1 ? suffix : '');
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // Intersection observer for scroll animations + counters
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('animated');
            if (entry.target.classList.contains('stat-number') && entry.target.dataset.count && !entry.target.classList.contains('counted')) {
                var target = parseInt(entry.target.dataset.count);
                animateValue(entry.target, target, 1500);
                entry.target.classList.add('counted');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-on-scroll, .stat-number[data-count]').forEach(function(el) {
        observer.observe(el);
    });
});

window.addEventListener('load', function() {
    document.body.classList.add('page-loaded');
});
