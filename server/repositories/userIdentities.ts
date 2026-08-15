import { nanoid } from 'nanoid'
import type { DbClient } from '../db/client'
import type { OAuthProviderId } from '../auth/oauthProviders'

/**
 * Social sign-in identities (E06-T05): which provider account maps to which
 * local user. `(provider, provider_user_id)` is the durable key — once a link
 * exists, the provider's CURRENT email is irrelevant to lookup (an attacker
 * who changes their provider email to a victim's address gains nothing).
 */
export interface UserIdentity {
  id: string
  userId: string
  provider: OAuthProviderId
  providerUserId: string
}

interface IdentityRow {
  id: string
  user_id: string
  provider: string
  provider_user_id: string
}

export async function findIdentity(
  db: DbClient,
  provider: OAuthProviderId,
  providerUserId: string,
): Promise<UserIdentity | null> {
  const { rows } = await db<IdentityRow>`
    select id, user_id, provider, provider_user_id
    from user_identities
    where provider = ${provider} and provider_user_id = ${providerUserId}
    limit 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider as OAuthProviderId,
    providerUserId: row.provider_user_id,
  }
}

/**
 * Link a provider account to a local user. `emailAtLink` is an audit trail of
 * what the provider asserted at linking time, never a lookup key.
 */
export async function createIdentity(
  db: DbClient,
  input: {
    userId: string
    provider: OAuthProviderId
    providerUserId: string
    emailAtLink: string | null
  },
): Promise<void> {
  await db`
    insert into user_identities (id, user_id, provider, provider_user_id, email_at_link, last_login_at)
    values (${nanoid()}, ${input.userId}, ${input.provider}, ${input.providerUserId}, ${input.emailAtLink}, ${new Date()})
  `
}

/** Stamp a successful sign-in through this identity. */
export async function touchIdentityLogin(db: DbClient, identityId: string): Promise<void> {
  await db`
    update user_identities set last_login_at = ${new Date()} where id = ${identityId}
  `
}
