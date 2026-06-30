from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class ProductoPedido(BaseModel):
    """Snapshot de un producto al momento de la compra, embebido dentro del pedido."""

    producto_id: str = Field(..., description="ID del producto original en la colección productos")
    nombre: str = Field(..., description="Nombre del producto al momento de la compra")
    precio_unitario: float = Field(..., gt=0, description="Precio unitario al momento de la compra")
    cantidad: int = Field(..., gt=0, description="Cantidad comprada")
    pasillo_id: str = Field(..., description="ID del pasillo al momento de la compra")
    pasillo_nombre: str = Field(..., description="Nombre del pasillo al momento de la compra")


class PedidoBase(BaseModel):
    usuario_id: str = Field(..., description="ID del usuario que realizó el pedido")
    productos: List[ProductoPedido] = Field(
        ..., description="Lista de productos embebidos como snapshot al momento de la compra"
    )
    total: float = Field(..., gt=0, description="Monto total del pedido")
    estado: str = Field(..., description="Estado del pedido", examples=["pendiente", "confirmado", "enviado", "entregado"])
    fecha_creacion: datetime = Field(..., description="Fecha y hora de creación del pedido")


class PedidoCreate(PedidoBase):
    model_config = {
        "json_schema_extra": {
            "example": {
                "usuario_id": "665f1a2b3c4d5e6f7a8b9c3a",
                "productos": [
                    {
                        "producto_id": "665f1a2b3c4d5e6f7a8b9c2f",
                        "nombre": "Leche Entera 1L",
                        "precio_unitario": 4.50,
                        "cantidad": 2,
                        "pasillo_id": "665f1a2b3c4d5e6f7a8b9c1e",
                        "pasillo_nombre": "Pasillo 4 - Lácteos y Refrigerados"
                    }
                ],
                "total": 9.00,
                "estado": "pendiente",
                "fecha_creacion": "2026-06-29T18:30:00Z"
            }
        }
    }


class PedidoResponse(PedidoBase):
    id: str = Field(..., alias="_id", description="ID del pedido")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
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
                        "pasillo_nombre": "Pasillo 4 - Lácteos y Refrigerados"
                    }
                ],
                "total": 9.00,
                "estado": "pendiente",
                "fecha_creacion": "2026-06-29T18:30:00Z"
            }
        }
    }
