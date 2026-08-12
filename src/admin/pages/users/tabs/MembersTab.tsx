/**
 * Users → Team tab.
 *
 * The members of the CURRENT workspace (resolved server-side from the session's
 * active tenant), plus pending invitations. Owners/admins (`users.manage`) can
 * invite by email, change a member's role, remove a member, and cancel a
 * pending invite. The owner role is protected server-side — only an owner may
 * assign it or manage another owner — so this UI offers the non-owner roles and
 * surfaces any server refusal via a toast.
 *
 * Self-contained: loads its own members / invitations / role options, unlike
 * the sibling tabs which share `useUsersPageData` (those are install-global;
 * this list is per-workspace).
 */
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Button } from '@ui/components/Button'
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from '@ui/components/DataTable'
import { Dialog } from '@ui/components/Dialog'
import { Input } from '@ui/components/Input'
import { Select } from '@ui/components/Select'
import { Skeleton } from '@ui/components/Skeleton'
import { PlusIcon } from 'pixel-art-icons/icons/plus'
import { TrashSolidIcon } from 'pixel-art-icons/icons/trash-solid'
import { pushToast } from '@ui/components/Toast'
import {
  listWorkspaceMembersCms,
  setWorkspaceMemberRoleCms,
  removeWorkspaceMemberCms,
  listInvitationsCms,
  createInvitationCms,
  cancelInvitationCms,
  listCmsRoles,
  type CmsWorkspaceMember,
  type CmsInvitation,
  type CmsRole,
} from '@core/persistence'
import { RowActionMenu } from '../components/RowActionMenu'
import { Badge } from '../components/Badge'
import styles from '../UsersPage.module.css'
import { getErrorMessage } from '@core/utils/errorMessage'

const INVITE_FORM_ID = 'invite-member-form'

/** Roles offerable in the invite / change-role dropdowns (owner is protected). */
function assignableRoles(roles: CmsRole[]): CmsRole[] {
  return roles.filter((r) => r.id !== 'owner')
}

/** Pure load of the team's members, pending invitations, and role options. */
async function loadTeamData(): Promise<{
  members: CmsWorkspaceMember[]
  invitations: CmsInvitation[]
  roles: CmsRole[]
}> {
  const [members, invitations, roles] = await Promise.all([
    listWorkspaceMembersCms(),
    listInvitationsCms(),
    listCmsRoles(),
  ])
  return { members, invitations, roles }
}

function toastError(err: unknown, title: string): void {
  pushToast({ kind: 'error', title, body: getErrorMessage(err, 'Please try again.') })
}

