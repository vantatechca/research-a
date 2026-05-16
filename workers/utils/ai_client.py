"""
AI client for the peptide-brain pipeline.

Uses Anthropic Claude Haiku 4.5 via the api_keys DB lookup (provider='anthropic').
Switched from OpenRouter to avoid the credit top-up cycle.
"""
import json
import logging
import os
import httpx
from utils.api_keys import get_api_key

logger = logging.getLogger(__name__)

CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
ANTHROPIC_VERSION = "2023-06-01"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


def _build_request(prompt: str, system_prompt: str | None, temperature: float) -> dict:
    body = {
        "model": CLAUDE_MODEL,
        "max_tokens": 2048,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_prompt:
        body["system"] = system_prompt
    return body


def _headers(api_key: str) -> dict:
    return {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }


def _extract_text(data: dict) -> str:
    """Anthropic returns content as a list of blocks; concat the text blocks."""
    content = data.get("content", [])
    if not isinstance(content, list):
        return ""
    parts = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "".join(parts)


async def call_cheap_model(
    prompt: str,
    system_prompt: str | None = None,
    temperature: float = 0.3,
) -> str:
    api_key = get_api_key("anthropic")
    if not api_key:
        logger.warning("No Anthropic API key configured, returning empty response")
        return ""

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            ANTHROPIC_URL,
            headers=_headers(api_key),
            json=_build_request(prompt, system_prompt, temperature),
        )
        response.raise_for_status()
        return _extract_text(response.json())


def call_cheap_model_sync(
    prompt: str,
    system_prompt: str | None = None,
    temperature: float = 0.3,
) -> str:
    api_key = get_api_key("anthropic")
    if not api_key:
        logger.warning("No Anthropic API key configured, returning empty response")
        return ""

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            ANTHROPIC_URL,
            headers=_headers(api_key),
            json=_build_request(prompt, system_prompt, temperature),
        )
        response.raise_for_status()
        return _extract_text(response.json())


def extract_json_from_response(response: str) -> list | dict:
    response = response.strip()
    if response.startswith("```json"):
        response = response[7:]
    if response.startswith("```"):
        response = response[3:]
    if response.endswith("```"):
        response = response[:-3]
    response = response.strip()

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    # Try array first (more common for extraction prompts)
    start = response.find("[")
    end = response.rfind("]") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(response[start:end])
        except json.JSONDecodeError:
            pass

    # Then object
    start = response.find("{")
    end = response.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(response[start:end])
        except json.JSONDecodeError:
            pass

    return []