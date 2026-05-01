import json
import logging
import hashlib
import re

from celery_app import app
from utils.ai_client import call_cheap_model_sync, extract_json_from_response
from utils.db import insert_idea, check_duplicate_slug, get_brain_memories
from utils.embeddings import generate_embedding

logger = logging.getLogger(__name__)

RELEVANCE_PROMPT = """You are a filter for a peptide digital product research system.
Given the following content, answer ONLY "YES" or "NO":
Is this content about peptides AND does it suggest a digital product opportunity?
(People asking for help, seeking information, expressing confusion, looking for guides/tools = YES)
(Pure medical discussions with no product angle, spam, unrelated content = NO)

Content:
{content}

Answer (YES or NO):"""

EXTRACTION_PROMPT = """Given this scraped content from {source}, extract any digital product ideas for the peptide/health/wellness niche.

For each idea, provide:
- title: Clear product name/concept
- summary: 2-3 sentence description
- category: One of [ebook, course, template, calculator, app, membership, printable, ai_tool]
- peptide_topics: Which peptides or peptide categories this relates to
- target_audience: Who would buy this
- pain_point: What problem does this solve
- evidence: Why you think this would sell (reference the source data)
- effort_to_build: low/medium/high
- differentiation_angle: What would make this stand out from competitors

Return as JSON array. If no valid ideas, return empty array [].

Content:
{content}"""

SCORING_WEIGHTS = {
    "google_trends": 0.20,
    "reddit": 0.15,
    "youtube": 0.10,
    "competitor_validation": 0.20,
    "effort_inverse": 0.10,
    "brain_alignment": 0.15,
    "novelty": 0.10,
}


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text[:80]


def check_relevance(content: str) -> bool:
    """Quick cheap-model check: is this about peptides AND digital products?"""
    try:
        response = call_cheap_model_sync(
            RELEVANCE_PROMPT.format(content=content[:2000]),
            temperature=0.1,
        )
        return "YES" in response.upper()
    except Exception as e:
        logger.error(f"Relevance check failed: {e}")
        return True  # Default to processing on error


def extract_ideas(content: str, source: str) -> list[dict]:
    """Use cheap model to extract structured ideas from raw content."""
    try:
        response = call_cheap_model_sync(
            EXTRACTION_PROMPT.format(source=source, content=content[:4000]),
            temperature=0.3,
        )
        ideas = extract_json_from_response(response)
        if isinstance(ideas, dict):
            ideas = [ideas]
        return ideas if isinstance(ideas, list) else []
    except Exception as e:
        logger.error(f"Idea extraction failed: {e}")
        return []


def check_brain_alignment(idea: dict) -> float:
    """Check idea against brain memories for alignment score."""
    try:
        golden_rules = get_brain_memories(memory_type="golden_rule")
        general_rules = get_brain_memories(memory_type="general_rule")

        score = 50.0  # Neutral starting point
        idea_text = f"{idea.get('title', '')} {idea.get('summary', '')} {idea.get('category', '')}"
        idea_lower = idea_text.lower()

        # Check golden rules
        for rule in golden_rules:
            content = rule["content"].lower()
            if "only" in content and "peptide" in content:
                # "Focus only on peptide-related digital products"
                if any(kw in idea_lower for kw in ["peptide", "semaglutide", "glp-1", "bpc", "tb-500"]):
                    score += 10
                else:
                    score -= 30
            if "recurring" in content and "revenue" in content:
                if idea.get("category") in ["membership", "app", "course"]:
                    score += 15
            if "medical advice" in content and "disclaimer" in content:
                if any(kw in idea_lower for kw in ["dosing", "protocol", "treatment"]):
                    score -= 5  # Slight penalty, needs disclaimers

        # Check general rules
        for rule in general_rules:
            content = rule["content"].lower()
            importance = rule.get("importance", 0.5)
            # Simple keyword matching for rule relevance
            if any(word in idea_lower for word in content.split()[:5]):
                score += importance * 10

        return max(0, min(100, score))

    except Exception as e:
        logger.error(f"Brain alignment check failed: {e}")
        return 50.0


