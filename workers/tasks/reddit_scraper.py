import logging
import time
import hashlib

import httpx
from celery_app import app
from config import SUBREDDITS, PEPTIDE_COMPOUNDS
from utils.db import log_scrape
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)

USER_AGENT = "PeptideBrain/1.0 (Research Bot)"


def fetch_subreddit(subreddit: str, query: str = "peptide", limit: int = 100) -> list[dict]:
    url = f"https://www.reddit.com/r/{subreddit}/search.json"
    params = {"q": query, "sort": "new", "limit": limit, "restrict_sr": "on", "t": "week"}
    headers = {"User-Agent": USER_AGENT}

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(url, params=params, headers=headers)
            if response.status_code == 429:
                logger.warning(f"Rate limited on r/{subreddit}, sleeping 60s")
                time.sleep(60)
                return []
            response.raise_for_status()
            data = response.json()

        posts = []
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            posts.append({
                "title": post.get("title", ""),
                "selftext": post.get("selftext", "")[:2000],
                "score": post.get("score", 0),
                "num_comments": post.get("num_comments", 0),
                "upvote_ratio": post.get("upvote_ratio", 0),
                "subreddit": subreddit,
                "permalink": f"https://reddit.com{post.get('permalink', '')}",
                "created_utc": post.get("created_utc", 0),
                "is_question": post.get("link_flair_text", "").lower() in ["question", "help", "advice"]
                    or "?" in post.get("title", ""),
            })
        return posts
    except Exception as e:
        logger.error(f"Error fetching r/{subreddit}: {e}")
        return []


@app.task(name="tasks.reddit_scraper.scrape_reddit", bind=True, max_retries=2)
def scrape_reddit(self):
    logger.info("Starting Reddit scrape...")
    all_posts = []
    total_results = 0

    for subreddit in SUBREDDITS:
        posts = fetch_subreddit(subreddit)
        all_posts.extend(posts)
        total_results += len(posts)
        time.sleep(2)  # Rate limit respect

    if not all_posts:
        log_scrape("reddit", None, 0, 0, "completed")
        return {"results": 0, "ideas": 0}

    # Deduplicate by title hash
    seen = set()
    unique_posts = []
    for post in all_posts:
        title_hash = hashlib.md5(post["title"].lower().encode()).hexdigest()
        if title_hash not in seen:
            seen.add(title_hash)
            unique_posts.append(post)

    # Batch posts into chunks for AI processing
    batch_size = 20
    ideas_generated = 0

    for i in range(0, len(unique_posts), batch_size):
        batch = unique_posts[i : i + batch_size]
        batch_text = "\n\n---\n\n".join(
            f"[r/{p['subreddit']}] {p['title']}\n{p['selftext'][:500]}\n"
            f"Score: {p['score']} | Comments: {p['num_comments']} | Question: {p['is_question']}\n"
            f"Link: {p['permalink']}"
            for p in batch
        )

        source_links = [{"url": p["permalink"], "title": p["title"], "sourceType": "reddit"} for p in batch]

        count = process_raw_content.delay(
            content=batch_text,
            source="reddit",
            source_links=source_links,
            metadata={"subreddits": list(set(p["subreddit"] for p in batch))},
        )
        ideas_generated += 1  # Track batches sent

    log_scrape("reddit", None, total_results, ideas_generated, "completed")
    logger.info(f"Reddit scrape complete: {total_results} posts, {ideas_generated} batches sent to pipeline")
    return {"results": total_results, "batches_sent": ideas_generated}
