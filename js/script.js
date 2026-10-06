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
    let currentFilter = 'All';
    let searchQuery = '';
    let currentAiFile = null;

    const navigationBar = document.getElementById('navigationBar');
    const backBtn = document.getElementById('backBtn');
    const currentPath = document.getElementById('currentPath');
    const controlsSection = document.getElementById('controlsSection');
    const coursesContainer = document.getElementById('coursesContainer');
    const uploadBtn = document.getElementById('uploadBtn');

    let currentView = 'home'; // 'home', 'course', 'folder'
    let selectedCourseCode = null;
    let selectedCourseName = null;
    let selectedFolder = null;

    backBtn.addEventListener('click', () => {
        if (currentView === 'folder') {
            currentView = 'course';
            selectedFolder = null;
        } else if (currentView === 'course') {
            currentView = 'home';
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
            showNotification('✓ Admin access granted!', 'success');
        };

        const denyAccess = () => {
            adminLoginAttempts++;
            updateLoginAttempts();
            if (adminLoginAttempts >= maxLoginAttempts) {
                adminLoginLockedUntil = new Date(new Date().getTime() + 5 * 60000);
                showLoginError('Account locked for 5 minutes due to too many failed attempts');
            } else {
                const remaining = maxLoginAttempts - adminLoginAttempts;
                showLoginError(`❌ Wrong password. ${remaining} attempt(s) remaining`);
            }
            adminPasswordInput.value = '';
            adminPasswordInput.focus();
        };

        try {
            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass, action: 'verify' })
            });

            if (response.status === 200) {
                grantAccess();
            } else {
                // API returned an error — fallback to local check
                if (pass === 'admin@fa24bai') {
                    grantAccess();
                } else {
                    denyAccess();
                }
            }
        } catch (error) {
            // No server / local mode — validate against hardcoded password
            if (pass === 'admin@fa24bai') {
                grantAccess();
            } else {
                denyAccess();
            }
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aiModal.classList.contains('active')) {
            aiModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Load LocalState
    let recents = []; // In-memory only, clears on page refresh

    const addRecent = (filename) => {
        recents = recents.filter(f => f !== filename);
        recents.unshift(filename);
        if (recents.length > 3) recents.pop();
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
        if (lowerName.includes('cdf')) return 'CDF';
        if (lowerName.includes('lab manual')) return 'Lab Manual';
        if (lowerName.includes('syllabus')) return 'Syllabus';
        if (lowerName.includes('lecture')) return 'Lectures';
        if (lowerName.includes('assignment')) return 'Assignments';
        return 'Other';
    };

    const getCleanName = (filepath) => {
        let filename = filepath.split('/').pop();
        let clean = filename.replace(/\.(pdf|pptx|ppt|doc|docx)$/i, '');
        clean = clean.replace(/_/g, ' ');
        return clean;
    };

    const createResourceHtml = (res) => {
        let viewUrl = res.rawName;
        if (viewUrl.match(/\.(pptx|ppt|docx|doc)$/i)) {
            // Encode the path segments properly for the raw github URL
            const encodedPath = res.rawName.split('/').map(encodeURIComponent).join('/');
            const rawGithubUrl = 'https://raw.githubusercontent.com/abduIwahid/fa24-bai/main/' + encodedPath;
            viewUrl = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodeURIComponent(rawGithubUrl);
        }

        return `
            <div class="resource-item">
                <div>
                    <div class="resource-name">${res.cleanName}</div>
                    <div class="resource-type-badge">${res.resourceType}</div>
                </div>
                <div class="resource-actions">
                    <a href="${viewUrl}" target="_blank" class="action-btn view" onclick="window.trackView('${res.rawName.replace(/'/g, "\\'")}')">View</a>
                    ${adminPass ? `<button class="action-btn delete-btn" onclick="window.deleteFile('${res.rawName.replace(/'/g, "\\'")}')" style="background:#ff4444; color:white; border:none; margin-left: auto;">Delete</button>` : ''}
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
        } catch(e) {
            alert("Delete failed.");
        }
    };
    window.openAI = (filename) => {
        currentAiFile = allFiles.find(f => f.rawName === filename);
        if(!currentAiFile) return;
        aiModalSubtitle.textContent = currentAiFile.cleanName;
        chatContainer.innerHTML = '<div class="chat-message ai">Hi! I\'m your AI study assistant. Ask me anything about this document, or use the quick actions above.</div>';
        aiModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    aiCloseBtn.addEventListener('click', () => {
        aiModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    });

    const addChatMessage = (text, sender) => {
        const msg = document.createElement('div');
        msg.className = `chat-message ${sender}`;
        msg.textContent = text;
        chatContainer.appendChild(msg);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    };

    const handleAiRequest = async (prompt, action = 'chat') => {
        if (!currentAiFile) return;
        
        if (action === 'chat' && !prompt) return;
        
        if (action === 'chat') {
            addChatMessage(prompt, 'user');
            aiInput.value = '';
        } else {
            addChatMessage(`Action: ${action.charAt(0).toUpperCase() + action.slice(1)}`, 'user');
        }

        // Typing indicator
        const typingId = Date.now();
        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message ai';
        typingEl.id = `typing-${typingId}`;
        typingEl.textContent = 'Thinking...';
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
            document.getElementById(`typing-${typingId}`).remove();
            
            if (response.ok) {
                addChatMessage(data.reply, 'ai');
            } else {
                addChatMessage("Sorry, there was an error processing your request.", 'ai');
            }
        } catch(e) {
            document.getElementById(`typing-${typingId}`).remove();
            addChatMessage("Network error. Please try again.", 'ai');
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
            if(file) {
                quickAccessList.innerHTML += createResourceHtml(file);
            }
        });
    };

    window.openCourse = (code, name) => {
        currentView = 'course';
        selectedCourseCode = code;
        selectedCourseName = name;
        renderCourses();
    };

    window.openFolder = (folderName, courseCode = null, courseName = null) => {
        if (courseCode) selectedCourseCode = courseCode;
        if (courseName) selectedCourseName = courseName;
        currentView = 'folder';
        selectedFolder = folderName;
        renderCourses();
    };

    const renderCourses = () => {
        if (currentView === 'home') {
            navigationBar.style.display = 'none';
            controlsSection.style.display = 'block';
            quickAccessContainer.style.display = recents.length ? 'block' : 'none';

            const filteredFiles = allFiles.filter(file => {
                const matchesSearch = file.name.toLowerCase().includes(searchQuery);
                const matchesFilter = currentFilter === 'All' || file.resourceType === currentFilter;
                return matchesSearch && matchesFilter;
            });

            if (filteredFiles.length === 0) {
                coursesContainer.innerHTML = '<div class="no-results">No resources found.</div>';
                return;
            }

            const coursesMap = {};
            filteredFiles.forEach(file => {
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
                
                if (courseData.folderTypes.has('Lectures')) {
                    const lectureCount = courseData.resources.filter(r => r.resourceType === 'Lectures').length;
                    resourcesHtml += `
                        <div class="resource-item" style="cursor: pointer; background: #fafafa; border: 1px dashed #ccc;" onclick="window.openFolder('Lectures', '${courseData.info.code}', '${courseData.info.name.replace(/'/g, "\\'")}')">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 1.5rem;">📁</span>
                                <div>
                                    <div class="resource-name">Lectures</div>
                                    <div style="font-size: 0.8rem; color: #666;">${lectureCount} item(s)</div>
                                </div>
                            </div>
                            <div class="resource-actions">
                                <span style="color: var(--primary-color); font-weight: bold; font-size: 0.9rem;">Open Folder &rarr;</span>
                            </div>
                        </div>
                    `;
                }

                if (mainResources.length === 0 && !courseData.folderTypes.has('Lectures') && courseData.resources.length > 0) {
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
                folderCard.innerHTML = `
                    <div class="course-header">
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
            folderContainer.className = 'course-card';
            folderContainer.style.width = '100%';
            folderContainer.innerHTML = `
                <div class="course-header" style="border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px;">
                    <div class="course-info">
                        <h2>${selectedFolder}</h2>
                        <p class="course-code">${folderFiles.length} item(s)</p>
                    </div>
                </div>
                <div class="resources-list">
                    ${folderFiles.map(res => createResourceHtml(res)).join('')}
                </div>
            `;
            coursesContainer.appendChild(folderContainer);
        }
    };

    // Load Files
    async function loadFiles() {
        try {
            const response = await fetch('/api/files');
            const data = await response.json();
            
            if (response.ok) {
                const pdfs = data.filter(file => file.name.match(/\.(pdf|pptx|ppt|doc|docx)$/i));
                
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
                
                if(folderOptions) {
                    folderOptions.innerHTML = '';
                    folders.forEach(folder => {
                        const option = document.createElement('option');
                        option.value = folder;
                        folderOptions.appendChild(option);
                    });
                }
                
                updateAdminUI();
                renderCourses();
                renderQuickAccess();
            } else {
                coursesContainer.innerHTML = '<p class="loading-text" style="color:red;">Error loading documents.</p>';
            }
        } catch (error) {
            coursesContainer.innerHTML = '<p class="loading-text" style="color:red;">Error loading documents.</p>';
        }
    }

    loadFiles();

    // Pull-to-refresh logic
    let touchStartY = 0;
    document.addEventListener('touchstart', e => {
        if (window.scrollY === 0) touchStartY = e.touches[0].clientY;
    }, {passive: true});

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
        renderCourses();
    });

    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderCourses();
        });
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

    // === Favicon Bar Logic ===
    const navItems = {
        home:    document.getElementById('navHome'),
        search:  document.getElementById('navSearch'),
        upload:  document.getElementById('navUpload'),
        notice:  document.getElementById('navNotice'),
        courses: document.getElementById('navCourses'),
    };

    const setActiveNav = (key) => {
        Object.values(navItems).forEach(el => el && el.classList.remove('active'));
        if (navItems[key]) navItems[key].classList.add('active');
    };

    window.scrollToHome = () => {
        setActiveNav('home');
        if (currentView !== 'home') {
            currentView = 'home';
            selectedCourseCode = null;
            selectedCourseName = null;
            selectedFolder = null;
            renderCourses();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.focusSearch = () => {
        setActiveNav('search');
        if (currentView !== 'home') {
            currentView = 'home';
            selectedCourseCode = null;
            selectedCourseName = null;
            selectedFolder = null;
            renderCourses();
        }
        setTimeout(() => {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    window.openUploadPanel = async () => {
        setActiveNav('upload');
        if (!adminPass) {
            const pass = await promptAdminPassword();
            if (!pass) {
                setActiveNav('home');
                return;
            }
        }
        if (currentView !== 'home') {
            currentView = 'home';
            selectedCourseCode = null;
            selectedCourseName = null;
            selectedFolder = null;
            renderCourses();
        }
        if (uploadSection) {
            uploadSection.style.display = 'block';
            setTimeout(() => {
                uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    };

    window.scrollToCourses = () => {
        setActiveNav('courses');
        if (currentView !== 'home') {
            currentView = 'home';
            selectedCourseCode = null;
            selectedCourseName = null;
            selectedFolder = null;
            renderCourses();
        }
        setTimeout(() => {
            coursesContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    // === Notices System ===
    const noticesModal      = document.getElementById('noticesModal');
    const noticesCloseBtn   = document.getElementById('noticesCloseBtn');
    const noticesList       = document.getElementById('noticesList');
    const noticesFooter     = document.getElementById('noticesFooter');
    const noticeInput       = document.getElementById('noticeInput');
    const postNoticeBtn     = document.getElementById('postNoticeBtn');
    const noticeBadge       = document.getElementById('noticeBadge');

    const NOTICES_KEY     = 'fa24bai_notices';
    const SEEN_KEY        = 'fa24bai_notices_seen';

    const getNotices = () => JSON.parse(localStorage.getItem(NOTICES_KEY) || '[]');
    const saveNotices = (arr) => localStorage.setItem(NOTICES_KEY, JSON.stringify(arr));

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
            return `
                <div class="notice-card">
                    <div style="font-size:0.95rem; line-height:1.5;">${n.text.replace(/\n/g, '<br>')}</div>
                    <div class="notice-card-meta">
                        <span><i class="bi bi-clock" style="margin-right:0.2rem;"></i>${n.date}</span>
                        ${deleteBtn}
                    </div>
                </div>`;
        }).join('');
    };

    window.deleteNotice = (idx) => {
        if (!adminPass) return;
        const notices = getNotices();
        notices.splice(idx, 1);
        saveNotices(notices);
        // Adjust seen count
        const seen = Math.min(parseInt(localStorage.getItem(SEEN_KEY) || '0', 10), notices.length);
        localStorage.setItem(SEEN_KEY, seen);
        renderNotices();
        updateNoticeBadge();
    };

    window.openNotices = () => {
        setActiveNav('notice');
        // Mark all as seen
        const notices = getNotices();
        localStorage.setItem(SEEN_KEY, notices.length);
        updateNoticeBadge();
        // Show admin post form if logged in
        if (noticesFooter) noticesFooter.style.display = adminPass ? 'flex' : 'none';
        renderNotices();
        noticesModal.classList.add('active');
    };

    if (noticesCloseBtn) {
        noticesCloseBtn.addEventListener('click', () => {
            noticesModal.classList.remove('active');
            setActiveNav('home');
        });
    }

    if (postNoticeBtn) {
        postNoticeBtn.addEventListener('click', () => {
            const text = noticeInput.value.trim();
            if (!text) return;
            const notices = getNotices();
            notices.push({
                text,
                date: new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
            });
            saveNotices(notices);
            // New notice counts as seen by admin
            localStorage.setItem(SEEN_KEY, notices.length);
            noticeInput.value = '';
            renderNotices();
            updateNoticeBadge();
            showNotification('✓ Announcement posted!', 'success');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && noticesModal && noticesModal.classList.contains('active')) {
            noticesModal.classList.remove('active');
            setActiveNav('home');
        }
    });

    // Init badge on load
    updateNoticeBadge();



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

                if (pass === 'admin@fa24bai') {
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
                        showLoginError(`❌ Wrong password. ${remaining} attempt(s) remaining`);
                    }
                    adminPasswordInput.value = '';
                    adminPasswordInput.focus();
                    resolve(null);
                }
            };
        });
    };

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
