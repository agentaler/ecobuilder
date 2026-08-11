/**
 * Media tenant-isolation matrix (E07) — the media library is per-workspace.
 *
 * Two owners, each with an image uploaded into their own workspace. Workspace
 * A must never see, mutate, replace, delete, or trash B's asset: a cross-tenant
 * id is a 404, never the asset and never a 403 that would confirm it exists.
 * The workspace is resolved server-side from the session's active tenant, so
 * there is no client-supplied id to forge — the test uses a real asset id that
 * belongs to the other tenant.
 */
import { describe, expect, it } from 'bun:test'
import { createTestDb } from '../helpers/createTestDb'
import { handleCmsRequest } from '../../../server/handlers/cms'
import { createUser } from '../../../server/repositories/users'
import { addTenantMember, createTenant } from '../../../server/repositories/tenants'
import { createMediaAsset, getMediaAsset } from '../../../server/repositories/media'
import { createSession } from '../../../server/auth/sessions'
import { createSessionToken, hashSessionToken, sessionExpiry, hashPassword } from '../../../server/auth/tokens'

const ORIGIN = 'http://localhost'

interface Actor {
  userId: string
  tenantId: string
  cookie: string
  assetId: string
}

async function makeTenantWithAsset(
  db: Parameters<typeof createUser>[0],
  key: string,
): Promise<Actor> {
  const user = await createUser(db, {
    id: `u_${key}`,
    email: `${key}@example.com`,
    displayName: key,
    passwordHash: await hashPassword('long-enough-password'),
    roleId: 'admin',
  })
  const tenant = await createTenant(db, { slug: `ws-${key}`, name: `${key} workspace` })
  await addTenantMember(db, { tenantId: tenant.id, userId: user.id, roleId: 'admin' })

  const asset = await createMediaAsset(db, {
    id: `asset_${key}`,
    tenantId: tenant.id,
    filename: `${key}.png`,
    mimeType: 'image/png',
    sizeBytes: 10,
    storagePath: `asset_${key}.png`,
    publicPath: `/uploads/asset_${key}.png`,
    uploadedByUserId: user.id,
    storageAdapterId: '',
    externallyHosted: false,
  })

  const token = createSessionToken()
  await createSession(db, {
    idHash: await hashSessionToken(token),
    userId: user.id,
    expiresAt: sessionExpiry(),
    ipAddress: null,
    userAgent: null,
    mfaPassedAt: new Date(),
    activeTenantId: tenant.id,
  })
  return { userId: user.id, tenantId: tenant.id, cookie: `ecobuilder_admin_session=${token}`, assetId: asset.id }
}

function req(method: string, path: string, cookie: string, body?: unknown): Request {
  const headers = new Headers({ origin: ORIGIN })
  if (body !== undefined) headers.set('content-type', 'application/json')
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  request.headers.set('cookie', cookie)
  return request
}

const MEDIA = '/admin/api/cms/media'

describe('media tenant isolation matrix', () => {
  it('a list endpoint shows only the caller\'s workspace assets', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await makeTenantWithAsset(db, 'alice')
      const b = await makeTenantWithAsset(db, 'bob')

      const res = await handleCmsRequest(req('GET', MEDIA, a.cookie), db)
      expect(res.status).toBe(200)
      const ids = (await res.json()).assets.map((x: { id: string }) => x.id)
      expect(ids).toContain(a.assetId)
      expect(ids).not.toContain(b.assetId)
    } finally {
      await cleanup()
    }
  })

  it('A cannot rename, trash, or delete B\'s asset (404, not 403)', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await makeTenantWithAsset(db, 'alice')
      const b = await makeTenantWithAsset(db, 'bob')

      const patch = await handleCmsRequest(
        req('PATCH', `${MEDIA}/${b.assetId}`, a.cookie, { title: 'hijacked' }),
        db,
      )
      expect(patch.status).toBe(404)

      const trash = await handleCmsRequest(req('DELETE', `${MEDIA}/${b.assetId}`, a.cookie), db)
      expect(trash.status).toBe(404)

      // B's asset is untouched: still present, un-trashed, original title.
      const stillThere = await getMediaAsset(db, b.assetId, b.tenantId)
      expect(stillThere?.deletedAt).toBeNull()
      expect(stillThere?.title).toBe('')
    } finally {
      await cleanup()
    }
  })

  it('A can rename its own asset', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await makeTenantWithAsset(db, 'alice')

      const patch = await handleCmsRequest(
        req('PATCH', `${MEDIA}/${a.assetId}`, a.cookie, { title: 'My Hero' }),
        db,
      )
      expect(patch.status).toBe(200)
      expect((await patch.json()).asset.title).toBe('My Hero')
    } finally {
      await cleanup()
    }
  })

  it('folders are scoped per workspace', async () => {
    const { db, cleanup } = await createTestDb()
    try {
      const a = await makeTenantWithAsset(db, 'alice')
      const b = await makeTenantWithAsset(db, 'bob')

      const created = await handleCmsRequest(
        req('POST', `${MEDIA}/folders`, a.cookie, { name: 'Brand' }),
        db,
      )
      expect(created.status).toBe(201)
      const folderId = (await created.json()).folder.id

      // B's folder list never shows A's folder.
      const bList = await handleCmsRequest(req('GET', `${MEDIA}/folders`, b.cookie), db)
      const bIds = (await bList.json()).folders.map((f: { id: string }) => f.id)
      expect(bIds).not.toContain(folderId)

      // B cannot delete A's folder — cross-tenant id is a 404.
      const del = await handleCmsRequest(req('DELETE', `${MEDIA}/folders/${folderId}`, b.cookie), db)
      expect(del.status).toBe(404)

      // Both workspaces can hold a folder with the same slug (tenant-scoped unique).
      const bCreated = await handleCmsRequest(
        req('POST', `${MEDIA}/folders`, b.cookie, { name: 'Brand' }),
        db,
      )
      expect(bCreated.status).toBe(201)
    } finally {
      await cleanup()
    }
  })
})
