# Auto Job Applier LinkedIn — Final Project Plan

A single source-of-truth spec for the project end state. Use this to rebuild
from scratch, audit the current implementation, or onboard a new contributor.

---

## 1. Vision

A locally-hosted admin console that drives a Selenium bot to find and apply
to relevant jobs on LinkedIn — from **two sources**:

1. **LinkedIn `/jobs`** — the canonical job board (existing flow).
2. **Company LinkedIn `/posts` feeds** — "we're hiring" announcements that
   never reach the job board.

The operator manages resumes, search rules, target companies, and apply
policy through a web UI behind admin login. The bot stays runnable
standalone (`python runAiBot.py`) so the dashboard is additive, not
load-bearing.

## 2. Primary use cases

| # | Actor | Story |
|---|---|---|
| U1 | Admin | Log in, change password, sign out. |
| U2 | Admin | Upload multiple PDF resumes; tag them; set one as default. |
| U3 | Admin | Bind a resume to a specific search term (per-term override). |
| U4 | Admin | Edit search rules (terms, location, job type, experience, on-site, date posted, apply mode) without touching Python files. |
| U5 | Admin | Maintain a list of target companies; auto-discover companies hiring for the configured roles. |
| U6 | Admin | Start the job-board bot, watch live logs, stop it. |
| U7 | Admin | Start a feed scan that finds hiring posts on company pages and lists them with confidence + permalink. |
| U8 | Admin | Browse the applied/failed log with filtering. |

## 3. Architecture

```
                   ┌──────────────────────────────────────┐
                   │           React 19 + Vite SPA        │
                   │  (Login, Dashboard, SearchRules,     │
                   │   Resumes, Companies, HiringPosts,   │
                   │   ApplyLog, RawConfig, Logs,         │
                   │   Settings)                          │
                   └──────────────┬───────────────────────┘
                                  │  fetch(/api/*, cookie)
                   ┌──────────────▼───────────────────────┐
                   │              FastAPI                  │
                   │  auth (bcrypt + JWT cookie)           │
                   │  config_manager (regex Python writer) │
                   │  resume_registry (registry.json)      │
                   │  bot_controller (subprocess slots)    │
                   └────┬───────────┬──────────┬───────────┘
                        │           │          │
                spawn   │   spawn   │  spawn   │
                        ▼           ▼          ▼
                ┌─────────────┐ ┌────────┐ ┌──────────────┐
                │ runAiBot.py │ │ feed_  │ │ company_     │
                │ (Selenium)  │ │scraper │ │ discovery    │
                └─────┬───────┘ └────┬───┘ └──────┬───────┘
                      │              │             │
                      ▼              ▼             ▼
              applied/failed   feed_jobs.csv  config/companies.py
                  CSVs                          (merged)
                                  │
                                  └── classified by modules/ai/* (LLM)
                                      with regex fallback
```

## 4. Tech stack (locked)

| Layer | Choice | Reason |
|---|---|---|
| Bot | Python 3.14, Selenium (undetected-chromedriver) | Existing, working. |
| LLM | OpenAI / DeepSeek / Gemini via `modules/ai/` | Already pluggable. |
| Backend | FastAPI + Uvicorn | Async, types, SSE for logs. |
| Auth | bcrypt + python-jose JWT in httpOnly cookie | Single admin, dead simple. |
| Frontend | React 19, Vite, plain CSS | Already in the repo. |
| Storage | Python config files + JSON registry + CSV outputs | No DB; matches existing patterns. |
| Process mgmt | `subprocess.Popen` per slot (bot/feed/discover) | Each long-running job is independent. |
| Logs | SSE (`text/event-stream`) per slot | Already implemented. |

**Not in scope:** SQLite/Postgres, Docker, multi-user, RBAC, hosted deployment, browser extension. These can be added later but are not required for the spec to be "done".

## 5. Data model

### 5a. Python config files (regex-edited by `server/config_manager.py`)

| File | Purpose | Edited via |
|---|---|---|
| `config/secrets.py` | LinkedIn creds, LLM keys — read from env via `_env()` helper; literals are fallback only | env vars (not the UI) |
| `config/personals.py` | Name, address, EEO fields | Raw Config tab |
| `config/questions.py` | Application form answers; `default_resume_path` is **auto-rewritten** by the resume registry | Raw Config tab + Resumes tab |
| `config/search.py` | Search rules, `apply_mode`, `per_term_resume` | Search Rules tab |
| `config/companies.py` | `target_companies = [{name, linkedin_url, tags}]` | Companies tab |
| `config/settings.py` | Bot behavior knobs | Raw Config tab |

### 5b. Resume registry

- `all resumes/registry.json` = `{ resumes: [{id, label, path, tags, uploaded_at}], default_id }`
- Physical PDFs live at `all resumes/<id>/resume.pdf`.
- Setting `default_id` rewrites `config/questions.py:default_resume_path`.

