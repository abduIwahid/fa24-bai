document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("loaded");
    
    const coursesContainer = document.getElementById('coursesContainer');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const statusText = document.getElementById('uploadStatus');
    const searchInput = document.getElementById('searchInput');
    const filterChips = document.querySelectorAll('.filter-chip');

    let allFiles = [];
    let currentFilter = 'All';
    let searchQuery = '';

    // Course mapping logic
    const getCourseInfo = (filename) => {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('pfai') || lowerName.includes('ai270') || lowerName.includes('aic270')) {
            return { name: 'Artificial Intelligence', code: 'AIC270', icon: '🧠' };
        }
        if (lowerName.includes('krr') || lowerName.includes('kr&r') || lowerName.includes('aic372')) {
            return { name: 'Knowledge Rep. & Reasoning', code: 'AIC372', icon: '🤖' };
        }
        if (lowerName.includes('os') || lowerName.includes('csc322')) {
            return { name: 'Operating Systems', code: 'CSC322', icon: '💻' };
        }
        if (lowerName.includes('stat') || lowerName.includes('mth262')) {
            return { name: 'Probability & Statistics', code: 'MTH262', icon: '📐' };
        }
        return { name: 'Other Resources', code: 'VAR', icon: '📁' };
    };

    const getResourceType = (filename) => {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('cdf')) return 'CDF';
        if (lowerName.includes('lab manual')) return 'Lab Manual';
        if (lowerName.includes('syllabus')) return 'Syllabus';
        return 'Other';
    };

    const getCleanName = (filename, type, course) => {
        let clean = filename.replace('.pdf', '');
        clean = clean.replace(/_/g, ' ');
        return clean;
    };

    // Render logic
    const renderCourses = () => {
        // Filter files
        const filteredFiles = allFiles.filter(file => {
            const matchesSearch = file.name.toLowerCase().includes(searchQuery);
            const matchesFilter = currentFilter === 'All' || file.resourceType === currentFilter;
            return matchesSearch && matchesFilter;
        });

        if (filteredFiles.length === 0) {
            coursesContainer.innerHTML = '<div class="no-results">No resources found.</div>';
            return;
        }

        // Group by course
        const coursesMap = {};
        filteredFiles.forEach(file => {
            if (!coursesMap[file.course.code]) {
                coursesMap[file.course.code] = {
                    info: file.course,
                    resources: []
                };
            }
            coursesMap[file.course.code].resources.push(file);
        });

        // Build HTML
        coursesContainer.innerHTML = '';
        Object.values(coursesMap).forEach(courseData => {
            const courseEl = document.createElement('div');
            courseEl.className = 'course-card';
            
            let resourcesHtml = courseData.resources.map(res => `
                <div class="resource-item">
                    <div>
                        <div class="resource-name">${res.cleanName}</div>
                        <div class="resource-type-badge">${res.resourceType}</div>
                    </div>
                    <div class="resource-actions">
                        <a href="${res.rawName}" target="_blank" class="action-btn view">👁 View</a>
                        <a href="${res.rawName}" download class="action-btn download">⬇ D/L</a>
                    </div>
                </div>
            `).join('');

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

    // 1. Fetch existing PDFs from our backend
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
                        cleanName: getCleanName(file.name, rType, courseInfo)
                    };
                });
                
                renderCourses();
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

    // 2. Handle File Upload
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
                    body: JSON.stringify({
                        filename: file.name,
                        contentBase64: base64data
                    })
                });

                const result = await response.json();

                if (response.ok) {
                    statusText.textContent = "Upload successful! Refreshing list...";
                    statusText.style.color = "green";
                    fileInput.value = "";
                    setTimeout(loadFiles, 2000);
                } else {
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
