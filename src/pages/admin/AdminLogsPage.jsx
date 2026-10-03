import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import { Button, EmptyState, Input, LoadingSkeleton, Select } from '@/components/ui'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { ROLE_LABELS } from '@/constants'
import { useAsync } from '@/hooks/useAsync'
import { logService } from '@/services'
import { cn } from '@/utils/cn'
import { parseDateTime } from '@/utils/date'

/**
 * The three logs an administrator can read (Correction 5). Each answers one
 * question; docs/security-activity-logging.md says why they are separate.
 */
const TABS = [
  { id: 'activity', label: 'Activity', hint: 'Where signed-in people went and what they did.' },
  { id: 'sessions', label: 'Sessions', hint: 'Each sign-in: the account, its IP address and browser, when it started and ended.' },
  { id: 'security', label: 'Security events', hint: 'Sign-ins, failed attempts, locks, password resets, role and account changes.' },
]

const LOADERS = {
  activity: logService.getActivityLog,
  sessions: logService.getSessionLog,
  security: logService.getAuditLog,
}

/** What each recorded action means, in words (ACTIVITY_ACTIONS in api/helpers.php). */
const ACTIVITY_LABELS = {
  page_view: 'Opened a page',
  login: 'Signed in',
  logout: 'Signed out',
  profile_updated: 'Updated their profile',
  email_change_requested: 'Asked to change their email',
  draft_saved: 'Saved a draft',
  draft_updated: 'Updated a draft',
  draft_deleted: 'Deleted a draft',
  report_submitted: 'Submitted a report for review',
  report_edited: 'Edited a report',
  report_photos_added: 'Added photographs',
  report_photos_changed: 'Changed photographs',
  report_status_changed: 'Changed a report’s status',
  report_approved: 'Approved a report',
  report_rejected: 'Did not approve a report',
  report_resubmitted: 'Submitted a report again',
  report_removed: 'Removed a report',
  match_request_verification: 'Asked for a match to be verified',
  match_dismiss: 'Said a match is not their pet',
  match_reject: 'Ruled out a match',
  match_request_information: 'Asked for more information',
  match_provide_information: 'Provided information',
  match_confirm: 'Confirmed a match',
  match_reopen: 'Reopened a match',
  report_flagged: 'Flagged a report',
  moderation_decided: 'Decided a moderation case',
  notification_read: 'Read a notification',
  notifications_all_read: 'Marked all notifications read',
  account_status_changed: 'Changed an account’s status',
  role_changed: 'Changed an account’s role',
  category_changed: 'Changed a pet category',
}

/** audit_logs.action, in words. */
const AUDIT_LABELS = {
  login: 'Signed in',
  login_failed: 'Failed sign-in',
  account_locked: 'Account locked',
  account_unlocked: 'Account unlocked',
  logout: 'Signed out',
  register: 'Account created',
  role_changed: 'Role changed',
  account_suspended: 'Account suspended',
  account_reinstated: 'Account reinstated',
  report_status_changed: 'Report status changed',
  match_decided: 'Match decided',
  moderation_resolved: 'Moderation decided',
  category_changed: 'Category changed',
  email_verified: 'Email verified',
  email_change_completed: 'Email changed',
  password_reset: 'Password reset',
  report_reviewed: 'Report reviewed',
  report_removed: 'Report removed',
}

/** user_sessions.end_reason, in words. */
const END_REASONS = {
  logout: 'Signed out',
  idle_timeout: 'Expired: inactive',
  absolute_timeout: 'Expired: time limit',
  password_reset: 'Password changed',
  new_privileged_login: 'Signed in on another device',
  role_promoted: 'Access level changed',
  account_locked: 'Account locked',
  account_suspended: 'Account suspended',
}

/** The filters each log takes, as the API names them. */
const FILTERS = {
  activity: ['user', 'action', 'ip', 'route', 'session', 'from', 'to'],
  sessions: ['user', 'state', 'ip', 'session', 'from', 'to'],
  security: ['user', 'action', 'outcome', 'ip', 'from', 'to'],
}

