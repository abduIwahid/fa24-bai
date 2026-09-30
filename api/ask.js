import pdf from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { filename, prompt, action } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return res.status(500).json({ reply: 'Server Error: GEMINI_API_KEY is not configured in Vercel.' });
    }

    try {
        // 1. Fetch the PDF from GitHub
        const owner = 'abduIwahid';
        const repo = 'fa24-bai';
        const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodeURIComponent(filename)}`;
        
        let pdfText = "";
        try {
            const pdfResponse = await fetch(url);
            if (!pdfResponse.ok) throw new Error("Failed to fetch PDF");
            const arrayBuffer = await pdfResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const data = await pdf(buffer);
            pdfText = data.text;
        } catch(e) {
            console.error("PDF Parse error:", e);
            return res.status(500).json({ reply: 'Failed to read the PDF document.' });
        }

        const truncatedText = pdfText.substring(0, 50000); 

        // 2. Prepare the AI Prompt
        let finalPrompt = "";
        if (action === 'summarize') {
            finalPrompt = `Summarize the following document content in a detailed, structured way. Focus on key concepts and takeaways.\n\nDocument text:\n${truncatedText}`;
        } else if (action === 'quiz') {
            finalPrompt = `Create a 5-question multiple choice practice quiz based on the following document text. Provide the answers at the very end.\n\nDocument text:\n${truncatedText}`;
        } else if (action === 'viva') {
            finalPrompt = `Generate 5 common viva (oral exam) questions based on this document, along with a short hint for the correct answer.\n\nDocument text:\n${truncatedText}`;
        } else {
            finalPrompt = `Based on the following document text, answer this question: "${prompt}"\n\nDocument text:\n${truncatedText}`;
        }

        // 3. Call Gemini API
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        
        return res.status(200).json({ reply: response.text() });
    } catch (error) {
        console.error("AI Error:", error);
        return res.status(500).json({ reply: 'AI generation failed. Please try again later.' });
    }
}
