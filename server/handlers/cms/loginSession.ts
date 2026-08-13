/**
 * The single session-issuance path.
 *
 * Every way into the product — password, emailed sign-in code, and (next) a
 * social provider — ends here, so MFA policy, workspace seeding, the sign-in
 * history row and the audit trail cannot drift apart per method. A new method
 * supplies its own credential check and then calls `issueLoginSession`; it does
 * not get to decide what a session looks like.
 *
 * Rate-limit bookkeeping deliberately stays with each caller: the buckets are
 * keyed per method, so only the caller knows which to release.
 */
import type { DbClient } from '../../db/client'
import type { AuthUser } from '../../repositories/users'
import { markUserLoggedIn } from '../../repositories/users'
import { recordLoginAttempt } from '../../repositories/loginAttempts'
import { createAuditEvent } from '../../repositories/audit'
import { resolveDefaultTenantForUser } from '../../repositories/tenants'
import { createSession } from '../../auth/sessions'
import { createSessionToken, hashSessionToken, sessionExpiry } from '../../auth/tokens'
import { jsonResponse, setCookieHeader } from '../../http'
import { sessionCookie } from './session'
import { requestAuditContext } from './shared'

/** How the caller proved who they are — recorded on the success audit event. */
export type LoginMethod = 'password' | 'email_code' | 'oauth:google' | 'oauth:github'

/**
 * An account is "previously locked" when it still carries a `locked_until`
 * timestamp (we let the legitimate user back in once the window elapsed, before
 * a successful login cleared the column) or a non-zero failure counter. Drives
 * the `login.unlocked` audit event so operators see an account recover.
 */
function previouslyLocked(user: AuthUser): boolean {
  if (user.failedLoginCount > 0) return true
  return user.lockedUntil !== null
}

/**
 * Mint a session and return it as a cookie.
 *
 * With MFA enabled the session is created pending (`mfaPassedAt: null`) and the
 * body carries `mfaRequired: true`; the caller's client then posts to
 * `/auth/mfa/verify`, which keys off the pending session and so works for every
 * login method without knowing which one minted it. A pending session
 * authenticates nothing until then — `findUserBySessionHash` refuses it.
 *
 * `extraBody` is merged into the JSON response for method-specific flags.
 */
export async function issueLoginSession(
  db: DbClient,
  req: Request,
  user: AuthUser,
  email: string,
  ip: string | null,
  method: LoginMethod,
  extraBody: Record<string, unknown> = {},
): Promise<Response> {
  const wasPreviouslyLocked = previouslyLocked(user)

  const token = createSessionToken()
  const expiresAt = sessionExpiry()
  // Seed the session with the user's workspace (their oldest active membership),
  // or null when they have none yet — the client routes null to onboarding.
  const activeTenantId = await resolveDefaultTenantForUser(db, user.id)
  await createSession(db, {
    idHash: await hashSessionToken(token),
    userId: user.id,
    expiresAt,
    mfaPassedAt: user.mfaEnabled ? null : new Date(),
    activeTenantId,
    ...requestAuditContext(req),
  })

  if (user.mfaEnabled) {
    return setCookieHeader(
      jsonResponse({ ok: true, mfaRequired: true, ...extraBody }),
      sessionCookie(req, token, expiresAt),
    )
  }

  await recordLoginAttempt(db, {
    emailNorm: email || null,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent'),
    userId: user.id,
    result: 'success',
  })
  await markUserLoggedIn(db, user.id)

  if (wasPreviouslyLocked) {
    await createAuditEvent(db, {
      actorUserId: user.id,
      action: 'login.unlocked',
      targetType: 'user',
      targetId: user.id,
      metadata: { email },
      ...requestAuditContext(req),
    })
  }

  await createAuditEvent(db, {
    actorUserId: user.id,
    action: 'login.success',
    targetType: 'user',
    targetId: user.id,
    metadata: { method },
    ...requestAuditContext(req),
  })

  return setCookieHeader(
    jsonResponse({ ok: true, mfaRequired: false, ...extraBody }),
    sessionCookie(req, token, expiresAt),
  )
}
