# Activity Data Import — Format Instructions

This document describes exactly what the ScholarVision app expects when you import **App Usage** or **Study Session** data. Follow these instructions to ensure a successful import and accurate seeding of the Academic Prediction Engine.

---

## Overview

Two separate import pipelines are available under the **Activity** section of the dashboard:

| Pipeline | Endpoint | Seeds These Sliders |
|----------|----------|---------------------|
| App Usage | `POST /api/activity/app-usage` | Focus Ratio |
| Study Sessions | `POST /api/activity/study-logs` | Study Hours · Attention Span · Break Frequency |

Both pipelines accept a single **JSON file** (`.json`) of up to **5 MB**. Drop the file onto the import panel, or click to browse.

---

---

# PART 1 — App Usage JSON

---

## File Format

A single `.json` file containing a top-level object with a `logs` array.

**File size limit:** 5 MB maximum.

---

## Top-Level Structure

```json
{
  "sync_timestamp": "2024-11-01T08:30:00Z",
  "client_version": "1.0",
  "logs": [ ...log entry objects... ]
}
```

| Field            | Type   | Required | Notes                                               |
|------------------|--------|----------|-----------------------------------------------------|
| `sync_timestamp` | string | No       | ISO-8601 datetime of when the export was generated  |
| `client_version` | string | No       | Version string of your export tool                  |
| `logs`           | array  | **Yes**  | List of app log entry objects (see below)           |

The file will be rejected if:
- The top level is not a JSON object
- `logs` is missing or is not an array
- `logs` contains no valid entries after validation

---

## Log Entry Object Structure

Each item in the `logs` array must be an **object**. Items that are not objects, or that are missing required fields, are silently skipped.

```json
{
  "app_name":      "VS Code",
  "category":      "Productive",
  "duration_mins": 90,
  "logged_date":   "2024-11-01"
}
```

| Field           | Type    | Required | Notes                                                                  |
|-----------------|---------|----------|------------------------------------------------------------------------|
| `app_name`      | string  | **Yes**  | Name of the application or service — entries with a blank name are skipped |
| `duration_mins` | integer | **Yes**  | Time spent in the app, in whole minutes — must be ≥ 1, or entry is skipped |
| `logged_date`   | string  | **Yes**  | Date of use in `YYYY-MM-DD` format                                     |
| `category`      | string  | No       | Productivity classification (see below); unknown values default to `"Neutral"` |

> **Critical:** Entries missing `app_name`, `duration_mins`, or `logged_date` are silently dropped. Always include all three.

---

## Category Values

The `category` field controls how each app's time contributes to the **Focus Ratio** baseline. Only the three values below are recognised — any other string (or a missing field) is treated as `"Neutral"`.

| Value          | Meaning                                                         | Example Apps                           |
|----------------|-----------------------------------------------------------------|----------------------------------------|
| `"Productive"` | Time spent on tools that directly support studying or working   | VS Code, Notion, Anki, Zotero, Excel   |
| `"Neutral"`    | Time that is neither clearly productive nor clearly distracting | Spotify, Email, Slack, YouTube (Study) |
| `"Distracting"`| Time spent on apps that detract from focused study             | TikTok, Instagram, Reddit, Netflix     |

---

## How App Usage Data is Derived

After a successful import, the following calculation is applied across **all** App Usage imports for your session:

| Derived Slider | Formula | Example |
|----------------|---------|---------|
| **Focus Ratio** | `SUM(duration_mins WHERE category = 'Productive')` ÷ `SUM(duration_mins, all entries)` × 100 | 270 productive mins ÷ 450 total mins = **60%** |

All other baseline sliders (Study Hours, Attention Span, Break Frequency) are sourced from the Study Sessions pipeline, not from App Usage data.

> Focus Ratio is recalculated each time you load the Prediction Engine, taking the **running total** across every App Usage import you have made in the current session — not just the most recent file.

---

## JSON Examples — App Usage

### Minimal Valid Example

The smallest file that will import successfully:

```json
{
  "logs": [
    {
      "app_name":      "VS Code",
      "duration_mins": 90,
      "logged_date":   "2024-11-01"
    }
  ]
}
```

### Full Example

