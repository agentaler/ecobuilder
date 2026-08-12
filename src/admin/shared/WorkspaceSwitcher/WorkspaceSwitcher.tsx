/**
 * WorkspaceSwitcher — toolbar chip that shows the active workspace and lets the
 * user switch between the workspaces they belong to, or create a new one.
 *
 * Sits just before `AccountMenuButton` in `Toolbar.tsx`. Switching or creating
 * a workspace does a HARD navigation to `/admin` on purpose: the whole admin
 * shell re-boots so `/me` re-resolves the user's role + capabilities in the new
 * workspace (a soft nav would keep the stale per-tenant capability set alive).
 *
 * Renders nothing until the user is hydrated; a single-workspace user still
 * sees the chip (so they can create a second one) but no switch list churn.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@ui/components/Button'
import { Input } from '@ui/components/Input'
import { Dialog } from '@ui/components/Dialog'
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '@ui/components/ContextMenu'
import { FolderGlyphIcon } from 'pixel-art-icons/icons/folder-glyph'
import { ChevronDownIcon } from 'pixel-art-icons/icons/chevron-down'
import { CheckIcon } from 'pixel-art-icons/icons/check'
import { PlusIcon } from 'pixel-art-icons/icons/plus'
import { useCurrentAdminUser } from '@admin/sessionContext'
import {
  listWorkspacesCms,
  switchWorkspaceCms,
  createWorkspaceCms,
  type CmsWorkspaceWithRole,
} from '@core/persistence'
import { pushToast } from '@ui/components/Toast'
import { getErrorMessage } from '@core/utils/errorMessage'
import styles from './WorkspaceSwitcher.module.css'

const NEW_WORKSPACE_FORM_ID = 'new-workspace-form'

export function WorkspaceSwitcher(): ReactNode {
  const user = useCurrentAdminUser()
  const [open, setOpen] = useState(false)
  const [workspaces, setWorkspaces] = useState<CmsWorkspaceWithRole[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Load the workspace list once so the chip can label the active workspace and
  // the menu can list the rest. Cheap (one query); refreshed on mount only.
  useEffect(() => {
    let alive = true
    listWorkspacesCms()
      .then((res) => { if (alive) setWorkspaces(res.workspaces) })
      .catch((err) => console.error('[workspace-switcher] load failed:', err))
    return () => { alive = false }
  }, [])

  if (!user) return null

  const activeId = user.activeTenantId
  const active = workspaces?.find((w) => w.id === activeId) ?? null
  const label = active?.name ?? 'Workspace'

  async function handleSwitch(tenantId: string): Promise<void> {
    if (busy || tenantId === activeId) { setOpen(false); return }
    setBusy(true)
    try {
      await switchWorkspaceCms(tenantId)
      // Hard reload so the shell re-boots with the new active workspace.
      window.location.assign('/admin')
    } catch (err) {
      setBusy(false)
      pushToast({ kind: 'error', title: 'Could not switch workspace', body: getErrorMessage(err, 'Please try again.') })
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      await createWorkspaceCms({ name })
      // createWorkspaceCms switches the session into the new workspace.
      window.location.assign('/admin')
    } catch (err) {
      setBusy(false)
      pushToast({ kind: 'error', title: 'Could not create workspace', body: getErrorMessage(err, 'Please try again.') })
    }
  }

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="xs"
        type="button"
        active={open}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Current workspace: ${label}. Switch workspace`}
        className={styles.trigger}
        data-testid="workspace-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <FolderGlyphIcon size={13} aria-hidden="true" className={styles.triggerIcon} />
        <span className={styles.triggerLabel}>{label}</span>
        <ChevronDownIcon size={12} aria-hidden="true" className={styles.triggerChevron} />
      </Button>

      {open && typeof document !== 'undefined' && createPortal(
        <ContextMenu
          ariaLabel="Switch workspace"
          onClose={() => setOpen(false)}
          anchorRef={triggerRef}
          side="bottom"
          align="start"
          width={260}
          zIndex={10000}
        >
          <header className={styles.header}>Workspaces</header>
          <ContextMenuSeparator />
          {workspaces && workspaces.length > 0 ? (
            workspaces.map((w) => (
              <ContextMenuItem
                key={w.id}
                onClick={() => void handleSwitch(w.id)}
                disabled={busy}
                data-testid={`workspace-option-${w.slug}`}
              >
                <span className={styles.check} aria-hidden="true">
                  {w.id === activeId ? <CheckIcon size={12} /> : null}
                </span>
                <span className={styles.wsName}>{w.name}</span>
                {w.roleId === 'owner' && <span className={styles.ownerTag}>Owner</span>}
              </ContextMenuItem>
            ))
          ) : (
            <p className={styles.empty}>{workspaces ? 'No other workspaces' : 'Loading…'}</p>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => { setOpen(false); setNewName(''); setCreating(true) }}
            data-testid="workspace-create"
          >
            <span className={styles.check} aria-hidden="true"><PlusIcon size={12} /></span>
            <span>New workspace</span>
          </ContextMenuItem>
        </ContextMenu>,
        document.body,
      )}

      {creating && (
        <Dialog
          open
          onClose={() => { if (!busy) setCreating(false) }}
          title="Create a workspace"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" form={NEW_WORKSPACE_FORM_ID} variant="primary" disabled={busy || !newName.trim()}>
                {busy ? 'Creating…' : 'Create workspace'}
              </Button>
            </>
          }
        >
          <form id={NEW_WORKSPACE_FORM_ID} onSubmit={(e) => void handleCreate(e)} className={styles.createForm}>
            <label className={styles.createLabel} htmlFor="new-workspace-name">Workspace name</label>
            <Input
              id="new-workspace-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Acme Studio"
              autoFocus
              required
              data-testid="workspace-create-name"
            />
          </form>
        </Dialog>
      )}
    </>
  )
}
