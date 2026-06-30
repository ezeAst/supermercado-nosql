from pydantic import BaseModel, Field


class PasilloBase(BaseModel):
    nombre: str = Field(..., description="Nombre del pasillo", examples=["Pasillo 4 - Lácteos y Refrigerados"])
    departamento_id: str = Field(..., description="ID del departamento al que pertenece el pasillo")
    departamento_nombre: str = Field(
        ..., description="Nombre del departamento, denormalizado para evitar joins"
    )


class PasilloCreate(PasilloBase):
    model_config = {
        "json_schema_extra": {
            "example": {
                "nombre": "Pasillo 4 - Lácteos y Refrigerados",
                "departamento_id": "665f1a2b3c4d5e6f7a8b9c0d",
                "departamento_nombre": "Lácteos"
            }
        }
    }


class PasilloResponse(PasilloBase):
    id: str = Field(..., alias="_id", description="ID del pasillo")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "665f1a2b3c4d5e6f7a8b9c1e",
                "nombre": "Pasillo 4 - Lácteos y Refrigerados",
                "departamento_id": "665f1a2b3c4d5e6f7a8b9c0d",
                "departamento_nombre": "Lácteos"
            }
        }
    }
