/**
 * Self-service SaaS auth (E06-T04): signup, email verification, password reset.
 *
 * Distinct from `setup.ts` (the one-shot self-hosted bootstrap) and `auth.ts`
 * (login/session lifecycle). Signup creates a user + their own workspace
 * (tenant) + owner membership in one transaction, auto-signs them in with that
 * workspace active, and emails a verification link. Verification and reset
 * redeem single-use tokens from `auth_tokens`.
 *
 * Every response that could reveal whether an email exists is deliberately
 * uniform (forgot-password always 200) so the endpoints aren't account oracles.
 */
import { nanoid } from 'nanoid'
import type { DbClient } from '../../db/client'
import { hashPassword, createSessionToken, hashSessionToken, sessionExpiry } from '../../auth/tokens'
import { createSession } from '../../auth/sessions'
import { createUser, markEmailVerified, resetUserPassword, findUserByEmail } from '../../repositories/users'
import {
  addTenantMember,
  createTenant,
  getTenantBySlug,
  normalizeTenantSlug,
} from '../../repositories/tenants'
import { seedTenantContent } from '../../repositories/tenantSeed'
import { issueAuthToken, consumeAuthToken } from '../../repositories/authTokens'
import { sendEmail, publicAppOrigin } from '../../email'
import {
  badRequest,
  jsonResponse,
  methodNotAllowed,
  readValidatedBody,
  setCookieHeader,
} from '../../http'
import { Type } from '@core/utils/typeboxHelpers'
import { sessionCookie } from './session'
import { CMS_API_PREFIX, requestAuditContext } from './shared'
import { createAuditEvent } from '../../repositories/audit'
import { serializeCollabAwareWrite } from '../../repositories/rowWriteEvents'

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24 // 24h
const RESET_TTL_MS = 1000 * 60 * 60 // 1h

const SignupBodySchema = Type.Object({
  email: Type.String(),
  password: Type.String(),
  displayName: Type.Optional(Type.String()),
  workspaceName: Type.Optional(Type.String()),
})

/** Derive a URL-safe, unique tenant slug from a base string. */
async function uniqueTenantSlug(db: DbClient, base: string): Promise<string> {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  let candidate = cleaned.length >= 2 ? cleaned : `workspace-${nanoid(6).toLowerCase()}`
  // Validate/normalize; on a reserved or malformed base fall back to a random one.
  try {
    candidate = normalizeTenantSlug(candidate)
  } catch {
    candidate = `workspace-${nanoid(6).toLowerCase()}`
  }
  if (!(await getTenantBySlug(db, candidate))) return candidate
  for (let i = 0; i < 5; i++) {
    const next = `${candidate.slice(0, 32)}-${nanoid(4).toLowerCase()}`
    if (!(await getTenantBySlug(db, next))) return next
  }
  return `workspace-${nanoid(8).toLowerCase()}`
}

async function sendVerificationEmail(db: DbClient, userId: string, email: string): Promise<void> {
  const token = await issueAuthToken(db, userId, 'email_verify', VERIFY_TTL_MS)
  const link = `${publicAppOrigin()}/verify-email?token=${encodeURIComponent(token)}`
  await sendEmail({
    to: email,
    subject: 'Confirm your Ecobuilder email',
    text: `Welcome to Ecobuilder. Confirm your email to finish setting up your workspace:\n\n${link}\n\nThis link expires in 24 hours.`,
  })
}

