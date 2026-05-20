"""
Company auto-discovery.

Given the user's search_terms (and optionally a resume text), discover LinkedIn
company pages whose recent job postings match those roles, and return them as
{name, linkedin_url, tags} dicts that can be appended into
config/companies.py:target_companies.

Strategy:
1. Use the running Selenium browser to query LinkedIn's job search for each role.
2. From the result page, extract unique hiring company names + their /company/
   permalinks (these appear on each job card as a company link).
3. Dedupe, score by frequency across roles, return the top N.

This is intentionally search-based rather than scraping the global company
directory — it stays within the user's authenticated session and surfaces only
companies actually hiring for the configured roles.
"""
from __future__ import annotations

import os
import re
import sys
import time
from typing import Optional
from urllib.parse import quote_plus

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from selenium.webdriver.common.by import By

from config.search import search_terms, search_location

COMPANY_LINK_RE = re.compile(r"linkedin\.com/company/[A-Za-z0-9._-]+")


def _search_url(role: str, location: str) -> str:
    base = "https://www.linkedin.com/jobs/search/?keywords=" + quote_plus(role)
    if location:
        base += "&location=" + quote_plus(location)
    return base


def _collect_companies_from_results(driver, max_scrolls: int = 4) -> dict[str, str]:
    """Return {company_name: company_url} from currently loaded results page."""
    found: dict[str, str] = {}
    for _ in range(max_scrolls):
        cards = driver.find_elements(By.CSS_SELECTOR, "a.job-card-container__company-name, a.job-card-container__link, a[href*='/company/']")
        for c in cards:
            try:
                href = c.get_attribute("href") or ""
                m = COMPANY_LINK_RE.search(href)
                if not m:
                    continue
                name = (c.text or "").strip()
                if not name:
                    continue
                url = "https://www." + m.group(0).rstrip("/")
                found.setdefault(name, url)
            except Exception:
                continue
        try:
            driver.execute_script("window.scrollBy(0, 800);")
        except Exception:
            pass
        time.sleep(1.4)
    return found


def discover(roles: Optional[list[str]] = None, location: Optional[str] = None, top_n: int = 25) -> list[dict]:
    roles = roles or search_terms
    location = location if location is not None else search_location

    from modules.open_chrome import open_chrome
    driver, wait, actions = open_chrome()

    try:
        from runAiBot import is_logged_in_LN, login_LN
        if not is_logged_in_LN():
            login_LN()
    except Exception as e:
        print(f"[company_discovery] login bootstrap failed: {e}")

    scores: dict[str, dict] = {}
    for role in roles:
        url = _search_url(role, location)
        print(f"[company_discovery] querying {role!r} -> {url}")
        driver.get(url)
        time.sleep(3.0)
        found = _collect_companies_from_results(driver)
        for name, link in found.items():
            entry = scores.setdefault(name, {"name": name, "linkedin_url": link, "tags": [], "_score": 0})
            entry["_score"] += 1
            if role not in entry["tags"]:
                entry["tags"].append(role)

    ranked = sorted(scores.values(), key=lambda e: e["_score"], reverse=True)[:top_n]
    for e in ranked:
        e.pop("_score", None)
    print(f"[company_discovery] discovered {len(ranked)} companies")
    return ranked


def merge_into_config(new_entries: list[dict]) -> list[dict]:
    """Merge new entries into companies storage (Mongo via store; falls back to config/companies.py)."""
    try:
        from server.store import list_companies, replace_companies  # type: ignore
        existing = list_companies()
    except Exception:
        from config.companies import target_companies as existing  # type: ignore
        replace_companies = None  # type: ignore
        list_companies = None     # type: ignore

    seen_urls = {e.get("linkedin_url") for e in existing}
    merged = list(existing)
    for e in new_entries:
        if e.get("linkedin_url") in seen_urls:
            continue
        merged.append(e)
        seen_urls.add(e.get("linkedin_url"))

    if 'replace_companies' in locals() and replace_companies is not None:
        replace_companies(merged)
    else:
        from server.config_manager import write_config  # type: ignore
        write_config("companies.py", {"target_companies": merged})
    return merged


if __name__ == "__main__":
    new = discover()
    for e in new:
        print(f"  {e['name']:40s} {e['linkedin_url']}")
