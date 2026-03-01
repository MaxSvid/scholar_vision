"""
Seed a fully-populated test/demo user for ScholarVision.

What this script creates
------------------------
  1. users                — test@scholarvision.com  (password: Scholar2024!)
  2. student_profiles     — Alex Chen, CS, University of Edinburgh
  3. cohort_students      — feature vector for Peer Benchmark + Prediction Engine
  4. health_imports       — 1 import record tied to demo user
     health_metrics       — 35 records: 7 × sleep, 21 × heart rate, 7 × step count
  5. uploaded_files       — 3 files (transcript PDF, assignment DOCX, notes PDF)
     parsed_grades        — 4 grade records from the transcript
  6. app_usage_imports    — 1 import record
     app_usage_entries    — 49 entries: 7 apps × 7 days
  7. study_imports        — 1 import record
     study_entries        — 14 sessions: 2 sessions × 7 days

Derived baselines that will appear in the Prediction Engine after seeding
-------------------------------------------------------------------------
  sleepHours    ≈ 7.57 h/night   (avg of 7 sleep_analysis records)
  studyHours    ≈ 4.07 h/day     (avg daily total across 7 days)
  attentionSpan ≈ 45 min         (avg duration ÷ (breaks+1) across 14 sessions)
  breakFreq     ≈ 1.79/session   (avg breaks_taken across 14 sessions)
  focusRatio    ≈ 58.2%          (productive mins / total app mins)

Usage (from scholar_vision/ root)
----------------------------------
  uv run python3 scripts/seed_test_user.py
  uv run python3 scripts/seed_test_user.py --force
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

# ── Make project root importable ──────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())


_load_env(ROOT / ".env")

import psycopg  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402
from security import hash_password  # noqa: E402

# ── Constants ─────────────────────────────────────────────────────────────────
DEMO_EMAIL    = "test@scholarvision.com"
DEMO_PASSWORD = "Scholar2024!"
BASE_DATE     = date(2024, 11, 4)   # Monday — start of the demo week


# ── Helpers ───────────────────────────────────────────────────────────────────

def _dsn() -> str:
    return (
        f"postgresql://"
        f"{os.getenv('POSTGRES_USER',      'tester')}:"
        f"{os.getenv('POSTGRES_PASSWORD',  'sql_password')}@"
        f"{os.getenv('POSTGRES_HOST',      'localhost')}:"
        f"{os.getenv('POSTGRES_PORT_HOST', '5432')}/"
        f"{os.getenv('POSTGRES_DB',        'sql_db')}"
    )


def day(n: int) -> date:
    """BASE_DATE + n days."""
    return BASE_DATE + timedelta(days=n)


def ts(d: date, h: int, m: int, s: int = 0) -> str:
    """Naive ISO-8601 datetime string for a given date + HH:MM:SS."""
    return datetime(d.year, d.month, d.day, h, m, s).isoformat(sep=" ")


# ── Seeder ────────────────────────────────────────────────────────────────────

def seed(conn: psycopg.Connection) -> str:
    """Seed all demo data. Returns the user_id created."""

    # ── 1. User ───────────────────────────────────────────────────────────────
    print("  [1/7] Creating user account…")
    pwd_hash = hash_password(DEMO_PASSWORD)
    row = conn.execute(
        """
        INSERT INTO users (email, password_hash, full_name)
        VALUES (%s, %s, %s)
        RETURNING user_id
        """,
        (DEMO_EMAIL, pwd_hash, "Alex Chen"),
    ).fetchone()
    user_id    = str(row["user_id"])
    session_id = user_id   # JWT auth: session_id == user_id

    # ── 2. Student profile ────────────────────────────────────────────────────
    print("  [2/7] Creating student profile…")
    conn.execute(
        """
        INSERT INTO student_profiles
            (user_id, full_name, date_of_birth, major, university_name,
             enrollment_year, current_year, location, bio,
             year_of_study, study_goal, weekly_hours_target, target_gpa)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            "Alex Chen",
            date(2002, 3, 15),
            "Computer Science",
            "University of Edinburgh",
            2022, 3,
            "Edinburgh, UK",
            "Third-year CS student focused on machine learning and software engineering.",
            "3rd Year",
            "Graduate with First Class Honours and secure a ML research position.",
            40.0,
            "First Class",
        ),
    )

    # ── 3. Cohort entry ───────────────────────────────────────────────────────
    # Computed after log inserts — see step 8 below.

    # ── 4. Apple Health metrics ───────────────────────────────────────────────
    print("  [4/7] Inserting Apple Health metrics (35 records)…")

    metrics: list[dict] = []

    # Sleep — one record per night
    _sleep = [
        (day(-1), day(0),  22, 30,  6, 15, 7.75),
        (day(0),  day(1),  23,  0,  6, 45, 7.75),
        (day(1),  day(2),  22, 15,  6,  0, 7.75),
        (day(2),  day(3),  23, 30,  6, 30, 7.0),
        (day(3),  day(4),  22,  0,  5, 45, 7.75),
        (day(4),  day(5),  23, 45,  7,  0, 7.25),
        (day(5),  day(6),  22, 30,  6, 15, 7.75),
    ]
    for s_d, e_d, sh, sm, eh, em, hrs in _sleep:
        metrics.append({
            "type": "sleep_analysis",  "data_class": "quantity",
            "value_num": hrs,           "value_cat": None,  "unit": "h",
            "start_time": ts(s_d, sh, sm),
            "end_time":   ts(e_d, eh, em),
            "source_device": "Apple Watch Series 9",
        })

    # Heart rate — 3 readings per day
    _hr = [
        (0, [(7, 10, 62), (12, 30, 74), (20, 15, 67)]),
        (1, [(7, 20, 60), (13,  0, 72), (20, 45, 65)]),
        (2, [(7,  5, 63), (12, 15, 76), (19, 30, 68)]),
        (3, [(7, 30, 61), (13, 30, 70), (21,  0, 66)]),
        (4, [(7, 15, 59), (12, 45, 73), (20, 30, 64)]),
        (5, [(8,  0, 64), (13, 15, 75), (19, 45, 69)]),
        (6, [(7, 45, 62), (12,  0, 71), (20,  0, 66)]),
    ]
    for n, readings in _hr:
        for h, m, bpm in readings:
            metrics.append({
                "type": "heart_rate",  "data_class": "quantity",
                "value_num": float(bpm), "value_cat": None, "unit": "count/min",
                "start_time": ts(day(n), h, m),
                "end_time":   None,
                "source_device": "Apple Watch Series 9",
            })

    # Step count — one daily total per day
    _steps = [9200, 8500, 7800, 10100, 7200, 9800, 8300]
    for n, steps in enumerate(_steps):
        metrics.append({
            "type": "step_count",  "data_class": "quantity",
            "value_num": float(steps), "value_cat": None, "unit": "count",
            "start_time": ts(day(n),  0,  0),
            "end_time":   ts(day(n), 23, 59, 59),
            "source_device": "iPhone 15 Pro",
        })

    health_import_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO health_imports
            (import_id, session_id, source_user_id,
             sync_timestamp, client_version, metric_count)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            health_import_id, session_id,
            "apple_health_alex_chen",
            "2024-11-10 20:00:00", "2.1.0", len(metrics),
        ),
    )

    for m in metrics:
        conn.execute(
            """
            INSERT INTO health_metrics
                (import_id, type, data_class, value_num, value_cat,
                 unit, start_time, end_time, source_device, was_user_entered)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                health_import_id,
                m["type"], m["data_class"], m["value_num"], m["value_cat"],
                m["unit"], m["start_time"], m["end_time"],
                m["source_device"], False,
            ),
        )

    # ── 5. Uploaded files + parsed grades ────────────────────────────────────
    print("  [5/7] Inserting uploaded files and parsed grades…")

    transcript_id     = str(uuid.uuid4())
    transcript_stored = f"{uuid.uuid4()}.pdf"
    conn.execute(
        """
        INSERT INTO uploaded_files
            (file_id, session_id, original_name, stored_name,
             file_type, file_size, category, parse_status, storage_path, raw_text)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            transcript_id, session_id,
            "Semester_1_Transcript.pdf", transcript_stored,
            "pdf", 142_560, "Grades", "done",
            f"uploads/{transcript_stored}",
            (
                "UNIVERSITY OF EDINBURGH — OFFICIAL TRANSCRIPT\n"
                "Student: Alex Chen  |  ID: s2201234\n"
                "Mathematics 101:     A   85/100\n"
                "Computer Science 101: A+  92/100\n"
                "Physics 201:         B+  78/100\n"
                "Literature 150:      B   74/100\n"
            ),
        ),
    )

    _grades = [
        ("Mathematics 101",     "MATH101",  "A",    85.0, 100.0,  85.0, "Semester 1 2024"),
        ("Computer Science 101","CS101",    "A+",   92.0, 100.0,  92.0, "Semester 1 2024"),
        ("Physics 201",         "PHYS201",  "B+",   78.0, 100.0,  78.0, "Semester 1 2024"),
        ("Literature 150",      "LIT150",   "B",    74.0, 100.0,  74.0, "Semester 1 2024"),
    ]
    for row_idx, (cname, ccode, letter, score, max_s, pct, sem) in enumerate(_grades, 1):
        conn.execute(
            """
            INSERT INTO parsed_grades
                (file_id, course_name, course_code, grade_letter,
                 score, max_score, percentage, semester, source_row)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (transcript_id, cname, ccode, letter, score, max_s, pct, sem, row_idx),
        )

    assign_id     = str(uuid.uuid4())
    assign_stored = f"{uuid.uuid4()}.docx"
    conn.execute(
        """
        INSERT INTO uploaded_files
            (file_id, session_id, original_name, stored_name,
             file_type, file_size, category, parse_status, storage_path)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            assign_id, session_id,
            "CS101_Assignment_3.docx", assign_stored,
            "docx", 38_912, "Assignments", "done",
            f"uploads/{assign_stored}",
        ),
    )

    notes_id     = str(uuid.uuid4())
    notes_stored = f"{uuid.uuid4()}.pdf"
    conn.execute(
        """
        INSERT INTO uploaded_files
            (file_id, session_id, original_name, stored_name,
             file_type, file_size, category, parse_status, storage_path)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            notes_id, session_id,
            "Mathematics_Notes_Ch7_Integration.pdf", notes_stored,
            "pdf", 215_040, "Notes", "done",
            f"uploads/{notes_stored}",
        ),
    )

    # ── 6. App usage logs ─────────────────────────────────────────────────────
    print("  [6/7] Inserting app usage logs (49 entries)…")

    _apps = [
        ("VS Code",    "Productive",  [150, 120, 140, 100,  90, 130, 110]),
        ("Notion",     "Productive",  [ 45,  35,  50,  40,  30,  45,  35]),
        ("Anki",       "Productive",  [ 30,  25,  35,  30,  20,  40,  30]),
        ("YouTube",    "Neutral",     [ 50,  55,  45,  60,  50,  60,  55]),
        ("Spotify",    "Neutral",     [ 40,  35,  30,  45,  35,  45,  30]),
        ("Reddit",     "Distracting", [ 30,  25,  35,  20,  30,  25,  20]),
        ("Instagram",  "Distracting", [ 20,  15,  20,  25,  20,  15,  20]),
    ]
    total_log_count = sum(len(mins) for _, _, mins in _apps)

    app_import_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO app_usage_imports
            (import_id, session_id, sync_timestamp, client_version, log_count)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (app_import_id, session_id, "2024-11-10 20:00:00", "1.0", total_log_count),
    )

    for app_name, category, daily_mins in _apps:
        for n, mins in enumerate(daily_mins):
            conn.execute(
                """
                INSERT INTO app_usage_entries
                    (import_id, app_name, category, duration_mins, logged_date)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (app_import_id, app_name, category, mins, day(n)),
            )

    # ── 7. Study sessions ─────────────────────────────────────────────────────
    print("  [7/7] Inserting study sessions (14 sessions)…")

    _sessions = [
        (0,  9,  0, 11, 30, "Mathematics",  2, "Integration by parts, substitution method"),
        (0, 14,  0, 16, 30, "Programming",  3, "Binary search tree implementation and unit tests"),
        (1,  9, 30, 11, 30, "Physics",      2, "Electromagnetism — Faraday's law and applications"),
        (1, 14,  0, 15, 30, "Mathematics",  1, "Differential equations — separation of variables"),
        (2,  9,  0, 12,  0, "Programming",  3, "AVL tree implementation, wrote benchmarks"),
        (2, 15,  0, 16, 30, "Literature",   1, "Victorian poetry analysis — Tennyson and Browning"),
        (3,  9,  0, 11,  0, "Mathematics",  1, "Complex numbers — polar form and Euler's formula"),
        (3, 13, 30, 15, 30, "Physics",      2, "Thermodynamics — entropy and the Carnot cycle"),
        (4,  9,  0, 10, 30, "Economics",    1, "IS-LM model and aggregate demand"),
        (4, 14,  0, 16,  0, "Programming",  2, "Graph algorithms — Dijkstra, BFS, DFS"),
        (5, 10,  0, 13,  0, "Mathematics",  3, "Vector calculus — gradient, divergence, curl"),
        (5, 15,  0, 17,  0, "Literature",   2, "Essay draft: Romanticism vs Modernism"),
        (6, 11,  0, 12, 30, "Physics",      1, "Electromagnetism problem set review"),
        (6, 14,  0, 15, 30, "Economics",    1, "IS-LM worked examples and past paper"),
    ]

    study_import_id = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO study_imports
            (import_id, session_id, sync_timestamp, client_version, session_count)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (study_import_id, session_id, "2024-11-10 21:00:00", "1.0", len(_sessions)),
    )

    for n, sh, sm, eh, em, subject, breaks, notes in _sessions:
        d        = day(n)
        started  = datetime(d.year, d.month, d.day, sh, sm)
        ended    = datetime(d.year, d.month, d.day, eh, em)
        dur_mins = int((ended - started).total_seconds() / 60)
        conn.execute(
            """
            INSERT INTO study_entries
                (import_id, started_at, ended_at, duration_mins,
                 subject_tag, breaks_taken, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                study_import_id,
                started.isoformat(sep=" "),
                ended.isoformat(sep=" "),
                dur_mins, subject, breaks, notes,
            ),
        )

    # ── 8. Cohort entry — derived from actual inserted logs ───────────────────
    print("  [8/8] Computing cohort_students metrics from inserted logs…")

    try:
        # Average daily study hours
        row = conn.execute(
            """
            SELECT SUM(duration_mins)                          AS total_mins,
                   COUNT(DISTINCT DATE(started_at))            AS days
            FROM study_entries WHERE import_id = %s
            """,
            (study_import_id,),
        ).fetchone()
        total_mins     = row["total_mins"] or 0
        days           = row["days"]       or 1
        avg_study_hours = round(total_mins / 60.0 / days, 1)

        # Average attention span: duration / (breaks + 1) per session
        row = conn.execute(
            """
            SELECT AVG(duration_mins / (breaks_taken + 1.0)) AS avg_att
            FROM study_entries WHERE import_id = %s
            """,
            (study_import_id,),
        ).fetchone()
        avg_attention = round(row["avg_att"]) if row["avg_att"] is not None else 44

        # Average sleep hours (sleep_analysis records only)
        row = conn.execute(
            """
            SELECT AVG(value_num) AS avg_sleep
            FROM health_metrics
            WHERE import_id = %s AND type = 'sleep_analysis'
            """,
            (health_import_id,),
        ).fetchone()
        avg_sleep = round(row["avg_sleep"], 1) if row["avg_sleep"] is not None else 7.6

        # Focus ratio: productive minutes / total minutes × 100
        row = conn.execute(
            """
            SELECT SUM(CASE WHEN category = 'Productive' THEN duration_mins ELSE 0 END) AS prod,
                   SUM(duration_mins)                                                     AS total
            FROM app_usage_entries WHERE import_id = %s
            """,
            (app_import_id,),
        ).fetchone()
        if row["total"] and row["total"] > 0:
            focus_ratio = round(100.0 * row["prod"] / row["total"], 1)
        else:
            focus_ratio = 58.2

        # Average breaks per session
        row = conn.execute(
            "SELECT AVG(breaks_taken) AS avg_breaks FROM study_entries WHERE import_id = %s",
            (study_import_id,),
        ).fetchone()
        avg_breaks = round(row["avg_breaks"], 1) if row["avg_breaks"] is not None else 1.8

    except Exception as exc:
        print(f"  ⚠  Metric computation failed ({exc}); using fallback values.")
        avg_study_hours = 4.1
        avg_attention   = 44
        avg_sleep       = 7.6
        focus_ratio     = 58.2
        avg_breaks      = 1.8

    current_grade = 74.5

    conn.execute(
        """
        INSERT INTO cohort_students
            (study_hours, attention_span, focus_ratio, sleep_hours,
             break_freq, current_grade)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (avg_study_hours, avg_attention, focus_ratio, avg_sleep, avg_breaks, current_grade),
    )

    print(f"     study={avg_study_hours}h  attention={avg_attention}min  "
          f"focus={focus_ratio}%  sleep={avg_sleep}h  breaks={avg_breaks}  grade={current_grade}")

    conn.commit()
    return user_id


