/**
 * The `instatic-*` → `ecobuilder-*` storage-key migration.
 *
 * Renaming the keys without this sweep would silently reset every existing
 * user's editor preferences, layouts, and clipboard — data loss dressed up as
 * a rename. The sweep runs once per profile (flagged), prefers values already
 * under the new key, and clears the legacy keys either way.
 */
import { beforeEach, describe, expect, it } from 'bun:test'
import { migrateLegacyStorageKeys } from '@admin/lib/legacyStorageKeys'

const FLAG = 'ecobuilder-storage-key-migration-v1'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('migrateLegacyStorageKeys', () => {
  it('moves legacy keys to the new prefix and removes the originals', () => {
    window.localStorage.setItem('instatic-editor-prefs', '{"theme":"dark"}')
    window.localStorage.setItem('instatic-clipboard-v1', '{"nodes":[]}')
    window.localStorage.setItem('unrelated-key', 'untouched')

    migrateLegacyStorageKeys()

    expect(window.localStorage.getItem('ecobuilder-editor-prefs')).toBe('{"theme":"dark"}')
    expect(window.localStorage.getItem('ecobuilder-clipboard-v1')).toBe('{"nodes":[]}')
    expect(window.localStorage.getItem('instatic-editor-prefs')).toBeNull()
    expect(window.localStorage.getItem('instatic-clipboard-v1')).toBeNull()
    expect(window.localStorage.getItem('unrelated-key')).toBe('untouched')
  })

  it('never clobbers a value already stored under the new key', () => {
    // The new key is newer by definition — the user wrote it after upgrading.
    window.localStorage.setItem('ecobuilder-editor-prefs', '{"theme":"light"}')
    window.localStorage.setItem('instatic-editor-prefs', '{"theme":"dark"}')

    migrateLegacyStorageKeys()

    expect(window.localStorage.getItem('ecobuilder-editor-prefs')).toBe('{"theme":"light"}')
    expect(window.localStorage.getItem('instatic-editor-prefs')).toBeNull()
  })

  it('sweeps sessionStorage too', () => {
    window.sessionStorage.setItem('instatic-spotlight-pending-action', '{"id":"x"}')
    migrateLegacyStorageKeys()
    expect(window.sessionStorage.getItem('ecobuilder-spotlight-pending-action')).toBe('{"id":"x"}')
    expect(window.sessionStorage.getItem('instatic-spotlight-pending-action')).toBeNull()
  })

  it('is a no-op once the flag is set', () => {
    migrateLegacyStorageKeys()
    expect(window.localStorage.getItem(FLAG)).toBe('1')

    // A legacy key appearing AFTER the sweep (e.g. written by an old tab still
    // open across the deploy) is not migrated again — the sweep is one-shot.
    window.localStorage.setItem('instatic-editor-prefs', '{"theme":"dark"}')
    migrateLegacyStorageKeys()
    expect(window.localStorage.getItem('ecobuilder-editor-prefs')).toBeNull()
    expect(window.localStorage.getItem('instatic-editor-prefs')).toBe('{"theme":"dark"}')
  })
})
