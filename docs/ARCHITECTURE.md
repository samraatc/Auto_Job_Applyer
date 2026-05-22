# Architecture & Flow

A developer-oriented map of the project: what each piece is, how the pieces
talk, where data lives, and what happens end-to-end when you press *Start
bot* or *Run feed scan* in the dashboard.

Companion docs:
- `MIGRATION.md` — setup, env vars, deployment notes.
- `AUDIT.md` — feature-level compliance + change log.

---

## 1. What this project is

A LinkedIn auto-applier that:

1. Logs into LinkedIn in a real Chrome window via Selenium,
2. Iterates over your configured `search_terms`, walks paginated job results,
   and applies (or collects external links) within filter rules you set,
3. Independently scrapes target companies' `/posts` feeds and uses an LLM
   to classify which posts are hiring,
4. Exposes everything through an authenticated FastAPI + React admin dashboard.

It's split into three runtime processes managed by one parent server:

```
                    ┌──────────────────────────────────┐
                    │  uvicorn  server.main:app        │
                    │  (FastAPI + static React build)  │
                    └────────────┬─────────────────────┘
                                 │  spawns + tails stdout
                ┌────────────────┼────────────────────┐
                ▼                ▼                    ▼
       runAiBot.py        modules.feed_scraper  modules.company_discovery
       (Easy Apply +      (LinkedIn /posts      (Job search → company
        external links)    + LLM classifier)     harvesting)
```

Each child runs in its own Chrome instance, in its own subprocess slot.

---

## 2. High-level component map

```
┌────────────────────────────────────────────────────────────────────────────┐
│ frontend/  (Vite + React 19, served from /frontend/dist by FastAPI)        │
│   App.jsx ──> Sidebar.jsx                                                  │
│           ──> Dashboard | SearchRules | Resumes | Companies | HiringPosts  │
│               LinkedInPosts | ApplyLog | ConfigEditor | Terminal | Settings│
│           ──> Login.jsx (neumorphism, shown when /api/auth/me returns 401) │
│   api.js  (fetch wrapper: credentials:'include', 401→event)                │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │ HTTPS-ready cookie + JSON
                                   ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ server/                                                                    │
│   main.py             FastAPI app, routes, CORS, static mount              │
│   auth.py             bcrypt + JWT in httpOnly cookie, require_admin dep   │
│   config_manager.py   read_config / write_config for config/*.py           │
│   resume_registry.py  PDF upload, registry.json, syncs questions.py        │
│   bot_controller.py   3 subprocess slots (bot/feed/discover) + SSE logs    │
│   db.py               pymongo client + indexes + healthcheck (optional)    │
│   store.py            Repos: posts / applied / companies / resumes /       │
│                       search_rules. Mongo-first reads, file fallback,      │
│                       dual writes.                                         │
│   migrate_to_mongo.py One-shot idempotent CSV/JSON→Mongo importer          │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ subprocess.Popen ['python', '-u', …]
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ runAiBot.py    main bot loop (Selenium + LLM)                              │
│ modules/                                                                   │
│   open_chrome.py             undetected-chromedriver setup                 │
│   helpers.py                 logging, sleep, CSV truncation                │
│   clickers_and_finders.py    XPath/CSS helpers (try_xp, wait_span_click)   │
│   validator.py               sanity-checks config on bot start             │
│   feed_scraper.py            scrape /posts pages + LLM classify            │
│   company_discovery.py       harvest companies from job-search results     │
│   ai/                                                                      │
│     openaiConnections.py     OpenAI (+ openai-compatible local LLMs)       │
│     deepseekConnections.py   DeepSeek                                      │
│     geminiConnections.py     Google Gemini                                 │
│     prompts.py               system / few-shot prompts                     │
│   resumes/                   (in-development; PDF generator/extractor)     │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │ reads
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ config/  (Python files exec'd via config_manager.read_config)              │
│   secrets.py        creds + LLM (env-var first, file fallback)             │
│   personals.py      name / address / gender / etc.                         │
│   questions.py      Easy-Apply answer bank + default_resume_path           │
│   settings.py       browser + behaviour flags                              │
│   search.py         search_terms, filters, apply_mode, per_term_resume     │
│   companies.py      target_companies for the feed scraper                  │
│   resume.py         (in-development; resume-generator inputs)              │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ Persistence (dual layer)                                                   │
│   Files  (always written, source of truth on Mongo outage)                 │
│     all excels/feed_jobs.csv                       hiring-post hits        │
│     all excels/all_applied_applications_history.csv applied jobs           │
│     all excels/all_failed_applications_history.csv  failed jobs            │
│     all resumes/<id>/resume.pdf + registry.json    resume registry         │
│     config/companies.py, config/search.py          editable Python configs │
│     server/auth_state.json                         bcrypt hash + JWT secret│
│   MongoDB Atlas  (preferred when MONGODB_URI is set)                       │
│     posts, applied_jobs, companies, resumes, resumes_meta, search_rules    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Why three subprocesses

`server/bot_controller.py` owns three independent slots:

| Slot       | Argv                                          | Purpose                       |
|------------|-----------------------------------------------|-------------------------------|
| `bot`      | `python -u runAiBot.py`                       | The main Easy-Apply loop      |
| `feed`     | `python -u -m modules.feed_scraper [--dry-run]` | Scrape /posts pages, classify |
| `discover` | `python -u -m modules.company_discovery`      | Find new companies            |

Each slot:
- Has its own `subprocess.Popen` handle and `queue.Queue` for stdout.
- Streams stdout via a background `threading.Thread` (`_enqueue_output`).
- Surfaces via SSE through `/api/{bot,feed-scan,discover}/logs`.
- Returns `{status: running|not_running|already_running|stopped}` on start/stop.

This isolation matters because each child opens its own Chrome session and
uses Selenium globals. Running them in-process would conflict on driver
state, login cookies, and pyautogui dialogs.

---

## 4. End-to-end flow: pressing **Start Bot**

```
User clicks "Start Bot" in Dashboard
  → POST /api/bot/start    (cookie auth)
  → bot_controller.start_bot()
      → subprocess.Popen(['python','-u','runAiBot.py'], cwd=PROJECT_ROOT)
      → spawns stdout-tailing thread
  → returns {status:'started', slot:'bot'}

