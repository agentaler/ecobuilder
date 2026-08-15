import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  getCmsPublicSite,
  getCmsSetupStatus,
  getCurrentCmsUser,
  type CmsCurrentUser,
  type CmsPublicSite,
  type CmsSetupStatus,
} from '@core/persistence/auth'
import { getErrorMessage } from '@core/utils/errorMessage'

/**
 * Pre-flighted boot probes (see server/static.ts `BOOT_API_KICKOFF`).
 *
 * The unauthenticated SSR shell ships an inline `<script>` that fires the
 * three boot fetches at HTML-parse time and exposes the result promises on
 * `window.__instaticBootPromises`. When present, this hook consumes them instead
 * of issuing its own fetches — net effect: ~300 ms shaved off cold load
 * because React 19's `useEffect` would otherwise be deferred behind the
 * scheduler + first-paint cycle.
 *
 * Window typing kept loose (`unknown`) so we don't grow a public ambient
 * declaration; this consumer narrows once and validates the result shape.
 */
interface PreflightedBootPromises {
  setupStatus: Promise<CmsSetupStatus>
  me: Promise<{ ok: true; user: CmsCurrentUser } | { ok: false }>
  publicSite: Promise<CmsPublicSite | null>
}

function readPreflightedBootPromises(): PreflightedBootPromises | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { __instaticBootPromises?: unknown }).__instaticBootPromises
  if (!candidate || typeof candidate !== 'object') return null
  const c = candidate as Record<string, unknown>
  if (!('setupStatus' in c) || !('me' in c) || !('publicSite' in c)) return null
  return c as unknown as PreflightedBootPromises
}

// Phase the admin shell can be in after the boot effect has resolved. The
// 'mfa' phase is normally owned by the pre-auth form (a sub-state of 'login'
// that the login submit enters), with ONE boot-time exception: an OAuth
// callback that minted a pending-MFA session redirects to `/admin?mfa=1` —
// the session cookie exists but authenticates nothing until the second factor
// clears, so without the hint the boot would land on a login form that has no
// idea a code entry is one step away.
type AdminBootPhase = 'setup' | 'login' | 'mfa' | 'editor'

/**
 * Copy for the OAuth callback's `authError` refusal codes. The server redirects
 * with a CODE, never provider detail — the detail is in the server log.
 */
const AUTH_ERROR_COPY: Record<string, string> = {
  link_required:
    'An account with this email already exists but has not verified its address. '
    + 'Sign in with your password or an emailed code first — after that, social sign-in links automatically.',
  email_unverified:
    "That social account's email address isn't verified with the provider, so it can't be used here.",
  account_disabled: 'This account is suspended.',
  oauth_failed: 'Social sign-in failed. Try again.',
  oauth_denied: 'Social sign-in was cancelled.',
}

/**
 * Read-and-strip the OAuth handoff params. Stripping via `history.replaceState`
 * means a refresh doesn't re-show a stale error or re-enter the MFA screen.
 */
