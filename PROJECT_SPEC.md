# PROJECT_SPEC.md — Pama Convex MCP Control Plane

> Product requirements and implementation contract for `Crown384/convex-mcp`.
> Companion: **[AGENTS.md](./AGENTS.md)** (mandatory agent safety and Git workflow).
> Created: 2026-10-10. Scope corrected 2026-10-13: examples are not separate integrations. Check code and test evidence before assuming any feature is implemented.

## 1. Product in one sentence

An **owner-controlled web dashboard plus remotely connectable MCP server** for securely reading, diagnosing, and—only after explicit approval—operating on multiple registered Convex projects and their separate dev/staging/prod deployments, from ChatGPT or other AI clients on a phone.

### Why this exists

The owner builds and maintains multiple Convex-backed products and may be away from a PC. A practical example: Pamastore has a seller waiting for verification; the owner needs an agent to find the seller, review their application, and perform the **real authorized verification workflow**, with correct application business rules and audit evidence, not just edit a document directly.

### Success looks like

1. The owner signs into this product on a phone.
2. Registers **Pamastore**, selects its **production** deployment, and provides a permission-scoped deploy key in a secure web form.
3. Checks connection health and available capabilities, without revealing or copying the key.
4. Connects an authorized ChatGPT MCP client to a hosted HTTPS endpoint.
5. Asks: “Show me unverified sellers on Pamastore production.”
6. The agent uses an explicitly registered, read-only **Pamastore workflow tool**, with bounded results and redacted customer data.
7. The owner inspects a specific seller, requests verification and sees the precise proposed change.
8. A short-lived, single-use approval is issued. The server invokes a **Pamastore-approved admin operation** that runs the product's own permission/business-rule logic.
9. The result is confirmed from the source deployment and recorded in the audit trail. Failure is reported plainly and can be retried safely where supported.

**Important:** The above is only an illustrative application use case, not a required Pamastore implementation. The generic MCP server must work across any authorized Convex project; application-specific business rules always remain in that application's own functions.

## 2. Product boundaries

### In scope — MVP

- Mobile-first authenticated dashboard.
- Project/deployment registration (many projects; explicit environments; ownership).
- Secure connection checks and key rotation/removal.
- Encrypted credential vault for deployment-scoped Convex keys.
- Authenticated remote MCP endpoint using current supported Streamable HTTP protocol.
- Tool registry with least-privilege grants and server-side authorization.
- Read-only deployment inspection: metadata, table names/schema, paginated data browsing, function metadata, bounded recent logs and basic diagnostics where supported.
- Opt-in, app-specific controlled function execution with previews and approvals.
- Audit history, rate limits, redaction and admin-facing failure recovery.
- Clear management from a phone, including disconnect/revoke instructions.
- Generic, application-independent capability to invoke individually approved Convex operations through a safe function allowlist and approval lifecycle. A specific app demonstration is optional and not a platform prerequisite.

### Out of scope for initial MVP

- Universal automatic discovery of all Convex accounts without credentials.
- Unrestricted mutation/deletion of any Convex document in production.
- AI-generated arbitrary JavaScript execution against production Convex.
- Direct sharing of deploy keys with LLMs/MCP clients.
- Generic shell/terminal access to cloud hosts.
- Bulk destructive operations, automatic schema migrations or code deployment.
- Bypassing the apps' RBAC, user identity, consent, tenancy and business rules.
- A standalone replacement for Convex's dashboard or the existing PamaENV Store.
- Selling access to unrelated third-party Convex customers before a separate multi-user security review.

## 3. Current technology baseline and decisions

**Observed starter (not yet production-ready):** root Next.js App Router project, React 19, Convex backend, Tailwind v4, TypeScript. Current `package.json` uses npm-oriented starter scripts and `vercel.json` runs a Convex deployment as part of building. No MCP implementation exists.

