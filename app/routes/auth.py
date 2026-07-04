import base64
import json
import unicodedata

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.db import mongo

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])


class LoginBody(BaseModel):
    email: str = Field(..., description="Correo del usuario")
    password: str = Field(..., description="Contraseña")


@router.post(
    "/login",
    summary="Iniciar sesión",
    description="Autentica al usuario por email. La contraseña debe coincidir con el nombre del usuario (demo). Retorna un token y los datos del usuario.",
    responses={
        200: {
            "description": "Login exitoso",
            "content": {
                "application/json": {
                    "example": {
                        "token": "eyJ1c2VyX2lkIjoiNjY1Zj...",
                        "usuario": {"_id": "...", "nombre": "Ana Torres", "email": "ana.torres@demo.supermercado.pe", "rol": "cliente"},
                    }
                }
            },
        },
        401: {"description": "Credenciales inválidas"},
    },
)
async def login(body: LoginBody):
    db = mongo.get_db()
    usuario = await db.usuarios.find_one({"email": body.email})
    if not usuario:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if usuario.get("password") and body.password != usuario["password"]:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    elif not usuario.get("password") and body.password != unicodedata.normalize("NFKD", usuario.get("nombre", "")).encode("ascii", "ignore").decode().lower().replace(" ", ""):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    payload = {"user_id": str(usuario["_id"]), "rol": usuario.get("rol", "cliente")}
    token = base64.b64encode(json.dumps(payload).encode()).decode()

    return {
        "token": token,
        "usuario": {
            "_id": str(usuario["_id"]),
            "nombre": usuario["nombre"],
            "email": usuario["email"],
            "rol": usuario.get("rol", "cliente"),
        },
    }


@router.get(
    "/me",
    summary="Obtener usuario actual",
    description="Retorna los datos del usuario autenticado según el token enviado en el header Authorization.",
)
async def get_me(request: Request):
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = json.loads(base64.b64decode(token).decode())
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")

    db = mongo.get_db()
    from bson import ObjectId
    usuario = await db.usuarios.find_one({"_id": ObjectId(payload["user_id"])})
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return {
        "_id": str(usuario["_id"]),
        "nombre": usuario["nombre"],
        "email": usuario["email"],
        "rol": usuario.get("rol", "cliente"),
    }
