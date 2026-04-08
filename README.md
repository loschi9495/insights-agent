# Onfly Insights Agent

Agente de relatórios em linguagem natural que consulta o BigQuery da Onfly e responde perguntas sobre gastos, reservas, viajantes, empresas e indicadores financeiros.

## Como funciona

```
Usuário (browser) → Login Google SSO → Frontend (React) → Backend (FastAPI) → Claude API → BigQuery → Resposta formatada
```

O agente recebe uma pergunta, usa o Claude para interpretar a intenção e gerar queries SQL, executa no BigQuery (dataset `cockpit`, projeto `dw-onfly-prd`) e formata a resposta com tabelas, insights e comparativos. Também permite exportar resultados como planilha Excel (.xlsx).

Todas as queries são **read-only** — comandos de escrita (INSERT, UPDATE, DELETE, DROP) são bloqueados automaticamente.

## Estrutura do projeto

```
insights-agent/                          # Backend (Python/FastAPI)
├── api.py                               # API HTTP com autenticação Google SSO
├── cli.py                               # Interface de linha de comando interativa
├── discover_schema.py                   # Script para mapear schema do BigQuery
├── requirements.txt                     # Dependências Python
├── .env                                 # Variáveis de ambiente (não commitado)
├── .env.example                         # Exemplo de configuração
├── exports/                             # Planilhas XLSX geradas (temporário)
├── config/
│   ├── settings.py                      # Configurações da aplicação
│   └── schema.txt                       # Schema do BigQuery (gerado automaticamente)
├── docs/
│   ├── openapi.json                     # Especificação OpenAPI da API
│   └── lovable-prompt.md                # Prompt usado para gerar o frontend no Lovable
├── prompts/
│   └── system.txt                       # System prompt do agente
└── src/
    ├── agent.py                         # Orquestrador principal (Claude + tools)
    ├── auth.py                          # Autenticação Google OAuth SSO
    ├── bigquery_client.py               # Cliente BigQuery com sandbox de segurança
    ├── exporter.py                      # Gerador de planilhas XLSX
    └── tools.py                         # Definição das tools para o Claude

Onfly Insight Chat/                      # Frontend (React/TypeScript)
├── src/
│   ├── App.tsx                          # Rotas com proteção de autenticação
│   ├── pages/
│   │   ├── Index.tsx                    # Chat principal
│   │   └── Login.tsx                    # Tela de login Google SSO
│   ├── components/
│   │   ├── ChatMessage.tsx              # Mensagens com markdown + botão download
│   │   ├── ChatInput.tsx                # Input de perguntas
│   │   ├── ChatSidebar.tsx              # Sidebar com conversas + perfil + logout
│   │   ├── SuggestionsGrid.tsx          # Cards de sugestões na tela inicial
│   │   └── TypingIndicator.tsx          # Indicador de loading
│   └── lib/
│       ├── api.ts                       # Cliente HTTP com auth headers
│       ├── auth.ts                      # Gerenciamento de sessão (localStorage)
│       └── conversations.ts             # Persistência de conversas
└── vite.config.ts                       # Proxy dev para o backend
```

## Setup

### Pré-requisitos

