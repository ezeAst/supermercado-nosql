from typing import Optional

from bson import ObjectId
from fastapi import HTTPException

from app.db import mongo
from app.db import redis as redis_db


ESTADOS_VALIDOS = {"registrado", "en_preparacion", "listo_para_despacho", "despachado"}
ESTADOS_PRODUCTO = {"pendiente", "en_pasillo", "listo"}


def _jsonable(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_jsonable(v) for v in obj]
    return obj


async def _get_pedido_from_all_shards(pedido_id: str) -> tuple[Optional[dict], Optional[int]]:
    try:
        oid = ObjectId(pedido_id)
    except Exception:
        return None, None
    for sid in range(mongo.SHARDS):
        db = mongo.get_db(sid)
        doc = await db.pedidos.find_one({"_id": oid})
        if doc:
            return doc, sid
    return None, None


async def get_pedidos_pendientes(pasillo_id: Optional[str]) -> list:
    result = []
    for sid in range(mongo.SHARDS):
        db = mongo.get_db(sid)
        pipeline: list = [
            {"$match": {"estado": {"$in": ["registrado", "en_preparacion"]}}},
            {"$unwind": "$productos"},
        ]
        if pasillo_id:
            pipeline.append({"$match": {"productos.pasillo_id": pasillo_id}})

        pipeline += [
            {"$group": {
                "_id": {"pasillo_id": "$productos.pasillo_id", "producto_id": "$productos.producto_id"},
                "pasillo_nombre": {"$first": "$productos.pasillo_nombre"},
                "departamento_nombre": {"$first": "$productos.departamento_nombre"},
                "nombre": {"$first": "$productos.nombre"},
                "precio_unitario": {"$first": "$productos.precio_unitario"},
                "cantidad_total": {"$sum": "$productos.cantidad"},
            }},
            {"$group": {
                "_id": "$_id.pasillo_id",
                "pasillo_nombre": {"$first": "$pasillo_nombre"},
                "departamento_nombre": {"$first": "$departamento_nombre"},
                "productos": {"$push": {
                    "producto_id": "$_id.producto_id",
                    "nombre": "$nombre",
                    "precio_unitario": "$precio_unitario",
                    "cantidad_total": "$cantidad_total",
                }},
            }},
            {"$project": {"_id": 0, "pasillo_id": "$_id", "pasillo_nombre": 1, "departamento_nombre": 1, "productos": 1}},
            {"$lookup": {
                "from": "pasillos",
                "let": {"pid": "$pasillo_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", {"$toObjectId": "$$pid"}]}}},
                    {"$project": {"zona_almacen": 1, "encargado_area": 1}},
                ],
                "as": "pasillo_info",
            }},
            {"$addFields": {
                "zona_almacen": {"$arrayElemAt": ["$pasillo_info.zona_almacen", 0]},
                "encargado_area": {"$arrayElemAt": ["$pasillo_info.encargado_area", 0]},
            }},
            {"$project": {"pasillo_info": 0}},
            {"$sort": {"zona_almacen": 1, "pasillo_nombre": 1}},
        ]
        docs = await db.pedidos.aggregate(pipeline).to_list(length=None)
        result.extend(docs)

    # Merge pasillos duplicados
    merged = {}
    for entry in result:
        pid = entry["pasillo_id"]
        if pid in merged:
            merged[pid]["productos"].extend(entry["productos"])
        else:
            merged[pid] = entry
    # Re-agrupar productos por producto_id dentro de cada pasillo
    for entry in merged.values():
        prod_map = {}
        for p in entry["productos"]:
            pid = p["producto_id"]
            if pid in prod_map:
                prod_map[pid]["cantidad_total"] += p["cantidad_total"]
            else:
                prod_map[pid] = p
        entry["productos"] = list(prod_map.values())
    return list(merged.values())


