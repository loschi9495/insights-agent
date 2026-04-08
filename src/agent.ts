import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { BigQueryClient } from "./bigquery-client.js";
import { generateXlsx } from "./exporter.js";
import { enrichQuestion, buildUserContext, type UserInfo } from "./prompt-enricher.js";
import { TOOLS } from "./tools.js";
import { config } from "./config.js";

export class InsightsAgent {
  private claude: Anthropic;
  private bq: BigQueryClient;
  private user: UserInfo | null;
  private systemPrompt: string;
  private conversation: Anthropic.MessageParam[] = [];

  constructor(user: UserInfo | null = null) {
    this.claude = new Anthropic();
    this.bq = new BigQueryClient();
    this.user = user;
    this.systemPrompt = "";
  }

  async init(): Promise<void> {
    const template = fs.readFileSync(path.resolve("prompts/system.txt"), "utf-8");
    let schema: string;
    try {
      schema = await this.bq.getFullSchema();
    } catch {
      schema = "(Schema será descoberto dinamicamente via tools)";
    }
    const userContext = buildUserContext(this.user);
    const today = new Date().toLocaleDateString("pt-BR");

    this.systemPrompt = template
      .replace("{schema}", schema)
      .replace("{user_context}", userContext)
      .replace("{today}", today);
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

  async ask(question: string): Promise<string> {
    if (!this.systemPrompt) await this.init();

    const enriched = enrichQuestion(question);
    this.conversation.push({ role: "user", content: enriched });

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
            const result = await this.executeTool(block.name, block.input as Record<string, unknown>);
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
          }
        }
        this.conversation.push({ role: "assistant", content: response.content });
        this.conversation.push({ role: "user", content: toolResults });
      } else if (response.stop_reason === "end_turn") {
        this.conversation.push({ role: "assistant", content: response.content });
        return response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
      }
    }

    return "Limite de iterações atingido. Tente reformular a pergunta.";
  }

  reset(): void {
    this.conversation = [];
  }
}
