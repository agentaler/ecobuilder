/**
 * Emailed sign-in codes (E06-T05).
 *
 *   POST /admin/api/cms/auth/email-code/request  — mail a 6-digit code
 *   POST /admin/api/cms/auth/email-code/verify   — redeem it for a session
 *   POST /admin/api/cms/auth/step-up/email-code  — mail a step-up code
 *
 * A code both signs in and signs up: an address with no account gets one
 * created on redemption, which then lands in workspace onboarding because the
 * fresh session carries no active tenant. That is also why the request endpoint
 * can answer identically for known and unknown addresses — with no account to
 * "not find", there is nothing for the response to leak.
 *
 * Redemption ends in `issueLoginSession`, the one path every login method
 * terminates in, so MFA policy and the audit trail cannot drift per method.
 */
import { nanoid } from 'nanoid'
import type { DbClient } from '../../db/client'
import { Type } from '@core/utils/typeboxHelpers'
import {
  burnLiveEmailLoginCodes,
  consumeEmailLoginCode,
  issueEmailLoginCode,
} from '../../repositories/emailLoginCodes'
import { createUser, findUserByEmail, markEmailVerified, normalizeEmail } from '../../repositories/users'
import { recordLoginAttempt } from '../../repositories/loginAttempts'
import { createAuditEvent } from '../../repositories/audit'
import { evaluateLockState } from '../../auth/lockout'
import {
  emailCodeRequestPerIpRateLimit,
  emailCodeRequestRateLimit,
  emailCodeVerifyRateLimit,
} from '../../auth/rateLimit'
import { clientIp } from '../../auth/security'
import { requireAuthenticatedUser } from '../../auth/authz'
import { sendEmail } from '../../email'
import { jsonResponse, readValidatedBody } from '../../http'
import { CMS_API_PREFIX, requestAuditContext } from './shared'
import { issueLoginSession } from './loginSession'

/** Long enough to switch to a mail app and back, short enough to bound guessing. */
const CODE_TTL_MS = 10 * 60 * 1000

const EmailCodeRequestBodySchema = Type.Object({ email: Type.String() })
const EmailCodeVerifyBodySchema = Type.Object({
  requestId: Type.String(),
  code: Type.String(),
})

function rateLimited(message: string, retryAfterMs: number): Response {
  return jsonResponse(
    { error: message },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
  )
}

/**
 * The code email. Says where the code must be typed, because redemption is
 * scoped to the request that issued it — the code is useless in a tab that
 * didn't ask for it, and a user who doesn't know that reads it as a bug.
 */
