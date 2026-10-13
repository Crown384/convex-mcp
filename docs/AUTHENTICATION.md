# Better Auth, Mailjet and MCP authentication

## Private configuration

Deploy the control plane to its own nonproduction Convex deployment. It must be separate from all managed Convex projects. The local betterAuth component expands the provider schema; the root schema holds only internal transactional auth guards, keyed by a secret-derived email hash. It exposes no public application functions.

On the Next.js host set:
- AUTH_SITE_URL: exact HTTPS website origin, no path/query/fragment.
- CONVEX_AUTH_SITE_URL: exact HTTP-actions HTTPS origin of the control-plane Convex deployment (convex.site, including supported regional hostname).
- AUTH_ALLOWED_EMAILS: comma-separated exact owner emails, at most ten; empty denies all.
- Existing PAMA_ENV_STORE_URL, PAMA_ENV_MACHINE_TOKEN and read policies remain server-only.

On the control-plane Convex backend set:
- AUTH_SITE_URL and AUTH_ALLOWED_EMAILS with the same values.
- BETTER_AUTH_SECRET: independently generated random secret, at least 32 characters; keep a secure backup.
- MAILJET_API_KEY, MAILJET_SECRET_KEY and verified MAILJET_FROM_EMAIL.

Mailjet uses HTTPS Send API v3.1 and Basic authentication. OTP bodies, Mailjet errors, deploy keys and tokens are never logged by our implementation. Better Auth logging is disabled. Platform log retention is configured outside this PR.

Local development may use loopback HTTP in development only. Production rejects insecure auth/backend origins. Generated schema fixtures contain only a schema-generation placeholder; runtime authentication never uses it.

## Browser and MCP flow

1. Visit /sign-in, enter an allowed email, request a code and verify it.
2. Better Auth sets an HTTP-only session cookie. Dashboard calls require that session; they never use an owner bearer.
3. Add the hosted HTTPS /api/mcp URL to the MCP client and select OAuth.
4. The client discovers:
   - /.well-known/oauth-protected-resource/api/mcp (also root alias)
   - /.well-known/oauth-authorization-server/api/auth (also root alias)
   - /api/auth/.well-known/oauth-authorization-server
5. The OAuth provider exposes /api/auth/oauth2/register, /authorize, /token and /api/auth/jwks. Unauthenticated registration creates public clients only and does not grant access. Registration is capped atomically at five requests per minute across the backend; unknown scopes and insecure PKCE are rejected by the provider.
6. Complete email-code login, review client consent, and allow access. The signed OAuth request lasts ten minutes so the five-minute email code flow has time to finish. Authorization codes are one-use, PKCE-bound, and expire.
7. Tokens require mcp:read, the exact MCP resource, issuer, signature, expiry and a current owner/session/client/consent record. Access tokens last five minutes; refresh tokens rotate and have a maximum seven-day lifetime. Email send/verify operations share a transaction-backed per-owner lease. There are at most three sends per minute and three code attempts per challenge, independent of client IP. Resending deletes all previous sign-in challenges; a failed Mailjet delivery invalidates its challenge and returns a safe error. Delivery has a ten-second timeout. Normal completion releases its fenced lease; an interrupted action can leave that owner locked for up to 35 minutes.

MCP access ends when the authorizing six-hour browser session expires, is signed out, or consent is revoked.

The Next server fetch hop is a cors request even when the browser is navigating. The facade restores a navigation redirect only for a validated authorize response from the fixed backend, never from a caller-provided URL.

## Deployment acceptance

Run isolated tests before calling it live: verified Mailjet sender delivers a real code; invalid/expired/replayed OTP fails; hosted web session works; real MCP client discovery/login/consent succeeds; all nine read tools connect to disposable authorized Convex projects; wrong issuer/audience/scope, logout and consent revocation deny immediately.

No production credentials are needed for repository tests. Do not infer real deployment, mail delivery, or ChatGPT account setup from fixture tests. The existing main-only Vercel policy remains; provision any isolated staging host separately.

## Migration and rollback

The prior MCP_ACCESS_TOKEN is ignored by owner/MCP routes. Existing clients must reconnect through OAuth. No managed app data or vault secret is migrated. On staging, revert the PR squash commit to restore the prior milestone; remember this intentionally restores the old bearer code and requires its server token to be configured. Auth component records can remain inert during rollback; do not delete live user records without an explicit migration.

For immediate access shutdown, remove the owner email from both allowlists, revoke consent, or remove server access to the PamaENV machine client. Rotate BETTER_AUTH_SECRET privately if compromised; rotating it invalidates sessions and may require reauthorization. Rotate/revoke PamaENV credentials separately.

## Scope

This PR implements authentication and transport. Project-specific grants, full operation audit/rate limiting, write approvals, production rollout, and live upstream acceptance remain separate work. Every owner allowlisted here can inspect the machine client's delegated projects; do not treat adding an email as a narrow project invitation.