**Preferred direction:**
- Next.js App Router and a maintained, compatible MCP TypeScript SDK.
- Convex **for this product's own database** (project registry, policies, audit, approvals, low-sensitivity metadata). Encrypt stored external deployment credentials using a separately managed server-side master key/KMS.
- A thin server-side adapter for the **documented Convex Deployment/Management API**. Use official SDK/HTTP or CLI only in documented supported contexts. Some CLI operations need an isolated execution worker; do not assume every CLI action fits a Vercel route timeout.
- `pnpm` with a committed lockfile after Phase 0 migration.
- An established web identity provider with secure sessions and MFA support where available. Select provider during Phase 0/1. **Do not home-build password authentication or mix browser sessions with MCP bearer tokens.**
- Remote MCP authentication compatible with client requirements: OAuth-backed, resource/audience-scoped tokens, discovery metadata, secure redirect/PKCE behavior and tool-level scopes. Choose the current official specification version and test with a real client; don't guess endpoints.
- Production Vercel frontend and a dedicated Convex deployment for this control plane, **separate from every managed app**.

### Design principle: control plane vs managed projects

```text
Mobile web admin ──web session──┐
                                │
ChatGPT / other MCP client ─OAuth bearer token─> HTTPS MCP route
                                │
                       Authentication middleware
                                │
                 Project/environment authorization
                                │
                  Tool policy + risk classification
                                │
              Approval / preview / idempotency checks
                                │
                 Central Convex audit / registry
                                │
                   Server-side Convex adapter
                                │
                  Scoped per-deployment secret
                                │
              Documented Convex APIs / app bridge
                                │
              Registered Convex deployment only
```

Secrets never travel from control-plane storage to the browser or MCP response. The agent cannot supply an arbitrary Convex host or credential to bypass the registry.

## 4. Resource model

### Organization/owner

MVP can be single-owner, but model an `ownerId` or workspace boundary so teams can be added without data migrations that weaken isolation. Future delegated users are **deny-all** until invited and assigned explicit roles/scopes.

### Project

Stable ID, name, optional GitHub repo URL (metadata only), display icon, owner/workspace, status, created/updated dates. A project can have multiple deployments.

Suggested initial names are **examples**, not registered connections: Pamastore, Track, PamaOS, Vasta, Eden CRM, Eden Garden, PamaCRM.

### Deployment

Stable internal ID, parent project ID, Convex deployment name/ref and verified canonical URL, explicit environment enum `dev | staging | prod | preview | other`, state `pending | healthy | degraded | disconnected`, credential reference, verified capabilities and last connection check. No URL or environment string inferred from display name alone.

**Do not assume every project has staging.** A persistent staging setup can use a separate Convex project/deployment.

### Credential

Reference to encrypted secret, key type (deployment-scoped key / approved OAuth token if later supported), `keyVersion`, available documented permission scopes, optional expiry, creation/rotation timestamps, test outcome and disabled/revoked status.

Persist only encrypted material and non-sensitive metadata. Never return the ciphertext *or* decrypted key in client-facing calls. Master key outside Convex DB. Design a recoverable key-rotation flow with safe re-encryption.

### Access grant / tool policy

Actor/principal, project(s), deployment(s), allowed tool IDs, allowed environments, maximum risk tier, optional time limit, write enablement. Scope grants to the narrowest principal and environment. Revocation invalidates access promptly.

### Approval

Unique approval ID; actor + MCP client; project/deployment; tool + normalized immutable arguments digest; exact target document/function; risk class; human-readable preview; issuance, expiration, used/revoked time; idempotency key; outcome. Must prevent token reuse, swapped arguments, stale target state and cross-deployment replay.

### Audit event

Immutable append-only event: timestamp, actor, client, project, deployment, tool, risk class, correlation/approval IDs, sanitized target descriptor, allowed/denied status, duration and safe error code. Never record sensitive fields, full payload or credentials.

### Long-running job

Optional table for bounded queued work, with state, retries, cancellation, rate/budget controls, approval linkage and sanitized outcome. Introduce only if an operation actually needs asynchronous execution.

## 5. Tool catalog (proposed names — exact implementation names may evolve)

