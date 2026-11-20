# UniShare — Quick Start & Demonstration Guide

Welcome to **UniShare**, an open-source university academic resource sharing platform with curriculum mapping and moderated document submissions.

This guide provides instructions to clone, set up, and demonstrate UniShare locally on any computer (Linux, macOS, or Windows) without requiring cloud accounts or external database connections.

---

## 1. Prerequisites

Ensure your system has the following runtimes installed:

| Tool | Recommended Version | Minimum Version | Verify Command |
|---|---|---|---|
| **Git** | 2.30+ | 2.20+ | `git --version` |
| **Python** | 3.11 or 3.12 | 3.10+ | `python3 --version` or `python --version` |
| **Node.js** | 20 LTS or 22 LTS | 18+ | `node -v` |
| **npm** | 10+ | 9+ | `npm -v` |

---

## 2. One-Click Launch (Recommended)

### On Linux or macOS:
```bash
git clone <repository-url>
cd UniShare
chmod +x start_linux.sh
./start_linux.sh
```

### On Windows:
1. Clone the repository:
   ```cmd
   git clone <repository-url>
   cd UniShare
   ```
2. Double-click `start_windows.bat` (or run `start_windows.bat` in Command Prompt).

*The launch script automatically creates a local Python virtual environment, installs dependencies, initializes the local demo SQLite database with 78 courses and 12 sample PDFs, starts FastAPI and Vite, and opens your browser.*

---

## 3. Manual Setup & Startup (Step-by-Step)

If you prefer to set up and run the services manually:

### Step 1: Clone Repository & Create Local Configuration
```bash
git clone <repository-url>
cd UniShare

# Copy the example environment template (defaults to local SQLite & local storage)
cp .env.example .env
```
*(On Windows Command Prompt: `copy .env.example .env`)*

### Step 2: Backend Setup & Demo Seeding
```bash
# 1. Create and activate virtual environment
# Linux / macOS:
python3 -m venv backend/.venv
source backend/.venv/bin/activate

# Windows:
python -m venv backend\venv
call backend\venv\Scripts\activate.bat

# 2. Install backend dependencies
pip install -r backend/requirements.txt

# 3. Initialize SQLite database & generate 12 demo academic PDFs
python backend/scripts/seed.py
```
*Expected output: `✅ Seeding complete! Courses: 78, Categories: 5, Resources: 12`*

### Step 3: Frontend Setup
```bash
cd frontend
npm install
cd ..
```

### Step 4: Run Services
Open two terminal windows:

**Terminal 1 — FastAPI Backend (Port 8000):**
```bash
# With virtual environment activated:
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
*Interactive Swagger docs available at: `http://127.0.0.1:8000/docs`*

**Terminal 2 — React Frontend (Port 5173):**
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

**Open your browser:**
Navigate to **`http://localhost:5173`**

---

## 4. Key Demo Scenarios to Present

### A. Academic Curriculum Catalog (Homepage)
- Navigate to `http://localhost:5173/`.
- Observe the full CSE curriculum: exactly **78 official courses** totaling **161.0 credits** distributed across 8 semesters.
- Test quick-filter shortcuts (e.g., Year 1 to Year 4).

### B. Resource Library Search & Filters
- Navigate to `http://localhost:5173/resources`.
- Search for topics (e.g., `"relational"`, `"scheduling"`, `"socket"`).
- Filter by Category (Lecture Notes, Lab Manuals, Past Questions, Syllabus, Reference Materials).
- Filter by Semester (1 through 8).

### C. In-Browser PDF Viewer & Direct Download
- Open any resource card (e.g., *Introduction to Relational Databases*).
- Click **"Preview"** to open the embedded PDF reader with page controls and zooming.
- Click **"Download"** to test local document streaming.

### D. Moderated Student Note Submission
- Navigate to `http://localhost:5173/contribute`.
- Fill in the form and upload any valid PDF document.
- Agree to the academic integrity acknowledgment and submit.
- The note is securely staged in `backend/storage/submissions/` pending review.

### E. Maintainer Review CLI
In your terminal, inspect and approve pending submissions:
```bash
# List all pending submissions
python backend/scripts/review_submissions.py list

# Inspect a submission
python backend/scripts/review_submissions.py show 1

# Approve submission (promotes file to published resources)
python backend/scripts/review_submissions.py approve 1
```

---

## 5. Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| `Port 8000 already in use` | Another server is using port 8000 | Kill the process occupying port 8000 or specify another port (`--port 8001`). |
| `Port 5173 already in use` | Another Vite dev server is running | Vite will automatically suggest port 5174. Check terminal output for the active URL. |
| `ModuleNotFoundError` in backend | Active virtualenv missing packages | Ensure `backend/.venv` (or `backend\venv`) is active and run `pip install -r backend/requirements.txt`. |
| Missing resources on fresh clone | Database not yet initialized | Run `python backend/scripts/seed.py` to generate the demo database and PDF files. |
| Windows PowerShell Script Execution Policy | Scripts restricted by default | Run `start_windows.bat` in standard Command Prompt (`cmd.exe`) rather than PowerShell. |
