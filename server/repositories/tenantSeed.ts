/**
 * Starter content every workspace (tenant) gets when it is created — the
 * homepage and a post entry-template — scoped to that tenant.
 *
 * Shared by `setup.ts` (the bootstrap tenant `'default'`) and signup (each new
 * tenant), so a freshly signed-up workspace is immediately publishable and its
 * posts are reachable, exactly like a fresh self-hosted install. The system
 * content-types (`pages`/`posts`/…) are shared product definitions; only the
 * content rows are per-tenant, so seeding writes rows carrying `tenantId` into
 * the shared `pages` table (see DECISIONS.md D5).
 */
import { nanoid } from 'nanoid'
import type { DbClient } from '../db/client'
import { createNode, type Page } from '@core/page-tree'
import { pageToCells } from '../../src/core/data/pageFromRow'
import { createDataRow } from './data'

export async function seedTenantContent(
  db: DbClient,
  tenantId: string,
  actorUserId: string | null = null,
): Promise<void> {
  // Starter homepage.
  const homeRoot = createNode('base.body')
  const homePage: Page = {
    id: nanoid(),
    title: 'Home',
    slug: 'index',
    nodes: { [homeRoot.id]: homeRoot },
    rootNodeId: homeRoot.id,
  }
  await createDataRow(
    db,
    { id: homePage.id, tableId: 'pages', tenantId, cells: pageToCells(homePage), slug: homePage.slug },
    actorUserId,
    null,
    { collabInternal: true },
  )

  // Post entry-template — without one, a published post resolves to a row with
  // no template chain and 404s while reporting success (see setupSeedsPostTemplate).
  const templateRoot = createNode('base.body')
  const templateOutlet = createNode('base.outlet')
  templateRoot.children = [templateOutlet.id]
  templateOutlet.parentId = templateRoot.id
  const postTemplate: Page = {
    id: nanoid(),
    title: 'Post template',
    slug: 'post-template',
    nodes: { [templateRoot.id]: templateRoot, [templateOutlet.id]: templateOutlet },
    rootNodeId: templateRoot.id,
    template: { enabled: true, target: { kind: 'postTypes', tableSlugs: ['posts'] }, priority: 0 },
  }
  await createDataRow(
    db,
    { id: postTemplate.id, tableId: 'pages', tenantId, cells: pageToCells(postTemplate), slug: postTemplate.slug },
    actorUserId,
    null,
    { collabInternal: true },
  )
}
