import { OAuth2Client } from "google-auth-library";
import { config } from "./config.js";
import { generateAccessToken, generateRefreshToken, verifyToken } from "./middleware/jwt.js";
import type { UserInfo } from "./prompt-enricher.js";

const DEV_USER: UserInfo = { email: "dev@localhost", name: "Dev Local", picture: "" };

const oauthClient = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: string;
  user: UserInfo;
}

export async function loginWithGoogle(credential: string): Promise<AuthTokens> {
  if (config.authBypass) {
    return {
      access_token: generateAccessToken(DEV_USER),
      refresh_token: generateRefreshToken(DEV_USER),
      expires_in: config.jwtExpiresIn,
      user: DEV_USER,
    };
  }

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

  const user: UserInfo = {
    email,
    name: payload.name || "",
    picture: payload.picture || "",
  };

  return {
    access_token: generateAccessToken(user),
    refresh_token: generateRefreshToken(user),
    expires_in: config.jwtExpiresIn,
    user,
  };
}

export function refreshAccessToken(refreshToken: string): { access_token: string; expires_in: string } {
  const payload = verifyToken(refreshToken, "refresh");
  const user: UserInfo = { email: payload.email, name: payload.name, picture: payload.picture };
  return {
    access_token: generateAccessToken(user),
    expires_in: config.jwtExpiresIn,
  };
}
