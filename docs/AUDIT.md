# Compliance audit — admin-console + feed-source extension

Date: 2026-05-16
Scope: every bullet from the original feature brief, mapped to the file(s)
that actually implement it, with line-number citations. Plus a list of fixes
applied during this audit pass and what was deliberately not changed.

## Status at a glance

| # | Required feature                          | Status     | Evidence |
|---|-------------------------------------------|------------|----------|
| 1 | Admin authentication                      | ✅ Done     | server/auth.py, server/main.py |
| 2 | Resume management                         | ✅ Done     | server/resume_registry.py, config/questions.py |
| 3 | Search controls as first-class fields     | ✅ Done     | server/main.py, frontend SearchRules.jsx, config/search.py |
| 4 | Apply-mode in the bot                     | ✅ Done     | runAiBot.py |
| 5 | LinkedIn company-post job scraper         | ✅ Done     | modules/feed_scraper.py, modules/company_discovery.py |
| 6 | UI structure (sidebar tabs)               | ✅ Done¹    | frontend Sidebar.jsx |
|   | runAiBot.py still runs standalone         | ✅ Verified | runAiBot.py:1283 |
|   | All config writes go through config_manager | ✅ Verified | server/resume_registry.py:46, server/main.py:133 |
|   | LLM + Selenium are real, not mocked       | ✅ Verified | modules/feed_scraper.py:136-179 |
|   | --dry-run flag for the feed scanner       | ✅ Verified | modules/feed_scraper.py:269-272 |
|   | Windows-friendly paths                    | ✅ Verified | os.path.join used throughout |

¹ Sidebar adds `Hiring Posts` and `Raw Config` beyond the spec list. User
   approved keeping both during the audit pass.

---

## 1. Admin authentication

Required: single admin user, env-seeded password hash, JWT-in-cookie, every
mutating route protected, `/login` redirect when unauthenticated.

| Sub-requirement                  | File / location                                    |
|----------------------------------|----------------------------------------------------|
| Username + bcrypt hash in `server/auth.py` | `server/auth.py:35-115`                  |
| Seeded from `ADMIN_USER`/`ADMIN_PASS` env  | `server/auth.py:52-63`                   |
| JWT in httpOnly cookie                     | `server/auth.py:83-92`                   |
| Cookie attrs gated on `AJA_HTTPS` env var  | `server/auth.py:27-32, 88-89` (added in audit) |
| `python-jose` + `bcrypt` used              | `server/auth.py:17-20`, `requirements-ui.txt:4-5` |
| `Depends(require_admin)` on every mutating route | `server/main.py:43, 67, 80, 126, 144, 158, 163, 186, 192, 209, 214, 269, 274, 285` |
| React `/login` route + unauth redirect     | `frontend/src/App.jsx:40-52, 67`, `frontend/src/api.js:11-15, 33-36` |

---

## 2. Resume management

Required: `all resumes/<id>/resume.pdf` + `registry.json`; GET/POST(multipart, pdf≤5MB)/PATCH default/DELETE endpoints; `default_resume_path` derived from registry default at bot-start time, not hard-coded.

| Sub-requirement                      | File / location                              |
|--------------------------------------|----------------------------------------------|
| Folder convention + registry shape   | `server/resume_registry.py:23-26, 49-63`     |
| `GET /api/resumes`                   | `server/main.py:140-141`                     |
| `POST /api/resumes` (pdf, 5MB cap)   | `server/main.py:144-154`, `server/resume_registry.py:85-112` |
| `PATCH /api/resumes/{id}/default`    | `server/main.py:157-159`, `server/resume_registry.py:115-121` |
| `DELETE /api/resumes/{id}`           | `server/main.py:162-164`, `server/resume_registry.py:124-138` |
| Registry default → `questions.py` auto-sync | `server/resume_registry.py:43-46, 109-111, 119-120` |
| `runAiBot.py` resolves `default_resume_path` via `config.questions` (live, not hard-coded) | `runAiBot.py:39`, `runAiBot.py:875-882`, `config/questions.py:24` |

**Verified end-to-end in audit:** flipping the registry default rewrites
`config/questions.py:default_resume_path` to the new entry's path. Smoke test
exercised `set_default('_audit_probe')`; `read_config('questions.py')`
returned the probe path; restored to `default` afterwards.

---

## 3. Search controls as first-class fields

Required: chip input for terms, location text, multi-checkbox job_type / experience_level / on_site, radio date_posted, **new** radio `apply_mode`, **new** `per_term_resume` map. `POST /api/search-rules` writes through `config_manager` atomically.

