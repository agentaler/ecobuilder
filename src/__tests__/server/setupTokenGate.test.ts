/**
 * The setup POST is a land grab until the install is claimed.
 *
 * It 409s once a site and owner exist, which stops it being an ongoing
 * account-creation backdoor — but for the window before that, "one-shot" means
 * "whoever gets there first". On a public hostname that is a stranger. In
 * production the endpoint therefore also demands a bootstrap token that only
 * someone with deployment log access has.
 *
 * These tests drive the production path explicitly, because the whole point is
 * behaviour that does NOT apply in dev where the rest of the suite runs.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { createCapabilityTestHarness } from '../helpers/capabilityHarness'
import { getSetupToken, isSetupTokenRequired, isValidSetupToken } from '../../../server/auth/setupToken'

const originalNodeEnv = process.env.NODE_ENV
const originalToken = process.env.ECOBUILDER_SETUP_TOKEN
const originalLegacyToken = process.env.INSTATIC_SETUP_TOKEN

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  if (originalToken === undefined) delete process.env.ECOBUILDER_SETUP_TOKEN
  else process.env.ECOBUILDER_SETUP_TOKEN = originalToken
  if (originalLegacyToken === undefined) delete process.env.INSTATIC_SETUP_TOKEN
  else process.env.INSTATIC_SETUP_TOKEN = originalLegacyToken
})

async function postSetup(
  harness: Awaited<ReturnType<typeof createCapabilityTestHarness>>,
  body: Record<string, unknown>,
) {
  return harness.cms('/admin/api/cms/setup', { method: 'POST', json: body })
}

const VALID_SETUP = {
  siteName: 'Test Site',
  email: 'owner@example.com',
  password: 'long-enough-password',
}

describe('setup token gate', () => {
  it('rejects a production setup with no token', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      process.env.NODE_ENV = 'production'
      process.env.ECOBUILDER_SETUP_TOKEN = 'correct-horse-battery-staple'

      const res = await postSetup(harness, VALID_SETUP)
      expect(res.status).toBe(403)

      // The install must still be claimable by someone who HAS the token —
      // a rejected attempt cannot consume the one shot.
      const status = await (await harness.cms('/admin/api/cms/setup/status')).json()
      expect(status.needsSetup).toBe(true)
    } finally {
      await harness.cleanup()
    }
  })

  it('rejects a production setup with the wrong token', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      process.env.NODE_ENV = 'production'
      process.env.ECOBUILDER_SETUP_TOKEN = 'correct-horse-battery-staple'

      const res = await postSetup(harness, { ...VALID_SETUP, setupToken: 'guess' })
      expect(res.status).toBe(403)
    } finally {
      await harness.cleanup()
    }
  })

  it('accepts a production setup carrying the configured token', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      process.env.NODE_ENV = 'production'
      process.env.ECOBUILDER_SETUP_TOKEN = 'correct-horse-battery-staple'

      const res = await postSetup(harness, {
        ...VALID_SETUP,
        setupToken: 'correct-horse-battery-staple',
      })
      expect(res.status).toBe(201)

      const status = await (await harness.cms('/admin/api/cms/setup/status')).json()
      expect(status.needsSetup).toBe(false)
    } finally {
      await harness.cleanup()
    }
  })

  it('does not gate setup outside production', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      process.env.NODE_ENV = 'test'
      const res = await postSetup(harness, VALID_SETUP)
      expect(res.status).toBe(201)
    } finally {
      await harness.cleanup()
    }
  })

  it('advertises the requirement so the setup screen can ask for a token', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      process.env.NODE_ENV = 'production'
      process.env.ECOBUILDER_SETUP_TOKEN = 'correct-horse-battery-staple'
      const status = await (await harness.cms('/admin/api/cms/setup/status')).json()
      expect(status.setupTokenRequired).toBe(true)

      process.env.NODE_ENV = 'test'
      const devStatus = await (await harness.cms('/admin/api/cms/setup/status')).json()
      expect(devStatus.setupTokenRequired).toBe(false)
    } finally {
      await harness.cleanup()
    }
  })
})

describe('setup token comparison', () => {
  it('is required only in production', () => {
    process.env.NODE_ENV = 'production'
    expect(isSetupTokenRequired()).toBe(true)
    process.env.NODE_ENV = 'development'
    expect(isSetupTokenRequired()).toBe(false)
  })

  it('honours the legacy INSTATIC_SETUP_TOKEN name as a fallback', () => {
    // Deployment config set before the ECOBUILDER_* rename must keep working —
    // see src/core/utils/renamedEnv.ts. New name wins when both are set.
    delete process.env.ECOBUILDER_SETUP_TOKEN
    process.env.INSTATIC_SETUP_TOKEN = 'legacy-configured-token'
    expect(isValidSetupToken('legacy-configured-token')).toBe(true)
    process.env.ECOBUILDER_SETUP_TOKEN = 'current-token'
    expect(isValidSetupToken('current-token')).toBe(true)
    expect(isValidSetupToken('legacy-configured-token')).toBe(false)
    delete process.env.INSTATIC_SETUP_TOKEN
  })

  it('rejects a prefix of the real token', () => {
    // Read the live token rather than assuming one: `getSetupToken` caches for
    // the process lifetime, so an env var set here may not be what is in use.
    const token = getSetupToken()
    expect(isValidSetupToken(token)).toBe(true)
    // A length-equality shortcut is what makes the timing-safe compare legal;
    // this pins that it rejects rather than throws on a short candidate.
    expect(isValidSetupToken(token.slice(0, 3))).toBe(false)
    expect(isValidSetupToken('')).toBe(false)
    expect(isValidSetupToken(`${token}x`)).toBe(false)
  })
})
