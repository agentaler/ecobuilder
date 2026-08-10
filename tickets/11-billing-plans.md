# E10 — Billing & plans
Phase: P2 · Depends on: E06 · Requirements: R-003

SaaS requires paid plans; a Stripe connector is already attached to the workspace, so Stripe is assumed (open question 5 — plan structure/pricing is a business decision that gates T01). Integration follows the repo's no-SDK discipline: direct REST + webhooks, TypeBox-validated at the boundary, no `stripe` npm package unless the ADR argues otherwise.

Out of scope for this epic: usage-based metering beyond plan limits; invoicing localization beyond Stripe's built-ins; domain purchase pricing (E09-T05 consumes the payment rails built here).

## Tasks

### E10-T01 · Decision: plan matrix + limit dimensions `db` `P2`
**Covers:** R-003
**Depends on:** —

Plan names and prices are set by user directive (undercut Instapage; strong annual discount): **Create** €29/mo annual (€39 monthly), **Optimize** €59/mo annual (€79 monthly), **Convert** custom — all with a 7-day free trial and a 25% annual saving. This ADR confirms the limit dimensions per tier already advertised on the landing page (Create: 1 site, 30k visitors/mo; Optimize: multiple sites/workspaces, 100k visitors/mo, domain purchase, team roles, priority support; Convert: unlimited + onboarding/SLA) and any additional enforcement dimensions (storage GB, AI usage).

**Acceptance criteria:**
- Signed-off plan matrix with concrete numbers; limit dimensions enumerated as typed constants.

### E10-T02 · Stripe integration: checkout, portal, webhooks `api` `P2`
**Covers:** R-003
**Depends on:** E10-T01

`server/billing/`: Checkout session creation, customer portal link, webhook endpoint (signature-verified, idempotent, TypeBox-validated events) maintaining a `tenant_subscriptions` table (additive migration: tenant_id, stripe ids, plan, status, period end). EU essentials: VAT via Stripe Tax, SCA-ready flows.

**Acceptance criteria:**
- Test-mode subscribe/upgrade/cancel round-trips update the table solely via webhooks; replayed/forged webhooks rejected.

### E10-T03 · Plan limit enforcement `api` `P2`
**Covers:** R-003
**Depends on:** E10-T01, E10-T02

One `server/billing/limits.ts` module answering `canCreate(tenant, dimension)`; enforced in the handlers that create sites/pages/media/domains/members. Over-limit → typed envelope error the UI can upsell on. Downgrade handling: existing over-limit resources become read-only, never deleted.

**Acceptance criteria:**
- Each limited dimension has an enforcement test; downgrade never destroys data.

### E10-T04 · Billing UI `ui` `P2`
**Covers:** R-003
**Depends on:** E10-T02, E10-T03

Tenant settings → Billing: current plan, usage vs limits meters, upgrade CTA → Checkout, manage → portal, over-limit upsell states wherever T03 errors surface.

**Acceptance criteria:**
- Full subscribe→upgrade→cancel journey clickable in test mode; usage meters accurate.

### E10-T05 · Billing authz + audit `perm` `P2`
**Covers:** R-003
**Depends on:** E10-T02

New capability `billing.manage` (owner/admin roles); webhook endpoint exempt from session auth but signature-gated; audit events for plan changes. **Source: coverage sweep.**

**Acceptance criteria:**
- Member without `billing.manage` gets 403 on billing routes; every subscription mutation audited.

### E10-T06 · Billing test suite `test` `P2`
**Covers:** R-003
**Depends on:** E10-T02, E10-T03

Webhook handler tested with recorded Stripe fixtures (all lifecycle events incl. payment_failed, dispute); limit matrix property tests; idempotency under duplicate delivery.

**Acceptance criteria:**
- Green without network; fixture drift test guards the validated event subset.

### E10-T07 · Billing docs `docs` `P2`
**Covers:** R-002, R-003
**Depends on:** E10-T04

`docs/features/billing.md`: architecture, webhook contract, limit dimensions, operator runbook (failed payments, refunds, manual plan overrides); self-hosted mode documented as billing-disabled.

**Acceptance criteria:**
- Doc matches shipped behavior; self-hosted build shows no billing UI.
