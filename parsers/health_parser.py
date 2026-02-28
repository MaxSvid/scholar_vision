"""
Apple Health JSON parser.

Expected top-level shape:
  {
    "user_id": str,
    "sync_timestamp": ISO-8601 str,
    "client_version": str,
    "metrics": [ { type, data_class, value, unit, start_time, end_time,
                   source_device, metadata? } ]
  }
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Optional


# ── Output types ──────────────────────────────────────────────────────────────

@dataclass
class HealthMetric:
    type:             str
    data_class:       str
    value_num:        Optional[float]   # for quantity metrics
    value_cat:        Optional[str]     # for category metrics (e.g. "REM")
    unit:             Optional[str]
    start_time:       str
    end_time:         Optional[str]
    source_device:    Optional[str]
    was_user_entered: bool = False


@dataclass
class HealthParseResult:
    source_user_id: Optional[str]
    sync_timestamp: Optional[str]
    client_version: Optional[str]
    metrics:        list[HealthMetric] = field(default_factory=list)
    error:          Optional[str]      = None


# ── Known metric types (for validation/display) ───────────────────────────────

KNOWN_TYPES = {
    # Activity
    "step_count", "distance_walking_running", "flights_climbed",
    "active_energy_burned", "basal_energy_burned", "exercise_time",
    "stand_time", "vo2_max",
    # Vitals
    "heart_rate", "heart_rate_variability_sdnn", "resting_heart_rate",
    "walking_heart_rate_average", "blood_oxygen_saturation",
    "respiratory_rate", "body_temperature", "blood_pressure_systolic",
    "blood_pressure_diastolic",
    # Body
    "body_mass", "body_mass_index", "body_fat_percentage",
    "lean_body_mass", "height", "waist_circumference",
    # Sleep
    "sleep_analysis",
    # Nutrition
    "dietary_energy_consumed", "dietary_protein", "dietary_carbohydrates",
    "dietary_fat_total", "dietary_fiber", "dietary_water",
    # Mindfulness
    "mindful_session",
}


# ── Parser ────────────────────────────────────────────────────────────────────

def parse_health_json(content: bytes) -> HealthParseResult:
    """Parse Apple Health export JSON bytes into a HealthParseResult."""
    try:
        data = json.loads(content.decode("utf-8"))
    except Exception as e:
        return HealthParseResult(
            source_user_id=None, sync_timestamp=None, client_version=None,
            error=f"JSON decode error: {e}",
        )

    if not isinstance(data, dict):
        return HealthParseResult(
            source_user_id=None, sync_timestamp=None, client_version=None,
            error="Expected a JSON object at the top level",
        )

    raw_metrics = data.get("metrics", [])
    if not isinstance(raw_metrics, list):
        return HealthParseResult(
            source_user_id=None, sync_timestamp=None, client_version=None,
            error="'metrics' field must be a list",
        )

    metrics: list[HealthMetric] = []
    for i, m in enumerate(raw_metrics):
        if not isinstance(m, dict):
            continue

        raw_val = m.get("value")
        if isinstance(raw_val, (int, float)):
            value_num: Optional[float] = float(raw_val)
            value_cat: Optional[str]   = None
        elif raw_val is not None:
            value_num = None
            value_cat = str(raw_val)
        else:
            value_num = None
            value_cat = None

        meta             = m.get("metadata") or {}
        was_user_entered = bool(meta.get("was_user_entered", False)) if isinstance(meta, dict) else False

        start = m.get("start_time", "")
        if not start:
            continue  # skip malformed entries without a timestamp

        metrics.append(HealthMetric(
            type             = str(m.get("type", "unknown")),
            data_class       = str(m.get("data_class", "quantity")),
            value_num        = value_num,
            value_cat        = value_cat,
            unit             = m.get("unit"),
            start_time       = start,
            end_time         = m.get("end_time"),
            source_device    = m.get("source_device"),
            was_user_entered = was_user_entered,
        ))

    return HealthParseResult(
        source_user_id = data.get("user_id"),
        sync_timestamp = data.get("sync_timestamp"),
        client_version = data.get("client_version"),
        metrics        = metrics,
    )


def summarise(result: HealthParseResult) -> dict:
    """Return a dict of metric_type → count for quick display."""
    counts: dict[str, int] = {}
    for m in result.metrics:
        counts[m.type] = counts.get(m.type, 0) + 1
    return counts
