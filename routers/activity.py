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

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from database.execute import execute, execute_returning, fetch_all, fetch_one
from parsers.app_usage_parser import parse_app_usage_json, summarise_app_usage
from parsers.study_parser import parse_study_json

router = APIRouter(prefix="/api/activity", tags=["activity"])

MAX_BODY_BYTES = 5 * 1024 * 1024  # 5 MB

VALID_CATEGORIES = {"Productive", "Neutral", "Distracting"}


class ManualStudyEntry(BaseModel):
    subject: str = ''
    hours: float
    date: str      # YYYY-MM-DD
    notes: str = ''


class ManualAppEntry(BaseModel):
    app: str
    hours: float
    date: str      # YYYY-MM-DD
    category: str = 'Neutral'


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
          AND  client_version IS DISTINCT FROM 'manual'
        ORDER  BY imported_at DESC
        """,
        (session_id,),
    )

    stats = await fetch_one(
        """
        SELECT
            COALESCE(SUM(ae.duration_mins), 0)                                                           AS total_mins,
            COALESCE(SUM(CASE WHEN ae.category = 'Productive'   THEN ae.duration_mins ELSE 0 END), 0)   AS productive_mins,
            COALESCE(SUM(CASE WHEN ae.category = 'Distracting'  THEN ae.duration_mins ELSE 0 END), 0)   AS distracting_mins
        FROM app_usage_entries ae
        JOIN app_usage_imports ai ON ai.import_id = ae.import_id
        WHERE ai.session_id = %s
        """,
        (session_id,),
    )

    by_app = await fetch_all(
        """
        SELECT ae.app_name, MAX(ae.category) AS category, SUM(ae.duration_mins) AS total_mins
        FROM   app_usage_entries ae
        JOIN   app_usage_imports ai ON ai.import_id = ae.import_id
        WHERE  ai.session_id = %s
        GROUP  BY ae.app_name
        ORDER  BY total_mins DESC
        """,
        (session_id,),
    )

    manual_entries = await fetch_all(
        """
        SELECT ae.entry_id, ae.app_name, ae.category, ae.duration_mins,
               ae.logged_date::text AS logged_date
        FROM app_usage_entries ae
        JOIN app_usage_imports ai ON ai.import_id = ae.import_id
        WHERE ai.session_id = %s AND ai.client_version = 'manual'
        ORDER BY ae.logged_date DESC, ae.entry_id DESC
        """,
        (session_id,),
    )

    return {
        "imports": rows,
        "summary": {
            "total_mins":      int(stats["total_mins"])       if stats else 0,
            "productive_mins": int(stats["productive_mins"])  if stats else 0,
            "distracting_mins": int(stats["distracting_mins"]) if stats else 0,
            "by_app": [
                {"app_name": a["app_name"], "category": a["category"], "total_mins": int(a["total_mins"])}
                for a in by_app
            ],
        },
        "manual_entries": [dict(e) for e in manual_entries],
    }


@router.post("/app-usage/manual")
async def add_manual_app_entry(body: ManualAppEntry, session_id: str = Query(...)):
    try:
        datetime.strptime(body.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, "date must be YYYY-MM-DD")

    category = body.category if body.category in VALID_CATEGORIES else "Neutral"
    duration_mins = max(1, int(body.hours * 60))

    import_row = await execute_returning(
        """
        INSERT INTO app_usage_imports
            (session_id, sync_timestamp, client_version, log_count)
        VALUES (%s, NOW(), 'manual', 1)
        RETURNING import_id
        """,
        (session_id,),
    )
    import_id = import_row["import_id"]

    entry_row = await execute_returning(
        """
        INSERT INTO app_usage_entries
            (import_id, app_name, category, duration_mins, logged_date)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING entry_id
        """,
        (import_id, body.app, category, duration_mins, body.date),
    )
    return {"entry_id": entry_row["entry_id"], "import_id": str(import_id)}


@router.delete("/app-usage/manual/{entry_id}")
async def delete_manual_app_entry(entry_id: int, session_id: str = Query(...)):
    entry = await fetch_one(
        """
        SELECT ae.entry_id, ae.import_id, ai.client_version
        FROM app_usage_entries ae
        JOIN app_usage_imports ai ON ai.import_id = ae.import_id
        WHERE ae.entry_id = %s AND ai.session_id = %s
        """,
        (entry_id, session_id),
    )
    if not entry or entry["client_version"] != "manual":
        raise HTTPException(404, "Manual entry not found")

    import_id = entry["import_id"]
    await execute("DELETE FROM app_usage_entries WHERE entry_id = %s", (entry_id,))
    await execute("DELETE FROM app_usage_imports WHERE import_id = %s", (import_id,))
    return {"deleted": entry_id}


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
          AND  client_version IS DISTINCT FROM 'manual'
        ORDER  BY imported_at DESC
        """,
        (session_id,),
    )

    stats = await fetch_one(
        """
        SELECT COUNT(*) AS total_sessions, COALESCE(SUM(se.duration_mins), 0) AS total_mins
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
        """,
        (session_id,),
    )

    daily = await fetch_all(
        """
        SELECT se.started_at::date AS day,
               ROUND(SUM(se.duration_mins)::numeric / 60.0, 2) AS hours
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
          AND se.started_at::date >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY se.started_at::date
        ORDER BY day
        """,
        (session_id,),
    )

    subject_rows = await fetch_all(
        """
        SELECT DISTINCT se.subject_tag
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
          AND se.subject_tag IS NOT NULL
          AND se.subject_tag <> ''
        ORDER BY se.subject_tag
        """,
        (session_id,),
    )

    manual_entries = await fetch_all(
        """
        SELECT se.entry_id, se.subject_tag, se.duration_mins,
               se.started_at::date::text AS logged_date, se.notes
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s AND si.client_version = 'manual'
        ORDER BY se.started_at DESC
        """,
        (session_id,),
    )

    total_sessions = int(stats["total_sessions"]) if stats else 0
    total_mins     = int(stats["total_mins"])      if stats else 0
    total_hours    = round(total_mins / 60, 1)

    return {
        "imports": rows,
        "summary": {
            "total_sessions":    total_sessions,
            "total_hours":       total_hours,
            "avg_session_hours": round(total_hours / total_sessions, 1) if total_sessions else 0,
            "last_7_days": [
                {"date": str(d["day"]), "hours": float(d["hours"])}
                for d in daily
            ],
            "subjects": [r["subject_tag"] for r in subject_rows],
        },
        "manual_entries": [dict(e) for e in manual_entries],
    }


