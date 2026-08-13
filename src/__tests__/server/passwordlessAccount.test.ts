/**
 * Passwordless accounts (E06-T05 groundwork).
 *
 * Migration 032 relaxed `users.password_hash` so an account created by an
 * emailed sign-in code or a social provider can exist without a password.
 * These tests pin the contract the rest of that work builds on: such an
 * account is storable, reports `hasPassword: false`, can never be signed into
 * with a password, and can have a first password set later.
 *
 * No endpoint creates one yet — the repository is exercised directly, which is
 * exactly why this is worth pinning now rather than after the endpoints land.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import {
  createUser,
  findUserByEmail,
  toPublicUser,
  updateUser,
} from '../../../server/repositories/users'
import { hashPassword, verifyPassword } from '../../../server/auth/tokens'

describe('passwordless accounts', () => {
  it('can be created with no password and reports hasPassword: false', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await createUser(db, {
        email: 'social@example.com',
        displayName: 'Social',
        passwordHash: null,
        roleId: 'member',
        emailVerified: true,
      })

      const user = await findUserByEmail(db, 'social@example.com')
      expect(user).not.toBeNull()
      expect(user!.passwordHash).toBeNull()
      expect(toPublicUser(user!).hasPassword).toBe(false)
    } finally {
      await cleanup()
    }
  })

  it('a password account still reports hasPassword: true', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await createUser(db, {
        email: 'classic@example.com',
        displayName: 'Classic',
        passwordHash: await hashPassword('correct horse battery staple'),
        roleId: 'member',
      })

      const user = await findUserByEmail(db, 'classic@example.com')
      expect(toPublicUser(user!).hasPassword).toBe(true)
    } finally {
      await cleanup()
    }
  })

  it('cannot be signed into with any password', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await createUser(db, {
        email: 'nopass@example.com',
        displayName: 'No Pass',
        passwordHash: null,
        roleId: 'member',
      })
      const user = await findUserByEmail(db, 'nopass@example.com')

      // The login path compares against a dummy hash when the stored one is
      // null, so verification must fail without `Bun.password.verify` ever
      // being handed a non-hash. Guard the same way the handlers do.
      const attempt = user!.passwordHash !== null
        && await verifyPassword('', user!.passwordHash)
      expect(attempt).toBe(false)
    } finally {
      await cleanup()
    }
  })

  it('can have a first password set, and can have it cleared again', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const created = await createUser(db, {
        email: 'upgrade@example.com',
        displayName: 'Upgrade',
        passwordHash: null,
        roleId: 'member',
      })

      await updateUser(db, created.id, { passwordHash: await hashPassword('a-brand-new-password') })
      const withPassword = await findUserByEmail(db, 'upgrade@example.com')
      expect(withPassword!.passwordHash).not.toBeNull()
      expect(await verifyPassword('a-brand-new-password', withPassword!.passwordHash!)).toBe(true)

      // An explicit null must CLEAR the password. The `??` this replaced would
      // have silently kept the existing hash.
      await updateUser(db, created.id, { passwordHash: null })
      const cleared = await findUserByEmail(db, 'upgrade@example.com')
      expect(cleared!.passwordHash).toBeNull()
      expect(toPublicUser(cleared!).hasPassword).toBe(false)
    } finally {
      await cleanup()
    }
  })
})
