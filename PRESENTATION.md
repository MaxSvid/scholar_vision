# ScholarVision — Hackathon Presentation
### RGU Hack '26 · Study Optimisation & Academic Intelligence Platform

---

## The Problem

Students consistently underperform not because they lack intelligence, but because they lack **visibility into their own behaviour**. They don't know:

- Whether they are studying enough compared to students who succeed
- Which habits are actually hurting their grades
- What their academic trajectory looks like before it's too late to change it

By the time exam results arrive, the opportunity to course-correct has already passed. Traditional academic support is reactive — ScholarVision makes it **proactive**.

---

## What We Built

**ScholarVision** is an AI-powered student personal assistant that tracks study behaviour, analyses patterns, and uses real machine learning models to predict academic outcomes — with actionable, explainable advice — before exams happen.

It answers the question every student quietly asks: _"Am I on track?"_

---

## How It Works — End to End

### 1. Student Registers & Sets Goals
The student creates a profile with their field of study, year, university, weekly study hour target, and academic goal. This establishes a baseline for comparison.

### 2. Daily Data Collection (3 trackers)

**Study Log**
The student logs each study session: subject, hours, date, and notes. The dashboard shows a 7-day bar chart of study hours, total logged time, and average session length. Over time this builds a behavioural timeline.

**App Usage Monitor**
The student logs how long they spent on each app. ScholarVision automatically categorises apps as:
- **Productive** — VS Code, Notion, Anki, Zotero, Word, Excel
- **Neutral** — Spotify, Slack, Email
- **Distracting** — TikTok, Instagram, Reddit, Netflix, Gaming

It calculates a **Focus Ratio** (productive hours / total screen time × 100%) which becomes a direct input to the ML prediction model.

**Attention Span Tracker**
Includes a live Pomodoro-style focus timer. The student starts the timer, studies, then stops it — the session is automatically logged with duration and quality rating. They can also log sessions manually. Tracks average attention span, best session, and high-quality session count.

### 3. File Import — Academic Records
Students upload their grade sheets, transcripts, or feedback reports (PDF, DOCX, XLSX, CSV, TXT). The backend parser automatically extracts:
- Course names and codes (e.g. `CS101`, `MATH 202`)
- Grade letters (`A+`, `B-`)
- Scores and percentages (`87%`, `42/50`)
- Semester information

All extracted grades are stored in the database, building a structured academic history from existing documents.

### 4. Apple Health Integration
Students import their Apple Health JSON export. ScholarVision ingests sleep data, step counts, heart rate, and other health metrics — because sleep hours and physical activity are proven predictors of cognitive performance and academic outcomes.

### 5. AI Prediction Engine — The Core
Once the student has entered their data, they go to the **Prediction Panel**. They set sliders for their current metrics and run one of three ML analysis modes:

---

## The Machine Learning Engine

### Training Data
The models are trained on a **synthetic cohort of 1,000 students** with realistic distributions of study behaviour and academic outcomes. The synthetic data is generated using statistical relationships between habits and grades — e.g. students who study more tend to have higher focus ratios and better grades, with realistic noise and variance.

On deployment, the engine also loads **real peer data from the PostgreSQL database** (the `cohort_students` table), replacing the synthetic data as real users join the platform.

### Input Features (5 behavioural signals)

| Feature | What it measures |
|---|---|
| `studyHours` | Average daily study hours |
| `attentionSpan` | Average focus session length (minutes) |
| `focusRatio` | Productive app usage as % of total screen time |
| `sleepHours` | Hours of sleep per night |
| `breakFreq` | Number of structured breaks per study day |

### Target
Predicted academic score (0–100), converted to a grade letter (A+ through F).

---

### Mode 1 — STRICT (Decision Tree)
**Algorithm:** Decision Tree Regressor (max depth 3)

**Why:** Decision Trees produce a transparent, human-readable decision path. Every prediction can be explained as a series of IF/THEN rules — no black box.

**Output example:**
```
DECISION PATH:
  [1] Daily study hours = 3.5h ≤ 4.2h  → lower range
  [2] Sleep hours = 6.0h ≤ 6.8h        → lower range

PREDICTED SCORE: 58 / 100  [D]
TRAJECTORY: ↓ AT RISK — INTERVENTION REQUIRED

IMPROVEMENT LEVERS:
  → Study hours (3.5h) are below 4h — the highest-leverage change available.
  → Sleep (6.0h) is below 7h — memory consolidation is impaired.
```

