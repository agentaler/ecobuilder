import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@ui/components/Button'
import { Input } from '@ui/components/Input'
import { LoaderIcon } from 'pixel-art-icons/icons/loader'
import { createWorkspaceCms } from '@core/persistence'
import { getCurrentCmsUser, type CmsCurrentUser } from '@core/persistence/auth'
import { getErrorMessage } from '@core/utils/errorMessage'
import panelStyles from '../AdminEntry.module.css'
import fieldStyles from '../preauth/AdminPreAuthForm.module.css'
import styles from './OnboardingWorkspace.module.css'

interface OnboardingWorkspaceProps {
  user: CmsCurrentUser
  /** Called with the refreshed user (now carrying an active workspace). */
  onCreated: (user: CmsCurrentUser) => void
}

/**
 * First-run onboarding (E06-T06): a freshly signed-up account has no workspace,
 * so `activeTenantId` is null. This step creates the first workspace, switches
 * the session into it server-side, then re-reads `/me` so the app re-renders
 * into the editor for the new workspace.
 */
export function OnboardingWorkspace({ user, onCreated }: OnboardingWorkspaceProps) {
  const firstName = user.displayName.trim().split(/\s+/)[0]
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const workspaceName = name.trim()
    if (!workspaceName) {
      setError('Give your workspace a name')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createWorkspaceCms({ name: workspaceName })
      // The session now points at the new workspace — re-hydrate so the app
      // renders the editor with owner capabilities in it.
      onCreated(await getCurrentCmsUser())
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create workspace'))
      setSubmitting(false)
    }
  }

  return (
    <main className={panelStyles.page}>
      <section className={panelStyles.panel} aria-labelledby="onboarding-title">
        <p className={styles.eyebrow}>{firstName ? `Welcome, ${firstName}` : 'Welcome'}</p>
        <h1 id="onboarding-title" className={panelStyles.title}>Create your first workspace</h1>
        <p className={styles.lede}>
          A workspace holds your sites, content, and team. You can create more later.
        </p>

        <form className={fieldStyles.form} onSubmit={handleSubmit}>
          <label className={fieldStyles.field} htmlFor={nameId}>
            <span>Workspace name</span>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme Studio"
              autoComplete="organization"
              autoFocus
              required
              data-testid="onboarding-workspace-name"
            />
          </label>

          {error && (
            <p role="alert" className={panelStyles.error}>{error}</p>
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
              <LoaderIcon size={14} className={fieldStyles.spinIcon} aria-hidden="true" />
            )}
            <span>{submitting ? 'Creating workspace' : 'Create workspace'}</span>
          </Button>
        </form>
      </section>
    </main>
  )
}
