import { createHash, randomBytes } from 'node:crypto'
import type { DbClient } from '../db/client'
import type { OAuthProviderId } from '../auth/oauthProviders'

/**
 * OAuth login flow state (E06-T05). One row per started flow, created at
 * `/start` and consumed exactly once at `/callback`.
 *
 * The row is keyed by the SHA-256 of the browser's state nonce — the sessions
 * / auth_tokens discipline: a database read never yields a live credential.
 * The same nonce also rides a browser-bound cookie, so completing a flow needs
 * BOTH the nonce (cookie + query) and the un-consumed row; a leaked callback
 * URL alone is not enough, and a replayed one dies on `consumed_at`.
 */

function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex')
}

export interface StartedOAuthFlow {
  /** The raw nonce — goes in the provider's `state` param AND the cookie. */
  state: string
  codeVerifier: string
}

export interface ConsumedOAuthFlow {
  provider: OAuthProviderId
  codeVerifier: string
  linkUserId: string | null
  redirectAfter: string
}

export async function createOAuthLoginState(
  db: DbClient,
  input: {
    provider: OAuthProviderId
    ttlMs: number
    linkUserId?: string | null
    redirectAfter?: string
  },
): Promise<StartedOAuthFlow> {
  const state = randomBytes(32).toString('base64url')
  // 32 random bytes base64url = 43 chars — a valid RFC 7636 verifier as-is.
  const codeVerifier = randomBytes(32).toString('base64url')
  await db`
    insert into oauth_login_states (state_hash, provider, code_verifier, link_user_id, redirect_after, expires_at)
    values (
      ${hashState(state)}, ${input.provider}, ${codeVerifier},
      ${input.linkUserId ?? null}, ${input.redirectAfter ?? '/admin'},
      ${new Date(Date.now() + input.ttlMs)}
    )
  `
  return { state, codeVerifier }
}

/**
 * Redeem a flow's state. The single guarded UPDATE is the gate: it only
 * matches a live, un-consumed row for the expected provider and stamps
 * `consumed_at` in the same statement, so a replayed callback cannot win
 * twice. Expiry compares against a bound timestamp (never SQLite's
 * `current_timestamp` — its format sorts below ISO text on the same day).
 */
export async function consumeOAuthLoginState(
  db: DbClient,
  state: string,
  provider: OAuthProviderId,
): Promise<ConsumedOAuthFlow | null> {
  const { rows } = await db<{
    provider: string
    code_verifier: string
    link_user_id: string | null
    redirect_after: string
  }>`
    update oauth_login_states set consumed_at = ${new Date()}
    where state_hash = ${hashState(state)}
      and provider = ${provider}
      and consumed_at is null
      and expires_at > ${new Date()}
    returning provider, code_verifier, link_user_id, redirect_after
  `
  const row = rows[0]
  if (!row) return null
  return {
    provider: row.provider as OAuthProviderId,
    codeVerifier: row.code_verifier,
    linkUserId: row.link_user_id,
    redirectAfter: row.redirect_after,
  }
}
