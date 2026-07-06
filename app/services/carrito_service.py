import json
import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from app.db import mongo
from app.db import redis as redis_db

logger = logging.getLogger(__name__)


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


async def confirmar_carrito(
    usuario_id: str,
    direccion_entrega: str,
    metodo_pago: str,
    idempotency_key: str,
) -> tuple[dict, bool]:
    shard = mongo.shard_for_user(usuario_id)
    db = mongo.get_db(shard)
    r = redis_db.get_redis()

    existing = await db.pedidos.find_one({"idempotency_key": idempotency_key})
    if existing:
        return _jsonable(existing), True

    carrito_key = f"carrito:{usuario_id}"
    carrito_raw: dict = await r.hgetall(carrito_key)

    if not carrito_raw:
        raise HTTPException(status_code=400, detail="El carrito está vacío")

    try:
        items: dict[str, int] = {pid: int(cant) for pid, cant in carrito_raw.items()}
    except ValueError:
        raise HTTPException(status_code=400, detail="El carrito contiene cantidades inválidas")

    try:
        oids = [ObjectId(pid) for pid in items]
    except Exception:
        raise HTTPException(status_code=400, detail="El carrito contiene IDs de producto inválidos")

    # Productos en shard 0
    productos_docs = await mongo.get_db(0).productos.find({"_id": {"$in": oids}}).to_list(length=None)

    if len(productos_docs) != len(items):
        found_ids = {str(doc["_id"]) for doc in productos_docs}
        missing = [pid for pid in items if pid not in found_ids]
        raise HTTPException(status_code=400, detail=f"Productos no encontrados: {', '.join(missing)}")

    productos_map = {str(doc["_id"]): doc for doc in productos_docs}

    sin_stock = [
        productos_map[pid]["nombre"]
        for pid, cantidad in items.items()
        if productos_map[pid]["stock"] < cantidad
    ]
    if sin_stock:
        raise HTTPException(status_code=400, detail=f"Stock insuficiente para: {', '.join(sin_stock)}")

    snapshots = []
    total = 0.0
    for pid, cantidad in items.items():
        doc = productos_map[pid]
        precio = doc["precio"]
        snapshots.append({
            "producto_id": pid,
            "nombre": doc["nombre"],
            "precio_unitario": precio,
            "cantidad": cantidad,
            "pasillo_id": doc["pasillo_id"],
            "pasillo_nombre": doc["pasillo_nombre"],
            "departamento_nombre": doc.get("departamento_nombre", ""),
            "estado_pasillo": "pendiente",
        })
        total += precio * cantidad

    pedido_doc = {
        "usuario_id": usuario_id,
        "productos": snapshots,
        "total": round(total, 2),
        "estado": "registrado",
        "fecha_creacion": datetime.now(timezone.utc),
        "direccion_entrega": direccion_entrega,
        "metodo_pago": metodo_pago,
        "idempotency_key": idempotency_key,
    }

    result = await db.pedidos.insert_one(pedido_doc)
    pedido_doc["_id"] = result.inserted_id

    pedido_id_str = str(result.inserted_id)
    pedido_json = _jsonable(pedido_doc)
    await r.set(f"pedido_estado:{pedido_id_str}", json.dumps(pedido_json), ex=86400)
    await redis_db.log_redis_op(f"pedido_estado:{pedido_id_str}", "write", "confirmar_carrito")

    await mongo.log_shard_op(shard, "write", "pedidos", usuario_id, "confirmar_carrito")

    try:
        await r.delete(carrito_key)
    except Exception as exc:
        logger.warning("No se pudo eliminar carrito Redis para %s: %s", usuario_id, exc)

    return _jsonable(pedido_doc), False


async def set_item_carrito(usuario_id: str, producto_id: str, cantidad: int) -> None:
    r = redis_db.get_redis()
    carrito_key = f"carrito:{usuario_id}"
    if cantidad <= 0:
        await r.hdel(carrito_key, producto_id)
    else:
        await r.hset(carrito_key, producto_id, cantidad)
        await r.expire(carrito_key, 86400)
    await redis_db.log_redis_op(carrito_key, "write", f"set_item:{producto_id}->{cantidad}")


async def remove_item_carrito(usuario_id: str, producto_id: str) -> None:
    r = redis_db.get_redis()
    await r.hdel(f"carrito:{usuario_id}", producto_id)
    await redis_db.log_redis_op(f"carrito:{usuario_id}", "write", f"remove_item:{producto_id}")


async def clear_carrito(usuario_id: str) -> None:
    r = redis_db.get_redis()
    await r.delete(f"carrito:{usuario_id}")
    await redis_db.log_redis_op(f"carrito:{usuario_id}", "write", "clear_carrito")


async def add_item_carrito(usuario_id: str, producto_id: str, cantidad: int) -> None:
    r = redis_db.get_redis()
    carrito_key = f"carrito:{usuario_id}"
    nueva_cantidad = await r.hincrby(carrito_key, producto_id, cantidad)
    if nueva_cantidad <= 0:
        await r.hdel(carrito_key, producto_id)
    else:
        await r.expire(carrito_key, 86400)
    await redis_db.log_redis_op(carrito_key, "write", f"add_item:{producto_id}->{nueva_cantidad}")


async def get_carrito(usuario_id: str) -> list:
    r = redis_db.get_redis()
    carrito_key = f"carrito:{usuario_id}"
    carrito_raw: dict = await r.hgetall(carrito_key)
    if not carrito_raw:
        return []
    await redis_db.log_redis_op(carrito_key, "read", f"get_carrito:{len(carrito_raw)}_items")

    try:
        oids = [ObjectId(pid) for pid in carrito_raw]
    except Exception:
        return []

    db = mongo.get_db(0)
    productos = await db.productos.find({"_id": {"$in": oids}}).to_list(length=None)
    productos_map = {str(doc["_id"]): doc for doc in productos}

    items = []
    for pid, cant_str in carrito_raw.items():
        doc = productos_map.get(pid)
        if not doc:
            continue
        cantidad = int(cant_str)
        items.append({
            "producto_id": pid,
            "nombre": doc["nombre"],
            "precio_unitario": doc["precio"],
            "cantidad": cantidad,
            "subtotal": round(doc["precio"] * cantidad, 2),
            "pasillo_nombre": doc["pasillo_nombre"],
        })
    return items
