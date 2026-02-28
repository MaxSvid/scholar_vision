"""
Study session JSON parser.

Expected top-level shape:
  {
    "sync_timestamp": ISO-8601 str,
    "client_version": str,
    "sessions": [
      {
        "started_at": ISO-8601 str,
        "ended_at":   ISO-8601 str,
        "subject_tag": str,
        "breaks_taken": int,
        "notes": str
      }
    ]
  }
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional


@dataclass
class StudyEntry:
    started_at:    str
    ended_at:      str
    duration_mins: int
    subject_tag:   Optional[str]
    breaks_taken:  int
    notes:         Optional[str]


@dataclass
class StudyParseResult:
    sync_timestamp: Optional[str]
    client_version: Optional[str]
    sessions:       list[StudyEntry] = field(default_factory=list)
    error:          Optional[str]    = None


def _parse_iso(s: str) -> Optional[datetime]:
    """Parse an ISO-8601 string, returning None on failure."""
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    # fallback: fromisoformat (Python 3.7+)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def parse_study_json(content: bytes) -> StudyParseResult:
    """Parse study session JSON bytes into a StudyParseResult."""
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        return StudyParseResult(
            sync_timestamp=None, client_version=None,
            error=f"JSON decode error: {e}",
        )

    if not isinstance(data, dict):
        return StudyParseResult(
            sync_timestamp=None, client_version=None,
            error="Expected a JSON object at the top level",
        )

    raw_sessions = data.get("sessions", [])
    if not isinstance(raw_sessions, list):
        return StudyParseResult(
            sync_timestamp=None, client_version=None,
            error="'sessions' field must be a list",
        )

    sessions: list[StudyEntry] = []
    for item in raw_sessions:
        if not isinstance(item, dict):
            continue

        started_str = item.get("started_at")
        ended_str   = item.get("ended_at")
        if not isinstance(started_str, str) or not isinstance(ended_str, str):
            continue

        started_dt = _parse_iso(started_str)
        ended_dt   = _parse_iso(ended_str)
        if started_dt is None or ended_dt is None:
            continue

        # Make both timezone-naive for comparison
        if started_dt.tzinfo is not None:
            started_dt = started_dt.replace(tzinfo=None)
        if ended_dt.tzinfo is not None:
            ended_dt = ended_dt.replace(tzinfo=None)

        if ended_dt <= started_dt:
            continue

        duration_mins = int((ended_dt - started_dt).total_seconds() / 60)
        if duration_mins < 1:
            continue

        breaks_taken = item.get("breaks_taken", 0)
        if not isinstance(breaks_taken, int) or breaks_taken < 0:
            breaks_taken = 0

        subject_tag = item.get("subject_tag")
        if not isinstance(subject_tag, str):
            subject_tag = None

        notes = item.get("notes")
        if not isinstance(notes, str):
            notes = None

        sessions.append(StudyEntry(
            started_at=started_str,
            ended_at=ended_str,
            duration_mins=duration_mins,
            subject_tag=subject_tag,
            breaks_taken=breaks_taken,
            notes=notes,
        ))

    return StudyParseResult(
        sync_timestamp=data.get("sync_timestamp"),
        client_version=data.get("client_version"),
        sessions=sessions,
    )