def calculate_priority_score(idea: dict, brain_alignment: float) -> float:
    """Calculate composite priority score."""
    google_trends = min(100, (idea.get("google_trends_score") or 0))
    reddit = min(100, (idea.get("reddit_mention_count", 0) * 5))  # Rough scaling
    youtube = min(100, (idea.get("youtube_video_count", 0) * 10))
    competitor = min(100, (idea.get("etsy_competitor_count", 0) * 3))  # Some competition is validation

    effort_map = {"low": 20, "medium": 50, "high": 80}
    effort = effort_map.get(idea.get("effort_to_build", "medium"), 50)

    novelty = 70  # Default novelty for new ideas

    score = (
        SCORING_WEIGHTS["google_trends"] * google_trends
        + SCORING_WEIGHTS["reddit"] * reddit
        + SCORING_WEIGHTS["youtube"] * youtube
        + SCORING_WEIGHTS["competitor_validation"] * competitor
        + SCORING_WEIGHTS["effort_inverse"] * (100 - effort)
        + SCORING_WEIGHTS["brain_alignment"] * brain_alignment
        + SCORING_WEIGHTS["novelty"] * novelty
    )

    return round(min(100, max(0, score)), 1)


@app.task(name="tasks.idea_pipeline.process_raw_content", bind=True, max_retries=2)
def process_raw_content(self, content: str, source: str, source_links: list[dict] | None = None, metadata: dict | None = None):
    """Central pipeline: raw content -> dedup -> relevance -> extract -> score -> insert."""
    logger.info(f"Processing raw content from {source} ({len(content)} chars)")

    # Step 1: Relevance filter
    if not check_relevance(content):
        logger.info(f"Content from {source} filtered out (not relevant)")
        return {"filtered": True, "reason": "not_relevant"}

    # Step 2: Idea extraction
    ideas = extract_ideas(content, source)
    if not ideas:
        logger.info(f"No ideas extracted from {source} content")
        return {"ideas_extracted": 0}

    logger.info(f"Extracted {len(ideas)} ideas from {source}")

    # Pull batch-level metrics out of metadata if scrapers supplied them.
    # Every idea extracted from this batch shares these signals — coarse but
    # better than the previous always-zero counts that broke priority scoring.
    batch_metrics: dict = {}
    if metadata and isinstance(metadata.get("metrics"), dict):
        batch_metrics = metadata["metrics"]

    inserted = 0
    for idea in ideas:
        title = idea.get("title", "").strip()
        if not title:
            continue

        # Layer batch metrics into the idea dict so scoring + persistence see
        # them. setdefault preserves anything the AI explicitly returned.
        for k, v in batch_metrics.items():
            idea.setdefault(k, v)

        # Step 3: Deduplication by slug
        slug = slugify(title)
        if check_duplicate_slug(slug):
            logger.debug(f"Duplicate idea skipped: {title}")
            continue

        # Step 4: Brain alignment check
        brain_alignment = check_brain_alignment(idea)

        # Step 5: Priority scoring
        priority_score = calculate_priority_score(idea, brain_alignment)

        # Step 6: Insert
        idea_data = {
            "title": title,
            "slug": slug,
            "summary": idea.get("summary", ""),
            "detailed_analysis": idea.get("evidence", ""),
            "category": idea.get("category", "ebook"),
            "subcategory": idea.get("subcategory"),
            "peptide_topics": idea.get("peptide_topics", []),
            "priority_score": priority_score,
            "confidence_score": brain_alignment,
            "effort_to_build": idea.get("effort_to_build", "medium"),
            "differentiation_notes": idea.get("differentiation_angle"),
            "source_links": source_links or [],
            "discovery_source": source,
            # Carry batch metrics into the row so dashboards can read them.
            "reddit_mention_count": idea.get("reddit_mention_count", 0),
            "reddit_question_count": idea.get("reddit_question_count", 0),
            "youtube_video_count": idea.get("youtube_video_count", 0),
            "youtube_avg_views": idea.get("youtube_avg_views", 0),
            "forum_mention_count": idea.get("forum_mention_count", 0),
        }

        try:
            idea_id = insert_idea(idea_data)
            if idea_id is None:
                # Race: another worker inserted the same slug between dedup
                # check and insert. Skip silently.
                logger.debug(f"Idea '{title}' skipped at insert (slug conflict)")
                continue
            inserted += 1
            logger.info(f"Inserted idea: {title} (score: {priority_score}, id: {idea_id})")
        except Exception as e:
            logger.error(f"Failed to insert idea '{title}': {e}")

    logger.info(f"Pipeline complete for {source}: {inserted}/{len(ideas)} ideas inserted")
    return {"ideas_extracted": len(ideas), "ideas_inserted": inserted}
