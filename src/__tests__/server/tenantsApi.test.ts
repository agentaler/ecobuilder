/**
 * Workspace switcher + membership management API (E06-T07 backend).
 *
 * Covers the caller-facing routes: list my workspaces, create one, switch the
 * active workspace (membership-gated), and the `users.manage`-gated members
 * roster (list, change role, remove) — all scoped to the session's active
 * tenant so one workspace's admin can't reach into another. The owner role is
 * protected: an admin (has `users.manage`, not `roles.manage`) can't assign it
 * or evict an owner.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { createUser } from '../../../server/repositories/users'
import {
  addTenantMember,
  createTenant,
  getTenantMembership,
  listTenantsForUser,
} from '../../../server/repositories/tenants'
import { findUserBySessionHash } from '../../../server/auth/sessions'
import { createSession } from '../../../server/auth/sessions'
import { createSessionToken, hashSessionToken, sessionExpiry, hashPassword } from '../../../server/auth/tokens'

const ORIGIN = 'http://localhost'

type Db = Parameters<typeof createUser>[0]

async function makeUser(db: Db, key: string, roleId = 'member'): Promise<string> {
  const user = await createUser(db, {
    id: `u_${key}`,
    email: `${key}@example.com`,
    displayName: key,
    passwordHash: await hashPassword('long-enough-password'),
    roleId,
  })
  return user.id
}

async function sessionFor(db: Db, userId: string, tenantId: string): Promise<{ cookie: string; idHash: string }> {
  const token = createSessionToken()
  const idHash = await hashSessionToken(token)
  await createSession(db, {
    idHash,
    userId,
    expiresAt: sessionExpiry(),
    ipAddress: null,
    userAgent: null,
    mfaPassedAt: new Date(),
    activeTenantId: tenantId,
  })
  return { cookie: `ecobuilder_admin_session=${token}`, idHash }
}

function req(method: string, path: string, cookie: string, body?: unknown): Request {
  const headers = new Headers({ origin: ORIGIN })
  if (body !== undefined) headers.set('content-type', 'application/json')
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  request.headers.set('cookie', cookie)
  return request
}

const TENANTS = '/admin/api/cms/tenants'

describe('workspace switcher + membership API', () => {
  it('lists the workspaces a user belongs to and the active one', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const userId = await makeUser(db, 'alice')
      const wsA = await createTenant(db, { slug: 'ws-a', name: 'Workspace A' })
      const wsB = await createTenant(db, { slug: 'ws-b', name: 'Workspace B' })
      await addTenantMember(db, { tenantId: wsA.id, userId, roleId: 'owner' })
      await addTenantMember(db, { tenantId: wsB.id, userId, roleId: 'admin' })
      const { cookie } = await sessionFor(db, userId, wsA.id)

      const res = await handleCmsRequest(req('GET', TENANTS, cookie), db)
      expect(res.status).toBe(200)
      const { tenants, activeTenantId } = await res.json()
      expect(activeTenantId).toBe(wsA.id)
      expect(tenants.map((t: { id: string }) => t.id).sort()).toEqual([wsA.id, wsB.id].sort())
    } finally {
      await cleanup()
    }
  })

  it('creates a new workspace with the caller as its owner', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const userId = await makeUser(db, 'alice')
      const home = await createTenant(db, { slug: 'ws-home', name: 'Home' })
      await addTenantMember(db, { tenantId: home.id, userId, roleId: 'owner' })
      const { cookie } = await sessionFor(db, userId, home.id)

      const res = await handleCmsRequest(req('POST', TENANTS, cookie, { name: 'Second Studio' }), db)
      expect(res.status).toBe(201)
      const { tenant } = await res.json()
      expect(tenant.name).toBe('Second Studio')

      const membership = await getTenantMembership(db, tenant.id, userId)
      expect(membership?.roleId).toBe('owner')
      // It now appears in the caller's workspace list.
      const list = await listTenantsForUser(db, userId)
      expect(list.map((t) => t.id)).toContain(tenant.id)
    } finally {
      await cleanup()
    }
  })

  it('switches the active workspace only to one the caller belongs to', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const userId = await makeUser(db, 'alice')
      const wsA = await createTenant(db, { slug: 'ws-a', name: 'A' })
      const wsB = await createTenant(db, { slug: 'ws-b', name: 'B' })
      const foreign = await createTenant(db, { slug: 'ws-foreign', name: 'Foreign' })
      await addTenantMember(db, { tenantId: wsA.id, userId, roleId: 'owner' })
      await addTenantMember(db, { tenantId: wsB.id, userId, roleId: 'admin' })
      const { cookie, idHash } = await sessionFor(db, userId, wsA.id)

      const ok = await handleCmsRequest(req('POST', `${TENANTS}/switch`, cookie, { tenantId: wsB.id }), db)
      expect(ok.status).toBe(200)
      // The session now resolves capabilities through wsB.
      const resolved = await findUserBySessionHash(db, idHash)
      expect(resolved?.activeTenantId).toBe(wsB.id)

      // A workspace the caller doesn't belong to is a 404, not a switch.
      const denied = await handleCmsRequest(req('POST', `${TENANTS}/switch`, cookie, { tenantId: foreign.id }), db)
      expect(denied.status).toBe(404)
    } finally {
      await cleanup()
    }
  })

  it('members roster is scoped to the active workspace and gated by users.manage', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const ownerId = await makeUser(db, 'owner')
      const memberId = await makeUser(db, 'member')
      const ws = await createTenant(db, { slug: 'ws', name: 'WS' })
      await addTenantMember(db, { tenantId: ws.id, userId: ownerId, roleId: 'owner' })
      await addTenantMember(db, { tenantId: ws.id, userId: memberId, roleId: 'member' })

      // The owner (users.manage) can see the roster.
      const ownerSession = await sessionFor(db, ownerId, ws.id)
      const list = await handleCmsRequest(req('GET', `${TENANTS}/members`, ownerSession.cookie), db)
      expect(list.status).toBe(200)
      const { members } = await list.json()
      expect(members.map((m: { userId: string }) => m.userId).sort()).toEqual([ownerId, memberId].sort())

      // The plain member (no users.manage) is forbidden.
      const memberSession = await sessionFor(db, memberId, ws.id)
      const denied = await handleCmsRequest(req('GET', `${TENANTS}/members`, memberSession.cookie), db)
      expect(denied.status).toBe(403)
    } finally {
      await cleanup()
    }
  })

  it('an owner can change a member\'s role; an admin cannot touch the owner role', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const ownerId = await makeUser(db, 'owner')
      const adminId = await makeUser(db, 'admin')
      const memberId = await makeUser(db, 'member')
      const ws = await createTenant(db, { slug: 'ws', name: 'WS' })
      await addTenantMember(db, { tenantId: ws.id, userId: ownerId, roleId: 'owner' })
      await addTenantMember(db, { tenantId: ws.id, userId: adminId, roleId: 'admin' })
      await addTenantMember(db, { tenantId: ws.id, userId: memberId, roleId: 'member' })

      const owner = await sessionFor(db, ownerId, ws.id)
      const admin = await sessionFor(db, adminId, ws.id)

      // Owner promotes the member to admin.
      const promote = await handleCmsRequest(
        req('PATCH', `${TENANTS}/members/${memberId}`, owner.cookie, { roleId: 'admin' }),
        db,
      )
      expect(promote.status).toBe(200)
      expect((await getTenantMembership(db, ws.id, memberId))?.roleId).toBe('admin')

      // Admin cannot mint an owner…
      const mintOwner = await handleCmsRequest(
        req('PATCH', `${TENANTS}/members/${memberId}`, admin.cookie, { roleId: 'owner' }),
        db,
      )
      expect(mintOwner.status).toBe(403)

      // …nor remove the existing owner.
      const evict = await handleCmsRequest(
        req('DELETE', `${TENANTS}/members/${ownerId}`, admin.cookie),
        db,
      )
      expect(evict.status).toBe(403)
      expect(await getTenantMembership(db, ws.id, ownerId)).not.toBeNull()
    } finally {
      await cleanup()
    }
  })

  it('refuses to remove or demote the last active owner', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const ownerId = await makeUser(db, 'owner')
      const ws = await createTenant(db, { slug: 'ws', name: 'WS' })
      await addTenantMember(db, { tenantId: ws.id, userId: ownerId, roleId: 'owner' })
      const owner = await sessionFor(db, ownerId, ws.id)

      const demote = await handleCmsRequest(
        req('PATCH', `${TENANTS}/members/${ownerId}`, owner.cookie, { roleId: 'admin' }),
        db,
      )
      expect(demote.status).toBe(409)

      const remove = await handleCmsRequest(
        req('DELETE', `${TENANTS}/members/${ownerId}`, owner.cookie),
        db,
      )
      expect(remove.status).toBe(409)
    } finally {
      await cleanup()
    }
  })
})
