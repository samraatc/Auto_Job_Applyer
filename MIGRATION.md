# Admin dashboard — migration notes

This patch adds an authenticated admin dashboard, a multi-resume registry, a
typed search-rules editor with an **apply mode** (Easy Apply / External /
Both), a LinkedIn **company-feed hiring-post scanner**, and **company
auto-discovery** that mines LinkedIn job results for companies hiring for
your configured search terms.

The existing Selenium bot (`runAiBot.py`) still runs standalone — none of the
prior config files were renamed.

## 1. Install new dependencies

```powershell
pip install -r requirements-ui.txt
```

New packages: `bcrypt`, `python-jose[cryptography]`, `python-multipart`,
`pydantic>=2`, `python-dotenv`.

## 2. Set environment variables

The server (and the standalone bot) auto-loads `.env` from the project root
on import — copy `.env.example` to `.env`, fill it in, and you're done. No
shell exports required.

If you'd rather not use `.env`, you can still set the same vars in your
shell. PowerShell example:

```powershell
$env:ADMIN_USER  = "youruser"
$env:ADMIN_PASS  = "a-strong-password"

# LinkedIn credentials (previously hard-coded in config/secrets.py)
$env:LINKEDIN_USER = "you@example.com"
$env:LINKEDIN_PASS = "your-linkedin-password"

# LLM provider (only LLM_API_KEY is required for OpenAI / DeepSeek / Gemini)
$env:USE_AI       = "true"
$env:AI_PROVIDER  = "openai"          # or "deepseek" / "gemini"
$env:LLM_API_KEY  = "sk-..."
$env:LLM_MODEL    = "gpt-4o-mini"

# Optional — when serving the dashboard behind HTTPS:
$env:AJA_HTTPS    = "true"
```

See `.env.example` for the full list with defaults.

`ADMIN_USER` / `ADMIN_PASS` are read **once** on first boot of the server and
persisted (bcrypt-hashed) to `server/auth_state.json` along with a generated
JWT secret. If you skip this step the dashboard boots with `admin` / `admin`
and prints a warning — change it immediately under **Settings → Change
password**.

**To rotate admin credentials later** — change them in `.env` (or your
shell env) and then **delete** `server/auth_state.json`. The next boot
re-seeds username/hash/JWT-secret from the now-loaded env. Existing
sessions are invalidated by the new JWT secret, which is a feature.

`LINKEDIN_USER` / `LINKEDIN_PASS` and the `LLM_*` vars are read on every
import of `config/secrets.py`, so you can rotate them without touching code.

## 3. Build the frontend

```powershell
cd frontend
npm install
npm run build
cd ..
```

## 4. Run the server

```powershell
uvicorn server.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000 — you should land on the login screen.

## 5. What changed in `config/`

- **Rewritten:** `config/secrets.py` now reads every credential from the
  environment via a tiny `_env()` helper. Literal values left in the file are
  empty-string fallbacks. The legacy "edit secrets in the Raw Config tab"
  workflow is intentionally gone — secrets live in env vars only.
- **New:** `config/companies.py` — list of `{name, linkedin_url, tags}` dicts
  that the feed scanner walks. Editable through the Companies tab.
- **New variables in `config/search.py`:**
  - `apply_mode` — `"easy"`, `"external"`, or `"both"` (default `"both"`).
  - `per_term_resume` — `{search_term: resume_pdf_path}` map written by the
    Search Rules editor.
- `config/questions.py:default_resume_path` is **auto-rewritten** every time
  you change the default resume in the dashboard. The legacy path
  `all resumes/default/resume.pdf` is registered as the default if present.

Nothing else moved. `personals.py`, `settings.py` are unchanged.

## 6. What changed in the bot

`runAiBot.py` reads `apply_mode` and `per_term_resume` (from
`from config.search import *`) and short-circuits the apply branch:

- `easy`     → skips a job that doesn't expose Easy Apply.
- `external` → skips a job that does expose Easy Apply (only collects external links).
- `both`     → original behaviour.

When iterating `search_terms`, if `per_term_resume[term]` resolves to an
existing file on disk, the bot temporarily swaps `default_resume_path` to it
for that term's iteration; otherwise it keeps the registry default.

Skipped jobs increment the existing `skip_count` and log a one-liner.

## 7. New backend modules

| File | Purpose |
|---|---|
| `server/auth.py` | bcrypt + JWT cookie auth, `require_admin` dependency. Cookie attrs gated on `AJA_HTTPS` env var. |
| `server/resume_registry.py` | upload / list / set-default / delete resumes; auto-syncs `config/questions.py:default_resume_path` on every save |
| `server/bot_controller.py` | now manages three subprocess slots: `bot` / `feed` / `discover` |
| `modules/feed_scraper.py` | scrolls each target company's `/posts` page, classifies posts via LLM (with a regex fallback), writes hits to `all excels/feed_jobs.csv`. Supports `--dry-run`. |
| `modules/company_discovery.py` | runs LinkedIn job search for each `search_term`, harvests `/company/...` links from the result cards, merges into `config/companies.py` |

## 8. API surface

All routes (except `GET /api/bot/status`) require the `aja_session` cookie.

```
POST   /api/auth/login              {username, password} -> sets cookie
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/change-password    {current_password, new_password}

