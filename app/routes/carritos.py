from typing import Literal

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.services import carrito_service

router = APIRouter(prefix="/api/v1", tags=["Carritos"])


class AgregarItemBody(BaseModel):
    producto_id: str = Field(..., description="ID del producto a agregar")
    cantidad: int = Field(1, ge=1, description="Cantidad a agregar")


class SetItemBody(BaseModel):
    cantidad: int = Field(..., ge=0, description="Cantidad exacta. 0 para eliminar el producto del carrito.")


@router.post(
    "/carritos/{usuario_id}/productos",
    status_code=200,
    summary="Agregar producto al carrito",
    description=(
        "Incrementa la cantidad del producto en el carrito del usuario usando `HINCRBY`. "
        "Si la cantidad resultante es ≤ 0, elimina el producto del carrito. "
        "Establece un TTL de 24h en la clave `carrito:{usuario_id}`."
    ),
)
async def agregar_item(usuario_id: str, body: AgregarItemBody):
    await carrito_service.add_item_carrito(usuario_id, body.producto_id, body.cantidad)
    return {"ok": True}


@router.put(
    "/carritos/{usuario_id}/productos/{producto_id}",
    status_code=200,
    summary="Actualizar cantidad exacta de un producto en el carrito",
    description=(
        "Usa `HSET carrito:{usuario_id} {producto_id} {cantidad}` para establecer "
        "la cantidad exacta. Si `cantidad` es 0, elimina el campo con `HDEL`. "
        "TTL de 24h se renueva al actualizar."
    ),
    responses={
        200: {"description": "Cantidad actualizada"},
    },
)
async def set_item(usuario_id: str, producto_id: str, body: SetItemBody):
    await carrito_service.set_item_carrito(usuario_id, producto_id, body.cantidad)
    return {"ok": True}


@router.delete(
    "/carritos/{usuario_id}/productos/{producto_id}",
    status_code=200,
    summary="Eliminar un producto del carrito",
    description="Usa `HDEL carrito:{usuario_id} {producto_id}`. Idempotente: no falla si el producto no estaba.",
    responses={
        200: {"description": "Producto eliminado del carrito"},
    },
)
async def delete_item(usuario_id: str, producto_id: str):
    await carrito_service.remove_item_carrito(usuario_id, producto_id)
    return {"ok": True}


@router.delete(
    "/carritos/{usuario_id}",
    status_code=200,
    summary="Vaciar carrito completo",
    description=(
        "Elimina la clave completa `carrito:{usuario_id}` de Redis con `DEL`. "
        "Idempotente: no falla si el carrito ya estaba vacío o no existía."
    ),
    responses={
        200: {"description": "Carrito eliminado"},
    },
)
async def clear_carrito(usuario_id: str):
    await carrito_service.clear_carrito(usuario_id)
    return {"ok": True}


@router.get(
    "/carritos/{usuario_id}",
    summary="Ver carrito actual",
    description=(
        "Lee el carrito del usuario desde Redis (`HGETALL carrito:{usuario_id}`) "
        "y enriquece cada item con nombre, precio y pasillo desde MongoDB."
    ),
)
async def get_carrito(usuario_id: str):
    return await carrito_service.get_carrito(usuario_id)


class ConfirmarCarritoBody(BaseModel):
    direccion_entrega: str = Field(
        ...,
        description="Dirección de entrega del pedido",
    )
    metodo_pago: Literal["tarjeta", "efectivo"] = Field(
        ...,
        description="Método de pago seleccionado",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "direccion_entrega": "Av. Universitaria 1801, Lima",
                "metodo_pago": "tarjeta",
            }
        }
    }


@router.post(
    "/carritos/{usuario_id}/confirmar",
    status_code=201,
    summary="Confirmar carrito y crear pedido",
    description=(
        "Lee el carrito del usuario desde Redis (`HGETALL carrito:{usuario_id}`). "
        "Valida el stock de cada producto en MongoDB y crea el pedido con los productos "
        "embebidos como snapshot (precio y nombre al momento de la compra). "
        "Soporta idempotencia mediante el header `Idempotency-Key`: si ya existe un pedido "
        "con esa clave se retorna 409 con el pedido existente sin volver a procesarlo. "
        "Si la escritura en MongoDB es exitosa, elimina el carrito de Redis con `DEL`. "
        "Un fallo en el `DEL` no es crítico: el TTL de 24h lo limpiará."
    ),
    responses={
        201: {
            "description": "Pedido creado exitosamente",
            "content": {
                "application/json": {
                    "example": {
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
                        "direccion_entrega": "Av. Universitaria 1801, Lima",
                        "metodo_pago": "tarjeta",
                        "idempotency_key": "550e8400-e29b-41d4-a716-446655440000",
                    }
                }
            },
        },
        400: {"description": "Carrito vacío, stock insuficiente o producto no encontrado"},
        409: {"description": "Pedido ya creado con este Idempotency-Key (responde con el pedido existente)"},
        422: {"description": "Datos de entrada inválidos"},
    },
)
async def confirmar_carrito(
    usuario_id: str,
    body: ConfirmarCarritoBody,
    idempotency_key: str = Header(
        ...,
        alias="Idempotency-Key",
        description="UUID único por intento de compra para garantizar idempotencia",
    ),
):
    pedido, es_duplicado = await carrito_service.confirmar_carrito(
        usuario_id=usuario_id,
        direccion_entrega=body.direccion_entrega,
        metodo_pago=body.metodo_pago,
        idempotency_key=idempotency_key,
    )
    status = 409 if es_duplicado else 201
    return JSONResponse(status_code=status, content=pedido)
