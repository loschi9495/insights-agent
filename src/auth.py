from fastapi import HTTPException, Request
from config.settings import GOOGLE_CLIENT_ID, ALLOWED_EMAIL_DOMAIN, AUTH_BYPASS

DEV_USER = {
    "email": "dev@localhost",
    "name": "Dev Local",
    "picture": "",
}


def get_current_user(request: Request) -> dict:
    """Valida o token Google do header Authorization e retorna os dados do usuário."""
    if AUTH_BYPASS:
        return DEV_USER

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token não fornecido")

    token = auth_header.removeprefix("Bearer ")

    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    email = idinfo.get("email", "")
    if not idinfo.get("email_verified", False):
        raise HTTPException(status_code=401, detail="Email não verificado")

    if ALLOWED_EMAIL_DOMAIN and not email.endswith(f"@{ALLOWED_EMAIL_DOMAIN}"):
        raise HTTPException(status_code=403, detail=f"Acesso restrito a emails @{ALLOWED_EMAIL_DOMAIN}")

    return {
        "email": email,
        "name": idinfo.get("name", ""),
        "picture": idinfo.get("picture", ""),
    }
