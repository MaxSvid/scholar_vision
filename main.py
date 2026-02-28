import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from routers.files import router as files_router
from routers.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure uploads directory exists at startup
    Path("uploads").mkdir(exist_ok=True)
    yield


app = FastAPI(title="AI Student Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server (local only)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router)
app.include_router(health_router)


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
