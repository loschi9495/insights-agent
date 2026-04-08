TOOLS = [
    {
        "name": "execute_query",
        "description": (
            "Executa uma query SQL (BigQuery Standard SQL) no data warehouse da Onfly. "
            "Use para responder perguntas sobre gastos, reservas, aprovações, viajantes, "
            "faturas, créditos e qualquer dado da plataforma. "
            "Apenas SELECT é permitido. Sempre use agregações e filtros para eficiência."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "Query SQL no dialeto BigQuery Standard SQL.",
                },
                "max_rows": {
                    "type": "integer",
                    "description": "Máximo de linhas (default 100, max 500).",
                    "default": 100,
                },
            },
            "required": ["sql"],
        },
    },
    {
        "name": "list_datasets",
        "description": "Lista todos os datasets disponíveis no BigQuery.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "list_tables",
        "description": "Lista todas as tabelas de um dataset específico com contagem de rows.",
        "input_schema": {
            "type": "object",
            "properties": {
                "dataset_id": {
                    "type": "string",
                    "description": "Nome do dataset.",
                },
            },
            "required": ["dataset_id"],
        },
    },
    {
        "name": "describe_table",
        "description": "Retorna schema completo de uma tabela (colunas, tipos, descrições).",
        "input_schema": {
            "type": "object",
            "properties": {
                "dataset_id": {
                    "type": "string",
                    "description": "Nome do dataset.",
                },
                "table_id": {
                    "type": "string",
                    "description": "Nome da tabela.",
                },
            },
            "required": ["dataset_id", "table_id"],
        },
    },
]
