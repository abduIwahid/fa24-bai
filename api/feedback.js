// Feedback endpoint: stores student feedback as a JSON file in the repo
// (same GitHub Contents pattern as uploads/counts), so the maintainer can
// read everything in one place. POST { name?, message, page? }
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Lightweight per-IP rate limiting (best effort, in-memory)
    const clientIp = ((req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim() || 'unknown';
    if (!global.__fbRate) global.__fbRate = new Map();
    const nowMs = Date.now();
    const hits = (global.__fbRate.get(clientIp) || []).filter(t => nowMs - t < 60000);
    if (hits.length >= 5) {
        return res.status(429).json({ success: false, message: 'Too many submissions - please wait a minute.' });
    }
    hits.push(nowMs);
    global.__fbRate.set(clientIp, hits);

    const { name, message, page } = req.body || {};
    const cleanName = (name || '').toString().trim().slice(0, 60);
    const cleanMessage = (message || '').toString().trim().slice(0, 1000);
    const cleanPage = (page || '').toString().trim().slice(0, 120);
    if (cleanMessage.length < 3) {
        return res.status(400).json({ success: false, message: 'Please write a little more detail.' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ success: false, message: 'Server configuration error: GITHUB_TOKEN missing' });
    }

    const owner = 'abduIwahid';
    const repo = 'fa24-bai';
    const path = 'feedback/feedback.json';
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const ghHeaders = {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'StudyHub-Feedback'
    };

    try {
        let items = [];
        let sha = null;
        const getRes = await fetch(url, { headers: ghHeaders, signal: AbortSignal.timeout(8000) });
        if (getRes.ok) {
            const j = await getRes.json();
            sha = j.sha;
            try {
                const decoded = Buffer.from((j.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) items = parsed;
            } catch (e) { /* start fresh if the file is unreadable */ }
        }

        items.push({
            at: new Date().toISOString(),
            name: cleanName || 'Anonymous',
            message: cleanMessage,
            page: cleanPage || 'home'
        });
        if (items.length > 500) items = items.slice(items.length - 500);

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: ghHeaders,
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
                message: `Feedback: ${cleanMessage.slice(0, 60)}`,
                content: Buffer.from(JSON.stringify(items, null, 2)).toString('base64'),
                ...(sha ? { sha } : {})
            })
        });
        if (!putRes.ok) {
            const err = await putRes.json().catch(() => ({}));
            return res.status(putRes.status).json({ success: false, message: err.message || 'Could not save feedback' });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Feedback error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}
