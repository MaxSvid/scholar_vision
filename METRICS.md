# ScholarVision — Collected Metrics & Prediction Model

> Frontend-only audit. No backend required to understand what is tracked.
> All data lives in React state (in-memory, lost on page refresh) except Health metrics which are persisted via the FastAPI backend.

---

## 1. User Profile
*Collected at registration (AuthModal). Stored in App-level state, passed as `user` prop throughout.*

| Field | Type | Notes |
|---|---|---|
| `firstName` / `lastName` | string | Display name only |
| `fieldOfStudy` | string | e.g. "Computer Science" |
| `yearOfStudy` | string | e.g. "3rd Year" |
| `university` | string | Optional |
| `weeklyHours` | number | Self-declared weekly study target (hours) |
| `studyGoal` | string | Free-text personal goal |

---

## 2. Study Log
*Source: `StudyTracker.jsx` — manual entry per session.*

### Raw fields logged per session
| Field | Type | Notes |
|---|---|---|
| `subject` | enum | Mathematics, Physics, Programming, Literature, History, Chemistry, Economics, Other |
| `hours` | float | Duration of the session (min 0.25h) |
| `date` | date | ISO date string |
| `notes` | string | Optional free-text |

### Derived metrics (computed in component)
| Derived metric | Formula |
|---|---|
| Total hours logged | `Σ hours` across all sessions |
| Avg hours per session | `total / session_count` |
| Session count | `sessions.length` |
| Daily totals (last 7 days) | Sessions grouped by date, summed — used for the bar chart |
| Avg daily hours | `total / unique_days` — fed into 3D graph node label |
| Avg session duration (min) | `(total / session_count) * 60` — fed into 3D graph node label |

---

## 3. App Usage
*Source: `AppUsage.jsx` — manual entry per app per day.*

### Raw fields logged per entry
| Field | Type | Notes |
|---|---|---|
| `app` | enum/string | Selected from preset list (see below) or typed |
| `hours` | float | Hours used that day |
| `date` | date | ISO date string |
| `category` | enum | Auto-assigned based on app name |

### App category classification (hardcoded)
| Category | Apps |
|---|---|
| **Productive** | VS Code, Notion, Anki, Zotero, Word, Excel, Scholar Docs |
| **Neutral** | Spotify, YouTube (Study), Slack, Email |
| **Distracting** | TikTok, Instagram, Twitter/X, Reddit, Netflix, Discord, Gaming |
| **Neutral** (fallback) | Any app not in the above lists |

### Derived metrics
| Derived metric | Formula |
|---|---|
| Total screen time | `Σ hours` across all logs |
| Productive hours | `Σ hours` where `category === 'Productive'` |
| Distracting hours | `Σ hours` where `category === 'Distracting'` |
| Focus ratio (%) | `productive / total * 100` |
| Per-app total hours | Aggregated and sorted descending — used for the horizontal bar chart |

---

## 4. Attention Span
*Source: `AttentionSpan.jsx` — live timer (auto-logged) or manual entry.*

### Raw fields logged per session
| Field | Type | Notes |
|---|---|---|
| `duration` | integer | Focus duration in minutes |
| `breaks` | integer | Number of breaks taken |
| `quality` | enum | High / Medium / Low — manually rated, or auto-assigned by timer: >30min → High, else Medium |
| `date` | date | ISO date string |

### Derived metrics
| Derived metric | Formula |
|---|---|
| Average attention span (min) | `Σ duration / session_count` |
| Best session (min) | `max(duration)` |
| High-quality session count | Count where `quality === 'High'` |
| Avg breaks per session | `Σ breaks / session_count` — fed into 3D graph |
| Focus quality % | `high_quality_count / total * 100` — fed into 3D graph |

---

## 5. Prediction Engine
*Source: `PredictionPanel.jsx` — manual slider inputs, NOT auto-wired to the trackers above.*

> **Note:** The sliders are independent — the user must set them manually. They do not automatically pull from Study Log, App Usage, or Attention trackers. This is the intended next integration step.

