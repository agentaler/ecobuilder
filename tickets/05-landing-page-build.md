# E04 — Landing page: build & content
Phase: P0 · Depends on: — · Requirements: R-004

A marketing site in the structural spirit of instapage.com (hero + product proof + feature sections + social proof + CTA cadence), repositioned around Ecobuilder's actual differentiators: eco-friendly by construction (clean static HTML output, no framework runtime shipped to visitors — measurably lightweight pages), open-source, EU-focused. Lives in this repo as a self-contained `landing/` app with its own build, deployed as a separate Railway service (E05). Static-first output — the landing page itself must embody the "clean, fast, green" pitch (Lighthouse/CO₂-per-view numbers become marketing copy).

Out of scope for this epic: i18n/geo/SEO plumbing and deployment (E05); app signup flow it links to (E06); pricing page contents beyond placeholder (E10).

## Tasks

### E04-T01 · Scaffold `landing/` app with its own build `struct` `P0`
**Covers:** R-004
**Depends on:** —

New top-level `landing/` directory: Vite static build, TypeScript, CSS with the same token discipline as the main app (own `tokens.css`; reuse of `src/ui` components is NOT allowed — the landing must not pull the admin bundle). Own `package.json` scripts wired into root via `bun run landing:dev` / `landing:build`. Update repo-layout section of CLAUDE.md + `docs/architecture.md`.

**Acceptance criteria:**
- `bun run landing:build` emits a static site under `landing/dist/`; main app build unaffected.
- Architecture test: `landing/` imports nothing from `src/admin` or `server/`.

### E04-T02 · Design system for the landing page `ui` `P0`
**Covers:** R-004
**Depends on:** E04-T01

Tokens (eco-leaning palette on an achromatic base, consistent with the product's two-layer color philosophy), type scale, spacing, buttons/cards/nav/footer primitives, light+dark. Instapage-grade polish is the bar: generous whitespace, strong hero typography, real component rhythm.

**Acceptance criteria:**
- A styleguide page renders every primitive in both themes; no hardcoded colors outside tokens.

### E04-T03 · Hero + value proposition section `ui` `P0`
**Covers:** R-004
**Depends on:** E04-T02

Headline positioning Ecobuilder as the eco-friendly Webflow/Framer/WordPress alternative for Europe; product screenshot/canvas mock; primary CTA (start free → app.ecobuilder.ai) + secondary (view on GitHub). Copy drafted EN-first with translation keys from day one (E05 consumes them).

**Acceptance criteria:**
- Renders under 100KB total transfer for above-the-fold; CTA links resolve.

### E04-T04 · Feature/proof sections `ui` `P0`
**Covers:** R-004
**Depends on:** E04-T02

Sections: visual editor (real screenshots), clean-output proof (page-weight / CO₂-per-view comparison vs typical WP/Webflow page — sourced methodology, e.g. Website Carbon-style model), plugin system, self-host vs cloud, EU data residency. Each section is a reusable block component.

**Acceptance criteria:**
- All sections responsive down to 360px; images lazy-loaded with dimensions set (no CLS).

### E04-T05 · Social proof + FAQ + footer `ui` `P0`
**Covers:** R-004
**Depends on:** E04-T02

Testimonials/logos placeholder structure (real quotes when available), FAQ with disclosure semantics, footer with legal links (imprint/privacy — GDPR pages get real content in E11-T03), language switcher slot (wired in E05).

**Acceptance criteria:**
- FAQ keyboard-accessible; footer links resolve or are explicitly stubbed.

### E04-T06 · Early-access / contact capture `ui` `P0`
**Covers:** R-004
**Depends on:** E04-T03

Email capture form (waitlist/newsletter until self-serve signup ships in E06, then swapped for direct signup CTA). POST to a minimal endpoint (E04-T07). Honeypot + double-opt-in note; no third-party marketing scripts — that would poison the eco pitch.

**Acceptance criteria:**
- Submission stores the address and confirms inline; bot submissions dropped.

### E04-T07 · Minimal capture endpoint `api` `P0`
**Covers:** R-004
**Depends on:** E04-T01

Simplest correct home: a tiny handler in the existing server (`/api/landing/subscribe`) writing to a new `landing_subscribers` table (additive migration in both dialects), TypeBox-validated, rate-limited. The landing site (static) posts cross-origin to app.ecobuilder.ai with CORS allowing only the landing origin. **Source: coverage sweep.**

**Acceptance criteria:**
- Valid email → 200 + row; invalid → envelope error; rate limit enforced; CORS rejects other origins.

### E04-T08 · Landing content/test pass `test` `docs` `P0`
**Covers:** R-004, R-002
**Depends on:** E04-T03…T06

Playwright smoke: renders, nav, form submit, no console errors, Lighthouse budget assertions (perf ≥ 95, a11y ≥ 95 on CI). Add `docs/landing.md` describing the app, its build, and the content-editing workflow.

**Acceptance criteria:**
- CI runs the landing smoke; budgets enforced; doc exists.
