import re
from datetime import date


# Abreviações comuns que podem causar ambiguidade em queries
ABBREVIATIONS = {
    r'\bCC\b': 'centro de custo',
    r'\bTM\b': 'ticket médio',
    r'\bYoY\b': 'comparação ano a ano',
    r'\bMoM\b': 'comparação mês a mês',
    r'\bQoQ\b': 'comparação trimestre a trimestre',
}

# Meses em português para detecção
MONTH_PATTERNS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
    'jul', 'ago', 'set', 'out', 'nov', 'dez',
    'Q1', 'Q2', 'Q3', 'Q4', 'trimestre', 'semestre',
    'semana', 'mês', 'mes', 'ano', 'hoje', 'ontem',
    'último', 'ultima', 'passado', 'passada', 'atual', 'corrente',
    '2024', '2025', '2026',
]


def has_time_reference(text: str) -> bool:
    """Verifica se o texto contém referência temporal."""
    lower = text.lower()
    return any(p.lower() in lower for p in MONTH_PATTERNS)


def expand_abbreviations(text: str) -> str:
    """Expande abreviações conhecidas no texto."""
    for pattern, replacement in ABBREVIATIONS.items():
        text = re.sub(pattern, replacement, text)
    return text


def enrich_question(question: str) -> str:
    """Enriquece a pergunta do usuário antes de enviar ao Claude."""
    question = expand_abbreviations(question)

    # Se não tem referência temporal, adicionar contexto
    if not has_time_reference(question):
        today = date.today()
        question += f" (Sem período especificado. Hoje é {today.strftime('%d/%m/%Y')})"

    return question


def build_user_context(user: dict | None) -> str:
    """Constrói o contexto do usuário para o system prompt."""
    if not user:
        return "Usuário não identificado (acesso via CLI)."

    parts = []
    if user.get("name"):
        parts.append(f"Nome: {user['name']}")
    if user.get("email"):
        parts.append(f"Email: {user['email']}")
        domain = user['email'].split('@')[-1] if '@' in user['email'] else ''
        if domain:
            parts.append(f"Domínio: {domain}")

    return "\n".join(parts) if parts else "Usuário autenticado."