### Input parameters (user-adjusted sliders)
| Parameter | Range | Unit | Weight in model |
|---|---|---|---|
| Daily study hours | 0 – 16 | h | **30 pts** |
| Average attention span | 5 – 120 | min | **20 pts** |
| Productive app ratio | 0 – 100 | % | **20 pts** |
| Current grade average | 0 – 100 | % | **15 pts** |
| Hours of sleep / night | 3 – 12 | h | **10 pts** |
| Breaks per study day | 0 – 10 | — | **5 pts** |
| **Total** | | | **100 pts** |

### Scoring formula
```
score  = clamp(studyHours / 8 × 30,          0, 30)
       + clamp(attentionSpan / 60 × 20,       0, 20)
       + clamp(focusRatio / 100 × 20,         0, 20)
       + clamp(currentGrade / 100 × 15,       0, 15)
       + clamp((sleepHours − 4) / 4 × 10,    0, 10)
       + clamp(breakFreq / 4 × 5,             0,  5)
```

### Grade thresholds
| Score | Grade |
|---|---|
| ≥ 90 | A+ |
| ≥ 80 | A |
| ≥ 70 | B |
| ≥ 60 | C |
| ≥ 50 | D |
| < 50 | F |

### Automatic recommendations triggered when
- `studyHours < 4` → increase daily study time
- `attentionSpan < 30` → try Pomodoro 45/15 splits
- `focusRatio < 60` → reduce distracting app usage
- `sleepHours < 7` → aim for 7–9h for memory consolidation
- `breakFreq < 2` → take regular breaks

---

## 6. Health Data (Apple Health Import)
*Source: `HealthImport.jsx` + `routers/health.py` — JSON export from Apple Health app.*
*This is the only data source persisted in the database.*

### All recognised metric types
| Metric key | Display label | Value type |
|---|---|---|
| `step_count` | Steps | numeric (steps/day) |
| `heart_rate` | Heart Rate | numeric (bpm) |
| `resting_heart_rate` | Resting HR | numeric (bpm) |
| `walking_heart_rate_average` | Walking HR | numeric (bpm) |
| `heart_rate_variability_sdnn` | HRV | numeric (ms) |
| `blood_oxygen_saturation` | Blood O₂ | numeric (%) |
| `respiratory_rate` | Resp. Rate | numeric (breaths/min) |
| `body_temperature` | Body Temp | numeric (°C/°F) |
| `blood_pressure_systolic` | BP Systolic | numeric (mmHg) |
| `blood_pressure_diastolic` | BP Diastolic | numeric (mmHg) |
| `sleep_analysis` | Sleep | numeric (hours) or categorical |
| `active_energy_burned` | Active Cal | numeric (kcal) |
| `basal_energy_burned` | Basal Cal | numeric (kcal) |
| `distance_walking_running` | Distance | numeric (km/mi) |
| `flights_climbed` | Flights | numeric |
| `exercise_time` | Exercise | numeric (min) |
| `stand_time` | Stand Time | numeric (min) |
| `vo2_max` | VO₂ Max | numeric (mL/kg/min) |
| `body_mass` | Weight | numeric (kg/lb) |
| `body_mass_index` | BMI | numeric |
| `body_fat_percentage` | Body Fat | numeric (%) |
| `mindful_session` | Mindfulness | numeric (min) or count |
| `dietary_energy_consumed` | Calories | numeric (kcal) |
| `dietary_water` | Water | numeric (mL/L) |

### Per-record fields stored in database
| Field | Notes |
|---|---|
| `type` | Metric key from table above |
| `data_class` | Apple Health data class string |
| `value_num` | Numeric value (float), if applicable |
| `value_cat` | Categorical value (string), if applicable |
| `unit` | Unit string from Apple Health |
| `start_time` | ISO timestamp |
| `end_time` | ISO timestamp |
| `source_device` | e.g. "Apple Watch Series 9" |
| `was_user_entered` | Boolean — distinguishes manual vs sensor data |

