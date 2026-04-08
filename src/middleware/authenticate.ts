import { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { verifyToken } from "./jwt.js";
import type { UserInfo } from "../prompt-enricher.js";

const DEV_USER: UserInfo = { email: "dev@localhost", name: "Dev Local", picture: "" };

declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (config.authBypass) {
    req.user = DEV_USER;
    next();
    return;
  }

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token não fornecido", code: "MISSING_TOKEN" });
    return;
  }

  try {
    const payload = verifyToken(auth.slice(7), "access");
    req.user = { email: payload.email, name: payload.name, picture: payload.picture };
    next();
  } catch (e) {
    const message = (e as Error).message;
    if (message.includes("expired")) {
      res.status(401).json({ error: "Token expirado", code: "TOKEN_EXPIRED" });
    } else {
      res.status(401).json({ error: "Token inválido", code: "INVALID_TOKEN" });
    }
  }
}