runAiBot.main()
  ├─ validate_config()
  ├─ ensure default_resume_path exists      (from config.questions, which
  │                                           resume_registry keeps in sync)
  ├─ open Chrome via modules.open_chrome
  ├─ is_logged_in_LN() ? : login_LN()       (uses LINKEDIN_USER/PASS env)
  ├─ if use_AI: ai_create_*_client()        (LLM client init)
  └─ run(total_runs=1)
       └─ apply_to_jobs(search_terms)
            for each search_term:
              if per_term_resume[term] exists on disk:
                temporarily swap globals()['default_resume_path']
              driver.get("https://www.linkedin.com/jobs/search/?keywords=…")
              apply_filters()
              while current_count < switch_number:
                for each job card on page:
                  get_job_main_details()
                  check_blacklist()
                  get_job_description()
                  if use_AI:
                    skills = ai_extract_skills(jobDescription)
                  ─── apply_mode branch ───
                    "external"  + has Easy Apply → skip
                    "easy"      + no Easy Apply  → skip
                    otherwise → original behaviour:
                      Easy Apply path:
                        answer_questions(modal, …)
                        upload_resume(default_resume_path)
                        Submit / Done
                      else:
                        external_apply(): open external link tab,
                                          record application_link
                  submitted_jobs(...) writes:
                    1. row → all_applied_applications_history.csv
                    2. row → Mongo.applied_jobs (best-effort via store)
            return
       sleep 300+300 between cycles, repeat if run_non_stop
```

Frontend simultaneously opens `EventSource('/api/bot/logs')`. Each child
stdout line gets forwarded as a `data: …` SSE frame, which the Terminal
component appends.

---

## 5. End-to-end flow: pressing **Run feed scan**

```
LinkedIn Posts (or Hiring Posts) tab → "Refresh from LinkedIn"
  → POST /api/feed-scan/start?dry_run=false
  → bot_controller.start_feed_scan(dry_run=False)
      → subprocess.Popen(['python','-u','-m','modules.feed_scraper'])

modules.feed_scraper.run(dry_run=False)
  ├─ open Chrome
  ├─ login bootstrap (runs runAiBot.is_logged_in_LN/login_LN)
  ├─ for each entry in config.companies.target_companies:
  │    url = company.linkedin_url.rstrip('/') + '/posts/'
  │    driver.get(url); time.sleep(3)
  │    posts = _scroll_and_collect(driver, max_scrolls=8)
  │       └─ collects {text, permalink, posted_at} per post card
  │    for each post:
  │      if post URL already in feed_jobs.csv: skip
  │      cls = _ai_classify(post.text, roles) or _heuristic_classify(post.text)
  │      if cls.is_hiring:
  │        build hit dict (Source, Company, Posted At, Title, Location,
  │                        Apply URL, Post URL, Confidence, Classified At,
  │                        Matched Role, Post Excerpt)
  │  if not dry_run and hits:
  │    write_hits(hits)
  │       └─ store.upsert_posts(hits):
  │            1. append rows to feed_jobs.csv
  │            2. bulk_write UpdateOne(post_url) upserts into Mongo.posts
  └─ print done summary
