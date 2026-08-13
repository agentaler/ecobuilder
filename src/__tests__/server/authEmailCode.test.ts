/**
 * Emailed sign-in codes (E06-T05).
 *
 * A code both signs in and signs up, so these tests pin four things: that the
 * request endpoint leaks nothing about whether an address has an account, that
 * redemption is bounded (attempt cap, expiry, single use, purpose separation),
 * that a new address ends up with a passwordless, verified account holding no
 * workspace (which is what routes it to onboarding), and that an MFA account
 * still has to clear its second factor.
 *
 * Codes are minted through the repository rather than read out of an inbox —
 * the same seam `signup.test.ts` uses for verification tokens.
 */
import { beforeEach, describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { createUser, findUserByEmail } from '../../../server/repositories/users'
import { issueEmailLoginCode } from '../../../server/repositories/emailLoginCodes'
import { hashPassword } from '../../../server/auth/tokens'
import {
  emailCodeRequestPerIpRateLimit,
  emailCodeRequestRateLimit,
  emailCodeVerifyRateLimit,
} from '../../../server/auth/rateLimit'
import type { DbClient } from '../../../server/db'

// The limiters are process-global singletons keyed by IP, and every request here
// arrives IP-less (key `'unknown'`), so without this one test's attempts would
// spend another's quota.
beforeEach(() => {
  emailCodeVerifyRateLimit.reset('unknown')
  emailCodeRequestPerIpRateLimit.reset('unknown')
  emailCodeRequestRateLimit.reset('unknown|known@example.com')
  emailCodeRequestRateLimit.reset('unknown|nobody@example.com')
})

const ORIGIN = 'http://localhost'
const REQUEST = '/admin/api/cms/auth/email-code/request'
const VERIFY = '/admin/api/cms/auth/email-code/verify'

function post(path: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json', origin: ORIGIN })
  const req = new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (cookie) req.headers.set('cookie', cookie)
  return req
}

function get(path: string, cookie: string): Request {
  const req = new Request(`${ORIGIN}${path}`, { method: 'GET', headers: new Headers({ origin: ORIGIN }) })
  req.headers.set('cookie', cookie)
  return req
}

function sessionCookieFrom(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? ''
  const token = /ecobuilder_admin_session=([^;]+)/.exec(setCookie)?.[1] ?? ''
  return `ecobuilder_admin_session=${token}`
}

/** Mint a live login code straight from the repository. */
function mintCode(db: DbClient, email: string, userId: string | null = null) {
  return issueEmailLoginCode(db, {
    emailNormalized: email,
    userId,
    purpose: 'login',
    ttlMs: 10 * 60 * 1000,
    ipAddress: null,
    userAgent: null,
  })
}

describe('email sign-in codes — requesting', () => {
  it('answers identically for a known and an unknown address', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await createUser(db, {
        email: 'known@example.com',
        displayName: 'Known',
        passwordHash: await hashPassword('a-very-long-password'),
        roleId: 'member',
      })

      const knownRes = await handleCmsRequest(post(REQUEST, { email: 'known@example.com' }), db)
      const unknownRes = await handleCmsRequest(post(REQUEST, { email: 'nobody@example.com' }), db)

      expect(knownRes.status).toBe(200)
      expect(unknownRes.status).toBe(200)

      // Same status AND same shape — a difference in either is an oracle for
      // whether an address has an account.
      const known = await knownRes.json() as Record<string, unknown>
      const unknown = await unknownRes.json() as Record<string, unknown>
      expect(Object.keys(known).sort()).toEqual(Object.keys(unknown).sort())
      expect(typeof known['requestId']).toBe('string')
      expect(typeof unknown['requestId']).toBe('string')
    } finally {
      await cleanup()
    }
  })

  it('rejects a malformed address', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const res = await handleCmsRequest(post(REQUEST, { email: 'not-an-email' }), db)
      expect(res.status).toBe(400)
    } finally {
      await cleanup()
    }
  })
})

