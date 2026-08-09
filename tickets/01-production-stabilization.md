# E00 — Production stabilization (publish bug)
Phase: P0 · Depends on: — · Requirements: R-011

Publishing (site and posts) does not work on the deployed app.ecobuilder.ai instance, while the identical flow verified clean locally (setup → login → step-up → publish → public page served). Root-causing and fixing this precedes everything else: the SaaS pivot is pointless if the hosted product can't publish. Known signals: the public root has never served a published artefact; Railway logs show `[collab] dropped malformed awareness frame`, and ALL edits flow through the Yjs collab WebSocket (there is no client-side save pipeline), so a broken socket on Railway silently loses drafts.

Out of scope for this epic: multi-tenant publish changes (E08), Redis render cache (E03).

## Tasks

### E00-T01 · Root-cause failed publish on Railway `devops` `P0`
**Covers:** R-011
**Depends on:** —

Reproduce the failure on app.ecobuilder.ai while tailing `railway logs`. Verify in order: (1) collab WebSocket connects and persists edits through Railway's proxy (draft survives reload); (2) step-up dialog completes on publish; (3) `publishDraftSite` writes artefacts to `/app/storage/uploads/published/` (volume, running as root via `RAILWAY_RUN_UID=0`); (4) runtime dependency install (`server/publish/runtime/dependencyCache.ts`) succeeds inside the container. Capture the failing layer and exact error.

**Acceptance criteria:**
- A written diagnosis naming the failing layer with the log/trace proving it.
- Reproduction steps that fail before the fix and pass after.

### E00-T02 · Fix the identified publish failure `devops` `P0`
**Covers:** R-011
**Depends on:** E00-T01

Implement the fix for whatever T01 identifies (candidate areas: WS framing through Railway's proxy in `server/collab/socket.ts`, volume permissions, publish-time dependency install network/cache paths). Fix at the source per CLAUDE.md — no retry band-aids around a broken layer.

**Acceptance criteria:**
- Publishing a page and a post from the live admin succeeds; public URLs serve the content (HTTP 200 with published HTML, not `{"error":"Not found"}`).
- Redeploy + republish keeps working (A/B slot swap survives container restart).

### E00-T03 · Add an e2e publish smoke test that runs against a production-like container `test` `P0`
**Covers:** R-011
**Depends on:** E00-T02

Playwright (or scripted API) flow: setup → login → edit via collab socket → publish → assert public HTML, run against the Docker image (compose) rather than `bun run dev`, so proxy/volume/permission differences are exercised. **Source: coverage sweep.**

**Acceptance criteria:**
- Test fails on the pre-fix image, passes post-fix, and runs in CI behind a label or nightly job.

### E00-T04 · Surface publish failures to the operator `ui` `P0`
**Covers:** R-011
**Depends on:** E00-T01

Whatever failed did so silently (no server error logs). Ensure every failure path in `publishDraftSite`/`publishDataRow` and the collab relay logs `console.error('[publish]', …)` server-side and surfaces a toast with the envelope message client-side — including WS persistence failures, which today can drop edits without any signal. **Source: coverage sweep.**

**Acceptance criteria:**
- Forcing each failure mode (socket drop, disk write error, runtime build error) produces one server error log and one user-visible toast.

### E00-T05 · Document Railway ops learnings `devops` `docs` `P0`
**Covers:** R-011, R-002
**Depends on:** E00-T02

Fold the root cause + fix into `docs/deployment/railway.md` troubleshooting table so self-hosters on Railway don't rediscover it.

**Acceptance criteria:**
- Troubleshooting row exists with symptom → check → fix.
