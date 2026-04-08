"""
API HTTP para o Agente de Insights da Onfly.

Uso:
    uvicorn api:app --reload --port 8080
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from src.agent import InsightsAgent

app = FastAPI(
    title="Onfly Insights Agent",
    description="Agente de relatórios em linguagem natural para a plataforma Onfly",
    version="1.0.0",
)

# Pool de agentes por session
sessions: dict[str, InsightsAgent] = {}


class QuestionRequest(BaseModel):
    question: str
    session_id: str = "default"


class QuestionResponse(BaseModel):
    answer: str
    session_id: str


@app.post("/ask", response_model=QuestionResponse)
def ask_question(req: QuestionRequest):
    if req.session_id not in sessions:
        sessions[req.session_id] = InsightsAgent()

    agent = sessions[req.session_id]
    try:
        answer = agent.ask(req.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QuestionResponse(answer=answer, session_id=req.session_id)


@app.post("/reset")
def reset_session(session_id: str = "default"):
    if session_id in sessions:
        sessions[session_id].reset()
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}
