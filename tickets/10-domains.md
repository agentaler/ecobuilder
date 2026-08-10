# E09 — Domains: tenant subdomains, custom connect, purchase
Phase: P2 · Depends on: E08 · Requirements: R-010

Domain scheme decided by the user (2026-08-10): free tenant sites at `<tenant>.ecobuilder.ai`, with custom domains mapped on top.

Every tenant needs a public address the moment they sign up, an easy path to connect a domain they already own, and a buy-a-domain-from-us flow. Open question 3 is settled — free tenant addresses are `<tenant>.ecobuilder.ai`, siblings of the workspace and console rather than a separate TLD, so the cookie/phishing isolation that a separate TLD would have given for free must be engineered explicitly (E09-T09). Open question 4 (registrar reseller API) still needs a decision ticket first.

Out of scope for this epic: email/DNS hosting for purchased domains beyond what the site needs; domain transfers away (documented manual process initially).

## Tasks

### E09-T01 · Decisions: wildcard DNS/TLS + registrar provider `db` `P2`
**Covers:** R-010
**Depends on:** —

ADR settling: (a) wildcard DNS + wildcard TLS for `*.ecobuilder.ai` (the free tenant address domain, per the user's decision) — note the certificate implications: a wildcard cert covers one label level, so `<tenant>.ecobuilder.ai` is covered but nothing deeper; (b) the registrar reseller (evaluate OpenSRS, Namecheap API, Gandi resale — criteria: EU TLD coverage incl. .fr/.de/.eu, API quality, wholesale pricing, GDPR/WHOIS handling); (c) where TLS terminates for custom domains on Railway (platform certs vs fronting proxy).

**Acceptance criteria:**
- ADR merged; test registrar account exists; wildcard domain live for staging.

### E09-T02 · Auto-provision `<tenant>.ecobuilder.ai` at signup `api` `P2`
**Covers:** R-010
**Depends on:** E09-T01, E08-T01

Signup (E06-T04) claims the tenant slug as a subdomain: validation (reserved words, length, homograph safety), `tenant_domains` row kind=subdomain verified immediately, rename flow with old-subdomain redirect grace.

**Acceptance criteria:**
- New tenant's site is live at their subdomain immediately after first publish; reserved names (www, admin, api…) rejected.

### E09-T03 · Custom domain connect flow `api` `devops` `P2`
**Covers:** R-010
**Depends on:** E08-T01, E09-T01

`tenant_domains` kind=custom lifecycle: pending → verified (TXT challenge) → active (CNAME/ALIAS detected, TLS issued per T01 decision). Background re-checker with backoff; clear failure states (wrong record, CAA blocks issuance, apex vs subdomain guidance).

**Acceptance criteria:**
- Happy path from "add domain" to serving with TLS needs nothing but two DNS records; every failure state carries an actionable message.

### E09-T04 · Domain settings UI `ui` `P2`
**Covers:** R-010
**Depends on:** E09-T02, E09-T03

Tenant settings → Domains: current subdomain (+ rename), connect-custom-domain wizard showing exact records to add with live verification status, set-primary, remove. Uses shared primitives; statuses poll via the existing async-resource pattern.

**Acceptance criteria:**
- A non-technical user can connect a domain following only on-screen instructions; status updates without reload.

### E09-T05 · Domain purchase flow `ui` `api` `P2`
**Covers:** R-010
**Depends on:** E09-T01, E10-T02

Search availability (registrar API), price display (EUR, margin per business decision), purchase via the billing rails (E10 Stripe payment), then auto-configure: registrar DNS pointed at the tenant's site, `tenant_domains` row created and activated with zero manual DNS work. Registrant contact/WHOIS data collected per TLD policy (GDPR-aware defaults).

**Acceptance criteria:**
- Sandbox-mode e2e: search → buy → domain live on the tenant site with no manual steps; failed payment leaves no half-registered domain.

### E09-T06 · Domain abuse + security guards `perm` `P2`
**Covers:** R-010
**Depends on:** E09-T02, E09-T03

Rate-limit domain claims, block connecting domains verified by another tenant, takeover protection on subdomain rename/release (cooldown before reuse), audit events for every domain mutation. **Source: coverage sweep.**

**Acceptance criteria:**
- Isolation tests: tenant B cannot claim/verify tenant A's domain; released subdomains unclaimable during cooldown.

### E09-T07 · Domain lifecycle test suite `test` `P2`
**Covers:** R-010
**Depends on:** E09-T02…T06

Registrar API mocked at the HTTP boundary (TypeBox-validated fixtures); DNS verification tested against a stub resolver; renewal/expiry webhook handling covered.

**Acceptance criteria:**
- Full lifecycle green in CI without external calls; a contract-drift fixture test guards the registrar wire format.

### E09-T08 · Domains docs `docs` `P2`
**Covers:** R-002, R-010
**Depends on:** E09-T04, E09-T05

User-facing help (connect vs buy, records tables per registrar), operator runbook (wildcard cert rotation, registrar account, stuck-verification triage).

**Acceptance criteria:**
- Support can resolve the top failure modes from the runbook alone.

### E09-T09 · Isolate the workspace and console from tenant subdomains `perm` `P2`
**Covers:** R-010, R-012
**Depends on:** E09-T01

Tenant sites live at `<tenant>.ecobuilder.ai`, siblings of the workspace and console under one registrable domain. Browsers treat sibling subdomains as *related domains*: a tenant who can run script on their own subdomain can set cookies scoped to `.ecobuilder.ai`, and those cookies are sent to `app.` and `admin.`. This task makes that unexploitable.

Required, all of them:
- **Never set a `Domain=` attribute on any authentication cookie.** Host-only cookies are the baseline; a domain-wide session cookie here would be handed to every tenant site.
- **Use the `__Host-` prefix** for the session and console cookies. The browser then refuses the cookie unless it is Secure, `Path=/` and host-only — which structurally blocks a sibling subdomain from overwriting it (cookie tossing / session fixation).
- **Distinct cookie names** for workspace and console, so neither can be replayed against the other.
- **`SameSite=Strict`** on authentication cookies: sibling subdomains are same-site, so `Lax` does not protect these flows.
- **Keep the strict `Origin` check** on state-changing requests (already implemented via `PUBLIC_ORIGIN`) and assert tenant hosts are never in the workspace's allowed origins.
- **Reserve subdomains** that could impersonate first-party surfaces: `app`, `admin`, `www`, `api`, `mail`, `login`, `account`, `billing`, `status`, `cdn`, `assets`, `static` (extend in E09-T02's reserved list).
- **Do not serve tenant content from the apex** `ecobuilder.ai` — it stays the marketing site, so no tenant script ever runs on the registrable domain itself.

**Acceptance criteria:**
- A cookie set with `Domain=.ecobuilder.ai` from a tenant subdomain is not accepted as a session by the workspace or the console (integration test with a simulated hostile tenant subdomain).
- Session and console cookies carry the `__Host-` prefix and no `Domain` attribute; a test asserts both, so a future change cannot silently widen them.
- Tenant hostnames never appear in the workspace/console allowed-origin set.
