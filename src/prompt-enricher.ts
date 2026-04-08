const ABBREVIATIONS: [RegExp, string][] = [
  [/\bCC\b/g, "centro de custo"],
  [/\bTM\b/g, "ticket médio"],
  [/\bYoY\b/g, "comparação ano a ano"],
  [/\bMoM\b/g, "comparação mês a mês"],
  [/\bQoQ\b/g, "comparação trimestre a trimestre"],
];

const MONTH_PATTERNS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
  "Q1", "Q2", "Q3", "Q4", "trimestre", "semestre",
  "semana", "mês", "mes", "ano", "hoje", "ontem",
  "último", "ultima", "passado", "passada", "atual", "corrente",
  "2024", "2025", "2026",
];

function hasTimeReference(text: string): boolean {
  const lower = text.toLowerCase();
  return MONTH_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function expandAbbreviations(text: string): string {
  for (const [pattern, replacement] of ABBREVIATIONS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function enrichQuestion(question: string): string {
  question = expandAbbreviations(question);
  if (!hasTimeReference(question)) {
    const today = new Date();
    const formatted = today.toLocaleDateString("pt-BR");
    question += ` (Sem período especificado. Hoje é ${formatted})`;
  }
  return question;
}

export interface UserInfo {
  email: string;
  name: string;
  picture: string;
}

export function buildUserContext(user: UserInfo | null): string {
  if (!user) return "Usuário não identificado (acesso via CLI).";
  const parts: string[] = [];
  if (user.name) parts.push(`Nome: ${user.name}`);
  if (user.email) {
    parts.push(`Email: ${user.email}`);
    const domain = user.email.split("@")[1];
    if (domain) parts.push(`Domínio: ${domain}`);
  }
  return parts.length ? parts.join("\n") : "Usuário autenticado.";
}
