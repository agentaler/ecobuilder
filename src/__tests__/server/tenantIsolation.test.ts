/**
 * Tenant isolation matrix (E07) — the core security guarantee.
 *
 * Two users, each owning their own workspace, each with a data row in it.
 * Workspace A must never reach workspace B's data: not by direct id, not
 * through a list endpoint, not by mutating it. A cross-tenant id is
 * indistinguishable from a non-existent one — a 404, never a 403 (which would
 * confirm the row exists) and never the data.
 *
 * The workspace is resolved server-side from the session's active tenant, not
 * from anything the client sends, so there is no client-supplied workspace id
 * to forge — the test asserts that resolution holds by using a row id that
 * exists but belongs to the other tenant.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { createUser } from '../../../server/repositories/users'
import { addTenantMember, createTenant } from '../../../server/repositories/tenants'
import { createDataRow } from '../../../server/repositories/data'
import { createSession } from '../../../server/auth/sessions'
import { createSessionToken, hashSessionToken, sessionExpiry, hashPassword } from '../../../server/auth/tokens'

const ORIGIN = 'http://localhost'

interface Actor {
  userId: string
  tenantId: string
  cookie: string
  rowId: string
}

async function makeTenantWithRow(
  db: Parameters<typeof createUser>[0],
  key: string,
): Promise<Actor> {
  const user = await createUser(db, {
    id: `u_${key}`,
    email: `${key}@example.com`,
    displayName: key,
    passwordHash: await hashPassword('long-enough-password'),
    roleId: 'member',
  })
  const tenant = await createTenant(db, { slug: `ws-${key}`, name: `${key} workspace` })
  await addTenantMember(db, { tenantId: tenant.id, userId: user.id, roleId: 'owner' })

  // A post row that belongs to this tenant.
  const row = await createDataRow(
    db,
    { tableId: 'posts', tenantId: tenant.id, cells: { title: `${key} secret post` }, slug: `${key}-post` },
    user.id,
  )

  const token = createSessionToken()
  await createSession(db, {
    idHash: await hashSessionToken(token),
    userId: user.id,
    expiresAt: sessionExpiry(),
    ipAddress: null,
    userAgent: null,
    mfaPassedAt: new Date(),
    activeTenantId: tenant.id,
  })
  return { userId: user.id, tenantId: tenant.id, cookie: `ecobuilder_admin_session=${token}`, rowId: row.id }
}

function req(method: string, path: string, cookie: string, body?: unknown): Request {
  const headers = new Headers({ origin: ORIGIN })
  if (body !== undefined) headers.set('content-type', 'application/json')
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  // `cookie` is a forbidden request header — the test env's Request strips it
  // when passed via init, so set it after construction (as the harness does).
  request.headers.set('cookie', cookie)
  return request
}

describe('tenant isolation matrix', () => {
  it('A can read its own row but B\'s row is 404 by direct id', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await makeTenantWithRow(db, 'alice')
      const b = await makeTenantWithRow(db, 'bob')

      const own = await handleCmsRequest(req('GET', `/admin/api/cms/data/rows/${a.rowId}`, a.cookie), db)
      expect(own.status).toBe(200)

      const cross = await handleCmsRequest(req('GET', `/admin/api/cms/data/rows/${b.rowId}`, a.cookie), db)
      expect(cross.status).toBe(404) // exists, but not in A's workspace
    } finally {
      await cleanup()
    }
  })

  it('a list endpoint shows only the caller\'s workspace rows', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await makeTenantWithRow(db, 'alice')
      const b = await makeTenantWithRow(db, 'bob')

      const res = await handleCmsRequest(req('GET', '/admin/api/cms/data/tables/posts/rows', a.cookie), db)
      expect(res.status).toBe(200)
      const { rows } = await res.json()
      const ids = rows.map((r: { id: string }) => r.id)
      expect(ids).toContain(a.rowId)
      expect(ids).not.toContain(b.rowId)
      // And B's list is the mirror image.
      const resB = await handleCmsRequest(req('GET', '/admin/api/cms/data/tables/posts/rows', b.cookie), db)
      const idsB = (await resB.json()).rows.map((r: { id: string }) => r.id)
      expect(idsB).toContain(b.rowId)
      expect(idsB).not.toContain(a.rowId)
    } finally {
      await cleanup()
    }
  })

  it('A cannot mutate or delete B\'s row (404, not 403)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await makeTenantWithRow(db, 'alice')
      const b = await makeTenantWithRow(db, 'bob')

      const patch = await handleCmsRequest(
        req('PATCH', `/admin/api/cms/data/rows/${b.rowId}`, a.cookie, { cells: { title: 'hijacked' } }),
        db,
      )
      expect(patch.status).toBe(404)

      const del = await handleCmsRequest(req('DELETE', `/admin/api/cms/data/rows/${b.rowId}`, a.cookie), db)
      expect(del.status).toBe(404)

      // B's row is untouched.
      const stillThere = await handleCmsRequest(req('GET', `/admin/api/cms/data/rows/${b.rowId}`, b.cookie), db)
      expect(stillThere.status).toBe(200)
      expect((await stillThere.json()).row.cells.title).toBe('bob secret post')
    } finally {
      await cleanup()
    }
  })
})
