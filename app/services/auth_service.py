import json
from typing import Optional

from app.db import redis as redis_db

SESSION_TTL = 86400  # 24h


async def crear_sesion(user_id: str, rol: str) -> str:
    r = redis_db.get_redis()
    payload = json.dumps({"user_id": user_id, "rol": rol})
    await r.set(f"sesion:{user_id}", payload, ex=SESSION_TTL)
    await redis_db.log_redis_op(f"sesion:{user_id}", "write", "crear_sesion")
    return user_id


async def validar_sesion(token: str) -> Optional[dict]:
    r = redis_db.get_redis()
    raw = await r.get(f"sesion:{token}")
    if raw is not None:
        await redis_db.log_redis_op(f"sesion:{token}", "read", "validar_sesion")
        return json.loads(raw)
    return None


async def eliminar_sesion(token: str) -> None:
    r = redis_db.get_redis()
    await r.delete(f"sesion:{token}")
    await redis_db.log_redis_op(f"sesion:{token}", "write", "eliminar_sesion")
