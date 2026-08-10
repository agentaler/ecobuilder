/**
 * CMS site-transfer archive format.
 *
 * User-facing exports are ZIP files:
 *   - .ecobuilder/site-bundle.json  metadata manifest (imports also accept the
 *     pre-rename `.instatic/` path)
 *   - media/<storagePath>         raw media bytes
 *
 * The manifest is the first stored entry so preview can read it with a small
 * `Blob.slice()` and archive import can validate site data before streaming
 * media entries to disk. The embedded-byte `SiteBundle` JSON shape remains the
 * internal direct-import format.
 */

import { Type, type Static } from '@core/utils/typeboxHelpers'
import { DataRowSchema, DataTableSchema } from './schemas'
import { SiteShellSchema } from '@core/page-tree'
import {
  BundleMediaFolderSchema,
  BundleRedirectSchema,
  MediaAssetMetadataSchema,
} from './bundleSchema'

export const BUNDLE_ARCHIVE_MANIFEST_PATH = '.ecobuilder/site-bundle.json'
/**
 * Manifest path written by exports before the E02 rename. Archives are files
 * users keep on disk indefinitely, so import accepts both paths forever-ish;
 * export writes only the new one.
 */
export const LEGACY_BUNDLE_ARCHIVE_MANIFEST_PATH = '.instatic/site-bundle.json'

export function isBundleArchiveManifestPath(path: string): boolean {
  return path === BUNDLE_ARCHIVE_MANIFEST_PATH || path === LEGACY_BUNDLE_ARCHIVE_MANIFEST_PATH
}
export const BUNDLE_ARCHIVE_MEDIA_PREFIX = 'media/'

export function mediaArchivePath(storagePath: string): string {
  return `${BUNDLE_ARCHIVE_MEDIA_PREFIX}${storagePath}`
}

export const SiteBundleArchiveManifestSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  exportedAt: Type.String(),
  sourceSiteName: Type.Optional(Type.String()),
  site: Type.Optional(SiteShellSchema),
  tables: Type.Array(DataTableSchema),
  rows: Type.Array(DataRowSchema),
  media: Type.Optional(Type.Array(MediaAssetMetadataSchema)),
  mediaFolders: Type.Optional(Type.Array(BundleMediaFolderSchema)),
  redirects: Type.Optional(Type.Array(BundleRedirectSchema)),
})

export type SiteBundleArchiveManifest = Static<typeof SiteBundleArchiveManifestSchema>
