import type Anthropic from "@anthropic-ai/sdk";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "execute_query",
    description:
      "Executa uma query SQL (BigQuery Standard SQL) no data warehouse da Onfly. " +
      "Use para responder perguntas sobre gastos, reservas, aprovações, viajantes, " +
      "faturas, créditos e qualquer dado da plataforma. " +
      "Apenas SELECT é permitido. Sempre use agregações e filtros para eficiência.",
    input_schema: {
      type: "object" as const,
      properties: {
        sql: { type: "string", description: "Query SQL no dialeto BigQuery Standard SQL." },
        max_rows: { type: "integer", description: "Máximo de linhas (default 100, max 500).", default: 100 },
      },
      required: ["sql"],
    },
  },
  {
    name: "list_datasets",
    description: "Lista todos os datasets disponíveis no BigQuery.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_tables",
    description: "Lista todas as tabelas de um dataset específico com contagem de rows.",
    input_schema: {
      type: "object" as const,
      properties: {
        dataset_id: { type: "string", description: "Nome do dataset." },
      },
      required: ["dataset_id"],
    },
  },
  {
    name: "describe_table",
    description: "Retorna schema completo de uma tabela (colunas, tipos, descrições).",
    input_schema: {
      type: "object" as const,
      properties: {
        dataset_id: { type: "string", description: "Nome do dataset." },
        table_id: { type: "string", description: "Nome da tabela." },
      },
      required: ["dataset_id", "table_id"],
    },
  },
  {
    name: "export_spreadsheet",
    description:
      "Exporta o resultado de uma query SQL para uma planilha Excel (.xlsx) " +
      "que o usuário pode baixar. Use quando o usuário pedir para exportar, " +
      "salvar em planilha, gerar Excel, ou baixar os dados. " +
      "Retorna um link de download. Suporta até 5000 linhas.",
    input_schema: {
      type: "object" as const,
      properties: {
        sql: { type: "string", description: "Query SQL para gerar os dados da planilha." },
        title: { type: "string", description: "Título/nome da planilha (ex: 'GMV por empresa Q1 2026')." },
        max_rows: { type: "integer", description: "Máximo de linhas (default 5000).", default: 5000 },
      },
      required: ["sql", "title"],
    },
  },
];
