/**
 * Team invitations (E06-T07) — invite a teammate into the active workspace.
 *
 *   POST   /admin/api/cms/invitations        — invite email + role (users.manage)
 *   GET    /admin/api/cms/invitations        — list pending invites (users.manage)
 *   DELETE /admin/api/cms/invitations/:id    — cancel a pending invite (users.manage)
 *   POST   /admin/api/cms/invitations/accept — accept by token (any signed-in user)
 *
 * The workspace an invite targets is the actor's active tenant, resolved
 * server-side from the session — never client-supplied — so an admin of one
 * workspace can't mint members into another. Acceptance is the one route that
 * is NOT `users.manage`-gated: the invitee is joining a workspace they don't
 * yet belong to, and the emailed token plus a server-side email match are the
 * gate. The raw token lives only in the email; only its hash is stored.
 */
import type { DbClient } from '../../db/client'
import { Type } from '@core/utils/typeboxHelpers'
import { requireAuthenticatedUser, requireCapability } from '../../auth/authz'
import type { AuthUser } from '../../repositories/users'
import { findUserByEmail } from '../../repositories/users'
import { getRoleById } from '../../repositories/roles'
import { getTenantById, getTenantMembership } from '../../repositories/tenants'
import {
  cancelInvitation,
  createInvitation,
  listPendingInvitations,
  acceptInvitation,
} from '../../repositories/tenantInvitations'
import { createAuditEvent } from '../../repositories/audit'
import { sendEmail, publicAppOrigin } from '../../email'
import { badRequest, jsonResponse, readValidatedBody } from '../../http'
import { CMS_API_PREFIX, requestAuditContext } from './shared'
import { runRouteTable, type Route, type RouteParams } from './routeTable'

const InviteBodySchema = Type.Object({
  email: Type.String(),
  roleId: Type.String(),
})

const AcceptBodySchema = Type.Object({ token: Type.String() })

async function sendInvitationEmail(
  db: DbClient,
  input: { email: string; tenantId: string; token: string; roleId: string; inviterName: string },
): Promise<void> {
  const tenant = await getTenantById(db, input.tenantId)
  const workspace = tenant?.name ?? 'a workspace'
  const link = `${publicAppOrigin()}/admin/accept-invitation?token=${encodeURIComponent(input.token)}`
  await sendEmail({
    to: input.email,
    subject: `You've been invited to ${workspace} on Ecobuilder`,
    text:
      `${input.inviterName} invited you to join "${workspace}" on Ecobuilder.\n\n` +
      `Accept the invitation to get started:\n\n${link}\n\n` +
      `This link expires in 48 hours. If you weren't expecting this, you can ignore this email.`,
  })
}

// ---------------------------------------------------------------------------
// Management routes (gated by `users.manage`, scoped to the active tenant)
// ---------------------------------------------------------------------------

async function handleCreateInvite(
  req: Request,
  db: DbClient,
  _params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const tenantId = actor.activeTenantId
  if (!tenantId) return badRequest('No active workspace')

  const body = await readValidatedBody(req, InviteBodySchema)
  if (!body) return badRequest('Invalid request body')
  const email = body.email.trim().toLowerCase()
  if (!email.includes('@')) return badRequest('Invalid email')

  // Ownership is not transferable by invitation — it is set at signup and
  // guarded by the tenant last-owner rules. Every other role is invitable.
  if (body.roleId === 'owner') {
    return jsonResponse({ error: 'The owner role cannot be assigned by invitation.' }, { status: 400 })
  }
  const role = await getRoleById(db, body.roleId)
  if (!role) return badRequest('Unknown role')

  // If the address already belongs to an active member of this workspace,
  // an invite is meaningless — surface it as a clear conflict.
  const existing = await findUserByEmail(db, email)
  if (existing) {
    const membership = await getTenantMembership(db, tenantId, existing.id)
    if (membership && membership.status === 'active') {
      return jsonResponse({ error: 'That person is already a member of this workspace.' }, { status: 409 })
    }
  }

  const { invitation, token } = await createInvitation(db, {
    tenantId,
    email,
    roleId: body.roleId,
    invitedByUserId: actor.id,
  })
  await sendInvitationEmail(db, {
    email,
    tenantId,
    token,
    roleId: body.roleId,
    inviterName: actor.displayName?.trim() || actor.email,
  })
  await createAuditEvent(db, {
    actorUserId: actor.id,
    action: 'invitation.create',
    targetType: 'invitation',
    targetId: invitation.id,
    metadata: { tenantId, roleId: body.roleId, email },
    ...requestAuditContext(req),
  })
  return jsonResponse({ invitation }, { status: 201 })
}

