/**
 * Social sign-in (E06-T05) — Google + GitHub authorization-code flows.
 *
 *   GET /admin/api/cms/auth/oauth/:provider/start     — bounce to the provider
 *   GET /admin/api/cms/auth/oauth/:provider/callback  — code → session
 *
 * Both are GET by necessity, not style: the CSRF origin check 403s cross-origin
 * state-changing methods, so a `form_post` callback could never land. The
 * `state` round-trip is what replaces that check here — the callback requires
 * the browser-bound nonce cookie, the query `state`, and a live single-use DB
 * row to all agree before any code is exchanged.
 *
 * Account linking is by `(provider, provider_user_id)` first, verified email
 * second, and REFUSES everything else. The one-line rule: auto-link requires
 * verified on both sides. An attacker who signs up locally with a victim's
 * address (unverified) cannot capture the victim's future Google sign-in, and
 * an attacker whose provider email is unverified captures nothing — both
 * refusals are the E06-T05 acceptance criterion.
 *
 * Terminates in `issueLoginSession` like every other login method; the JSON
 * response is re-wrapped as a redirect (`/admin`, or `/admin?mfa=1` for a
 * pending-MFA session the boot hook routes to the MFA screen).
 */
import { nanoid } from 'nanoid'
import type { DbClient } from '../../db/client'
import { Type, parseValue, filterArray } from '@core/utils/typeboxHelpers'
import {
  oauthProviderById,
  oauthRedirectUri,
  type OAuthProviderConfig,
  type OAuthProviderId,
} from '../../auth/oauthProviders'
import {
  consumeOAuthLoginState,
  createOAuthLoginState,
} from '../../repositories/oauthLoginStates'
import {
  createIdentity,
  findIdentity,
  touchIdentityLogin,
} from '../../repositories/userIdentities'
import {
  createUser,
  findUserByEmail,
  findUserById,
  normalizeEmail,
  type AuthUser,
} from '../../repositories/users'
import { createAuditEvent } from '../../repositories/audit'
import { pkceChallengeForVerifier } from '../../ai/mcp/connectors/token'
import { readCookie } from '../../auth/authz'
import { clientIp, publicOriginIsHttps } from '../../auth/security'
import { oauthStartRateLimit } from '../../auth/rateLimit'
import { jsonResponse } from '../../http'
import { CMS_API_PREFIX, requestAuditContext } from './shared'
import { issueLoginSession, type LoginMethod } from './loginSession'
import { runRouteTable, type Route, type RouteParams } from './routeTable'

/** Ten minutes to round-trip the provider's consent screen. */
const STATE_TTL_MS = 10 * 60 * 1000

const STATE_COOKIE_NAME = 'ecobuilder_oauth_state'
/** Narrow enough to ride only the two OAuth endpoints, wide enough for both providers. */
const STATE_COOKIE_PATH = `${CMS_API_PREFIX}/auth/oauth`

function stateCookie(req: Request, value: string, maxAgeSeconds: number): string {
  const secure = publicOriginIsHttps() || req.url.startsWith('https://')
  const base = `${STATE_COOKIE_NAME}=${value}; Path=${STATE_COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`
  return secure ? `${base}; Secure` : base
}

/**
 * Redirect into the admin app. Refusals ride an `authError` code the pre-auth
 * screen maps to human copy — never provider detail, which is logged
 * server-side instead.
 */
