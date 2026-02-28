"""
App usage JSON parser.

Expected top-level shape:
  {
    "sync_timestamp": ISO-8601 str,
    "client_version": str,
    "logs": [
      { "app_name": str, "category": str, "duration_mins": int, "logged_date": "YYYY-MM-DD" }
    ]
  }
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Optional


VALID_CATEGORIES = {"Productive", "Neutral", "Distracting"}


@dataclass
class AppUsageEntry:
    app_name:      str
    category:      str
    duration_mins: int
    logged_date:   str


@dataclass
class AppUsageParseResult:
    sync_timestamp: Optional[str]
    client_version: Optional[str]
    logs:           list[AppUsageEntry] = field(default_factory=list)
    error:          Optional[str]       = None


def parse_app_usage_json(content: bytes) -> AppUsageParseResult:
    """Parse app usage JSON bytes into an AppUsageParseResult."""
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        return AppUsageParseResult(
            sync_timestamp=None, client_version=None,
            error=f"JSON decode error: {e}",
        )

    if not isinstance(data, dict):
        return AppUsageParseResult(
            sync_timestamp=None, client_version=None,
            error="Expected a JSON object at the top level",
        )

    raw_logs = data.get("logs", [])
    if not isinstance(raw_logs, list):
        return AppUsageParseResult(
            sync_timestamp=None, client_version=None,
            error="'logs' field must be a list",
        )

    logs: list[AppUsageEntry] = []
    for item in raw_logs:
        if not isinstance(item, dict):
            continue

        app_name = item.get("app_name")
        if not isinstance(app_name, str) or not app_name.strip():
            continue

        duration_mins = item.get("duration_mins")
        if not isinstance(duration_mins, int) or duration_mins < 1:
            continue

        logged_date = item.get("logged_date")
        if not isinstance(logged_date, str) or not logged_date.strip():
            continue

        raw_cat = item.get("category", "Neutral")
        category = raw_cat if raw_cat in VALID_CATEGORIES else "Neutral"

        logs.append(AppUsageEntry(
            app_name=app_name.strip(),
            category=category,
            duration_mins=duration_mins,
            logged_date=logged_date.strip(),
        ))

    return AppUsageParseResult(
        sync_timestamp=data.get("sync_timestamp"),
        client_version=data.get("client_version"),
        logs=logs,
    )


def summarise_app_usage(result: AppUsageParseResult) -> dict:
    """Return totals per category."""
    totals: dict[str, int] = {}
    for e in result.logs:
        totals[e.category] = totals.get(e.category, 0) + e.duration_mins
    return totals
