"""
Worker-side API key loader.

Reads the same `api_keys` table that the Next.js /settings UI writes to.
Falls back to env vars when no DB row exists, so existing setups still work.

Decrypts AES-256-GCM ciphertext using MASTER_ENCRYPTION_KEY (matching the
Node.js encryption format: [12-byte IV][16-byte tag][ciphertext], base64).

Cached in-process for 60s to avoid hitting the DB on every API call.
"""

import base64
import logging
import os
import time
from typing import Optional

import psycopg2
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from config import DATABASE_URL

logger = logging.getLogger(__name__)

# Provider id -> env var name. Mirrors src/lib/api-keys/providers.ts.
PROVIDER_ENV_VARS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "youtube": "YOUTUBE_API_KEY",
    "serp": "SERP_API_KEY",
    "etsy": "ETSY_API_KEY",
    "embeddings": "EMBEDDINGS_API_KEY",
}

_CACHE: dict[str, tuple[Optional[str], float]] = {}
_CACHE_TTL_SEC = 60.0
_IV_LEN = 12
_TAG_LEN = 16


def _master_key() -> Optional[bytes]:
    raw = os.getenv("MASTER_ENCRYPTION_KEY")
    if not raw:
        return None
    # Hex (64 chars) or base64 (decodes to 32 bytes)
    if len(raw) == 64:
        try:
            return bytes.fromhex(raw)
        except ValueError:
            pass
    try:
        decoded = base64.b64decode(raw)
        if len(decoded) == 32:
            return decoded
    except (ValueError, base64.binascii.Error):
        pass
    return None


def _decrypt(payload_b64: str) -> Optional[str]:
    key = _master_key()
    if key is None:
        logger.warning("MASTER_ENCRYPTION_KEY not configured; cannot decrypt DB keys")
        return None
    try:
        buf = base64.b64decode(payload_b64)
        if len(buf) < _IV_LEN + _TAG_LEN + 1:
            return None
        iv = buf[:_IV_LEN]
        tag = buf[_IV_LEN : _IV_LEN + _TAG_LEN]
        ct = buf[_IV_LEN + _TAG_LEN :]
        aesgcm = AESGCM(key)
        # Python's AESGCM expects (nonce, ciphertext + tag)
        plaintext = aesgcm.decrypt(iv, ct + tag, None)
        return plaintext.decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to decrypt API key: {e}")
        return None


def _read_from_db(provider: str) -> Optional[str]:
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT encrypted_value FROM api_keys WHERE provider = %s",
                    (provider,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return _decrypt(row[0])
    except Exception as e:
        logger.error(f"DB read failed for provider={provider}: {e}")
        return None


def get_api_key(provider: str) -> Optional[str]:
    """
    Resolve an API key. DB-first, env-fallback. Returns None if neither set.
    Cached in-process for 60s.
    """
    cached = _CACHE.get(provider)
    if cached and cached[1] > time.time():
        return cached[0]

    value = _read_from_db(provider)

    if not value:
        env_var = PROVIDER_ENV_VARS.get(provider)
        if env_var:
            env_value = os.getenv(env_var, "")
            if env_value:
                value = env_value

    _CACHE[provider] = (value, time.time() + _CACHE_TTL_SEC)
    return value


def invalidate_cache(provider: Optional[str] = None) -> None:
    """Drop a single provider or the whole cache."""
    if provider is None:
        _CACHE.clear()
    else:
        _CACHE.pop(provider, None)