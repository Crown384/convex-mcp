# AGENTS.md — Pama Convex MCP

> Standing operating instructions for every AI coding agent and human contributor working in this repository.
> **Read this file and [PROJECT_SPEC.md](./PROJECT_SPEC.md) in full before editing code.** If the documents disagree, choose the more restrictive security requirement and request clarification.
> Updated: 2026-10-13. Status: **read-only staging implementation with Better Auth/Mailjet OAuth**, pending live deployment acceptance.

## 1. Mission and scope

Build a secure, remotely accessible, **multi-project Convex management MCP server** with a mobile-friendly web dashboard. The owner must be able to manage explicitly connected Convex deployments from ChatGPT or another authorized MCP client **without needing a PC**.

The platform uses **Next.js for UI and the remote MCP endpoint** and **Convex for its own registry, metadata, policies, approvals, and audit records**. It connects outward to *other* Convex projects through documented APIs and separately authorized credentials. It does not magically discover or access projects for which it has no authorization.

Core use case: securely inspect and operate through approved Convex capabilities on **any** registered project (Track, Pamastore, PamaOS, Vasta, Eden and future projects), with exact deployment policy, application-owned business rules, and human approval for sensitive operations. Named applications are examples, not core integration work items.

Do not confuse this product with:
- **Convex's official local MCP server** (a reference for capabilities and semantics).
- **PamaENV Store** (a separate secret/environment management product). Integrate later if approved; do not implicitly read its database or credentials.
- An AI agent with unconditional administrative access. All tools are subject to server-side authorization and policy.

## 2. Current repository reality — inspect again before coding

Current staging contains a Next.js dashboard, nine read-only tools, official SDK transport, Better Auth email-code login and OAuth using a local Convex component. PamaENV is the delegated project registry and external secret store. No managed-project credentials are duplicated in the auth database.

See README.md and docs/AUTHENTICATION.md for the current runtime/setup. Existing docs may include planned features; inspect source and evidence before claiming live connectivity, write approvals or production readiness.

## 3. Non-negotiable security rules

1. **Default deny.** Every dashboard/API/MCP request needs authenticated identity, deployment-level permission checks, tool-specific authorization, and an explicit environment target.
2. **Start read-only.** Production writes, function execution, environment changes, schema changes, deploys, destructive actions and raw querying are not available until their dedicated guardrails are implemented and reviewed.
3. **Deploy keys are secrets.** Never commit, print, email, log, interpolate into URLs, embed in client bundles, return to MCP callers, or expose via `NEXT_PUBLIC_*`. Store encrypted at the application layer using an external server-side key/KMS; limit retrieval to the exact server-side operation and scrub buffers/logs where practical.
4. **Use least privilege.** Prefer individual deployment-scoped, action-scoped, revocable, expiring Convex deploy keys. Do not require a personal token covering all projects. Where an official API requires broader rights, communicate the risk before enabling it.
5. **Separate environments explicitly.** Every action must carry a validated project/deployment ID and render its `dev`/`staging`/`prod` context. No defaulting to production; no cross-environment fallback.
6. **No arbitrary code execution in production.** No `eval`, unsafe dynamic import, user-submitted JavaScript, shell passthrough, arbitrary function-name execution, or unrestricted HTTP proxy as a shortcut for tools. If an advanced read-only query feature is ever added, it needs a separately reviewed sandbox and explicit restrictions.
7. **Production mutations need approval.** Separate a read/preview step from execution. For high-risk operations, obtain a server-verified, short-lived, single-use approval linked to actor, deployment, exact action, target, arguments and idempotency key. A chat message saying “yes” alone is not your server-side security boundary.
8. **Never bypass business rules.** Seller verification must invoke an application-defined operation with verification checks, permissions, transactional updates, side effects, and an audit trail. Don't directly set `seller.verified=true` in Convex tables to “make it work.”
9. **Authorization is enforced at every layer.** Scope Convex queries/mutations by user/org/project; do not trust client-provided user IDs or project IDs; validate MCP bearer audience/issuer/scopes and web sessions independently.
10. **Fail closed.** On auth errors, ambiguous deployment, expired approval, unavailable audit log, network errors, unsupported API or uncertain permission: refuse to mutate and return a safe error.
11. **Never invent a successful operation.** Differentiate implemented, mocked, tested, deployed, authorized, and actually executed outcomes.
12. **Avoid SSRF and credential forwarding.** Use official Convex API hosts or verified per-deployment hostnames, HTTPS, strict allowlists and redirect restrictions. Do not forward credentials to user-controlled URLs.
13. **Do not expose sensitive records needlessly.** Minimize PII, paginate, redact, apply explicit allowlists and never put customer documents or credentials into telemetry.
14. **Audit meaningful operations.** At minimum: actor, client, project, environment, tool, normalized action, target, outcome, time, correlation ID, approval reference, request hash and sanitized error. Never store key plaintext or full sensitive payload.
15. **No unauthorized deployments or production changes.** Code/documentation changes and infrastructure/database actions are distinct approvals. Ask before touching real production data or credentials.

