/**
 * Social sign-in provider registry (E06-T05).
 *
 * A provider exists only while BOTH its env vars are set — an unconfigured
 * provider is absent from `configuredOAuthProviders()`, its start/callback
 * routes 404, and the pre-auth screen never renders its button. That is what
 * makes the whole feature safe to deploy before any OAuth app exists.
 *
 *   OAUTH_GOOGLE_CLIENT_ID / OAUTH_GOOGLE_CLIENT_SECRET
 *   OAUTH_GITHUB_CLIENT_ID / OAUTH_GITHUB_CLIENT_SECRET
 *
 * PKCE is sent only where the provider honours it: Google verifies S256;
 * GitHub OAuth Apps silently ignore `code_challenge`, so for GitHub the state
 * nonce (browser-bound cookie + single-use DB row) is the load-bearing
 * protection. We are a confidential client either way — the secret never
 * leaves the server.
 */
import { expectedOrigin } from './security'

export type OAuthProviderId = 'google' | 'github'

export interface OAuthProviderConfig {
  id: OAuthProviderId
  /** Human label for buttons and audit copy ("Google", "GitHub"). */
  label: string
  authorizeUrl: string
  tokenUrl: string
  scope: string
  clientId: string
  clientSecret: string
  /** Send code_challenge/S256 only where the provider actually verifies it. */
  supportsPkce: boolean
}

function providerFromEnv(
  id: OAuthProviderId,
  label: string,
  urls: { authorizeUrl: string; tokenUrl: string; scope: string; supportsPkce: boolean },
  env: NodeJS.ProcessEnv,
): OAuthProviderConfig | null {
  const prefix = `OAUTH_${id.toUpperCase()}`
  const clientId = env[`${prefix}_CLIENT_ID`]?.trim()
  const clientSecret = env[`${prefix}_CLIENT_SECRET`]?.trim()
  if (!clientId || !clientSecret) return null
  return { id, label, clientId, clientSecret, ...urls }
}

/** Every provider with credentials configured, in display order. */
export function configuredOAuthProviders(env: NodeJS.ProcessEnv = process.env): OAuthProviderConfig[] {
  const providers = [
    providerFromEnv('google', 'Google', {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
      supportsPkce: true,
    }, env),
    providerFromEnv('github', 'GitHub', {
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      // read:user for the profile, user:email for /user/emails — the only way
      // to see a VERIFIED address when the user hides their public email.
      scope: 'read:user user:email',
      supportsPkce: false,
    }, env),
  ]
  return providers.filter((p): p is OAuthProviderConfig => p !== null)
}

/** Resolve a provider id from a URL segment; unknown or unconfigured → null. */
export function oauthProviderById(
  id: string,
  env: NodeJS.ProcessEnv = process.env,
): OAuthProviderConfig | null {
  return configuredOAuthProviders(env).find((p) => p.id === id) ?? null
}

/**
 * The redirect URI registered with the provider. Derived from the canonical
 * public origin so the value we send always matches what the operator
 * registered — a mismatch is the most common OAuth setup failure.
 */
export function oauthRedirectUri(req: Request, id: OAuthProviderId): string {
  return `${expectedOrigin(req)}/admin/api/cms/auth/oauth/${id}/callback`
}
