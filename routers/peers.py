"""
Peer cohort router.

GET /api/peers   – return anonymised rows from cohort_students
                   for the Peers tab 3-D visualisation.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from database.execute import fetch_all
from security import get_current_user

router = APIRouter(prefix="/api/peers", tags=["peers"])


@router.get("")
async def list_peers(
    limit: int = Query(default=12, ge=1, le=100),
    _: str = Depends(get_current_user),
):
    """
    Return *limit* rows from cohort_students ordered by id.
    Columns returned match the DB schema exactly so the frontend
    can map them by name without guessing.
    """
    rows = await fetch_all(
        """
        SELECT id,
               study_hours,
               attention_span,
               focus_ratio,
               sleep_hours,
               break_freq,
               current_grade
        FROM   cohort_students
        ORDER  BY id
        LIMIT  %s
        """,
        (limit,),
    )
    return {"peers": rows}
