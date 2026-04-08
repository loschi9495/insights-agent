"""
API HTTP para o Agente de Insights da Onfly.

Uso:
    uvicorn api:app --reload --port 8080
"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from src.agent import InsightsAgent
from src.auth import get_current_user
from src.exporter import get_export_path, cleanup_old_exports

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


class GoogleLoginRequest(BaseModel):
    credential: str


class UserResponse(BaseModel):
    email: str
    name: str
    picture: str


@app.post("/auth/google", response_model=UserResponse)
def google_login(req: GoogleLoginRequest):
    """Valida o token do Google Sign-In e retorna dados do usuário."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    from config.settings import GOOGLE_CLIENT_ID, ALLOWED_EMAIL_DOMAIN

    try:
        idinfo = id_token.verify_oauth2_token(
            req.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Token inválido")

    email = idinfo.get("email", "")
    if not idinfo.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Email não verificado")

    if ALLOWED_EMAIL_DOMAIN and not email.endswith(f"@{ALLOWED_EMAIL_DOMAIN}"):
        raise HTTPException(status_code=403, detail=f"Acesso restrito a emails @{ALLOWED_EMAIL_DOMAIN}")

    return UserResponse(
        email=email,
        name=idinfo.get("name", ""),
        picture=idinfo.get("picture", ""),
    )


@app.post("/ask", response_model=QuestionResponse)
def ask_question(req: QuestionRequest, user: dict = Depends(get_current_user)):
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
def reset_session(session_id: str = "default", user: dict = Depends(get_current_user)):
    """Reseta o histórico de conversa de uma sessão."""
    if session_id in sessions:
        sessions[session_id].reset()
    return {"status": "ok"}


@app.get("/suggestions", response_model=SuggestionResponse)
def get_suggestions(user: dict = Depends(get_current_user)):
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


@app.get("/download/{file_id}")
def download_file(file_id: str, user: dict = Depends(get_current_user)):
    """Baixa um arquivo XLSX exportado pelo agente."""
    filepath = get_export_path(file_id)
    if not filepath:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado ou expirado.")
    return FileResponse(
        path=str(filepath),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filepath.name,
    )


@app.get("/health")
def health():
    """Health check do serviço (sem auth)."""
    cleanup_old_exports()
    return {"status": "ok"}
