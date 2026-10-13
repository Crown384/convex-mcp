# Control-plane architecture — foundation decisions

The web UI and future remote MCP route are separate security principals. A browser session **cannot** substitute for an MCP access token. Future MCP access must verify signature, issuer, resource/audience, expiry, client and delegated project/tool scopes per request.

```text
Phone owner (browser session)         ChatGPT (OAuth access token)
                 \                    /
                  Next.js authorization boundary
                               |
                        Tool policy registry
                               |
                     Convex control-plane DB
                               |
                  Encrypted credential reference
                               |
                    Official Convex API adapter
                               |
                     One explicitly registered
                    deployment + environment
```

## Phase boundary

- **Phase 0 (this PR)**: static landing page, no connection to Convex or external deployments, no MCP route, no public CRUD/mutation functions. `/api/health` says only that the frontend is on the foundation phase.
- **Phase 1**: authenticated owner/workspace records, project/deployment registry, app-layer encrypted scoped keys, authorization policies, append-only audit. No broad public functions or premature tool exposure.
- **Phase 2**: supported SDK/Streamable HTTP remote MCP transport; audited read-only tools, verified scopes and OAuth resource discovery, bounded paginated outputs.
- **Phase 3**: exact preview + short-lived server-issued single-use approvals, idempotency, emergency stop, auditable action allowlists. No generic arbitrary JavaScript or production patch API.
- **Phase 4**: generic approved-function execution with a disposable development application proving app-owned business rules, **not** a direct database flag edit. Application-specific examples are not core deliverables.
- **Phase 5**: real-client checks, threat model, recovery/rotation, end-to-end QA and owner-approved release.

## Deployment boundaries

Deploy the control plane to its **own** Convex project, never by reusing Pamastore/Track/PamaOS deployments. A deploy key for one managed project never authorizes the rest.

Do not derive Convex hosts from user-supplied strings at request time. Persist and verify canonical host identity at registration using documented endpoints. No credential echo, raw arbitrary query, shell passthrough or unscoped production writes.

The starter sample `numbers` mutation and sample routes were removed because they allowed unauthenticated writes and conveyed misleading readiness. The new schema is empty intentionally. Phase 1 schema/functions require independent authorization review.
