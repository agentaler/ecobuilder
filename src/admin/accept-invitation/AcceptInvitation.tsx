import { useEffect, useEffectEvent, useState } from 'react'
import { AppLoadingScreen } from '../AppLoadingScreen'
import { AdminPreAuthForm, type PreAuthPhase } from '../preauth/AdminPreAuthForm'
import { Button } from '@ui/components/Button'
import { acceptInvitationCms, switchWorkspaceCms } from '@core/persistence'
import {
  getCurrentCmsUser,
  getCmsPublicSite,
  getCmsSetupStatus,
  type CmsPublicSite,
} from '@core/persistence/auth'
import { isAbortError } from '@core/http'
import { getErrorMessage } from '@core/utils/errorMessage'
import panelStyles from '../AdminEntry.module.css'
import styles from './AcceptInvitation.module.css'

type Phase =
  | { kind: 'checking' }
  | { kind: 'accepting' }
  | { kind: 'need-auth'; publicSite: CmsPublicSite; setupTokenRequired: boolean }
  | { kind: 'error'; message: string }

/**
 * `/admin/accept-invitation?token=…` — the invitee's landing screen.
 *
 * If the visitor is already signed in, the token is redeemed immediately and
 * they're dropped into the workspace they joined. If they're signed out, the
 * shared pre-auth form is shown so they can sign in OR create an account (with
 * the invited email); on success the token is redeemed and the same landing
 * happens. Redeeming switches the session into the joined workspace, so a
 * brand-new signup skips onboarding and lands straight in the shared workspace.
 */
export function AcceptInvitation() {
  const token = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : '',
  ).get('token')?.trim() ?? ''
  const [phase, setPhase] = useState<Phase>(() =>
    token ? { kind: 'checking' } : { kind: 'error', message: 'This invitation link is missing its token.' },
  )
  const [authPhase, setAuthPhase] = useState<PreAuthPhase>('login')

  async function redeem(): Promise<void> {
    setPhase({ kind: 'accepting' })
    try {
      const { tenantId } = await acceptInvitationCms(token)
      // Land the invitee IN the workspace they just joined.
      await switchWorkspaceCms(tenantId).catch(() => {})
      window.location.assign('/admin')
    } catch (err) {
      if (isAbortError(err)) return
      setPhase({ kind: 'error', message: getErrorMessage(err, 'This invitation could not be accepted.') })
    }
  }

  // One-shot boot: redeem straight away for a signed-in visitor, otherwise show
  // the pre-auth form. `useEffectEvent` keeps it a mount-only run without an
  // exhaustive-deps escape hatch (which would disable the React Compiler).
  const boot = useEffectEvent(async () => {
    try {
      await getCurrentCmsUser()
      await redeem()
    } catch {
      try {
        const [publicSite, setup] = await Promise.all([getCmsPublicSite(), getCmsSetupStatus()])
        setPhase({ kind: 'need-auth', publicSite, setupTokenRequired: setup.setupTokenRequired ?? false })
      } catch (err) {
        setPhase({ kind: 'error', message: getErrorMessage(err, 'Something went wrong. Try again.') })
      }
    }
  })

  // Microtask-defer so no setState runs synchronously inside the effect body
  // (the codebase's pattern — see UsersPage's pending-action routing).
  useEffect(() => { if (token) queueMicrotask(() => void boot()) }, [token])

  if (phase.kind === 'checking' || phase.kind === 'accepting') {
    return <AppLoadingScreen />
  }

  if (phase.kind === 'error') {
    return (
      <main className={panelStyles.page}>
        <section className={panelStyles.panel}>
          <h1 className={panelStyles.title}>Invitation</h1>
          <p className={styles.message} role="alert">{phase.message}</p>
          <Button variant="primary" size="md" fullWidth onClick={() => window.location.assign('/admin')}>
            Go to Ecobuilder
          </Button>
        </section>
      </main>
    )
  }

  // need-auth: sign in or create an account, then redeem.
  return (
    <div className={styles.invited}>
      <p className={styles.banner}>
        You've been invited to a workspace. Sign in or create an account with the
        invited email address to accept.
      </p>
      <AdminPreAuthForm
        phase={authPhase}
        setupTokenRequired={phase.setupTokenRequired}
        publicSite={phase.publicSite}
        initialError={null}
        // OAuth is a hard navigation away — it could never come back here to
        // redeem the invitation token, so social stays off on this screen.
        socialEnabled={false}
        onPhaseChange={setAuthPhase}
        onAuthenticated={() => void redeem()}
      />
    </div>
  )
}