- Python 3.12+
- Node.js 18+
- Conta na [Anthropic](https://console.anthropic.com) com API key
- Acesso ao projeto GCP `dw-onfly-prd` (BigQuery)
- `gcloud` CLI autenticado
- Google Client ID OAuth (para SSO)

### 1. Backend

```bash
cd ~/Dev/OnflyV3/insights-agent

# Criar e ativar virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com ANTHROPIC_API_KEY e GOOGLE_CLIENT_ID

# Autenticar no GCP (se ainda não estiver)
gcloud auth application-default login

# Mapear schema do BigQuery (rodar uma vez)
python discover_schema.py

# Iniciar o backend
uvicorn api:app --reload --port 8080
```

### 2. Frontend

```bash
cd ~/Dev/OnflyV3/Onfly\ Insight\ Chat

# Instalar dependências
npm install

# Configurar Google Client ID
# Criar arquivo .env.local com:
# VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com

# Iniciar o frontend
npm run dev
```

### 3. Google OAuth Client ID

1. Acesse [GCP Console - Credentials](https://console.cloud.google.com/apis/credentials?project=dw-onfly-prd)
2. **Criar credenciais** -> **ID do cliente OAuth**
3. Tipo: **Aplicativo da Web**
4. Nome: `Onfly Insights Agent`
5. **Origens JavaScript autorizadas**: `http://localhost:3000`
6. **URIs de redirecionamento autorizados**: `http://localhost:3000`
7. Copie o **Client ID** gerado
8. Configure no backend (`.env`): `GOOGLE_CLIENT_ID=seu-id`
9. Configure no frontend (`.env.local`): `VITE_GOOGLE_CLIENT_ID=seu-id`

## Rodando front + back juntos

```bash
# Terminal 1 — Backend (porta 8080)
cd ~/Dev/OnflyV3/insights-agent
source .venv/bin/activate
uvicorn api:app --reload --port 8080

# Terminal 2 — Frontend (porta 3000, proxy para backend)
cd ~/Dev/OnflyV3/Onfly\ Insight\ Chat
npm run dev
```

Acesse **http://localhost:3000**. O Vite proxy redireciona chamadas `/ask`, `/reset`, `/suggestions`, `/auth`, `/download` automaticamente para o backend na porta 8080.

## Autenticação (Google SSO)

### Fluxo

```
1. Usuário acessa http://localhost:3000
2. ProtectedRoute detecta que não há sessão → redireciona para /login
3. Usuário clica em "Sign in with Google"
4. Google retorna credential (JWT token)
5. Frontend envia POST /auth/google com o token
6. Backend valida o token com google.oauth2.id_token
7. Se válido, retorna nome/email/foto do usuário
8. Frontend armazena credential no localStorage
9. Todas as requests enviam header Authorization: Bearer <token>
10. Se token expira, backend retorna 401 → frontend redireciona para /login
```

### Restrição por domínio

Para permitir apenas emails de um domínio específico (ex: `@onfly.com.br`), configure no `.env`:

```
ALLOWED_EMAIL_DOMAIN=onfly.com.br
```

Deixe vazio para aceitar qualquer conta Google.

### Endpoints de autenticação

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/auth/google` | Não | Valida token Google e retorna dados do usuário |
| POST | `/ask` | Sim | Envia pergunta ao agente |
| POST | `/reset` | Sim | Reseta sessão de conversa |
| GET | `/suggestions` | Sim | Sugestões de perguntas |
| GET | `/download/{file_id}` | Sim | Baixa planilha XLSX |
| GET | `/health` | Não | Health check |
| GET | `/docs` | Não | Swagger UI |

## Exportação de planilhas

O agente gera planilhas Excel automaticamente quando o usuário pede. Basta usar linguagem natural:

- "Gere uma planilha com as top 20 empresas por GMV"
- "Quero esses dados em Excel"
- "Exporte o GMV por modalidade numa planilha"
- "Salva isso em planilha pra mim"

### Como funciona

1. O Claude detecta a intenção de exportar e chama a tool `export_spreadsheet`
2. A tool executa a query SQL no BigQuery (até 5000 linhas)
3. Gera um arquivo XLSX formatado (header azul, zebra stripes, auto-fit, filtros)
4. Retorna um `file_id` que o Claude inclui na resposta como link
5. O frontend renderiza o link como botão "Baixar planilha"
6. O clique faz download via `GET /download/{file_id}`
7. Arquivos são limpos automaticamente após 24 horas

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

### Exportação
- "Gere uma planilha com o GMV mensal por empresa em 2026"
- "Exporte os top 50 viajantes por gasto em Excel"
- "Quero uma planilha com todas as empresas que fizeram churn"

## Configuração

Variáveis de ambiente do backend (`.env`):

| Variável | Descrição | Default |
|----------|-----------|---------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic | (obrigatório) |
| `GCP_PROJECT_ID` | Projeto GCP | `dw-onfly-prd` |
| `BIGQUERY_LOCATION` | Região do BigQuery | `us-central1` |
| `BIGQUERY_MAX_BYTES_BILLED` | Limite de bytes por query | 10GB |
| `CLAUDE_MODEL` | Modelo do Claude | `claude-sonnet-4-20250514` |
| `CLAUDE_MAX_TOKENS` | Max tokens na resposta | 4096 |
| `GOOGLE_CLIENT_ID` | Client ID OAuth do Google | (obrigatório para SSO) |
| `ALLOWED_EMAIL_DOMAIN` | Restringe login a um domínio | (vazio = qualquer email) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON | (opcional, usa gcloud auth) |

Variáveis de ambiente do frontend (`.env.local`):

| Variável | Descrição |
|----------|-----------|
| `VITE_GOOGLE_CLIENT_ID` | Mesmo Client ID OAuth do backend |
| `VITE_API_URL` | URL da API (vazio = usa proxy do Vite) |

## Segurança

- Autenticação via Google SSO (OAuth 2.0) em todos os endpoints protegidos
- Restrição opcional por domínio de email (ex: `@onfly.com.br`)
- Apenas queries `SELECT` e `WITH` são permitidas no BigQuery
- Keywords destrutivas bloqueadas: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, MERGE
- Limite de 10GB de billing por query
- Máximo de 500 rows por resposta, 5000 por exportação
- Máximo de 10 iterações de tool use por pergunta
- Arquivos de exportação expiram em 24 horas
- Token Google validado server-side via `google.oauth2.id_token`

## Arquitetura

```
┌───────────────┐     ┌────────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser     │────►│  React App     │────►│  FastAPI      │────►│  Claude API  │
│               │     │  :3000         │     │  :8080        │     │  (tool_use)  │
│  Google SSO   │     │  Vite proxy    │     │  Auth + CORS  │     └──────┬───────┘
└───────────────┘     └────────────────┘     └──────┬────────┘            │
                                                     │         ┌──────────┴──────────┐
                                                     │         ▼                     ▼
                                                     │   execute_query      export_spreadsheet
                                                     │         │                     │
                                                     │         ▼                     ▼
                                                     │   ┌──────────┐         ┌──────────┐
                                                     └──►│ BigQuery │         │  XLSX    │
                                                         │ cockpit  │         │  exports │
                                                         └──────────┘         └──────────┘
```