```

`_ai_classify` builds a strict-JSON prompt (`{"is_hiring": bool, ...}`),
calls the configured LLM, and falls back to `_heuristic_classify` (regex
on phrases like "we're hiring", "open role", URLs) if the LLM fails or
returns malformed JSON.

---

## 6. End-to-end flow: pressing **Run discovery**

```
Companies tab → "Run discovery"
  → POST /api/companies/discover
  → bot_controller.start_discovery()
      → subprocess.Popen(['python','-u','-m','modules.company_discovery'])

modules.company_discovery.discover()
  ├─ open Chrome, log in
  ├─ for each role in search_terms:
  │    url = "https://www.linkedin.com/jobs/search/?keywords=" + role
  │             + ("&location=" + search_location)
  │    driver.get(url); scroll a few times
  │    collect company anchors matching /company/<slug>
  │    score each by frequency across roles
  └─ ranked top N (default 25)

merge_into_config(ranked):
  ├─ load current companies (Mongo via store.list_companies, file fallback)
  ├─ dedupe by linkedin_url
  └─ store.replace_companies(merged)
       ├─ config_manager.write_config('companies.py', {...})
       └─ Mongo.companies.delete_many({}) + insert_many(merged)
```

---

## 7. Authentication flow

```
React boot → checkAuth() → GET /api/auth/me   (sends aja_session cookie)
                              │
                              ├─ 200 {username}  → App renders dashboard
                              └─ 401              → api.js dispatches
                                                    'aja:unauthenticated'
                                                    → setUser(null)
                                                    → Login.jsx renders

User submits form
  POST /api/auth/login {username, password}
    server/auth.verify_credentials():
      _ensure_state() loads server/auth_state.json
        if missing username/password_hash:
          read ADMIN_USER, ADMIN_PASS from env
          bcrypt-hash, persist
      bcrypt.checkpw(password, state.password_hash)
    create_token():
      jwt.encode({sub, exp=now+12h}, state.jwt_secret, HS256)
    set_session_cookie():
      Set-Cookie: aja_session=<jwt>;
                  HttpOnly;
                  SameSite=lax|strict (AJA_HTTPS);
                  Secure=false|true (AJA_HTTPS);
                  Max-Age=43200;
                  Path=/

Every mutating route depends on require_admin(aja_session: Cookie):
  - decode JWT against state.jwt_secret
  - verify sub == state.username
  - raise 401 on failure
```

Rotation: change `ADMIN_USER` / `ADMIN_PASS` in `.env`, delete
`server/auth_state.json`, restart. The new boot re-seeds and generates a
fresh JWT secret, which invalidates all existing browser sessions.

---

## 8. Config persistence model

There are two write paths and they go through the same `config_manager`:

```
┌────────────────────────────────┐    ┌─────────────────────────────────┐
│ User edits Search Rules tab    │    │ User clicks "Save" in Raw Config│
│ POST /api/search-rules         │    │ POST /api/config (typed=False)  │
└──────────┬─────────────────────┘    └──────────┬──────────────────────┘
           │                                     │
           ▼                                     ▼
   store.write_search_rules()         config_manager.update_all_configs()
           │                                     │
           ├─ config_manager.write_config('search.py', payload)
           │     regex-substitutes each `key = value` line in place
           │     (preserves comments + helpful text around it)
           └─ Mongo.search_rules.update_one({_id:"current"}, $set, upsert=True)
```

`config_manager.write_config` uses a regex that matches `key = value`
assignments and substitutes in place. `format_value` knows how to render
str/bool/list/dict so values round-trip cleanly (including dicts with
embedded quotes — verified end-to-end). Reads use `exec(content, ns, ns)`
into a single namespace, filtering out callables, `__builtins__`, and
underscored names — so helper functions like `_env()` in `secrets.py` can
do `import os` without the read crashing.

---

## 9. Mongo dual-write semantics

```
Write path (e.g. feed_scraper.write_hits):
  1. Append rows to all excels/feed_jobs.csv         ← always
  2. store.upsert_posts():
       db.posts.bulk_write([UpdateOne({post_url}, $set, upsert=True), …])
                                                     ← best-effort
     If Mongo is None (URI unset or unreachable):
       step 2 is a no-op, logged once per minute

