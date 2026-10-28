export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const owner = 'abduIwahid';
    const repo = 'fa24-bai';

    // In-memory cache (survives across warm invocations of this function
    // instance). The materials list changes rarely, so serving an hour-old
    // copy is fine — and it keeps GitHub's API quota from being burned by
    // repeat traffic: previously every cold CDN cache cost 1 tree call +
    // one commits call PER FILE, and a GitHub rate-limit then took the
    // whole list down for everyone.
    const now = Date.now();
    if (handlerCache.data && (now - handlerCache.at) < 60 * 60 * 1000) {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json(handlerCache.data);
    }

    try {
        const headers = { 'User-Agent': 'Vercel-Upload-App' };

        // Use token if available to avoid rate limits
        if (GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
        }

        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
        const response = await fetch(treeUrl, { headers });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            // Resilience: if GitHub is rate-limiting (or down) and we have
            // ANY earlier copy in memory, serve the stale list instead of
            // failing the whole page for every student.
            if (handlerCache.data) {
                res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
                return res.status(200).json(handlerCache.data);
            }
            return res.status(response.status).json({ message: err.message || 'Error fetching from GitHub' });
        }

        const data = await response.json();

        // Map the tree array back to the expected [{name: ...}] format
        const pdfs = data.tree
            .filter(item => item.type === 'blob' && item.path.match(/\.(pdf|pptx|ppt|doc|docx)$/i))
            .map(item => ({ name: item.path }));

        // --- Round 2: attach per-file created/updated dates ---------------
        // Derived from the commit history of each path (one commits call per
        // file returns newest-first, so [0] = last updated, [last] = first
        // added). Fully best-effort — any failure simply returns the files
        // without dates. Only runs on a genuine refresh (see cache above),
        // not on every request.
        if (GITHUB_TOKEN) {
            try {
                await attachDates(pdfs, headers, owner, repo);
            } catch (dateErr) {
                console.warn('Date enrichment failed, serving files without dates:', dateErr.message);
            }
        }

        handlerCache = { at: Date.now(), data: pdfs };

        // Let Vercel's CDN absorb repeat traffic: fresh for an hour,
        // stale-while-revalidate for a day after that.
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json(pdfs);
    } catch (error) {
        console.error("Fetch error:", error);
        if (handlerCache.data) {
            res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
            return res.status(200).json(handlerCache.data);
        }
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

// Module-level cache shared by all invocations on a warm instance.
let handlerCache = { at: 0, data: null };

// Fetch commit dates for every path with bounded concurrency.
async function attachDates(files, headers, owner, repo) {
    const CONCURRENCY = 8;
    let idx = 0;

    const worker = async () => {
        while (idx < files.length) {
            const file = files[idx++];
            try {
                const encodedPath = file.name.split('/').map(encodeURIComponent).join('/');
                const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodedPath}&per_page=100`;
                const r = await fetch(url, { headers });
                if (!r.ok) continue;
                const commits = await r.json();
                if (!Array.isArray(commits) || commits.length === 0) continue;
                const dateOf = (c) => (c && c.commit && ((c.commit.committer && c.commit.committer.date) || (c.commit.author && c.commit.author.date))) || null;
                const latest = dateOf(commits[0]);
                const earliest = dateOf(commits[commits.length - 1]);
                if (latest) file.updatedAt = latest;
                if (earliest) file.createdAt = earliest;
            } catch (e) {
                // best-effort per file: leave dates off this one
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
}
