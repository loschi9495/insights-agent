from datetime import date, timedelta

TEMPLATES = [
    {
        "id": "weekly_summary",
        "name": "Resumo Semanal",
        "description": "GMV, tickets de suporte, NPS e churn da última semana vs anterior",
        "icon": "calendar",
        "category": "recorrente",
        "prompt": "Faça um resumo completo da última semana ({start} a {end}): "
                  "1) GMV total e por modalidade, "
                  "2) Quantidade de reservas emitidas, "
                  "3) Tickets de suporte abertos, "
                  "4) Empresas que fizeram churn. "
                  "Compare com a semana anterior.",
    },
    {
        "id": "client_health",
        "name": "Health Check do Cliente",
        "description": "GMV, NPS, tickets e engajamento de uma empresa específica",
        "icon": "heart-pulse",
        "category": "cliente",
        "prompt": "Faça um health check completo da empresa {company}: "
                  "1) GMV dos últimos 3 meses (mês a mês), "
                  "2) NPS mais recente, "
                  "3) Tickets de suporte abertos, "
                  "4) Status de engajamento (travel, expense, blue). "
                  "Indique se há sinais de risco de churn.",
        "variables": [
            {"name": "company", "label": "Nome da empresa", "type": "text", "placeholder": "Ex: Hotmart Colombia"}
        ],
    },
    {
        "id": "cs_pipeline",
        "name": "Pipeline de Risco CS",
        "description": "Empresas com GMV caindo, NPS baixo ou sem uso recente",
        "icon": "alert-triangle",
        "category": "cs",
        "prompt": "Identifique empresas em risco: "
                  "1) GMV caindo há 2 meses consecutivos, "
                  "2) NPS abaixo de 7, "
                  "3) Sem uso da plataforma nos últimos 30 dias. "
                  "Organize por nível de risco (alto, médio, baixo). "
                  "Gere uma planilha com todas as empresas em risco.",
    },
    {
        "id": "monthly_executive",
        "name": "Relatório Executivo Mensal",
        "description": "Visão C-level: GMV, receita, take rate, crescimento e churn",
        "icon": "briefcase",
        "category": "recorrente",
        "prompt": "Gere um relatório executivo do mês {month}: "
                  "1) GMV total e por modalidade, "
                  "2) Receita e take rate, "
                  "3) Quantidade de empresas ativas, "
                  "4) Novos clientes vs churn, "
                  "5) Top 5 empresas por GMV, "
                  "6) Comparação com o mês anterior (variação %). "
                  "Gere também uma planilha com o detalhamento.",
        "variables": [
            {"name": "month", "label": "Mês", "type": "text", "placeholder": "Ex: março 2026"}
        ],
    },
    {
        "id": "route_analysis",
        "name": "Análise de Rotas Aéreas",
        "description": "Rotas mais frequentes, ticket médio e antecedência de compra",
        "icon": "plane",
        "category": "produto",
        "prompt": "Analise as rotas aéreas dos últimos 3 meses: "
                  "1) Top 10 rotas por volume de passagens, "
                  "2) Ticket médio por rota, "
                  "3) Antecedência média de compra, "
                  "4) Rotas com maior e menor ticket médio. "
                  "Compare com o trimestre anterior se possível.",
    },
    {
        "id": "consolidator_performance",
        "name": "Performance de Consolidadores",
        "description": "Take rate, GMV e volume por consolidador",
        "icon": "bar-chart-3",
        "category": "operacional",
        "prompt": "Analise a performance dos consolidadores nos últimos 3 meses: "
                  "1) GMV por consolidador, "
                  "2) Take rate por consolidador, "
                  "3) Volume de transações, "
                  "4) Evolução mensal. "
                  "Identifique oportunidades de melhoria.",
    },
    {
        "id": "product_adoption",
        "name": "Adoção de Produtos",
        "description": "Empresas por produto usado (travel, expense, blue) e cross-sell",
        "icon": "layers",
        "category": "produto",
        "prompt": "Analise a adoção de produtos: "
                  "1) Quantas empresas usam travel, expense e blue, "
                  "2) Empresas que usam travel mas não usam expense (oportunidade de cross-sell), "
                  "3) Empresas que usam expense mas não usam blue, "
                  "4) Taxa de adoção por tamanho de empresa. "
                  "Foque nos últimos 2 meses.",
    },
    {
        "id": "nps_deep_dive",
        "name": "Análise de NPS",
        "description": "NPS por segmento, tamanho de empresa e motivos das notas",
        "icon": "star",
        "category": "produto",
        "prompt": "Faça uma análise profunda do NPS: "
                  "1) NPS geral e por tamanho de empresa, "
                  "2) Distribuição das notas (promotores, neutros, detratores), "
                  "3) Principais motivos das notas baixas e altas, "
                  "4) Evolução do NPS nos últimos 6 meses. "
                  "Destaque insights acionáveis.",
    },
]


def get_templates() -> list[dict]:
    return TEMPLATES


def render_template(template_id: str, variables: dict | None = None) -> str | None:
    """Renderiza um template substituindo variáveis."""
    template = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not template:
        return None

    prompt = template["prompt"]
    today = date.today()

    # Substituições automáticas de data
    prompt = prompt.replace("{start}", (today - timedelta(days=7)).strftime("%d/%m/%Y"))
    prompt = prompt.replace("{end}", today.strftime("%d/%m/%Y"))

    # Substituições de variáveis do usuário
    if variables:
        for key, value in variables.items():
            prompt = prompt.replace(f"{{{key}}}", value)

    return prompt