Read path (e.g. /api/hiring-posts):
  1. db = get_db()
  2. if db is not None:
       try Mongo query (with role/company/limit filters)
       on success: return projected to legacy CSV-shaped keys
       on failure: fall through
  3. read all excels/feed_jobs.csv, sort, filter, slice
```

This gives you three states:

| State                    | Reads from | Writes to       |
|--------------------------|------------|-----------------|
| `MONGODB_URI` unset      | Files      | Files only      |
| URI set, Atlas reachable | Mongo      | Mongo + Files   |
| URI set, Atlas down      | Files      | Files (Mongo retry next call) |

`runAiBot.py` is intentionally Mongo-blind. It imports `server.store`
lazily inside `try/except` so the standalone bot keeps running even when
`server/` isn't importable or `pymongo` isn't installed.

---

## 10. Mongo collections (when enabled)

```
auto_job_applier                            (database; MONGODB_DB env)
├── posts                                   (hiring posts)
│     unique on post_url
│     indexed on classified_at, matched_role
│     {source, company, posted_at, title, location, apply_url, post_url,
│      confidence, classified_at, matched_role, post_excerpt}
├── applied_jobs                            (applied + failed history)
│     unique on job_id
│     indexed on date_applied, status
│     {job_id, title, company, status: 'applied'|'failed',
│      date_applied, job_link, external_link, ... (CSV-shaped keys also kept)}
├── companies                               (target list)
│     unique on linkedin_url
│     {name, linkedin_url, tags[]}
├── resumes                                 (registry entries)
│     unique on id
│     {id, label, path, tags[], uploaded_at}
├── resumes_meta                            (default pointer)
│     _id="default", default_id
└── search_rules                            (current typed rules)
      _id="current"
      {search_terms[], search_location, job_type[], experience_level[],
       on_site[], date_posted, apply_mode, per_term_resume{}, ...}
```

`server/migrate_to_mongo.py` is the idempotent importer: it reads every
existing CSV/JSON/config-py and upserts into the right collection. Safe to
re-run any time (and recommended after first enabling Mongo).

---

## 11. Apply-mode and per-term resume

These two `config/search.py` knobs change how `apply_to_jobs` behaves:

```python
apply_mode = "both"          # "easy" | "external" | "both"
per_term_resume = {          # term-specific resume override
    "Product Manager":   "all resumes/pm_role/resume.pdf",
    "Software Engineer": "all resumes/swe_role/resume.pdf",
}
```

In `apply_to_jobs`:

```python
for searchTerm in search_terms:
    # (a) per-term resume swap
    override = (per_term_resume or {}).get(searchTerm)
    if override and os.path.exists(override):
        globals()['default_resume_path'] = override
    else:
        globals()['default_resume_path'] = _base_resume_path

    # (b) per-job apply-mode branch
    has_easy = try_xp(driver, ".//button[…contains(@aria-label,'Easy')…]")
    if apply_mode == "external" and has_easy:  skip
    if apply_mode == "easy" and not has_easy:  skip
    # else: original behaviour
```

The UI's *Search Rules* tab writes both values back through the typed
`/api/search-rules` endpoint. Resume IDs are translated to filesystem
paths on save (using the registry), so the Python side stays simple.

---

## 12. Resume registry

```
Upload:
  React Resumes.jsx → POST /api/resumes (multipart: file, label, tags, default)
    server.resume_registry.upload_resume():
      enforce .pdf and ≤5 MB
      slugify(label) + uuid[:6] → folder name
      save file to all resumes/<id>/resume.pdf
      append entry to registry
      if first ever or make_default: data.default_id = new id
      _save(data):
        1. write all resumes/registry.json
        2. (if Mongo) replace resumes collection + update resumes_meta
        3. _sync_questions_default() →
              config_manager.write_config('questions.py',
                  {'default_resume_path': default_entry['path']})

runAiBot.main() at startup:
  from config.questions import default_resume_path   ← always current,
                                                       because registry sync
                                                       rewrites it on every
                                                       change
