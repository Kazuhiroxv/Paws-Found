import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ShieldAlert, UserCog, UserRound, Users } from 'lucide-react'
import { Button, EmptyState, LoadingSkeleton, Select, SidePanel, Textarea } from '@/components/ui'
import { Avatar } from '@/components/Avatar'
import { StatTile } from '@/components/StatTile'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { ADMIN_LEVELS, ADMIN_LEVEL_LABELS, CAPABILITIES, ROLES, ROLE_LABELS, roleLabel } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser'
import { userService } from '@/services'
import { can } from '@/utils/permissions'
import { optionsFromLabels } from '@/utils/options'
import { AccountStatusBadge } from './AdminBadges'
import { parseDateTime } from '@/utils/date'
import { errorText } from '@/i18n/apiErrors'
import { languageInfo, t } from '@/i18n'

/**
 * When an account was created, always with the year: accounts span years, and
 * "Jun 1" beside "Jan 5" does not say which came first.
 */
const joinedOn = (value) =>
  value
    ? parseDateTime(value).toLocaleDateString(languageInfo().locale, { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

async function loadUsers() {
  return { users: await userService.getUsers() }
}

/**
 * What each role can do, so a role change is made with its meaning in view
 * (`admin.users.roleInfo.<role>`), and what each administrator level adds
 * (`admin.users.levelInfo.<level>`; ADMIN_CAPABILITIES in api/helpers.php).
 */

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
  // Who is looking, and what their administrator level lets them change
  // (Correction 6). The server checks every request again.
  const currentUser = useWorkspaceUser()
  const mayManageAdmins = can(currentUser, CAPABILITIES.MANAGE_ADMINS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  // The Overview's "Manage" link arrives as ?status=suspended.
  const [params, setParams] = useSearchParams()
  const statusFilter = params.get('status') ?? ''
  const setStatusFilter = (value) => setParams(value ? { status: value } : {}, { replace: true })
  const [asking, setAsking] = useState(null) // { user, kind: 'role'|'status'|'unlock', role?, level?, reason? }
  const [isBusy, setIsBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  // The account being read. The table shows what fits a row; this is where
  // the rest of it lives, without losing the list behind it.
  const [viewing, setViewing] = useState(null)

  const header = (
    <PageHeader
      icon={Users}
      eyebrow={t('shell.access.eyebrow')}
      title={t('nav.users')}
      description={t('admin.users.description')}
      breadcrumb={[{ label: t('shell.workspace.admin'), to: '/admin' }, { label: t('nav.users') }]}
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
          {t('admin.users.failed', { message: errorText(error) })}
        </p>
      </div>
    )
  }

  const { users } = data
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
        await userService.setUserRole(asking.user.id, asking.role, asking.level)
      } else if (asking.kind === 'unlock') {
        await userService.unlockAccount(asking.user.id)
      } else {
        await userService.setAccountStatus(
          asking.user.id,
          asking.user.accountStatus === 'suspended' ? 'active' : 'suspended',
          asking.reason,
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
          <StatTile icon={Users} label={t('admin.overview.accounts')} value={users.length} />
        </li>
        <li className="contents">
          <StatTile
            icon={UserRound}
            label={t('admin.users.members')}
            value={users.filter((user) => user.role === ROLES.USER).length}
          />
        </li>
        <li className="contents">
          <StatTile
            icon={UserCog}
            label={t('admin.users.staffAdmins')}
            value={users.filter((user) => user.role !== ROLES.USER).length}
          />
        </li>
        <li className="contents">
          <StatTile
            icon={ShieldAlert}
            label={t('admin.users.needAttention')}
            value={users.filter((user) => user.accountStatus !== 'active').length}
          />
        </li>
      </ul>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem_13rem]">
        <label className="relative">
          <span className="sr-only">{t('admin.users.search')}</span>
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.users.placeholder')}
            className="h-10 w-full rounded-control border border-border-strong bg-panel pr-3 pl-9 text-sm text-fg placeholder:text-fg-muted"
          />
        </label>
        <Select
          label={t('admin.users.role')}
          hideLabel
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          options={[{ value: '', label: t('admin.users.anyRole') }, ...optionsFromLabels(ROLE_LABELS)]}
        />
        <Select
          label={t('admin.users.accountStatus')}
          hideLabel
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { value: '', label: t('filters.anyStatus') },
            { value: 'active', label: t('admin.state.account.active') },
            { value: 'suspended', label: t('admin.state.account.suspended') },
            { value: 'locked', label: t('admin.users.lockedOption') },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-fg-muted" aria-live="polite">
          {isFiltering
            ? t('admin.users.countFiltered', { shown: visible.length, total: users.length })
            : t('admin.users.count', { count: users.length })}
        </p>
        {isFiltering && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            {t('staff.reports.clear')}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('admin.users.noMatch')}
          description={t('admin.users.noMatchBody')}
          action={
            <Button variant="secondary" onClick={clearFilters}>
              {t('staff.reports.clear')}
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
                mayManageAdmins={mayManageAdmins}
                onAsk={setAsking}
              />
            ))}
          </ul>

          <div className="hidden rounded-card bg-sunken/60 p-3 lg:block">
            <div className="rounded-card border border-border bg-panel">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-fg shadow-[0_1px_0_var(--color-border)] [&>tr>th:first-child]:rounded-tl-card [&>tr>th:last-child]:rounded-tr-card">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    {t('admin.users.user')}
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    {t('admin.users.role')}
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    {t('filters.status')}
                  </th>
                  <th scope="col" className="px-2 py-2.5 font-medium">
                    {t('admin.users.joined')}
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    {t('detail.actions')}
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
                              {isSelf && <span className="ml-2 text-fg-muted">{t('admin.users.you')}</span>}
                            </p>
                            <p className="break-all text-fg-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-3 text-fg">{roleLabel(user)}</td>

                      <td className="px-2 py-3">
                        <AccountStatusBadge status={user.accountStatus} />
                      </td>

                      <td className="px-2 py-3 whitespace-nowrap text-fg-muted">
                        {joinedOn(user.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <RowActions
                            user={user}
                            isSelf={isSelf}
                            mayManageAdmins={mayManageAdmins}
                            onAsk={setAsking}
                          />
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
        {t('admin.users.ownNote')}{' '}
        {mayManageAdmins ? t('admin.users.superNote') : t('admin.users.otherNote')}
      </p>

      {asking?.kind === 'role' && (
        <RoleDialog
          user={asking.user}
          role={asking.role}
          level={asking.level}
          onPick={(role) => setAsking((current) => ({ ...current, role }))}
          onPickLevel={(level) => setAsking((current) => ({ ...current, level }))}
          onCancel={cancel}
          onConfirm={commit}
          isBusy={isBusy}
          error={actionError}
        />
      )}

      {asking?.kind === 'status' && (
        <StatusDialog
          user={asking.user}
          reason={asking.reason ?? ''}
          onReason={(reason) => setAsking((current) => ({ ...current, reason }))}
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
        eyebrow={t('admin.users.account')}
        title={viewing?.fullName ?? ''}
        onClose={() => setViewing(null)}
      >
        {viewing && (
          <AccountPanel
            user={viewing}
            isSelf={viewing.id === currentUser?.id}
            mayManageAdmins={mayManageAdmins}
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
function AccountPanel({ user, isSelf, mayManageAdmins, onAsk }) {
  const isSuspended = user.accountStatus === 'suspended'
  const isLocked = user.accountStatus === 'locked'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Avatar name={user.fullName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fg-muted">{roleLabel(user)}</p>
          <AccountStatusBadge status={user.accountStatus} className="mt-1.5" />
        </div>
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">{t('auth.email')}</dt>
          <dd className="break-all text-fg">{user.email}</dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">{t('admin.users.phone')}</dt>
          <dd className={user.phone ? 'text-fg' : 'text-fg-subtle'}>
            {user.phone || t('common.notGiven')}
          </dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">{t('admin.users.usuallyIn')}</dt>
          <dd className={user.preferredLocation ? 'text-fg' : 'text-fg-subtle'}>
            {user.preferredLocation || t('common.notGiven')}
          </dd>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <dt className="text-fg-muted">{t('admin.users.joined')}</dt>
          <dd className="text-fg">{joinedOn(user.createdAt)}</dd>
        </div>
      </dl>

      {isSelf ? (
        <p className="rounded-control border border-border bg-sunken px-3 py-2.5 text-sm text-fg-muted">
          {t('admin.users.ownAccount')}
        </p>
      ) : user.role === ROLES.ADMIN && !mayManageAdmins ? (
        <p className="rounded-control border border-border bg-sunken px-3 py-2.5 text-sm text-fg-muted">
          {t('admin.users.adminManaged')}
        </p>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {isLocked && (
            <>
              <Button fullWidth onClick={() => onAsk({ user, kind: 'unlock' })}>
                {t('admin.users.unlockThis')}
              </Button>
              <p className="-mt-1 mb-1 text-sm text-fg-muted">
                {t('admin.users.unlockNote')}
              </p>
            </>
          )}

          {mayManageAdmins && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => onAsk({ user, kind: 'role', role: user.role, level: user.adminLevel })}
            >
              {t('admin.users.changeRoleLevel')}
            </Button>
          )}

          <Button variant="ghost" fullWidth onClick={() => onAsk({ user, kind: 'status' })}>
            {isSuspended ? t('admin.users.reinstateThis') : t('admin.users.suspendThis')}
          </Button>

          <p className="text-sm text-fg-muted">
            {isSuspended
              ? t('admin.users.reinstateNote')
              : t('admin.users.suspendNote')}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * The two management actions. Suspending is destructive, so it reads as one
 * before anybody hovers: an outlined button in danger ink, the same shape as
 * "Change role" beside it. Not filled red, because a column of solid red
 * buttons made the whole table look like a warning. The confirmation dialog
 * behind it is unchanged. The two danger classes are marked important (!):
 * cn() only joins classes, and the button's own text-fg otherwise won, which
 * left a red border around dark text.
 */
function RowActions({ user, isSelf, mayManageAdmins, onAsk }) {
  if (isSelf) {
    return <span className="text-fg-muted">{t('admin.users.yourAccount')}</span>
  }

  // Correction 6: another administrator is a Super Administrator's to manage.
  if (user.role === ROLES.ADMIN && !mayManageAdmins) {
    return <span className="text-fg-muted">{t('admin.users.managedBySuper')}</span>
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
          {t('admin.users.unlock')}
          <span className="sr-only"> {t('admin.users.srAccount', { name: user.fullName })}</span>
        </Button>
      )}
      {mayManageAdmins && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAsk({ user, kind: 'role', role: user.role, level: user.adminLevel })}
        >
          {t('admin.users.changeRole')}
          <span className="sr-only"> {t('admin.users.srFor', { name: user.fullName })}</span>
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        className={isSuspended ? undefined : 'border-danger/45 text-danger-hover! hover:bg-danger-soft!'}
        onClick={() => onAsk({ user, kind: 'status' })}
      >
        {isSuspended ? t('admin.users.reinstate') : t('admin.users.suspend')}
        <span className="sr-only"> {t('admin.users.srAccount', { name: user.fullName })}</span>
      </Button>
    </div>
  )
}

/** One account as a card, for narrower screens. */
function UserCard({ user, isSelf, mayManageAdmins, onAsk }) {
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-panel p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Avatar name={user.fullName} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">
            {user.fullName}
            {isSelf && <span className="ml-2 text-fg-muted">{t('admin.users.you')}</span>}
          </p>
          <p className="text-sm break-all text-fg-muted">{user.email}</p>
        </div>
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="text-fg-muted">{t('admin.users.roleColon')}</dt>
          <dd className="text-fg">{roleLabel(user)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{t('filters.status')}</dt>
          <dd>
            <AccountStatusBadge status={user.accountStatus} />
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-fg-muted">{t('admin.users.joined')}</dt>
          <dd className="text-fg-muted">{joinedOn(user.createdAt)}</dd>
        </div>
      </dl>

      <RowActions user={user} isSelf={isSelf} mayManageAdmins={mayManageAdmins} onAsk={onAsk} />
    </li>
  )
}

function RoleDialog({ user, role, level, onPick, onPickLevel, onCancel, onConfirm, isBusy, error }) {
  const isAdmin = role === ROLES.ADMIN
  // An administrator needs a level chosen on purpose: nobody becomes a Super
  // Administrator by default (the server refuses one without a level too).
  const changed = role !== user.role || (isAdmin && level !== user.adminLevel)
  const ready = changed && (!isAdmin || Boolean(level))
  const target = isAdmin ? (ADMIN_LEVEL_LABELS[level] ?? ROLE_LABELS[role]) : ROLE_LABELS[role]

  return (
    <ConfirmDialog
      isOpen
      title={t('admin.users.roleTitle', { name: user.fullName })}
      confirmLabel={ready ? t('admin.users.make', { target }) : t('admin.users.changeRole')}
      tone="primary"
      confirmDisabled={!ready || isBusy}
      isBusy={isBusy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="text-fg-muted">
        {t('admin.users.roleBody', { name: user.fullName, role: roleLabel(user) })}
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('admin.users.newRole', { name: user.fullName })}</legend>
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
                {value === user.role && <span className="text-fg-muted"> · {t('admin.users.current')}</span>}
              </span>
              <span className="text-fg-muted">{t(`admin.users.roleInfo.${value}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {isAdmin && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-fg">{t('admin.users.levelRequired')}</legend>
          {Object.values(ADMIN_LEVELS).map((value) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-control border border-border p-3 has-checked:border-brand has-checked:bg-brand-soft"
            >
              <input
                type="radio"
                name={`level-${user.id}`}
                value={value}
                checked={level === value}
                onChange={() => onPickLevel(value)}
                className="mt-1 size-4 shrink-0 accent-brand"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-fg">
                  {ADMIN_LEVEL_LABELS[value]}
                  {user.role === ROLES.ADMIN && value === user.adminLevel && (
                    <span className="text-fg-muted"> · {t('admin.users.current')}</span>
                  )}
                </span>
                <span className="text-fg-muted">{t(`admin.users.levelInfo.${value}`)}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
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
      title={t('admin.users.unlockTitle', { name: user.fullName })}
      confirmLabel={t('admin.users.unlockConfirm')}
      tone="primary"
      isBusy={isBusy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="text-fg-muted">
        {user.fullName} · {roleLabel(user)} · {user.email}
      </p>
      <p>{t('admin.users.unlockBody')}</p>
      <p className="text-fg-muted">{t('admin.users.unlockCaution')}</p>
    </ConfirmDialog>
  )
}

function StatusDialog({ user, reason, onReason, onCancel, onConfirm, isBusy, error }) {
  const isSuspended = user.accountStatus === 'suspended'
  // The server refuses a suspension without a reason: it goes in the audit
  // log beside the administrator's name. (Missing here before Correction 6,
  // so Suspend on this page always failed.)
  const needsReason = !isSuspended && reason.trim() === ''

  return (
    <ConfirmDialog
      isOpen
      title={isSuspended ? t('admin.users.reinstateTitle', { name: user.fullName }) : t('admin.users.suspendTitle', { name: user.fullName })}
      confirmLabel={isSuspended ? t('admin.users.reinstateConfirm') : t('admin.users.suspendConfirm')}
      tone={isSuspended ? 'primary' : 'danger'}
      confirmDisabled={needsReason || isBusy}
      isBusy={isBusy}
      error={error}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="text-fg-muted">
        {user.fullName} · {roleLabel(user)} · {user.email}
      </p>
      <p>
        {isSuspended
          ? t('admin.users.reinstateBody')
          : t('admin.users.suspendBody')}
      </p>
      {!isSuspended && (
        <Textarea
          label={t('publication.reason')}
          required
          rows={3}
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          hint={t('admin.users.reasonHint')}
        />
      )}
    </ConfirmDialog>
  )
}
