import json
import anthropic
from datetime import date
from pathlib import Path
from collections.abc import Generator
from src.bigquery_client import BigQueryClient
from src.exporter import generate_xlsx
from src.prompt_enricher import enrich_question, build_user_context
from src.tools import TOOLS
from config.settings import CLAUDE_MODEL, CLAUDE_MAX_TOKENS


class StreamingInsightsAgent:
    """Agent that yields SSE events during execution."""

    def __init__(self, user: dict | None = None):
        self.claude = anthropic.Anthropic()
        self.bq = BigQueryClient()
        self.user = user
        self.system_prompt = self._load_system_prompt()
        self.conversation: list[dict] = []

    def _load_system_prompt(self) -> str:
        template = Path("prompts/system.txt").read_text()
        try:
            schema = self.bq.get_full_schema()
        except Exception:
            schema = "(Schema será descoberto dinamicamente via tools)"
        user_context = build_user_context(self.user)
        today = date.today().strftime("%d/%m/%Y")
        return (
            template
            .replace("{schema}", schema)
            .replace("{user_context}", user_context)
            .replace("{today}", today)
        )

    def _execute_tool(self, name: str, inputs: dict) -> str:
        match name:
            case "execute_query":
                return self.bq.execute_query(
                    sql=inputs["sql"],
                    max_rows=inputs.get("max_rows", 100),
                )
            case "list_datasets":
                return self.bq.list_datasets()
            case "list_tables":
                return self.bq.list_tables(inputs["dataset_id"])
            case "describe_table":
                return self.bq.describe_table(inputs["dataset_id"], inputs["table_id"])
            case "export_spreadsheet":
                try:
                    rows = self.bq.execute_query_raw(
                        sql=inputs["sql"],
                        max_rows=inputs.get("max_rows", 5000),
                    )
                    file_id = generate_xlsx(rows, title=inputs.get("title", "Relatório"))
                    return f"EXPORT_FILE_ID:{file_id}|ROWS:{len(rows)}|TITLE:{inputs.get('title', 'Relatório')}"
                except Exception as e:
                    return f"ERRO ao exportar: {e}"
            case _:
                return f"Tool desconhecida: {name}"

    def _tool_status(self, name: str) -> str:
        labels = {
            "execute_query": "Consultando BigQuery...",
            "list_datasets": "Listando datasets...",
            "list_tables": "Listando tabelas...",
            "describe_table": "Analisando schema...",
            "export_spreadsheet": "Gerando planilha...",
        }
        return labels.get(name, "Processando...")

    def ask_stream(self, question: str) -> Generator[str, None, None]:
        """Yields SSE-formatted events: status updates and final text chunks."""
        enriched = enrich_question(question)
        self.conversation.append({"role": "user", "content": enriched})

        yield f"data: {json.dumps({'type': 'status', 'content': 'Analisando sua pergunta...'})}\n\n"

        max_iterations = 10
        for _ in range(max_iterations):
            # Non-streaming call for tool use loop
            response = self.claude.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=CLAUDE_MAX_TOKENS,
                system=self.system_prompt,
                tools=TOOLS,
                messages=self.conversation,
            )

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        yield f"data: {json.dumps({'type': 'status', 'content': self._tool_status(block.name)})}\n\n"
                        result = self._execute_tool(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })

                self.conversation.append({"role": "assistant", "content": response.content})
                self.conversation.append({"role": "user", "content": tool_results})

                yield f"data: {json.dumps({'type': 'status', 'content': 'Gerando resposta...'})}\n\n"

            elif response.stop_reason == "end_turn":
                self.conversation.append({"role": "assistant", "content": response.content})

                full_text = "".join(
                    block.text for block in response.content if hasattr(block, "text")
                )

                # Send text in chunks for smooth rendering
                chunk_size = 40
                for i in range(0, len(full_text), chunk_size):
                    chunk = full_text[i:i + chunk_size]
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"

                yield f"data: {json.dumps({'type': 'done', 'content': ''})}\n\n"
                return

        yield f"data: {json.dumps({'type': 'error', 'content': 'Limite de iterações atingido.'})}\n\n"

    def reset(self):
        self.conversation = []