function consumeAuthRedirectParams(): { mfaPending: boolean; errorMessage: string | null } {
  if (typeof window === 'undefined') return { mfaPending: false, errorMessage: null }
  const params = new URLSearchParams(window.location.search)
  const mfaPending = params.get('mfa') === '1'
  const errorCode = params.get('authError')
  if (!mfaPending && !errorCode) return { mfaPending: false, errorMessage: null }
  params.delete('mfa')
  params.delete('authError')
  const query = params.toString()
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`,
  )
  return {
    mfaPending,
    errorMessage: errorCode ? AUTH_ERROR_COPY[errorCode] ?? 'Sign-in failed. Try again.' : null,
  }
}

interface AdminBootResult {
  status: 'loading' | 'ready'
  phase: AdminBootPhase
  setupTokenRequired: boolean
  currentUser: CmsCurrentUser | null
  publicSite: CmsPublicSite
  initialError: string | null
}

const DEFAULT_PUBLIC_SITE: CmsPublicSite = { name: null, faviconUrl: null }

/**
 * Resolves the initial admin shell state on mount:
 *  1. Site identity (logo + name) is fetched in parallel so the brand row
 *     can hydrate independently of the auth probe.
 *  2. Setup status decides whether the install needs first-run setup.
 *  3. If setup is complete, the current-user probe decides login vs. editor.
 *
 * The hook never re-runs — once 'ready', subsequent transitions (login
 * success, MFA verify, logout) are owned by the pre-auth form / authenticated
 * shell, not this hook.
 */
export function useAdminBoot(): AdminBootResult {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading')
  const [phase, setPhase] = useState<AdminBootPhase>('login')
  const [currentUser, setCurrentUser] = useState<CmsCurrentUser | null>(null)
  const [publicSite, setPublicSite] = useState<CmsPublicSite>(DEFAULT_PUBLIC_SITE)
  const [initialError, setInitialError] = useState<string | null>(null)
  // Production installs gate the setup POST behind a bootstrap token, so the
  // setup form has to know whether to ask for one.
  const [setupTokenRequired, setSetupTokenRequired] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Preferred path: consume the promises the SSR shell fired at HTML
    // parse time. They started at ~5 ms and are almost certainly already
    // resolved by the time React's `useEffect` runs (~300 ms post-mount).
    // Falls back to firing the fetches from here if the inline script is
    // missing (dev server, custom SSR setups, or pre-SSR builds).
    const preflighted = readPreflightedBootPromises()

    const publicSitePromise = preflighted?.publicSite ?? getCmsPublicSite().catch(() => null)
    void publicSitePromise.then((next) => {
      if (cancelled || next === null) return
      setPublicSite(next)
    })

    async function resolveAuthPhase(): Promise<void> {
      try {
        const setupStatusPromise = preflighted?.setupStatus ?? getCmsSetupStatus()
        const currentUserPromise: Promise<{ ok: true; user: CmsCurrentUser } | { ok: false }> =
          preflighted?.me
            ?? getCurrentCmsUser().then(
              (u) => ({ ok: true as const, user: u }),
              () => ({ ok: false as const }),
            )
        const setupStatus = await setupStatusPromise
        if (cancelled) return

        if (setupStatus.needsSetup) {
          // flushSync — see comment on the editor-phase branch below.
          flushSync(() => {
            setSetupTokenRequired(setupStatus.setupTokenRequired ?? false)
            setPhase('setup')
            setStatus('ready')
          })
          // Drain the speculative /me request so we don't leak a pending
          // promise rejection.
          void currentUserPromise
          return
        }

        const currentUserResult = await currentUserPromise
        if (cancelled) return
        // flushSync — by default React 19 schedules the state transition
        // (loading → editor) under the concurrent scheduler, and the
        // commit can sit in the work queue for 200–300 ms behind layout
        // / paint / prefetch work before it actually renders. On our
        // resource-timeline trace this gap was the bulk of the
        // perceived "cold load" — DashboardPage's chunk loaded at
        // ~60 ms, but its commit didn't paint until ~380 ms because the
        // concurrent re-render was deferred.
        //
        // Forcing the boot-resolved transition synchronous means the
        // moment the /me promise resolves, React paints the next frame
        // with DashboardPage instead of stalling AppLoadingScreen for
        // an extra 280 ms. Subsequent state transitions in the app
        // (nav clicks, form submits, etc.) still flow through the
        // concurrent scheduler — this only forces THE initial boot
        // commit through.
        if (currentUserResult.ok) {
          flushSync(() => {
            setCurrentUser(currentUserResult.user)
            setPhase('editor')
            setStatus('ready')
          })
        } else {
          // The OAuth callback hands off through URL params: `?mfa=1` means a
          // pending-MFA session cookie is already set (open on the MFA screen),
          // `?authError=…` is a refusal to surface. Both are read-and-stripped
          // so a refresh doesn't replay them.
          const handoff = consumeAuthRedirectParams()
          flushSync(() => {
            setCurrentUser(null)
            if (handoff.errorMessage) setInitialError(handoff.errorMessage)
            setPhase(handoff.mfaPending ? 'mfa' : 'login')
            setStatus('ready')
          })
        }
      } catch (err) {
        if (cancelled) return
        flushSync(() => {
          setInitialError(getErrorMessage(err, 'CMS is unavailable'))
          setPhase('login')
          setStatus('ready')
        })
      }
    }

    void resolveAuthPhase()
    return () => { cancelled = true }
  }, [])

  return { status, phase, currentUser, publicSite, initialError, setupTokenRequired }
}
