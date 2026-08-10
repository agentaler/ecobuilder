# E12 — URL model & super-admin console
Phase: P1 (URL model) / P2 (console) · Depends on: E06, E08 · Requirements: R-003, R-012

Today one host serves both a site's public pages (`/`) and its editor (`/admin`), because a single-tenant install *is* one site. Multi-tenancy splits those onto different hosts, which removes the reason the `/admin` prefix exists and creates a third surface that does not exist yet: the platform console the operator uses to run the business.

**Target model**

| Host | Serves | Audience |
|---|---|---|
| `app.ecobuilder.ai` | tenant workspace at `/` | customers |
| `<tenant>.ecobuilder.ai` / custom domain | that tenant's published site at `/` | visitors |
| `admin.ecobuilder.ai` | platform console | Ecobuilder staff |

**The security rule this epic exists to enforce:** platform administration is NOT a tenant capability. A super admin is a platform-level identity on its own host with its own session scope; it is never "an owner with more permissions". Otherwise any tenant-scoping bug in the capability system escalates into cross-tenant access.

Out of scope for this epic: the tenancy schema itself (E06/E07), host→tenant resolution (E08), domain provisioning (E09), billing mechanics (E10 — the console only *reads* billing state).

## Tasks

### E12-T01 · Decide the URL model and write it down `struct` `docs` `P1`
**Covers:** R-003
**Depends on:** —

ADR fixing: workspace at `/` on the app host; public sites at `/` on tenant hosts; console on a separate host. Also decides the API prefix question — `/admin/api/cms/*` is invisible to users, so renaming it is cosmetic churn with real migration cost; the ADR should state whether it stays (recommended) so nobody relitigates it per-PR.

**Acceptance criteria:**
- ADR merged covering all three surfaces, the API prefix decision, and the cookie-scope consequences below.

### E12-T02 · Serve the workspace at `/` on the app host `ui` `P1`
**Covers:** R-003
**Depends on:** E08-T02, E12-T01

On a host resolved as the app host, the SPA mounts at `/`; `/admin/*` 301s to the equivalent `/` path so existing links and bookmarks survive. The in-house router's base path becomes host-derived rather than the hardcoded `/admin`. Public-site routing stays untouched on tenant hosts.

**Acceptance criteria:**
- `https://app.ecobuilder.ai/` loads the workspace; `/admin`, `/admin/site`, `/admin/content/...` redirect to their `/` equivalents.
- Deep links inside the SPA no longer contain `/admin`.

### E12-T03 · Widen the session cookie path safely `perm` `P1`
**Covers:** R-003
**Depends on:** E12-T02

The session cookie is `Path=/admin` today; a workspace at `/` cannot read it. Widen to `Path=/`, reading the old cookie for one release so live sessions survive the change (same dual-read pattern as the cookie rename in E02-T02). Re-check CSRF origin handling and `SameSite` under the new scope.

**Acceptance criteria:**
- A session created before the deploy still works after it; new logins set only the `/`-scoped cookie.
- CSRF tests pass for the workspace host; the cookie is never sent to tenant public hosts.

### E12-T04 · Platform-admin identity, separate from tenant roles `db` `perm` `P2`
**Covers:** R-012
**Depends on:** E06-T02

Additive migration adding a platform-level flag (e.g. `users.platform_role`) that is deliberately NOT part of `tenant_members` or the capability bundles. A dedicated guard (`requirePlatformAdmin`) gates every console route, independent of `requireCapability`. Granting it is an explicit operation with an audit event.

**Acceptance criteria:**
- A tenant owner with every capability is refused by `requirePlatformAdmin`.
- Architecture test: no console route is reachable through the tenant capability path.

### E12-T05 · Console host and shell `ui` `P2`
**Covers:** R-012
**Depends on:** E12-T04, E08-T02

`admin.ecobuilder.ai` resolves to the console rather than any tenant. Its own login, its own cookie name and scope (never shared with the workspace host), and a shell that visually cannot be mistaken for a tenant workspace.

**Acceptance criteria:**
- Console host serves no tenant content; workspace host serves no console route.
- A workspace session cannot authenticate against the console, and vice versa.

### E12-T06 · Tenant list, detail and lifecycle `ui` `api` `P2`
**Covers:** R-012
**Depends on:** E12-T05

Search tenants; per-tenant detail (owner, members, domains, plan, usage, created/last active); lifecycle actions: suspend, unsuspend, close with retention window.

**Acceptance criteria:**
- Suspending a tenant blocks its workspace and stops serving its public sites, reversibly, with an audit event.

### E12-T07 · Support access with consent and full audit `perm` `P2`
**Covers:** R-012
**Depends on:** E12-T06

Staff sometimes need to see a tenant's workspace to help. Impersonation is the highest-risk feature in any SaaS, so: time-boxed, reason recorded, visible banner in the impersonated session, every action attributed to the real staff identity in the audit log, and — per GDPR — the tenant is notified. No silent access.

**Acceptance criteria:**
- Impersonated sessions expire automatically and cannot perform billing or destructive account actions.
- Audit shows both identities for every impersonated action; the tenant receives a notification.

### E12-T08 · Platform health and revenue view `ui` `P2`
**Covers:** R-012
**Depends on:** E12-T05, E10-T02

Signups, active tenants, publish volume and failure rate, subscription status and MRR — read-only, sourced from existing tables and the metrics endpoint (E11-T02).

**Acceptance criteria:**
- Figures reconcile with Stripe and the database; no write paths.

### E12-T09 · Console tests and docs `test` `docs` `P2`
**Covers:** R-012, R-002
**Depends on:** E12-T04…T08

Isolation tests (tenant session ↔ console session cannot cross), impersonation guard tests, suspension effect tests, plus `docs/features/super-admin.md` and an operator runbook for suspend/close/support-access.

**Acceptance criteria:**
- Suite green; runbook lets a new operator handle suspension and a support-access request unaided.
