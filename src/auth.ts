import { Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "./config.js";
import type { UserInfo } from "./prompt-enricher.js";

const DEV_USER: UserInfo = { email: "dev@localhost", name: "Dev Local", picture: "" };

const oauthClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (config.authBypass) {
    (req as any).user = DEV_USER;
    next();
    return;
  }

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Token não fornecido" });
    return;
  }

  const token = auth.slice(7);

  try {
    if (!oauthClient) {
      res.status(500).json({ detail: "GOOGLE_CLIENT_ID não configurado" });
      return;
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
      res.status(401).json({ detail: "Email não verificado" });
      return;
    }

    const email = payload.email || "";
    if (config.allowedEmailDomain && !email.endsWith(`@${config.allowedEmailDomain}`)) {
      res.status(403).json({ detail: `Acesso restrito a emails @${config.allowedEmailDomain}` });
      return;
    }

    (req as any).user = {
      email,
      name: payload.name || "",
      picture: payload.picture || "",
    };
    next();
  } catch {
    res.status(401).json({ detail: "Token inválido ou expirado" });
  }
}

export async function verifyGoogleToken(credential: string): Promise<UserInfo> {
  if (config.authBypass) return DEV_USER;

  if (!oauthClient) throw new Error("GOOGLE_CLIENT_ID não configurado");

  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience: config.googleClientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.email_verified) throw new Error("Email não verificado");

  const email = payload.email || "";
  if (config.allowedEmailDomain && !email.endsWith(`@${config.allowedEmailDomain}`)) {
    throw new Error(`Acesso restrito a emails @${config.allowedEmailDomain}`);
  }

  return { email, name: payload.name || "", picture: payload.picture || "" };
}
