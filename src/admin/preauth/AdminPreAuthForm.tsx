import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@ui/components/Button'
import { Input } from '@ui/components/Input'
import { DatabaseSolidIcon } from 'pixel-art-icons/icons/database-solid'
import { LoaderIcon } from 'pixel-art-icons/icons/loader'
import {
  getCurrentCmsUser,
  loginCms,
  setupCms,
  signupCms,
  verifyCmsMfa,
  type CmsCurrentUser,
  type CmsPublicSite,
} from '@core/persistence/auth'
import panelStyles from '../AdminEntry.module.css'
import styles from './AdminPreAuthForm.module.css'
import { getErrorMessage } from '@core/utils/errorMessage'

// Phase the unauthenticated form can be in. 'mfa' is a sub-state reached
// only after a login submit returns `mfaRequired: true` — never set by the
// boot hook directly.
export type PreAuthPhase = 'setup' | 'login' | 'signup' | 'mfa'

interface AdminPreAuthFormProps {
  phase: PreAuthPhase
  /** Production installs require a bootstrap token to claim the instance. */
  setupTokenRequired: boolean
  publicSite: CmsPublicSite
  initialError: string | null
  onPhaseChange: (phase: PreAuthPhase) => void
  onAuthenticated: (user: CmsCurrentUser) => void
}

interface PhaseCopy {
  title: string
  submit: string
  submitPending: string
}

const PHASE_COPY: Record<PreAuthPhase, PhaseCopy> = {
  setup: { title: 'Set Up CMS', submit: 'Create Admin', submitPending: 'Setting up' },
  login: { title: 'Sign in', submit: 'Sign In', submitPending: 'Signing in' },
  signup: { title: 'Create your workspace', submit: 'Create workspace', submitPending: 'Creating' },
  mfa: { title: 'Two-Factor Authentication', submit: 'Verify', submitPending: 'Verifying' },
}

const MIN_PASSWORD_LENGTH = 12

async function runAuthAction(
  action: () => Promise<void>,
  fallbackMessage: string,
  setSubmitting: (v: boolean) => void,
  setError: (v: string | null) => void,
): Promise<void> {
  setSubmitting(true)
  setError(null)
  try {
    await action()
  } catch (err) {
    setError(getErrorMessage(err, fallbackMessage))
  } finally {
    setSubmitting(false)
  }
}

