"""
Script para descobrir e salvar o schema do BigQuery.
Rode uma vez para gerar o mapa de tabelas que o agente usa.

Uso:
    python discover_schema.py
"""
from src.bigquery_client import BigQueryClient
from pathlib import Path


def main():
    bq = BigQueryClient()

    print("Descobrindo schema do BigQuery...\n")

    schema = bq.get_full_schema()

    output_path = Path("config/schema.txt")
    output_path.write_text(schema)

    print(schema)
    print(f"\nSchema salvo em {output_path}")


if __name__ == "__main__":
    main()
