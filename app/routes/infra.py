from fastapi import APIRouter

from app.db import mongo
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
