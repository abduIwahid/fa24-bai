import { Readable } from 'node:stream';

// Single-file download: streams a listed course file back with a
// Content-Disposition: attachment header so browsers (especially
// mobile) save it instead of opening it inline.
// Only paths present in the static files.json can be downloaded.
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const file = req.query.file;
    if (!file || typeof file !== 'string') {
        return res.status(400).json({ message: 'Missing file parameter' });
    }

    try {
        const origin = `https://${req.headers.host}`;

        const listRes = await fetch(`${origin}/files.json`);
        if (!listRes.ok) {
            return res.status(500).json({ message: 'Could not read the materials list' });
        }
        const list = await listRes.json();
        const allowed = new Set((Array.isArray(list) ? list : []).map(e => e.name));
        if (!allowed.has(file)) {
            return res.status(404).json({ message: 'File not found' });
        }

        const encodedPath = file.split('/').map(encodeURIComponent).join('/');
        const fileRes = await fetch(`${origin}/${encodedPath}`);
        if (!fileRes.ok || !fileRes.body) {
            return res.status(502).json({ message: 'Could not fetch the file' });
        }

        const base = file.split('/').pop().replace(/"/g, '');
        res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'application/octet-stream');
        const len = fileRes.headers.get('content-length');
        if (len) res.setHeader('Content-Length', len);
        res.setHeader('Content-Disposition', `attachment; filename="${base}"`);
        res.setHeader('Cache-Control', 'private, no-store');

        Readable.fromWeb(fileRes.body).pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Internal Server Error' });
        }
        res.end();
    }
}
