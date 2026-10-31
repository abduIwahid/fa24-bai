import JSZip from 'jszip';

// Folder download: builds one ZIP from a list of course files and
// streams it back as an attachment. The client sends the exact file
// paths shown in the folder view; every path is validated against
// the static files.json before anything is fetched.
const MAX_FILES = 60;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { files, name } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ message: 'No files provided' });
    }
    if (files.length > MAX_FILES) {
        return res.status(400).json({ message: `Too many files (max ${MAX_FILES})` });
    }

    try {
        const origin = `https://${req.headers.host}`;

        const listRes = await fetch(`${origin}/files.json`);
        if (!listRes.ok) {
            return res.status(500).json({ message: 'Could not read the materials list' });
        }
        const list = await listRes.json();
        const allowed = new Set((Array.isArray(list) ? list : []).map(e => e.name));
        const wanted = [...new Set(files)].filter(f => typeof f === 'string' && allowed.has(f));
        if (wanted.length === 0) {
            return res.status(404).json({ message: 'None of the requested files were found' });
        }

        const zip = new JSZip();
        const usedNames = new Set();
        let added = 0;
        for (const file of wanted) {
            const encodedPath = file.split('/').map(encodeURIComponent).join('/');
            const fileRes = await fetch(`${origin}/${encodedPath}`);
            if (!fileRes.ok) continue;
            const buf = Buffer.from(await fileRes.arrayBuffer());

            // Entry name = bare file name; de-duplicate collisions.
            let base = file.split('/').pop();
            if (usedNames.has(base)) {
                const dot = base.lastIndexOf('.');
                const stem = dot > 0 ? base.slice(0, dot) : base;
                const ext = dot > 0 ? base.slice(dot) : '';
                let n = 2;
                while (usedNames.has(`${stem} (${n})${ext}`)) n++;
                base = `${stem} (${n})${ext}`;
            }
            usedNames.add(base);
            zip.file(base, buf);
            added++;
        }

        if (added === 0) {
            return res.status(502).json({ message: 'Could not fetch any of the files' });
        }

        const zipBase = String(name || 'Study Hub Files').replace(/[^\w\- ]+/g, '').trim() || 'Study Hub Files';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipBase}.zip"`);
        res.setHeader('Content-Encoding', 'identity');
        res.setHeader('Cache-Control', 'private, no-store, no-transform');
        res.setHeader('X-Files-Included', String(added));

        // PDFs are already compressed — STORE keeps this fast and light.
        zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'STORE' })
            .on('error', (e) => { console.error('ZIP stream error:', e); res.end(); })
            .pipe(res);
    } catch (error) {
        console.error('ZIP download error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ message: 'Internal Server Error' });
        }
        res.end();
    }
}
