# Pama Convex MCP

A personal Convex dashboard and remote MCP server. Sign in with an email code delivered by Mailjet, then authorize an MCP client through Better Auth OAuth. PamaENV holds managed-project deploy keys; they never reach the browser or MCP response.

**Current milestone: owner-only email-code authentication and read-only MCP implemented for staging. Hosting, real Mailjet delivery, live PamaENV/Convex access, and attachment to a real ChatGPT account still require deployment acceptance.**

## Authentication

Only exact emails in the private AUTH_ALLOWED_EMAILS allowlist may sign in. There is no password login. Codes are hashed, expire in five minutes and permit three incorrect attempts. Better Auth stores sessions and OAuth records in a local Convex component. Browser sessions last six hours.

MCP clients use OAuth authorization code + S256 PKCE and explicit consent. Each request requires a signed, unexpired token for the exact /api/mcp audience and mcp:read scope. The backend checks the owner allowlist, active session, client state and current consent on every request. Logout or revoking consent blocks the connection. The old MCP_ACCESS_TOKEN is no longer accepted.

The remote endpoint uses the official MCP SDK's stateless Streamable HTTP transport. See [authentication setup](docs/AUTHENTICATION.md) for configuration, discovery URLs, rollout and recovery.

## Available tools

projects_list, deployments_list, deployment_status, environment_names_list, tables_list, functions_list, usage_limits_list, documents_list, logs_recent.

Document reads require an explicit staging project/table/scalar-field policy and are disabled by default. Logs expose execution metadata only. No mutation/function-execution tools exist. Production reads require separate server opt-in; production document values, logs and environment names remain blocked.

## Development and checks

Use Node 20.9+ and the pinned pnpm 10.18.3 through Corepack.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm exec playwright test
```

Auth tests exercise real Better Auth handlers, the real local Convex component adapter in convex-test, and the official MCP client/transport. Browser fixtures use only fake identities and a local auth backend; they do not send real Mailjet mail or attach a real ChatGPT account.

## Release

Feature PRs target staging. The Vercel Git guards still permit main only; merging staging does not deploy a site or backend. This auth milestone requires a separately deployed control-plane Convex component. No automatic Convex deployment runs during a Next build.

Read [PROJECT_SPEC.md](PROJECT_SPEC.md), [AGENTS.md](AGENTS.md), [read-only integration](docs/READ_ONLY_MVP.md), and [architecture](docs/ARCHITECTURE.md).
