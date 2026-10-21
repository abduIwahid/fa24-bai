export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, prompt, action, password } = req.body;

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

                const fileResponse = await fetch(url, { headers: fetchHeaders });
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
- Exam Takeaways: High-yield concepts, key definitions, and critical exam points.`;
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

        const systemMessage = `You are an expert academic tutor for students in the FA24-BAI (Artificial Intelligence) program. Provide clear, accurate, and structured study guidance in clean markdown without conversational filler.`;

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

        // Dynamically query Google Generative Language API to discover available models for this key
        let targetModels = [];
        try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
            const listRes = await fetch(listUrl);
            const listData = await listRes.json();

            if (!listRes.ok || listData.error) {
                const apiErrMsg = listData.error ? listData.error.message : `HTTP ${listRes.status}`;
                console.warn('Google ListModels returned error:', apiErrMsg);
                return res.status(200).json({
                    reply: `Google Gemini API error: ${apiErrMsg}. Please check your GEMINI_API_KEY in Vercel settings.`
                });
            }

            if (Array.isArray(listData.models)) {
                // Strictly filter to conversational Gemini models only (exclude research, embedding, or zero-quota preview models)
                const contentModels = listData.models
                    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace(/^models\//, ''))
                    .filter(m => m.startsWith('gemini-') && !m.includes('deep-research') && !m.includes('preview-0'));

                // Prioritize fastest and standard free-tier models in order
                const preferred = [
                    'gemini-1.5-flash',
                    'gemini-2.0-flash',
                    'gemini-1.5-flash-8b',
                    'gemini-2.0-flash-exp'
                ];

                for (const p of preferred) {
                    const match = contentModels.find(m => m === p || m.startsWith(`${p}-`));
                    if (match && !targetModels.includes(match)) {
                        targetModels.push(match);
                    }
                }

                for (const m of contentModels) {
                    if (m.includes('flash') && !targetModels.includes(m)) {
                        targetModels.push(m);
                    }
                }
            }
        } catch (discoverErr) {
            console.warn('Could not discover models dynamically, falling back to defaults:', discoverErr.message);
        }

        if (targetModels.length === 0) {
            targetModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];
        }

        let replyText = null;
        let modelErrors = [];

        // Helper to query Gemini REST endpoint
        async function queryGemini(modelName, partsPayload) {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
            const apiRes = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: partsPayload
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048
                    }
                })
            });

            const data = await apiRes.json();
            return { ok: apiRes.ok, status: apiRes.status, data };
        }

        // Try available models
        for (const modelName of targetModels) {
            try {
                // Try multimodal PDF if available, otherwise text
                const primaryPayload = base64Pdf ? partsWithPdf : partsTextOnly;
                let res = await queryGemini(modelName, primaryPayload);

                if (res.ok && res.data.candidates && res.data.candidates[0] && res.data.candidates[0].content) {
                    const textParts = res.data.candidates[0].content.parts.map(p => p.text).join('\n');
                    if (textParts) {
                        replyText = textParts;
                        break;
                    }
                }

                // If multimodal PDF payload failed, retry with text only
                if (base64Pdf && res.data && res.data.error) {
                    console.warn(`Model ${modelName} PDF payload failed, retrying text-only:`, res.data.error.message);
                    const resText = await queryGemini(modelName, partsTextOnly);
                    if (resText.ok && resText.data.candidates && resText.data.candidates[0] && resText.data.candidates[0].content) {
                        const textParts = resText.data.candidates[0].content.parts.map(p => p.text).join('\n');
                        if (textParts) {
                            replyText = textParts;
                            break;
                        }
                    }
                }

                if (res.data && res.data.error) {
                    const errMsg = res.data.error.message || `Error code ${res.data.error.code}`;
                    modelErrors.push(`${modelName}: ${errMsg}`);
                    // If error is about API key authenticity, break immediately
                    if (errMsg.toLowerCase().includes('api key') || errMsg.toLowerCase().includes('permission_denied')) {
                        break;
                    }
                }
            } catch (modelErr) {
                modelErrors.push(`${modelName}: ${modelErr.message}`);
                console.warn(`Model ${modelName} request exception:`, modelErr.message);
            }
        }

        if (replyText) {
            return res.status(200).json({ reply: replyText });
        }

        const primaryError = modelErrors.length > 0 ? modelErrors[0] : 'No active model response received.';

        return res.status(200).json({
            reply: `AI response notice: ${primaryError}. Please verify your GEMINI_API_KEY in Vercel settings.`
        });
    } catch (error) {
        console.error('AI Handler Error:', error);
        return res.status(200).json({
            reply: `AI assistant encountered an unexpected error: ${error.message || 'Check connection'}.`
        });
    }
}
