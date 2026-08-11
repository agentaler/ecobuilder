# E01 — Rename: product surface (Instatic → Ecobuilder)
Phase: P0 · Depends on: — · Requirements: R-001, R-002

Rename everything a human reads — UI strings, package metadata, agent rule files, README/docs — without touching wire-level identifiers (env vars, `/_instatic/*` routes, cookies, import specifiers), which are E02. This split keeps the P0 rename zero-risk for the live deployment and for self-hosters. Audit found ~40 capitalized "Instatic" product strings in `src/` across ~27 files, 435 doc occurrences across 43 files, and that `AGENTS.md` is a symlink to `CLAUDE.md` (one edit updates both).

Out of scope for this epic: `INSTATIC_*` env vars, `instatic_admin_session` cookie, `/_instatic/*` URL namespaces, `@instatic/*` plugin specifiers, localStorage keys, CLI binary name (all E02).

## Tasks

### E01-T01 · Update package metadata and repo identity `struct` `P0`
**Covers:** R-001
**Depends on:** —

`package.json`: `name` → `ecobuilder`, `homepage` → `https://ecobuilder.ai`, `repository`/`bugs` → `github.com/agentaler/ecobuilder`. Update `.github/FUNDING.yml`, issue templates, and Dockerfile OCI label values that carry the product name (keep `INSTATIC_VERSION` build-arg names for E02).

**Acceptance criteria:**
- `bun install && bun run build` clean; no remaining `corebunch/instatic` references outside CHANGELOG.

### E01-T02 · Rename user-visible product strings in the admin UI `ui` `P0`
**Covers:** R-001
**Depends on:** —

Replace capitalized "Instatic" in: `index.html` (title + loading aria-label), `AppLoadingScreen.tsx`, `AdminPreAuthForm.tsx`, MCP/AI pages (`McpTab.tsx`, `McpOAuthAuthorizePage.tsx`, `ProvidersTab.tsx`), import/export dialogs, spotlight help commands, dashboard StorageWidget, canvas layout, CodeMirror editor — the full 27-file list from the naming audit. Also server-rendered strings: login skeleton in `server/static.ts`, MCP error copy in `server/ai/mcp/server.ts`.

**Acceptance criteria:**
- Grep for `\bInstatic\b` in `src/` and `server/` returns only wire-level identifiers explicitly deferred to E02.
- Browser tab, login screen, and spotlight help all read "Ecobuilder".

### E01-T03 · Update TOTP issuer for new enrollments `ui` `P0`
**Covers:** R-001
**Depends on:** —

`server/handlers/cms/me.ts` issuer `'Instatic'` → `'Ecobuilder'`. Existing enrolled authenticators keep their old label (cosmetic only, secrets unaffected) — note this in the change.

**Acceptance criteria:**
- New MFA enrollment shows "Ecobuilder" in the authenticator app; existing TOTP logins still pass.

### E01-T04 · Rename CLAUDE.md/AGENTS.md and align agent rules `docs` `P0`
**Covers:** R-001, R-002
**Depends on:** —

`CLAUDE.md` H1 and prose → Ecobuilder (symlinked AGENTS.md follows). Update the "What this project is" section for the new reality: product name, SaaS direction (self-hosted remains supported), and note that wire-level `instatic` identifiers are intentionally retained until E02.

**Acceptance criteria:**
- CLAUDE.md accurately describes the renamed project; no stale "self-hosted only" claim once E06 lands (add forward-pointer).

### E01-T05 · Sweep docs/ and root markdown `docs` `P0`
**Covers:** R-001, R-002
**Depends on:** E01-T02

Rename across all 43 affected files under `docs/` plus README (24 hits), CONTRIBUTING, SECURITY, CODE_OF_CONDUCT. Keep literal code identifiers (`INSTATIC_SECRET_KEY`, `/_instatic/…`) accurate where they document current behavior — the docs must match the code, not the aspiration. Fix the stale claim in `docs/reference/persistence-keys.md` that `user_preferences` keys are `instatic-`-prefixed (audit: they are unprefixed).

**Acceptance criteria:**
- Product-name grep in `docs/` returns only wire-level identifiers that still exist in code.
- README screenshots/badges reference the new repo.

### E01-T06 · Rename Docker image coordinates `devops` `P0`
**Covers:** R-001
**Depends on:** E01-T01

`ghcr.io/corebunch/instatic` → `ghcr.io/agentaler/ecobuilder` in `release.yml`, `compose.prod.yml`, `compose.build.yml`, `scripts/build-release-bundle.ts`, deployment docs. Local tag `instatic:local` → `ecobuilder:local`.

**Acceptance criteria:**
- Release workflow publishes to the new image path; compose files pull it.

### E01-T07 · Keep architecture gates green through the rename `test` `P0`
**Covers:** R-001
**Depends on:** E01-T02

Update the naming-adjacent tests that assert on product strings or fixtures (`cmsTransferExport.test.ts` "Instatic manifest" test names, tmpdir prefixes, `task427-preview-class-css.test.ts` fixtures) — but do NOT touch the route-string gates (`media-signed-redirect-serving`, `hole-runtime-asset-route`, `module-js-asset-route`), which continue asserting `/_instatic/*` until E02.

**Acceptance criteria:**
- `bun test` fully green after the rename.

### E01-T08 · Update example plugin template naming `docs` `P0`
**Covers:** R-001, R-002
**Depends on:** E01-T02

`examples/plugins/template/` README and `plugin.json` product references → Ecobuilder (keep `@instatic/*` import specifiers and `instatic-plugin.config.ts` filename until E02).

**Acceptance criteria:**
- Template scaffolds and builds against the renamed host.
