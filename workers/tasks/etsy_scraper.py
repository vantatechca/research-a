import logging
import time

import httpx
from celery_app import app
from config import ETSY_QUERIES
from utils.db import log_scrape
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)


def search_etsy(query: str, limit: int = 25) -> list[dict]:
    """Search Etsy using their public search page (JSON endpoint)."""
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                "https://openapi.etsy.com/v3/application/listings/active",
                params={
                    "keywords": query,
                    "limit": limit,
                    "sort_on": "score",
                    "includes": "Images",
                },
                headers={
                    "x-api-key": "your_etsy_key",  # Replaced by env
                    "User-Agent": "PeptideBrain/1.0",
                },
            )
            if response.status_code != 200:
                # Fallback: scrape public search
                return scrape_etsy_search(query, limit)

            data = response.json()
            listings = []
            for item in data.get("results", []):
                listings.append({
                    "title": item.get("title", ""),
                    "price": f"${item.get('price', {}).get('amount', 0) / item.get('price', {}).get('divisor', 100):.2f}",
                    "views": item.get("views", 0),
                    "num_favorers": item.get("num_favorers", 0),
                    "url": item.get("url", ""),
                    "shop_name": item.get("shop_name", ""),
                    "description": item.get("description", "")[:300],
                    "tags": item.get("tags", [])[:10],
                })
            return listings
    except Exception as e:
        logger.error(f"Etsy API error for '{query}': {e}")
        return scrape_etsy_search(query, limit)


def scrape_etsy_search(query: str, limit: int = 25) -> list[dict]:
    """Fallback: scrape Etsy search results page."""
    try:
        from bs4 import BeautifulSoup

        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(
                f"https://www.etsy.com/search",
                params={"q": query, "ref": "search_bar"},
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            )
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "lxml")

            listings = []
            for card in soup.select("[data-listing-id]")[:limit]:
                title_el = card.select_one("h3") or card.select_one(".v2-listing-card__title")
                price_el = card.select_one(".currency-value") or card.select_one("span.currency-value")

                title = title_el.get_text(strip=True) if title_el else ""
                price = price_el.get_text(strip=True) if price_el else ""
                listing_id = card.get("data-listing-id", "")

                if title:
                    listings.append({
                        "title": title,
                        "price": f"${price}" if price else "N/A",
                        "url": f"https://www.etsy.com/listing/{listing_id}",
                        "shop_name": "",
                        "description": "",
                        "tags": [],
                    })
            return listings
    except Exception as e:
        logger.error(f"Etsy scrape error for '{query}': {e}")
        return []


@app.task(name="tasks.etsy_scraper.scrape_etsy", bind=True, max_retries=2)
def scrape_etsy(self):
    logger.info("Starting Etsy scrape...")
    all_listings = []

    for query in ETSY_QUERIES:
        listings = search_etsy(query)
        for listing in listings:
            listing["search_query"] = query
        all_listings.extend(listings)
        time.sleep(3)

    if not all_listings:
        log_scrape("etsy", None, 0, 0, "completed")
        return {"results": 0}

    # Deduplicate by title
    seen = set()
    unique = []
    for l in all_listings:
        if l["title"] not in seen:
            seen.add(l["title"])
            unique.append(l)

    batch_text = "\n\n---\n\n".join(
        f"Product: {l['title']}\nPrice: {l['price']}\nShop: {l.get('shop_name', 'N/A')}\n"
        f"Description: {l.get('description', '')[:200]}\n"
        f"Tags: {', '.join(l.get('tags', []))}\nURL: {l['url']}\n"
        f"Search Query: {l.get('search_query', '')}"
        for l in unique[:40]
    )

    source_links = [{"url": l["url"], "title": l["title"], "sourceType": "etsy"} for l in unique[:40]]

    process_raw_content.delay(
        content=f"Etsy Competitor Analysis - {len(unique)} products found:\n\n{batch_text}",
        source="etsy",
        source_links=source_links,
        metadata={"total_listings": len(unique), "queries": ETSY_QUERIES},
    )

    # Update competitor counts for existing ideas
    from utils.db import get_connection
    with get_connection() as conn:
        with conn.cursor() as cur:
            for query in ETSY_QUERIES:
                count = sum(1 for l in unique if l.get("search_query") == query)
                prices = [float(l["price"].replace("$", "").replace(",", "")) for l in unique
                         if l.get("search_query") == query and l["price"] != "N/A"]
                avg_price = sum(prices) / len(prices) if prices else None

                cur.execute(
                    """
                    UPDATE ideas SET etsy_competitor_count = %s, etsy_avg_price = %s, last_data_refresh = NOW()
                    WHERE LOWER(title) LIKE %s OR LOWER(summary) LIKE %s
                    """,
                    (count, avg_price, f"%{query.lower()}%", f"%{query.lower()}%"),
                )

    log_scrape("etsy", None, len(unique), 1, "completed")
    logger.info(f"Etsy scrape complete: {len(unique)} products")
    return {"results": len(unique)}
