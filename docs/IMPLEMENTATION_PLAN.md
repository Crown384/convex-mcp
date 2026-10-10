# PR-sized delivery roadmap

## Phase 0 — foundation (this PR)

- Replace unsafe sample `numbers` functions and starter demo with a truthful no-access landing page.
- Add explicit scripts, single package manager, frozen pnpm lockfile and a lightweight release-guard test.
- Prevent feature/staging preview builds; remove implicit Convex deployment from Vercel build command.
- Document safe setup, architectures, upcoming decisions and rollback.
- Verify dependency lockfile, lint/typecheck/unit/build in a disposable sandbox. Report any environment-caused failures with exact output.

## Phase 1A — owner authentication and isolation

- Choose a maintained identity provider; implement sign-in/out, session protection and workspace scoping.
- Convex schema indexes and ownership-aware functions with validators and negative access tests.
- No public browser route to a secret or internal permission bypass.

## Phase 1B — registry and encrypted credentials

- CRUD for projects/deployments with explicit environment and verified host identity.
- Server-only authenticated encryption with AAD, key metadata, safe rotation/removal.
- Least-privilege capability checks, owner policy, sanitized audit and disconnect.
- Mobile dashboard with real loading/error states and test coverage.

## Phase 2A — OAuth/MCP connectivity

- Confirm current MCP OAuth protected-resource guidance and supported official SDK.
- Discover client/resource metadata and enforce per-request issuer, audience, expiry and scopes.
- Streamable HTTP endpoint with tests for wrong principal, revoked token and tenant escape.

## Phase 2B — read-only deployment tools

- Adapter for documented Convex APIs; `projects_list`, `deployments_list`, bounded table/doc/function/log diagnostics only where verified.
- Pagination, redaction, safe errors, rate limiting, audit and disposable-dev smoke checks.

## Phase 3 — approvals & application operations

- Preview/execution split, one-use/short-lived server approval, race/replay defense, allowlists and emergency disable switch.
- Harmless development test operation first; prod stays read-only.

## Phase 4 — Pamastore seller pilot

- Inspect Pamastore business rules; implement app-owned bridge where necessary in a separate reviewed PR.
- Pending applicants / details / verification eligibility / approval / post-action confirmation.
- Production enablement requires another explicit owner approval.

## Phase 5 — security & release

- Client and mobile E2E checks, threat model, operational alerts, backups and key rotation/recovery.
- Owner-reviewed main release and separately approved backend deployment.

### Explicitly unresolved

Identity provider, OAuth issuer, future production hostname, Convex API permission feasibility, and Pamastore's existing approved seller action remain open. None block Phase 0. Do not assert these integrations exist.
