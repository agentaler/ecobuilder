/**
 * E02 — technical-namespace rename: the parts that carry persisted state.
 *
 * Each rename here has data behind it that this repo does not control — env
 * vars in deployment config, the session cookie in browsers, a config filename
 * in plugin repos. A clean break would break those installs, so each one ships
 * with a fallback, and these tests pin BOTH directions: the new name is
 * primary, and the legacy name still works. The deferred wire namespaces
 * (`/_instatic/*`, `<instatic-hole>`, `@instatic/*`) are covered by their own
 * architecture gates and are intentionally NOT renamed — see tickets/03.
 */
import { describe, expect, it } from 'bun:test'
import { readRenamedEnv, renamedEnvName } from '@core/utils/renamedEnv'
import { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../../server/auth/tokens'
import { getSessionHash } from '../../../server/auth/authz'
import { hashSessionToken } from '../../../server/auth/tokens'
import { PLUGIN_CONFIG_FILENAME } from '../../core/plugin-sdk/cli/configPath'

describe('renamed env vars', () => {
  it('prefers the new name and falls back to the legacy one', () => {
    const env = { ECOBUILDER_DEMO: 'new', INSTATIC_DEMO: 'old' }
    expect(readRenamedEnv('DEMO', env)).toBe('new')
    expect(readRenamedEnv('DEMO', { INSTATIC_DEMO: 'old' })).toBe('old')
    expect(readRenamedEnv('DEMO', {})).toBeUndefined()
  })

  it('documents variables under the new prefix', () => {
    expect(renamedEnvName('SECRET_KEY')).toBe('ECOBUILDER_SECRET_KEY')
  })
})

describe('renamed session cookie', () => {
  it('names the new cookie and keeps the legacy constant for dual-read', () => {
    expect(SESSION_COOKIE_NAME).toBe('ecobuilder_admin_session')
    expect(LEGACY_SESSION_COOKIE_NAME).toBe('instatic_admin_session')
  })

  it('accepts a session presented under either cookie name', async () => {
    const token = 'session-token-for-rename-test'
    const expected = await hashSessionToken(token)

    // happy-dom (the test DOM) follows the fetch spec and strips a `cookie`
    // header passed via constructor init — set it after construction, exactly
    // as the server receives it.
    const requestWithCookie = (cookie: string) => {
      const req = new Request('http://localhost/admin/api/cms/me')
      req.headers.set('cookie', cookie)
      return req
    }
    const withNew = requestWithCookie(`${SESSION_COOKIE_NAME}=${token}`)
    const withLegacy = requestWithCookie(`${LEGACY_SESSION_COOKIE_NAME}=${token}`)
    // A browser mid-rename can hold both; the new cookie must win.
    const withBoth = requestWithCookie(
      `${LEGACY_SESSION_COOKIE_NAME}=stale-token; ${SESSION_COOKIE_NAME}=${token}`,
    )

    expect(await getSessionHash(withNew)).toBe(expected)
    expect(await getSessionHash(withLegacy)).toBe(expected)
    expect(await getSessionHash(withBoth)).toBe(expected)
    expect(await getSessionHash(new Request('http://localhost/'))).toBeNull()
  })
})

describe('renamed plugin config filename', () => {
  it('exports the new filename as canonical', () => {
    expect(PLUGIN_CONFIG_FILENAME).toBe('ecobuilder-plugin.config.ts')
  })
})
