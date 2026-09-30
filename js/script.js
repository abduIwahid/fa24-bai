document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("loaded");
    
    // Elements
    const coursesContainer = document.getElementById('coursesContainer');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const statusText = document.getElementById('uploadStatus');
    const searchInput = document.getElementById('searchInput');
    const filterChips = document.querySelectorAll('.filter-chip');
    
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

    // Load LocalState
    let favorites = JSON.parse(localStorage.getItem('favs')) || [];
    let recents = JSON.parse(localStorage.getItem('recents')) || [];

    const saveState = () => {
        localStorage.setItem('favs', JSON.stringify(favorites));
        localStorage.setItem('recents', JSON.stringify(recents));
    };

    const addRecent = (filename) => {
        recents = recents.filter(f => f !== filename);
        recents.unshift(filename);
        if (recents.length > 3) recents.pop();
        saveState();
        renderQuickAccess();
    };

    const toggleFavorite = (filename) => {
        if (favorites.includes(filename)) {
            favorites = favorites.filter(f => f !== filename);
        } else {
            favorites.push(filename);
        }
        saveState();
        renderCourses();
        renderQuickAccess();
    };

    // Course mapping logic
    const getCourseInfo = (filename) => {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('pfai') || lowerName.includes('ai270') || lowerName.includes('aic270')) return { name: 'Artificial Intelligence', code: 'AIC270', icon: '🧠' };
        if (lowerName.includes('krr') || lowerName.includes('kr&r') || lowerName.includes('aic372')) return { name: 'Knowledge Rep. & Reasoning', code: 'AIC372', icon: '🤖' };
        if (lowerName.includes('os') || lowerName.includes('csc322')) return { name: 'Operating Systems', code: 'CSC322', icon: '💻' };
        if (lowerName.includes('stat') || lowerName.includes('mth262')) return { name: 'Probability & Statistics', code: 'MTH262', icon: '📐' };
        return { name: 'Other Resources', code: 'VAR', icon: '📁' };
    };

    const getResourceType = (filename) => {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('cdf')) return 'CDF';
        if (lowerName.includes('lab manual')) return 'Lab Manual';
        if (lowerName.includes('syllabus')) return 'Syllabus';
        return 'Other';
    };

    const getCleanName = (filename) => {
        let clean = filename.replace('.pdf', '');
        clean = clean.replace(/_/g, ' ');
        return clean;
    };

    const createResourceHtml = (res) => {
        const isFav = favorites.includes(res.rawName);
        return `
            <div class="resource-item">
                <div>
                    <div class="resource-name">${res.cleanName}</div>
                    <div class="resource-type-badge">${res.resourceType}</div>
                </div>
                <div class="resource-actions">
                    <button class="action-btn fav ${isFav ? 'active' : ''}" onclick="window.toggleFav('${res.rawName}')">⭐</button>
                    <a href="${res.rawName}" target="_blank" class="action-btn view" onclick="window.trackView('${res.rawName}')">👁 View</a>
                    <button class="action-btn ai-btn" onclick="window.openAI('${res.rawName}')">✨ Ask AI</button>
                    <a href="${res.rawName}" download class="action-btn download">⬇ D/L</a>
                </div>
            </div>
        `;
    };

    window.toggleFav = (filename) => toggleFavorite(filename);
    window.trackView = (filename) => addRecent(filename);
    
    // --- AI LOGIC ---
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

    const renderCourses = () => {
        const filteredFiles = allFiles.filter(file => {
            if (currentFilter === 'Favorites') return favorites.includes(file.rawName);
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
                coursesMap[file.course.code] = { info: file.course, resources: [] };
            }
            coursesMap[file.course.code].resources.push(file);
        });

        coursesContainer.innerHTML = '';
        Object.values(coursesMap).forEach(courseData => {
            const courseEl = document.createElement('div');
            courseEl.className = 'course-card';
            
            let resourcesHtml = courseData.resources.map(res => createResourceHtml(res)).join('');

            courseEl.innerHTML = `
                <div class="course-header">
                    <div class="course-icon">${courseData.info.icon}</div>
                    <div class="course-info">
                        <h2>${courseData.info.name}</h2>
                        <p class="course-code">${courseData.info.code} • ${courseData.resources.length} Resource(s)</p>
                    </div>
                </div>
                <div class="resources-list">
                    ${resourcesHtml}
                </div>
            `;
            coursesContainer.appendChild(courseEl);
        });
    };

    // Load Files
    async function loadFiles() {
        try {
            const response = await fetch('/api/files');
            const data = await response.json();
            
            if (response.ok) {
                const pdfs = data.filter(file => file.name.endsWith('.pdf'));
                
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
            statusText.textContent = "Please select a file first.";
            statusText.style.color = "red";
            return;
        }

        if (!file.name.endsWith('.pdf')) {
            statusText.textContent = "Only PDF files are allowed.";
            statusText.style.color = "red";
            return;
        }

        uploadBtn.disabled = true;
        statusText.textContent = "Uploading... Please wait.";
        statusText.style.color = "var(--text-color)";

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64data = e.target.result.split(',')[1];
            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name, contentBase64: base64data })
                });

                if (response.ok) {
                    statusText.textContent = "Upload successful! Refreshing list...";
                    statusText.style.color = "green";
                    fileInput.value = "";
                    setTimeout(loadFiles, 2000);
                } else {
                    const result = await response.json();
                    statusText.textContent = `Error: ${result.message}`;
                    statusText.style.color = "red";
                }
            } catch (error) {
                statusText.textContent = "Upload failed. Server error.";
                statusText.style.color = "red";
            } finally {
                uploadBtn.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    });
});
