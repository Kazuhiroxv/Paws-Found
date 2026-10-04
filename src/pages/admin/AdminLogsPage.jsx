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
import { errorText } from '@/i18n/apiErrors'
import { hasKey, languageInfo, t } from '@/i18n'

/**
 * The three logs an administrator can read (Correction 5). Each answers one
 * question; docs/security-activity-logging.md says why they are separate.
 * Their names and hints are `admin.logs.tabs.<id>` and `<id>Hint`.
 */
const TABS = ['activity', 'sessions', 'security']

const LOADERS = {
  activity: logService.getActivityLog,
  sessions: logService.getSessionLog,
  security: logService.getAuditLog,
}

/**
 * What each recorded action means, in words: `admin.logs.activity.<action>`
 * (ACTIVITY_ACTIONS in api/helpers.php), `admin.logs.audit.<action>`
 * (audit_logs.action) and `admin.logs.ended.<reason>` (user_sessions.end_reason).
 * An action without words is shown as stored.
 */
const ACTIVITY_ACTIONS = [
  'page_view', 'login', 'logout', 'profile_updated', 'email_change_requested', 'privacy_notice_acknowledged',
  'draft_saved', 'draft_updated', 'draft_deleted', 'report_submitted', 'report_edited',
  'report_photos_added', 'report_photos_changed', 'report_status_changed', 'report_approved',
  'report_rejected', 'report_resubmitted', 'report_removed', 'match_request_verification',
  'match_dismiss', 'match_reject', 'match_request_information', 'match_provide_information',
  'match_confirm', 'match_reopen', 'report_flagged', 'moderation_decided', 'notification_read',
  'notifications_all_read', 'account_status_changed', 'role_changed', 'admin_level_changed', 'category_changed',
]

const AUDIT_ACTIONS = [
  'login', 'login_failed', 'account_locked', 'account_unlocked', 'logout', 'register', 'role_changed',
  'account_suspended', 'account_reinstated', 'report_status_changed', 'match_decided',
  'moderation_resolved', 'category_changed', 'email_verified', 'email_change_completed',
  'password_reset', 'report_reviewed', 'report_removed',
]

const words = (group, value) => (hasKey(`admin.logs.${group}.${value}`) ? t(`admin.logs.${group}.${value}`) : value)

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
        eyebrow={t('shell.access.eyebrow')}
        title={t('nav.logs')}
        description={t('admin.logs.description')}
        breadcrumb={[{ label: t('shell.workspace.admin'), to: '/admin' }, { label: t('nav.logs') }]}
      />

      <p className="rounded-control border border-border bg-sunken/70 px-3 py-2 text-sm text-fg-muted">
        {t('admin.logs.privacy')}
      </p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('admin.logs.log')}>
        {TABS.map((id) => ({ id })).map((item) => (
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
            {t(`admin.logs.tabs.${item.id}`)}
          </button>
        ))}
      </div>

      <div id="logs-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">{t(`admin.logs.tabs.${tab}Hint`)}</p>

        {/* Keyed on the address, so a filter set by clicking an IP or a
            session in the table shows up in the form too. */}
        <FilterForm key={query} tab={tab} initial={current} onApply={(filters) => show(tab, filters)} />

        {isLoading ? (
          <LoadingSkeleton lines={6} />
        ) : error ? (
          <p role="alert" className="text-sm text-danger">
            {t('admin.logs.failed', { message: errorText(error) })}
          </p>
        ) : data.rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t('admin.logs.noMatch')}
            description={t('admin.logs.noMatchBody')}
            action={
              <Button variant="secondary" onClick={() => show(tab)}>
                {t('staff.reports.clear')}
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-sm text-fg-muted" aria-live="polite">
              {t('admin.logs.showing', {
                from: (data.page - 1) * data.perPage + 1,
                to: (data.page - 1) * data.perPage + data.rows.length,
                total: data.total,
              })}
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
  return TABS.includes(value) ? value : 'activity'
}

