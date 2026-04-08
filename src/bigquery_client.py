import warnings
warnings.filterwarnings("ignore", message="Your application has authenticated using end user credentials")

from google.cloud import bigquery
from config.settings import GCP_PROJECT_ID, BIGQUERY_LOCATION, BIGQUERY_MAX_BYTES_BILLED, MAX_QUERY_ROWS, BLOCKED_SQL_KEYWORDS


class BigQueryClient:
    def __init__(self):
        self.client = bigquery.Client(
            project=GCP_PROJECT_ID,
            location=BIGQUERY_LOCATION,
        )
        self._schema_cache: dict | None = None

    def list_datasets(self) -> str:
        datasets = list(self.client.list_datasets())
        if not datasets:
            return "Nenhum dataset encontrado no projeto."
        return "\n".join(f"- {ds.dataset_id}" for ds in datasets)

    def list_tables(self, dataset_id: str) -> str:
        tables = list(self.client.list_tables(f"{GCP_PROJECT_ID}.{dataset_id}"))
        if not tables:
            return f"Nenhuma tabela encontrada em {dataset_id}."
        lines = []
        for t in tables:
            full = self.client.get_table(t)
            row_count = full.num_rows or 0
            lines.append(f"- {t.table_id} ({row_count:,} rows)")
        return f"Dataset: {dataset_id}\n" + "\n".join(lines)

    def describe_table(self, dataset_id: str, table_id: str) -> str:
        table = self.client.get_table(f"{GCP_PROJECT_ID}.{dataset_id}.{table_id}")
        lines = [
            f"Tabela: {dataset_id}.{table_id}",
            f"Rows: {table.num_rows:,}",
            f"Tamanho: {table.num_bytes / 1024 / 1024:.1f} MB",
            f"Última modificação: {table.modified}",
            "",
            "Colunas:",
        ]
        for field in table.schema:
            desc = f" -- {field.description}" if field.description else ""
            lines.append(f"  - {field.name} ({field.field_type}, {field.mode}){desc}")
        return "\n".join(lines)

    def get_full_schema(self) -> str:
        """Retorna schema completo de todos os datasets e tabelas (com cache)."""
        if self._schema_cache is not None:
            return self._schema_cache

        parts = []
        for ds in self.client.list_datasets():
            tables = list(self.client.list_tables(f"{GCP_PROJECT_ID}.{ds.dataset_id}"))
            if not tables:
                continue
            parts.append(f"\n## Dataset: {ds.dataset_id}")
            for t in tables:
                full = self.client.get_table(t)
                cols = ", ".join(f"{f.name} ({f.field_type})" for f in full.schema)
                parts.append(f"  - {t.table_id}: {cols}")

        result = "\n".join(parts)
        self._schema_cache = result
        return result

    def execute_query(self, sql: str, max_rows: int | None = None) -> str:
        sql_upper = sql.upper().strip()

        for kw in BLOCKED_SQL_KEYWORDS:
            if kw in sql_upper.split():
                return f"ERRO: Keyword '{kw}' não permitida. Apenas queries SELECT são aceitas."

        if not (sql_upper.startswith("SELECT") or sql_upper.startswith("WITH")):
            return "ERRO: Query deve começar com SELECT ou WITH."

        job_config = bigquery.QueryJobConfig(
            maximum_bytes_billed=BIGQUERY_MAX_BYTES_BILLED,
        )

        try:
            job = self.client.query(sql, job_config=job_config)
            rows = list(job.result(max_results=max_rows or MAX_QUERY_ROWS))
        except Exception as e:
            return f"ERRO na query: {e}"

        if not rows:
            return "Query executada com sucesso. Nenhum resultado encontrado."

        headers = list(rows[0].keys())
        lines = [" | ".join(headers)]
        lines.append(" | ".join("---" for _ in headers))
        for row in rows:
            lines.append(" | ".join(str(row[h]) for h in headers))

        bytes_processed = job.total_bytes_processed or 0
        footer = f"\n\n({len(rows)} rows, {bytes_processed / 1024 / 1024:.1f} MB processados)"
        return "\n".join(lines) + footer
