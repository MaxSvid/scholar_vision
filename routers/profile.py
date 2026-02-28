"""
User profile / baseline router.

GET /api/profile/baseline?session_id=...
  Returns real metric averages derived from the session's imported data,
  plus a sources map indicating which data streams are currently active.

Baseline values that cannot yet be derived from session data are returned
as null; the frontend substitutes its own defaults in those cases.
"""
from __future__ import annotations

from fastapi import APIRouter, Query

from database.execute import fetch_one

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("/baseline")
async def get_baseline(session_id: str = Query(...)):
    # ── Sleep hours — average of Apple Health sleep_analysis records ──────
    sleep_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(hm.value_num) AS numeric), 1) AS avg_sleep
        FROM   health_metrics  hm
        JOIN   health_imports  hi ON hi.import_id = hm.import_id
        WHERE  hi.session_id  = %s
          AND  hm.type        = 'sleep_analysis'
          AND  hm.value_num   IS NOT NULL
        """,
        (session_id,),
    )
    sleep_hours = (
        float(sleep_row["avg_sleep"])
        if sleep_row and sleep_row["avg_sleep"] is not None
        else None
    )

    # ── Health source — count imports + total metrics for this session ────
    health_counts = await fetch_one(
        """
        SELECT
            COUNT(DISTINCT hi.import_id) AS import_count,
            COUNT(hm.metric_id)          AS metric_count
        FROM   health_imports  hi
        LEFT JOIN health_metrics hm ON hm.import_id = hi.import_id
        WHERE  hi.session_id = %s
        """,
        (session_id,),
    )
    has_health   = bool(health_counts and int(health_counts["import_count"]) > 0)
    health_count = int(health_counts["metric_count"]) if health_counts else 0

    # ── Files / grades source — count files + extracted grades ────────────
    grade_counts = await fetch_one(
        """
        SELECT
            COUNT(DISTINCT uf.file_id) AS file_count,
            COUNT(pg.grade_id)         AS grade_count
        FROM   uploaded_files  uf
        LEFT JOIN parsed_grades pg ON pg.file_id = uf.file_id
        WHERE  uf.session_id = %s
        """,
        (session_id,),
    )
    has_files   = bool(grade_counts and int(grade_counts["file_count"]) > 0)
    has_grades  = bool(grade_counts and int(grade_counts["grade_count"]) > 0)
    grade_count = int(grade_counts["grade_count"]) if grade_counts else 0

    return {
        "baseline": {
            # Each value is the real measured average, or null if not yet available.
            # The frontend uses null to mean "fall back to default slider value".
            "studyHours":    None,         # source: study_sessions    (not yet populated)
            "attentionSpan": None,         # source: app data           (not yet connected)
            "focusRatio":    None,         # source: app_usage_logs     (not yet connected)
            "sleepHours":    sleep_hours,  # source: health_metrics → sleep_analysis
            "breakFreq":     None,         # source: study_sessions    (not yet populated)
        },
        "sources": {
            "health":        has_health,
            "files":         has_files,
            "grades":        has_grades,
            "healthCount":   health_count,
            "gradeCount":    grade_count,
            "appUsage":      False,   # requires browser extension — not yet connected
            "studySessions": False,   # requires in-app tracking  — not yet connected
            "cohort":        True,    # always active: 1000 cohort students seeded in DB
        },
    }
