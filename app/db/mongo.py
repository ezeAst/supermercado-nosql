import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.db import redis as redis_db

load_dotenv()

logger = logging.getLogger(__name__)

_clients: dict[int, AsyncIOMotorClient] = {}
SHARDS = 2


def shard_for_user(usuario_id: str) -> int:
    h = int(hashlib.md5(usuario_id.encode()).hexdigest(), 16)
    return h % SHARDS


def _uri_for_shard(shard_id: int) -> str:
    key = f"MONGO_SHARD{shard_id}_URI"
    uri = os.getenv(key)
    if not uri:
        raise ValueError(f"{key} env var is not set")
    return uri


def get_client(shard_id: int) -> AsyncIOMotorClient:
    if shard_id not in _clients:
        raise RuntimeError(f"MongoDB client for shard {shard_id} not initialized")
    return _clients[shard_id]


def get_db(shard_id: int) -> AsyncIOMotorDatabase:
    return get_client(shard_id)["supermercado_db"]


def get_db_for_user(usuario_id: str) -> AsyncIOMotorDatabase:
    return get_db(shard_for_user(usuario_id))


async def get_all_dbs() -> list[AsyncIOMotorDatabase]:
    return [get_db(sid) for sid in range(SHARDS)]


async def log_shard_op(
    shard_id: int,
    op: str,
    collection: str,
    usuario_id: Optional[str] = None,
    detail: Optional[str] = None,
) -> None:
    try:
        r = redis_db.get_redis()
        entry = json.dumps({
            "ts": datetime.now(timezone.utc).isoformat(),
            "shard": shard_id,
            "op": op,
            "collection": collection,
            "usuario_id": usuario_id or "",
            "detail": detail or "",
        })
        await r.lpush("shard_log:ops", entry)
        await r.ltrim("shard_log:ops", 0, 49)
    except Exception as e:
        logger.warning("Failed to log shard op: %s", e)


async def connect() -> None:
    for sid in range(SHARDS):
        uri = _uri_for_shard(sid)
        _clients[sid] = AsyncIOMotorClient(uri, readPreference="secondaryPreferred")
        await _clients[sid].admin.command("ping")
        logger.info("Connected to shard %d (%s)", sid, uri)


async def disconnect() -> None:
    for sid, client in _clients.items():
        client.close()
    _clients.clear()
