"""
Seed the cohort_students table with synthetic student data.

Usage (from the scholar_vision/ project root):
    python scripts/seed_db.py           # seed once, skip if already populated
    python scripts/seed_db.py --force   # truncate and re-seed

Prerequisites:
    - PostgreSQL reachable (docker-compose up -d)
    - mock_cohort_data.csv present, OR the script generates it automatically
"""

import argparse
import os
import socket
import sys
import time
from pathlib import Path

# Make project root importable 
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Load .env before importing project modules 
def _load_env(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())

_load_env(ROOT / ".env")

# Project imports (after env is set) 
from database.cohort import sync_create_table, sync_count, sync_bulk_insert, sync_truncate
from scripts.generate_mock_cohort import generate

CSV_PATH = ROOT / "mock_cohort_data.csv"


# Wait for Postgres 

def wait_for_postgres(host: str, port: int, timeout: int = 60) -> bool:
    print(f"  Waiting for PostgreSQL at {host}:{port}…", end="", flush=True)
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f"  ready.")
                return True
        except (OSError, ConnectionRefusedError):
            print(".", end="", flush=True)
            time.sleep(2)
    print(f"\n  ✗ Timed out after {timeout}s.")
    return False


# Main 

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed cohort_students table.")
    parser.add_argument("--force", action="store_true", help="Truncate and re-seed.")
    args = parser.parse_args()

    host = os.getenv("POSTGRES_HOST",      "localhost")
    port = int(os.getenv("POSTGRES_PORT_HOST", "5432"))

    if not wait_for_postgres(host, port):
        sys.exit(1)

    # Create table if it doesn't exist
    print("  Creating cohort_students table (if not exists)…")
    sync_create_table()

    # Check existing rows
    count = sync_count()
    if count > 0 and not args.force:
        print(f"  ✓ Table already contains {count} rows. Use --force to re-seed.")
        return

    if args.force and count > 0:
        print(f"  --force: truncating {count} existing rows…")
        sync_truncate()

    # Generate / load CSV
    if CSV_PATH.exists():
        import pandas as pd
        df = pd.read_csv(CSV_PATH)
        print(f"  Loaded {len(df)} rows from {CSV_PATH.name}.")
    else:
        print("  CSV not found — generating synthetic cohort (n=1,000)…")
        df = generate(n=1_000)
        df.to_csv(CSV_PATH, index=False)
        print(f"  Saved to {CSV_PATH}.")

    # Bulk insert
    print(f"  Inserting {len(df)} rows into cohort_students…")
    inserted = sync_bulk_insert(df)
    print(f"  ✓ Seeded {inserted} students successfully.")
    print(f"\n  Verify in pgAdmin → localhost:5050 → sql_db → cohort_students")


if __name__ == "__main__":
    main()