/**
 * The administrator's log viewer.
 *
 * Everything is filtered and paged by the API — the logs grow with every page
 * anybody opens, so the browser is only ever sent one page. The filters live
 * in the address, so "this session's activity" is a link like any other.
 *
 * Administrators only, for now; which administrators may read it is the next
 * correction's question (administrator privilege levels).
 */
export function AdminLogsPage() {
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const tab = tabFrom(params.get('tab'))

  const load = useCallback(() => {
    const { tab: requested, ...filters } = Object.fromEntries(new URLSearchParams(query))
    return LOADERS[tabFrom(requested)](filters)
  }, [query])
  const { data, error, isLoading } = useAsync(load)

  /** Show `tab` with these filters, from page one. */
  const show = (nextTab, filters = {}) => {
    const next = { tab: nextTab }
    for (const [key, value] of Object.entries(filters)) {
      if (value) next[key] = value
    }
    setParams(next)
  }
  const current = Object.fromEntries(FILTERS[tab].map((key) => [key, params.get(key) ?? '']))
  const narrow = (key, value) => show(tab, { ...current, [key]: value })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ScrollText}
        eyebrow="Administrator"
        title="Logs"
        description="Who signed in, from which address, where they went and what they did. Newest first."
        breadcrumb={[{ label: 'Administration', to: '/admin' }, { label: 'Logs' }]}
      />

      <p className="rounded-control border border-border bg-sunken/70 px-3 py-2 text-sm text-fg-muted">
        IP addresses and browser details are personal information. They are shown here for security
        and administration; avoid putting this page on a projector in front of people it does not
        concern.
      </p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Log">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="logs-panel"
            onClick={() => show(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-sm transition-colors',
              tab === item.id
                ? 'border-brand-soft bg-brand-soft font-medium text-brand-hover'
                : 'border-border-strong bg-panel text-fg-muted hover:text-fg',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div id="logs-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">{TABS.find((item) => item.id === tab).hint}</p>

        {/* Keyed on the address, so a filter set by clicking an IP or a
            session in the table shows up in the form too. */}
        <FilterForm key={query} tab={tab} initial={current} onApply={(filters) => show(tab, filters)} />

        {isLoading ? (
          <LoadingSkeleton lines={6} />
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            The log could not be loaded: {error.message}
          </p>
        ) : data.rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded matches"
            description="Try a wider date range, or clear the filters."
            action={
              <Button variant="secondary" onClick={() => show(tab)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-sm text-fg-muted" aria-live="polite">
              Showing {(data.page - 1) * data.perPage + 1}–{(data.page - 1) * data.perPage + data.rows.length} of{' '}
              {data.total}, newest first
            </p>

            <div className="overflow-x-auto rounded-card border border-border bg-panel">
              {tab === 'activity' && <ActivityTable rows={data.rows} narrow={narrow} show={show} />}
              {tab === 'sessions' && <SessionTable rows={data.rows} narrow={narrow} show={show} />}
              {tab === 'security' && <SecurityTable rows={data.rows} narrow={narrow} />}
            </div>

            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onChange={(page) => setParams({ ...Object.fromEntries(params), page: String(page) })}
            />
          </>
        )}
      </div>
    </div>
  )
}

function tabFrom(value) {
  return TABS.some((item) => item.id === value) ? value : 'activity'
}

/** The filters for one log. Applied on submit, not on every keystroke. */
function FilterForm({ tab, initial, onApply }) {
  const [form, setForm] = useState(initial)
  const set = (key) => (event) => setForm((now) => ({ ...now, [key]: event.target.value }))
  const has = (key) => FILTERS[tab].includes(key)

  const actionOptions =
    tab === 'activity'
      ? [
          { value: '', label: 'Everything' },
          { value: 'actions', label: 'Actions only (no page views)' },
          ...Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label })),
        ]
      : [{ value: '', label: 'Any event' }, ...Object.entries(AUDIT_LABELS).map(([value, label]) => ({ value, label }))]

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onApply(form)
      }}
      className="grid gap-3 rounded-card border border-border bg-panel p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Input label="Person" placeholder="Name or email" value={form.user} onChange={set('user')} />
      {has('action') && (
        <Select label={tab === 'activity' ? 'What' : 'Event'} value={form.action} onChange={set('action')} options={actionOptions} />
      )}
      {has('state') && (
        <Select
          label="State"
          value={form.state}
          onChange={set('state')}
          options={[
            { value: '', label: 'Any' },
            { value: 'open', label: 'Open' },
            { value: 'ended', label: 'Ended' },
            { value: 'expired', label: 'Expired, no sign-out recorded' },
          ]}
        />
      )}
      {has('outcome') && (
        <Select
          label="Outcome"
          value={form.outcome}
          onChange={set('outcome')}
          options={[
            { value: '', label: 'Any' },
            { value: 'success', label: 'Succeeded' },
            { value: 'failure', label: 'Failed' },
          ]}
        />
      )}
      <Input label="IP address" placeholder="e.g. 203.0.113.7" value={form.ip} onChange={set('ip')} />
      {has('route') && <Input label="Page" placeholder="e.g. /pet/12 or /staff" value={form.route} onChange={set('route')} />}
      {has('session') && <Input label="Session" placeholder="Session reference" value={form.session} onChange={set('session')} />}
      <Input label="From" type="date" value={form.from} onChange={set('from')} />
      <Input label="To" type="date" value={form.to} onChange={set('to')} />
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit">Apply filters</Button>
        <Button type="button" variant="ghost" onClick={() => onApply({})}>
          Clear
        </Button>
      </div>
    </form>
  )
}

