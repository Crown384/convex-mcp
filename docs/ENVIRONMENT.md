# Environment setup and release boundaries

## Development (Phase 0)

- Node.js >=20.9 and pinned pnpm from `package.json`; use `corepack enable`.
- `pnpm install --frozen-lockfile`; `pnpm dev:frontend` runs the static preview.
- `NEXT_PUBLIC_CONVEX_URL` is **not needed** to render Phase 0. Leave it unset.
- `.env.example` describes future configuration, but **contains no credentials**.

## Future control-plane deployment

Create a dedicated Convex project with distinct **development** and **production** deployments. Configure their secrets in protected deployment settings, never in Git history.

Future setup will need an approved identity provider, audited OAuth resource-server validation, and a server-side encryption/KMS secret stored outside Convex DB. None are implemented or required in Phase 0. Key backup and restoration must keep the master key separate from DB backups.

Managed deployment secrets must be entered through the authenticated secure Phase 1 UI. Never request them in email, commit them, log them or include them in `NEXT_PUBLIC_*` variables.

## Vercel release policy

`vercel.json` uses `git.deploymentEnabled` to deny automatic builds for every branch except `main`; a second `ignoreCommand` guard checks both `VERCEL_ENV=production` and `VERCEL_GIT_COMMIT_REF=main`. Missing metadata fails closed. See `tests/vercel-ignore-build.test.cjs`.

The old starter `buildCommand` invoked `convex deploy` without environment separation; it is removed. `pnpm build` compiles **only the Next.js frontend**. Do not add automatic Convex deployment before separate backend release design and owner approval.

Before any production release, confirm in the actual Vercel project Settings → Git that the **Production Branch is main**, and verify the connected repository/build settings. Source configuration alone does not prove the dashboard settings; this is a manual check. An unlinked Vercel project cannot be declared deployed.

## Rollback

For Phase 0, revert the feature PR on `staging`. No database schema changes are deployed. If a future release reaches `main`, roll back via an owner-approved Git revert/deployment and independently assess backend schema compatibility. Phase 0 never touches actual managed apps.

## Secrets checklist

1. No real keys in source, fixtures or logs.
2. No managed deployment keys passed via URL or to AI clients.
3. Preview deployments do not receive future production secrets.
4. No manual `convex deploy` without explicit, correct target and owner approval.
