import { BigQuery } from "@google-cloud/bigquery";
import { config } from "./config.js";
import { QueryCache } from "./cache.js";

const queryCache = new QueryCache(1800);

export class BigQueryClient {
  private client: BigQuery;
  private schemaCache: string | null = null;
  public cache = queryCache;

  constructor() {
    this.client = new BigQuery({
      projectId: config.gcpProjectId,
      location: config.bigqueryLocation,
    });
  }

  async listDatasets(): Promise<string> {
    const [datasets] = await this.client.getDatasets();
    if (!datasets.length) return "Nenhum dataset encontrado no projeto.";
    return datasets.map((ds) => `- ${ds.id}`).join("\n");
  }

  async listTables(datasetId: string): Promise<string> {
    const [tables] = await this.client.dataset(datasetId).getTables();
    if (!tables.length) return `Nenhuma tabela encontrada em ${datasetId}.`;
    const lines: string[] = [];
    for (const t of tables) {
      const [meta] = await t.getMetadata();
      const rowCount = parseInt(meta.numRows || "0");
      lines.push(`- ${t.id} (${rowCount.toLocaleString()} rows)`);
    }
    return `Dataset: ${datasetId}\n${lines.join("\n")}`;
  }

  async describeTable(datasetId: string, tableId: string): Promise<string> {
    const [meta] = await this.client.dataset(datasetId).table(tableId).getMetadata();
    const rows = parseInt(meta.numRows || "0");
    const bytes = parseInt(meta.numBytes || "0");
    const lines = [
      `Tabela: ${datasetId}.${tableId}`,
      `Rows: ${rows.toLocaleString()}`,
      `Tamanho: ${(bytes / 1024 / 1024).toFixed(1)} MB`,
      "",
      "Colunas:",
    ];
    for (const field of meta.schema?.fields || []) {
      const desc = field.description ? ` -- ${field.description}` : "";
      lines.push(`  - ${field.name} (${field.type}, ${field.mode})${desc}`);
    }
    return lines.join("\n");
  }

  async getFullSchema(): Promise<string> {
    if (this.schemaCache) return this.schemaCache;

    const [datasets] = await this.client.getDatasets();
    const parts: string[] = [];

    for (const ds of datasets) {
      const [tables] = await this.client.dataset(ds.id!).getTables();
      if (!tables.length) continue;
      parts.push(`\n## Dataset: ${ds.id}`);
      for (const t of tables) {
        const [meta] = await t.getMetadata();
        const cols = (meta.schema?.fields || [])
          .map((f: { name: string; type: string }) => `${f.name} (${f.type})`)
          .join(", ");
        parts.push(`  - ${t.id}: ${cols}`);
      }
    }

    this.schemaCache = parts.join("\n");
    return this.schemaCache;
  }

  private validateSql(sql: string): string | null {
    const upper = sql.toUpperCase().trim();
    for (const kw of config.blockedSqlKeywords) {
      if (upper.split(/\s+/).includes(kw)) {
        return `ERRO: Keyword '${kw}' não permitida. Apenas queries SELECT são aceitas.`;
      }
    }
    if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
      return "ERRO: Query deve começar com SELECT ou WITH.";
    }
    return null;
  }

  async executeQueryRaw(sql: string, maxRows = 5000): Promise<Record<string, unknown>[]> {
    const err = this.validateSql(sql);
    if (err) throw new Error(err);

    const [rows] = await this.client.query({
      query: sql,
      maximumBytesBilled: String(config.bigqueryMaxBytes),
      maxResults: maxRows,
    });
    return rows;
  }

  async executeQuery(sql: string, maxRows?: number): Promise<string> {
    const err = this.validateSql(sql);
    if (err) return err;

    const cached = this.cache.get(sql);
    if (cached) return cached + "\n\n(resultado do cache)";

    try {
      const [job] = await this.client.createQueryJob({
        query: sql,
        maximumBytesBilled: String(config.bigqueryMaxBytes),
      });
      const [rows] = await job.getQueryResults({ maxResults: maxRows || config.maxQueryRows });

      if (!rows.length) return "Query executada com sucesso. Nenhum resultado encontrado.";

      const headers = Object.keys(rows[0]);
      const lines = [
        headers.join(" | "),
        headers.map(() => "---").join(" | "),
        ...rows.map((row) => headers.map((h) => String(row[h] ?? "")).join(" | ")),
      ];

      const [jobMeta] = await job.getMetadata();
      const bytesProcessed = parseInt(jobMeta.statistics?.totalBytesProcessed || "0");
      const footer = `\n\n(${rows.length} rows, ${(bytesProcessed / 1024 / 1024).toFixed(1)} MB processados)`;
      const result = lines.join("\n") + footer;

      this.cache.set(sql, result);
      return result;
    } catch (e) {
      return `ERRO na query: ${(e as Error).message}`;
    }
  }
}
