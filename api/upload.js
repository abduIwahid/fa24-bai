export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, contentBase64, password, folder } = req.body;
    
    // Security check (fail closed: no env var configured = no access)
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
    if (!ADMIN_PASSWORD) {
        return res.status(503).json({ message: 'Server configuration error: ADMIN_PASSWORD is not set' });
    }
    if (password !== ADMIN_PASSWORD) {
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
    
    let path = filename;
    if (folder && folder.trim() !== '') {
        const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
        path = `${cleanFolder}/${filename}`;
    }

    // Percent-encode each path segment (file names contain spaces, '#', etc.)
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    const ghHeaders = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Upload-App'
    };

    try {
        // GitHub requires the current blob sha to overwrite an existing
        // file — look it up first so re-uploading a fixed deck works.
        let existingSha = null;
        const getRes = await fetch(url, { headers: ghHeaders });
        if (getRes.ok) {
            const existing = await getRes.json();
            existingSha = existing.sha;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
                message: `Upload ${filename} via Vercel`,
                content: contentBase64,
                ...(existingSha ? { sha: existingSha } : {})
            })
        });

        if (!response.ok) {
            const err = await response.json();
            return res.status(response.status).json({ message: err.message });
        }

        const byteSize = Buffer.from(contentBase64, 'base64').length;
        await syncFilesJson(ghHeaders, owner, repo, (list) => {
            const now = new Date().toISOString();
            const existing = list.find(e => e.name === path);
            if (existing) {
                existing.updatedAt = now;
                existing.size = byteSize;
                if (!existing.createdAt) existing.createdAt = now;
                return list;
            }
            list.push({ name: path, updatedAt: now, createdAt: now, size: byteSize });
            return list;
        });

        return res.status(200).json({ message: 'File uploaded successfully' });
    } catch (error) {
        console.error("Upload error:", error);
        return res.status(500).json({ message: 'Internal Server Error' });
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
