from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AI Student Assistant")

# This defines what the incoming data should look like
class StudentQuery(BaseModel):
    subject: str
    question: str

@app.get("/")
async def home():
    return {"message": "System Active", "docs": "/docs"}

@app.post("/ask")
async def ask_assistant(query: StudentQuery):
    # This is where your AI logic will go later
    return {
        "reply": f"You asked about {query.subject}. Let me look that up for you!",
        "received_question": query.question
    }