**Every tool must have:** stable unique name, description honest about side effects, JSON input schema, output schema, required capability, risk tier, environment allowlist, pagination/output cap, redaction policy, timeout, rate limit and audit policy. Register only real supported tools; no fake results or stubs masquerading as working endpoints.

### Level R0: introspection / read-only — earliest MCP MVP

| Tool | Inputs (conceptual) | Intended behavior |
| --- | --- | --- |
| `projects_list` | filters, cursor | List projects visible to authenticated actor; no secrets |
| `deployments_list` | projectId | List verified deployment metadata and explicit environment |
| `deployment_status` | deploymentId | Test/describe health and allowed capabilities, not leaked keys |
| `tables_list` | deploymentId | List table names, known schema/metadata, bounded output |
| `documents_list` | deploymentId, table, cursor, limit | Paginated documents, with field redaction, cap and allowlist |
| `document_get` | deploymentId, table, documentId | One permitted, redacted document; never cross-project |
| `functions_list` | deploymentId, filters | Metadata about deployed callable functions, with access boundaries |
| `logs_get` | deploymentId, cursor, limit, filters | Bounded recent logs with redaction; don't promise infinite streaming |
| `environment_names_list` | deploymentId | Names/metadata only; no variable values by default |
| `deployment_insights` | deploymentId | Expose documented metrics/insights if the assigned key allows |
| `audit_recent` | projectId, cursor | This control plane's own sanitized audit history |

Reference capabilities in Convex's official MCP server: `status`, `tables`, `data`, `functionSpec`, `logs`, `insights`. Verify specific API routes and permission requirements before committing scope.

**No general raw one-off query or custom JS in Phase 2.** If read-only advanced search is needed, consider a small fixed set of typed/paginated query adapters. Official tooling's one-off read-only query is not by itself proof that our hosted server can safely execute user-supplied code.

### Level W1: controlled, specifically approved writes — Phase 3+

| Tool | Preconditions |
| --- | --- |
| `approved_function_run` | Registered function allowlist, verified supported invoke mechanism, validated args, correct actor authorization, preview and approval for sensitive operations |
| `environment_variable_set` | Correct deployment and scope, server-side policy, masked inputs, approval, no plaintext echo, audit |
| `environment_variable_remove` | Same safeguards; explicit confirmation of exact variable name/environment |
| `deployment_pause_request` / `deployment_unpause_request` | High-risk operation, exact target, approval and supported API; optional post-MVP |

For application business actions, require the connected application's own explicitly approved authorization/business-rule function (with scoped grants and preview/approval). The MCP server must expose a generic, registered function-execution mechanism and never hardcode one application's business workflows or expose unrestricted `run_internal_mutation`.

### Level D2: destructive or infrastructure-changing — not default MVP

Data patch/delete/insertion, arbitrary function invocation, key creation/revocation, backups restore/delete, deploy code/schema, usage limit changes, bulk jobs or one-off raw queries. Track as future requests, separately threat-model and only implement where **officially supported**. Require high-risk approvals, isolation and possible out-of-band verification.

### Tool error contract

Return an unambiguous structured error with a stable safe code (e.g. `UNAUTHORIZED`, `DEPLOYMENT_NOT_FOUND`, `CAPABILITY_UNAVAILABLE`, `APPROVAL_REQUIRED`, `APPROVAL_EXPIRED`, `RATE_LIMITED`, `UPSTREAM_FAILURE`) and correlation ID. No stack traces, backend tokens, secrets, internal host details, or raw sensitive data.

## 6. Convex integration rules

