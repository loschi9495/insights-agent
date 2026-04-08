import rateLimit from "express-rate-limit";
import { config } from "../config.js";

export const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.email || req.ip || "anonymous",
  message: { error: "Muitas requisições. Tente novamente em breve.", code: "RATE_LIMITED" },
});

export const authLimiter = rateLimit({
  windowMs: 60000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Aguarde 1 minuto.", code: "AUTH_RATE_LIMITED" },
});

export const streamLimiter = rateLimit({
  windowMs: 60000,
  max: 10,
  keyGenerator: (req) => (req as any).user?.email || req.ip || "anonymous",
  message: { error: "Muitas requisições de streaming. Aguarde.", code: "STREAM_RATE_LIMITED" },
});
