/**
 * Workspaces (tenants) — the switcher + membership management surface.
 *
 *   GET    /admin/api/cms/tenants                     — the caller's workspaces
 *   POST   /admin/api/cms/tenants                     — create a new workspace
 *   POST   /admin/api/cms/tenants/switch              — set the session's active workspace
 *   GET    /admin/api/cms/tenants/members             — members of the active workspace
 *   PATCH  /admin/api/cms/tenants/members/:userId     — change a member's role
 *   DELETE /admin/api/cms/tenants/members/:userId     — remove a member
 *
 * The active workspace is the session's, resolved server-side — the members
 * routes never take a tenant id from the client, so an admin of one workspace
 * can't manage another's roster. Listing / creating / switching are
 * authenticated-only (every user has their own workspaces); the members routes
 * are `users.manage`-gated. Owner is a protected role: only an owner (the sole
 * holder of `roles.manage`) may assign it, or change/remove another owner.
 */
import type { DbClient } from '../../db/client'
import { Type } from '@core/utils/typeboxHelpers'
import {
  getSessionHash,
  requireAuthenticatedUser,
  requireCapability,
  userHasCapability,
} from '../../auth/authz'
import type { AuthUser } from '../../repositories/users'
import { setSessionActiveTenant } from '../../auth/sessions'
import {
  addTenantMember,
  createTenant,
  getTenantMembership,
  listTenantMembers,
  listTenantsForUser,
  removeTenantMember,
  setTenantMemberRole,
  uniqueTenantSlug,
  TenantMutationError,
} from '../../repositories/tenants'
import { seedTenantContent } from '../../repositories/tenantSeed'
import { serializeCollabAwareWrite } from '../../repositories/rowWriteEvents'
import { createAuditEvent } from '../../repositories/audit'
import { badRequest, jsonResponse, readValidatedBody } from '../../http'
import { CMS_API_PREFIX, requestAuditContext } from './shared'
import { runRouteTable, type Route, type RouteParams } from './routeTable'

function tenantMutationError(err: unknown): Response {
  if (err instanceof TenantMutationError) {
    return jsonResponse({ error: err.message }, { status: err.status })
  }
  throw err
}

// ---------------------------------------------------------------------------
// Authenticated routes: list / create / switch
// ---------------------------------------------------------------------------

async function handleListTenants(
  _req: Request,
  db: DbClient,
  _params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const tenants = await listTenantsForUser(db, actor.id)
  return jsonResponse({ tenants, activeTenantId: actor.activeTenantId })
}

const CreateTenantBodySchema = Type.Object({
  name: Type.String(),
  slug: Type.Optional(Type.String()),
})

async function handleCreateTenant(
  req: Request,
  db: DbClient,
  _params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const body = await readValidatedBody(req, CreateTenantBodySchema)
  if (!body) return badRequest('Invalid request body')
  const name = body.name.trim()
  if (!name) return badRequest('Workspace name is required')

  try {
    const result = await serializeCollabAwareWrite(async () =>
      db.transaction(async (tx) => {
        const slug = body.slug?.trim() ? body.slug.trim() : await uniqueTenantSlug(tx, name)
        const tenant = await createTenant(tx, { slug, name })
        await addTenantMember(tx, { tenantId: tenant.id, userId: actor.id, roleId: 'owner' })
        await seedTenantContent(tx, tenant.id)
        return tenant
      }),
    )
    // Drop the creator straight into the new workspace: point their session at
    // it so the next request resolves owner capabilities there. This is what
    // makes onboarding (first workspace) land the user in their editor, and a
    // later "New workspace" switch to it.
    const idHash = await getSessionHash(req)
    if (idHash) await setSessionActiveTenant(db, idHash, result.id)
    await createAuditEvent(db, {
      actorUserId: actor.id,
      action: 'tenant.create',
      targetType: 'tenant',
      targetId: result.id,
      metadata: { slug: result.slug },
      ...requestAuditContext(req),
    })
    return jsonResponse({ tenant: result, activeTenantId: result.id }, { status: 201 })
  } catch (err) {
    return tenantMutationError(err)
  }
}

const SwitchTenantBodySchema = Type.Object({ tenantId: Type.String() })

async function handleSwitchTenant(
  req: Request,
  db: DbClient,
  _params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const body = await readValidatedBody(req, SwitchTenantBodySchema)
  if (!body) return badRequest('Invalid request body')

  // Membership is the authorization: a workspace the caller doesn't actively
  // belong to is a 404, indistinguishable from one that doesn't exist.
  const membership = await getTenantMembership(db, body.tenantId, actor.id)
  if (!membership || membership.status !== 'active') {
    return jsonResponse({ error: 'Workspace not found' }, { status: 404 })
  }
  const idHash = await getSessionHash(req)
  if (!idHash) return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  await setSessionActiveTenant(db, idHash, body.tenantId)
  return jsonResponse({ ok: true, activeTenantId: body.tenantId })
}

// ---------------------------------------------------------------------------
// Members routes: users.manage-gated, scoped to the active workspace
// ---------------------------------------------------------------------------

