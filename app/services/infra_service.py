import json
import logging
import os

from motor.motor_asyncio import AsyncIOMotorClient

from app.db import mongo
from app.db import redis as redis_db

logger = logging.getLogger(__name__)


async def get_mongo_replica_set() -> dict:
    result = {"shards": [], "shard_count": mongo.SHARDS}

    for sid in range(mongo.SHARDS):
        try:
            uri = os.getenv(f"MONGO_SHARD{sid}_URI")
            # Cliente temporal con timeout corto para health check
            client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000, readPreference="secondaryPreferred")
            status = await client.admin.command("replSetGetStatus")
            members = []
            for m in status.get("members", []):
                optime = m.get("optimeDate", None)
                optime_str = optime.isoformat() if optime else None

                primary_optime = None
                for pm in status.get("members", []):
                    if pm.get("stateStr") == "PRIMARY":
                        primary_optime = pm.get("optimeDate")
                        break

                lag = None
                if primary_optime and optime:
                    lag = (primary_optime - optime).total_seconds()

                members.append({
                    "id": m.get("_id"),
                    "name": m.get("name"),
                    "state": m.get("stateStr"),
                    "health": m.get("health"),
                    "optimeDate": optime_str,
                    "lag_segundos": lag,
                })

            try:
                db = client["supermercado_db"]
                count = await db.pedidos.count_documents({})
            except Exception:
                count = -1

            result["shards"].append({
                "shard_id": sid,
                "replica_set": status.get("set", f"rs{sid}"),
                "members": members,
                "total_pedidos": count,
            })
            client.close()
        except Exception as e:
            result["shards"].append({"shard_id": sid, "error": str(e)})
            logger.warning("Error getting shard %d status: %s", sid, e)

    result["ruteo"] = "md5(usuario_id) % shards"
    return result


async def get_mongo_indices() -> dict:
    db = mongo.get_db(0)
    collections = ["usuarios", "productos", "pedidos", "pasillos", "departamentos"]
    result = {}
    for col in collections:
        indices = await db[col].index_information()
        items = []
        for name, info in indices.items():
            if name == "_id_":
                continue
            items.append({
                "nombre": name,
                "campos": [(k, v) for k, v in info.get("key", [])],
                "unique": info.get("unique", False),
                "sparse": info.get("sparse", False),
                "text": any(v == "text" for _, v in info.get("key", [])),
            })
        result[col] = items
    return result


async def get_redis_info() -> dict:
    r = redis_db.get_redis()
    info = await r.info("replication")

    master = {
        "role": info.get("role"),
        "connected_slaves": info.get("connected_slaves"),
        "master_repl_offset": info.get("master_repl_offset"),
        "master_replid": info.get("master_replid"),
    }

    replica = None
    if info.get("role") == "master" and info.get("connected_slaves", 0) > 0:
        slave0 = info.get("slave0", {})
        replica = {
            "role": "slave",
            "master_host": slave0.get("ip"),
            "master_port": slave0.get("port"),
            "master_link_status": slave0.get("state"),
            "slave_repl_offset": slave0.get("offset"),
            "lag": slave0.get("lag"),
        }

    return {"master": master, "replica": replica}


async def get_redis_claves() -> list:
    r = redis_db.get_redis()
    patrones = ["carrito:*", "pedido_estado:*", "sesion:*"]
    result = []
    for pattern in patrones:
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            for key in keys:
                tipo = await r.type(key)
                ttl = await r.ttl(key)
                valor = ""
                if tipo == "string":
                    val = await r.get(key)
                    if val:
                        valor = val[:80]
                elif tipo == "hash":
                    campos = await r.hlen(key)
                    valor = f"{campos} campo(s)"
                result.append({"clave": key, "tipo": tipo, "ttl_segundos": ttl, "valor_resumen": valor})
            if cursor == 0:
                break
    return result


async def get_shard_ops() -> list:
    r = redis_db.get_redis()
    raw = await r.lrange("shard_log:ops", 0, 49)
    result = []
    for entry in raw:
        try:
            result.append(json.loads(entry))
        except json.JSONDecodeError:
            continue
    return result


async def get_redis_ops() -> list:
    r = redis_db.get_redis()
    raw = await r.lrange("redis_log:ops", 0, 49)
    result = []
    for entry in raw:
        try:
            result.append(json.loads(entry))
        except json.JSONDecodeError:
            continue
    return result