function redirectResponse(location: string, cookies: string[]): Response {
  // Cookies are appended AFTER construction (the `setCookieHeader` pattern in
  // server/http.ts): Set-Cookie is a spec-forbidden response header, and a
  // Headers object passed into the Response constructor gets it stripped in
  // spec-strict runtimes. Post-construction append survives everywhere.
  const res = new Response(null, { status: 302, headers: { location } })
  for (const cookie of cookies) res.headers.append('set-cookie', cookie)
  return res
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider HTTP — raw fetch + TypeBox at the boundary (the AI-driver pattern)
// ─────────────────────────────────────────────────────────────────────────────

const TokenResponseSchema = Type.Object({
  access_token: Type.String(),
}, { additionalProperties: true })

const GoogleUserinfoSchema = Type.Object({
  sub: Type.String(),
  email: Type.Optional(Type.String()),
  email_verified: Type.Optional(Type.Boolean()),
  name: Type.Optional(Type.String()),
}, { additionalProperties: true })

const GithubUserSchema = Type.Object({
  id: Type.Number(),
  login: Type.String(),
  name: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  email: Type.Optional(Type.Union([Type.String(), Type.Null()])),
}, { additionalProperties: true })

const GithubEmailSchema = Type.Object({
  email: Type.String(),
  primary: Type.Boolean(),
  verified: Type.Boolean(),
}, { additionalProperties: true })

/** What every provider normalizes to before the linking rules run. */
interface OAuthProfile {
  providerUserId: string
  email: string | null
  /** Only a provider-asserted VERIFIED address may auto-link or auto-verify. */
  emailVerified: boolean
  displayName: string
}

async function exchangeCode(
  provider: OAuthProviderConfig,
  req: Request,
  code: string,
  codeVerifier: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthRedirectUri(req, provider.id),
  })
  if (provider.supportsPkce) body.set('code_verifier', codeVerifier)

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      // GitHub answers form-encoded unless JSON is explicitly requested.
      accept: 'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${provider.id} token endpoint responded ${res.status}: ${detail.slice(0, 200)}`)
  }
  return parseValue(TokenResponseSchema, await res.json()).access_token
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`google userinfo responded ${res.status}`)
  const info = parseValue(GoogleUserinfoSchema, await res.json())
  return {
    providerUserId: info.sub,
    email: info.email ?? null,
    emailVerified: info.email_verified === true,
    displayName: info.name ?? '',
  }
}

