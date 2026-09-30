export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const owner = 'abduIwahid';
    const repo = 'fa24-bai';

    try {
        const headers = { 'User-Agent': 'Vercel-Upload-App' };
        
        // Use token if available to avoid rate limits
        if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
        }

        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
        const response = await fetch(treeUrl, { headers });
        
        if (!response.ok) {
            const err = await response.json();
            return res.status(response.status).json({ message: err.message || 'Error fetching from GitHub' });
        }

        const data = await response.json();
        
        // Map the tree array back to the expected [{name: ...}] format
        const pdfs = data.tree
            .filter(item => item.type === 'blob' && item.path.endsWith('.pdf'))
            .map(item => ({ name: item.path }));

        return res.status(200).json(pdfs);
    } catch (error) {
        console.error("Fetch error:", error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