1. Use documented Convex **Deployment API**, **Management API**, and official client libraries; prefer a dedicated module per API family.
2. Deployment keys may have action-level scopes such as data read/write, environment read/write, logs view, functions execution and deploy. **Introspect or test exact key capabilities** before showing a tool as available; don't infer write access because a key has a `prod:` prefix.
3. Convex Deployment API authentication uses the documented `Authorization: Convex <key>` scheme. Verify specific routes and granted actions; do not confuse it with the app's own OAuth bearer authentication.
4. Register project/deployment IDs and verify host identity; do not forward keys to caller-chosen URLs. Strict HTTPS and server-side hostname validation.
5. Keep adapters typed, handle quotas/429, upstream failures, pagination and retries with backoff. Never retry non-idempotent mutations automatically unless a safe app-specific idempotency contract exists.
6. Include capability negotiation/error reporting. Unsupported APIs should be documented as unavailable rather than simulated.
7. A generic admin-key function call may bypass or change application user-auth semantics. For user/business mutations, favor the app's **explicit admin bridge** with actor assertion, own authorization checks, transactional mutation, invariant validation and audit.
8. Validate input document identifiers and table names; field redaction must use per-project policies, not regex masking as the only line of defense.
9. Support scoped permissions and **credential rotation** without breaking unrelated projects. Disconnecting a deployment removes usable credentials; clearly tell the operator whether the Convex-side key must also be revoked manually.
10. For service capability checks, never “test” a write permission by modifying production data.

## 7. Identity and security design

### Dashboard

- Owner signs in with a vetted auth provider; secure httpOnly/SameSite cookies, HTTPS, CSRF protection on state-changing endpoints, sensible session expiry, optional MFA.
- Server derives owner/workspace from authenticated session, not form fields. Web UI cannot directly fetch decrypted credentials from Convex.
- Explicit project registration and disconnection wizard with credential entry, scope explanation and test feedback.
- No unauthenticated public admin page or default password.

### MCP authentication

