import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ShieldAlert, UserCog, UserRound, Users } from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton, Select, SidePanel } from '@/components/ui'
import { Avatar } from '@/components/Avatar'
import { StatTile } from '@/components/StatTile'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { ROLES, ROLE_LABELS } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { userService } from '@/services'
import { optionsFromLabels } from '@/utils/options'
import { formatShortDate } from '@/utils/date'
import { AccountStatusBadge } from './AdminBadges'

async function loadUsers() {
  const [users, currentUser] = await Promise.all([
    userService.getUsers(),
    userService.getCurrentUser(),
  ])
  return { users, currentUser }
}

/** What each role can do, so a role change is made with its meaning in view. */
const ROLE_DESCRIPTIONS = {
  [ROLES.USER]: 'Files and manages their own reports. No access to either workspace.',
  [ROLES.STAFF]:
    'Reviews reports and possible matches, decides verifications, and sees both reporters’ contact details.',
  [ROLES.ADMIN]: 'Manages accounts, categories and moderation, including suspending accounts.',
}

/**
 * Account management.
 *
 * An administrator can change someone's role and suspend or reinstate an
 * account — but never their own, so the last administrator cannot lock
 * themselves out of the system. The server enforces that too; hiding the
 * buttons is only the polite half.
 *
 * Both changes go through a confirmation that names the person and says what
 * the change does: they are one click apart in a table of similar-looking rows.
 */
