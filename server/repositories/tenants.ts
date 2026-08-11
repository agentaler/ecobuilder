import { nanoid } from 'nanoid'
import type { DbClient } from '../db/client'
import { normalizeCapabilities, type CoreCapability } from '../auth/capabilities'
import type { TenantMemberRow, TenantRow, TenantStatus } from '../types'

/**
 * The tenant / membership repository — the account boundary the multi-tenant
 * conversion scopes everything to (E06-T02).
 *
 * A tenant is one customer workspace. A membership binds a user to a tenant
 * with a role; roles stay global capability bundles, membership is what makes
 * a capability apply *within* a tenant. A single human (one `users` row, one
 * globally-unique email) can be a member of many tenants — the standard SaaS
 * shape — so authorization resolves through `tenant_members` for the session's
 * active tenant, not through `users.role_id` (that transition lands in
 * E06-T08; this module is the data layer it will consume).
 */

/**
 * The tenant every pre-multi-tenant install is backfilled into (migration
 * 025). Self-hosted single-tenant mode keeps using exactly this one, so the id
 * is a stable, referenceable constant rather than a random nanoid — it matches
 * the `site` row's `'default'` id by design.
 */
export const BOOTSTRAP_TENANT_ID = 'default'
export const BOOTSTRAP_TENANT_SLUG = 'default'

export interface Tenant {
  id: string
  slug: string
  name: string
  status: TenantStatus
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface TenantMembership {
  tenantId: string
  userId: string
  roleId: string
  status: TenantStatus
  createdAt: string
  updatedAt: string
}

/** A tenant joined with the caller's role in it — the shape a tenant switcher needs. */
export interface TenantWithRole extends Tenant {
  roleId: string
  membershipStatus: TenantStatus
}

export class TenantMutationError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'TenantMutationError'
    this.status = status
  }
}

function asStatus(value: unknown): TenantStatus {
  return value === 'suspended' ? 'suspended' : 'active'
}

function rowToTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: asStatus(row.status),
    settings: (row.settings_json ?? {}) as Record<string, unknown>,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

function rowToMembership(row: TenantMemberRow): TenantMembership {
  return {
    tenantId: row.tenant_id,
    userId: row.user_id,
    roleId: row.role_id,
    status: asStatus(row.status),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

// A reserved-slug list keeps a tenant from claiming a first-party surface — the
// same set E09-T09 reserves at the subdomain layer, enforced here at creation
// so the two can never diverge.
const RESERVED_TENANT_SLUGS = new Set([
  'app', 'admin', 'www', 'api', 'mail', 'login', 'account', 'billing',
  'status', 'cdn', 'assets', 'static',
])

/** Normalize + validate a requested slug, or throw a `TenantMutationError`. */
export function normalizeTenantSlug(input: string): string {
  const slug = input.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(slug)) {
    throw new TenantMutationError(
      'Slug must be 2–63 characters, lowercase letters, digits and hyphens, not starting or ending with a hyphen.',
    )
  }
  // The bootstrap tenant owns 'default'; a customer signup must not reuse a
  // first-party surface name. The bootstrap tenant is created by the migration
  // and by setup, never through this validation path.
  if (slug !== BOOTSTRAP_TENANT_SLUG && RESERVED_TENANT_SLUGS.has(slug)) {
    throw new TenantMutationError(`"${slug}" is reserved and cannot be used as a workspace name.`)
  }
  return slug
}

export async function getTenantById(db: DbClient, id: string): Promise<Tenant | null> {
  const result = await db<TenantRow>`select * from tenants where id = ${id}`
  const row = result.rows[0]
  return row ? rowToTenant(row) : null
}

export async function getTenantBySlug(db: DbClient, slug: string): Promise<Tenant | null> {
  const result = await db<TenantRow>`select * from tenants where slug = ${slug}`
  const row = result.rows[0]
  return row ? rowToTenant(row) : null
}

/**
 * Create a tenant. Slug collisions surface as a typed 409 so callers (signup,
 * tenant switcher) can render a field error rather than a raw DB message.
 */
export async function createTenant(
  db: DbClient,
  input: { id?: string; slug: string; name: string; settings?: Record<string, unknown> },
): Promise<Tenant> {
  const slug = input.id === BOOTSTRAP_TENANT_ID ? input.slug : normalizeTenantSlug(input.slug)
  const existing = await getTenantBySlug(db, slug)
  if (existing) throw new TenantMutationError(`Workspace "${slug}" already exists.`, 409)

  const id = input.id ?? nanoid()
  const result = await db<TenantRow>`
    insert into tenants (id, slug, name, settings_json)
    values (${id}, ${slug}, ${input.name}, ${input.settings ?? {}})
    returning *
  `
  return rowToTenant(result.rows[0])
}

/**
 * Add a membership. Idempotent on `(tenant_id, user_id)` — re-adding an
 * existing member updates their role/status rather than erroring, which is the
 * behaviour invitation-accept and role-change both want.
 */
export async function addTenantMember(
  db: DbClient,
  input: { tenantId: string; userId: string; roleId: string; status?: TenantStatus },
): Promise<TenantMembership> {
  const result = await db<TenantMemberRow>`
    insert into tenant_members (tenant_id, user_id, role_id, status)
    values (${input.tenantId}, ${input.userId}, ${input.roleId}, ${input.status ?? 'active'})
    on conflict (tenant_id, user_id) do update
      set role_id = excluded.role_id,
          status = excluded.status,
          updated_at = current_timestamp
    returning *
  `
  return rowToMembership(result.rows[0])
}

/** The effective role a user holds inside a tenant — role identity + capabilities. */
export interface TenantRole {
  id: string
  slug: string
  name: string
  description: string
  isSystem: boolean
  capabilities: CoreCapability[]
}

/**
 * Resolve the role a user holds in a tenant, joined to its capability bundle —
 * the authorization source of truth for the session's active tenant (E06-T08).
 * Returns null when the user is not an active member, letting the auth path
 * fall back to the user's global role during the transition and for any session
 * whose tenant no longer exists.
 */
export async function resolveTenantRole(
  db: DbClient,
  tenantId: string,
  userId: string,
): Promise<TenantRole | null> {
  const result = await db<{
    id: string
    slug: string
    name: string
    description: string
    is_system: boolean | number
    capabilities_json: unknown
  }>`
    select r.id, r.slug, r.name, r.description, r.is_system, r.capabilities_json
    from tenant_members m
    join roles r on r.id = m.role_id
    where m.tenant_id = ${tenantId} and m.user_id = ${userId} and m.status = 'active'
  `
  const row = result.rows[0]
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isSystem: Boolean(row.is_system),
    capabilities: normalizeCapabilities(row.capabilities_json),
  }
}

