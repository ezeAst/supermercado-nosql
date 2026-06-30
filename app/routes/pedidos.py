from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services import pedido_service

router = APIRouter(prefix="/api/v1", tags=["Pedidos"])


@router.get(
    "/usuarios/{usuario_id}/pedidos",
    summary="Historial de pedidos del usuario",
    description=(
        "Retorna los pedidos de un usuario ordenados por `fecha_creacion` descendente. "
        "Paginación por cursor: el valor de `siguiente_cursor` de la respuesta se pasa "
        "como parámetro `before` en la siguiente llamada. "
        "Usa el índice compuesto `{usuario_id: 1, fecha_creacion: -1}`."
    ),
    responses={
        200: {
            "description": "Lista paginada de pedidos con cursor para la siguiente página",
            "content": {
                "application/json": {
                    "example": {
                        "pedidos": [
                            {
                                "_id": "665f1a2b3c4d5e6f7a8b9c4b",
                                "usuario_id": "665f1a2b3c4d5e6f7a8b9c3a",
                                "productos": [
                                    {
                                        "producto_id": "665f1a2b3c4d5e6f7a8b9c2f",
                                        "nombre": "Leche Entera 1L",
                                        "precio_unitario": 4.50,
                                        "cantidad": 2,
                                        "pasillo_id": "665f1a2b3c4d5e6f7a8b9c1e",
                                        "pasillo_nombre": "Pasillo 4 - Lácteos y Refrigerados",
                                    }
                                ],
                                "total": 9.00,
                                "estado": "registrado",
                                "fecha_creacion": "2026-06-29T18:30:00+00:00",
                            }
                        ],
                        "siguiente_cursor": "2026-06-28T10:00:00+00:00",
                    }
                }
            },
        },
        404: {"description": "Usuario no encontrado"},
    },
)
async def get_pedidos_usuario(
    usuario_id: str,
    before: Optional[str] = Query(
        None,
        description="Cursor ISO 8601: valor de `siguiente_cursor` de la respuesta anterior",
        example="2026-06-28T10:00:00+00:00",
    ),
    limit: int = Query(20, ge=1, le=100, description="Máximo de pedidos a retornar"),
    estado: Optional[str] = Query(
        None,
        description="Filtrar por estado del pedido: `registrado`, `en_preparacion`, `entregado`, etc.",
    ),
):
    before_dt: Optional[datetime] = None
    if before:
        try:
            before_dt = datetime.fromisoformat(before.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail="El parámetro 'before' debe ser una fecha ISO 8601 válida",
            )

    return await pedido_service.get_pedidos_usuario(
        usuario_id=usuario_id,
        before=before_dt,
        limit=limit,
        estado=estado,
    )


@router.get(
    "/usuarios/{usuario_id}/pedidos/{pedido_id}",
    summary="Detalle de un pedido del usuario",
    description=(
        "Retorna el documento completo de un pedido verificando que pertenece al usuario. "
        "Si la clave `pedido_estado:{pedido_id}` existe en Redis, incluye el campo "
        "`estado_redis` con el valor en caché (RF04 — estado en tiempo real)."
    ),
    responses={
        200: {"description": "Documento completo del pedido"},
        404: {"description": "Usuario o pedido no encontrado, o el pedido no pertenece al usuario"},
    },
)
async def get_pedido_usuario(usuario_id: str, pedido_id: str):
    return await pedido_service.get_pedido_usuario(
        usuario_id=usuario_id,
        pedido_id=pedido_id,
    )