describe('email sign-in codes — redeeming', () => {
  it('creates a verified, passwordless account with no workspace for a new address', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const issued = await mintCode(db, 'new@example.com')
      const res = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ ok: true, mfaRequired: false, createdAccount: true })

      const user = await findUserByEmail(db, 'new@example.com')
      expect(user).not.toBeNull()
      // Passwordless: mailbox control was the credential.
      expect(user!.passwordHash).toBeNull()

      // No workspace yet — this null is what routes the client to onboarding.
      const me = await handleCmsRequest(get('/admin/api/cms/me', sessionCookieFrom(res)), db)
      expect(me.status).toBe(200)
      expect(await me.json()).toMatchObject({
        user: { activeTenantId: null, hasPassword: false },
      })
    } finally {
      await cleanup()
    }
  })

  it('signs in an existing password account without touching its password', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const created = await createUser(db, {
        email: 'existing@example.com',
        displayName: 'Existing',
        passwordHash: await hashPassword('a-very-long-password'),
        roleId: 'member',
      })
      const issued = await mintCode(db, 'existing@example.com', created.id)

      const res = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ createdAccount: false })

      const user = await findUserByEmail(db, 'existing@example.com')
      expect(user!.passwordHash).not.toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('burns the code after one use', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const issued = await mintCode(db, 'once@example.com')
      const first = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )
      expect(first.status).toBe(200)

      const replay = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )
      expect(replay.status).toBe(401)
    } finally {
      await cleanup()
    }
  })

  it('stops accepting the RIGHT code once the attempt cap is spent', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const issued = await mintCode(db, 'grind@example.com')
      const wrong = issued.code === '000000' ? '111111' : '000000'

      for (let i = 0; i < 5; i++) {
        const res = await handleCmsRequest(
          post(VERIFY, { requestId: issued.requestId, code: wrong }), db,
        )
        expect(res.status).toBe(401)
      }

      // The cap is on the code, not on the guesser: the correct code is now
      // dead too, so five wrong guesses genuinely end the attempt.
      const res = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )
      expect(res.status).toBe(401)
      expect(await findUserByEmail(db, 'grind@example.com')).toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('rejects an expired code', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const issued = await issueEmailLoginCode(db, {
        emailNormalized: 'stale@example.com',
        userId: null,
        purpose: 'login',
        ttlMs: -1_000, // already expired
        ipAddress: null,
        userAgent: null,
      })
      const res = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )
      expect(res.status).toBe(401)
    } finally {
      await cleanup()
    }
  })

  it('rejects the right code under the wrong request id', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const mine = await mintCode(db, 'a@example.com')
      const theirs = await mintCode(db, 'b@example.com')

      // Scoping is what makes guessing 1-in-a-million against ONE code rather
      // than a shot at every live code at once.
      const res = await handleCmsRequest(
        post(VERIFY, { requestId: theirs.requestId, code: mine.code }), db,
      )
      expect(res.status).toBe(401)
    } finally {
      await cleanup()
    }
  })

  it('will not redeem a step-up code as a sign-in code', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const created = await createUser(db, {
        email: 'purpose@example.com',
        displayName: 'Purpose',
        passwordHash: null,
        roleId: 'member',
      })
      const issued = await issueEmailLoginCode(db, {
        emailNormalized: 'purpose@example.com',
        userId: created.id,
        purpose: 'step_up',
        ttlMs: 10 * 60 * 1000,
        ipAddress: null,
        userAgent: null,
      })

      const res = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )
      expect(res.status).toBe(401)
    } finally {
      await cleanup()
    }
  })

  it('still demands the second factor from an MFA account', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const created = await createUser(db, {
        email: 'mfa@example.com',
        displayName: 'MFA',
        passwordHash: await hashPassword('a-very-long-password'),
        roleId: 'member',
      })
      // Enable MFA directly — the code path must respect it regardless of how
      // the account was signed into.
      await db`update users set mfa_enabled = 1 where id = ${created.id}`

      const issued = await mintCode(db, 'mfa@example.com', created.id)
      const res = await handleCmsRequest(
        post(VERIFY, { requestId: issued.requestId, code: issued.code }), db,
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ ok: true, mfaRequired: true })

      // The cookie exists but authenticates nothing until the second factor
      // clears — the same pending-session rule password login follows.
      const me = await handleCmsRequest(get('/admin/api/cms/me', sessionCookieFrom(res)), db)
      expect(me.status).toBe(401)
    } finally {
      await cleanup()
    }
  })
})
