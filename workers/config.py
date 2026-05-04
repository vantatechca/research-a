import os

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://peptidebrain:peptidebrain_dev@localhost:5432/peptidebrain")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# AI - model + endpoint config (NOT the keys; those load from utils.api_keys
# which checks the DB first then falls back to env). These constants stay
# here because they're plain config, not secrets.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat")
EMBEDDINGS_API_URL = os.getenv("EMBEDDINGS_API_URL", "https://api.openai.com/v1")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")

# External APIs (provider switch - keys themselves come from api_keys loader)
SERP_API_PROVIDER = os.getenv("SERP_API_PROVIDER", "serper")

# Scraper queries and configurations
REDDIT_SUBREDDITS = [
    "Peptides",
    "ResearchPeptides",
    "PeptidesAdvice",
    "Peptides_Discussion",
    "Nootropics",
    "BioHackers",
    "Longevity",
    "TestosteroneKickoff",
    "Steroids",
    "PeptidesAndPRPs",
    "PeptidesAUS",
    "PeptidesNutrition",
    "PeptidesGroup",
]

YOUTUBE_QUERIES = [
    "peptides explained",
    "peptide therapy results",
    "BPC-157 review",
    "TB-500 results",
    "Ipamorelin guide",
    "MK-677 transformation",
    "Tirzepatide weight loss",
    "Semaglutide review",
    "peptide stack",
    "peptide injection guide",
]

WEB_SEARCH_QUERIES = [
    "peptide research breakthrough 2024",
    "new peptide therapy clinical trial",
    "peptides for muscle growth research",
    "peptides longevity studies",
    "peptide weight loss research",
]

ETSY_QUERIES = [
    "peptide guide",
    "peptide ebook",
    "peptide protocol",
    "peptide course",
    "peptide calculator",
]

WHOP_QUERIES = [
    "peptide community",
    "peptide course",
    "peptide coaching",
]

BHW_FORUMS = [
    "https://www.blackhatworld.com/forums/health-fitness.260/",
]

RSS_FEEDS = [
    "https://www.peptidesciences.com/blog/feed/",
    "https://examine.com/feed/",
]

# Celery beat schedule — interval (in seconds) per scraper.
# These exact keys are referenced by celery_app.py beat_schedule;
# renaming any of them will break the scheduler at startup.
SCHEDULES = {
    "reddit": 10800.0,         # every 3 hours
    "google_trends": 21600.0,  # every 6 hours
    "youtube": 21600.0,        # every 6 hours
    "etsy": 86400.0,           # every 24 hours
    "whop": 86400.0,           # every 24 hours
    "bhw": 43200.0,            # every 12 hours
    "rss_news": 3600.0,        # every hour
    "web_search": 43200.0,     # every 12 hours
}

# Timezone for the Celery beat scheduler.
BEAT_TIMEZONE = os.getenv("BEAT_TIMEZONE", "UTC")