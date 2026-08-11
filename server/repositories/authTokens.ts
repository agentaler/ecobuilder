import { createHash, randomBytes } from 'node:crypto'
import { nanoid } from 'nanoid'
import type { DbClient } from '../db/client'

/**
 * Single-use tokens for email verification and password reset (E06-T04).
 *
 * The raw token is returned to the caller once (to put in the emailed link) and
 * never stored — only its SHA-256 hash is persisted, exactly like session
 * tokens, so a database read cannot mint a valid link. `consumeAuthToken`
 * atomically marks the token used, so a link works exactly once.
 */
export type AuthTokenKind = 'email_verify' | 'password_reset'

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/**
 * Issue a token of the given kind for a user. Returns the RAW token (for the
 * link); only its hash is stored. Any prior unused tokens of the same kind for
 * this user are invalidated so a fresh request supersedes an old link.
 */
export async function issueAuthToken(
  db: DbClient,
  userId: string,
  kind: AuthTokenKind,
  ttlMs: number,
): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ttlMs)
  // Supersede older links of the same kind — burn them so only the newest works.
  await db`
    update auth_tokens set used_at = current_timestamp
    where user_id = ${userId} and kind = ${kind} and used_at is null
  `
  await db`
    insert into auth_tokens (id, user_id, kind, token_hash, expires_at)
    values (${nanoid()}, ${userId}, ${kind}, ${hashToken(raw)}, ${expiresAt})
  `
  return raw
}

/**
 * Redeem a token. Returns the `userId` it belonged to, or null when the token
 * is unknown, of the wrong kind, already used, or expired. The update is the
 * gate: it only matches an unused, unexpired row and stamps `used_at` in the
 * same statement, so two concurrent redemptions can't both succeed.
 */
export async function consumeAuthToken(
  db: DbClient,
  raw: string,
  kind: AuthTokenKind,
): Promise<string | null> {
  const tokenHash = hashToken(raw)
  const result = await db<{ user_id: string }>`
    update auth_tokens set used_at = current_timestamp
    where token_hash = ${tokenHash}
      and kind = ${kind}
      and used_at is null
      and expires_at > current_timestamp
    returning user_id
  `
  return result.rows[0]?.user_id ?? null
}
