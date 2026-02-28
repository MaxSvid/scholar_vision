# ScholarVision — Local Setup & Testing Guide

## Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | ≥ 24 | Runs PostgreSQL + pgAdmin |
| [Node.js](https://nodejs.org/) | ≥ 20 | React frontend dev server |
| [Python](https://www.python.org/downloads/) | 3.13 | FastAPI backend |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | latest | Python package manager |

Verify everything is installed:

```bash
docker --version
node --version
python --version
uv --version
```

---

## Project Structure Overview

```
scholar_vision/
├── front-end/          React app (Vite, port 5173 in dev)
├── routers/            FastAPI route handlers
├── database/           psycopg DB helpers + cohort module
├── parsers/            Apple Health + file parsers
├── ml_engine.py        ML inference engine (DT / KNN / RF + SHAP)
├── scripts/
│   ├── generate_mock_cohort.py    Generates mock_cohort_data.csv
│   └── seed_db.py                 Seeds cohort_students table
├── init_DB/db.sql      Full schema (runs automatically on first postgres start)
├── models/             Persisted .joblib model files (created at first start)
├── docker-compose.yaml Postgres + pgAdmin + app (production)
├── Dockerfile          Multi-stage build (Node → Python)
├── pyproject.toml      Python dependencies
└── .env                Environment variables
```

---

## Mode A — Local Development (recommended for coding)

In this mode the **database runs in Docker** while the **backend and frontend run directly on your machine** for fast hot-reload.

### Step 1 — Clone and enter the project

```bash
git clone <repo-url>
cd scholar_vision
```

### Step 2 — Verify .env credentials

The `.env` file should already contain:

```
POSTGRES_PASSWORD=sql_password
POSTGRES_USER=tester
POSTGRES_DB=sql_db
PGDATA=/var/lib/postgresql/data
POSTGRES_PORT_HOST=5432
POSTGRES_HOST=postgres

PGADMIN_PORT_HOST=5050
PGADMIN_DEFAULT_EMAIL=admin@admin.com
PGADMIN_DEFAULT_PASSWORD=admin
```

> No changes needed for local development.

### Step 3 — Start the database only

```bash
docker-compose up -d postgres pgadmin
```

Wait until postgres is healthy (~10 seconds):

```bash
docker ps   # STATUS should show "(healthy)" for scholar_postgres
```

### Step 4 — Install Python dependencies

```bash
uv sync
```

> This installs FastAPI, scikit-learn, SHAP, psycopg, pandas, and all other backend deps.

### Step 5 — Generate synthetic cohort data

```bash
uv run python scripts/generate_mock_cohort.py
```

Outputs `mock_cohort_data.csv` (1,000 synthetic student rows) in the project root.

### Step 6 — Seed the database

The seed script waits for Postgres automatically:

```bash
POSTGRES_HOST=localhost uv run python3 scripts/seed_db.py
```

Expected output:
```
  Waiting for PostgreSQL at localhost:5432…  ready.
  Creating cohort_students table (if not exists)…
  Loaded 1000 rows from mock_cohort_data.csv.
  Inserting 1000 rows into cohort_students…
  ✓ Seeded 1000 students successfully.

  Verify in pgAdmin → localhost:5050 → sql_db → cohort_students
```

> To re-seed from scratch: `POSTGRES_HOST=localhost python scripts/seed_db.py --force`

### Step 7 — Start the FastAPI backend

```bash
POSTGRES_HOST=localhost uv run uvicorn main:app --reload --port 8000
```

On first start the ML engine will train three models and save them to `/models/`:
```
INFO  No persisted models found — training now…
INFO  Models trained and saved to models
INFO  Cohort loaded from DB: 1000 rows.
INFO  Uvicorn running on http://0.0.0.0:8000
```

Subsequent starts skip training:
```
INFO  Loading persisted models from models
INFO  Cohort loaded from DB: 1000 rows.
```

### Step 8 — Start the React frontend

Open a **new terminal**:

```bash
cd front-end
npm install
npm run dev
```

```
  VITE v5.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

### Local dev access points

| Service | URL |
|---|---|
| React app | http://localhost:5173 |
| FastAPI (API) | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |

---

## Mode B — Full Docker (production simulation)

Everything — frontend, backend, database — runs inside Docker. The React app is built into static files and served by FastAPI.

```bash
docker-compose up --build -d
```

Build takes ~2 minutes (Node build + Python install). Then seed the DB from inside the container:

```bash
docker exec -it scholar_app python scripts/seed_db.py
```

Access points:

| Service | URL |
|---|---|
| Full app (React + API) | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| pgAdmin | http://localhost:5050 |

Stop everything:

```bash
docker-compose down          # keeps DB data (volume preserved)
docker-compose down -v       # also wipes the DB volume
```

---

## Verify Database with pgAdmin

1. Open http://localhost:5050
2. Login: `admin@admin.com` / `admin`
3. Right-click **Servers → Register → Server**
4. **General** tab → Name: `ScholarVision`
5. **Connection** tab:
   - Host: `postgres` (Docker mode) or `localhost` (local dev)
   - Port: `5432`
   - Username: `tester`
   - Password: `sql_password`
   - Database: `sql_db`
6. Click **Save**

Run a verification query:

```sql
-- Cohort populated?
SELECT COUNT(*) FROM cohort_students;        -- expect 1000

-- Grade distribution
SELECT
  CASE
    WHEN current_grade >= 90 THEN 'A+'
    WHEN current_grade >= 80 THEN 'A'
    WHEN current_grade >= 70 THEN 'B'
    WHEN current_grade >= 60 THEN 'C'
    ELSE 'D/F'
  END AS grade_band,
  COUNT(*) AS students,
  ROUND(AVG(current_grade)::numeric, 1) AS avg_grade
FROM cohort_students
GROUP BY 1
ORDER BY avg_grade DESC;

-- Health imports
SELECT COUNT(*) FROM health_imports;

-- Uploaded files
SELECT COUNT(*) FROM uploaded_files;
```

---

## Testing the API

### Interactive Swagger UI

Open http://localhost:8000/docs — all endpoints are listed and executable from the browser.

### Prediction Engine — all three modes

**Clear-Cut Rules (Decision Tree)**
```bash
curl -X POST http://localhost:8000/api/predictions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studyHours": 5,
    "attentionSpan": 40,
    "focusRatio": 70,
    "sleepHours": 7,
    "breakFreq": 2,
    "analysis_mode": "strict"
  }'
```

**Peer Comparison (KNN — reads from DB)**
```bash
curl -X POST http://localhost:8000/api/predictions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studyHours": 5,
    "attentionSpan": 40,
    "focusRatio": 70,
    "sleepHours": 7,
    "breakFreq": 2,
    "analysis_mode": "peer"
  }'
