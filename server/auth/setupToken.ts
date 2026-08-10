/**
 * Bootstrap token for the first-run setup endpoint.
 *
 * `POST /admin/api/cms/setup` is a one-shot: it 409s once a site and an owner
 * exist. That is enough to stop it becoming an account-creation backdoor, but
 * it is NOT enough on a publicly reachable host. Between the moment a
 * deployment goes live and the moment the operator claims it, whoever finds
 * the hostname first becomes the owner — the endpoint hands out the instance
 * on a first-come basis, and a hosted app is on a guessable domain.
 *
 * So in production the setup POST additionally requires a token:
 *
 *   1. `INSTATIC_SETUP_TOKEN` environment variable, when set. Deployments that
 *      want a known value (config management, an operator who is not watching
 *      the logs) set this.
 *   2. Otherwise a random token generated at boot and logged once. Claiming
 *      the install then requires deployment log access, which a stranger who
 *      merely knows the URL does not have.
 *
 * Outside production no token is required: local dev and the test harness run
 * setup constantly, and an attacker who is already on your loopback interface
 * has better options than racing the installer.
 *
 * The production check is deliberately `NODE_ENV`-based rather than derived
 * from the request's Host header — a Host is attacker-controlled, so gating on
 * "looks like localhost" would be bypassable with a spoofed header.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'

const ENV_VAR_NAME = 'INSTATIC_SETUP_TOKEN'

/**
 * Only the GENERATED token is memoized. A generated token must stay stable for
 * the lifetime of the boot that logged it, or the operator's copy would go
 * stale mid-setup. A configured token is read live from the environment every
 * time — it is already stable by definition, and caching it would mean the
 * process kept honouring a value the operator had since changed.
 */
let generatedToken: string | null = null

/** True when the setup POST must carry a matching token. */
export function isSetupTokenRequired(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** The token the setup POST must present. */
export function getSetupToken(): string {
  const configured = process.env[ENV_VAR_NAME]?.trim()
  if (configured) return configured
  generatedToken ??= randomBytes(24).toString('base64url')
  return generatedToken
}

/**
 * Compare a caller-supplied token against the expected one without leaking
 * position information through timing. Lengths are compared first because
 * `timingSafeEqual` throws on a length mismatch.
 */
export function isValidSetupToken(candidate: string): boolean {
  const expected = getSetupToken()
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Announce the token at boot when the install is still unclaimed. Called once
 * from the server entrypoint. Nothing is logged when setup is already complete
 * — the token is spent, and printing a live secret on every restart of a
 * long-running install is how secrets end up in log aggregators.
 */
export function logSetupTokenIfPending(needsSetup: boolean): void {
  if (!needsSetup || !isSetupTokenRequired()) return
  if (process.env[ENV_VAR_NAME]?.trim()) {
    console.warn(`[setup] This install is unclaimed. Setup requires the ${ENV_VAR_NAME} you configured.`)
    return
  }
  console.warn(
    `[setup] This install is unclaimed. Setup requires this one-time token:\n` +
      `[setup]   ${getSetupToken()}\n` +
      `[setup] It changes on every restart. Set ${ENV_VAR_NAME} to pin it.`,
  )
}
