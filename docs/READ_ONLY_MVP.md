# Read-only personal-use MCP MVP

Authentication has moved to Better Auth email codes and OAuth; see [AUTHENTICATION.md](AUTHENTICATION.md).

This milestone uses the PamaENV machine API as the project registry and secret vault. It introduces no additional managed-project secret store. The authentication milestone now requires its own Convex control-plane backend. A registered PamaENV project must contain variables named CONVEX_URL and CONVEX_DEPLOY_KEY for the appropriate staging or production scope. Shared variables are included by PamaENV's existing machine lookup resolution. The MCP service requests exactly those two keys for a project/environment and never returns either.

## Server setup

In PamaENV create a separate machine client authorized only for required projects/environments. Revoke it there to stop access at the vault. Configure PAMA_ENV_STORE_URL as the exact HTTPS origin of PamaENV and PAMA_ENV_MACHINE_TOKEN as this client's pes_ token on the Convex MCP server. Configure Better Auth/Mailjet and exact owner emails as described in AUTHENTICATION.md. The former MCP_ACCESS_TOKEN is ignored. Store these in private Vercel server variables or equivalent secret manager, never in NEXT_PUBLIC_* or Git history. Run a fresh server deployment for rotations. No secret should be pasted into an AI prompt.

Staging can use a dev deployment key or a production deploy key for a physically separate Convex staging project. Regional Convex hosts (such as name.eu-west-1.convex.cloud) are recognized. Production requires a prod: deploy key targeting the exact Convex hostname. The hostname on CONVEX_URL must match the deployment name embedded in the key, and the URL must be HTTPS on the convex.cloud domain. Self-hosted Convex is intentionally not supported in this milestone. Only the configured, fixed PamaENV origin is contacted for credentials. Unsupported permissions and upstream errors return safe codes.

By default production connection checks are denied. Set MCP_ENABLE_PRODUCTION_READS=true to enable the safe production status tool, NOT writes or PII tools. The staging environment_names_list tool returns names only; no environment values ever leave the server.

## Dashboard

Sign in at /sign-in with your email code, then open /dashboard. Authentication uses an HTTP-only Better Auth session cookie. Sign out to end the session, or revoke a client connection. Deploy keys and the PamaENV machine token remain server-only.

## Remote MCP

Endpoint: https://YOUR_HOST/api/mcp. Authenticate through Better Auth OAuth with mcp:read and the exact endpoint resource. The official SDK handles stateless JSON Streamable HTTP, initialization, notifications, tool schemas and calls. GET is authenticated and has no long-lived server stream. See AUTHENTICATION.md for discovery and authorization URLs.

Available tools: projects_list, deployments_list, deployment_status, environment_names_list, tables_list, functions_list, usage_limits_list, documents_list, logs_recent. Metadata tools return only bounded metadata. The separate optional `documents_list` tool reads strictly allowlisted staging document scalar values; none of these tools exposes environment secret values or invokes application mutations. No arbitrary queries, run, deletes, mutations, environment values or unmanaged hosts.

Use your MCP client's OAuth flow to initialize and discover tools; do not paste a session token or deployment credential into a command or chat.

Deployment status requires PamaENV access plus a documented Convex Deployment API endpoint /api/v1/deployment_info. Environment names uses /api/v1/list_environment_variables and strips values before returning. Both calls are read-only; production env name reads are always blocked.

## Limits and security

Owner-only email-code sessions and OAuth are implemented. Full per-client project grants and a persistent MCP operation audit remain future work; PamaENV audits machine retrievals. Guarded function execution, write approvals and broad metrics remain outside this read-only milestone.

Before live claims, validate the real deployed PamaENV machine API, real separately scoped staging key, Next runtime, and a real remote MCP client. No real staging/production Convex access is exercised in unit tests. The current Vercel rules build from main only; merging into staging does not deploy the app.

## QA and rollback

Execute corepack pnpm install --frozen-lockfile, pnpm lint, pnpm typecheck, pnpm test, pnpm build in Daytona. No real deployment keys needed for build, and absent configuration must fail closed. To roll back, revert the merged staging commit (do not change main). To revoke access immediately, revoke the PamaENV machine client and sign out/revoke OAuth consent and rotate any compromised Better Auth secret privately.

## Optional staging-only paginated data reads

`documents_list` is **disabled by default**. It cannot access production document values, including when `MCP_ENABLE_PRODUCTION_READS=true`. Add a private **server-only** `MCP_DOCUMENT_READ_POLICY` JSON string of shape `{"sample":{"orders":["status","total"]}}` after reviewing fields. The exact project slug and exact table name must be listed, and **only** the named top-level fields will be returned. Allowlisted values must be top-level scalars (string, number, boolean or null); arrays and nested objects fail closed. No wildcard, recursive object projection or implicit access to document IDs. Maximum 20 rows per call and 24,000 characters per MCP result; cursor pagination is supported.

**Security warning:** Convex deployment admin keys may bypass application RBAC, data-owner visibility and tenant isolation; the operator is responsible for explicitly choosing non-sensitive fields. This is a staging diagnostic aid, not a substitute for each application's authorized business functions. Production customer records and direct writes remain blocked. Revoking the PamaENV machine token blocks new requests; changing the document policy requires a server configuration rollout. Neither current tests nor the UI verify this against a live deployment.

## Safe staging execution diagnostics

`logs_recent` retrieves a bounded recent chunk via the Convex CLI's read-only log endpoint, exposes just function identifier/type, completion/progress, failure flag and timestamp, and supports `all|success|failure` filtering and cursors. It **does not** expose actual console messages, exception bodies, stack traces, function parameters or result values: those may contain secrets and personally identifiable information. Production logs are always blocked, even when production metadata reads are enabled. Real live log endpoint capability still requires a disposable deployment test.
