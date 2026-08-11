import { createHash, randomBytes } from 'node:crypto'
import { nanoid } from 'nanoid'
import type { DbClient } from '../db/client'
import { addTenantMember } from './tenants'

/**
 * Team invitations (E06-T07). An invite binds an email + role to a tenant; the
 * invitee redeems the emailed token to become a `tenant_member`. Like the auth
 * tokens, only the token hash is stored — the raw token lives solely in the
 * link. Acceptance is idempotent and atomic: the same UPDATE that flips
 * `pending → accepted` is the gate, so a link is consumable exactly once.
 */
export type InvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired'

export interface TenantInvitation {
  id: string
  tenantId: string
  email: string
  roleId: string
  invitedByUserId: string | null
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

interface InvitationRow {
  id: string
  tenant_id: string
  email_normalized: string
  role_id: string
  invited_by_user_id: string | null
  status: string
  expires_at: Date | string
  created_at: Date | string
}

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 48 // 48h

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function toStatus(value: string): InvitationStatus {
  return value === 'accepted' || value === 'cancelled' || value === 'expired' ? value : 'pending'
}

function rowToInvitation(row: InvitationRow): TenantInvitation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email_normalized,
    roleId: row.role_id,
    invitedByUserId: row.invited_by_user_id,
    status: toStatus(row.status),
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  }
}

/**
 * Create (or refresh) a pending invitation for an email into a tenant with a
 * role. Returns the raw token for the link. Re-inviting a still-pending email
 * supersedes the prior invite (its token stops working) so there is always at
 * most one live link per (tenant, email).
 */
export async function createInvitation(
  db: DbClient,
  input: { tenantId: string; email: string; roleId: string; invitedByUserId: string | null; ttlMs?: number },
): Promise<{ invitation: TenantInvitation; token: string }> {
  const email = input.email.trim().toLowerCase()
  const raw = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS))
  // Supersede + insert atomically: the partial unique index allows at most one
  // pending invite per (tenant, email), so both statements must land together.
  const invitation = await db.transaction(async (tx) => {
    await tx`
      update tenant_invitations set status = 'cancelled', updated_at = current_timestamp
      where tenant_id = ${input.tenantId} and email_normalized = ${email} and status = 'pending'
    `
    const result = await tx<InvitationRow>`
      insert into tenant_invitations (id, tenant_id, email_normalized, role_id, invited_by_user_id, token_hash, expires_at)
      values (${nanoid()}, ${input.tenantId}, ${email}, ${input.roleId}, ${input.invitedByUserId}, ${hashToken(raw)}, ${expiresAt})
      returning *
    `
    return rowToInvitation(result.rows[0])
  })
  return { invitation, token: raw }
}

/** Pending, non-expired invitations for a tenant — the "invites" list. */
export async function listPendingInvitations(db: DbClient, tenantId: string): Promise<TenantInvitation[]> {
  const result = await db<InvitationRow>`
    select * from tenant_invitations
    where tenant_id = ${tenantId} and status = 'pending' and expires_at > current_timestamp
    order by created_at desc
  `
  return result.rows.map(rowToInvitation)
}

export async function getInvitationById(db: DbClient, id: string): Promise<TenantInvitation | null> {
  const result = await db<InvitationRow>`select * from tenant_invitations where id = ${id}`
  const row = result.rows[0]
  return row ? rowToInvitation(row) : null
}

/** Cancel a pending invitation. Returns false if it wasn't pending. */
export async function cancelInvitation(db: DbClient, id: string, tenantId: string): Promise<boolean> {
  const result = await db`
    update tenant_invitations set status = 'cancelled', updated_at = current_timestamp
    where id = ${id} and tenant_id = ${tenantId} and status = 'pending'
  `
  return result.rowCount > 0
}

export type AcceptResult =
  | { ok: true; invitation: TenantInvitation }
  | { ok: false; reason: 'not_found' | 'not_pending' | 'expired' | 'email_mismatch' }

/**
 * Accept an invitation by its raw token, joining `userId` to the tenant with
 * the invited role. `userEmail` must match the invited address (verified
 * server-side, never trusted from the client). Atomic: the `pending → accepted`
 * UPDATE is the single-use gate; only on its success is the membership written.
 */
export async function acceptInvitation(
  db: DbClient,
  rawToken: string,
  userId: string,
  userEmail: string,
): Promise<AcceptResult> {
  return db.transaction(async (tx) => {
    const found = await tx<InvitationRow>`
      select * from tenant_invitations where token_hash = ${hashToken(rawToken)}
    `
    const row = found.rows[0]
    if (!row) return { ok: false as const, reason: 'not_found' as const }
    if (toStatus(row.status) !== 'pending') return { ok: false as const, reason: 'not_pending' as const }
    if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false as const, reason: 'expired' as const }
    if (row.email_normalized !== userEmail.trim().toLowerCase()) {
      return { ok: false as const, reason: 'email_mismatch' as const }
    }

    const claimed = await tx`
      update tenant_invitations set status = 'accepted', updated_at = current_timestamp
      where id = ${row.id} and status = 'pending'
    `
    if (claimed.rowCount === 0) return { ok: false as const, reason: 'not_pending' as const }

    await addTenantMember(tx, { tenantId: row.tenant_id, userId, roleId: row.role_id })
    return { ok: true as const, invitation: rowToInvitation(row) }
  })
}
