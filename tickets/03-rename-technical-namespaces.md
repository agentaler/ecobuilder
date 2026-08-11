# E02 — Rename: technical namespaces
Phase: P1 · Depends on: E01 · Requirements: R-001, R-002

**Status (2026-08-10): T01–T06 SHIPPED** — env vars (`renamedEnv.ts` fallback), session cookie (dual-read in `authz.ts`, dual-clear on logout), MCP identity string, plugin CLI + config filename (`configPath.ts` dual-read), localStorage/sessionStorage keys (one-time boot sweep `legacyStorageKeys.ts`), and the naming-sensitive tests (`renamedIdentifiers.test.ts`, `legacyStorageKeys.test.ts`). The published-HTML wire namespaces (`/_instatic/*`, `<instatic-hole>`, `data-instatic-*`, `@instatic/*`) remain deferred per the out-of-scope note below.

Rename machine-facing identifiers that carry migration risk. Each one has persisted state behind it: env vars are set in live deployments, the session cookie lives in browsers, localStorage keys hold user prefs, `@instatic/*` specifiers are baked into built plugin bundles, and `/_instatic/*` URLs + `<instatic-hole>` elements are baked into published HTML on disk. Per open question 6 in the overview, the published-HTML wire namespaces are explicitly deferred — this epic renames what can move safely now and records the deferral.

Out of scope for this epic: `/_instatic/*` URL prefixes, `<instatic-hole>`/`data-instatic-*` markup, `@instatic/*` import specifiers (deferred until a dual-serve + republish window is scheduled).

## Tasks

### E02-T01 · Rename env vars to `ECOBUILDER_*` with one-boot fallback `struct` `P1`
**Covers:** R-001
**Depends on:** —

`INSTATIC_SECRET_KEY`, `INSTATIC_FORM_SECRET`, `INSTATIC_UPLOADS_DIR`, `INSTATIC_VERSION/REVISION/CREATED`, `INSTATIC_IMAGE`, `INSTATIC_MCP_AUTH`, bench vars. Read `ECOBUILDER_*` first; if only the legacy name is set, use it and log one `console.warn('[config] INSTATIC_* is renamed to ECOBUILDER_*…')`. This is deployment config, not code API — CLAUDE.md's no-shims rule does not require breaking live installs on pull. Update `.env.example`, compose files, render.yaml blueprints, Railway variables on the live service.

**Acceptance criteria:**
- Boot with only legacy vars works and warns; boot with new vars is silent; docs list only `ECOBUILDER_*`.
- Secrets encrypted under the key are readable regardless of which var supplied it.

### E02-T02 · Rename session cookie with dual-read window `api` `P1`
**Covers:** R-001
**Depends on:** —

`SESSION_COOKIE_NAME` in `server/auth/tokens.ts`: `instatic_admin_session` → `ecobuilder_admin_session`. Read both names for one release, always write the new one, expire the old on sight — so live sessions survive the rename instead of force-logging-out every user.

**Acceptance criteria:**
- An active pre-rename session continues working across the deploy; new logins set only the new cookie; old cookie is cleared.

### E02-T03 · Rename MCP server identity and document client re-registration `api` `P1`
**Covers:** R-001
**Depends on:** —

`server/ai/mcp/server.ts` identity `{ name: 'instatic' }` → `ecobuilder`. External MCP clients cache the OAuth discovery path (`/.well-known/oauth-protected-resource/_instatic/mcp`) — the path itself stays (deferred namespace), only the identity string changes. Note in `docs/features/mcp-connectors.md` that connectors keep working; only display names change.

**Acceptance criteria:**
- Existing connector tokens still authenticate; MCP handshake reports the new name.

### E02-T04 · Rename plugin CLI and config filename with dual-read `struct` `P1`
**Covers:** R-001
**Depends on:** —

`instatic-plugin` script → `ecobuilder-plugin`; config `instatic-plugin.config.ts` → `ecobuilder-plugin.config.ts` (loader accepts both, warns on legacy). Update `src/core/plugin-sdk/cli/*`, the lint test, and `examples/plugins/template/`.

**Acceptance criteria:**
- Template plugin builds with the new CLI name; a repo using the old config filename still builds with a deprecation warning.

### E02-T05 · Migrate localStorage/sessionStorage keys on read `devops` `P1`
**Covers:** R-001
**Depends on:** —

The 9 `instatic-*` localStorage keys (catalogued in `docs/reference/persistence-keys.md`) + spotlight sessionStorage key: on first read, if the new `ecobuilder-*` key is absent and the legacy key exists, copy value → new key, delete legacy. One shared helper, not nine copies.

**Acceptance criteria:**
- Editor prefs/layout survive the rename in an existing browser profile; fresh profiles only ever see `ecobuilder-*` keys.

### E02-T06 · Update naming-sensitive tests `test` `P1`
**Covers:** R-001
**Depends on:** E02-T01, E02-T02, E02-T04

Update env-var, cookie, and CLI tests. Route-string architecture gates (`media-signed-redirect-serving`, `hole-runtime-asset-route`, `module-js-asset-route`) stay on `/_instatic/*` and gain a comment pointing at the deferral decision.

**Acceptance criteria:**
- `bun test` green; deferred gates carry the pointer comment.

### E02-T07 · Record the wire-namespace deferral as an ADR `docs` `P1`
**Covers:** R-002
**Depends on:** —

Document in `docs/architecture.md` (or a short ADR) why `/_instatic/*`, `<instatic-hole>`, `data-instatic-*`, `@instatic/*`, and the `.instatic/site-bundle.json` export manifest path are retained: they're baked into published artefacts, third-party plugin bundles, export ZIPs, and external MCP client caches; renaming requires dual-serving + republish-all, scheduled separately.

**Acceptance criteria:**
- The decision, its blast-radius list, and the future migration recipe are written down where the next agent will find them.
