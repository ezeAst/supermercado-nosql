import json
import logging
import os
from datetime import datetime, timezone

import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis client not initialized")
    return _redis


async def log_redis_op(key: str, op: str, detail: str = "") -> None:
    try:
        r = get_redis()
        entry = json.dumps({
            "ts": datetime.now(timezone.utc).isoformat(),
            "key": key[:60],
            "op": op,
            "detail": detail[:80],
        })
        await r.lpush("redis_log:ops", entry)
        await r.ltrim("redis_log:ops", 0, 49)
    except Exception as e:
        logger.warning("Failed to log redis op: %s", e)


async def connect() -> None:
    global _redis
    host = os.getenv("REDIS_HOST", "localhost")
    port = int(os.getenv("REDIS_PORT", "6379"))
    _redis = aioredis.Redis(
        host=host,
        port=port,
        decode_responses=True,
    )
    await _redis.ping()


async def disconnect() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
