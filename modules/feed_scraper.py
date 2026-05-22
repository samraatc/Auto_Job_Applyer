"""
LinkedIn company-feed hiring-post scraper.

For each company in config/companies.py:target_companies, opens
linkedin.com/company/<slug>/posts/, scrolls N times, extracts visible post text,
and classifies each post with the configured LLM as hiring / not-hiring.
Hits are persisted to all excels/feed_hiring_posts.csv.

Can be run standalone (python -m modules.feed_scraper) or invoked from the
admin dashboard. Supports --dry-run (classify but do not write).
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime
from typing import Optional

# Make project root importable when run as `python modules/feed_scraper.py`
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from config.companies import target_companies
from config.search import search_terms
from config.secrets import use_AI, ai_provider
from config.settings import file_name as applied_csv_path  # not strictly needed, kept for parity

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUTPUT_CSV = os.path.join(PROJECT_ROOT, "all excels", "feed_jobs.csv")
SCROLL_PAUSE = 1.6
MAX_SCROLLS = 8
MAX_POSTS_PER_COMPANY = 30
MAX_POSTS_KEYWORD_SCAN = 60          # cap per keyword to avoid runaway scrolls

# Column order matches the original spec. Two new optional columns —
# Author Name and Author URL — let the LinkedIn Posts tab show a "Contact"
# link for keyword-search hits where the author is the person hiring.
CSV_FIELDS = [
    "Source", "Company", "Posted At", "Title", "Location",
    "Apply URL", "Post URL", "Confidence", "Classified At",
    "Matched Role", "Post Excerpt",
    "Author Name", "Author URL",
]


def _ensure_csv() -> None:
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    if not os.path.exists(OUTPUT_CSV):
        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=CSV_FIELDS).writeheader()


def _existing_post_urls() -> set[str]:
    if not os.path.exists(OUTPUT_CSV):
        return set()
    with open(OUTPUT_CSV, "r", encoding="utf-8") as f:
        return {row.get("Post URL", "") for row in csv.DictReader(f)}


def _company_posts_url(entry: dict) -> str:
    url = entry.get("linkedin_url", "").rstrip("/")
    if not url:
        return ""
    if "/company/" not in url:
        return url
    if url.endswith("/posts"):
        return url + "/"
    return url + "/posts/"


def _scroll_and_collect(driver, max_scrolls: int = MAX_SCROLLS) -> list:
    seen = set()
    posts = []
    for _ in range(max_scrolls):
        try:
            cards = driver.find_elements(By.CSS_SELECTOR, "div.feed-shared-update-v2, div.update-components-update-v2")
        except Exception:
            cards = []
        for card in cards:
            try:
                key = card.get_attribute("data-urn") or card.id
            except Exception:
                key = id(card)
            if key in seen:
                continue
            seen.add(key)
            try:
                text = card.text.strip()
            except Exception:
                text = ""
            permalink = ""
            try:
                anchor = card.find_element(By.CSS_SELECTOR, "a[href*='/feed/update/']")
                permalink = anchor.get_attribute("href") or ""
            except Exception:
                pass
            # Best-effort relative-time string (e.g. "2d", "3 hours ago"). LinkedIn's
            # post header carries it as either a <time> element or inside the
            # actor sub-description span. Either selector can fail when LinkedIn
            # tweaks markup; we swallow the exception and keep going.
            posted_at = ""
            try:
                time_el = card.find_element(
                    By.CSS_SELECTOR,
                    "time, .update-components-actor__sub-description span, "
                    ".update-components-actor__sub-description, "
                    "span.feed-shared-actor__sub-description span"
                )
                posted_at = (time_el.get_attribute("datetime") or time_el.text or "").strip()
            except Exception:
                pass
            if text:
                posts.append({"text": text, "permalink": permalink, "posted_at": posted_at})
            if len(posts) >= MAX_POSTS_PER_COMPANY:
                return posts
        driver.find_element(By.TAG_NAME, "body").send_keys(Keys.PAGE_DOWN)
        time.sleep(SCROLL_PAUSE)
    return posts


def _extract_author(card) -> tuple[str, str]:
    """
    Pull the post author's display name and profile URL from a LinkedIn
    content-search card. LinkedIn ships several markup variants — try each
    and take the first that yields a non-empty name + href.
    """
    name = ""
    href = ""
    selectors = [
        # Actor block — used both in feed and content search.
        ("a.update-components-actor__meta-link", "span.update-components-actor__title span"),
        ("a.app-aware-link[href*='/in/']", "span"),
        ("a[href*='/in/']", "span"),
    ]
    for link_sel, name_sel in selectors:
        try:
            link_el = card.find_element(By.CSS_SELECTOR, link_sel)
            href = link_el.get_attribute("href") or ""
            try:
                name = (link_el.find_element(By.CSS_SELECTOR, name_sel).text or "").strip()
            except Exception:
                name = (link_el.text or "").strip()
            if href:
                break
        except Exception:
            continue
    # Trim LinkedIn's tracking query params.
    if href and "?" in href:
        href = href.split("?", 1)[0]
    return name, href


def _keyword_search_url(keywords: str, sort_by: str = "date_posted") -> str:
    """
    Build a LinkedIn content-search URL. `keywords` is a free-text query —
    spaces become %20. sortBy="date_posted" puts newest first; the other
    valid value is "relevance".
    """
    from urllib.parse import quote_plus
    base = "https://www.linkedin.com/search/results/content/"
    return f"{base}?keywords={quote_plus(keywords)}&sortBy=%22{sort_by}%22&origin=GLOBAL_SEARCH_HEADER"


def _collect_keyword_posts(driver, max_scrolls: int = MAX_SCROLLS, cap: int = MAX_POSTS_KEYWORD_SCAN) -> list:
    """
    Scroll the current LinkedIn content-search results page and pull every
    visible post card. Returns a list of dicts with text, permalink,
    posted_at, author_name, author_url.
    """
    seen = set()
    posts: list[dict] = []
    for _ in range(max_scrolls):
        try:
            cards = driver.find_elements(By.CSS_SELECTOR, "div.feed-shared-update-v2, div.update-components-update-v2")
        except Exception:
            cards = []
        for card in cards:
            try:
                key = card.get_attribute("data-urn") or card.id
            except Exception:
                key = id(card)
            if key in seen:
                continue
            seen.add(key)
            try:
                text = card.text.strip()
            except Exception:
                text = ""
            permalink = ""
            try:
                anchor = card.find_element(By.CSS_SELECTOR, "a[href*='/feed/update/']")
                permalink = anchor.get_attribute("href") or ""
            except Exception:
                pass
            posted_at = ""
            try:
                time_el = card.find_element(
                    By.CSS_SELECTOR,
                    "time, .update-components-actor__sub-description span"
                )
                posted_at = (time_el.get_attribute("datetime") or time_el.text or "").strip()
            except Exception:
                pass
            author_name, author_url = _extract_author(card)
            if text:
                posts.append({
                    "text": text,
                    "permalink": permalink,
                    "posted_at": posted_at,
                    "author_name": author_name,
                    "author_url": author_url,
                })
            if len(posts) >= cap:
                return posts
        driver.find_element(By.TAG_NAME, "body").send_keys(Keys.PAGE_DOWN)
        time.sleep(SCROLL_PAUSE)
    return posts


def scan_by_keyword(driver, keywords: str, roles: list[str], dry_run: bool = False) -> list[dict]:
    """
    LinkedIn-wide post search by free-text keyword (default usage: "hiring",
    or a combined query like "hiring devops engineer"). Each result becomes
    a CSV row with Source="linkedin_keyword:<keywords>" and includes the
    author name + profile URL so the user has someone to message.
    """
    url = _keyword_search_url(keywords)
    print(f"[feed_scraper] keyword scan -> {url}")
    driver.get(url)
    time.sleep(3.5)
    posts = _collect_keyword_posts(driver)
    print(f"[feed_scraper]   collected {len(posts)} posts for '{keywords}'")

    existing = _existing_post_urls() if not dry_run else set()
    hits = []
    for p in posts:
        if p["permalink"] and p["permalink"] in existing:
            continue
        cls = _heuristic_classify(p["text"], roles)
        # When the search keyword itself is hiring-related, treat any post
        # surfaced by LinkedIn as a candidate — the search already pre-filtered.
        if not cls.get("is_hiring") and "hir" in keywords.lower():
            cls["is_hiring"] = True
            cls["confidence"] = max(cls.get("confidence") or 0, 0.4)
        if not cls.get("is_hiring"):
            continue
        now = datetime.utcnow().isoformat() + "Z"
        hits.append({
            "Source": f"linkedin_keyword:{keywords}",
            "Company": "",  # author may be a recruiter at any company
            "Posted At": p.get("posted_at", ""),
            "Title": cls.get("title") or "",
            "Location": cls.get("location") or "",
            "Apply URL": cls.get("apply_url") or "",
            "Post URL": p["permalink"],
            "Confidence": cls.get("confidence") or 0,
            "Classified At": now,
            "Matched Role": cls.get("matched_role") or "",
            "Post Excerpt": p["text"][:280].replace("\n", " "),
            "Author Name": p.get("author_name", ""),
            "Author URL": p.get("author_url", ""),
        })
    print(f"[feed_scraper]   {len(hits)} hiring candidates for '{keywords}'")
    return hits


HIRING_REGEX = re.compile(
    r"\b(we'?re\s+hiring|now\s+hiring|hiring\s+for|open\s+role|open\s+position|"
    r"join\s+our\s+team|apply\s+now|we\s+are\s+looking\s+for|currently\s+looking|"
    r"job\s+opening|career\s+opportunit)\b",
    re.IGNORECASE,
)
URL_REGEX = re.compile(r"https?://\S+")


def _heuristic_classify(text: str, roles: list[str]) -> dict:
    lower = text.lower()
    is_hiring = bool(HIRING_REGEX.search(text))
    matched_role = next((r for r in roles if r.lower() in lower), None)
    apply_url = None
    m = URL_REGEX.search(text)
    if m:
        apply_url = m.group(0)
    return {
        "is_hiring": is_hiring,
        "title": matched_role,
        "location": None,
        "apply_url": apply_url,
        "confidence": 0.6 if is_hiring else 0.0,
        "matched_role": matched_role,
    }


def _ai_classify(text: str, roles: list[str]) -> Optional[dict]:
    """Use the configured LLM to classify a post. Returns None on failure."""
    if not use_AI:
        return None
    prompt = (
        "You are classifying a LinkedIn post. Decide if it is advertising a current job opening "
        "the reader could apply to. Reply with strict JSON only, no prose.\n\n"
        f"Roles of interest: {roles}\n\n"
        f"Post text:\n\"\"\"\n{text[:3000]}\n\"\"\"\n\n"
        "JSON schema: {\"is_hiring\": bool, \"title\": string|null, \"location\": string|null, "
        "\"apply_url\": string|null, \"confidence\": number between 0 and 1, "
        "\"matched_role\": string|null}"
    )

    raw = None
    try:
        if ai_provider in ("openai", "deepseek"):
            from modules.ai.openaiConnections import ai_create_openai_client, ai_completion
            client = ai_create_openai_client()
            response = ai_completion(client, [{"role": "user", "content": prompt}], response_format=None, stream=False)
            if isinstance(response, dict) and "content" in response:
                raw = response["content"]
            elif isinstance(response, str):
                raw = response
            else:
                raw = json.dumps(response)
        elif ai_provider == "gemini":
            from modules.ai.geminiConnections import gemini_create_client, gemini_completion
            model = gemini_create_client()
            raw = gemini_completion(model, prompt, is_json=True)
            if not isinstance(raw, str):
                raw = json.dumps(raw)
        else:
            return None
    except Exception as e:
        print(f"[feed_scraper] LLM call failed: {e}")
        return None

    try:
        cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
        return json.loads(cleaned)
    except Exception as e:
        print(f"[feed_scraper] LLM JSON parse failed: {e}")
        return None


def scan_company(driver, entry: dict, roles: list[str], dry_run: bool = False) -> list[dict]:
    url = _company_posts_url(entry)
    name = entry.get("name") or url
    if not url:
        print(f"[feed_scraper] skipping {name}: no linkedin_url")
        return []
    print(f"[feed_scraper] scanning {name} -> {url}")
    driver.get(url)
    time.sleep(3.0)
    posts = _scroll_and_collect(driver)
    print(f"[feed_scraper]   collected {len(posts)} posts")

    existing = _existing_post_urls() if not dry_run else set()
    hits = []
    for p in posts:
        if p["permalink"] and p["permalink"] in existing:
            continue
        cls = _ai_classify(p["text"], roles) or _heuristic_classify(p["text"], roles)
        if not cls.get("is_hiring"):
            continue
        now = datetime.utcnow().isoformat() + "Z"
        hit = {
            "Source": "linkedin_feed",
            "Company": name,
            "Posted At": p.get("posted_at", ""),
            "Title": cls.get("title") or "",
            "Location": cls.get("location") or "",
            "Apply URL": cls.get("apply_url") or "",
            "Post URL": p["permalink"],
            "Confidence": cls.get("confidence") or 0,
            "Classified At": now,
            "Matched Role": cls.get("matched_role") or "",
            "Post Excerpt": p["text"][:280].replace("\n", " "),
        }
        hits.append(hit)
    print(f"[feed_scraper]   {len(hits)} hiring posts")
    return hits


def write_hits(hits: list[dict]) -> None:
    # Dual-write: CSV (existing behaviour, never breaks) + Mongo via the repo.
    # The repo handles its own CSV append, so we don't double-write.
    try:
        import sys as _sys, os as _os
        _sys.path.insert(0, _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", "server")))
        from store import upsert_posts  # type: ignore
        upsert_posts(hits)
        return
    except Exception as e:
        print(f"[feed_scraper] store.upsert_posts unavailable ({e}); falling back to direct CSV write")
    # Fallback path — only runs if the repo import fails for some reason.
    _ensure_csv()
    with open(OUTPUT_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        for h in hits:
            w.writerow(h)


def list_hits(limit: int = 200) -> list[dict]:
    if not os.path.exists(OUTPUT_CSV):
        return []
    with open(OUTPUT_CSV, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    rows.sort(key=lambda r: r.get("Classified At", ""), reverse=True)
    return rows[:limit]


def run_keyword(keywords_list: list[str], dry_run: bool = False) -> None:
    """
    Run a LinkedIn content-search scan for each of `keywords_list` (e.g.
    ["hiring", "hiring devops engineer"]). Reuses the bot's existing login
    bootstrap so the user only signs in once.
    """
    if not keywords_list:
        print("[feed_scraper] no keywords given")
        return

    from modules.open_chrome import open_chrome  # lazy import — Selenium heavy
    driver, wait, actions = open_chrome()

    try:
        from runAiBot import is_logged_in_LN, login_LN
        if not is_logged_in_LN():
            login_LN()
    except Exception as e:
        print(f"[feed_scraper] login bootstrap failed: {e}")

    all_hits = []
    for kw in keywords_list:
        try:
            hits = scan_by_keyword(driver, kw, search_terms, dry_run=dry_run)
            all_hits.extend(hits)
            if not dry_run and hits:
                write_hits(hits)
        except Exception as e:
            print(f"[feed_scraper] error scanning keyword '{kw}': {e}")

    print(f"[feed_scraper] keyword scan done. total hits: {len(all_hits)} (dry_run={dry_run})")


def run(dry_run: bool = False, companies: Optional[list[dict]] = None) -> None:
    companies = companies or target_companies
    if not companies:
        print("[feed_scraper] no companies configured")
        return

    from modules.open_chrome import open_chrome  # lazy import — Selenium heavy
    driver, wait, actions = open_chrome()

    # We rely on the user already being logged in; runAiBot.login flow can be reused.
    try:
        from runAiBot import is_logged_in_LN, login_LN
        if not is_logged_in_LN():
            login_LN()
    except Exception as e:
        print(f"[feed_scraper] login bootstrap failed: {e}")

    all_hits = []
    for entry in companies:
        try:
            hits = scan_company(driver, entry, search_terms, dry_run=dry_run)
            all_hits.extend(hits)
            if not dry_run and hits:
                write_hits(hits)
        except Exception as e:
            print(f"[feed_scraper] error scanning {entry.get('name')}: {e}")

    print(f"[feed_scraper] done. total hits: {len(all_hits)} (dry_run={dry_run})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--keywords",
        nargs="*",
        default=None,
        help="LinkedIn content-search queries to scan, e.g. --keywords hiring "
             "'we are hiring devops'. If omitted, falls back to the company-feed scan.",
    )
    args = parser.parse_args()
    if args.keywords:
        run_keyword(args.keywords, dry_run=args.dry_run)
    else:
        run(dry_run=args.dry_run)