This mode is ideal for students who want to understand exactly which threshold they are falling short on.

---

### Mode 2 — PEER (K-Nearest Neighbours)
**Algorithm:** K-Nearest Neighbours (k=5, Euclidean distance, StandardScaler normalisation)

**Why:** Students respond well to peer comparison — "students like you" is more motivating than abstract scores. KNN finds the 5 students in the cohort whose study profiles are most similar to yours and compares your metrics directly.

**Output example:**
```
YOUR 5 CLOSEST PEERS (by study profile):

  Daily study hours      peer avg: 5.2h    you: 3.5h   ↓ -1.7
  Attention span         peer avg: 48min   you: 40min  ↓ -8.0
  Focus ratio            peer avg: 72%     you: 70%    ≈
  Sleep hours            peer avg: 7.4h    you: 6.0h   ↓ -1.4
  Breaks / day           peer avg: 3.1     you: 2.0    ↓ -1.1

  Peer avg grade:  74/100
  Your prediction: 58/100

BIGGEST GAPS TO CLOSE:
  → Daily study hours: +1.7h would align you with peer average
  → Sleep hours: +1.4h would align you with peer average
```

---

### Mode 3 — DEEP (Random Forest + SHAP)
**Algorithm:** Random Forest Regressor (150 trees) + SHAP (SHapley Additive exPlanations)

**Why:** Random Forest is the most accurate of the three models — 150 decision trees averaged together reduce variance and overfitting. SHAP values provide mathematically rigorous explanations of exactly how much each feature contributed to the prediction, positive or negative.

**Why SHAP specifically:** SHAP is grounded in game theory (Shapley values from cooperative game theory). Each feature's contribution is calculated by averaging its marginal contribution across all possible feature orderings — giving a fair, consistent attribution score.

**Output example:**
```
SHAP FEATURE ATTRIBUTION — WHAT DRIVES YOUR SCORE:

  TOP POSITIVE FACTOR:  Focus ratio  ( +4.2 pts )
  TOP NEGATIVE FACTOR:  Sleep hours  ( -8.1 pts )

  FULL BREAKDOWN:
  Focus ratio            70%     +4.2 pts  ████
  Daily study hours      3.5h    +1.1 pts  █
  Breaks / day           2       +0.3 pts
  Attention span         40min   -2.4 pts  ██
  Sleep hours            6.0h    -8.1 pts  ████████

PREDICTED SCORE:  58 / 100  [D]

HIGHEST IMPACT ACTION:
  → Improving sleep hours is currently costing you ~8.1 pts. Address this first.
```

This is Explainable AI (XAI) in practice — the model doesn't just predict, it shows its reasoning transparently.

---

## Technical Stack

### Frontend
| Technology | Role |
|---|---|
| **React 18** | Component-based UI framework |
| **Vite** | Build tool and dev server |
| **Three.js** | 3D animated data visualisations (hero graph, peer graph) |
| **Lucide React** | Icon library |
| Pure CSS | Custom retro terminal aesthetic — no UI component library |

All charts (bar charts, horizontal charts, score ring) are built from scratch in CSS — no Chart.js or D3 dependency.

### Backend
| Technology | Role |
|---|---|
| **Python 3.13** | Core language |
| **FastAPI** | High-performance async API framework |
| **uvicorn** | ASGI server |
| **psycopg3** | Async PostgreSQL driver |
| **scikit-learn** | Decision Tree, Random Forest, KNN models |
| **SHAP** | Explainable AI — feature attribution values |
| **pandas / numpy** | Data processing and feature engineering |
| **joblib** | Model serialisation (persist trained models to disk) |
| **pdfplumber** | PDF parsing |
| **python-docx** | DOCX parsing |
| **aiofiles** | Async file I/O |

### Database
| Technology | Role |
|---|---|
| **PostgreSQL 16** | Primary relational database |
| **pgAdmin 4** | Database management UI |

