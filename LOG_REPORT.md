# Bot log analysis — 2026-05-21

Source: stdout from the most recent `runAiBot.py` subprocess plus the contents
of `all_applied_applications_history.csv` and `all_failed_applications_history.csv`.

This is an analysis, not a refactor — every recommendation at the bottom is
left as a proposal you can opt into.

---

## 1. Headline numbers

| Metric                                | Value                  |
|---------------------------------------|------------------------|
| Total **applied** rows (all-time)     | **76**                 |
| &nbsp;&nbsp;– Older Product-roles batch (timestamped, Mar/Apr 2026) | 49 |
| &nbsp;&nbsp;– Current DevOps/Cloud batch (Date Applied = "Pending") | 27 |
| Total **failed** rows (all-time)      | **~330**               |
| Failed / Applied ratio                | **~4.3 ×**             |
| Unique failed Job IDs                 | ~210 (≈120 retries)    |
| LLM provider in use                   | `openai` (gpt-5-mini, per secrets.py earlier in the session) |
| LLM call success rate (in pasted run) | **0 %** — every call hit HTTP 429 |
| External-link captures in this run    | ≥ 2 (saved as "External Job link" rows) |
| Duplicate-job skip events             | ≥ 5 ("Already applied to ...") |

The "Date Applied = Pending" rows are interesting: that's `submitted_jobs()`
writing the row *before* `date_applied` was set to `datetime.now()`. That
only happens when the Easy Apply path bailed out and the bot wrote the row
as part of the external-link branch. So the current batch is almost entirely
externals — see §3.

---

## 2. What the run actually did

A representative slice:

```
Apply to "Associate Cloud Operations Engineer 2 | PowerSchool"
  Time Posted: Bengaluru, Karnataka, India ⋅ 6 days ago ⋅ Over 100 people clicked apply
  -- EXTRACTING SKILLS FROM JOB DESCRIPTION
  ERROR: Error code: 429 - insufficient_quota
  Click Failed! Didn't find 'Continue'
  Got the external application link "https://careers3-powerschool.icims.com/jobs/52744/..."
  Successfully saved "Associate Cloud Operations Engineer 2 | PowerSchool" job. Job ID: 4411512378 info

  Trying to Apply to "Software Engineer | BrothersTec"
    -- EXTRACTING SKILLS FROM JOB DESCRIPTION
    ERROR: Error code: 429 - insufficient_quota
    Click Failed! Didn't find 'Continue'
    Got the external application link "https://www.linkedin.com/jobs/search/?currentJobId=4411525913&..."
    Successfully saved ...

  Trying to Apply to "DevOps Engineer - Remote | YO IT Consulting"
    Found "Clearance" or "Polygraph". Skipping this job!

  Failed to click "DevOps Engineer | Infio" job on details button. Job ID: 4414740200!
  Already applied to "DevOps Engineer | Infio" job. Job ID: 4414740200!
```

So in one window of ~3 jobs, every one of them:
1. Triggered the LLM and got HTTP 429,
2. Fell through to the heuristic / no-skill path,
3. Either applied externally (no Easy Apply submit) or was skipped on the
   security-clearance regex.

---

## 3. Failure modes ranked by impact

### 3.1 OpenAI billing quota exhausted (BLOCKER)

```
Error code: 429 - You exceeded your current quota, please check your plan and
billing details. ... 'type': 'insufficient_quota'
```

- **Where:** `modules/ai/openaiConnections.py:ai_extract_skills`.
- **Effect:** Skills column is missing/wrong for every new row; AI answering
  of unknown form fields falls back to `years_of_experience` + a random
  pick (`randomly_answered_questions` set). On forms that have a free-text
  "Why are you a good fit?" textarea this defaults to `""` → submission
  may be rejected.
- **Why:** Account credit is exhausted. The error is from OpenAI's API,
  not your code.
- **Fix:** either top up at https://platform.openai.com/billing, or set
  `AI_PROVIDER=gemini` (free tier) / `AI_PROVIDER=deepseek` (cheap) /
  Ollama locally. The bot already supports all three providers — only the
  `.env` switch is needed.

### 3.2 "Time Posted" parser captures the wrong text

```
Time Posted: Bengaluru, Karnataka, India ⋅ 6 days ago ⋅ Over 100 people clicked apply
```

That whole sentence is being fed to `calculate_date_posted(...)`, which
expects something like `"6 days ago"`. The XPath at
`runAiBot.py:973-979` is `'.//span[contains(normalize-space(), " ago")]'`
applied to the wide `jobs_top_card`, and LinkedIn has merged metadata into
the same span lately. Result: `date_listed` ends up `"Unknown"` for most
new rows.

- **Impact:** purely cosmetic right now (the bot still applies), but the
  Date Posted column in `all_applied_applications_history.csv` is empty
  for the recent batch.
- **Fix:** tighten the XPath, or post-process the captured string with a
  regex like `r"(\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)"`
  before passing to `calculate_date_posted`.

### 3.3 "Click Failed! Didn't find 'Continue'"

```
Click Failed! Didn't find 'Continue'
Got the external application link "..."
```

- **Where:** `external_apply()` calls `wait_span_click(driver, "Continue", 1, True, False)`
  *after* hitting the apply button. LinkedIn's modal sometimes goes
  straight to a "Job application" external-link panel without a
  "Continue" button.
- **Impact:** noisy log; functionally fine because the next line shows
  the external link was still captured.
- **Fix (optional):** demote that message from "Click Failed!" to a debug
  print, since it's not actually a failure mode in this flow.

### 3.4 HR info missing on most jobs

```
HR info was not given for "Associate Cloud Operations Engineer 2" with Job ID: 4411512378!
```

