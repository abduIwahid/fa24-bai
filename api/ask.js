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

        // Assemble request parts
        const parts = [];
        if (base64Pdf) {
            parts.push({
                inline_data: {
                    mime_type: 'application/pdf',
                    data: base64Pdf
                }
            });
        }

        parts.push({
            text: `${systemMessage}

Document Title: ${cleanDocName}${folderContext ? ` (Category: ${folderContext})` : ''}

${promptInstruction}`
        });

        // Try candidate Gemini models via direct Google Generative Language REST API
        const candidateModels = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-2.0-flash',
            'gemini-1.5-pro'
        ];

        let replyText = null;
        let lastErrorMessage = '';

        for (const modelName of candidateModels) {
            try {
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY.trim())}`;
                const apiRes = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 2048
                        }
                    })
                });

                const data = await apiRes.json();

                if (apiRes.ok && data.candidates && data.candidates[0] && data.candidates[0].content) {
                    const textParts = data.candidates[0].content.parts.map(p => p.text).join('\n');
                    if (textParts) {
                        replyText = textParts;
                        break;
                    }
                } else if (data.error) {
                    lastErrorMessage = data.error.message || 'API error';
                    console.warn(`Model ${modelName} returned error:`, lastErrorMessage);
                    // If error is about API key, break immediately
                    if (lastErrorMessage.toLowerCase().includes('api key')) {
                        break;
                    }
                }
            } catch (modelErr) {
                lastErrorMessage = modelErr.message;
                console.warn(`Model ${modelName} fetch error:`, lastErrorMessage);
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
