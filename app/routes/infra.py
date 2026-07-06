from fastapi import APIRouter, HTTPException

from app.db import mongo
from app.db import redis as redis_db
from app.services import infra_service

router = APIRouter(prefix="/api/v1/infra", tags=["Infraestructura NoSQL"])


@router.get("/mongo/replica-set", summary="Estado de los shards de MongoDB")
async def get_mongo_replica_set():
    return await infra_service.get_mongo_replica_set()


@router.get("/mongo/indices", summary="Índices activos en MongoDB")
async def get_mongo_indices():
    return await infra_service.get_mongo_indices()


@router.get("/mongo/shard-ops", summary="Log de operaciones por shard")
async def get_shard_ops():
    return await infra_service.get_shard_ops()


@router.get("/mongo/shard-for-user/{usuario_id}", summary="Calcula a qué shard pertenece un usuario")
async def get_shard_for_user(usuario_id: str):
    shard = mongo.shard_for_user(usuario_id)
    return {"usuario_id": usuario_id, "shard": shard}


@router.get("/redis/info", summary="Estado de replicación de Redis")
async def get_redis_info():
    return await infra_service.get_redis_info()


@router.get("/redis/claves", summary="Claves Redis activas con TTL")
async def get_redis_claves():
    return await infra_service.get_redis_claves()


@router.delete("/redis/claves/{clave:path}", summary="Eliminar una clave Redis")
async def delete_redis_clave(clave: str):
    r = redis_db.get_redis()
    result = await r.delete(clave)
    if result == 0:
        raise HTTPException(status_code=404, detail="Clave no encontrada")
    return {"ok": True, "clave": clave}


@router.get("/redis/ops", summary="Log de operaciones Redis")
async def get_redis_ops():
    return await infra_service.get_redis_ops()
