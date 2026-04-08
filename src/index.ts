import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { authMiddleware, verifyGoogleToken } from "./auth.js";
import { InsightsAgent } from "./agent.js";
import { StreamingInsightsAgent } from "./agent-stream.js";
import { getExportPath, cleanupOldExports } from "./exporter.js";
import { getTemplates, renderTemplate } from "./templates.js";
import type { UserInfo } from "./prompt-enricher.js";

const app = express();
app.use(cors());
app.use(express.json());

const sessions = new Map<string, InsightsAgent>();
const streamSessions = new Map<string, StreamingInsightsAgent>();

function getUser(req: express.Request): UserInfo {
  return (req as any).user;
}

function extractFollowUps(answer: string): { answer: string; followUps: string[] } {
  const markers = ["**Próximas perguntas:**", "**Próximas perguntas**:", "**Perguntas sugeridas:**"];
  for (const marker of markers) {
    if (answer.includes(marker)) {
      const [main, rest] = answer.split(marker, 2);
      const clean = main.trimEnd().replace(/---\s*$/, "").trimEnd();
      const followUps = rest
        .split("\n")
        .map((l) => l.trim().replace(/^[-*]\s*/, "").trim())
        .filter((l) => l && !l.startsWith("---"))
        .slice(0, 5);
      return { answer: clean, followUps };
    }
  }
  return { answer, followUps: [] };
}

// --- Auth ---

app.get("/auth/bypass-status", (_req, res) => {
  res.json({ bypass: config.authBypass });
});

app.post("/auth/google", async (req, res) => {
  try {
    const user = await verifyGoogleToken(req.body.credential);
    res.json(user);
  } catch (e) {
    res.status(401).json({ detail: (e as Error).message });
  }
});

// --- Protected routes ---

app.post("/ask", authMiddleware, async (req, res) => {
  const { question, session_id = "default" } = req.body;
  const user = getUser(req);

  if (!sessions.has(session_id)) {
    const agent = new InsightsAgent(user);
    await agent.init();
    sessions.set(session_id, agent);
  }

  try {
    const rawAnswer = await sessions.get(session_id)!.ask(question);
    const { answer, followUps } = extractFollowUps(rawAnswer);
    res.json({ answer, session_id, follow_ups: followUps });
  } catch (e) {
    res.status(500).json({ detail: (e as Error).message });
  }
});

app.post("/ask/stream", authMiddleware, async (req, res) => {
  const { question, session_id = "default" } = req.body;
  const user = getUser(req);

  if (!streamSessions.has(session_id)) {
    streamSessions.set(session_id, new StreamingInsightsAgent(user));
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    for await (const event of streamSessions.get(session_id)!.askStream(question)) {
      res.write(event);
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: "error", content: (e as Error).message })}\n\n`);
  }
  res.end();
});

app.post("/reset", authMiddleware, (req, res) => {
  const sessionId = req.query.session_id as string || "default";
  sessions.get(sessionId)?.reset();
  streamSessions.get(sessionId)?.reset();
  res.json({ status: "ok" });
});

app.get("/suggestions", authMiddleware, (_req, res) => {
  res.json({
    suggestions: [
      "Qual o GMV total por modalidade no Q1 2026?",
      "Top 10 empresas por GMV em 2026",
      "Compare o GMV de janeiro vs fevereiro 2026",
      "Qual o take rate por consolidador?",
      "Quais empresas fizeram churn em 2026?",
      "NPS médio por tamanho de empresa",
      "Taxa de conversão de cotações para reservas por empresa",
      "Ticket médio de voo por rota nos últimos 3 meses",
      "Empresas que usam travel mas não usam expense",
      "Quantos tickets de suporte foram abertos por categoria este mês?",
    ],
  });
});

app.get("/templates", authMiddleware, (_req, res) => {
  res.json({ templates: getTemplates() });
});

app.post("/templates/render", authMiddleware, (req, res) => {
  const { template_id, variables } = req.body;
  const prompt = renderTemplate(template_id, variables);
  if (!prompt) {
    res.status(404).json({ detail: "Template não encontrado" });
    return;
  }
  res.json({ prompt });
});

app.get("/download/:fileId", authMiddleware, (req, res) => {
  const filepath = getExportPath(req.params.fileId as string);
  if (!filepath) {
    res.status(404).json({ detail: "Arquivo não encontrado ou expirado." });
    return;
  }
  res.download(filepath);
});

app.get("/health", (_req, res) => {
  cleanupOldExports();
  res.json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`Insights Agent running on http://localhost:${config.port}`);
});
