/**
 * Social sign-in (E06-T05) — Google + GitHub authorization-code flows.
 *
 * Provider HTTP is stubbed at `globalThis.fetch`, so every branch of OUR logic
 * runs for real: state discipline (cookie + query + single-use DB row), the
 * code exchange, profile normalization, and the account-linking rules.
 *
 * The two "attack rows" are the ticket's acceptance criterion: an attacker
 * with an UNVERIFIED matching email — on either side — cannot capture an
 * account. Everything else is scaffolding around proving that.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { DbClient } from '../../../server/db'
import { createTestDb } from '../helpers/createTestDb'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { createUser, findUserByEmail } from '../../../server/repositories/users'
import { hashPassword } from '../../../server/auth/tokens'
import { oauthStartRateLimit } from '../../../server/auth/rateLimit'

const ORIGIN = 'http://localhost'
const START = (provider: string) => `${ORIGIN}/admin/api/cms/auth/oauth/${provider}/start`
const CALLBACK = (provider: string, query: string) =>
  `${ORIGIN}/admin/api/cms/auth/oauth/${provider}/callback?${query}`

const ENV_KEYS = [
  'OAUTH_GOOGLE_CLIENT_ID', 'OAUTH_GOOGLE_CLIENT_SECRET',
  'OAUTH_GITHUB_CLIENT_ID', 'OAUTH_GITHUB_CLIENT_SECRET',
] as const

let originalEnv: Record<string, string | undefined>
let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalEnv = {}
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key]
  process.env['OAUTH_GOOGLE_CLIENT_ID'] = 'google-client-id'
  process.env['OAUTH_GOOGLE_CLIENT_SECRET'] = 'google-secret'
  process.env['OAUTH_GITHUB_CLIENT_ID'] = 'github-client-id'
  process.env['OAUTH_GITHUB_CLIENT_SECRET'] = 'github-secret'
  originalFetch = globalThis.fetch
  oauthStartRateLimit.reset('unknown')
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
  globalThis.fetch = originalFetch
})

/**
 * Stub the provider's token + profile endpoints. Local `/admin/...` requests
 * never reach fetch (the handlers are called in-process), so everything
 * arriving here is outbound provider traffic.
 */
function stubProvider(profile: {
  sub?: string
  githubId?: number
  email?: string | null
  emailVerified?: boolean
  name?: string
  /** GitHub /user/emails payload; null = endpoint fails. */
  githubEmails?: Array<{ email: string; primary: boolean; verified: boolean }> | null
}): void {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('googleapis.com/token') || url.includes('github.com/login/oauth/access_token')) {
      return Response.json({ access_token: 'provider-access-token' })
    }
    if (url.includes('openidconnect.googleapis.com/v1/userinfo')) {
      return Response.json({
        sub: profile.sub ?? 'google-sub-1',
        email: profile.email ?? undefined,
        email_verified: profile.emailVerified ?? false,
        name: profile.name ?? 'Test User',
      })
    }
    if (url.includes('api.github.com/user/emails')) {
      if (profile.githubEmails === null) return new Response('nope', { status: 403 })
      return Response.json(profile.githubEmails ?? [])
    }
    if (url.includes('api.github.com/user')) {
      return Response.json({
        id: profile.githubId ?? 4242,
        login: 'octo-test',
        name: profile.name ?? 'Octo Test',
        email: profile.email ?? null,
      })
    }
    throw new Error(`unexpected outbound fetch in test: ${url}`)
  }) as typeof globalThis.fetch
}

function get(path: string, cookie?: string): Request {
  const req = new Request(path, { method: 'GET', headers: new Headers({ origin: ORIGIN }) })
  if (cookie) req.headers.set('cookie', cookie)
  return req
}

/** Run /start and hand back the state nonce + its cookie for the callback.
 * Cookies are read via `getSetCookie()` — under bun:test, `get('set-cookie')`
 * returns null (Set-Cookie is a special-cased header). */
async function startFlow(db: DbClient, provider: string): Promise<{ state: string; cookie: string }> {
  const res = await handleCmsRequest(get(START(provider)), db)
  expect(res.status).toBe(302)
  const location = new URL(res.headers.get('location') ?? '')
  const state = location.searchParams.get('state') ?? ''
  const setCookie = res.headers.getSetCookie().join('\n')
  const cookieValue = /ecobuilder_oauth_state=([^;]*)/.exec(setCookie)?.[1] ?? ''
  expect(state).not.toBe('')
  expect(cookieValue).toBe(state)
  return { state, cookie: `ecobuilder_oauth_state=${state}` }
}

