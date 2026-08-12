/**
 * Workspace + team persistence (E06-T07): the client stack for the workspace
 * switcher, the members roster, and invitations. Thin `apiRequest` wrappers
 * over the tenant/member/invitation endpoints, each validating the response
 * against a TypeBox schema at the boundary.
 */
import { Type, type Static } from '@sinclair/typebox'
import { apiRequest, type FetchLike } from '@core/http'

const BASE = '/admin/api/cms'

const WorkspaceSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
  status: Type.Union([Type.Literal('active'), Type.Literal('suspended')]),
  roleId: Type.String(),
  membershipStatus: Type.Union([Type.Literal('active'), Type.Literal('suspended')]),
}, { additionalProperties: true })

export type CmsWorkspaceWithRole = Static<typeof WorkspaceSchema>

const WorkspacesEnvelope = Type.Object({
  tenants: Type.Array(WorkspaceSchema),
  activeTenantId: Type.Union([Type.String(), Type.Null()]),
}, { additionalProperties: true })

/** The caller's workspaces + which one is active — drives the switcher. */
export async function listWorkspacesCms(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<{ workspaces: CmsWorkspaceWithRole[]; activeTenantId: string | null }> {
  const body = await apiRequest(`${BASE}/tenants`, {
    schema: WorkspacesEnvelope,
    fetchImpl,
    fallbackMessage: 'Could not load workspaces',
  })
  return { workspaces: body.tenants, activeTenantId: body.activeTenantId }
}

const CmsWorkspaceSchema = Type.Object({
  id: Type.String(),
  slug: Type.String(),
  name: Type.String(),
}, { additionalProperties: true })

const CmsCreateWorkspaceResponseSchema = Type.Object(
  { tenant: CmsWorkspaceSchema, activeTenantId: Type.Optional(Type.String()) },
  { additionalProperties: true },
)

export type CmsWorkspace = Static<typeof CmsWorkspaceSchema>

/**
 * Create a workspace and switch the session into it — the onboarding step and
 * the switcher's "New workspace" action both use this. On success the caller
 * re-reads `/me` to pick up the now-active workspace.
 */
export async function createWorkspaceCms(
  input: { name: string },
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<CmsWorkspace> {
  const body = await apiRequest(`${BASE}/tenants`, {
    method: 'POST',
    body: input,
    schema: CmsCreateWorkspaceResponseSchema,
    fetchImpl,
    fallbackMessage: 'Could not create workspace',
  })
  return body.tenant
}

const SwitchEnvelope = Type.Object(
  { ok: Type.Boolean(), activeTenantId: Type.String() },
  { additionalProperties: true },
)

/** Switch the active workspace. The caller re-hydrates `/me` afterwards. */
export async function switchWorkspaceCms(
  tenantId: string,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<void> {
  await apiRequest(`${BASE}/tenants/switch`, {
    method: 'POST',
    body: { tenantId },
    schema: SwitchEnvelope,
    fetchImpl,
    fallbackMessage: 'Could not switch workspace',
  })
}

// ─── Members ─────────────────────────────────────────────────────────────────

const MemberSchema = Type.Object({
  userId: Type.String(),
  email: Type.String(),
  displayName: Type.String(),
  roleId: Type.String(),
  roleName: Type.String(),
  status: Type.Union([Type.Literal('active'), Type.Literal('suspended')]),
  createdAt: Type.String(),
}, { additionalProperties: true })

export type CmsWorkspaceMember = Static<typeof MemberSchema>

const MembersEnvelope = Type.Object({ members: Type.Array(MemberSchema) }, { additionalProperties: true })

/** Roster of the active workspace (requires `users.manage`). */
export async function listWorkspaceMembersCms(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<CmsWorkspaceMember[]> {
  const body = await apiRequest(`${BASE}/tenants/members`, {
    schema: MembersEnvelope,
    fetchImpl,
    fallbackMessage: 'Could not load members',
  })
  return body.members
}

/** Change a member's role in the active workspace. */
export async function setWorkspaceMemberRoleCms(
  userId: string,
  roleId: string,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<void> {
  await apiRequest(`${BASE}/tenants/members/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: { roleId },
    fetchImpl,
    fallbackMessage: 'Could not change member role',
  })
}

/** Remove a member from the active workspace. */
export async function removeWorkspaceMemberCms(
  userId: string,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<void> {
  await apiRequest(`${BASE}/tenants/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    fetchImpl,
    fallbackMessage: 'Could not remove member',
  })
}

// ─── Invitations ─────────────────────────────────────────────────────────────

const InvitationSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  roleId: Type.String(),
  status: Type.String(),
  expiresAt: Type.String(),
  createdAt: Type.String(),
}, { additionalProperties: true })

export type CmsInvitation = Static<typeof InvitationSchema>

const InvitationsEnvelope = Type.Object({ invitations: Type.Array(InvitationSchema) }, { additionalProperties: true })

/** Pending invitations for the active workspace. */
export async function listInvitationsCms(
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<CmsInvitation[]> {
  const body = await apiRequest(`${BASE}/invitations`, {
    schema: InvitationsEnvelope,
    fetchImpl,
    fallbackMessage: 'Could not load invitations',
  })
  return body.invitations
}

/** Invite an email into the active workspace with a role. */
export async function createInvitationCms(
  input: { email: string; roleId: string },
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<void> {
  await apiRequest(`${BASE}/invitations`, {
    method: 'POST',
    body: input,
    fetchImpl,
    fallbackMessage: 'Could not send invitation',
  })
}

/** Cancel a pending invitation. */
export async function cancelInvitationCms(
  id: string,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<void> {
  await apiRequest(`${BASE}/invitations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    fetchImpl,
    fallbackMessage: 'Could not cancel invitation',
  })
}

const AcceptEnvelope = Type.Object(
  { ok: Type.Boolean(), tenantId: Type.String() },
  { additionalProperties: true },
)

/** Accept an invitation by its emailed token — joins the caller to the workspace. */
export async function acceptInvitationCms(
  token: string,
  fetchImpl: FetchLike = globalThis.fetch.bind(globalThis),
): Promise<{ tenantId: string }> {
  const body = await apiRequest(`${BASE}/invitations/accept`, {
    method: 'POST',
    body: { token },
    schema: AcceptEnvelope,
    fetchImpl,
    fallbackMessage: 'Could not accept invitation',
  })
  return { tenantId: body.tenantId }
}
