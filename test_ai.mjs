import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
    try {
        console.log("Checking SDK...");
        const genAI = new GoogleGenerativeAI("DUMMY_KEY");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("SDK works!");
    } catch(e) {
        console.error("SDK Error:", e);
    }
}
run();
