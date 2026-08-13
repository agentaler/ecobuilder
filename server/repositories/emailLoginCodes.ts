import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { nanoid } from 'nanoid'
import type { DbClient } from '../db/client'

/**
 * Emailed sign-in codes (E06-T05) — a short numeric code that proves control
 * of a mailbox. It both signs in an existing account and creates a new one, and
 * (with `purpose: 'step_up'`) re-authenticates an account that has no password
 * to re-enter.
 *
 * Why not `auth_tokens`: that table needs a `user_id`, and a code sent to an
 * address with no account yet has no user to point at.
 *
 * Why redemption is keyed by the row id rather than by the code hash: looking a
 * code up by `where code_hash = ?` would search *every live code at once*, so a
 * blind guess would land on someone's code with probability ≈ (live codes)/10^6
 * — odds that improve as the product grows — and a per-row attempt counter
 * could never stop it, because each guess hits a different row. Keying by the
 * id makes every guess a 1-in-10^6 shot against one code, and `max_attempts`
 * caps it at five. The id is not a secret; it is a scoping key.
 *
 * The hash is salted with that id so a stolen database cannot be reversed with
 * a single 10^6-entry table.
 */
export type EmailLoginCodePurpose = 'login' | 'step_up'

/** Codes are 6 digits — short enough to retype, and bounded by `max_attempts`. */
const CODE_DIGITS = 6

/**
 * Live codes allowed per address. More than one is legitimate (two tabs, or a
 * resend racing the first mail), but an unbounded set would widen the guessing
 * surface, so issuing beyond this burns the oldest.
 */
const MAX_LIVE_CODES_PER_EMAIL = 3

export interface IssuedEmailLoginCode {
  /** Handed to the client; scopes redemption to this one code. */
  requestId: string
  /** The RAW code — goes in the email and is never stored. */
  code: string
  expiresAt: Date
}

export interface RedeemedEmailLoginCode {
  requestId: string
  emailNormalized: string
  /** Null when the code was issued for an address with no account yet. */
  userId: string | null
}

/** Rejection-sampled by `randomInt`, so every code is equally likely. */
function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0')
}

function hashCode(requestId: string, code: string): string {
  return createHash('sha256').update(`${requestId}:${code}`).digest('hex')
}

/** Constant-time compare so a wrong code can't be narrowed by timing. */
function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Mint a code. Returns the raw code (for the email) and the request id (for the
 * client); only the salted hash is stored.
 */
export async function issueEmailLoginCode(
  db: DbClient,
  input: {
    emailNormalized: string
    userId: string | null
    purpose: EmailLoginCodePurpose
    ttlMs: number
    ipAddress: string | null
    userAgent: string | null
  },
): Promise<IssuedEmailLoginCode> {
  // Keep the live set bounded. Ordered oldest-first so the survivors are the
  // newest `MAX_LIVE_CODES_PER_EMAIL - 1` — the new one below makes up the cap.
  const { rows: live } = await db<{ id: string }>`
    select id from email_login_codes
    where email_normalized = ${input.emailNormalized}
      and purpose = ${input.purpose}
      and consumed_at is null
      and expires_at > ${new Date()}
    order by created_at asc
  `
  const excess = live.slice(0, Math.max(0, live.length - (MAX_LIVE_CODES_PER_EMAIL - 1)))
  for (const row of excess) {
    await db`
      update email_login_codes set consumed_at = current_timestamp where id = ${row.id}
    `
  }

  const requestId = nanoid()
  const code = generateCode()
  const expiresAt = new Date(Date.now() + input.ttlMs)
  await db`
    insert into email_login_codes (
      id, email_normalized, user_id, purpose, code_hash, expires_at, ip_address, user_agent
    )
    values (
      ${requestId}, ${input.emailNormalized}, ${input.userId}, ${input.purpose},
      ${hashCode(requestId, code)}, ${expiresAt}, ${input.ipAddress}, ${input.userAgent}
    )
  `
  return { requestId, code, expiresAt }
}

/**
 * Redeem a code. Returns null when the request id is unknown, the purpose does
 * not match, the code is wrong, or the row is expired, already used, or out of
 * attempts.
 *
 * The first statement is the gate: it bumps `attempts` and returns the row only
 * while it is live and under the cap, so a wrong guess is spent even though the
 * request fails, and two concurrent redemptions cannot both proceed.
 */
export async function consumeEmailLoginCode(
  db: DbClient,
  requestId: string,
  code: string,
  purpose: EmailLoginCodePurpose,
): Promise<RedeemedEmailLoginCode | null> {
  // Expiry compares against a BOUND timestamp, never SQLite's
  // `current_timestamp`: these columns hold ISO text (`…T11:43:26.028Z`) while
  // `current_timestamp` renders `… 11:43:27`, and since 'T' sorts above ' ',
  // every same-day expiry would compare as still in the future.
  const { rows } = await db<{
    id: string
    email_normalized: string
    user_id: string | null
    code_hash: string
  }>`
    update email_login_codes
    set attempts = attempts + 1
    where id = ${requestId}
      and purpose = ${purpose}
      and consumed_at is null
      and expires_at > ${new Date()}
      and attempts < max_attempts
    returning id, email_normalized, user_id, code_hash
  `
  const row = rows[0]
  if (!row) return null
  if (!hashesMatch(row.code_hash, hashCode(requestId, code))) return null

  // Mark used in its own guarded statement so a race cannot redeem twice.
  const consumed = await db<{ id: string }>`
    update email_login_codes set consumed_at = current_timestamp
    where id = ${requestId} and consumed_at is null
    returning id
  `
  if (consumed.rows.length !== 1) return null

  return {
    requestId: row.id,
    emailNormalized: row.email_normalized,
    userId: row.user_id,
  }
}

/**
 * Burn every remaining live code for an address. Called after a successful
 * sign-in so a code still sitting in an inbox cannot be replayed.
 */
export async function burnLiveEmailLoginCodes(
  db: DbClient,
  emailNormalized: string,
): Promise<void> {
  await db`
    update email_login_codes set consumed_at = current_timestamp
    where email_normalized = ${emailNormalized}
      and consumed_at is null
  `
}