async function mailCode(email: string, code: string, purpose: 'login' | 'step_up'): Promise<boolean> {
  const heading = purpose === 'login'
    ? 'Your Ecobuilder sign-in code'
    : 'Your Ecobuilder confirmation code'
  return sendEmail({
    to: email,
    subject: heading,
    text: [
      `${heading}: ${code}`,
      '',
      'Enter it in the window where you asked for it. It expires in 10 minutes.',
      "If you didn't request it, you can ignore this email.",
    ].join('\n'),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/email-code/request
// ─────────────────────────────────────────────────────────────────────────────

async function handleEmailCodeRequest(req: Request, db: DbClient): Promise<Response> {
  const body = await readValidatedBody(req, EmailCodeRequestBodySchema)
  const email = normalizeEmail((body?.email ?? '').trim())
  if (!email.includes('@')) return jsonResponse({ error: 'Enter a valid email address' }, { status: 400 })

  const ip = clientIp(req)
  if (ip) {
    const perIp = emailCodeRequestPerIpRateLimit.consume(ip)
    if (!perIp.ok) {
      return rateLimited('Too many code requests from this address. Try again later.', perIp.retryAfterMs)
    }
  }
  const perEmail = emailCodeRequestRateLimit.consume(`${ip ?? 'unknown'}|${email}`)
  if (!perEmail.ok) {
    return rateLimited('Too many code requests. Try again later.', perEmail.retryAfterMs)
  }

  // A missing account is not an error here — redemption creates one. Binding the
  // user id when it IS known lets redemption skip a lookup and lets the step-up
  // owner check work.
  const existing = await findUserByEmail(db, email)
  const issued = await issueEmailLoginCode(db, {
    emailNormalized: email,
    userId: existing?.id ?? null,
    purpose: 'login',
    ttlMs: CODE_TTL_MS,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent'),
  })

  // A code that never arrives is not a recoverable state — it is the only way
  // in. Burn it and say so rather than reporting a cheerful success against an
  // inbox that stays empty.
  if (!await mailCode(email, issued.code, 'login')) {
    await burnLiveEmailLoginCodes(db, email)
    return jsonResponse({ error: 'Could not send the code. Try again.' }, { status: 503 })
  }

  return jsonResponse({
    ok: true,
    requestId: issued.requestId,
    expiresInSeconds: Math.round(CODE_TTL_MS / 1000),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/email-code/verify
// ─────────────────────────────────────────────────────────────────────────────

async function handleEmailCodeVerify(req: Request, db: DbClient): Promise<Response> {
  const body = await readValidatedBody(req, EmailCodeVerifyBodySchema)
  if (!body) return jsonResponse({ error: 'That code is invalid or has expired.' }, { status: 401 })

  const ip = clientIp(req)
  const verifyDecision = emailCodeVerifyRateLimit.consume(ip ?? 'unknown')
  if (!verifyDecision.ok) {
    return rateLimited('Too many attempts. Try again later.', verifyDecision.retryAfterMs)
  }

  const redeemed = await consumeEmailLoginCode(db, body.requestId.trim(), body.code.trim(), 'login')
  if (!redeemed) {
    // Nothing identifying is known on this path — a failed redemption returns no
    // row, so there is no address to attribute the attempt to. Guessing is
    // bounded without it: the row's own `attempts` cap ends a run against one
    // code, and the per-IP limiter above bounds shots across many.
    await recordLoginAttempt(db, {
      emailNorm: null,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent'),
      userId: null,
      result: 'bad_code',
    })
    return jsonResponse({ error: 'That code is invalid or has expired.' }, { status: 401 })
  }

  const email = redeemed.emailNormalized
  // Re-resolve rather than trusting the id captured at request time: the account
  // may have been created in between (another tab, or a social sign-up).
  let user = await findUserByEmail(db, email)
  let createdAccount = false

  if (!user) {
    await createUser(db, {
      id: nanoid(),
      email,
      displayName: '',
      // Passwordless: control of the mailbox is the credential. A password can
      // be added later from account settings.
      passwordHash: null,
      roleId: 'member',
      // They just proved they can read mail at this address.
      emailVerified: true,
    })
    user = await findUserByEmail(db, email)
    if (!user) return jsonResponse({ error: 'Could not create the account.' }, { status: 500 })
    createdAccount = true
    await createAuditEvent(db, {
      actorUserId: user.id,
      action: 'user.signup',
      targetType: 'user',
      targetId: user.id,
      metadata: { email, method: 'email_code' },
      ...requestAuditContext(req),
    })
  }

  if (user.status !== 'active') {
    await recordLoginAttempt(db, {
      emailNorm: email,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent'),
      userId: user.id,
      result: 'account_disabled',
    })
    return jsonResponse({ error: 'That code is invalid or has expired.' }, { status: 401 })
  }

  // Redeeming a code IS proof of mailbox control — the very thing the signup
  // verification link proves — so an existing still-unverified account becomes
  // verified here. This also unblocks social-login auto-linking, which only
  // links onto verified accounts.
  if (!createdAccount && user.emailVerifiedAt === null) {
    await markEmailVerified(db, user.id)
  }

  const lock = evaluateLockState(user.lockedUntil)
  if (lock.locked) {
    return jsonResponse(
      { error: 'Account locked. Try again later.' },
      { status: 423, headers: { 'Retry-After': String(Math.ceil(lock.retryAfterMs / 1000)) } },
    )
  }

  // A code still sitting in the inbox must not remain usable after one worked.
  await burnLiveEmailLoginCodes(db, email)
  emailCodeVerifyRateLimit.reset(ip ?? 'unknown')
  emailCodeRequestRateLimit.reset(`${ip ?? 'unknown'}|${email}`)

  return issueLoginSession(db, req, user, email, ip, 'email_code', { createdAccount })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/step-up/email-code
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mail a step-up code to the signed-in user. Only for accounts with no password
 * — one that has a password must re-enter it, or mailbox access would become a
 * universal password bypass (the same rule `handleStepUp` enforces).
 */
async function handleStepUpEmailCodeRequest(req: Request, db: DbClient): Promise<Response> {
  const user = await requireAuthenticatedUser(req, db)
  if (user instanceof Response) return user
  if (user.passwordHash !== null) {
    return jsonResponse({ error: 'Confirm with your password.' }, { status: 400 })
  }

  const ip = clientIp(req)
  const email = user.email.toLowerCase()
  const decision = emailCodeRequestRateLimit.consume(`${ip ?? 'unknown'}|${email}|step_up`)
  if (!decision.ok) {
    return rateLimited('Too many code requests. Try again later.', decision.retryAfterMs)
  }

  const issued = await issueEmailLoginCode(db, {
    emailNormalized: email,
    userId: user.id,
    purpose: 'step_up',
    ttlMs: CODE_TTL_MS,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent'),
  })

  if (!await mailCode(email, issued.code, 'step_up')) {
    return jsonResponse({ error: 'Could not send the code. Try again.' }, { status: 503 })
  }

  return jsonResponse({
    ok: true,
    requestId: issued.requestId,
    expiresInSeconds: Math.round(CODE_TTL_MS / 1000),
  })
}

export const EMAIL_CODE_ROUTES = [
  { method: 'POST' as const, pattern: `${CMS_API_PREFIX}/auth/email-code/request`, handler: handleEmailCodeRequest },
  { method: 'POST' as const, pattern: `${CMS_API_PREFIX}/auth/email-code/verify`, handler: handleEmailCodeVerify },
  { method: 'POST' as const, pattern: `${CMS_API_PREFIX}/auth/step-up/email-code`, handler: handleStepUpEmailCodeRequest },
]
