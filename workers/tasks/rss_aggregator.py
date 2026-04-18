import logging
import hashlib
from datetime import datetime

import feedparser
from celery_app import app
from config import RSS_FEEDS, PEPTIDE_COMPOUNDS
from utils.db import log_scrape
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)


def fetch_feed(feed_config: dict) -> list[dict]:
    try:
        feed = feedparser.parse(feed_config["url"])
        articles = []

        for entry in feed.entries[:20]:
            title = entry.get("title", "")
            summary = entry.get("summary", entry.get("description", ""))[:1000]
            link = entry.get("link", "")
            published = entry.get("published", "")

            # Basic relevance check
            text = (title + " " + summary).lower()
            is_relevant = any(
                kw.lower() in text
                for kw in ["peptide", "semaglutide", "tirzepatide", "GLP-1", "biohacking",
                           "supplement", "reconstitution", "dosing"] + PEPTIDE_COMPOUNDS[:10]
            )

            articles.append({
                "title": title,
                "summary": summary,
                "url": link,
                "published": published,
                "source_name": feed_config["name"],
                "source_type": feed_config.get("type", "news"),
                "is_relevant": is_relevant,
            })
        return articles
    except Exception as e:
        logger.error(f"RSS feed error for {feed_config['name']}: {e}")
        return []


@app.task(name="tasks.rss_aggregator.scrape_rss", bind=True, max_retries=2)
def scrape_rss(self):
    logger.info("Starting RSS aggregation...")
    all_articles = []

    for feed_config in RSS_FEEDS:
        articles = fetch_feed(feed_config)
        all_articles.extend(articles)

    if not all_articles:
        log_scrape("rss", None, 0, 0, "completed")
        return {"results": 0}

    # Filter relevant articles
    relevant = [a for a in all_articles if a["is_relevant"]]

    if not relevant:
        log_scrape("rss", None, len(all_articles), 0, "completed")
        return {"results": len(all_articles), "relevant": 0}

    # Deduplicate by title hash
    seen = set()
    unique = []
    for a in relevant:
        h = hashlib.md5(a["title"].lower().encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            unique.append(a)

    # Separate news from research
    news = [a for a in unique if a["source_type"] == "news"]
    research = [a for a in unique if a["source_type"] == "research"]

    # Process news
    if news:
        batch_text = "\n\n---\n\n".join(
            f"[{a['source_name']}] {a['title']}\n{a['summary'][:300]}\n"
            f"Published: {a['published']}\nURL: {a['url']}"
            for a in news[:15]
        )
        source_links = [{"url": a["url"], "title": a["title"], "sourceType": "news"} for a in news[:15]]

        process_raw_content.delay(
            content=f"Peptide Industry News - {len(news)} articles:\n\n{batch_text}",
            source="rss",
            source_links=source_links,
            metadata={"type": "news", "count": len(news)},
        )

    # Process research
    if research:
        batch_text = "\n\n---\n\n".join(
            f"[{a['source_name']}] {a['title']}\n{a['summary'][:300]}\nURL: {a['url']}"
            for a in research[:10]
        )
        source_links = [{"url": a["url"], "title": a["title"], "sourceType": "research"} for a in research[:10]]

        process_raw_content.delay(
            content=f"Peptide Research Papers - {len(research)} papers:\n\n{batch_text}",
            source="rss",
            source_links=source_links,
            metadata={"type": "research", "count": len(research)},
        )

    log_scrape("rss", None, len(all_articles), len(unique), "completed")
    logger.info(f"RSS scrape complete: {len(all_articles)} articles, {len(unique)} relevant")
    return {"results": len(all_articles), "relevant": len(unique)}