async function fetchGithubProfile(accessToken: string): Promise<OAuthProfile> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    // GitHub's API rejects requests without a User-Agent.
    'user-agent': 'ecobuilder-auth',
    accept: 'application/vnd.github+json',
  }
  const userRes = await fetch('https://api.github.com/user', { headers })
  if (!userRes.ok) throw new Error(`github /user responded ${userRes.status}`)
  const user = parseValue(GithubUserSchema, await userRes.json())

  // The profile's `email` is whatever the user chose to display and says
  // nothing about verification — /user/emails is the only source of a
  // provider-verified address (the `user:email` scope exists for this).
  let email: string | null = null
  let emailVerified = false
  const emailsRes = await fetch('https://api.github.com/user/emails', { headers })
  if (emailsRes.ok) {
    const emails = filterArray(GithubEmailSchema, await emailsRes.json())
    const primary = emails.find((entry) => entry.primary) ?? emails.find((entry) => entry.verified)
    if (primary) {
      email = primary.email
      emailVerified = primary.verified
    }
  }
  if (!email && user.email) {
    email = user.email
  }

  return {
    providerUserId: String(user.id),
    email,
    emailVerified,
    displayName: user.name ?? user.login,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/oauth/:provider/start
// ─────────────────────────────────────────────────────────────────────────────

async function handleOAuthStart(req: Request, db: DbClient, params: RouteParams): Promise<Response> {
  const provider = oauthProviderById(params['provider'] ?? '')
  // Unconfigured or unknown → the route genuinely doesn't exist on this install.
  if (!provider) return jsonResponse({ error: 'Not found' }, { status: 404 })

  const ip = clientIp(req)
  const decision = oauthStartRateLimit.consume(ip ?? 'unknown')
  if (!decision.ok) {
    return jsonResponse(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(decision.retryAfterMs / 1000)) } },
    )
  }

  const flow = await createOAuthLoginState(db, { provider: provider.id, ttlMs: STATE_TTL_MS })

  const authorize = new URL(provider.authorizeUrl)
  authorize.searchParams.set('client_id', provider.clientId)
  authorize.searchParams.set('redirect_uri', oauthRedirectUri(req, provider.id))
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('scope', provider.scope)
  authorize.searchParams.set('state', flow.state)
  if (provider.supportsPkce) {
    authorize.searchParams.set('code_challenge', await pkceChallengeForVerifier(flow.codeVerifier))
    authorize.searchParams.set('code_challenge_method', 'S256')
  }
  if (provider.id === 'google') {
    // Always let the user pick the account — silently reusing the browser's
    // default Google session surprises anyone with more than one.
    authorize.searchParams.set('prompt', 'select_account')
  }

  return redirectResponse(authorize.toString(), [
    stateCookie(req, flow.state, Math.round(STATE_TTL_MS / 1000)),
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/oauth/:provider/callback
// ─────────────────────────────────────────────────────────────────────────────

/** Re-wrap `issueLoginSession`'s JSON response as the redirect a top-level
 * navigation needs, preserving its Set-Cookie and MFA branch. */
async function redirectWithSession(
  db: DbClient,
  req: Request,
  user: AuthUser,
  ip: string | null,
  method: LoginMethod,
  clearStateCookie: string,
): Promise<Response> {
  const sessionRes = await issueLoginSession(db, req, user, user.email.toLowerCase(), ip, method)
  const body = parseValue(
    Type.Object({ mfaRequired: Type.Optional(Type.Boolean()) }, { additionalProperties: true }),
    await sessionRes.json(),
  )
  // `getSetCookie()`, not `get('set-cookie')` — the latter is special-cased
  // for Set-Cookie and returns null in some runtimes (bun:test among them).
  const cookies = [clearStateCookie, ...sessionRes.headers.getSetCookie()]
  // `?mfa=1` tells the boot hook to open on the MFA screen — a pending session
  // authenticates nothing, so without the hint the user would land on a login
  // form that has no idea a second factor is one step away.
  return redirectResponse(body.mfaRequired === true ? '/admin?mfa=1' : '/admin', cookies)
}

async function refuse(
  db: DbClient,
  req: Request,
  code: 'link_required' | 'email_unverified' | 'account_disabled' | 'oauth_failed' | 'oauth_denied',
  clearStateCookie: string,
  context: { provider: OAuthProviderId; email?: string | null; userId?: string | null },
): Promise<Response> {
  await createAuditEvent(db, {
    actorUserId: context.userId ?? null,
    action: 'login.failure',
    targetType: 'user',
    targetId: context.userId ?? null,
    metadata: { method: `oauth:${context.provider}`, reason: code, email: context.email ?? '' },
    ...requestAuditContext(req),
  })
  return redirectResponse(`/admin?authError=${code}`, [clearStateCookie])
}

async function handleOAuthCallback(req: Request, db: DbClient, params: RouteParams): Promise<Response> {
  const provider = oauthProviderById(params['provider'] ?? '')
  if (!provider) return jsonResponse({ error: 'Not found' }, { status: 404 })

  const url = new URL(req.url)
  const clearCookie = stateCookie(req, '', 0)
  const ip = clientIp(req)

  // The user clicked "cancel" on the consent screen — a normal outcome, not a
  // protocol violation. Send them back with a soft message.
  if (url.searchParams.get('error')) {
    return refuse(db, req, 'oauth_denied', clearCookie, { provider: provider.id })
  }

  // State discipline: browser cookie, query param, and a live un-consumed DB
  // row must all agree. Failures here are protocol violations (or replays) a
  // real user never produces by accident — they get a hard 400, not a redirect.
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  if (!state || !code) return jsonResponse({ error: 'Invalid OAuth response' }, { status: 400 })
  if (readCookie(req, STATE_COOKIE_NAME) !== state) {
    return jsonResponse({ error: 'Invalid OAuth state' }, { status: 400 })
  }
  const flow = await consumeOAuthLoginState(db, state, provider.id)
  if (!flow) return jsonResponse({ error: 'Invalid OAuth state' }, { status: 400 })

  let profile: OAuthProfile
  try {
    const accessToken = await exchangeCode(provider, req, code, flow.codeVerifier)
    profile = provider.id === 'google'
      ? await fetchGoogleProfile(accessToken)
      : await fetchGithubProfile(accessToken)
  } catch (err) {
    console.error(`[oauth:${provider.id}] exchange failed:`, err)
    return refuse(db, req, 'oauth_failed', clearCookie, { provider: provider.id })
  }

  const method: LoginMethod = `oauth:${provider.id}`

  // 1. A known identity signs in, full stop — the provider's CURRENT email is
  //    deliberately ignored, so repointing a provider account's address at a
  //    victim gains nothing.
  const identity = await findIdentity(db, provider.id, profile.providerUserId)
  if (identity) {
    const user = await findUserById(db, identity.userId)
    if (!user || user.status !== 'active') {
      return refuse(db, req, 'account_disabled', clearCookie, {
        provider: provider.id, userId: identity.userId,
      })
    }
    await touchIdentityLogin(db, identity.id)
    return redirectWithSession(db, req, user, ip, method, clearCookie)
  }

  // A provider profile with no usable address cannot become an account (email
  // is the product's identity key) and cannot be matched to one.
  if (!profile.email) {
    console.error(`[oauth:${provider.id}] profile carried no email address`)
    return refuse(db, req, 'oauth_failed', clearCookie, { provider: provider.id })
  }
  const email = normalizeEmail(profile.email)
  const local = await findUserByEmail(db, email)

  // 2. Unverified on EITHER side blocks auto-linking onto an existing account.
  if (local && !profile.emailVerified) {
    return refuse(db, req, 'email_unverified', clearCookie, {
      provider: provider.id, email, userId: local.id,
    })
  }
  if (local && local.emailVerifiedAt === null) {
    return refuse(db, req, 'link_required', clearCookie, {
      provider: provider.id, email, userId: local.id,
    })
  }

  // 3. Verified on both sides → link and sign in.
  if (local) {
    if (local.status !== 'active') {
      return refuse(db, req, 'account_disabled', clearCookie, {
        provider: provider.id, email, userId: local.id,
      })
    }
    await createIdentity(db, {
      userId: local.id,
      provider: provider.id,
      providerUserId: profile.providerUserId,
      emailAtLink: email,
    })
    await createAuditEvent(db, {
      actorUserId: local.id,
      action: 'user.update',
      targetType: 'user',
      targetId: local.id,
      metadata: { identityLinked: provider.id },
      ...requestAuditContext(req),
    })
    return redirectWithSession(db, req, local, ip, method, clearCookie)
  }

  // 4. No local account → create one. Passwordless (the provider is the
  //    credential); verified only when the provider asserts the address is.
  await createUser(db, {
    id: nanoid(),
    email,
    displayName: profile.displayName,
    passwordHash: null,
    roleId: 'member',
    emailVerified: profile.emailVerified,
  })
  const created = await findUserByEmail(db, email)
  if (!created) return refuse(db, req, 'oauth_failed', clearCookie, { provider: provider.id, email })
  await createIdentity(db, {
    userId: created.id,
    provider: provider.id,
    providerUserId: profile.providerUserId,
    emailAtLink: email,
  })
  await createAuditEvent(db, {
    actorUserId: created.id,
    action: 'user.signup',
    targetType: 'user',
    targetId: created.id,
    metadata: { email, method },
    ...requestAuditContext(req),
  })
  return redirectWithSession(db, req, created, ip, method, clearCookie)
}

// ─────────────────────────────────────────────────────────────────────────────
// Route table — chained from handlers/cms/index.ts
// ─────────────────────────────────────────────────────────────────────────────

const OAUTH_ROUTES: readonly Route<[]>[] = [
  {
    method: 'GET',
    pattern: new RegExp(`^${CMS_API_PREFIX}/auth/oauth/(?<provider>[a-z]+)/start$`),
    handler: handleOAuthStart,
  },
  {
    method: 'GET',
    pattern: new RegExp(`^${CMS_API_PREFIX}/auth/oauth/(?<provider>[a-z]+)/callback$`),
    handler: handleOAuthCallback,
  },
]

export async function handleOAuthRoutes(req: Request, db: DbClient): Promise<Response | null> {
  return runRouteTable(req, db, OAUTH_ROUTES)
}
