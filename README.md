# FA24-BAI 5th Semester Study Hub 🎓

A modern, serverless web application designed to host and organize study resources (PDFs, CDFs, Lab Manuals, Syllabuses) for the 5th Semester FA24-BAI cohort.

## 🚀 Features

- **📚 Course-Wise Organization:** Resources are automatically categorized by course (Artificial Intelligence, OS, Statistics, KR&R).
- **🔍 Instant Search & Filters:** Quickly find the exact document you need using the search bar and resource-type filters (CDF, Lab Manual, Syllabus).
- **🕒 Session-Based Quick Access:** Keep track of the documents you're actively studying during your session.
- **🔒 Secure Admin Upload:** Upload new PDFs directly to the platform (Admin password protected).
- **📱 PWA Support:** Install the app directly to your phone's home screen for native-like access!

## 🏗️ Architecture

This project is built to be fast, free, and incredibly lightweight by utilizing serverless edge technologies:
- **Frontend:** Vanilla HTML/CSS/JS (Lightweight and blazing fast).
- **Backend / API:** [Vercel Serverless Functions](https://vercel.com/docs/functions) (Node.js).
- **Storage / Database:** [GitHub API](https://docs.github.com/en/rest) (The repository itself acts as the storage system for PDFs).
- **Hosting:** Vercel.

## 🛠️ Setup & Deployment

To deploy your own instance of this Study Hub:

1. **Fork this repository** to your own GitHub account.
2. Go to [Vercel](https://vercel.com) and create a new project, linking it to your forked repository.
3. In your Vercel Project Settings > Environment Variables, add the following required variables:
   - `ADMIN_PASSWORD` - Create a secure password. You'll need this to upload new PDFs via the website UI.
   - `GITHUB_TOKEN` *(Optional but recommended)* - A GitHub Personal Access Token to increase the API rate limit for fetching files.
4. **Deploy!**

## 📂 Project Structure

```text
├── api/             # Vercel Serverless Functions
│   ├── files.js     # Fetches PDF metadata from GitHub
│   └── upload.js    # Securely commits new PDFs to GitHub
├── css/
│   └── style.css    # Modern UI Styling (Glassmorphism, animations)
├── js/
│   └── script.js    # Frontend logic (Filtering, Uploading, State)
├── index.html       # The main application view
└── manifest.json    # PWA configuration
```

## 🤝 Contributing
If you're a student in the FA24-BAI cohort, you can contribute by uploading missing course resources! Just ask the repository owner for the upload password, or submit a Pull Request with your PDFs.