async def get_pedidos_cola(estado_filter: Optional[str] = None) -> list:
    if estado_filter and estado_filter in ESTADOS_VALIDOS:
        estados = [estado_filter]
    else:
        estados = list(ESTADOS_VALIDOS)

    result = []
    for sid in range(mongo.SHARDS):
        db = mongo.get_db(sid)
        cursor = (
            db.pedidos.find(
                {"estado": {"$in": estados}},
                {"_id": 1, "estado": 1, "fecha_creacion": 1, "total": 1, "usuario_id": 1, "productos": 1, "direccion_entrega": 1},
            )
            .sort("fecha_creacion", 1)
            .limit(100)
        )
        docs = await cursor.to_list(length=100)
        for doc in docs:
            doc["_id"] = str(doc["_id"])
            if "fecha_creacion" in doc:
                doc["fecha_creacion"] = doc["fecha_creacion"].isoformat()
            doc["num_productos"] = len(doc.get("productos", []))
            doc.pop("productos", None)
            doc["shard"] = sid
        result.extend(docs)

    result.sort(key=lambda x: x.get("fecha_creacion", ""))
    return result


async def get_pedido_detalle(pedido_id: str) -> dict:
    doc, sid = await _get_pedido_from_all_shards(pedido_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    r = redis_db.get_redis()
    estado_redis = await r.get(f"pedido_estado:{pedido_id}")
    result = _jsonable(doc)
    result["shard"] = sid
    if estado_redis is not None:
        result["estado_redis"] = estado_redis

    return result


async def actualizar_estado_pedido(pedido_id: str, nuevo_estado: str) -> dict:
    if nuevo_estado not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=422, detail=f"Estado inválido. Valores: {sorted(ESTADOS_VALIDOS)}")

    doc, sid = await _get_pedido_from_all_shards(pedido_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    db = mongo.get_db(sid)
    try:
        oid = ObjectId(pedido_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    result = await db.pedidos.update_one({"_id": oid}, {"$set": {"estado": nuevo_estado}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    r = redis_db.get_redis()
    await r.set(f"pedido_estado:{pedido_id}", nuevo_estado, ex=86400)

    uid = doc.get("usuario_id", "")
    await mongo.log_shard_op(sid, "write", "pedidos", uid, f"cambiar_estado:{nuevo_estado}")

    return {"pedido_id": pedido_id, "estado": nuevo_estado}


async def actualizar_estado_producto(pedido_id: str, producto_id: str, nuevo_estado: str) -> dict:
    if nuevo_estado not in ESTADOS_PRODUCTO:
        raise HTTPException(status_code=422, detail=f"Estado de producto inválido. Valores: {sorted(ESTADOS_PRODUCTO)}")

    doc, sid = await _get_pedido_from_all_shards(pedido_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    db = mongo.get_db(sid)
    try:
        oid = ObjectId(pedido_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    result = await db.pedidos.update_one(
        {"_id": oid, "productos.producto_id": producto_id},
        {"$set": {"productos.$.estado_pasillo": nuevo_estado}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido o producto no encontrado")

    doc = await db.pedidos.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    todos_listos = all(
        prod.get("estado_pasillo", "pendiente") == "listo"
        for prod in doc.get("productos", [])
    )
    order_estado = doc.get("estado", "registrado")

    if todos_listos:
        await db.pedidos.update_one({"_id": oid}, {"$set": {"estado": "listo_para_despacho"}})
        r = redis_db.get_redis()
        await r.set(f"pedido_estado:{pedido_id}", "listo_para_despacho", ex=86400)
        order_estado = "listo_para_despacho"

    uid = doc.get("usuario_id", "")
    await mongo.log_shard_op(sid, "write", "pedidos", uid, f"toggle_producto:{producto_id}->{nuevo_estado}")

    return {
        "pedido_id": pedido_id,
        "producto_id": producto_id,
        "producto_estado": nuevo_estado,
        "order_estado": order_estado,
    }
