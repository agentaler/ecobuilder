# Architecture Decisions — Multi-tenant SaaS conversion

Decisions are recorded newest-last. Each states the choice, the alternative
considered, and why — so a future reader knows the reasoning, not just the result.

## D1 — Auth: extend the in-house stack, do NOT adopt Better Auth

**Choice:** Keep the existing in-house authentication (argon2id passwords,
DB-backed sessions, TOTP MFA, step-up, lockout, rate-limiting, audit) and add
signup / email-verification / password-reset / OAuth on top of it.

**Alternative:** Replace it with Better Auth (email+password, org plugin).

**Why not Better Auth:**
- `zod` is banned repo-wide (gated by `ai-driver-isolation.test.ts`); Better
  Auth and the Polar SDK pull zod in transitively.
- Better Auth's schema CLI binds only to Prisma/Drizzle/Kysely. This project
  uses a hand-written `DbClient` over `Bun.sql`/`bun:sqlite` with dual-dialect
  hand-written migrations — no supported adapter exists without adding a whole
  ORM.
- Swapping to email+password would drop MFA/step-up/lockout/audit — a security
  regression on a stack that already has them.
- The E06-T01 ticket already evaluated and rejected Better Auth for these reasons.

This is the "adapt the requirement's *mechanism*, keep its *outcome*" call: every
auth outcome the mission asks for is delivered on the hardened in-house base.

## D2 — Tenancy: `tenants` + `tenant_members`, not Better Auth organizations

**Choice:** A workspace is a `tenants` row; membership is a `tenant_members`
row binding a user to a tenant with a role. Capabilities resolve through the
session's active tenant.

**Alternative:** Better Auth organization plugin.

**Why:** Follows from D1 (no Better Auth). The model is the standard SaaS shape
(one human, many workspaces) and is already shipped: migrations 025–028, the
tenant repository, per-tenant owner rule, and session-scoped capability
resolution. "Workspace" is the UI label; `tenant` is the internal identifier.

## D3 — Billing: Stripe, not Polar

**Choice:** Stripe (the connector is already attached to the deployment),
per-workspace via `referenceId = tenant.id`, a local `subscriptions` table
synced only by signature-verified idempotent webhooks, server-side feature
gating via `getWorkspacePlan(tenantId)`.

**Alternative:** Polar via `@polar-sh/better-auth`.

**Why not Polar:** depends on Better Auth (rejected in D1) and pulls zod. The
E10 ticket specifies Stripe. The billing *architecture* the mission wants —
per-workspace reference id, webhook-synced local table, no per-request provider
calls, server-side gating — is provider-agnostic and preserved exactly.

## D4 — Test runner: `bun test`, not Vitest

**Choice:** `bun test` (the repo standard) for unit/integration incl. the tenant
isolation matrix; Playwright (already installed) for e2e.

**Why:** Adding Vitest duplicates the runner and violates the repo's tooling
rules. `bun test` already runs the whole suite.

## D5 — System content-types are SHARED product definitions; only content is per-tenant

**Choice:** The four system tables (`pages`, `posts`, `components`, `layouts`)
stay shared, product-level content-type definitions with their fixed ids. The
per-tenant boundary is the **content** — `data_rows` and everything downstream
(versions, redirects, snapshots, media, publish artefacts) — scoped by
`tenant_id`. A tenant's starter content (homepage + post entry-template) is
seeded as `data_rows` at tenant creation (`server/repositories/tenantSeed.ts`),
shared by setup (bootstrap tenant) and signup (each new tenant).

**Alternative considered (and initially planned):** per-tenant `data_tables`
with tenant-scoped ids.

**Why the shared-defs model won:** in Ecobuilder, pages/posts/components/layouts
are *product primitives*, not tenant-customisable schemas — every workspace
wants the same four. Making the definitions per-tenant would force tenant-scoped
table ids (`'pages'` → `'<tenant>:pages'`) and ripple through every
`tableId: 'pages'` reference, the publisher, and the collab relay for no product
benefit. Scoping the rows (which is where tenant data actually lives) delivers
full isolation with a far smaller, safer change. `data_tables` keeps its
`tenant_id` column (all `'default'`) harmlessly; the composite unique on
`(tenant_id, slug)` still enforces global type-slug uniqueness.

## D6 — Backfill mapping (existing single-install data → bootstrap tenant)

Migrations 025–028 fold every existing install into one bootstrap tenant with
`id = 'default'` (matching the `site` row's id): the tenant is created from the
`site` row, every non-deleted user becomes a `'default'` member with their
current role, and all existing content rows carry `tenant_id = 'default'` via
the column's `NOT NULL DEFAULT 'default'`. Result: single-install behaviour is
byte-for-byte preserved, and the install is now "tenant `default`" in the
multi-tenant model.

## D7 — Email delivery abstraction

**Choice:** One `sendEmail()` entry (`server/email/`) with a provider driver
over plain REST (no SDK, matching the AI-driver discipline). With no provider
key configured it logs the actionable link to the console. Email never blocks
signup or tests.

**Placeholders:** `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY` (or SMTP_*)
in `.env.example`. Absent → console transport.
