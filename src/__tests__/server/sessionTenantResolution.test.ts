/**
 * E06-T08: a session carries an active tenant, and the authenticated user's
 * role + capabilities resolve through THAT tenant's membership — not through
 * the user's global `users.role_id`.
 *
 * The acceptance criterion: one human who is an owner in tenant A and a plain
 * member in tenant B must get the owner capability set when a session scoped to
 * A resolves, and the (empty) member set when a session scoped to B resolves —
 * from the same user row. This is what makes a tenant-scoping bug fail closed
 * instead of leaking cross-tenant authority.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { createSession, findUserBySessionHash } from '../../../server/auth/sessions'
import { hashSessionToken, createSessionToken } from '../../../server/auth/tokens'
import { createUser } from '../../../server/repositories/users'
import { addTenantMember, createTenant } from '../../../server/repositories/tenants'

async function makeSession(db: Parameters<typeof createSession>[0], userId: string, activeTenantId: string) {
  const token = createSessionToken()
  const idHash = await hashSessionToken(token)
  await createSession(db, {
    idHash,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    ipAddress: null,
    userAgent: null,
    activeTenantId,
  })
  return idHash
}

describe('session capability resolution is tenant-scoped', () => {
  it('resolves the same user to different roles in different tenants', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const user = await createUser(db, {
        id: 'u_multi',
        email: 'multi@example.com',
        displayName: 'Multi',
        passwordHash: 'x',
        roleId: 'member', // global role is irrelevant once membership resolves
      })
      const a = await createTenant(db, { slug: 'tenant-a', name: 'A' })
      const b = await createTenant(db, { slug: 'tenant-b', name: 'B' })
      await addTenantMember(db, { tenantId: a.id, userId: user.id, roleId: 'owner' })
      await addTenantMember(db, { tenantId: b.id, userId: user.id, roleId: 'member' })

      const sessionA = await makeSession(db, user.id, a.id)
      const sessionB = await makeSession(db, user.id, b.id)

      const asOwner = await findUserBySessionHash(db, sessionA)
      const asMember = await findUserBySessionHash(db, sessionB)

      expect(asOwner?.activeTenantId).toBe(a.id)
      expect(asOwner?.role.slug).toBe('owner')
      expect(asOwner?.capabilities).toContain('users.manage')

      expect(asMember?.activeTenantId).toBe(b.id)
      expect(asMember?.role.slug).toBe('member')
      // The member role carries no admin capabilities — the whole point.
      expect(asMember?.capabilities).not.toContain('users.manage')
    } finally {
      await cleanup()
    }
  })

  it('falls back to the global role when the active tenant has no membership', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const user = await createUser(db, {
        id: 'u_orphan',
        email: 'orphan@example.com',
        displayName: 'Orphan',
        passwordHash: 'x',
        roleId: 'admin',
      })
      // Session points at a tenant the user is NOT a member of.
      const ghost = await createTenant(db, { slug: 'ghost', name: 'Ghost' })
      const session = await makeSession(db, user.id, ghost.id)

      const resolved = await findUserBySessionHash(db, session)
      // No membership → the global role (admin) stands, safe default.
      expect(resolved?.role.slug).toBe('admin')
      expect(resolved?.capabilities).toContain('users.manage')
    } finally {
      await cleanup()
    }
  })
})
