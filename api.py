"""
API HTTP para o Agente de Insights da Onfly.

Uso:
    uvicorn api:app --reload --port 8080
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.agent import InsightsAgent

app = FastAPI(
    title="Onfly Insights Agent",
    description="Agente de relatórios em linguagem natural para a plataforma Onfly",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pool de agentes por session
sessions: dict[str, InsightsAgent] = {}


class QuestionRequest(BaseModel):
    question: str
    session_id: str = "default"


class QuestionResponse(BaseModel):
    answer: str
    session_id: str


class SuggestionResponse(BaseModel):
    suggestions: list[str]


@app.post("/ask", response_model=QuestionResponse)
def ask_question(req: QuestionRequest):
    """Envia uma pergunta em linguagem natural e recebe a resposta com dados do BigQuery."""
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
    """Reseta o histórico de conversa de uma sessão."""
    if session_id in sessions:
        sessions[session_id].reset()
    return {"status": "ok"}


@app.get("/suggestions", response_model=SuggestionResponse)
def get_suggestions():
    """Retorna sugestões de perguntas para o usuário."""
    return SuggestionResponse(suggestions=[
        "Qual o GMV total por modalidade no Q1 2026?",
        "Top 10 empresas por GMV em 2026",
        "Compare o GMV de janeiro vs fevereiro 2026",
        "Qual o take rate por consolidador?",
        "Quais empresas fizeram churn em 2026?",
        "NPS médio por tamanho de empresa",
        "Taxa de conversão de cotações para reservas por empresa",
        "Ticket médio de voo por rota nos últimos 3 meses",
        "Empresas que usam travel mas não usam expense",
        "Quantos tickets de suporte foram abertos por categoria este mês?",
    ])


@app.get("/health")
def health():
    """Health check do serviço."""
    return {"status": "ok"}