async function handleListInvites(
  _req: Request,
  db: DbClient,
  _params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const tenantId = actor.activeTenantId
  if (!tenantId) return badRequest('No active workspace')
  const invitations = await listPendingInvitations(db, tenantId)
  return jsonResponse({ invitations })
}

async function handleCancelInvite(
  req: Request,
  db: DbClient,
  params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const tenantId = actor.activeTenantId
  if (!tenantId) return badRequest('No active workspace')
  const cancelled = await cancelInvitation(db, params.id, tenantId)
  if (!cancelled) return jsonResponse({ error: 'Invitation not found' }, { status: 404 })
  await createAuditEvent(db, {
    actorUserId: actor.id,
    action: 'invitation.cancel',
    targetType: 'invitation',
    targetId: params.id,
    metadata: { tenantId },
    ...requestAuditContext(req),
  })
  return jsonResponse({ ok: true })
}

const INVITATIONS_PATH = `${CMS_API_PREFIX}/invitations`

const MANAGE_ROUTES: readonly Route<[AuthUser]>[] = [
  { method: 'POST', pattern: INVITATIONS_PATH, handler: handleCreateInvite },
  { method: 'GET', pattern: INVITATIONS_PATH, handler: handleListInvites },
  {
    method: 'DELETE',
    pattern: new RegExp(`^${INVITATIONS_PATH}/(?<id>[^/]+)$`),
    handler: handleCancelInvite,
  },
]

// ---------------------------------------------------------------------------
// Accept route (any authenticated user — the token + email match is the gate)
// ---------------------------------------------------------------------------

async function handleAcceptInvite(req: Request, db: DbClient, actor: AuthUser): Promise<Response> {
  const body = await readValidatedBody(req, AcceptBodySchema)
  if (!body) return badRequest('Invalid request body')

  const result = await acceptInvitation(db, body.token.trim(), actor.id, actor.email)
  if (!result.ok) {
    switch (result.reason) {
      case 'not_found':
        return jsonResponse({ error: 'This invitation link is invalid.' }, { status: 404 })
      case 'not_pending':
        return jsonResponse({ error: 'This invitation has already been used or cancelled.' }, { status: 409 })
      case 'expired':
        return jsonResponse({ error: 'This invitation has expired.' }, { status: 410 })
      case 'email_mismatch':
        return jsonResponse({ error: 'This invitation was sent to a different email address.' }, { status: 403 })
    }
  }
  await createAuditEvent(db, {
    actorUserId: actor.id,
    action: 'invitation.accept',
    targetType: 'invitation',
    targetId: result.invitation.id,
    metadata: { tenantId: result.invitation.tenantId, roleId: result.invitation.roleId },
    ...requestAuditContext(req),
  })
  return jsonResponse({ ok: true, tenantId: result.invitation.tenantId })
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const ACCEPT_PATH = `${INVITATIONS_PATH}/accept`
const INVITATION_ITEM_PATTERN = /^\/admin\/api\/cms\/invitations\/([^/]+)$/

export async function handleInvitationsRoutes(req: Request, db: DbClient): Promise<Response | null> {
  const { pathname } = new URL(req.url)

  // Accept is authenticated but NOT `users.manage`-gated — the invitee is
  // joining a workspace they aren't yet a member of. Matched first so the
  // `/invitations/:id` item pattern below doesn't treat "accept" as an id.
  if (pathname === ACCEPT_PATH) {
    if (req.method !== 'POST') return null
    const actor = await requireAuthenticatedUser(req, db)
    if (actor instanceof Response) return actor
    return handleAcceptInvite(req, db, actor)
  }

  if (pathname !== INVITATIONS_PATH && !INVITATION_ITEM_PATTERN.test(pathname)) {
    return null
  }

  const actor = await requireCapability(req, db, 'users.manage')
  if (actor instanceof Response) return actor

  return runRouteTable(req, db, MANAGE_ROUTES, actor)
}