export function MembersTab() {
  const [members, setMembers] = useState<CmsWorkspaceMember[] | null>(null)
  const [invitations, setInvitations] = useState<CmsInvitation[]>([])
  const [roles, setRoles] = useState<CmsRole[]>([])
  const [busy, setBusy] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const inviteEmailId = useId()
  const inviteRoleId = useId()

  function apply(d: { members: CmsWorkspaceMember[]; invitations: CmsInvitation[]; roles: CmsRole[] }): void {
    setMembers(d.members)
    setInvitations(d.invitations)
    setRoles(d.roles)
  }

  async function refresh(): Promise<void> {
    try {
      apply(await loadTeamData())
    } catch (err) {
      setMembers([])
      toastError(err, 'Could not load the team')
    }
  }

  useEffect(() => {
    let cancelled = false
    void loadTeamData()
      .then((d) => { if (!cancelled) apply(d) })
      .catch((err: unknown) => { if (!cancelled) { setMembers([]); toastError(err, 'Could not load the team') } })
    return () => { cancelled = true }
  }, [])

  const roleOptions = assignableRoles(roles).map((r) => ({ value: r.id, label: r.name, textValue: r.name }))

  async function changeRole(userId: string, roleId: string): Promise<void> {
    setBusy(true)
    try {
      await setWorkspaceMemberRoleCms(userId, roleId)
      await refresh()
    } catch (err) {
      toastError(err, 'Could not change role')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(member: CmsWorkspaceMember): Promise<void> {
    setBusy(true)
    try {
      await removeWorkspaceMemberCms(member.userId)
      pushToast({ kind: 'success', title: 'Member removed', body: `${member.displayName || member.email} was removed.` })
      await refresh()
    } catch (err) {
      toastError(err, 'Could not remove member')
    } finally {
      setBusy(false)
    }
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const email = inviteEmail.trim()
    if (!email || busy) return
    setBusy(true)
    try {
      await createInvitationCms({ email, roleId: inviteRole })
      pushToast({ kind: 'success', title: 'Invitation sent', body: `Invited ${email}.` })
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('member')
      await refresh()
    } catch (err) {
      toastError(err, 'Could not send invitation')
    } finally {
      setBusy(false)
    }
  }

  async function cancelInvite(invitation: CmsInvitation): Promise<void> {
    setBusy(true)
    try {
      await cancelInvitationCms(invitation.id)
      await refresh()
    } catch (err) {
      toastError(err, 'Could not cancel invitation')
    } finally {
      setBusy(false)
    }
  }

  const roleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? roleId

  return (
    <section className={styles.body}>
      <div className={styles.tabHeader}>
        <p className={styles.secondaryText}>People with access to this workspace.</p>
        <Button variant="primary" size="sm" onClick={() => setInviteOpen(true)} disabled={busy}>
          <PlusIcon size={12} aria-hidden="true" />
          <span>Invite member</span>
        </Button>
      </div>

      {members === null ? (
        <div className={styles.skeletonStack}>
          <Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} />
        </div>
      ) : members.length > 0 ? (
        <DataTable aria-label="Members" density="compact">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeader scope="col">Member</DataTableHeader>
              <DataTableHeader scope="col">Role</DataTableHeader>
              <DataTableHeader scope="col" className={styles.actionsHeader}>Actions</DataTableHeader>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {members.map((member) => {
              const isOwner = member.roleId === 'owner'
              return (
                <DataTableRow key={member.userId} aria-label={`Member ${member.email}`}>
                  <DataTableCell>
                    <div className={styles.identity}>
                      <strong>{member.displayName || member.email}</strong>
                      <span>{member.email}</span>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    {isOwner ? (
                      <Badge label="Owner" />
                    ) : (
                      <Select
                        aria-label={`Role for ${member.email}`}
                        value={member.roleId}
                        options={roleOptions}
                        disabled={busy}
                        onChange={(e) => void changeRole(member.userId, e.currentTarget.value)}
                      />
                    )}
                  </DataTableCell>
                  <DataTableCell className={styles.actionsCell}>
                    {!isOwner && (
                      <RowActionMenu
                        triggerLabel={`Actions for ${member.email}`}
                        menuLabel={`Member actions for ${member.email}`}
                        disabled={busy}
                        items={[
                          {
                            label: 'Remove from workspace',
                            icon: <TrashSolidIcon size={12} aria-hidden="true" />,
                            danger: true,
                            onSelect: () => void removeMember(member),
                          },
                        ]}
                      />
                    )}
                  </DataTableCell>
                </DataTableRow>
              )
            })}
          </DataTableBody>
        </DataTable>
      ) : (
        <p className={styles.emptyState}>No members yet.</p>
      )}

      {invitations.length > 0 && (
        <div className={styles.subSection}>
          <h3 className={styles.subHeading}>Pending invitations</h3>
          <DataTable aria-label="Pending invitations" density="compact">
            <DataTableHead>
              <DataTableRow>
                <DataTableHeader scope="col">Email</DataTableHeader>
                <DataTableHeader scope="col">Role</DataTableHeader>
                <DataTableHeader scope="col" className={styles.actionsHeader}>Actions</DataTableHeader>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody>
              {invitations.map((inv) => (
                <DataTableRow key={inv.id} aria-label={`Invitation for ${inv.email}`}>
                  <DataTableCell><strong>{inv.email}</strong></DataTableCell>
                  <DataTableCell><Badge label={roleName(inv.roleId)} muted /></DataTableCell>
                  <DataTableCell className={styles.actionsCell}>
                    <Button variant="ghost" size="xs" onClick={() => void cancelInvite(inv)} disabled={busy}>
                      Cancel
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      )}

      {inviteOpen && (
        <Dialog
          open
          onClose={() => { if (!busy) setInviteOpen(false) }}
          title="Invite a member"
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" form={INVITE_FORM_ID} variant="primary" disabled={busy || !inviteEmail.trim()}>
                {busy ? 'Sending…' : 'Send invitation'}
              </Button>
            </>
          }
        >
          <form id={INVITE_FORM_ID} onSubmit={(e) => void sendInvite(e)} className={styles.inviteForm}>
            <label className={styles.inviteLabel} htmlFor={inviteEmailId}>Email address</label>
            <Input
              id={inviteEmailId}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              autoFocus
              required
              data-testid="invite-email"
            />
            <label className={styles.inviteLabel} htmlFor={inviteRoleId}>Role</label>
            <Select
              id={inviteRoleId}
              value={inviteRole}
              options={roleOptions}
              onChange={(e) => setInviteRole(e.currentTarget.value)}
            />
          </form>
        </Dialog>
      )}
    </section>
  )
}
