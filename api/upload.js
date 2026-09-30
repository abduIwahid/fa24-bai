export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, contentBase64, password } = req.body;
    
    // Security check
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (ADMIN_PASSWORD && password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized: Invalid Admin Password' });
    }

    if (!filename || !contentBase64) {
        return res.status(400).json({ message: 'Missing filename or content' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ message: 'Server configuration error: GITHUB_TOKEN missing' });
    }

    const owner = 'abduIwahid';
    const repo = 'fa24-bai';
    const path = filename; 
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Upload-App'
            },
            body: JSON.stringify({
                message: `Upload ${filename} via Vercel`,
                content: contentBase64
            })
        });

        if (!response.ok) {
            const err = await response.json();
            return res.status(response.status).json({ message: err.message });
        }

        return res.status(200).json({ message: 'File uploaded successfully' });
    } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
