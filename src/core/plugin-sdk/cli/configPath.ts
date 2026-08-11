/**
 * Locating a plugin's config file across the `instatic-plugin` →
 * `ecobuilder-plugin` rename.
 *
 * The filename lives in plugin repositories this project does not control, so
 * unlike an internal symbol it cannot be renamed by fiat: an author who pulls a
 * new CLI would find their plugin suddenly unbuildable with a "not found"
 * error naming a file they never had. The CLI therefore accepts the legacy name
 * and says so once, per the E02 ticket's dual-read requirement.
 *
 * New plugins are scaffolded with the current name only (see `init.ts`), so the
 * legacy branch drains as authors regenerate or rename. Delete it then.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const PLUGIN_CONFIG_FILENAME = 'ecobuilder-plugin.config.ts'
const LEGACY_PLUGIN_CONFIG_FILENAME = 'instatic-plugin.config.ts'

/** Directories already warned about, so a multi-plugin build warns once each. */
const warned = new Set<string>()

/**
 * Absolute path to the plugin's config file, or `null` when neither name is
 * present. Prefers the current name, so a directory carrying both (mid-rename)
 * builds the one the author is migrating to.
 */
export function resolvePluginConfigPath(sourceDir: string): string | null {
  const current = join(sourceDir, PLUGIN_CONFIG_FILENAME)
  if (existsSync(current)) return current

  const legacy = join(sourceDir, LEGACY_PLUGIN_CONFIG_FILENAME)
  if (!existsSync(legacy)) return null

  if (!warned.has(sourceDir)) {
    warned.add(sourceDir)
    console.warn(
      `[ecobuilder-plugin] ${LEGACY_PLUGIN_CONFIG_FILENAME} is renamed to ` +
        `${PLUGIN_CONFIG_FILENAME}. The old name still builds for now; rename it.`,
    )
  }
  return legacy
}