function sessionCookieFrom(res: Response): string | null {
  for (const cookie of res.headers.getSetCookie()) {
    const match = /ecobuilder_admin_session=([^;]+)/.exec(cookie)
    if (match) return `ecobuilder_admin_session=${match[1]}`
  }
  return null
}

describe('social sign-in — start', () => {
  it('404s for an unconfigured provider', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      delete process.env['OAUTH_GOOGLE_CLIENT_ID']
      const res = await handleCmsRequest(get(START('google')), db)
      expect(res.status).toBe(404)
    } finally {
      await cleanup()
    }
  })

  it('sends Google to consent with state + S256 PKCE', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const res = await handleCmsRequest(get(START('google')), db)
      expect(res.status).toBe(302)
      const location = new URL(res.headers.get('location') ?? '')
      expect(location.origin).toBe('https://accounts.google.com')
      expect(location.searchParams.get('client_id')).toBe('google-client-id')
      expect(location.searchParams.get('response_type')).toBe('code')
      expect(location.searchParams.get('state')).not.toBeNull()
      expect(location.searchParams.get('code_challenge')).not.toBeNull()
      expect(location.searchParams.get('code_challenge_method')).toBe('S256')
      expect(location.searchParams.get('redirect_uri')).toContain('/admin/api/cms/auth/oauth/google/callback')
    } finally {
      await cleanup()
    }
  })

  it('sends GitHub to consent WITHOUT PKCE (GitHub ignores it; state is the protection)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const res = await handleCmsRequest(get(START('github')), db)
      expect(res.status).toBe(302)
      const location = new URL(res.headers.get('location') ?? '')
      expect(location.origin).toBe('https://github.com')
      expect(location.searchParams.get('code_challenge')).toBeNull()
      expect(location.searchParams.get('state')).not.toBeNull()
    } finally {
      await cleanup()
    }
  })
})

describe('social sign-in — state discipline', () => {
  it('rejects a callback whose state does not match the cookie', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      stubProvider({ email: 'a@example.com', emailVerified: true })
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), 'ecobuilder_oauth_state=different'),
        db,
      )
      expect(res.status).toBe(400)
      expect(sessionCookieFrom(res)).toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('rejects a callback with no state cookie at all (browser binding)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      stubProvider({ email: 'a@example.com', emailVerified: true })
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(get(CALLBACK('google', `code=abc&state=${flow.state}`)), db)
      expect(res.status).toBe(400)
    } finally {
      await cleanup()
    }
  })

  it('rejects a replayed state (single use)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      stubProvider({ email: 'fresh@example.com', emailVerified: true })
      const flow = await startFlow(db, 'google')
      const first = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), flow.cookie), db,
      )
      expect(first.status).toBe(302)
      const replay = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), flow.cookie), db,
      )
      expect(replay.status).toBe(400)
    } finally {
      await cleanup()
    }
  })

  it('sends a cancelled consent softly back to the login screen', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `error=access_denied&state=${flow.state}`), flow.cookie), db,
      )
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/admin?authError=oauth_denied')
    } finally {
      await cleanup()
    }
  })
})

