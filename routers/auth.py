"""
Authentication router.

POST  /api/auth/register  – create account, return JWT
POST  /api/auth/login     – verify credentials, return JWT
GET   /api/auth/me        – return current user profile
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database.execute import execute, execute_returning, fetch_one
from security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Request / response models ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:        str
    password:     str = Field(..., min_length=8, max_length=72)
    firstName:    str = ''
    lastName:     str = ''
    fieldOfStudy: str = ''
    yearOfStudy:  str = ''
    university:   str = ''
    weeklyHours:  str = ''
    studyGoal:    str = ''
    targetGPA:    str = ''


class LoginRequest(BaseModel):
    email:    str
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_user_dict(
    user_id: str,
    email: str,
    first_name: str,
    last_name: str,
    full_name: str | None,
    field_of_study: str,
    year_of_study: str,
    university: str,
    weekly_hours: str,
    study_goal: str,
    target_gpa: str,
) -> dict:
    return {
        "id":           user_id,
        "email":        email,
        "fullName":     full_name or f"{first_name} {last_name}".strip(),
        "firstName":    first_name,
        "lastName":     last_name,
        "fieldOfStudy": field_of_study,
        "yearOfStudy":  year_of_study,
        "university":   university,
        "weeklyHours":  weekly_hours,
        "studyGoal":    study_goal,
        "targetGPA":    target_gpa,
    }


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(422, "Email and password are required")
    if len(body.password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters")

    existing = await fetch_one(
        "SELECT user_id FROM users WHERE email = %s", (email,)
    )
    if existing:
        raise HTTPException(409, "An account with that email already exists")

    full_name = f"{body.firstName} {body.lastName}".strip() or None
    hashed    = hash_password(body.password)

    user_row = await execute_returning(
        """
        INSERT INTO users (email, password_hash, full_name)
        VALUES (%s, %s, %s)
        RETURNING user_id, email, full_name
        """,
        (email, hashed, full_name),
    )
    user_id = str(user_row["user_id"])

    # Persist academic profile
    weekly_hours_float = None
    try:
        weekly_hours_float = float(body.weeklyHours) if body.weeklyHours else None
    except ValueError:
        pass

    await execute(
        """
        INSERT INTO student_profiles
            (user_id, full_name, major, university_name,
             year_of_study, study_goal, weekly_hours_target, target_gpa)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE SET
            full_name           = EXCLUDED.full_name,
            major               = EXCLUDED.major,
            university_name     = EXCLUDED.university_name,
            year_of_study       = EXCLUDED.year_of_study,
            study_goal          = EXCLUDED.study_goal,
            weekly_hours_target = EXCLUDED.weekly_hours_target,
            target_gpa          = EXCLUDED.target_gpa
        """,
        (
            user_id, full_name,
            body.fieldOfStudy or None,
            body.university   or None,
            body.yearOfStudy  or None,
            body.studyGoal    or None,
            weekly_hours_float,
            body.targetGPA    or None,
        ),
    )

    token = create_access_token(user_id)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": _build_user_dict(
            user_id, email,
            body.firstName, body.lastName, full_name,
            body.fieldOfStudy, body.yearOfStudy, body.university,
            body.weeklyHours, body.studyGoal, body.targetGPA,
        ),
    }


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest):
    email = body.email.strip().lower()
    user  = await fetch_one(
        "SELECT user_id, email, password_hash, full_name FROM users WHERE email = %s",
        (email,),
    )
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    user_id = str(user["user_id"])

    # Load extended profile
    profile = await fetch_one(
        """
        SELECT major, university_name, year_of_study,
               study_goal, weekly_hours_target, target_gpa
        FROM student_profiles WHERE user_id = %s
        """,
        (user_id,),
    )

    full_name = user["full_name"] or ""
    parts     = full_name.split(" ", 1) if full_name else ["", ""]
    first     = parts[0]
    last      = parts[1] if len(parts) > 1 else ""

    weekly_str = ""
    if profile and profile["weekly_hours_target"] is not None:
        val = profile["weekly_hours_target"]
        weekly_str = str(int(val)) if val == int(val) else str(val)

    token = create_access_token(user_id)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": _build_user_dict(
            user_id, user["email"],
            first, last, full_name,
            profile["major"]          if profile else "",
            profile["year_of_study"]  if profile else "",
            profile["university_name"] if profile else "",
            weekly_str,
            profile["study_goal"]     if profile else "",
            profile["target_gpa"]     if profile else "",
        ),
    }


# ── Current user ──────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user)):
    user = await fetch_one(
        "SELECT user_id, email, full_name, created_at FROM users WHERE user_id = %s",
        (user_id,),
    )
    if not user:
        raise HTTPException(404, "User not found")

    profile = await fetch_one(
        """
        SELECT major, university_name, year_of_study,
               study_goal, weekly_hours_target, target_gpa
        FROM student_profiles WHERE user_id = %s
        """,
        (user_id,),
    )

    full_name = user["full_name"] or ""
    parts     = full_name.split(" ", 1) if full_name else ["", ""]

    return {
        "user": {
            "id":           user_id,
            "email":        user["email"],
            "fullName":     full_name,
            "firstName":    parts[0],
            "lastName":     parts[1] if len(parts) > 1 else "",
            "fieldOfStudy": profile["major"]          if profile else "",
            "yearOfStudy":  profile["year_of_study"]  if profile else "",
            "university":   profile["university_name"] if profile else "",
            "studyGoal":    profile["study_goal"]     if profile else "",
            "targetGPA":    profile["target_gpa"]     if profile else "",
        }
    }