/** The filters for one log. Applied on submit, not on every keystroke. */
function FilterForm({ tab, initial, onApply }) {
  const [form, setForm] = useState(initial)
  const set = (key) => (event) => setForm((now) => ({ ...now, [key]: event.target.value }))
  const has = (key) => FILTERS[tab].includes(key)

  const actionOptions =
    tab === 'activity'
      ? [
          { value: '', label: t('admin.logs.everything') },
          { value: 'actions', label: t('admin.logs.actionsOnly') },
          ...ACTIVITY_ACTIONS.map((value) => ({ value, label: words('activity', value) })),
        ]
      : [{ value: '', label: t('admin.logs.anyEvent') }, ...AUDIT_ACTIONS.map((value) => ({ value, label: words('audit', value) }))]

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onApply(form)
      }}
      className="grid gap-3 rounded-card border border-border bg-panel p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Input label={t('admin.logs.person')} placeholder={t('admin.users.placeholder')} value={form.user} onChange={set('user')} />
      {has('action') && (
        <Select label={tab === 'activity' ? t('admin.logs.what') : t('admin.logs.event')} value={form.action} onChange={set('action')} options={actionOptions} />
      )}
      {has('state') && (
        <Select
          label={t('admin.logs.state')}
          value={form.state}
          onChange={set('state')}
          options={[
            { value: '', label: t('admin.logs.any') },
            { value: 'open', label: t('admin.logs.open') },
            { value: 'ended', label: t('admin.logs.endedState') },
            { value: 'expired', label: t('admin.logs.expired') },
          ]}
        />
      )}
      {has('outcome') && (
        <Select
          label={t('admin.logs.outcome')}
          value={form.outcome}
          onChange={set('outcome')}
          options={[
            { value: '', label: t('admin.logs.any') },
            { value: 'success', label: t('admin.logs.succeeded') },
            { value: 'failure', label: t('admin.logs.failedOutcome') },
          ]}
        />
      )}
      <Input label={t('admin.logs.ip')} placeholder={t('admin.logs.ipPlaceholder')} value={form.ip} onChange={set('ip')} />
      {has('route') && <Input label={t('admin.logs.page')} placeholder={t('admin.logs.pagePlaceholder')} value={form.route} onChange={set('route')} />}
      {has('session') && <Input label={t('admin.logs.session')} placeholder={t('admin.logs.sessionPlaceholder')} value={form.session} onChange={set('session')} />}
      <Input label={t('filters.from')} type="date" value={form.from} onChange={set('from')} />
      <Input label={t('filters.to')} type="date" value={form.to} onChange={set('to')} />
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit">{t('admin.logs.apply')}</Button>
        <Button type="button" variant="ghost" onClick={() => onApply({})}>
          {t('admin.logs.clear')}
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
      <Head columns={[t('admin.logs.when'), t('admin.logs.person'), t('admin.logs.what'), t('admin.logs.pageOrItem'), t('admin.logs.ip'), t('admin.logs.session')]} />
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.activity_id}>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.created_at)}</td>
            <td className={td}>
              <Person person={row.user} onPick={() => narrow('user', row.user.email)} />
            </td>
            <td className={td}>
              <span className="text-fg">{words('activity', row.action)}</span>
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
      <Head
        columns={[
          t('admin.logs.person'),
          t('admin.logs.session'),
          t('admin.logs.ip'),
          t('admin.logs.browser'),
          t('admin.logs.started'),
          t('detail.lastSeen'),
          t('admin.logs.endedState'),
        ]}
      />
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.session_reference}>
            <td className={td}>
              <Person person={row.user} onPick={() => narrow('user', row.user.email)} />
            </td>
            <td className={td}>
              <Reference value={row.session_reference} onPick={() => show('activity', { session: row.session_reference })} />
              <span className="block text-xs text-fg-muted">
                {t('admin.logs.entries', { count: row.activity_count })}
              </span>
            </td>
            <td className={td}>
              <Ip value={row.ip_address} onPick={() => narrow('ip', row.ip_address)} />
            </td>
            <td className={cn(td, 'max-w-[16rem] text-xs text-fg-muted')}>
              <span className="line-clamp-2 break-words" title={row.user_agent ?? ''}>
                {row.user_agent ?? t('common.notGiven')}
              </span>
            </td>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.started_at)}</td>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.last_seen_at)}</td>
            <td className={td}>
              {row.state === 'ended' ? (
                <>
                  <span className="text-fg">{row.end_reason ? words('ended', row.end_reason) : t('admin.logs.endedState')}</span>
                  <span className="block text-xs whitespace-nowrap text-fg-muted">{formatLogTime(row.ended_at)}</span>
                </>
              ) : row.state === 'expired' ? (
                <span className="text-fg-muted">{t('admin.logs.expired')}</span>
              ) : (
                <span className="font-medium text-brand-hover">{t('admin.logs.open')}</span>
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
      <Head
        columns={[
          t('admin.logs.when'),
          t('admin.logs.event'),
          t('admin.users.account'),
          t('admin.logs.concerning'),
          t('admin.logs.detail'),
          t('admin.logs.ip'),
        ]}
      />
      <tbody className="divide-y divide-border">
        {rows.map((row) => (
          <tr key={row.audit_id}>
            <td className={cn(td, 'whitespace-nowrap text-fg-muted')}>{formatLogTime(row.created_at)}</td>
            <td className={td}>
              <span className={row.outcome === 'failure' ? 'font-medium text-danger' : 'text-fg'}>
                {words('audit', row.action)}
              </span>
              {row.outcome === 'failure' && <span className="block text-xs text-fg-muted">{t('admin.logs.failedOutcome')}</span>}
            </td>
            <td className={td}>
              {row.actor.full_name || row.actor.email ? (
                <button
                  type="button"
                  onClick={() => narrow('user', row.actor.email ?? row.actor.full_name)}
                  className="text-left hover:underline"
                >
                  <span className="block text-fg">{row.actor.full_name ?? t('admin.logs.notSignedIn')}</span>
                  {row.actor.email && <span className="block text-xs text-fg-muted">{row.actor.email}</span>}
                </button>
              ) : (
                <span className="text-fg-muted">{t('admin.logs.nobody')}</span>
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
    <button type="button" onClick={onPick} className="text-left hover:underline" title={t('admin.logs.onlyPerson')}>
      <span className="block text-fg">{person.full_name}</span>
      <span className="block text-xs text-fg-muted">
        {person.email} · {ROLE_LABELS[person.role] ?? person.role}
      </span>
    </button>
  )
}

function Ip({ value, onPick }) {
  if (!value) return <span className="text-fg-muted">{t('admin.logs.notRecorded')}</span>

  return (
    <button type="button" onClick={onPick} className="font-mono text-xs text-fg hover:underline" title={t('admin.logs.onlyAddress')}>
      {value}
    </button>
  )
}

/** A session reference, shortened as it is read aloud: the first eight characters. */
function Reference({ value, onPick }) {
  if (!value) return <span className="text-xs text-fg-muted">{t('admin.logs.beforeSessions')}</span>

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
          {t('admin.logs.reportId', { id })}
        </Link>
      </span>
    )
  }
  if (route) return <span className="font-mono text-xs">{route}</span>
  if (type && id) return <span>{`${words('target', type)} ${id}`}</span>
  return <span>—</span>
}

/** Date and time to the second, in the viewer's own time: a log is read by the second. */
function formatLogTime(value) {
  if (!value) return ''
  const date = parseDateTime(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(languageInfo().locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}
