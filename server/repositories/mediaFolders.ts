/**
 * Media folder repository.
 *
 * Backs the HappyFiles-style folder tree on the Media page. Folders form a
 * tree via `parent_id` (null = root). Slugs are unique within a parent so
 * users can have two "Logos" folders under different roots.
 *
 * Asset membership is many-to-many through `media_asset_folders` — see
 * `repositories/media.ts → assignAssetToFolders` for that join.
 */
import { type DbClient, placeholder } from '../db/client'
import { isoDate } from '@core/utils/isoDate'

/**
 * Optional tenant scope for the folder read/mutate paths (E07 media isolation).
 * The folder handler passes `user.activeTenantId`; the bundle export path omits
 * it and stays unscoped. `nextParam` is the 1-based index of the first free
 * placeholder in the query the caller is building.
 */
function tenantScope(
  db: DbClient,
  tenantId: string | undefined,
  nextParam: number,
): { clause: string; params: unknown[] } {
  if (tenantId === undefined) return { clause: '', params: [] }
  return { clause: ` and tenant_id = ${placeholder(db.dialect, nextParam)}`, params: [tenantId] }
}

const FOLDER_COLUMNS = 'id, parent_id, name, slug, sort_order, created_by_user_id, created_at'

interface MediaFolder {
  id: string
  parentId: string | null
  name: string
  slug: string
  sortOrder: number
  createdByUserId: string | null
  createdAt: string
}

interface CreateMediaFolderInput {
  id: string
  tenantId: string
  parentId: string | null
  name: string
  slug: string
  sortOrder?: number
  createdByUserId: string | null
}

export interface UpdateMediaFolderInput {
  name?: string
  slug?: string
  parentId?: string | null
  sortOrder?: number
}

interface MediaFolderRow {
  id: string
  parent_id: string | null
  name: string
  slug: string
  sort_order: number | string
  created_by_user_id: string | null
  created_at: Date | string
}

function mapFolder(row: MediaFolderRow): MediaFolder {
  return {
    id: row.id,
    parentId: row.parent_id ?? null,
    name: row.name,
    slug: row.slug,
    sortOrder: Number(row.sort_order),
    createdByUserId: row.created_by_user_id ?? null,
    createdAt: isoDate(row.created_at),
  }
}

export async function listMediaFolders(db: DbClient, tenantId?: string): Promise<MediaFolder[]> {
  const where = tenantId === undefined ? '' : ` where tenant_id = ${placeholder(db.dialect, 1)}`
  const { rows } = await db.unsafe<MediaFolderRow>(
    `select ${FOLDER_COLUMNS}
     from media_folders${where}
     order by sort_order asc, lower(name) asc`,
    tenantId === undefined ? [] : [tenantId],
  )
  return rows.map(mapFolder)
}

export async function getMediaFolder(
  db: DbClient,
  id: string,
  tenantId?: string,
): Promise<MediaFolder | null> {
  const scope = tenantScope(db, tenantId, 2)
  const { rows } = await db.unsafe<MediaFolderRow>(
    `select ${FOLDER_COLUMNS}
     from media_folders
     where id = ${placeholder(db.dialect, 1)}${scope.clause}`,
    [id, ...scope.params],
  )
  return rows[0] ? mapFolder(rows[0]) : null
}

export async function createMediaFolder(
  db: DbClient,
  input: CreateMediaFolderInput,
): Promise<MediaFolder> {
  const sortOrder = input.sortOrder ?? 0
  const { rows } = await db<MediaFolderRow>`
    insert into media_folders (id, tenant_id, parent_id, name, slug, sort_order, created_by_user_id)
    values (
      ${input.id},
      ${input.tenantId},
      ${input.parentId},
      ${input.name},
      ${input.slug},
      ${sortOrder},
      ${input.createdByUserId}
    )
    returning id, parent_id, name, slug, sort_order, created_by_user_id, created_at
  `
  return mapFolder(rows[0])
}

