import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from routers.auth import router as auth_router
from routers.activity import router as activity_router
from routers.files import router as files_router
from routers.health import router as health_router
from routers.peers import router as peers_router
from routers.predictions import router as predictions_router
from routers.profile import router as profile_router
from ml_engine import engine as ml_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path("uploads").mkdir(exist_ok=True)
    Path("models").mkdir(exist_ok=True)
    # Train / load ML models at startup (blocking but runs once)
    ml_engine.ensure_ready()                  # train / load models (sync, runs once)
    await ml_engine.load_cohort_from_db()    # refresh peer data from DB (async)
    yield


app = FastAPI(title="AI Student Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",       # Vite dev server
        "https://scholarvision.uk",
        "https://www.scholarvision.uk",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(activity_router)
app.include_router(files_router)
app.include_router(health_router)
app.include_router(peers_router)
app.include_router(predictions_router)
app.include_router(profile_router)


class StudentQuery(BaseModel):
    subject: str
    question: str


@app.get("/api")
async def home():
    return {"message": "System Active", "docs": "/docs"}


@app.post("/api/ask")
async def ask_assistant(query: StudentQuery):
    # AI logic goes here later
    return {
        "reply": f"You asked about {query.subject}. Let me look that up for you!",
        "received_question": query.question,
    }


# Serve the built React app — only if dist exists (skipped during local dev)
if os.path.exists("front-end/dist"):
    app.mount("/", StaticFiles(directory="front-end/dist", html=True), name="frontend")
