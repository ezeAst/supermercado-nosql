from typing import Optional

from fastapi import APIRouter, Query

from app.services import producto_service

router = APIRouter(prefix="/api/v1", tags=["Productos"])


@router.get(
    "/productos",
    summary="Listar catálogo de productos",
    description=(
        "Retorna productos del catálogo (máximo 500). "
        "Filtros opcionales: `pasillo_id` usa el índice `pasillo_id`; "
        "`search` realiza búsqueda de texto en el nombre usando el índice `productos_nombre_text` "
        "y ordena los resultados por relevancia (`textScore`). "
        "Ambos filtros pueden combinarse."
    ),
    responses={
        200: {
            "description": "Lista de productos",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "_id": "665f1a2b3c4d5e6f7a8b9c2f",
                            "nombre": "Leche Entera 1L",
                            "precio": 4.50,
                            "stock": 120,
                            "pasillo_id": "665f1a2b3c4d5e6f7a8b9c1e",
                            "pasillo_nombre": "dairy eggs",
                            "departamento_nombre": "dairy eggs",
                        }
                    ]
                }
            },
        }
    },
)
async def get_productos(
    pasillo_id: Optional[str] = Query(
        None,
        description="Filtrar por ID de pasillo. Usa el índice `pasillo_id`.",
    ),
    search: Optional[str] = Query(
        None,
        description="Búsqueda de texto en nombre. Usa el índice `productos_nombre_text`. Mínimo 2 caracteres.",
        min_length=2,
    ),
):
    return await producto_service.get_productos(pasillo_id=pasillo_id, search=search)