export async function updateMediaFolder(
  db: DbClient,
  id: string,
  input: UpdateMediaFolderInput,
): Promise<MediaFolder | null> {
  // COALESCE pattern — `undefined` → NULL → keep-existing — same trick used in
  // the assets repo. One query shape regardless of how many fields changed,
  // dialect-portable.
  const name = input.name ?? null
  const slug = input.slug ?? null
  // Distinguish "don't touch parent_id" from "set parent_id to NULL" by using
  // a sentinel: an explicit `null` parent (move to root) is opt-in by passing
  // `parentId: null`. To handle both cases we route through two query shapes.
  const sortOrder = input.sortOrder ?? null

  if (input.parentId !== undefined) {
    const { rows } = await db<MediaFolderRow>`
      update media_folders set
        name = coalesce(${name}, name),
        slug = coalesce(${slug}, slug),
        parent_id = ${input.parentId},
        sort_order = coalesce(${sortOrder}, sort_order)
      where id = ${id}
      returning id, parent_id, name, slug, sort_order, created_by_user_id, created_at
    `
    if (rows.length === 0) return null
    return mapFolder(rows[0])
  }

  const { rows } = await db<MediaFolderRow>`
    update media_folders set
      name = coalesce(${name}, name),
      slug = coalesce(${slug}, slug),
      sort_order = coalesce(${sortOrder}, sort_order)
    where id = ${id}
    returning id, parent_id, name, slug, sort_order, created_by_user_id, created_at
  `
  if (rows.length === 0) return null
  return mapFolder(rows[0])
}

/**
 * Delete a folder. `ON DELETE CASCADE` removes child folders and asset
 * membership rows automatically — the assets themselves stay (they just
 * become Uncategorized).
 */
export async function deleteMediaFolder(
  db: DbClient,
  id: string,
  tenantId?: string,
): Promise<boolean> {
  const scope = tenantScope(db, tenantId, 2)
  const result = await db.unsafe(
    `delete from media_folders where id = ${placeholder(db.dialect, 1)}${scope.clause}`,
    [id, ...scope.params],
  )
  return result.rowCount > 0
}

// ---------------------------------------------------------------------------
// Bundle export / import
// ---------------------------------------------------------------------------

/** A media folder serialized for bundle transfer (authorship dropped). */
export interface ExportableMediaFolder {
  id: string
  parentId: string | null
  name: string
  slug: string
  sortOrder: number
}

/** The whole folder tree, raw, for a full-site export. */
export async function listExportableMediaFolders(db: DbClient): Promise<ExportableMediaFolder[]> {
  const folders = await listMediaFolders(db)
  return folders.map((f) => ({
    id: f.id,
    parentId: f.parentId,
    name: f.name,
    slug: f.slug,
    sortOrder: f.sortOrder,
  }))
}

/** Wipe all folders (cascades membership) — used by the `replace` import strategy. */
export async function deleteAllMediaFolders(db: DbClient): Promise<void> {
  await db`delete from media_folders`
}

/**
 * Insert a folder preserving its original id, upserting on conflict so a
 * re-import is idempotent. `created_by_user_id` is left null — folder
 * authorship is instance-local and is not carried in the bundle. Used by the
 * bundle import handler.
 */
export async function importMediaFolder(
  db: DbClient,
  input: ExportableMediaFolder,
): Promise<void> {
  await db`
    insert into media_folders (id, parent_id, name, slug, sort_order, created_by_user_id)
    values (
      ${input.id},
      ${input.parentId},
      ${input.name},
      ${input.slug},
      ${input.sortOrder},
      ${null}
    )
    on conflict (id) do update
      set parent_id = excluded.parent_id,
          name = excluded.name,
          slug = excluded.slug,
          sort_order = excluded.sort_order
  `
}

/**
 * Detect whether a (parent, slug) pair is already taken — used by the create
 * / rename handlers to return a friendly error rather than a raw unique
 * constraint violation.
 */
export async function isMediaFolderSlugTaken(
  db: DbClient,
  parentId: string | null,
  slug: string,
  tenantId?: string,
  excludeId?: string,
): Promise<boolean> {
  // Build the predicate positionally so the null-parent branch, the tenant
  // scope, and the self-exclusion all share one query shape across dialects.
  const params: unknown[] = []
  const clauses: string[] = []
  if (parentId === null) {
    clauses.push('parent_id is null')
  } else {
    params.push(parentId)
    clauses.push(`parent_id = ${placeholder(db.dialect, params.length)}`)
  }
  params.push(slug)
  clauses.push(`slug = ${placeholder(db.dialect, params.length)}`)
  if (tenantId !== undefined) {
    params.push(tenantId)
    clauses.push(`tenant_id = ${placeholder(db.dialect, params.length)}`)
  }
  if (excludeId !== undefined) {
    params.push(excludeId)
    clauses.push(`id <> ${placeholder(db.dialect, params.length)}`)
  }
  const { rows } = await db.unsafe<{ id: string }>(
    `select id from media_folders where ${clauses.join(' and ')} limit 1`,
    params,
  )
  return rows.length > 0
}
