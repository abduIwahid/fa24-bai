document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("loaded");

    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const folderOptions = document.getElementById('folderOptions');
    const uploadStatus = document.getElementById('uploadStatus');
    const searchInput = document.getElementById('searchInput');
    const filterChips = document.querySelectorAll('.filter-chip');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const uploadSection = document.getElementById('uploadSection');

    const quickAccessContainer = document.getElementById('quickAccessContainer');
    const quickAccessList = document.getElementById('quickAccessList');

    // AI Modal Elements
    const aiModal = document.getElementById('aiModal');
    const aiCloseBtn = document.getElementById('aiCloseBtn');
    const aiModalSubtitle = document.getElementById('aiModalSubtitle');
    const chatContainer = document.getElementById('chatContainer');
    const aiInput = document.getElementById('aiInput');
    const aiSendBtn = document.getElementById('aiSendBtn');
    const aiActionBtns = document.querySelectorAll('.ai-action-btn');

    let allFiles = [];
    let filesState = 'loading'; // 'loading' | 'ready' | 'error' — drives view states
    let currentFilter = 'All';
    let searchQuery = '';
    let currentAiFile = null;

    const landingSection = document.getElementById('landingSection');
    const searchSection = document.getElementById('searchSection');
    const coursesSection = document.getElementById('coursesSection');
    const bookmarksSection = document.getElementById('bookmarksSection');
    const bookmarksContainer = document.getElementById('bookmarksContainer');

    // Request-a-material form (Google Form) — single place to swap the URL
    const REQUEST_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe8ZaXjapeO1vaGv1k4KDVo2ziVLxygVu6pjrCC5igZB2ExGA/viewform';
    window.openRequestForm = () => window.open(REQUEST_FORM_URL, '_blank', 'noopener');
    const landingCoursesGrid = document.getElementById('landingCoursesGrid');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const searchResultsInfo = document.getElementById('searchResultsInfo');

    const navigationBar = document.getElementById('navigationBar');
    const backBtn = document.getElementById('backBtn');
    const currentPath = document.getElementById('currentPath');
    const controlsSection = document.getElementById('controlsSection');
    const coursesContainer = document.getElementById('coursesContainer');
    const uploadBtn = document.getElementById('uploadBtn');

    let currentTab = 'home'; // 'home', 'search', 'courses'
    let currentView = 'all'; // inside courses view: 'all', 'course', 'folder'
    let selectedCourseCode = null;
    let selectedCourseName = null;
    let selectedFolder = null;

    // === Navigation State & Handlers ===
    const navItems = {
        home: document.getElementById('navHome'),
        search: document.getElementById('navSearch'),
        upload: document.getElementById('navUpload'),
        notice: document.getElementById('navNotice'),
        courses: document.getElementById('navCourses'),
        bookmarks: document.getElementById('navBookmarks'),
    };

    // Sliding glass pill behind the active header nav item — the
    // highlight glides to the clicked item instead of jumping.
    const headerMenuEl = document.getElementById('headerMenu');
    const navIndicator = document.getElementById('navIndicator');
    const moveNavIndicator = () => {
        if (!navIndicator || !headerMenuEl) return;
        const active = headerMenuEl.querySelector('.menu-item.active');
        if (!active || !active.offsetWidth || !active.offsetHeight) {
            navIndicator.style.opacity = '0';
            return;
        }
        navIndicator.style.opacity = '1';
        navIndicator.style.width = active.offsetWidth + 'px';
        navIndicator.style.height = active.offsetHeight + 'px';
        navIndicator.style.transform = 'translate(' + active.offsetLeft + 'px,' + active.offsetTop + 'px)';
    };
    window.addEventListener('resize', moveNavIndicator);
    window.addEventListener('load', () => setTimeout(moveNavIndicator, 80));
    // Browser zoom (e.g. Safari's AA setting) changes layout without a
    // reliable resize event — recalc the glass pill on every signal so it
    // never detaches from the active item.
    if (window.visualViewport) window.visualViewport.addEventListener('resize', moveNavIndicator);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveNavIndicator());
    window.addEventListener('orientationchange', () => setTimeout(moveNavIndicator, 120));
    setTimeout(moveNavIndicator, 400);
    setTimeout(moveNavIndicator, 1000);

    const setActiveNav = (key) => {
        Object.values(navItems).forEach(el => el && el.classList.remove('active'));
        if (navItems[key]) navItems[key].classList.add('active');
        moveNavIndicator();
    };

    // === Hash routing (Round 2) ======================================
    // Routes:  #/                                   → Home
    //          #/search[?q=term]                   → Search
    //          #/courses                            → Courses overview
    //          #/course/<CODE>                      → one course
    //          #/course/<CODE>/<Folder>[?file=...]  → a folder / a material
    //          #/bookmarks                          → Bookmarks
    // The URL is the single source of truth: UI actions only ever change
    // location.hash, and the hashchange handler applies the route to the
    // view state — so Back/Forward, bookmarks and shared links all work.
    let pendingHighlight = null; // rawName to scroll to once a folder renders

    const courseNameFor = (code) => {
        const f = allFiles.find(x => x.course.code === code);
        if (f) return f.course.name;
        const core = CORE_COURSES.find(c => c.code === code);
        return core ? core.name : code;
    };

    const buildMaterialHash = (file) =>
        '#/course/' + encodeURIComponent(file.course.code) + '/' +
        encodeURIComponent(file.resourceType) +
        '?file=' + encodeURIComponent(file.rawName.split('/').pop());

    const materialDeepLink = (file) =>
        window.location.origin + window.location.pathname + buildMaterialHash(file);

    const parseRoute = () => {
        const raw = (window.location.hash || '').replace(/^#\/?/, '');
        const qIdx = raw.indexOf('?');
        const pathPart = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
        const params = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');
        const seg = pathPart.split('/').filter(Boolean).map(s => {
            try { return decodeURIComponent(s); } catch (e) { return s; }
        });
        if (seg.length === 0) return { name: 'home' };
        if (seg[0] === 'search') return { name: 'search', q: params.has('q') ? (params.get('q') || '') : null };
        if (seg[0] === 'courses') return { name: 'courses' };
        if (seg[0] === 'bookmarks') return { name: 'bookmarks' };
        if (seg[0] === 'course' && seg[1]) {
            if (seg[2]) return { name: 'folder', code: seg[1], folder: seg[2], file: params.get('file') || null };
            return { name: 'course', code: seg[1] };
        }
        return { name: 'home' };
    };

    const renderCurrentTab = () => {
        setActiveNav(currentTab);
        if (landingSection) landingSection.style.display = currentTab === 'home' ? 'block' : 'none';
        if (searchSection) searchSection.style.display = currentTab === 'search' ? 'block' : 'none';
        if (coursesSection) coursesSection.style.display = currentTab === 'courses' ? 'block' : 'none';
        if (bookmarksSection) bookmarksSection.style.display = currentTab === 'bookmarks' ? 'block' : 'none';

        if (currentTab === 'home') {
            renderLandingCourses();
            renderQuickAccess();
            renderCountdown();
        } else if (currentTab === 'search') {
            renderSearch();
            renderRecentSearches();
        } else if (currentTab === 'courses') {
            renderCourses();
        } else if (currentTab === 'bookmarks') {
            renderBookmarks();
        }
    };

    const applyRoute = () => {
        const route = parseRoute();
        pendingHighlight = null;

        if (route.name === 'search') {
            currentTab = 'search';
            if (route.q !== null) {
                searchQuery = route.q.toLowerCase();
                if (searchInput) searchInput.value = route.q;
            }
        } else if (route.name === 'courses') {
            currentTab = 'courses';
            currentView = 'all';
            selectedCourseCode = null;
            selectedCourseName = null;
            selectedFolder = null;
        } else if (route.name === 'course' || route.name === 'folder') {
            currentTab = 'courses';
            selectedCourseCode = route.code;
            selectedCourseName = courseNameFor(route.code);
            if (route.name === 'folder') {
                currentView = 'folder';
                selectedFolder = route.folder;
                if (route.file) {
                    const target = allFiles.find(f => f.course.code === route.code &&
                        f.resourceType === route.folder &&
                        f.rawName.split('/').pop() === route.file);
                    if (target) pendingHighlight = target.rawName;
                }
            } else {
                currentView = 'course';
                selectedFolder = null;
            }
        } else if (route.name === 'bookmarks') {
            currentTab = 'bookmarks';
        } else {
            currentTab = 'home';
        }

        renderCurrentTab();

        if (pendingHighlight) {
            setTimeout(() => highlightPending(), 90);
        }
    };

    const highlightPending = () => {
        if (!pendingHighlight || !coursesContainer) return;
        const items = coursesContainer.querySelectorAll('.resource-item');
        for (const el of items) {
            if (el.getAttribute('data-file') === pendingHighlight) {
                el.classList.add('highlight');
                try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* no-op */ }
                break;
            }
        }
    };

    const goTo = (hash) => {
        if (window.location.hash === hash) {
            applyRoute();
        } else {
            window.location.hash = hash; // hashchange handler applies it
        }
    };

    window.addEventListener('hashchange', applyRoute);

    // Backwards-compatible shim for any lingering switchTab callers
    const switchTab = (tabName) => {
        if (tabName === 'search') goTo('#/search');
        else if (tabName === 'courses') goTo('#/courses');
        else if (tabName === 'bookmarks') goTo('#/bookmarks');
        else goTo('#/');
    };
    window.switchTab = switchTab;

    window.scrollToHome = () => {
        goTo('#/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.focusSearch = () => {
        goTo('#/search');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            const inputEl = document.getElementById('searchInput');
            if (inputEl) {
                try {
                    inputEl.focus({ preventScroll: true });
                } catch (err) {
                    inputEl.focus();
                }
            }
        }, 120);
    };

    window.submitLandingSearch = () => {
        const landingInput = document.getElementById('landingSearchInput');
        const query = landingInput ? landingInput.value.trim() : '';
        if (query) saveRecentSearch(query);
        goTo('#/search' + (query ? '?q=' + encodeURIComponent(query) : ''));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const landingSearchInput = document.getElementById('landingSearchInput');
    if (landingSearchInput) {
        landingSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.submitLandingSearch();
            }
        });
    }

    window.scrollToCourses = () => {
        goTo('#/courses');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.openBookmarks = () => {
        goTo('#/bookmarks');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.openUploadPanel = async () => {
        setActiveNav('upload');
        if (!adminPass) {
            const pass = await promptAdminPassword();
            if (!pass) {
                setActiveNav(currentTab);
                return;
            }
        }
        if (uploadSection) {
            uploadSection.style.display = 'block';
            setTimeout(() => {
                const header = document.querySelector('.header');
                const headerOffset = header ? header.offsetHeight + 12 : 70;
                const rect = uploadSection.getBoundingClientRect();
                const targetY = window.pageYOffset + rect.top - headerOffset;
                window.scrollTo({
                    top: Math.max(0, targetY),
                    behavior: 'smooth'
                });
            }, 100);
        }
    };

    if (navItems.home) navItems.home.addEventListener('click', (e) => { e.preventDefault(); window.scrollToHome(); });
    if (navItems.search) navItems.search.addEventListener('click', (e) => { e.preventDefault(); window.focusSearch(); });
    if (navItems.upload) navItems.upload.addEventListener('click', (e) => { e.preventDefault(); window.openUploadPanel(); });
    if (navItems.courses) navItems.courses.addEventListener('click', (e) => { e.preventDefault(); window.scrollToCourses(); });
    if (navItems.bookmarks) navItems.bookmarks.addEventListener('click', (e) => { e.preventDefault(); window.openBookmarks(); });

    backBtn.addEventListener('click', () => {
        if (currentView === 'folder' && selectedCourseCode) {
            goTo('#/course/' + encodeURIComponent(selectedCourseCode));
        } else if (currentView === 'course') {
            goTo('#/courses');
        }
    });

    // Admin State
    let adminPass = sessionStorage.getItem('adminPass') || null;
    let adminLoginAttempts = 0;
    const maxLoginAttempts = 5;
    let adminLoginLockedUntil = null;

    // The password is ONLY ever verified by the server (POST /api/ask,
    // action "verify"). There is deliberately no client-side copy of it:
    // any network/server failure means "not verified" (fail closed).
    const verifyAdminPasswordOnServer = async (pass) => {
        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass, action: 'verify' })
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    };

    // Admin Login Elements
    const adminLoginModal = document.getElementById('adminLoginModal');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminPasswordInput = document.getElementById('adminPassword');
    const adminCloseBtn = document.getElementById('adminCloseBtn');
    const loginError = document.getElementById('loginError');
    const loginAttempts = document.getElementById('loginAttempts');


    // Brief "Welcome Admin" pop (Wadi, 2026-10-23): shows for ~2 seconds
    // with a shrinking loading bar, only at the moment of login — no name,
    // nothing permanent in the header.
    const showAdminWelcome = () => {
        const old = document.getElementById('adminWelcomePop');
        if (old) old.remove();
        const pop = document.createElement('div');
        pop.id = 'adminWelcomePop';
        pop.style.cssText = 'position:fixed;top:88px;left:50%;transform:translate(-50%,-10px);opacity:0;transition:opacity .25s ease,transform .25s ease;background:#004741;color:#f0ede4;padding:.7rem 1.4rem .85rem;border-radius:999px;box-shadow:0 14px 34px rgba(0,71,65,.28);z-index:3000;font-weight:600;font-size:.95rem;overflow:hidden;';
        pop.textContent = 'Welcome Admin';
        const bar = document.createElement('div');
        bar.style.cssText = 'position:absolute;left:0;bottom:0;height:3px;width:100%;background:#f0ede4;opacity:.85;';
        pop.appendChild(bar);
        document.body.appendChild(pop);
        requestAnimationFrame(() => {
            pop.style.opacity = '1';
            pop.style.transform = 'translate(-50%,0)';
            bar.style.transition = 'width 1.8s linear';
            bar.style.width = '0';
        });
        setTimeout(() => { pop.style.opacity = '0'; pop.style.transform = 'translate(-50%,-10px)'; }, 1850);
        setTimeout(() => pop.remove(), 2200);
    };

    const updateAdminUI = () => {
        const uploadNavItem = document.getElementById('navUpload');
        const logoutBtn = document.getElementById('adminLogoutBtn');
        if (adminPass) {
            adminLoginBtn.style.display = 'none';
            if (uploadNavItem) uploadNavItem.style.display = '';
            if (logoutBtn) logoutBtn.style.display = '';
            uploadSection.style.display = 'block';
            renderCourses();
            renderSearch();
            renderLandingCourses();
            renderQuickAccess();
        } else {
            adminLoginBtn.style.display = '';
            if (uploadNavItem) uploadNavItem.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (uploadSection) uploadSection.style.display = 'none';
        }
        moveNavIndicator();
    };

    const openAdminLoginModal = () => {
        adminLoginModal.classList.add('active');
        adminPasswordInput.focus();
        loginError.style.display = 'none';
        adminPasswordInput.style.borderColor = '';
        updateLoginAttempts();
    };

    const closeAdminLoginModal = () => {
        adminLoginModal.classList.remove('active');
        adminPasswordInput.value = '';
        adminPasswordInput.type = 'password';
        if (togglePasswordIcon) togglePasswordIcon.className = 'bi bi-eye';
        loginError.style.display = 'none';
    };

    const updateLoginAttempts = () => {
        if (adminLoginAttempts > 0) {
            loginAttempts.textContent = `Attempts: ${adminLoginAttempts}/${maxLoginAttempts}`;
            loginAttempts.style.color = adminLoginAttempts >= 3 ? '#dc2626' : '#999';
        } else {
            loginAttempts.textContent = '';
        }
    };

    const showLoginError = (message) => {
        loginError.textContent = message;
        loginError.style.display = 'block';
        adminPasswordInput.style.borderColor = '#dc2626';
        adminPasswordInput.style.animation = 'shake 0.4s ease-in-out';
        setTimeout(() => {
            adminPasswordInput.style.animation = 'none';
        }, 400);
    };

    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const togglePasswordIcon = document.getElementById('togglePasswordIcon');

    if (togglePasswordBtn && adminPasswordInput && togglePasswordIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = adminPasswordInput.type === 'password';
            adminPasswordInput.type = isPassword ? 'text' : 'password';
            togglePasswordIcon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    }

    adminLoginBtn.addEventListener('click', openAdminLoginModal);

    // === Header hamburger menu ===
    const menuBtn = document.getElementById('menuBtn');
    const headerMenu = document.getElementById('headerMenu');
    const closeHeaderMenu = () => {
        if (headerMenu) headerMenu.classList.remove('open');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    };
    if (menuBtn && headerMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = headerMenu.classList.toggle('open');
            menuBtn.setAttribute('aria-expanded', String(isOpen));
            if (isOpen) requestAnimationFrame(moveNavIndicator);
        });
        headerMenu.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', closeHeaderMenu);
        });
        document.addEventListener('click', (e) => {
            if (headerMenu.classList.contains('open') && !e.target.closest('.header')) closeHeaderMenu();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeHeaderMenu();
        });
    }

    // === Admin logout ===
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', () => {
            adminPass = null;
            sessionStorage.removeItem('adminPass');
            updateAdminUI();
            renderCourses();
            renderSearch();
            renderLandingCourses();
            renderQuickAccess();
            closeHeaderMenu();
            showNotification('Logged out', 'info');
        });
    }

    adminCloseBtn.addEventListener('click', closeAdminLoginModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && adminLoginModal.classList.contains('active')) {
            closeAdminLoginModal();
        }
    });

    adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check if locked out
        if (adminLoginLockedUntil && new Date() < adminLoginLockedUntil) {
            const secondsLeft = Math.ceil((adminLoginLockedUntil - new Date()) / 1000);
            showLoginError(`Too many attempts. Try again in ${secondsLeft}s`);
            return;
        }

        const pass = adminPasswordInput.value.trim();

        if (!pass) {
            showLoginError('Password cannot be empty');
            return;
        }

        const grantAccess = () => {
            adminPass = pass;
            sessionStorage.setItem('adminPass', pass);
            adminLoginAttempts = 0;
            adminLoginLockedUntil = null;
            updateLoginAttempts();
            closeAdminLoginModal();
            updateAdminUI();
            showAdminWelcome();
        };

        const denyAccess = () => {
            adminLoginAttempts++;
            updateLoginAttempts();
            if (adminLoginAttempts >= maxLoginAttempts) {
                adminLoginLockedUntil = new Date(new Date().getTime() + 5 * 60000);
                showLoginError('Account locked for 5 minutes due to too many failed attempts');
            } else {
                const remaining = maxLoginAttempts - adminLoginAttempts;
                showLoginError(`Wrong password. ${remaining} attempt(s) remaining`);
            }
            adminPasswordInput.value = '';
            adminPasswordInput.focus();
        };

        // Server-side verification only — no local fallback of any kind.
        let response = null;
        try {
            response = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass, action: 'verify' })
            });
        } catch (error) {
            response = null;
        }

        if (response && response.ok) {
            grantAccess();
        } else if (response && response.status === 401) {
            denyAccess();
        } else {
            // Server unreachable or misconfigured: fail closed, and do not
            // count it as a wrong-password attempt.
            showLoginError('Could not verify with the server. Check your connection and try again.');
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aiModal.classList.contains('active')) {
            aiModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Recently Viewed — localStorage, one timestamped entry { f, t } per item.
    // Entries expire after RECENT_TTL_MIN minutes so the list clears itself
    // (per Wadi, 2026-10-22). Legacy plain-string entries get a fresh
    // timestamp on first load so nobody's list vanishes mid-use.
    const RECENTS_KEY = 'fa24bai_recents';
    const RECENT_TTL_MIN = 30; // change this one number to shorten/lengthen the timer
    const RECENT_TTL_MS = RECENT_TTL_MIN * 60 * 1000;
    let recents = [];
    try {
        const storedRecents = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
        if (Array.isArray(storedRecents)) recents = storedRecents.map(e =>
            typeof e === 'string' ? { f: e, t: Date.now() }
            : (e && typeof e.f === 'string' && typeof e.t === 'number') ? e : null
        ).filter(Boolean);
    } catch (e) {
        recents = [];
    }

    const saveRecents = () => {
        try {
            localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
        } catch (e) { /* private mode / quota: recents just stay in memory */ }
    };

    const pruneRecents = () => {
        const now = Date.now();
        const before = recents.length;
        recents = recents.filter(e => e && typeof e.f === 'string' && (now - e.t) < RECENT_TTL_MS);
        if (recents.length !== before) saveRecents();
    };
    pruneRecents();

    const addRecent = (filename) => {
        recents = recents.filter(e => e.f !== filename);
        recents.unshift({ f: filename, t: Date.now() });
        if (recents.length > 6) recents.length = 6;
        saveRecents();
        renderQuickAccess();
    };

    // While the page stays open, drop items as they cross the TTL.
    setInterval(() => { pruneRecents(); renderQuickAccess(); }, 60 * 1000);

    // === Shared helpers (Round 2) ===
    const DAY_MS = 24 * 60 * 60 * 1000;

    const escapeHtml = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Freshness badges (Wadi's rule, 2026-10-23): nothing already on the
    // site carries a badge. From now on, an upload gets a "New" badge for
    // 24 hours only, then it disappears on its own; "Updated" follows the
    // same from-now + 24h rule. Dates come from /api/files (git history).
    const NEW_BADGE_EPOCH = Date.parse('2026-10-23T02:12:00.000Z');
    const dateBadge = (file) => {
        const now = Date.now();
        const created = file.createdAt ? Date.parse(file.createdAt) : null;
        const updated = file.updatedAt ? Date.parse(file.updatedAt) : null;
        if (created && created > NEW_BADGE_EPOCH && now - created <= DAY_MS) {
            return '<span class="badge-fresh badge-new">New</span>';
        }
        if (updated && updated > NEW_BADGE_EPOCH && now - updated <= DAY_MS && (!created || updated - created > 60000)) {
            return '<span class="badge-fresh badge-updated">Updated</span>';
        }
        return '';
    };

    const timeAgo = (iso) => {
        const then = Date.parse(iso);
        if (isNaN(then)) return '';
        const days = Math.floor((Date.now() - then) / DAY_MS);
        if (days <= 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 30) return `${days} days ago`;
        const months = Math.floor(days / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    };

    const skeletonCardsHtml = (n) => Array.from({ length: n }, () => `
        <div class="skeleton-card" aria-hidden="true">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line med"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
        </div>`).join('');

    // === Bookmarks (Round 2) — starred materials in localStorage ===
    const BOOKMARKS_KEY = 'fa24bai_bookmarks';
    let bookmarks = [];
    try {
        const storedBookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
        if (Array.isArray(storedBookmarks)) bookmarks = storedBookmarks.filter(f => typeof f === 'string');
    } catch (e) {
        bookmarks = [];
    }

    const saveBookmarks = () => {
        try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks)); } catch (e) { /* ignore */ }
    };

    const isBookmarked = (filename) => bookmarks.includes(filename);

    window.toggleBookmark = (e, filename) => {
        if (e) e.stopPropagation();
        const nowBookmarked = !isBookmarked(filename);
        bookmarks = nowBookmarked
            ? [filename, ...bookmarks.filter(f => f !== filename)]
            : bookmarks.filter(f => f !== filename);
        saveBookmarks();
        // Reflect the new state on every star button for this file
        document.querySelectorAll('[data-bookmark]').forEach(btn => {
            if (btn.getAttribute('data-bookmark') === filename) {
                if (btn.classList.contains('fav')) btn.classList.toggle('active', nowBookmarked);
                const icon = btn.querySelector('i');
                if (icon) icon.className = nowBookmarked ? 'bi bi-star-fill' : 'bi bi-star';
                const lbl = btn.querySelector('.bookmark-label');
                if (lbl) lbl.textContent = nowBookmarked ? 'Remove Bookmark' : 'Bookmark';
            }
        });
        if (currentTab === 'bookmarks') renderBookmarks();
        showNotification(nowBookmarked ? 'Bookmarked for revision' : 'Bookmark removed', 'info');
    };

    const renderBookmarks = () => {
        if (!bookmarksContainer) return;
        if (filesState === 'loading') {
            bookmarksContainer.innerHTML = skeletonCardsHtml(3);
            return;
        }
        if (filesState === 'error') {
            bookmarksContainer.innerHTML = `
                <div class="no-results state-block" style="grid-column: 1 / -1;">
                    <p>We couldn't load the materials list. Check your connection and try again.</p>
                    <button type="button" class="retry-btn" onclick="window.retryLoadFiles()">Retry</button>
                </div>`;
            return;
        }
        const files = bookmarks.map(n => allFiles.find(f => f.rawName === n)).filter(Boolean);
        if (files.length === 0) {
            bookmarksContainer.innerHTML = '<div class="no-results" style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; color: #777;">No bookmarks yet. Tap the star on any material to save it here for revision week.</div>';
            return;
        }
        bookmarksContainer.innerHTML = files.map(f => createResourceHtml(f, { showCourse: true })).join('');
    };

    // === Download counts (Round 2) — /api/count, throttled per session ===
    let countsMap = {};
    const countedThisSession = new Set();

    const fetchCounts = async () => {
        try {
            const r = await fetch('/api/count');
            if (!r.ok) return;
            const d = await r.json();
            if (d && d.counts && typeof d.counts === 'object') {
                countsMap = d.counts;
                
                if (currentTab === 'bookmarks') renderBookmarks();
            }
        } catch (e) { /* counts are decorative — never block the UI */ }
    };

    const incrementCount = (filename) => {
        if (countedThisSession.has(filename)) return;
        countedThisSession.add(filename);
        countsMap[filename] = (countsMap[filename] || 0) + 1; // optimistic
        const payload = JSON.stringify({ name: filename });
        try {
            if (navigator.sendBeacon) {
                const blob = new Blob([payload], { type: 'application/json' });
                if (navigator.sendBeacon('/api/count', blob)) return;
            }
            fetch('/api/count', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(() => {});
        } catch (e) { /* ignore */ }
    };

    // === Recent searches (Round 2) ===
    const RECENT_SEARCHES_KEY = 'fa24bai_recent_searches';
    let recentSearches = [];
    try {
        const storedSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
        if (Array.isArray(storedSearches)) recentSearches = storedSearches.filter(s => typeof s === 'string');
    } catch (e) {
        recentSearches = [];
    }

    const saveRecentSearches = () => {
        try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches)); } catch (e) { /* ignore */ }
    };

    const saveRecentSearch = (q) => {
        const term = (q || '').trim();
        if (term.length < 2) return;
        recentSearches = [term, ...recentSearches.filter(s => s.toLowerCase() !== term.toLowerCase())].slice(0, 6);
        saveRecentSearches();
        renderRecentSearches();
    };

    const renderRecentSearches = () => {
        const box = document.getElementById('recentSearches');
        if (!box) return;
        const typing = searchInput && searchInput.value.trim().length > 0;
        if (recentSearches.length === 0 || typing) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        box.style.display = 'block';
        box.innerHTML = '<span class="recent-searches-label">Recent:</span>' +
            recentSearches.map(q => `<button type="button" class="recent-search-chip" onclick="window.runRecentSearch('${q.replace(/'/g, "\\'")}')"><i class="bi bi-clock-history"></i>${escapeHtml(q)}</button>`).join('') +
            '<button type="button" class="recent-search-clear" onclick="window.clearRecentSearches()">Clear</button>';
    };

    window.runRecentSearch = (q) => {
        searchQuery = q.toLowerCase();
        if (searchInput) searchInput.value = q;
        goTo('#/search?q=' + encodeURIComponent(q));
        renderSearch();
        renderRecentSearches();
    };

    window.clearRecentSearches = () => {
        recentSearches = [];
        saveRecentSearches();
        renderRecentSearches();
    };

    // Course mapping logic
    const getCourseInfo = (filepath) => {
        const lowerName = filepath.toLowerCase();
        // The course folder in the path ("5th Semester/OS/...") is the
        // ground truth. Filename substrings mis-file real lectures — e.g.
        // the WEB lecture "CSS_Cascading_Box_Model_and_Positioning" was
        // claimed by Operating Systems because "Positioning" contains "os"
        // and the 'os' check ran before the 'web' check.
        const segments = lowerName.split('/');
        const courseFolder = segments.length > 2 ? segments[1] : '';
        if (courseFolder === 'os') return { name: 'Operating Systems', code: 'CSC322', icon: 'OS' };
        if (courseFolder === 'web') return { name: 'Web Technologies', code: 'WEB', icon: 'WEB' };
        if (courseFolder === 'daa') return { name: 'Design and Analysis of Algorithms', code: 'DAA', icon: 'ALG' };
        if (courseFolder.includes('stat')) return { name: 'Probability & Statistics', code: 'MTH262', icon: 'STAT' };
        if (courseFolder.includes('pfai') || courseFolder.includes('programming')) return { name: 'Programming for Artificial Intelligence', code: 'AIC270', icon: 'AI' };
        if (courseFolder.includes('krr') || courseFolder.includes('knowledge')) return { name: 'Knowledge Rep. & Reasoning', code: 'AIC372', icon: 'KRR' };
        // Fallback for files outside the semester folder structure.
        if (lowerName.includes('pfai') || lowerName.includes('ai270') || lowerName.includes('aic270')) return { name: 'Programming for Artificial Intelligence', code: 'AIC270', icon: 'AI' };
        if (lowerName.includes('krr') || lowerName.includes('kr&r') || lowerName.includes('aic372')) return { name: 'Knowledge Rep. & Reasoning', code: 'AIC372', icon: 'KRR' };
        if (lowerName.includes('os') || lowerName.includes('csc322')) return { name: 'Operating Systems', code: 'CSC322', icon: 'OS' };
        if (lowerName.includes('stat') || lowerName.includes('mth262')) return { name: 'Probability & Statistics', code: 'MTH262', icon: 'STAT' };
        if (lowerName.includes('daa') || lowerName.includes('algorithm')) return { name: 'Design and Analysis of Algorithms', code: 'DAA', icon: 'ALG' };
        if (lowerName.includes('web')) return { name: 'Web Technologies', code: 'WEB', icon: 'WEB' };
        return { name: 'Other Resources', code: 'VAR', icon: 'DOC' };
    };

    const getResourceType = (filepath) => {
        const lowerName = filepath.toLowerCase();
        const detectType = (text) => {
            if (text.includes('cdf')) return 'CDF';
            if (text.includes('lab manual')) return 'Lab Manual';
            if (text.includes('syllabus')) return 'Syllabus';
            if (text.includes('notes')) return 'Notes';
            if (text.includes('lecture')) return 'Lectures';
            if (text.includes('assignment')) return 'Assignments';
            return null;
        };
        // Prefer the actual parent-folder segment (".../Notes/x.pdf") over
        // filename substrings, which mis-filed e.g. Statistics Notes as Other.
        const segments = lowerName.split('/');
        const folderSegment = segments.length > 1 ? segments[segments.length - 2] : '';
        return detectType(folderSegment) || detectType(lowerName) || 'Other';
    };

    const getCleanName = (filepath) => {
        let filename = filepath.split('/').pop();
        let clean = filename.replace(/\.(pdf|pptx|ppt|doc|docx)$/i, '');
        clean = clean.replace(/_/g, ' ');
        return clean;
    };

    window.toggleRogerMenu = (e, menuId) => {
        e.stopPropagation();
        const menu = document.getElementById(menuId);
        if (!menu) return;
        const isOpen = menu.classList.contains('active');
        window.closeAllRogerMenus();
        if (!isOpen) {
            menu.classList.add('active');
        }
    };

    window.closeAllRogerMenus = () => {
        document.querySelectorAll('.roger-dropdown.active').forEach(m => m.classList.remove('active'));
    };

    window.copyResourceLink = (filename) => {
        const file = allFiles.find(f => f.rawName === filename);
        const fullUrl = file ? materialDeepLink(file) : window.location.origin + '/' + encodeURI(filename);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullUrl).then(() => {
                showNotification('Resource link copied to clipboard', 'info');
            }).catch(() => {
                showNotification('Could not copy link', 'error');
            });
        } else {
            showNotification('Clipboard access unavailable', 'error');
        }
    };

    window.shareOnWhatsApp = (filename) => {
        const file = allFiles.find(f => f.rawName === filename);
        if (!file) return;
        const text = `📚 ${file.cleanName} (${file.course.code} · ${file.resourceType}) — FA24-BAI Study Hub\n${materialDeepLink(file)}`;
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    };

    document.addEventListener('click', () => {
        window.closeAllRogerMenus();
    });

    const createResourceHtml = (res, opts = {}) => {
        let viewUrl = res.rawName;
        if (viewUrl.match(/\.(pptx|ppt|docx|doc)$/i)) {
            // Encode the path segments properly for the raw github URL
            const encodedPath = res.rawName.split('/').map(encodeURIComponent).join('/');
            const rawGithubUrl = 'https://raw.githubusercontent.com/abduIwahid/fa24-bai/main/' + encodedPath;
            viewUrl = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(rawGithubUrl);
        }

        const escapedRawName = res.rawName.replace(/'/g, "\\'");
        const attrRawName = res.rawName.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const menuId = 'menu-' + Math.random().toString(36).substring(2, 9);
        const fav = isBookmarked(res.rawName);
        const dlCount = countsMap[res.rawName] || 0;

        return `
            <div class="resource-item" data-file="${attrRawName}">
                <div class="resource-main">
                    <div class="resource-name">${res.cleanName}${dateBadge(res)}</div>
                    <div><span class="resource-type-badge">${res.resourceType}</span>${dlCount > 0 ? `<span class="download-count"><i class="bi bi-download"></i> ${dlCount}</span>` : ''}</div>
                    ${opts.showCourse ? `<button type="button" class="resource-course-link" onclick="window.openFolder('${res.resourceType}', '${res.course.code}', '${res.course.name.replace(/'/g, "\\'")}')">${res.course.code} · ${res.course.name} &rarr;</button>` : ''}
                </div>
                <div class="resource-actions">
                    <a href="${viewUrl}" target="_blank" class="action-btn view" onclick="window.trackView('${escapedRawName}')">Open</a>
                    <div class="roger-menu-wrap">
                        <button type="button" class="roger-btn" onclick="window.toggleRogerMenu(event, '${menuId}')" aria-label="Resource options" title="Options">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <div class="roger-dropdown" id="${menuId}">
                            <a href="${viewUrl}" target="_blank" class="roger-item" onclick="window.trackView('${escapedRawName}'); window.closeAllRogerMenus();">
                                <i class="bi bi-box-arrow-up-right"></i> Open Resource
                            </a>
                            <button type="button" class="roger-item" onclick="window.openAI('${escapedRawName}'); window.closeAllRogerMenus();">
                                <i class="bi bi-chat-left-dots"></i> AI Assistant
                            </button>
                            <button type="button" class="roger-item" onclick="window.copyResourceLink('${escapedRawName}'); window.closeAllRogerMenus();">
                                <i class="bi bi-link-45deg"></i> Copy Link
                            </button>
                            <button type="button" class="roger-item" data-bookmark="${attrRawName}" onclick="window.toggleBookmark(event, '${escapedRawName}'); window.closeAllRogerMenus();">
                                <i class="bi ${fav ? 'bi-star-fill' : 'bi-star'}"></i> <span class="bookmark-label">${fav ? 'Remove Bookmark' : 'Bookmark'}</span>
                            </button>
                            <button type="button" class="roger-item" onclick="window.shareOnWhatsApp('${escapedRawName}'); window.closeAllRogerMenus();">
                                <i class="bi bi-whatsapp"></i> Share on WhatsApp
                            </button>
                            ${adminPass ? `
                            <button type="button" class="roger-item danger" onclick="window.deleteFile('${escapedRawName}'); window.closeAllRogerMenus();">
                                <i class="bi bi-trash3"></i> Delete
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    window.trackView = (filename) => {
        addRecent(filename);
        incrementCount(filename);
    };

    window.deleteFile = async (filename) => {
        if (!confirm(`Are you sure you want to permanently delete ${filename}?`)) return;

        try {
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, password: adminPass })
            });
            if (response.ok) {
                alert("File deleted successfully!");
                loadFiles();
            } else {
                const data = await response.json();
                alert(`Error: ${data.message}`);
                if (response.status === 401) {
                    sessionStorage.removeItem('adminPass');
                    adminPass = null;
                    location.reload();
                }
            }
        } catch (e) {
            alert("Delete failed.");
        }
    };
    window.openAI = (filename) => {
        currentAiFile = allFiles.find(f => f.rawName === filename);
        if (!currentAiFile) return;
        aiModalSubtitle.textContent = currentAiFile.cleanName;
        chatContainer.innerHTML = '<div class="chat-message ai">Hi! I\'m your AI study assistant. Ask me anything about this document, or use the quick actions above.</div>';
        aiModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    aiCloseBtn.addEventListener('click', () => {
        aiModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });

    const formatMarkdown = (str) => {
        if (!str) return '';
        let s = String(str);
        // Scrub LaTeX so answers never show raw $$ / \text{} junk
        s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1').replace(/\$([^$\n]+)\$/g, '$1');
        s = s.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, '$1');
        s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
        s = s.replace(/\\rightarrow|\\to\b/g, '\u2192').replace(/\\leftarrow/g, '\u2190')
             .replace(/\\leq/g, '\u2264').replace(/\\geq/g, '\u2265').replace(/\\times/g, '\u00d7')
             .replace(/\\cdot/g, '\u00b7').replace(/\\pm/g, '\u00b1').replace(/\\infty/g, '\u221e')
             .replace(/\\approx/g, '\u2248').replace(/\\neq/g, '\u2260');
        s = s.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
        let escaped = s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        escaped = escaped.split('\n').map(line => {
            const h = line.match(/^#{1,6}\s+(.*)$/);
            if (h) return `<div style="font-weight:700;margin:10px 0 4px;">${h[1]}</div>`;
            if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) return '<hr style="border:none;border-top:1px solid rgba(0,71,65,0.18);margin:10px 0;">';
            const b = line.match(/^\s*[-*\u2022]\s+(.*)$/);
            if (b) return `\u2022 ${b[1]}`;
            return line;
        }).join('\n');
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
        escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:2px 4px;border-radius:3px;">$1</code>');
        escaped = escaped.replace(/\n/g, '<br>');
        escaped = escaped.replace(/(<br>)+(<div style="font-weight:700)/g, '$2').replace(/(<\/div>)(<br>)+/g, '$1');
        escaped = escaped.replace(/(<br>)+(<hr)/g, '$2').replace(/(<hr[^>]*>)(<br>)+/g, '$1');
        return escaped;
    };

    const addChatMessage = (text, sender) => {
        const msg = document.createElement('div');
        msg.className = `chat-message ${sender}`;
        if (sender === 'ai') {
            msg.innerHTML = formatMarkdown(text);
        } else {
            msg.textContent = text;
        }
        chatContainer.appendChild(msg);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    let isAiGenerating = false;
    let lastAiRequestTime = 0;
    const AI_COOLDOWN_MS = 2500; // 2.5s anti-spam cooldown

    const handleAiRequest = async (prompt, action = 'chat') => {
        if (!currentAiFile || isAiGenerating) return;

        const now = Date.now();
        if (now - lastAiRequestTime < AI_COOLDOWN_MS) {
            showNotification('Please wait a moment before sending another AI request.', 'info');
            return;
        }

        if (action === 'chat' && !prompt.trim()) return;
        lastAiRequestTime = now;

        if (action === 'chat') {
            addChatMessage(prompt, 'user');
            aiInput.value = '';
        } else {
            const labelMap = {
                summarize: 'Summarize Document',
                quiz: 'Generate Practice Quiz',
                viva: 'Generate Viva Questions'
            };
            addChatMessage(labelMap[action] || action, 'user');
        }

        isAiGenerating = true;
        aiSendBtn.disabled = true;
        aiActionBtns.forEach(b => b.disabled = true);

        // Typing indicator
        const typingId = Date.now();
        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message ai';
        typingEl.id = `typing-${typingId}`;
        typingEl.textContent = 'Analyzing document...';
        chatContainer.appendChild(typingEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: currentAiFile.rawName,
                    prompt: prompt,
                    action: action
                })
            });
            const data = await response.json();
            const placeholder = document.getElementById(`typing-${typingId}`);
            if (placeholder) placeholder.remove();

            if (response.ok && data.reply) {
                if (action === 'quiz') {
                    const parsedQuiz = parseMcqQuiz(data.reply);
                    if (parsedQuiz && parsedQuiz.length >= 2) {
                        renderInteractiveQuiz(parsedQuiz, data.reply);
                    } else {
                        addChatMessage(data.reply, 'ai');
                    }
                } else {
                    addChatMessage(data.reply, 'ai');
                }
            } else {
                addChatMessage(data.reply || 'Could not process request at this time.', 'ai');
            }
        } catch (e) {
            const placeholder = document.getElementById(`typing-${typingId}`);
            if (placeholder) placeholder.remove();
            addChatMessage('Connection issue. Please verify internet and try again.', 'ai');
        } finally {
            isAiGenerating = false;
            aiSendBtn.disabled = false;
            aiActionBtns.forEach(b => b.disabled = false);
        }
    };

    // === Interactive practice quiz (Round 2) ==========================
    // Tolerant parser for the Gemini quiz format produced by /api/ask:
    // numbered questions, lettered options (A–D), and an "Answers &
    // Explanations" section. Also understands an inline "Correct answer: B"
    // per question. Returns null when the text isn't MCQ-shaped so the
    // caller can fall back to the plain-text rendering.
    const parseMcqQuiz = (text) => {
        if (!text || typeof text !== 'string') return null;
        const lines = text.split(/\r?\n/);

        const answersIdx = lines.findIndex(l =>
            /answers?\s*(?:&|and)?\s*explanations?/i.test(l) || /answer\s*key/i.test(l));
        const mainLines = answersIdx >= 0 ? lines.slice(0, answersIdx) : lines;
        const answerLines = answersIdx >= 0 ? lines.slice(answersIdx + 1) : [];

        // Answer key: "1. B — explanation" / "1) B: explanation" ...
        const answers = {};
        let curAns = null;
        answerLines.forEach(l => {
            const m = l.match(/^\s*(?:[-*•]\s*)?(?:\*\*)?\s*(?:Q(?:uestion)?\s*)?(\d{1,2})\s*[\).\:\-]\s*(?:\*\*)?\s*\(?([A-Da-d])\)?\b[\s\.\:\-—]*(.*)$/);
            if (m) {
                curAns = parseInt(m[1], 10);
                answers[curAns] = { letter: m[2].toUpperCase(), explanation: (m[3] || '').trim() };
            } else if (curAns && l.trim()) {
                answers[curAns].explanation = (answers[curAns].explanation + ' ' + l.trim()).trim();
            }
        });

        // Question blocks
        const qStart = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*(?:Q(?:uestion)?\s*)?(\d{1,2})\s*[\).\:]\s*(?:\*\*)?\s*(.*)$/i;
        const optLine = /^\s*(?:[-*•]\s*)?(?:\*\*)?\s*\(?([A-D])[\).\:\-]\s*(?:\*\*)?\s*(.+)$/;
        const blocks = [];
        let cur = null;
        mainLines.forEach(l => {
            const om = l.match(optLine);
            const qm = om ? null : l.match(qStart);
            if (qm) {
                cur = { num: parseInt(qm[1], 10), question: (qm[2] || '').trim(), options: [], inlineAnswer: null };
                blocks.push(cur);
            } else if (om && cur) {
                cur.options.push({ letter: om[1].toUpperCase(), text: om[2].trim() });
            } else if (cur && /correct\s*answer/i.test(l)) {
                const cm = l.match(/correct\s*answer[^A-Da-d]*\(?([A-D])\)?/i);
                if (cm) cur.inlineAnswer = cm[1].toUpperCase();
            } else if (cur && cur.options.length === 0 && l.trim()) {
                cur.question = (cur.question + ' ' + l.trim()).trim();
            }
        });

        const clean = (s) => String(s || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
        const questions = [];
        blocks.forEach(b => {
            if (!b.question || b.options.length < 2) return;
            let ans = null;
            let expl = '';
            const rec = answers[b.num];
            if (rec) { ans = rec.letter; expl = rec.explanation || ''; }
            else if (b.inlineAnswer) ans = b.inlineAnswer;
            if (!ans) return;
            if (!b.options.some(o => o.letter === ans)) return;
            expl = clean(expl).replace(/^correct answer[:\s]*/i, '');
            questions.push({
                question: clean(b.question),
                options: b.options.map(o => ({ letter: o.letter, text: clean(o.text) })),
                answer: ans,
                explanation: expl
            });
        });

        return questions.length >= 2 ? questions : null;
    };
    window.parseMcqQuiz = parseMcqQuiz; // exposed for testing

    const renderInteractiveQuiz = (questions, rawText) => {
        const wrap = document.createElement('div');
        wrap.className = 'chat-message ai';
        wrap.style.cssText = 'max-width: 100%; width: 100%; background: transparent; padding: 0;';
        const card = document.createElement('div');
        card.className = 'quiz-card';
        wrap.appendChild(card);
        chatContainer.appendChild(wrap);

        let idx = 0;
        let score = 0;

        const renderStep = () => {
            card.innerHTML = '';

            if (idx >= questions.length) {
                const done = document.createElement('div');
                done.className = 'quiz-done';
                done.innerHTML = `
                    <div class="quiz-progress">Quiz complete</div>
                    <div class="quiz-done-score">${score} / ${questions.length}</div>
                    <p style="margin: 0.4rem 0 0;">${score === questions.length
                        ? 'Perfect score — exam ready!'
                        : score >= Math.ceil(questions.length / 2)
                            ? 'Good effort — review the explanations and retry.'
                            : 'Keep practicing — retry and read each explanation.'}</p>`;
                card.appendChild(done);
                const foot = document.createElement('div');
                foot.className = 'quiz-footer';
                const retry = document.createElement('button');
                retry.className = 'quiz-retry-btn';
                retry.textContent = 'Retry Quiz';
                retry.addEventListener('click', () => { idx = 0; score = 0; renderStep(); });
                const toggle = document.createElement('button');
                toggle.className = 'quiz-text-toggle';
                toggle.textContent = 'Show original text';
                toggle.addEventListener('click', () => {
                    wrap.className = 'chat-message ai';
                    wrap.style.cssText = '';
                    wrap.innerHTML = formatMarkdown(rawText);
                });
                foot.appendChild(retry);
                foot.appendChild(toggle);
                card.appendChild(foot);
                chatContainer.scrollTop = chatContainer.scrollHeight;
                return;
            }

            const q = questions[idx];

            const prog = document.createElement('div');
            prog.className = 'quiz-progress';
            prog.textContent = `Question ${idx + 1} of ${questions.length}`;
            card.appendChild(prog);

            const qEl = document.createElement('div');
            qEl.className = 'quiz-question';
            qEl.textContent = q.question;
            card.appendChild(qEl);

            const opts = document.createElement('div');
            opts.className = 'quiz-options';
            card.appendChild(opts);

            const expl = document.createElement('div');
            expl.className = 'quiz-explanation';
            expl.style.display = 'none';
            card.appendChild(expl);

            const foot = document.createElement('div');
            foot.className = 'quiz-footer';
            const scoreEl = document.createElement('span');
            scoreEl.className = 'quiz-score';
            scoreEl.textContent = `Score: ${score}`;
            const nextBtn = document.createElement('button');
            nextBtn.className = 'quiz-next-btn';
            nextBtn.textContent = idx === questions.length - 1 ? 'See Results' : 'Next Question';
            nextBtn.style.display = 'none';
            nextBtn.addEventListener('click', () => { idx++; renderStep(); });
            foot.appendChild(scoreEl);
            foot.appendChild(nextBtn);
            card.appendChild(foot);

            q.options.forEach(opt => {
                const b = document.createElement('button');
                b.className = 'quiz-option';
                b.textContent = `${opt.letter}. ${opt.text}`;
                b.addEventListener('click', () => {
                    const isCorrect = opt.letter === q.answer;
                    if (isCorrect) score++;
                    opts.querySelectorAll('button').forEach(x => {
                        x.disabled = true;
                        if (x.textContent.startsWith(q.answer + '.')) x.classList.add('correct');
                    });
                    if (!isCorrect) b.classList.add('wrong');
                    if (q.explanation) {
                        expl.textContent = q.explanation;
                        expl.style.display = 'block';
                    }
                    scoreEl.textContent = `Score: ${score}`;
                    nextBtn.style.display = 'inline-flex';
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                });
                opts.appendChild(b);
            });

            chatContainer.scrollTop = chatContainer.scrollHeight;
        };

        renderStep();
    };

    aiSendBtn.addEventListener('click', () => handleAiRequest(aiInput.value, 'chat'));
    aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAiRequest(aiInput.value, 'chat');
    });

    aiActionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            handleAiRequest('', action);
        });
    });

    // Render logic
    const renderQuickAccess = () => {
        pruneRecents();
        if (recents.length === 0) {
            quickAccessContainer.style.display = 'none';
            return;
        }
        quickAccessContainer.style.display = 'block';
        quickAccessList.innerHTML = '';

        recents.forEach(entry => {
            const file = allFiles.find(f => f.rawName === entry.f);
            if (file) {
                quickAccessList.innerHTML += createResourceHtml(file);
            }
        });
    };

    window.openCourse = (code, name) => {
        goTo('#/course/' + encodeURIComponent(code));
    };

    window.openCourseFromLanding = (code, name) => {
        goTo('#/course/' + encodeURIComponent(code));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.openFolder = (folderName, courseCode = null, courseName = null) => {
        const code = courseCode || selectedCourseCode;
        if (!code) { goTo('#/courses'); return; }
        goTo('#/course/' + encodeURIComponent(code) + '/' + encodeURIComponent(folderName));
    };

    // Jump straight to a specific material (search results): folder route
    // with a ?file= target that gets scrolled to + highlighted.
    window.openMaterial = (filename) => {
        const file = allFiles.find(f => f.rawName === filename);
        if (!file) return;
        goTo(buildMaterialHash(file));
    };

    const CORE_COURSES = [
        { code: 'AIC270', name: 'Programming for Artificial Intelligence' },
        { code: 'AIC372', name: 'Knowledge Rep. & Reasoning' },
        { code: 'CSC322', name: 'Operating Systems' },
        { code: 'MTH262', name: 'Probability & Statistics' },
        { code: 'DAA',    name: 'Design and Analysis of Algorithms' },
        { code: 'WEB',    name: 'Web Technologies' }
    ];

    const renderLandingCourses = () => {
        if (!landingCoursesGrid) return;

        if (filesState === 'loading') {
            landingCoursesGrid.innerHTML = skeletonCardsHtml(6);
            return;
        }

        const coursesMap = {};
        allFiles.forEach(file => {
            if (!coursesMap[file.course.code]) {
                coursesMap[file.course.code] = { info: file.course, count: 0, folderTypes: new Set() };
            }
            coursesMap[file.course.code].count++;
            coursesMap[file.course.code].folderTypes.add(file.resourceType);
        });

        let list = Object.values(coursesMap);
        if (list.length === 0) {
            list = CORE_COURSES.map(c => ({
                info: c,
                count: 0,
                folderTypes: new Set()
            }));
        }

        landingCoursesGrid.innerHTML = list.map(courseData => {
            const escapedName = courseData.info.name.replace(/'/g, "\\'");
            const filesHtml = courseData.count > 0
                ? `<div class="course-files-count">${courseData.count} files</div>`
                : `<div class="course-files-note">Syllabus, CDF, lab manuals, and lecture slides</div>`;

            return `
                <div class="course-card landing-course-card" style="cursor: pointer;" onclick="window.openCourseFromLanding('${courseData.info.code}', '${escapedName}')">
                    <div class="course-info">
                        <h2 style="font-size: 1.18rem; margin: 0 0 0.3rem 0;">${courseData.info.name}</h2>
                        <p class="course-code" style="margin: 0;">${courseData.info.code}</p>
                    </div>
                    ${filesHtml}
                </div>
            `;
        }).join('');
    };

    const renderSearch = () => {
        if (!searchResultsContainer) return;

        // Loading / error states (data comes from /api/files via loadFiles)
        if (filesState === 'loading') {
            if (searchResultsInfo) searchResultsInfo.textContent = 'Loading study materials...';
            searchResultsContainer.innerHTML = skeletonCardsHtml(4);
            return;
        }
        if (filesState === 'error') {
            if (searchResultsInfo) searchResultsInfo.textContent = 'Could not load study materials.';
            searchResultsContainer.innerHTML = `
                <div class="no-results state-block" style="grid-column: 1 / -1;">
                    <p>We couldn't load the materials list. Check your connection and try again.</p>
                    <button type="button" class="retry-btn" onclick="window.retryLoadFiles()">Retry</button>
                </div>`;
            return;
        }

        const query = searchQuery.trim().toLowerCase();
        const tokens = query.split(/\s+/).filter(Boolean);

        // Search covers title AND full repo path, token by token, so
        // "os lab manual" or "statistics notes" find the right file.
        const haystackOf = (file) => [file.name, file.cleanName, file.rawName, file.course.name, file.course.code, file.resourceType].join(' ').toLowerCase();

        const scoreOf = (file) => {
            if (!query) return 0;
            const name = file.cleanName.toLowerCase();
            let score = 0;
            if (name.startsWith(query)) score += 100;
            else if (name.includes(query)) score += 60;
            if (file.name.toLowerCase().includes(query)) score += 25;
            if (file.course.code.toLowerCase() === query || file.course.name.toLowerCase().includes(query)) score += 20;
            if (file.resourceType.toLowerCase() === query) score += 15;
            return score;
        };

        const filteredFiles = allFiles
            .filter(file => {
                const matchesFilter = currentFilter === 'All' || file.resourceType === currentFilter;
                if (!matchesFilter) return false;
                if (tokens.length === 0) return true;
                const hay = haystackOf(file);
                return tokens.every(token => hay.includes(token));
            })
            .map(file => ({ file, score: scoreOf(file) }))
            .sort((a, b) => (b.score - a.score) || a.file.cleanName.localeCompare(b.file.cleanName))
            .map(entry => entry.file);

        if (searchResultsInfo) {
            if (filteredFiles.length === 0) {
                searchResultsInfo.textContent = `No materials found${query ? ` matching "${query}"` : ''}${currentFilter !== 'All' ? ` with filter "${currentFilter}"` : ''}.`;
            } else {
                searchResultsInfo.textContent = `Showing ${filteredFiles.length} of ${allFiles.length} study material(s)${currentFilter !== 'All' ? ` (${currentFilter})` : ''}`;
            }
        }

        if (filteredFiles.length === 0) {
            searchResultsContainer.innerHTML = '<div class="no-results" style="grid-column: 1 / -1; padding: 2.5rem 1rem; text-align: center; color: #777;">No matching documents. Try a different search query or select another filter.</div>';
            return;
        }

        // Group results under course headers; groups are ordered by their
        // best-scoring file so the most relevant course comes first.
        const groups = [];
        const groupMap = {};
        filteredFiles.forEach(f => {
            if (!groupMap[f.course.code]) {
                groupMap[f.course.code] = { info: f.course, files: [] };
                groups.push(groupMap[f.course.code]);
            }
            groupMap[f.course.code].files.push(f);
        });

        let html = '';
        groups.forEach(g => {
            html += `<div class="search-group-header">${g.info.code} · ${g.info.name}<span class="group-count">${g.files.length} item(s)</span></div>`;
            html += g.files.map(res => createResourceHtml(res, { showCourse: true })).join('');
        });
        searchResultsContainer.innerHTML = html;
    };

    const renderCourses = () => {
        // Shared loading / error states for every courses sub-view
        if (filesState === 'loading') {
            navigationBar.style.display = currentView === 'all' ? 'none' : 'flex';
            if (currentView !== 'all' && selectedCourseName) currentPath.textContent = selectedCourseName;
            coursesContainer.innerHTML = skeletonCardsHtml(6);
            return;
        }
        if (filesState === 'error') {
            navigationBar.style.display = 'none';
            coursesContainer.innerHTML = `
                <div class="no-results state-block">
                    <p>We couldn't load the materials list. Check your connection and try again.</p>
                    <button type="button" class="retry-btn" onclick="window.retryLoadFiles()">Retry</button>
                </div>`;
            return;
        }

        if (currentView === 'all') {
            navigationBar.style.display = 'none';
            controlsSection.style.display = 'none';
            quickAccessContainer.style.display = 'none';

            if (allFiles.length === 0) {
                coursesContainer.innerHTML = '<div class="no-results">No resources found.</div>';
                return;
            }

            const coursesMap = {};
            allFiles.forEach(file => {
                if (!coursesMap[file.course.code]) {
                    coursesMap[file.course.code] = { info: file.course, resources: [], folderTypes: new Set() };
                }
                coursesMap[file.course.code].resources.push(file);
                coursesMap[file.course.code].folderTypes.add(file.resourceType);
            });

            coursesContainer.innerHTML = `
                <div class="request-strip">
                    <div class="request-strip-text">
                        <h3><i class="bi bi-envelope-paper-fill"></i> Missing something?</h3>
                        <p>Request a material or share your notes with the cohort.</p>
                    </div>
                    <button type="button" class="action-btn request-btn" onclick="window.openRequestForm();">
                        <i class="bi bi-send-fill"></i> Request a Material
                    </button>
                </div>`;
            Object.values(coursesMap).forEach(courseData => {
                const courseEl = document.createElement('div');
                courseEl.className = 'course-card';

                const mainResources = courseData.resources.filter(r => r.resourceType === 'CDF' || r.resourceType === 'Lab Manual');
                let resourcesHtml = mainResources.map(res => createResourceHtml(res)).join('');

                // Every other category (Lectures, Syllabus, Assignments,
                // Notes, Other) gets a folder shortcut, so nothing is hidden.
                const shortcutTypes = [...courseData.folderTypes].filter(t => t !== 'CDF' && t !== 'Lab Manual');
                shortcutTypes.forEach(type => {
                    const count = courseData.resources.filter(r => r.resourceType === type).length;
                    resourcesHtml += `
                        <div class="resource-item folder-shortcut" onclick="window.openFolder('${type}', '${courseData.info.code}', '${courseData.info.name.replace(/'/g, "\\'")}')">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.4rem; color: var(--accent); display:flex; align-items:center;"><i class="bi bi-folder-fill"></i></span>
                                <div>
                                    <div class="resource-name">${type}</div>
                                    <div style="font-size: 0.8rem; color: #666;">${count} item(s)</div>
                                </div>
                            </div>
                            <div class="resource-actions">
                                <span style="color: var(--accent); font-weight: bold; font-size: 0.9rem;">Open &rarr;</span>
                            </div>
                        </div>
                    `;
                });

                if (mainResources.length === 0 && shortcutTypes.length === 0 && courseData.resources.length > 0) {
                    resourcesHtml = `<p style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">(Only specific resources are directly visible here)</p>`;
                }

                courseEl.innerHTML = `
                    <div class="course-header" style="cursor: pointer;" onclick="window.openCourse('${courseData.info.code}', '${courseData.info.name.replace(/'/g, "\\'")}')">
                        <div class="course-info">
                            <h2>${courseData.info.name}</h2>
                            <p class="course-code">${courseData.folderTypes.size} Folder(s)</p>
                        </div>
                    </div>
                    <div class="resources-list">
                        ${resourcesHtml}
                    </div>
                    <button class="action-btn" style="width: 100%; padding: 10px; background: #e0e0e0; color: #111; border: none; font-weight: bold; cursor: pointer; border-radius: 6px;" onclick="window.openCourse('${courseData.info.code}', '${courseData.info.name.replace(/'/g, "\\'")}')">View Course Details</button>
                `;
                coursesContainer.appendChild(courseEl);
            });
        }
        else if (currentView === 'course') {
            navigationBar.style.display = 'flex';
            controlsSection.style.display = 'none';
            quickAccessContainer.style.display = 'none';
            currentPath.textContent = selectedCourseName;

            const courseFiles = allFiles.filter(f => f.course.code === selectedCourseCode);
            const folderTypes = new Set(courseFiles.map(f => f.resourceType));

            coursesContainer.innerHTML = '';

            if (folderTypes.size === 0) {
                coursesContainer.innerHTML = '<div class="no-results">No folders found in this course.</div>';
                return;
            }

            // Course dashboard header: quick chips for Syllabus/CDF,
            // material count, last-updated, and this course's next deadline.
            const syllabusFile = courseFiles.find(f => f.resourceType === 'Syllabus');
            const cdfFile = courseFiles.find(f => f.resourceType === 'CDF');
            const lastUpdated = courseFiles.reduce((mx, f) =>
                (f.updatedAt && (!mx || Date.parse(f.updatedAt) > Date.parse(mx))) ? f.updatedAt : mx, null);
            const deadline = (typeof nextDeadlineForCourse === 'function')
                ? nextDeadlineForCourse(selectedCourseCode) : null;

            const dash = document.createElement('div');
            dash.className = 'course-dash';
            dash.innerHTML = `
                <div class="course-dash-top">
                    <div>
                        <h2>${escapeHtml(selectedCourseName || '')}</h2>
                        <p class="course-dash-meta">${escapeHtml(selectedCourseCode || '')} · ${courseFiles.length} material(s)${lastUpdated ? ` · Last updated ${timeAgo(lastUpdated)}` : ''}</p>
                    </div>
                </div>
                ${(syllabusFile || cdfFile) ? `
                <div class="course-dash-chips">
                    ${syllabusFile ? `<button type="button" class="dash-chip" onclick="window.openFolder('Syllabus')"><i class="bi bi-list-task"></i> Syllabus</button>` : ''}
                    ${cdfFile ? `<button type="button" class="dash-chip" onclick="window.openFolder('CDF')"><i class="bi bi-file-earmark-text-fill"></i> CDF</button>` : ''}
                </div>` : ''}
                ${deadline ? `<div class="course-dash-deadline"><i class="bi bi-alarm-fill"></i> Next deadline: <strong>${escapeHtml(String(deadline.text || '').split('\n')[0])}</strong> — ${fmtExamDate(deadline.examDate)} · ${daysLabel(daysUntil(deadline.examDate))}</div>` : ''}
            `;
            coursesContainer.appendChild(dash);

            folderTypes.forEach(folder => {
                const folderFiles = courseFiles.filter(f => f.resourceType === folder);
                const folderCard = document.createElement('div');
                folderCard.className = 'course-card';
                folderCard.style.cursor = 'pointer';
                folderCard.onclick = () => window.openFolder(folder);

                // Pick an icon per folder type
                const folderIcons = {
                    'Lectures':    'bi-camera-video-fill',
                    'Lab Manual':  'bi-journal-code',
                    'CDF':         'bi-file-earmark-text-fill',
                    'Syllabus':    'bi-list-task',
                    'Assignments': 'bi-pencil-square',
                    'Notes':       'bi-journal-text',
                    'Other':       'bi-folder-fill',
                };
                const iconClass = folderIcons[folder] || 'bi-folder-fill';

                folderCard.innerHTML = `
                    <div class="course-header">
                        <div class="course-icon" style="display:flex;align-items:center;justify-content:center;">
                            <i class="bi ${iconClass}" style="font-size:1.8rem; color:var(--accent);"></i>
                        </div>
                        <div class="course-info">
                            <h2>${folder}</h2>
                            <p class="course-code">${folderFiles.length} item(s)</p>
                        </div>
                    </div>
                `;
                coursesContainer.appendChild(folderCard);
            });
        }
        else if (currentView === 'folder') {
            navigationBar.style.display = 'flex';
            controlsSection.style.display = 'none';
            quickAccessContainer.style.display = 'none';
            currentPath.textContent = `${selectedCourseName} > ${selectedFolder}`;

            // Newest uploads first: the latest lecture sits on top, and a
            // newly added file automatically takes the top spot.
            const folderFiles = allFiles
                .filter(f => f.course.code === selectedCourseCode && f.resourceType === selectedFolder)
                .sort((a, b) => (Date.parse(b.createdAt || b.updatedAt) || 0) - (Date.parse(a.createdAt || a.updatedAt) || 0));

            coursesContainer.innerHTML = '';

            if (folderFiles.length === 0) {
                coursesContainer.innerHTML = '<div class="no-results">Folder is empty.</div>';
                return;
            }

            const folderContainer = document.createElement('div');
            folderContainer.className = 'course-card folder-card';
            folderContainer.innerHTML = `
                <div class="course-header" style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 15px;">
                    <div class="course-info">
                        <h2>${selectedFolder}</h2>
                        <p class="course-code">${folderFiles.length} item(s)</p>
                    </div>
                </div>
                <div class="folder-resources-grid">
                    ${folderFiles.map(res => createResourceHtml(res)).join('')}
                </div>
            `;
            coursesContainer.appendChild(folderContainer);
        }
    };

    // Retry entry point used by the error states in Search / Courses views
    window.retryLoadFiles = () => {
        filesState = 'loading';
        renderSearch();
        renderCourses();
        loadFiles(true);
    };

    // Load Files with Session Storage Caching (5 min TTL)
    const FILES_CACHE_KEY = 'fa24bai_files_cache';
    const FILES_CACHE_TIME_KEY = 'fa24bai_files_cache_time';
    const CACHE_TTL_MS = 5 * 60 * 1000;

    async function loadFiles(forceRefresh = false) {
        try {
            let data = null;
            const cachedTime = parseInt(sessionStorage.getItem(FILES_CACHE_TIME_KEY) || '0', 10);
            const isCacheValid = !forceRefresh && (Date.now() - cachedTime < CACHE_TTL_MS);

            if (isCacheValid) {
                const cachedDataStr = sessionStorage.getItem(FILES_CACHE_KEY);
                if (cachedDataStr) {
                    try {
                        data = JSON.parse(cachedDataStr);
                    } catch (e) {
                        data = null;
                    }
                }
            }

            if (!data) {
                const response = await fetch('/api/files');
                if (response.ok) {
                    data = await response.json();
                    try {
                        sessionStorage.setItem(FILES_CACHE_KEY, JSON.stringify(data));
                        sessionStorage.setItem(FILES_CACHE_TIME_KEY, Date.now().toString());
                    } catch (storageErr) {
                        // Storage full or private mode, proceed without session cache
                    }
                } else {
                    filesState = 'error';
                    renderLandingCourses();
                    renderSearch();
                    renderCourses();
                    return;
                }
            }

            if (Array.isArray(data)) {
                filesState = 'ready';
                const pdfs = data.filter(file => file.name && file.name.match(/\.(pdf|pptx|ppt|doc|docx)$/i));

                allFiles = pdfs.map(file => {
                    const courseInfo = getCourseInfo(file.name);
                    const rType = getResourceType(file.name);
                    return {
                        rawName: file.name,
                        name: file.name,
                        course: courseInfo,
                        resourceType: rType,
                        cleanName: getCleanName(file.name),
                        createdAt: file.createdAt || null,
                        updatedAt: file.updatedAt || null
                    };
                });

                // Extract unique folders
                const folders = new Set();
                allFiles.forEach(file => {
                    if (file.rawName.includes('/')) {
                        const folder = file.rawName.substring(0, file.rawName.lastIndexOf('/'));
                        folders.add(folder);
                    }
                });

                if (folderOptions) {
                    folderOptions.innerHTML = '';
                    folders.forEach(folder => {
                        const option = document.createElement('option');
                        option.value = folder;
                        folderOptions.appendChild(option);
                    });
                }

                updateAdminUI();
                renderLandingCourses();
                renderSearch();
                renderCourses();
                renderQuickAccess();
                // Re-apply the current URL route now that data is ready —
                // this is what makes a cold deep link land in the right view.
                applyRoute();
                fetchCounts();
            }
        } catch (error) {
            filesState = 'error';
            renderLandingCourses();
            renderSearch();
            renderCourses();
        }
    }

    // Initial route + data load happen at the END of this script (after
    // every renderer/helper is defined), so a cold deep link lands in
    // the right view. See the bottom of this file.

    // Pull-to-refresh logic
    let touchStartY = 0;
    document.addEventListener('touchstart', e => {
        if (window.scrollY === 0) touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        if (window.scrollY === 0 && touchStartY > 0) {
            let touchEndY = e.changedTouches[0].clientY;
            if (touchEndY - touchStartY > 100) {
                coursesContainer.innerHTML = '<p class="loading-text">Refreshing...</p>';
                loadFiles();
            }
        }
    });

    // Event Listeners for Search & Filter
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderSearch();
        renderRecentSearches();
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const q = searchInput.value.trim();
            if (q) {
                saveRecentSearch(q);
                goTo('#/search?q=' + encodeURIComponent(q));
            }
        }
    });

    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderSearch();
        });
    });

    // Keyboard shortcut: "/" jumps to search from anywhere
    document.addEventListener('keydown', (e) => {
        if (e.key !== '/') return;
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        window.focusSearch();
    });

    // Upload
    uploadBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            uploadStatus.textContent = "Please select a file first.";
            uploadStatus.style.color = "red";
            return;
        }

        if (!file.name.match(/\.(pdf|pptx|ppt|doc|docx)$/i)) {
            uploadStatus.textContent = "Only PDF, PPTX/PPT, and DOCX/DOC files are allowed.";
            uploadStatus.style.color = "red";
            return;
        }

        if (!adminPass) {
            alert("Please login as Admin first.");
            return;
        }

        uploadBtn.disabled = true;
        uploadStatus.textContent = "Uploading... Please wait.";
        uploadStatus.style.color = "var(--text-color)";


        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64data = e.target.result.split(',')[1];
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        contentBase64: base64data,
                        password: adminPass,
                        folder: folderInput ? folderInput.value : ''
                    })
                });

                if (response.ok) {
                    uploadStatus.textContent = "Upload successful! Refreshing list...";
                    uploadStatus.style.color = "green";
                    fileInput.value = "";
                    setTimeout(loadFiles, 2000);
                } else {
                    const result = await response.json();
                    uploadStatus.textContent = `Error: ${result.message}`;
                    uploadStatus.style.color = "red";

                }
            } catch (error) {
                uploadStatus.textContent = "Upload failed. Server error.";
                uploadStatus.style.color = "red";
            } finally {
                uploadBtn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });

    // Upload panel polish: chosen-file chip + drag & drop onto the dropzone
    const uploadDrop = document.getElementById('uploadDrop');
    const uploadFileName = document.getElementById('uploadFileName');
    if (fileInput && uploadDrop && uploadFileName) {
        const showChosenFile = () => {
            const f = fileInput.files && fileInput.files[0];
            if (f) {
                const kb = Math.max(1, Math.round(f.size / 1024));
                const size = kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
                uploadFileName.textContent = '';
                const icon = document.createElement('i');
                icon.className = 'bi bi-file-earmark-check-fill';
                uploadFileName.appendChild(icon);
                uploadFileName.appendChild(document.createTextNode(' ' + f.name + ' · ' + size));
                uploadFileName.style.display = 'inline-flex';
                uploadDrop.classList.add('has-file');
            } else {
                uploadFileName.style.display = 'none';
                uploadDrop.classList.remove('has-file');
            }
        };
        fileInput.addEventListener('change', showChosenFile);
        ['dragenter', 'dragover'].forEach((ev) => uploadDrop.addEventListener(ev, (e) => {
            e.preventDefault();
            uploadDrop.classList.add('dragging');
        }));
        ['dragleave', 'drop'].forEach((ev) => uploadDrop.addEventListener(ev, (e) => {
            e.preventDefault();
            uploadDrop.classList.remove('dragging');
        }));
        uploadDrop.addEventListener('drop', (e) => {
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length) {
                const dt = new DataTransfer();
                dt.items.add(files[0]);
                fileInput.files = dt.files;
                showChosenFile();
            }
        });
    }

    // Favicon bar navigation initialized at start

    // === Notices System with Backend Sync ===
    const noticesModal = document.getElementById('noticesModal');
    const noticesCloseBtn = document.getElementById('noticesCloseBtn');
    const noticesList = document.getElementById('noticesList');
    const noticesFooter = document.getElementById('noticesFooter');
    const noticeInput = document.getElementById('noticeInput');
    const postNoticeBtn = document.getElementById('postNoticeBtn');
    const noticeBadge = document.getElementById('noticeBadge');

    const NOTICES_KEY = 'fa24bai_notices';
    const SEEN_KEY = 'fa24bai_notices_seen';

    let localNotices = JSON.parse(localStorage.getItem(NOTICES_KEY) || '[]');

    const getNotices = () => localNotices;

    const saveNoticesLocally = (arr) => {
        localNotices = arr;
        try {
            localStorage.setItem(NOTICES_KEY, JSON.stringify(arr));
        } catch (e) {}
    };

    // === Deadlines & countdown (Round 2) ===
    // A notice becomes a deadline when it carries an examDate (yyyy-mm-dd).
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const daysUntil = (yyyyMmDd) => {
        const target = startOfDay(new Date(yyyyMmDd + 'T00:00:00'));
        return Math.round((target - startOfDay(new Date())) / DAY_MS);
    };
    const fmtExamDate = (yyyyMmDd) =>
        new Date(yyyyMmDd + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const daysLabel = (d) => d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`;

    const upcomingDeadlines = () => getNotices()
        .filter(n => n && typeof n.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.examDate) && daysUntil(n.examDate) >= 0)
        .slice()
        .sort((a, b) => a.examDate.localeCompare(b.examDate));

    const COURSE_KEYWORDS = {
        CSC322: ['operating systems', 'csc322'],
        MTH262: ['statistics', 'mth262'],
        AIC270: ['programming for artificial intelligence', 'pfai', 'aic270'],
        AIC372: ['knowledge rep', 'krr', 'aic372'],
        DAA: ['design and analysis of algorithms', 'algorithms', 'daa'],
        WEB: ['web technologies', 'csc336']
    };

    const noticeMatchesCourse = (n, code) => {
        if (n.course && n.course === code) return true;
        const text = ' ' + String(n.text || '').toLowerCase() + ' ';
        return (COURSE_KEYWORDS[code] || []).some(k => text.includes(k));
    };

    const nextDeadlineForCourse = (code) =>
        upcomingDeadlines().find(n => noticeMatchesCourse(n, code)) || null;

    const renderCountdown = () => {
        const box = document.getElementById('countdownContainer');
        if (!box) return;
        const ups = upcomingDeadlines().slice(0, 3);
        if (ups.length === 0) {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }
        box.style.display = 'block';
        box.innerHTML = `
            <div class="countdown-card">
                <p class="countdown-title"><i class="bi bi-alarm-fill"></i> Upcoming Deadlines</p>
                ${ups.map(n => `
                    <div class="countdown-row">
                        <div>
                            <div class="countdown-subject">${escapeHtml(String(n.text || '').split('\n')[0])}</div>
                            <div class="countdown-when">${fmtExamDate(n.examDate)}${n.time ? ' · ' + escapeHtml(n.time) : ''}</div>
                        </div>
                        <span class="countdown-days">${daysLabel(daysUntil(n.examDate))}</span>
                    </div>`).join('')}
            </div>`;
    };

    const fetchNoticesFromBackend = async () => {
        try {
            const res = await fetch('/api/notices');
            if (res.ok) {
                const serverNotices = await res.json();
                if (Array.isArray(serverNotices) && serverNotices.length > 0) {
                    saveNoticesLocally(serverNotices);
                    renderNotices();
                    renderCountdown();
                    updateNoticeBadge();
                }
            }
        } catch (e) {
            // Local fallback active
        }
    };

    const updateNoticeBadge = () => {
        const notices = getNotices();
        const seenCount = parseInt(localStorage.getItem(SEEN_KEY) || '0', 10);
        const unseen = notices.length - seenCount;
        if (unseen > 0) {
            noticeBadge.style.display = 'block';
            noticeBadge.title = `${unseen} new notice(s)`;
        } else {
            noticeBadge.style.display = 'none';
        }
    };

    let noticeFilter = 'All';

    window.setNoticeFilter = (cat) => {
        noticeFilter = cat;
        renderNotices();
    };

    const renderNotices = () => {
        const notices = getNotices();
        const filterHtml = `
            <div class="notice-filters">
                ${['All', 'Exam', 'Class', 'General'].map(c =>
                    `<button type="button" class="notice-filter-chip ${noticeFilter === c ? 'active' : ''}" onclick="window.setNoticeFilter('${c}')">${c}</button>`).join('')}
            </div>`;

        if (notices.length === 0) {
            noticesList.innerHTML = filterHtml + `
                <div class="notice-empty">
                    <i class="bi bi-megaphone"></i>
                    <p>No announcements yet.</p>
                </div>`;
            return;
        }

        // Pinned first, then newest first (original array index preserved
        // so delete targets the right entry).
        const sorted = notices
            .map((n, i) => ({ n, i }))
            .sort((a, b) => ((b.n.pinned ? 1 : 0) - (a.n.pinned ? 1 : 0)) || (b.i - a.i));
        const visible = sorted.filter(({ n }) =>
            noticeFilter === 'All' || (n.category || 'General') === noticeFilter);

        if (visible.length === 0) {
            noticesList.innerHTML = filterHtml + `
                <div class="notice-empty">
                    <i class="bi bi-megaphone"></i>
                    <p>No ${noticeFilter} announcements.</p>
                </div>`;
            return;
        }

        noticesList.innerHTML = filterHtml + visible.map(({ n, i: realIdx }) => {
            const deleteBtn = adminPass
                ? `<button class="notice-card-delete" onclick="window.deleteNotice(${realIdx})">
                       <i class="bi bi-trash3"></i> Delete
                   </button>`
                : '';
            const safeText = String(n.text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
            const cat = n.category || 'General';
            const catClass = cat === 'Exam' ? 'exam' : cat === 'Class' ? 'class' : '';
            const deadlineMeta = n.examDate
                ? ` · <i class="bi bi-calendar-event" style="margin-right:0.2rem;"></i>${fmtExamDate(n.examDate)}${n.time ? ' ' + escapeHtml(n.time) : ''} (${daysLabel(daysUntil(n.examDate))})`
                : '';
            return `
                <div class="notice-card ${n.pinned ? 'pinned' : ''}">
                    <div style="font-size:0.95rem; line-height:1.5;">${n.pinned ? '<i class="bi bi-pin-angle-fill notice-pin-mark"></i>' : ''}<span class="notice-cat ${catClass}">${cat}</span>${safeText}</div>
                    <div class="notice-card-meta">
                        <span><i class="bi bi-clock" style="margin-right:0.2rem;"></i>${escapeHtml(n.date || '')}${deadlineMeta}</span>
                        ${deleteBtn}
                    </div>
                </div>`;
        }).join('');
    };

    window.deleteNotice = async (idx) => {
        if (!adminPass) return;
        const notices = [...getNotices()];
        notices.splice(idx, 1);
        saveNoticesLocally(notices);

        const seen = Math.min(parseInt(localStorage.getItem(SEEN_KEY) || '0', 10), notices.length);
        localStorage.setItem(SEEN_KEY, seen);
        renderNotices();
        renderCountdown();
        updateNoticeBadge();

        try {
            await fetch('/api/notices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: adminPass, notices, action: 'delete' })
            });
            showNotification('Notice deleted from cohort board', 'info');
        } catch (e) {
            // Local update succeeded
        }
    };

    window.openNotices = () => {
        setActiveNav('notice');
        const notices = getNotices();
        localStorage.setItem(SEEN_KEY, notices.length);
        updateNoticeBadge();
        if (noticesFooter) noticesFooter.style.display = adminPass ? 'flex' : 'none';
        renderNotices();
        noticesModal.classList.add('active');
        fetchNoticesFromBackend();
    };

    if (noticesCloseBtn) {
        noticesCloseBtn.addEventListener('click', () => {
            noticesModal.classList.remove('active');
            setActiveNav(currentTab);
        });
    }

    const noticeCategoryEl = document.getElementById('noticeCategory');
    const noticeExamDateEl = document.getElementById('noticeExamDate');
    const noticeTimeEl = document.getElementById('noticeTime');
    const noticePinnedEl = document.getElementById('noticePinned');

    if (postNoticeBtn) {
        postNoticeBtn.addEventListener('click', async () => {
            const text = noticeInput.value.trim();
            if (!text) return;
            postNoticeBtn.disabled = true;

            const newNotice = {
                text,
                date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
            };
            const category = noticeCategoryEl ? noticeCategoryEl.value : 'General';
            if (category && category !== 'General') newNotice.category = category;
            else newNotice.category = 'General';
            const examDate = noticeExamDateEl ? noticeExamDateEl.value : '';
            if (examDate) newNotice.examDate = examDate;
            const timeVal = noticeTimeEl ? noticeTimeEl.value.trim() : '';
            if (timeVal) newNotice.time = timeVal;
            if (noticePinnedEl && noticePinnedEl.checked) newNotice.pinned = true;

            const notices = [...getNotices()];
            notices.push(newNotice);
            saveNoticesLocally(notices);
            localStorage.setItem(SEEN_KEY, notices.length);
            noticeInput.value = '';
            if (noticeExamDateEl) noticeExamDateEl.value = '';
            if (noticeTimeEl) noticeTimeEl.value = '';
            if (noticePinnedEl) noticePinnedEl.checked = false;
            renderNotices();
            renderCountdown();
            updateNoticeBadge();

            try {
                const res = await fetch('/api/notices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: adminPass, notices, action: 'post' })
                });
                if (res.ok) {
                    showNotification('Announcement posted and synced to GitHub', 'success');
                } else {
                    showNotification('Announcement saved locally', 'info');
                }
            } catch (e) {
                showNotification('Announcement saved locally', 'info');
            } finally {
                postNoticeBtn.disabled = false;
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && noticesModal && noticesModal.classList.contains('active')) {
            noticesModal.classList.remove('active');
            setActiveNav(currentTab);
        }
    });

    // Tap the dimmed area outside any open window (AI Assistant, Notices,
    // Admin Login) to close it — clicks inside the window keep working.
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
                if (overlay.id === 'noticesModal' && typeof setActiveNav === 'function') {
                    setActiveNav(currentTab);
                }
            }
        });
    });

    // Init badge and fetch backend notices
    updateNoticeBadge();
    fetchNoticesFromBackend();



    const promptAdminPassword = () => {
        return new Promise((resolve) => {
            openAdminLoginModal();

            // Override form submission to resolve promise
            const originalSubmit = adminLoginForm.onsubmit;
            adminLoginForm.onsubmit = async (e) => {
                e.preventDefault();
                const pass = adminPasswordInput.value.trim();

                if (!pass) {
                    showLoginError('Password cannot be empty');
                    resolve(null);
                    return;
                }

                if (await verifyAdminPasswordOnServer(pass)) {
                    adminPass = pass;
                    sessionStorage.setItem('adminPass', pass);
                    adminLoginAttempts = 0;
                    adminLoginLockedUntil = null;
                    closeAdminLoginModal();
                    updateAdminUI();
                    resolve(pass);
                } else {
                    adminLoginAttempts++;
                    updateLoginAttempts();
                    if (adminLoginAttempts >= maxLoginAttempts) {
                        adminLoginLockedUntil = new Date(new Date().getTime() + 5 * 60000);
                        showLoginError('Account locked for 5 minutes due to too many failed attempts');
                    } else {
                        const remaining = maxLoginAttempts - adminLoginAttempts;
                        showLoginError(`Wrong password. ${remaining} attempt(s) remaining`);
                    }
                    adminPasswordInput.value = '';
                    adminPasswordInput.focus();
                    resolve(null);
                }
            };
        });
    };

    // === Theme toggle (dark mode) — initial theme is set by the inline
    // script in index.html <head> before first paint ===
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    const applyThemeIcon = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (themeToggleIcon) themeToggleIcon.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    };
    applyThemeIcon();
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('fa24bai_theme', next); } catch (e) { /* ignore */ }
            applyThemeIcon();
        });
    }

    // Notification System
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 2000;
            animation: slideDown 0.3s ease-out;
            font-weight: 500;
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    };

    // === Init: apply the current URL route, then load data ============
    // (loadFiles re-applies the route once data is ready.)
    applyRoute();
    loadFiles();

    // === Service worker (PWA, Round 2) ===
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => { /* offline support is best-effort */ });
        });
    }
});

// ===== Extra (2026-10-23): scroll progress bar =====
(function () {
    const bar = document.getElementById('scrollProgress');
    function onScroll() {
        const st = window.scrollY || document.documentElement.scrollTop;
        const h = document.documentElement.scrollHeight - window.innerHeight;
        if (bar) bar.style.width = (h > 0 ? Math.min(100, (st / h) * 100) : 0) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
})();

// ===== Hub Q&A (2026-10-24): ask across all course materials =====
(function () {
    var input = document.getElementById('hubQaInput');
    var btn = document.getElementById('hubQaBtn');
    var box = document.getElementById('hubQaResult');
    if (!input || !btn || !box) return;
    function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmt(t) {
        return esc(t)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/^##\s?(.*)$/gm, '<div class="hub-qa-h">$1</div>')
            .replace(/^-\s?(.*)$/gm, '<div class="hub-qa-li">&bull; $1</div>')
            .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    }
    async function ask() {
        var q = input.value.trim();
        if (q.length < 3) { input.focus(); return; }
        btn.disabled = true;
        box.style.display = 'block';
        box.innerHTML = '<div class="hub-qa-loading">Searching your course materials...</div>';
        try {
            var r = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hubask', question: q }) });
            var d = await r.json();
            var html = '<div class="hub-qa-answer">' + fmt(d.reply || 'No answer came back - please try again.') + '</div>';
            if (Array.isArray(d.sources) && d.sources.length) {
                html += '<div class="hub-qa-sources"><span>Sources:</span>' + d.sources.map(function (f) {
                    var url = 'https://raw.githubusercontent.com/abduIwahid/fa24-bai/main/' + f.split('/').map(encodeURIComponent).join('/');
                    var name = f.split('/').pop();
                    return '<button type="button" class="hub-qa-chip" data-url="' + url + '"><i class="bi bi-file-earmark-pdf"></i> ' + esc(name) + '</button>';
                }).join('') + '</div>';
            }
            box.innerHTML = html;
            box.querySelectorAll('.hub-qa-chip').forEach(function (ch) {
                ch.addEventListener('click', function () { window.open(ch.getAttribute('data-url'), '_blank', 'noopener'); });
            });
        } catch (e) {
            box.innerHTML = '<div class="hub-qa-answer">Something went wrong reaching the AI - please try again.</div>';
        }
        btn.disabled = false;
    }
    btn.addEventListener('click', ask);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
})();