@router.post("/study-logs/manual")
async def add_manual_study_entry(body: ManualStudyEntry, session_id: str = Query(...)):
    try:
        parsed_date = datetime.strptime(body.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, "date must be YYYY-MM-DD")

    duration_mins = max(1, int(body.hours * 60))
    started_at = parsed_date.replace(hour=9, minute=0, second=0)
    ended_at   = started_at + timedelta(minutes=duration_mins)

    import_row = await execute_returning(
        """
        INSERT INTO study_imports
            (session_id, sync_timestamp, client_version, session_count)
        VALUES (%s, NOW(), 'manual', 1)
        RETURNING import_id
        """,
        (session_id,),
    )
    import_id = import_row["import_id"]

    entry_row = await execute_returning(
        """
        INSERT INTO study_entries
            (import_id, started_at, ended_at, duration_mins, subject_tag, breaks_taken, notes)
        VALUES (%s, %s, %s, %s, %s, 0, %s)
        RETURNING entry_id
        """,
        (import_id, started_at, ended_at, duration_mins, body.subject or None, body.notes or None),
    )
    return {"entry_id": entry_row["entry_id"], "import_id": str(import_id)}


@router.delete("/study-logs/manual/{entry_id}")
async def delete_manual_study_entry(entry_id: int, session_id: str = Query(...)):
    entry = await fetch_one(
        """
        SELECT se.entry_id, se.import_id, si.client_version
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE se.entry_id = %s AND si.session_id = %s
        """,
        (entry_id, session_id),
    )
    if not entry or entry["client_version"] != "manual":
        raise HTTPException(404, "Manual entry not found")

    import_id = entry["import_id"]
    await execute("DELETE FROM study_entries WHERE entry_id = %s", (entry_id,))
    await execute("DELETE FROM study_imports WHERE import_id = %s", (import_id,))
    return {"deleted": entry_id}


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