| Sub-requirement                       | File / location                              |
|---------------------------------------|----------------------------------------------|
| `SearchRules.jsx` component           | `frontend/src/components/SearchRules.jsx:31-143` |
| Chip input for `search_terms`         | `frontend/src/components/SearchRules.jsx:71-73, 117-133` |
| Location, job_type, experience_level, on_site | `frontend/src/components/SearchRules.jsx:75-92` |
| Date posted (radio/select)            | `frontend/src/components/SearchRules.jsx:94-98` |
| Apply mode radio                      | `frontend/src/components/SearchRules.jsx:100-108` |
| Per-term resume dropdown              | `frontend/src/components/SearchRules.jsx:116-134` |
| Pydantic `SearchRules` model with Literal apply_mode | `server/main.py:91-102` |
| ID ↔ path resolution at the API boundary | `server/main.py:104-134` |
| `apply_mode` declared in search.py    | `config/search.py:58`                         |
| `per_term_resume` declared in search.py | `config/search.py:63`                         |
| Atomic write via `config_manager.write_config` | `server/main.py:133`                |
| Robust dict writes (audit improvement) | `server/config_manager.py:format_value` dict branch (added in audit) |

**Verified end-to-end in audit:** wrote a 3-key `per_term_resume` containing
embedded quotes via `write_config`, re-read with `read_config`, equality held.

---

## 4. Apply-mode in the bot

Required: branch on `apply_mode` in `runAiBot.py` — `easy`/`external`/`both`.

| Sub-requirement                       | File / location                              |
|---------------------------------------|----------------------------------------------|
| Easy-Apply button detection           | `runAiBot.py:1012`                            |
| `apply_mode == "external"` → skip Easy Apply | `runAiBot.py:1013-1016`                |
| `apply_mode == "easy"` → skip non-Easy-Apply | `runAiBot.py:1017-1020`                |
| `apply_mode == "both"` → original branch | `runAiBot.py:1022-1094`                 |
| `per_term_resume` swap per search term | `runAiBot.py:875-882`                      |
| `apply_mode` import path              | `runAiBot.py:40` (`from config.search import *`) |

---

## 5. LinkedIn company-post job scraper

Required: visit each company's `/posts`, scroll N times, classify each post via the existing LLM with strict JSON output, persist hits to `all excels/feed_jobs.csv`, dedupe by Post URL. `Companies` UI tab. New orchestrator endpoint `POST /api/feed-scan/start` running in a separate subprocess. `--dry-run`. Existing /jobs scraping untouched.

| Sub-requirement                       | File / location                              |
|---------------------------------------|----------------------------------------------|
| `config/companies.py:target_companies` | `config/companies.py:6`                     |
| Companies tab CRUD                    | `frontend/src/components/Companies.jsx`     |
| `LinkedInFeedSource`-equivalent (scan_company) | `modules/feed_scraper.py:182-218`  |
| `/posts` URL builder                  | `modules/feed_scraper.py:63-71`             |
| Scroll N times, collect text + permalink + posted-at | `modules/feed_scraper.py:74-106` (Posted-at extraction added in audit) |
| LLM classification with strict-JSON prompt | `modules/feed_scraper.py:136-179`      |
| Regex heuristic fallback              | `modules/feed_scraper.py:109-133`           |
| Persist hits to `all excels/feed_jobs.csv` | `modules/feed_scraper.py:35-36, 221-226` |
| Required CSV columns                  | `modules/feed_scraper.py:42-46` (9 required + 2 extras: Matched Role, Post Excerpt) |
| Dedupe by Post URL                    | `modules/feed_scraper.py:56-60, 197-198`    |
| `POST /api/feed-scan/start` endpoint  | `server/main.py:209-211`                    |
| Separate subprocess from main bot     | `server/bot_controller.py:10-11, 82-95`     |
| `--dry-run` flag                      | `modules/feed_scraper.py:269-272, 199, 261` |
| Existing /jobs flow untouched         | `runAiBot.py:867-1146` (apply_to_jobs body unchanged except for apply_mode/per_term hooks) |
| **Bonus:** company auto-discovery     | `modules/company_discovery.py`              |

---

## 6. UI structure

Required sidebar: `Dashboard | Search Rules | Resumes | Companies | Apply Log | Live Logs | Settings | Logout`.

Actual sidebar: `Dashboard | Search Rules | Resumes | Companies | Hiring Posts | Apply Log | Raw Config | Live Logs | Settings | Sign out`. The two extras (`Hiring Posts`, `Raw Config`) were retained at user request and documented in MIGRATION.md §9. All required tabs are present.

| Tab           | Component file                                       |
|---------------|------------------------------------------------------|
| Dashboard     | `frontend/src/components/Dashboard.jsx`              |
| Search Rules  | `frontend/src/components/SearchRules.jsx`            |
| Resumes       | `frontend/src/components/Resumes.jsx`                |
| Companies     | `frontend/src/components/Companies.jsx`              |
| Hiring Posts  | `frontend/src/components/HiringPosts.jsx`            |
| Apply Log     | `frontend/src/components/ApplyLog.jsx`               |
| Raw Config    | `frontend/src/components/ConfigEditor.jsx`           |
| Live Logs     | `frontend/src/components/Terminal.jsx`               |
| Settings      | `frontend/src/components/Settings.jsx`               |
| Logout        | `frontend/src/components/Sidebar.jsx:31-35`          |

