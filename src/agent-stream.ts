import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { BigQueryClient } from "./bigquery-client.js";
import { generateXlsx } from "./exporter.js";
import { enrichQuestion, buildUserContext, type UserInfo } from "./prompt-enricher.js";
import { TOOLS } from "./tools.js";
import { config } from "./config.js";

function sseEvent(type: string, content: string): string {
  return `data: ${JSON.stringify({ type, content })}\n\n`;
}

const TOOL_LABELS: Record<string, string> = {
  execute_query: "Consultando BigQuery...",
  list_datasets: "Listando datasets...",
  list_tables: "Listando tabelas...",
  describe_table: "Analisando schema...",
  export_spreadsheet: "Gerando planilha...",
};

export class StreamingInsightsAgent {
  private claude: Anthropic;
  private bq: BigQueryClient;
  private user: UserInfo | null;
  private systemPrompt = "";
  private conversation: Anthropic.MessageParam[] = [];

  constructor(user: UserInfo | null = null) {
    this.claude = new Anthropic();
    this.bq = new BigQueryClient();
    this.user = user;
  }

  private async init(): Promise<void> {
    if (this.systemPrompt) return;
    const template = fs.readFileSync(path.resolve("prompts/system.txt"), "utf-8");
    let schema: string;
    try {
      schema = await this.bq.getFullSchema();
    } catch {
      schema = "(Schema será descoberto dinamicamente via tools)";
    }
    this.systemPrompt = template
      .replace("{schema}", schema)
      .replace("{user_context}", buildUserContext(this.user))
      .replace("{today}", new Date().toLocaleDateString("pt-BR"));
  }

  private async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
      case "execute_query":
        return this.bq.executeQuery(input.sql as string, input.max_rows as number | undefined);
      case "list_datasets":
        return this.bq.listDatasets();
      case "list_tables":
        return this.bq.listTables(input.dataset_id as string);
      case "describe_table":
        return this.bq.describeTable(input.dataset_id as string, input.table_id as string);
      case "export_spreadsheet":
        try {
          const rows = await this.bq.executeQueryRaw(input.sql as string, (input.max_rows as number) || 5000);
          const fileId = await generateXlsx(rows, (input.title as string) || "Relatório");
          return `EXPORT_FILE_ID:${fileId}|ROWS:${rows.length}|TITLE:${input.title || "Relatório"}`;
        } catch (e) {
          return `ERRO ao exportar: ${(e as Error).message}`;
        }
      default:
        return `Tool desconhecida: ${name}`;
    }
  }

  async *askStream(question: string): AsyncGenerator<string> {
    await this.init();

    const enriched = enrichQuestion(question);
    this.conversation.push({ role: "user", content: enriched });
    yield sseEvent("status", "Analisando sua pergunta...");

    for (let i = 0; i < 10; i++) {
      const response = await this.claude.messages.create({
        model: config.claudeModel,
        max_tokens: config.claudeMaxTokens,
        system: this.systemPrompt,
        tools: TOOLS,
        messages: this.conversation,
      });

      if (response.stop_reason === "tool_use") {
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type === "tool_use") {
            yield sseEvent("status", TOOL_LABELS[block.name] || "Processando...");
            const result = await this.executeTool(block.name, block.input as Record<string, unknown>);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }
        }
        this.conversation.push({ role: "assistant", content: response.content });
        this.conversation.push({ role: "user", content: toolResults });
        yield sseEvent("status", "Gerando resposta...");
      } else if (response.stop_reason === "end_turn") {
        this.conversation.push({ role: "assistant", content: response.content });
        const fullText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        const chunkSize = 40;
        for (let j = 0; j < fullText.length; j += chunkSize) {
          yield sseEvent("text", fullText.slice(j, j + chunkSize));
        }
        yield sseEvent("done", "");
        return;
      }
    }

    yield sseEvent("error", "Limite de iterações atingido.");
  }

  reset(): void {
    this.conversation = [];
  }
}
