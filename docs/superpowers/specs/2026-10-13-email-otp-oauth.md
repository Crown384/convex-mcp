# Email code login and MCP OAuth
Owner request: Better Auth, email OTP through Mailjet, ChatGPT MCP authorization, QA loop and staging merge at 5/5.
The owner-only default uses a private exact email allowlist. There is no password login or public control-plane access.
Better Auth 1.6.15 and its matching OAuth provider are pinned to the supported Convex adapter 0.12.5. A local Convex component persists the provider's expanded OAuth schema. Better Auth runs in Convex HTTP actions with the component adapter; the web does not need Convex websocket sessions.
The browser uses an HTTP-only session cookie through a same-origin auth proxy. OAuth code flow requires S256 PKCE and explicit consent; discovery advertises the exact MCP resource and read scope.
MCP tokens are signature-, issuer-, audience-, expiry-, scope-, actor-, client-, session- and consent-checked by the trusted backend on every request. Logout, removing the owner allowlist entry or revoking consent blocks subsequent access. No bootstrap bearer fallback.
An official stateless MCP SDK transport replaces production JSON-RPC handling. Existing read tools and PamaENV secret boundaries remain.
Mailjet credentials live only on Convex. OTPs expire after five minutes, allow three wrong guesses and are hashed in storage. Missing configuration fails closed.
Staging acceptance: actual Better Auth email-code and OAuth handlers, real Convex component adapter in convex-test, official MCP client/transport, invalid authorization and replay cases, UI tests, lint/types/build. Live Mailjet delivery, hosted Convex and ChatGPT account attachment remain distinct deployment acceptance; do not claim them from test fixtures.
