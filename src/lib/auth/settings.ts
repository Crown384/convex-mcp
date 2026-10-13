export class AuthFailure extends Error { constructor(public code = "UNAUTHORIZED") { super(code); } }
export function siteOrigin(): string {
  const input = process.env.AUTH_SITE_URL;
  if (!input) throw new AuthFailure("AUTH_NOT_CONFIGURED");
  const url = new URL(input);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && process.env.NODE_ENV !== "production";
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/")
    throw new AuthFailure("AUTH_NOT_CONFIGURED");
  return url.origin;
}
export function ownerEmail(email: unknown): boolean {
  if (typeof email !== "string" || email.length > 254) return false;
  const allowed = (process.env.AUTH_ALLOWED_EMAILS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.length > 0 && allowed.length <= 10 && allowed.includes(email.trim().toLowerCase());
}
export function authIssuer() { return siteOrigin() + "/api/auth"; }
export function mcpResource() { return siteOrigin() + "/api/mcp"; }
export const MCP_SCOPE = "mcp:read";
export const AUTH_ENDPOINTS = new Set(["get-session", "sign-out", "sign-in/email-otp", "email-otp/send-verification-otp",
  "oauth2/authorize", "oauth2/consent", "oauth2/token", "oauth2/register", "oauth2/public-client",
  "oauth2/get-consents", "oauth2/delete-consent", "jwks", ".well-known/oauth-authorization-server", ".well-known/openid-configuration"]);
