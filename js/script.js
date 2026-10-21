document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("loaded");

    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const folderOptions = document.getElementById('folderOptions');
    const uploadStatus = document.getElementById('uploadStatus');
    const searchInput = document.getElementById('searchInput');
    const filterChips = document.querySelectorAll('.filter-chip');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminWelcome = document.getElementById('adminWelcome');
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
    };

    const setActiveNav = (key) => {
        Object.values(navItems).forEach(el => el && el.classList.remove('active'));
        if (navItems[key]) navItems[key].classList.add('active');
    };

    const switchTab = (tabName) => {
        currentTab = tabName;
        setActiveNav(tabName);

        if (landingSection) landingSection.style.display = tabName === 'home' ? 'block' : 'none';
        if (searchSection) searchSection.style.display = tabName === 'search' ? 'block' : 'none';
        if (coursesSection) coursesSection.style.display = tabName === 'courses' ? 'block' : 'none';

        if (tabName === 'home') {
            if (typeof renderLandingCourses === 'function') renderLandingCourses();
            if (typeof renderQuickAccess === 'function') renderQuickAccess();
        } else if (tabName === 'search') {
            if (typeof renderSearch === 'function') renderSearch();
        } else if (tabName === 'courses') {
            if (typeof renderCourses === 'function') renderCourses();
        }
    };

    window.switchTab = switchTab;

    window.scrollToHome = () => {
        switchTab('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.focusSearch = () => {
        switchTab('search');
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
        searchQuery = query.toLowerCase();
        if (searchInput) searchInput.value = query;
        switchTab('search');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (typeof renderSearch === 'function') renderSearch();
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
        currentView = 'all';
        selectedCourseCode = null;
        selectedCourseName = null;
        selectedFolder = null;
        switchTab('courses');
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

    backBtn.addEventListener('click', () => {
        if (currentView === 'folder') {
            currentView = 'course';
            selectedFolder = null;
        } else if (currentView === 'course') {
            currentView = 'all';
            selectedCourseCode = null;
            selectedCourseName = null;
        }
        renderCourses();
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

    const updateAdminUI = () => {
        if (adminPass) {
            adminLoginBtn.style.display = 'none';
            adminWelcome.style.display = 'block';
            uploadSection.style.display = 'block';
            renderCourses();
            renderSearch();
            renderLandingCourses();
            renderQuickAccess();
        }
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
            showNotification('Admin access granted', 'success');
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

    // Recently Viewed — persisted in localStorage so it survives refresh
    const RECENTS_KEY = 'fa24bai_recents';
    let recents = [];
    try {
        const storedRecents = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
        if (Array.isArray(storedRecents)) recents = storedRecents.filter(f => typeof f === 'string');
    } catch (e) {
        recents = [];
    }

    const saveRecents = () => {
        try {
            localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
        } catch (e) { /* private mode / quota: recents just stay in memory */ }
    };

    const addRecent = (filename) => {
        recents = recents.filter(f => f !== filename);
        recents.unshift(filename);
        if (recents.length > 6) recents.length = 6;
        saveRecents();
        renderQuickAccess();
    };

    // Course mapping logic
    const getCourseInfo = (filepath) => {
        const lowerName = filepath.toLowerCase();
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
        const fullUrl = window.location.origin + '/' + encodeURI(filename);
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
        const menuId = 'menu-' + Math.random().toString(36).substring(2, 9);

        return `
            <div class="resource-item">
                <div class="resource-main">
                    <div class="resource-name">${res.cleanName}</div>
                    <div class="resource-type-badge">${res.resourceType}</div>
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

    window.trackView = (filename) => addRecent(filename);

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
        let escaped = str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
        escaped = escaped.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:2px 4px;border-radius:3px;">$1</code>');
        escaped = escaped.replace(/\n/g, '<br>');
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
                addChatMessage(data.reply, 'ai');
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
        if (recents.length === 0) {
            quickAccessContainer.style.display = 'none';
            return;
        }
        quickAccessContainer.style.display = 'block';
        quickAccessList.innerHTML = '';

        recents.forEach(filename => {
            const file = allFiles.find(f => f.rawName === filename);
            if (file) {
                quickAccessList.innerHTML += createResourceHtml(file);
            }
        });
    };

    window.openCourse = (code, name) => {
        currentView = 'course';
        selectedCourseCode = code;
        selectedCourseName = name;
        selectedFolder = null;
        switchTab('courses');
        renderCourses();
    };

    window.openCourseFromLanding = (code, name) => {
        selectedCourseCode = code;
        selectedCourseName = name;
        selectedFolder = null;
        currentView = 'course';
        switchTab('courses');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.openFolder = (folderName, courseCode = null, courseName = null) => {
        if (courseCode) selectedCourseCode = courseCode;
        if (courseName) selectedCourseName = courseName;
        currentView = 'folder';
        selectedFolder = folderName;
        switchTab('courses');
        renderCourses();
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
            const countText = courseData.count > 0
                ? `${courseData.count} study material(s) organized in ${courseData.folderTypes.size} category folder(s)`
                : `Syllabus, CDF, lab manuals, and lecture slides`;

            return `
                <div class="course-card landing-course-card" style="cursor: pointer;" onclick="window.openCourseFromLanding('${courseData.info.code}', '${escapedName}')">
                    <div class="course-header" style="margin-bottom: 0.75rem;">
                        <div class="course-info">
                            <span class="course-code" style="display:inline-block; margin-bottom: 0.35rem;">${courseData.info.code}</span>
                            <h2 style="font-size: 1.15rem; margin-top: 0.15rem;">${courseData.info.name}</h2>
                        </div>
                    </div>
                    <div style="font-size: 0.85rem; color: #666; margin-bottom: 1.1rem; line-height: 1.4;">
                        ${countText}
                    </div>
                    <button type="button" class="action-btn" style="width: 100%; padding: 0.65rem 1rem; background: var(--accent-light); color: var(--accent); border: 1px solid transparent; font-weight: 600; cursor: pointer; border-radius: 6px; font-size: 0.88rem;" onclick="event.stopPropagation(); window.openCourseFromLanding('${courseData.info.code}', '${escapedName}')">
                        Explore Course &rarr;
                    </button>
                </div>
            `;
        }).join('');
    };

    const renderSearch = () => {
        if (!searchResultsContainer) return;

        // Loading / error states (data comes from /api/files via loadFiles)
        if (filesState === 'loading') {
            if (searchResultsInfo) searchResultsInfo.textContent = 'Loading study materials...';
            searchResultsContainer.innerHTML = '<div class="no-results state-block" style="grid-column: 1 / -1;"><p class="loading-text">Loading study materials...</p></div>';
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

        searchResultsContainer.innerHTML = filteredFiles.map(res => createResourceHtml(res, { showCourse: true })).join('');
    };

    const renderCourses = () => {
        if (currentView === 'all') {
            navigationBar.style.display = 'none';
            controlsSection.style.display = 'none';
            quickAccessContainer.style.display = 'none';

            if (filesState === 'loading') {
                coursesContainer.innerHTML = '<div class="no-results state-block"><p class="loading-text">Loading hub...</p></div>';
                return;
            }
            if (filesState === 'error') {
                coursesContainer.innerHTML = `
                    <div class="no-results state-block">
                        <p>We couldn't load the materials list. Check your connection and try again.</p>
                        <button type="button" class="retry-btn" onclick="window.retryLoadFiles()">Retry</button>
                    </div>`;
                return;
            }
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

            coursesContainer.innerHTML = '';
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
                    <button class="action-btn" style="width: 100%; margin-top: 10px; padding: 10px; background: #e0e0e0; color: #111; border: none; font-weight: bold; cursor: pointer; border-radius: 6px;" onclick="window.openCourse('${courseData.info.code}', '${courseData.info.name.replace(/'/g, "\\'")}')">View Course Details</button>
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

            const folderFiles = allFiles.filter(f => f.course.code === selectedCourseCode && f.resourceType === selectedFolder);

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
                        cleanName: getCleanName(file.name)
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
                switchTab('home');
            }
        } catch (error) {
            filesState = 'error';
            renderLandingCourses();
            renderSearch();
            renderCourses();
        }
    }

    // Immediate render of landing view and core courses
    renderLandingCourses();
    switchTab('home');

    loadFiles();

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

    const fetchNoticesFromBackend = async () => {
        try {
            const res = await fetch('/api/notices');
            if (res.ok) {
                const serverNotices = await res.json();
                if (Array.isArray(serverNotices) && serverNotices.length > 0) {
                    saveNoticesLocally(serverNotices);
                    renderNotices();
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

    const renderNotices = () => {
        const notices = getNotices();
        if (notices.length === 0) {
            noticesList.innerHTML = `
                <div class="notice-empty">
                    <i class="bi bi-megaphone"></i>
                    <p>No announcements yet.</p>
                </div>`;
            return;
        }
        noticesList.innerHTML = notices.slice().reverse().map((n, revIdx) => {
            const realIdx = notices.length - 1 - revIdx;
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
            return `
                <div class="notice-card">
                    <div style="font-size:0.95rem; line-height:1.5;">${safeText}</div>
                    <div class="notice-card-meta">
                        <span><i class="bi bi-clock" style="margin-right:0.2rem;"></i>${n.date}</span>
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

    if (postNoticeBtn) {
        postNoticeBtn.addEventListener('click', async () => {
            const text = noticeInput.value.trim();
            if (!text) return;
            postNoticeBtn.disabled = true;

            const notices = [...getNotices()];
            notices.push({
                text,
                date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
            });
            saveNoticesLocally(notices);
            localStorage.setItem(SEEN_KEY, notices.length);
            noticeInput.value = '';
            renderNotices();
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
});
