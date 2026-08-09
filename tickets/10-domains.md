# E09 — Domains: tenant subdomains, custom connect, purchase
Phase: P2 · Depends on: E08 · Requirements: R-010

Every tenant needs a public address the moment they sign up, an easy path to connect a domain they already own, and a buy-a-domain-from-us flow. Encodes open question 3 (default free address scheme `<tenant>.ecobuilder.site` on a separate TLD from app/landing for cookie + phishing isolation) and open question 4 (registrar reseller API — decision ticket first).

Out of scope for this epic: email/DNS hosting for purchased domains beyond what the site needs; domain transfers away (documented manual process initially).

## Tasks

### E09-T01 · Decisions: free-subdomain TLD + registrar provider `db` `P2`
**Covers:** R-010
**Depends on:** —

ADR settling: (a) the free tenant address domain (proposal: `ecobuilder.site`, purchased + wildcard-DNS'd + wildcard TLS via the platform/Caddy); (b) the registrar reseller (evaluate OpenSRS, Namecheap API, Gandi resale — criteria: EU TLD coverage incl. .fr/.de/.eu, API quality, wholesale pricing, GDPR/WHOIS handling); (c) where TLS terminates for custom domains on Railway (platform certs vs fronting proxy).

**Acceptance criteria:**
- ADR merged; test registrar account exists; wildcard domain live for staging.

### E09-T02 · Auto-provision `<tenant>.ecobuilder.site` at signup `api` `P2`
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
