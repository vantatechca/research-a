from celery import Celery
from celery.schedules import crontab
from config import REDIS_URL, SCHEDULES, BEAT_TIMEZONE

app = Celery("peptidebrain", broker=REDIS_URL, backend=REDIS_URL)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

app.conf.beat_schedule = {
    "scrape-reddit": {
        "task": "tasks.reddit_scraper.scrape_reddit",
        "schedule": SCHEDULES["reddit"],
    },
    "scrape-google-trends": {
        "task": "tasks.google_trends.scrape_google_trends",
        "schedule": SCHEDULES["google_trends"],
    },
    "scrape-youtube": {
        "task": "tasks.youtube_scraper.scrape_youtube",
        "schedule": SCHEDULES["youtube"],
    },
    "scrape-etsy": {
        "task": "tasks.etsy_scraper.scrape_etsy",
        "schedule": SCHEDULES["etsy"],
    },
    "scrape-whop": {
        "task": "tasks.whop_scraper.scrape_whop",
        "schedule": SCHEDULES["whop"],
    },
    "scrape-bhw": {
        "task": "tasks.bhw_scraper.scrape_bhw",
        "schedule": SCHEDULES["bhw"],
    },
    "scrape-rss": {
        "task": "tasks.rss_aggregator.scrape_rss",
        "schedule": SCHEDULES["rss_news"],
    },
    "scrape-web": {
        "task": "tasks.web_researcher.scrape_web",
        "schedule": SCHEDULES["web_search"],
    },
}

from tasks import (
       reddit_scraper,
       google_trends,
       youtube_scraper,
       etsy_scraper,
       whop_scraper,
       bhw_scraper,
       rss_aggregator,
       web_researcher,
       idea_pipeline,
   )
