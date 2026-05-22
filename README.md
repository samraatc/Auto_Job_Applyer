# Auto Job Applier

Auto Job Applier is a LinkedIn job-search and application assistant with a powerful Python automation bot, a scalable FastAPI backend, and a modern React admin dashboard built for production SaaS environments.

The backend controls the bot, stores configuration, manages resumes, streams live logs, and exposes dashboard APIs. The frontend is a Vite/React dashboard for editing search rules, uploading resumes, viewing applied jobs, and monitoring the bot in real-time.

---

## 🏗 Architecture

The project has been refactored into a scalable production SaaS structure with clear separation of concerns.

### Project Structure

```text
.
├── runAiBot.py              # Main LinkedIn automation bot
├── server/                  # FastAPI backend (layered architecture)
│   ├── api/routes/          # API route definitions
│   ├── auth/                # Authentication logic
│   ├── bot/                 # Bot controller and process management
│   ├── config/              # Configuration management
│   ├── database/            # MongoDB client and migrations
│   ├── middleware/          # CORS and request middleware
│   ├── models/              # Data models and schemas
│   ├── repositories/        # Database access layer
│   ├── resumes/             # Resume file registry
│   ├── services/            # Business logic layer
│   └── utils/               # Shared utilities
├── frontend/                # React + Vite dashboard
│   ├── src/api/             # API client
│   ├── src/components/      # React components (auth, dashboard, jobs, etc.)
│   ├── src/context/         # React Context (Auth)
│   └── src/styles/          # CSS and styling
├── config/                  # Legacy bot settings
├── modules/                 # Bot core logic (scraping, AI, resume tools)
└── docs/                    # Architecture and planning documentation
```

---

## 📋 Requirements

- **Python**: 3.10+
- **Node.js**: 18+
- **Browser**: Google Chrome installed (with ChromeDriver-compatible Selenium setup)
- **Database**: MongoDB Atlas or local MongoDB instance (Recommended for SaaS operation, falls back to local files if not set)

---

## 🚀 Setup & Installation

### 1. Configure Environment

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set the required variables:

```env
ADMIN_USER=admin
ADMIN_PASS=change-this-password

LINKEDIN_USER=your-linkedin-email
LINKEDIN_PASS=your-linkedin-password

USE_AI=true
AI_PROVIDER=openai
LLM_API_KEY=your-api-key
LLM_MODEL=gpt-4o-mini
```

**Optional MongoDB (Highly Recommended):**

```env
MONGODB_URI=mongodb+srv://USER:PASS@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=auto_job_applier
```

### 2. Install Python Dependencies

From the project root, create a virtual environment and install backend/bot dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements-bot.txt -r requirements-ui.txt
```

*(Note: If PowerShell blocks virtualenv activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*

### 3. Install Frontend Dependencies

```powershell
cd frontend
npm install
cd ..
```

---

## 🏃‍♂️ Running the Application

### Development Mode

**Backend:**
Start the FastAPI server from the project root:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn server.main:app --reload --host 127.0.0.1 --port 8000
```
*Backend URL: `http://127.0.0.1:8000`*

**Frontend:**
Open another terminal:

```powershell
cd frontend
npm run dev
```
*Frontend URL: `http://127.0.0.1:5173` (Proxies `/api` requests to backend)*

### Production Mode

**1. Build the Frontend:**

```powershell
cd frontend
npm run build
cd ..
```

**2. Start the Backend Server:**

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn server.main:app --host 0.0.0.0 --port 8000
```

When `frontend/dist` exists, `server/main.py` serves the built frontend directly from the FastAPI app.
*Production URL: `http://127.0.0.1:8000`*

---

## 🤖 Onboarding Flow & Dashboard Usage

### 🚀 First-Time Onboarding
When you launch the web dashboard for the first time, you will be guided through a secure 5-step **Onboarding Wizard** to configure your automation environment:
1. **Connect LinkedIn**: Securely specify your LinkedIn login email and password (used by Selenium to log in and apply).
2. **Upload Resume**: Upload your primary resume (PDF or DOCX). You can manage multiple resumes later in the dashboard.
3. **Search Rules**: Define keywords (e.g. "Frontend Developer") and locations (e.g. "Remote") to target your search.
4. **Configure AI**: Configure OpenAI, Gemini, or Anthropic with your API key to enable smart questionnaire handling.
5. **Start Automation**: Complete the wizard to enter the main dashboard workspace.

### 📊 Dashboard & Monitoring
Once onboarding is completed, you can manage everything via the main dashboard:
* **Overview**: Monitor the bot's current status (Idle / Running / Errored), start or stop the bot with one click, view global statistics, and see smart setup warnings.
* **Search Rules**: Configure search terms, locations, experience level, and apply mode using modern chip selectors and status toggles.
* **Resumes**: Drag-and-drop new resumes, delete old ones, and select the default resume for active applications.
* **Companies & Hiring Posts**: View discovered companies and real-time scanned job posts.
* **Application Logs & History**: Track Selenium runs in real-time, filter application results by status, and clear history with double-confirmation popups.

Alternatively, run the bot directly from the CLI:
```powershell
.\.venv\Scripts\Activate.ps1
python runAiBot.py
```

---

## 🛠 Troubleshooting

- **Login uses old password:** The first admin password is persisted in `server/auth_state.json`. Change it from the dashboard settings page, or delete the file during local development to reseed from `.env`.
- **MongoDB not connected:** If `MONGODB_URI` is empty or unreachable, the app automatically falls back to local file storage. Check status at `http://127.0.0.1:8000/api/mongo/health`.
- **Chrome/Selenium errors:** Ensure Chrome is up to date. If profile issues occur, set `safe_mode = True` inside `config/settings.py`.
- **Resume missing:** Ensure you upload and set a default resume from the dashboard `Resumes` tab. The app will sync the path to the bot configuration.