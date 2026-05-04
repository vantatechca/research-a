import os

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://peptidebrain:peptidebrain_dev@localhost:5432/peptidebrain",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ─── AI - model + endpoint config ─────────────────────────────────────────────
# (NOT the keys; those load from utils.api_keys which checks the DB first
# then falls back to env). These constants stay here because they're plain
# config, not secrets.
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat")
EMBEDDINGS_API_URL = os.getenv("EMBEDDINGS_API_URL", "https://api.openai.com/v1")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")

# ─── External APIs (provider switch) ─────────────────────────────────────────
# Keys themselves come from api_keys loader, not env directly.
SERP_API_PROVIDER = os.getenv("SERP_API_PROVIDER", "serper")

# ─── Reddit scraper ───────────────────────────────────────────────────────────
SUBREDDITS = [
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

# Peptide compounds used for content matching across scrapers.
PEPTIDE_COMPOUNDS = [
    "BPC-157",
    "TB-500",
    "Ipamorelin",
    "MK-677",
    "Tirzepatide",
    "Semaglutide",
    "GHK-Cu",
    "CJC-1295",
    "Sermorelin",
    "Tesamorelin",
    "Melanotan",
    "Selank",
    "Cerebrolysin",
    "Epitalon",
    "AOD-9604",
    "PT-141",
    "Hexarelin",
    "GHRP-6",
    "GHRP-2",
]

# ─── YouTube scraper ──────────────────────────────────────────────────────────
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

# ─── Web research (Serper/SerpAPI/Brave) ─────────────────────────────────────
WEB_SEARCH_QUERIES = [
    "peptide research breakthrough 2024",
    "new peptide therapy clinical trial",
    "peptides for muscle growth research",
    "peptides longevity studies",
    "peptide weight loss research",
]

# ─── Etsy scraper ─────────────────────────────────────────────────────────────
ETSY_QUERIES = [
    "peptide guide",
    "peptide ebook",
    "peptide protocol",
    "peptide course",
    "peptide calculator",
]

# ─── Whop scraper ─────────────────────────────────────────────────────────────
WHOP_QUERIES = [
    "peptide community",
    "peptide course",
    "peptide coaching",
]

# ─── BHW scraper ──────────────────────────────────────────────────────────────
BHW_FORUMS = [
    "https://www.blackhatworld.com/forums/health-fitness.260/",
]

# ─── RSS feeds ────────────────────────────────────────────────────────────────
# Each feed: dict with name, url, type ("news" or "research").
RSS_FEEDS = [
    {
        "name": "Peptide Sciences",
        "url": "https://www.peptidesciences.com/blog/feed/",
        "type": "news",
    },
    {
        "name": "Examine.com",
        "url": "https://examine.com/feed/",
        "type": "research",
    },
]

# ─── Google Trends keywords ───────────────────────────────────────────────────
TRENDS_KEYWORDS_CORE = [
    "peptide",
    "peptide therapy",
    "peptides for weight loss",
    "peptides for muscle",
    "peptides for healing",
    "peptide guide",
    "peptide stack",
    "GLP-1",
    "biohacking",
    "longevity",
]

TRENDS_KEYWORDS_PRODUCTS = [
    "BPC-157",
    "TB-500",
    "Ipamorelin",
    "MK-677",
    "Tirzepatide",
    "Semaglutide",
    "Sermorelin",
    "GHK-Cu",
    "CJC-1295",
    "PT-141",
]

# ─── Celery beat schedule ─────────────────────────────────────────────────────
# Interval (in seconds) per scraper. These exact keys are referenced by
# celery_app.py beat_schedule; renaming any of them will break the
# scheduler at startup.
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