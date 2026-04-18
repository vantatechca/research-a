import logging
import time

import httpx
from bs4 import BeautifulSoup
from celery_app import app
from utils.db import log_scrape
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)

WHOP_CATEGORIES = [
    "https://whop.com/categories/health-fitness/",
    "https://whop.com/categories/education/",
]

WHOP_SEARCH_TERMS = [
    "peptide", "semaglutide", "biohacking", "supplements",
    "health guide", "fitness protocol", "weight loss",
]


def scrape_whop_page(url: str) -> list[dict]:
    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            )
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "lxml")

            products = []
            for card in soup.select("[class*='product'], [class*='listing'], [class*='card']")[:20]:
                title_el = card.select_one("h2, h3, [class*='title'], [class*='name']")
                price_el = card.select_one("[class*='price']")
                desc_el = card.select_one("[class*='description'], p")
                link_el = card.select_one("a[href]")

                title = title_el.get_text(strip=True) if title_el else ""
                if not title:
                    continue

                products.append({
                    "title": title,
                    "price": price_el.get_text(strip=True) if price_el else "N/A",
                    "description": desc_el.get_text(strip=True)[:300] if desc_el else "",
                    "url": link_el["href"] if link_el and link_el.get("href", "").startswith("http") else url,
                })
            return products
    except Exception as e:
        logger.error(f"Whop scrape error for {url}: {e}")
        return []


@app.task(name="tasks.whop_scraper.scrape_whop", bind=True, max_retries=2)
def scrape_whop(self):
    logger.info("Starting Whop scrape...")
    all_products = []

    for url in WHOP_CATEGORIES:
        products = scrape_whop_page(url)
        all_products.extend(products)
        time.sleep(3)

    for term in WHOP_SEARCH_TERMS:
        products = scrape_whop_page(f"https://whop.com/search/?q={term}")
        all_products.extend(products)
        time.sleep(3)

    if not all_products:
        log_scrape("whop", None, 0, 0, "completed")
        return {"results": 0}

    # Deduplicate
    seen = set()
    unique = []
    for p in all_products:
        if p["title"] not in seen:
            seen.add(p["title"])
            unique.append(p)

    batch_text = "\n\n---\n\n".join(
        f"Product: {p['title']}\nPrice: {p['price']}\n"
        f"Description: {p['description']}\nURL: {p['url']}"
        for p in unique[:30]
    )

    source_links = [{"url": p["url"], "title": p["title"], "sourceType": "whop"} for p in unique[:30]]

    process_raw_content.delay(
        content=f"Whop.com Competitor Analysis - {len(unique)} products found:\n\n{batch_text}",
        source="whop",
        source_links=source_links,
        metadata={"total_products": len(unique)},
    )

    log_scrape("whop", None, len(unique), 1, "completed")
    logger.info(f"Whop scrape complete: {len(unique)} products")
    return {"results": len(unique)}
