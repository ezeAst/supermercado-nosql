from pydantic import BaseModel, Field


class DepartamentoBase(BaseModel):
    nombre: str = Field(..., description="Nombre del departamento", examples=["Lácteos"])


class DepartamentoCreate(DepartamentoBase):
    model_config = {
        "json_schema_extra": {
            "example": {
                "nombre": "Lácteos"
            }
        }
    }


class DepartamentoResponse(DepartamentoBase):
    id: str = Field(..., alias="_id", description="ID del departamento")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "665f1a2b3c4d5e6f7a8b9c0d",
                "nombre": "Lácteos"
            }
        }
    }
