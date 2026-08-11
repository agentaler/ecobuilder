/**
 * Setup must seed an entry template for the `posts` post type.
 *
 * Without one, `renderPublishedDataRowTemplate` finds an empty template chain
 * and returns null, so every published post 404s — while the publish API
 * reports success. That silent dead end was reachable on every fresh install,
 * so the seed is a correctness requirement, not a convenience.
 */
import { describe, expect, it } from 'bun:test'
import { createCapabilityTestHarness } from '../helpers/capabilityHarness'
import { parsePageTemplate } from '@core/page-tree'

describe('setup seeding', () => {
  it('creates a post entry template alongside the starter homepage', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      const cookie = await harness.setupOwner()

      const res = await harness.cms('/admin/api/cms/data/tables/pages/rows', { cookie })
      expect(res.status).toBe(200)
      const body = await res.json()

      const slugs = body.rows.map((r: { slug: string }) => r.slug).sort()
      expect(slugs).toContain('index')
      expect(slugs).toContain('post-template')

      const template = body.rows.find((r: { slug: string }) => r.slug === 'post-template')
      expect(template.cells.templateEnabled).toBe(true)
      expect(template.cells.templateTarget).toEqual({ kind: 'postTypes', tableSlugs: ['posts'] })

      // The seeded config must survive the same parse the publisher applies.
      const parsed = parsePageTemplate({
        enabled: template.cells.templateEnabled,
        target: template.cells.templateTarget,
        priority: template.cells.templatePriority,
      })
      expect(parsed?.enabled).toBe(true)
      expect(parsed?.target).toEqual({ kind: 'postTypes', tableSlugs: ['posts'] })
    } finally {
      await harness.cleanup()
    }
  })

  it('gives the template an outlet so the entry body renders inside it', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      const cookie = await harness.setupOwner()
      const body = await (await harness.cms('/admin/api/cms/data/tables/pages/rows', { cookie })).json()
      const template = body.rows.find((r: { slug: string }) => r.slug === 'post-template')

      const nodes: Record<string, { moduleId: string }> = template.cells.body.nodes
      const moduleIds = Object.values(nodes).map((n) => n.moduleId)
      // An entry template without an outlet renders a wrapper with no post in it.
      expect(moduleIds).toContain('base.outlet')
    } finally {
      await harness.cleanup()
    }
  })
})