## 4. Engineering principles

- Prefer **pnpm** for new work (owner preference). Adopt it during the bootstrap phase with one committed lockfile; do not mix package managers or silently break the starter.
- TypeScript strict, Convex validators (`v.*`), Zod at external boundaries if installed, explicit response/output schemas, no `any` without documented justification.
- Use the **official maintained MCP TypeScript SDK** and **Streamable HTTP**. Check the current MCP specification and target client's requirements before implementing transport or OAuth; never hand-roll the JSON-RPC protocol.
- Use documented **Convex Deployment/Management APIs** and official supported SDKs, not undocumented dashboard endpoints. For each proposed tool, first verify its API, deployment-key scope and error semantics.
- Prefer a small pluggable **Convex adapter layer** and a tool registry that maps a tool to required capability, environment restrictions, approval policy, input schema and sanitized output schema.
- Convex is the product's control-plane database, *not* an all-powerful bypass for other projects' `ctx.auth`, app-side authorization, tenancy boundaries, or business workflows.
- UI: premium, responsive, **phone-first**, accessible, with clear project/env labels, confirmation views and usable error states.
- Paginate indexed queries, cap response sizes, rate-limit by actor/client/deployment/tool, set timeouts and bound concurrency. Prefer background jobs for long-running operations.
- No cross-project coupling to internal table names; generic tools inspect metadata, and **application-specific actions** are registered explicitly after source review.
- Dependencies should be justified and locked; no novelty refactor or premature monorepo migration.

## 5. Git and QA workflow

1. Inspect `main`, open PRs, issues, current files and latest commits before beginning work.
2. During Phase 0 create **`staging` from `main`** if absent. Create short-lived `feat/*` or `fix/*` branches from `staging`.
3. Implement in coherent, reviewable PRs **targeting `staging`**. Keep docs current with code. Reference tracked issues in PR body if available.
4. Add or update focused tests for changed behavior. Run the **smallest sufficient local validation** first, then broader checks when justified. Conserve GitHub Actions minutes; avoid redundant CI runs and unnecessary workflows.
5. Report exact branch, commit SHA, changed files, tests actually run, security impact, unresolved blockers, and manual verification steps. Never claim “all tests pass” if they were not run.
6. Require QA review for auth, credential, cross-project, production-write, MCP transport and deployment changes; address review findings and request re-review.
7. Do **not merge into `main`**, deploy production, connect real credentials, or operate on any live application's user accounts without explicit owner authorization. Do not auto-merge a PR just because checks are green.
8. Configure Vercel so **`main` is the production deployment source**. Avoid unnecessary preview builds for every feature branch, per owner preference; verify the exact Vercel configuration rather than assuming a `vercel.json` build command prevents previews.
9. Destroy ephemeral test environments/sandboxes when finished. Never leave costly or privileged sandboxes running without permission.
10. Keep PRs narrow. No speculative polish while critical permission boundaries are unfinished.

A documentation-only bootstrap commit directly to `main` may precede branch creation; ongoing feature implementation follows the branch policy above.

## 6. Mandatory build sequence

