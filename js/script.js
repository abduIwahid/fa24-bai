document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("loaded");
    
    const linksContainer = document.getElementById('linksContainer');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('fileInput');
    const statusText = document.getElementById('uploadStatus');

    // 1. Fetch existing PDFs from our backend to avoid GitHub rate limits
    async function loadFiles() {
        try {
            // Using our Vercel backend to list repo contents
            const response = await fetch('/api/files');
            const data = await response.json();
            
            if (response.ok) {
                linksContainer.innerHTML = '';
                const pdfs = data.filter(file => file.name.endsWith('.pdf'));
                
                if (pdfs.length === 0) {
                    linksContainer.innerHTML = '<p>No documents found.</p>';
                } else {
                    pdfs.forEach(file => {
                        const a = document.createElement('a');
                        a.href = file.name; // Relative path works perfectly
                        a.target = '_blank';
                        a.textContent = `${file.name}`;
                        linksContainer.appendChild(a);
                    });
                }
            } else {
                linksContainer.innerHTML = '<p>Error loading documents.</p>';
            }
        } catch (error) {
            linksContainer.innerHTML = '<p>Error loading documents.</p>';
        }
    }

    loadFiles();

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
        statusText.style.color = "black";

        // Read file as Base64
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64data = e.target.result.split(',')[1]; // Get only the base64 string
            
            try {
                // Send to our Vercel Serverless Function
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
                    fileInput.value = ""; // Clear input
                    
                    // Reload files list after 2 seconds to allow Vercel/GitHub to process
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
