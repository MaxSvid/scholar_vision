"""
POST /api/predictions/analyze

Runs ML inference on the user's current study metrics and returns a
predicted score plus a human-readable text explanation.

analysis_mode:
  'strict' → Decision Tree path → IF/THEN rule advice
  'peer'   → KNN → comparison with 5 nearest cohort neighbours
  'deep'   → Random Forest + SHAP → feature attribution breakdown
"""

from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ml_engine import engine

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


# Schema

class AnalysisMode(str, Enum):
    strict = "strict"
    peer   = "peer"
    deep   = "deep"


class PredictionRequest(BaseModel):
    studyHours:    float = Field(..., ge=0,   le=16,  description="Daily study hours")
    attentionSpan: float = Field(..., ge=5,   le=120, description="Avg attention span (minutes)")
    focusRatio:    float = Field(..., ge=0,   le=100, description="Productive app ratio (%)")
    sleepHours:    float = Field(..., ge=3,   le=12,  description="Hours of sleep per night")
    breakFreq:     float = Field(..., ge=0,   le=10,  description="Breaks per study day")
    analysis_mode: AnalysisMode = AnalysisMode.strict


class PredictionResponse(BaseModel):
    predicted_score: float
    predicted_grade: str
    analysis_mode:   str
    text_advice:     str


# Endpoint 

@router.post("/analyze", response_model=PredictionResponse)
async def analyze(req: PredictionRequest):
    if engine.dt is None:
        raise HTTPException(503, detail="ML models not ready — please retry in a moment.")

    values = {
        "studyHours":    req.studyHours,
        "attentionSpan": req.attentionSpan,
        "focusRatio":    req.focusRatio,
        "sleepHours":    req.sleepHours,
        "breakFreq":     req.breakFreq,
    }

    try:
        if req.analysis_mode == AnalysisMode.strict:
            score, advice = engine.predict_strict(values)
        elif req.analysis_mode == AnalysisMode.peer:
            score, advice = engine.predict_peer(values)
        else:
            score, advice = engine.predict_deep(values)
    except Exception as exc:
        raise HTTPException(500, detail=f"Inference error: {exc}") from exc

    grade = engine._score_to_grade(score)
    return PredictionResponse(
        predicted_score=round(score, 1),
        predicted_grade=grade,
        analysis_mode=req.analysis_mode.value,
        text_advice=advice,
    )
