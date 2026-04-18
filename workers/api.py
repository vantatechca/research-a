from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PeptideBrain Workers API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TriggerRequest(BaseModel):
    source: str
    query: str | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/trigger")
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


@app.get("/status/{task_id}")
def task_status(task_id: str):
    from celery.result import AsyncResult
    from celery_app import app as celery_app

    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }
