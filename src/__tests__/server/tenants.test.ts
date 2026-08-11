/**
 * Multi-tenancy foundation (E06-T02): the `tenants` + `tenant_members` schema,
 * its backfill, and the repository that later epics scope every query through.
 *
 * Two things must hold from day one:
 *   1. An install that has already run setup ends up as exactly one tenant with
 *      the owner as its owner — whether it got there via the migration backfill
 *      (existing installs) or via the setup flow (fresh installs). Both paths
 *      must converge on the same shape, or the "single-tenant is just one row
 *      in the multi-tenant tables" invariant breaks.
 *   2. The repository refuses slugs that would let a customer impersonate a
 *      first-party surface (app, admin, …) — the same names E09-T09 reserves at
 *      the subdomain layer.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { createCapabilityTestHarness } from '../helpers/capabilityHarness'
import {
  BOOTSTRAP_TENANT_ID,
  TenantMutationError,
  addTenantMember,
  createTenant,
  countActiveTenantOwners,
  getTenantById,
  getTenantMembership,
  listTenantsForUser,
  normalizeTenantSlug,
  removeTenantMember,
  setTenantMemberRole,
} from '../../../server/repositories/tenants'
import { createUser } from '../../../server/repositories/users'
import { hashPassword } from '../../../server/auth/tokens'

describe('setup creates the bootstrap tenant', () => {
  it('leaves a fresh install as one tenant with the owner as owner', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      await harness.setupOwner()
      const { db } = harness

      const tenant = await getTenantById(db, BOOTSTRAP_TENANT_ID)
      expect(tenant).not.toBeNull()
      expect(tenant?.slug).toBe('default')
      expect(tenant?.status).toBe('active')

      const owners = await db<{ user_id: string }>`
        select user_id from tenant_members
        where tenant_id = ${BOOTSTRAP_TENANT_ID} and role_id = 'owner' and status = 'active'
      `
      expect(owners.rows).toHaveLength(1)
      expect(await countActiveTenantOwners(db, BOOTSTRAP_TENANT_ID)).toBe(1)
    } finally {
      await harness.cleanup()
    }
  })
})

describe('migration 025 backfill', () => {
  it('folds an existing site + users into the bootstrap tenant', async () => {
    // createTestDb runs migration 025 on an empty DB (backfill selects
    // nothing). Simulate a pre-multi-tenant install by inserting a site + user
    // the way earlier migrations left them, then re-run the backfill (it is
    // idempotent — on conflict do nothing) exactly as the migration does.
    const { db, cleanup } = await createTestDb()
    try {
      await db`insert into site (id, name) values ('default', 'Legacy Site')`
      await createUser(db, {
        id: 'legacy_owner',
        email: 'owner@legacy.example',
        displayName: 'Owner',
        passwordHash: await hashPassword('long-enough-password'),
        roleId: 'owner',
        allowOwnerRole: true,
      })

      await db`
        insert into tenants (id, slug, name)
          select 'default', 'default', name from site limit 1
          on conflict (id) do nothing
      `
      await db`
        insert into tenant_members (tenant_id, user_id, role_id, status)
          select 'default', id, role_id, status from users where deleted_at is null
          on conflict (tenant_id, user_id) do nothing
      `

      const tenant = await getTenantById(db, BOOTSTRAP_TENANT_ID)
      expect(tenant?.name).toBe('Legacy Site')
      const membership = await getTenantMembership(db, BOOTSTRAP_TENANT_ID, 'legacy_owner')
      expect(membership?.roleId).toBe('owner')
      expect(membership?.status).toBe('active')
    } finally {
      await cleanup()
    }
  })
})

describe('tenant repository', () => {
  it('creates a tenant and lists it for a member', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const user = await createUser(db, {
        id: 'u_1',
        email: 'a@example.com',
        displayName: 'A',
        passwordHash: await hashPassword('long-enough-password'),
        roleId: 'admin',
      })
      const tenant = await createTenant(db, { slug: 'acme', name: 'Acme' })
      await addTenantMember(db, { tenantId: tenant.id, userId: user.id, roleId: 'admin' })

      const tenants = await listTenantsForUser(db, user.id)
      expect(tenants).toHaveLength(1)
      expect(tenants[0].slug).toBe('acme')
      expect(tenants[0].roleId).toBe('admin')
    } finally {
      await cleanup()
    }
  })

  it('rejects a duplicate slug with a 409', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      await createTenant(db, { slug: 'acme', name: 'Acme' })
      await expect(createTenant(db, { slug: 'acme', name: 'Acme Two' })).rejects.toMatchObject({
        name: 'TenantMutationError',
        status: 409,
      })
    } finally {
      await cleanup()
    }
  })

  it('membership is idempotent and updates the role on re-add', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const user = await createUser(db, {
        id: 'u_2',
        email: 'b@example.com',
        displayName: 'B',
        passwordHash: await hashPassword('long-enough-password'),
        roleId: 'member',
      })
      const tenant = await createTenant(db, { slug: 'beta', name: 'Beta' })
      await addTenantMember(db, { tenantId: tenant.id, userId: user.id, roleId: 'member' })
      await addTenantMember(db, { tenantId: tenant.id, userId: user.id, roleId: 'admin' })

      const membership = await getTenantMembership(db, tenant.id, user.id)
      expect(membership?.roleId).toBe('admin')
      // Re-adding must not create a second row.
      const rows = await db`select * from tenant_members where tenant_id = ${tenant.id} and user_id = ${user.id}`
      expect(rows.rows).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })

  it('rejects reserved and malformed slugs', () => {
    for (const bad of ['app', 'admin', 'api', 'www', 'billing']) {
      expect(() => normalizeTenantSlug(bad)).toThrow(TenantMutationError)
    }
    for (const bad of ['-acme', 'acme-', 'a', 'has space', 'with_underscore']) {
      expect(() => normalizeTenantSlug(bad)).toThrow(TenantMutationError)
    }
    // Case is normalized, not rejected.
    expect(normalizeTenantSlug('Acme-Co')).toBe('acme-co')
    expect(normalizeTenantSlug('UPPER')).toBe('upper')
  })
})

describe('per-tenant owner rule (E06-T03)', () => {
  async function seed(db: Parameters<typeof createTenant>[0]) {
    const owner = await createUser(db, {
      id: 'owner_x', email: 'owner@x.example', displayName: 'Owner',
      passwordHash: await hashPassword('long-enough-password'), roleId: 'owner', allowOwnerRole: true,
    })
    const tenant = await createTenant(db, { slug: 'acme', name: 'Acme' })
    await addTenantMember(db, { tenantId: tenant.id, userId: owner.id, roleId: 'owner' })
    return { owner, tenant }
  }

  it('lets two tenants each have an owner (no installation-wide cap)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await createUser(db, {
        id: 'oa', email: 'a@x.example', displayName: 'A',
        passwordHash: await hashPassword('long-enough-password'), roleId: 'owner', allowOwnerRole: true,
      })
      const b = await createUser(db, {
        id: 'ob', email: 'b@x.example', displayName: 'B',
        passwordHash: await hashPassword('long-enough-password'), roleId: 'owner', allowOwnerRole: true,
      })
      const t1 = await createTenant(db, { slug: 't-one', name: 'One' })
      const t2 = await createTenant(db, { slug: 't-two', name: 'Two' })
      await addTenantMember(db, { tenantId: t1.id, userId: a.id, roleId: 'owner' })
      await addTenantMember(db, { tenantId: t2.id, userId: b.id, roleId: 'owner' })

      expect(await countActiveTenantOwners(db, t1.id)).toBe(1)
      expect(await countActiveTenantOwners(db, t2.id)).toBe(1)
    } finally {
      await cleanup()
    }
  })

  it('refuses to remove or demote a tenant’s last active owner', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const { owner, tenant } = await seed(db)
      await expect(removeTenantMember(db, tenant.id, owner.id)).rejects.toMatchObject({ status: 409 })
      await expect(setTenantMemberRole(db, tenant.id, owner.id, 'admin')).rejects.toMatchObject({ status: 409 })
      // Still there, still owner.
      expect((await getTenantMembership(db, tenant.id, owner.id))?.roleId).toBe('owner')
    } finally {
      await cleanup()
    }
  })

  it('allows demoting an owner once a second owner exists', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const { owner, tenant } = await seed(db)
      const second = await createUser(db, {
        id: 'owner_y', email: 'y@x.example', displayName: 'Y',
        passwordHash: await hashPassword('long-enough-password'), roleId: 'owner', allowOwnerRole: true,
      })
      await addTenantMember(db, { tenantId: tenant.id, userId: second.id, roleId: 'owner' })

      const demoted = await setTenantMemberRole(db, tenant.id, owner.id, 'admin')
      expect(demoted?.roleId).toBe('admin')
      expect(await countActiveTenantOwners(db, tenant.id)).toBe(1)
    } finally {
      await cleanup()
    }
  })
})
