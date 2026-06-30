import os
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis client not initialized")
    return _redis


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
