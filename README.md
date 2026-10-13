# Pama Convex MCP

A **planned security-first, remotely connectable Convex control plane** with a phone-friendly Next.js dashboard, a separate Convex metadata database, and (in a future phase) a scoped OAuth-authenticated MCP server.

**Current status: Phase 0 foundation.** The landing page is informational. There is no login, project connection, credential vault, management tool, production operation, or MCP endpoint yet. Do not treat a healthy Next.js page or `/api/health` as proof that other Convex deployments are connected.

Read [PROJECT_SPEC.md](./PROJECT_SPEC.md) for the full product and acceptance criteria; read [AGENTS.md](./AGENTS.md) before contributing.

## Running the foundation

Requires Node.js 20.9+ and pnpm 10 (pin in `package.json`). Use Corepack where available.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev:frontend
```

Open http://localhost:3000. Phase 0's frontend intentionally works **without deploy keys or a Convex connection**.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm dev:backend` is **not** needed for this phase; it starts Convex's development workflow and can update a developer's own deployment. Only use it with an explicitly separate development Convex project after Phase 1 setup. Never run `convex deploy` against a production deployment as part of review.

## Security and release boundaries

- Feature work: `feat/*` → PR → `staging`; owner-reviewed release → `main`.
- Only commits to `main` are eligible for Vercel's automatic builds; feature and staging builds are skipped. See [the release guard](./scripts/vercel-ignore-build.cjs).
- `pnpm build` **never executes `convex deploy`**. A future production control-plane backend release needs its own explicit authorization and procedure.
- No project secrets are present in this repository. **Never put managed deploy keys in `NEXT_PUBLIC_*`**, commit env files, or email tokens.
- This repository must not mutate managed production projects before Phases 1–4 introduce verified authorization and approvals.

See [architecture](./docs/ARCHITECTURE.md), [environment setup](./docs/ENVIRONMENT.md), and [PR-sized roadmap](./docs/IMPLEMENTATION_PLAN.md).

## Phase 0 verification

Run `pnpm check` plus `pnpm build` in a clean, disposable environment. CI is intentionally not automatically enabled, to conserve GitHub Actions credits. Build/type/test evidence should be attached to the PR. See the validation and remaining manual checks in the PR description.
