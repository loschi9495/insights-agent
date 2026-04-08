# Onfly Insights Agent — Frontend

Crie uma aplicação web moderna de chat/relatórios que se conecta a uma API de insights de dados. A aplicação permite que gestores de viagens corporativas façam perguntas em linguagem natural e recebam relatórios com dados reais.

## Conceito

Uma interface estilo chat onde o usuário digita perguntas sobre dados de viagens corporativas (gastos, reservas, viajantes, empresas) e recebe respostas formatadas com tabelas, números e insights. Semelhante ao ChatGPT, mas especializado em análise de dados corporativos.

## Persona do usuário

- Travel Manager, CFO ou gestor financeiro de empresa brasileira
- Precisa de relatórios rápidos sem depender de time de BI
- Interface em português brasileiro

## Design e Layout

### Tela principal
- Sidebar esquerda com:
  - Logo "Onfly Insights" no topo
  - Lista de conversas anteriores (session_id como identificador)
  - Botão "Nova conversa" que chama POST /reset e limpa o chat
- Área principal de chat:
  - Mensagens do usuário alinhadas à direita com fundo azul
  - Respostas do agente alinhadas à esquerda com fundo cinza claro
  - As respostas do agente contêm markdown (tabelas, headers, bold, listas) — renderizar como HTML formatado usando uma lib como react-markdown
  - Mostrar indicador de loading "Consultando dados..." enquanto aguarda resposta (a API pode levar 10-30 segundos)
- Input fixo na parte inferior:
  - Campo de texto com placeholder "Faça uma pergunta sobre seus dados..."
  - Botão de enviar (ícone de seta)
  - Enviar com Enter, Shift+Enter para nova linha

### Tela inicial (sem mensagens)
- Título centralizado: "O que você gostaria de saber?"
- Grid de cards com sugestões de perguntas (vindas do GET /suggestions)
- Ao clicar em um card, envia a pergunta automaticamente

### Estilo visual
- Tema escuro com detalhes em azul (#0056b3) — cores da Onfly
- Fonte principal: Inter ou sistema
- Cantos arredondados nos cards e mensagens
- Responsivo (funcionar em desktop e mobile)

## API Backend

A API roda em um servidor separado. Usar variável de ambiente para a URL base:

```
VITE_API_URL=http://localhost:8080
```

### Endpoints

#### POST /ask
Envia uma pergunta e recebe a resposta.

Request:
```json
{
  "question": "Qual o GMV total por modalidade no Q1 2026?",
  "session_id": "uuid-da-sessao"
}
```

Response (200):
```json
{
  "answer": "# GMV Total por Modalidade - Q1 2026\n\n**Total Geral: R$ 771.893.710,04**\n\n| Modalidade | GMV | % do Total |\n|-----------|-----|------------|\n| Voo | R$ 435.520.330 | 56,4% |\n| Hotel | R$ 289.348.166 | 37,5% |\n| Carro | R$ 27.849.239 | 3,6% |\n| Ônibus | R$ 19.175.973 | 2,5% |\n\n**Insight:** Voo domina com 56,4% do GMV total.",
  "session_id": "uuid-da-sessao"
}
```

Response (500):
```json
{
  "detail": "mensagem de erro"
}
```

Importante: o campo `answer` contém markdown com tabelas, headers, bold, listas. Renderizar como HTML formatado.

#### POST /reset
Reseta o histórico de uma sessão.

Request query param: `?session_id=uuid-da-sessao`

Response:
```json
{
  "status": "ok"
}
```

#### GET /suggestions
Retorna sugestões de perguntas para exibir na tela inicial.

Response:
```json
{
  "suggestions": [
    "Qual o GMV total por modalidade no Q1 2026?",
    "Top 10 empresas por GMV em 2026",
    "Compare o GMV de janeiro vs fevereiro 2026",
    "Qual o take rate por consolidador?",
    "Quais empresas fizeram churn em 2026?",
    "NPS médio por tamanho de empresa",
    "Taxa de conversão de cotações para reservas por empresa",
    "Ticket médio de voo por rota nos últimos 3 meses",
    "Empresas que usam travel mas não usam expense",
    "Quantos tickets de suporte foram abertos por categoria este mês?"
  ]
}
```

#### GET /health
Health check.

Response:
```json
{
  "status": "ok"
}
```

## Funcionalidades

1. **Chat com histórico**: Manter conversa com contexto (o backend mantém o histórico por session_id). Gerar um UUID v4 como session_id ao criar nova conversa.

2. **Múltiplas conversas**: Salvar conversas no localStorage do browser. A sidebar lista as conversas com título baseado na primeira pergunta.

3. **Sugestões iniciais**: Na tela inicial sem mensagens, exibir as sugestões do GET /suggestions como cards clicáveis.

4. **Renderização de markdown**: As respostas vêm em markdown com tabelas, headers, bold, listas. Usar react-markdown com remark-gfm para renderizar tabelas corretamente. Estilizar as tabelas com bordas sutis e padding.

5. **Loading state**: Mostrar animação de "pensando" (3 pontos pulsantes) enquanto aguarda resposta. A API pode levar 10-30 segundos.

6. **Tratamento de erros**: Se a API retornar 500, exibir mensagem amigável: "Desculpe, ocorreu um erro ao consultar os dados. Tente reformular sua pergunta."

7. **Copiar resposta**: Botão de copiar (ícone clipboard) em cada resposta do agente para copiar o texto markdown.

8. **Nova conversa**: Botão na sidebar que chama POST /reset com o session_id atual e limpa o chat.

## Stack sugerida

- React + TypeScript
- Tailwind CSS
- react-markdown + remark-gfm (para renderizar tabelas markdown)
- uuid (para gerar session_id)
- localStorage para persistir conversas

## Comportamento do chat

- Ao enviar uma pergunta, adicionar imediatamente a mensagem do usuário no chat
- Mostrar loading indicator na posição da próxima mensagem
- Quando a resposta chegar, substituir o loading pela resposta renderizada
- Scroll automático para a mensagem mais recente
- Desabilitar o input enquanto aguarda resposta
