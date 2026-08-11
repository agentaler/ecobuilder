# E05 — Landing page: i18n, geo-detection, SEO & deploy
Phase: P0 · Depends on: E04 · Requirements: R-005, R-006, R-007

Make the landing bilingual (EN/FR) with automatic language selection, correct EU-grade SEO, and ship it as its own Railway service on ecobuilder.ai. Language strategy encoded here: locale-prefixed static routes (`/en/…`, `/fr/…`) — both fully pre-rendered — with a tiny edge/server redirect at `/` that picks a locale from (1) explicit stored user choice, (2) `Accept-Language`, (3) IP-country lookup as tiebreak; search engines see stable per-locale URLs with hreflang, never a cloaked redirect.

Out of scope for this epic: translating the admin product UI (overview non-goal); additional locales.

## Tasks

### E05-T01 · i18n framework for the landing `i18n` `struct` `P0`
**Covers:** R-005
**Depends on:** E04-T01

Typed message catalogs (`landing/locales/en.ts`, `fr.ts`) with a `t()` helper that fails the build on missing keys — no runtime i18n library needed for a static bilingual site. Build emits the full page tree once per locale under `/en/` and `/fr/`.

**Acceptance criteria:**
- Build fails if any key exists in one locale but not the other; both trees fully render.

### E05-T02 · Locale negotiation at `/` `i18n` `api` `P0`
**Covers:** R-005, R-006
**Depends on:** E05-T01

The landing service (E05-T07's tiny static server) answers `/` with a 302 to `/en/` or `/fr/`: cookie `lang` if set → else `Accept-Language` q-values → else IP country (FR/BE/CH/LU/MC → fr) via a local GeoIP lookup or Railway-available headers — decide in-task; no third-party geo API with per-request fees. `Vary: Accept-Language, Cookie` set; crawlers requesting `/` without preferences get `/en/`.

**Acceptance criteria:**
- `curl -H 'Accept-Language: fr-FR'` → 302 `/fr/`; en-US → `/en/`; cookie overrides header; googlebot default documented and tested.

### E05-T03 · Visible language switcher with persisted choice `i18n` `ui` `P0`
**Covers:** R-005, R-006
**Depends on:** E05-T01

Switcher in nav + footer linking to the same page in the other locale (not the homepage), setting the `lang` cookie. Auto-detection must never trap a user in the wrong language.

**Acceptance criteria:**
- Switching on `/fr/tarifs` lands on `/en/pricing` equivalent; choice survives revisit to `/`.

### E05-T04 · French content pass `i18n` `ui` `P0`
**Covers:** R-005
**Depends on:** E04-T03…T06, E05-T01

Full FR translation of all landing copy — marketing-quality French (tu/vous register decision documented; vous default), localized examples/currency (€), and FR slugs where natural (`/fr/tarifs`). Native-speaker review flagged as a follow-up gate before launch.

**Acceptance criteria:**
- Zero untranslated strings on any `/fr/` page; FR pages pass the same Lighthouse budgets.

### E05-T05 · hreflang, sitemaps, meta & structured data `i18n` `P0`
**Covers:** R-005, R-006
**Depends on:** E05-T01

`hreflang` en/fr/x-default pairs on every page, per-locale sitemap + index, canonical URLs, OpenGraph/Twitter cards per locale, Organization + Product JSON-LD.

**Acceptance criteria:**
- Validator-clean hreflang reciprocity; sitemaps list every published route in both locales.

### E05-T06 · i18n/SEO test suite `test` `P0`
**Covers:** R-005, R-006
**Depends on:** E05-T02…T05

Playwright + unit coverage: negotiation matrix (header/cookie/geo/crawler), switcher round-trips, hreflang reciprocity check over the built output, catalog-parity test.

**Acceptance criteria:**
- Suite green in CI; a deliberately missing FR key or hreflang orphan fails.

### E05-T07 · Landing Railway service `devops` `P0`
**Covers:** R-007
**Depends on:** E04-T08

Second Railway service `landing` in the ecobuilder project: minimal Bun static server (locale redirect + static files + cache headers; ~50 lines, lives in `landing/server.ts`) with its own Dockerfile. No volume, no DB. Health check `/health`.

**Acceptance criteria:**
- Service serves the built site on its Railway domain; deploys green with health check.

### E05-T08 · Point ecobuilder.ai at the landing service `devops` `P0`
**Covers:** R-007
**Depends on:** E05-T07

Custom domains `ecobuilder.ai` + `www.ecobuilder.ai` (www → apex 301) on the landing service; user adds the DNS records (apex ALIAS/CNAME per registrar support + TXT verify). Keep `app.ecobuilder.ai` on the app service untouched.

**Acceptance criteria:**
- `https://ecobuilder.ai` serves the landing with valid TLS; `www` redirects; app subdomain unaffected.

### E05-T09 · Landing deployment docs `docs` `P0`
**Covers:** R-007, R-002
**Depends on:** E05-T07, E05-T08

Extend `docs/deployment/railway.md` (or `docs/landing.md`) with the two-service topology, DNS table for the apex domain, and the locale-negotiation behavior operators must not break (the `Vary` contract).

**Acceptance criteria:**
- Doc describes both services + DNS records exactly as deployed.
