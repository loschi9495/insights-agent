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

  port: parseInt(process.env.PORT || "8080"),
};
