import anthropic
from pathlib import Path
from src.bigquery_client import BigQueryClient
from src.tools import TOOLS
from config.settings import CLAUDE_MODEL, CLAUDE_MAX_TOKENS


class InsightsAgent:
    def __init__(self):
        self.claude = anthropic.Anthropic()
        self.bq = BigQueryClient()
        self.system_prompt = self._load_system_prompt()
        self.conversation: list[dict] = []

    def _load_system_prompt(self) -> str:
        template = Path("prompts/system.txt").read_text()
        try:
            schema = self.bq.get_full_schema()
        except Exception:
            schema = "(Schema será descoberto dinamicamente via tools list_datasets/list_tables/describe_table)"
        return template.replace("{schema}", schema)

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
            case _:
                return f"Tool desconhecida: {name}"

    def ask(self, question: str) -> str:
        self.conversation.append({"role": "user", "content": question})

        max_iterations = 10  # evitar loops infinitos
        for _ in range(max_iterations):
            response = self.claude.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=CLAUDE_MAX_TOKENS,
                system=self.system_prompt,
                tools=TOOLS,
                messages=self.conversation,
            )

            if response.stop_reason == "tool_use":
                # Executar todas as tool calls
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = self._execute_tool(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result,
                        })

                self.conversation.append({"role": "assistant", "content": response.content})
                self.conversation.append({"role": "user", "content": tool_results})

            elif response.stop_reason == "end_turn":
                self.conversation.append({"role": "assistant", "content": response.content})
                return "".join(
                    block.text for block in response.content if hasattr(block, "text")
                )

        return "Limite de iterações atingido. Tente reformular a pergunta."

    def reset(self):
        self.conversation = []