- **Where:** `runAiBot.py:945-967`.
- **Cause:** "Promoted by hirer" / "Responses managed off LinkedIn" jobs
  rarely surface a `hirer-card__hirer-information` element. So this is
  expected for promoted listings and the bot logs it correctly.
- **Recommendation:** none, unless you want to silence the line entirely.

### 3.5 Re-attempt of permanently-failed Job IDs

| Job ID       | Times in failed CSV |
|--------------|---------------------|
| `4376823988` | 5                   |
| `4376482663` | 6                   |
| `4392270330` | 5                   |
| `4391554515` | 4                   |
| `4391074298` | 4                   |
| `4389186674` | 4                   |
| `4387572811` | 4                   |
| `4386309901` | 5                   |

`apply_to_jobs()` only de-dupes against the **applied** CSV
(`get_applied_job_ids`). Failed jobs come back on every search cycle
because the rejected-jobs set is per-process. Over 16 runs you've
reattempted these jobs 50+ times in aggregate — wasted Selenium time and
LLM tokens.

- **Fix:** load failed Job IDs at startup the same way applied IDs are
  loaded. One-liner add in `runAiBot.py:apply_to_jobs`:
  ```python
  rejected_jobs = get_failed_job_ids()   # parallel of get_applied_job_ids
  ```
  Then never call `failed_job(...)` for a Job ID already in that set.

### 3.6 Encoding mojibake in stdout

The pasted log shows `�` in place of bullets and dashes:

```
Bengaluru, Karnataka, India � 6 days ago � Over 100 people clicked apply
```

- **Where:** `bot_controller._spawn()` opens the subprocess with
  `encoding='utf-8', errors='replace'`, but the subprocess itself writes
  with the Windows default code page (cp1252 / cp65001 depending on host).
  When a UTF-8 bullet hits cp1252's decode table it becomes `?` →
  `replace` → `�`.
- **Fix:** set `PYTHONIOENCODING=utf-8` in the spawn env:
  ```python
  env = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}
  subprocess.Popen(argv, ..., env=env)
  ```
  Already inside `server/bot_controller.py:_spawn`. One-line change.

### 3.7 Search-term drift between runs

The applied CSV shows the search corpus has shifted:

- **Mar–Apr 2026 (49 rows):** entirely Product Manager / APM titles.
- **May 2026 (27 rows):** entirely DevOps / Cloud / Software Engineer titles.

That's expected since you edited `search_terms` in the dashboard. Worth
flagging because it's why the apply-log table looks bimodal.

---

## 4. Apply-mode signal

In the current batch, every successful "applied" row has
`External Job link = <some non-LinkedIn URL>` and `Date Applied = Pending`.
That's the **external** path firing — these jobs were saved as
"link collected" rather than "Easy Apply submitted". Consistent with
`apply_mode = "both"` and most DevOps jobs not offering Easy Apply.

If you want to bias the bot toward jobs you can submit-in-one-click, flip
`apply_mode` to `"easy"` in the Search Rules tab — the run will skip jobs
that don't show Easy Apply, which today is most of the DevOps listings.

---

## 5. Bad-word filter is firing correctly

```
Found "Clearance" or "Polygraph". Skipping this job!
```

That came from `runAiBot.py:402-404` matching `'clearance'` in the job
description (NetApp + YO IT Consulting both mentioned clearance / security
contexts). Good — those jobs would have been a waste of an apply.

---

## 6. Summary table

| Health area                | State        | Action recommended                          |
|----------------------------|--------------|---------------------------------------------|
| LinkedIn login + scraping  | ✅ working   | none                                        |
| Easy Apply submission      | ⚠ degraded  | check whether jobs in this batch *had* Easy Apply at all |
| External link collection   | ✅ working   | none                                        |
| Blacklist / clearance skip | ✅ working   | none                                        |
| LLM skill extraction       | ❌ broken    | top up OpenAI billing **or** switch provider |
| Time Posted parsing        | ❌ broken    | tighten XPath / post-process with regex      |
| Duplicate-applied dedupe   | ✅ working   | none                                        |
| Duplicate-failed dedupe    | ❌ missing   | load failed IDs on startup                   |
| Subprocess log encoding    | ⚠ mojibake | set `PYTHONIOENCODING=utf-8` on spawn       |
| HR info detection          | ⚠ noisy    | optional: lower log severity for promoted posts |

---

## 7. Recommended fixes, in priority order

1. **(Today)** Switch the LLM provider in `.env`:
   ```
   AI_PROVIDER=gemini
   LLM_API_KEY=<your gemini key>
   LLM_MODEL=gemini-1.5-flash
   ```
   Restart uvicorn. The 429s stop immediately; skill extraction works.
2. **(Today, 1-line)** In `server/bot_controller.py:_spawn`, pass
   `env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}` to `subprocess.Popen`.
   No more `�` in Live Logs.
3. **(This week, ~10 lines)** Add `get_failed_job_ids()` parallel to
   `get_applied_job_ids()` in `runAiBot.py` and seed `rejected_jobs` from
   it at the top of `apply_to_jobs()`. Stops 50+ wasted re-attempts.
4. **(This week, regex)** Post-process `time_posted_text` with
   `re.search(r"(\d+\s+\w+\s+ago)", text)` before
   `calculate_date_posted(...)`. Fills in the Date Posted column again.
5. **(Optional)** Mongo dedupe — once you enable Atlas, the new
   `applied_jobs` collection has a unique index on `job_id` so the bot
   becomes idempotent across processes too. Migration script in
   `server/migrate_to_mongo.py` will import the existing CSV history.

If you want any of #1–4 wired in for you, say the word and I'll do them.
