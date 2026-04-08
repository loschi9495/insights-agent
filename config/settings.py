import os
from dotenv import load_dotenv

load_dotenv()

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "dw-onfly-prd")
BIGQUERY_LOCATION = os.getenv("BIGQUERY_LOCATION", "us-central1")
BIGQUERY_MAX_BYTES_BILLED = int(os.getenv("BIGQUERY_MAX_BYTES_BILLED", 10 * 1024**3))  # 10GB

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
CLAUDE_MAX_TOKENS = int(os.getenv("CLAUDE_MAX_TOKENS", 4096))

MAX_QUERY_ROWS = 500
BLOCKED_SQL_KEYWORDS = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE", "MERGE"]

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "")  # ex: "onfly.com.br" para restringir
