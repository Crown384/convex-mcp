# Pama Convex MCP

A personal-use, mobile-friendly **read-only Convex control plane**, with Next.js dashboard and an authenticated HTTP MCP endpoint. The server uses **PamaENV** to discover explicitly delegated projects and resolve deployment-scoped Convex credentials server-to-server. No deploy keys are returned to browsers or MCP clients.

**Current status: read-only MVP implemented, not remotely deployed or connected to live credentials.** There is no OAuth authorization server, public user login, generic database document inspector, production mutation endpoint, or completed Pamastore business workflow. The owner dashboard uses a single server-configured personal bearer token, held only in the tab's memory. Do not confuse passing local checks with real upstream integration or ChatGPT compatibility.

Read [PROJECT_SPEC.md](./PROJECT_SPEC.md) and [AGENTS.md](./AGENTS.md) for the complete product specification and engineering rules. [Read-only setup and security limitations](./docs/READ_ONLY_MVP.md) is the operational manual for this milestone.

## Setup

Requires Node.js 20.9+ and pnpm 10 (pinned in `package.json`).

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev:frontend
```

Set these **server-only** variables before connecting real projects:

- `MCP_ACCESS_TOKEN`: unique random bearer token (minimum 32 characters) for owner dashboard and trusted MCP clients.
- `PAMA_ENV_STORE_URL`: exact HTTPS origin of the deployed PamaENV Store.
- `PAMA_ENV_MACHINE_TOKEN`: separate `pes_` machine token from PamaENV, explicitly allowed to access only the selected projects/environments.
- `MCP_ENABLE_PRODUCTION_READS`: defaults to `false`; must be exactly `true` to allow production deployment-status checks. No write tools exist.

See [`.env.example`](./.env.example) and the [step-by-step integration guide](./docs/READ_ONLY_MVP.md). Keep tokens and deploy keys out of Git, chat prompts, URLs, and `NEXT_PUBLIC_*` variables. PamaENV must hold `CONVEX_URL` and `CONVEX_DEPLOY_KEY` for each delegated deployment environment. The server looks up those values on each operation; revoking its machine client blocks subsequent lookups. **Do not enter Convex deploy keys into the dashboard.**

Visit `/dashboard` for owner project discovery and status checks. The remote tool endpoint is `POST /api/mcp`, with `Authorization: Bearer <MCP_ACCESS_TOKEN>` and `Content-Type: application/json`. This is a **stateless JSON-RPC subset of Streamable HTTP**, not a full OAuth-based MCP implementation; clients requiring OAuth discovery are not yet supported. Available tools include `projects_list`, `deployments_list`, `deployment_status`, staging-only `environment_names_list`, `tables_list`, `functions_list`, and `usage_limits_list`. New tools expose bounded metadata only; no app functions are executed.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Tests use fake upstream responses; they do not verify live Convex or PamaENV connections. Validate against a **disposable authorized staging deployment** before considering live credentials ready. There is no automatic Convex backend deployment, and running `pnpm dev:backend` is not necessary for this read-only Next.js integration.

## Release boundaries

- Feature branches merge by reviewed PR into `staging`; releases into `main` require separate owner authorization.
- Only `main` is eligible for Vercel Git builds; merging into `staging` does not deploy a website. See [release guard](./scripts/vercel-ignore-build.cjs).
- `pnpm build` never executes `convex deploy`.
- No production writes, arbitrary function execution, secret revelation, DB mutation, schema changes, shell access, or unsupervised management operations are exposed.
- Future work: OAuth with real MCP clients, broader read-only tools, per-client policy, audit, approvals for specific business actions, and E2E deployment testing.

See [architecture](./docs/ARCHITECTURE.md) and [roadmap](./docs/IMPLEMENTATION_PLAN.md). To roll back this milestone on staging, revert its merge commit; to revoke access, revoke the PamaENV machine token and rotate the owner token at the server.
