# E11 — SaaS operations: observability, GDPR, limits, backups
Phase: P2 · Depends on: E03 · Requirements: R-003

Running other people's sites changes the operational bar: you need to see failures before users report them, honor EU privacy law (the market focus makes GDPR non-optional), contain noisy tenants, and guarantee restorable backups. Server currently logs `console.error` with module prefixes and nothing else.

Out of scope for this epic: SOC2-style compliance programs; multi-region deployment.

## Tasks

### E11-T01 · Structured logging + error tracking `devops` `P2`
**Covers:** R-003
**Depends on:** —

Structured log lines (JSON in production: level, module, tenant_id, request id) behind a thin `server/log.ts` replacing bare `console.error` calls (keep the `[module]` convention as the module field); optional self-hostable error sink (e.g. Sentry-compatible DSN, direct REST per no-SDK discipline).

**Acceptance criteria:**
- Every request path failure carries tenant + request ids; Railway log search by tenant works.

### E11-T02 · Metrics + alerting `devops` `P2`
**Covers:** R-003
**Depends on:** E11-T01

`/metrics` (Prometheus text format, token-gated): request latency/status by route class, publish duration/failures, collab socket counts, cache hit rates, Redis/DB health. Alert rules for the failure modes seen so far (publish failure rate, socket disconnect storms, volume near-full).

**Acceptance criteria:**
- Dashboards show per-tenant publish health; a forced publish failure fires an alert in staging.

### E11-T03 · GDPR baseline `perm` `P2`
**Covers:** R-003
**Depends on:** —

Privacy policy + imprint pages (landing links from E04-T05 get real content), cookie usage documented (session cookie is strictly necessary — no consent banner needed until analytics exist), DPA template for tenants, data-export (existing site-transfer ZIP per tenant) and account/tenant deletion flows with defined retention (soft-delete → purge job), records-of-processing doc. EU data residency stated (Railway region pinned EU).

**Acceptance criteria:**
- Deletion request fully purges a tenant (DB rows, uploads, artefacts, backups noted) within the stated window; export produces a complete archive.

### E11-T04 · Backup & restore for the SaaS topology `devops` `P2`
**Covers:** R-003
**Depends on:** —

Scheduled Postgres backups (Railway PITR or pg_dump job to object storage) + uploads-volume backup; documented, TESTED restore runbook including per-tenant selective restore via the export format.

**Acceptance criteria:**
- A staged full restore succeeds from real backups; per-tenant restore drill documented with timings.

### E11-T05 · Data retention & cleanup jobs `db` `P2`
**Covers:** R-003
**Depends on:** E11-T03

Purge jobs for: expired sessions, old `login_attempts`, soft-deleted tenants past retention, orphaned publish slots/media variants. Additive migration only if a `deleted_at`/retention column is missing somewhere. **Source: coverage sweep.**

**Acceptance criteria:**
- Jobs run on schedule, are idempotent, and log counts; DB growth curves flatten in staging soak.

### E11-T06 · Status page + incident comms `ui` `P2`
**Covers:** R-003
**Depends on:** E11-T02

Minimal public status page (static, fed by the health/metrics endpoints; can live on the landing service) with component states for app/publishing/API.

**Acceptance criteria:**
- Forced staging outage reflects on the status page without manual editing.

### E11-T07 · Ops test coverage `test` `P2`
**Covers:** R-003
**Depends on:** E11-T01, E11-T05

Log-shape contract tests, metrics endpoint schema test, purge-job tests on seeded aged data, deletion-flow completeness test (asserts zero residual rows/files for a purged tenant).

**Acceptance criteria:**
- Green in CI; deletion completeness test enumerates every tenant-scoped table from the live schema so new tables can't be forgotten.

### E11-T08 · Operations docs `docs` `P2`
**Covers:** R-002, R-003
**Depends on:** E11-T01…T06

`docs/operations.md`: logging/metrics conventions, alert catalog, backup/restore runbooks, GDPR request handling, incident process.

**Acceptance criteria:**
- On-call can handle the top five incident types from the doc alone.