```

---

## 13. Frontend structure

```
frontend/src/
├── main.jsx                  React 19 root
├── App.jsx                   tab state, /api/auth/me bootstrap, layout
├── api.js                    fetch wrapper: credentials:'include' +
│                             401 → 'aja:unauthenticated' event
└── components/
     Sidebar.jsx              tab list (10 tabs incl. LinkedIn Posts)
     Dashboard.jsx            Start/Stop Bot, status badge
     SearchRules.jsx          typed editor (terms, filters, apply_mode,
                              per-term resume)
     Resumes.jsx              upload + list + set-default + delete
     Companies.jsx            CRUD + Run discovery
     HiringPosts.jsx          all scraper hits, clickable rows, Applied badge
     LinkedInPosts.jsx        hits filtered to current search_terms,
                              Applied badge, Mongo health
     ApplyLog.jsx             applied/failed CSV+Mongo merge, status pills
     ConfigEditor.jsx         legacy raw key/value editor (read of typed
                              configs only — secrets.py is empty here)
     Terminal.jsx             SSE-tailed bot stdout
     Settings.jsx             change admin password
     Login.jsx                neumorphism sign-in (shown when 401)
```

All API calls flow through `api.js`. A 401 anywhere fires a custom event
that flips `App.jsx`'s `user` to null, which mounts `Login.jsx`. After a
successful POST `/api/auth/login`, the cookie is set server-side and the
next `/api/auth/me` succeeds.

---

## 14. Boot sequence (the order things load)

```
uvicorn server.main:app
  └─ server/main.py top-of-file:
       sys.path.insert(0, server/)
       try: dotenv.load_dotenv(<project>/.env)      ← step 1: env loaded
       from config_manager, bot_controller, auth,
            resume_registry, db, store ...           ← step 2: imports
            ├─ auth.py reads AJA_HTTPS (now in env)
            ├─ auth._ensure_state() reads ADMIN_USER/PASS (now in env)
            └─ db.py reads MONGODB_URI/MONGODB_DB (now in env)
       FastAPI app constructed, routes registered
       StaticFiles mount at /  (frontend/dist if built)

python runAiBot.py            (standalone, also under bot subprocess)
  └─ from config.secrets import …  ← dotenv loaded here too (config/secrets.py
                                     calls load_dotenv on import)
     from config.search, .questions, .settings, .personals
     from modules.open_chrome import *
     main() …
```

The two dotenv loads are both idempotent (no `override`), so it doesn't
matter which entry point runs first.

---

## 15. Error & failure model

| Failure                                    | What happens                                       |
|--------------------------------------------|----------------------------------------------------|
| Atlas unreachable                          | Repos return files; warning logged once/min        |
| `pymongo` not installed                    | `db.is_enabled()` returns False; files only        |
| `.env` missing                             | dotenv no-ops; vars default per `_env(name, dflt)` |
| `ADMIN_USER/PASS` unset on first boot      | Auth seeds with `admin`/`admin`, prints warning    |
| LinkedIn DOM selectors stop matching       | Feed scraper returns 0 posts; bot logs + continues |
| LLM call fails / non-JSON response         | `_heuristic_classify` regex fallback runs          |
| Selenium browser closes mid-run            | `NoSuchWindowException` propagates to `main()`,    |
|                                            | summary dialog still shown, driver.quit()          |
| CSV file locked (open in Excel)            | pyautogui alert; row is dropped — next attempt OK  |
| Resume PDF missing at default_resume_path  | pyautogui alert; bot reuses last LinkedIn upload   |

The system never blocks on Mongo or on the LLM — both are best-effort.
The Selenium core is the only hard dependency for the apply loop.

---

## 16. Runtime workflows (the everyday user journey)

### First-time setup
```
pip install -r requirements-ui.txt
cp .env.example .env  &&  edit ADMIN_USER, ADMIN_PASS, LINKEDIN_USER,
                              LINKEDIN_PASS, LLM_API_KEY, MONGODB_URI
