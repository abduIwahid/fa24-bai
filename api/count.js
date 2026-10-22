// Lightweight download/view counter for the "Most Downloaded" strip.
//
// Storage: counts.json in the repo root, shaped {"counts": {"<path>": n}}.
// Writes go through the GitHub Contents API with sha-based optimistic
// concurrency: on a 409/422 (someone else wrote first) we re-read and
// retry up to 3 times, so concurrent increments merge instead of
// clobbering each other. The client also throttles to one increment per
// file per browser session, keeping commit volume modest.
//
// If GITHUB_TOKEN is missing the endpoint degrades quietly (GET returns
// an empty map, POST is a no-op success) so the strip simply stays hidden.

const owner = 'abduIwahid';
const repo = 'fa24-bai';
const path = 'counts.json';

const ghHeaders = (token) => ({
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Vercel-Study-Hub',
    'Content-Type': 'application/json'
});

async function readCounts(token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const r = await fetch(url, { headers: ghHeaders(token) });
    if (r.status === 404) return { counts: {}, sha: null };
    if (!r.ok) throw new Error(`GitHub read failed: ${r.status}`);
    const data = await r.json();
    let parsed = {};
    try {
        parsed = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
    } catch (e) {
        // A corrupt counts file must never break the site: start fresh,
        // but keep the sha so the next write repairs it in place.
        parsed = {};
    }
    const counts = (parsed && typeof parsed.counts === 'object' && parsed.counts) || {};
    return { counts, sha: data.sha || null };
}

export default async function handler(req, res) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (req.method === 'GET') {
        if (!GITHUB_TOKEN) {
            return res.status(200).json({ counts: {} });
        }
        try {
            const { counts } = await readCounts(GITHUB_TOKEN);
            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
            return res.status(200).json({ counts });
        } catch (error) {
            console.error('Count read error:', error);
            return res.status(200).json({ counts: {} });
        }
    }

    if (req.method === 'POST') {
        const name = req.body && req.body.name;
        if (typeof name !== 'string' || !name || name.length > 300 || !/\.(pdf|pptx|ppt|doc|docx)$/i.test(name)) {
            return res.status(400).json({ message: 'Invalid file name' });
        }
        if (!GITHUB_TOKEN) {
            return res.status(200).json({ ok: true, skipped: true });
        }

        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        let lastErr = null;

        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                const { counts, sha } = await readCounts(GITHUB_TOKEN);
                counts[name] = (typeof counts[name] === 'number' ? counts[name] : 0) + 1;

                const body = {
                    message: `Count view: ${name.split('/').pop()}`,
                    content: Buffer.from(JSON.stringify({ counts }, null, 2)).toString('base64'),
                    ...(sha ? { sha } : {})
                };
                const putRes = await fetch(url, { method: 'PUT', headers: ghHeaders(GITHUB_TOKEN), body: JSON.stringify(body) });

                if (putRes.ok) {
                    return res.status(200).json({ ok: true, count: counts[name] });
                }
                if (putRes.status === 409 || putRes.status === 422) {
                    lastErr = new Error(`Conflict (HTTP ${putRes.status})`);
                    // brief backoff with jitter before re-reading + retrying
                    await new Promise(r => setTimeout(r, 120 * (attempt + 1) + Math.floor(Math.random() * 120)));
                    continue;
                }
                const errBody = await putRes.json().catch(() => ({}));
                return res.status(putRes.status).json({ message: errBody.message || 'Count update failed' });
            } catch (error) {
                lastErr = error;
                await new Promise(r => setTimeout(r, 120 * (attempt + 1)));
            }
        }

        console.error('Count update failed after retries:', lastErr && lastErr.message);
        return res.status(502).json({ message: 'Count update failed after retries' });
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
}
