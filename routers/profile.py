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
from ml_engine import engine

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

    # ── Focus ratio — productive mins / total mins from app_usage_entries ────
    focus_row = await fetch_one(
        """
        SELECT ROUND(
            SUM(CASE WHEN ae.category='Productive' THEN ae.duration_mins ELSE 0 END) * 100.0
            / NULLIF(SUM(ae.duration_mins), 0), 1) AS focus_ratio
        FROM app_usage_entries ae
        JOIN app_usage_imports ai ON ai.import_id = ae.import_id
        WHERE ai.session_id = %s
        """,
        (session_id,),
    )
    focus_ratio = (
        float(focus_row["focus_ratio"])
        if focus_row and focus_row["focus_ratio"] is not None
        else None
    )

    # ── Break frequency — average breaks per study session ────────────────
    break_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(se.breaks_taken) AS numeric), 1) AS avg_breaks
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
        """,
        (session_id,),
    )
    break_freq = (
        float(break_row["avg_breaks"])
        if break_row and break_row["avg_breaks"] is not None
        else None
    )

    # ── Attention span — avg uninterrupted focus block (mins) ────────────
    attention_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(se.duration_mins::float / (se.breaks_taken + 1)) AS numeric), 0) AS avg_attention
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
        """,
        (session_id,),
    )
    attention_span = (
        float(attention_row["avg_attention"])
        if attention_row and attention_row["avg_attention"] is not None
        else None
    )

    # ── Study hours — average daily study hours ───────────────────────────
    study_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(daily_mins) / 60.0 AS numeric), 1) AS avg_daily_hours
        FROM (
            SELECT se.started_at::date AS day, SUM(se.duration_mins) AS daily_mins
            FROM study_entries se
            JOIN study_imports si ON si.import_id = se.import_id
            WHERE si.session_id = %s
            GROUP BY day
        ) d
        """,
        (session_id,),
    )
    study_hours = (
        float(study_row["avg_daily_hours"])
        if study_row and study_row["avg_daily_hours"] is not None
        else None
    )

    # ── App usage source counts ───────────────────────────────────────────
    app_usage_counts = await fetch_one(
        """
        SELECT COUNT(*) AS import_count
        FROM app_usage_imports
        WHERE session_id = %s
        """,
        (session_id,),
    )
    has_app_usage   = bool(app_usage_counts and int(app_usage_counts["import_count"]) > 0)
    app_usage_count = int(app_usage_counts["import_count"]) if app_usage_counts else 0

    # ── Study session source counts ───────────────────────────────────────
    study_counts = await fetch_one(
        """
        SELECT COUNT(*) AS import_count
        FROM study_imports
        WHERE session_id = %s
        """,
        (session_id,),
    )
    has_study_sessions   = bool(study_counts and int(study_counts["import_count"]) > 0)
    study_session_count  = int(study_counts["import_count"]) if study_counts else 0

    return {
        "baseline": {
            # Each value is the real measured average, or null if not yet available.
            # The frontend uses null to mean "fall back to default slider value".
            "studyHours":    study_hours,
            "attentionSpan": attention_span,
            "focusRatio":    focus_ratio,
            "sleepHours":    sleep_hours,  # source: health_metrics → sleep_analysis
            "breakFreq":     break_freq,
        },
        "sources": {
            "health":              has_health,
            "files":               has_files,
            "grades":              has_grades,
            "healthCount":         health_count,
            "gradeCount":          grade_count,
            "appUsage":            has_app_usage,
            "studySessions":       has_study_sessions,
            "appUsageCount":       app_usage_count,
            "studySessionCount":   study_session_count,
            "cohort":              True,    # always active: 1000 cohort students seeded in DB
        },
    }


@router.get("/overview")
async def get_overview(session_id: str = Query(...)):
    """
    Aggregate snapshot for the Overview dashboard card row.
    All four values are derived from the session's imported data.
    """

    # ── Study hours logged today ──────────────────────────────────────────────
    today_row = await fetch_one(
        """
        SELECT ROUND(CAST(COALESCE(SUM(se.duration_mins), 0) AS numeric) / 60.0, 1) AS hours_today
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
          AND se.started_at::date = CURRENT_DATE
        """,
        (session_id,),
    )
    study_hours_today = float(today_row["hours_today"] or 0) if today_row else 0.0

    # ── Historical average attention span ─────────────────────────────────────
    att_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(se.duration_mins::float / (se.breaks_taken + 1)) AS numeric), 0) AS avg_attention
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
        """,
        (session_id,),
    )
    avg_attention = (
        float(att_row["avg_attention"])
        if att_row and att_row["avg_attention"] is not None
        else None
    )

    # ── Top app by duration today ─────────────────────────────────────────────
    top_app_row = await fetch_one(
        """
        SELECT ae.app_name
        FROM app_usage_entries ae
        JOIN app_usage_imports ai ON ai.import_id = ae.import_id
        WHERE ai.session_id = %s
          AND ae.logged_date = CURRENT_DATE
        GROUP BY ae.app_name
        ORDER BY SUM(ae.duration_mins) DESC
        LIMIT 1
        """,
        (session_id,),
    )
    top_app_today = top_app_row["app_name"] if top_app_row else None

    # ── Baseline metrics for grade prediction ─────────────────────────────────

    focus_row = await fetch_one(
        """
        SELECT ROUND(
            SUM(CASE WHEN ae.category='Productive' THEN ae.duration_mins ELSE 0 END) * 100.0
            / NULLIF(SUM(ae.duration_mins), 0), 1) AS focus_ratio
        FROM app_usage_entries ae
        JOIN app_usage_imports ai ON ai.import_id = ae.import_id
        WHERE ai.session_id = %s
        """,
        (session_id,),
    )
    focus_ratio = (
        float(focus_row["focus_ratio"])
        if focus_row and focus_row["focus_ratio"] is not None
        else 70.0
    )

    break_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(se.breaks_taken) AS numeric), 1) AS avg_breaks
        FROM study_entries se
        JOIN study_imports si ON si.import_id = se.import_id
        WHERE si.session_id = %s
        """,
        (session_id,),
    )
    break_freq = (
        float(break_row["avg_breaks"])
        if break_row and break_row["avg_breaks"] is not None
        else 2.0
    )

    study_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(daily_mins) / 60.0 AS numeric), 1) AS avg_daily_hours
        FROM (
            SELECT se.started_at::date AS day, SUM(se.duration_mins) AS daily_mins
            FROM study_entries se
            JOIN study_imports si ON si.import_id = se.import_id
            WHERE si.session_id = %s
            GROUP BY day
        ) d
        """,
        (session_id,),
    )
    study_hours_bl = (
        float(study_row["avg_daily_hours"])
        if study_row and study_row["avg_daily_hours"] is not None
        else 5.0
    )

    sleep_row = await fetch_one(
        """
        SELECT ROUND(CAST(AVG(hm.value_num) AS numeric), 1) AS avg_sleep
        FROM health_metrics hm
        JOIN health_imports hi ON hi.import_id = hm.import_id
        WHERE hi.session_id = %s
          AND hm.type = 'sleep_analysis'
          AND hm.value_num IS NOT NULL
        """,
        (session_id,),
    )
    sleep_hours = (
        float(sleep_row["avg_sleep"])
        if sleep_row and sleep_row["avg_sleep"] is not None
        else 7.0
    )

    # ── Run 'strict' Decision Tree prediction ────────────────────────────────
    predicted_grade = None
    if engine.dt is not None:
        values = {
            "studyHours":    study_hours_bl,
            "attentionSpan": avg_attention if avg_attention is not None else 40.0,
            "focusRatio":    focus_ratio,
            "sleepHours":    sleep_hours,
            "breakFreq":     break_freq,
        }
        try:
            score, _ = engine.predict_strict(values)
            predicted_grade = engine._score_to_grade(score)
        except Exception:
            predicted_grade = None

    return {
        "studyHoursToday":       study_hours_today,
        "avgAttentionSpan":      avg_attention,
        "topAppToday":           top_app_today,
        "currentPredictedGrade": predicted_grade,
    }
