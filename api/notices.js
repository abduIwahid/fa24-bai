export default async function handler(req, res) {
    const owner = 'abduIwahid';
    const repo = 'fa24-bai';
    const path = 'notices.json';
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (req.method === 'GET') {
        try {
            const headers = { 'User-Agent': 'Vercel-Study-Hub' };
            if (GITHUB_TOKEN) {
                headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
            }

            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const response = await fetch(url, { headers });

            if (response.ok) {
                const data = await response.json();
                const content = Buffer.from(data.content, 'base64').toString('utf-8');
                const notices = JSON.parse(content);
                return res.status(200).json(notices);
            }

            // Fallback: try raw URL
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
            const rawRes = await fetch(rawUrl);
            if (rawRes.ok) {
                const notices = await rawRes.json();
                return res.status(200).json(notices);
            }

            return res.status(200).json([]);
        } catch (error) {
            console.error('Fetch notices error:', error);
            return res.status(200).json([]);
        }
    }

    if (req.method === 'POST') {
        const { password, notices, action } = req.body;

        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        if (!ADMIN_PASSWORD) {
            return res.status(503).json({ message: 'Server configuration error: ADMIN_PASSWORD is not set' });
        }
        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ message: 'Unauthorized: Invalid Admin Password' });
        }

        if (!Array.isArray(notices)) {
            return res.status(400).json({ message: 'Invalid payload: notices must be an array' });
        }

        // Normalize to the known notice model so stray/legacy fields can't
        // corrupt the board. Backward compatible: older notices only carry
        // {text, date}; the round-2 fields (examDate, time, category,
        // pinned, course) are all optional.
        const CATEGORIES = ['Exam', 'Class', 'General'];
        const cleanNotices = notices.slice(0, 200).map((n) => {
            const out = {
                text: String((n && n.text) || '').slice(0, 4000),
                date: String((n && n.date) || '')
            };
            if (n && typeof n.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.examDate)) out.examDate = n.examDate;
            if (n && typeof n.time === 'string' && n.time) out.time = n.time.slice(0, 60);
            if (n && CATEGORIES.includes(n.category)) out.category = n.category;
            if (n && n.pinned === true) out.pinned = true;
            if (n && typeof n.course === 'string' && n.course) out.course = n.course.slice(0, 20);
            return out;
        }).filter(n => n.text);

        if (!GITHUB_TOKEN) {
            return res.status(500).json({ message: 'Server configuration error: GITHUB_TOKEN missing' });
        }

        try {
            // Get current file sha
            const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
            const getRes = await fetch(getUrl, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'User-Agent': 'Vercel-Study-Hub'
                }
            });

            let sha = null;
            if (getRes.ok) {
                const existing = await getRes.json();
                sha = existing.sha;
            }

            const updatedContentBase64 = Buffer.from(JSON.stringify(cleanNotices, null, 2)).toString('base64');
            const putRes = await fetch(getUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Vercel-Study-Hub'
                },
                body: JSON.stringify({
                    message: action === 'delete' ? 'Delete notice via Admin UI' : 'Post notice via Admin UI',
                    content: updatedContentBase64,
                    ...(sha ? { sha } : {})
                })
            });

            if (!putRes.ok) {
                const err = await putRes.json();
                return res.status(putRes.status).json({ message: err.message });
            }

            return res.status(200).json({ message: 'Notices updated successfully', notices: cleanNotices });
        } catch (error) {
            console.error('Save notices error:', error);
            return res.status(500).json({ message: error.message || 'Internal Server Error' });
        }
    }

    return res.status(405).json({ message: 'Method Not Allowed' });
}
