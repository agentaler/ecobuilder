/**
 * One-time migration of client-side persistence keys `instatic-*` → `ecobuilder-*`.
 *
 * Every browser-side key in this app shares a single prefix by convention (see
 * `docs/reference/persistence-keys.md`), which is what makes a prefix sweep the
 * right shape here: one function run once at boot, rather than a dual-read
 * branch bolted onto each of the ~dozen call sites. After it runs, every reader
 * can name the new key and nothing else in the codebase knows the old one
 * existed.
 *
 * Without this, renaming the keys would silently reset editor preferences,
 * panel layouts, the clipboard, and column widths for every existing user —
 * data loss that looks like a bug, not a rename.
 *
 * Delete this module once existing browser profiles have converged.
 */
const LEGACY_PREFIX = 'instatic-'
const CURRENT_PREFIX = 'ecobuilder-'

/** Marks the sweep done so a reload does not re-scan storage on every boot. */
const MIGRATION_FLAG = 'ecobuilder-storage-key-migration-v1'

function migrateStore(store: Storage): number {
  // Snapshot the key list first: writing to storage while iterating its live
  // index is how a loop skips entries.
  const legacyKeys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key?.startsWith(LEGACY_PREFIX)) legacyKeys.push(key)
  }

  let moved = 0
  for (const legacyKey of legacyKeys) {
    const nextKey = CURRENT_PREFIX + legacyKey.slice(LEGACY_PREFIX.length)
    const value = store.getItem(legacyKey)
    // A value already under the new key wins — it is newer by definition, and
    // clobbering it would undo whatever the user did after the upgrade.
    if (value !== null && store.getItem(nextKey) === null) {
      store.setItem(nextKey, value)
      moved++
    }
    store.removeItem(legacyKey)
  }
  return moved
}

/**
 * Run the sweep. Safe to call more than once — the flag makes repeat calls a
 * single `getItem`. Storage access throws in private-browsing modes and when
 * cookies are blocked, so every failure is non-fatal: worst case the user
 * starts from defaults, which is what they would get without storage anyway.
 */
export function migrateLegacyStorageKeys(): void {
  try {
    if (window.localStorage.getItem(MIGRATION_FLAG)) return
  } catch {
    return // storage unavailable — nothing to migrate into
  }

  try {
    migrateStore(window.localStorage)
  } catch (err) {
    console.warn('[storage-migration] localStorage sweep failed:', err)
  }
  try {
    migrateStore(window.sessionStorage)
  } catch (err) {
    console.warn('[storage-migration] sessionStorage sweep failed:', err)
  }

  try {
    window.localStorage.setItem(MIGRATION_FLAG, '1')
  } catch {
    // Unwritable storage means the sweep re-runs next boot. It is idempotent.
  }
}
