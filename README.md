# ScholarVision

AI-Driven Student Personal Assistant - RGU Hack '26

Scholar Vision uses a quantifiable approach to map your academic journey against other peers, predict your grade trajectory, and give you actionable advice that tracks study behaviour, analyses patterns, and uses real machine learning models to predict academic outcomes.
---

More information in the [presentation tutorial](PRESENTATION.md)

## Project Structure

```
scholar_vision/
├── main.py                  ← FastAPI entry point, registers all routers
├── ml_engine.py             ← All ML logic (Decision Tree, KNN, Random Forest + SHAP)
├── routers/
│   ├── predictions.py       ← POST /api/predictions/analyze
│   ├── files.py             ← File upload / list / delete
│   └── health.py            ← Apple Health data import
├── parsers/
│   ├── file_parser.py       ← PDF / DOCX / CSV / XLSX / TXT → structured grades
│   └── health_parser.py     ← Apple Health JSON → health metrics
├── database/
│   ├── connection.py        ← Async DB connection pool (psycopg)
│   ├── execute.py           ← Query helpers: execute, fetch_one, fetch_all
│   └── cohort.py            ← Fetches live peer data from DB for KNN model
├── models/                  ← Persisted trained model files (.joblib)
├── uploads/                 ← Saved uploaded files (UUID-named)
├── scripts/
│   ├── generate_mock_cohort.py  ← Generates synthetic student CSV
│   └── seed_db.py               ← Seeds the cohort_students table
├── init_DB/db.sql           ← Full PostgreSQL schema, auto-runs on first Docker start
├── front-end/               ← React + Vite app
│   ├── src/
│   │   ├── App.jsx          ← Root: switches between HeroPage and Dashboard
│   │   ├── components/      ← All UI panels (see Frontend section)
│   │   └── index.css        ← Global retro terminal styles
│   ├── Dockerfile           ← (not used — built inside root Dockerfile)
│   └── vite.config.js       ← Vite config, binds to 0.0.0.0 for Docker
├── Dockerfile               ← Multi-stage: Node builds React → Python serves everything
├── docker-compose.yaml      ← postgres + pgadmin + app (one FastAPI container)
├── pyproject.toml           ← Python dependencies (uv)
└── .env                     ← Secrets (DB credentials, ports) — never commit this
```

---

## Backend

### `main.py` — Entry Point

- Creates the FastAPI app with a **lifespan** function that runs on startup:
  1. Creates `uploads/` and `models/` directories if missing
  2. Trains or loads the ML models (`ml_engine.ensure_ready()`)
  3. Fetches live cohort data from the DB for peer comparison (`ml_engine.load_cohort_from_db()`)
- Registers three routers: `files`, `health`, `predictions`
- Adds CORS middleware (allows `http://localhost:5173` for local Vite dev)
- Mounts the built React app at `/` if `front-end/dist/` exists (skipped during local dev without a build)

---

### `ml_engine.py` — ML Models

The core intelligence of the project. Trains three models on a 1,000-student synthetic dataset and persists them to `models/` so they only train once.

**Input features (5):**

| Feature | Description |
|---|---|
| `studyHours` | Daily study hours (0–16h) |
| `attentionSpan` | Average focus session length (5–120 min) |
| `focusRatio` | Productive app usage ratio (0–100%) |
| `sleepHours` | Hours of sleep per night (3–12h) |
| `breakFreq` | Number of breaks per study day (0–10) |

**Target:** `currentGrade` — predicted score out of 100

**Three analysis modes:**

| Mode | Algorithm | Output |
|---|---|---|
| `strict` | Decision Tree (max depth 3) | Traces the exact decision path — produces human-readable IF/THEN rules explaining why you got that score |
| `peer` | K-Nearest Neighbours (k=5) | Finds 5 students with the most similar study profile, compares your metrics to theirs, shows where you're behind |
| `deep` | Random Forest (150 trees) + SHAP | Uses SHAP values to show exactly how much each factor contributed to your score — identifies your single highest-impact improvement |

On startup it also tries to replace the synthetic CSV data with real peer data from the `cohort_students` database table. If the DB is unavailable it silently falls back to the CSV.

---

### API Endpoints

#### Predictions — `routers/predictions.py`

```
POST /api/predictions/analyze
```

Request body:
```json
{
  "studyHours": 5.0,
  "attentionSpan": 40,
  "focusRatio": 70,
  "sleepHours": 7,
  "breakFreq": 2,
  "analysis_mode": "strict"   // "strict" | "peer" | "deep"
}
```

Response:
```json
{
  "predicted_score": 74.3,
  "predicted_grade": "B",
  "analysis_mode": "strict",
  "text_advice": "DECISION PATH:\n  [1] Daily study hours = 5h > 4.2h ..."
}
```

---

#### File Import — `routers/files.py`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/files/upload` | Upload a file (PDF/DOCX/XLSX/CSV/TXT, max 20 MB). Parses grades automatically. |
| `GET` | `/api/files?session_id=...` | List all files for a session |
| `GET` | `/api/files/{file_id}` | Full file record + extracted grades + text snippets |
| `DELETE` | `/api/files/{file_id}` | Delete file from disk and DB |

