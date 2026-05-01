import json
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from config import DATABASE_URL

psycopg2.extras.register_uuid()


@contextmanager
def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def insert_idea(idea_data: dict) -> str | None:
    """Insert an idea row.

    Returns the new UUID on success, or None when the row was skipped due to a
    slug conflict (ON CONFLICT DO NOTHING). Previously returned a fresh UUID
    even on conflict, making callers think an insert happened when it hadn't.
    """
    idea_id = str(uuid.uuid4())
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ideas (
                    id, title, slug, summary, detailed_analysis, category, subcategory,
                    peptide_topics, status, priority_score, confidence_score,
                    google_trends_score, google_trends_direction,
                    reddit_mention_count, reddit_question_count,
                    youtube_video_count, youtube_avg_views,
                    forum_mention_count, etsy_competitor_count, etsy_avg_price,
                    etsy_avg_reviews, whop_competitor_count, search_volume_monthly,
                    existing_products, competitor_analysis, differentiation_notes,
                    estimated_price_range, estimated_monthly_revenue,
                    effort_to_build, time_to_build,
                    source_links, discovery_source
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s,
                    %s, %s
                )
                ON CONFLICT (slug) DO NOTHING
                RETURNING id
                """,
                (
                    idea_id,
                    idea_data.get("title", ""),
                    idea_data.get("slug", ""),
                    idea_data.get("summary", ""),
                    idea_data.get("detailed_analysis"),
                    idea_data.get("category", "ebook"),
                    idea_data.get("subcategory"),
                    idea_data.get("peptide_topics", []),
                    "pending",
                    idea_data.get("priority_score", 0),
                    idea_data.get("confidence_score", 0),
                    idea_data.get("google_trends_score"),
                    idea_data.get("google_trends_direction"),
                    idea_data.get("reddit_mention_count", 0),
                    idea_data.get("reddit_question_count", 0),
                    idea_data.get("youtube_video_count", 0),
                    idea_data.get("youtube_avg_views", 0),
                    idea_data.get("forum_mention_count", 0),
                    idea_data.get("etsy_competitor_count", 0),
                    idea_data.get("etsy_avg_price"),
                    idea_data.get("etsy_avg_reviews"),
                    idea_data.get("whop_competitor_count", 0),
                    idea_data.get("search_volume_monthly"),
                    json.dumps(idea_data.get("existing_products", [])),
                    idea_data.get("competitor_analysis"),
                    idea_data.get("differentiation_notes"),
                    idea_data.get("estimated_price_range"),
                    idea_data.get("estimated_monthly_revenue"),
                    idea_data.get("effort_to_build"),
                    idea_data.get("time_to_build"),
                    json.dumps(idea_data.get("source_links", [])),
                    idea_data.get("discovery_source"),
                ),
            )
            result = cur.fetchone()
            return result[0] if result else None


def log_scrape(source: str, query: str | None, results_count: int, ideas_generated: int, status: str = "completed", error_message: str | None = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scrape_logs (id, source, query, results_count, ideas_generated, status, error_message, completed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (str(uuid.uuid4()), source, query, results_count, ideas_generated, status, error_message, datetime.now(timezone.utc) if status != "running" else None),
            )


def check_duplicate_slug(slug: str) -> bool:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM ideas WHERE slug = %s", (slug,))
            return cur.fetchone() is not None


def get_brain_memories(memory_type: str | None = None, active_only: bool = True) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = "SELECT * FROM brain_memory WHERE 1=1"
            params: list = []
            if memory_type:
                query += " AND memory_type = %s"
                params.append(memory_type)
            if active_only:
                query += " AND active = true"
            query += " ORDER BY importance DESC, created_at DESC"
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]


def insert_brain_memory(memory_type: str, content: str, source: str, importance: float = 0.5, related_idea_ids: list | None = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO brain_memory (id, memory_type, content, source, importance, related_idea_ids)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (str(uuid.uuid4()), memory_type, content, source, importance, related_idea_ids or []),
            )
