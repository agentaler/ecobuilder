# E07 — Tenant-scoped data layer
Phase: P1 · Depends on: E06 · Requirements: R-003

Thread `tenant_id` through the content/media/plugin/publish schema and repositories. Audit: 36 of 38 tables have no tenant column; global unique indexes (`data_tables.slug`, `data_rows(table_id, slug)`, `data_row_redirects(from_route_base, from_slug)`, `media_assets.public_path`, `published_runtime_assets.public_path`) make two tenants with a page at `/about` impossible; two tables are schema-enforced singletons (`site_sync_state`, `active_media_variant_delegate`). All migrations additive, both dialects, with backfill to the E06 bootstrap tenant. Repositories gain a required `tenantId` parameter — no default, so the type system finds every call site.

Out of scope for this epic: request-time tenant resolution and per-tenant publish artefacts (E08); collab relay scoping (E08).

## Tasks

### E07-T01 · Add `tenant_id` to content tables `db` `P1`
**Covers:** R-003
**Depends on:** —

`site`, `data_tables`, `data_rows`, `data_row_versions`, `data_row_redirects`, `site_snapshots`, `collab_documents` (doc id gains a tenant prefix — see T04): additive `tenant_id` column (nullable, backfilled to bootstrap tenant, then enforced via new composite indexes). Replace global uniques with `(tenant_id, …)` composites via the established index-rebuild pattern.

**Acceptance criteria:**
- Two tenants can each own a `pages` table with an `/about` row; migration runs clean on a live-shaped DB in both dialects.

### E07-T02 · Add `tenant_id` to media + plugin tables `db` `P1`
**Covers:** R-003
**Depends on:** —

`media_assets` (+ `public_path` unique becomes per-tenant), `media_folders`, `media_asset_folders`, `media_smart_folders`, `media_usage_refs`, `published_runtime_assets`, `installed_plugins` (per-tenant install), `plugin_records`, `plugin_crash_events`, `plugin_schedules`, `plugin_schedule_runs`, `plugin_secrets`. Same backfill pattern.

**Acceptance criteria:**
- Tenant A installing a plugin does not surface it in tenant B; media paths collide safely across tenants.

### E07-T03 · Rebuild singleton tables as per-tenant `db` `P1`
**Covers:** R-003
**Depends on:** —

`site_sync_state` (`check (id = 1)`) and `active_media_variant_delegate` (`check (singleton = 1)`) become per-tenant rows via additive table-rebuild migrations (pattern from migrations 006/012/017). `active_media_storage_adapter` PK `(role)` → `(tenant_id, role)`.

**Acceptance criteria:**
- Per-tenant sync sequences advance independently; delegate election is per-tenant.

### E07-T04 · Tenant-prefixed collab doc ids `db` `struct` `P1`
**Covers:** R-003
**Depends on:** —

`src/core/collab/docIds.ts` doc ids `<kind>:<rowId>` → `<tenantId>:<kind>:<rowId>`; `collab_documents` PK migrated additively (new rows new format; read path accepts legacy ids mapped to the bootstrap tenant). Pub/sub topics `collab:<docId>` inherit the prefix, isolating fan-out per tenant.

**Acceptance criteria:**
- Two tenants editing "the" site shell produce independent Y docs; legacy docs still load for the bootstrap tenant.

### E07-T05 · Thread `tenantId` through repositories and CMS handlers `api` `P1`
**Covers:** R-003
**Depends on:** E07-T01…T04

Every repository function touching a tenant-scoped table takes `tenantId` (from the session's active tenant, E06-T08). `server/repositories/site.ts` loses its hardcoded `'default'`. Handlers never accept a tenant id from the request body — always from the session.

**Acceptance criteria:**
- `tsc` finds zero call sites passing no tenant; grep for `'default'` in repositories returns nothing.

### E07-T06 · Cross-tenant isolation gates `perm` `P1`
**Covers:** R-003
**Depends on:** E07-T05

Architecture-level test: every handler route exercised as tenant A cannot read or mutate tenant B's rows (fixture with two seeded tenants; assert 404/403, never data). This is the load-bearing security test of the whole conversion.

**Acceptance criteria:**
- Suite covers every CMS handler family (content, media, plugins, publish, AI, collab); a deliberately unscoped query fails it.

### E07-T07 · Per-tenant secrets audit `perm` `P1`
**Covers:** R-003
**Depends on:** E07-T02

`INSTATIC/ECOBUILDER_SECRET_KEY` is one master key per installation. For SaaS: derive per-tenant subkeys (HKDF with tenant id) for plugin secrets and AI credentials so a hypothetical tenant-scoped leak doesn't expose all tenants. Existing ciphertexts re-wrapped lazily on read. **Source: coverage sweep.**

**Acceptance criteria:**
- New encryptions use derived keys; legacy ciphertexts still decrypt; key-derivation test vectors committed.

### E07-T08 · Data-layer test sweep on both dialects `test` `P1`
**Covers:** R-003
**Depends on:** E07-T01…T05

Migration tests on realistic seeded data (bootstrap tenant + second tenant), composite-unique behavior, singleton rebuilds, collab id migration, repository scoping — all on SQLite and Postgres in CI.

**Acceptance criteria:**
- Green on both dialects; migration-parity gate still passes.

### E07-T09 · Data-model docs `docs` `P1`
**Covers:** R-002, R-003
**Depends on:** E07-T05

Update `docs/features/content-storage.md`, `site-shell.md`, `media.md`, `plugin-system.md`, `docs/reference/database-dialects.md` for tenant scoping; document the backfill/bootstrap-tenant story for self-hosted upgraders (their install just becomes a one-tenant SaaS-shaped DB).

**Acceptance criteria:**
- Docs describe the scoped schema; self-hosted upgrade path stated explicitly.
