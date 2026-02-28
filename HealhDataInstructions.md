# Health Data Import — Format Instructions

This document describes exactly what the ScholarVision app expects when you import Apple Health data. Follow these instructions to ensure a successful import.

---

## File Format

The import endpoint accepts a single **JSON file** (`.json`). XML exports directly from the Apple Health app are not supported — you must convert or export using a third-party app that produces JSON output.

**File size limit:** 10 MB maximum.

---

## Top-Level Structure

The JSON file must be an **object** (not an array) with the following fields:

```json
{
  "user_id":        "string — any identifier for the user (optional but recommended)",
  "sync_timestamp": "2024-11-01T08:30:00Z",
  "client_version": "1.0.0",
  "metrics":        [ ...metric objects... ]
}
```

| Field            | Type   | Required | Notes                                      |
|------------------|--------|----------|--------------------------------------------|
| `user_id`        | string | No       | Any identifier; stored for reference only  |
| `sync_timestamp` | string | No       | ISO-8601 datetime of the export            |
| `client_version` | string | No       | Version of the export app                  |
| `metrics`        | array  | **Yes**  | List of metric objects (see below)         |

The file will be rejected if:
- The top level is not a JSON object
- `metrics` is missing or is not an array
- `metrics` is an empty array (no valid entries found)

---

## Metric Object Structure

Each item in the `metrics` array must be an **object**. Items that are not objects are silently skipped.

```json
{
  "type":          "sleep_analysis",
  "data_class":    "category",
  "value":         7.5,
  "unit":          "h",
  "start_time":    "2024-11-01T22:00:00Z",
  "end_time":      "2024-11-02T05:30:00Z",
  "source_device": "Apple Watch Series 9",
  "metadata": {
    "was_user_entered": false
  }
}
```

| Field           | Type            | Required | Notes                                                        |
|-----------------|-----------------|----------|--------------------------------------------------------------|
| `type`          | string          | No       | Metric type identifier (see list below); defaults to `unknown` |
| `data_class`    | string          | No       | `"quantity"` or `"category"`; defaults to `"quantity"`      |
| `value`         | number or string | No      | Number → stored as numeric value; string → stored as category label |
| `unit`          | string          | No       | Unit of measurement (e.g. `"h"`, `"count"`, `"bpm"`)        |
| `start_time`    | string          | **Yes**  | ISO-8601 datetime — **entries without this are skipped**     |
| `end_time`      | string          | No       | ISO-8601 datetime for ranged measurements                    |
| `source_device` | string          | No       | Device name (e.g. `"iPhone 15"`, `"Apple Watch"`)           |
| `metadata`      | object          | No       | Optional extra fields; `was_user_entered` (bool) supported   |

> **Critical:** Any metric entry missing `start_time` is silently dropped. Always include it.

---

## Supported Metric Types

The following `type` values are recognised and will be correctly categorised in the app:

### Activity
| Type | Description |
|------|-------------|
| `step_count` | Daily step count |
| `distance_walking_running` | Distance walked or run |
| `flights_climbed` | Flights of stairs climbed |
| `active_energy_burned` | Active calories burned |
| `basal_energy_burned` | Resting calories burned |
| `exercise_time` | Minutes of exercise |
| `stand_time` | Minutes stood per hour |
| `vo2_max` | Cardiorespiratory fitness |

### Vitals
| Type | Description |
|------|-------------|
| `heart_rate` | Heart rate (bpm) |
| `resting_heart_rate` | Resting heart rate |
| `heart_rate_variability_sdnn` | Heart rate variability |
| `walking_heart_rate_average` | Walking heart rate |
| `blood_oxygen_saturation` | Blood oxygen (%) |
| `respiratory_rate` | Breaths per minute |
| `body_temperature` | Body temperature |
| `blood_pressure_systolic` | Systolic blood pressure |
| `blood_pressure_diastolic` | Diastolic blood pressure |

### Body
| Type | Description |
|------|-------------|
| `body_mass` | Body weight |
| `body_mass_index` | BMI |
| `body_fat_percentage` | Body fat (%) |
| `lean_body_mass` | Lean mass |
| `height` | Height |
| `waist_circumference` | Waist measurement |

### Sleep (used for academic baseline)
| Type | Description |
|------|-------------|
| `sleep_analysis` | Sleep session duration — **directly feeds the Sleep Hours baseline in the Prediction Engine** |

### Nutrition
| Type | Description |
|------|-------------|
| `dietary_energy_consumed` | Calories consumed |
| `dietary_protein` | Protein (g) |
| `dietary_carbohydrates` | Carbohydrates (g) |
| `dietary_fat_total` | Total fat (g) |
| `dietary_fiber` | Dietary fiber (g) |
| `dietary_water` | Water intake |

### Mindfulness
| Type | Description |
|------|-------------|
| `mindful_session` | Mindfulness session duration |

> Any other `type` string is accepted and stored — it will simply appear as an unknown metric type in the summary.

---

## What the App Derives from Health Data

After a successful import, the following is calculated and used in the **Academic Prediction Engine**:

| Derived Value | Source Type | How |
|---------------|-------------|-----|
| **Sleep Hours baseline** | `sleep_analysis` | Average of all `value_num` (numeric) records across imported sessions |

All other slider baselines (study hours, attention span, focus ratio, breaks) require data sources not yet connected (study session logs, app usage). Only sleep is derived from Apple Health data.

---

## Minimal Valid Example

This is the smallest file that will import successfully:

```json
{
  "metrics": [
    {
      "type":       "sleep_analysis",
      "value":      7.5,
      "unit":       "h",
      "start_time": "2024-11-01T22:00:00Z"
    }
  ]
}
```

---

## Full Example

```json
{
  "user_id":        "student_42",
  "sync_timestamp": "2024-11-15T09:00:00Z",
  "client_version": "2.1.0",
  "metrics": [
    {
      "type":          "sleep_analysis",
      "data_class":    "quantity",
      "value":         7.2,
      "unit":          "h",
      "start_time":    "2024-11-14T23:00:00Z",
      "end_time":      "2024-11-15T06:12:00Z",
      "source_device": "Apple Watch Series 9",
      "metadata":      { "was_user_entered": false }
    },
    {
      "type":          "heart_rate",
      "data_class":    "quantity",
      "value":         62,
      "unit":          "bpm",
      "start_time":    "2024-11-15T06:15:00Z",
      "source_device": "Apple Watch Series 9"
    },
    {
      "type":          "step_count",
      "data_class":    "quantity",
      "value":         8432,
      "unit":          "count",
      "start_time":    "2024-11-15T00:00:00Z",
      "end_time":      "2024-11-15T23:59:59Z",
      "source_device": "iPhone 15"
    },
    {
      "type":          "mindful_session",
      "data_class":    "category",
      "value":         "MindfulSession",
      "unit":          "min",
      "start_time":    "2024-11-15T07:00:00Z",
      "end_time":      "2024-11-15T07:10:00Z",
      "source_device": "iPhone 15"
    }
  ]
}
```

---

## Common Import Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `JSON decode error` | File is not valid JSON | Validate the file at [jsonlint.com](https://jsonlint.com) |
| `Expected a JSON object at the top level` | File starts with `[` (array) instead of `{` | Wrap the array: `{ "metrics": [...] }` |
| `'metrics' field must be a list` | `metrics` is a string or object | Ensure `metrics` is a `[...]` array |
| `No valid metrics found in payload` | All entries are missing `start_time` | Add `start_time` to every metric |
| `Payload exceeds 10 MB limit` | File is too large | Split into multiple smaller files and import separately |
