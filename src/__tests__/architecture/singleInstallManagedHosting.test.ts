import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dir, '../../..')
const RUNTIME_SOURCE_ROOTS = ['server', 'src/admin', 'src/core']

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

/**
 * The multi-tenant conversion (E06–E12) replaced the original single-install
 * invariant this file used to enforce. The account boundary is now the
 * `tenants` / `tenant_members` schema, scoped by a `tenant_id` — deliberately
 * introduced by migration 025. What remains worth gating is that the codebase
 * uses ONE canonical tenancy scheme rather than accreting competing ones
 * (`sites`, `site_id`, `workspace_id`, `user_site_`), which would fracture
 * every scoped query. The `site` table itself stays — it is the per-tenant
 * site-identity row, not a second tenancy mechanism.
 */
describe('Tenancy model is canonical', () => {
  it('defines the tenancy foundation in both dialects', () => {
    const pg = read('server/db/migrations-pg.ts')
    const sqlite = read('server/db/migrations-sqlite.ts')

    for (const src of [pg, sqlite]) {
      expect(src).toMatch(/create table if not exists tenants\b/)
      expect(src).toMatch(/create table if not exists tenant_members\b/)
      // The original single-site `site` table is retained (site identity), not
      // renamed into a competing `sites` collection.
      expect(src).toContain('create table if not exists site')
    }
  })

  it('does not introduce a competing account-scope identifier', () => {
    // `tenant_id` is now the one true scope column; these are the alternative
    // schemes it replaces, kept out so scoping stays consistent. Matched
    // case-sensitively: these target snake_case DB identifiers, so the
    // legitimate `SITE_ID` site-identity constant ('default') is not a hit.
    const forbidden = [
      /\bworkspace_id\b/,
      /\buser_site_/,
      /\bsite_id\b/,
      /\bcreate table\s+if not exists\s+sites\b/i,
    ]

    const offenders: string[] = []
    for (const root of RUNTIME_SOURCE_ROOTS) {
      for (const file of new Bun.Glob('**/*.{ts,tsx}').scanSync(join(ROOT, root))) {
        const path = join(root, file)
        const src = read(path)
        for (const pattern of forbidden) {
          if (pattern.test(src)) offenders.push(`${path}: ${pattern}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
