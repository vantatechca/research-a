import hmac
import logging
import os

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

app = FastAPI(title="PeptideBrain Workers API")

# CORS — only the Next.js frontend talks to this API in browsers. We don't
# need to allow random origins. The Authorization header has to be in the
# allow-list explicitly because it's a non-simple header.
#
# Render injects FRONTEND_URL at runtime (set it in the dashboard) so prod
# requests pass CORS. localhost:3000 is for local dev.
_allowed_origins = [
    "http://localhost:3000",
]
_frontend_url = os.getenv("FRONTEND_URL")
if _frontend_url:
    _allowed_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ─── Auth dependency ────────────────────────────────────────────────────────
#
# Bearer-token check on every protected route. Token comes from the
# WORKER_API_TOKEN env var, which MUST match the same env var on the Next.js
# service (otherwise /api/scrape/trigger calls fail with 401).
#
# /health is intentionally NOT protected — Render's uptime check needs to hit
# it without credentials.

def require_worker_token(
    authorization: str | None = Header(default=None),
) -> None:
    expected = os.getenv("WORKER_API_TOKEN")
    if not expected:
        # Fail closed: if the operator hasn't configured a token, refuse the
        # request rather than serving an unauthenticated API. Logging this
        # makes the misconfiguration easy to spot in Render's log stream.
        logger.error("WORKER_API_TOKEN is not set; refusing all auth-required requests")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server is missing WORKER_API_TOKEN",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    presented = authorization[len("Bearer ") :].strip()

    # Constant-time compare — protects against timing oracles even though the
    # token is high-entropy. Cheap enough at this request rate.
    if not hmac.compare_digest(presented.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


class TriggerRequest(BaseModel):
    source: str
    query: str | None = None


# ─── Routes ─────────────────────────────────────────────────────────────────


@app.get("/health")
def health():
    """
    Public — no auth. Render's uptime monitor hits this; we don't want to
    burn alerts on auth failures from monitoring.
    """
    return {"status": "ok"}


@app.post("/trigger", dependencies=[Depends(require_worker_token)])
def trigger_scrape(req: TriggerRequest):
    from tasks.reddit_scraper import scrape_reddit
    from tasks.google_trends import scrape_google_trends
    from tasks.youtube_scraper import scrape_youtube
    from tasks.etsy_scraper import scrape_etsy
    from tasks.whop_scraper import scrape_whop
    from tasks.bhw_scraper import scrape_bhw
    from tasks.rss_aggregator import scrape_rss
    from tasks.web_researcher import scrape_web

    task_map = {
        "reddit": scrape_reddit,
        "google_trends": scrape_google_trends,
        "youtube": scrape_youtube,
        "etsy": scrape_etsy,
        "whop": scrape_whop,
        "bhw": scrape_bhw,
        "rss": scrape_rss,
        "web": scrape_web,
    }

    task = task_map.get(req.source)
    if not task:
        raise HTTPException(status_code=400, detail=f"Unknown source: {req.source}")

    result = task.delay()
    return {"task_id": result.id, "source": req.source, "status": "queued"}


@app.get("/status/{task_id}", dependencies=[Depends(require_worker_token)])
def task_status(task_id: str):
    from celery.result import AsyncResult
    from celery_app import app as celery_app

    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }