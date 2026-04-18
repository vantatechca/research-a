import logging
import time

from celery_app import app
from config import TRENDS_KEYWORDS_CORE, TRENDS_KEYWORDS_PRODUCTS
from utils.db import log_scrape, get_connection
from tasks.idea_pipeline import process_raw_content

logger = logging.getLogger(__name__)


def fetch_trends_data(keywords: list[str]) -> list[dict]:
    results = []
    try:
        from pytrends.request import TrendReq

        pytrends = TrendReq(hl="en-US", tz=300)

        # Process in groups of 5 (Google Trends limit)
        for i in range(0, len(keywords), 5):
            batch = keywords[i : i + 5]
            try:
                pytrends.build_payload(batch, timeframe="today 3-m", geo="US")
                interest = pytrends.interest_over_time()

                if not interest.empty:
                    for kw in batch:
                        if kw in interest.columns:
                            values = interest[kw].tolist()
                            current = values[-1] if values else 0
                            avg_recent = sum(values[-4:]) / max(len(values[-4:]), 1)
                            avg_older = sum(values[:4]) / max(len(values[:4]), 1)

                            if avg_older > 0:
                                change = (avg_recent - avg_older) / avg_older
                                if change > 0.5:
                                    direction = "rising"
                                elif change > 0.1:
                                    direction = "rising"
                                elif change < -0.2:
                                    direction = "declining"
                                else:
                                    direction = "stable"
                            else:
                                direction = "stable"

                            is_breakout = change > 2.0 if avg_older > 0 else False

                            results.append({
                                "keyword": kw,
                                "score": int(current),
                                "direction": direction,
                                "is_breakout": is_breakout,
                                "values": values[-12:],  # Last 12 data points
                            })

                # Related queries
                try:
                    related = pytrends.related_queries()
                    for kw in batch:
                        if kw in related and related[kw].get("rising") is not None:
                            rising_df = related[kw]["rising"]
                            if not rising_df.empty:
                                for _, row in rising_df.head(5).iterrows():
                                    results.append({
                                        "keyword": row["query"],
                                        "score": 0,
                                        "direction": "rising",
                                        "is_breakout": "Breakout" in str(row.get("value", "")),
                                        "parent_keyword": kw,
                                        "values": [],
                                    })
                except Exception:
                    pass

                time.sleep(5)  # Rate limit respect
            except Exception as e:
                logger.error(f"Error fetching trends for {batch}: {e}")
                time.sleep(10)

    except ImportError:
        logger.error("pytrends not installed")
    except Exception as e:
        logger.error(f"Google Trends error: {e}")

    return results


@app.task(name="tasks.google_trends.scrape_google_trends", bind=True, max_retries=1)
def scrape_google_trends(self):
    logger.info("Starting Google Trends scrape...")

    all_keywords = TRENDS_KEYWORDS_CORE + TRENDS_KEYWORDS_PRODUCTS
    results = fetch_trends_data(all_keywords)

    # Update ideas table with trend scores
    from utils.db import get_connection
    with get_connection() as conn:
        with conn.cursor() as cur:
            for result in results:
                # Update any ideas that mention this keyword in peptide_topics
                cur.execute(
                    """
                    UPDATE ideas
                    SET google_trends_score = %s,
                        google_trends_direction = %s,
                        last_data_refresh = NOW()
                    WHERE %s = ANY(peptide_topics)
                       OR LOWER(title) LIKE %s
                    """,
                    (result["score"], result["direction"], result["keyword"], f"%{result['keyword'].lower()}%"),
                )

    # Check for breakout opportunities
    breakouts = [r for r in results if r.get("is_breakout")]
    if breakouts:
        breakout_text = "\n".join(
            f"BREAKOUT: '{r['keyword']}' showing >200% growth" for r in breakouts
        )
        process_raw_content.delay(
            content=f"Google Trends BREAKOUT ALERT:\n{breakout_text}\n\nThese keywords are showing explosive growth. Analyze for digital product opportunities.",
            source="google_trends",
            source_links=[],
            metadata={"type": "breakout_alert", "keywords": [r["keyword"] for r in breakouts]},
        )

    log_scrape("google_trends", None, len(results), len(breakouts), "completed")
    logger.info(f"Google Trends scrape complete: {len(results)} keywords tracked, {len(breakouts)} breakouts")
    return {"keywords_tracked": len(results), "breakouts": len(breakouts)}
