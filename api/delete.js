export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, password } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (ADMIN_PASSWORD && password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Unauthorized: Invalid Admin Password' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ message: 'Server configuration error: GITHUB_TOKEN missing' });
    }

    const owner = 'abduIwahid';
    const repo = 'fa24-bai';
    
    try {
        // 1. Get the file's SHA (required by GitHub API to delete)
        const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filename)}`;
        const getRes = await fetch(getUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`, 
                'User-Agent': 'Vercel-Upload-App' 
            }
        });
        
        if (!getRes.ok) return res.status(404).json({ message: 'File not found on GitHub' });
        const fileData = await getRes.json();
        const sha = fileData.sha;

        // 2. Delete the file
        const delRes = await fetch(getUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Vercel-Upload-App'
            },
            body: JSON.stringify({
                message: `Delete ${filename} via Admin UI`,
                sha: sha
            })
        });

        if (!delRes.ok) {
            const err = await delRes.json();
            throw new Error(err.message || "Delete failed");
        }
        
        return res.status(200).json({ message: 'Deleted successfully' });
    } catch(e) {
        console.error(e);
        return res.status(500).json({ message: e.message });
    }
}
