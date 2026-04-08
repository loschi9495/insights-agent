import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config.js";
import { loginWithGoogle, refreshAccessToken } from "./auth.js";
import { authenticate } from "./middleware/authenticate.js";
import { apiLimiter, authLimiter, streamLimiter } from "./middleware/rate-limit.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { InsightsAgent } from "./agent.js";
import { StreamingInsightsAgent } from "./agent-stream.js";
import { getExportPath, cleanupOldExports } from "./exporter.js";
import { getTemplates, renderTemplate } from "./templates.js";

const app = express();

// --- Global middleware ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// --- Session stores ---
const sessions = new Map<string, InsightsAgent>();
const streamSessions = new Map<string, StreamingInsightsAgent>();

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

// ==========================================
//  AUTH ROUTES (public)
// ==========================================

app.get("/auth/bypass-status", (_req, res) => {
  res.json({ bypass: config.authBypass });
});

app.post("/auth/google", authLimiter, async (req, res) => {
  try {
    const tokens = await loginWithGoogle(req.body.credential);
    res.json(tokens);
  } catch (e) {
    res.status(401).json({ error: (e as Error).message, code: "AUTH_FAILED" });
  }
});

app.post("/auth/refresh", authLimiter, (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      res.status(400).json({ error: "refresh_token obrigatório", code: "MISSING_REFRESH_TOKEN" });
      return;
    }
    const tokens = refreshAccessToken(refresh_token);
    res.json(tokens);
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("expired")) {
      res.status(401).json({ error: "Refresh token expirado. Faça login novamente.", code: "REFRESH_EXPIRED" });
    } else {
      res.status(401).json({ error: "Refresh token inválido", code: "INVALID_REFRESH" });
    }
  }
});

app.get("/auth/me", authenticate, (req, res) => {
  res.json(req.user);
});

// ==========================================
//  PROTECTED ROUTES
// ==========================================

app.post("/ask", authenticate, apiLimiter, async (req, res) => {
  const { question, session_id = "default" } = req.body;

  if (!sessions.has(session_id)) {
    const agent = new InsightsAgent(req.user!);
    await agent.init();
    sessions.set(session_id, agent);
  }

  try {
    const rawAnswer = await sessions.get(session_id)!.ask(question);
    const { answer, followUps } = extractFollowUps(rawAnswer);
    res.json({ answer, session_id, follow_ups: followUps });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message, code: "AGENT_ERROR" });
  }
});

app.post("/ask/stream", authenticate, streamLimiter, async (req, res) => {
  const { question, session_id = "default" } = req.body;

  if (!streamSessions.has(session_id)) {
    streamSessions.set(session_id, new StreamingInsightsAgent(req.user!));
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

app.post("/reset", authenticate, (req, res) => {
  const sessionId = (req.query.session_id as string) || "default";
  sessions.get(sessionId)?.reset();
  streamSessions.get(sessionId)?.reset();
  res.json({ status: "ok" });
});

app.get("/suggestions", authenticate, (_req, res) => {
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

app.get("/templates", authenticate, (_req, res) => {
  res.json({ templates: getTemplates() });
});

app.post("/templates/render", authenticate, (req, res) => {
  const { template_id, variables } = req.body;
  const prompt = renderTemplate(template_id, variables);
  if (!prompt) {
    res.status(404).json({ error: "Template não encontrado", code: "NOT_FOUND" });
    return;
  }
  res.json({ prompt });
});

app.get("/download/:fileId", authenticate, (req, res) => {
  const filepath = getExportPath(req.params.fileId as string);
  if (!filepath) {
    res.status(404).json({ error: "Arquivo não encontrado ou expirado.", code: "NOT_FOUND" });
    return;
  }
  res.download(filepath);
});

// ==========================================
//  PUBLIC ROUTES
// ==========================================

app.get("/health", (_req, res) => {
  cleanupOldExports();
  res.json({ status: "ok" });
});

// --- Error handler (must be last) ---
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Insights Agent running on http://localhost:${config.port}`);
});
