import logging
import httpx
from config import EMBEDDINGS_API_KEY, EMBEDDINGS_API_URL, EMBEDDINGS_MODEL

logger = logging.getLogger(__name__)


def generate_embedding(text: str) -> list[float] | None:
    if not EMBEDDINGS_API_KEY:
        logger.warning("No embeddings API key configured")
        return None

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{EMBEDDINGS_API_URL}/embeddings",
                headers={
                    "Authorization": f"Bearer {EMBEDDINGS_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": EMBEDDINGS_MODEL,
                    "input": text,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["data"][0]["embedding"]
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)
