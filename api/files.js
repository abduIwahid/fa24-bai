export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const owner = 'abduIwahid';
    const repo = 'fa24-bai';
    const url = `https://api.github.com/repos/${owner}/${repo}/contents`;

    try {
        const headers = { 'User-Agent': 'Vercel-Upload-App' };
        
        // Use token if available to avoid rate limits
        if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
        }

        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            const err = await response.json();
            return res.status(response.status).json({ message: err.message || 'Error fetching from GitHub' });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error("Fetch error:", error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
