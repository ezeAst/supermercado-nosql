from typing import Optional

from fastapi import APIRouter, Query

from app.services import producto_service

router = APIRouter(prefix="/api/v1", tags=["Productos"])


@router.get(
    "/productos",
    summary="Listar catálogo de productos",
)
async def get_productos(
    pasillo_id: Optional[str] = Query(None, description="Filtrar por ID de pasillo."),
    departamento_id: Optional[str] = Query(None, description="Filtrar por ID de departamento."),
    search: Optional[str] = Query(None, description="Búsqueda de texto en nombre.", min_length=2),
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(25, ge=1, le=100, description="Productos por página"),
):
    return await producto_service.get_productos(
        pasillo_id=pasillo_id, departamento_id=departamento_id,
        search=search, page=page, limit=limit,
    )


@router.get(
    "/pasillos",
    summary="Listar pasillos para filtros",
)
async def get_pasillos():
    return await producto_service.get_pasillos()


@router.get(
    "/departamentos",
    summary="Listar departamentos para filtros",
)
async def get_departamentos():
    return await producto_service.get_departamentos()
