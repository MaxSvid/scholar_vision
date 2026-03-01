"""
Cohort student table — DDL, sync CRUD (used by seed script), and async
fetch (used by ml_engine at FastAPI startup).

DB column names use snake_case; Python feature names are camelCase.
The module handles the mapping transparently.
"""

import logging
import os

import pandas as pd
import psycopg
from psycopg.rows import dict_row

log = logging.getLogger(__name__)

# Column mapping

# Python / CSV  →  database column
PY_TO_DB: dict[str, str] = {
    "studyHours":    "study_hours",
    "attentionSpan": "attention_span",
    "focusRatio":    "focus_ratio",
    "sleepHours":    "sleep_hours",
    "breakFreq":     "break_freq",
    "currentGrade":  "current_grade",
}
DB_TO_PY: dict[str, str] = {v: k for k, v in PY_TO_DB.items()}

FEATURES = ["studyHours", "attentionSpan", "focusRatio", "sleepHours", "breakFreq"]
TARGET   = "currentGrade"
ALL_COLS = FEATURES + [TARGET]

DB_COLS  = [PY_TO_DB[c] for c in ALL_COLS]

# DDL 

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS cohort_students (
    id             SERIAL   PRIMARY KEY,
    study_hours    REAL     NOT NULL,
    attention_span REAL     NOT NULL,
    focus_ratio    REAL     NOT NULL,
    sleep_hours    REAL     NOT NULL,
    break_freq     REAL     NOT NULL,
    current_grade  REAL     NOT NULL,
    seeded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

INSERT_SQL = (
    "INSERT INTO cohort_students "
    "(study_hours, attention_span, focus_ratio, sleep_hours, break_freq, current_grade) "
    "VALUES (%s, %s, %s, %s, %s, %s)"
)

SELECT_SQL = (
    "SELECT study_hours, attention_span, focus_ratio, "
    "sleep_hours, break_freq, current_grade "
    "FROM cohort_students ORDER BY id"
)

# Connection helpers 

def _sync_dsn() -> str:
    host = os.getenv("POSTGRES_HOST",      "localhost")
    port = os.getenv("POSTGRES_PORT_HOST", "5432")
    user = os.getenv("POSTGRES_USER",      "tester")
    pw   = os.getenv("POSTGRES_PASSWORD",  "sql_password")
    db   = os.getenv("POSTGRES_DB",        "sql_db")
    return f"postgresql://{user}:{pw}@{host}:{port}/{db}"


# Sync API (used by scripts/seed_db.py) 

def sync_create_table() -> None:
    with psycopg.connect(_sync_dsn()) as conn:
        conn.execute(CREATE_SQL)
        conn.commit()
    log.info("cohort_students table ensured.")


def sync_count() -> int:
    with psycopg.connect(_sync_dsn()) as conn:
        row = conn.execute("SELECT COUNT(*) FROM cohort_students").fetchone()
    return row[0] if row else 0


def sync_bulk_insert(df: pd.DataFrame) -> int:
    rows = [
        (
            float(row.studyHours),
            float(row.attentionSpan),
            float(row.focusRatio),
            float(row.sleepHours),
            float(row.breakFreq),
            float(row.currentGrade),
        )
        for row in df[ALL_COLS].itertuples(index=False)
    ]
    with psycopg.connect(_sync_dsn()) as conn:
        with conn.cursor() as cur:
            cur.executemany(INSERT_SQL, rows)
        conn.commit()
    return len(rows)


def sync_truncate() -> None:
    with psycopg.connect(_sync_dsn()) as conn:
        conn.execute("TRUNCATE TABLE cohort_students RESTART IDENTITY")
        conn.commit()


# Async API (used by ml_engine, called from FastAPI lifespan) 

async def async_fetch_cohort_df() -> pd.DataFrame | None:
    """
    Fetch all cohort rows from the DB and return a DataFrame with camelCase
    column names matching FEATURES + TARGET.  Returns None on any error.
    """
    try:
        # Use a fresh async connection (not the dict_row one) for simplicity
        async with await psycopg.AsyncConnection.connect(_sync_dsn()) as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(SELECT_SQL)
                rows = await cur.fetchall()

        if not rows:
            log.warning("cohort_students table is empty — peer mode will use CSV fallback.")
            return None

        df = pd.DataFrame(rows).rename(columns=DB_TO_PY)
        log.info("Cohort loaded from DB: %d rows.", len(df))
        return df

    except Exception as exc:
        log.warning("Could not fetch cohort from DB (%s). Peer mode will use CSV.", exc)
        return None