cd frontend && npm install && npm run build && cd ..
python -m server.migrate_to_mongo            ← only if MONGODB_URI is set
uvicorn server.main:app --host 127.0.0.1 --port 8000
# open http://127.0.0.1:8000 → log in
```

### Daily use
1. Open dashboard → log in.
2. *Search Rules* → tweak terms / filters / apply mode → Save.
3. *Resumes* → upload a fresh PDF, mark default → propagates to `questions.py`.
4. *Companies* → add or run discovery to populate target_companies.
5. *Dashboard* → Start Bot → Live Logs streams.
6. While that runs, *LinkedIn Posts* → Refresh from LinkedIn → review
   hiring posts, click rows to open on LinkedIn, see Applied badges
   appear as the bot processes Job IDs.
7. *Apply Log* → review what got submitted / failed.

### Standalone bot (no dashboard)
```
python runAiBot.py
```
Same behaviour as `Start Bot` from the dashboard, but no SSE log
streaming, no Mongo health surface, no UI controls. Reads the same `.env`
and same config files.

---

## 17. Where things are stored on disk

```
F:\Real_Pro_Practice\Automation\Auto_job_applier_linkedIn-main\
├── runAiBot.py                          # main bot entry
├── server/                              # FastAPI app + repos
├── modules/                             # bot logic + AI clients
├── config/                              # editable Python config
├── frontend/                            # React 19 source + dist/
├── all resumes/
│   ├── registry.json                    # resume registry (mirrored in Mongo)
│   └── <resume_id>/resume.pdf           # uploaded PDFs
├── all excels/
│   ├── all_applied_applications_history.csv
│   ├── all_failed_applications_history.csv
│   └── feed_jobs.csv                    # hiring-post scraper output
├── logs/
│   ├── log.txt                          # rolling bot log
│   └── screenshots/                     # one-off failure captures
├── server/auth_state.json               # bcrypt hash + JWT secret (gitignored)
├── .env                                 # local secrets (gitignored)
├── MIGRATION.md                         # setup + deployment notes
├── AUDIT.md                             # compliance + change log
└── ARCHITECTURE.md                      # this document
```

---

## 18. Dependencies

```
Python (server + bot)
  fastapi, uvicorn[standard]              ← admin API + static serving
  python-multipart                        ← file uploads
  bcrypt, python-jose[cryptography]       ← admin auth
  pydantic>=2                             ← typed payloads
  python-dotenv                           ← .env autoload
  pymongo>=4, dnspython                   ← Mongo Atlas (optional)
  selenium, undetected-chromedriver       ← browser automation
  pyautogui                               ← user-confirm dialogs
  openai, google-generativeai             ← LLM clients (optional)

JavaScript (frontend)
  react 19, react-dom 19, vite            ← build + runtime
  (no other runtime deps — everything is fetch + custom CSS)
```

---

## 19. Diagram: full request lifecycle (LinkedIn Posts tab)

```
┌────────────┐
│  Browser   │ React: LinkedInPosts mounts
└─────┬──────┘
      │ GET /api/linkedin-posts          (cookie: aja_session)
      │ GET /api/mongo/health
      │ GET /api/feed-scan/status        (every 4s)
      ▼
┌─────────────────────────────────────────────────────────┐
│ uvicorn → FastAPI                                       │
│   require_admin(): decode JWT, verify sub               │
│   store.read_search_rules() → terms                     │
│   store.list_posts(match_terms=terms, limit=200)        │
│     ├─ try Mongo: db.posts.find({...}).sort.limit       │
│     │             return projected to CSV-shape keys    │
│     └─ fallback:  read feed_jobs.csv, filter, slice     │
│   extract Job IDs from Apply URLs                       │
│   store.applied_status_map(ids):                        │
│     ├─ try Mongo: db.applied_jobs.find({job_id:{$in}})  │
│     └─ fallback:  return {} (no badges)                 │
│   annotate posts with _applied_status                   │
│ → JSON: {posts:[...], matched_terms:[...]}              │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌────────────┐  React renders table; rows are clickable;
│  Browser   │  user clicks → window.open(Post URL).
└────────────┘
```

---

## 20. Glossary

| Term                  | Meaning                                                   |
|-----------------------|-----------------------------------------------------------|
| Easy Apply            | LinkedIn's in-modal apply flow (vs. external redirect)    |
| apply_mode            | `easy` / `external` / `both` — controls which jobs apply  |
| per_term_resume       | Map of `search_term → resume_pdf_path` for per-role résumés |
| Feed scan             | Walks each company's /posts page, LLM-classifies          |
| Discovery             | Walks LinkedIn job search, harvests company links         |
| Repo (in `store.py`)  | Mongo-first / file-fallback persistence facade            |
| dotenv autoload       | `load_dotenv()` called from both `main.py` and `secrets.py` |
| AJA_HTTPS             | Env flag → Secure + SameSite=strict cookie                 |
| MONGODB_URI           | Atlas SRV string (empty = Mongo disabled)                 |
| auth_state.json       | Persisted bcrypt hash + JWT secret (rotate by deleting)    |
