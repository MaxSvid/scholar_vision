# How Academic File Import Works — ScholarVision

## Overview

When a student uploads an academic document (transcript, grade sheet, report card, etc.), the system automatically reads it, extracts grades and useful text, and stores everything in the database — without the student doing any manual data entry.

---

## Step-by-Step Flow

### 1. The upload request arrives

The frontend sends a `POST /api/files/upload` request as a multipart form containing:
- The file itself
- A `session_id` (anonymous browser session, since there's no login yet)
- Optional `category` (e.g. "Transcript", "Assignment") and `notes`

Handled by: `routers/files.py → upload_file()`

---

### 2. Basic validation

Before anything is saved, two checks run:

| Check | Limit | Error if exceeded |
|---|---|---|
| File size | 20 MB | HTTP 413 |
| File type | pdf, doc, docx, xlsx, xls, csv, txt, png, jpg, jpeg | HTTP 415 |

---

### 3. File saved to disk

The file is written to the `uploads/` folder under a UUID-based filename (e.g. `a3f7c9d2-….pdf`). The original filename is preserved separately in the database. This means two students can upload files with the same name without conflict.

```
uploads/
  a3f7c9d2-1234-....pdf   ← stored on disk
  b8e2a011-5678-....csv
```

---

### 4. Parsing — the smart part

`parse_file(file_type, content)` in `parsers/file_parser.py` is called with the raw file bytes. It dispatches to a format-specific parser:

#### PDF (`pdfplumber`)
1. Opens each page of the PDF.
2. **First tries tables** — if the page has a structured table (like a grade table), it reads the headers to find columns named things like `course`, `grade`, `score`, `mark`, `semester`, `code`, etc.
3. **Falls back to line-by-line text** — scans every line of plain text through regex patterns to find grade-like information.

#### DOCX (`python-docx`)
1. Reads all paragraphs — headings are detected by Word style name or by being short and ALL CAPS.
2. Reads all tables — same column-header detection as PDF.

#### CSV / XLSX (`pandas`)
1. Loads the spreadsheet into a DataFrame.
2. Scans column headers for keywords: `course`, `module`, `subject`, `grade`, `mark`, `score`, `percentage`, `semester`, `code`, etc.
3. Reads each row and maps values to grade fields.
4. If no recognisable grade column is found, scans all cell values as a fallback.

#### TXT
Line-by-line scan using regex (same patterns as PDF text fallback).

#### PNG / JPG / JPEG
No text extraction. The file is saved and recorded but no grades or snippets are produced. (There is no OCR.)

---

### 5. What the parser extracts

For each line / table row that looks like academic data, it produces a **ParsedGrade** with these fields:

| Field | Example | How detected |
|---|---|---|
| `course_name` | "Introduction to Algorithms" | First token before a separator (`-`, `:`, `|`) |
| `course_code` | "CS301", "MATH-202" | Regex: 2-6 letters + 3-4 digits |
| `grade_letter` | "A+", "B-", "C" | Regex: A–F with optional +/- |
| `score` | 42.0 | Numerator from a fraction like `42/50` |
| `max_score` | 50.0 | Denominator from a fraction like `42/50` |
| `percentage` | 84.0 | Explicit `87%` or `87/100`, or computed from score/max |
| `semester` | "Spring 2024" | Regex: semester/spring/autumn/fall/summer + year |
| `source_row` | 3 | Row number in the original file (for traceability) |

The parser also extracts **TextSnippets** — pieces of text that aren't grades but are still useful:
- `heading` — short ALL-CAPS lines or Word heading styles (e.g. "ACADEMIC TRANSCRIPT")
- `comment` — any longer text line that didn't match a grade pattern (e.g. professor feedback)

**Deduplication:** After extraction, exact duplicate grade entries (same course + same score) are removed.

**Caps:** Snippets are capped at 200 (TXT) or 300 (PDF/DOCX) to avoid storing megabytes of text.

---

### 6. Everything stored in the database

Three tables are written in sequence:

#### `uploaded_files` — one row per upload
Stores the file registry: who uploaded it, when, where it lives on disk, what type it is, and the full extracted raw text (capped at 50,000 characters).

Key columns: `file_id` (UUID), `session_id`, `original_name`, `stored_name`, `file_type`, `file_size`, `category`, `notes`, `storage_path`, `parse_status` (`pending` → `done` or `failed`), `raw_text`, `uploaded_at`.

#### `parsed_grades` — one row per grade found
Every `ParsedGrade` object from the parser becomes a row here, linked back to the file via `file_id`.

#### `parsed_text_snippets` — one row per text snippet
Every heading and comment extracted from the document is stored here, also linked via `file_id`.

---

### 7. Response returned to the frontend

```json
{
  "file": {
    "file_id": "a3f7c9d2-...",
    "original_name": "transcript.pdf",
    "file_type": "pdf",
    "file_size": 84231,
    "category": "Transcript",
    "parse_status": "done",
    "uploaded_at": "2026-02-28T10:30:00"
  },
  "grades_count": 12,
  "snippets_count": 8,
  "parse_error": null
}
```

If parsing failed (corrupted file, unsupported encoding, etc.), `parse_status` is `"failed"` and `parse_error` contains the error message. The file is still saved — it just has no extracted data.

---

## Other Endpoints

| Endpoint | What it does |
|---|---|
| `GET /api/files?session_id=…` | Lists all files uploaded in this browser session |
| `GET /api/files/{file_id}` | Returns the full file record + all its extracted grades + snippets |
| `DELETE /api/files/{file_id}` | Deletes the file from disk AND removes all its database rows (cascade) |

---

## What the parser cannot do

- **OCR** — scanned image PDFs (photos of paper transcripts) will extract no text. Only digitally-created PDFs work.
- **Images** — PNG/JPG files are stored but not read.
- **Handwritten notes** — not supported.
- **Non-English grade letters** — the regex expects A–F scale. European numerical grades (e.g. 1–10 or 0–20) will be extracted as raw numbers but won't produce a `grade_letter`.
- **Password-protected files** — pdfplumber will error; the file is saved with `parse_status = "failed"`.
