# E06 — SaaS accounts: signup, social login, tenant model
Phase: P1 · Depends on: E03 · Requirements: R-003, R-009

The account-model foundation for multi-tenancy. Today there is NO self-service signup (one-shot `/setup` bootstrap), email is globally unique, a schema index enforces exactly one active owner per installation, and a user has exactly one installation-wide role. This epic introduces: public signup, OAuth social login, email verification, and the tenant/membership schema — `tenants` + `tenant_members(user_id, tenant_id, role_id)` — that every later epic scopes to. All schema work is additive per CLAUDE.md's migration rules, in both dialects.

Out of scope for this epic: threading `tenant_id` through content/media/publish tables (E07), host-based routing (E08), billing (E10).

## Tasks

### E06-T01 · Decision: Better Auth vs. extending in-house auth `struct` `P1`
**Covers:** R-009
**Depends on:** —

Spike + written ADR. In-house stack already owns sessions, MFA/TOTP, step-up, lockout, rate limiting, audit — Better Auth would replace all of it for OAuth convenience. Conservative recommendation encoded in following tickets: keep the in-house session model; add OAuth authorization-code flows (Google, GitHub; Apple optional) as thin handlers that terminate in the existing session issuance. Revisit only if provider matrix growth hurts.

**Acceptance criteria:**
- ADR with the decision, the rejected option's real costs, and the provider list for launch.

### E06-T02 · Tenancy schema: `tenants` + `tenant_members` `db` `P1`
**Covers:** R-003
**Depends on:** —

Additive migrations (both dialects, same ID): `tenants` (id, slug unique, name, status, settings_json, created_at), `tenant_members` (tenant_id, user_id, role_id, status, unique(tenant_id, user_id)). Backfill: create one tenant from the existing `site` row and membership rows for all existing users with their current roles. Roles stay global capability bundles; membership binds them per-tenant.

**Acceptance criteria:**
- Migration runs on a live-shaped DB; every existing user ends up a member of the backfilled tenant with an equivalent role.

### E06-T03 · Retire single-installation account constraints `db` `P1`
**Covers:** R-003
**Depends on:** E06-T02

Replace `users_single_active_owner_idx` (one active owner per installation) with a per-tenant owner rule enforced on `tenant_members`; keep `users.email_normalized` globally unique (one human = one account, member of many tenants — the standard SaaS shape). Constraint changes use the additive rebuild pattern established by migrations 006/012/017.

**Acceptance criteria:**
- Two tenants can each have an owner; a tenant cannot lose its last active owner (repository-level guard + test).

### E06-T04 · Self-service signup + email verification `api` `P1`
**Covers:** R-003, R-009
**Depends on:** E06-T02

`POST /signup`: create user (verified=false), tenant, owner membership in one transaction; verification email with expiring token; unverified accounts can log in but not publish. Requires an outbound email module (`server/email/`) with a provider driver over plain REST (Resend or SMTP — same no-SDK discipline as AI drivers) — provider choice is a sub-decision recorded in the task. The one-shot `/setup` flow remains for self-hosted mode behind a config switch (`SAAS_MODE`).

**Acceptance criteria:**
- Signup → verify → publish path works e2e; expired/reused tokens rejected; self-hosted setup flow unchanged when `SAAS_MODE` unset.

### E06-T05 · OAuth social login flows `api` `P1`
**Covers:** R-009
**Depends on:** E06-T01, E06-T04

Per the ADR: authorization-code + PKCE handlers for Google/GitHub, a `user_identities` table (provider, provider_user_id, user_id, unique(provider, provider_user_id)) — additive migration — with email-match account linking (only onto verified emails, else explicit link prompt). Terminates in the existing session issuance incl. MFA policy.

**Acceptance criteria:**
- New-user-via-Google and existing-user-link paths both work; an attacker with an unverified matching email cannot capture the account (test).

### E06-T06 · Signup/login UI `ui` `P1`
**Covers:** R-003, R-009
**Depends on:** E06-T04, E06-T05

Extend `AdminPreAuthForm` into a real auth surface: signup, login, social buttons, verification-pending state, password reset (also needs the email module), all on shared `src/ui` primitives with error toasts per the error rules.

**Acceptance criteria:**
- All states reachable and styled in both themes; failures produce envelope-message toasts, not raw errors.

### E06-T07 · Tenant switcher + membership management UI `ui` `P1`
**Covers:** R-003
**Depends on:** E06-T02

Workspace switcher in the admin shell (current tenant name, switch, create-new-tenant), members page (invite by email → invitation flow, change role, remove) gated by per-tenant `users.manage`.

**Acceptance criteria:**
- User in two tenants switches contexts with correctly scoped data; non-admin member sees no member management.

### E06-T08 · Session tenancy + capability checks become membership-aware `perm` `P1`
**Covers:** R-003
**Depends on:** E06-T02

Session carries an active `tenant_id`; `requireCapability`/`requireStepUp` resolve capabilities through `tenant_members` for the active tenant instead of `users.role_id`. `users.role_id` is retired from the auth path (column stays, per additive rules, until a cleanup migration).

**Acceptance criteria:**
- A user who is admin in tenant A and viewer in tenant B gets 403 on admin actions while B is active (integration test).

### E06-T09 · Auth/tenancy test suite `test` `P1`
**Covers:** R-003, R-009
**Depends on:** E06-T04…T08

Integration coverage: signup/verify, OAuth happy + attack paths, invitation flow, membership capability matrix, last-owner guard, `SAAS_MODE` off = current self-hosted behavior byte-for-byte.

**Acceptance criteria:**
- Suite green on both dialects in CI.

### E06-T10 · Auth & tenancy docs `docs` `P1`
**Covers:** R-002, R-003
**Depends on:** E06-T08

Rewrite `docs/features/auth-and-access.md` for the membership model, add signup/OAuth flows, `SAAS_MODE`, and the email module; update `docs/server.md` handler/repository tables; CLAUDE.md drops "self-hosted only" for "self-hostable + first-party SaaS".

**Acceptance criteria:**
- Docs match shipped behavior; capability catalog reflects per-tenant resolution.