- Use official MCP SDK transport and authorization guidance. Publish OAuth protected-resource metadata and connect to a proper trusted authorization server as required by the chosen protocol version/client.
- Verify JWT signature/key rotation or opaque-token introspection, issuer, audience/resource, expiry, revocation and scopes on **every request**. Never trust bare user IDs provided in tool arguments.
- Bind consent/grants to the actual client and user; consider device/session revocation.
- Tool visibility is not authorization. Re-check before *execution*, including after any asynchronous approval.
- Do not accept `NEXT_PUBLIC_CONVEX_URL` (control plane's public DB endpoint) as proof of access to other deployments.

### Secret handling

- App-layer encryption with AEAD (for example AES-256-GCM) or managed KMS envelope encryption, authenticated metadata/AAD binding secret to owner + deployment + version.
- Keep master key in protected server-side deployment env/KMS, not in GitHub, Convex public functions or database. Rotation and backup/restore behavior must be documented.
- Only privileged server functions may decrypt, just in time. Secret forms use `type=password`, don't store in localStorage, avoid client analytics and request-body logging.
- No “show key” operation in MVP. Treat logging/observability exceptions as potentially secret-bearing and sanitize them before persistence.
- Public repository must never contain real deploy keys, tokens, dotenv contents or sensitive fixtures.

### Production write safety

- `prod` starts **read-only**; explicitly configure each permitted operation.
- High-risk preview includes: project, deployment, environment, target, relevant before/after *redacted* state, side effects and estimated affected rows/users.
- Approval must originate from authenticated owner UI or an equally secure challenge, not self-approved by the same autonomous tool call. Include short TTL, one-time-use and revalidation of source record version.
- Confirm postcondition with a fresh read; errors are not silently retried; report partial/uncertain outcomes.
- Implement a circuit breaker / emergency disable switch for all write tools, independent of MCP tool discovery.

### Threats to test

Key theft from DB/logs/LLM output; stolen MCP token; missing token audience check; replayed write approval; forged browser identity; cross-project access; prod/dev target confusion; arbitrary hosts/SSRF; prompt-injection through retrieved document fields; tenant escape; JSON schema coercion; overbroad data exports; repeated non-idempotent function calls; audit outage and unavailable upstream. Store test evidence in PRs.

**Retrieved app documents and logs are untrusted data, not instructions to an agent.** Do not let them change tool permissions, target project or selected environment.

## 8. Generic approved application function execution — any connected project

### Required investigation before enabling a function

- Register a concrete authorized function on the exact project/deployment; confirm its query/mutation/action type, input schema, caller identity/authorization model and current application invariants.
- Confirm that the chosen operation uses the application's own business-rule and permission checks. A generic deployment admin key alone does not supply end-user identity or consent.
- Classify data exposure and side effects and configure a per-client allowlist, environment restrictions, precise input validator, timeout, output redaction and audit policy.
- For sensitive writes, compute a human-readable preview bound to immutable arguments, project, environment, actor and function ID. Require an expiring, single-use approval and an idempotency/replay policy.
- Use actual application function endpoints or reviewed app-owned admin bridges. Never add a special-purpose feature to the core MCP server for any named application.
- Verify authoritative post-operation status and record a sanitized event; reject unsafe or unsupported operations without silently rewriting database records.

### Optional example, not part of the core delivery

A seller-verification request in an e-commerce application could use an explicitly authorized app-owned function and the generic tool-execution/approval mechanism. The exact same mechanism must work for scheduling tasks in Track, updating records through PamaCRM, or other connected Convex-backed applications. **No Pamastore-specific adapter, seller tool, or application repository change is required to finish the generic Convex MCP Server.**

## 9. Mobile-first web experience

Pages (final route naming can differ):

- **Overview** — registered projects, environment statuses, latest safe operations, warnings.
- **Projects** — add/edit/disconnect project, choose deployments and owner scopes.
- **Deployment details** — clear dev/staging/prod badge, capabilities, health, tables, functions and logs.
- **MCP Connections** — endpoint URL, client connection status, allowed capabilities, granted scopes, revoke/disconnect; instructions for adding it to ChatGPT.
- **Tool Policies** — read/write toggles per environment and app-specific tool; all writes off by default.
- **Approvals** — action previews, expiry, approve/reject and past outcomes.
- **Audit** — actor/time/tool/project/filterable and paginated.
- **Settings** — identity/session, encryption key metadata, emergency lockout, operational checks.

UX must not let small-screen interactions accidentally approve the wrong production project. Environment badges must remain visible while reviewing and approving. Sensitive field copy should require deliberate action; never copy deploy keys back out. Provide loading, permission-denied, expired approval, upstream outage and disconnected credential states.

## 10. API and persistence design contracts

Potential root structure (adapt as project evolves):

```text
app/(dashboard)/...
app/api/mcp/route.ts
app/api/health/route.ts
convex/schema.ts
convex/projects.ts
convex/deployments.ts
convex/approvals.ts
convex/audit.ts
src/lib/mcp/
src/lib/auth/
src/lib/convex-admin/
src/lib/crypto/
src/lib/policy/
tests/
AGENTS.md
PROJECT_SPEC.md
README.md
```

Convex tables (names provisional):

- `workspaces` / `workspaceMembers` (optional single-owner foundation; don't fabricate membership rights)
- `projects` with owner/workspace indexes
- `deployments` indexed by project, status, environment
- `credentialRecords` encrypted contents + metadata, restricted server-only access
- `clientConnections` and `accessGrants`
- `toolPolicies` scoped by project/deployment
- `approvals` indexed by actor/status/expiry
- `auditEvents` indexed by actor, project, deployment, time
- `jobs` only if asynchronous work is required

All Convex functions must validate args; indexes should support paginated/filtered views. Avoid unbounded `collect()` on growing audit/data tables. Do not expose secrets in generated Convex public query functions or broad public file storage.

Example remote entry point **after implementation**:

```text
POST https://<your-production-domain>/api/mcp
GET  https://<your-production-domain>/.well-known/oauth-protected-resource
```

Paths, supported HTTP methods and OAuth discovery must match the chosen SDK/specification and real deployed client tests; the example is not a deployed URL.

## 11. Environments and deployment

- Control plane itself has distinct dev and production Convex deployments. Keep all managed-project secrets out of preview builds.
- Protect Vercel production secrets and Convex key material in proper deployment settings. Never put real credentials into local fixtures.
- Root `vercel.json` currently deploys Convex during build. Review and configure **production-only release from `main`**; ensure feature/staging commits do not unexpectedly push to the production backend.
- Avoid automatically spending Vercel builds or GitHub Actions credits on feature branches. Use targeted tests and only enable preview deployments if explicitly approved.
- Long-running operations must account for Vercel request limits; use durable background jobs/a separate worker if required rather than relying on an HTTP request running indefinitely.
- Health checks must not expose credentials, private project names to unauthenticated callers or sensitive upstream diagnostic payloads.
- Document backups of control-plane registry and encrypted key recovery *without* copying master key into the same database backup.

### Suggested configuration categories (names not final)

```text
# Server-only
CONTROL_PLANE_ENCRYPTION_KEY=<managed-secret>
AUTH_ISSUER=<configured-issuer>
AUTH_AUDIENCE=<this-service-resource>
# Convex's own service deployment setup is handled through documented Convex env settings.
# Browser-exposed public config may include the control-plane Convex URL;
# NEVER place a managed project's deploy key in NEXT_PUBLIC_*.
```

No real secrets in documentation or tests.

## 12. Implementation phases, deliverables and exit gates

### Phase 0 — Repository foundation

**Deliverables:** accurate README, clean starter UI, remove toy `numbers` demo where safe, baseline `pnpm` scripts/lockfile, explicit lint/typecheck/build commands, `staging` from `main`, feature PR to staging, Vercel/build policy reviewed, architecture outline and environment documentation.

**Gate:** static checks pass or remaining problems are recorded with exact reproducible errors; no production credentials requested; no unplanned Convex production deployment.

### Phase 1 — Registry, auth, encryption, policy and audit

**Deliverables:** login/logout, safe role/owner boundary, project/deployment CRUD, capability metadata, encrypted key submission/replace/disconnect, safe server-side connection test, risk policy, append-only audit. Dashboard usable on phone.

**Gate:** actor from workspace A cannot see/control workspace B; plaintext secrets absent from API responses/logs; compromised client cannot decrypt credential; tampered project IDs are rejected; key rotation tested; no unauthenticated management route.

### Phase 2 — Read-only remote MCP

**Deliverables:** hosted MCP endpoint, OAuth resource discovery/authorization, scopes, project/deployment tools, bounded tables/data/functions/log tools backed by actual supported APIs, safe pagination and redaction, ChatGPT client setup guide.

**Gate:** MCP client connects in test environment; unauthorized, expired and wrong-audience tokens fail; tool grants enforced; production calls remain read-only; real disposable deployment smoke tests show correct data, no credential leaks.

### Phase 3 — Approved mutations and application adapters

**Deliverables:** approval UI, preview lifecycle, single-use expiry/idempotency, guarded function allowlist, server-side action policies, emergency stop. Initially demonstrate a harmless operation on a **disposable dev deployment**.

**Gate:** replay/argument swap/cross-env attempts denied, no double-mutation, race-condition checks, side effects audited and actual post-state verified; production default-deny remains intact.

### Phase 4 — Generalized authorized-function pilot

**Deliverables:** demonstrate an application-defined authorized function using the generic invocation interface on a disposable Convex development project, including allowlist, preview, approval, replay prevention, audit, and post-state verification. Do not implement project-specific business logic in the MCP server.

**Gate:** a real disposable application function is invoked safely for both approved and denied cases, with no direct table shortcut. Production write enablement requires a separately reviewed owner approval.

### Phase 5 — Release hardening

**Deliverables:** threat model and security review, runbook, key-rotation and incident handling, observability, bounded costs, load/performance checks, backups/restore procedure, owner acceptance demo, production deployment and MCP connection verification.

**Gate:** owner approves release; no outstanding critical/high security findings; validated rollbacks; all sensitive operations auditable.

### Later phases (separate issues)

Support more Convex management tools/metrics, backup administration, production deploy operations, delegated team roles, PamaENV trusted integration, app-specific workflows for PamaOS/Track/PamaCRM/Eden, multi-step batch jobs and portable credential providers. Each expansion begins with a permissions and API feasibility review.

## 13. Test matrix and definition of done

### Minimum testing for any related feature

- **Unit:** schema validation, authorization predicates, masking and redaction, risk mapping, approval expiry, encryption/AAD/versioning, idempotency.
- **Integration:** mock only external Convex API edges and verify real adapter request shapes, auth headers/scope failures, timeouts, pagination/limits, proper errors.
- **Security negative:** missing/forged JWT, wrong OAuth audience/issuer, stolen/expired approval, replay, swapped project ID, cross-owner access, `prod` vs `dev` confusion, SSRF, stored prompt injection and secret leakage.
- **End-to-end:** usable phone-sized dashboard, login/revoke, connected disposable dev backend, real MCP client discovery/calls, production write blocked absent approval.
- **Manual real-device:** important before release, but log as GitHub issue if no device/browser is available; don't claim Playwright or actual phone QA passed when it hasn't been run.
- **Performance:** bounded listing over large tables, audit indexes, rate limits, upstream timeouts, graceful partial outage and cost behavior.

An agent must report **exact test commands and actual output**, repository branch/head SHA, scope and security risk. Do not use a green build as a substitute for authorization testing. Avoid unnecessary paid CI workflows.

### Acceptance criteria for initial usable release

- [ ] Secure remote MCP connection from an approved ChatGPT client.
- [ ] At least two independent test Convex projects selectable and isolated.
- [ ] Dev and prod clearly distinguished, with tested restrictions.
- [ ] Registered scoped deploy keys stored encrypted and never revealed.
- [ ] Read-only discovery, tables/documents/functions/logs work for explicitly supported capabilities.
- [ ] Audit captures every attempted sensitive operation and denied access.
- [ ] Production writes are impossible without explicit app-specific enablement and approval.
- [ ] One approved app-specific operation works end-to-end in a disposable test deployment.
- [ ] Mobile dashboard supports initial setup and approvals.
- [ ] Failure, secret rotation, revoke and recovery paths documented and tested.
- [ ] Owner-reviewed rollout, with no unsupported security assumptions.

## 14. Outstanding decisions to resolve during implementation

Do **not** stall foundation work on these; raise a focused question when the decision first becomes necessary:

1. Which provider handles owner web login and MCP OAuth (may be separate pieces)? The choice must meet client compatibility and security requirements.
2. Is the first hosted MCP instance owner-only or will invited PAMA-Ltd staff use it immediately? Default owner-only.
3. What is the deployment domain? Do not assume an endpoint exists before actual Vercel/DNS deployment.
4. Which official management APIs are accessible with the minimum scope required for each proposed tool? Verify against the current Convex docs and keys.
5. Which first disposable application-defined function best validates the generic approvals/execution path? Do not make any named production application a platform dependency.
6. Whether secrets should ultimately be managed locally or pulled via an approved PamaENV integration. Start independently, integrate only on explicit approval.
7. Which source-controlled staging/production process is acceptable for the first release? Default feature PR → staging → owner-reviewed main release.

## 15. Reference material

- Official Convex MCP server: https://docs.convex.dev/ai/convex-mcp-server
- Convex deploy key types and permissions: https://docs.convex.dev/cli/deploy-key-types
- Convex management APIs: https://docs.convex.dev/platform-apis/overview
- Convex Deployment API: https://docs.convex.dev/deployment-api/convex-deployment-api
- Convex with Vercel: https://docs.convex.dev/production/hosting/vercel
- MCP protocol and authorization: https://modelcontextprotocol.io/specification
- Official MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Repo-local agent constraints: [AGENTS.md](./AGENTS.md)

**First instruction to the coding agent:** Review this spec and the actual code, then prepare a small Phase 0 PR to `staging`. The first completed implementation milestone must be verifiable foundation work, **not a claim that a production-capable MCP server is ready**.
