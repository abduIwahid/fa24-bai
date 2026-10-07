# FA24-BAI 5th Semester Study Hub 🎓

A serverless web app for the FA24-BAI cohort to host, browse, and search 5th-semester study resources, with a built-in Gemini AI assistant that summarizes PDFs, generates practice quizzes, and prepares viva questions.

🔗 **Live:** [fa24-bai.vercel.app](https://fa24-bai.vercel.app)

## 🚀 Features

- **🧠 AI Study Assistant (PDFs):** Summarize a document, generate a 5-question MCQ quiz, get 5 viva questions with hints, or ask free-form questions about the file. Uses the first ~50,000 characters of extracted text.
- **📚 Course-wise organization:** Resources are grouped automatically by course, then by type (CDF, Lab Manual, Syllabus, Lectures, Assignments).
- **🔍 Search & filters:** Search by course or document name and filter by resource type.
- **📄 Multi-format viewing:** PDFs open directly. PPT/PPTX/DOC/DOCX open in the Microsoft Office Online viewer.
- **🕘 Recent files:** The last 3 documents you opened (current session only).
- **📢 Notices board:** Announcements posted by the admin. *Stored in the browser's `localStorage`, so notices are per-device and not synced.*
- **🔒 Admin controls:** Password-protected upload and delete. Files are committed straight to this repo through the GitHub API.
- **📱 Installable (PWA manifest):** Add to your home screen. An internet connection is still required (no service worker / offline mode).

### Courses covered

| Course | Code |
|---|---|
| Programming for Artificial Intelligence | AIC270 |
| Knowledge Representation & Reasoning | AIC372 |
| Operating Systems | CSC322 |
| Design & Analysis of Algorithms | CSC301 |
| Web Technologies | CSC336 |
| Probability & Statistics | MTH262 |

## 🏗️ Architecture

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JS, Bootstrap Icons, Inter font |
| Backend | Vercel Serverless Functions (Node.js) in `/api` |
| AI | `@google/generative-ai` (Gemini) + `pdf-parse` for text extraction |
| Storage | This GitHub repository, accessed via the GitHub REST API |
| Hosting | Vercel |

**How it works**

1. `GET /api/files` reads the repo tree and returns all `.pdf/.ppt/.pptx/.doc/.docx` paths.
2. The frontend derives course and resource type from each file's path.
3. For AI actions, `/api/ask` downloads the PDF from GitHub, extracts text, and sends it to Gemini with an action-specific prompt.
4. Upload/delete call the GitHub Contents API, so every change is a commit.

### API endpoints

| Endpoint | Method | Body | Purpose |
|---|---|---|---|
| `/api/files` | GET | none | List all resource files |
| `/api/ask` | POST | `filename`, `action` (`summarize` \| `quiz` \| `viva`), or `prompt` for free-form Q&A | AI response for a PDF |
| `/api/upload` | POST | `filename`, `contentBase64`, `password`, `folder` (optional) | Commit a new file |
| `/api/delete` | POST | `filename`, `password` | Delete a file |

## 🛠️ Setup & Deployment

1. **Fork** this repository.
2. **Point the code at your fork.** The repo owner/name are hardcoded:
   - `owner` and `repo` constants in `api/ask.js`, `api/files.js`, `api/upload.js`, `api/delete.js`
   - the `raw.githubusercontent.com/abduIwahid/fa24-bai` URL in `js/script.js`
3. **Import the fork into [Vercel](https://vercel.com)** and add these environment variables:

   | Variable | Required | Notes |
   |---|---|---|
   | `ADMIN_PASSWORD` | **Yes** | Protects upload/delete. If unset, those endpoints are **not** protected. |
   | `GEMINI_API_KEY` | Yes (for AI) | From [Google AI Studio](https://aistudio.google.com). |
   | `GITHUB_TOKEN` | Yes (for upload/delete), recommended otherwise | Fine-grained PAT with **Contents: Read and write** on the repo. Also raises the API rate limit for listing files. |

4. **Deploy.**

### Run locally

```bash
npm install
npm i -g vercel
vercel dev          # serves the frontend and /api functions
node test_ai.mjs    # optional: checks the Gemini SDK loads
```

## 📂 Adding Resources

Use the **Admin Login → Upload** panel (set the optional *Folder* field), or open a Pull Request.

Recommended layout:

```
5th Semester/<COURSE>/<Type>/<file>
e.g. 5th Semester/OS/Lab Manual/CSC322_OS_Lab Manual_V3.1.pdf
```

Course and type are detected from keywords in the path, so keep them in the path or filename:

- **Course:** `PfAI`, `KRR`, `OS`, `Statistics`, `DAA`, `WEB` (or the course code)
- **Type:** `CDF`, `Lab Manual`, `Syllabus`, `Lectures`, `Assignments`

## 📁 Project Structure

```
├── 5th Semester/        # Study material, one folder per course
│   ├── DAA/  KRR/  OS/  PfAI/  Statistics/  WEB/
│   └── <course>/{CDF, Lab Manual, Syllabus, Lectures, Assignments}
├── api/                 # Vercel serverless functions
│   ├── ask.js           # PDF -> text -> Gemini (summarize / quiz / viva / Q&A)
│   ├── delete.js        # Delete a file via GitHub API (admin)
│   ├── files.js         # List resource files from the repo tree
│   └── upload.js        # Commit a new file via GitHub API (admin)
├── css/style.css        # UI styling
├── js/script.js         # Frontend: routing, search, filters, AI chat, admin, notices
├── index.html           # App shell
├── manifest.json        # PWA manifest
├── package.json         # Dependencies (@google/generative-ai, pdf-parse)
└── test_ai.mjs          # Gemini SDK smoke test
```

## ⚠️ Known Limitations

- AI features work on **PDFs only**, and only on PDFs with selectable text (scanned PDFs return no content).
- Only the first ~50,000 characters of a document are sent to the model.
- Notices and recent files are client-side only.
- Office files need the repo to be **public** for the Office Online viewer to load them.
- Unauthenticated GitHub API calls are rate-limited; set `GITHUB_TOKEN`.

## 🤝 Contributing

FA24-BAI students can contribute missing course resources: ask the repository owner for the upload password, or submit a Pull Request with your files.