# ── Cleanup helpers ───────────────────────────────────────────────────────────

def _clean(conn: psycopg.Connection) -> None:
    """Delete all data tied to the demo user."""
    row = conn.execute(
        "SELECT user_id FROM users WHERE email = %s", (DEMO_EMAIL,)
    ).fetchone()
    if not row:
        return
    uid = str(row["user_id"])
    for table in ("app_usage_imports", "study_imports",
                  "health_imports", "uploaded_files"):
        conn.execute(f"DELETE FROM {table} WHERE session_id = %s", (uid,))
    conn.execute("DELETE FROM users WHERE email = %s", (DEMO_EMAIL,))
    conn.commit()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed ScholarVision with a fully-populated test/demo user.",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Delete existing demo user and all linked records, then re-seed.",
    )
    args = parser.parse_args()

    print(f"\n  ScholarVision — Test User Seeder")
    print(f"  {'=' * 54}")

    with psycopg.connect(_dsn(), row_factory=dict_row) as conn:

        existing = conn.execute(
            "SELECT user_id FROM users WHERE email = %s", (DEMO_EMAIL,)
        ).fetchone()

        if existing:
            if not args.force:
                print(f"\n  ✓ Demo user already exists.")
                print(f"    user_id: {existing['user_id']}")
                print(f"\n    Use --force to delete and re-seed.")
                _print_instructions(str(existing['user_id']))
                return
            print(f"  --force: removing existing demo data…")
            _clean(conn)
            print(f"  ✓ Cleaned up.\n")

        print(f"  Email:     {DEMO_EMAIL}")
        print(f"  Password:  {DEMO_PASSWORD}")
        print(f"  Demo week: {BASE_DATE} → {day(6)}\n")

        try:
            user_id = seed(conn)
        except Exception as exc:
            conn.rollback()
            print(f"\n  ✗ Seed failed: {exc}")
            raise

    _print_instructions(user_id)


def _print_instructions(user_id: str) -> None:
    print(f"\n  {'=' * 54}")
    print(f"  ✓  All data seeded successfully.\n")
    print(f"  Log in at the app with:\n")
    print(f"      Email:    {DEMO_EMAIL}")
    print(f"      Password: {DEMO_PASSWORD}\n")
    print(f"  user_id (= session_id in DB): {user_id}\n")
    print(f"  Then navigate to each section:\n")
    print(f"    Health      → 1 import · 35 metrics (sleep, HR, steps)")
    print(f"    Files       → 3 files  · 4 parsed grades")
    print(f"    App Usage   → 1 import · 49 entries (7 apps × 7 days)")
    print(f"    Study Log   → 1 import · 14 sessions (2/day × 7 days)")
    print(f"    Predictions → all 5 sliders seeded with real values")
    print(f"                  sleepHours ≈7.6h  studyHours ≈4.1h")
    print(f"                  attentionSpan ≈45min  breakFreq ≈1.8")
    print(f"                  focusRatio ≈58%")
    print(f"    Peers       → demo user in top ~35% of cohort")
    print(f"  {'=' * 54}\n")


if __name__ == "__main__":
    main()