async function handleListMembers(
  _req: Request,
  db: DbClient,
  _params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const tenantId = actor.activeTenantId
  if (!tenantId) return badRequest('No active workspace')
  const members = await listTenantMembers(db, tenantId)
  return jsonResponse({ members })
}

const MemberRoleBodySchema = Type.Object({ roleId: Type.String() })

/**
 * Owner is a protected role. Only an owner — the sole holder of `roles.manage`
 * among the built-in roles — may assign the owner role or change/remove a
 * member who currently holds it. This stops an admin (who has `users.manage`
 * but not `roles.manage`) from minting owners or evicting one.
 */
function ownerActionForbidden(): Response {
  return jsonResponse(
    { error: 'Only an owner can manage the owner role.' },
    { status: 403 },
  )
}

async function handleMemberRole(
  req: Request,
  db: DbClient,
  params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const tenantId = actor.activeTenantId
  if (!tenantId) return badRequest('No active workspace')
  const body = await readValidatedBody(req, MemberRoleBodySchema)
  if (!body) return badRequest('Invalid request body')

  const target = await getTenantMembership(db, tenantId, params.userId)
  if (!target) return jsonResponse({ error: 'Member not found' }, { status: 404 })

  const touchesOwner = body.roleId === 'owner' || target.roleId === 'owner'
  if (touchesOwner && !userHasCapability(actor, 'roles.manage')) {
    return ownerActionForbidden()
  }

  try {
    const updated = await setTenantMemberRole(db, tenantId, params.userId, body.roleId)
    if (!updated) return jsonResponse({ error: 'Member not found' }, { status: 404 })
    await createAuditEvent(db, {
      actorUserId: actor.id,
      action: 'tenant.member.role',
      targetType: 'user',
      targetId: params.userId,
      metadata: { tenantId, roleId: body.roleId },
      ...requestAuditContext(req),
    })
    return jsonResponse({ membership: updated })
  } catch (err) {
    return tenantMutationError(err)
  }
}

async function handleMemberRemove(
  req: Request,
  db: DbClient,
  params: RouteParams,
  actor: AuthUser,
): Promise<Response> {
  const tenantId = actor.activeTenantId
  if (!tenantId) return badRequest('No active workspace')

  const target = await getTenantMembership(db, tenantId, params.userId)
  if (!target) return jsonResponse({ error: 'Member not found' }, { status: 404 })
  if (target.roleId === 'owner' && !userHasCapability(actor, 'roles.manage')) {
    return ownerActionForbidden()
  }

  try {
    const removed = await removeTenantMember(db, tenantId, params.userId)
    if (!removed) return jsonResponse({ error: 'Member not found' }, { status: 404 })
    await createAuditEvent(db, {
      actorUserId: actor.id,
      action: 'tenant.member.remove',
      targetType: 'user',
      targetId: params.userId,
      metadata: { tenantId },
      ...requestAuditContext(req),
    })
    return jsonResponse({ ok: true })
  } catch (err) {
    return tenantMutationError(err)
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const TENANTS_PATH = `${CMS_API_PREFIX}/tenants`
const SWITCH_PATH = `${TENANTS_PATH}/switch`
const MEMBERS_PATH = `${TENANTS_PATH}/members`
const MEMBER_ITEM_PATTERN = /^\/admin\/api\/cms\/tenants\/members\/([^/]+)$/

const AUTH_ROUTES: readonly Route<[AuthUser]>[] = [
  { method: 'GET', pattern: TENANTS_PATH, handler: handleListTenants },
  { method: 'POST', pattern: TENANTS_PATH, handler: handleCreateTenant },
  { method: 'POST', pattern: SWITCH_PATH, handler: handleSwitchTenant },
]

const MEMBERS_ROUTES: readonly Route<[AuthUser]>[] = [
  { method: 'GET', pattern: MEMBERS_PATH, handler: handleListMembers },
  {
    method: 'PATCH',
    pattern: new RegExp(`^${MEMBERS_PATH}/(?<userId>[^/]+)$`),
    handler: handleMemberRole,
  },
  {
    method: 'DELETE',
    pattern: new RegExp(`^${MEMBERS_PATH}/(?<userId>[^/]+)$`),
    handler: handleMemberRemove,
  },
]

export async function handleTenantsRoutes(req: Request, db: DbClient): Promise<Response | null> {
  const { pathname } = new URL(req.url)

  // Members management — `users.manage`, active-workspace scoped. Checked first
  // so `/tenants/members` isn't mistaken for a workspace named "members".
  if (pathname === MEMBERS_PATH || MEMBER_ITEM_PATTERN.test(pathname)) {
    const actor = await requireCapability(req, db, 'users.manage')
    if (actor instanceof Response) return actor
    return runRouteTable(req, db, MEMBERS_ROUTES, actor)
  }

  if (pathname === TENANTS_PATH || pathname === SWITCH_PATH) {
    const actor = await requireAuthenticatedUser(req, db)
    if (actor instanceof Response) return actor
    return runRouteTable(req, db, AUTH_ROUTES, actor)
  }

  return null
}
