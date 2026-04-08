import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { UserInfo } from "../prompt-enricher.js";

export interface TokenPayload {
  email: string;
  name: string;
  picture: string;
  type: "access" | "refresh";
}

export function generateAccessToken(user: UserInfo): string {
  return jwt.sign(
    { email: user.email, name: user.name, picture: user.picture, type: "access" },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );
}

export function generateRefreshToken(user: UserInfo): string {
  return jwt.sign(
    { email: user.email, name: user.name, picture: user.picture, type: "refresh" },
    config.jwtSecret,
    { expiresIn: config.refreshTokenExpiresIn } as jwt.SignOptions,
  );
}

export function verifyToken(token: string, expectedType: "access" | "refresh" = "access"): TokenPayload {
  const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  if (payload.type !== expectedType) {
    throw new Error(`Token type mismatch: expected ${expectedType}, got ${payload.type}`);
  }
  return payload;
}
