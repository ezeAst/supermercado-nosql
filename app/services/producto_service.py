from typing import Optional

from app.db import mongo


async def get_productos(
    pasillo_id: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 25,
) -> dict:
    db = mongo.get_db()

    query: dict = {}
    if pasillo_id:
        query["pasillo_id"] = pasillo_id
    if search:
        query["$text"] = {"$search": search}

    projection = {
        "_id": 1,
        "nombre": 1,
        "precio": 1,
        "stock": 1,
        "pasillo_id": 1,
        "pasillo_nombre": 1,
        "departamento_nombre": 1,
    }

    total = await db.productos.count_documents(query)

    skip = (page - 1) * limit

    if search:
        projection["score"] = {"$meta": "textScore"}
        cursor = (
            db.productos.find(query, projection)
            .sort([("score", {"$meta": "textScore"})])
            .skip(skip)
            .limit(limit)
        )
    else:
        cursor = (
            db.productos.find(query, projection)
            .skip(skip)
            .limit(limit)
        )

    docs = await cursor.to_list(length=limit)
    for doc in docs:
        doc["_id"] = str(doc["_id"])
        doc.pop("score", None)

    return {
        "items": docs,
        "total": total,
        "page": page,
        "limit": limit,
    }
