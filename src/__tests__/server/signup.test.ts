/**
 * Self-service signup, onboarding, email verification, and password reset
 * (E06-T04 / E06-T06).
 *
 * Signup creates the ACCOUNT only (unverified) and signs the user in with NO
 * workspace — the response flags `needsOnboarding`. Onboarding (POST /tenants)
 * then creates the first workspace, makes the user its owner, seeds starter
 * content, and switches the session into it. The verification and reset tokens
 * must be single-use and time-bound.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { listTenantsForUser, getTenantMembership } from '../../../server/repositories/tenants'
import { findUserByEmail } from '../../../server/repositories/users'
import { issueAuthToken } from '../../../server/repositories/authTokens'

const ORIGIN = 'http://localhost'

function post(path: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ 'content-type': 'application/json', origin: ORIGIN })
  if (cookie) headers.set('cookie', cookie)
  const req = new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  // `cookie` is a forbidden init header in the test env's Request — set it after.
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

const SIGNUP = '/admin/api/cms/signup'

describe('signup', () => {
  it('creates the account only and signs in with no workspace (needsOnboarding)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const res = await handleCmsRequest(
        post(SIGNUP, { email: 'newbie@example.com', password: 'long-enough-password', displayName: 'Newbie' }),
        db,
      )
      expect(res.status).toBe(201)
      expect(await res.json()).toMatchObject({ ok: true, needsOnboarding: true })
      // Auto-signed-in: a session cookie is set.
      expect(res.headers.get('set-cookie') ?? '').toContain('ecobuilder_admin_session=')

      const user = await findUserByEmail(db, 'newbie@example.com')
      expect(user).not.toBeNull()

      // No workspace yet, and the session's /me reports a null active workspace.
      const tenants = await listTenantsForUser(db, user!.id)
      expect(tenants).toHaveLength(0)
      const me = await handleCmsRequest(get('/admin/api/cms/me', sessionCookieFrom(res)), db)
      expect(me.status).toBe(200)
      expect((await me.json()).user.activeTenantId).toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('onboarding creates the first workspace, seeds content, and switches into it', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const signup = await handleCmsRequest(
        post(SIGNUP, { email: 'founder@example.com', password: 'long-enough-password', displayName: 'Founder' }),
        db,
      )
      const cookie = sessionCookieFrom(signup)

      const created = await handleCmsRequest(
        post('/admin/api/cms/tenants', { name: 'Acme Studio' }, cookie),
        db,
      )
      expect(created.status).toBe(201)
      const tenantId = (await created.json()).tenant.id

      const user = await findUserByEmail(db, 'founder@example.com')
      // Owner of exactly one workspace now.
      const tenants = await listTenantsForUser(db, user!.id)
      expect(tenants.map((t) => t.id)).toEqual([tenantId])
      expect((await getTenantMembership(db, tenantId, user!.id))?.roleId).toBe('owner')

      // Starter content seeded into the new workspace.
      const rows = await db<{ slug: string }>`select slug from data_rows where tenant_id = ${tenantId}`
      expect(rows.rows.map((r) => r.slug).sort()).toEqual(['index', 'post-template'])

      // The session switched into the new workspace: /me now reports it active,
      // with owner capabilities resolved through the membership.
      const me = await handleCmsRequest(get('/admin/api/cms/me', cookie), db)
      const body = await me.json()
      expect(body.user.activeTenantId).toBe(tenantId)
      expect(body.user.role.slug).toBe('owner')
    } finally {
      await cleanup()
    }
  })

  it('starts the account unverified and verifies via a single-use token', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await handleCmsRequest(
        post(SIGNUP, { email: 'verify@example.com', password: 'long-enough-password' }),
        db,
      )
      const user = await findUserByEmail(db, 'verify@example.com')
      const before = await db<{ v: string | null }>`select email_verified_at as v from users where id = ${user!.id}`
      expect(before.rows[0].v).toBeNull()

      // Mint the same kind of token the email carries, then redeem it.
      const token = await issueAuthToken(db, user!.id, 'email_verify', 60_000)
      const ok = await handleCmsRequest(post('/admin/api/cms/verify-email', { token }), db)
      expect(ok.status).toBe(200)
      const after = await db<{ v: string | null }>`select email_verified_at as v from users where id = ${user!.id}`
      expect(after.rows[0].v).not.toBeNull()

      // Re-using the token fails — single use.
      const replay = await handleCmsRequest(post('/admin/api/cms/verify-email', { token }), db)
      expect(replay.status).toBe(400)
    } finally {
      await cleanup()
    }
  })

  it('rejects a duplicate email', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await handleCmsRequest(post(SIGNUP, { email: 'dup@example.com', password: 'long-enough-password' }), db)
      const res = await handleCmsRequest(post(SIGNUP, { email: 'dup@example.com', password: 'long-enough-password' }), db)
      expect(res.status).toBe(409)
    } finally {
      await cleanup()
    }
  })

  it('rejects a short password', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const res = await handleCmsRequest(post(SIGNUP, { email: 'short@example.com', password: 'short' }), db)
      expect(res.status).toBe(400)
    } finally {
      await cleanup()
    }
  })
})

describe('password reset', () => {
  it('forgot-password always returns 200 (no account oracle) and reset consumes the token', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await handleCmsRequest(post(SIGNUP, { email: 'reset@example.com', password: 'long-enough-password' }), db)
      const user = await findUserByEmail(db, 'reset@example.com')

      // Unknown email: still 200.
      const unknown = await handleCmsRequest(post('/admin/api/cms/password/forgot', { email: 'nobody@example.com' }), db)
      expect(unknown.status).toBe(200)
      // Known email: 200.
      const known = await handleCmsRequest(post('/admin/api/cms/password/forgot', { email: 'reset@example.com' }), db)
      expect(known.status).toBe(200)

      const token = await issueAuthToken(db, user!.id, 'password_reset', 60_000)
      const ok = await handleCmsRequest(
        post('/admin/api/cms/password/reset', { token, password: 'a-brand-new-password' }),
        db,
      )
      expect(ok.status).toBe(200)
      // Token is single use.
      const replay = await handleCmsRequest(
        post('/admin/api/cms/password/reset', { token, password: 'another-new-password' }),
        db,
      )
      expect(replay.status).toBe(400)
    } finally {
      await cleanup()
    }
  })
})
