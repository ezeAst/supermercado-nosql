from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import HTTPException

from app.db import mongo
from app.db import redis as redis_db


def _jsonable(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonable(v) for v in obj]
    return obj


async def _check_usuario(db, usuario_id: str) -> None:
    try:
        oid = ObjectId(usuario_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user = await db.usuarios.find_one({"_id": oid}, {"_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")


async def get_pedidos_usuario(
    usuario_id: str,
    before: Optional[datetime],
    limit: int,
    estado: Optional[str],
) -> dict:
    shard = mongo.shard_for_user(usuario_id)
    db = mongo.get_db(shard)
    await _check_usuario(mongo.get_db(0), usuario_id)

    query: dict = {"usuario_id": usuario_id}
    if before is not None:
        query["fecha_creacion"] = {"$lt": before}
    if estado is not None:
        query["estado"] = estado

    cursor = (
        db.pedidos.find(query)
        .sort("fecha_creacion", -1)
        .limit(limit + 1)
    )
    docs = await cursor.to_list(length=limit + 1)

    has_more = len(docs) > limit
    if has_more:
        docs = docs[:limit]

    pedidos = [_jsonable(doc) for doc in docs]

    siguiente_cursor: Optional[str] = None
    if has_more and pedidos:
        siguiente_cursor = pedidos[-1]["fecha_creacion"]

    await mongo.log_shard_op(shard, "read", "pedidos", usuario_id, "historial")

    return {"pedidos": pedidos, "siguiente_cursor": siguiente_cursor}


async def get_pedido_usuario(usuario_id: str, pedido_id: str) -> dict:
    shard = mongo.shard_for_user(usuario_id)
    db = mongo.get_db(shard)
    await _check_usuario(mongo.get_db(0), usuario_id)

    try:
        oid = ObjectId(pedido_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    doc = await db.pedidos.find_one({"_id": oid, "usuario_id": usuario_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    result = _jsonable(doc)

    r = redis_db.get_redis()
    estado_redis = await r.get(f"pedido_estado:{pedido_id}")
    if estado_redis is not None:
        result["estado_redis"] = estado_redis

    await mongo.log_shard_op(shard, "read", "pedidos", usuario_id, "detalle_pedido")

    return result
