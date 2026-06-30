from typing import Literal, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services import almacen_service

router = APIRouter(prefix="/api/v1/almacen", tags=["Almacén"])


class CambiarEstadoBody(BaseModel):
    estado: Literal["registrado", "en_preparacion", "listo", "entregado"]


@router.get(
    "/pedidos/pendientes",
    summary="Productos pendientes agrupados por pasillo",
    description=(
        "Agrega todos los pedidos en estado `registrado` o `en_preparacion` usando el índice "
        "`{estado: 1}`, aplica `$unwind` sobre el array `productos` y agrupa con `$group` "
        "por `pasillo_id`, sumando la `cantidad_total` de cada producto a preparar. "
        "Útil para el equipo de almacén antes de armar los pedidos."
    ),
    responses={
        200: {
            "description": "Lista de pasillos con productos pendientes y cantidades totales",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "pasillo_id": "665f1a2b3c4d5e6f7a8b9c1e",
                            "pasillo_nombre": "Pasillo 4 - Lácteos y Refrigerados",
                            "productos": [
                                {
                                    "producto_id": "665f1a2b3c4d5e6f7a8b9c2f",
                                    "nombre": "Leche Entera 1L",
                                    "precio_unitario": 4.50,
                                    "cantidad_total": 12,
                                }
                            ],
                        }
                    ]
                }
            },
        }
    },
)
async def get_pedidos_pendientes(
    pasillo_id: Optional[str] = Query(
        None,
        description="Filtrar resultados a un único pasillo por su ID",
    ),
):
    return await almacen_service.get_pedidos_pendientes(pasillo_id=pasillo_id)


@router.get(
    "/pedidos",
    summary="Cola de pedidos pendientes (individuales)",
    description="Lista los pedidos con estado `registrado` o `en_preparacion`, ordenados por fecha de creación ascendente.",
)
async def get_pedidos_cola():
    return await almacen_service.get_pedidos_cola()


@router.patch(
    "/pedidos/{pedido_id}/estado",
    summary="Cambiar estado de un pedido",
    description="Actualiza el estado de un pedido. Útil para que el encargado marque avances: registrado → en_preparacion → listo → entregado.",
    responses={
        200: {"description": "Estado actualizado"},
        404: {"description": "Pedido no encontrado"},
        422: {"description": "Estado inválido"},
    },
)
async def cambiar_estado_pedido(pedido_id: str, body: CambiarEstadoBody):
    return await almacen_service.actualizar_estado_pedido(pedido_id, body.estado)
