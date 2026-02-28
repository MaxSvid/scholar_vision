import os
import psycopg
from psycopg.rows import dict_row


def get_dsn() -> str:
    host     = os.getenv("POSTGRES_HOST", "localhost")
    port     = os.getenv("POSTGRES_PORT_HOST", "5432")
    user     = os.getenv("POSTGRES_USER", "tester")
    password = os.getenv("POSTGRES_PASSWORD", "sql_password")
    db       = os.getenv("POSTGRES_DB", "sql_db")
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


async def get_conn() -> psycopg.AsyncConnection:
    """Open a single async connection. Use as an async context manager."""
    return await psycopg.AsyncConnection.connect(get_dsn(), row_factory=dict_row)