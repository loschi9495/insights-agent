# Onfly Insights Agent

Agente de relatórios em linguagem natural que consulta o BigQuery da Onfly e responde perguntas sobre gastos, reservas, viajantes, empresas e indicadores financeiros.

## Como funciona

```
Pergunta em português → Claude (NLU + SQL) → BigQuery → Resposta formatada
```

O agente recebe uma pergunta, usa o Claude para interpretar a intenção e gerar queries SQL, executa no BigQuery e formata a resposta com tabelas, insights e comparativos.

Todas as queries são **read-only** — comandos de escrita (INSERT, UPDATE, DELETE, DROP) são bloqueados automaticamente.

## Estrutura do projeto

```
insights-agent/
├── cli.py                  # Interface de linha de comando interativa
├── api.py                  # API HTTP (FastAPI)
├── discover_schema.py      # Script para mapear schema do BigQuery
├── requirements.txt        # Dependências Python
├── .env                    # Variáveis de ambiente (não commitado)
├── .env.example            # Exemplo de configuração
├── config/
│   ├── settings.py         # Configurações da aplicação
│   └── schema.txt          # Schema do BigQuery (gerado automaticamente)
├── prompts/
│   └── system.txt          # System prompt do agente
└── src/
    ├── agent.py            # Orquestrador principal (Claude + tools)
    ├── bigquery_client.py  # Cliente BigQuery com sandbox de segurança
    └── tools.py            # Definição das tools para o Claude
```

## Setup

### Pré-requisitos

- Python 3.12+
- Conta na [Anthropic](https://console.anthropic.com) com API key
- Acesso ao projeto GCP `dw-onfly-prd` (BigQuery)
- `gcloud` CLI autenticado

### Instalação

```bash
cd ~/Dev/OnflyV3/insights-agent

# Criar e ativar virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com sua ANTHROPIC_API_KEY

# Autenticar no GCP (se ainda não estiver)
gcloud auth application-default login

# Mapear schema do BigQuery (rodar uma vez)
python discover_schema.py
```
### Pergunta direta (sem modo interativo)

```bash
python cli.py "Quais as 10 empresas com maior GMV em 2026?"
```

### API HTTP

```bash
source .venv/bin/activate
uvicorn api:app --reload --port 8080
```

Endpoints:

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/ask` | Enviar pergunta |
| POST | `/reset` | Resetar sessao |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |

Exemplo de request:

```bash
curl -X POST http://localhost:8080/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Quais creditos aereos vencem nos proximos 30 dias?", "session_id": "user-123"}'
```

Resposta:

```json
{
  "answer": "...",
  "session_id": "user-123"
}
```

## Exemplos de perguntas

### Financeiro
- "Qual o GMV total por modalidade no Q1 2026?"
- "Compare o GMV de janeiro vs fevereiro 2026"
- "Qual o take rate por consolidador no ultimo trimestre?"
- "Top 10 empresas por lucro em 2026"

### Empresas
- "Quantas empresas ativas temos por setor?"
- "Quais empresas fizeram churn em 2026?"
- "Qual a taxa de conversao de cotacoes para reservas por empresa?"
- "Empresas com maior potencial de GMV mensal que nao estao atingindo"

### Viajantes e reservas
- "Quais os 10 viajantes que mais viajaram neste trimestre?"
- "Qual a antecedencia media de compra de voos por mes?"
- "Rotas aereas mais frequentes em 2026"
- "Ticket medio de hotel por estado"

### Operacional
- "Qual o percentual de emissoes automaticas vs manuais por mes?"
- "NPS medio por tamanho de empresa"
- "Quantos tickets de suporte foram abertos por categoria este mes?"
- "Empresas que usam travel mas nao usam expense"

### Scale-up e engajamento
- "Quais empresas estao engajadas no Blue nos ultimos 3 meses?"
- "Empresas com mais de 100 funcionarios que nao usaram a plataforma nos ultimos 2 meses"
- "Taxa de conversao voo vs hotel por empresa"

Para ver o schema completo: `config/schema.txt`

## Configuracao

Variaveis de ambiente (`.env`):

| Variavel | Descricao | Default |
|----------|-----------|---------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic | (obrigatorio) |
| `GCP_PROJECT_ID` | Projeto GCP |
| `BIGQUERY_LOCATION` | Regiao do BigQuery |
| `BIGQUERY_MAX_BYTES_BILLED` | Limite de bytes por query | 10GB |
| `CLAUDE_MODEL` | Modelo do Claude | `claude-sonnet-4-20250514` |
| `CLAUDE_MAX_TOKENS` | Max tokens na resposta | 4096 |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON (opcional) | (usa gcloud auth) |

## Seguranca

- Apenas queries `SELECT` e `WITH` sao permitidas
- Keywords destrutivas bloqueadas: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, MERGE
- Limite de 10GB de billing por query
- Maximo de 500 rows por resultado
- Maximo de 10 iteracoes por pergunta (evita loops infinitos)

## Arquitetura

```
                    ┌──────────────┐
  Pergunta ───────► │  Claude API  │
                    │  (tool_use)  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        list_datasets  describe    execute_query
              │        _table          │
              └────────────┼───────────┘
                           ▼
                    ┌──────────────┐
                    │   BigQuery   │
                    │  cockpit.*   │
                    └──────────────┘
                           │
                           ▼
                   Resposta formatada
                   em portugues BR
```

O Claude decide autonomamente quais tools chamar e em qual ordem. Se nao conhece o schema de uma tabela, usa `list_tables` e `describe_table` antes de montar a query SQL.
