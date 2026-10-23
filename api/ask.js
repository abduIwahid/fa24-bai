export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, prompt, action, password } = req.body;

    // Lightweight per-IP rate limiting (best effort, in-memory): slows down
    // password guessing on 'verify' and AI quota abuse on the AI actions.
    const clientIp = ((req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim() || 'unknown';
    if (!global.__askRate) global.__askRate = new Map();
    const nowMs = Date.now();
    const bucketKey = clientIp + ':' + (action === 'verify' ? 'verify' : 'ai');
    const hits = (global.__askRate.get(bucketKey) || []).filter(t => nowMs - t < 60000);
    const limit = action === 'verify' ? 10 : 20;
    if (hits.length >= limit) {
        if (action === 'verify') {
            return res.status(429).json({ success: false, message: 'Too many attempts - please wait a minute and try again.' });
        }
        return res.status(200).json({ reply: 'Too many AI requests right now - please wait a minute and try again.' });
    }
    hits.push(nowMs);
    global.__askRate.set(bucketKey, hits);

    // Support admin password verification (server-side only, fail closed:
    // if the env var is not configured, nobody gets in)
    if (action === 'verify') {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
        if (!ADMIN_PASSWORD) {
            return res.status(503).json({ success: false, message: 'Server configuration error: ADMIN_PASSWORD is not set' });
        }
        if (password === ADMIN_PASSWORD) {
            return res.status(200).json({ success: true, message: 'Authorized' });
        }
        return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(200).json({
            reply: 'Server configuration note: GEMINI_API_KEY is not set in Vercel Environment Variables. Please add your Google AI Studio key to Vercel.'
        });
    }

    try {
        const owner = 'abduIwahid';
        const repo = 'fa24-bai';
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        const cleanDocName = filename
            ? filename.split('/').pop().replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
            : 'Course Document';
        const folderContext = filename && filename.includes('/')
            ? filename.substring(0, filename.lastIndexOf('/'))
            : '';

        // Shared summary cache: the first student's summary of a file is
        // stored in the repo and served to everyone after that - one Gemini
        // call per lecture instead of one per student.
        let cachePath = null;
        if (action === 'summarize' && filename) {
            cachePath = 'ai-cache/' + filename.replace(/[^a-zA-Z0-9]+/g, '_') + '.json';
            try {
                // Read via the Contents API, not raw.githubusercontent: the raw
                // CDN caches 404s, so a just-written cache file can look
                // missing for minutes. The API read is strongly consistent.
                if (GITHUB_TOKEN) {
                    const cRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${cachePath}`, {
                        headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'StudyHub-AI-Cache' },
                        signal: AbortSignal.timeout(8000)
                    });
                    if (cRes.ok) {
                        const j = await cRes.json();
                        const decoded = Buffer.from((j.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
                        const cached = JSON.parse(decoded);
                        if (cached && cached.reply) {
                            return res.status(200).json({ reply: cached.reply, cached: true });
                        }
                    }
                }
            } catch (cacheErr) { /* cache is best-effort */ }
        }

        let base64Pdf = null;

        // Fetch PDF from GitHub if filename is provided
        if (filename && filename.match(/\.pdf$/i)) {
            try {
                const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
                const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodedPath}`;
                const fetchHeaders = {};
                if (GITHUB_TOKEN) {
                    fetchHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
                }

                const fileResponse = await fetch(url, { headers: fetchHeaders, signal: AbortSignal.timeout(15000) });
                if (fileResponse.ok) {
                    const arrayBuffer = await fileResponse.arrayBuffer();
                    // Check file size under 7MB for inline data transfer
                    if (arrayBuffer.byteLength > 0 && arrayBuffer.byteLength < 7 * 1024 * 1024) {
                        base64Pdf = Buffer.from(arrayBuffer).toString('base64');
                    }
                }
            } catch (fetchErr) {
                console.warn('Could not load raw PDF for inline data:', fetchErr.message);
            }
        }

        // Build prompt instruction
        let promptInstruction = '';
        if (action === 'summarize') {
            promptInstruction = `Provide a comprehensive, highly structured study summary for "${cleanDocName}".
Include:
- Core Overview: Primary purpose and fundamental themes.
- Key Concepts & Theorems/Formulas: Clear bullet points explaining essential topics.
- Exam Takeaways: High-yield concepts, key definitions, and critical exam points.
Keep the whole summary focused and under ~450 words.`;
        } else if (action === 'quiz') {
            promptInstruction = `Generate 5 high-yield multiple choice practice questions (MCQs) for "${cleanDocName}".
For each question:
- State the question clearly.
- Provide options (A, B, C, D).
- At the end, include an "Answers & Explanations" section with the correct choices and concise rationales.`;
        } else if (action === 'viva') {
            promptInstruction = `Generate 5 realistic viva / oral exam questions on "${cleanDocName}".
Provide each question followed by a model answer highlighting the exact keywords an examiner expects.`;
        } else {
            promptInstruction = `The student is studying "${cleanDocName}" and asked:
"${prompt}"

Provide a direct, academically thorough, and helpful answer.`;
        }

        const systemMessage = `You are an expert academic tutor for students in the FA24-BAI (Artificial Intelligence) program. Provide clear, accurate, and structured study guidance without conversational filler.

FORMATTING RULES (strict):
- Never use LaTeX or math markup: no $$...$$, no $...$, no \text{}, \rightarrow, \frac or any backslash commands.
- Write formulas in plain text, e.g. O(n log n), T(n) = 2T(n/2) + n, x^2. Use -> for arrows and <= / >= for comparisons.
- Use ## for section headings and - for bullet points. Be direct and concise; skip any content that does not help the student.`;

        const textPromptPart = {
            text: `${systemMessage}

Document Title: ${cleanDocName}${folderContext ? ` (Category: ${folderContext})` : ''}

${promptInstruction}`
        };

        // Assemble request parts (multimodal with PDF inlineData if available)
        const partsWithPdf = [];
        if (base64Pdf) {
            partsWithPdf.push({
                inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Pdf
                }
            });
        }
        partsWithPdf.push(textPromptPart);

        const partsTextOnly = [textPromptPart];

        const cleanKey = (GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim();

        // Fast path: known-good models first (no discovery call per request,
        // which keeps answers quick and saves API quota for a full class).
        let targetModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];

        // Fallback only: discover whatever this key can actually use.
        async function discoverModels() {
            try {
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
                const listRes = await fetch(listUrl, { signal: AbortSignal.timeout(10000) });
                const listData = await listRes.json();
                if (!listRes.ok || listData.error || !Array.isArray(listData.models)) return [];
                const contentModels = listData.models
                    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace(/^models\//, ''))
                    .filter(m => m.startsWith('gemini-') && !m.includes('deep-research') && !m.includes('preview-0'));
                const preferred = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
                const out = [];
                for (const p of preferred) {
                    const match = contentModels.find(m => m === p || m.startsWith(`${p}-`));
                    if (match && !out.includes(match)) out.push(match);
                }
                for (const m of contentModels) {
                    if (m.includes('flash') && !out.includes(m)) out.push(m);
                }
                return out;
            } catch (e) {
                return [];
            }
        }

        let modelErrors = [];

        // Helper to query Gemini REST endpoint
        async function queryGemini(modelName, partsPayload) {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
            const apiRes = await fetch(apiUrl, {
                signal: AbortSignal.timeout(25000),
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: partsPayload
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: ['summarize', 'quiz', 'viva'].includes(action) ? 2048 : 1024
                    }
                })
            });
            const data = await apiRes.json();
            return { ok: apiRes.ok, status: apiRes.status, data };
        }


        async function tryModels(models) {
            for (const modelName of models) {
                try {
                    const primaryPayload = base64Pdf ? partsWithPdf : partsTextOnly;
                    let res = await queryGemini(modelName, primaryPayload);
                    if (res.ok && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content) {
                        const textParts = res.data.candidates[0].content.parts.map(p => p.text).join('\n');
                        if (textParts) return textParts;
                    }
                    if (base64Pdf && res.data && res.data.error) {
                        const resText = await queryGemini(modelName, partsTextOnly);
                        if (resText.ok && resText.data.candidates && resText.data.candidates[0] && resText.data.candidates[0].content) {
                            const textParts = resText.data.candidates[0].content.parts.map(p => p.text).join('\n');
                            if (textParts) return textParts;
                        }
                    }
                    if (res.data && res.data.error) {
                        const errMsg = res.data.error.message || `Error code ${res.data.error.code}`;
                        modelErrors.push(`${modelName}: ${errMsg}`);
                        if (errMsg.toLowerCase().includes('api key not valid') || errMsg.toLowerCase().includes('api_key_invalid')) break;
                    }
                } catch (modelErr) {
                    modelErrors.push(`${modelName}: ${modelErr.message}`);
                }
            }
            return null;
        }

        let replyText = await tryModels(targetModels);
        if (!replyText) {
            const discovered = await discoverModels();
            const extra = discovered.filter(m => !targetModels.includes(m));
            if (extra.length) replyText = await tryModels(extra);
        }

        if (replyText) {
            if (cachePath && GITHUB_TOKEN) {
                try {
                    const ghHeaders = { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'StudyHub-AI-Cache' };
                    const cUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cachePath}`;
                    let existingSha = null;
                    const gRes = await fetch(cUrl, { headers: ghHeaders, signal: AbortSignal.timeout(6000) });
                    if (gRes.ok) { const j = await gRes.json(); existingSha = j.sha; }
                    const payload = JSON.stringify({ file: filename, action: 'summarize', createdAt: new Date().toISOString(), reply: replyText }, null, 2);
                    await fetch(cUrl, {
                        method: 'PUT', headers: ghHeaders, signal: AbortSignal.timeout(8000),
                        body: JSON.stringify({ message: `AI summary cache: ${filename}`, content: Buffer.from(payload).toString('base64'), ...(existingSha ? { sha: existingSha } : {}) })
                    });
                } catch (cacheWriteErr) { /* never let caching break the answer */ }
            }
            return res.status(200).json({ reply: replyText });
        }

        console.error('AI: all model attempts failed:', modelErrors.join(' | ') || 'No active model response received.');

        return res.status(200).json({
            reply: 'The AI assistant is having trouble right now — please try again in a few minutes.'
        });
    } catch (error) {
        console.error('AI Handler Error:', error);
        return res.status(200).json({
            reply: `AI assistant encountered an unexpected error: ${error.message || 'Check connection'}.`
        });
    }
}
