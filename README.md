# FA24-BAI 5th Semester Study Hub

A modern web portal for the FA24-BAI cohort (BS Artificial Intelligence, 5th semester) to discover, search, and study semester resources — with an integrated Google Gemini AI study companion for instant summaries, practice quizzes, and viva preparation.

**Live Portal:** [fa24-bai.vercel.app](https://fa24-bai.vercel.app)

---

## Features

- **Landing Page:** Welcoming home portal with an integrated search bar, cohort stats, feature overviews, and direct course preview cards.
- **Global Search:** Fast search across every material by title and full path, with ranked results, filter chips, and a `/` keyboard shortcut.
- **Course Explorer:** Structured folder hierarchy for every course — CDFs, Lab Manuals, Syllabi, Lectures, Assignments, and Notes — with breadcrumb navigation and folder shortcuts on every course card.
- **AI Study Companion:** Powered by Google Gemini. Summarize documents, generate 5-question review quizzes, compile common viva questions, or ask custom questions about a document.
- **Dark Mode:** A full dark theme in the same cream/deep-green identity, toggle in the header, saved per device.
- **Recently Viewed:** Your last-opened materials stay one tap away, even after a refresh.
- **Resource Options Menu:** A three-dots menu on every material to open it, run AI analysis, copy a shareable direct link, or delete it (admin only).
- **Multi-Format Support:** Inline viewing for PDFs, and Microsoft Office Online integration for PowerPoint (`.pptx`, `.ppt`) and Word (`.docx`, `.doc`) documents.
- **Notice Board:** Cohort announcement board for academic alerts and deadline reminders.
- **Request a Material:** Anything missing? Request it through the [request form](https://docs.google.com/forms/d/e/1FAIpQLSe8ZaXjapeO1vaGv1k4KDVo2ziVLxygVu6pjrCC5igZB2ExGA/viewform) and the Admin will upload it.
- **Admin Management:** Password-protected uploads and deletions, verified server-side only (fail-closed), committed straight to GitHub via the REST API.
- **Fast by Default:** Semester files and assets are served with long-term immutable caching, and links shared on WhatsApp/social show a proper title, description, and preview image.
- **Custom 404 Page:** A themed not-found page (with a familiar animated face) that guides lost visitors back home.

---

## Courses Covered

| Course Name | Course Code |
|---|---|
| Programming for Artificial Intelligence | AIC270 |
| Knowledge Representation & Reasoning | AIC372 |
| Operating Systems | CSC322 |
| Probability & Statistics | MTH262 |
| Design and Analysis of Algorithms | CSC301 |
| Web Technologies | CSC336 |

---

## Architecture & Tech Stack

| Layer | Implementation |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+), Bootstrap Icons — no build step |
| Typography | Helvetica ('Helvetica Neue', Helvetica, Arial, sans-serif) |
| Backend | Vercel Serverless Functions (`/api`) |
| AI Integration | Google Gemini API (document analysis) |
| Document Storage | This GitHub repository, accessed via the GitHub Contents and Tree APIs |
| Hosting | Vercel |

### API Endpoints

| Endpoint | Method | Payload / Query | Description |
|---|---|---|---|
| `/api/files` | GET | None | Lists all repository resource file paths |
| `/api/ask` | POST | `filename`, `action` (`summarize`, `quiz`, `viva`), `prompt`, `password` (admin verification) | Generates AI analysis, or validates the admin key server-side |
| `/api/upload` | POST | `filename`, `contentBase64`, `password`, `folder` | Commits a new resource to the repository (supports overwriting) |
| `/api/delete` | POST | `filename`, `password` | Deletes a resource from the repository |
| `/api/notices` | GET / POST | `password` (POST only) | Reads the notice board, or posts a new announcement (admin only) |

All admin endpoints fail closed: if `ADMIN_PASSWORD` is not configured on the server, they refuse every request.

---

## Setup & Deployment

### 1. Fork or Clone

```bash
git clone https://github.com/abduIwahid/fa24-bai.git
cd fa24-bai
```

### 2. Configure Environment Variables

When deploying to [Vercel](https://vercel.com), configure the following environment variables:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | API key from Google AI Studio for the AI study features |
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token with repository read/write permissions |
| `ADMIN_PASSWORD` | Yes | Master authorization key for admin upload/delete operations — keep it secret and rotate it if it is ever exposed |

### 3. Local Development

```bash
npm install
npm i -g vercel
vercel dev
```

---

## Resource Organization Guidelines

Resources uploaded via the Admin Portal or Pull Request follow this directory structure:

```
5th Semester/<COURSE_NAME>/<RESOURCE_TYPE>/<FILENAME>
```

Examples:
- `5th Semester/OS/Lab Manual/CSC322_OS_Lab Manual_V3.1.pdf`
- `5th Semester/PfAI/Lectures/PfAI_Lecture_01.pptx`

Course mapping and resource types are recognized automatically based on path keywords:
- **Courses:** `PfAI`, `AIC270`, `KRR`, `AIC372`, `OS`, `CSC322`, `STAT`, `MTH262`, `DAA`, `CSC301`, `WEB`, `CSC336`
- **Resource Types:** `CDF`, `Lab Manual`, `Syllabus`, `Lectures`, `Assignments`, `Notes`

---

## Maintainer

Maintained by the FA24-BAI Study Hub Admin.
Copyright (c) 2026 FA24-BAI. All rights reserved.