async function handleSignup(req: Request, db: DbClient): Promise<Response> {
  const body = await readValidatedBody(req, SignupBodySchema)
  if (!body) return badRequest('Invalid request body')
  const email = body.email.trim().toLowerCase()
  const password = body.password.trim()
  const displayName = body.displayName?.trim() ?? ''
  if (!email.includes('@')) return badRequest('Invalid email')
  if (password.length < 12) return badRequest('Password must be at least 12 characters')

  if (await findUserByEmail(db, email)) {
    // Uniform-ish: a real duplicate is a legitimate 409 the signup form shows.
    return jsonResponse({ error: 'An account with this email already exists.' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const workspaceName = body.workspaceName?.trim() || `${displayName || email.split('@')[0]}'s Workspace`

  const result = await serializeCollabAwareWrite(async () =>
    db.transaction(async (tx) => {
      // Global account role is 'member'; workspace ownership is the tenant
      // membership, not the installation-wide role.
      const user = await createUser(tx, {
        id: nanoid(),
        email,
        displayName,
        passwordHash,
        roleId: 'member',
        emailVerified: false,
      })
      const slug = await uniqueTenantSlug(tx, workspaceName)
      const tenant = await createTenant(tx, { slug, name: workspaceName })
      await addTenantMember(tx, { tenantId: tenant.id, userId: user.id, roleId: 'owner' })
      await seedTenantContent(tx, tenant.id)
      await createAuditEvent(tx, {
        actorUserId: null,
        action: 'user.signup',
        targetType: 'user',
        targetId: user.id,
        metadata: { tenantId: tenant.id },
        ...requestAuditContext(req),
      })
      return { user, tenant }
    }),
  )

  // Verification email is best-effort and must not block signup completion.
  await sendVerificationEmail(db, result.user.id, email)

  // Auto-sign-in with the new workspace active.
  const token = createSessionToken()
  const expiresAt = sessionExpiry()
  await createSession(db, {
    idHash: await hashSessionToken(token),
    userId: result.user.id,
    expiresAt,
    mfaPassedAt: new Date(),
    activeTenantId: result.tenant.id,
    ...requestAuditContext(req),
  })
  return setCookieHeader(
    jsonResponse({ ok: true, emailVerificationRequired: true }, { status: 201 }),
    sessionCookie(req, token, expiresAt),
  )
}

const VerifyEmailBodySchema = Type.Object({ token: Type.String() })

async function handleVerifyEmail(req: Request, db: DbClient): Promise<Response> {
  const body = await readValidatedBody(req, VerifyEmailBodySchema)
  if (!body) return badRequest('Invalid request body')
  const userId = await consumeAuthToken(db, body.token.trim(), 'email_verify')
  if (!userId) return jsonResponse({ error: 'This verification link is invalid or has expired.' }, { status: 400 })
  await markEmailVerified(db, userId)
  return jsonResponse({ ok: true })
}

const ForgotPasswordBodySchema = Type.Object({ email: Type.String() })

async function handleForgotPassword(req: Request, db: DbClient): Promise<Response> {
  const body = await readValidatedBody(req, ForgotPasswordBodySchema)
  if (!body) return badRequest('Invalid request body')
  const email = body.email.trim().toLowerCase()
  const user = await findUserByEmail(db, email)
  if (user) {
    const token = await issueAuthToken(db, user.id, 'password_reset', RESET_TTL_MS)
    const link = `${publicAppOrigin()}/reset-password?token=${encodeURIComponent(token)}`
    await sendEmail({
      to: email,
      subject: 'Reset your Ecobuilder password',
      text: `A password reset was requested for your account. Use this link to choose a new password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`,
    })
  }
  // Always 200 — never reveal whether the email is registered.
  return jsonResponse({ ok: true })
}

const ResetPasswordBodySchema = Type.Object({ token: Type.String(), password: Type.String() })

async function handleResetPassword(req: Request, db: DbClient): Promise<Response> {
  const body = await readValidatedBody(req, ResetPasswordBodySchema)
  if (!body) return badRequest('Invalid request body')
  const password = body.password.trim()
  if (password.length < 12) return badRequest('Password must be at least 12 characters')
  const userId = await consumeAuthToken(db, body.token.trim(), 'password_reset')
  if (!userId) return jsonResponse({ error: 'This reset link is invalid or has expired.' }, { status: 400 })
  await resetUserPassword(db, userId, await hashPassword(password))
  return jsonResponse({ ok: true })
}

/**
 * Dispatch the self-service auth endpoints. Returns null when the path isn't
 * one of ours, so `handleCmsRequest` can fall through to the next handler.
 */
export async function handleSignupRoutes(req: Request, db: DbClient): Promise<Response | null> {
  const url = new URL(req.url)
  const routes: Record<string, (req: Request, db: DbClient) => Promise<Response>> = {
    [`${CMS_API_PREFIX}/signup`]: handleSignup,
    [`${CMS_API_PREFIX}/verify-email`]: handleVerifyEmail,
    [`${CMS_API_PREFIX}/password/forgot`]: handleForgotPassword,
    [`${CMS_API_PREFIX}/password/reset`]: handleResetPassword,
  }
  const handler = routes[url.pathname]
  if (!handler) return null
  if (req.method !== 'POST') return methodNotAllowed()
  return handler(req, db)
}
