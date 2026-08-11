# E03 — Infra: Postgres + Redis for app.ecobuilder.ai
Phase: P0 · Depends on: E00 · Requirements: R-008

Move the production Railway deployment from SQLite-on-volume to Railway Postgres, and introduce Redis as a first-class cache/coordination layer. The codebase already has a full Postgres adapter (`DATABASE_URL` selects the dialect; migration parity is gated), so the DB move is infra + data. Redis is NEW code: today the render cache, rate limits, publish lock, and setup-status memo are all in-process singletons — acceptable for one container, and the exact things that must leave process memory before multi-instance/multi-tenant operation (E08 builds on this).

Out of scope for this epic: per-tenant cache partitioning (E08), collab relay scale-out across instances.

## Tasks

### E03-T01 · Provision Railway Postgres + Redis services `devops` `P0`
**Covers:** R-008
**Depends on:** —

Add Railway Postgres and Redis services to the `ecobuilder` project; wire `DATABASE_URL=${{Postgres.DATABASE_URL}}` and a new `REDIS_URL` reference on the app service. Keep the volume — uploads/published artefacts stay on disk.

**Acceptance criteria:**
- App boots against Postgres (migrations run on start); `railway status` shows all three services healthy.

### E03-T02 · Decide + execute the SQLite→Postgres cutover `db` `P0`
**Covers:** R-008
**Depends on:** E03-T01

Open question 2: current SQLite has ~setup-only data. Conservative plan encoded here: export via the existing site-transfer ZIP (`docs/features/site-transfer.md`), re-run setup on Postgres, import. If the user confirms data is disposable, plain re-setup suffices. Do NOT build a generic SQLite→PG migrator for one row of real data.

**Acceptance criteria:**
- Production admin account works on Postgres; site content (if any worth keeping) is present; SQLite file retired from the boot path.

### E03-T03 · Introduce a Redis client module with typed cache interface `db` `struct` `P0`
**Covers:** R-008
**Depends on:** E03-T01

New `server/cache/` module owning the Redis connection (Bun's `Bun.redis` client — no heavyweight ORM-ish deps), with a narrow interface: get/set/del with TTL, atomic incr for rate limits, and a pub/sub handle reserved for E08. `REDIS_URL` optional in config: absent → in-process fallback implementations, so self-hosters and `bun run dev` need no Redis. TypeBox-validate anything deserialized from Redis at the boundary.

**Acceptance criteria:**
- `bun run dev` works with no Redis; with `REDIS_URL` set, cache round-trips hit Redis (verified by test).
- Architecture test: only `server/cache/` imports the Redis client.

### E03-T04 · Move render cache (Layer B) behind the cache interface `struct` `P0`
**Covers:** R-008
**Depends on:** E03-T03

`server/publish/renderCache.ts` LRU keyed `(urlPath, canonicalQuery, publishVersion)` gains a Redis-backed implementation (in-process LRU stays as the no-Redis fallback and L1). `bumpPublishVersion()` must invalidate across instances — version key in Redis rather than module-level `let` when Redis is present.

**Acceptance criteria:**
- Publish on instance A evicts cached renders served by instance B (two-process integration test).
- Single-instance no-Redis behavior byte-identical to today.

### E03-T05 · Move login/form rate limits and publish lock to Redis `devops` `P0`
**Covers:** R-008
**Depends on:** E03-T03

`server/auth/rateLimit.ts` buckets and `withPublishLock` become Redis-backed (SET NX + expiry for the lock) when Redis is configured, keeping in-process fallbacks. **Source: coverage sweep** — these are correctness holes the moment a second instance exists.

**Acceptance criteria:**
- Concurrent publishes from two processes serialize; rate-limit counters shared across processes (tests prove both).

### E03-T06 · Postgres CI job `test` `P0`
**Covers:** R-008
**Depends on:** —

CI currently exercises SQLite by default. Add a job (or matrix leg) running the server test suite against a Postgres service container so dialect drift is caught pre-deploy, now that production runs PG.

**Acceptance criteria:**
- CI runs green on both dialects; a deliberate PG-ism fails the PG leg.

### E03-T07 · Redis integration tests `test` `P0`
**Covers:** R-008
**Depends on:** E03-T03, E03-T04, E03-T05

Test the cache interface against a real Redis in CI (service container): TTL expiry, version-bump invalidation, lock contention, rate-limit atomicity, and the fallback path with `REDIS_URL` unset.

**Acceptance criteria:**
- Suite green in CI with and without the Redis container.

### E03-T08 · Update deployment docs + Railway guide for the new topology `devops` `docs` `P0`
**Covers:** R-008, R-002
**Depends on:** E03-T02

`docs/deployment/railway.md` gains the three-service topology (app + Postgres + Redis), `REDIS_URL`, backup guidance (PG backups replace SQLite-file copy; volume still holds uploads/artefacts). `docs/deployment/backup-restore.md` updated to match.

**Acceptance criteria:**
- A fresh operator can stand up the full topology from the doc alone.
