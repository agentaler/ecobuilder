/**
 * Environment variables renamed `INSTATIC_*` → `ECOBUILDER_*`.
 *
 * These are deployment configuration, not a code API — they live in compose
 * files, platform dashboards, and CI secrets that this repo cannot edit. So
 * unlike a TypeScript signature, renaming one cannot be a clean break: an
 * install that pulls the rename would fail to boot on a variable the operator
 * has no way to know changed. CLAUDE.md's no-shims rule governs code shape,
 * and the E02 ticket calls for exactly this fallback.
 *
 * Reads the new name first, falls back to the legacy name, and warns once per
 * variable so the warning is actionable rather than a per-read flood. The
 * fallback is intended to be deleted once deployments have moved.
 */
const NEW_PREFIX = 'ECOBUILDER_'
const LEGACY_PREFIX = 'INSTATIC_'

/** Legacy names already warned about, so a hot path warns at most once. */
const warned = new Set<string>()

type EnvSource = Record<string, string | undefined>

/**
 * @param suffix The part after the prefix — pass `'SECRET_KEY'` to read
 *   `ECOBUILDER_SECRET_KEY`, falling back to `INSTATIC_SECRET_KEY`.
 */
export function readRenamedEnv(suffix: string, env: EnvSource = process.env): string | undefined {
  const current = env[`${NEW_PREFIX}${suffix}`]
  if (current !== undefined) return current

  const legacyName = `${LEGACY_PREFIX}${suffix}`
  const legacy = env[legacyName]
  if (legacy === undefined) return undefined

  if (!warned.has(legacyName)) {
    warned.add(legacyName)
    console.warn(
      `[config] ${legacyName} is renamed to ${NEW_PREFIX}${suffix}. ` +
        `The old name still works for now; update your deployment configuration.`,
    )
  }
  return legacy
}

/** The name this variable is documented under, for error messages. */
export function renamedEnvName(suffix: string): string {
  return `${NEW_PREFIX}${suffix}`
}
