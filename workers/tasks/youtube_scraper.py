import logging
import time

import httpx
from celery_app import app
from config import YOUTUBE_API_KEY, YOUTUBE_QUERIES
from utils.db import log_scrape
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)


def search_youtube_api(query: str, max_results: int = 10) -> list[dict]:
    if not YOUTUBE_API_KEY:
        logger.warning("No YouTube API key configured")
        return []

    try:
        with httpx.Client(timeout=15.0) as client:
            # Search
            search_resp = client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "maxResults": max_results,
                    "order": "date",
                    "publishedAfter": "2024-01-01T00:00:00Z",
                    "key": YOUTUBE_API_KEY,
                },
            )
            search_resp.raise_for_status()
            search_data = search_resp.json()

            video_ids = [item["id"]["videoId"] for item in search_data.get("items", []) if "videoId" in item.get("id", {})]
            if not video_ids:
                return []

            # Get video details
            stats_resp = client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "part": "statistics,snippet,contentDetails",
                    "id": ",".join(video_ids),
                    "key": YOUTUBE_API_KEY,
                },
            )
            stats_resp.raise_for_status()
            stats_data = stats_resp.json()

            videos = []
            for item in stats_data.get("items", []):
                stats = item.get("statistics", {})
                snippet = item.get("snippet", {})
                videos.append({
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", "")[:500],
                    "channel": snippet.get("channelTitle", ""),
                    "published_at": snippet.get("publishedAt", ""),
                    "views": int(stats.get("viewCount", 0)),
                    "likes": int(stats.get("likeCount", 0)),
                    "comments": int(stats.get("commentCount", 0)),
                    "url": f"https://youtube.com/watch?v={item['id']}",
                    "tags": snippet.get("tags", [])[:10],
                })
            return videos

    except Exception as e:
        logger.error(f"YouTube API error for '{query}': {e}")
        return []


@app.task(name="tasks.youtube_scraper.scrape_youtube", bind=True, max_retries=2)
def scrape_youtube(self):
    logger.info("Starting YouTube scrape...")
    all_videos = []

    for query in YOUTUBE_QUERIES[:15]:  # Limit to save quota
        videos = search_youtube_api(query, max_results=5)
        all_videos.extend(videos)
        time.sleep(1)

    if not all_videos:
        log_scrape("youtube", None, 0, 0, "completed")
        return {"results": 0, "ideas": 0}

    # Deduplicate
    seen_titles = set()
    unique_videos = []
    for v in all_videos:
        if v["title"] not in seen_titles:
            seen_titles.add(v["title"])
            unique_videos.append(v)

    # Send to pipeline
    batch_text = "\n\n---\n\n".join(
        f"Title: {v['title']}\nChannel: {v['channel']}\n"
        f"Views: {v['views']:,} | Likes: {v['likes']:,} | Comments: {v['comments']:,}\n"
        f"Description: {v['description'][:300]}\n"
        f"Tags: {', '.join(v['tags'][:5])}\nURL: {v['url']}"
        for v in unique_videos[:30]
    )

    source_links = [{"url": v["url"], "title": v["title"], "sourceType": "youtube"} for v in unique_videos[:30]]

    process_raw_content.delay(
        content=batch_text,
        source="youtube",
        source_links=source_links,
        metadata={"total_videos": len(unique_videos)},
    )

    log_scrape("youtube", None, len(unique_videos), 1, "completed")
    logger.info(f"YouTube scrape complete: {len(unique_videos)} videos")
    return {"results": len(unique_videos)}
