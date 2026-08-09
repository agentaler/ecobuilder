# E08 — Tenant-aware runtime & publishing
Phase: P2 · Depends on: E07 · Requirements: R-003

Make the request path and publish pipeline serve many tenants from one deployment. Audit: routing is path-only (no handler reads Host), publish state is process-global (`publishVersion` module `let`, one A/B artefact slot pair, one render LRU, one publish lock), and `UPLOADS_DIR` is a single global root. This epic adds host→tenant resolution at the top of `handleServerRequest`, partitions storage/caches by tenant, and builds on E03's Redis layer for cross-instance correctness.

Out of scope for this epic: how tenants GET domains (subdomain provisioning/custom domains/purchase — E09); plan-based limits (E10).

## Tasks

### E08-T01 · Tenant domain mapping table `db` `P2`
**Covers:** R-003
**Depends on:** —

Additive `tenant_domains` (id, tenant_id, hostname unique, kind: subdomain|custom, verified_at, is_primary). Seed the bootstrap tenant's Railway/app domains. E09 fills it from provisioning flows.

**Acceptance criteria:**
- Hostname lookup resolves tenant in one indexed query; per-tenant primary uniqueness enforced.

### E08-T02 · Host-based tenant resolution in the router `api` `P2`
**Covers:** R-003
**Depends on:** E08-T01

Top of `handleServerRequest`: resolve `Host` (with trusted `X-Forwarded-Host` per `TRUSTED_PROXY_CIDRS`) → tenant context; cached (Redis + in-process, invalidated on domain changes). Admin/API routes take tenant from session (E06-T08) and ignore Host; public routes REQUIRE a domain-mapped tenant; unknown hosts get a branded 404. Self-hosted single-tenant mode: one implicit tenant, zero behavior change.

**Acceptance criteria:**
- Same path on two mapped domains serves each tenant's content; unknown host never leaks any tenant's pages.

### E08-T03 · Per-tenant publish artefact storage `struct` `P2`
**Covers:** R-003
**Depends on:** E08-T02

`staticArtefact.ts` layout gains a tenant segment: `<UPLOADS_DIR>/tenants/<tenantId>/published/{a,b,current}`; media under `<UPLOADS_DIR>/tenants/<tenantId>/…`. `uploadsDir` threading (already an explicit parameter chain) carries a tenant-scoped root. Bootstrap tenant's existing artefacts/media migrated by a one-time startup move (idempotent).

**Acceptance criteria:**
- Publishing tenant A never touches tenant B's slots; legacy layout auto-migrates once; `/uploads/*` serving respects tenant roots.

### E08-T04 · Per-tenant publish version, lock, and caches `struct` `P2`
**Covers:** R-003
**Depends on:** E03-T04, E03-T05, E08-T02

`publishVersion` and `withPublishLock` become per-tenant (Redis-keyed via E03); render LRU key gains `tenantId`; CSS fallback memo and `getSetupStatusCached` re-scoped or removed. `bumpPublishVersion(tenantId)` evicts only that tenant.

**Acceptance criteria:**
- Publish for tenant A does not evict tenant B's cached renders (test); concurrent publishes across tenants run in parallel, within a tenant serialize.

### E08-T05 · Tenant-scope the plugin sandbox and MCP surface `perm` `P2`
**Covers:** R-003
**Depends on:** E08-T02

QuickJS plugin runtime context, plugin RPC (`cms.content.tree.mutate` etc.), scheduler runs, and the MCP tool engine all execute with an explicit tenant context; `networkAllowedHosts` and grantedPermissions evaluated per tenant install. MCP connector tokens bind to (user, tenant).

**Acceptance criteria:**
- A plugin installed by tenant A cannot read tenant B rows even via raw RPC (isolation test); MCP publish tool publishes only the bound tenant.

### E08-T06 · Admin surfaces for public-domain awareness `ui` `P2`
**Covers:** R-003
**Depends on:** E08-T02

Editor preview links, "view site" affordances, and publish-success toasts use the tenant's primary domain instead of relative paths/hardcoded origin.

**Acceptance criteria:**
- Publish toast links to the right domain per tenant; preview works from admin regardless of admin's own host.

### E08-T07 · Multi-tenant runtime test suite `test` `P2`
**Covers:** R-003
**Depends on:** E08-T02…T05

Two-tenant integration fixture: host routing, artefact isolation on disk, cache isolation, collab isolation over real websockets, plugin/MCP scoping; plus the E00 production-like container smoke extended to two tenants.

**Acceptance criteria:**
- Green in CI on both dialects with Redis service.

### E08-T08 · Load sanity for shared-process tenancy `test` `P2`
**Covers:** R-003
**Depends on:** E08-T04

Bench (`scripts/bench`) scenario: N tenants publishing + serving concurrently; assert no cross-tenant cache pollution and acceptable p95 vs single-tenant baseline. **Source: coverage sweep.**

**Acceptance criteria:**
- Documented baseline numbers; regression threshold wired into the bench harness.

### E08-T09 · Runtime architecture docs `docs` `P2`
**Covers:** R-002, R-003
**Depends on:** E08-T02…T05

Rewrite `docs/features/publisher.md` (per-tenant layers A/B/C), `docs/server.md` (tenant resolution in the request lifecycle), `docs/architecture.md` topology diagram.

**Acceptance criteria:**
- Docs match shipped behavior including the self-hosted implicit-tenant mode.
