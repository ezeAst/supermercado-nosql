import os

import redis.asyncio as aioredis

from app.db import mongo
from app.db import redis as redis_db


async def get_mongo_replica_set() -> dict:
    """Estado del replica set: miembros, roles, health y lag de replicación."""
    client = mongo.get_client()
    status = await client.admin.command("replSetGetStatus")

    primary_optime = None
    for m in status.get("members", []):
        if m.get("stateStr") == "PRIMARY":
            primary_optime = m.get("optimeDate")
            break

    members_out = []
    for m in status.get("members", []):
        lag_s = None
        if primary_optime and m.get("stateStr") == "SECONDARY":
            delta = primary_optime - m.get("optimeDate", primary_optime)
            lag_s = round(max(0.0, delta.total_seconds()), 3)
        optime_date = m.get("optimeDate")
        members_out.append({
            "id": m.get("_id"),
            "name": m.get("name"),
            "state": m.get("stateStr"),
            "health": m.get("health"),
            "optimeDate": optime_date.isoformat() if optime_date else None,
            "lag_segundos": lag_s,
        })

    return {
        "replica_set": status.get("set"),
        "read_preference": "secondaryPreferred",
        "members": members_out,
    }


async def get_mongo_indices() -> dict:
    """Índices activos en todas las colecciones de supermercado_db."""
    db = mongo.get_db()
    collections = ["usuarios", "productos", "pedidos", "pasillos", "departamentos"]
    result: dict = {}
    for col_name in collections:
        info = await db[col_name].index_information()
        parsed = []
        for idx_name, idx_doc in info.items():
            key_pairs = idx_doc.get("key", [])
            parsed.append({
                "nombre": idx_name,
                "campos": [[f, v] for f, v in key_pairs],
                "unique": idx_doc.get("unique", False),
                "sparse": idx_doc.get("sparse", False),
                "text": any(v == "text" for _, v in key_pairs),
            })
        result[col_name] = parsed
    return result


async def get_redis_info() -> dict:
    """INFO replication del master y, si está configurada, de la réplica."""
    r = redis_db.get_redis()
    master_raw = await r.info("replication")
    master_out = {
        "role": master_raw.get("role"),
        "connected_slaves": master_raw.get("connected_slaves", 0),
        "master_replid": master_raw.get("master_replid"),
        "master_repl_offset": master_raw.get("master_repl_offset"),
        "repl_backlog_size": master_raw.get("repl_backlog_size"),
    }

    replica_out = None
    replica_host = os.getenv("REDIS_REPLICA_HOST")
    if replica_host:
        replica_port = int(os.getenv("REDIS_REPLICA_PORT", "6379"))
        r_replica = aioredis.Redis(host=replica_host, port=replica_port, decode_responses=True)
        try:
            rep_raw = await r_replica.info("replication")
            replica_out = {
                "role": rep_raw.get("role"),
                "master_host": rep_raw.get("master_host"),
                "master_port": rep_raw.get("master_port"),
                "master_link_status": rep_raw.get("master_link_status"),
                "slave_repl_offset": rep_raw.get("slave_repl_offset"),
                "lag": rep_raw.get("master_last_io_seconds_ago"),
            }
        except Exception as exc:
            replica_out = {"error": str(exc)}
        finally:
            await r_replica.aclose()

    return {"master": master_out, "replica": replica_out}


async def get_redis_claves() -> list:
    """Escanea carrito:* y pedido_estado:* con SCAN, retorna tipo, TTL y valor resumido."""
    r = redis_db.get_redis()
    patrones = ["carrito:*", "pedido_estado:*"]
    claves: list = []

    for pattern in patrones:
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor, match=pattern, count=100)
            for key in keys:
                ttl = await r.ttl(key)
                key_type = await r.type(key)
                valor_resumen: str | None = None
                if key_type == "hash":
                    raw: dict = await r.hgetall(key)
                    items = list(raw.items())[:3]
                    valor_resumen = f"{len(raw)} campos: " + ", ".join(
                        f"{k}={v}" for k, v in items
                    ) + ("…" if len(raw) > 3 else "")
                elif key_type == "string":
                    valor_resumen = await r.get(key)
                claves.append({
                    "clave": key,
                    "tipo": key_type,
                    "ttl_segundos": ttl,
                    "valor_resumen": valor_resumen,
                })
            if cursor == 0:
                break

    claves.sort(key=lambda x: x["clave"])
    return claves
