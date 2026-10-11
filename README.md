# FA24-BAI 5th Semester Study Hub

A modern web portal for the FA24-BAI cohort to discover, search, and study 5th-semester academic resources, featuring an integrated Google Gemini AI study companion for instant summaries, practice quizzes, and viva preparation.

Live Portal: [fa24-bai.vercel.app](https://fa24-bai.vercel.app)

---

## Features

- **Dedicated Landing Page:** Welcoming home portal featuring an integrated search bar, semester cohort stats, feature overviews, and direct course preview cards.
- **Dedicated Search Experience:** Distraction-free search view with real-time keyword matching across filenames, courses, and resource categories, accompanied by interactive filter chips.
- **Course Explorer:** Structured folder hierarchy for every course, separating CDFs, Lab Manuals, Syllabi, Lectures, and Assignments, complete with breadcrumb navigation.
- **AI Study Companion:** Powered by Google Gemini. Summarize documents, generate 5-question review quizzes, compile common viva questions, or ask custom questions directly against document contents.
- **Resource Options Menu:** Roger three-dots menu on every study material providing options to open documents, invoke AI analysis, copy shareable direct links, or delete files (authorized admin).
- **Multi-Format Document Support:** Inline viewing for PDFs, and Microsoft Office Online integration for PowerPoint (`.pptx`, `.ppt`) and Word (`.docx`, `.doc`) documents.
- **Notice Board:** Cohort announcement board for academic alerts and deadline reminders.
- **Admin Management:** Password-protected modal for uploading new resources and removing outdated files directly committed to GitHub via the REST API.
- **Responsive Layout & Typography:** Clean Helvetica typography with calibrated display zoom (85% on PC, 75% on mobile devices) and auto-zoom prevention on mobile inputs.

---

## Courses Covered

| Course Name | Course Code |
|---|---|
| Programming for Artificial Intelligence | AIC270 |
| Knowledge Representation & Reasoning | AIC372 |
| Operating Systems | CSC322 |
| Probability & Statistics | MTH262 |
| Design and Analysis of Algorithms | DAA |
| Web Technologies | WEB |

---

## Architecture & Tech Stack

| Layer | Implementation |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+), Bootstrap Icons |
| Typography | Helvetica ('Helvetica Neue', Helvetica, Arial, sans-serif) |
| Backend | Vercel Serverless Functions (`/api`) |
| AI Integration | Google Gemini API (multimodal document analysis) |
| Document Storage | GitHub Repository, accessed via GitHub Contents and Tree APIs |
| Hosting | Vercel |

### API Endpoints

| Endpoint | Method | Payload / Query | Description |
|---|---|---|---|
| `/api/files` | GET | None | Fetches all repository resource file paths |
| `/api/ask` | POST | `filename`, `action` (`summarize`, `quiz`, `viva`), `prompt`, `password` (for admin verification) | Generates AI analysis or validates admin key |
| `/api/upload` | POST | `filename`, `contentBase64`, `password`, `folder` | Commits a new resource to the repository |
| `/api/delete` | POST | `filename`, `password` | Deletes a resource from the repository |

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
| `GEMINI_API_KEY` | Yes | API key from Google AI Studio for AI study features |
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token with repository read/write permissions |
| `ADMIN_PASSWORD` | Yes | Master authorization key for admin upload and delete operations |

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
- **Courses:** `PfAI`, `AIC270`, `KRR`, `AIC372`, `OS`, `CSC322`, `STAT`, `MTH262`, `DAA`, `WEB`
- **Resource Types:** `CDF`, `Lab Manual`, `Syllabus`, `Lectures`, `Assignments`

---

## Author & Maintainer

Maintained by [Abdul Wahid](https://github.com/abduIwahid).
Copyright (c) 2026 FA24-BAI. All rights reserved.