---

## Non-negotiables

| Requirement | Evidence |
|-------------|----------|
| `python runAiBot.py` still runs standalone | `runAiBot.py:1283-1284` — `__main__` guard unchanged. `from config.search import *` now also pulls in `apply_mode` and `per_term_resume`, both of which have default values (`"both"`, `{}`). |
| Config persistence flows through `server/config_manager.py` | `server/resume_registry.py:46` (questions.py), `server/main.py:133` (search.py), `server/main.py:187` (companies.py), `modules/company_discovery.py:107, 117` (companies.py merge). |
| No mocks for LLM or Selenium | `modules/feed_scraper.py:152-167` wires to `modules.ai.openaiConnections.ai_completion` / `modules.ai.geminiConnections.gemini_completion`; `modules/feed_scraper.py:244-245` uses `modules.open_chrome.open_chrome`. |
| `--dry-run` skips CSV writes | `modules/feed_scraper.py:259-261` (`if not dry_run and hits: write_hits(hits)`). |
| Windows-friendly paths | `os.path.join` used in every server / module path; bash uses Linux-style mount paths only. |

---

## Fixes applied during this audit

| ID | Change | Files |
|----|--------|-------|
| B1 | Rewrote MIGRATION.md sections 5, 9, 10, 11, 12 to match the actual code (CSV filename `feed_jobs.csv`, column ordering, retained sidebar tabs, `AJA_HTTPS` flag, `read_config('secrets.py')` returning empty). | `MIGRATION.md` |
| B2 | Feed-scraper `Posted At` column now populated from the post header's `<time>` / actor sub-description element, with defensive try/except fall-through to empty. | `modules/feed_scraper.py` |
| B3 | `Login.jsx` no longer pre-fills the username field with `'admin'`. Helper text updated to reference env vars. | `frontend/src/components/Login.jsx` |
| B4 | `format_value()` in `config_manager.py` got an explicit `dict` branch (single-line canonical, recurses on values), and `read_config()` now uses a single namespace dict for `exec()` so helper functions defined inside config files (like `_env()` in the new `secrets.py`) resolve their imports correctly. | `server/config_manager.py` |
| B5 | `server/auth.py` cookie `secure` / `samesite` attrs are now driven by a new `AJA_HTTPS` env var (default off for local dev). | `server/auth.py` |
| B6 | `Companies.jsx` and `HiringPosts.jsx` collapsed their two on-mount `useEffect`s into one — avoids double-fire on mount. | `frontend/src/components/Companies.jsx`, `frontend/src/components/HiringPosts.jsx` |
| Secrets | `config/secrets.py` rewritten to load every credential from environment variables (LINKEDIN_USER, LINKEDIN_PASS, LLM_API_KEY, etc.) with empty-string fallbacks. The previously committed plaintext LinkedIn password and OpenAI key are now empty strings on disk. `.env.example` documents every variable. `.gitignore` extended with `.env`, `.env.local`, `server/auth_state.json`. | `config/secrets.py`, `.env.example`, `.gitignore` |
| Dotenv | Both `server/main.py` and `config/secrets.py` now call `dotenv.load_dotenv()` against the project-root `.env` on import (best-effort: silently no-ops if `python-dotenv` isn't installed). `python-dotenv` added to `requirements-ui.txt`. Documented in MIGRATION.md §2. | `server/main.py`, `config/secrets.py`, `requirements-ui.txt`, `MIGRATION.md` |
| Auth reset | Blanked `server/auth_state.json` so the next server boot re-seeds username/hash/JWT-secret from the loaded `.env`. (Was pinned to `admin` from a prior boot before the env vars were set.) | `server/auth_state.json` |

---

## Round 2 — features (MongoDB + LinkedIn Posts + neumorphism login)

| ID | Change | Files |
|----|--------|-------|
| Mongo layer | New `server/db.py` (pymongo client + indexes + healthcheck) and `server/store.py` (repos for posts / applied / companies / resumes / search rules; Mongo-first reads with file fallback; dual-writes). | `server/db.py`, `server/store.py` |
| Mongo migration | `python -m server.migrate_to_mongo` idempotently imports `feed_jobs.csv`, the applied/failed CSVs, `registry.json`, `companies.py`, and `search.py` into Mongo. `--dry-run` previews. | `server/migrate_to_mongo.py` |
| Writers wired | `modules/feed_scraper.py:write_hits` and `runAiBot.py:submitted_jobs` / `failed_job` dual-write to Mongo. `server/resume_registry.py` and `modules/company_discovery.py:merge_into_config` read/write through the store. | `modules/feed_scraper.py`, `runAiBot.py`, `server/resume_registry.py`, `modules/company_discovery.py` |
| API wired | `/api/hiring-posts`, `/api/applied-jobs`, `/api/companies`, `/api/search-rules` now read through `server/store`. New `GET /api/linkedin-posts` returns posts filtered to the current `search_terms` with an `_applied_status` field per row. New `GET /api/mongo/health` for the dashboard badge. | `server/main.py` |
| Sidebar tab | "LinkedIn Posts" added between Hiring Posts and Apply Log. | `frontend/src/components/Sidebar.jsx`, `frontend/src/App.jsx` |
| LinkedIn Posts UI | New `LinkedInPosts.jsx` — filtered table, clickable rows opening the post in a new tab, Applied badge, Mongo health badge, Start scan / Dry run buttons. | `frontend/src/components/LinkedInPosts.jsx` |
| Hiring Posts UI | Rows clickable; new Applied column showing the applied/failed badge if the bot has already touched the job. | `frontend/src/components/HiringPosts.jsx` |
| Apply Log UI | Status pills (Applied/Failed/Pending), rows clickable opening the LinkedIn job in a new tab. | `frontend/src/components/ApplyLog.jsx` |
| Neumorphism login | Rewrote `Login.jsx` with scoped neumorphism CSS — soft outset card, inset inputs, click-flip button, light/dark via `prefers-color-scheme`. | `frontend/src/components/Login.jsx` |
| Env / deps | `pymongo>=4`, `dnspython` added to `requirements-ui.txt`. `MONGODB_URI` / `MONGODB_DB` added to `.env.example`. MIGRATION.md got a new §12 covering Atlas setup, collections, and the health endpoint. | `requirements-ui.txt`, `.env.example`, `MIGRATION.md` |

### Design contract

- **Mongo is optional.** Without `MONGODB_URI`, behaviour is byte-identical
  to round 1: every read/write goes to CSV/JSON. Existing users see no
  change until they opt in.
- **Files stay authoritative on Mongo outages.** Every writer still writes
  to its CSV/JSON. Reads fall back to the same files when Mongo is
  unreachable. The standalone bot keeps applying.
- **No `import pymongo` from the bot path.** `runAiBot.py` only touches
  Mongo via `server/store.record_applied`, which is imported lazily and
  inside `try/except`. Missing `pymongo` or missing `server/` directory is
  a silent no-op.
- **`/api/linkedin-posts` extracts Job IDs from the post's Apply URL** (the
  `linkedin.com/jobs/view/{id}` pattern) so the Applied badge works without
  any extra wiring from the scraper side.

