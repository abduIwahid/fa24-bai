import pdf from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
        return res.status(500).json({ reply: 'Server Error: GEMINI_API_KEY is not configured in environment variables.' });
    }

    try {
        const owner = 'abduIwahid';
        const repo = 'fa24-bai';
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

        // Clean document and folder names for context
        const cleanDocName = filename
            ? filename.split('/').pop().replace(/\.[^/.]+$/, '').replace(/_/g, ' ')
            : 'Course Document';
        const folderContext = filename && filename.includes('/')
            ? filename.substring(0, filename.lastIndexOf('/'))
            : '';

        let pdfText = '';

        // Attempt to fetch and extract document text from GitHub
        if (filename) {
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
                    const buffer = Buffer.from(arrayBuffer);

                    // Only parse PDF formats with pdf-parse
                    if (filename.match(/\.pdf$/i)) {
                        const parsed = await pdf(buffer);
                        if (parsed && parsed.text) {
                            pdfText = parsed.text.trim();
                        }
                    }
                }
            } catch (docErr) {
                console.warn('Could not extract direct document text, using contextual knowledge:', docErr.message);
            }
        }

        // Prepare structured, highly relevant prompt instructions
        const systemContext = `You are a knowledgeable university AI study assistant for the FA24-BAI (Artificial Intelligence) program. Provide direct, academically rigorous, and relevant answers in clean markdown without meta-talk or filler.`;

        let promptInstruction = '';
        if (action === 'summarize') {
            promptInstruction = `Provide a comprehensive, well-structured study summary for "${cleanDocName}".
Include:
- Overview: Core purpose and high-level concepts.
- Key Principles & Formulas / Algorithms: Essential points in clear bullet points.
- Exam Focus: Critical takeaways and common student misunderstandings.`;
        } else if (action === 'quiz') {
            promptInstruction = `Create 5 high-yield multiple-choice questions (MCQs) testing understanding of "${cleanDocName}".
Format each question with options (A, B, C, D).
At the end, provide an "Answers & Explanations" section with the correct choices and concise rationales.`;
        } else if (action === 'viva') {
            promptInstruction = `Generate 5 realistic viva / oral exam questions on "${cleanDocName}".
Provide each question followed by a model answer highlighting the exact technical keywords an examiner looks for.`;
        } else {
            promptInstruction = `The student asked: "${prompt}".
Provide a clear, detailed, and directly relevant academic response.`;
        }

        const docContentSnippet = pdfText ? pdfText.substring(0, 40000) : '';
        const finalPrompt = `${systemContext}

Document: ${cleanDocName}${folderContext ? ` (Category: ${folderContext})` : ''}
${docContentSnippet ? `\n--- DOCUMENT CONTENT ---\n${docContentSnippet}\n--- END DOCUMENT CONTENT ---\n` : ''}
${promptInstruction}`;

        // Initialize Gemini model
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        const replyText = response.text();

        return res.status(200).json({ reply: replyText });
    } catch (error) {
        console.error('AI Handler Error:', error);
        return res.status(500).json({ reply: 'AI generation encountered an issue. Please try again in a moment.' });
    }
}