```

**Deep Context (Random Forest + SHAP)**
```bash
curl -X POST http://localhost:8000/api/predictions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "studyHours": 9,
    "attentionSpan": 75,
    "focusRatio": 85,
    "sleepHours": 8,
    "breakFreq": 4,
    "analysis_mode": "deep"
  }'
```

Expected response shape:
```json
{
  "predicted_score": 78.4,
  "predicted_grade": "B",
  "analysis_mode": "peer",
  "text_advice": "YOUR 5 CLOSEST PEERS (by study profile):\n ..."
}
```

### Health data import

```bash
curl -X POST "http://localhost:8000/api/health/import?session_id=test-session-1" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "metrics": [
      {
        "type": "step_count",
        "data_class": "HKQuantityTypeIdentifierStepCount",
        "value": 9200,
        "unit": "count",
        "start_time": "2026-02-28T08:00:00",
        "end_time": "2026-02-28T09:00:00"
      },
      {
        "type": "heart_rate",
        "data_class": "HKQuantityTypeIdentifierHeartRate",
        "value": 68,
        "unit": "bpm",
        "start_time": "2026-02-28T08:30:00"
      },
      {
        "type": "sleep_analysis",
        "data_class": "HKCategoryTypeIdentifierSleepAnalysis",
        "value": 7.5,
        "unit": "h",
        "start_time": "2026-02-27T23:00:00",
        "end_time": "2026-02-28T06:30:00"
      }
    ]
  }'
```

Check the import list:
```bash
curl "http://localhost:8000/api/health/imports?session_id=test-session-1"
```

Check the aggregated summary:
```bash
curl "http://localhost:8000/api/health/metrics/summary?session_id=test-session-1"
```

### File upload

```bash
curl -X POST "http://localhost:8000/api/files/upload?session_id=test-session-1" \
  -F "file=@/path/to/your/document.pdf"
```

List uploaded files:
```bash
curl "http://localhost:8000/api/files?session_id=test-session-1"
```

### System health check

```bash
curl http://localhost:8000/api
# {"message": "System Active", "docs": "/docs"}
```

---

## Testing the Frontend

Open http://localhost:5173 (dev) or http://localhost:8000 (Docker).

| Feature | Where to test |
|---|---|
| User registration / login | Landing page → Auth modal |
| Study log | Dashboard → Study Log tab |
| App usage tracker | Dashboard → App Usage tab |
| Attention span timer | Dashboard → Attention tab |
| **Prediction Engine** | Dashboard → Prediction tab → switch modes, move sliders |
| 3D influence graph | Dashboard → 3D Graph tab |
| Peer benchmark | Dashboard → Peers tab |
| File import | Dashboard → Files tab → upload a PDF or DOCX |
| Apple Health import | Dashboard → Health tab → paste or drop JSON |

---

## Resetting State

| What | Command |
|---|---|
| Wipe DB data and restart fresh | `docker-compose down -v && docker-compose up -d postgres pgadmin` then re-seed |
| Retrain ML models from scratch | Delete the `/models` folder and restart the backend |
| Re-seed cohort with new data | `POSTGRES_HOST=localhost python scripts/seed_db.py --force` |
| Clear frontend session data | Browser DevTools → Application → Session Storage → clear `sv_session_id` |

---

## Troubleshooting

**`Connection refused` on seed_db.py**
Postgres is not yet ready. Wait 10–15 seconds and retry. The script will also auto-wait for up to 60 seconds.

**`ModuleNotFoundError: No module named 'shap'`**
Dependencies are not installed. Run `uv sync` from the `scholar_vision/` root.

**`503 ML models not ready`**
The backend started but the lifespan hook hasn't finished training. Wait 20–30 seconds for first-time model training, then retry. Subsequent starts are instant (models load from disk).

**pgAdmin can't connect to `postgres` host**
This hostname works inside Docker networking only. When connecting from the pgAdmin UI running in Docker to the Postgres container, use host `postgres`. If running pgAdmin locally (outside Docker), use `localhost`.

**Vite proxy errors (`ECONNREFUSED`)**
The backend is not running. Make sure `uvicorn main:app --reload --port 8000` is active before using the frontend.

**CORS errors in browser console**
Only `http://localhost:5173` is in the CORS allowlist. Do not access the React app via `127.0.0.1:5173` or any other origin.
