"""
Activity import router.

POST   /api/activity/app-usage?session_id=...   – import app usage JSON
GET    /api/activity/app-usage?session_id=...   – list imports for session
GET    /api/activity/app-usage/{id}             – detail + entries
DELETE /api/activity/app-usage/{id}             – delete import + cascade

POST   /api/activity/study-logs?session_id=...  – import study sessions JSON
GET    /api/activity/study-logs?session_id=...  – list imports
GET    /api/activity/study-logs/{id}            – detail + entries
DELETE /api/activity/study-logs/{id}            – delete import + cascade
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from database.execute import execute, execute_returning, fetch_all, fetch_one
from parsers.app_usage_parser import parse_app_usage_json, summarise_app_usage
from parsers.study_parser import parse_study_json

router = APIRouter(prefix="/api/activity", tags=["activity"])

MAX_BODY_BYTES = 5 * 1024 * 1024  # 5 MB


# ── App Usage ─────────────────────────────────────────────────────────────────

@router.post("/app-usage")
async def import_app_usage(
    request:    Request,
    session_id: str = Query(...),
):
    content = await request.body()
    if len(content) > MAX_BODY_BYTES:
        raise HTTPException(413, "Payload exceeds 5 MB limit")

    result = parse_app_usage_json(content)
    if result.error:
        raise HTTPException(422, f"Parse error: {result.error}")
    if not result.logs:
        raise HTTPException(422, "No valid log entries found in payload")

    row = await execute_returning(
        """
        INSERT INTO app_usage_imports
            (session_id, sync_timestamp, client_version, log_count)
        VALUES (%s, %s, %s, %s)
        RETURNING import_id, imported_at, log_count
        """,
        (session_id, result.sync_timestamp, result.client_version, len(result.logs)),
    )
    import_id = row["import_id"]

    for e in result.logs:
        await execute(
            """
            INSERT INTO app_usage_entries
                (import_id, app_name, category, duration_mins, logged_date)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (import_id, e.app_name, e.category, e.duration_mins, e.logged_date),
        )

    return {
        "import_id":   str(import_id),
        "log_count":   len(result.logs),
        "summary":     summarise_app_usage(result),
        "imported_at": str(row["imported_at"]),
    }


@router.get("/app-usage")
async def list_app_usage_imports(session_id: str = Query(...)):
    rows = await fetch_all(
        """
        SELECT import_id, sync_timestamp, client_version, log_count, imported_at
        FROM   app_usage_imports
        WHERE  session_id = %s
        ORDER  BY imported_at DESC
        """,
        (session_id,),
    )
    return {"imports": rows}


@router.get("/app-usage/{import_id}")
async def get_app_usage_import(import_id: str):
    row = await fetch_one(
        "SELECT * FROM app_usage_imports WHERE import_id = %s", (import_id,)
    )
    if not row:
        raise HTTPException(404, "Import not found")

    entries = await fetch_all(
        """
        SELECT app_name, category, duration_mins, logged_date
        FROM   app_usage_entries
        WHERE  import_id = %s
        ORDER  BY logged_date, app_name
        """,
        (import_id,),
    )
    return {"import": row, "entries": entries}


@router.delete("/app-usage/{import_id}")
async def delete_app_usage_import(import_id: str):
    row = await fetch_one(
        "SELECT import_id FROM app_usage_imports WHERE import_id = %s", (import_id,)
    )
    if not row:
        raise HTTPException(404, "Import not found")
    await execute("DELETE FROM app_usage_imports WHERE import_id = %s", (import_id,))
    return {"deleted": import_id}


# ── Study Logs ────────────────────────────────────────────────────────────────

@router.post("/study-logs")
async def import_study_logs(
    request:    Request,
    session_id: str = Query(...),
):
    content = await request.body()
    if len(content) > MAX_BODY_BYTES:
        raise HTTPException(413, "Payload exceeds 5 MB limit")

    result = parse_study_json(content)
    if result.error:
        raise HTTPException(422, f"Parse error: {result.error}")
    if not result.sessions:
        raise HTTPException(422, "No valid study sessions found in payload")

    total_mins = sum(s.duration_mins for s in result.sessions)

    row = await execute_returning(
        """
        INSERT INTO study_imports
            (session_id, sync_timestamp, client_version, session_count)
        VALUES (%s, %s, %s, %s)
        RETURNING import_id, imported_at, session_count
        """,
        (session_id, result.sync_timestamp, result.client_version, len(result.sessions)),
    )
    import_id = row["import_id"]

    for s in result.sessions:
        await execute(
            """
            INSERT INTO study_entries
                (import_id, started_at, ended_at, duration_mins, subject_tag, breaks_taken, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (import_id, s.started_at, s.ended_at, s.duration_mins,
             s.subject_tag, s.breaks_taken, s.notes),
        )

    return {
        "import_id":     str(import_id),
        "session_count": len(result.sessions),
        "total_hours":   round(total_mins / 60, 1),
        "imported_at":   str(row["imported_at"]),
    }


@router.get("/study-logs")
async def list_study_imports(session_id: str = Query(...)):
    rows = await fetch_all(
        """
        SELECT import_id, sync_timestamp, client_version, session_count, imported_at
        FROM   study_imports
        WHERE  session_id = %s
        ORDER  BY imported_at DESC
        """,
        (session_id,),
    )
    return {"imports": rows}


@router.get("/study-logs/{import_id}")
async def get_study_import(import_id: str):
    row = await fetch_one(
        "SELECT * FROM study_imports WHERE import_id = %s", (import_id,)
    )
    if not row:
        raise HTTPException(404, "Import not found")

    entries = await fetch_all(
        """
        SELECT started_at, ended_at, duration_mins, subject_tag, breaks_taken, notes
        FROM   study_entries
        WHERE  import_id = %s
        ORDER  BY started_at
        """,
        (import_id,),
    )

    total_mins = sum(e["duration_mins"] for e in entries)
    avg_breaks = round(sum(e["breaks_taken"] for e in entries) / len(entries), 1) if entries else 0

    return {
        "import":      row,
        "entries":     entries,
        "total_hours": round(total_mins / 60, 1),
        "avg_breaks":  avg_breaks,
    }


@router.delete("/study-logs/{import_id}")
async def delete_study_import(import_id: str):
    row = await fetch_one(
        "SELECT import_id FROM study_imports WHERE import_id = %s", (import_id,)
    )
    if not row:
        raise HTTPException(404, "Import not found")
    await execute("DELETE FROM study_imports WHERE import_id = %s", (import_id,))
    return {"deleted": import_id}
