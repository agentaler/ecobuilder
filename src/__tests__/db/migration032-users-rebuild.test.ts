/**
 * Migration 032 rebuilds the `users` table (SQLite cannot relax a column's
 * NOT NULL in place). `users` is the parent of ~8 `on delete cascade`
 * children, so a rebuild that runs with FK enforcement ON would have its
 * `drop table users` fire an implicit DELETE and silently wipe every session
 * and workspace membership in the database.
 *
 * `createTestDb` runs every migration against an EMPTY database, so it can
 * never catch that: there is no data to lose. This suite instead migrates to
 * the state just before 032, writes a realistic row set across the cascade
 * children, then runs the rest — which is the only arrangement that can
 * observe the data loss.
 */
import { describe, test, expect } from 'bun:test'
import * as os from 'node:os'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createDbClient } from '../../../server/db'
import { runMigrations } from '../../../server/db/runMigrations'

const REBUILD_MIGRATION_ID = '032_nullable_password_hash'

async function createDbMigratedTo(stopBeforeId: string) {
  const tmpFile = path.join(os.tmpdir(), `cms-migr-${crypto.randomUUID()}`, 'test.db')
  const { db, migrations } = createDbClient(`sqlite:${tmpFile}`)
  const stopIndex = migrations.findIndex((m) => m.id === stopBeforeId)
  if (stopIndex < 0) throw new Error(`migration ${stopBeforeId} not found`)

  await runMigrations(db, migrations.slice(0, stopIndex))
  return {
    db,
    migrations,
    cleanup: () => fs.rm(path.dirname(tmpFile), { recursive: true, force: true }),
  }
}

describe('migration 032 — users table rebuild', () => {
  test('preserves users and every cascade-child row', async () => {
    const { db, migrations, cleanup } = await createDbMigratedTo(REBUILD_MIGRATION_ID)
    try {
      // A user plus one row in each of the cascade children a botched rebuild
      // would erase.
      await db`
        insert into users (id, email, email_normalized, display_name, password_hash, role_id)
        values ('u_1', 'owner@example.com', 'owner@example.com', 'Owner', 'argon2-hash', 'owner')`
      await db`
        insert into sessions (id_hash, user_id, expires_at)
        values ('sess_hash_1', 'u_1', '2099-01-01T00:00:00.000Z')`
      await db`insert into tenants (id, slug, name) values ('t_1', 'studio', 'Studio')`
      await db`
        insert into tenant_members (tenant_id, user_id, role_id)
        values ('t_1', 'u_1', 'owner')`
      await db`
        insert into auth_tokens (id, user_id, kind, token_hash, expires_at)
        values ('tok_1', 'u_1', 'email_verify', 'hash_1', '2099-01-01T00:00:00.000Z')`

      await runMigrations(db, migrations)

      // The rebuild itself.
      const { rows: users } = await db<{ id: string; password_hash: string | null }>`
        select id, password_hash from users`
      expect(users).toHaveLength(1)
      expect(users[0]!.id).toBe('u_1')
      expect(users[0]!.password_hash).toBe('argon2-hash')

      // The cascade children — the rows an unguarded `drop table users` eats.
      const { rows: sessions } = await db<{ id_hash: string }>`select id_hash from sessions`
      expect(sessions).toHaveLength(1)
      const { rows: members } = await db<{ user_id: string }>`select user_id from tenant_members`
      expect(members).toHaveLength(1)
      const { rows: tokens } = await db<{ id: string }>`select id from auth_tokens`
      expect(tokens).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })

  test('leaves no foreign-key violations behind', async () => {
    const { db, migrations, cleanup } = await createDbMigratedTo(REBUILD_MIGRATION_ID)
    try {
      await db`
        insert into users (id, email, email_normalized, display_name, password_hash, role_id)
        values ('u_1', 'a@example.com', 'a@example.com', 'A', 'hash', 'owner')`
      await db`
        insert into sessions (id_hash, user_id, expires_at)
        values ('sess_1', 'u_1', '2099-01-01T00:00:00.000Z')`

      // The runner asserts this internally before re-enabling enforcement, so a
      // dangling reference would already have thrown. Re-check explicitly: this
      // is the invariant the whole `disableForeignKeys` dance exists to protect.
      await runMigrations(db, migrations)

      const { rows: violations } = await db`pragma foreign_key_check`
      expect(violations).toHaveLength(0)
    } finally {
      await cleanup()
    }
  })

  test('accepts a NULL password_hash afterwards, and still rejects duplicate active emails', async () => {
    const { db, migrations, cleanup } = await createDbMigratedTo(REBUILD_MIGRATION_ID)
    try {
      await runMigrations(db, migrations)

      // The point of the migration: passwordless accounts become storable.
      await db`
        insert into users (id, email, email_normalized, display_name, password_hash, role_id)
        values ('u_social', 'social@example.com', 'social@example.com', 'Social', null, 'member')`
      const { rows } = await db<{ password_hash: string | null }>`
        select password_hash from users where id = 'u_social'`
      expect(rows[0]!.password_hash).toBeNull()

      // The partial unique index must survive the rebuild — without it two
      // active accounts could share an email.
      let duplicateRejected = false
      try {
        await db`
          insert into users (id, email, email_normalized, display_name, password_hash, role_id)
          values ('u_dup', 'social@example.com', 'social@example.com', 'Dup', null, 'member')`
      } catch {
        duplicateRejected = true
      }
      expect(duplicateRejected).toBe(true)
    } finally {
      await cleanup()
    }
  })
})
