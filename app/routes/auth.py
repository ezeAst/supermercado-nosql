import unicodedata

from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.db import mongo
from app.services import auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])


class LoginBody(BaseModel):
    email: str = Field(..., description="Correo del usuario")
    password: str = Field(..., description="Contraseña")


@router.get("/usuarios", summary="Listar usuarios por rol")
async def list_usuarios(
    rol: str = Query(..., description="Filtrar por rol: cliente o trabajador"),
):
    db = mongo.get_db(0)
    cursor = db.usuarios.find({"rol": rol}, {"_id": 1, "nombre": 1, "email": 1, "rol": 1})
    result = []
    async for doc in cursor:
        result.append({
            "_id": str(doc["_id"]),
            "nombre": doc["nombre"],
            "email": doc["email"],
            "rol": doc.get("rol", "cliente"),
        })
    return result


@router.post("/login", summary="Iniciar sesión")
async def login(body: LoginBody):
    db = mongo.get_db(0)  # usuarios en shard 0
    usuario = await db.usuarios.find_one({"email": body.email})
    if not usuario:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    expected = unicodedata.normalize("NFKD", usuario.get("nombre", "")).encode(
        "ascii", "ignore"
    ).decode().lower().replace(" ", "")

    stored_pw = usuario.get("password", "")
    if stored_pw:
        if body.password != stored_pw:
            raise HTTPException(status_code=401, detail="Credenciales inválidas")
    elif body.password != expected:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = await auth_service.crear_sesion(str(usuario["_id"]), usuario.get("rol", "cliente"))

    return {
        "token": token,
        "usuario": {
            "_id": str(usuario["_id"]),
            "nombre": usuario["nombre"],
            "email": usuario["email"],
            "rol": usuario.get("rol", "cliente"),
        },
    }


@router.get("/me", summary="Obtener usuario actual")
async def get_me(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")

    sesion = await auth_service.validar_sesion(token)
    if not sesion:
        raise HTTPException(status_code=401, detail="Sesión expirada o inválida")

    db = mongo.get_db(0)  # usuarios en shard 0
    try:
        oid = ObjectId(sesion["user_id"])
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

    usuario = await db.usuarios.find_one({"_id": oid})
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return {
        "_id": str(usuario["_id"]),
        "nombre": usuario["nombre"],
        "email": usuario["email"],
        "rol": usuario.get("rol", "cliente"),
    }


@router.post("/logout", summary="Cerrar sesión")
async def logout(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token:
        await auth_service.eliminar_sesion(token)
    return {"ok": True}
