/**
 * Shared Redis layer.
 *
 * Everything here is OPTIONAL. With `REDIS_URL` unset the module reports
 * itself unconfigured and every helper is a no-op, so single-process installs
 * (and `bun run dev`) behave exactly as they did before Redis existed — no
 * extra container, no new required dependency.
 *
 * With `REDIS_URL` set, the module gives the process the two things a
 * multi-instance deployment needs and a single process cannot provide:
 *
 *   1. **Cross-instance publish invalidation.** Each instance keeps its own
 *      in-memory render cache keyed by publish version. Publishing on instance
 *      A must invalidate instance B, so the version is mirrored to a shared
 *      counter and broadcast on a pub/sub channel. Reads stay synchronous —
 *      the local counter is updated by the subscription, never awaited on the
 *      hot path.
 *   2. **A cross-instance publish lock**, so two instances cannot interleave
 *      their read-version → bake → bump windows over the same shared volume.
 *
 * Failures are never fatal: Redis being down degrades the deployment to
 * per-instance behaviour (exactly the pre-Redis semantics) rather than taking
 * publishing offline.
 */
import { RedisClient } from 'bun'

/** Shared key namespace, so one Redis can host several environments. */
const PREFIX = 'ecobuilder:'
export const PUBLISH_VERSION_KEY = `${PREFIX}publish:version`
export const PUBLISH_VERSION_CHANNEL = `${PREFIX}publish:version:changed`
export const PUBLISH_LOCK_KEY = `${PREFIX}publish:lock`

let client: RedisClient | null = null
let subscriber: RedisClient | null = null
let configuredUrl: string | null = null

/** True when a Redis URL was supplied and the client has been created. */
export function isCacheConfigured(): boolean {
  return client !== null
}

function logFailure(operation: string, err: unknown): void {
  console.error(`[cache] ${operation} failed`, err)
}

/**
 * Create the Redis connections. Safe to call with `undefined` (no-op) and safe
 * to call twice (the second call is ignored). A connection error is logged and
 * swallowed — the caller continues without Redis.
 *
 * `onPublishVersion` is invoked whenever another instance broadcasts a new
 * publish version, so this process can fast-forward its local counter.
 */
export async function initCache(
  url: string | undefined,
  onPublishVersion?: (version: number) => void,
): Promise<void> {
  if (!url || client) return
  try {
    configuredUrl = url
    client = new RedisClient(url)
    await client.connect()

    if (onPublishVersion) {
      // A dedicated connection: a subscribed Redis connection cannot serve
      // ordinary commands.
      subscriber = new RedisClient(url)
      await subscriber.connect()
      await subscriber.subscribe(PUBLISH_VERSION_CHANNEL, (message: string) => {
        const version = Number.parseInt(message, 10)
        if (Number.isFinite(version)) onPublishVersion(version)
      })
    }
  } catch (err) {
    logFailure('connect', err)
    await closeCache()
  }
}

/** Close both connections. Used on shutdown and between tests. */
export async function closeCache(): Promise<void> {
  const open = [client, subscriber].filter((c): c is RedisClient => c !== null)
  client = null
  subscriber = null
  configuredUrl = null
  for (const c of open) {
    try {
      c.close()
    } catch (err) {
      logFailure('close', err)
    }
  }
}

/** The URL the cache was configured with, for diagnostics. */
export function cacheUrl(): string | null {
  return configuredUrl
}

/**
 * Atomically increment the shared publish counter and broadcast the new value.
 * Returns the shared version, or `null` when Redis is unavailable so the
 * caller can fall back to its local counter.
 */
export async function incrementSharedPublishVersion(): Promise<number | null> {
  if (!client) return null
  try {
    const version = await client.incr(PUBLISH_VERSION_KEY)
    await client.publish(PUBLISH_VERSION_CHANNEL, String(version))
    return version
  } catch (err) {
    logFailure('publish-version increment', err)
    return null
  }
}

/**
 * Read the shared publish counter, so a starting instance does not serve
 * renders stamped with a version below what its peers have already published.
 */
export async function readSharedPublishVersion(): Promise<number | null> {
  if (!client) return null
  try {
    const raw = await client.get(PUBLISH_VERSION_KEY)
    if (raw === null) return null
    const version = Number.parseInt(raw, 10)
    return Number.isFinite(version) ? version : null
  } catch (err) {
    logFailure('publish-version read', err)
    return null
  }
}

/**
 * Try to take a lock for `ttlMs`. Returns a token on success, `null` when the
 * lock is held elsewhere OR when Redis is unavailable — callers treat `null`
 * as "no cross-instance lock", never as "blocked", so an outage cannot stop
 * publishing.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  if (!client) return null
  const token = crypto.randomUUID()
  try {
    const result = await client.set(key, token, 'PX', String(ttlMs), 'NX')
    return result === 'OK' ? token : null
  } catch (err) {
    logFailure('lock acquire', err)
    return null
  }
}

/**
 * Release a lock, but only if this process still owns it — a lock that expired
 * and was retaken by a peer must not be deleted by the previous holder.
 */
export async function releaseLock(key: string, token: string): Promise<void> {
  if (!client) return
  try {
    const current = await client.get(key)
    if (current === token) await client.del(key)
  } catch (err) {
    logFailure('lock release', err)
  }
}

/** Test seam: the live client, or `null`. */
export function cacheClientForTests(): RedisClient | null {
  return client
}
