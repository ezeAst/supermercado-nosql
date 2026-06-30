from fastapi import APIRouter

from app.services import infra_service

router = APIRouter(prefix="/api/v1/infra", tags=["Infraestructura NoSQL"])


@router.get(
    "/mongo/replica-set",
    summary="Estado del replica set de MongoDB",
    description=(
        "Ejecuta `replSetGetStatus` en el nodo admin y retorna el estado de cada miembro: "
        "rol (PRIMARY / SECONDARY), health, optimeDate y lag en segundos respecto al primario. "
        "También informa el `readPreference` configurado en la aplicación."
    ),
    responses={
        200: {
            "description": "Estado del replica set con miembros y lag",
            "content": {
                "application/json": {
                    "example": {
                        "replica_set": "rs0",
                        "read_preference": "secondaryPreferred",
                        "members": [
                            {"id": 0, "name": "mongo-primary:27017", "state": "PRIMARY", "health": 1.0, "optimeDate": "2026-06-30T10:00:00", "lag_segundos": None},
                            {"id": 1, "name": "mongo-secondary1:27017", "state": "SECONDARY", "health": 1.0, "optimeDate": "2026-06-30T09:59:59", "lag_segundos": 1.0},
                        ],
                    }
                }
            },
        }
    },
)
async def get_mongo_replica_set():
    return await infra_service.get_mongo_replica_set()


@router.get(
    "/mongo/indices",
    summary="Índices activos en MongoDB",
    description=(
        "Llama a `collection.index_information()` para cada colección de `supermercado_db` "
        "y retorna nombre, campos, y flags (unique, sparse, text)."
    ),
    responses={
        200: {
            "description": "Mapa colección → lista de índices",
            "content": {
                "application/json": {
                    "example": {
                        "pedidos": [
                            {"nombre": "pedidos_usuario_fecha", "campos": [["usuario_id", 1], ["fecha_creacion", -1]], "unique": False, "sparse": False, "text": False},
                            {"nombre": "pedidos_estado", "campos": [["estado", 1]], "unique": False, "sparse": False, "text": False},
                        ]
                    }
                }
            },
        }
    },
)
async def get_mongo_indices():
    return await infra_service.get_mongo_indices()


@router.get(
    "/redis/info",
    summary="Estado de replicación de Redis",
    description=(
        "Ejecuta `INFO replication` en el nodo master y, si `REDIS_REPLICA_HOST` está configurado, "
        "también en la réplica. Retorna role, offset, lag y slaves conectados."
    ),
    responses={
        200: {
            "description": "Información de replicación de master y réplica",
            "content": {
                "application/json": {
                    "example": {
                        "master": {"role": "master", "connected_slaves": 1, "master_repl_offset": 1234},
                        "replica": {"role": "slave", "master_host": "redis-master", "master_link_status": "up", "lag": 0},
                    }
                }
            },
        }
    },
)
async def get_redis_info():
    return await infra_service.get_redis_info()


@router.get(
    "/redis/claves",
    summary="Claves Redis activas con TTL",
    description=(
        "Escanea con `SCAN` los patrones `carrito:*` y `pedido_estado:*`. "
        "Para cada clave retorna tipo de estructura, TTL restante en segundos y un resumen del valor. "
        "Usa `SCAN` en lugar de `KEYS *` para no bloquear Redis."
    ),
    responses={
        200: {
            "description": "Lista de claves activas con metadata",
            "content": {
                "application/json": {
                    "example": [
                        {"clave": "carrito:64f1a2...", "tipo": "hash", "ttl_segundos": 85400, "valor_resumen": "2 campos: 64f9b1...=2, 64f9c4...=1"},
                        {"clave": "pedido_estado:64f2c3...", "tipo": "string", "ttl_segundos": 86000, "valor_resumen": "en_preparacion"},
                    ]
                }
            },
        }
    },
)
async def get_redis_claves():
    return await infra_service.get_redis_claves()
