from typing import Optional

from fastapi import APIRouter, Query

from app.services import producto_service

router = APIRouter(prefix="/api/v1", tags=["Productos"])


@router.get(
    "/productos",
    summary="Listar catálogo de productos",
    description=(
        "Retorna productos del catálogo con paginación. "
        "Filtros opcionales: `pasillo_id` usa el índice `pasillo_id`; "
        "`search` realiza búsqueda de texto en el nombre usando el índice `productos_nombre_text` "
        "y ordena los resultados por relevancia (`textScore`). "
        "Ambos filtros pueden combinarse."
    ),
    responses={
        200: {
            "description": "Lista paginada de productos",
            "content": {
                "application/json": {
                    "example": {
                        "items": [
                            {
                                "_id": "665f1a2b3c4d5e6f7a8b9c2f",
                                "nombre": "Leche Entera 1L",
                                "precio": 4.50,
                                "stock": 120,
                                "pasillo_id": "665f1a2b3c4d5e6f7a8b9c1e",
                                "pasillo_nombre": "dairy eggs",
                                "departamento_nombre": "dairy eggs",
                            }
                        ],
                        "total": 250,
                        "page": 1,
                        "limit": 25,
                    }
                }
            },
        }
    },
)
async def get_productos(
    pasillo_id: Optional[str] = Query(None, description="Filtrar por ID de pasillo."),
    search: Optional[str] = Query(None, description="Búsqueda de texto en nombre.", min_length=2),
    page: int = Query(1, ge=1, description="Número de página (empieza en 1)"),
    limit: int = Query(25, ge=1, le=100, description="Productos por página"),
):
    return await producto_service.get_productos(
        pasillo_id=pasillo_id, search=search, page=page, limit=limit,
    )