describe('social sign-in — accounts and linking', () => {
  it('creates a verified, passwordless account for a new Google user and lands in onboarding', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      stubProvider({ sub: 'g-new', email: 'newcomer@example.com', emailVerified: true, name: 'New Comer' })
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), flow.cookie), db,
      )
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/admin')

      const user = await findUserByEmail(db, 'newcomer@example.com')
      expect(user).not.toBeNull()
      expect(user!.passwordHash).toBeNull()
      expect(user!.emailVerifiedAt).not.toBeNull()

      // The session works, and `/me` reports no workspace → onboarding.
      const cookie = sessionCookieFrom(res)
      expect(cookie).not.toBeNull()
      const me = await handleCmsRequest(get(`${ORIGIN}/admin/api/cms/me`, cookie!), db)
      expect(me.status).toBe(200)
      expect(await me.json()).toMatchObject({ user: { activeTenantId: null, hasPassword: false } })
    } finally {
      await cleanup()
    }
  })

  it('the identity wins over a changed provider email (no takeover via email swap)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      // First sign-in registers the (provider, provider_user_id) identity.
      stubProvider({ sub: 'stable-sub', email: 'original@example.com', emailVerified: true })
      const first = await startFlow(db, 'google')
      await handleCmsRequest(get(CALLBACK('google', `code=a&state=${first.state}`), first.cookie), db)

      // Same provider subject returns asserting a DIFFERENT (victim's) email.
      stubProvider({ sub: 'stable-sub', email: 'victim@example.com', emailVerified: true })
      const second = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `code=b&state=${second.state}`), second.cookie), db,
      )
      expect(res.status).toBe(302)

      // Signed into the ORIGINAL account; no account exists for the victim email.
      expect(await findUserByEmail(db, 'victim@example.com')).toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('links onto an existing account when BOTH sides are verified', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await createUser(db, {
        email: 'linked@example.com',
        displayName: 'Linked',
        passwordHash: await hashPassword('a-very-long-password'),
        roleId: 'member',
        emailVerified: true,
      })
      stubProvider({ sub: 'g-link', email: 'linked@example.com', emailVerified: true })
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), flow.cookie), db,
      )
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/admin')
      expect(sessionCookieFrom(res)).not.toBeNull()

      // Linked, not duplicated.
      const { rows } = await db<{ n: number | string }>`
        select count(*) as n from users where email_normalized = ${'linked@example.com'}`
      expect(Number(rows[0]!.n)).toBe(1)
      const { rows: identities } = await db<{ user_id: string }>`
        select user_id from user_identities where provider = ${'google'} and provider_user_id = ${'g-link'}`
      expect(identities).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })

  it('ATTACK: a verified provider email cannot capture an UNVERIFIED local account', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      // The victim-shaped precondition: a local account that never verified.
      await createUser(db, {
        email: 'pending@example.com',
        displayName: 'Pending',
        passwordHash: await hashPassword('a-very-long-password'),
        roleId: 'member',
        emailVerified: false,
      })
      stubProvider({ sub: 'g-attacker', email: 'pending@example.com', emailVerified: true })
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), flow.cookie), db,
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/admin?authError=link_required')
      expect(sessionCookieFrom(res)).toBeNull()
      const { rows } = await db<{ id: string }>`select id from user_identities`
      expect(rows).toHaveLength(0)
    } finally {
      await cleanup()
    }
  })

  it('ATTACK: an UNVERIFIED provider email cannot reach an existing account', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await createUser(db, {
        email: 'target@example.com',
        displayName: 'Target',
        passwordHash: await hashPassword('a-very-long-password'),
        roleId: 'member',
        emailVerified: true,
      })
      stubProvider({ sub: 'g-unverified', email: 'target@example.com', emailVerified: false })
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), flow.cookie), db,
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/admin?authError=email_unverified')
      expect(sessionCookieFrom(res)).toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('GitHub: a hidden profile email falls back to the verified primary from /user/emails', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      stubProvider({
        githubId: 777,
        email: null, // profile hides it
        githubEmails: [
          { email: 'secondary@example.com', primary: false, verified: true },
          { email: 'octo@example.com', primary: true, verified: true },
        ],
      })
      const flow = await startFlow(db, 'github')
      const res = await handleCmsRequest(
        get(CALLBACK('github', `code=abc&state=${flow.state}`), flow.cookie), db,
      )
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/admin')
      expect(await findUserByEmail(db, 'octo@example.com')).not.toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('an MFA account gets a pending session and the ?mfa=1 handoff', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const created = await createUser(db, {
        email: 'mfa-social@example.com',
        displayName: 'MFA Social',
        passwordHash: await hashPassword('a-very-long-password'),
        roleId: 'member',
        emailVerified: true,
      })
      await db`update users set mfa_enabled = 1 where id = ${created.id}`

      stubProvider({ sub: 'g-mfa', email: 'mfa-social@example.com', emailVerified: true })
      const flow = await startFlow(db, 'google')
      const res = await handleCmsRequest(
        get(CALLBACK('google', `code=abc&state=${flow.state}`), flow.cookie), db,
      )

      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/admin?mfa=1')

      // The pending session's cookie authenticates nothing until MFA clears.
      const cookie = sessionCookieFrom(res)
      expect(cookie).not.toBeNull()
      const me = await handleCmsRequest(get(`${ORIGIN}/admin/api/cms/me`, cookie!), db)
      expect(me.status).toBe(401)
    } finally {
      await cleanup()
    }
  })
})
