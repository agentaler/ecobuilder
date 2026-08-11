/**
 * Self-service signup, email verification, and password reset (E06-T04).
 *
 * Signup must, in one shot: create the user (unverified), create their own
 * workspace with them as owner, seed starter content into that workspace, sign
 * them in with the workspace active, and email a verification link. Then the
 * verification and reset tokens must be single-use and time-bound.
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
  return new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}

const SIGNUP = '/admin/api/cms/signup'

describe('signup', () => {
  it('creates a user, their workspace as owner, seeds content, and signs them in', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const res = await handleCmsRequest(
        post(SIGNUP, { email: 'newbie@example.com', password: 'long-enough-password', displayName: 'Newbie' }),
        db,
      )
      expect(res.status).toBe(201)
      // Auto-signed-in: a session cookie is set.
      expect(res.headers.get('set-cookie') ?? '').toContain('ecobuilder_admin_session=')

      const user = await findUserByEmail(db, 'newbie@example.com')
      expect(user).not.toBeNull()

      // Owns exactly one workspace, as owner.
      const tenants = await listTenantsForUser(db, user!.id)
      expect(tenants).toHaveLength(1)
      const membership = await getTenantMembership(db, tenants[0].id, user!.id)
      expect(membership?.roleId).toBe('owner')

      // Starter content is scoped to the NEW tenant, not 'default'.
      const rows = await db<{ slug: string; tenant_id: string }>`
        select slug, tenant_id from data_rows where tenant_id = ${tenants[0].id}
      `
      const slugs = rows.rows.map((r) => r.slug).sort()
      expect(slugs).toEqual(['index', 'post-template'])
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
