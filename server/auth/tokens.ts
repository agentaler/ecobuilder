import { createHash, randomBytes } from 'node:crypto'

export const SESSION_COOKIE_NAME = 'ecobuilder_admin_session'

/**
 * The pre-rename cookie name, still READ so sessions survive the deploy that
 * renames it. Never written: `sessionCookie` always emits the new name and
 * `clearSessionCookie` expires both, so a browser converges on the new name at
 * the next login or logout. Delete once no live session predates the rename
 * (sessions expire after 90 days — see SESSION_ABSOLUTE_TIMEOUT_MS).
 */
export const LEGACY_SESSION_COOKIE_NAME = 'instatic_admin_session'
const SESSION_ABSOLUTE_TIMEOUT_MS = 1000 * 60 * 60 * 24 * 90

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash)
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function hashSessionToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionExpiry(now = Date.now()): Date {
  return new Date(now + SESSION_ABSOLUTE_TIMEOUT_MS)
}
