# Ecobuilder — Engineering Backlog
Generated from: user directives (2026-08-09 session), CLAUDE.md, codebase audit (tenancy + naming sweeps, 2026-08-09)
Scope: P0 (stabilize + rename + infra + landing) → P1 (SaaS foundation) → P2 (multi-tenant runtime, domains, billing, ops)

Requirement IDs below were assigned by this analysis (no formal PRD exists).

## Requirements index

| ID | Requirement | Phase |
|----|-------------|-------|
| R-001 | Rename product to **Ecobuilder** across CLAUDE.md/AGENTS.md, UI, package metadata | P0 |
| R-002 | All documentation updated to match rename and new architecture | P0–P2 |
| R-003 | Convert from self-hosted single-tenant to **multi-tenant SaaS** | P1–P2 |
| R-004 | Landing page similar to instapage.com; eco-friendly positioning; Europe market | P0 |
| R-005 | Landing page bilingual: English + French | P0 |
| R-006 | Auto-detect visitor language from location/browser | P0 |
| R-007 | Landing hosted at **ecobuilder.ai** as a separate Railway service | P0 |
| R-008 | app.ecobuilder.ai runs on **Postgres + Redis** | P0 |
| R-009 | Social login (Better Auth or similar) | P1 |
| R-010 | Tenants can **connect their own domain or buy a domain from us** easily | P2 |
| R-011 | Publish (site + posts) works reliably on the hosted deployment | P0 |

## Epics & build order

| # | Epic | Phase | Depends on | Tasks | Requirements |
|---|------|-------|------------|-------|--------------|
| E00 | Production stabilization (publish bug) | P0 | — | 5 | R-011 |
| E01 | Rename — product surface | P0 | — | 8 | R-001, R-002 |
| E02 | Rename — technical namespaces | P1 | E01 | 7 | R-001, R-002 |
| E03 | Infra: Postgres + Redis for app.ecobuilder.ai | P0 | E00 | 8 | R-008 |
| E04 | Landing page — build & content | P0 | — | 8 | R-004 |
| E05 | Landing page — i18n, geo-detection, SEO, deploy | P0 | E04 | 9 | R-005, R-006, R-007 |
| E06 | SaaS accounts: signup, social login, tenant model | P1 | E03 | 10 | R-003, R-009 |
| E07 | Tenant-scoped data layer | P1 | E06 | 9 | R-003 |
| E08 | Tenant-aware runtime & publishing | P2 | E07 | 9 | R-003 |
| E09 | Domains: tenant subdomains, custom connect, purchase | P2 | E08 | 8 | R-010 |
| E10 | Billing & plans | P2 | E06 | 7 | R-003 |
| E11 | SaaS operations: observability, GDPR, limits, backups | P2 | E03 | 8 | R-003 |

Added coverage dimension: `i18n` (landing-page localization and locale routing). Checklist: translated copy completeness, locale routing/URLs, hreflang, language detection & override, persisted preference, date/number formats.

## Coverage matrix

| Epic | ui | api | db | perm | struct | test | devops | docs | i18n |
|------|----|-----|----|------|--------|------|--------|------|------|
| E00 | T04 | N/A¹ | N/A¹ | N/A¹ | N/A¹ | T03 | T02,T05 | T05 | N/A² |
| E01 | T02,T03 | N/A³ | N/A³ | N/A³ | T01 | T07 | T06 | T04,T05,T08 | N/A² |
| E02 | N/A⁴ | T02,T03 | N/A⁵ | N/A⁴ | T01,T04 | T06 | T05 | T07 | N/A² |
| E03 | N/A⁶ | N/A⁶ | T02,T03 | N/A⁶ | T04 | T06,T07 | T01,T05,T08 | T08 | N/A² |
| E04 | T02–T06 | T07 | N/A⁷ | N/A⁷ | T01 | T08 | N/A⁸ | T08 | N/A⁹ |
| E05 | T03,T04 | T02 | N/A⁷ | N/A⁷ | T01 | T06 | T07,T08 | T09 | T01–T05 |
| E06 | T06,T07 | T04,T05 | T02,T03 | T08 | T01 | T09 | N/A¹⁰ | T10 | N/A² |
| E07 | N/A¹¹ | T05 | T01–T04 | T06,T07 | N/A¹¹ | T08 | N/A¹⁰ | T09 | N/A² |
| E08 | T06 | T02 | T01 | T05 | T03,T04 | T07,T08 | N/A¹⁰ | T09 | N/A² |
| E09 | T04,T05 | T02,T03 | T01 | T06 | N/A¹² | T07 | T03 | T08 | N/A² |
| E10 | T04 | T02,T03 | T01 | T05 | N/A¹² | T06 | N/A¹⁰ | T07 | N/A² |
| E11 | T06 | N/A¹³ | T05 | T03 | N/A¹² | T07 | T01,T02,T04 | T08 | N/A² |