### How health feeds the 3D graph
The API endpoint `GET /api/health/metrics/summary` returns per-type averages. These populate 5 nodes in the 3D graph:

| Graph node | Source metric | Label format |
|---|---|---|
| SLEEP | `sleep_analysis` avg | `SLEEP: X.Xh` |
| STEPS | `step_count` avg | `STEPS: X,XXX` |
| HEART RATE | `heart_rate` or `resting_heart_rate` avg | `HEART RATE: XX BPM` |
| HRV | `heart_rate_variability_sdnn` avg | `HRV: XX MS` |
| ACTIVE CAL | `active_energy_burned` avg | `ACTIVE CAL: XXX KCAL` |
| MINDFULNESS | `mindful_session` count | `MINDFULNESS: XX SESSIONS` |

---

## 7. Uploaded Files
*Source: `FileImport.jsx` + `routers/files.py` — file upload (PDF, DOCX, TXT, CSV, XLSX, PNG, JPG).*

| Field | Notes |
|---|---|
| `filename` | Original file name |
| `size` | File size in bytes |
| `content_type` | MIME type |
| `parse_status` | `pending` / `done` / `error` — set by backend parser |
| Grade / snippet extraction | Attempted by backend (content not currently displayed in frontend) |

---

## 8. Data flow into the 3D Influence Graph
*Source: `DataGraph3D.jsx` — visualises all data sources as interconnected nodes.*

The central **PREDICTED OUTCOME** node connects to 6 category nodes. Each category's leaf nodes show live values derived from the data above:

```
PREDICTED OUTCOME
├── STUDY TIME
│   ├── AVG TIME: Xh/day          ← StudyTracker (avg daily hours)
│   ├── SESSION: ~Xmin             ← StudyTracker (avg session duration)
│   └── SLEEP: 7h/night            ← static placeholder (not yet wired)
├── ATTENTION SPAN
│   ├── AVG SPAN: Xmin             ← AttentionSpan (avg duration)
│   ├── BREAKS: X/session          ← AttentionSpan (avg breaks)
│   └── FOCUS QUALITY: X% HIGH     ← AttentionSpan (high quality %)
├── APP USAGE
│   ├── Obsidian / VS Code / Anki  ← AppUsage (hours per app)
│   ├── AI Agents / Notion         ← AppUsage
│   ├── TikTok (distracting)       ← AppUsage
│   └── Discord / YouTube          ← AppUsage
├── MAJOR / FIELD
│   ├── FIELD OF STUDY             ← User profile
│   ├── YEAR / LEVEL               ← User profile
│   └── WEEKLY TARGET              ← User profile
├── WEBSITES
│   ├── Google Scholar             ← static (not yet tracked)
│   ├── ArXiv                      ← static (not yet tracked)
│   ├── Reddit                     ← static (not yet tracked)
│   └── YouTube Study              ← static (not yet tracked)
└── HEALTH
    ├── SLEEP                      ← HealthImport (sleep_analysis avg)
    ├── STEPS                      ← HealthImport (step_count avg)
    ├── HEART RATE                 ← HealthImport (heart_rate avg)
    ├── HRV                        ← HealthImport (hrv avg)
    ├── ACTIVE CAL                 ← HealthImport (active_energy_burned avg)
    └── MINDFULNESS                ← HealthImport (mindful_session count)
```

---

## 9. Gaps & Not-yet-connected data

| Gap | Description |
|---|---|
| Prediction sliders not auto-filled | `PredictionPanel` sliders are manually set; they should eventually pull from StudyTracker, AppUsage, and AttentionSpan automatically |
| Website tracking not implemented | The WEBSITES cluster in the 3D graph has static placeholder nodes; no actual browser history is collected |
| Sleep node in STUDY cluster | Hard-coded to "7h/NIGHT" — should pull from Health `sleep_analysis` avg |
| File content not displayed | Files are uploaded and stored but extracted grades/snippets are not surfaced in the UI |
| Health not in Prediction Engine | Apple Health data (HRV, steps, sleep) is visualised in the 3D graph but not yet fed into the prediction score |