const th = 'px-3 py-2.5 text-left font-medium whitespace-nowrap'
const td = 'px-3 py-2.5 align-top'

function Head({ columns }) {
  return (
    <thead className="border-b border-border bg-surface-muted text-fg">
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col" className={th}>
            {column}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function ActivityTable({ rows, narrow, show }) {
  return (
    <table className="w-full min-w-[56rem] text-sm">
      <Head columns={['When', 'Person', 'What', 'Page or item', 'IP address', 'Session']} />
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.activity_id}>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.created_at)}</td>
            <td className={td}>
              <Person person={row.user} onPick={() => narrow('user', row.user.email)} />
            </td>
            <td className={td}>
              <span className="text-fg">{ACTIVITY_LABELS[row.action] ?? row.action}</span>
              {row.detail && <span className="block text-xs text-fg-muted">{row.detail}</span>}
            </td>
            <td className={cn(td, 'text-fg-muted')}>
              <Target route={row.route} type={row.target_type} id={row.target_id} />
            </td>
            <td className={td}>
              <Ip value={row.ip_address} onPick={() => narrow('ip', row.ip_address)} />
            </td>
            <td className={td}>
              <Reference value={row.session_reference} onPick={() => show('sessions', { session: row.session_reference })} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SessionTable({ rows, narrow, show }) {
  return (
    <table className="w-full min-w-[64rem] text-sm">
      <Head columns={['Person', 'Session', 'IP address', 'Browser', 'Started', 'Last seen', 'Ended']} />
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.session_reference}>
            <td className={td}>
              <Person person={row.user} onPick={() => narrow('user', row.user.email)} />
            </td>
            <td className={td}>
              <Reference value={row.session_reference} onPick={() => show('activity', { session: row.session_reference })} />
              <span className="block text-xs text-fg-muted">
                {row.activity_count} {row.activity_count === 1 ? 'entry' : 'entries'}
              </span>
            </td>
            <td className={td}>
              <Ip value={row.ip_address} onPick={() => narrow('ip', row.ip_address)} />
            </td>
            <td className={cn(td, 'max-w-[16rem] text-xs text-fg-muted')}>
              <span className="line-clamp-2 break-words" title={row.user_agent ?? ''}>
                {row.user_agent ?? 'Not given'}
              </span>
            </td>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.started_at)}</td>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.last_seen_at)}</td>
            <td className={td}>
              {row.state === 'ended' ? (
                <>
                  <span className="text-fg">{END_REASONS[row.end_reason] ?? 'Ended'}</span>
                  <span className="block text-xs whitespace-nowrap text-fg-muted">{formatLogTime(row.ended_at)}</span>
                </>
              ) : row.state === 'expired' ? (
                <span className="text-fg-muted">Expired, no sign-out recorded</span>
              ) : (
                <span className="font-medium text-brand-hover">Open</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SecurityTable({ rows, narrow }) {
  return (
    <table className="w-full min-w-[56rem] text-sm">
      <Head columns={['When', 'Event', 'Account', 'Concerning', 'Detail', 'IP address']} />
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.audit_id}>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.created_at)}</td>
            <td className={td}>
              <span className={row.outcome === 'failure' ? 'font-medium text-danger' : 'text-fg'}>
                {AUDIT_LABELS[row.action] ?? row.action}
              </span>
              {row.outcome === 'failure' && <span className="block text-xs text-fg-muted">Failed</span>}
            </td>
            <td className={td}>
              {row.actor.full_name || row.actor.email ? (
                <button
                  type="button"
                  onClick={() => narrow('user', row.actor.email ?? row.actor.full_name)}
                  className="text-left hover:underline"
                >
                  <span className="block text-fg">{row.actor.full_name ?? 'Not signed in'}</span>
                  {row.actor.email && <span className="block text-xs text-fg-muted">{row.actor.email}</span>}
                </button>
              ) : (
                <span className="text-fg-muted">Nobody signed in</span>
              )}
            </td>
            <td className={cn(td, 'text-fg-muted')}>
              <Target type={row.target_type} id={row.target_id} />
            </td>
            <td className={cn(td, 'max-w-[18rem] text-fg-muted')}>{row.detail ?? '—'}</td>
            <td className={td}>
              <Ip value={row.ip_address} onPick={() => narrow('ip', row.ip_address)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** A name that filters the log to that person when pressed. */
function Person({ person, onPick }) {
  return (
    <button type="button" onClick={onPick} className="text-left hover:underline" title="Show only this person">
      <span className="block text-fg">{person.full_name}</span>
      <span className="block text-xs text-fg-muted">
        {person.email} · {ROLE_LABELS[person.role] ?? person.role}
      </span>
    </button>
  )
}

function Ip({ value, onPick }) {
  if (!value) return <span className="text-fg-muted">Not recorded</span>

  return (
    <button type="button" onClick={onPick} className="font-mono text-xs text-fg hover:underline" title="Show only this address">
      {value}
    </button>
  )
}

/** A session reference, shortened as it is read aloud: the first eight characters. */
function Reference({ value, onPick }) {
  if (!value) return <span className="text-xs text-fg-muted">Before session records</span>

  return (
    <button type="button" onClick={onPick} className="font-mono text-xs text-brand hover:underline" title={value}>
      {value.slice(0, 8)}…
    </button>
  )
}

/** Where it happened: a page, or the thing acted on. A report links to it. */
function Target({ route, type, id }) {
  if (type === 'report' && id) {
    return (
      <span>
        {route && <span className="block font-mono text-xs">{route}</span>}
        <Link to={`/pet/${id}`} className="text-brand hover:underline">
          Report {id}
        </Link>
      </span>
    )
  }
  if (route) return <span className="font-mono text-xs">{route}</span>
  if (type && id) return <span>{`${type.replace('_', ' ')} ${id}`}</span>
  return <span>—</span>
}

/** Date and time to the second, in the viewer's own time: a log is read by the second. */
function formatLogTime(value) {
  if (!value) return ''
  const date = parseDateTime(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}