¹ N/A: diagnosis epic — root cause unknown until E00-T01; follow-on tasks land in the dimension the cause implicates.
² N/A: admin-product epic; admin UI i18n is an explicit non-goal for now.
³ N/A: product-surface rename touches strings/docs only; wire formats unchanged by design in this epic.
⁴ N/A: namespace rename is server/build-level; no UI or permission changes.
⁵ N/A: DB stores no `instatic` strings in schema or system rows (audit finding: `user_preferences` keys are unprefixed).
⁶ N/A: infrastructure epic; no UI, endpoint, or permission surface changes.
⁷ N/A: landing page is static marketing content — no database, no authenticated surface.
⁸ deploy covered by E05 (single deploy pipeline for the landing service).
⁹ i18n handled entirely in E05 to keep one epic owning locale correctness.
¹⁰ devops changes for SaaS land centrally in E11 (observability/limits) and E03 (infra).
¹¹ E07 is data-layer only by design; runtime/UI threading is E08.
¹² no new packages/modules beyond those introduced by the epic's api/db tasks.
¹³ observability is infra + code instrumentation, no new public API.

## Traceability

| Requirement | Tasks | Notes |
|-------------|-------|-------|
| R-001 | E01-T01…T08, E02-T01…T07 | product surface first, technical namespaces second |
| R-002 | E01-T04,T05,T08; E02-T07; E03-T08; E05-T09; E06-T10; E07-T09; E08-T09; E09-T08; E10-T07; E11-T08 | docs tracked per-epic |
| R-003 | E06-*, E07-*, E08-*, E10-*, E11-* | phased conversion |
| R-004 | E04-T01…T08 | |
| R-005 | E05-T01,T02,T05 | |
| R-006 | E05-T02,T03 | |
| R-007 | E05-T07,T08 | |
| R-008 | E03-T01…T08 | |
| R-009 | E06-T01,T04,T05,T06 | |
| R-010 | E09-T01…T08 | |
| R-011 | E00-T01…T05 | |

### Unmapped requirements
None — all requirements in scope are covered.

## Open questions

1. **Better Auth vs. extending in-house auth** (R-009). Better Auth would replace a mature in-house session/MFA/step-up stack and add a large dependency; the conservative reading encoded in E06 is: keep the in-house session model, add OAuth (Google, GitHub, Apple) provider flows to it, and revisit Better Auth only if provider count grows. E06-T01 is the decision ticket.
2. **Existing production data** (E03). app.ecobuilder.ai currently runs on SQLite with (apparently) only setup-time data. Tickets assume it is acceptable to re-run setup on Postgres rather than build a SQLite→PG data migration tool. Confirm before E03-T03.
3. **Tenant public-site subdomain scheme** (E08/E09). Tickets assume `<tenant>.ecobuilder.site` (separate TLD from the app/landing domains, standard SaaS practice for cookie/security isolation). Needs domain purchase + wildcard DNS decision.
4. **Domain purchase provider** (R-010). Tickets assume a reseller API (Namecheap/OpenSRS/Gandi or Cloudflare Registrar-style). E09-T01 is the decision ticket; pricing margin is a business decision.
5. **Billing scope** (E10). User directives (2026-08-09): undercut Instapage to win customers, with a strong annual discount — Create €29/mo annual (€39 monthly), Optimize €59/mo annual (€79 monthly), Convert custom — all with a 14-day free trial, 25% annual saving. Sell on eco + AI + effortless setup. Stripe assumed (connector already attached). E10-T01 confirms limits per tier.
6. **Open-source status.** User directive (2026-08-09): Ecobuilder is a **closed-source commercial SaaS**, not open source. The repo currently carries an open-source LICENSE, public GitHub positioning, README/CONTRIBUTING language, and CLAUDE.md's "self-hosted, open-source" description — all need a repositioning pass (folded into E01), and the repository likely needs to become private. Legal review of the upstream license obligations (the codebase originates from the Instatic open-source project) is REQUIRED before relicensing — flag to the user.
7. **`/_instatic/*` public namespaces** (E02). Renaming URL prefixes baked into published HTML requires dual-serving + republish. Tickets encode: rename env vars and CLI now; keep wire-level namespaces (`/_instatic/*`, `<instatic-hole>`, `@instatic/*` import specifiers) until a dedicated migration window — they are invisible to end users.
8. **Admin UI localization** is treated as out of scope (landing page only gets FR). Flag if the product itself must be bilingual.

## Out of scope (stated or conservative)

- Admin/editor UI translation (only the landing page is bilingual for now).
- Migrating existing self-hosted installations to the SaaS (they continue as self-hosted; CLAUDE.md's additive-migration rule still applies to shared migrations).
- Mobile apps, native SDKs, additional languages beyond EN/FR.
- Renaming wire-level namespaces baked into published HTML (deferred — open question 6).
