# Multi-tenant SaaS — Architecture & Plan

## Phase 0 recon (this codebase)

| Aspect | Finding |
|---|---|
| Runtime | **Bun** (server + tooling). Not Node/Next. |
| Server | `Bun.serve` with a hand-written router (`server/router.ts`). No file-based routes, no catch-all `/api/auth/*`, no middleware layer. |
| Language | TypeScript everywhere. |
| Package manager | **bun** (lockfile `bun.lock`). |
| Database | Postgres (`Bun.sql`) **or** SQLite (`bun:sqlite`), chosen by `DATABASE_URL`. One hand-written `DbClient` interface, two adapters. |
| Migrations | Hand-written, **dual-dialect**: `server/db/migrations-pg.ts` + `migrations-sqlite.ts`, identical ids (gated by `migration-parity.test.ts`). No ORM, no external migration CLI. |
| Validation | **TypeBox** at every boundary. `zod` banned repo-wide. |
| Frontend | React 19 (React Compiler on) + Vite. CSS Modules only. In-house router (`react-router` banned). Shared UI primitives in `src/ui`. |
| Existing auth | Mature in-house stack: argon2id, DB sessions, TOTP MFA, step-up, lockout, rate-limiting, audit. |
| Test runner | `bun test`. Playwright installed for e2e (`tests/e2e`). |
| Commands | typecheck+build `bun run build` (`tsc -b && vite build`); tests `bun test`; lint `bun run lint`. |

Because the stack is Bun/TypeBox/dual-migrations with hardened in-house auth,
the mission's Better-Auth/Polar/Vitest/Next prescriptions do not fit and are
replaced by repo-native equivalents that meet the same outcomes — see
`DECISIONS.md` D1–D4.

## Tenant-owned tables (need `workspace`/`tenant_id` scoping)

Content & publishing:
- `site`, `data_tables`, `data_rows`, `data_row_versions`, `data_row_redirects`,
  `site_snapshots`, `collab_documents` — **scoped (migration 028, done).**

Media:
- `media_assets`, `media_folders`, `media_asset_folders`, `media_smart_folders`,
  `media_usage_refs`, `published_runtime_assets` — **pending (E07-T02).**

Plugins & AI (tenant-owned config/state):
- `installed_plugins`, `plugin_records`, `plugin_crash_events`, `plugin_secrets`,
  `plugin_schedules`, `plugin_schedule_runs` — pending.
- `ai_provider_credentials`, `ai_defaults`, `ai_conversations`, `ai_messages`,
  `ai_mcp_connectors`, `ai_mcp_oauth_*` — pending.
- `active_media_storage_adapter`, `active_media_variant_delegate`,
  `site_sync_state` — schema-enforced singletons; become per-tenant (E07).

Global / not tenant-scoped (deliberately):
- `tenants`, `tenant_members`, `users`, `sessions`, `roles`, `user_preferences`
  (per-user, not per-tenant), `audit_events` (carries actor + target; tenant
  context added as metadata, not a scope column), `login_attempts`,
  `ai_model_pricing` (global reference data).

## Data-access discipline (the isolation requirement)

Tenant reads/writes flow through the repository layer, which is the single
choke point the mission calls a "data-access layer". Scoping rules:
- The request's tenant is the session's `active_tenant_id` (never a
  client-supplied id), resolved once in the handler from the authenticated
  `AuthUser.activeTenantId`, membership already verified by
  `findUserBySessionHash` (E06-T08).
- Repositories that touch tenant tables take a `tenantId` and filter by it.
- The editor's tree mutations already funnel through `mutateActiveTree` /
  `applyTreeOperation`; the DB repositories are the server-side equivalent.

## Plan (tickets E06–E12, tracked in `tickets/`)

Done this effort:
- E06-T02 tenancy schema · E06-T03 per-tenant owner rule · E06-T08
  session-scoped capabilities · E07-T01 content-table `tenant_id` + composite
  uniques.

Next, in order:
1. **E06-T04** — signup + `server/email/` `sendEmail()` abstraction + email
   verification.
2. **E07 (repos)** — thread `tenantId` through data-table/data-row/media/publish
   repositories; per-tenant system-table seeding (D5).
3. **E06-T05/T06/T07** — OAuth, auth UI, tenant switcher + members/invitations UI.
4. **E10** — Stripe billing: per-workspace `referenceId`, local `subscriptions`
   table, webhooks, `getWorkspacePlan` gating, billing UI.
5. **E08/E12** — host-based tenant resolution + URL model (workspace at `/`,
   console at `admin.ecobuilder.ai`).
6. **Verification** — isolation matrix, billing webhook tests, e2e smoke;
   recorded in `VERIFICATION.md`.
