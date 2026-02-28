"""
File import router — upload, list, retrieve, delete academic files.

POST   /api/files/upload      – upload one file, parse it, store to DB
GET    /api/files             – list files for a session
GET    /api/files/{file_id}   – full file record with parsed data
DELETE /api/files/{file_id}   – delete file from disk + DB
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Form, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from database.execute import execute, execute_returning, fetch_all, fetch_one
from parsers.file_parser import parse_file

router = APIRouter(prefix="/api/files", tags=["files"])

UPLOADS_DIR = Path(__file__).parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"pdf", "doc", "docx", "xlsx", "xls", "csv", "txt", "png", "jpg", "jpeg"}
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(
    file:       UploadFile = File(...),
    session_id: str        = Form(...),
    category:   str        = Form("Other"),
    notes:      str        = Form(""),
):
    content = await file.read()

    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "File exceeds 20 MB limit")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_TYPES:
        raise HTTPException(415, f"File type '{ext}' not supported")

    file_id     = str(uuid.uuid4())
    stored_name = f"{file_id}.{ext}"
    storage_path = str(UPLOADS_DIR / stored_name)

    # Persist to disk
    async with aiofiles.open(storage_path, "wb") as fh:
        await fh.write(content)

    # Parse
    parse_result = parse_file(ext, content)
    parse_status = "failed" if parse_result.error else "done"

    # Insert file record
    row = await execute_returning(
        """
        INSERT INTO uploaded_files
            (file_id, session_id, original_name, stored_name, file_type,
             file_size, category, notes, storage_path, parse_status, raw_text)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING file_id, original_name, file_type, file_size,
                  category, parse_status, uploaded_at
        """,
        (
            file_id, session_id, file.filename, stored_name, ext,
            len(content), category, notes, storage_path,
            parse_status, parse_result.raw_text[:50_000],
        ),
    )

    # Insert parsed grades
    for g in parse_result.grades:
        await execute(
            """
            INSERT INTO parsed_grades
                (file_id, course_name, course_code, grade_letter,
                 score, max_score, percentage, semester, source_row)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                file_id, g.course_name, g.course_code, g.grade_letter,
                g.score, g.max_score, g.percentage, g.semester, g.source_row,
            ),
        )

    # Insert text snippets
    for s in parse_result.snippets:
        await execute(
            """
            INSERT INTO parsed_text_snippets
                (file_id, snippet_type, content, page_number)
            VALUES (%s, %s, %s, %s)
            """,
            (file_id, s.snippet_type, s.content[:2000], s.page_number),
        )

    return {
        "file": row,
        "grades_count":   len(parse_result.grades),
        "snippets_count": len(parse_result.snippets),
        "parse_error":    parse_result.error,
    }


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("")
async def list_files(session_id: str):
    rows = await fetch_all(
        """
        SELECT file_id, original_name, file_type, file_size,
               category, notes, parse_status, uploaded_at
        FROM   uploaded_files
        WHERE  session_id = %s
        ORDER  BY uploaded_at DESC
        """,
        (session_id,),
    )
    return {"files": rows}


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{file_id}")
async def get_file(file_id: str):
    row = await fetch_one(
        "SELECT * FROM uploaded_files WHERE file_id = %s",
        (file_id,),
    )
    if not row:
        raise HTTPException(404, "File not found")

    grades = await fetch_all(
        "SELECT * FROM parsed_grades WHERE file_id = %s ORDER BY source_row",
        (file_id,),
    )
    snippets = await fetch_all(
        "SELECT * FROM parsed_text_snippets WHERE file_id = %s ORDER BY snippet_id LIMIT 100",
        (file_id,),
    )

    return {"file": row, "grades": grades, "snippets": snippets}


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{file_id}")
async def delete_file(file_id: str):
    row = await fetch_one(
        "SELECT storage_path FROM uploaded_files WHERE file_id = %s",
        (file_id,),
    )
    if not row:
        raise HTTPException(404, "File not found")

    # Remove from disk (ignore if already gone)
    try:
        Path(row["storage_path"]).unlink(missing_ok=True)
    except Exception:
        pass

    await execute(
        "DELETE FROM uploaded_files WHERE file_id = %s",
        (file_id,),
    )

    return {"deleted": file_id}