export async function getTenantMembership(
  db: DbClient,
  tenantId: string,
  userId: string,
): Promise<TenantMembership | null> {
  const result = await db<TenantMemberRow>`
    select * from tenant_members where tenant_id = ${tenantId} and user_id = ${userId}
  `
  const row = result.rows[0]
  return row ? rowToMembership(row) : null
}

/** Every tenant the user belongs to, with their role in each — for the switcher. */
export async function listTenantsForUser(db: DbClient, userId: string): Promise<TenantWithRole[]> {
  const result = await db<TenantRow & { role_id: string; membership_status: string }>`
    select t.*, m.role_id as role_id, m.status as membership_status
    from tenant_members m
    join tenants t on t.id = m.tenant_id
    where m.user_id = ${userId}
    order by t.name asc
  `
  return result.rows.map((row) => ({
    ...rowToTenant(row),
    roleId: row.role_id,
    membershipStatus: asStatus(row.membership_status),
  }))
}

/**
 * Count active owners of a tenant. The last-active-owner guard reads this
 * before allowing an owner to be removed or demoted, so a tenant can never be
 * orphaned.
 */
export async function countActiveTenantOwners(db: DbClient, tenantId: string): Promise<number> {
  const result = await db<{ count: number }>`
    select count(*) as count from tenant_members
    where tenant_id = ${tenantId} and role_id = 'owner' and status = 'active'
  `
  return Number(result.rows[0]?.count ?? 0)
}

/**
 * Throw when a change to `member` would drop the tenant's active-owner count to
 * zero. The rule the migration 026 index-drop hands off to: a tenant must keep
 * at least one active owner, and unlike "at most one owner" that is a minimum,
 * not something a DB unique index can express — so it lives here and every
 * owner-affecting mutation routes through it.
 */
async function assertNotLastActiveOwner(
  db: DbClient,
  member: TenantMembership,
  action: string,
): Promise<void> {
  const isActiveOwner = member.roleId === 'owner' && member.status === 'active'
  if (!isActiveOwner) return
  if ((await countActiveTenantOwners(db, member.tenantId)) <= 1) {
    throw new TenantMutationError(`Cannot ${action} the last active owner of this workspace.`, 409)
  }
}

/**
 * Change a member's role. Refuses to demote the tenant's last active owner.
 * Returns null when the user is not a member of the tenant.
 */
export async function setTenantMemberRole(
  db: DbClient,
  tenantId: string,
  userId: string,
  roleId: string,
): Promise<TenantMembership | null> {
  const member = await getTenantMembership(db, tenantId, userId)
  if (!member) return null
  if (roleId !== 'owner') await assertNotLastActiveOwner(db, member, 'demote')

  const result = await db<TenantMemberRow>`
    update tenant_members set role_id = ${roleId}, updated_at = current_timestamp
    where tenant_id = ${tenantId} and user_id = ${userId}
    returning *
  `
  return rowToMembership(result.rows[0])
}

/**
 * Remove a member from a tenant. Refuses to remove the last active owner.
 * Returns false when the user was not a member.
 */
export async function removeTenantMember(
  db: DbClient,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const member = await getTenantMembership(db, tenantId, userId)
  if (!member) return false
  await assertNotLastActiveOwner(db, member, 'remove')

  await db`delete from tenant_members where tenant_id = ${tenantId} and user_id = ${userId}`
  return true
}
