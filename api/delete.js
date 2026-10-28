export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, password } = req.body;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
        return res.status(503).json({ message: 'Server configuration error: ADMIN_PASSWORD is not set' });
    }
    if (password !== ADMIN_PASSWORD) {
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
        const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
        const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
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

        await syncFilesJson({
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Vercel-Upload-App'
        }, owner, repo, (list) => list.filter(e => e.name !== filename));
        
        return res.status(200).json({ message: 'Deleted successfully' });
    } catch(e) {
        console.error(e);
        return res.status(500).json({ message: e.message });
    }
}

// --- files.json maintenance -------------------------------------------
// The materials list is served to students from the STATIC files.json
// (see vercel.json rewrite of /api/files), so it never depends on the
// GitHub API at page-load time. Keep it in sync on every upload/delete.
// Best-effort: a failure here must never fail the upload/delete itself.
async function syncFilesJson(ghHeaders, owner, repo, mutate) {
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/files.json`;
        let list = [];
        let sha = null;
        const getRes = await fetch(url, { headers: ghHeaders });
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
            try {
                list = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
            } catch (e) { list = []; }
        }
        if (!Array.isArray(list)) list = [];
        const next = mutate(list);
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: 'Update files.json (materials list)',
                content: Buffer.from(JSON.stringify(next, null, 1)).toString('base64'),
                ...(sha ? { sha } : {})
            })
        });
        if (!putRes.ok) console.warn('files.json sync failed:', putRes.status);
    } catch (e) {
        console.warn('files.json sync error:', e.message);
    }
}
