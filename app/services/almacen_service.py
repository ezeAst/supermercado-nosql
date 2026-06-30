from typing import Optional

from bson import ObjectId
from fastapi import HTTPException

from app.db import mongo
from app.db import redis as redis_db


async def get_pedidos_pendientes(pasillo_id: Optional[str]) -> list:
    db = mongo.get_db()

    pipeline: list = [
        {"$match": {"estado": {"$in": ["registrado", "en_preparacion"]}}},
        {"$unwind": "$productos"},
    ]

    if pasillo_id:
        pipeline.append({"$match": {"productos.pasillo_id": pasillo_id}})

    pipeline += [
        # Suma cantidades del mismo producto en distintos pedidos
        {
            "$group": {
                "_id": {
                    "pasillo_id": "$productos.pasillo_id",
                    "producto_id": "$productos.producto_id",
                },
                "pasillo_nombre": {"$first": "$productos.pasillo_nombre"},
                "departamento_nombre": {"$first": "$productos.departamento_nombre"},
                "nombre": {"$first": "$productos.nombre"},
                "precio_unitario": {"$first": "$productos.precio_unitario"},
                "cantidad_total": {"$sum": "$productos.cantidad"},
            }
        },
        # Agrupa por pasillo formando el array de productos
        {
            "$group": {
                "_id": "$_id.pasillo_id",
                "pasillo_nombre": {"$first": "$pasillo_nombre"},
                "departamento_nombre": {"$first": "$departamento_nombre"},
                "productos": {
                    "$push": {
                        "producto_id": "$_id.producto_id",
                        "nombre": "$nombre",
                        "precio_unitario": "$precio_unitario",
                        "cantidad_total": "$cantidad_total",
                    }
                },
            }
        },
        {
            "$project": {
                "_id": 0,
                "pasillo_id": "$_id",
                "pasillo_nombre": 1,
                "departamento_nombre": 1,
                "productos": 1,
            }
        },
        # Enriquecer con zona y encargado desde la colección pasillos
        {
            "$lookup": {
                "from": "pasillos",
                "let": {"pid": "$pasillo_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", {"$toObjectId": "$$pid"}]}}},
                    {"$project": {"zona_almacen": 1, "encargado_area": 1}},
                ],
                "as": "pasillo_info",
            }
        },
        {
            "$addFields": {
                "zona_almacen": {"$arrayElemAt": ["$pasillo_info.zona_almacen", 0]},
                "encargado_area": {"$arrayElemAt": ["$pasillo_info.encargado_area", 0]},
            }
        },
        {"$project": {"pasillo_info": 0}},
        {"$sort": {"zona_almacen": 1, "pasillo_nombre": 1}},
    ]

    return await db.pedidos.aggregate(pipeline).to_list(length=None)


ESTADOS_VALIDOS = {"registrado", "en_preparacion", "listo", "entregado"}


async def get_pedidos_cola() -> list:
    """Lista individual de pedidos pendientes (registrado o en_preparacion)."""
    db = mongo.get_db()
    cursor = (
        db.pedidos.find(
            {"estado": {"$in": ["registrado", "en_preparacion"]}},
            {"_id": 1, "estado": 1, "fecha_creacion": 1, "total": 1, "usuario_id": 1, "productos": 1},
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
    return docs


async def actualizar_estado_pedido(pedido_id: str, nuevo_estado: str) -> dict:
    """Cambia el estado de un pedido. Solo permite transiciones válidas."""
    if nuevo_estado not in ESTADOS_VALIDOS:
        raise HTTPException(
            status_code=422,
            detail=f"Estado inválido. Valores permitidos: {sorted(ESTADOS_VALIDOS)}",
        )
    try:
        oid = ObjectId(pedido_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    db = mongo.get_db()
    result = await db.pedidos.update_one({"_id": oid}, {"$set": {"estado": nuevo_estado}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    r = redis_db.get_redis()
    await r.set(f"pedido_estado:{pedido_id}", nuevo_estado, ex=86400)

    return {"pedido_id": pedido_id, "estado": nuevo_estado}
