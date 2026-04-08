import "dotenv/config";

export const config = {
  gcpProjectId: process.env.GCP_PROJECT_ID || "dw-onfly-prd",
  bigqueryLocation: process.env.BIGQUERY_LOCATION || "us-central1",
  bigqueryMaxBytes: parseInt(process.env.BIGQUERY_MAX_BYTES_BILLED || String(10 * 1024 ** 3)),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
  claudeMaxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || "4096"),

  maxQueryRows: 500,
  blockedSqlKeywords: ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE", "MERGE"],

  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || "",
  authBypass: process.env.AUTH_BYPASS?.toLowerCase() === "true",

  jwtSecret: process.env.JWT_SECRET || "onfly-insights-dev-secret-change-in-prod",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",

  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "30"),

  port: parseInt(process.env.PORT || "8080"),
};
