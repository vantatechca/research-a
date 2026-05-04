import logging
import httpx
from config import EMBEDDINGS_API_URL, EMBEDDINGS_MODEL
from utils.api_keys import get_api_key

logger = logging.getLogger(__name__)


def generate_embedding(text: str) -> list[float] | None:
    api_key = get_api_key("embeddings")
    if not api_key:
        logger.warning("No embeddings API key configured")
        return None

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{EMBEDDINGS_API_URL}/embeddings",
                headers={
                    "Authorization": f"Bearer {api_key}",
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