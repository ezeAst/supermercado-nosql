from pydantic import BaseModel, Field


class ProductoBase(BaseModel):
    nombre: str = Field(..., description="Nombre del producto", examples=["Leche Entera 1L"])
    precio: float = Field(..., gt=0, description="Precio unitario del producto")
    stock: int = Field(..., ge=0, description="Cantidad disponible en inventario")
    pasillo_id: str = Field(..., description="ID del pasillo al que pertenece el producto")
    pasillo_nombre: str = Field(..., description="Nombre del pasillo, denormalizado")
    departamento_id: str = Field(..., description="ID del departamento al que pertenece el producto")
    departamento_nombre: str = Field(..., description="Nombre del departamento, denormalizado")


class ProductoCreate(ProductoBase):
    model_config = {
        "json_schema_extra": {
            "example": {
                "nombre": "Leche Entera 1L",
                "precio": 4.50,
                "stock": 120,
                "pasillo_id": "665f1a2b3c4d5e6f7a8b9c1e",
                "pasillo_nombre": "Pasillo 4 - Lácteos y Refrigerados",
                "departamento_id": "665f1a2b3c4d5e6f7a8b9c0d",
                "departamento_nombre": "Lácteos"
            }
        }
    }


class ProductoResponse(ProductoBase):
    id: str = Field(..., alias="_id", description="ID del producto")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "665f1a2b3c4d5e6f7a8b9c2f",
                "nombre": "Leche Entera 1L",
                "precio": 4.50,
                "stock": 120,
                "pasillo_id": "665f1a2b3c4d5e6f7a8b9c1e",
                "pasillo_nombre": "Pasillo 4 - Lácteos y Refrigerados",
                "departamento_id": "665f1a2b3c4d5e6f7a8b9c0d",
                "departamento_nombre": "Lácteos"
            }
        }
    }