```json
{
  "sync_timestamp": "2024-11-07T20:00:00Z",
  "client_version": "1.0",
  "logs": [
    {
      "app_name":      "VS Code",
      "category":      "Productive",
      "duration_mins": 150,
      "logged_date":   "2024-11-05"
    },
    {
      "app_name":      "Notion",
      "category":      "Productive",
      "duration_mins": 45,
      "logged_date":   "2024-11-05"
    },
    {
      "app_name":      "Anki",
      "category":      "Productive",
      "duration_mins": 30,
      "logged_date":   "2024-11-06"
    },
    {
      "app_name":      "YouTube",
      "category":      "Neutral",
      "duration_mins": 60,
      "logged_date":   "2024-11-05"
    },
    {
      "app_name":      "Spotify",
      "category":      "Neutral",
      "duration_mins": 90,
      "logged_date":   "2024-11-06"
    },
    {
      "app_name":      "Reddit",
      "category":      "Distracting",
      "duration_mins": 40,
      "logged_date":   "2024-11-05"
    },
    {
      "app_name":      "Instagram",
      "category":      "Distracting",
      "duration_mins": 25,
      "logged_date":   "2024-11-06"
    }
  ]
}
```

In this example, Focus Ratio = (150 + 45 + 30) ÷ (150 + 45 + 30 + 60 + 90 + 40 + 25) = 225 ÷ 440 ≈ **51%**.

---

## Common Import Errors — App Usage