### 5c. Auth state

- `server/auth_state.json` = `{ username, password_hash (bcrypt), jwt_secret }`
- Seeded once from `ADMIN_USER` / `ADMIN_PASS` env vars on first boot.

### 5d. CSV outputs (in `all excels/`)

| File | Writer | Columns |
|---|---|---|
| `all_applied_applications_history.csv` | `runAiBot.py` | `Job ID, Title, Company, HR Name, HR Link, Job Link, External Job link, Date Applied` |
| `all_failed_applications_history.csv` | `runAiBot.py` | same |
| `feed_jobs.csv` | `modules/feed_scraper.py` | `Source, Company, Posted At, Title, Location, Apply URL, Post URL, Confidence, Classified At, Matched Role, Post Excerpt` |

## 6. Feature inventory

Status legend: ✅ done, 🟡 partial / needs polish, ⬜ planned.

| Area | Feature | Status |
|---|---|---|
| Auth | bcrypt login, JWT cookie, require_admin dependency | ✅ |
| Auth | First-run seed from env, default `admin`/`admin` warning | ✅ |
| Auth | Change-password UI + endpoint | ✅ |
| Auth | HTTPS-aware cookie (`AJA_HTTPS` env) | ✅ |
| Auth | Multi-user / RBAC | ⬜ |
| Resumes | Upload PDF (≤5 MB), label, tags, set default, delete | ✅ |
| Resumes | Auto-sync `default_resume_path` in `questions.py` | ✅ |
| Resumes | Per-search-term override | ✅ |
| Resumes | AI-tailored per-job resume generation | ⬜ |
| Search | Typed editor: terms, location, job type, experience, on-site, date posted, easy-apply | ✅ |
| Search | `apply_mode` (easy / external / both) | ✅ |
| Search | Per-term resume binding | ✅ |
| Search | Salary, companies, industry, blacklist fields (currently raw-only) | 🟡 |
| Companies | CRUD list | ✅ |
| Companies | Auto-discovery from `/jobs` results | ✅ |
| Companies | Per-company tags + filter by tag | 🟡 |
| Feed scan | Scrolls company `/posts` page | ✅ |
| Feed scan | LLM classify (OpenAI/DeepSeek/Gemini) + regex fallback | ✅ |
| Feed scan | `Posted At` extraction | ✅ |
| Feed scan | Dry-run (no CSV write) | ✅ |
| Feed scan | Auto-apply to discovered post if it links to a known applier (Easy Apply / external) | ⬜ |
| Bot | Easy/external branch gated by `apply_mode` | ✅ |
| Bot | Per-term resume swap | ✅ |
| Logs | SSE stream per slot (bot/feed/discover) | ✅ |
| Apply Log | Read both CSVs, filter by status + free text | ✅ |
| Settings | Change password | ✅ |
| Ops | `MIGRATION.md` with env vars and build steps | ✅ |
| Ops | `.env.example` | ⬜ |
| Ops | Docker / one-command launcher | ⬜ |

## 7. Backend API surface

All routes require the `aja_session` cookie except where noted.

```
POST   /api/auth/login              {username, password}        -> 200 + cookie
POST   /api/auth/logout                                          -> clears cookie
GET    /api/auth/me                                              -> {username}
POST   /api/auth/change-password    {current_password, new_password}

GET    /api/config                  legacy raw dump
POST   /api/config                  legacy raw write

GET    /api/search-rules            typed SearchRules
POST   /api/search-rules            typed SearchRules
    SearchRules = {
      search_terms, search_location, job_type[], experience_level[],
      on_site[], date_posted, easy_apply_only,
      apply_mode: "easy"|"external"|"both",
      per_term_resume: {term: resume_id}
    }

GET    /api/resumes                 {resumes, default_id}
POST   /api/resumes                 multipart: file, label, tags, make_default
PATCH  /api/resumes/{id}/default
DELETE /api/resumes/{id}

GET    /api/companies               {target_companies}
POST   /api/companies               {target_companies}
POST   /api/companies/discover      spawn modules.company_discovery
GET    /api/companies/discover/status
GET    /api/companies/discover/logs SSE

POST   /api/feed-scan/start?dry_run=bool
POST   /api/feed-scan/stop
GET    /api/feed-scan/status
GET    /api/feed-scan/logs          SSE
GET    /api/hiring-posts?role=&company=&limit=

GET    /api/applied-jobs?status=all|applied|failed

POST   /api/bot/start
POST   /api/bot/stop
GET    /api/bot/status              PUBLIC (login-screen badge)
GET    /api/bot/logs                SSE
```

## 8. Frontend tabs

Sidebar order:
`Dashboard | Search Rules | Resumes | Companies | Hiring Posts | Apply Log | Raw Config | Live Logs | Settings`
Sign out is pinned to the bottom of the sidebar.