### Infrastructure
| Technology | Role |
|---|---|
| **Docker** | Multi-stage containerisation |
| **Docker Compose** | Orchestrates postgres + pgadmin + app |
| **Caddy** | Reverse proxy + automatic HTTPS (Let's Encrypt) |
| **VPS** | Self-hosted on Ubuntu server |

---

## System Architecture

```
Browser
   │
   ▼
Caddy (HTTPS · scholarvision.uk)
   │
   ▼
Docker Container — scholar_app
   ├── FastAPI (Python)
   │     ├── /api/predictions/analyze  ← ML inference
   │     ├── /api/files/upload         ← file parsing
   │     ├── /api/health/import        ← Apple Health
   │     └── /  (StaticFiles)          ← React SPA
   │
Docker Container — scholar_postgres
   ├── users, profiles, features
   ├── study_sessions, app_usage_logs
   ├── uploaded_files, parsed_grades
   ├── health_imports, health_metrics
   ├── ml_predictions, xai_explanations
   └── cohort_students (peer KNN data)
```

The React frontend is **built at Docker image build time** (Node.js multi-stage build) and served directly by FastAPI as static files. There is no separate frontend server in production.

---

## Database Schema — 8 Sections

1. **Auth** — `users`, `user_identities` (OAuth ready)
2. **Profile** — `student_profiles`, `student_features` (ML feature vectors)
3. **Academic** — `academic_performance`, `course_enrollments`, `assessment_results`
4. **Passive Collection** — `study_sessions`, `app_usage_logs`, `library_access_logs`
5. **Enrichment** — `extracurricular_activities`, `internships`, `certifications`
6. **Soft Skills** — `peer_reviews`, `professor_feedback`
7. **ML Targets** — `career_outcomes` (Placed / Unemployed / Higher Education / Self-Employed)
8. **AI Layer** — `ml_predictions`, `xai_explanations` (SHAP values + rank), `improvement_recommendations`

---

## Judging Criteria — Our Case

### Impact
ScholarVision addresses a universal and high-stakes student problem: academic underperformance due to poor behavioural habits. The tool gives students actionable, personalised intelligence **before** results arrive — when it can still make a difference. The peer comparison feature leverages social motivation (one of the strongest behavioural drivers) to make advice feel relevant rather than generic. Apple Health integration connects physical wellbeing to academic outcomes — a link backed by extensive research.

### Innovation
- **Three ML models in one tool** — each optimised for a different type of insight (rules, peers, attribution)
- **SHAP-based explainability** — not just "you scored 58" but "sleep is costing you 8 points — fix this first"
- **Automatic academic record parsing** — students upload a PDF and grades are extracted automatically, no manual entry
- **Apple Health integration** — passive health data feeds into academic prediction
- **Peer benchmarking with KNN** — "students like you" comparison computed mathematically, not curated manually

### Technical Difficulty
- Full-stack application: React SPA + FastAPI async backend + PostgreSQL
- Three distinct ML models trained, persisted, and served in production
- SHAP explainability layer on top of Random Forest
- Multi-format file parser (PDF, DOCX, XLSX, CSV, TXT) with regex-based grade extraction
- Apple Health JSON ingestion and metric classification
- Multi-stage Docker build (Node → Python, no Node in production image)
- Self-hosted on VPS with automatic HTTPS via Caddy + Let's Encrypt
- Full PostgreSQL schema with 20+ tables covering the complete student data lifecycle

---

## Live Demo Flow

1. **Register** — create a profile with name, field of study, year, weekly target
2. **Study Log** — log a study session, see the 7-day chart update
3. **App Usage** — log time on TikTok vs VS Code, watch focus ratio calculate
4. **Attention Span** — start the live focus timer, stop it, see it auto-log
5. **Prediction** — adjust sliders, run DEEP mode, see SHAP attribution breakdown
6. **Files** — upload a grade sheet, see parsed courses and scores returned
7. **Health** — import Apple Health data, see sleep and activity metrics stored

---

## What's Next (Beyond the Hackathon)

- Real-time passive tracking via browser extension (no manual logging)
- University integration — pull grades directly from student portals
- Longitudinal trajectory — semester-over-semester prediction curves
- Group study optimisation — schedule coordination for peer study groups
- Career outcome prediction — link current habits to post-graduation outcomes (the `career_outcomes` table is already in the schema)
