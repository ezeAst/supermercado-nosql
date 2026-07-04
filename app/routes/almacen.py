from typing import Literal, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services import almacen_service

router = APIRouter(prefix="/api/v1/almacen", tags=["Almacén"])


class CambiarEstadoBody(BaseModel):
    estado: Literal["registrado", "en_preparacion", "listo_para_despacho", "despachado"]


class CambiarEstadoProductoBody(BaseModel):
    estado: Literal["pendiente", "en_pasillo", "listo"]


@router.get(
    "/pedidos/pendientes",
    summary="Productos pendientes agrupados por pasillo",
    description="Agrega todos los pedidos en estado `registrado` o `en_preparacion` usando el índice `{estado: 1}`, aplica `$unwind` sobre el array `productos` y agrupa con `$group` por `pasillo_id`, sumando la `cantidad_total` de cada producto a preparar.",
)
async def get_pedidos_pendientes(
    pasillo_id: Optional[str] = Query(None, description="Filtrar resultados a un único pasillo por su ID"),
):
    return await almacen_service.get_pedidos_pendientes(pasillo_id=pasillo_id)


@router.get(
    "/pedidos",
    summary="Cola de pedidos pendientes",
    description="Lista los pedidos con estado `registrado` o `en_preparacion`, ordenados por fecha de creación ascendente. Opcionalmente filtrar por estado.",
)
async def get_pedidos_cola(
    estado: Optional[str] = Query(None, description="Filtrar por estado: registrado, en_preparacion, listo_para_despacho, despachado"),
):
    return await almacen_service.get_pedidos_cola(estado_filter=estado)


@router.get(
    "/pedidos/{pedido_id}",
    summary="Detalle completo de un pedido",
    description="Retorna el detalle completo de un pedido, incluyendo el estado individual de cada producto (pendiente/en_pasillo/listo).",
)
async def get_pedido_detalle(pedido_id: str):
    return await almacen_service.get_pedido_detalle(pedido_id)


@router.patch(
    "/pedidos/{pedido_id}/estado",
    summary="Cambiar estado de un pedido",
    description="Actualiza el estado de un pedido: registrado → en_preparacion → listo_para_despacho → despachado.",
)
async def cambiar_estado_pedido(pedido_id: str, body: CambiarEstadoBody):
    return await almacen_service.actualizar_estado_pedido(pedido_id, body.estado)


@router.patch(
    "/pedidos/{pedido_id}/productos/{producto_id}/estado",
    summary="Cambiar estado de un producto individual en un pedido",
    description="Cambia el estado de preparación de un producto específico dentro de un pedido. Si todos los productos quedan en 'listo', el pedido se promueve automáticamente a 'listo_para_despacho'.",
)
async def cambiar_estado_producto(pedido_id: str, producto_id: str, body: CambiarEstadoProductoBody):
    return await almacen_service.actualizar_estado_producto(pedido_id, producto_id, body.estado)