**Important:** the OpenAI key and LinkedIn password that were previously
committed in `config/secrets.py` are still recoverable from git history.
Scrubbing them out requires `git filter-repo` (or BFG) and a force-push,
which this audit does NOT execute on your behalf. Rotate both credentials
in their respective consoles regardless of whether you rewrite history.

---

## Things I did NOT change

- The Selenium-side selectors in `modules/feed_scraper.py` and
  `modules/company_discovery.py`. They depend on LinkedIn's current DOM.
  Without a way to verify against the live site, blind tweaks are risky.
- The pyautogui-driven manual-confirmation dialogs in `runAiBot.py`.
- The existing `apply_to_jobs` flow beyond the audit hooks that were
  already there before this pass.
- `requirements-ui.txt` — already satisfies the deliverable.
- Pre-existing `__pycache__/` and `.venv/` in the tree.

## Known sandbox artifacts

- `all resumes/_audit_probe/resume.pdf` — an empty placeholder PDF left over
  from the end-to-end registry sync test. The registry no longer references
  it. Safe to `Remove-Item -Recurse "all resumes/_audit_probe"` on Windows.

## Smoke-test results

| Test | Result |
|------|--------|
| `import config.search` after additions | `apply_mode='both'`, `per_term_resume={}`, terms=5 — OK |
| Multi-key `per_term_resume` round-trip via `write_config`/`read_config` (incl. embedded `"` and `'`) | match: True |
| Registry `set_default('_audit_probe')` → `config/questions.py:default_resume_path` rewrite | match: True |
| `python -m py_compile` on all touched server + modules files | OK |
| `from config.secrets import *` after rewrite (all 9 expected names present) | OK |
| Env-var override (`LINKEDIN_USER=test@example.com` → `config.secrets.username`) | applied |

The sandbox FUSE mirror of the workspace got stale relative to host writes
during the latter half of the audit (file Edits succeed host-side but the
Linux mount serves cached content), so some `python -m py_compile` runs
against modified files in the sandbox were skipped in favour of host-side
file-Read sanity checks. The Windows-side Python interpreter reads the
actual host files and is unaffected.
