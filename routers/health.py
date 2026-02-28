"""
Apple Health import router.

POST   /api/health/import          – import a Health JSON payload
GET    /api/health/imports         – list all imports for a session
GET    /api/health/imports/{id}    – import detail + metrics
DELETE /api/health/imports/{id}    – delete import and its metrics
GET    /api/health/metrics/summary – aggregated counts by type for a session
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from database.execute import execute, execute_returning, fetch_all, fetch_one
from parsers.health_parser import parse_health_json, summarise

router = APIRouter(prefix="/api/health", tags=["health"])

MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB


# ── Import ────────────────────────────────────────────────────────────────────

@router.post("/import")
async def import_health(
    request:    Request,
    session_id: str = Query(...),
):
    content = await request.body()

    if len(content) > MAX_BODY_BYTES:
        raise HTTPException(413, "Payload exceeds 10 MB limit")

    result = parse_health_json(content)

    if result.error:
        raise HTTPException(422, f"Parse error: {result.error}")

    if not result.metrics:
        raise HTTPException(422, "No valid metrics found in payload")

    # Insert import record
    row = await execute_returning(
        """
        INSERT INTO health_imports
            (session_id, source_user_id, sync_timestamp, client_version, metric_count)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING import_id, imported_at, metric_count
        """,
        (
            session_id,
            result.source_user_id,
            result.sync_timestamp,
            result.client_version,
            len(result.metrics),
        ),
    )

    import_id = row["import_id"]

    # Bulk-insert metrics
    for m in result.metrics:
        await execute(
            """
            INSERT INTO health_metrics
                (import_id, type, data_class, value_num, value_cat, unit,
                 start_time, end_time, source_device, was_user_entered)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                import_id,
                m.type, m.data_class,
                m.value_num, m.value_cat,
                m.unit,
                m.start_time, m.end_time,
                m.source_device,
                m.was_user_entered,
            ),
        )

    return {
        "import_id":     str(import_id),
        "metric_count":  len(result.metrics),
        "sync_timestamp": result.sync_timestamp,
        "summary":       summarise(result),
        "imported_at":   str(row["imported_at"]),
    }


# ── List imports ──────────────────────────────────────────────────────────────

@router.get("/imports")
async def list_imports(session_id: str = Query(...)):
    rows = await fetch_all(
        """
        SELECT import_id, source_user_id, sync_timestamp, client_version,
               metric_count, imported_at
        FROM   health_imports
        WHERE  session_id = %s
        ORDER  BY imported_at DESC
        """,
        (session_id,),
    )
    return {"imports": rows}


# ── Import detail ─────────────────────────────────────────────────────────────

@router.get("/imports/{import_id}")
async def get_import(import_id: str):
    row = await fetch_one(
        "SELECT * FROM health_imports WHERE import_id = %s", (import_id,)
    )
    if not row:
        raise HTTPException(404, "Import not found")

    metrics = await fetch_all(
        """
        SELECT type, data_class, value_num, value_cat, unit,
               start_time, end_time, source_device
        FROM   health_metrics
        WHERE  import_id = %s
        ORDER  BY start_time
        """,
        (import_id,),
    )

    # Build per-type summary
    summary: dict[str, int] = {}
    for m in metrics:
        summary[m["type"]] = summary.get(m["type"], 0) + 1

    return {"import": row, "metrics": metrics, "summary": summary}


# ── Delete import ─────────────────────────────────────────────────────────────

@router.delete("/imports/{import_id}")
async def delete_import(import_id: str):
    row = await fetch_one(
        "SELECT import_id FROM health_imports WHERE import_id = %s", (import_id,)
    )
    if not row:
        raise HTTPException(404, "Import not found")

    await execute(
        "DELETE FROM health_imports WHERE import_id = %s", (import_id,)
    )
    return {"deleted": import_id}


# ── Aggregated summary across all imports for a session ───────────────────────

@router.get("/metrics/summary")
async def metrics_summary(session_id: str = Query(...)):
    rows = await fetch_all(
        """
        SELECT hm.type, COUNT(*) AS count,
               AVG(hm.value_num) AS avg_value,
               MIN(hm.start_time) AS earliest,
               MAX(hm.start_time) AS latest
        FROM   health_metrics hm
        JOIN   health_imports hi ON hi.import_id = hm.import_id
        WHERE  hi.session_id = %s
        GROUP  BY hm.type
        ORDER  BY count DESC
        """,
        (session_id,),
    )
    return {"summary": rows}
