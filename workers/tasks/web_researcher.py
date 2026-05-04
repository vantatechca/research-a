import logging
import random

import httpx
from celery_app import app
from config import SERP_API_PROVIDER, WEB_SEARCH_QUERIES
from utils.api_keys import get_api_key
from utils.db import log_scrape
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)


def search_serper(query: str, num_results: int = 10) -> list[dict]:
    api_key = get_api_key("serp")
    if not api_key:
        logger.warning("No SERP API key configured")
        return []

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(
                "https://google.serper.dev/search",
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                json={"q": query, "num": num_results},
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("organic", []):
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                    "url": item.get("link", ""),
                    "position": item.get("position", 0),
                })
            return results
    except Exception as e:
        logger.error(f"Serper search error for '{query}': {e}")
        return []


def search_serpapi(query: str, num_results: int = 10) -> list[dict]:
    api_key = get_api_key("serp")
    if not api_key:
        return []

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                "https://serpapi.com/search",
                params={
                    "q": query,
                    "api_key": api_key,
                    "num": num_results,
                    "engine": "google",
                },
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("organic_results", []):
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                    "url": item.get("link", ""),
                    "position": item.get("position", 0),
                })
            return results
    except Exception as e:
        logger.error(f"SerpAPI search error for '{query}': {e}")
        return []


def search_brave(query: str, num_results: int = 10) -> list[dict]:
    api_key = get_api_key("serp")
    if not api_key:
        return []

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": num_results},
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": api_key,
                },
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("web", {}).get("results", []):
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("description", ""),
                    "url": item.get("url", ""),
                })
            return results
    except Exception as e:
        logger.error(f"Brave search error for '{query}': {e}")
        return []


@app.task(name="tasks.web_researcher.scrape_web", bind=True, max_retries=2)
def scrape_web(self):
    logger.info("Starting web research...")

    search_fn = {
        "serper": search_serper,
        "serpapi": search_serpapi,
        "brave": search_brave,
    }.get(SERP_API_PROVIDER, search_serper)

    # Rotate through queries - pick 3 random ones per run
    queries = random.sample(WEB_SEARCH_QUERIES, min(3, len(WEB_SEARCH_QUERIES)))
    all_results = []

    for query in queries:
        results = search_fn(query)
        for r in results:
            r["query"] = query
        all_results.extend(results)

    if not all_results:
        log_scrape("web", ",".join(queries), 0, 0, "completed")
        return {"results": 0}

    batch_text = "\n\n---\n\n".join(
        f"Query: {r['query']}\nTitle: {r['title']}\nSnippet: {r['snippet']}\nURL: {r['url']}"
        for r in all_results
    )

    source_links = [{"url": r["url"], "title": r["title"], "sourceType": "web"} for r in all_results]

    process_raw_content.delay(
        content=f"Web Research Results:\n\n{batch_text}",
        source="web",
        source_links=source_links,
        metadata={"queries": queries, "total_results": len(all_results)},
    )

    log_scrape("web", ",".join(queries), len(all_results), 1, "completed")
    logger.info(f"Web research complete: {len(all_results)} results for {len(queries)} queries")
    return {"results": len(all_results)}