export function AdminPreAuthForm({
  phase,
  setupTokenRequired,
  publicSite,
  initialError,
  onPhaseChange,
  onAuthenticated,
}: AdminPreAuthFormProps) {
  const [siteName, setSiteName] = useState('My Site')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  const siteNameId = useId()
  const displayNameId = useId()
  const emailId = useId()
  const passwordId = useId()
  const mfaCodeId = useId()
  const setupTokenId = useId()

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    await runAuthAction(async () => {
      await setupCms({ siteName, email, password, displayName, setupToken })
      await loginCms({ email, password })
      onAuthenticated(await getCurrentCmsUser())
    }, 'Setup failed', setSubmitting, setError)
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    await runAuthAction(async () => {
      // Creates the ACCOUNT and auto-signs in with no workspace yet; `/me` then
      // hydrates the session and the app routes to onboarding (a null
      // activeTenantId) to create the first workspace.
      await signupCms({ displayName, email, password })
      onAuthenticated(await getCurrentCmsUser())
    }, 'Sign up failed', setSubmitting, setError)
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAuthAction(async () => {
      const result = await loginCms({ email, password })
      if (result.mfaRequired) {
        setPassword('')
        setMfaCode('')
        onPhaseChange('mfa')
        return
      }
      onAuthenticated(await getCurrentCmsUser())
    }, 'Login failed', setSubmitting, setError)
  }

  async function handleMfaVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runAuthAction(async () => {
      await verifyCmsMfa({ code: mfaCode })
      const user = await getCurrentCmsUser()
      setMfaCode('')
      onAuthenticated(user)
    }, 'MFA verification failed', setSubmitting, setError)
  }

  const copy = PHASE_COPY[phase]
  const submitLabel = submitting ? copy.submitPending : copy.submit

  // Pre-auth brand row: when the install has picked a favicon, render it
  // in place of the default icon AND swap the "Ecobuilder" label for
  // the operator-configured site name. When neither is set, keep the
  // default mark + product name so a fresh clone still looks like itself.
  const brandLabel = publicSite.name ?? 'Ecobuilder'

  const onSubmit =
    phase === 'setup' ? handleSetup :
    phase === 'signup' ? handleSignup :
    phase === 'mfa' ? handleMfaVerify :
    handleLogin

  return (
    <main className={panelStyles.page}>
      <section className={panelStyles.panel} aria-labelledby="admin-entry-title">
        <div className={styles.brandRow}>
          {publicSite.faviconUrl ? (
            <img
              className={styles.brandFavicon}
              src={publicSite.faviconUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          ) : (
            <div className={styles.brandIcon} aria-hidden="true">
              <DatabaseSolidIcon size={16} />
            </div>
          )}
          <span>{brandLabel}</span>
        </div>

        <h1 id="admin-entry-title" className={panelStyles.title}>{copy.title}</h1>

        <form className={styles.form} onSubmit={onSubmit}>
          {phase === 'mfa' ? (
            <label className={styles.field} htmlFor={mfaCodeId}>
              <span>Authentication code</span>
              <Input
                id={mfaCodeId}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                data-testid="admin-mfa-code"
              />
            </label>
          ) : phase === 'setup' && (
            <>
              <label className={styles.field} htmlFor={siteNameId}>
                <span>Site name</span>
                <Input
                  id={siteNameId}
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  required
                  autoComplete="organization"
                />
              </label>

              {/* Optional, and public: this is what author bindings render on
                  published pages. Left blank they render nothing — which is
                  why it is offered here rather than only on the account page. */}
              <label className={styles.field} htmlFor={displayNameId}>
                <span>Your name <span className={styles.hint}>optional, shown on published pages</span></span>
                <Input
                  id={displayNameId}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  data-testid="admin-setup-display-name"
                />
              </label>

              {/* Only a person with deployment log access can claim a public
                  install — knowing the URL is not enough. */}
              {setupTokenRequired && (
                <label className={styles.field} htmlFor={setupTokenId}>
                  <span>Setup token <span className={styles.hint}>printed in this server's startup log</span></span>
                  <Input
                    id={setupTokenId}
                    value={setupToken}
                    onChange={(event) => setSetupToken(event.target.value)}
                    required
                    autoComplete="off"
                    data-testid="admin-setup-token"
                  />
                </label>
              )}
            </>
          )}

          {phase === 'signup' && (
            <label className={styles.field} htmlFor={displayNameId}>
              <span>Your name <span className={styles.hint}>optional</span></span>
              <Input
                id={displayNameId}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                data-testid="signup-display-name"
              />
            </label>
          )}

          {phase !== 'mfa' && (
            <>
              <label className={styles.field} htmlFor={emailId}>
                <span>Email</span>
                <Input
                  id={emailId}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  autoComplete="email"
                />
              </label>

              <label className={styles.field} htmlFor={passwordId}>
                <span>Password</span>
                <Input
                  id={passwordId}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={phase === 'setup' || phase === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
                  type="password"
                  autoComplete={phase === 'setup' || phase === 'signup' ? 'new-password' : 'current-password'}
                />
              </label>
            </>
          )}

          {error && (
            <p role="alert" className={panelStyles.error}>
              {error}
            </p>
          )}

          <Button
            variant="primary"
            size="md"
            type="submit"
            fullWidth
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && (
              <LoaderIcon size={14} className={styles.spinIcon} aria-hidden="true" />
            )}
            <span>{submitLabel}</span>
          </Button>
        </form>

        {/* Login ↔ signup toggle — the self-service SaaS front door. Hidden
            during setup (one-shot install bootstrap) and MFA (a sub-step of an
            in-flight login). */}
        {(phase === 'login' || phase === 'signup') && (
          <p className={styles.altAction}>
            {phase === 'login' ? (
              <>
                New to {brandLabel}?{' '}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => { setError(null); onPhaseChange('signup') }}
                  data-testid="switch-to-signup"
                >
                  Create a workspace
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => { setError(null); onPhaseChange('login') }}
                  data-testid="switch-to-login"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        )}
      </section>
    </main>
  )
}
