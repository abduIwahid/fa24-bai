export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, prompt, action, password } = req.body;

    // Support admin password verification
    if (action === 'verify') {
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin@fa24bai';
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

        // Candidate models available in Google Generative AI v1beta
        const candidateModels = [
            'gemini-1.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash-8b',
            'gemini-1.5-pro-latest'
        ];

        let replyText = null;
        let lastErrorMessage = '';

        // Helper to query Gemini REST endpoint
        async function queryGemini(modelName, partsPayload) {
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY.trim())}`;
            const apiRes = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: partsPayload }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048
                    }
                })
            });

            const data = await apiRes.json();
            return { ok: apiRes.ok, status: apiRes.status, data };
        }

        // Try candidate models with multimodal PDF payload first
        for (const modelName of candidateModels) {
            try {
                const resPdf = await queryGemini(modelName, partsWithPdf);

                if (resPdf.ok && resPdf.data.candidates && resPdf.data.candidates[0] && resPdf.data.candidates[0].content) {
                    const textParts = resPdf.data.candidates[0].content.parts.map(p => p.text).join('\n');
                    if (textParts) {
                        replyText = textParts;
                        break;
                    }
                }

                // If error occurred with PDF payload (e.g., payload size limit or schema), fallback to text-only prompt
                if (base64Pdf && resPdf.data && resPdf.data.error) {
                    console.warn(`Model ${modelName} PDF payload error, retrying text-only:`, resPdf.data.error.message);
                    const resText = await queryGemini(modelName, partsTextOnly);
                    if (resText.ok && resText.data.candidates && resText.data.candidates[0] && resText.data.candidates[0].content) {
                        const textParts = resText.data.candidates[0].content.parts.map(p => p.text).join('\n');
                        if (textParts) {
                            replyText = textParts;
                            break;
                        }
                    }
                }

                if (resPdf.data && resPdf.data.error) {
                    lastErrorMessage = resPdf.data.error.message || 'API error';
                    // If key is outright invalid, stop early
                    if (lastErrorMessage.toLowerCase().includes('api_key_invalid') || lastErrorMessage.toLowerCase().includes('api key not valid')) {
                        break;
                    }
                }
            } catch (modelErr) {
                lastErrorMessage = modelErr.message;
                console.warn(`Model ${modelName} request exception:`, lastErrorMessage);
            }
        }

        if (replyText) {
            return res.status(200).json({ reply: replyText });
        }

        return res.status(200).json({
            reply: lastErrorMessage
                ? `AI response notice: ${lastErrorMessage}. Please verify your GEMINI_API_KEY in Vercel settings.`
                : 'AI assistant is temporarily unable to process this document. Please try again shortly.'
        });
    } catch (error) {
        console.error('AI Handler Error:', error);
        return res.status(200).json({
            reply: `AI assistant encountered an unexpected error: ${error.message || 'Check connection'}.`
        });
    }
}