export function AdminUsersPage() {
  const { data, error, isLoading, reload } = useAsync(loadUsers)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  // The Overview's "Manage" link arrives as ?status=suspended.
  const [params, setParams] = useSearchParams()
  const statusFilter = params.get('status') ?? ''
  const setStatusFilter = (value) => setParams(value ? { status: value } : {}, { replace: true })
  const [asking, setAsking] = useState(null) // { user, kind: 'role'|'status'|'unlock', role? }
  const [isBusy, setIsBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  // The account being read. The table shows what fits a row; this is where
  // the rest of it lives, without losing the list behind it.
  const [viewing, setViewing] = useState(null)

  const header = (
    <PageHeader
      icon={Users}
      eyebrow="Administrator"
      title="Users"
      description="Community members, Pet Coordinators and administrators."
      breadcrumb={[{ label: 'Administration', to: '/admin' }, { label: 'Users' }]}
    />
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingSkeleton lines={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p role="alert" className="text-sm text-danger">
          The account list could not be loaded: {error.message}
        </p>
      </div>
    )
  }

  const { users, currentUser } = data
  const needle = search.trim().toLowerCase()
  const isFiltering = Boolean(needle || roleFilter || statusFilter)

  const visible = users.filter((user) => {
    if (roleFilter && user.role !== roleFilter) return false
    if (statusFilter && user.accountStatus !== statusFilter) return false
    if (!needle) return true
    return (
      user.fullName.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
    )
  })

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('')
  }

  const commit = async () => {
    setIsBusy(true)
    setActionError(null)
    try {
      if (asking.kind === 'role') {
        await userService.setUserRole(asking.user.id, asking.role)
      } else if (asking.kind === 'unlock') {
        await userService.unlockAccount(asking.user.id)
      } else {
        await userService.setAccountStatus(
          asking.user.id,
          asking.user.accountStatus === 'suspended' ? 'active' : 'suspended',
        )
      }
      setAsking(null)
      reload()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught : new Error(String(caught)))
    } finally {
      setIsBusy(false)
    }
  }

  const cancel = () => {
    setAsking(null)
    setActionError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {/* Four counts, each one a question an administrator opens this page to
          answer. They are small numbers because the system is small; a count
          of 10 is a fact, not an embarrassment, and hiding it would only mean
          counting the rows by hand.
          
          "Needs attention" is the one that earns its place: suspended and
          locked accounts are the two states somebody is waiting on, and they
          are otherwise three filter clicks apart. */}
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li className="contents">
          <StatTile icon={Users} label="Accounts" value={users.length} />
        </li>
        <li className="contents">
          <StatTile
            icon={UserRound}
            label="Community members"
            value={users.filter((user) => user.role === ROLES.USER).length}
          />
        </li>
        <li className="contents">
          <StatTile
            icon={UserCog}
            label="Coordinators and admins"
            value={users.filter((user) => user.role !== ROLES.USER).length}
          />
        </li>
        <li className="contents">
          <StatTile
            icon={ShieldAlert}
            label="Need attention"
            value={users.filter((user) => user.accountStatus !== 'active').length}
          />
        </li>
      </ul>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <label className="relative">
          <span className="sr-only">Search accounts</span>
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or email"
            className="h-10 w-full rounded-control border border-border-strong bg-panel pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted"
          />
        </label>
        <Select
          label="Role"
          hideLabel
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          options={[{ value: '', label: 'Any role' }, ...optionsFromLabels(ROLE_LABELS)]}
        />
        <Select
          label="Account status"
          hideLabel
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { value: '', label: 'Any status' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'locked', label: 'Locked (failed sign-ins)' },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {isFiltering
            ? `${visible.length} of ${users.length} accounts`
            : `${users.length} ${users.length === 1 ? 'account' : 'accounts'}`}
        </p>
        {isFiltering && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No accounts match"
          description="Try a broader search, or clear the filters."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          {/* Phones and tablets: one management card per account. A five-column
              table squeezed to 390px is unreadable and scrolls sideways. */}
          <ul className="flex flex-col gap-3 rounded-card bg-sunken/60 p-3 lg:hidden">
            {visible.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isSelf={user.id === currentUser?.id}
                onAsk={setAsking}
              />
            ))}
          </ul>

          <div className="hidden rounded-card bg-sunken/60 p-3 lg:block">
            <div className="rounded-card border border-border bg-panel">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-[4.5rem] z-10 border-b border-border bg-surface-muted text-fg shadow-[0_1px_0_var(--color-border)] [&>tr>th:first-child]:rounded-tl-card [&>tr>th:last-child]:rounded-tr-card">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    User
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Role
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    Joined
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border [&>tr:last-child>td:first-child]:rounded-bl-card [&>tr:last-child>td:last-child]:rounded-br-card">
                {visible.map((user) => {
                  const isSelf = user.id === currentUser?.id

                  return (
                    <tr
                      key={user.id}
                      onClick={(event) => {
                        // The row's own buttons open dialogs and must not also
                        // open the panel behind them.
                        if (event.target.closest('button')) return
                        setViewing(user)
                      }}
                      className="cursor-pointer align-middle transition-colors hover:bg-surface"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.fullName} />
                          <div className="min-w-0">
                            <p className="font-medium text-fg">
                              {user.fullName}
                              {isSelf && <span className="ml-2 text-fg-muted">(you)</span>}
                            </p>
                            <p className="break-all text-fg-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-3 text-fg">{ROLE_LABELS[user.role]}</td>

                      <td className="px-2 py-3">
                        <AccountStatusBadge status={user.accountStatus} />
                      </td>

                      <td className="px-2 py-3 whitespace-nowrap text-fg-muted">
                        {formatShortDate(user.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <RowActions user={user} isSelf={isSelf} onAsk={setAsking} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      <p className="text-sm text-fg-muted">
        You cannot change your own role or suspend your own account — that is how an
        administrator locks themselves out.
      </p>

      {asking?.kind === 'role' && (
        <RoleDialog
          user={asking.user}
          role={asking.role}
          onPick={(role) => setAsking((current) => ({ ...current, role }))}
          onCancel={cancel}
          onConfirm={commit}
          isBusy={isBusy}
          error={actionError}
        />
      )}

      {asking?.kind === 'status' && (
        <StatusDialog
          user={asking.user}
          onCancel={cancel}
          onConfirm={commit}
          isBusy={isBusy}
          error={actionError}
        />
      )}

      {asking?.kind === 'unlock' && (
        <UnlockDialog
          user={asking.user}
          onCancel={cancel}
          onConfirm={commit}
          isBusy={isBusy}
          error={actionError}
        />
      )}

      {/* Reading an account does not interrupt the list. Acting on one still
          does — every button in here opens the same confirmation the table
          does, on top of the panel. */}
      <SidePanel
        isOpen={Boolean(viewing)}
        eyebrow="Account"
        title={viewing?.fullName ?? ''}
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <AccountPanel
            user={viewing}
            isSelf={viewing.id === currentUser?.id}
            onAsk={setAsking}
          />
        )}
      </SidePanel>
    </div>
  )
}

/**
 * One account, read in full beside the table.
 *
 * The two fields the table has no room for — the phone number and where they
 * usually are — plus the same three actions the row offers, with the sentence
 * of explanation a button in a table cell cannot carry.
 */
function AccountPanel({ user, isSelf, onAsk }) {
  const isSuspended = user.accountStatus === 'suspended'
  const isLocked = user.accountStatus === 'locked'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Avatar name={user.fullName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg-muted">{ROLE_LABELS[user.role]}</p>
          <AccountStatusBadge status={user.accountStatus} className="mt-1.5" />
        </div>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">Email</dt>
          <dd className="break-all text-fg">{user.email}</dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">Phone</dt>
          <dd className={user.phone ? 'text-fg' : 'text-fg-subtle'}>
            {user.phone || 'Not given'}
          </dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">Usually in</dt>
          <dd className={user.preferredLocation ? 'text-fg' : 'text-fg-subtle'}>
            {user.preferredLocation || 'Not given'}
          </dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">Joined</dt>
          <dd className="text-fg">{formatShortDate(user.createdAt)}</dd>
        </div>
      </dl>

      {isSelf ? (
        <p className="rounded-control border border-border bg-sunken px-3 py-2.5 text-sm text-fg-muted">
          This is your own account. An administrator cannot change their own role or suspend
          themselves — that is how the last administrator locks everyone out.
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {isLocked && (
            <>
              <Button fullWidth onClick={() => onAsk({ user, kind: 'unlock' })}>
                Unlock this account
              </Button>
              <p className="-mt-1 mb-1 text-sm text-fg-muted">
                Locked after three failed sign-in attempts. Unlocking gives them three more.
              </p>
            </>
          )}

          <Button
            variant="secondary"
            fullWidth
            onClick={() => onAsk({ user, kind: 'role', role: user.role })}
          >
            Change role
          </Button>

          <Button variant="ghost" fullWidth onClick={() => onAsk({ user, kind: 'status' })}>
            {isSuspended ? 'Reinstate this account' : 'Suspend this account'}
          </Button>

          <p className="text-sm text-fg-muted">
            {isSuspended
              ? 'Reinstating lets them sign in again. Their reports were never affected.'
              : 'Suspending stops them signing in, on every device, straight away. Their reports stay visible.'}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * The two management actions. Suspending is destructive, so it is a quiet
 * button that only turns red on hover or focus — a column of red buttons made
 * the whole table look like a warning.
 */
function RowActions({ user, isSelf, onAsk }) {
  if (isSelf) {
    return <span className="text-fg-muted">This is your account</span>
  }

  const isSuspended = user.accountStatus === 'suspended'
  const isLocked = user.accountStatus === 'locked'

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {/* Unlocking comes first and is the only filled button in the row: on a
          locked account it is the thing that needs doing, and somebody is
          probably waiting on the other end of a telephone. */}
      {isLocked && (
        <Button size="sm" onClick={() => onAsk({ user, kind: 'unlock' })}>
          Unlock
          <span className="sr-only"> {user.fullName}’s account</span>
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onAsk({ user, kind: 'role', role: user.role })}
      >
        Change role
        <span className="sr-only"> for {user.fullName}</span>
      </Button>
      <Button
        size="sm"
        variant={isSuspended ? 'secondary' : 'ghost'}
        className={isSuspended ? undefined : 'text-fg-muted hover:bg-danger-soft hover:text-danger-hover focus-visible:bg-danger-soft focus-visible:text-danger-hover'}
        onClick={() => onAsk({ user, kind: 'status' })}
      >
        {isSuspended ? 'Reinstate' : 'Suspend'}
        <span className="sr-only"> {user.fullName}’s account</span>
      </Button>
    </div>
  )
}

/** One account as a card, for narrower screens. */
function UserCard({ user, isSelf, onAsk }) {
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-panel p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar name={user.fullName} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">
            {user.fullName}
            {isSelf && <span className="ml-2 text-fg-muted">(you)</span>}
          </p>
          <p className="text-sm break-all text-fg-muted">{user.email}</p>
        </div>
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="text-fg-muted">Role:</dt>
          <dd className="text-fg">{ROLE_LABELS[user.role]}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Status</dt>
          <dd>
            <AccountStatusBadge status={user.accountStatus} />
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-fg-muted">Joined</dt>
          <dd className="text-fg-muted">{formatShortDate(user.createdAt)}</dd>
        </div>
      </dl>

      <RowActions user={user} isSelf={isSelf} onAsk={onAsk} />
    </li>
  )
}

function RoleDialog({ user, role, onPick, onCancel, onConfirm, isBusy, error }) {
  const changed = role !== user.role

  return (
    <ConfirmDialog
      isOpen
      title={`Change ${user.fullName}’s role?`}
      confirmLabel={changed ? `Make ${ROLE_LABELS[role]}` : 'Change role'}
      tone="primary"
      confirmDisabled={!changed || isBusy}
      isBusy={isBusy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="text-fg-muted">
        {user.fullName} is currently {ROLE_LABELS[user.role]}. A role decides what someone can
        reach, and the change takes effect on their very next request — on every device they are
        signed in on, without them signing out and in again. Their screens catch up within a few
        seconds, and they are told the role changed.
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">New role for {user.fullName}</legend>
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <label
            key={value}
            className="flex cursor-pointer gap-3 rounded-control border border-border p-3 has-checked:border-brand has-checked:bg-brand-soft"
          >
            <input
              type="radio"
              name={`role-${user.id}`}
              value={value}
              checked={role === value}
              onChange={() => onPick(value)}
              className="mt-1 size-4 shrink-0 accent-brand"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium text-fg">
                {label}
                {value === user.role && <span className="text-fg-muted"> · current</span>}
              </span>
              <span className="text-fg-muted">{ROLE_DESCRIPTIONS[value]}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </ConfirmDialog>
  )
}

/**
 * Unlocking an account after three failed sign-in attempts.
 *
 * Says what it does and what it does not do, because the two are easy to
 * confuse: the person gets their three attempts back, but nobody has changed
 * their password, and if they still do not know it they will be back here in a
 * minute. Saying so is cheaper than the telephone call.
 */
function UnlockDialog({ user, onCancel, onConfirm, isBusy, error }) {
  return (
    <ConfirmDialog
      isOpen
      title={`Unlock ${user.fullName}’s account?`}
      confirmLabel="Unlock account"
      tone="primary"
      isBusy={isBusy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="text-fg-muted">
        {user.fullName} · {ROLE_LABELS[user.role]} · {user.email}
      </p>
      <p>
        This account locked itself after three failed sign-in attempts. Unlocking sets it back to
        active and clears the counter, so they have three attempts again.
      </p>
      <p className="text-fg-muted">
        It does not change their password. Check that you are speaking to the account holder
        before you do this — three failures may have been somebody else trying to guess it.
      </p>
    </ConfirmDialog>
  )
}

function StatusDialog({ user, onCancel, onConfirm, isBusy, error }) {
  const isSuspended = user.accountStatus === 'suspended'

  return (
    <ConfirmDialog
      isOpen
      title={isSuspended ? `Reinstate ${user.fullName}?` : `Suspend ${user.fullName}?`}
      confirmLabel={isSuspended ? 'Reinstate account' : 'Suspend account'}
      tone={isSuspended ? 'primary' : 'danger'}
      isBusy={isBusy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="text-fg-muted">
        {user.fullName} · {ROLE_LABELS[user.role]} · {user.email}
      </p>
      <p>
        {isSuspended
          ? 'They will be able to sign in again and use their account as before. Their reports are untouched either way.'
          : 'They will not be able to sign in until an administrator reinstates them. Reports they have already filed stay in the system and stay visible.'}
      </p>
    </ConfirmDialog>
  )
}
