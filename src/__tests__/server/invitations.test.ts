/**
 * Team invitations (E06-T07) — the invite → accept lifecycle and its guards.
 *
 * An invite binds an email + role to the inviter's ACTIVE workspace, resolved
 * server-side from the session. Only `users.manage` holders (owner/admin of the
 * active tenant) can invite/list/cancel; the invitee accepts with the emailed
 * token, gated by a server-side email match. Acceptance is single-use and the
 * workspace scope can't be forged — an owner of one workspace can neither see
 * nor cancel another's invites.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { createUser } from '../../../server/repositories/users'
import { addTenantMember, createTenant, getTenantMembership } from '../../../server/repositories/tenants'
import { createInvitation } from '../../../server/repositories/tenantInvitations'
import { createSession } from '../../../server/auth/sessions'
import { createSessionToken, hashSessionToken, sessionExpiry, hashPassword } from '../../../server/auth/tokens'

const ORIGIN = 'http://localhost'

interface Owner {
  userId: string
  tenantId: string
  cookie: string
}

interface Member {
  userId: string
  email: string
  cookie: string
}

async function sessionCookieFor(
  db: Parameters<typeof createUser>[0],
  userId: string,
  tenantId: string,
): Promise<string> {
  const token = createSessionToken()
  await createSession(db, {
    idHash: await hashSessionToken(token),
    userId,
    expiresAt: sessionExpiry(),
    ipAddress: null,
    userAgent: null,
    mfaPassedAt: new Date(),
    activeTenantId: tenantId,
  })
  return `ecobuilder_admin_session=${token}`
}

async function makeOwner(db: Parameters<typeof createUser>[0], key: string): Promise<Owner> {
  const user = await createUser(db, {
    id: `u_${key}`,
    email: `${key}@example.com`,
    displayName: key,
    passwordHash: await hashPassword('long-enough-password'),
    roleId: 'member',
  })
  const tenant = await createTenant(db, { slug: `ws-${key}`, name: `${key} workspace` })
  await addTenantMember(db, { tenantId: tenant.id, userId: user.id, roleId: 'owner' })
  return { userId: user.id, tenantId: tenant.id, cookie: await sessionCookieFor(db, user.id, tenant.id) }
}

async function makeUser(db: Parameters<typeof createUser>[0], key: string): Promise<Member> {
  const email = `${key}@example.com`
  const user = await createUser(db, {
    id: `u_${key}`,
    email,
    displayName: key,
    passwordHash: await hashPassword('long-enough-password'),
    roleId: 'member',
  })
  return { userId: user.id, email, cookie: await sessionCookieFor(db, user.id, 'default') }
}

function req(method: string, path: string, cookie: string, body?: unknown): Request {
  const headers = new Headers({ origin: ORIGIN })
  if (body !== undefined) headers.set('content-type', 'application/json')
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  // `cookie` is a forbidden request header — set it after construction.
  request.headers.set('cookie', cookie)
  return request
}

const INVITATIONS = '/admin/api/cms/invitations'

describe('team invitations', () => {
  it('owner invites a member who then accepts and joins the workspace', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const owner = await makeOwner(db, 'alice')
      const invitee = await makeUser(db, 'bob')

      const invite = await handleCmsRequest(
        req('POST', INVITATIONS, owner.cookie, { email: invitee.email, roleId: 'admin' }),
        db,
      )
      expect(invite.status).toBe(201)

      // It shows up in the pending list.
      const list = await handleCmsRequest(req('GET', INVITATIONS, owner.cookie), db)
      expect(list.status).toBe(200)
      const { invitations } = await list.json()
      expect(invitations).toHaveLength(1)
      expect(invitations[0].email).toBe(invitee.email)
      // The token is never exposed by the API.
      expect(invitations[0].token).toBeUndefined()

      // Redeem: the raw token lives only in the email, so drive accept from a
      // freshly issued invitation whose token we hold.
      const { token } = await createInvitation(db, {
        tenantId: owner.tenantId,
        email: invitee.email,
        roleId: 'admin',
        invitedByUserId: owner.userId,
      })
      const accept = await handleCmsRequest(
        req('POST', `${INVITATIONS}/accept`, invitee.cookie, { token }),
        db,
      )
      expect(accept.status).toBe(200)
      expect((await accept.json()).tenantId).toBe(owner.tenantId)

      // Bob is now an admin member of Alice's workspace.
      const membership = await getTenantMembership(db, owner.tenantId, invitee.userId)
      expect(membership?.roleId).toBe('admin')
      expect(membership?.status).toBe('active')
    } finally {
      await cleanup()
    }
  })

  it('a member without users.manage cannot invite', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      // A workspace whose caller is a plain member, not owner/admin.
      const user = await createUser(db, {
        id: 'u_carol',
        email: 'carol@example.com',
        displayName: 'carol',
        passwordHash: await hashPassword('long-enough-password'),
        roleId: 'member',
      })
      const tenant = await createTenant(db, { slug: 'ws-carol', name: 'carol workspace' })
      await addTenantMember(db, { tenantId: tenant.id, userId: user.id, roleId: 'member' })
      const cookie = await sessionCookieFor(db, user.id, tenant.id)

      const res = await handleCmsRequest(
        req('POST', INVITATIONS, cookie, { email: 'dave@example.com', roleId: 'admin' }),
        db,
      )
      expect(res.status).toBe(403)
    } finally {
      await cleanup()
    }
  })

  it('rejects an invitation to the owner role', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const owner = await makeOwner(db, 'alice')
      const res = await handleCmsRequest(
        req('POST', INVITATIONS, owner.cookie, { email: 'new@example.com', roleId: 'owner' }),
        db,
      )
      expect(res.status).toBe(400)
    } finally {
      await cleanup()
    }
  })

  it('a cancelled invitation can no longer be accepted', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const owner = await makeOwner(db, 'alice')
      const invitee = await makeUser(db, 'bob')
      const { invitation, token } = await createInvitation(db, {
        tenantId: owner.tenantId,
        email: invitee.email,
        roleId: 'admin',
        invitedByUserId: owner.userId,
      })

      const cancel = await handleCmsRequest(
        req('DELETE', `${INVITATIONS}/${invitation.id}`, owner.cookie),
        db,
      )
      expect(cancel.status).toBe(200)

      const accept = await handleCmsRequest(
        req('POST', `${INVITATIONS}/accept`, invitee.cookie, { token }),
        db,
      )
      expect(accept.status).toBe(409)
    } finally {
      await cleanup()
    }
  })

  it('an expired invitation is rejected on accept', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const owner = await makeOwner(db, 'alice')
      const invitee = await makeUser(db, 'bob')
      const { token } = await createInvitation(db, {
        tenantId: owner.tenantId,
        email: invitee.email,
        roleId: 'admin',
        invitedByUserId: owner.userId,
        ttlMs: -1000, // already expired
      })

      const accept = await handleCmsRequest(
        req('POST', `${INVITATIONS}/accept`, invitee.cookie, { token }),
        db,
      )
      expect(accept.status).toBe(410)
    } finally {
      await cleanup()
    }
  })

  it('rejects accept when the signed-in email differs from the invited address', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const owner = await makeOwner(db, 'alice')
      const wrongUser = await makeUser(db, 'mallory')
      const { token } = await createInvitation(db, {
        tenantId: owner.tenantId,
        email: 'bob@example.com', // invited someone else
        roleId: 'admin',
        invitedByUserId: owner.userId,
      })

      const accept = await handleCmsRequest(
        req('POST', `${INVITATIONS}/accept`, wrongUser.cookie, { token }),
        db,
      )
      expect(accept.status).toBe(403)
    } finally {
      await cleanup()
    }
  })

  it('an owner cannot see or cancel another workspace\'s invitation', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const alice = await makeOwner(db, 'alice')
      const bob = await makeOwner(db, 'bob')

      // Bob invites someone into his own workspace.
      const { invitation } = await createInvitation(db, {
        tenantId: bob.tenantId,
        email: 'carol@example.com',
        roleId: 'admin',
        invitedByUserId: bob.userId,
      })

      // Alice's list never shows Bob's invite.
      const list = await handleCmsRequest(req('GET', INVITATIONS, alice.cookie), db)
      const { invitations } = await list.json()
      expect(invitations).toHaveLength(0)

      // And Alice cannot cancel it — a cross-tenant id is a 404.
      const cancel = await handleCmsRequest(
        req('DELETE', `${INVITATIONS}/${invitation.id}`, alice.cookie),
        db,
      )
      expect(cancel.status).toBe(404)

      // Bob's invite is untouched.
      const bobList = await handleCmsRequest(req('GET', INVITATIONS, bob.cookie), db)
      expect((await bobList.json()).invitations).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })
})
