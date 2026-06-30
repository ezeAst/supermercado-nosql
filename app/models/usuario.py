from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UsuarioBase(BaseModel):
    nombre: str = Field(..., description="Nombre completo del usuario", examples=["Ana Torres"])
    email: EmailStr = Field(..., description="Correo electrónico del usuario")
    telefono: Optional[str] = Field(None, description="Número de teléfono del usuario")
    direccion: Optional[str] = Field(None, description="Dirección de entrega del usuario")


class UsuarioCreate(UsuarioBase):
    password: str = Field(..., min_length=8, description="Contraseña en texto plano, se hashea antes de guardar")

    model_config = {
        "json_schema_extra": {
            "example": {
                "nombre": "Ana Torres",
                "email": "ana.torres@example.com",
                "telefono": "+51 987654321",
                "direccion": "Av. Siempre Viva 123, Lima",
                "password": "contraseñaSegura123"
            }
        }
    }


class UsuarioResponse(UsuarioBase):
    id: str = Field(..., alias="_id", description="ID del usuario")

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "665f1a2b3c4d5e6f7a8b9c3a",
                "nombre": "Ana Torres",
                "email": "ana.torres@example.com",
                "telefono": "+51 987654321",
                "direccion": "Av. Siempre Viva 123, Lima"
            }
        }
    }