Upload form fields: `file`, `session_id`, `category` (optional), `notes` (optional)

---

#### Apple Health — `routers/health.py`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/health/import?session_id=...` | Import Apple Health JSON export (max 10 MB) |
| `GET` | `/api/health/imports?session_id=...` | List all imports for a session |
| `GET` | `/api/health/imports/{import_id}` | Import detail + all metrics |
| `DELETE` | `/api/health/imports/{import_id}` | Delete import and all its metrics |
| `GET` | `/api/health/metrics/summary?session_id=...` | Aggregated counts by metric type |

---

### `parsers/file_parser.py` — File Parsing

Handles each file type differently then runs the same regex patterns across all of them:

| Format | Library | Method |
|---|---|---|
| PDF | `pdfplumber` | Extracts tables first, then falls back to line-by-line text |
| DOCX | `python-docx` | Reads paragraphs and tables |
| CSV / XLSX | `pandas` | Detects columns by name (`course`, `grade`, `score`, `semester`, etc.) |
| TXT | built-in | Line-by-line with regex |
| Images | — | No text extraction, stored only |

Regex patterns it looks for:
- Course codes: `CS101`, `MATH 202`, `ENG-003`
- Grade letters: `A+`, `B-`, `C`
- Percentages: `87%`, `87/100`
- Score fractions: `42/50`
- Semester hints: `Semester 1`, `Spring 2024`

---

## Database Schema

8 sections, all defined in `init_DB/db.sql` (auto-runs on first Docker start):

| Section | Tables |
|---|---|
| Auth | `users`, `user_identities` (OAuth/Google) |
| Profile | `student_profiles`, `student_features` (ML vectors) |
| Academic | `academic_performance` (GPA), `course_enrollments`, `assessment_results` |
| Passive | `study_sessions`, `app_usage_logs`, `library_access_logs` |
| Enrichment | `extracurricular_activities`, `internships`, `certifications` |
| Soft skills | `peer_reviews`, `professor_feedback` |
| ML targets | `career_outcomes` (Placed / Unemployed / Higher Ed / Self-Employed) |
| AI layer | `ml_predictions`, `xai_explanations` (SHAP values), `improvement_recommendations` |
| File import | `uploaded_files`, `parsed_grades`, `parsed_text_snippets` |
| Health | `health_imports`, `health_metrics` |
| Peer data | `cohort_students` (feeds the KNN peer model) |

---

## Frontend

React + Vite app with a retro terminal aesthetic (monospace, dark, blinking cursors).

### Pages

**HeroPage** (unauthenticated)
- ASCII art logo with typewriter tagline effect
- LOGIN / REGISTER buttons → opens AuthModal overlay
- 6-card feature grid
- Animated 3D hero graph (`HeroGraph3D.jsx`)

**Dashboard** (after login)
- Top bar with user name and logout
- Left sidebar with 6 tabs
- Main content area swaps based on active tab

### Dashboard Tabs

| Tab | Component | What it does |
|---|---|---|
| OVERVIEW | inline | Profile card + 4 stat cards + system log terminal |
| STUDY LOG | `StudyTracker.jsx` | Log and view daily study hours |
| APP USAGE | `AppUsage.jsx` | Log and view app usage patterns |
| ATTENTION | `AttentionSpan.jsx` | Focus session tracking |
| PREDICTION | `PredictionPanel.jsx` | Sliders → calls `/api/predictions/analyze` → shows score ring + advice |
| FILES | `FileImport.jsx` | Upload academic files → calls `/api/files/upload` |
| HEALTH | `HealthImport.jsx` | Upload Apple Health JSON → calls `/api/health/import` |

### 3D Graphs

Three animated 3D visualisation components built with pure CSS/JS (no external chart library):
- `HeroGraph3D.jsx` — decorative graph on the landing page
- `DataGraph3D.jsx` — generic data visualisation used in the dashboard
- `PeerGraph3D.jsx` — shows how you compare to your 5 nearest peer students

---

## Docker

```yaml
services:
  postgres   # PostgreSQL 16, healthcheck, persistent volume
  pgadmin    # pgAdmin 4, depends on postgres being healthy
  app        # Multi-stage build: Node builds React, Python runs FastAPI
```

### Multi-stage Dockerfile

```
Stage 1 (node:20-alpine)
  → npm ci
  → npm run build
  → produces front-end/dist/

Stage 2 (python:3.13-slim)
  → pip install uv
  → uv sync --frozen (installs Python deps)
  → COPY source + dist from Stage 1
  → uvicorn main:app --host 0.0.0.0 --port 8000
  (Node is discarded — not in the final image)
```

FastAPI serves the built React files via `StaticFiles`. API routes at `/api/...` take priority; everything else falls through to `index.html` for the React SPA.

---

## Environment Variables (`.env`)

```env
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=
PGDATA=
POSTGRES_PORT_HOST=
POSTGRES_HOST=
PGADMIN_PORT_HOST=
PGADMIN_DEFAULT_EMAIL=
PGADMIN_DEFAULT_PASSWORD=
```

Copy `.env.example` and fill in your values. Never commit `.env`.
