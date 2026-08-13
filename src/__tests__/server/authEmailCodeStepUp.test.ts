/**
 * Step-up re-auth for accounts with no password (E06-T05).
 *
 * Step-up gates the highest-blast-radius actions (publishing, deleting a user,
 * changing MFA). It verified a password, which an account created by an emailed
 * code or a social provider does not have — so those accounts would have been
 * permanently unable to publish. They now confirm with an emailed code instead.
 *
 * The load-bearing rule, and the reason for the second test here: an account
 * that HAS a password may not substitute a code for it. Otherwise access to a
 * mailbox would be a universal password bypass on every account in the product.
 */
import { beforeEach, describe, expect, it } from 'bun:test'
import type { DbClient } from '../../../server/db'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { createTestDb } from '../helpers/createTestDb'
import { createUser, type AuthUser } from '../../../server/repositories/users'
import { issueEmailLoginCode } from '../../../server/repositories/emailLoginCodes'
import { createSession } from '../../../server/auth/sessions'
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionExpiry,
} from '../../../server/auth/tokens'
import { loginPerIpRateLimit, loginRateLimit } from '../../../server/auth/rateLimit'

const ORIGIN = 'http://localhost'
const STEP_UP = '/admin/api/cms/auth/step-up'
const STEP_UP_CODE = '/admin/api/cms/auth/step-up/email-code'

beforeEach(() => {
  loginRateLimit.reset('unknown|passwordless@example.com')
  loginRateLimit.reset('unknown|haspassword@example.com')
  loginRateLimit.reset('unknown|other@example.com')
  loginPerIpRateLimit.reset('unknown')
})

function post(path: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json', origin: ORIGIN })
  const req = new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (cookie) req.headers.set('cookie', cookie)
  return req
}

/** Sign the user in directly — these tests are about step-up, not login. */
async function sessionFor(db: DbClient, user: AuthUser): Promise<string> {
  const token = createSessionToken()
  await createSession(db, {
    idHash: await hashSessionToken(token),
    userId: user.id,
    expiresAt: sessionExpiry(),
    ipAddress: null,
    userAgent: null,
    mfaPassedAt: new Date(),
  })
  return `${SESSION_COOKIE_NAME}=${token}`
}

async function makeUser(
  db: DbClient,
  email: string,
  passwordHash: string | null,
): Promise<AuthUser> {
  await createUser(db, { email, displayName: email, passwordHash, roleId: 'owner', allowOwnerRole: true })
  const { findUserByEmail } = await import('../../../server/repositories/users')
  const user = await findUserByEmail(db, email)
  if (!user) throw new Error('user not created')
  return user
}

function mintStepUpCode(db: DbClient, email: string, userId: string | null) {
  return issueEmailLoginCode(db, {
    emailNormalized: email,
    userId,
    purpose: 'step_up',
    ttlMs: 10 * 60 * 1000,
    ipAddress: null,
    userAgent: null,
  })
}

describe('email-code step-up', () => {
  it('opens a step-up window for an account with no password', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const user = await makeUser(db, 'passwordless@example.com', null)
      const cookie = await sessionFor(db, user)
      const issued = await mintStepUpCode(db, 'passwordless@example.com', user.id)

      const res = await handleCmsRequest(
        post(STEP_UP, { emailCodeRequestId: issued.requestId, emailCode: issued.code }, cookie),
        db,
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ ok: true })
      // The window rides a rotated session cookie.
      expect(res.headers.get('set-cookie') ?? '').toContain(SESSION_COOKIE_NAME)
    } finally {
      await cleanup()
    }
  })

  it('refuses an email code from an account that HAS a password', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      // The downgrade attack: if this passed, reading someone's mail would beat
      // knowing their password everywhere step-up is required.
      const user = await makeUser(db, 'haspassword@example.com', await hashPassword('a-very-long-password'))
      const cookie = await sessionFor(db, user)
      const issued = await mintStepUpCode(db, 'haspassword@example.com', user.id)

      const res = await handleCmsRequest(
        post(STEP_UP, { emailCodeRequestId: issued.requestId, emailCode: issued.code }, cookie),
        db,
      )

      expect(res.status).toBe(401)
    } finally {
      await cleanup()
    }
  })

  it('will not accept a sign-in code as a step-up code', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const user = await makeUser(db, 'passwordless@example.com', null)
      const cookie = await sessionFor(db, user)
      const loginCode = await issueEmailLoginCode(db, {
        emailNormalized: 'passwordless@example.com',
        userId: user.id,
        purpose: 'login',
        ttlMs: 10 * 60 * 1000,
        ipAddress: null,
        userAgent: null,
      })

      const res = await handleCmsRequest(
        post(STEP_UP, { emailCodeRequestId: loginCode.requestId, emailCode: loginCode.code }, cookie),
        db,
      )

      expect(res.status).toBe(401)
    } finally {
      await cleanup()
    }
  })

  it("refuses a code minted for somebody else's account", async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const mine = await makeUser(db, 'passwordless@example.com', null)
      const other = await makeUser(db, 'other@example.com', null)
      const cookie = await sessionFor(db, mine)
      // A live, correct, step-up-purpose code — but issued for another account.
      const issued = await mintStepUpCode(db, 'other@example.com', other.id)

      const res = await handleCmsRequest(
        post(STEP_UP, { emailCodeRequestId: issued.requestId, emailCode: issued.code }, cookie),
        db,
      )

      expect(res.status).toBe(401)
    } finally {
      await cleanup()
    }
  })

  it('only mails a step-up code to accounts that need one', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const passwordless = await makeUser(db, 'passwordless@example.com', null)
      const ok = await handleCmsRequest(
        post(STEP_UP_CODE, {}, await sessionFor(db, passwordless)), db,
      )
      expect(ok.status).toBe(200)
      expect(await ok.json()).toMatchObject({ ok: true })

      const withPassword = await makeUser(
        db, 'haspassword@example.com', await hashPassword('a-very-long-password'),
      )
      const refused = await handleCmsRequest(
        post(STEP_UP_CODE, {}, await sessionFor(db, withPassword)), db,
      )
      expect(refused.status).toBe(400)
    } finally {
      await cleanup()
    }
  })
})
