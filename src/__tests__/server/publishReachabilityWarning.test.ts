/**
 * Publishing a row and serving it are two separate outcomes.
 *
 * `renderPublishedDataRowTemplate` returns null — a 404 — when a row's post
 * type has no published entry template, but the publish transaction succeeds
 * regardless: the row flips to `published`, gets a `publishedAt`, and the API
 * answers 200. That gap used to be completely silent, so a user could publish
 * a post, see every success signal, and still have a dead URL.
 *
 * The publish endpoint now reports it as a warning. These tests pin both
 * directions so the signal can't quietly disappear again.
 */
import { describe, expect, it } from 'bun:test'
import { createCapabilityTestHarness } from '../helpers/capabilityHarness'

async function createPost(harness: Awaited<ReturnType<typeof createCapabilityTestHarness>>, cookie: string) {
  const res = await harness.cms('/admin/api/cms/data/tables/posts/rows', {
    cookie,
    method: 'POST',
    json: {},
  })
  expect(res.status).toBe(201)
  const { row } = await res.json()
  return row.id as string
}

describe('row publish reachability warning', () => {
  it('warns when the post type has no published entry template', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      const cookie = await harness.setupOwner()
      const rowId = await createPost(harness, cookie)

      // Setup seeds a post template as a DRAFT page. Until the site is
      // published, the publisher resolves the chain against the last published
      // snapshot — which has no template — so the entry is not reachable yet.
      const res = await harness.cms(`/admin/api/cms/data/rows/${rowId}/publish`, {
        cookie,
        method: 'POST',
        json: {},
      })
      expect(res.status).toBe(200)
      const body = await res.json()

      // The publish itself still succeeded.
      expect(body.row.status).toBe('published')

      expect(body.warnings).toHaveLength(1)
      expect(body.warnings[0].code).toBe('missingEntryTemplate')
      // The message has to name the dead route and the fix, not just complain.
      expect(body.warnings[0].message).toContain('posts')
      expect(body.warnings[0].message).toContain('404')
    } finally {
      await harness.cleanup()
    }
  })

  it('reports no warning once the entry template is published', async () => {
    const harness = await createCapabilityTestHarness()
    try {
      const cookie = await harness.setupOwner()
      const rowId = await createPost(harness, cookie)

      const sitePublish = await harness.cms('/admin/api/cms/publish', {
        cookie,
        method: 'POST',
        json: {},
      })
      expect(sitePublish.status).toBe(200)

      const res = await harness.cms(`/admin/api/cms/data/rows/${rowId}/publish`, {
        cookie,
        method: 'POST',
        json: {},
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.row.status).toBe('published')
      expect(body.warnings).toEqual([])
    } finally {
      await harness.cleanup()
    }
  })
})
