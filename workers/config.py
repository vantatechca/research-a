import os

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://peptidebrain:peptidebrain_dev@localhost:5432/peptidebrain")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# AI
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat")
EMBEDDINGS_API_KEY = os.getenv("EMBEDDINGS_API_KEY", "")
EMBEDDINGS_API_URL = os.getenv("EMBEDDINGS_API_URL", "https://api.openai.com/v1")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")

# External APIs
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
SERP_API_KEY = os.getenv("SERP_API_KEY", "")
SERP_API_PROVIDER = os.getenv("SERP_API_PROVIDER", "serper")
ETSY_API_KEY = os.getenv("ETSY_API_KEY", "")

# Subreddits to monitor
SUBREDDITS = [
    "peptides", "Semaglutide", "Tirzepatide",
    "moreplatesmoredates", "Biohackers", "StackAdvice",
    "HGH", "steroids", "longevity", "Nootropics",
    "DigitalProducts", "EtsySellers", "passive_income",
]

# Peptide compounds to track
PEPTIDE_COMPOUNDS = [
    "BPC-157", "TB-500", "semaglutide", "tirzepatide", "retatrutide",
    "GLP-1", "GHK-Cu", "CJC-1295", "ipamorelin", "MK-677",
    "PT-141", "DSIP", "selank", "semax", "AOD-9604",
    "tesamorelin", "sermorelin", "hexarelin", "GHRP-6", "GHRP-2",
    "melanotan", "epitalon", "thymosin alpha-1", "LL-37", "KPV",
]

# Google Trends keywords
TRENDS_KEYWORDS_CORE = [
    "peptides", "BPC-157", "semaglutide", "tirzepatide",
    "peptide dosing", "peptide guide", "reconstitution",
    "bacteriostatic water", "peptide calculator", "GLP-1",
    "retatrutide", "TB-500", "CJC-1295", "ipamorelin",
    "MK-677", "PT-141", "GHK-Cu", "DSIP", "selank", "semax",
]

TRENDS_KEYWORDS_PRODUCTS = [
    "peptide course", "peptide ebook", "peptide tracker",
    "peptide cycle planner", "peptide stack guide",
    "peptide reconstitution guide",
]

# YouTube search queries
YOUTUBE_QUERIES = TRENDS_KEYWORDS_CORE + [
    "peptide review", "peptide results",
    "how to use peptides", "peptide for beginners",
    "semaglutide results", "peptide side effects",
]

# Etsy search queries
ETSY_QUERIES = [
    "peptide guide", "peptide ebook", "peptide tracker",
    "peptide planner", "semaglutide guide", "GLP-1 guide",
    "peptide dosing chart", "reconstitution guide",
    "peptide journal", "peptide cycle planner",
    "biohacking guide", "biohacking planner",
]

# Web search queries (rotated)
WEB_SEARCH_QUERIES = [
    "best selling peptide ebooks 2025",
    "peptide digital product launch",
    "semaglutide guide buy",
    "peptide course online",
    "peptide app tracker",
    "peptide dose calculator app",
    "peptide guide review",
    "peptide reconstitution guide buy",
    "peptide stacking guide ebook",
    "GLP-1 weight loss tracker app",
]

# RSS feeds
RSS_FEEDS = [
    {"name": "PubMed Peptides", "url": "https://pubmed.ncbi.nlm.nih.gov/rss/search/1234/?limit=20&utm_campaign=pubmed-2&fc=20231001000000", "type": "research"},
    {"name": "Google News - Peptides", "url": "https://news.google.com/rss/search?q=peptides+health", "type": "news"},
    {"name": "Google News - Semaglutide", "url": "https://news.google.com/rss/search?q=semaglutide", "type": "news"},
    {"name": "Google News - Tirzepatide", "url": "https://news.google.com/rss/search?q=tirzepatide", "type": "news"},
    {"name": "Google News - Peptide Regulation", "url": "https://news.google.com/rss/search?q=peptide+regulation", "type": "news"},
]

# Idea categories
IDEA_CATEGORIES = [
    "ebook", "course", "template", "calculator",
    "app", "membership", "printable", "ai_tool",
]

# Schedules (in seconds)
SCHEDULES = {
    "reddit": 2 * 3600,        # Every 2 hours
    "google_trends": 12 * 3600, # Every 12 hours
    "youtube": 6 * 3600,        # Every 6 hours
    "etsy": 24 * 3600,          # Every 24 hours
    "whop": 24 * 3600,          # Every 24 hours
    "bhw": 6 * 3600,            # Every 6 hours
    "rss_news": 1 * 3600,       # Every 1 hour
    "rss_research": 4 * 3600,   # Every 4 hours
    "web_search": 4 * 3600,     # Every 4 hours
}
