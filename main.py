import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="AI Student Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server (local only)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
