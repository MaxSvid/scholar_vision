from typing import Any
from database.connection import get_conn


async def fetch_all(query: str, params: Any = None) -> list[dict]:
    async with await get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            return await cur.fetchall()


async def fetch_one(query: str, params: Any = None) -> dict | None:
    async with await get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            return await cur.fetchone()


async def execute(query: str, params: Any = None) -> None:
    async with await get_conn() as conn:
        await conn.execute(query, params)
        await conn.commit()


async def execute_returning(query: str, params: Any = None) -> dict | None:
    """Run an INSERT … RETURNING and return the first row."""
    async with await get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
            await conn.commit()
            return await cur.fetchone()