GET    /api/config                  legacy raw-config dump
POST   /api/config                  legacy raw-config write
                                    (secrets.py is read-only via this path now —
                                    set env vars instead)

GET    /api/search-rules            typed SearchRules
POST   /api/search-rules            typed SearchRules (writes search.py)

GET    /api/resumes
POST   /api/resumes                 multipart: file, label, tags, make_default
PATCH  /api/resumes/{id}/default
DELETE /api/resumes/{id}

GET    /api/companies
POST   /api/companies               {target_companies: [...]}
POST   /api/companies/discover      spawns modules.company_discovery
GET    /api/companies/discover/status
GET    /api/companies/discover/logs SSE

POST   /api/feed-scan/start?dry_run=bool   spawns modules.feed_scraper
POST   /api/feed-scan/stop
GET    /api/feed-scan/status
GET    /api/feed-scan/logs                 SSE
GET    /api/hiring-posts?role=&company=&limit=

GET    /api/applied-jobs?status=all|applied|failed

POST   /api/bot/start
POST   /api/bot/stop
GET    /api/bot/status                     public (used by login-screen badge)
GET    /api/bot/logs                       SSE
```

## 9. UI tabs

`Dashboard | Search Rules | Resumes | Companies | Hiring Posts | Apply Log | Raw Config | Live Logs | Settings`

- **Dashboard** — start/stop the main applier bot, see status.
- **Search Rules** — typed form (terms, location, job type, experience,
  on-site, date posted, apply mode, per-term resume override).
- **Resumes** — upload PDFs (≤5 MB), switch default, delete. Default
  propagates to `config/questions.py:default_resume_path`.
- **Companies** — CRUD list + a one-click **Run discovery** button that
  opens Chrome, searches each role, and appends new companies.
- **Hiring Posts** — start/stop feed scan (with dry-run), filter results by
  role/company, click through to LinkedIn.
- **Apply Log** — read-only view of `all_applied_applications_history.csv` and
  `all_failed_applications_history.csv` with a text-search filter.
- **Raw Config** — legacy key/value editor for any setting that doesn't have
  a typed UI yet. `secrets.py` is now empty here on purpose.
- **Live Logs** — SSE-tailed stdout from the running bot subprocess.
- **Settings** — change admin password.
- **Sign out** is at the bottom of the sidebar.

## 10. CSV outputs

| Path | Source |
|---|---|
| `all excels/all_applied_applications_history.csv` | original bot (unchanged) |
| `all excels/all_failed_applications_history.csv`  | original bot (unchanged) |
| `all excels/feed_jobs.csv`                        | **NEW** — feed scanner hits |

Columns of `feed_jobs.csv` (in order):
`Source, Company, Posted At, Title, Location, Apply URL, Post URL,
Confidence, Classified At, Matched Role, Post Excerpt`.

`Posted At` is populated best-effort from the post header's relative-time
element (e.g. `"2d"` or an ISO `datetime` attribute); it stays empty when
the selector misses, which is harmless.

## 11. HTTPS / production hardening

The session cookie defaults to `secure=False, samesite=lax` so login works
on plain `http://127.0.0.1:8000`. When serving the dashboard behind HTTPS
(reverse proxy, ngrok, Caddy, etc.) set `AJA_HTTPS=true` in the server's
environment and restart — the cookie flips to `secure=True,
samesite=strict`.

## 12. Known limitations

- LinkedIn DOM changes will break the feed scraper selectors
  (`div.feed-shared-update-v2`, `div.update-components-update-v2`). Update
  `modules/feed_scraper.py:_scroll_and_collect` if scrolls return zero posts.
- Company discovery relies on `a.job-card-container__company-name` and
  `a[href*='/company/']` on the jobs results page; same fragility.
- The LLM classifier expects strict JSON. If the model returns prose, the
  scraper falls back to the regex heuristic.
- `read_config('secrets.py')` returns an empty dict on purpose (the
  underscored helpers in the new `secrets.py` aren't exported). Use the
  environment, not the Raw Config tab, to change them.