Follow **[PROJECT_SPEC.md](./PROJECT_SPEC.md)**, which defines MVP scope, exact capability tiers, data model, tool catalog, milestones and acceptance tests.

- **Phase 0: foundation.** Audit starter; clean up scripts/lockfile, remove toy UI/schema, establish staging and deployment guards; document environment setup.
- **Phase 1: control plane.** Secure sign-in, project/deployment registry, encrypted credential storage, permission engine and audit log.
- **Phase 2: read-only MCP.** Authenticated remote endpoint + verified project/deployment discovery, tables, documents, function metadata, logs, diagnostics with pagination/redaction.
- **Phase 3: guarded admin operations.** Explicit approvals, replay prevention, application function allowlists, safe function calls and carefully scoped write tools.
- **Phase 4: generic function-execution pilot.** Validate an allowed application-owned function on a disposable Convex development deployment with approval, replay prevention and audit. No application-specific adapters are required.
- **Phase 5: production readiness.** Threat-model pass, integration tests, monitoring, backup/recovery of control plane, key rotation, Vercel/Convex deployment, MCP client connectivity tests.
- **Later:** richer usage/metrics/backup management, multi-user delegation, trusted PamaENV integration, batch operations and advanced discovery as independently reviewed features.

Do not skip earlier foundations for a high-risk demo.

## 7. Suggested logical code organization (adapt to actual repo)

```text
app/
  (dashboard)/             # login-protected, mobile-first control plane
  api/mcp/route.ts          # Streamable HTTP MCP route (if host/SDK supports it)
  api/health/route.ts       # sanitized non-secret health
  .well-known/             # MCP/OAuth discovery as required by selected spec
convex/
  schema.ts                # strongly validated project registry/policies/audit
  projects.ts
  deployments.ts
  credentials.ts           # restricted calls, never exposed to browser
  approvals.ts
  audit.ts
src/
  lib/auth/                # web and MCP identity verification
  lib/mcp/                 # server bootstrap, tool registration, schemas
  lib/policy/              # authorization and action risk model
  lib/convex-admin/        # documented Convex API adapters
  lib/crypto/              # encryption/decryption, redaction, key rotation
  lib/observability/
tests/                     # unit + integration + security coverage
```

Names are a **proposal, not existing files**. Keep network/secret access on the trusted server. Use Convex actions/Next.js server code appropriately and verify runtime compatibility.

## 8. Before claiming a feature is done

- [ ] Functionality is real (no stub, mock, optimistic UI or inert button passed as complete).
- [ ] Web and MCP identities are authenticated and independently scoped.
- [ ] Tool arguments are schema-validated; unauthorized and cross-project paths fail.
- [ ] Credentials are encrypted, redacted and never shipped client-side.
- [ ] Exact environment and risk tier are visible to user/agent.
- [ ] Production writes cannot bypass preview, approval and replay defense.
- [ ] Success/failure audited, with no secrets or unnecessary PII in logs.
- [ ] Tests and, when appropriate, live **disposable dev deployment** smoke checks have evidence.
- [ ] Docs, migration details and rollback procedure are up to date.
- [ ] PR describes any unsupported endpoint, vendor/API limitation or remaining manual step.

## 9. Your first task as coding agent

Read this file, read [PROJECT_SPEC.md](./PROJECT_SPEC.md), inspect the repository/branches, inspect current Convex documentation, and produce a short implementation plan split into PR-sized milestones. Then **begin Phase 0 only** on a new feature branch from `staging`, unless the owner instructs otherwise. Do not ask for production deploy keys in chat; provide the secure setup mechanism first. Document unverified assumptions and concrete limitations; don't substitute speculation for tests.

### Authoritative links

- Convex Deploy Keys: https://docs.convex.dev/cli/deploy-key-types
- Convex Management APIs: https://docs.convex.dev/platform-apis/overview
- Convex Deployment API: https://docs.convex.dev/deployment-api/convex-deployment-api
- Convex official MCP server (reference, not our hosted service): https://docs.convex.dev/ai/convex-mcp-server
- MCP specification: https://modelcontextprotocol.io/specification
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