## 9. Bot integration contract

The dashboard must never break standalone bot execution. Rules:

1. New variables in `config/*.py` always have safe defaults (`apply_mode = "both"`, `per_term_resume = {}`).
2. `runAiBot.py` reads them via `globals().get(...)` so missing vars don't crash.
3. The resume registry's `default_id` rewrites `config/questions.py:default_resume_path` — the bot keeps using the same import path it always did.
4. The dashboard spawns the bot via `python -u runAiBot.py`. No env-var coupling beyond what `secrets.py` already reads.
5. Feed scan and company discovery are separate subprocess slots; never share state with the main bot.

## 10. Build & run

```powershell
# Python deps
pip install -r requirements-ui.txt

# First-run admin + LinkedIn + LLM creds
$env:ADMIN_USER     = "you"
$env:ADMIN_PASS     = "a-strong-password"
$env:LINKEDIN_USER  = "you@example.com"
$env:LINKEDIN_PASS  = "your-linkedin-password"
$env:USE_AI         = "true"
$env:AI_PROVIDER    = "openai"
$env:LLM_API_KEY    = "sk-..."
$env:LLM_MODEL      = "gpt-4o-mini"

# Frontend build
cd frontend; npm install; npm run build; cd ..

# Run the server
python -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```

Open http://127.0.0.1:8000.

## 11. Phased delivery (for a from-scratch rebuild)

A new contributor could implement the whole project in four phases.
Each phase is independently shippable and leaves the bot runnable standalone.

### Phase 0 — Bootstrap (½ day)
- Clone the upstream Selenium bot. Verify `python runAiBot.py` works against your LinkedIn.
- Move secrets out of `config/secrets.py` literals into env-var reads.
- Create empty `frontend/` Vite + React scaffold; one Dashboard tab with Start/Stop.
- FastAPI server with `/api/bot/start|stop|status|logs` (no auth yet).

**Exit criteria:** start/stop bot from the browser, see live SSE logs.

### Phase 1 — Auth + typed search rules (1 day)
- `server/auth.py` (bcrypt + JWT cookie, `require_admin`, `auth_state.json`).
- `Login.jsx`, `Settings.jsx`, sign-out.
- Replace the raw config editor with a typed `SearchRules.jsx` form. Add `apply_mode` + bot branch.

**Exit criteria:** any mutating route requires login; the search form edits `config/search.py` and the bot respects `apply_mode`.

### Phase 2 — Multi-resume + per-term binding (1 day)
- `server/resume_registry.py` with `registry.json` and `/api/resumes/*`.
- `Resumes.jsx` upload + set-default + delete.
- Add `per_term_resume` to `config/search.py` and the SearchRules UI.
- Bot swaps `default_resume_path` per iteration.

**Exit criteria:** upload PDFs from the UI, set one as default, bind per term; bot uses the right resume.

### Phase 3 — Two-source job discovery (2 days)
- `config/companies.py` + `Companies.jsx` CRUD.
- `modules/company_discovery.py` + `/api/companies/discover` spawn.
- `modules/feed_scraper.py` writing `all excels/feed_jobs.csv` with the spec columns.
- `HiringPosts.jsx` + `/api/hiring-posts` filter.
- `ApplyLog.jsx` + `/api/applied-jobs`.
- `MIGRATION.md`, `.env.example`.

**Exit criteria:** click "Run discovery" → companies appear in the list → "Start scan" → hiring posts populate, filterable in the UI.

### Phase 4 (post-launch) — Stretch goals
- AI-tailored resumes per job description.
- Auto-apply directly from a discovered feed post when the apply URL is recognizable (LinkedIn `/jobs/view/...` or Greenhouse/Lever/Workday).
- Per-company tag → resume binding.
- Switch CSV outputs to SQLite for fast filters and dedupe.
- Docker compose for one-command launch.

## 12. Open decisions

These are the only ambiguous calls left in the spec — they don't block a rebuild but pick a side before each phase that touches them.

| # | Decision | Default in this plan |
|---|---|---|
| D1 | Storage: CSV vs SQLite? | CSV (matches existing bot output) |
| D2 | Auto-apply from feed posts when an apply URL is parseable? | No (Phase 4 stretch) |
| D3 | Multi-user / RBAC? | No (single admin) |
| D4 | Hosted deployment (Docker, HTTPS)? | No (localhost only; `AJA_HTTPS` env flips cookie attrs if you reverse-proxy later) |
| D5 | Per-company resume override (extending per-term binding)? | No (per-term only) |
| D6 | Headless mode for feed scan? | No (relies on user's logged-in Chrome profile) |

Override any of these by replying with the new choice; everything downstream
in the plan will need to be adjusted to match.

---

**Status:** as of today, Phases 0–3 are implemented in this repo. Phase 4 is
the stretch backlog. Use `MIGRATION.md` for build/run; use this document for
"what is the project and why".
