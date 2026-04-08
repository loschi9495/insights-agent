"""
API HTTP para o Agente de Insights da Onfly.

Uso:
    uvicorn api:app --reload --port 8080
"""
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from src.agent import InsightsAgent
from src.agent_stream import StreamingInsightsAgent
from src.auth import get_current_user
from src.exporter import get_export_path, cleanup_old_exports
from src.templates import get_templates, render_template

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
stream_sessions: dict[str, StreamingInsightsAgent] = {}


class QuestionRequest(BaseModel):
    question: str
    session_id: str = "default"


class QuestionResponse(BaseModel):
    answer: str
    session_id: str
    follow_ups: list[str] = []


class SuggestionResponse(BaseModel):
    suggestions: list[str]


class GoogleLoginRequest(BaseModel):
    credential: str


class UserResponse(BaseModel):
    email: str
    name: str
    picture: str


class TemplateRenderRequest(BaseModel):
    template_id: str
    variables: dict | None = None


@app.get("/auth/bypass-status")
def auth_bypass_status():
    """Retorna se o bypass de auth está ativo (para o frontend saber)."""
    from config.settings import AUTH_BYPASS
    return {"bypass": AUTH_BYPASS}


@app.post("/auth/google", response_model=UserResponse)
def google_login(req: GoogleLoginRequest):
    """Valida o token do Google Sign-In e retorna dados do usuário."""
    from config.settings import GOOGLE_CLIENT_ID, ALLOWED_EMAIL_DOMAIN, AUTH_BYPASS

    if AUTH_BYPASS:
        return UserResponse(email="dev@localhost", name="Dev Local", picture="")

    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

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


def extract_follow_ups(answer: str) -> tuple[str, list[str]]:
    """Extrai sugestões de follow-up da resposta do agente."""
    follow_ups = []
    clean_answer = answer

    markers = ["**Próximas perguntas:**", "**Próximas perguntas**:", "**Perguntas sugeridas:**"]
    for marker in markers:
        if marker in answer:
            parts = answer.split(marker, 1)
            clean_answer = parts[0].rstrip().rstrip("---").rstrip()
            suggestions_text = parts[1].strip()
            for line in suggestions_text.split("\n"):
                line = line.strip().lstrip("- ").lstrip("* ").strip()
                if line and not line.startswith("---"):
                    follow_ups.append(line)
            break

    return clean_answer, follow_ups[:5]


@app.post("/ask", response_model=QuestionResponse)
def ask_question(req: QuestionRequest, user: dict = Depends(get_current_user)):
    """Envia uma pergunta em linguagem natural e recebe a resposta com dados do BigQuery."""
    if req.session_id not in sessions:
        sessions[req.session_id] = InsightsAgent(user=user)

    agent = sessions[req.session_id]
    try:
        raw_answer = agent.ask(req.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    answer, follow_ups = extract_follow_ups(raw_answer)
    return QuestionResponse(answer=answer, session_id=req.session_id, follow_ups=follow_ups)


@app.post("/ask/stream")
def ask_question_stream(req: QuestionRequest, user: dict = Depends(get_current_user)):
    """Envia uma pergunta e recebe resposta via Server-Sent Events (streaming)."""
    if req.session_id not in stream_sessions:
        stream_sessions[req.session_id] = StreamingInsightsAgent(user=user)

    agent = stream_sessions[req.session_id]
    return StreamingResponse(
        agent.ask_stream(req.question),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/reset")
def reset_session(session_id: str = "default", user: dict = Depends(get_current_user)):
    """Reseta o histórico de conversa de uma sessão."""
    if session_id in sessions:
        sessions[session_id].reset()
    if session_id in stream_sessions:
        stream_sessions[session_id].reset()
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


@app.get("/templates")
def list_templates(user: dict = Depends(get_current_user)):
    """Retorna templates de relatórios disponíveis."""
    return {"templates": get_templates()}


@app.post("/templates/render")
def render_template_endpoint(req: TemplateRenderRequest, user: dict = Depends(get_current_user)):
    """Renderiza um template com variáveis e retorna o prompt pronto."""
    prompt = render_template(req.template_id, req.variables)
    if not prompt:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    return {"prompt": prompt}


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
