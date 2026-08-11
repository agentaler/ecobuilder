/**
 * Proves the publish version behaves correctly for a multi-instance
 * deployment, which is the whole reason Redis was introduced.
 *
 * The render cache on each instance is keyed by publish version, so publishing
 * on instance A only invalidates instance B if B learns the new version. These
 * tests cover the version-adoption contract without needing a live Redis: they
 * drive `adoptPublishVersion` the way the pub/sub subscription does.
 *
 * The no-Redis path matters just as much — a self-hosted single process must
 * behave exactly as it did before this module existed.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { isCacheConfigured } from '../../../server/cache/redis'
import {
  adoptPublishVersion,
  bumpPublishVersion,
  getPublishVersion,
  resetPublishStateForTests,
  withPublishLock,
} from '../../../server/publish/publishState'

afterEach(() => {
  resetPublishStateForTests()
})

describe('publish version sharing', () => {
  it('is unconfigured — and therefore purely local — without REDIS_URL', () => {
    expect(isCacheConfigured()).toBe(false)
    const before = getPublishVersion()
    expect(bumpPublishVersion()).toBe(before + 1)
    expect(getPublishVersion()).toBe(before + 1)
  })

  it('adopts a higher version broadcast by a peer instance', () => {
    bumpPublishVersion()
    const local = getPublishVersion()

    adoptPublishVersion(local + 5)

    expect(getPublishVersion()).toBe(local + 5)
  })

  it('never moves the version backwards', () => {
    bumpPublishVersion()
    bumpPublishVersion()
    const local = getPublishVersion()

    // A late or out-of-order broadcast must not resurrect invalidated renders.
    adoptPublishVersion(local - 1)
    adoptPublishVersion(0)

    expect(getPublishVersion()).toBe(local)
  })

  it('ignores a non-numeric or non-finite broadcast', () => {
    const local = getPublishVersion()

    adoptPublishVersion(Number.NaN)
    adoptPublishVersion(Number.POSITIVE_INFINITY)

    expect(getPublishVersion()).toBe(local)
  })

  it('keeps serializing publishes in-process when no shared lock is available', async () => {
    const order: string[] = []
    const first = withPublishLock(async () => {
      order.push('first:start')
      await Bun.sleep(20)
      order.push('first:end')
    })
    const second = withPublishLock(async () => {
      order.push('second:start')
      order.push('second:end')
    })

    await Promise.all([first, second])

    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

  it('a peer bump between two local publishes is not lost', () => {
    bumpPublishVersion()
    const afterLocal = getPublishVersion()

    // Peer publishes twice while this instance is idle…
    adoptPublishVersion(afterLocal + 2)
    // …then this instance publishes again.
    const next = bumpPublishVersion()

    expect(next).toBe(afterLocal + 3)
    expect(getPublishVersion()).toBe(afterLocal + 3)
  })
})