| Error | Cause | Fix |
|-------|-------|-----|
| `JSON decode error` | File is not valid JSON | Validate at [jsonlint.com](https://jsonlint.com) |
| `Expected a JSON object at the top level` | File starts with `[` instead of `{` | Wrap: `{ "logs": [...] }` |
| `'logs' field must be a list` | `logs` is a string or object | Ensure `logs` is a `[...]` array |
| `No valid log entries found in payload` | All entries are missing required fields or have `duration_mins < 1` | Add `app_name`, `duration_mins` (≥ 1), and `logged_date` to every entry |
| `Payload exceeds 5 MB limit` | File is too large | Split into multiple smaller files and import separately |

---

---

# PART 2 — Study Sessions JSON

---

## File Format

A single `.json` file containing a top-level object with a `sessions` array.

**File size limit:** 5 MB maximum.

---

## Top-Level Structure

```json
{
  "sync_timestamp": "2024-11-01T08:30:00Z",
  "client_version": "1.0",
  "sessions": [ ...session objects... ]
}
```

| Field            | Type   | Required | Notes                                               |
|------------------|--------|----------|-----------------------------------------------------|
| `sync_timestamp` | string | No       | ISO-8601 datetime of when the export was generated  |
| `client_version` | string | No       | Version string of your export tool                  |
| `sessions`       | array  | **Yes**  | List of study session objects (see below)           |

The file will be rejected if:
- The top level is not a JSON object
- `sessions` is missing or is not an array
- `sessions` contains no valid entries after validation

---

## Session Object Structure

Each item in the `sessions` array must be an **object**. Items missing required fields or with invalid timestamps are silently skipped.

```json
{
  "started_at":   "2024-11-01T09:00:00Z",
  "ended_at":     "2024-11-01T11:30:00Z",
  "subject_tag":  "Mathematics",
  "breaks_taken": 3,
  "notes":        "Covered integration by parts and substitution"
}
```

| Field          | Type    | Required | Notes                                                                                |
|----------------|---------|----------|--------------------------------------------------------------------------------------|
| `started_at`   | string  | **Yes**  | ISO-8601 datetime the session began — entries without this are skipped               |
| `ended_at`     | string  | **Yes**  | ISO-8601 datetime the session ended — must be strictly later than `started_at`       |
| `breaks_taken` | integer | No       | Number of breaks taken during the session; defaults to `0` if missing or negative    |
| `subject_tag`  | string  | No       | Subject or topic label (e.g. `"Mathematics"`, `"Programming"`)                       |
| `notes`        | string  | No       | Free-text notes about what was covered                                               |

> **Critical:** Entries missing `started_at` or `ended_at`, entries where `ended_at ≤ started_at`, and entries whose computed duration is less than 1 minute are silently dropped. Always include both timestamps.

> **`duration_mins` is computed automatically** by the backend as `floor((ended_at − started_at) in seconds ÷ 60)`. Do not include it in your file — it is ignored if present.

---

## Breaks Field

`breaks_taken` is a single integer representing how many times you paused the session. You do not need to record the exact start and end time of each break — just count them.

If your tracking tool does record individual break timestamps, count the entries in the breaks array before exporting:

```
"breaks_taken": 3   // you took 3 breaks during this session
```

A higher `breaks_taken` relative to `duration_mins` means shorter uninterrupted focus blocks, which lowers the **Attention Span** baseline. A lower count means longer stretches of sustained focus.

---

## How Study Session Data is Derived

After a successful import, the following calculations are applied across **all** Study Session imports for your session:

| Derived Slider     | Formula | Example |
|--------------------|---------|---------|
| **Study Hours**    | Average of daily total study minutes across all days with recorded sessions ÷ 60 | Days: 150 min, 90 min, 120 min → avg 120 min ÷ 60 = **2.0 h/day** |
| **Attention Span** | Average of `duration_mins ÷ (breaks_taken + 1)` across all session entries | Sessions: 90÷(2+1)=30, 120÷(3+1)=30, 60÷(1+1)=30 → avg **30 min** |
| **Break Frequency**| Average of `breaks_taken` across all session entries | Sessions with 2, 3, 1 breaks → avg **2.0 breaks/session** |

> All three sliders are recalculated each time you load the Prediction Engine, aggregating across every Study Session import in the current session — not just the most recent file.

**Attention Span interpretation:** A 90-minute session with 2 breaks yields three uninterrupted blocks of 30 minutes each. A 90-minute session with 0 breaks yields one 90-minute block. Higher values indicate longer sustained focus.

---

## JSON Examples — Study Sessions

### Minimal Valid Example

The smallest file that will import successfully:

```json
{
  "sessions": [
    {
      "started_at": "2024-11-01T09:00:00Z",
      "ended_at":   "2024-11-01T11:00:00Z"
    }
  ]
}
```

### Full Example

```json
{
  "sync_timestamp": "2024-11-07T22:00:00Z",
  "client_version": "1.0",
  "sessions": [
    {
      "started_at":   "2024-11-04T09:00:00Z",
      "ended_at":     "2024-11-04T11:30:00Z",
      "subject_tag":  "Mathematics",
      "breaks_taken": 2,
      "notes":        "Integration by parts, substitution method"
    },
    {
      "started_at":   "2024-11-04T14:00:00Z",
      "ended_at":     "2024-11-04T15:30:00Z",
      "subject_tag":  "Physics",
      "breaks_taken": 1,
      "notes":        "Electromagnetism — Faraday's law"
    },
    {
      "started_at":   "2024-11-05T10:00:00Z",
      "ended_at":     "2024-11-05T13:00:00Z",
      "subject_tag":  "Programming",
      "breaks_taken": 3,
      "notes":        "Implemented binary search tree, wrote unit tests"
    },
    {
      "started_at":   "2024-11-06T09:30:00Z",
      "ended_at":     "2024-11-06T11:00:00Z",
      "subject_tag":  "Mathematics",
      "breaks_taken": 1,
      "notes":        "Differential equations — separation of variables"
    },
    {
      "started_at":   "2024-11-07T15:00:00Z",
      "ended_at":     "2024-11-07T17:30:00Z",
      "subject_tag":  "Economics",
      "breaks_taken": 2,
      "notes":        "Macroeconomics — IS-LM model"
    }
  ]
}
```

**What this example produces:**

| Session | Duration | Breaks | Focus Block (duration ÷ breaks+1) |
|---------|----------|--------|-----------------------------------|
| Mathematics (Nov 4) | 150 min | 2 | 50 min |
| Physics (Nov 4) | 90 min | 1 | 45 min |
| Programming (Nov 5) | 180 min | 3 | 45 min |
| Mathematics (Nov 6) | 90 min | 1 | 45 min |
| Economics (Nov 7) | 150 min | 2 | 50 min |

- **Study Hours baseline:** Daily totals are 240 min (Nov 4), 180 min (Nov 5), 90 min (Nov 6), 150 min (Nov 7) → avg 165 min ÷ 60 = **2.75 h/day**
- **Attention Span baseline:** avg(50, 45, 45, 45, 50) = **47 min**
- **Break Frequency baseline:** avg(2, 1, 3, 1, 2) = **1.8 breaks/session**

---

## Common Import Errors — Study Sessions

| Error | Cause | Fix |
|-------|-------|-----|
| `JSON decode error` | File is not valid JSON | Validate at [jsonlint.com](https://jsonlint.com) |
| `Expected a JSON object at the top level` | File starts with `[` instead of `{` | Wrap: `{ "sessions": [...] }` |
| `'sessions' field must be a list` | `sessions` is a string or object | Ensure `sessions` is a `[...]` array |
| `No valid study sessions found in payload` | All entries fail timestamp validation | Ensure `started_at` and `ended_at` are valid ISO-8601 strings and `ended_at > started_at` |
| `Payload exceeds 5 MB limit` | File is too large | Split into multiple smaller files and import separately |

---

## ISO-8601 Datetime Format Reference

Both `started_at` and `ended_at` must be valid ISO-8601 datetime strings. The following formats are all accepted:

```
2024-11-01T09:00:00Z          ← UTC (recommended)
2024-11-01T09:00:00+01:00     ← with timezone offset
2024-11-01T09:00:00           ← local time (no timezone; treated as-is)
```

Dates alone (`2024-11-01`) are **not** accepted — a time component is required.
