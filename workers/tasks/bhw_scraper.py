import logging
import time
import random

import httpx
from bs4 import BeautifulSoup
from celery_app import app
from utils.db import log_scrape
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

BHW_SECTIONS = [
    {"name": "Making Money", "url": "https://www.blackhatworld.com/forums/making-money.50/"},
    {"name": "eBooks", "url": "https://www.blackhatworld.com/forums/ebooks-guides.48/"},
    {"name": "SEO", "url": "https://www.blackhatworld.com/forums/white-hat-seo.87/"},
]

SEARCH_TERMS = [
    "peptide", "health niche digital products", "supplement guides",
    "Etsy digital product health", "biohacking ebook",
]


def scrape_bhw_section(url: str) -> list[dict]:
    try:
        headers = {"User-Agent": random.choice(USER_AGENTS)}

        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            if response.status_code != 200:
                logger.warning(f"BHW returned {response.status_code} for {url}")
                return []

            soup = BeautifulSoup(response.text, "lxml")
            threads = []

            for thread in soup.select(".structItem--thread")[:20]:
                title_el = thread.select_one(".structItem-title a")
                stats = thread.select_one(".structItem-cell--meta")
                preview_el = thread.select_one(".structItem-snippet")

                title = title_el.get_text(strip=True) if title_el else ""
                href = title_el.get("href", "") if title_el else ""
                preview = preview_el.get_text(strip=True)[:300] if preview_el else ""

                if not title:
                    continue

                replies = "0"
                views = "0"
                if stats:
                    stat_items = stats.select("dd")
                    if len(stat_items) >= 2:
                        replies = stat_items[0].get_text(strip=True)
                        views = stat_items[1].get_text(strip=True)

                threads.append({
                    "title": title,
                    "url": f"https://www.blackhatworld.com{href}" if href.startswith("/") else href,
                    "preview": preview,
                    "replies": replies,
                    "views": views,
                })
            return threads
    except Exception as e:
        logger.error(f"BHW scrape error for {url}: {e}")
        return []


@app.task(name="tasks.bhw_scraper.scrape_bhw", bind=True, max_retries=2)
def scrape_bhw(self):
    logger.info("Starting BHW scrape...")
    all_threads = []

    for section in BHW_SECTIONS:
        threads = scrape_bhw_section(section["url"])
        for t in threads:
            t["section"] = section["name"]
        all_threads.extend(threads)
        time.sleep(random.uniform(3, 6))

    if not all_threads:
        log_scrape("bhw", None, 0, 0, "completed")
        return {"results": 0}

    # Filter for relevant threads
    keywords = ["peptide", "health", "supplement", "digital product", "ebook",
                 "guide", "etsy", "biohack", "weight loss", "making money"]
    relevant = [
        t for t in all_threads
        if any(kw in t["title"].lower() or kw in t.get("preview", "").lower() for kw in keywords)
    ]

    if not relevant:
        relevant = all_threads[:10]  # Take top threads if no keyword match

    batch_text = "\n\n---\n\n".join(
        f"[{t.get('section', 'Forum')}] {t['title']}\n{t.get('preview', '')}\n"
        f"Replies: {t['replies']} | Views: {t['views']}\nURL: {t['url']}"
        for t in relevant[:20]
    )

    source_links = [{"url": t["url"], "title": t["title"], "sourceType": "forum"} for t in relevant[:20]]

    process_raw_content.delay(
        content=f"Forum Intelligence (BHW) - {len(relevant)} relevant threads:\n\n{batch_text}",
        source="bhw",
        source_links=source_links,
        metadata={"total_threads": len(all_threads), "relevant_threads": len(relevant)},
    )

    log_scrape("bhw", None, len(all_threads), 1, "completed")
    logger.info(f"BHW scrape complete: {len(all_threads)} threads, {len(relevant)} relevant")
    return {"results": len(all_threads), "relevant": len(relevant)}
